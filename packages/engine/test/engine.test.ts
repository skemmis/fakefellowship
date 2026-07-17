import { describe, expect, it } from 'vitest';
import {
  applyAction,
  canAct,
  checkInvariants,
  createGame,
  GOAL_LOCATION,
  legalActions,
  LOCATIONS,
  MAP,
  RuleError,
  simulateGame,
  START_LOCATION,
  type GameState,
} from '../src/index.js';

function newGame(seed = 7): GameState {
  return createGame(
    [
      { id: 'p1', name: 'Alice', heroes: ['alric', 'sylra'] },
      { id: 'p2', name: 'Bob', heroes: ['tansy', 'maelis'] },
    ],
    seed,
  );
}

describe('map', () => {
  it('is symmetric and connected', () => {
    for (const loc of LOCATIONS) {
      for (const n of loc.adjacent) {
        expect(MAP[n].adjacent).toContain(loc.id);
      }
    }
    // BFS from start reaches everywhere, including the goal.
    const seen = new Set([START_LOCATION]);
    const queue = [START_LOCATION];
    while (queue.length) {
      for (const n of MAP[queue.shift()!].adjacent) {
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    expect(seen.size).toBe(LOCATIONS.length);
    expect(seen.has(GOAL_LOCATION)).toBe(true);
  });
});

describe('setup', () => {
  it('creates a valid initial state', () => {
    const s = newGame();
    checkInvariants(s);
    expect(s.players[0].hand).toHaveLength(2);
    expect(s.players[0].hand.every((c) => c.kind !== 'ashen_surge')).toBe(true);
    expect(s.shardbearer.location).toBe(START_LOCATION);
    expect(s.hope).toBe(6);
  });

  it('rejects duplicate heroes', () => {
    expect(() =>
      createGame(
        [
          { id: 'p1', name: 'A', heroes: ['alric', 'alric'] },
        ],
        1,
      ),
    ).toThrow();
  });
});

describe('turn action budget', () => {
  it('allows 4 actions with one hero and 1 with the other', () => {
    let s = newGame();
    // Alric moves 4 times.
    for (let i = 0; i < 4; i++) {
      const to = MAP[s.heroes['alric'].location].adjacent[0];
      s = applyAction(s, 'p1', { type: 'move', hero: 'alric', path: [to] }).state;
    }
    expect(canAct(s, 'alric')).toBe(false);
    // Sylra may still take exactly 1.
    const to = MAP[s.heroes['sylra'].location].adjacent[0];
    s = applyAction(s, 'p1', { type: 'move', hero: 'sylra', path: [to] }).state;
    expect(canAct(s, 'sylra')).toBe(false);
  });

  it('caps the second hero at 4 once the first has used 2', () => {
    let s = newGame();
    const step = () => MAP[s.heroes['alric'].location].adjacent[0];
    s = applyAction(s, 'p1', { type: 'move', hero: 'alric', path: [step()] }).state;
    s = applyAction(s, 'p1', { type: 'move', hero: 'alric', path: [step()] }).state;
    // Alric has 2: Sylra can now use at most 1.
    const sylraStep = MAP[s.heroes['sylra'].location].adjacent[0];
    s = applyAction(s, 'p1', { type: 'move', hero: 'sylra', path: [sylraStep] }).state;
    expect(canAct(s, 'sylra')).toBe(false);
    expect(canAct(s, 'alric')).toBe(true);
  });

  it('rejects acting out of turn', () => {
    const s = newGame();
    expect(() =>
      applyAction(s, 'p2', { type: 'move', hero: 'tansy', path: ['greenhollow'] }),
    ).toThrow(RuleError);
  });
});

describe('movement', () => {
  it('rejects non-adjacent moves', () => {
    const s = newGame();
    expect(() =>
      applyAction(s, 'p1', { type: 'move', hero: 'alric', path: ['cindermaw'] }),
    ).toThrow(RuleError);
  });

  it('lets Sylra (swift) move 2 but not others', () => {
    const s = newGame();
    const r = applyAction(s, 'p1', {
      type: 'move',
      hero: 'sylra',
      path: ['greenhollow', 'lanternhold'],
    });
    expect(r.state.heroes['sylra'].location).toBe('lanternhold');
    expect(() =>
      applyAction(s, 'p1', { type: 'move', hero: 'alric', path: ['greenhollow', 'lanternhold'] }),
    ).toThrow(RuleError);
  });
});

describe('muster and battle', () => {
  it('musters faction troops at a sanctuary', () => {
    let s = newGame();
    s.heroes['alric'].location = 'lanternhold';
    const r = applyAction(s, 'p1', { type: 'muster', hero: 'alric' });
    expect(r.state.allied['lanternhold']?.vale).toBe(2);
    expect(r.state.supply.factions.vale).toBe(8);
    checkInvariants(r.state);
  });

  it('rejects muster outside sanctuaries', () => {
    const s = newGame();
    expect(() => applyAction(s, 'p1', { type: 'muster', hero: 'alric' })).toThrow(RuleError);
  });

  it('battle removes shadow troops and conserves supply', () => {
    let s = newGame();
    s.heroes['alric'].location = 'redgrass'; // has 1 initial shadow troop
    // Try several RNG states until dice actually kill something.
    let killed = false;
    for (let seed = 0; seed < 30 && !killed; seed++) {
      const trial = { ...s, rngState: seed >>> 0 };
      const r = applyAction(trial, 'p1', { type: 'battle', hero: 'alric', location: 'redgrass' });
      checkInvariants(r.state);
      if ((r.state.shadow['redgrass'] ?? 0) === 0) killed = true;
    }
    expect(killed).toBe(true);
  });
});

describe('guide and hide', () => {
  it('guides the shardbearer along the road', () => {
    let s = newGame();
    const r = applyAction(s, 'p1', { type: 'guide', hero: 'alric', path: ['greenhollow'] });
    expect(r.state.shardbearer.location).toBe('greenhollow');
  });

  it('requires standing with the shardbearer', () => {
    let s = newGame();
    s.heroes['alric'].location = 'candlecross';
    expect(() =>
      applyAction(s, 'p1', { type: 'guide', hero: 'alric', path: ['ferryford'] }),
    ).toThrow(RuleError);
  });

  it('hide sets hidden and guide clears it', () => {
    let s = newGame();
    s = applyAction(s, 'p1', { type: 'hide', hero: 'alric' }).state;
    expect(s.shardbearer.hidden).toBe(true);
    s = applyAction(s, 'p1', { type: 'guide', hero: 'alric', path: ['greenhollow'] }).state;
    expect(s.shardbearer.hidden).toBe(false);
  });
});

describe('win and loss', () => {
  it('destroying the Ember requires objectives, position, and no wraiths', () => {
    let s = newGame();
    s.shardbearer.location = GOAL_LOCATION;
    s.heroes['alric'].location = GOAL_LOCATION;
    s.wraiths = [];
    expect(() => applyAction(s, 'p1', { type: 'destroyEmber', hero: 'alric' })).toThrow(
      /objectives/,
    );
    s.objectives[0].complete = true;
    s.objectives[1].complete = true;
    const r = applyAction(s, 'p1', { type: 'destroyEmber', hero: 'alric' });
    expect(r.state.phase).toBe('won');
  });

  it('wraiths at the Cindermaw bar the way', () => {
    let s = newGame();
    s.shardbearer.location = GOAL_LOCATION;
    s.heroes['alric'].location = GOAL_LOCATION;
    s.objectives[0].complete = true;
    s.objectives[1].complete = true;
    s.wraiths = [{ id: 0, location: GOAL_LOCATION }];
    expect(() => applyAction(s, 'p1', { type: 'destroyEmber', hero: 'alric' })).toThrow(
      /wraith/i,
    );
  });

  it('hope reaching 0 loses the game', () => {
    let s = newGame();
    s.hope = 1;
    // Stack shadow at Lanternhold so the next spawn besieges it (-1 hope).
    s.shadow['lanternhold'] = 2;
    s.supply.shadow -= 2;
    s.foreseen = [{ id: 'x1', kind: 'spawn', location: 'lanternhold' }];
    const r = applyAction(s, 'p1', { type: 'endTurn' });
    expect(r.state.phase).toBe('lost');
    expect(r.state.lossReason).toMatch(/hope/);
  });
});

describe('legalActions', () => {
  it('every enumerated action is accepted by the reducer', () => {
    let s = newGame(11);
    for (let i = 0; i < 200 && s.phase === 'playing'; i++) {
      const actions = legalActions(s);
      expect(actions.length).toBeGreaterThan(0);
      for (const a of actions) {
        // Applying any legal action must not throw.
        const r = applyAction(s, s.players[s.turn.playerIdx].id, a);
        checkInvariants(r.state);
      }
      // Advance with the first non-endTurn action when possible.
      const pick = actions.find((a) => a.type !== 'endTurn') ?? actions[0];
      s = applyAction(s, s.players[s.turn.playerIdx].id, pick).state;
    }
  });
});

describe('determinism', () => {
  it('same seed + same actions = identical states', () => {
    const play = () => {
      let s = newGame(99);
      s = applyAction(s, 'p1', { type: 'move', hero: 'alric', path: ['greenhollow'] }).state;
      s = applyAction(s, 'p1', { type: 'endTurn' }).state;
      s = applyAction(s, 'p2', { type: 'endTurn' }).state;
      return s;
    };
    expect(JSON.stringify(play())).toBe(JSON.stringify(play()));
  });
});

describe('full-game simulation', () => {
  it('greedy bots finish 25 games without invariant violations', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const r = simulateGame(seed, { players: 2, bot: 'greedy' });
      expect(['won', 'lost']).toContain(r.phase);
    }
  });

  it('random bots finish 10 games without invariant violations', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const r = simulateGame(seed, { players: 3, bot: 'random' });
      expect(['won', 'lost']).toContain(r.phase);
    }
  });
});
