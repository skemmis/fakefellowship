import type {
  CharacterId,
  DarkenCard,
  Difficulty,
  EventCard,
  Faction,
  LocationId,
  RegionCard,
  RegionId,
  ShadowCard,
  ShadowOrder,
  SymbolKind,
} from '../types.js';

// ---------------------------------------------------------------------------
// Core numbers, confirmed against the official rulebook (see docs/SOURCE-TEXT.md).
// The only value not pinned by the rulebook is the per-symbol token split.
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

export const SHADOW_TROOPS_TOTAL = 48; // rulebook p2
// Rulebook p2: 35 friendly troops — 8 Dwarven, 9 Elven, 8 Rohirrim, 10 Gondor.
export const FACTION_TOTALS = { deepholm: 8, sylvan: 9, riders: 8, vale: 10 } as const;
/** Display names for the four Free Peoples armies (internal ids are legacy). */
export const FACTION_NAMES = {
  vale: 'Gondor',
  riders: 'Rohirrim',
  sylvan: 'Elven',
  deepholm: 'Dwarven',
} as const;
export const NAZGUL_TOTAL = 9;
// Rulebook p2 lists 36 symbol tokens total but does not split them by symbol;
// 9 each (= 36) is a stand-in. Never blocks the 5 Resistance needed to win.
export const TOKENS_PER_SYMBOL = 9;

export const CAPTURE_COST = 3; // Valor
export const RING_DESTROY_COST = 5; // Resistance
export const MAX_SEARCH_DICE = 7;
export const MAX_BATTLE_DICE = 3;
export const HAVEN_LOST_HOPE = 3;
export const CAPTURE_HOPE = 2;

/**
 * Die faces, transcribed from the physical dice.
 * Search: 2 blank (slip), 2 lone-tree (weary: −1 hope), 1 framed-tree
 * (exposed: −1 hope, ignored in a haven), 1 Nazgûl (recall to Mordor).
 */
export const SEARCH_DIE = ['slip', 'slip', 'weary', 'weary', 'exposed', 'recall'] as const;
/**
 * Battle: 2 shadow-troop (rout), 2 shadow+friendly (exchange), 1 framed
 * friendly (overrun: ignored in a haven), 1 winged Nazgûl (−2 friendly if
 * Nazgûl are in the region).
 */
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
 * The 14 event cards, transcribed from the owner's card photos (mechanics
 * paraphrased). The `reconstructed` flag is kept for any card still unverified.
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

// 12 Skies Darken cards; step 3 ("Under Cover of Darkness") drops 3 shadow troops
// on the location the card shows. Those 12 target locations live only on the
// physical cards (the rulebook shows just one example, South Ithilien), so this
// list is a stand-in until the cards are photographed. See docs/SOURCE-TEXT.md.
const DARKEN_TARGETS: LocationId[] = [
  'druadan_forest', 'dorwinion', 'gladden_fields', 'hollin', 'mount_doom',
  'north_ithilien', 'south_ithilien', 'southern_mirkwood', 'tharbad',
  'fangorn_forest', 'druwaith_iaur', 'emyn_muil',
];

export function buildDarkenCards(): DarkenCard[] {
  return DARKEN_TARGETS.map((loc, i) => ({ id: `sd${i}`, kind: 'darken', location: loc }));
}

// ---------------------------------------------------------------------------
// Shadow cards: 48 regular (advance half + reinforce half) + 2 specials,
// all transcribed from the physical deck. The advance half names a battle
// line by its endpoints; the reinforce half always adds 1 troop at the
// line's origin, plus one of three special orders (16 of each):
//   eye     — the Eye shifts to Frodo's region (a search if already there)
//   hunt2   — 2 Nazgûl close in on Frodo (closest outside his region)
//   deploy3 — 3 Nazgûl fly from Mordor to the Eye (recall 3 if Eye in Mordor)
// Each card's printed back (red flag vs. dark Eye banner) is real: the back
// of the NEXT card on the deck picks which half of the flipped card resolves
// (flag = advance, banner = reinforce). 25 of each across the 50 cards.
// ---------------------------------------------------------------------------

type ShadowRow = [LocationId, LocationId, ShadowOrder, 'F' | 'B'];

const SHADOW_CARD_DATA: ShadowRow[] = [
  ['rhun', 'woodland_realm', 'eye', 'B'],
  ['isengard', 'grey_havens', 'eye', 'B'],
  ['umbar', 'helms_deep', 'deploy3', 'B'],
  ['nurn', 'minas_tirith', 'eye', 'F'],
  ['isengard', 'rivendell', 'deploy3', 'B'],
  ['dunland', 'rivendell', 'deploy3', 'F'],
  ['dunland', 'grey_havens', 'hunt2', 'F'],
  ['dunland', 'rivendell', 'eye', 'B'],
  ['moria', 'minas_tirith', 'deploy3', 'B'],
  ['dunland', 'helms_deep', 'deploy3', 'B'],
  ['nurn', 'minas_tirith', 'hunt2', 'B'],
  ['isengard', 'helms_deep', 'eye', 'F'],
  ['umbar', 'helms_deep', 'eye', 'B'],
  ['rhun', 'minas_tirith', 'hunt2', 'F'],
  ['umbar', 'grey_havens', 'deploy3', 'F'],
  ['isengard', 'grey_havens', 'deploy3', 'B'],
  ['dol_guldur', 'erebor', 'hunt2', 'B'],
  ['dol_guldur', 'erebor', 'eye', 'F'],
  ['umbar', 'helms_deep', 'hunt2', 'F'],
  ['umbar', 'helms_deep', 'hunt2', 'F'],
  ['dunland', 'grey_havens', 'eye', 'B'],
  ['nurn', 'helms_deep', 'deploy3', 'F'],
  ['nurn', 'erebor', 'hunt2', 'F'],
  ['moria', 'erebor', 'hunt2', 'B'],
  ['dunland', 'helms_deep', 'hunt2', 'F'],
  ['nurn', 'helms_deep', 'eye', 'B'],
  ['rhun', 'woodland_realm', 'hunt2', 'F'],
  ['moria', 'erebor', 'eye', 'F'],
  ['isengard', 'rivendell', 'hunt2', 'F'],
  ['dol_guldur', 'helms_deep', 'deploy3', 'F'],
  ['near_harad', 'erebor', 'eye', 'F'],
  ['near_harad', 'erebor', 'hunt2', 'B'],
  ['rhun', 'woodland_realm', 'deploy3', 'B'],
  ['near_harad', 'helms_deep', 'deploy3', 'B'],
  ['umbar', 'grey_havens', 'eye', 'B'],
  ['moria', 'minas_tirith', 'hunt2', 'B'],
  ['moria', 'rivendell', 'deploy3', 'F'],
  ['rhun', 'minas_tirith', 'deploy3', 'B'],
  ['near_harad', 'helms_deep', 'eye', 'B'],
  ['dol_guldur', 'helms_deep', 'eye', 'F'],
  ['near_harad', 'helms_deep', 'deploy3', 'B'],
  ['nurn', 'erebor', 'deploy3', 'F'],
  ['dol_guldur', 'minas_tirith', 'deploy3', 'F'],
  ['near_harad', 'helms_deep', 'hunt2', 'B'],
  ['dol_guldur', 'minas_tirith', 'hunt2', 'B'],
  ['rhun', 'woodland_realm', 'eye', 'F'],
  ['isengard', 'helms_deep', 'hunt2', 'F'],
  ['moria', 'rivendell', 'eye', 'F'],
];

export function buildShadowCards(): { deck: ShadowCard[]; specials: ShadowCard[] } {
  const deck: ShadowCard[] = SHADOW_CARD_DATA.map(([from, to, order, back], i) => ({
    id: `sh${i}`,
    back: back === 'F' ? 'flag' : 'banner',
    lineFrom: from,
    lineTo: to,
    reinforce: from,
    order,
  }));
  const specials: ShadowCard[] = [
    { id: 'sp_drums', back: 'flag', special: 'drums_of_war' },
    { id: 'sp_wheels', back: 'banner', special: 'wheels_of_saruman' },
  ];
  return { deck, specials };
}

export const SPECIAL_SHADOW_INFO: Record<string, { name: string; text: string }> = {
  // Effects transcribed from the physical cards (paraphrased).
  drums_of_war: {
    name: 'The Drums of War',
    text: 'Every shadow stronghold in Mordor gains 1 shadow troop.',
  },
  wheels_of_saruman: {
    name: 'The Wheels of Saruman',
    text: 'The current player picks one: remove 2 friendly troops from the board; or one player gives up 2 cards and/or symbol tokens; or lose 1 hope.',
  },
};

// ---------------------------------------------------------------------------
// Objectives: all 24 transcribed from the physical cards (text paraphrased).
// A card marked `uses` forces that character into the game at setup.
// `setupShadow` places extra shadow troops; `reserve` sets troops aside on
// the card (unusable until the objective completes). `uncertain` flags a
// detail that could not be read from the photos and awaits confirmation —
// the engine uses a conservative stand-in until then.
// ---------------------------------------------------------------------------

export interface ObjectiveDef {
  id: string;
  name: string;
  text: string;
  finale?: boolean;
  /** red = always in play (the finale); black = suggested first-game set. */
  star?: 'red' | 'black';
  uses?: CharacterId[];
  setupShadow?: Partial<Record<LocationId, number>>;
  reserve?: { faction: Faction; count: number };
  uncertain?: string;
}

export const OBJECTIVES: ObjectiveDef[] = [
  {
    id: 'destroy_ring',
    name: 'Destroy the One Ring',
    text: 'Complete every other objective first. Then, as an action, Frodo spends 5 Resistance at Mount Doom and survives a final search with 1 extra die per missing hope (7 dice max). Win if he endures.',
    finale: true,
    star: 'red',
    uses: ['frodo_sam'],
  },
  {
    id: 'blessing_elves',
    name: 'Attain the Blessing of the Elves',
    text: 'Setup: 3 Elven troops wait on this card. As an action, a character in Rivendell spends 3 Valor or 3 Stealth with another character present. Done: the waiting troops join the supply, each player with a character in Rivendell may take a Friendship token, and hope rises 1.',
    star: 'black',
    reserve: { faction: 'sylvan', count: 3 },
  },
  {
    id: 'staff_broken',
    name: '“Saruman, Your Staff Is Broken”',
    text: 'Setup: 2 extra shadow troops in Isengard. Done when Isengard is a haven AND Rohan holds no shadow troops or shadow strongholds. The current player may take 1 Resistance token.',
    star: 'black',
    setupShadow: { isengard: 2 },
  },
  {
    id: 'challenge_sauron',
    name: 'Challenge Sauron',
    text: 'A character spends an action in North Ithilien while 2 Rohirrim, 2 Elven, and 3 Gondor troops are present. Done: the Eye shifts to Ithilien and every shadow troop in Mordor falls back to Udûn.',
    star: 'black',
  },
  {
    id: 'subdue_umbar',
    name: 'Subdue Umbar',
    text: 'Done when Umbar is a haven, OR every Haradwaith location holds a friendly troop with no shadow troops in Haradwaith. (The reward repositioning to Pelargir is not automated yet.)',
  },
  {
    id: 'avenge_balin',
    name: 'Avenge Balin!',
    text: 'Done when Moria is a haven with at least 2 Dwarven troops inside. If at least 4 Dwarven troops stand in Moria, the current player may take 2 Valor tokens.',
  },
  {
    id: 'oathbreakers',
    name: 'Oathbreakers Fulfill Their Duty',
    text: 'Once per game Aragorn rides from Edoras to Erech (an action): 2 shadow troops muster at Pelargir, Umbar’s shadow troops march there too, and up to 3 Gondor troops rally at Erech. Done once he has ridden AND Gondor holds no shadow troops or strongholds: hope rises 1.',
    uses: ['aragorn'],
  },
  {
    id: 'light_mirkwood',
    name: 'Bring Light to Mirkwood',
    text: 'Setup: 1 shadow troop each in Old Forest Road and Southern Mirkwood. Done when Mirkwood holds no shadow troops (Dol Guldur may stay uncaptured) and every Mirkwood location has an Elven troop: hope rises 1.',
    setupShadow: { old_forest_road: 1, southern_mirkwood: 1 },
  },
  {
    id: 'arwen_banner',
    name: 'Arwen Unfurls the Banner',
    text: 'Arwen spends an action and 1 Friendship in Minas Tirith while it is a haven holding at least 1 Gondor, 1 Rohirrim, 1 Elven, and 1 Dwarven troop. Done: hope rises 1.',
    uses: ['arwen'],
  },
  {
    id: 'boromir_honor',
    name: 'Boromir Reclaims His Honor',
    text: 'Done when Boromir and another character stand where the last friendly troop falls in battle: up to 2 shadow troops are driven off, and Boromir leaves the game. When the next objective completes, a new character takes his place.',
    uses: ['boromir'],
  },
  {
    id: 'unseat_denethor',
    name: 'Unseat Denethor',
    text: 'Setup: 4 Gondor troops wait on this card. As an action, a character in Minas Tirith spends 2 Stealth, 1 Friendship, and 1 Valor with another character present. Done: the waiting troops join the supply, up to 3 Gondor troops muster in Minas Tirith, and hope rises 1.',
    reserve: { faction: 'vale', count: 4 },
  },
  {
    id: 'shelobs_lair',
    name: 'Shelob’s Lair',
    text: 'Sam spends an action in Minas Morgul to brave the lair, rolling 3 battle dice with Gollum present: an overrun costs 1 hope, an exchange 2, a Nazgûl 3; a lone foe is harmless — plus 1 hope per Resistance (card or token) the Gollum player holds (solo: per Resistance card in hand). Sam may spend Valor to ignore dice and Friendship to prevent hope losses. Done: if Frodo lost no hope doing it, he may take 1 extra action this turn.',
    uses: ['gollum'],
  },
  {
    id: 'hobbits_loyalty',
    name: 'Hobbits Pledge Their Loyalty',
    text: 'While in a haven, Merry & Pippin may spend an action to discard a Friendship region card matching their region, placing a Friendship token from the supply on that haven’s people. Pledge 2 of the 4 peoples — Gondor, Rohirrim, Elven, Dwarven — then give the 2 tokens to their player and hope rises 1.',
    uses: ['merry_pippin'],
  },
  {
    id: 'that_makes_six',
    name: '“That Makes Six!”',
    text: 'Shadow troops Legolas removes with his Sure Shot gather on this card. Done at 6: they return to the supply and hope rises 1.',
    uses: ['legolas'],
  },
  {
    id: 'free_theoden',
    name: 'Free Théoden’s Mind',
    text: 'Setup: 4 Rohirrim troops wait on this card. As an action, a character in Edoras spends 2 Friendship and 1 Resistance with another character present. Done: the waiting troops join the supply, up to 2 Rohirrim muster in Edoras, and hope rises 1.',
    reserve: { faction: 'riders', count: 4 },
  },
  {
    id: 'infiltrate_morgul',
    name: 'Infiltrate Minas Morgul',
    text: 'Setup: 1 extra shadow troop in Minas Morgul. It may be Captured for the usual 3 Valor or 3 Stealth. Done when it is a haven: the current player may take 2 Stealth tokens, and the top 2 shadow cards are removed from the game.',
    setupShadow: { minas_morgul: 1 },
    uncertain: 'deck-surgery choice is automated (both cards removed)',
  },
  {
    id: 'ride_eored',
    name: 'Ride with the Éored',
    text: 'When Éomer’s Attack with Rohirrim present fells shadow troops, one may be pinned to this card’s spot for his region (Rohan and each adjacent region, 1 each). Done at 4 pinned: they return to the supply and hope rises 1.',
    uses: ['eomer'],
  },
  {
    id: 'confront_balrog',
    name: 'Confront the Balrog',
    text: 'Gandalf spends an action in Moria to face the terror, rolling 3 battle dice: an overrun costs 1 hope, an exchange 2, a Nazgûl 3; a lone foe is harmless. He may spend Resistance to ignore dice and Valor to prevent hope losses. Done: Gandalf falls from the board — when the next Skies Darken card is drawn he returns to Lórien as Gandalf the White (hope rises 2), and thereafter 1 Valor lets him set any dice of a roll to the results the players want.',
    uses: ['gandalf'],
  },
  {
    id: 'rangers_eriador',
    name: 'Rangers Secure Eriador',
    text: 'Done when Eriador holds no shadow troops or strongholds and every Eriador location has a friendly troop: hope rises 1. (The reward repositioning is not automated yet.)',
  },
  {
    id: 'dwarven_lands',
    name: 'Lift Shadow from Dwarven Lands',
    text: 'Setup: 1 shadow troop in Ered Luin. Done when Ered Luin holds no shadow troops but at least 4 Dwarven troops, and Dale has no shadow troops or strongholds: the current player may take 2 Valor tokens and hope rises 1.',
    uses: ['gimli'],
    setupShadow: { ered_luin: 1 },
  },
  {
    id: 'shieldmaiden',
    name: '“Shieldmaiden No Longer”',
    text: 'While this is in play, Éowyn at a rolled battle may spend 2 Valor to turn one die to the Nazgûl face (her blade then fells a Nazgûl in the region). Done when she has destroyed at least 2 Nazgûl and Rohan holds no shadow troops or strongholds: hope rises 1.',
    uses: ['eowyn'],
  },
  {
    id: 'frecas_heirs',
    name: 'Deal with Freca’s Heirs',
    text: 'Dunland may be Captured (though it is no stronghold) for the usual 3 Valor or 3 Friendship. Done when Dunland is a haven with at least 2 Rohirrim troops: 1 more Rohirrim may muster there. If shadow troops later overrun Dunland, lose 3 hope and the haven is gone.',
  },
  {
    id: 'lay_bare_pits',
    name: 'Lay Bare the Pits',
    text: 'Setup: 1 extra shadow troop in Dol Guldur. Galadriel may Capture it for the usual 3 Valor or 2 Resistance + 1 Valor. Done when Dol Guldur is a haven with at least 3 Elven troops: if Galadriel stands there, hope rises 1 more (beyond the Capture’s 2).',
    uses: ['galadriel'],
    setupShadow: { dol_guldur: 1 },
  },
  {
    id: 'secure_anduin',
    name: 'Secure the Crossing of the Anduin',
    text: 'Setup: 1 shadow troop in Osgiliath. Faramir may Capture Osgiliath (though it is no stronghold) for the usual 3 Valor — or 2 Resistance + 1 Stealth. Done when Osgiliath is a haven: 1 Gondor troop may muster there. If shadow troops later overrun it, lose 3 hope and the haven is gone.',
    uses: ['faramir'],
    setupShadow: { osgiliath: 1 },
  },
];

export const OBJECTIVE_MAP: Record<string, ObjectiveDef> = Object.fromEntries(
  OBJECTIVES.map((o) => [o.id, o]),
);

/**
 * Alternative Capture costs granted by objective cards (instead of the
 * usual 3 Valor). Owner-confirmed entries only; the rest await their cards'
 * fine print.
 */
export const ALT_CAPTURE: {
  objective: string;
  location: LocationId;
  character?: CharacterId;
  cost: SymbolKind[];
}[] = [
  { objective: 'secure_anduin', location: 'osgiliath', character: 'faramir', cost: ['resistance', 'resistance', 'stealth'] },
  { objective: 'infiltrate_morgul', location: 'minas_morgul', cost: ['stealth', 'stealth', 'stealth'] },
  { objective: 'frecas_heirs', location: 'dunland', cost: ['friendship', 'friendship', 'friendship'] },
  { objective: 'lay_bare_pits', location: 'dol_guldur', character: 'galadriel', cost: ['resistance', 'resistance', 'valor'] },
];

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
