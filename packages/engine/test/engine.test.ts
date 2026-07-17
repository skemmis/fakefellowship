import { describe, expect, it } from 'vitest';
import {
  applyAction,
  BATTLE_LINES,
  BEARER,
  canAct,
  checkInvariants,
  CONNECTIONS,
  createGame,
  legalActions,
  LOCATIONS,
  MAP,
  MORDOR,
  MOUNT_DOOM,
  REGION_MAP,
  REGIONS,
  RuleError,
  simulateGame,
  type GameState,
} from '../src/index.js';

function newGame(seed = 7, players = 2): GameState {
  const setup = Array.from({ length: players }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` }));
  return createGame(setup, seed);
}

/** Force a deterministic 2p game where p1 has Frodo&Sam + Aragorn. */
function riggedGame(seed = 7): GameState {
  const s = newGame(seed, 2);
  // Reassign characters directly for test determinism.
  const all = ['frodo_sam', 'aragorn', 'eowyn', 'gimli'];
  s.players[0].characters = ['frodo_sam', 'aragorn'];
  s.players[1].characters = ['eowyn', 'gimli'];
  s.characters = {
    frodo_sam: { location: 'the_shire' },
    aragorn: { location: 'weather_hills' },
    eowyn: { location: 'edoras' },
    gimli: { location: 'erebor' },
  };
  s.turn.playerIdx = 0;
  s.turn.actionsUsed = {};
  s.turn.actedOrder = [];
  return s;
}

describe('board data', () => {
  it('all locations belong to defined regions and are connected', () => {
    const regionIds = new Set(REGIONS.map((r) => r.id));
    for (const l of LOCATIONS) expect(regionIds.has(l.region)).toBe(true);
    // Connectivity via CONNECTIONS
    const seen = new Set(['the_shire']);
    const q = ['the_shire'];
    while (q.length) {
      for (const c of CONNECTIONS[q.shift()!]) {
        if (!seen.has(c.to)) {
          seen.add(c.to);
          q.push(c.to);
        }
      }
    }
    expect(seen.size).toBe(LOCATIONS.length);
  });

  it('region adjacency is symmetric', () => {
    for (const r of REGIONS) {
      for (const n of r.adjacent) {
        expect(REGION_MAP[n].adjacent).toContain(r.id);
      }
    }
  });

  it('battle lines start at shadow locations and end at printed havens', () => {
    for (const line of BATTLE_LINES) {
      expect(MAP[line.path[0]].shadowLoc).toBe(true);
      expect(MAP[line.path[line.path.length - 1]].haven).toBe(true);
    }
  });

  it('Mount Doom is in Mordor', () => {
    expect(MAP[MOUNT_DOOM].region).toBe(MORDOR);
  });
});

describe('setup', () => {
  it('creates a valid initial state at every player count and difficulty', () => {
    for (const players of [2, 3, 4, 5]) {
      for (const diff of ['introductory', 'standard', 'heroic', 'epic', 'legendary'] as const) {
        const s = createGame(
          Array.from({ length: players }, (_, i) => ({ id: `p${i}`, name: `P${i}` })),
          42,
          diff,
        );
        checkInvariants(s);
        expect(s.hope).toBe(6);
        expect(Object.keys(s.characters).length).toBe(players * 2);
        expect(BEARER in s.characters).toBe(true); // Frodo always dealt
        expect(s.objectives.some((o) => o.id === 'destroy_ring')).toBe(true);
      }
    }
  });

  it('seeds 18 + 9 shadow troops and leaves 21 in the supply', () => {
    const s = newGame(1);
    expect(s.supply.shadow).toBe(21);
  });
});

describe('turn structure (4 + 1, no interleaving)', () => {
  it('allows 4 actions with one character then 1 with the other', () => {
    let s = riggedGame();
    for (let i = 0; i < 4; i++) {
      const to = CONNECTIONS[s.characters['aragorn'].location].find((c) => !c.cost)!.to;
      s = applyAction(s, 'p1', { type: 'travel', character: 'aragorn', to }).state;
    }
    expect(canAct(s, 'aragorn')).toBe(false);
    const to = CONNECTIONS[s.characters[BEARER].location].find((c) => !c.cost)!.to;
    s = applyAction(s, 'p1', { type: 'travel', character: BEARER, to, cover: 'search' }).state;
    while (s.pending) s = applyAction(s, 'p1', { type: 'confirm' }).state;
    expect(canAct(s, BEARER)).toBe(false);
  });

  it('forbids returning to the first character after switching', () => {
    let s = riggedGame();
    let to = CONNECTIONS[s.characters['aragorn'].location].find((c) => !c.cost)!.to;
    s = applyAction(s, 'p1', { type: 'travel', character: 'aragorn', to }).state;
    // Switch to Frodo (1 action so far on Aragorn -> Frodo gets the 4-slot).
    to = CONNECTIONS[s.characters[BEARER].location].find((c) => !c.cost)!.to;
    s = applyAction(s, 'p1', { type: 'travel', character: BEARER, to, cover: 'search' }).state;
    while (s.pending) s = applyAction(s, 'p1', { type: 'confirm' }).state;
    expect(canAct(s, 'aragorn')).toBe(false); // may not go back
    expect(canAct(s, BEARER)).toBe(true); // up to 4
  });

  it('rejects out-of-turn actions', () => {
    const s = riggedGame();
    expect(() =>
      applyAction(s, 'p2', { type: 'muster', character: 'eowyn' }),
    ).toThrow(RuleError);
  });
});

describe('travel and searches', () => {
  it('moving Frodo without stealth rolls a search when enemies are near', () => {
    let s = riggedGame();
    // Stack Nazgûl into Eriador so a search must roll dice.
    s.wraiths = { eriador: 3, mordor: 6 };
    const r = applyAction(s, 'p1', { type: 'travel', character: BEARER, to: 'bree', cover: 'search' });
    expect(r.state.pending?.type).toBe('search');
    const done = applyAction(r.state, 'p1', { type: 'confirm' });
    expect(done.state.pending).toBeNull();
    checkInvariants(done.state);
  });

  it('stealth cover skips the search', () => {
    let s = riggedGame();
    s.wraiths = { eriador: 3, mordor: 6 };
    s.players[0].tokens.stealth = 1;
    s.supply.tokens.stealth -= 1;
    const r = applyAction(s, 'p1', { type: 'travel', character: BEARER, to: 'bree', cover: 'stealth' });
    expect(r.state.pending).toBeNull();
    expect(r.state.players[0].tokens.stealth).toBe(0);
  });

  it('putting on the Ring costs hope, moves the Eye, and ignores shadow troops', () => {
    let s = riggedGame();
    s.wraiths = { mordor: 9 }; // no Nazgûl near => ring search rolls 0 dice
    s.shadow['bree'] = 5; // would add dice on a normal search, ignored with the Ring
    s.supply.shadow -= 5;
    const r = applyAction(s, 'p1', { type: 'travel', character: BEARER, to: 'bree', cover: 'ring' });
    expect(r.state.hope).toBe(5);
    expect(r.state.eye).toBe('eriador');
    expect(r.state.pending).toBeNull(); // 0 dice: no roll at all
  });

  it('special paths cost symbols', () => {
    let s = riggedGame();
    s.characters['aragorn'].location = 'rivendell';
    // No stealth available: High Pass is illegal.
    s.players[0].hand = s.players[0].hand.filter((c) => !(c.kind === 'region' && c.symbol === 'stealth'));
    expect(() =>
      applyAction(s, 'p1', { type: 'travel', character: 'aragorn', to: 'carrock' }),
    ).toThrow(RuleError);
  });

  it('companions and troops travel together', () => {
    let s = riggedGame();
    s.characters['aragorn'].location = 'the_shire';
    s.friendly['the_shire'] = { sylvan: 2 };
    s.supply.factions.sylvan -= 2;
    const r = applyAction(s, 'p1', {
      type: 'travel',
      character: 'aragorn',
      to: 'bree',
      companions: [BEARER],
      troops: { sylvan: 2 },
      cover: 'search',
    });
    let st = r.state;
    while (st.pending) st = applyAction(st, 'p1', { type: 'confirm' }).state;
    expect(st.characters[BEARER].location).toBe('bree');
    expect(st.friendly['bree']?.sylvan).toBe(2);
    checkInvariants(st);
  });
});

describe('actions', () => {
  it('muster spends friendship and places a troop', () => {
    let s = riggedGame();
    s.characters['aragorn'].location = 'minas_tirith';
    s.players[0].tokens.friendship = 1;
    s.supply.tokens.friendship -= 1;
    const before = s.friendly['minas_tirith']?.vale ?? 0;
    const r = applyAction(s, 'p1', { type: 'muster', character: 'aragorn' });
    expect(r.state.friendly['minas_tirith']?.vale).toBe(before + 1);
    expect(r.state.players[0].tokens.friendship).toBe(0);
    checkInvariants(r.state);
  });

  it('Éowyn musters at Rohirrim locations for free', () => {
    let s = riggedGame();
    s.turn.playerIdx = 1;
    const r = applyAction(s, 'p2', { type: 'muster', character: 'eowyn' });
    expect((r.state.friendly['edoras']?.riders ?? 0)).toBeGreaterThan(0);
    checkInvariants(r.state);
  });

  it('attack shifts the Eye and opens a battle roll', () => {
    let s = riggedGame();
    s.characters['aragorn'].location = 'minas_tirith';
    s.shadow['minas_tirith'] = 2;
    s.supply.shadow -= 2;
    const r = applyAction(s, 'p1', { type: 'attack', character: 'aragorn', dice: 2 });
    expect(r.state.eye).toBe('gondor');
    expect(r.state.pending?.type).toBe('battle');
    const done = applyAction(r.state, 'p1', { type: 'confirm' });
    checkInvariants(done.state);
  });

  it('prepare banks a token at a haven', () => {
    let s = riggedGame();
    s.characters['aragorn'].location = 'rivendell';
    const regionCard = s.players[0].hand.find((c) => c.kind === 'region');
    if (!regionCard) return; // hand had only events for this seed
    const r = applyAction(s, 'p1', { type: 'prepare', character: 'aragorn', card: regionCard.id });
    const sym = regionCard.kind === 'region' ? regionCard.symbol : 'valor';
    expect(r.state.players[0].tokens[sym]).toBeGreaterThan(0);
    checkInvariants(r.state);
  });

  it('capture flips a stronghold to a haven, moves the Eye, gains 2 hope', () => {
    let s = riggedGame();
    s.characters['aragorn'].location = 'moria';
    s.supply.shadow += s.shadow['moria'] ?? 0; // Moria's garrison back to supply
    delete s.shadow['moria'];
    s.friendly['moria'] = { deepholm: 1 };
    s.supply.factions.deepholm -= 1;
    s.players[0].tokens.valor = 3;
    s.supply.tokens.valor -= 3;
    s.hope = 4;
    const r = applyAction(s, 'p1', { type: 'capture', character: 'aragorn' });
    expect(r.state.siteStatus['moria']).toBe('haven');
    expect(r.state.spawnStopped['moria']).toBe(true);
    expect(r.state.eye).toBe('misty_mountains');
    // +2 from capture, +2 more if the Balrog objective happens to be in play.
    const balrog = r.state.objectives.find((o) => o.id === 'confront_balrog');
    expect(r.state.hope).toBe(balrog ? 8 : 6);
    expect(balrog?.complete ?? true).toBe(true);
    checkInvariants(r.state);
  });

  it('fellowship passes a matching region card between co-located players', () => {
    let s = riggedGame();
    s.characters['eowyn'].location = 'the_shire'; // p2 character joins Frodo
    const eriadorCard = { id: 'rc_test', kind: 'region' as const, region: 'eriador', symbol: 'valor' as const, number: 1 };
    s.players[0].hand.push(eriadorCard);
    // Keep card conservation: drop another card from p1's hand into discard.
    s.playerDiscard.push(s.players[0].hand.shift()!);
    const r = applyAction(s, 'p1', { type: 'fellowship', character: BEARER, give: 'rc_test', takeFrom: 'p2' });
    expect(r.state.players[1].hand.some((c) => c.id === 'rc_test')).toBe(true);
  });
});

describe('winning and losing', () => {
  it('the Ring can only be destroyed after all other objectives', () => {
    let s = riggedGame();
    s.characters[BEARER].location = MOUNT_DOOM;
    s.players[0].tokens.resistance = 5;
    s.supply.tokens.resistance -= 5;
    expect(() => applyAction(s, 'p1', { type: 'destroyEmber' })).toThrow(/objective/i);
    for (const o of s.objectives) if (o.id !== 'destroy_ring') o.complete = true;
    s.wraiths = { eriador: 9 }; // nothing in Mordor
    delete s.shadow[MOUNT_DOOM];
    s.hope = 6; // 2 missing hope => 2 dice
    const r = applyAction(s, 'p1', { type: 'destroyEmber' });
    let st = r.state;
    if (st.pending) st = applyAction(st, 'p1', { type: 'confirm' }).state;
    expect(['won', 'lost']).toContain(st.phase); // won unless dice drained 6 hope (impossible with 2 dice)
    expect(st.phase).toBe('won');
  });

  it('a final search with full hope and no enemies wins outright', () => {
    let s = riggedGame();
    s.characters[BEARER].location = MOUNT_DOOM;
    for (const o of s.objectives) if (o.id !== 'destroy_ring') o.complete = true;
    s.players[0].tokens.resistance = 5;
    s.supply.tokens.resistance -= 5;
    s.wraiths = { eriador: 9 };
    delete s.shadow[MOUNT_DOOM];
    s.hope = 8;
    const r = applyAction(s, 'p1', { type: 'destroyEmber' });
    expect(r.state.phase).toBe('won');
  });

  it('hope reaching 0 loses the game', () => {
    let s = riggedGame();
    s.hope = 1;
    s.wraiths = { eriador: 7, mordor: 2 };
    // Keep confirming searches until one drains hope... force with a rigged travel loop.
    let guard = 0;
    while (s.phase === 'playing' && guard++ < 60) {
      if (s.pending) {
        s = applyAction(s, 'p1', { type: 'confirm' }).state;
        continue;
      }
      if (!canAct(s, BEARER)) {
        s.turn.actionsUsed = {};
        s.turn.actedOrder = [];
      }
      const here = s.characters[BEARER].location;
      const to = CONNECTIONS[here].find((c) => !c.cost)!.to;
      s = applyAction(s, 'p1', { type: 'travel', character: BEARER, to, cover: 'search' }).state;
    }
    expect(s.phase).toBe('lost');
  });

  it('a haven overrun by shadow troops becomes a stronghold and costs 3 hope', () => {
    let s = riggedGame();
    s.hope = 6;
    s.shadow['rivendell'] = 2;
    s.supply.shadow -= 2;
    s.supply.factions.sylvan += s.friendly['rivendell']?.sylvan ?? 0; // garrison returns to supply
    s.friendly['rivendell'] = {};
    // Any action triggers the haven check via checkHavens after battles; force via travel.
    const r = applyAction(s, 'p1', { type: 'travel', character: 'aragorn', to: 'rivendell' });
    expect(r.state.siteStatus['rivendell']).toBe('stronghold');
    expect(r.state.hope).toBe(3);
    checkInvariants(r.state);
  });
});

describe('full-game simulation', () => {
  it('greedy bots complete 15 games without invariant violations', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const r = simulateGame(seed, { players: 3 });
      expect(['won', 'lost']).toContain(r.phase);
    }
  });

  it('random bots complete 8 games without invariant violations', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const r = simulateGame(seed, { players: 2, bot: 'random' });
      expect(['won', 'lost']).toContain(r.phase);
    }
  });

  it('every enumerated legal action is accepted by the reducer', () => {
    let s = newGame(11, 3);
    for (let i = 0; i < 60 && s.phase === 'playing'; i++) {
      const decider = s.pending?.type === 'discard' ? s.pending.player : s.players[s.turn.playerIdx].id;
      const actions = legalActions(s, decider);
      expect(actions.length).toBeGreaterThan(0);
      for (const a of actions.slice(0, 25)) {
        const r = applyAction(s, decider, a);
        checkInvariants(r.state);
      }
      const pick = actions.find((a) => a.type !== 'endTurn') ?? actions[0];
      s = applyAction(s, decider, pick).state;
    }
  });
});

describe('solo variant', () => {
  it('deals Frodo & Sam plus 4 characters to one player with a rotating token', () => {
    const s = createGame([{ id: 'solo', name: 'Solo' }], 5);
    checkInvariants(s);
    expect(s.players[0].characters).toHaveLength(5);
    expect(s.players[0].characters[0]).toBe('frodo_sam');
    expect(s.solo?.order).toHaveLength(4);
    expect(s.solo?.order).not.toContain('frodo_sam');
  });

  it('only the token character (4 actions) and Frodo (1 action) may act; the token rotates', () => {
    let s = createGame([{ id: 'solo', name: 'Solo' }], 5);
    const token = s.solo!.order[0];
    const other = s.solo!.order[1];
    expect(canAct(s, token)).toBe(true);
    expect(canAct(s, BEARER)).toBe(true);
    expect(canAct(s, other)).toBe(false);
    // Frodo takes his single bonus action.
    const to = CONNECTIONS[s.characters[BEARER].location].find((c) => !c.cost)!.to;
    s = applyAction(s, 'solo', { type: 'travel', character: BEARER, to, cover: 'search' }).state;
    while (s.pending) s = applyAction(s, 'solo', { type: 'confirm' }).state;
    if (s.phase !== 'playing') return; // an unlucky search can end a rigged short game
    expect(canAct(s, BEARER)).toBe(false);
    expect(canAct(s, token)).toBe(true);
    // End the turn: the token passes to the next character.
    s = applyAction(s, 'solo', { type: 'endTurn' }).state;
    let guard = 0;
    while (s.pending && guard++ < 30) {
      const acts = legalActions(s, 'solo');
      s = applyAction(s, 'solo', acts[0]).state;
    }
    if (s.phase === 'playing') expect(s.solo!.idx).toBe(1);
  });

  it('solo games skip Fellowship and restrict Prepare to matching regions', () => {
    const s = createGame([{ id: 'solo', name: 'Solo' }], 9);
    const acts = legalActions(s, 'solo');
    expect(acts.some((a) => a.type === 'fellowship')).toBe(false);
    for (const a of acts) {
      if (a.type === 'prepare') {
        const card = s.players[0].hand.find((c) => c.id === a.card)!;
        const here = s.characters[a.character].location;
        expect(card.kind === 'region' && card.region === MAP[here].region).toBe(true);
      }
    }
  });

  it('solo bots complete 8 games without invariant violations', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const r = simulateGame(seed, { players: 1 });
      expect(['won', 'lost']).toContain(r.phase);
    }
  });
});

describe('determinism', () => {
  it('same seed + same actions = identical states', () => {
    const play = () => {
      let s = riggedGame(99);
      s = applyAction(s, 'p1', { type: 'travel', character: 'aragorn', to: 'bree' }).state;
      s = applyAction(s, 'p1', { type: 'endTurn' }).state;
      let guard = 0;
      while (s.pending && guard++ < 20) {
        const decider = s.pending.type === 'discard' ? s.pending.player : 'p1';
        const acts = legalActions(s, decider);
        s = applyAction(s, decider, acts[0]).state;
      }
      return JSON.stringify(s);
    };
    expect(play()).toBe(play());
  });
});
