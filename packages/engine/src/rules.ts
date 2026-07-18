import {
  ACTIONS_PRIMARY,
  ACTIONS_SECONDARY,
  BATTLE_DIE,
  CAPTURE_COST,
  CAPTURE_HOPE,
  CARDS_PER_TURN,
  EVENTS,
  FACTION_NAMES,
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
  findBattleLine,
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

/** Shift the Eye of Sauron, emitting an animation payload. */
function setEye(s: GameState, region: RegionId, events: GameEvent[], why: string): void {
  if (s.eye === region) return;
  s.eye = region;
  events.push({ kind: 'shadow', text: `The Eye of Sauron turns to ${REGION_MAP[region].name} (${why}).`, fx: { fx: 'eye', to: region } });
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
    events.push({
      kind: 'shadow',
      text: `${placed} shadow troop${placed > 1 ? 's' : ''} muster at ${locName(loc)} (${s.shadow[loc]}).`,
      fx: { fx: 'spawn', location: loc, count: placed },
    });
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
    // Gollum knows the hidden ways: searches where he lurks roll 3 fewer dice.
    const gollum = s.characters['gollum'];
    if (gollum && gollum.location === loc) diceCount = Math.max(0, diceCount - 3);
  }
  if (diceCount <= 0) {
    if (context === 'final') winGame(s, events);
    else events.push({ kind: 'search', text: `No enemies near ${locName(loc)} — Frodo passes unseen.` });
    return;
  }
  const dice: SearchFace[] = [];
  for (let i = 0; i < diceCount; i++) dice.push(SEARCH_DIE[nextInt(rng, 6)]);
  s.pending = { type: 'search', context, location: loc, dice, ignored: [] };
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
  for (let dieIdx = 0; dieIdx < pend.dice.length; dieIdx++) {
    if (s.phase !== 'playing') return;
    if (pend.ignored.includes(dieIdx)) continue; // neutralized by Sam's aid
    const face = pend.dice[dieIdx];
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
          events.push({
            kind: 'search',
            text: `A Nazgûl is recalled from ${REGION_MAP[from].name} to Mordor.`,
            fx: { fx: 'move', piece: 'nazgul', from, to: MORDOR },
          });
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
  const eowynHere = s.characters['eowyn']?.location === loc;
  const aragornHere = s.characters['aragorn']?.location === loc;
  let shadowKilled = pend.valorKills;
  let friendlyLost = 0;
  for (const face of pend.dice) {
    switch (face) {
      case 'rout':
        // Aragorn leads the charge: his routs fell two.
        shadowKilled += aragornHere ? 2 : 1;
        break;
      case 'exchange':
        shadowKilled += 1;
        friendlyLost += 1;
        break;
      case 'overrun':
        if (!isHaven(s, loc)) friendlyLost += 1;
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
  // Éomer holds the line: with Rohirrim present, one loss is ignored.
  if (
    friendlyLost > 0 &&
    s.characters['eomer']?.location === loc &&
    (s.friendly[loc]?.riders ?? 0) > 0
  ) {
    friendlyLost -= 1;
    events.push({ kind: 'battle', text: 'Éomer rallies the Rohirrim — one loss is turned aside.' });
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
      events.push({
        kind: 'shadow',
        text: `${n} shadow troop${n > 1 ? 's' : ''} advance from ${locName(from)} to ${locName(to)}.`,
        fx: { fx: 'move', piece: 'shadow', from, to, count: n },
      });
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
    events.push({
      kind: 'shadow',
      text: `A Nazgûl sweeps from ${REGION_MAP[from].name} into ${REGION_MAP[to].name}.`,
      fx: { fx: 'move', piece: 'nazgul', from, to },
    });
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
      events.push({
        kind: 'shadow',
        text: `A Nazgûl is recalled from ${REGION_MAP[from[0]].name} to Mordor.`,
        fx: { fx: 'move', piece: 'nazgul', from: from[0], to: MORDOR },
      });
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
    events.push({
      kind: 'shadow',
      text: `A Nazgûl flies from ${REGION_MAP[from].name} to the Eye in ${REGION_MAP[s.eye].name}.`,
      fx: { fx: 'move', piece: 'nazgul', from, to: s.eye },
    });
  }
}

function resolveShadowCard(s: GameState, rng: Rng, events: GameEvent[]): void {
  const card = drawShadowCard(s, rng);
  if (!card) return;

  if (card.special) {
    const info = SPECIAL_SHADOW_INFO[card.special];
    events.push({
      kind: 'shadow',
      text: `Special shadow card: ${info.name}!`,
      fx: { fx: 'shadowCard', half: 'special', specialName: info.name },
    });
    if (card.special === 'drums_of_war') {
      // Every shadow stronghold in Mordor gains a troop.
      for (const [loc, status] of Object.entries(s.siteStatus)) {
        if (status === 'stronghold' && MAP[loc].region === MORDOR) {
          addShadow(s, loc, 1, events, true);
          if (friendlyAt(s, loc) > 0) s.queue.unshift({ step: 'battle', location: loc, source: 'shadow' });
        }
      }
      checkHavens(s, events);
    } else {
      // The current player must pick one of three woes.
      s.pending = { type: 'wheels' };
      events.push({
        kind: 'shadow',
        text: 'The Wheels of Saruman turn — choose: Break Oath (remove 2 friendly troops), Doubt (one player gives up 2 cards/tokens), or Despair (lose 1 hope).',
      });
    }
    s.shadowDiscard.push(card);
    return;
  }

  // The back of the next card on the deck decides which half resolves.
  const nextBack = s.shadowDeck.length > 0
    ? s.shadowDeck[s.shadowDeck.length - 1].back
    : next(rng) < 0.5 ? 'flag' : 'banner';

  const lineDef = findBattleLine(card.lineFrom!, card.lineTo!);
  const lineName = `${locName(card.lineFrom!)} → ${locName(card.lineTo!)}`;
  if (nextBack === 'flag') {
    events.push({
      kind: 'shadow',
      text: `Shadow card: the ${lineName} line ADVANCES.`,
      fx: { fx: 'shadowCard', half: 'advance', lineName, lineColor: lineDef?.color, reinforce: card.reinforce, order: card.order },
    });
    if (lineDef) advanceLine(s, lineDef.id, events);
    else events.push({ kind: 'shadow', text: `(No matching battle line drawn on the board yet — nothing advances.)` });
  } else {
    events.push({
      kind: 'shadow',
      text: `Shadow card: REINFORCE ${locName(card.reinforce!)}.`,
      fx: { fx: 'shadowCard', half: 'reinforce', lineName, lineColor: lineDef?.color, reinforce: card.reinforce, order: card.order },
    });
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
          events.push({ kind: 'shadow', text: `The Eye of Sauron turns to ${REGION_MAP[fr].name}.`, fx: { fx: 'eye', to: fr } });
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
  events.push({ kind: 'card', text: 'SKIES DARKEN!', fx: { fx: 'darken', location: cardLoc } });
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
      events.push({ kind: 'card', text: `The Eye of Sauron turns to ${REGION_MAP[fr].name}.`, fx: { fx: 'eye', to: fr } });
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
  // Lembas grants extra actions beyond every other budget.
  if (s.turn.lembas && s.turn.lembas.character === character && s.turn.lembas.remaining > 0) {
    return true;
  }
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
  // Consume the normal budget first; Lembas actions cover the overflow.
  const budgetLeft = (() => {
    const probe: GameState = { ...s, turn: { ...s.turn, lembas: undefined } };
    return canAct(probe, character);
  })();
  if (!budgetLeft && s.turn.lembas?.character === character && s.turn.lembas.remaining > 0) {
    s.turn.lembas.remaining -= 1;
    return;
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

  // Tom Bombadil is the one event playable while a roll is pending.
  if (s.pending && !(card.event === 'tom_bombadil' && s.pending.type !== 'discard')) {
    throw new RuleError('Wait until the current roll is resolved.');
  }

  events.push({ kind: 'card', text: `${p.name} plays ${def.name}.` });

  const freeConn = (from: LocationId, to: LocationId): boolean => {
    const c = connection(from, to);
    return Boolean(c && !c.cost);
  };
  const moveTroops = (from: LocationId, to: LocationId, want: number): number => {
    const src = s.friendly[from] ?? {};
    let moved = 0;
    for (const f of Object.keys(src) as Faction[]) {
      while ((src[f] ?? 0) > 0 && moved < want) {
        src[f]! -= 1;
        const dst = (s.friendly[to] ??= {});
        dst[f] = (dst[f] ?? 0) + 1;
        moved++;
      }
    }
    return moved;
  };
  const optionalBattle = (loc: LocationId) => {
    // The event's optional battle works like an attack roll: the Eye shifts.
    if ((s.shadow[loc] ?? 0) === 0 || friendlyAt(s, loc) === 0) return;
    s.eye = regionOf(loc);
    events.push({ kind: 'card', text: `Battle is joined at ${locName(loc)} — the Eye turns to ${REGION_MAP[s.eye].name}.` });
    rollBattle(s, rng, loc, 'attack', Math.min(MAX_BATTLE_DICE, friendlyAt(s, loc)), events);
  };

  switch (card.event) {
    case 'red_arrow': {
      const from = action.location;
      const to = action.location2;
      if (!from || !to || s.siteStatus[from] !== 'haven' || s.siteStatus[to] !== 'haven' || from === to) {
        throw new RuleError('Choose two different havens.');
      }
      const moved = moveTroops(from, to, Math.min(3, action.count ?? 3));
      events.push({ kind: 'card', text: `${moved} troops answer the call, marching from ${locName(from)} to ${locName(to)}.` });
      checkHavens(s, events);
      if (action.battle) optionalBattle(to);
      break;
    }
    case 'tom_bombadil': {
      if (action.dice && action.dice.length > 0) {
        const pend = s.pending;
        if (!pend || (pend.type !== 'search' && pend.type !== 'battle')) throw new RuleError('No roll to reroll.');
        for (const die of action.dice.slice(0, 3)) {
          if (die < 0 || die >= pend.dice.length) continue;
          if (pend.type === 'search') pend.dice[die] = SEARCH_DIE[nextInt(rng, 6)] as SearchFace;
          else pend.dice[die] = BATTLE_DIE[nextInt(rng, 6)] as BattleFace;
        }
        events.push({ kind: 'card', text: `Old Tom sings the dice anew: [${pend.dice.join(' ')}].` });
      } else {
        changeHope(s, 1, events, def.name);
      }
      break;
    }
    case 'council_of_elrond': {
      if (s.solo) {
        // Solo: a free Prepare, any region card, no region match required.
        const pick = p.hand.find((cd) => cd.id === action.pick);
        if (!pick || pick.kind !== 'region') throw new RuleError('Choose a region card to Prepare.');
        if (s.supply.tokens[pick.symbol] <= 0) throw new RuleError('No matching tokens left.');
        p.hand.splice(p.hand.indexOf(pick), 1);
        s.playerDiscard.push(pick);
        s.supply.tokens[pick.symbol] -= 1;
        p.tokens[pick.symbol] += 1;
        events.push({ kind: 'card', text: `${p.name} prepares in council: a ${pick.symbol} token is banked.` });
        break;
      }
      for (const c of action.characters ?? []) {
        if (!s.characters[c]) throw new RuleError(`${c} is not in play.`);
        s.characters[c].location = 'rivendell';
      }
      if ((action.characters ?? []).length > 0) {
        events.push({
          kind: 'card',
          text: `${(action.characters ?? []).map((c) => charName(c)).join(', ')} are summoned to Rivendell (no search).`,
        });
      }
      if (action.symbol && action.toPlayer) {
        const giver = p;
        const taker = s.players.find((pl) => pl.id === action.toPlayer);
        if (!taker) throw new RuleError('Unknown player.');
        const bothThere =
          giver.characters.some((c) => s.characters[c]?.location === 'rivendell') &&
          taker.characters.some((c) => s.characters[c]?.location === 'rivendell');
        if (!bothThere) throw new RuleError('Both players need a character at Rivendell to pass a token.');
        if (giver.tokens[action.symbol] <= 0) throw new RuleError('You have no such token.');
        giver.tokens[action.symbol] -= 1;
        taker.tokens[action.symbol] += 1;
        events.push({ kind: 'card', text: `${giver.name} passes a ${action.symbol} token to ${taker.name} in council.` });
      }
      break;
    }
    case 'gwaihir': {
      const from = action.location;
      const to = action.location2;
      if (!from || !to || !freeConn(from, to)) throw new RuleError('Troops must move along a normal connection (no special paths).');
      if (friendlyAt(s, from) === 0) throw new RuleError('No friendly troops there to move.');
      const moved = moveTroops(from, to, Math.max(1, action.count ?? friendlyAt(s, from)));
      events.push({ kind: 'card', text: `The Eagle's tidings send ${moved} troops from ${locName(from)} to ${locName(to)}.` });
      checkHavens(s, events);
      if (action.battle) optionalBattle(to);
      break;
    }
    case 'rohan_horses': {
      const start = action.location;
      const legs = (action.path ?? []).slice(0, 3);
      if (!start || legs.length === 0) throw new RuleError('Choose a starting location and up to 3 destinations.');
      const riders = Object.keys(s.characters).filter((c) => s.characters[c].location === start);
      if (riders.length === 0) throw new RuleError('No characters there.');
      let here = start;
      for (const leg of legs) {
        if (!freeConn(here, leg)) throw new RuleError(`No normal connection ${locName(here)} → ${locName(leg)}.`);
        for (const c of riders) s.characters[c].location = leg;
        events.push({ kind: 'card', text: `${riders.map((c) => charName(c)).join(', ')} ride hard to ${locName(leg)}.` });
        if (riders.includes(BEARER)) {
          // Every leg exposes Frodo — a search that Stealth cannot buy off.
          s.queue.push({ step: 'search', context: 'travel', location: leg });
        }
        here = leg;
      }
      break;
    }
    case 'orc_infighting': {
      if (!action.location) throw new RuleError('Choose a location.');
      const n = removeShadow(s, action.location, Math.min(2, action.count ?? 2));
      events.push({ kind: 'card', text: `The orcs of ${locName(action.location)} turn on each other — ${n} slain.` });
      break;
    }
    case 'lembas': {
      const active = activePlayer(s);
      const c = action.character;
      if (!c || !active.characters.includes(c)) {
        throw new RuleError("Choose one of the current player's characters.");
      }
      s.turn.lembas = { character: c, remaining: (s.turn.lembas?.character === c ? s.turn.lembas.remaining : 0) + 2 };
      events.push({ kind: 'card', text: `Waybread sustains ${charName(c)}: 2 extra actions this turn.` });
      break;
    }
    case 'eagles': {
      if (!action.character || !action.location) throw new RuleError('Choose a character and destination.');
      if (!s.characters[action.character]) throw new RuleError('Not in play.');
      s.characters[action.character].location = action.location;
      events.push({ kind: 'card', text: `The Eagles bear ${charName(action.character)} to ${locName(action.location)}.` });
      if (action.character === BEARER) {
        const region = regionOf(action.location);
        s.eye = region;
        // The seven nearest Nazgûl wheel toward him at once.
        let moved = 0;
        while (moved < 7) {
          const from = Object.entries(s.wraiths)
            .filter(([r, n]) => n > 0 && r !== region)
            .sort((a, b) => regionDistance(a[0], region) - regionDistance(b[0], region) || a[0].localeCompare(b[0]))[0];
          if (!from) break;
          s.wraiths[from[0]] -= 1;
          s.wraiths[region] = (s.wraiths[region] ?? 0) + 1;
          moved++;
        }
        events.push({ kind: 'card', text: `The sky darkens: ${moved} Nazgûl converge on ${REGION_MAP[region].name} and the Eye follows!` });
        s.queue.push({ step: 'search', context: 'travel', location: action.location });
      }
      checkHavens(s, events);
      break;
    }
    case 'elronds_foresight': {
      const active = activePlayer(s);
      const top = s.playerDeck.slice(-4).reverse();
      const names = top.map((cd) =>
        cd.kind === 'region' ? REGION_MAP[cd.region].name : cd.kind === 'event' ? EVENTS.find((e) => e.key === cd.event)?.name ?? 'event' : 'SKIES DARKEN',
      );
      events.push({ kind: 'card', text: `Foresight reveals the coming cards: ${names.join(', ')}.` });
      if (action.pick) {
        const pi = s.playerDeck.findIndex((cd, j) => cd.id === action.pick && j >= s.playerDeck.length - 4);
        if (pi < 0) throw new RuleError('Pick one of the revealed cards.');
        const [taken] = s.playerDeck.splice(pi, 1);
        if (taken.kind === 'darken') throw new RuleError('A Skies Darken card may not be taken.');
        active.hand.push(taken);
        events.push({ kind: 'card', text: `${active.name} keeps a revealed card.` });
        if (active.hand.length > HAND_LIMIT) s.pending = { type: 'discard', player: active.id };
      }
      break;
    }
    case 'entmoot': {
      const n = Math.min(3, Math.max(0, action.count ?? 3), s.supply.factions.sylvan);
      s.supply.factions.sylvan -= n;
      const fg = (s.friendly['fangorn_forest'] ??= {});
      fg.sylvan = (fg.sylvan ?? 0) + n;
      events.push({ kind: 'card', text: `${n} Ents rouse at Fangorn Forest.` });
      if (action.location2) {
        if (!connection('fangorn_forest', action.location2)) throw new RuleError('March to a location adjacent to Fangorn Forest.');
        const marched = moveTroops('fangorn_forest', action.location2, friendlyAt(s, 'fangorn_forest'));
        for (const c of action.characters ?? []) {
          if (s.characters[c]?.location === 'fangorn_forest') s.characters[c].location = action.location2;
        }
        events.push({ kind: 'card', text: `The Entmoot marches: ${marched} troops to ${locName(action.location2)} (no toll, no search, no battle).` });
        checkHavens(s, events);
      }
      break;
    }
    case 'elven_cloaks': {
      if (!action.character || !action.path || action.path.length === 0) {
        throw new RuleError('Choose a character and up to 2 destinations.');
      }
      const c = action.character;
      if (!s.characters[c]) throw new RuleError('Not in play.');
      let here = s.characters[c].location;
      for (const leg of action.path.slice(0, 2)) {
        const conn = connection(here, leg);
        if (!conn) throw new RuleError(`No connection ${locName(here)} → ${locName(leg)}.`);
        if (conn.cost) pay(s, p, conn.cost, events);
        s.characters[c].location = leg;
        here = leg;
      }
      events.push({ kind: 'card', text: `Cloaked in grey, ${charName(c)} slips to ${locName(here)} — no search follows.` });
      break;
    }
    case 'palantir_gaze': {
      if (!action.character || !s.characters[action.character]) throw new RuleError('Choose a character.');
      const region = regionOf(s.characters[action.character].location);
      s.eye = region;
      moveNazgulToward(s, region, 3, events);
      events.push({ kind: 'card', text: `The stone betrays them: the Eye fixes on ${REGION_MAP[region].name}.` });
      break;
    }
    case 'conflicting_orders': {
      const from = action.location;
      const to = action.location2;
      if (!from || !to || !connection(from, to)) throw new RuleError('Choose a location and an adjacent destination.');
      const n = s.shadow[from] ?? 0;
      if (n === 0) throw new RuleError('No shadow troops there.');
      s.shadow[to] = (s.shadow[to] ?? 0) + n;
      delete s.shadow[from];
      events.push({ kind: 'card', text: `Confused orders send ${n} shadow troops from ${locName(from)} to ${locName(to)} — no battle rolls.` });
      checkHavens(s, events);
      break;
    }
    case 'gifts_elves': {
      if (!action.symbol || !action.toPlayer) throw new RuleError('Choose a symbol and a player.');
      if (s.supply.tokens[action.symbol] <= 0) throw new RuleError('None left in the supply.');
      const taker = s.players.find((pl) => pl.id === action.toPlayer);
      if (!taker) throw new RuleError('Unknown player.');
      s.supply.tokens[action.symbol] -= 1;
      taker.tokens[action.symbol] += 1;
      events.push({ kind: 'card', text: `An elven gift: ${taker.name} receives a ${action.symbol} token.` });
      break;
    }
    default:
      throw new RuleError('Unknown event.');
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

  // --- Any-turn abilities (Legolas's shot, the hobbits' distraction,
  // Galadriel's summons) work outside their owner's turn too.
  const anytimeAbility =
    action.type === 'ability' &&
    ((action.character === 'legolas' && (action.to || action.mode === 'nazgul')) ||
      (action.character === 'merry_pippin' && action.mode === 'distract') ||
      (action.character === 'galadriel' && action.mode === 'summon'));
  if (anytimeAbility && p.id !== playerId) {
    const owner = s.players.find((pl) => pl.id === playerId)!;
    doAbility(s, owner, action as Extract<Action, { type: 'ability' }>, events);
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
      spendAction(s, c);
      const region = regionOf(here);
      // Arwen's counsel: once per turn, at a haven, the region need not match.
      const counsel = c === 'arwen' && isHaven(s, here) && !s.turn.abilityUsed['arwen_counsel'];
      const matches = (card: { kind: string; region?: string; symbol?: string }) => {
        if (card.kind !== 'region') return false;
        // Boromir is tempted: Resistance cards never change hands through him.
        if (c === 'boromir' && card.symbol === 'resistance') return false;
        return counsel || card.region === region;
      };
      if (action.give) {
        const target = action.takeFrom ? s.players.find((pl) => pl.id === action.takeFrom) : other;
        if (!target) throw new RuleError('No other player has a character here.');
        if (!target.characters.some((cc) => s.characters[cc]?.location === here)) {
          throw new RuleError('That player has no character here.');
        }
        const idx = p.hand.findIndex((cd) => cd.id === action.give);
        if (idx < 0) throw new RuleError('Card not in your hand.');
        const card = p.hand[idx];
        if (!matches(card)) {
          throw new RuleError('You may only pass a region card matching the region you are in.');
        }
        if (counsel && card.kind === 'region' && card.region !== region) s.turn.abilityUsed['arwen_counsel'] = true;
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
        if (!matches(card)) {
          throw new RuleError('You may only take a region card matching the region you are in.');
        }
        if (counsel && card.kind === 'region' && card.region !== region) s.turn.abilityUsed['arwen_counsel'] = true;
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
      // Gollum needs no haven; everyone else does.
      if (c !== 'gollum' && !isHaven(s, here)) throw new RuleError('Prepare only at a haven.');
      const idx = p.hand.findIndex((cd) => cd.id === action.card);
      if (idx < 0) throw new RuleError('Card not in your hand.');
      const card = p.hand[idx];
      if (card.kind !== 'region') throw new RuleError('Discard a region card to Prepare.');
      if (s.solo && card.region !== regionOf(here)) {
        throw new RuleError('Solo rule: Prepare only with a card matching the region you are in.');
      }
      // Frodo & Sam bank an extra token at a haven within the card's region.
      const take = c === BEARER && isHaven(s, here) && card.region === regionOf(here) ? 2 : 1;
      if (s.supply.tokens[card.symbol] <= 0) throw new RuleError('No matching tokens left in the supply.');
      spendAction(s, c);
      p.hand.splice(idx, 1);
      s.playerDiscard.push(card);
      const got = Math.min(take, s.supply.tokens[card.symbol]);
      s.supply.tokens[card.symbol] -= got;
      p.tokens[card.symbol] += got;
      events.push({ kind: 'action', text: `${charName(c)} prepares: ${p.name} banks ${got} ${card.symbol} token${got > 1 ? 's' : ''}.` });
      // Arwen sends aid: an Elven troop rides to a character in the card's region.
      if (c === 'arwen' && (s.friendly[here]?.sylvan ?? 0) > 0) {
        const target = Object.keys(s.characters).find(
          (cc) => cc !== c && regionOf(s.characters[cc].location) === card.region,
        );
        if (target) {
          const dest = s.characters[target].location;
          s.friendly[here]!.sylvan! -= 1;
          const at = (s.friendly[dest] ??= {});
          at.sylvan = (at.sylvan ?? 0) + 1;
          events.push({ kind: 'action', text: `Arwen sends aid: an Elven troop joins ${charName(target)} at ${locName(dest)}.` });
          checkHavens(s, events);
        }
      }
      break;
    }

    case 'muster': {
      const c = action.character;
      requireOwn(p, c);
      if (c === 'gollum') throw new RuleError('Gollum will not muster troops.');
      const here = s.characters[c].location;
      const faction = MAP[here].muster;
      if (!faction) throw new RuleError('Muster only at a location with a muster icon.');
      if (s.supply.factions[faction] <= 0) throw new RuleError('No troops of that army left.');
      // Home-army musters are free: Éowyn/Éomer? no — Éowyn (riders),
      // Arwen (elves), Boromir (gondor), Gimli (dwarves).
      const FREE_MUSTER: Record<string, Faction> = {
        eowyn: 'riders',
        arwen: 'sylvan',
        boromir: 'vale',
        gimli: 'deepholm',
      };
      const free = FREE_MUSTER[c] === faction;
      spendAction(s, c);
      if (!free) pay(s, p, ['friendship'], events);
      const amount = Math.min(c === 'gandalf' ? 2 : 1, s.supply.factions[faction]); // Gandalf inspires an extra troop
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
      if (c === 'gollum') throw new RuleError('Gollum will not fight openly.');
      const loc = s.characters[c].location;
      if ((s.shadow[loc] ?? 0) === 0 || friendlyAt(s, loc) === 0) {
        throw new RuleError('Attack needs friendly and shadow troops in your location.');
      }
      const maxDice = Math.min(MAX_BATTLE_DICE, friendlyAt(s, loc));
      const dice = Math.max(1, Math.min(action.dice, maxDice));
      // Faramir's ambush: traveling here with troops earned a free Attack.
      if (s.turn.freeAttack && s.turn.freeAttack.character === c && s.turn.freeAttack.location === loc) {
        delete s.turn.freeAttack;
        events.push({ kind: 'action', text: `${charName(c)} springs the ambush (free attack).` });
      } else {
        spendAction(s, c);
      }
      // Attacks draw the Eye.
      s.eye = regionOf(loc);
      events.push({
        kind: 'action',
        text: `${charName(c)} attacks at ${locName(loc)} — the Eye turns to ${REGION_MAP[s.eye].name}.`,
        fx: { fx: 'eye', to: s.eye },
      });
      if (regionOf(loc) === MORDOR) completeObjective(s, 'challenge_sauron', events);
      rollBattle(s, rng, loc, 'attack', dice, events);
      break;
    }

    case 'capture': {
      const c = action.character;
      requireOwn(p, c);
      if (c === 'gollum') throw new RuleError('Gollum will not storm fortresses.');
      const here = s.characters[c].location;
      if (s.siteStatus[here] !== 'stronghold') throw new RuleError('Capture a shadow stronghold.');
      if (friendlyAt(s, here) === 0) throw new RuleError('A friendly troop must be present.');
      if ((s.shadow[here] ?? 0) > 0) throw new RuleError('Clear the shadow troops first.');
      const cost = c === 'boromir' ? CAPTURE_COST - 1 : CAPTURE_COST;
      spendAction(s, c);
      pay(s, p, Array(cost).fill('valor') as SymbolKind[], events);
      s.siteStatus[here] = 'haven';
      // Captured strongholds no longer receive card-driven shadow troops.
      s.spawnStopped[here] = true;
      s.eye = regionOf(here);
      events.push({
        kind: 'haven',
        text: `${locName(here)} is captured — it now shelters the Free Peoples! The Eye turns to ${REGION_MAP[s.eye].name}.`,
        fx: { fx: 'eye', to: s.eye },
      });
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

    case 'ability':
      doAbility(s, p, action, events);
      break;

    case 'endTurn':
      // Gollum's company wears on the Ring-bearers.
      if (
        s.characters['gollum'] &&
        s.characters[BEARER] &&
        s.characters['gollum'].location === s.characters[BEARER].location
      ) {
        events.push({ kind: 'turn', text: 'Gollum whispers poison in the dark beside Frodo...' });
        changeHope(s, -1, events, "Gollum's company");
      }
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
// Activated character abilities
// ---------------------------------------------------------------------------

function oncePerTurn(s: GameState, key: string): void {
  if (s.turn.abilityUsed[key]) throw new RuleError('Once per turn.');
  s.turn.abilityUsed[key] = true;
}

function gainToken(s: GameState, p: PlayerState, sym: SymbolKind, events: GameEvent[], why: string): void {
  if (s.supply.tokens[sym] <= 0) throw new RuleError(`No ${sym} tokens left in the supply.`);
  s.supply.tokens[sym] -= 1;
  p.tokens[sym] += 1;
  events.push({ kind: 'action', text: `${why}: ${p.name} gains a ${sym} token.` });
}

function doAbility(
  s: GameState,
  p: PlayerState,
  action: Extract<Action, { type: 'ability' }>,
  events: GameEvent[],
): void {
  const c = action.character;
  requireOwn(p, c);
  const here = s.characters[c]?.location;
  if (!here) throw new RuleError('Character not in play.');

  switch (c) {
    case 'aragorn': {
      // His blade, once per turn after any objective is won: an action that
      // removes 1 shadow troop from his location.
      if (!s.objectives.some((o) => o.complete)) throw new RuleError('Requires a completed objective.');
      if ((s.shadow[here] ?? 0) === 0) throw new RuleError('No shadow troops here.');
      oncePerTurn(s, 'aragorn_blade');
      spendAction(s, c);
      removeShadow(s, here, 1);
      events.push({ kind: 'action', text: `Aragorn's blade drives the shadow from ${locName(here)}.` });
      break;
    }
    case 'eomer': {
      // A free bonus Travel once per turn.
      if (!action.to) throw new RuleError('Choose where Éomer rides.');
      const conn = connection(here, action.to);
      if (!conn) throw new RuleError('Not connected.');
      if (conn.cost) pay(s, p, conn.cost, events);
      oncePerTurn(s, 'eomer_ride');
      s.characters[c].location = action.to;
      events.push({ kind: 'action', text: `Éomer rides free to ${locName(action.to)}.` });
      checkStateObjectives(s, events);
      break;
    }
    case 'gimli':
      oncePerTurn(s, 'gimli_craft');
      spendAction(s, c);
      gainToken(s, p, 'valor', events, "Gimli's craft");
      break;
    case 'legolas': {
      if (action.mode === 'peek') {
        // Free once per turn: glimpse the top shadow card.
        oncePerTurn(s, 'legolas_sight');
        const top = s.shadowDeck[s.shadowDeck.length - 1];
        const desc = !top
          ? 'nothing — the deck is empty'
          : top.special
            ? SPECIAL_SHADOW_INFO[top.special].name
            : `${locName(top.lineFrom!)} → ${locName(top.lineTo!)} / ${locName(top.reinforce!)}`;
        events.push({ kind: 'action', text: `Legolas's keen eyes read the next shadow card: ${desc}.` });
        break;
      }
      if (action.mode === 'nazgul') {
        // A shot on any turn: 1 Stealth sends a Nazgûl in his region to Mordor.
        const region = regionOf(here);
        if ((s.wraiths[region] ?? 0) === 0) throw new RuleError('No Nazgûl in his region.');
        pay(s, p, ['stealth'], events);
        s.wraiths[region] -= 1;
        s.wraiths[MORDOR] = (s.wraiths[MORDOR] ?? 0) + 1;
        events.push({ kind: 'action', text: `Legolas's arrow finds its mark — a Nazgûl flees ${REGION_MAP[region].name} for Mordor.` });
        break;
      }
      if (action.to) {
        // A shot on any turn: 1 Stealth removes a shadow troop at or beside him.
        if (action.to !== here && !connection(here, action.to)) throw new RuleError('Target at or adjacent to Legolas.');
        if ((s.shadow[action.to] ?? 0) === 0) throw new RuleError('No shadow troops there.');
        pay(s, p, ['stealth'], events);
        removeShadow(s, action.to, 1);
        events.push({ kind: 'action', text: `Legolas fells a shadow troop at ${locName(action.to)}.` });
        break;
      }
      // Default: walk silently — an action for a Stealth token.
      oncePerTurn(s, 'legolas_walk');
      spendAction(s, c);
      gainToken(s, p, 'stealth', events, 'Legolas walks unseen');
      break;
    }
    case 'merry_pippin': {
      if (action.mode === 'song') {
        // In Frodo's location: an action and 3 Friendship for 2 hope.
        if (s.characters[BEARER]?.location !== here) throw new RuleError('They must be with Frodo.');
        spendAction(s, c);
        pay(s, p, ['friendship', 'friendship', 'friendship'], events);
        events.push({ kind: 'action', text: 'Merry and Pippin strike up a song for weary hearts.' });
        changeHope(s, 2, events, 'a hobbit song');
        break;
      }
      if (action.mode === 'distract') {
        // Any turn: lure 2 Nazgûl into their region while fewer than 4 haunt it.
        const region = regionOf(here);
        if ((s.wraiths[region] ?? 0) >= 4) throw new RuleError('Their region already crawls with Nazgûl.');
        pay(s, p, ['friendship'], events);
        moveNazgulToward(s, region, 2, events);
        break;
      }
      oncePerTurn(s, 'mp_friend');
      spendAction(s, c);
      gainToken(s, p, 'friendship', events, 'Loyal friends');
      break;
    }
    case 'galadriel': {
      if (action.mode === 'summon') {
        // Any turn, at a haven: 1 Friendship calls in an unused event card.
        if (!isHaven(s, here)) throw new RuleError('Galadriel must be at a haven.');
        if (s.unusedEvents.length === 0) throw new RuleError('No events remain outside the game.');
        pay(s, p, ['friendship'], events);
        const idx = Math.floor((s.rngState % 997) / 997 * s.unusedEvents.length) % s.unusedEvents.length;
        const [card] = s.unusedEvents.splice(idx, 1);
        p.hand.push(card);
        const def = EVENTS.find((e) => e.key === (card as { event: string }).event);
        events.push({ kind: 'action', text: `Galadriel's light reveals a lost chance: ${def?.name}.` });
        if (p.hand.length > HAND_LIMIT) s.pending = { type: 'discard', player: p.id };
        break;
      }
      // Her Mirror, once per turn (action): reveal the next 4 player cards.
      oncePerTurn(s, 'galadriel_mirror');
      spendAction(s, c);
      const top = s.playerDeck.slice(-4).reverse();
      const names = top.map((cd) =>
        cd.kind === 'region'
          ? REGION_MAP[cd.region].name
          : cd.kind === 'event'
            ? EVENTS.find((e) => e.key === cd.event)?.name ?? 'event'
            : 'SKIES DARKEN',
      );
      events.push({ kind: 'action', text: `The Mirror shows what comes: ${names.join(', ')}.` });
      break;
    }
    case 'faramir': {
      // Once per turn (action), at a haven: recover a matching region card
      // from the discard pile.
      if (!isHaven(s, here)) throw new RuleError('Faramir must be at a haven.');
      const idx = s.playerDiscard.findIndex(
        (cd) => cd.id === action.card && cd.kind === 'region' && cd.region === regionOf(here),
      );
      if (idx < 0) throw new RuleError('Choose a discarded region card matching his region.');
      oncePerTurn(s, 'faramir_wisdom');
      spendAction(s, c);
      const [card] = s.playerDiscard.splice(idx, 1);
      p.hand.push(card);
      events.push({ kind: 'action', text: `Faramir recovers a ${REGION_MAP[(card as { region: string }).region].name} card from the discard.` });
      if (p.hand.length > HAND_LIMIT) s.pending = { type: 'discard', player: p.id };
      break;
    }
    case 'gollum': {
      // Once per turn (action): filch any card from the discard pile.
      const idx = s.playerDiscard.findIndex((cd) => cd.id === action.card);
      if (idx < 0) throw new RuleError('Choose a card from the discard pile.');
      oncePerTurn(s, 'gollum_slink');
      spendAction(s, c);
      const [card] = s.playerDiscard.splice(idx, 1);
      p.hand.push(card);
      events.push({ kind: 'action', text: 'Gollum slinks off with a discarded card, precious.' });
      if (p.hand.length > HAND_LIMIT) s.pending = { type: 'discard', player: p.id };
      break;
    }
    default:
      throw new RuleError('That character has no activated ability.');
  }
}

/** Move `count` Nazgûl (from the largest groups elsewhere) into `target`. */
function moveNazgulToward(s: GameState, target: RegionId, count: number, events: GameEvent[]): void {
  for (let i = 0; i < count; i++) {
    const from = Object.entries(s.wraiths)
      .filter(([r, n]) => n > 0 && r !== target)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (!from) return;
    s.wraiths[from[0]] -= 1;
    s.wraiths[target] = (s.wraiths[target] ?? 0) + 1;
    events.push({ kind: 'action', text: `A Nazgûl is drawn from ${REGION_MAP[from[0]].name} to ${REGION_MAP[target].name}.` });
  }
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
  let conn = connection(from, action.to);
  // Gandalf alone rides two connections on ordinary roads.
  let gandalfRide = false;
  if (
    !conn &&
    c === 'gandalf' &&
    (action.companions ?? []).length === 0 &&
    !Object.values(action.troops ?? {}).some((n) => (n ?? 0) > 0)
  ) {
    const twoStep = CONNECTIONS[from].some(
      (c1) => !c1.cost && CONNECTIONS[c1.to].some((c2) => !c2.cost && c2.to === action.to),
    );
    if (twoStep) {
      gandalfRide = true;
      conn = { to: action.to };
    }
  }
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

  // Special path cost (Faramir the ranger spends 1 fewer symbol).
  if (conn.cost) {
    const cost = c === 'faramir' ? conn.cost.slice(1) : conn.cost;
    if (cost.length > 0) pay(s, p, cost, events);
  }

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
    text: `${charName(c)} travels to ${locName(action.to)}${extras.length ? ` with ${extras.join(', ')}` : ''}${gandalfRide ? ' (riding hard, two roads)' : ''}.`,
    fx: { fx: 'move', piece: 'character', from, to: action.to, character: c },
  });
  // Faramir leading troops may spring a free Attack at his destination.
  if (c === 'faramir' && Object.values(troops).some((n) => (n ?? 0) > 0)) {
    s.turn.freeAttack = { character: c, location: action.to };
  }
  checkHavens(s, events);

  if (bearerMoves) {
    if (action.cover === 'stealth') {
      pay(s, p, ['stealth'], events);
      events.push({ kind: 'search', text: 'Frodo slips through unseen (stealth spent).' });
    } else if (action.cover === 'ring') {
      // Rulebook fine point: lose 1 hope, Eye to his region, search ignoring shadow troops.
      changeHope(s, -1, events, 'Frodo puts on the Ring');
      s.eye = regionOf(action.to);
      events.push({ kind: 'search', text: `Frodo puts on the Ring! The Eye turns to ${REGION_MAP[s.eye].name}.`, fx: { fx: 'eye', to: s.eye } });
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

  if (pend.type === 'wheels') {
    if (action.type !== 'wheels') throw new RuleError('The Wheels of Saruman must be resolved first.');
    // Stage 1: the current player picks a woe.
    if (!pend.mode && pend.remaining === undefined) {
      if (playerId !== activePlayer(s).id) throw new RuleError('The current player chooses.');
      if (action.pick === 'despair') {
        changeHope(s, -1, events, 'despair spreads through the Fellowship');
        s.pending = null;
        return;
      }
      if (action.pick === 'oath') {
        if (Object.values(s.friendly).every((fs) => Object.values(fs).every((n) => !n))) {
          throw new RuleError('No friendly troops on the board — pick another option.');
        }
        pend.mode = 'oath';
        pend.remaining = 2;
        events.push({ kind: 'shadow', text: 'Oaths break — remove 2 friendly troops from the board.' });
        return;
      }
      if (action.pick === 'doubt') {
        const target = s.players.find((pl) => pl.id === action.toPlayer);
        if (!target) throw new RuleError('Pick which player pays the price.');
        const wealth = target.hand.length + Object.values(target.tokens).reduce((a, b) => a + b, 0);
        if (wealth === 0) throw new RuleError('That player has nothing to give up.');
        pend.mode = 'doubt';
        pend.player = target.id;
        pend.remaining = Math.min(2, wealth);
        events.push({ kind: 'shadow', text: `Doubt gnaws at ${target.name} — they must give up ${pend.remaining} card${pend.remaining > 1 ? 's' : ''}/token${pend.remaining > 1 ? 's' : ''}.` });
        return;
      }
      throw new RuleError('Pick Break Oath, Doubt, or Despair.');
    }
    // Stage 2: resolve targets.
    if (pend.mode === 'oath') {
      if (playerId !== activePlayer(s).id) throw new RuleError('The current player picks the troops.');
      const loc = action.location;
      const f = action.faction;
      if (!loc || !f || !(s.friendly[loc]?.[f] ?? 0)) throw new RuleError('Pick a friendly troop on the board.');
      s.friendly[loc]![f]! -= 1;
      s.supply.factions[f] += 1;
      events.push({ kind: 'shadow', text: `A ${FACTION_NAMES[f]} troop abandons ${locName(loc)}.` });
      checkHavens(s, events);
      pend.remaining! -= 1;
      if (pend.remaining! <= 0 || Object.values(s.friendly).every((fs) => Object.values(fs).every((n) => !n))) {
        s.pending = null;
      }
      return;
    }
    // Doubt: the chosen player gives up cards and/or tokens.
    if (playerId !== pend.player) throw new RuleError('Not your price to pay.');
    if (action.card) {
      const idx = player.hand.findIndex((c) => c.id === action.card);
      if (idx < 0) throw new RuleError('Card not in your hand.');
      const [card] = player.hand.splice(idx, 1);
      s.playerDiscard.push(card);
      events.push({ kind: 'shadow', text: `${player.name} discards a card in doubt.` });
    } else if (action.symbol) {
      if ((player.tokens[action.symbol] ?? 0) <= 0) throw new RuleError('No such token.');
      player.tokens[action.symbol] -= 1;
      s.supply.tokens[action.symbol] += 1;
      events.push({ kind: 'shadow', text: `${player.name} returns a ${action.symbol} token in doubt.` });
    } else {
      throw new RuleError('Pick a card or token to give up.');
    }
    pend.remaining! -= 1;
    const wealth = player.hand.length + Object.values(player.tokens).reduce((a, b) => a + b, 0);
    if (pend.remaining! <= 0 || wealth === 0) s.pending = null;
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
      if (action.free) {
        // Character-granted free rerolls, once per roll: Aragorn on searches,
        // Galadriel (with an Elven troop present) in battles.
        if (pend.freeRerollUsed) throw new RuleError('The free reroll is already spent.');
        const ok =
          pend.type === 'search'
            ? s.characters['aragorn']?.location === pend.location
            : s.characters['galadriel']?.location === pend.location &&
              (s.friendly[pend.location]?.sylvan ?? 0) > 0;
        if (!ok) throw new RuleError('No character grants a free reroll here.');
        pend.freeRerollUsed = true;
      } else {
        // Resistance pays for rerolls; with Gandalf present, Valor serves too.
        const hasResistance =
          player.tokens.resistance > 0 ||
          player.hand.some((cd) => cd.kind === 'region' && cd.symbol === 'resistance');
        if (!hasResistance && pend.type === 'battle' && s.characters['gandalf']?.location === pend.location) {
          pay(s, player, ['valor'], events);
        } else {
          pay(s, player, ['resistance'], events);
        }
      }
      if (pend.type === 'search') {
        pend.dice[action.die] = SEARCH_DIE[nextInt(rng, 6)] as SearchFace;
      } else {
        pend.dice[action.die] = BATTLE_DIE[nextInt(rng, 6)] as BattleFace;
      }
      events.push({ kind: pend.type, text: `${player.name} rerolls a die: now [${pend.dice.join(' ')}].` });
      return;
    }
    case 'ignoreDie': {
      // Sam's steadfast aid: 1 Friendship neutralizes a harmful search die.
      if (pend.type !== 'search') throw new RuleError('Only search dice can be shrugged off.');
      if (s.characters[BEARER]?.location !== pend.location || !player.characters.includes(BEARER)) {
        throw new RuleError("Only Frodo & Sam's player may do this, with them present.");
      }
      const face = pend.dice[action.die];
      if (face !== 'weary' && face !== 'exposed') throw new RuleError('Only Weary or Exposed dice.');
      if (pend.ignored.includes(action.die)) throw new RuleError('Already shrugged off.');
      pay(s, player, ['friendship'], events);
      pend.ignored.push(action.die);
      events.push({ kind: 'search', text: `Sam steadies Frodo — a ${face} result is shrugged off.` });
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
