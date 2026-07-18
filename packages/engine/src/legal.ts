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
    const gandalfHere = pend.type === 'battle' && s.characters['gandalf']?.location === pend.location;
    if (present && (canPayList(player, ['resistance']) || (gandalfHere && canPayList(player, ['valor'])))) {
      for (let i = 0; i < pend.dice.length; i++) out.push({ type: 'reroll', die: i });
    }
    // Free once-per-roll rerolls: Aragorn (searches), Galadriel (battles with elves).
    if (present && !pend.freeRerollUsed) {
      const grants =
        pend.type === 'search'
          ? player.characters.includes('aragorn') && s.characters['aragorn']?.location === pend.location
          : player.characters.includes('galadriel') &&
            s.characters['galadriel']?.location === pend.location &&
            (s.friendly[pend.location]?.sylvan ?? 0) > 0;
      if (grants) {
        for (let i = 0; i < pend.dice.length; i++) out.push({ type: 'reroll', die: i, free: true });
      }
    }
    // Sam's aid: Frodo's player may neutralize harmful search dice.
    if (
      pend.type === 'search' &&
      player.characters.includes('frodo_sam') &&
      s.characters['frodo_sam']?.location === pend.location &&
      canPayList(player, ['friendship'])
    ) {
      for (let i = 0; i < pend.dice.length; i++) {
        if ((pend.dice[i] === 'weary' || pend.dice[i] === 'exposed') && !pend.ignored.includes(i)) {
          out.push({ type: 'ignoreDie', die: i });
        }
      }
    }
    if (pend.type === 'battle' && present && canPayList(player, ['valor']) && pend.valorKills < (s.shadow[pend.location] ?? 0)) {
      out.push({ type: 'showValor' });
    }
    // Tom Bombadil may reroll up to 3 dice of the pending roll.
    const tom = player.hand.find((c) => c.kind === 'event' && c.event === 'tom_bombadil');
    if (tom && pend.dice.length > 0) {
      const harmful = pend.dice
        .map((f, i) => ({ f, i }))
        .filter(({ f }) =>
          pend.type === 'search' ? f === 'weary' || f === 'exposed' : f === 'wraith' || f === 'overrun' || f === 'exchange',
        )
        .slice(0, 3)
        .map(({ i }) => i);
      if (harmful.length > 0) out.push({ type: 'playEvent', card: tom.id, dice: harmful });
    }
    if (player.id === active.id) out.push({ type: 'confirm' });
    return out;
  }

  // --- Any-turn abilities for this player ------------------------------
  for (const c of player.characters) {
    const loc = s.characters[c]?.location;
    if (!loc) continue;
    if (c === 'legolas' && canPayList(player, ['stealth'])) {
      const targets = [loc, ...CONNECTIONS[loc].map((cn) => cn.to)].filter((l) => (s.shadow[l] ?? 0) > 0);
      if (targets.length > 0) out.push({ type: 'ability', character: c, to: targets[0] });
      if ((s.wraiths[MAP[loc].region] ?? 0) > 0) out.push({ type: 'ability', character: c, mode: 'nazgul' });
    }
    if (c === 'merry_pippin' && canPayList(player, ['friendship']) && (s.wraiths[MAP[loc].region] ?? 0) < 4) {
      out.push({ type: 'ability', character: c, mode: 'distract' });
    }
    if (c === 'galadriel' && s.siteStatus[loc] === 'haven' && s.unusedEvents.length > 0 && canPayList(player, ['friendship'])) {
      out.push({ type: 'ability', character: c, mode: 'summon' });
    }
  }

  // --- Events (playable by anyone outside of rolls). Bots get a bounded
  // sample of simple targetings; the UI composes richer ones. -------------
  for (const card of player.hand) {
    if (card.kind !== 'event') continue;
    switch (card.event) {
      case 'tom_bombadil':
        if (s.hope < 8) out.push({ type: 'playEvent', card: card.id }); // gain-hope mode
        break;
      case 'orc_infighting': {
        const target = Object.keys(s.shadow).find((l) => (s.shadow[l] ?? 0) > 0);
        if (target) out.push({ type: 'playEvent', card: card.id, location: target });
        break;
      }
      case 'gifts_elves':
        for (const sym of ['stealth', 'resistance'] as const) {
          if (s.supply.tokens[sym] > 0) {
            out.push({ type: 'playEvent', card: card.id, symbol: sym, toPlayer: player.id });
          }
        }
        break;
      case 'lembas':
        if (player.id === active.id) {
          out.push({ type: 'playEvent', card: card.id, character: active.characters[0] });
        }
        break;
      case 'elronds_foresight':
        if (player.id === active.id && s.playerDeck.length > 0) {
          out.push({ type: 'playEvent', card: card.id });
        }
        break;
      case 'palantir_gaze': {
        // Aim the Eye at the character farthest from Frodo (bot heuristic).
        const c = player.characters.find((cc) => cc !== BEARER && s.characters[cc]);
        if (c) out.push({ type: 'playEvent', card: card.id, character: c });
        break;
      }
      case 'entmoot':
        if (s.supply.factions.sylvan > 0) out.push({ type: 'playEvent', card: card.id, count: 3 });
        break;
      case 'eagles': {
        const c = player.characters.find((cc) => cc !== BEARER && s.characters[cc]);
        const haven = Object.entries(s.siteStatus).find(([, st]) => st === 'haven');
        if (c && haven) out.push({ type: 'playEvent', card: card.id, character: c, location: haven[0] });
        break;
      }
      case 'conflicting_orders': {
        const from = Object.keys(s.shadow).find((l) => (s.shadow[l] ?? 0) > 0);
        const to = from ? CONNECTIONS[from].find((cn) => !MAP[cn.to].haven)?.to : undefined;
        if (from && to) out.push({ type: 'playEvent', card: card.id, location: from, location2: to });
        break;
      }
      default:
        break; // red_arrow, council, gwaihir, rohan_horses, elven_cloaks: UI-composed targets
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
      // Faramir the ranger spends one fewer symbol on special paths.
      const effCost = character === 'faramir' ? conn.cost?.slice(1) : conn.cost;
      if (effCost && effCost.length > 0 && !canPayList(p, effCost)) continue;
      const bearerHere =
        character === BEARER ||
        (s.characters[BEARER]?.location === here && p.characters.includes(BEARER));
      if (character === BEARER || (character !== BEARER && s.characters[BEARER]?.location === here)) {
        // Moving the bearer (or bringing him along as a companion).
        const companions = character === BEARER ? [] : [BEARER];
        const base = { type: 'travel' as const, character, to: conn.to, companions };
        const stealthCost: SymbolKind[] = [...(effCost ?? []), 'stealth'];
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
      // Boromir is tempted: Resistance cards never pass through his hands.
      const ok = (card: { kind: string; region?: string; symbol?: string }) =>
        card.kind === 'region' &&
        card.region === region &&
        !(character === 'boromir' && card.symbol === 'resistance');
      for (const card of p.hand) {
        if (ok(card)) out.push({ type: 'fellowship', character, give: card.id, takeFrom: other.id });
      }
      for (const card of other.hand) {
        if (ok(card)) out.push({ type: 'fellowship', character, take: card.id, takeFrom: other.id });
      }
    }

    // Prepare (Gollum needs no haven; solo: card must match the region)
    if (s.siteStatus[here] === 'haven' || character === 'gollum') {
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

    // Muster (home armies muster free)
    const muster = MAP[here].muster;
    if (muster && s.supply.factions[muster] > 0 && character !== 'gollum') {
      const FREE: Record<string, string> = { eowyn: 'riders', arwen: 'sylvan', boromir: 'vale', gimli: 'deepholm' };
      if (FREE[character] === muster || canPayList(p, ['friendship'])) {
        out.push({ type: 'muster', character });
      }
    }

    // Attack
    if ((s.shadow[here] ?? 0) > 0 && friendlyAt(s, here) > 0 && character !== 'gollum') {
      out.push({ type: 'attack', character, dice: Math.min(MAX_BATTLE_DICE, friendlyAt(s, here)) });
    }

    // Capture
    if (
      character !== 'gollum' &&
      s.siteStatus[here] === 'stronghold' &&
      friendlyAt(s, here) > 0 &&
      (s.shadow[here] ?? 0) === 0 &&
      canPayList(p, Array(character === 'boromir' ? 2 : 3).fill('valor') as SymbolKind[])
    ) {
      out.push({ type: 'capture', character });
    }

    // Activated abilities (once per turn)
    if (character === 'aragorn' && !s.turn.abilityUsed['aragorn_blade'] && s.objectives.some((o) => o.complete) && (s.shadow[here] ?? 0) > 0) {
      out.push({ type: 'ability', character });
    }
    if (character === 'eomer' && !s.turn.abilityUsed['eomer_ride']) {
      const free = CONNECTIONS[here].find((cn) => !cn.cost);
      if (free) out.push({ type: 'ability', character, to: free.to });
    }
    if (character === 'gimli' && !s.turn.abilityUsed['gimli_craft'] && s.supply.tokens.valor > 0) {
      out.push({ type: 'ability', character });
    }
    if (character === 'legolas') {
      if (!s.turn.abilityUsed['legolas_walk'] && s.supply.tokens.stealth > 0) out.push({ type: 'ability', character });
      if (!s.turn.abilityUsed['legolas_sight'] && s.shadowDeck.length > 0) out.push({ type: 'ability', character, mode: 'peek' });
    }
    if (character === 'merry_pippin') {
      if (!s.turn.abilityUsed['mp_friend'] && s.supply.tokens.friendship > 0) out.push({ type: 'ability', character });
      if (s.characters[BEARER]?.location === here && canPayList(p, ['friendship', 'friendship', 'friendship'])) {
        out.push({ type: 'ability', character, mode: 'song' });
      }
    }
    if (character === 'galadriel' && !s.turn.abilityUsed['galadriel_mirror'] && s.playerDeck.length > 0) {
      out.push({ type: 'ability', character });
    }
    if (character === 'faramir' && !s.turn.abilityUsed['faramir_wisdom'] && s.siteStatus[here] === 'haven') {
      const match = s.playerDiscard.find((cd) => cd.kind === 'region' && cd.region === MAP[here].region);
      if (match) out.push({ type: 'ability', character, card: match.id });
    }
    if (character === 'gollum' && !s.turn.abilityUsed['gollum_slink'] && s.playerDiscard.length > 0) {
      out.push({ type: 'ability', character, card: s.playerDiscard[s.playerDiscard.length - 1].id });
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
