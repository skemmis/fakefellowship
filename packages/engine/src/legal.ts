import { CONNECTIONS, MAP, MOUNT_DOOM, REGIONS } from './data/board.js';
import { BEARER } from './data/characters.js';
import { MAX_BATTLE_DICE, RING_DESTROY_COST } from './data/cards.js';
import { canAct } from './rules.js';
import type {
  Action,
  CharacterId,
  Faction,
  GameState,
  PlayerState,
  SymbolKind,
} from './types.js';

function symbolsAvailable(p: PlayerState, sym: SymbolKind): number {
  return p.tokens[sym] + p.hand.filter((c) => c.kind === 'region' && c.symbol === sym).length;
}

function canPayList(p: PlayerState, symbols: SymbolKind[]): boolean {
  const need: Partial<Record<SymbolKind, number>> = {};
  for (const s of symbols) need[s] = (need[s] ?? 0) + 1;
  return Object.entries(need).every(([s, n]) => symbolsAvailable(p, s as SymbolKind) >= (n ?? 0));
}

function friendlyAt(s: GameState, loc: string): number {
  return Object.values(s.friendly[loc] ?? {}).reduce((a, b) => a + (b ?? 0), 0);
}

/**
 * Enumerate legal actions for `playerId` (defaults to the active player).
 * Drives both the bots and the client UI. Travel options are enumerated
 * without troop/companion combinations (the UI composes those); bots get a
 * "bring everyone" variant so escorting is exercised.
 */
export function legalActions(s: GameState, playerId?: string): Action[] {
  if (s.phase !== 'playing') return [];
  const out: Action[] = [];
  const active = s.players[s.turn.playerIdx];
  const player = playerId ? s.players.find((p) => p.id === playerId)! : active;
  if (!player) return [];

  // --- Pending resolutions first ---------------------------------------
  if (s.pending) {
    const pend = s.pending;
    if (pend.type === 'discard') {
      if (player.id === pend.player) {
        for (const c of player.hand) out.push({ type: 'discard', card: c.id });
      }
      return out;
    }
    const present = player.characters.some((c) => s.characters[c]?.location === pend.location);
    if (present && canPayList(player, ['resistance'])) {
      for (let i = 0; i < pend.dice.length; i++) out.push({ type: 'reroll', die: i });
    }
    if (pend.type === 'battle' && present && canPayList(player, ['valor']) && pend.valorKills < (s.shadow[pend.location] ?? 0)) {
      out.push({ type: 'showValor' });
    }
    if (pend.type === 'search') {
      const phial = player.hand.find((c) => c.kind === 'event' && c.event === 'phial');
      if (phial) out.push({ type: 'playEvent', card: phial.id });
    }
    if (player.id === active.id) out.push({ type: 'confirm' });
    return out;
  }

  // --- Events (playable by anyone outside of rolls) ---------------------
  for (const card of player.hand) {
    if (card.kind !== 'event') continue;
    switch (card.event) {
      case 'athelas':
      case 'mithril':
      case 'gift':
        out.push({ type: 'playEvent', card: card.id });
        break;
      case 'council':
        if (s.supply.tokens.resistance > 0) out.push({ type: 'playEvent', card: card.id, symbol: 'resistance' });
        if (s.supply.tokens.stealth > 0) out.push({ type: 'playEvent', card: card.id, symbol: 'stealth' });
        break;
      case 'shadowfax':
        out.push({ type: 'playEvent', card: card.id, region: REGIONS[0].id });
        break;
      case 'beacons':
        out.push({ type: 'playEvent', card: card.id });
        break;
      case 'palantir':
        out.push({ type: 'playEvent', card: card.id });
        break;
      case 'eagles': {
        for (const c of player.characters) {
          const haven = Object.entries(s.siteStatus).find(([, st]) => st === 'haven');
          if (haven && s.characters[c]) {
            out.push({ type: 'playEvent', card: card.id, character: c, location: haven[0] });
          }
        }
        break;
      }
      case 'rohirrim_charge': {
        for (const loc of Object.keys(s.shadow)) {
          if ((s.shadow[loc] ?? 0) > 0 && friendlyAt(s, loc) > 0) {
            out.push({ type: 'playEvent', card: card.id, location: loc });
            break;
          }
        }
        break;
      }
      case 'ents': {
        if ((s.shadow['isengard'] ?? 0) > 0) out.push({ type: 'playEvent', card: card.id, location: 'isengard' });
        break;
      }
      case 'oath_dead': {
        const target = Object.keys(s.shadow).find((l) => MAP[l]?.region === 'gondor' && (s.shadow[l] ?? 0) > 0);
        if (target) out.push({ type: 'playEvent', card: card.id, location: target });
        break;
      }
      default:
        break; // haven_cloaks / ranger_paths need rich targets; UI composes them
    }
  }

  if (player.id !== active.id) return out;
  const p = active;

  // --- Character actions -------------------------------------------------
  for (const character of p.characters) {
    const st = s.characters[character];
    if (!st || !canAct(s, character)) continue;
    const here = st.location;

    // Travel (bearer cover variants; bots use bring-nothing or bring-all)
    for (const conn of CONNECTIONS[here]) {
      if (conn.cost && character !== 'gollum' && !canPayList(p, conn.cost)) continue;
      const bearerHere =
        character === BEARER ||
        (s.characters[BEARER]?.location === here && p.characters.includes(BEARER));
      if (character === BEARER || (character !== BEARER && s.characters[BEARER]?.location === here)) {
        // Moving the bearer (or bringing him along as a companion).
        const companions = character === BEARER ? [] : [BEARER];
        const base = { type: 'travel' as const, character, to: conn.to, companions };
        const stealthCost: SymbolKind[] = [...(conn.cost && character !== 'gollum' ? conn.cost : []), 'stealth'];
        if (canPayList(p, stealthCost)) out.push({ ...base, cover: 'stealth' });
        out.push({ ...base, cover: 'search' });
        if (bearerHere) out.push({ ...base, cover: 'ring' });
      }
      if (character !== BEARER) {
        out.push({ type: 'travel', character, to: conn.to });
        // Escort variant: bring all troops along.
        const troopsHere = s.friendly[here];
        if (troopsHere && friendlyAt(s, here) > 0) {
          out.push({ type: 'travel', character, to: conn.to, troops: { ...troopsHere } as Partial<Record<Faction, number>> });
        }
      }
    }

    // Fellowship: give/take a region card matching this region with a co-located player.
    const region = MAP[here].region;
    for (const other of s.solo ? [] : s.players) {
      if (other.id === p.id) continue;
      if (!other.characters.some((c) => s.characters[c]?.location === here)) continue;
      for (const card of p.hand) {
        if (card.kind === 'region' && card.region === region) {
          out.push({ type: 'fellowship', character, give: card.id, takeFrom: other.id });
        }
      }
      for (const card of other.hand) {
        if (card.kind === 'region' && card.region === region) {
          out.push({ type: 'fellowship', character, take: card.id, takeFrom: other.id });
        }
      }
    }

    // Prepare (solo: the card must match the character's current region)
    if (s.siteStatus[here] === 'haven') {
      for (const card of p.hand) {
        if (
          card.kind === 'region' &&
          s.supply.tokens[card.symbol] > 0 &&
          (!s.solo || card.region === MAP[here].region)
        ) {
          out.push({ type: 'prepare', character, card: card.id });
        }
      }
    }

    // Muster
    const muster = MAP[here].muster;
    if (muster && s.supply.factions[muster] > 0) {
      const free = character === 'eowyn' && muster === 'riders';
      if (free || canPayList(p, ['friendship'])) out.push({ type: 'muster', character });
    }

    // Attack
    if ((s.shadow[here] ?? 0) > 0 && friendlyAt(s, here) > 0) {
      out.push({ type: 'attack', character, dice: Math.min(MAX_BATTLE_DICE, friendlyAt(s, here)) });
    } else if (character === 'legolas') {
      const alt = CONNECTIONS[here].map((c) => c.to).find((l) => (s.shadow[l] ?? 0) > 0 && friendlyAt(s, l) > 0);
      if (alt) out.push({ type: 'attack', character, dice: MAX_BATTLE_DICE });
    }

    // Capture
    if (
      s.siteStatus[here] === 'stronghold' &&
      friendlyAt(s, here) > 0 &&
      (s.shadow[here] ?? 0) === 0 &&
      canPayList(p, Array(character === 'gimli' ? 2 : 3).fill('valor') as SymbolKind[])
    ) {
      out.push({ type: 'capture', character });
    }

    // Gandalf's kindled hope (reconstructed)
    if (character === 'gandalf' && !s.turn.abilityUsed['gandalf'] && s.siteStatus[here] === 'haven') {
      out.push({ type: 'ability', character });
    }
  }

  // Destroy the One Ring
  if (
    p.characters.includes(BEARER) &&
    s.characters[BEARER]?.location === MOUNT_DOOM &&
    s.objectives.every((o) => o.complete || o.id === 'destroy_ring') &&
    canAct(s, BEARER) &&
    canPayList(p, Array(RING_DESTROY_COST).fill('resistance') as SymbolKind[])
  ) {
    out.push({ type: 'destroyEmber' });
  }

  out.push({ type: 'endTurn' });
  return out;
}

/** Actions remaining per character under the 4+1 rule, for UI display. */
export function actionsRemaining(s: GameState): { character: CharacterId; remaining: number }[] {
  const p = s.players[s.turn.playerIdx];
  return p.characters.map((character) => {
    let remaining = 0;
    for (let i = 1; i <= 4; i++) {
      const probe = { ...s, turn: { ...s.turn, actionsUsed: { ...s.turn.actionsUsed } } };
      let count = 0;
      while (canAct(probe, character) && count < 5) {
        probe.turn.actionsUsed[character] = (probe.turn.actionsUsed[character] ?? 0) + 1;
        if (!probe.turn.actedOrder.includes(character)) {
          probe.turn.actedOrder = [...probe.turn.actedOrder, character];
        }
        count++;
      }
      remaining = count;
      break;
    }
    return { character, remaining };
  });
}
