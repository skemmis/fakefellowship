export type LocationId = string;
export type RegionId = string;
export type CharacterId = string;
export type PlayerId = string;

export type Faction = 'vale' | 'riders' | 'sylvan' | 'deepholm';
export type SymbolKind = 'friendship' | 'valor' | 'stealth' | 'resistance';

export type Difficulty = 'introductory' | 'standard' | 'heroic' | 'epic' | 'legendary';

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export interface RegionDef {
  id: RegionId;
  name: string;
  adjacent: RegionId[];
  /** Label position for rendering. */
  x: number;
  y: number;
}

export interface LocationDef {
  id: LocationId;
  name: string;
  region: RegionId;
  x: number;
  y: number;
  /** Printed haven. */
  haven?: boolean;
  /** Red location: shadow troops spawn here via shadow cards. */
  shadowLoc?: boolean;
  /** Printed shadow stronghold (capturable). */
  stronghold?: boolean;
  /** Capturing this stronghold permanently stops spawns here. */
  stopsSpawnWhenCaptured?: boolean;
  /** Muster location for a faction. */
  muster?: Faction;
}

export interface PathDef {
  a: LocationId;
  b: LocationId;
  /** Symbols the traveling character must spend (special paths). */
  cost?: SymbolKind[];
}

/** Ordered from the shadow location to the haven it menaces. */
export interface BattleLineDef {
  id: string;
  name: string;
  path: LocationId[];
}

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

export interface CharacterDef {
  id: CharacterId;
  name: string;
  title: string;
  start: LocationId;
  /** True for the shardbearer pair (the analog of the ring-bearer unit). */
  bearer?: boolean;
  abilityText: string;
  /** True if reconstructed rather than transcribed from the source game. */
  abilityReconstructed: boolean;
  color: string;
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export interface RegionCard {
  id: string;
  kind: 'region';
  region: RegionId;
  symbol: SymbolKind;
  /** Flavor number; lowest in an opening hand takes the first turn. */
  number: number;
}

export interface EventCard {
  id: string;
  kind: 'event';
  event: string; // key into EVENTS
}

export interface DarkenCard {
  id: string;
  kind: 'darken';
  location: LocationId; // step 3 target
}

export type PlayerCard = RegionCard | EventCard | DarkenCard;

export type ShadowOrder = 'eye' | 'hunt2' | 'deploy3';

export interface ShadowCard {
  id: string;
  /** Which half resolves is decided by the back of the next card on the deck. */
  back: 'flag' | 'banner';
  special?: 'war_drums' | 'traitors_engine';
  /** Advance half: battle line to advance. */
  line?: string;
  /** Reinforce half: location + special order. */
  reinforce?: LocationId;
  order?: ShadowOrder;
}

// ---------------------------------------------------------------------------
// Objectives
// ---------------------------------------------------------------------------

export interface ObjectiveState {
  id: string;
  complete: boolean;
}

// ---------------------------------------------------------------------------
// Dice
// ---------------------------------------------------------------------------

export type SearchFace = 'slip' | 'weary' | 'exposed' | 'recall';
export type BattleFace = 'rout' | 'exchange' | 'overrun' | 'wraith';

// ---------------------------------------------------------------------------
// Pending interactive resolutions (dice mitigation, forced discards)
// ---------------------------------------------------------------------------

export type SearchContext = 'travel' | 'order' | 'ring' | 'final';

export interface PendingSearch {
  type: 'search';
  context: SearchContext;
  location: LocationId; // where the bearer is (or is arriving)
  dice: SearchFace[];
  /** Dice neutralized by Sam's steadfast aid (friendship spent). */
  ignored: number[];
  /** Aragorn's free ranger reroll, once per search. */
  freeRerollUsed?: boolean;
}

export interface PendingBattle {
  type: 'battle';
  location: LocationId;
  source: 'attack' | 'shadow';
  dice: BattleFace[];
  /** Shadow troops removed so far via Show Valor. */
  valorKills: number;
  /** Galadriel's free ring-blessed reroll, once per battle. */
  freeRerollUsed?: boolean;
}

export interface PendingDiscard {
  type: 'discard';
  player: PlayerId;
}

export type Pending = PendingSearch | PendingBattle | PendingDiscard;

// ---------------------------------------------------------------------------
// Automatic step queue (shadow phase, darken steps, queued battles)
// ---------------------------------------------------------------------------

export type QueueItem =
  | { step: 'drawPlayerCards'; count: number }
  | { step: 'shadowDraw'; remaining: number }
  | { step: 'battle'; location: LocationId; source: 'attack' | 'shadow'; dice?: number }
  | { step: 'search'; context: SearchContext; location: LocationId }
  | { step: 'endTurn' }
  | { step: 'winCheck' };

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

export interface PlayerState {
  id: PlayerId;
  name: string;
  characters: CharacterId[];
  hand: PlayerCard[];
  tokens: Record<SymbolKind, number>;
}

export interface TurnState {
  playerIdx: number;
  /** Actions used per character this turn. */
  actionsUsed: Record<CharacterId, number>;
  /** Order in which characters have acted (max 2; no going back). */
  actedOrder: CharacterId[];
  /** Once-per-turn ability uses, keyed by character or character_ability. */
  abilityUsed: Record<string, boolean>;
  /** Faramir led troops here this turn: one free Attack awaits. */
  freeAttack?: { character: CharacterId; location: LocationId };
}

export interface GameState {
  version: 2;
  rngState: number;
  phase: 'playing' | 'won' | 'lost';
  lossReason?: string;
  difficulty: Difficulty;
  players: PlayerState[];
  /** Locations of in-play characters. */
  characters: Record<CharacterId, { location: LocationId }>;
  /** Wraith count per region (9 total in the box). */
  wraiths: Record<RegionId, number>;
  /** The Gaze: which region the enemy's attention is fixed on. */
  eye: RegionId;
  shadow: Record<LocationId, number>;
  friendly: Record<LocationId, Partial<Record<Faction, number>>>;
  supply: {
    shadow: number;
    factions: Record<Faction, number>;
    tokens: Record<SymbolKind, number>;
  };
  /**
   * Current status of convertible sites. Printed havens/strongholds start
   * here; Capture and haven-loss flip them.
   */
  siteStatus: Record<LocationId, 'haven' | 'stronghold'>;
  /** Captured strongholds that no longer receive card-driven spawns. */
  spawnStopped: Record<LocationId, boolean>;
  hope: number;
  threatIdx: number;
  playerDeck: PlayerCard[];
  playerDiscard: PlayerCard[];
  /** Darken cards leave the game entirely after resolving. */
  removedCards: PlayerCard[];
  /** Event cards left out at setup (Galadriel can call on them). */
  unusedEvents: PlayerCard[];
  shadowDeck: ShadowCard[];
  shadowDiscard: ShadowCard[];
  objectives: ObjectiveState[];
  turn: TurnState;
  pending: Pending | null;
  queue: QueueItem[];
  turnNumber: number;
  /**
   * Solo variant: one player runs Frodo & Sam plus four characters. The solo
   * token rotates through `order`; the token character takes up to 4 actions
   * and Frodo & Sam take 1 bonus action each turn.
   */
  solo?: { order: CharacterId[]; idx: number };
}

// ---------------------------------------------------------------------------
// Player intents
// ---------------------------------------------------------------------------

/** How the bearer's arrival is covered when traveling. */
export type BearerCover = 'stealth' | 'search' | 'ring';

export type Action =
  | {
      type: 'travel';
      character: CharacterId;
      to: LocationId;
      /** Friendly troops to bring along. */
      troops?: Partial<Record<Faction, number>>;
      /** Other characters to bring along. */
      companions?: CharacterId[];
      /** Required whenever the bearer moves (himself or brought along). */
      cover?: BearerCover;
    }
  | { type: 'fellowship'; character: CharacterId; give?: string; takeFrom?: PlayerId; take?: string }
  | { type: 'prepare'; character: CharacterId; card: string }
  | { type: 'muster'; character: CharacterId }
  | { type: 'attack'; character: CharacterId; dice: number }
  | { type: 'capture'; character: CharacterId }
  | { type: 'destroyEmber' }
  | {
      type: 'ability';
      character: CharacterId;
      /** Target location (Éomer's ride, Legolas's shot, ...). */
      to?: LocationId;
      /** Selects between a character's multiple abilities. */
      mode?: 'nazgul' | 'peek' | 'song' | 'distract' | 'summon';
      /** Card id target (Faramir/Gollum discard retrieval). */
      card?: string;
    }
  | { type: 'playEvent'; card: string; location?: LocationId; character?: CharacterId; region?: RegionId; symbol?: SymbolKind }
  | { type: 'endTurn' }
  // Pending-resolution actions:
  | { type: 'reroll'; die: number; free?: boolean } // 1 resistance (or valor with Gandalf present); free uses a character's once-per-roll reroll
  | { type: 'ignoreDie'; die: number } // Sam's aid: 1 friendship neutralizes a harmful search die
  | { type: 'showValor' } // battle only: spend 1 valor, remove 1 shadow troop
  | { type: 'confirm' } // apply the pending roll and continue
  | { type: 'discard'; card: string }; // resolve a pending hand-limit discard

export interface GameEvent {
  text: string;
  kind:
    | 'action'
    | 'card'
    | 'shadow'
    | 'search'
    | 'battle'
    | 'haven'
    | 'objective'
    | 'turn'
    | 'win'
    | 'loss';
}

export interface ActionResult {
  state: GameState;
  events: GameEvent[];
}
