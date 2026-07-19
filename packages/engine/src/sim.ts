/**
 * Headless simulation harness for the faithful ruleset. Bots play full games
 * while conservation/bounds invariants are checked after every action.
 * This is a CORRECTNESS tool, not a balance dial — the rules are the spec.
 */
import {
  buildDarkenCards,
  buildEventCards,
  buildRegionCards,
  DIFFICULTY_TABLE,
  FACTION_TOTALS,
  HOPE_MAX,
  NAZGUL_TOTAL,
  SETUP_BY_PLAYERS,
  SHADOW_TROOPS_TOTAL,
  TOKENS_PER_SYMBOL,
} from './data/cards.js';
import { CONNECTIONS, MAP, MOUNT_DOOM, REGION_MAP } from './data/board.js';
import { BEARER } from './data/characters.js';
import { legalActions } from './legal.js';
import { makeRng, nextInt, type Rng } from './rng.js';
import { applyAction } from './rules.js';
import { createGame } from './setup.js';
import type { Action, Difficulty, Faction, GameState, SymbolKind } from './types.js';

export function checkInvariants(s: GameState): void {
  const fail = (msg: string) => {
    throw new Error(`INVARIANT VIOLATED: ${msg}`);
  };

  // Shadow troop conservation (some may sit on objective cards)
  const shadowOnBoard = Object.values(s.shadow).reduce((a, b) => a + b, 0);
  const shadowOnCards = (s.objProgress['that_makes_six'] ?? 0) + (s.objProgress['ride_eored'] ?? 0);
  if (shadowOnBoard + shadowOnCards + s.supply.shadow !== SHADOW_TROOPS_TOTAL) {
    fail(`shadow troops: ${shadowOnBoard} on board + ${shadowOnCards} on cards + ${s.supply.shadow} supply != ${SHADOW_TROOPS_TOTAL}`);
  }
  for (const [loc, n] of Object.entries(s.shadow)) {
    if (!MAP[loc]) fail(`shadow at unknown location ${loc}`);
    if (n < 0) fail(`negative shadow at ${loc}`);
  }

  // Friendly troop conservation per faction
  const totals: Record<Faction, number> = { vale: 0, riders: 0, sylvan: 0, deepholm: 0 };
  for (const [loc, byFaction] of Object.entries(s.friendly)) {
    if (!MAP[loc]) fail(`friendly troops at unknown location ${loc}`);
    for (const [f, n] of Object.entries(byFaction)) {
      if ((n ?? 0) < 0) fail(`negative ${f} at ${loc}`);
      totals[f as Faction] += n ?? 0;
    }
  }
  for (const r of Object.values(s.objReserves)) {
    totals[r.faction] += r.count; // troops waiting on objective cards
  }
  for (const f of Object.keys(totals) as Faction[]) {
    if (totals[f] + s.supply.factions[f] !== FACTION_TOTALS[f]) {
      fail(`${f}: ${totals[f]} + ${s.supply.factions[f]} != ${FACTION_TOTALS[f]}`);
    }
  }

  // Nazgûl conservation
  const nazgul = Object.entries(s.wraiths).reduce((a, [r, n]) => {
    if (!REGION_MAP[r]) fail(`Nazgûl in unknown region ${r}`);
    if (n < 0) fail(`negative Nazgûl in ${r}`);
    return a + n;
  }, 0);
  if (nazgul !== NAZGUL_TOTAL) fail(`Nazgûl count ${nazgul} != ${NAZGUL_TOTAL}`);

  // Symbol token conservation (friendship pledges sit on the Hobbits'
  // objective card until it completes)
  const hobbitsOpen = s.objectives.some((o) => o.id === 'hobbits_loyalty' && !o.complete);
  const pledged = hobbitsOpen
    ? ['vale', 'riders', 'sylvan', 'deepholm'].filter((g) => s.objProgress[`hobbits_${g}`]).length
    : 0;
  for (const sym of ['friendship', 'valor', 'stealth', 'resistance'] as SymbolKind[]) {
    const held = s.players.reduce((a, p) => a + p.tokens[sym], 0);
    const onCards = sym === 'friendship' ? pledged : 0;
    if (held + onCards + s.supply.tokens[sym] !== TOKENS_PER_SYMBOL) {
      fail(`${sym} tokens: ${held} held + ${onCards} on cards + ${s.supply.tokens[sym]} supply != ${TOKENS_PER_SYMBOL}`);
    }
    if (s.supply.tokens[sym] < 0) fail(`negative ${sym} token supply`);
  }

  // Player card conservation (48 region + all 14 events incl. the unused
  // pool Galadriel can summon from + this difficulty's darken cards)
  const darken = DIFFICULTY_TABLE[s.difficulty].darken;
  const total =
    s.playerDeck.length +
    s.playerDiscard.length +
    s.removedCards.length +
    s.unusedEvents.length +
    s.players.reduce((a, p) => a + p.hand.length, 0);
  if (total !== 48 + 14 + darken) {
    fail(`player cards: ${total} != ${48 + 14 + darken}`);
  }

  // Shadow card conservation (48 + 2 specials)
  const shadowCards = s.shadowDeck.length + s.shadowDiscard.length;
  if (shadowCards !== 50) fail(`shadow cards: ${shadowCards} != 50`);

  // Bounds
  if (s.hope < 0 || s.hope > HOPE_MAX) fail(`hope out of range: ${s.hope}`);
  for (const c of Object.keys(s.characters)) {
    if (!MAP[s.characters[c].location]) fail(`character ${c} at unknown location`);
  }
  if (!REGION_MAP[s.eye]) fail(`Eye in unknown region ${s.eye}`);
}

export type BotKind = 'random' | 'greedy';

/**
 * A crude but rule-exercising bot: escorts Frodo toward Mount Doom, prepares
 * tokens, musters, attacks, captures, and confirms rolls. Its purpose is
 * coverage, not skill.
 */
function scoreAction(s: GameState, a: Action): number {
  const frodoLoc = s.characters[BEARER]?.location;
  const frodoRegion = frodoLoc ? MAP[frodoLoc].region : null;
  switch (a.type) {
    case 'destroyEmber':
      return 10000;
    case 'confirm':
      return 40;
    case 'reroll': {
      // Reroll harmful dice when we can afford it.
      const pend = s.pending;
      if (!pend || pend.type !== 'search' && pend.type !== 'battle') return 0;
      const face = pend.dice[a.die];
      const harmful =
        pend.type === 'search' ? face === 'weary' || face === 'exposed' : face === 'wraith' || face === 'overrun';
      return harmful ? 55 : 1;
    }
    case 'showValor':
      return 45;
    case 'discard':
      return 100;
    case 'travel': {
      const bearerMove = a.character === BEARER || (a.companions ?? []).includes(BEARER);
      if (bearerMove) {
        // Two-phase play: while objectives remain, Frodo shelters in a safe
        // haven; once the road is the only task left, he runs for Mordor.
        const questReady = s.objectives.filter((o) => !o.complete && o.id !== 'destroy_ring').length === 0;
        const progressBase = questReady ? 60 : 12;
        const progress =
          distanceToDoom(a.to) < distanceToDoom(s.characters[a.character].location) ? progressBase : 2;
        const shelter =
          !questReady && s.siteStatus[a.to] === 'haven' && (s.wraiths[MAP[a.to].region] ?? 0) === 0
            ? 34
            : 0;
        // Danger at the destination: Nazgûl in its region + shadow troops there.
        const danger = (s.wraiths[MAP[a.to].region] ?? 0) + Math.min(3, s.shadow[a.to] ?? 0);
        const desperate = s.hope <= 2 ? 25 : 0;
        if (a.cover === 'stealth') return Math.max(progress, shelter) + 15;
        if (a.cover === 'ring') return Math.max(progress, shelter) - danger * 25 - 20 - desperate;
        return Math.max(progress, shelter) - danger * 40 - desperate;
      }
      const towardFrodo =
        frodoLoc &&
        distTo(a.to, frodoLoc) < distTo(s.characters[a.character].location, frodoLoc)
          ? 18
          : 4;
      return towardFrodo + (a.troops ? 3 : 0);
    }
    case 'prepare': {
      const card = s.players.flatMap((p) => p.hand).find((c) => c.id === a.card);
      const sym = card && card.kind === 'region' ? card.symbol : undefined;
      return sym === 'stealth' || sym === 'resistance' ? 38 : sym === 'valor' ? 34 : 26;
    }
    case 'muster': {
      const loc = s.characters[a.character]?.location;
      if (!loc) return 24;
      // Garrisoning a haven is the core defensive play: garrisons fight the
      // battles that recycle shadow troops and keep the haven standing.
      const isHavenHere = s.siteStatus[loc] === 'haven' ? 12 : 0;
      const own = Object.values(s.friendly[loc] ?? {}).reduce((x, y) => x + (y ?? 0), 0);
      return 24 + isHavenHere + (own < 3 ? 6 : 0);
    }
    case 'attack': {
      const loc = s.characters[a.character]?.location;
      const region = loc ? MAP[loc].region : null;
      // Never drag the Eye onto Frodo; prize dragging it away from him.
      if (region && region === frodoRegion) return -50;
      const eyeOnFrodo = frodoRegion && s.eye === frodoRegion ? 18 : 0;
      const clearingStronghold = loc && s.siteStatus[loc] === 'stronghold' ? 16 : 0;
      return 32 + eyeOnFrodo + clearingStronghold;
    }
    case 'capture':
      return 90;
    case 'fellowship':
      return 8;
    case 'ability':
      return s.hope <= 5 ? 45 : 20;
    case 'playEvent':
      return 15;
    case 'endTurn':
      return 1;
    default:
      return 0;
  }
}

const doomCache = new Map<string, number>();
function distTo(a: string, b: string): number {
  const key = `${a}|${b}`;
  if (doomCache.has(key)) return doomCache.get(key)!;
  // BFS over CONNECTIONS ignoring costs.
  const dist: Record<string, number> = { [a]: 0 };
  const q = [a];
  while (q.length) {
    const cur = q.shift()!;
    for (const c of CONNECTIONS[cur]) {
      if (!(c.to in dist)) {
        dist[c.to] = dist[cur] + 1;
        q.push(c.to);
      }
    }
  }
  for (const [loc, d] of Object.entries(dist)) doomCache.set(`${a}|${loc}`, d);
  return dist[b] ?? 99;
}
function distanceToDoom(loc: string): number {
  return distTo(loc, MOUNT_DOOM);
}

export interface SimResult {
  seed: number;
  phase: 'won' | 'lost';
  lossReason?: string;
  turns: number;
  actionsTaken: number;
  finalHope: number;
  objectivesComplete: number;
  havensLost: number;
}

export function simulateGame(
  seed: number,
  opts: { players?: number; bot?: BotKind; difficulty?: Difficulty; maxActions?: number; trace?: boolean } = {},
): SimResult {
  const nPlayers = opts.players ?? 3;
  const bot = opts.bot ?? 'greedy';
  const maxActions = opts.maxActions ?? 20000;
  const difficulty = opts.difficulty ?? 'introductory';

  const setup = Array.from({ length: nPlayers }, (_, i) => ({
    id: `bot${i}`,
    name: `Bot ${i + 1}`,
  }));
  let state = createGame(setup, seed, difficulty);
  checkInvariants(state);

  const rng = makeRng(seed ^ 0x51ed270b);
  let actionsTaken = 0;

  while (state.phase === 'playing' && actionsTaken < maxActions) {
    // Whose decision is it? Discards and Doubt payments belong to their
    // target player; everything else is driven by the active player.
    const decider =
      state.pending?.type === 'discard' || state.pending?.type === 'ordeal' || state.pending?.type === 'mirror'
        ? state.pending.player
        : state.pending?.type === 'wheels' && state.pending.mode === 'doubt'
          ? state.pending.player!
          : state.players[state.turn.playerIdx].id;
    const actions = legalActions(state, decider);
    if (actions.length === 0) {
      throw new Error(`No legal actions for ${decider} (pending=${JSON.stringify(state.pending)})`);
    }
    let choice: Action;
    if (bot === 'random') {
      choice = actions[nextInt(rng, actions.length)];
    } else {
      let best = actions[0];
      let bestScore = -Infinity;
      for (const a of actions) {
        const sc = scoreAction(state, a) + nextInt(rng, 4);
        if (sc > bestScore) {
          bestScore = sc;
          best = a;
        }
      }
      choice = best;
    }
    const result = applyAction(state, decider, choice);
    state = result.state;
    if (opts.trace) for (const e of result.events) console.log(`  ${e.text}`);
    actionsTaken++;
    checkInvariants(state);
  }

  if (state.phase === 'playing') {
    throw new Error(`Game did not terminate in ${maxActions} actions (seed ${seed}).`);
  }

  const havensLost = Object.entries(state.siteStatus).filter(
    ([loc, st]) => st === 'stronghold' && MAP[loc].haven,
  ).length;

  return {
    seed,
    phase: state.phase,
    lossReason: state.lossReason,
    turns: state.turnNumber,
    actionsTaken,
    finalHope: state.hope,
    objectivesComplete: state.objectives.filter((o) => o.complete).length,
    havensLost,
  };
}
