import { CONNECTIONS, MAP, MOUNT_DOOM, REGIONS } from './data/board.js';
import { BEARER } from './data/characters.js';
import { ALT_CAPTURE, MAX_BATTLE_DICE, RING_DESTROY_COST } from './data/cards.js';
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

function objectiveOpen(s: GameState, id: string): boolean {
  return s.objectives.some((o) => o.id === id && !o.complete);
}

function othersAt(s: GameState, loc: string, except: CharacterId): boolean {
  return Object.entries(s.characters).some(([cid, st]) => cid !== except && st.location === loc);
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
    if (pend.type === 'mirror') {
      if (player.id === pend.player) out.push({ type: 'mirrorOrder', order: [...pend.cards] });
      return out;
    }
    if (pend.type === 'reposition') {
      if (player.id === pend.player) {
        for (const from of pend.from) {
          for (const [f, n] of Object.entries(s.friendly[from] ?? {})) {
            if ((n ?? 0) > 0) for (const to of pend.to) out.push({ type: 'reposition', from, faction: f as Faction, to });
          }
        }
        out.push({ type: 'confirm' });
      }
      return out;
    }
    if (pend.type === 'ordeal') {
      if (player.id === pend.player) {
        const ignoreCost = pend.objective === 'confront_balrog' ? 'resistance' : 'valor';
        const preventCost = pend.objective === 'confront_balrog' ? 'valor' : 'friendship';
        if (canPayList(player, [ignoreCost as SymbolKind])) {
          for (let i = 0; i < pend.dice.length; i++) {
            if (!pend.ignored.includes(i) && pend.dice[i] !== 'rout') out.push({ type: 'ignoreDie', die: i });
          }
        }
        if (canPayList(player, [preventCost as SymbolKind])) out.push({ type: 'preventHope' });
        out.push({ type: 'confirm' });
      }
      return out;
    }
    if (pend.type === 'wheels') {
      if (!pend.mode && pend.remaining === undefined) {
        if (player.id === active.id) {
          out.push({ type: 'wheels', pick: 'despair' });
          const anyTroops = Object.values(s.friendly).some((fs) => Object.values(fs).some((n) => (n ?? 0) > 0));
          if (anyTroops) out.push({ type: 'wheels', pick: 'oath' });
          for (const pl of s.players) {
            const wealth = pl.hand.length + Object.values(pl.tokens).reduce((a, b) => a + b, 0);
            if (wealth > 0) out.push({ type: 'wheels', pick: 'doubt', toPlayer: pl.id });
          }
        }
      } else if (pend.mode === 'oath') {
        if (player.id === active.id) {
          for (const [loc, fs] of Object.entries(s.friendly)) {
            for (const [f, n] of Object.entries(fs)) {
              if ((n ?? 0) > 0) out.push({ type: 'wheels', location: loc, faction: f as Faction });
            }
          }
        }
      } else if (player.id === pend.player) {
        for (const c of player.hand) out.push({ type: 'wheels', card: c.id });
        for (const [sym, n] of Object.entries(player.tokens)) {
          if (n > 0) out.push({ type: 'wheels', symbol: sym as SymbolKind });
        }
      }
      return out;
    }
    const present = player.characters.some((c) => s.characters[c]?.location === pend.location);
    if (present && canPayList(player, ['resistance'])) {
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
    // Light and Flame: Gandalf present at a battle may spend Valor to change
    // battle dice to any faces (as the White, searches too). Bots take the
    // obvious best face; the UI composes richer picks.
    {
      const white = (s.objProgress['gandalf_white'] ?? 0) > 0;
      const canBend = pend.type === 'battle' || (pend.type === 'search' && white);
      if (
        canBend &&
        player.characters.includes('gandalf') &&
        s.characters['gandalf']?.location === pend.location &&
        canPayList(player, ['valor']) &&
        pend.dice.some((f) => (pend.type === 'search' ? f !== 'slip' : f !== 'rout'))
      ) {
        out.push({ type: 'gandalfWhite', faces: pend.dice.map(() => (pend.type === 'search' ? 'slip' : 'rout')) });
      }
    }
    // Faramir's ambush: 1 Stealth turns a battle die to Rout.
    if (
      pend.type === 'battle' &&
      pend.ambush &&
      player.characters.includes('faramir') &&
      s.characters['faramir']?.location === pend.location &&
      canPayList(player, ['stealth'])
    ) {
      for (let i = 0; i < pend.dice.length; i++) {
        if (pend.dice[i] !== 'rout') out.push({ type: 'faramirAmbush', die: i });
      }
    }
    // Shieldmaiden No Longer: Éowyn may turn a battle die to the Nazgûl face.
    if (
      pend.type === 'battle' &&
      objectiveOpen(s, 'shieldmaiden') &&
      player.characters.includes('eowyn') &&
      s.characters['eowyn']?.location === pend.location &&
      canPayList(player, ['valor', 'valor'])
    ) {
      for (let i = 0; i < pend.dice.length; i++) {
        if (pend.dice[i] !== 'wraith') out.push({ type: 'eowynStrike', die: i });
      }
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
      // Arwen may Prepare one off-region card per turn in the solo game.
      const arwenFree = character === 'arwen' && !s.turn.abilityUsed['arwen_prepare'];
      for (const card of p.hand) {
        if (
          card.kind === 'region' &&
          s.supply.tokens[card.symbol] > 0 &&
          (!s.solo || card.region === MAP[here].region || arwenFree)
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

    // Capture (objective cards open Osgiliath to Faramir and Dunland to all)
    const objCapture =
      s.siteStatus[here] !== 'haven' &&
      ((here === 'osgiliath' && character === 'faramir' && objectiveOpen(s, 'secure_anduin')) ||
        (here === 'dunland' && objectiveOpen(s, 'frecas_heirs')));
    const captureSite =
      character !== 'gollum' &&
      (s.siteStatus[here] === 'stronghold' || objCapture) &&
      friendlyAt(s, here) > 0 &&
      (s.shadow[here] ?? 0) === 0;
    if (captureSite && canPayList(p, Array(character === 'boromir' ? 2 : 3).fill('valor') as SymbolKind[])) {
      out.push({ type: 'capture', character });
    }
    if (captureSite) {
      const grant = ALT_CAPTURE.find(
        (g) => g.location === here && (!g.character || g.character === character) && objectiveOpen(s, g.objective),
      );
      if (grant && canPayList(p, grant.cost)) out.push({ type: 'capture', character, alt: true });
    }

    // Objective-card actions
    if (objectiveOpen(s, 'blessing_elves') && here === 'rivendell' && othersAt(s, here, character)) {
      if (canPayList(p, ['valor', 'valor', 'valor'])) out.push({ type: 'objective', id: 'blessing_elves', character, variant: 'valor' });
      if (canPayList(p, ['stealth', 'stealth', 'stealth'])) out.push({ type: 'objective', id: 'blessing_elves', character, variant: 'stealth' });
    }
    if (objectiveOpen(s, 'challenge_sauron') && here === 'north_ithilien') {
      const at = s.friendly[here] ?? {};
      if ((at.riders ?? 0) >= 2 && (at.sylvan ?? 0) >= 2 && (at.vale ?? 0) >= 3) {
        out.push({ type: 'objective', id: 'challenge_sauron', character });
      }
    }
    if (objectiveOpen(s, 'arwen_banner') && character === 'arwen' && here === 'minas_tirith' && s.siteStatus[here] === 'haven' && canPayList(p, ['friendship'])) {
      const at = s.friendly[here] ?? {};
      if ((at.vale ?? 0) >= 1 && (at.riders ?? 0) >= 1 && (at.sylvan ?? 0) >= 1 && (at.deepholm ?? 0) >= 1) {
        out.push({ type: 'objective', id: 'arwen_banner', character });
      }
    }
    if (objectiveOpen(s, 'unseat_denethor') && here === 'minas_tirith' && othersAt(s, here, character) && canPayList(p, ['stealth', 'stealth', 'friendship', 'valor'])) {
      out.push({ type: 'objective', id: 'unseat_denethor', character });
    }
    if (objectiveOpen(s, 'free_theoden') && here === 'edoras' && othersAt(s, here, character) && canPayList(p, ['friendship', 'friendship', 'resistance'])) {
      out.push({ type: 'objective', id: 'free_theoden', character });
    }
    if (objectiveOpen(s, 'oathbreakers') && character === 'aragorn' && here === 'edoras' && !(s.objProgress['oathbreakers_ride'] ?? 0)) {
      out.push({ type: 'objective', id: 'oathbreakers', character });
    }
    if (objectiveOpen(s, 'hobbits_loyalty') && character === 'merry_pippin' && s.siteStatus[here] === 'haven' && s.supply.tokens.friendship > 0) {
      const group = MAP[here].muster;
      if (group && !(s.objProgress[`hobbits_${group}`] ?? 0)) {
        const match = p.hand.find((cd) => cd.kind === 'region' && cd.symbol === 'friendship' && cd.region === MAP[here].region);
        if (match) out.push({ type: 'objective', id: 'hobbits_loyalty', character, card: match.id });
      }
    }
    if (objectiveOpen(s, 'shelobs_lair') && character === 'frodo_sam' && here === 'minas_morgul' && s.characters['gollum']?.location === here) {
      out.push({ type: 'objective', id: 'shelobs_lair', character });
    }
    if (objectiveOpen(s, 'confront_balrog') && character === 'gandalf' && here === 'moria') {
      out.push({ type: 'objective', id: 'confront_balrog', character });
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
      const match = s.playerDiscard.find(
        (cd) => cd.kind === 'region' && cd.symbol === 'resistance' && cd.region === MAP[here].region,
      );
      if (match) out.push({ type: 'ability', character, card: match.id });
    }
    if (character === 'gollum' && !s.turn.abilityUsed['gollum_slink'] && s.playerDiscard.length > 0) {
      out.push({ type: 'ability', character, card: s.playerDiscard[s.playerDiscard.length - 1].id });
    }
  }

  // Faramir's Ambush: leading troops into a location earns a FREE Attack there,
  // available even if Faramir has no actions left (so it isn't gated by canAct).
  if (s.turn.freeAttack) {
    const fc = s.turn.freeAttack.character;
    const floc = s.turn.freeAttack.location;
    if (
      p.characters.includes(fc) &&
      s.characters[fc]?.location === floc &&
      (s.shadow[floc] ?? 0) > 0 &&
      friendlyAt(s, floc) > 0 &&
      !out.some((a) => a.type === 'attack' && a.character === fc)
    ) {
      out.push({ type: 'attack', character: fc, dice: Math.min(MAX_BATTLE_DICE, friendlyAt(s, floc)) });
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
