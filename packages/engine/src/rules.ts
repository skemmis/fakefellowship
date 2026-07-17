import {
  ACTIONS_PRIMARY,
  ACTIONS_SECONDARY,
  BATTLE_DIE,
  CAPTURE_COST,
  CAPTURE_HOPE,
  CARDS_PER_TURN,
  EVENTS,
  HAND_LIMIT,
  HAVEN_LOST_HOPE,
  HOPE_MAX,
  MAX_BATTLE_DICE,
  MAX_SEARCH_DICE,
  OBJECTIVE_MAP,
  RING_DESTROY_COST,
  SEARCH_DIE,
  SPECIAL_SHADOW_INFO,
  THREAT_TRACK,
} from './data/cards.js';
import {
  BATTLE_LINES,
  CONNECTIONS,
  connection,
  MAP,
  MORDOR,
  MOUNT_DOOM,
  REGION_MAP,
  regionDistance,
  regionsToward,
} from './data/board.js';
import { BEARER, CHARACTER_MAP } from './data/characters.js';
import { makeRng, next, nextInt, shuffle, type Rng } from './rng.js';
import type {
  Action,
  ActionResult,
  BattleFace,
  CharacterId,
  Faction,
  GameEvent,
  GameState,
  LocationId,
  PlayerId,
  PlayerState,
  RegionId,
  SearchContext,
  SearchFace,
  ShadowCard,
  SymbolKind,
} from './types.js';

export class RuleError extends Error {}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function activePlayer(s: GameState): PlayerState {
  return s.players[s.turn.playerIdx];
}

function charName(id: CharacterId): string {
  return CHARACTER_MAP[id].name;
}

function locName(id: LocationId): string {
  return MAP[id].name;
}

function regionOf(loc: LocationId): RegionId {
  return MAP[loc].region;
}

function friendlyAt(s: GameState, loc: LocationId): number {
  return Object.values(s.friendly[loc] ?? {}).reduce((a, b) => a + (b ?? 0), 0);
}

function isHaven(s: GameState, loc: LocationId): boolean {
  return s.siteStatus[loc] === 'haven';
}

function bearerInPlay(s: GameState): boolean {
  return BEARER in s.characters;
}

function bearerLocation(s: GameState): LocationId | null {
  return s.characters[BEARER]?.location ?? null;
}

function changeHope(s: GameState, delta: number, events: GameEvent[], why: string): void {
  if (s.phase !== 'playing') return;
  const before = s.hope;
  s.hope = Math.max(0, Math.min(HOPE_MAX, s.hope + delta));
  if (s.hope !== before) {
    events.push({
      kind: delta < 0 ? 'shadow' : 'action',
      text: `Hope ${delta < 0 ? 'falls' : 'rises'} to ${s.hope} (${why}).`,
    });
  }
  if (s.hope <= 0) {
    s.phase = 'lost';
    s.lossReason = 'Frodo has lost all hope';
    events.push({ kind: 'loss', text: 'The hope marker reaches despair. The quest fails.' });
  }
}

/**
 * Spend symbols for a player: tokens first, then discard matching region
 * cards. (Simplification: the engine auto-picks which card to discard;
 * players in the physical game choose.)
 */
function canPay(p: PlayerState, symbols: SymbolKind[]): boolean {
  const need: Record<string, number> = {};
  for (const sym of symbols) need[sym] = (need[sym] ?? 0) + 1;
  for (const [sym, n] of Object.entries(need)) {
    const tokens = p.tokens[sym as SymbolKind];
    const cards = p.hand.filter((c) => c.kind === 'region' && c.symbol === sym).length;
    if (tokens + cards < n) return false;
  }
  return true;
}

function pay(s: GameState, p: PlayerState, symbols: SymbolKind[], events: GameEvent[]): void {
  if (!canPay(p, symbols)) {
    throw new RuleError(`Not enough symbols (need ${symbols.join(', ')}).`);
  }
  for (const sym of symbols) {
    if (p.tokens[sym] > 0) {
      p.tokens[sym] -= 1;
      s.supply.tokens[sym] += 1;
      events.push({ kind: 'action', text: `${p.name} spends a ${sym} token.` });
    } else {
      const idx = p.hand.findIndex((c) => c.kind === 'region' && c.symbol === sym);
      const [card] = p.hand.splice(idx, 1);
      s.playerDiscard.push(card);
      events.push({ kind: 'action', text: `${p.name} discards a region card for ${sym}.` });
    }
  }
}

// ---------------------------------------------------------------------------
// Havens falling / troops
// ---------------------------------------------------------------------------

/** A haven with shadow troops and no friendly troops becomes a stronghold. */
function checkHavens(s: GameState, events: GameEvent[]): void {
  for (const [loc, status] of Object.entries(s.siteStatus)) {
    if (status !== 'haven') continue;
    if ((s.shadow[loc] ?? 0) > 0 && friendlyAt(s, loc) === 0) {
      s.siteStatus[loc] = 'stronghold';
      events.push({ kind: 'haven', text: `${locName(loc)} is overrun and falls to the shadow!` });
      changeHope(s, -HAVEN_LOST_HOPE, events, `${locName(loc)} lost`);
    }
  }
}

function addShadow(s: GameState, loc: LocationId, n: number, events: GameEvent[], fromCard: boolean): void {
  if (fromCard && s.spawnStopped[loc]) {
    events.push({ kind: 'shadow', text: `${locName(loc)} is held by the Free Peoples — no shadow troops appear.` });
    return;
  }
  let placed = 0;
  for (let i = 0; i < n; i++) {
    if (s.supply.shadow <= 0) {
      changeHope(s, -1, events, 'the shadow troop supply is empty');
      continue;
    }
    s.supply.shadow -= 1;
    s.shadow[loc] = (s.shadow[loc] ?? 0) + 1;
    placed++;
  }
  if (placed > 0) {
    events.push({ kind: 'shadow', text: `${placed} shadow troop${placed > 1 ? 's' : ''} muster at ${locName(loc)} (${s.shadow[loc]}).` });
  }
}

function removeShadow(s: GameState, loc: LocationId, n: number): number {
  const have = s.shadow[loc] ?? 0;
  const removed = Math.min(have, n);
  s.shadow[loc] = have - removed;
  if (s.shadow[loc] === 0) delete s.shadow[loc];
  s.supply.shadow += removed;
  return removed;
}

/** Remove friendly troops; the engine auto-picks from the largest army present. */
function removeFriendly(s: GameState, loc: LocationId, n: number, events: GameEvent[]): number {
  const at = s.friendly[loc];
  if (!at) return 0;
  let removed = 0;
  for (let i = 0; i < n; i++) {
    const factions = (Object.keys(at) as Faction[]).filter((f) => (at[f] ?? 0) > 0);
    if (factions.length === 0) break;
    factions.sort((a, b) => (at[b] ?? 0) - (at[a] ?? 0));
    const f = factions[0];
    at[f]! -= 1;
    s.supply.factions[f] += 1;
    removed++;
  }
  if (removed > 0) {
    events.push({ kind: 'battle', text: `${removed} friendly troop${removed > 1 ? 's' : ''} fall at ${locName(loc)}.` });
  }
  return removed;
}

// ---------------------------------------------------------------------------
// Objectives
// ---------------------------------------------------------------------------

function completeObjective(s: GameState, id: string, events: GameEvent[]): void {
  const obj = s.objectives.find((o) => o.id === id);
  if (!obj || obj.complete) return;
  obj.complete = true;
  const def = OBJECTIVE_MAP[id];
  events.push({ kind: 'objective', text: `Objective complete: ${def.name}!` });
  // Rewards (reconstructed).
  switch (id) {
    case 'blessing_elves': {
      changeHope(s, 1, events, def.name);
      if (s.supply.tokens.stealth > 0) {
        s.supply.tokens.stealth -= 1;
        activePlayer(s).tokens.stealth += 1;
        events.push({ kind: 'objective', text: `${activePlayer(s).name} takes a stealth token.` });
      }
      break;
    }
    case 'challenge_sauron':
      changeHope(s, 2, events, def.name);
      break;
    default:
      // Reconstructed reward: completed objectives rekindle hope.
      changeHope(s, 2, events, def.name);
  }
}

function checkStateObjectives(s: GameState, events: GameEvent[]): void {
  const gondorTroops = Object.values(s.friendly).reduce((a, f) => a + (f.vale ?? 0), 0);
  const riderTroops = Object.values(s.friendly).reduce((a, f) => a + (f.riders ?? 0), 0);
  if (gondorTroops >= 5) completeObjective(s, 'oathbreakers', events);
  if (riderTroops >= 6) completeObjective(s, 'ride_eored', events);
  if (
    bearerLocation(s) === 'rivendell' &&
    (s.shadow['rivendell'] ?? 0) === 0
  ) {
    completeObjective(s, 'blessing_elves', events);
  }
}

// ---------------------------------------------------------------------------
// Dice: rolling creates a pending state; `confirm` applies it.
// ---------------------------------------------------------------------------

function rollSearch(s: GameState, rng: Rng, context: SearchContext, loc: LocationId, events: GameEvent[]): void {
  const wraithsInRegion = s.wraiths[regionOf(loc)] ?? 0;
  const shadowHere = context === 'ring' ? 0 : s.shadow[loc] ?? 0;
  const extra = context === 'final' ? HOPE_MAX - s.hope : 0;
  let diceCount = Math.min(MAX_SEARCH_DICE, wraithsInRegion + shadowHere + extra);
  if (context !== 'final') {
    // Arwen (reconstructed): searches with her beside Frodo roll 1 fewer die.
    const arwen = s.characters['arwen'];
    if (arwen && arwen.location === loc && diceCount > 1) diceCount -= 1;
  }
  if (diceCount <= 0) {
    if (context === 'final') winGame(s, events);
    else events.push({ kind: 'search', text: `No enemies near ${locName(loc)} — Frodo passes unseen.` });
    return;
  }
  const dice: SearchFace[] = [];
  for (let i = 0; i < diceCount; i++) dice.push(SEARCH_DIE[nextInt(rng, 6)]);
  s.pending = { type: 'search', context, location: loc, dice };
  events.push({
    kind: 'search',
    text: `Search at ${locName(loc)}: [${dice.join(' ')}] — spend resistance to reroll, then confirm.`,
  });
}

function applySearch(s: GameState, events: GameEvent[]): void {
  const pend = s.pending;
  if (!pend || pend.type !== 'search') return;
  s.pending = null;
  const loc = pend.location;
  for (const face of pend.dice) {
    if (s.phase !== 'playing') return;
    switch (face) {
      case 'slip':
        break;
      case 'weary':
        changeHope(s, -1, events, 'weary');
        break;
      case 'exposed':
        if (isHaven(s, loc)) {
          events.push({ kind: 'search', text: 'Exposed — but the haven shelters Frodo.' });
        } else {
          changeHope(s, -1, events, 'exposed');
        }
        break;
      case 'recall': {
        if (regionOf(loc) === MORDOR) break;
        // Move 1 Nazgûl to Mordor: take from Frodo's region if possible,
        // otherwise from the largest group.
        const from =
          (s.wraiths[regionOf(loc)] ?? 0) > 0
            ? regionOf(loc)
            : Object.entries(s.wraiths).sort((a, b) => b[1] - a[1]).find(([, n]) => n > 0)?.[0];
        if (from) {
          s.wraiths[from] -= 1;
          s.wraiths[MORDOR] = (s.wraiths[MORDOR] ?? 0) + 1;
          events.push({ kind: 'search', text: `A Nazgûl is recalled from ${REGION_MAP[from].name} to Mordor.` });
        }
        break;
      }
    }
  }
  if (pend.context === 'final' && s.phase === 'playing' && s.hope >= 1) {
    winGame(s, events);
  }
}

function winGame(s: GameState, events: GameEvent[]): void {
  completeObjective(s, 'destroy_ring', events);
  s.phase = 'won';
  events.push({
    kind: 'win',
    text: 'The One Ring falls into the fire. Barad-dûr crumbles — Middle-earth is saved!',
  });
}

function rollBattle(s: GameState, rng: Rng, loc: LocationId, source: 'attack' | 'shadow', requested: number | undefined, events: GameEvent[]): void {
  let diceCount: number;
  if (source === 'attack') {
    const cap = Math.min(requested ?? MAX_BATTLE_DICE, friendlyAt(s, loc));
    diceCount = Math.max(1, cap);
  } else {
    diceCount = Math.min(MAX_BATTLE_DICE, s.shadow[loc] ?? 0);
  }
  if (diceCount <= 0) return;
  const dice: BattleFace[] = [];
  for (let i = 0; i < diceCount; i++) dice.push(BATTLE_DIE[nextInt(rng, 6)]);
  s.pending = { type: 'battle', location: loc, source, dice, valorKills: 0 };
  events.push({
    kind: 'battle',
    text: `Battle at ${locName(loc)}: [${dice.join(' ')}] — spend resistance to reroll or valor to slay, then confirm.`,
  });
}

function applyBattle(s: GameState, events: GameEvent[]): void {
  const pend = s.pending;
  if (!pend || pend.type !== 'battle') return;
  s.pending = null;
  const loc = pend.location;
  const region = regionOf(loc);
  const faramirHere = s.characters['faramir']?.location === loc;
  const eowynHere = s.characters['eowyn']?.location === loc;
  let shadowKilled = pend.valorKills;
  let friendlyLost = 0;
  for (const face of pend.dice) {
    switch (face) {
      case 'rout':
        shadowKilled += 1;
        break;
      case 'exchange':
        shadowKilled += 1;
        friendlyLost += 1;
        break;
      case 'overrun':
        if (!isHaven(s, loc) && !faramirHere) friendlyLost += 1;
        break;
      case 'wraith':
        if ((s.wraiths[region] ?? 0) > 0) {
          if (eowynHere) {
            s.wraiths[region] -= 1;
            s.wraiths[MORDOR] = (s.wraiths[MORDOR] ?? 0) + 1;
            events.push({ kind: 'battle', text: `Éowyn strikes — a Nazgûl in ${REGION_MAP[region].name} is destroyed and returns to Mordor.` });
          } else {
            friendlyLost += 2;
          }
        }
        break;
    }
  }
  const slain = removeShadow(s, loc, shadowKilled);
  if (slain > 0) events.push({ kind: 'battle', text: `${slain} shadow troop${slain > 1 ? 's' : ''} slain at ${locName(loc)}.` });
  if (friendlyLost > 0) removeFriendly(s, loc, friendlyLost, events);
  checkHavens(s, events);
  checkStateObjectives(s, events);
}

// ---------------------------------------------------------------------------
// Shadow phase
// ---------------------------------------------------------------------------

function drawShadowCard(s: GameState, rng: Rng): ShadowCard | undefined {
  if (s.shadowDeck.length === 0) {
    if (s.shadowDiscard.length === 0) return undefined;
    s.shadowDeck = shuffle(rng, [...s.shadowDiscard]);
    s.shadowDiscard = [];
  }
  return s.shadowDeck.pop();
}

function advanceLine(s: GameState, lineId: string, events: GameEvent[]): void {
  const line = BATTLE_LINES.find((l) => l.id === lineId);
  if (!line) return;
  events.push({ kind: 'shadow', text: `The shadow advances: ${line.name}.` });
  // Front troops move first; troops at the end of the line hold position.
  for (let i = line.path.length - 2; i >= 0; i--) {
    const from = line.path[i];
    const to = line.path[i + 1];
    const n = s.shadow[from] ?? 0;
    if (n > 0) {
      delete s.shadow[from];
      s.shadow[to] = (s.shadow[to] ?? 0) + n;
      events.push({ kind: 'shadow', text: `${n} shadow troop${n > 1 ? 's' : ''} advance from ${locName(from)} to ${locName(to)}.` });
    }
  }
  // Battles frontmost-first wherever both sides now stand.
  for (let i = line.path.length - 1; i >= 0; i--) {
    const loc = line.path[i];
    if ((s.shadow[loc] ?? 0) > 0 && friendlyAt(s, loc) > 0) {
      s.queue.unshift({ step: 'battle', location: loc, source: 'shadow' });
    }
  }
  checkHavens(s, events);
}

function moveNazgulCloser(s: GameState, count: number, events: GameEvent[]): void {
  const target = bearerLocation(s);
  if (!target) return;
  const frodoRegion = regionOf(target);
  for (let i = 0; i < count; i++) {
    // Closest Nazgûl not already in Frodo's region; ties: most Nazgûl, then name.
    const candidates = Object.entries(s.wraiths)
      .filter(([r, n]) => n > 0 && r !== frodoRegion)
      .map(([r, n]) => ({ r, n, d: regionDistance(r, frodoRegion) }))
      .sort((a, b) => a.d - b.d || b.n - a.n || a.r.localeCompare(b.r));
    if (candidates.length === 0) return;
    const from = candidates[0].r;
    const options = regionsToward(from, frodoRegion).sort();
    const to = options[0] ?? from;
    s.wraiths[from] -= 1;
    s.wraiths[to] = (s.wraiths[to] ?? 0) + 1;
    events.push({ kind: 'shadow', text: `A Nazgûl sweeps from ${REGION_MAP[from].name} into ${REGION_MAP[to].name}.` });
  }
}

function deployNazgulToEye(s: GameState, count: number, events: GameEvent[]): void {
  if (s.eye === MORDOR) {
    // Recall instead: pull from the largest group outside Mordor.
    for (let i = 0; i < count; i++) {
      const from = Object.entries(s.wraiths)
        .filter(([r, n]) => n > 0 && r !== MORDOR)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
      if (!from) return;
      s.wraiths[from[0]] -= 1;
      s.wraiths[MORDOR] = (s.wraiths[MORDOR] ?? 0) + 1;
      events.push({ kind: 'shadow', text: `A Nazgûl is recalled from ${REGION_MAP[from[0]].name} to Mordor.` });
    }
    return;
  }
  for (let i = 0; i < count; i++) {
    let from: RegionId | undefined;
    if ((s.wraiths[MORDOR] ?? 0) > 0) {
      from = MORDOR;
    } else {
      from = Object.entries(s.wraiths)
        .filter(([r, n]) => n > 0 && r !== s.eye)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    }
    if (!from) return;
    s.wraiths[from] -= 1;
    s.wraiths[s.eye] = (s.wraiths[s.eye] ?? 0) + 1;
    events.push({ kind: 'shadow', text: `A Nazgûl flies from ${REGION_MAP[from].name} to the Eye in ${REGION_MAP[s.eye].name}.` });
  }
}

function resolveShadowCard(s: GameState, rng: Rng, events: GameEvent[]): void {
  const card = drawShadowCard(s, rng);
  if (!card) return;

  if (card.special) {
    const info = SPECIAL_SHADOW_INFO[card.special];
    events.push({ kind: 'shadow', text: `Special shadow card: ${info.name}!` });
    if (card.special === 'war_drums') {
      for (const [loc, status] of Object.entries(s.siteStatus)) {
        if (status === 'stronghold' && MAP[loc].stronghold && !s.spawnStopped[loc]) {
          addShadow(s, loc, 1, events, true);
          if (friendlyAt(s, loc) > 0) s.queue.unshift({ step: 'battle', location: loc, source: 'shadow' });
        }
      }
    } else {
      addShadow(s, 'isengard', 2, events, true);
      if (friendlyAt(s, 'isengard') > 0) s.queue.unshift({ step: 'battle', location: 'isengard', source: 'shadow' });
      advanceLine(s, 'isengard_line', events);
    }
    s.shadowDiscard.push(card);
    checkHavens(s, events);
    return;
  }

  // The back of the next card on the deck decides which half resolves.
  const nextBack = s.shadowDeck.length > 0
    ? s.shadowDeck[s.shadowDeck.length - 1].back
    : next(rng) < 0.5 ? 'flag' : 'banner';

  if (nextBack === 'flag') {
    advanceLine(s, card.line!, events);
  } else {
    const loc = card.reinforce!;
    addShadow(s, loc, 1, events, true);
    if ((s.shadow[loc] ?? 0) > 0 && friendlyAt(s, loc) > 0) {
      s.queue.unshift({ step: 'battle', location: loc, source: 'shadow' });
    }
    checkHavens(s, events);
    // Special order.
    const frodoLoc = bearerLocation(s);
    switch (card.order) {
      case 'eye': {
        if (!frodoLoc) break;
        const fr = regionOf(frodoLoc);
        if (s.eye === fr) {
          events.push({ kind: 'shadow', text: `The Eye is already fixed on ${REGION_MAP[fr].name} — it searches for Frodo!` });
          s.queue.unshift({ step: 'search', context: 'order', location: frodoLoc });
        } else {
          s.eye = fr;
          events.push({ kind: 'shadow', text: `The Eye of Sauron turns to ${REGION_MAP[fr].name}.` });
        }
        break;
      }
      case 'hunt2':
        moveNazgulCloser(s, 2, events);
        break;
      case 'deploy3':
        deployNazgulToEye(s, 3, events);
        break;
    }
  }
  s.shadowDiscard.push(card);
}

// ---------------------------------------------------------------------------
// Turn end: draw player cards (Skies Darken), then the shadow phase
// ---------------------------------------------------------------------------

function resolveDarken(s: GameState, rng: Rng, cardLoc: LocationId, events: GameEvent[]): void {
  events.push({ kind: 'card', text: 'SKIES DARKEN!' });
  // 1. Threat rises.
  if (s.threatIdx < THREAT_TRACK.length - 1) s.threatIdx += 1;
  events.push({ kind: 'card', text: `The threat rate rises: ${THREAT_TRACK[s.threatIdx]} shadow cards per turn.` });
  // 2. The Eye seeks Frodo.
  const frodoLoc = bearerLocation(s);
  if (frodoLoc) {
    const fr = regionOf(frodoLoc);
    if (s.eye === fr) {
      changeHope(s, -2, events, 'the Eye finds Frodo\'s trail');
    } else {
      s.eye = fr;
      events.push({ kind: 'card', text: `The Eye of Sauron turns to ${REGION_MAP[fr].name}.` });
    }
  }
  // 3. Troops muster under cover of darkness.
  addShadow(s, cardLoc, 3, events, true);
  if ((s.shadow[cardLoc] ?? 0) > 0 && friendlyAt(s, cardLoc) > 0) {
    s.queue.unshift({ step: 'battle', location: cardLoc, source: 'shadow' });
  }
  checkHavens(s, events);
  // 4. The danger intensifies: shadow discard returns to the top of the deck.
  if (s.shadowDiscard.length > 0) {
    const recycled = shuffle(rng, [...s.shadowDiscard]);
    s.shadowDeck = [...s.shadowDeck, ...recycled]; // drawn from the end = on top
    s.shadowDiscard = [];
    events.push({ kind: 'card', text: 'The shadow discard pile is shuffled onto the deck — old perils stir again.' });
  }
}

function drawPlayerCards(s: GameState, rng: Rng, count: number, events: GameEvent[]): void {
  const p = activePlayer(s);
  for (let i = 0; i < count && s.phase === 'playing'; i++) {
    const card = s.playerDeck.pop();
    if (!card) {
      changeHope(s, -1, events, 'the player deck is empty');
      continue;
    }
    if (card.kind === 'darken') {
      s.removedCards.push(card);
      resolveDarken(s, rng, card.location, events);
    } else {
      p.hand.push(card);
      events.push({ kind: 'turn', text: `${p.name} draws a card.` });
    }
  }
  if (p.hand.length > HAND_LIMIT && s.phase === 'playing') {
    s.pending = { type: 'discard', player: p.id };
    events.push({ kind: 'turn', text: `${p.name} is over the hand limit and must discard.` });
  }
}

/** Advance the automatic queue until a pending decision or the queue drains. */
function pump(s: GameState, rng: Rng, events: GameEvent[]): void {
  while (s.phase === 'playing' && !s.pending && s.queue.length > 0) {
    const item = s.queue.shift()!;
    switch (item.step) {
      case 'drawPlayerCards':
        drawPlayerCards(s, rng, item.count, events);
        break;
      case 'shadowDraw':
        resolveShadowCard(s, rng, events);
        if (item.remaining > 1) {
          s.queue.push({ step: 'shadowDraw', remaining: item.remaining - 1 });
        }
        break;
      case 'battle':
        if ((s.shadow[item.location] ?? 0) > 0 && friendlyAt(s, item.location) > 0) {
          rollBattle(s, rng, item.location, item.source, item.dice, events);
        }
        break;
      case 'search':
        rollSearch(s, rng, item.context, item.location, events);
        break;
      case 'endTurn': {
        s.turn.playerIdx = (s.turn.playerIdx + 1) % s.players.length;
        s.turn.actionsUsed = {};
        s.turn.actedOrder = [];
        s.turn.abilityUsed = {};
        s.turnNumber += 1;
        if (s.solo) {
          s.solo.idx = (s.solo.idx + 1) % s.solo.order.length;
          events.push({
            kind: 'turn',
            text: `— Turn ${s.turnNumber}: the solo token passes to ${charName(s.solo.order[s.solo.idx])} (plus 1 Frodo & Sam action) —`,
          });
        } else {
          events.push({ kind: 'turn', text: `— Turn ${s.turnNumber}: ${activePlayer(s).name} —` });
        }
        break;
      }
      case 'winCheck':
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Action budget: 4 with one character, 1 with the other, no interleaving.
// ---------------------------------------------------------------------------

export function canAct(s: GameState, character: CharacterId): boolean {
  const p = activePlayer(s);
  if (!p.characters.includes(character)) return false;
  const used = s.turn.actionsUsed[character] ?? 0;
  // Solo variant: the token character takes up to 4 actions; Frodo & Sam
  // take 1 bonus action; nobody else acts this turn.
  if (s.solo) {
    const token = s.solo.order[s.solo.idx];
    if (character === token) return used < ACTIONS_PRIMARY;
    if (character === BEARER) return used < ACTIONS_SECONDARY;
    return false;
  }
  const order = s.turn.actedOrder;
  if (order.length === 0) return true;
  if (order.length === 1) {
    if (order[0] === character) {
      return used < ACTIONS_PRIMARY;
    }
    // Switching: the first character is done. Its usage decides the caps.
    const firstUsed = s.turn.actionsUsed[order[0]] ?? 0;
    const cap = firstUsed <= ACTIONS_SECONDARY ? ACTIONS_PRIMARY : ACTIONS_SECONDARY;
    return used < cap;
  }
  // Both have acted: only the second may continue.
  if (order[1] !== character) return false;
  const firstUsed = s.turn.actionsUsed[order[0]] ?? 0;
  const cap = firstUsed <= ACTIONS_SECONDARY ? ACTIONS_PRIMARY : ACTIONS_SECONDARY;
  return used < cap;
}

function spendAction(s: GameState, character: CharacterId): void {
  if (!canAct(s, character)) {
    throw new RuleError(
      `${charName(character)} cannot act: do up to ${ACTIONS_PRIMARY} actions with one character and up to ${ACTIONS_SECONDARY} with the other, finishing one before the other.`,
    );
  }
  if (!s.turn.actedOrder.includes(character)) s.turn.actedOrder.push(character);
  s.turn.actionsUsed[character] = (s.turn.actionsUsed[character] ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// Events (player cards)
// ---------------------------------------------------------------------------

function playEvent(s: GameState, rng: Rng, playerId: PlayerId, action: Extract<Action, { type: 'playEvent' }>, events: GameEvent[]): void {
  const p = s.players.find((pl) => pl.id === playerId)!;
  const idx = p.hand.findIndex((c) => c.id === action.card);
  if (idx < 0) throw new RuleError('That card is not in your hand.');
  const card = p.hand[idx];
  if (card.kind !== 'event') throw new RuleError('Only event cards can be played this way.');
  const def = EVENTS.find((e) => e.key === card.event)!;

  // The Light of Eärendil is the one event playable during a pending search.
  if (s.pending && !(s.pending.type === 'search' && card.event === 'phial')) {
    throw new RuleError('Wait until the current roll is resolved.');
  }

  events.push({ kind: 'card', text: `${p.name} plays ${def.name}.` });
  switch (card.event) {
    case 'haven_cloaks': {
      if (!action.character || !action.location) throw new RuleError('Choose a character and destination.');
      const path = shortestFreePath(s.characters[action.character].location, action.location, 3);
      if (!path) throw new RuleError('Destination must be within 3 connections along normal paths.');
      s.characters[action.character].location = action.location;
      events.push({ kind: 'card', text: `${charName(action.character)} slips away to ${locName(action.location)}.` });
      break;
    }
    case 'eagles': {
      if (!action.character || !action.location) throw new RuleError('Choose a character and a haven.');
      if (!isHaven(s, action.location)) throw new RuleError('The eagles only fly to havens.');
      s.characters[action.character].location = action.location;
      events.push({ kind: 'card', text: `${charName(action.character)} is carried to ${locName(action.location)}.` });
      break;
    }
    case 'athelas':
      changeHope(s, 2, events, def.name);
      break;
    case 'phial': {
      if (!s.pending || s.pending.type !== 'search') throw new RuleError('Play this during a search.');
      s.pending.dice = s.pending.dice.map(() => 'slip');
      events.push({ kind: 'card', text: 'A clear light drives back the darkness — every search die shows Slip By.' });
      break;
    }
    case 'rohirrim_charge': {
      if (!action.location) throw new RuleError('Choose a battle location.');
      if ((s.shadow[action.location] ?? 0) === 0 || friendlyAt(s, action.location) === 0) {
        throw new RuleError('Needs both friendly and shadow troops.');
      }
      rollBattle(s, rng, action.location, 'attack', MAX_BATTLE_DICE, events);
      break;
    }
    case 'beacons': {
      for (const l of Object.values(MAP)) {
        if (l.muster && isHaven(s, l.id) && s.supply.factions[l.muster] > 0) {
          s.supply.factions[l.muster] -= 1;
          const at = (s.friendly[l.id] ??= {});
          at[l.muster] = (at[l.muster] ?? 0) + 1;
        }
      }
      events.push({ kind: 'card', text: 'Troops muster at every standing haven.' });
      break;
    }
    case 'council': {
      if (!action.symbol) throw new RuleError('Choose a symbol.');
      if (s.supply.tokens[action.symbol] <= 0) throw new RuleError('None left in the supply.');
      s.supply.tokens[action.symbol] -= 1;
      p.tokens[action.symbol] += 1;
      break;
    }
    case 'ranger_paths': {
      if (!action.location || !action.character) throw new RuleError('Choose from- and to-locations.');
      // action.character carries the from-location's id in this event? Keep it
      // simple: move up to 3 troops from `character`'s location to `location`.
      const from = s.characters[action.character]?.location;
      if (!from || !connection(from, action.location)) throw new RuleError('Locations must be connected.');
      const at = s.friendly[from] ?? {};
      let moved = 0;
      for (const f of Object.keys(at) as Faction[]) {
        while ((at[f] ?? 0) > 0 && moved < 3) {
          at[f]! -= 1;
          const dst = (s.friendly[action.location] ??= {});
          dst[f] = (dst[f] ?? 0) + 1;
          moved++;
        }
      }
      events.push({ kind: 'card', text: `${moved} troops march from ${locName(from)} to ${locName(action.location)}.` });
      checkHavens(s, events);
      break;
    }
    case 'palantir': {
      const top = s.shadowDeck.slice(-3).reverse();
      const names = top.map((c) =>
        c.special ? SPECIAL_SHADOW_INFO[c.special].name : `${BATTLE_LINES.find((l) => l.id === c.line)?.name} / ${locName(c.reinforce!)}`,
      );
      events.push({ kind: 'card', text: `The Palantír reveals what comes: ${names.join(' | ')}.` });
      break;
    }
    case 'mithril':
      changeHope(s, 1, events, def.name);
      if (s.supply.tokens.resistance > 0) {
        s.supply.tokens.resistance -= 1;
        p.tokens.resistance += 1;
      }
      break;
    case 'ents': {
      const loc = action.location;
      const legal = loc === 'isengard' || (loc && connection('fangorn_forest', loc)) || loc === 'fangorn_forest';
      if (!loc || !legal) throw new RuleError('Target Isengard or a location connected to Fangorn Forest.');
      const n = removeShadow(s, loc, 2);
      events.push({ kind: 'card', text: `The forest marches — ${n} shadow troops destroyed at ${locName(loc)}.` });
      break;
    }
    case 'oath_dead': {
      if (!action.location || MAP[action.location].region !== 'gondor') {
        throw new RuleError('Target a Gondor location.');
      }
      const n = removeShadow(s, action.location, 2);
      events.push({ kind: 'card', text: `The Dead sweep through ${locName(action.location)} — ${n} shadow troops destroyed.` });
      break;
    }
    case 'shadowfax': {
      if (!action.region || !REGION_MAP[action.region]) throw new RuleError('Choose a region.');
      s.eye = action.region;
      events.push({ kind: 'card', text: `The Eye is drawn to ${REGION_MAP[action.region].name}.` });
      break;
    }
    case 'gift':
      drawPlayerCards(s, rng, 1, events);
      break;
  }
  const stillThere = p.hand.indexOf(card);
  if (stillThere >= 0) p.hand.splice(stillThere, 1);
  s.playerDiscard.push(card);
  checkStateObjectives(s, events);
}

/** BFS over free (uncosted) paths, up to maxLen steps. */
function shortestFreePath(from: LocationId, to: LocationId, maxLen: number): boolean {
  if (from === to) return false;
  let frontier = [from];
  const seen = new Set([from]);
  for (let d = 0; d < maxLen; d++) {
    const nextFrontier: LocationId[] = [];
    for (const cur of frontier) {
      for (const c of CONNECTIONS[cur]) {
        if (c.cost || seen.has(c.to)) continue;
        if (c.to === to) return true;
        seen.add(c.to);
        nextFrontier.push(c.to);
      }
    }
    frontier = nextFrontier;
  }
  return false;
}

// ---------------------------------------------------------------------------
// The reducer
// ---------------------------------------------------------------------------

export function applyAction(state: GameState, playerId: PlayerId, action: Action): ActionResult {
  if (state.phase !== 'playing') throw new RuleError('The game is over.');
  const s = clone(state);
  const events: GameEvent[] = [];
  const rng = makeRng(0);
  rng.state = s.rngState;

  const p = activePlayer(s);
  const actor = s.players.find((pl) => pl.id === playerId);
  if (!actor) throw new RuleError('Unknown player.');

  // --- Pending-resolution actions --------------------------------------
  if (s.pending) {
    handlePendingAction(s, rng, playerId, action, events);
    pump(s, rng, events);
    s.rngState = rng.state;
    return { state: s, events };
  }

  // --- Events may be played by any player, any turn --------------------
  if (action.type === 'playEvent') {
    playEvent(s, rng, playerId, action, events);
    pump(s, rng, events);
    s.rngState = rng.state;
    return { state: s, events };
  }

  if (p.id !== playerId) throw new RuleError(`It is ${p.name}'s turn.`);

  switch (action.type) {
    case 'travel':
      doTravel(s, rng, p, action, events);
      break;

    case 'fellowship': {
      if (s.solo) throw new RuleError('Solo games skip the Fellowship action — your characters already share one hand.');
      const c = action.character;
      requireOwn(p, c);
      const here = s.characters[c].location;
      const other = s.players.find((pl) => pl.id !== p.id && pl.characters.some((cc) => s.characters[cc]?.location === here));
      const isFree = c === 'merry_pippin' && !s.turn.abilityUsed[c];
      if (!isFree) spendAction(s, c);
      else s.turn.abilityUsed[c] = true;
      const region = regionOf(here);
      if (action.give) {
        const target = action.takeFrom ? s.players.find((pl) => pl.id === action.takeFrom) : other;
        if (!target) throw new RuleError('No other player has a character here.');
        if (!target.characters.some((cc) => s.characters[cc]?.location === here)) {
          throw new RuleError('That player has no character here.');
        }
        const idx = p.hand.findIndex((cd) => cd.id === action.give);
        if (idx < 0) throw new RuleError('Card not in your hand.');
        const card = p.hand[idx];
        if (card.kind !== 'region' || card.region !== region) {
          throw new RuleError('You may only pass a region card matching the region you are in.');
        }
        p.hand.splice(idx, 1);
        target.hand.push(card);
        events.push({ kind: 'action', text: `${p.name} passes a ${REGION_MAP[region].name} card to ${target.name}.` });
        if (target.hand.length > HAND_LIMIT) s.pending = { type: 'discard', player: target.id };
      } else if (action.take && action.takeFrom) {
        const target = s.players.find((pl) => pl.id === action.takeFrom);
        if (!target || !target.characters.some((cc) => s.characters[cc]?.location === here)) {
          throw new RuleError('That player has no character here.');
        }
        const idx = target.hand.findIndex((cd) => cd.id === action.take);
        if (idx < 0) throw new RuleError('Card not in their hand.');
        const card = target.hand[idx];
        if (card.kind !== 'region' || card.region !== region) {
          throw new RuleError('You may only take a region card matching the region you are in.');
        }
        target.hand.splice(idx, 1);
        p.hand.push(card);
        events.push({ kind: 'action', text: `${p.name} takes a ${REGION_MAP[region].name} card from ${target.name}.` });
        if (p.hand.length > HAND_LIMIT) s.pending = { type: 'discard', player: p.id };
      } else {
        throw new RuleError('Fellowship: give or take a matching region card.');
      }
      break;
    }

    case 'prepare': {
      const c = action.character;
      requireOwn(p, c);
      const here = s.characters[c].location;
      if (!isHaven(s, here)) throw new RuleError('Prepare only at a haven.');
      const idx = p.hand.findIndex((cd) => cd.id === action.card);
      if (idx < 0) throw new RuleError('Card not in your hand.');
      const card = p.hand[idx];
      if (card.kind !== 'region') throw new RuleError('Discard a region card to Prepare.');
      if (s.solo && card.region !== regionOf(here)) {
        throw new RuleError('Solo rule: Prepare only with a card matching the region you are in.');
      }
      const take = c === 'galadriel' ? 2 : 1; // Galadriel: reconstructed
      if (s.supply.tokens[card.symbol] <= 0) throw new RuleError('No matching tokens left in the supply.');
      spendAction(s, c);
      p.hand.splice(idx, 1);
      s.playerDiscard.push(card);
      const got = Math.min(take, s.supply.tokens[card.symbol]);
      s.supply.tokens[card.symbol] -= got;
      p.tokens[card.symbol] += got;
      events.push({ kind: 'action', text: `${charName(c)} prepares: ${p.name} banks ${got} ${card.symbol} token${got > 1 ? 's' : ''}.` });
      break;
    }

    case 'muster': {
      const c = action.character;
      requireOwn(p, c);
      const here = s.characters[c].location;
      const faction = MAP[here].muster;
      if (!faction) throw new RuleError('Muster only at a location with a muster icon.');
      if (s.supply.factions[faction] <= 0) throw new RuleError('No troops of that army left.');
      const free = c === 'eowyn' && faction === 'riders'; // from her card
      spendAction(s, c);
      if (!free) pay(s, p, ['friendship'], events);
      const amount = Math.min(c === 'eomer' ? 2 : 1, s.supply.factions[faction]); // Éomer: reconstructed
      s.supply.factions[faction] -= amount;
      const at = (s.friendly[here] ??= {});
      at[faction] = (at[faction] ?? 0) + amount;
      events.push({ kind: 'action', text: `${charName(c)} musters ${amount} troop${amount > 1 ? 's' : ''} at ${locName(here)}.` });
      checkStateObjectives(s, events);
      break;
    }

    case 'attack': {
      const c = action.character;
      requireOwn(p, c);
      let loc = s.characters[c].location;
      // Legolas (reconstructed): may attack a connected location.
      if (c === 'legolas' && action.dice < 0) throw new RuleError('bad dice');
      if ((s.shadow[loc] ?? 0) === 0 || friendlyAt(s, loc) === 0) {
        if (c === 'legolas') {
          const alt = CONNECTIONS[loc].map((cn) => cn.to).find((l) => (s.shadow[l] ?? 0) > 0 && friendlyAt(s, l) > 0);
          if (alt) loc = alt;
          else throw new RuleError('Attack needs friendly and shadow troops together.');
        } else {
          throw new RuleError('Attack needs friendly and shadow troops in your location.');
        }
      }
      const maxDice = Math.min(c === 'boromir' ? 4 : MAX_BATTLE_DICE, friendlyAt(s, loc));
      const dice = Math.max(1, Math.min(action.dice, maxDice));
      spendAction(s, c);
      // Attacks draw the Eye.
      s.eye = regionOf(loc);
      events.push({ kind: 'action', text: `${charName(c)} attacks at ${locName(loc)} — the Eye turns to ${REGION_MAP[s.eye].name}.` });
      if (regionOf(loc) === MORDOR) completeObjective(s, 'challenge_sauron', events);
      rollBattle(s, rng, loc, 'attack', dice, events);
      break;
    }

    case 'capture': {
      const c = action.character;
      requireOwn(p, c);
      const here = s.characters[c].location;
      if (s.siteStatus[here] !== 'stronghold') throw new RuleError('Capture a shadow stronghold.');
      if (friendlyAt(s, here) === 0) throw new RuleError('A friendly troop must be present.');
      if ((s.shadow[here] ?? 0) > 0) throw new RuleError('Clear the shadow troops first.');
      const cost = c === 'gimli' ? 2 : CAPTURE_COST; // Gimli: reconstructed
      spendAction(s, c);
      pay(s, p, Array(cost).fill('valor') as SymbolKind[], events);
      s.siteStatus[here] = 'haven';
      if (MAP[here].stopsSpawnWhenCaptured) s.spawnStopped[here] = true;
      s.eye = regionOf(here);
      events.push({ kind: 'haven', text: `${locName(here)} is captured — it now shelters the Free Peoples! The Eye turns to ${REGION_MAP[s.eye].name}.` });
      changeHope(s, CAPTURE_HOPE, events, `${locName(here)} captured`);
      if (here === 'isengard') completeObjective(s, 'staff_broken', events);
      if (here === 'moria') completeObjective(s, 'confront_balrog', events);
      if (here === 'umbar') completeObjective(s, 'subdue_umbar', events);
      if (here === 'dol_guldur') completeObjective(s, 'light_mirkwood', events);
      break;
    }

    case 'destroyEmber': {
      if (!bearerInPlay(s)) throw new RuleError('Frodo is not in play.');
      if (!p.characters.includes(BEARER)) throw new RuleError('Only Frodo\'s player may attempt this.');
      if (bearerLocation(s) !== MOUNT_DOOM) throw new RuleError('Frodo must stand at Mount Doom.');
      const remaining = s.objectives.filter((o) => !o.complete && o.id !== 'destroy_ring');
      if (remaining.length > 0) {
        throw new RuleError(`Complete every other objective first (${remaining.length} remain).`);
      }
      spendAction(s, BEARER);
      pay(s, p, Array(RING_DESTROY_COST).fill('resistance') as SymbolKind[], events);
      events.push({ kind: 'action', text: 'Frodo stands at the Crack of Doom and reaches for the Ring...' });
      s.queue.unshift({ step: 'search', context: 'final', location: MOUNT_DOOM });
      break;
    }

    case 'ability': {
      const c = action.character;
      requireOwn(p, c);
      if (c === 'gandalf') { // reconstructed
        if (s.turn.abilityUsed[c]) throw new RuleError('Once per turn.');
        if (!isHaven(s, s.characters[c].location)) throw new RuleError('Gandalf must be at a haven.');
        s.turn.abilityUsed[c] = true;
        events.push({ kind: 'action', text: 'Gandalf kindles hope in weary hearts.' });
        changeHope(s, 1, events, 'Gandalf');
      } else {
        throw new RuleError('That character has no activated ability.');
      }
      break;
    }

    case 'endTurn':
      s.queue.push({ step: 'drawPlayerCards', count: CARDS_PER_TURN });
      s.queue.push({ step: 'shadowDraw', remaining: THREAT_TRACK[s.threatIdx] });
      s.queue.push({ step: 'endTurn' });
      break;

    default:
      throw new RuleError(`Unknown action: ${(action as { type: string }).type}`);
  }

  checkStateObjectives(s, events);
  pump(s, rng, events);
  s.rngState = rng.state;
  return { state: s, events };
}

function requireOwn(p: PlayerState, c: CharacterId): void {
  if (!p.characters.includes(c)) throw new RuleError('Not your character.');
}

// ---------------------------------------------------------------------------
// Travel
// ---------------------------------------------------------------------------

function doTravel(
  s: GameState,
  rng: Rng,
  p: PlayerState,
  action: Extract<Action, { type: 'travel' }>,
  events: GameEvent[],
): void {
  const c = action.character;
  requireOwn(p, c);
  const from = s.characters[c].location;
  const conn = connection(from, action.to);
  if (!conn) throw new RuleError(`${locName(from)} does not connect to ${locName(action.to)}.`);

  const companions = (action.companions ?? []).filter((cc) => cc !== c);
  for (const cc of companions) {
    if (!s.characters[cc]) throw new RuleError(`${cc} is not in play.`);
    if (s.characters[cc].location !== from) throw new RuleError(`${charName(cc)} is not here.`);
  }
  const troops = action.troops ?? {};
  for (const [f, n] of Object.entries(troops)) {
    if ((s.friendly[from]?.[f as Faction] ?? 0) < (n ?? 0)) {
      throw new RuleError(`Not that many ${f} troops here.`);
    }
  }

  const bearerMoves = c === BEARER || companions.includes(BEARER);
  if (bearerMoves && !action.cover) {
    throw new RuleError('Frodo is coming along: choose stealth, a search, or the Ring.');
  }

  spendAction(s, c);

  // Special path cost (Gollum travels them free — reconstructed).
  if (conn.cost && c !== 'gollum') pay(s, p, conn.cost, events);

  // Move everyone and everything.
  s.characters[c].location = action.to;
  for (const cc of companions) s.characters[cc].location = action.to;
  for (const [f, n] of Object.entries(troops)) {
    if (!n) continue;
    const src = s.friendly[from]!;
    src[f as Faction]! -= n;
    const dst = (s.friendly[action.to] ??= {});
    dst[f as Faction] = (dst[f as Faction] ?? 0) + n;
  }
  const extras = [
    ...companions.map((cc) => charName(cc)),
    ...Object.entries(troops).filter(([, n]) => n).map(([f, n]) => `${n} ${f} troops`),
  ];
  events.push({
    kind: 'action',
    text: `${charName(c)} travels to ${locName(action.to)}${extras.length ? ` with ${extras.join(', ')}` : ''}.`,
  });
  checkHavens(s, events);

  if (bearerMoves) {
    if (action.cover === 'stealth') {
      pay(s, p, ['stealth'], events);
      events.push({ kind: 'search', text: 'Frodo slips through unseen (stealth spent).' });
    } else if (action.cover === 'ring') {
      // Rulebook fine point: lose 1 hope, Eye to his region, search ignoring shadow troops.
      changeHope(s, -1, events, 'Frodo puts on the Ring');
      s.eye = regionOf(action.to);
      events.push({ kind: 'search', text: `Frodo puts on the Ring! The Eye turns to ${REGION_MAP[s.eye].name}.` });
      s.queue.unshift({ step: 'search', context: 'ring', location: action.to });
    } else {
      s.queue.unshift({ step: 'search', context: 'travel', location: action.to });
    }
  }
  checkStateObjectives(s, events);
}

// ---------------------------------------------------------------------------
// Pending handling (rerolls, valor, confirm, discards)
// ---------------------------------------------------------------------------

function handlePendingAction(s: GameState, rng: Rng, playerId: PlayerId, action: Action, events: GameEvent[]): void {
  const pend = s.pending!;
  const player = s.players.find((pl) => pl.id === playerId)!;

  if (pend.type === 'discard') {
    if (action.type !== 'discard') throw new RuleError(`${s.players.find((pl) => pl.id === pend.player)?.name} must discard to the hand limit first.`);
    if (playerId !== pend.player) throw new RuleError('Not your discard.');
    const idx = player.hand.findIndex((c) => c.id === action.card);
    if (idx < 0) throw new RuleError('Card not in your hand.');
    const [card] = player.hand.splice(idx, 1);
    s.playerDiscard.push(card);
    events.push({ kind: 'turn', text: `${player.name} discards a card.` });
    if (player.hand.length <= HAND_LIMIT) s.pending = null;
    return;
  }

  const presentHere = (loc: LocationId) =>
    player.characters.some((c) => s.characters[c]?.location === loc);

  switch (action.type) {
    case 'playEvent':
      playEvent(s, rng, playerId, action, events);
      return;
    case 'reroll': {
      if (!presentHere(pend.location)) throw new RuleError('You need a character at the roll to help.');
      if (action.die < 0 || action.die >= pend.dice.length) throw new RuleError('Bad die.');
      pay(s, player, ['resistance'], events);
      if (pend.type === 'search') {
        pend.dice[action.die] = SEARCH_DIE[nextInt(rng, 6)] as SearchFace;
      } else {
        pend.dice[action.die] = BATTLE_DIE[nextInt(rng, 6)] as BattleFace;
      }
      events.push({ kind: pend.type, text: `${player.name} rerolls a die: now [${pend.dice.join(' ')}].` });
      return;
    }
    case 'showValor': {
      if (pend.type !== 'battle') throw new RuleError('Valor helps only in battles.');
      if (!presentHere(pend.location)) throw new RuleError('You need a character at the battle.');
      if (pend.valorKills >= (s.shadow[pend.location] ?? 0)) throw new RuleError('No shadow troops left to slay.');
      pay(s, player, ['valor'], events);
      pend.valorKills += 1;
      events.push({ kind: 'battle', text: `${player.name} shows valor — another shadow troop will fall.` });
      return;
    }
    case 'confirm': {
      if (playerId !== activePlayer(s).id) throw new RuleError('The current player confirms the roll.');
      if (pend.type === 'search') applySearch(s, events);
      else applyBattle(s, events);
      return;
    }
    default:
      throw new RuleError('Resolve the current roll first (reroll, valor, or confirm).');
  }
}
