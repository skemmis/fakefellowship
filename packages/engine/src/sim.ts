/**
 * Headless simulation harness. Plays full games with a simple heuristic bot
 * (or pure random), validating state invariants after every action. Use it to
 * shake out rules bugs and to eyeball balance:
 *
 *   npm run build -w @emberfall/engine && node packages/engine/dist/cli.js 500
 */
import { FACTION_SUPPLY, playerDeckSize, SHADOW_SUPPLY } from './data/constants.js';
import { GOAL_LOCATION, LOCATIONS, MAP, distance } from './data/map.js';
import { HEROES } from './data/heroes.js';
import { legalActions } from './legal.js';
import { makeRng, nextInt, type Rng } from './rng.js';
import { applyAction } from './rules.js';
import { createGame, type SetupPlayer } from './setup.js';
import type { Action, Faction, GameState } from './types.js';

/** Throws if the state violates a conservation or bounds invariant. */
export function checkInvariants(s: GameState): void {
  const fail = (msg: string) => {
    throw new Error(`INVARIANT VIOLATED: ${msg}\n${JSON.stringify(s, null, 1).slice(0, 2000)}`);
  };

  // Shadow troop conservation
  const onBoard = Object.values(s.shadow).reduce((a, b) => a + b, 0);
  if (onBoard + s.supply.shadow !== SHADOW_SUPPLY) {
    fail(`shadow conservation: board ${onBoard} + supply ${s.supply.shadow} != ${SHADOW_SUPPLY}`);
  }
  for (const [loc, n] of Object.entries(s.shadow)) {
    if (!MAP[loc]) fail(`shadow at unknown location ${loc}`);
    if (n < 0) fail(`negative shadow at ${loc}`);
  }

  // Allied troop conservation per faction
  const totals: Record<Faction, number> = { vale: 0, riders: 0, sylvan: 0, deepholm: 0 };
  for (const [loc, byFaction] of Object.entries(s.allied)) {
    if (!MAP[loc]) fail(`allied troops at unknown location ${loc}`);
    for (const [f, n] of Object.entries(byFaction)) {
      if ((n ?? 0) < 0) fail(`negative allied ${f} at ${loc}`);
      totals[f as Faction] += n ?? 0;
    }
  }
  for (const f of Object.keys(totals) as Faction[]) {
    if (totals[f] + s.supply.factions[f] !== FACTION_SUPPLY[f]) {
      fail(`${f} conservation: board ${totals[f]} + supply ${s.supply.factions[f]} != ${FACTION_SUPPLY[f]}`);
    }
  }

  // Bounds
  if (s.hope < 0 || s.hope > 8) fail(`hope out of range: ${s.hope}`);
  if (s.shardbearer.corruption < 0 || s.shardbearer.corruption > 8) {
    fail(`corruption out of range: ${s.shardbearer.corruption}`);
  }
  if (!MAP[s.shardbearer.location]) fail(`shardbearer at unknown location`);
  for (const w of s.wraiths) {
    if (!MAP[w.location]) fail(`wraith at unknown location ${w.location}`);
  }
  for (const h of Object.values(s.heroes)) {
    if (!MAP[h.location]) fail(`hero ${h.id} at unknown location`);
  }

  // Card conservation (expected totals derived from the same data as setup)
  const expectedPlayerCards = playerDeckSize(s.players.length);
  const cardCount =
    s.playerDeck.length +
    s.playerDiscard.length +
    s.players.reduce((a, p) => a + p.hand.length, 0);
  if (cardCount !== expectedPlayerCards) {
    fail(`player card conservation: ${cardCount} != ${expectedPlayerCards}`);
  }
  const expectedShadowCards =
    LOCATIONS.filter((l) => l.id !== GOAL_LOCATION).length +
    LOCATIONS.filter((l) => l.stronghold).length +
    4; // hunt cards
  const shadowCards = s.shadowDeck.length + s.shadowDiscard.length + s.foreseen.length;
  if (shadowCards !== expectedShadowCards) {
    fail(`shadow card conservation: ${shadowCards} != ${expectedShadowCards}`);
  }

  // Turn accounting
  const p = s.players[s.turn.playerIdx];
  const used = p.heroes.map((h) => s.turn.actionsUsed[h] ?? 0);
  if (Math.max(...used) > 4 || Math.min(...used) > 1) {
    fail(`action budget exceeded: ${JSON.stringify(s.turn.actionsUsed)}`);
  }
}

export type BotKind = 'random' | 'greedy';

/**
 * Greedy bot: pushes the shardbearer toward the Cindermaw, keeps him hidden
 * when wraiths close in, battles nearby shadow, musters at sanctuaries,
 * plays hope/utility cards. Not smart — just smart enough to finish games
 * and exercise most of the rules.
 */
function pickGreedy(s: GameState, actions: Action[], rng: Rng): Action {
  const score = (a: Action): number => {
    switch (a.type) {
      case 'destroyEmber':
        return 1000;
      case 'guide': {
        const to = a.path[a.path.length - 1];
        const closer =
          distance(to, GOAL_LOCATION) < distance(s.shardbearer.location, GOAL_LOCATION);
        return closer ? 90 : 5;
      }
      case 'hide': {
        const danger = s.wraiths.some(
          (w) =>
            w.location === s.shardbearer.location ||
            MAP[w.location].adjacent.includes(s.shardbearer.location),
        );
        return danger ? 95 : 2;
      }
      case 'battle': {
        const n = s.shadow[a.location] ?? 0;
        const sanctuaryBonus = s.sanctuaries[a.location] ? 30 : 0;
        return 40 + n * 5 + sanctuaryBonus;
      }
      case 'muster':
        return 45;
      case 'kindle':
        return 60;
      case 'move': {
        const to = a.path[a.path.length - 1];
        // Head toward the shardbearer or toward shadow concentrations.
        const towardBearer =
          distance(to, s.shardbearer.location) <
          distance(s.heroes[a.hero].location, s.shardbearer.location);
        const towardShadow = (s.shadow[to] ?? 0) > 0;
        return 20 + (towardBearer ? 15 : 0) + (towardShadow ? 10 : 0);
      }
      case 'playCard': {
        const card = s.players[s.turn.playerIdx].hand.find((c) => c.id === a.card)!;
        switch (card.kind) {
          case 'hearthsong':
            return s.hope <= 5 ? 70 : 10;
          case 'lantern_oil':
            if (a.cleanse) return s.shardbearer.corruption >= 4 ? 80 : 20;
            return s.hope <= 5 ? 65 : 8;
          case 'ambush':
            return 55;
          case 'rally_banner':
            return 35;
          case 'fernpath': {
            if (a.hide) return 30;
            const to = a.path![0];
            return distance(to, GOAL_LOCATION) <
              distance(s.shardbearer.location, GOAL_LOCATION)
              ? 50
              : 3;
          }
          case 'swift_march':
            return 12;
          case 'farsight':
            return 15;
          default:
            return 0;
        }
      }
      case 'endTurn':
        return 1;
      default:
        return 0;
    }
  };
  let best: Action[] = [];
  let bestScore = -Infinity;
  for (const a of actions) {
    const sc = score(a) + nextInt(rng, 5); // jitter breaks ties & adds variety
    if (sc > bestScore) {
      bestScore = sc;
      best = [a];
    } else if (sc === bestScore) {
      best.push(a);
    }
  }
  return best[nextInt(rng, best.length)];
}

export interface SimResult {
  seed: number;
  phase: 'won' | 'lost';
  lossReason?: string;
  turns: number;
  actionsTaken: number;
  finalHope: number;
  finalCorruption: number;
  objectivesComplete: number;
}

export function simulateGame(
  seed: number,
  opts: { players?: number; bot?: BotKind; maxActions?: number; trace?: boolean } = {},
): SimResult {
  const nPlayers = opts.players ?? 2;
  const bot = opts.bot ?? 'greedy';
  const maxActions = opts.maxActions ?? 5000;

  const setup: SetupPlayer[] = [];
  for (let i = 0; i < nPlayers; i++) {
    setup.push({
      id: `bot${i}`,
      name: `Bot ${i + 1}`,
      heroes: [HEROES[i * 2].id, HEROES[i * 2 + 1].id],
    });
  }
  let state = createGame(setup, seed);
  checkInvariants(state);

  const rng = makeRng(seed ^ 0x9e3779b9);
  let actionsTaken = 0;

  while (state.phase === 'playing' && actionsTaken < maxActions) {
    const actions = legalActions(state);
    if (actions.length === 0) throw new Error('No legal actions — engine bug.');
    const choice =
      bot === 'random'
        ? actions[nextInt(rng, actions.length)]
        : pickGreedy(state, actions, rng);
    const result = applyAction(state, state.players[state.turn.playerIdx].id, choice);
    state = result.state;
    actionsTaken++;
    if (opts.trace) {
      for (const e of result.events) console.log(`  ${e.text}`);
    }
    checkInvariants(state);
  }

  if (state.phase === 'playing') {
    throw new Error(`Game did not terminate in ${maxActions} actions (seed ${seed}).`);
  }

  return {
    seed,
    phase: state.phase,
    lossReason: state.lossReason,
    turns: state.turnNumber,
    actionsTaken,
    finalHope: state.hope,
    finalCorruption: state.shardbearer.corruption,
    objectivesComplete: state.objectives.filter((o) => o.complete).length,
  };
}
