import type {
  DarkenCard,
  Difficulty,
  EventCard,
  LocationId,
  RegionCard,
  RegionId,
  ShadowCard,
  ShadowOrder,
  SymbolKind,
} from '../types.js';
import { BATTLE_LINES, REGIONS, SHADOW_LOCATIONS } from './board.js';

// ---------------------------------------------------------------------------
// Core numbers. Values marked (reconstructed) are not printed in the rulebook
// and should be trued up against the physical components.
// ---------------------------------------------------------------------------

export const HOPE_MAX = 8;
/** The hope track's dot (start space) is on 6; despair (loss) is 0. */
export const HOPE_START = 6;

/** Shadow cards resolved per turn, by threat marker position (from the board). */
export const THREAT_TRACK = [2, 2, 3, 3, 4, 4, 5] as const;

export const HAND_LIMIT = 7;
export const CARDS_PER_TURN = 2;
export const ACTIONS_PRIMARY = 4;
export const ACTIONS_SECONDARY = 1;

export const SHADOW_TROOPS_TOTAL = 48;
export const FACTION_TOTALS = { deepholm: 8, sylvan: 9, riders: 8, vale: 10 } as const;
export const NAZGUL_TOTAL = 9;
export const TOKENS_PER_SYMBOL = 9; // 36 symbol tokens (reconstructed split)

export const CAPTURE_COST = 3; // Valor
export const RING_DESTROY_COST = 5; // Resistance
export const MAX_SEARCH_DICE = 7;
export const MAX_BATTLE_DICE = 3;
export const HAVEN_LOST_HOPE = 3;
export const CAPTURE_HOPE = 2;

/** Search die faces (distribution reconstructed; face effects are from the rulebook). */
export const SEARCH_DIE = ['slip', 'slip', 'slip', 'weary', 'exposed', 'recall'] as const;
/** Battle die faces (distribution reconstructed; face effects are from the rulebook). */
export const BATTLE_DIE = ['rout', 'rout', 'exchange', 'exchange', 'overrun', 'wraith'] as const;

export const SYMBOL_INFO: Record<SymbolKind, { name: string; note: string }> = {
  friendship: { name: 'Friendship', note: 'Spend 1 to Muster a troop.' },
  valor: { name: 'Valor', note: 'Spend 1 in a battle to remove a shadow troop; spend 3 to Capture.' },
  stealth: { name: 'Stealth', note: 'Spend 1 when Frodo travels to avoid a search.' },
  resistance: { name: 'Resistance', note: 'Spend 1 to reroll a search or battle die.' },
};

// ---------------------------------------------------------------------------
// Player cards
// ---------------------------------------------------------------------------

/** Setup table from the rulebook: events mixed in and opening hand size. */
export const SETUP_BY_PLAYERS: Record<number, { events: number; hand: number }> = {
  1: { events: 5, hand: 4 },
  2: { events: 6, hand: 4 },
  3: { events: 6, hand: 3 },
  4: { events: 7, hand: 2 },
  5: { events: 9, hand: 2 },
};

/** Difficulty table from the rulebook. */
export const DIFFICULTY_TABLE: Record<Difficulty, { darken: number; objectives: number }> = {
  introductory: { darken: 4, objectives: 4 },
  standard: { darken: 5, objectives: 4 },
  heroic: { darken: 5, objectives: 5 },
  epic: { darken: 6, objectives: 5 },
  legendary: { darken: 6, objectives: 6 },
};

/**
 * The 48 region cards, transcribed from the physical deck: 4 per region, one
 * of each symbol, each with its printed corner number (lowest number in an
 * opening hand picks the first player).
 */
const REGION_CARD_DATA: [RegionId, SymbolKind, number][] = [
  ['eriador', 'valor', 19], ['eriador', 'stealth', 4], ['eriador', 'resistance', 17], ['eriador', 'friendship', 144],
  ['rhudaur', 'friendship', 49], ['rhudaur', 'stealth', 458], ['rhudaur', 'valor', 464], ['rhudaur', 'resistance', 2],
  ['misty_mountains', 'valor', 200], ['misty_mountains', 'resistance', 21], ['misty_mountains', 'stealth', 30], ['misty_mountains', 'friendship', 27],
  ['enedwaith', 'resistance', 3], ['enedwaith', 'stealth', 11], ['enedwaith', 'valor', 12], ['enedwaith', 'friendship', 400],
  ['rohan', 'friendship', 45], ['rohan', 'resistance', 42], ['rohan', 'stealth', 105], ['rohan', 'valor', 10000],
  ['gondor', 'valor', 93], ['gondor', 'friendship', 26], ['gondor', 'resistance', 6], ['gondor', 'stealth', 28],
  ['ithilien', 'valor', 150], ['ithilien', 'stealth', 10], ['ithilien', 'resistance', 7000], ['ithilien', 'friendship', 3000],
  ['mordor', 'valor', 3019], ['mordor', 'stealth', 9], ['mordor', 'resistance', 1], ['mordor', 'friendship', 589],
  ['rhovanion', 'stealth', 18], ['rhovanion', 'valor', 20], ['rhovanion', 'resistance', 5], ['rhovanion', 'friendship', 8],
  ['mirkwood', 'valor', 33], ['mirkwood', 'friendship', 14], ['mirkwood', 'stealth', 131], ['mirkwood', 'resistance', 95],
  ['dale', 'valor', 111], ['dale', 'friendship', 13], ['dale', 'resistance', 7], ['dale', 'stealth', 50],
  ['haradwaith', 'valor', 15], ['haradwaith', 'friendship', 130], ['haradwaith', 'resistance', 99], ['haradwaith', 'stealth', 87],
];

export function buildRegionCards(): RegionCard[] {
  return REGION_CARD_DATA.map(([region, symbol, number], i) => ({
    id: `rc${i}`,
    kind: 'region',
    region,
    symbol,
    number,
  }));
}

/**
 * The 14 event cards. Effects are reconstructions (the rulebook shows only
 * one card partially); "Haven Cloaks and Rope" is closest to its source.
 */
export interface EventDef {
  key: string;
  name: string;
  text: string;
  reconstructed: boolean;
}

/**
 * The 14 event cards, mechanics transcribed from the physical cards
 * (descriptions paraphrased). All are playable at any time and are never
 * an action; Lembas is restricted to the Do Actions step.
 */
export const EVENTS: EventDef[] = [
  { key: 'red_arrow', name: 'The Red Arrow', text: 'Move up to 3 troops from one haven to another haven, then optionally battle there (the Eye shifts there if you do).', reconstructed: false },
  { key: 'tom_bombadil', name: 'Tom Bombadil', text: 'Either gain 1 hope, or reroll up to 3 dice of one roll.', reconstructed: false },
  { key: 'council_of_elrond', name: 'The Council of Elrond', text: 'Move any characters to Rivendell (no troops, no search); one player with a character there may then hand a symbol token to another. Solo: instead Prepare 1 card free, any region.', reconstructed: false },
  { key: 'gwaihir', name: 'Gwaihir Brings News', text: 'Move friendly troops into an adjacent location (no special paths), then optionally battle there (the Eye shifts there if you do).', reconstructed: false },
  { key: 'rohan_horses', name: 'Rohan Lends Horses', text: 'All characters in one location Travel together up to 3 times (no troops, no special paths). Frodo searches after every leg — Stealth cannot prevent it.', reconstructed: false },
  { key: 'orc_infighting', name: 'Orc Infighting', text: 'Remove up to 2 shadow troops from a single location.', reconstructed: false },
  { key: 'lembas', name: 'Lembas', text: 'During the Do Actions step: the current player gets 2 extra actions with one of their characters.', reconstructed: false },
  { key: 'eagles', name: 'Eagles', text: 'Move a character to any location. Moving Frodo this way pulls the 7 closest Nazgûl and the Eye to his region, then a search.', reconstructed: false },
  { key: 'elronds_foresight', name: "Elrond's Foresight", text: 'The current player reveals up to 4 player cards, may keep one (never a Skies Darken), and returns the rest to the top.', reconstructed: false },
  { key: 'entmoot', name: 'Entmoot', text: 'Add up to 3 Ent troops (Elven pieces) to Fangorn Forest, then optionally march them with willing characters to an adjacent location — even Isengard, with no Stealth cost, no search, no battle.', reconstructed: false },
  { key: 'elven_cloaks', name: 'Elven Cloaks and Rope', text: 'One character Travels alone up to 2 times with no searches (special path costs still apply; no companions or troops).', reconstructed: false },
  { key: 'palantir_gaze', name: 'Gaze into a Palantír', text: "Pick a character: the Eye shifts to their region and any 3 Nazgûl fly there.", reconstructed: false },
  { key: 'conflicting_orders', name: 'Conflicting Orders', text: 'Move all shadow troops from one location to adjacent location(s) of your choice. No battles roll.', reconstructed: false },
  { key: 'gifts_elves', name: 'Gifts from the Elves', text: 'Take any 1 symbol token from the supply and give it to any player.', reconstructed: false },
];

export function buildEventCards(): EventCard[] {
  return EVENTS.map((e, i) => ({ id: `ev${i}`, kind: 'event', event: e.key }));
}

/** 12 Skies Darken cards; each targets a location for its troop drop. (targets reconstructed) */
/** Skies Darken step-3 troop-drop targets — all 12 transcribed from the cards. */
const DARKEN_TARGETS: LocationId[] = [
  'druadan_forest', 'dorwinion', 'gladden_fields', 'hollin', 'mount_doom',
  'north_ithilien', 'south_ithilien', 'southern_mirkwood', 'tharbad',
  'fangorn_forest', 'druwaith_iaur', 'emyn_muil',
];

export function buildDarkenCards(): DarkenCard[] {
  return DARKEN_TARGETS.map((loc, i) => ({ id: `sd${i}`, kind: 'darken', location: loc }));
}

// ---------------------------------------------------------------------------
// Shadow cards: 48 regular (advance half + reinforce half) + 2 specials.
// Which half resolves is decided by the back of the next card on the deck.
// Special-order distribution (16/16/16) is from the rulebook.
// ---------------------------------------------------------------------------

export function buildShadowCards(): { deck: ShadowCard[]; specials: ShadowCard[] } {
  const deck: ShadowCard[] = [];
  const orders: ShadowOrder[] = ['eye', 'hunt2', 'deploy3'];
  for (let i = 0; i < 48; i++) {
    deck.push({
      id: `sh${i}`,
      back: i % 2 === 0 ? 'flag' : 'banner',
      line: BATTLE_LINES[i % BATTLE_LINES.length].id,
      reinforce: SHADOW_LOCATIONS[i % SHADOW_LOCATIONS.length],
      order: orders[Math.floor(i / 16)],
    });
  }
  const specials: ShadowCard[] = [
    { id: 'sp_drums', back: 'flag', special: 'war_drums' },
    { id: 'sp_wheels', back: 'banner', special: 'traitors_engine' },
  ];
  return { deck, specials };
}

export const SPECIAL_SHADOW_INFO: Record<string, { name: string; text: string }> = {
  // Both effects reconstructed — the rulebook names these cards but their
  // text isn't legible in the scan.
  war_drums: {
    name: 'The Drums of War',
    text: 'Add 1 shadow troop to every shadow stronghold that has not been captured, then battle wherever friendly troops share those locations.',
  },
  traitors_engine: {
    name: 'The Wheels of Saruman',
    text: 'Add 2 shadow troops to Isengard (unless captured), then advance the Isengard battle line.',
  },
};

// ---------------------------------------------------------------------------
// Objectives. The finale's procedure is from the rulebook; the others use
// real card names from the scenario lists with reconstructed requirements.
// ---------------------------------------------------------------------------

export interface ObjectiveDef {
  id: string;
  name: string;
  text: string;
  finale?: boolean;
  reconstructed: boolean;
}

export const OBJECTIVES: ObjectiveDef[] = [
  {
    id: 'destroy_ring',
    name: 'Destroy the One Ring',
    text: 'Complete every other objective first. Then, with Frodo at Mount Doom, spend 5 Resistance and survive a final search (1 die per Nazgûl in Mordor, per shadow troop at Mount Doom, and per missing hope — max 7). Win if any hope remains.',
    finale: true,
    reconstructed: false,
  },
  { id: 'blessing_elves', name: 'Attain the Blessing of the Elves', text: 'Frodo is at Rivendell with no shadow troops present. Reward: +1 hope and 1 Stealth token.', reconstructed: true },
  { id: 'staff_broken', name: 'Saruman, Your Staff Is Broken', text: 'Capture Isengard. Reward: +1 hope.', reconstructed: true },
  { id: 'challenge_sauron', name: 'Challenge Sauron', text: 'Do the Attack action in Mordor (drawing the Eye there). Reward: +2 hope.', reconstructed: true },
  { id: 'confront_balrog', name: 'Confront the Balrog', text: 'Capture Moria. Reward: +1 hope.', reconstructed: true },
  { id: 'oathbreakers', name: 'Oathbreakers Fulfill Their Duty', text: 'Have 5 or more Gondor troops on the board. Reward: +1 hope.', reconstructed: true },
  { id: 'subdue_umbar', name: 'Subdue Umbar', text: 'Capture Umbar. Reward: +1 hope.', reconstructed: true },
  { id: 'ride_eored', name: 'Ride with the Éored', text: 'Have 6 or more Rohirrim troops on the board. Reward: +1 hope.', reconstructed: true },
  { id: 'light_mirkwood', name: 'Bring Light to Mirkwood', text: 'Capture Dol Guldur. Reward: +1 hope.', reconstructed: true },
];

export const OBJECTIVE_MAP: Record<string, ObjectiveDef> = Object.fromEntries(
  OBJECTIVES.map((o) => [o.id, o]),
);

/** Starting board pressure (all values from the rulebook setup pages). */
export const INITIAL_SHADOW: Record<LocationId, number> = {
  dunland: 1, isengard: 1, moria: 2, dol_guldur: 1, rhun: 3,
  minas_morgul: 2, barad_dur: 2, nurn: 3, umbar: 1, near_harad: 2,
};
export const SETUP_SHADOW_CARD_DRAWS = 9;

export const INITIAL_FRIENDLY: Record<LocationId, { faction: keyof typeof FACTION_TOTALS; count: number }> = {
  ered_luin: { faction: 'deepholm', count: 1 },
  erebor: { faction: 'deepholm', count: 1 },
  iron_hills: { faction: 'deepholm', count: 1 },
  grey_havens: { faction: 'sylvan', count: 1 },
  rivendell: { faction: 'sylvan', count: 1 },
  lorien: { faction: 'sylvan', count: 1 },
  woodland_realm: { faction: 'sylvan', count: 1 },
  helms_deep: { faction: 'riders', count: 1 },
  edoras: { faction: 'riders', count: 1 },
  eastemnet: { faction: 'riders', count: 1 },
  minas_tirith: { faction: 'vale', count: 2 },
  dol_amroth: { faction: 'vale', count: 2 },
  pelargir: { faction: 'vale', count: 1 },
};

export const INITIAL_NAZGUL: Record<RegionId, number> = {
  eriador: 2, rhudaur: 1, misty_mountains: 1, gondor: 1, mordor: 4,
};
export const INITIAL_EYE: RegionId = 'eriador';
