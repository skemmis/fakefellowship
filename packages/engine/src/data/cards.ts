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
 * 48 region cards: 4 per region, one of each symbol. (Real symbol distribution
 * unverified.) Each card carries a flavor number; the lowest number in an
 * opening hand picks the first player.
 */
export function buildRegionCards(): RegionCard[] {
  const symbols: SymbolKind[] = ['friendship', 'valor', 'stealth', 'resistance'];
  const cards: RegionCard[] = [];
  REGIONS.forEach((region, r) => {
    symbols.forEach((symbol, s) => {
      const idx = r * 4 + s;
      cards.push({
        id: `rc${idx}`,
        kind: 'region',
        region: region.id,
        symbol,
        number: ((idx * 37) % 144) + 1, // spread of distinct flavor numbers
      });
    });
  });
  return cards;
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

export const EVENTS: EventDef[] = [
  { key: 'haven_cloaks', name: 'Haven Cloaks and Rope', text: 'Choose a character. Move them up to 3 connections along normal paths (no search for Frodo).', reconstructed: true },
  { key: 'eagles', name: 'The Eagles Are Coming!', text: 'Move a character to any haven.', reconstructed: true },
  { key: 'athelas', name: 'Athelas', text: 'Gain 2 hope.', reconstructed: true },
  { key: 'phial', name: 'The Light of Eärendil', text: 'Play during a search: all dice become Slip By.', reconstructed: true },
  { key: 'rohirrim_charge', name: 'Charge of the Rohirrim', text: 'Roll a battle (up to 3 dice, one per friendly troop) in any location with friendly and shadow troops. Do not shift the Eye.', reconstructed: true },
  { key: 'beacons', name: 'The Beacons Are Lit', text: 'Add 1 matching troop to each haven with a muster icon (if the supply allows).', reconstructed: true },
  { key: 'council', name: 'The Council Convenes', text: 'Take any 1 symbol token from the supply.', reconstructed: true },
  { key: 'ranger_paths', name: 'Ranger Paths', text: 'Move up to 3 friendly troops from one location to a connected location.', reconstructed: true },
  { key: 'palantir', name: 'The Palantír', text: 'Reveal the next 3 shadow cards to all players.', reconstructed: true },
  { key: 'mithril', name: 'Mithril Coat', text: 'Gain 1 hope and take 1 Resistance token if available.', reconstructed: true },
  { key: 'ents', name: 'March of the Ents', text: 'Remove up to 2 shadow troops at Isengard or a location connected to Fangorn Forest.', reconstructed: true },
  { key: 'oath_dead', name: 'The Dead Answer', text: 'Remove up to 2 shadow troops at any one Gondor location.', reconstructed: true },
  { key: 'shadowfax', name: 'Shadowfax', text: 'Shift the Eye to any region.', reconstructed: true },
  { key: 'gift', name: 'A Long-Expected Gift', text: 'Draw 1 player card.', reconstructed: true },
];

export function buildEventCards(): EventCard[] {
  return EVENTS.map((e, i) => ({ id: `ev${i}`, kind: 'event', event: e.key }));
}

/** 12 Skies Darken cards; each targets a location for its troop drop. (targets reconstructed) */
const DARKEN_TARGETS: LocationId[] = [
  'south_ithilien', 'dunland', 'rhun', 'near_harad', 'hollin', 'brown_lands',
  'old_forest_road', 'fords_of_isen', 'lake_town', 'osgiliath', 'harondor', 'gladden_fields',
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
