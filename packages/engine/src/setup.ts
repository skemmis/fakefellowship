import { makeRng, nextInt, shuffle } from './rng.js';
import {
  buildDarkenCards,
  buildEventCards,
  buildRegionCards,
  buildShadowCards,
  DIFFICULTY_TABLE,
  FACTION_TOTALS,
  HOPE_START,
  INITIAL_EYE,
  INITIAL_FRIENDLY,
  INITIAL_NAZGUL,
  INITIAL_SHADOW,
  NAZGUL_TOTAL,
  OBJECTIVES,
  SETUP_BY_PLAYERS,
  SETUP_SHADOW_CARD_DRAWS,
  SHADOW_TROOPS_TOTAL,
  TOKENS_PER_SYMBOL,
} from './data/cards.js';
import { CHARACTERS } from './data/characters.js';
import { MAP, PRINTED_HAVENS } from './data/board.js';
import type {
  CharacterId,
  Difficulty,
  Faction,
  GameState,
  PlayerCard,
  PlayerId,
  SymbolKind,
} from './types.js';

export interface SetupPlayer {
  id: PlayerId;
  name: string;
}

/**
 * Faithful setup sequence: markers, shadow deck (specials in the discard),
 * starting troops/Nazgûl/Eye, 9 seeding shadow draws, characters dealt 2 per
 * player at random, player deck built from region + event cards with Skies
 * Darken cards shuffled into difficulty-scaled stacks, first player chosen by
 * lowest region-card number in an opening hand.
 */
export function createGame(
  players: SetupPlayer[],
  seed: number,
  difficulty: Difficulty = 'introductory',
): GameState {
  if (players.length < 1 || players.length > 5) {
    throw new Error('Supported player counts: 1-5.');
  }
  const rng = makeRng(seed);
  const setupCfg = SETUP_BY_PLAYERS[players.length];
  const diffCfg = DIFFICULTY_TABLE[difficulty];

  // --- Shadow deck: specials start in the discard pile.
  const { deck: shadowBase, specials } = buildShadowCards();
  const shadowDeck = shuffle(rng, [...shadowBase]);
  const shadowDiscard = [...specials];

  // --- Troops, Nazgûl, the Eye.
  const shadow: GameState['shadow'] = {};
  let shadowPlaced = 0;
  for (const [loc, n] of Object.entries(INITIAL_SHADOW)) {
    shadow[loc] = n;
    shadowPlaced += n;
  }
  const friendly: GameState['friendly'] = {};
  const factionSupply: Record<Faction, number> = { ...FACTION_TOTALS };
  for (const [loc, { faction, count }] of Object.entries(INITIAL_FRIENDLY)) {
    friendly[loc] = { [faction]: count };
    factionSupply[faction] -= count;
  }
  const wraiths: GameState['wraiths'] = { ...INITIAL_NAZGUL };
  const wraithsPlaced = Object.values(wraiths).reduce((a, b) => a + b, 0);
  if (wraithsPlaced !== NAZGUL_TOTAL) throw new Error('bad Nazgûl setup');

  // --- Seeding draws: 9 shadow cards each drop 1 troop at their reinforce
  // location (ignoring every other instruction), then go to the discard.
  for (let i = 0; i < SETUP_SHADOW_CARD_DRAWS; i++) {
    const card = shadowDeck.pop()!;
    if (card.reinforce) {
      shadow[card.reinforce] = (shadow[card.reinforce] ?? 0) + 1;
      shadowPlaced += 1;
    }
    shadowDiscard.push(card);
  }

  // --- Objectives: the finale plus (N-1) random others.
  const finale = OBJECTIVES.find((o) => o.finale)!;
  const pool = shuffle(rng, OBJECTIVES.filter((o) => !o.finale).map((o) => o.id));
  const objectives = [
    ...pool.slice(0, diffCfg.objectives - 1).map((id) => ({ id, complete: false })),
    { id: finale.id, complete: false },
  ];

  // --- Characters. Multiplayer: 2 random characters each (Frodo always in
  // play). Solo: Frodo & Sam plus 4 random characters, all run by one player.
  const solo = players.length === 1;
  const charPool = shuffle(rng, CHARACTERS.map((c) => c.id).filter((c) => c !== 'frodo_sam'));
  let playerChars: CharacterId[][];
  let soloState: GameState['solo'];
  if (solo) {
    const four = charPool.slice(0, 4);
    playerChars = [['frodo_sam', ...four]];
    soloState = { order: four, idx: 0 };
  } else {
    const dealt = charPool.slice(0, players.length * 2);
    dealt[nextInt(rng, dealt.length)] = 'frodo_sam';
    playerChars = players.map((_, i) => [dealt[i * 2], dealt[i * 2 + 1]]);
  }
  const characters: GameState['characters'] = {};
  for (const group of playerChars) {
    for (const c of group) {
      characters[c] = { location: CHARACTERS.find((d) => d.id === c)!.start };
    }
  }

  // --- Player deck: regions + selected events; deal hands; then stack with
  // Skies Darken cards per difficulty.
  const regionCards = shuffle(rng, buildRegionCards());
  const allEvents = shuffle(rng, buildEventCards());
  const eventCards = allEvents.slice(0, setupCfg.events);
  const unusedEvents = allEvents.slice(setupCfg.events);
  const preDeck = shuffle(rng, [...regionCards, ...eventCards]);
  const hands: PlayerCard[][] = players.map(() => []);
  for (let i = 0; i < setupCfg.hand; i++) {
    for (let p = 0; p < players.length; p++) hands[p].push(preDeck.pop()!);
  }
  const darken = shuffle(rng, buildDarkenCards()).slice(0, diffCfg.darken);
  const stackCount = diffCfg.darken;
  const stacks: PlayerCard[][] = Array.from({ length: stackCount }, () => []);
  preDeck.forEach((card, i) => stacks[i % stackCount].push(card));
  stacks.forEach((stack, i) => {
    stack.push(darken[i]);
    shuffle(rng, stack);
  });
  // Larger stacks go nearest the top of the deck.
  stacks.sort((a, b) => a.length - b.length);
  const playerDeck = stacks.flat(); // deck is drawn from the end (top)

  // --- First player: lowest region-card number in an opening hand.
  let firstIdx = 0;
  let best = Infinity;
  hands.forEach((hand, i) => {
    for (const c of hand) {
      if (c.kind === 'region' && c.number < best) {
        best = c.number;
        firstIdx = i;
      }
    }
  });

  const siteStatus: GameState['siteStatus'] = {};
  for (const id of PRINTED_HAVENS) siteStatus[id] = 'haven';
  for (const l of Object.values(MAP)) {
    if (l.stronghold) siteStatus[l.id] = 'stronghold';
  }

  const first = playerChars[firstIdx];

  return {
    version: 2,
    rngState: rng.state,
    phase: 'playing',
    difficulty,
    players: players.map((p, i) => ({
      id: p.id,
      name: p.name,
      characters: playerChars[i],
      hand: hands[i],
      tokens: { friendship: 0, valor: 0, stealth: 0, resistance: 0 },
    })),
    characters,
    wraiths,
    eye: INITIAL_EYE,
    shadow,
    friendly,
    supply: {
      shadow: SHADOW_TROOPS_TOTAL - shadowPlaced,
      factions: factionSupply,
      tokens: {
        friendship: TOKENS_PER_SYMBOL,
        valor: TOKENS_PER_SYMBOL,
        stealth: TOKENS_PER_SYMBOL,
        resistance: TOKENS_PER_SYMBOL,
      } as Record<SymbolKind, number>,
    },
    siteStatus,
    spawnStopped: {},
    hope: HOPE_START,
    threatIdx: 0,
    playerDeck,
    playerDiscard: [],
    removedCards: [],
    unusedEvents,
    shadowDeck,
    shadowDiscard,
    objectives,
    turn: { playerIdx: firstIdx, actionsUsed: {}, actedOrder: [], abilityUsed: {} },
    pending: null,
    queue: [],
    turnNumber: 1,
    ...(soloState ? { solo: soloState } : {}),
  };
}
