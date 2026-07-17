import {
  ACTIONS_PRIMARY,
  ACTIONS_SECONDARY,
  BATTLE_DICE,
  BEACON_TARGET,
  CARDS_PER_TURN,
  CORRUPTION_MAX,
  FALL_THRESHOLD,
  FALLEN_LOSS,
  GARRISON_TARGET,
  HAND_LIMIT,
  HOPE_MAX,
  MUSTER_AMOUNT,
  OBJECTIVES_REQUIRED,
  PURGE_TARGET,
  SIEGE_THRESHOLD,
  THREAT_TRACK,
  WRAITH_COUNT_MAX,
} from './data/constants.js';
import { HERO_MAP, SHARDBEARER_NAME } from './data/heroes.js';
import { GOAL_LOCATION, MAP, areAdjacent, stepToward } from './data/map.js';
import { makeRng, next, shuffle, type Rng } from './rng.js';
import type {
  Action,
  ActionResult,
  Faction,
  GameEvent,
  GameState,
  HeroId,
  LocationId,
  PlayerCard,
  PlayerId,
  PlayerState,
  ShadowCard,
} from './types.js';

export class RuleError extends Error {}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function activePlayer(s: GameState): PlayerState {
  return s.players[s.turn.playerIdx];
}

function heroName(id: HeroId): string {
  return HERO_MAP[id].name;
}

function locName(id: LocationId): string {
  return MAP[id].name;
}

function alliedAt(s: GameState, loc: LocationId): number {
  const a = s.allied[loc];
  if (!a) return 0;
  return Object.values(a).reduce((x, y) => x + (y ?? 0), 0);
}

function otherHero(p: PlayerState, hero: HeroId): HeroId {
  return p.heroes[0] === hero ? p.heroes[1] : p.heroes[0];
}

function playerOwnsHero(p: PlayerState, hero: HeroId): boolean {
  return p.heroes.includes(hero);
}

/**
 * Turn budget: one of your two heroes may take up to 4 actions, the other up
 * to 1 — decided implicitly by how you spend them. A new action by `hero` is
 * legal if afterwards one hero has <= 4 used and the other <= 1.
 */
export function canAct(s: GameState, hero: HeroId): boolean {
  const p = activePlayer(s);
  if (!playerOwnsHero(p, hero)) return false;
  const used = { ...s.turn.actionsUsed };
  used[hero] = (used[hero] ?? 0) + 1;
  const a = used[p.heroes[0]] ?? 0;
  const b = used[p.heroes[1]] ?? 0;
  return Math.min(a, b) <= ACTIONS_SECONDARY && Math.max(a, b) <= ACTIONS_PRIMARY;
}

export function actionsRemaining(s: GameState): { hero: HeroId; remaining: number }[] {
  const p = activePlayer(s);
  return p.heroes.map((h) => {
    const usedH = s.turn.actionsUsed[h] ?? 0;
    const usedOther = s.turn.actionsUsed[otherHero(p, h)] ?? 0;
    const cap = usedOther > ACTIONS_SECONDARY ? ACTIONS_SECONDARY : ACTIONS_PRIMARY;
    return { hero: h, remaining: Math.max(0, cap - usedH) };
  });
}

function checkObjectives(s: GameState, events: GameEvent[]): void {
  for (const obj of s.objectives) {
    if (obj.complete) continue;
    let done = false;
    if (obj.id === 'garrisons') {
      const standing = Object.entries(s.sanctuaries).filter(([, st]) => st !== 'fallen');
      done =
        standing.length > 0 &&
        standing.every(([loc]) => alliedAt(s, loc) >= GARRISON_TARGET);
    } else if (obj.id === 'purge') {
      done = s.shadowSlain >= PURGE_TARGET;
    } else if (obj.id === 'beacon') {
      done = s.hope >= BEACON_TARGET;
    }
    if (done) {
      obj.complete = true;
      events.push({ kind: 'objective', text: `Objective complete: ${obj.name}!` });
    }
  }
}

function loseGame(s: GameState, reason: string, events: GameEvent[]): void {
  if (s.phase !== 'playing') return;
  s.phase = 'lost';
  s.lossReason = reason;
  events.push({ kind: 'loss', text: `The realm falls: ${reason}` });
}

function changeHope(s: GameState, delta: number, events: GameEvent[], why: string): void {
  const before = s.hope;
  s.hope = Math.max(0, Math.min(HOPE_MAX, s.hope + delta));
  if (s.hope !== before) {
    events.push({
      kind: delta < 0 ? 'shadow' : 'action',
      text: `Hope ${delta < 0 ? 'falls' : 'rises'} to ${s.hope} (${why}).`,
    });
  }
  if (s.hope <= 0) loseGame(s, 'hope is extinguished', events);
}

/**
 * Place shadow troops at a location. Garrisoned allied troops absorb spawns
 * one-for-one (both are removed). Handles sieges and falls of sanctuaries.
 */
function spawnShadow(s: GameState, loc: LocationId, n: number, events: GameEvent[]): void {
  for (let i = 0; i < n && s.phase === 'playing'; i++) {
    // Allied garrison absorbs the spawn: one ally falls, no shadow lands.
    const a = s.allied[loc];
    if (a) {
      const faction = (Object.keys(a) as Faction[]).find((f) => (a[f] ?? 0) > 0);
      if (faction) {
        a[faction]! -= 1;
        s.supply.factions[faction] += 1;
        events.push({
          kind: 'shadow',
          text: `Shadow assails ${locName(loc)} — an allied troop falls holding the line.`,
        });
        continue;
      }
    }
    if (s.supply.shadow <= 0) {
      loseGame(s, 'the shadow is endless (troop supply exhausted)', events);
      return;
    }
    s.supply.shadow -= 1;
    s.shadow[loc] = (s.shadow[loc] ?? 0) + 1;
    events.push({ kind: 'shadow', text: `Shadow troops muster at ${locName(loc)} (${s.shadow[loc]}).` });

    const status = s.sanctuaries[loc];
    if (status === 'standing' && s.shadow[loc] >= SIEGE_THRESHOLD) {
      s.sanctuaries[loc] = 'besieged';
      events.push({ kind: 'siege', text: `${locName(loc)} is besieged!` });
      changeHope(s, -1, events, `${locName(loc)} besieged`);
    } else if (status === 'besieged' && s.shadow[loc] >= FALL_THRESHOLD) {
      s.sanctuaries[loc] = 'fallen';
      events.push({ kind: 'siege', text: `${locName(loc)} has fallen to the shadow!` });
      changeHope(s, -2, events, `${locName(loc)} fell`);
      const fallen = Object.values(s.sanctuaries).filter((st) => st === 'fallen').length;
      if (fallen >= FALLEN_LOSS) {
        loseGame(s, `${fallen} sanctuaries lie in ruin`, events);
      }
    }
  }
}

function removeShadow(s: GameState, loc: LocationId, n: number, events: GameEvent[], slain: boolean): number {
  const have = s.shadow[loc] ?? 0;
  const removed = Math.min(have, n);
  if (removed > 0) {
    s.shadow[loc] = have - removed;
    if (s.shadow[loc] === 0) delete s.shadow[loc];
    s.supply.shadow += removed;
    if (slain) s.shadowSlain += removed;
    // Lifting a siege
    if (s.sanctuaries[loc] === 'besieged' && (s.shadow[loc] ?? 0) < SIEGE_THRESHOLD) {
      s.sanctuaries[loc] = 'standing';
      events.push({ kind: 'siege', text: `The siege of ${locName(loc)} is broken!` });
    }
  }
  return removed;
}

function drawShadowCard(s: GameState, rng: Rng): ShadowCard | undefined {
  if (s.foreseen.length > 0) return s.foreseen.shift();
  if (s.shadowDeck.length === 0) {
    // The shadow never rests: reshuffle the discard.
    s.shadowDeck = shuffle(rng, [...s.shadowDiscard]);
    s.shadowDiscard = [];
  }
  return s.shadowDeck.pop();
}

function huntCheck(s: GameState, rng: Rng, events: GameEvent[]): void {
  const loc = s.shardbearer.location;
  const wraithsHere = s.wraiths.filter((w) => w.location === loc).length;
  if (wraithsHere === 0 || s.phase !== 'playing') return;
  let eyes = 0;
  for (let i = 0; i < wraithsHere; i++) {
    if (next(rng) < 1 / 3) eyes++;
  }
  if (eyes === 0) {
    events.push({
      kind: 'hunt',
      text: `Wraiths search ${locName(loc)} but ${SHARDBEARER_NAME} slips away unseen.`,
    });
    return;
  }
  if (s.shardbearer.hidden) {
    s.shardbearer.hidden = false;
    events.push({
      kind: 'hunt',
      text: `Wraiths sweep ${locName(loc)} — ${SHARDBEARER_NAME}'s hiding place is compromised!`,
    });
    return;
  }
  s.shardbearer.corruption = Math.min(CORRUPTION_MAX, s.shardbearer.corruption + eyes);
  events.push({
    kind: 'hunt',
    text: `Wraiths find ${SHARDBEARER_NAME}'s trail! Corruption rises to ${s.shardbearer.corruption}.`,
  });
  if (s.shardbearer.corruption >= CORRUPTION_MAX) {
    loseGame(s, `${SHARDBEARER_NAME} succumbs to the Ember's corruption`, events);
  }
}

function moveWraithsToward(s: GameState, count: number, events: GameEvent[]): void {
  // The `count` wraiths nearest the shardbearer (by id order for determinism)
  // each advance one step.
  let moved = 0;
  for (const w of s.wraiths) {
    if (moved >= count) break;
    if (w.location === s.shardbearer.location) continue;
    const step = stepToward(w.location, s.shardbearer.location);
    if (step !== w.location) {
      w.location = step;
      moved++;
      events.push({ kind: 'shadow', text: `A wraith rides to ${locName(step)}.` });
    }
  }
}

function resolveSurge(s: GameState, rng: Rng, events: GameEvent[]): void {
  events.push({ kind: 'shadow', text: 'ASHEN SURGE! The shadow gathers its strength.' });
  if (s.threatIdx < THREAT_TRACK.length - 1) s.threatIdx += 1;
  events.push({
    kind: 'shadow',
    text: `Threat rises: ${THREAT_TRACK[s.threatIdx]} shadow cards per turn.`,
  });
  // Heavy spawn at the bottom card of the shadow deck (the "deepest peril").
  const bottom = s.shadowDeck.length > 0 ? s.shadowDeck.shift() : undefined;
  if (bottom) {
    if (bottom.kind === 'spawn' && bottom.location) {
      spawnShadow(s, bottom.location, 3, events);
    } else {
      moveWraithsToward(s, s.wraiths.length, events);
    }
    s.shadowDiscard.push(bottom);
  }
  // A new wraith rides out from Wraithspire.
  if (s.wraiths.length < WRAITH_COUNT_MAX) {
    s.wraiths.push({ id: s.wraiths.length, location: 'wraithspire' });
    events.push({ kind: 'shadow', text: 'A new wraith rides out from Wraithspire.' });
  }
  // The shadow discard returns to the top of the deck.
  if (s.shadowDiscard.length > 0) {
    const recycled = shuffle(rng, [...s.shadowDiscard]);
    s.shadowDeck = [...s.shadowDeck, ...recycled];
    s.shadowDiscard = [];
    events.push({ kind: 'shadow', text: 'Old perils stir again (shadow discard reshuffled).' });
  }
}

// ---------------------------------------------------------------------------
// Card play
// ---------------------------------------------------------------------------

function playCard(
  s: GameState,
  rng: Rng,
  action: Extract<Action, { type: 'playCard' }>,
  events: GameEvent[],
): void {
  const p = activePlayer(s);
  const idx = p.hand.findIndex((c) => c.id === action.card);
  if (idx < 0) throw new RuleError('That card is not in your hand.');
  const card = p.hand[idx];

  switch (card.kind) {
    case 'ashen_surge':
      throw new RuleError('Ashen Surge cannot be played.');
    case 'swift_march': {
      if (!action.hero || !action.path) throw new RuleError('Swift March needs a hero and a path.');
      if (!playerOwnsHero(p, action.hero)) throw new RuleError('Not your hero.');
      validatePath(s.heroes[action.hero].location, action.path, 2);
      s.heroes[action.hero].location = action.path[action.path.length - 1];
      events.push({
        kind: 'card',
        text: `${p.name} plays Swift March: ${heroName(action.hero)} hurries to ${locName(s.heroes[action.hero].location)}.`,
      });
      break;
    }
    case 'rally_banner': {
      if (!action.location) throw new RuleError('Rally Banner needs a sanctuary.');
      const def = MAP[action.location];
      if (!def?.sanctuary || s.sanctuaries[action.location] === 'fallen') {
        throw new RuleError('Rally Banner targets a standing sanctuary.');
      }
      const faction = def.sanctuary;
      const amount = Math.min(2, s.supply.factions[faction]);
      if (amount === 0) throw new RuleError(`No ${faction} troops left in the supply.`);
      s.supply.factions[faction] -= amount;
      const a = (s.allied[action.location] ??= {});
      a[faction] = (a[faction] ?? 0) + amount;
      events.push({
        kind: 'card',
        text: `${p.name} plays Rally Banner: ${amount} troops muster at ${locName(action.location)}.`,
      });
      break;
    }
    case 'ambush': {
      if (!action.location) throw new RuleError('Ambush needs a target location.');
      const near = p.heroes.some(
        (h) =>
          s.heroes[h].location === action.location ||
          areAdjacent(s.heroes[h].location, action.location!),
      );
      if (!near) throw new RuleError('Ambush must target a location at or adjacent to one of your heroes.');
      const removed = removeShadow(s, action.location, 2, events, true);
      if (removed === 0) throw new RuleError('No shadow troops there to ambush.');
      events.push({
        kind: 'card',
        text: `${p.name} plays Ambush: ${removed} shadow troops slain at ${locName(action.location)}.`,
      });
      break;
    }
    case 'lantern_oil':
      if (action.cleanse) {
        if (s.shardbearer.corruption <= 0) throw new RuleError('No corruption to cleanse.');
        s.shardbearer.corruption -= 1;
        events.push({
          kind: 'card',
          text: `${p.name} plays Lantern Oil: the Ember's grip eases (corruption ${s.shardbearer.corruption}).`,
        });
      } else {
        events.push({ kind: 'card', text: `${p.name} plays Lantern Oil.` });
        changeHope(s, 1, events, 'Lantern Oil');
      }
      break;
    case 'hearthsong':
      events.push({ kind: 'card', text: `${p.name} plays Hearthsong.` });
      changeHope(s, 2, events, 'Hearthsong');
      break;
    case 'fernpath': {
      if (action.hide) {
        s.shardbearer.hidden = true;
        events.push({
          kind: 'card',
          text: `${p.name} plays Fernpath: ${SHARDBEARER_NAME} goes to ground.`,
        });
      } else {
        if (!action.path || action.path.length !== 1) {
          throw new RuleError('Fernpath moves the shardbearer exactly 1 connection (or hides him).');
        }
        validatePath(s.shardbearer.location, action.path, 1);
        s.shardbearer.location = action.path[0];
        s.shardbearer.hidden = false;
        events.push({
          kind: 'card',
          text: `${p.name} plays Fernpath: ${SHARDBEARER_NAME} steals along hidden ways to ${locName(action.path[0])}.`,
        });
      }
      break;
    }
    case 'farsight': {
      // Take over any already-foreseen cards (clear first so drawShadowCard
      // doesn't hand them back to us and duplicate them).
      const seen: ShadowCard[] = [...s.foreseen];
      s.foreseen = [];
      while (seen.length < 3) {
        const c = drawShadowCard(s, rng);
        if (!c) break;
        seen.push(c);
      }
      s.foreseen = seen;
      const names = seen.map((c) =>
        c.kind === 'hunt' ? 'The Hunt' : locName(c.location!),
      );
      events.push({
        kind: 'card',
        text: `${p.name} plays Farsight. Coming perils: ${names.join(', ')}.`,
      });
      break;
    }
  }

  p.hand.splice(idx, 1);
  s.playerDiscard.push(card);
}

// ---------------------------------------------------------------------------
// Path validation
// ---------------------------------------------------------------------------

function validatePath(from: LocationId, path: LocationId[], maxLen: number): void {
  if (path.length < 1 || path.length > maxLen) {
    throw new RuleError(`Path must be 1-${maxLen} connections.`);
  }
  let cur = from;
  for (const step of path) {
    if (!MAP[step]) throw new RuleError(`Unknown location: ${step}`);
    if (!areAdjacent(cur, step)) {
      throw new RuleError(`${locName(cur)} does not connect to ${locName(step)}.`);
    }
    cur = step;
  }
}

// ---------------------------------------------------------------------------
// End of turn: draw cards, then the shadow phase
// ---------------------------------------------------------------------------

function endTurn(s: GameState, rng: Rng, events: GameEvent[]): void {
  const p = activePlayer(s);

  // Draw player cards (Nim's insight: +1).
  const hasNim = p.heroes.includes('nim');
  const draws = CARDS_PER_TURN + (hasNim ? 1 : 0);
  for (let i = 0; i < draws && s.phase === 'playing'; i++) {
    const card = s.playerDeck.pop();
    if (!card) {
      loseGame(s, 'time runs out — the player deck is exhausted', events);
      break;
    }
    if (card.kind === 'ashen_surge') {
      s.playerDiscard.push(card);
      resolveSurge(s, rng, events);
    } else {
      p.hand.push(card);
      events.push({ kind: 'turn', text: `${p.name} draws a card.` });
    }
  }
  // Hand limit: discard newest-last extras (players should play cards, not hoard).
  while (p.hand.length > HAND_LIMIT) {
    const dropped = p.hand.shift()!;
    s.playerDiscard.push(dropped);
    events.push({ kind: 'turn', text: `${p.name} is over the hand limit and loses a card.` });
  }

  // Shadow phase.
  if (s.phase === 'playing') {
    const count = THREAT_TRACK[s.threatIdx];
    events.push({ kind: 'shadow', text: `The shadow stirs (${count} cards)...` });
    for (let i = 0; i < count && s.phase === 'playing'; i++) {
      const card = drawShadowCard(s, rng);
      if (!card) break;
      if (card.kind === 'spawn' && card.location) {
        spawnShadow(s, card.location, MAP[card.location].stronghold ? 2 : 1, events);
      } else {
        events.push({ kind: 'hunt', text: 'The Hunt is called — every wraith rides!' });
        moveWraithsToward(s, s.wraiths.length, events);
      }
      s.shadowDiscard.push(card);
    }
    huntCheck(s, rng, events);
  }

  // Next player.
  if (s.phase === 'playing') {
    s.turn.playerIdx = (s.turn.playerIdx + 1) % s.players.length;
    const nextP = s.players[s.turn.playerIdx];
    s.turn.actionsUsed = Object.fromEntries(nextP.heroes.map((h) => [h, 0]));
    s.turn.kindleUsed = false;
    s.turnNumber += 1;
    events.push({ kind: 'turn', text: `— Turn ${s.turnNumber}: ${nextP.name} —` });
  }
}

// ---------------------------------------------------------------------------
// The reducer
// ---------------------------------------------------------------------------

export function applyAction(
  state: GameState,
  playerId: PlayerId,
  action: Action,
): ActionResult {
  if (state.phase !== 'playing') throw new RuleError('The game is over.');
  const s = deepClone(state);
  const events: GameEvent[] = [];
  const rng = makeRng(0);
  rng.state = s.rngState;

  const p = activePlayer(s);
  if (p.id !== playerId) throw new RuleError(`It is ${p.name}'s turn.`);

  const spendAction = (hero: HeroId) => {
    if (!playerOwnsHero(p, hero)) throw new RuleError('Not your hero.');
    if (!canAct(s, hero)) {
      throw new RuleError(
        `${heroName(hero)} has no actions left (one hero acts up to ${ACTIONS_PRIMARY} times, the other up to ${ACTIONS_SECONDARY}).`,
      );
    }
    s.turn.actionsUsed[hero] = (s.turn.actionsUsed[hero] ?? 0) + 1;
  };

  switch (action.type) {
    case 'move': {
      spendAction(action.hero);
      const maxLen = HERO_MAP[action.hero].ability === 'swift' ? 2 : 1;
      validatePath(s.heroes[action.hero].location, action.path, maxLen);
      s.heroes[action.hero].location = action.path[action.path.length - 1];
      events.push({
        kind: 'action',
        text: `${heroName(action.hero)} moves to ${locName(s.heroes[action.hero].location)}.`,
      });
      break;
    }

    case 'muster': {
      const loc = s.heroes[action.hero].location;
      const def = MAP[loc];
      if (!def.sanctuary) throw new RuleError('Muster only at a sanctuary.');
      if (s.sanctuaries[loc] === 'fallen') throw new RuleError(`${def.name} has fallen.`);
      const faction = def.sanctuary;
      const bonus = HERO_MAP[action.hero].ability === 'muster' ? 1 : 0;
      const amount = Math.min(MUSTER_AMOUNT + bonus, s.supply.factions[faction]);
      if (amount === 0) throw new RuleError(`No ${faction} troops left in the supply.`);
      spendAction(action.hero);
      s.supply.factions[faction] -= amount;
      const a = (s.allied[loc] ??= {});
      a[faction] = (a[faction] ?? 0) + amount;
      events.push({
        kind: 'action',
        text: `${heroName(action.hero)} musters ${amount} troops at ${def.name}.`,
      });
      break;
    }

    case 'battle': {
      const heroLoc = s.heroes[action.hero].location;
      const ability = HERO_MAP[action.hero].ability;
      const inRange =
        action.location === heroLoc ||
        (ability === 'longshot' && areAdjacent(heroLoc, action.location));
      if (!inRange) throw new RuleError('Battle where your hero stands (Elowen: or adjacent).');
      if ((s.shadow[action.location] ?? 0) === 0) {
        throw new RuleError('No shadow troops there.');
      }
      spendAction(action.hero);
      const dice = BATTLE_DICE + (ability === 'battle_die' ? 1 : 0);
      let kills = 0;
      let skulls = 0;
      const faces: string[] = [];
      for (let i = 0; i < dice; i++) {
        const r = next(rng);
        if (r < 1 / 6) {
          faces.push('crit');
          kills += 2;
        } else if (r < 3 / 6) {
          faces.push('hit');
          kills += 1;
        } else if (r < 5 / 6) {
          faces.push('miss');
        } else {
          faces.push('skull');
          skulls += 1;
        }
      }
      const slain = removeShadow(s, action.location, kills, events, true);
      events.push({
        kind: 'action',
        text: `${heroName(action.hero)} battles at ${locName(action.location)} [${faces.join(' ')}]: ${slain} shadow slain.`,
      });
      if (skulls > 0 && ability !== 'bulwark') {
        const a = s.allied[action.location];
        if (a) {
          for (let i = 0; i < skulls; i++) {
            const faction = (Object.keys(a) as Faction[]).find((f) => (a[f] ?? 0) > 0);
            if (!faction) break;
            a[faction]! -= 1;
            s.supply.factions[faction] += 1;
            events.push({
              kind: 'action',
              text: `An allied troop falls in the fighting at ${locName(action.location)}.`,
            });
          }
        }
      }
      break;
    }

    case 'guide': {
      const heroLoc = s.heroes[action.hero].location;
      if (heroLoc !== s.shardbearer.location && !areAdjacent(heroLoc, s.shardbearer.location)) {
        throw new RuleError(`Guide requires your hero at or adjacent to ${SHARDBEARER_NAME}.`);
      }
      const maxLen = HERO_MAP[action.hero].ability === 'guide' ? 2 : 1;
      validatePath(s.shardbearer.location, action.path, maxLen);
      spendAction(action.hero);
      s.shardbearer.location = action.path[action.path.length - 1];
      s.shardbearer.hidden = false;
      events.push({
        kind: 'action',
        text: `${heroName(action.hero)} guides ${SHARDBEARER_NAME} to ${locName(s.shardbearer.location)}.`,
      });
      // Rest at a standing sanctuary eases the Ember's grip.
      const dest = s.shardbearer.location;
      if (MAP[dest].sanctuary && s.sanctuaries[dest] !== 'fallen' && s.shardbearer.corruption > 0) {
        s.shardbearer.corruption -= 1;
        events.push({
          kind: 'action',
          text: `${SHARDBEARER_NAME} rests at ${locName(dest)} — corruption eases to ${s.shardbearer.corruption}.`,
        });
      }
      break;
    }

    case 'hide': {
      const heroLoc = s.heroes[action.hero].location;
      if (heroLoc !== s.shardbearer.location) {
        throw new RuleError(`Hide requires your hero to stand with ${SHARDBEARER_NAME}.`);
      }
      if (s.shardbearer.hidden) throw new RuleError(`${SHARDBEARER_NAME} is already hidden.`);
      spendAction(action.hero);
      s.shardbearer.hidden = true;
      events.push({
        kind: 'action',
        text: `${heroName(action.hero)} finds ${SHARDBEARER_NAME} a hiding place.`,
      });
      break;
    }

    case 'kindle': {
      if (HERO_MAP[action.hero].ability !== 'kindle') {
        throw new RuleError('Only Maelis can Kindle.');
      }
      if (s.turn.kindleUsed) throw new RuleError('Kindle is once per turn.');
      const loc = s.heroes[action.hero].location;
      if (!MAP[loc].sanctuary || s.sanctuaries[loc] === 'fallen') {
        throw new RuleError('Kindle requires a standing sanctuary.');
      }
      if (!playerOwnsHero(p, action.hero)) throw new RuleError('Not your hero.');
      s.turn.kindleUsed = true; // free action — no spendAction
      events.push({ kind: 'action', text: `${heroName(action.hero)} kindles the lamps.` });
      changeHope(s, 1, events, 'Kindle');
      break;
    }

    case 'destroyEmber': {
      if (s.shardbearer.location !== GOAL_LOCATION) {
        throw new RuleError(`${SHARDBEARER_NAME} must stand at the Cindermaw.`);
      }
      if (s.heroes[action.hero].location !== GOAL_LOCATION) {
        throw new RuleError('Your hero must stand at the Cindermaw to see it done.');
      }
      if (s.wraiths.some((w) => w.location === GOAL_LOCATION)) {
        throw new RuleError('Wraiths bar the way — the Cindermaw must be clear of them.');
      }
      const complete = s.objectives.filter((o) => o.complete).length;
      if (complete < OBJECTIVES_REQUIRED) {
        throw new RuleError(
          `The realm is not ready: complete ${OBJECTIVES_REQUIRED} objectives first (${complete} done).`,
        );
      }
      spendAction(action.hero);
      s.phase = 'won';
      events.push({
        kind: 'win',
        text: `${SHARDBEARER_NAME} casts the Ember into the Cindermaw. The shadow breaks — the realm is saved!`,
      });
      break;
    }

    case 'playCard':
      playCard(s, rng, action, events); // free action
      checkObjectives(s, events);
      break;

    case 'endTurn':
      endTurn(s, rng, events);
      break;

    default: {
      const never: never = action;
      throw new RuleError(`Unknown action: ${JSON.stringify(never)}`);
    }
  }

  checkObjectives(s, events);
  s.rngState = rng.state;
  return { state: s, events };
}
