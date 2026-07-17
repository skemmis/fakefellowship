import { makeRng, shuffle } from './rng.js';
import {
  CARDS_PER_TURN,
  FACTION_SUPPLY,
  HOPE_START,
  PLAYER_DECK,
  PLAYER_DECK_EXTRA,
  SHADOW_SUPPLY,
} from './data/constants.js';
import { HERO_MAP } from './data/heroes.js';
import { LOCATIONS, MAP, START_LOCATION } from './data/map.js';
import type {
  Faction,
  GameState,
  HeroId,
  PlayerCard,
  PlayerId,
  ShadowCard,
} from './types.js';

export interface SetupPlayer {
  id: PlayerId;
  name: string;
  heroes: [HeroId, HeroId];
}

/**
 * Initial board pressure: shadow troops already on the map at setup,
 * heavier the closer to Ashenfell.
 */
const INITIAL_SHADOW: Record<string, number> = {
  ashgate: 3,
  wraithspire: 3,
  sootplain: 2,
  cinder_approach: 2,
  emberpass: 2,
  redgrass: 1,
  cragspire: 1,
  thornfen: 1,
};

const INITIAL_WRAITHS: string[] = ['wraithspire', 'wraithspire', 'ashgate'];

export function createGame(players: SetupPlayer[], seed: number): GameState {
  if (players.length < 1 || players.length > 4) {
    throw new Error('Emberfall supports 1-4 players.');
  }
  const seen = new Set<HeroId>();
  for (const p of players) {
    for (const h of p.heroes) {
      if (!HERO_MAP[h]) throw new Error(`Unknown hero: ${h}`);
      if (seen.has(h)) throw new Error(`Hero ${h} picked twice.`);
      seen.add(h);
    }
  }

  const rng = makeRng(seed);

  // Player deck: shuffle non-surge cards, deal opening hands, then shuffle
  // the surges in (so nobody starts with a surge in hand).
  let cardId = 0;
  const base: PlayerCard[] = [];
  const surges: PlayerCard[] = [];
  const counts: Record<string, number> = { ...PLAYER_DECK };
  for (const [kind, extra] of Object.entries(PLAYER_DECK_EXTRA)) {
    counts[kind] += Math.max(0, players.length - 2) * (extra ?? 0);
  }
  for (const [kind, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i++) {
      const card: PlayerCard = { id: `pc${cardId++}`, kind: kind as PlayerCard['kind'] };
      (kind === 'ashen_surge' ? surges : base).push(card);
    }
  }
  shuffle(rng, base);
  const hands: PlayerCard[][] = players.map(() => []);
  for (let i = 0; i < CARDS_PER_TURN; i++) {
    for (let p = 0; p < players.length; p++) hands[p].push(base.pop()!);
  }
  const playerDeck = shuffle(rng, [...base, ...surges]);

  // Shadow deck: one spawn card per location outside the goal, strongholds
  // twice, plus hunt cards.
  const shadowDeck: ShadowCard[] = [];
  let sId = 0;
  for (const loc of LOCATIONS) {
    if (loc.id === 'cindermaw') continue;
    shadowDeck.push({ id: `sc${sId++}`, kind: 'spawn', location: loc.id });
    if (loc.stronghold) shadowDeck.push({ id: `sc${sId++}`, kind: 'spawn', location: loc.id });
  }
  for (let i = 0; i < 4; i++) shadowDeck.push({ id: `sc${sId++}`, kind: 'hunt' });
  shuffle(rng, shadowDeck);

  const shadow: GameState['shadow'] = {};
  let shadowPlaced = 0;
  for (const [loc, n] of Object.entries(INITIAL_SHADOW)) {
    if (!MAP[loc]) throw new Error(`bad initial shadow location ${loc}`);
    shadow[loc] = n;
    shadowPlaced += n;
  }

  const heroes: GameState['heroes'] = {};
  for (const p of players) {
    for (const h of p.heroes) heroes[h] = { id: h, location: START_LOCATION };
  }

  const sanctuaries: GameState['sanctuaries'] = {};
  for (const loc of LOCATIONS) {
    if (loc.sanctuary) sanctuaries[loc.id] = 'standing';
  }

  const firstPlayer = players[0];

  return {
    version: 1,
    rngState: rng.state,
    phase: 'playing',
    players: players.map((p, i) => ({
      id: p.id,
      name: p.name,
      heroes: p.heroes,
      hand: hands[i],
    })),
    heroes,
    shardbearer: { location: START_LOCATION, hidden: false, corruption: 0 },
    wraiths: INITIAL_WRAITHS.map((loc, i) => ({ id: i, location: loc })),
    shadow,
    allied: {},
    supply: {
      shadow: SHADOW_SUPPLY - shadowPlaced,
      factions: { ...FACTION_SUPPLY } as Record<Faction, number>,
    },
    sanctuaries,
    hope: HOPE_START,
    threatIdx: 0,
    playerDeck,
    playerDiscard: [],
    shadowDeck,
    shadowDiscard: [],
    foreseen: [],
    objectives: [
      {
        id: 'garrisons',
        name: 'Garrison the Realm',
        text: 'Have 3 or more allied troops at every standing sanctuary.',
        complete: false,
      },
      {
        id: 'purge',
        name: 'Purge the Shadow',
        text: 'Slay 12 shadow troops in battle.',
        complete: false,
      },
      {
        id: 'beacon',
        name: 'Light the Beacons',
        text: 'Raise hope to 7 or more.',
        complete: false,
      },
    ],
    shadowSlain: 0,
    turn: {
      playerIdx: 0,
      actionsUsed: Object.fromEntries(firstPlayer.heroes.map((h) => [h, 0])),
      kindleUsed: false,
      stage: 'actions',
    },
    turnNumber: 1,
  };
}
