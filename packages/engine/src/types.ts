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

/**
 * An atomic connection between two locations: EITHER a white path (players
 * only, optional symbol cost) OR a battle line segment (colored, directed
 * arrow; chains of same-colored segments form full battle lines).
 */
export interface EdgeDef {
  a: LocationId;
  b: LocationId;
  kind: 'path' | 'line';
  /** Symbols a player spends to traverse (paths AND battle-line segments). */
  cost?: SymbolKind[];
  /** Line segments only: the route's printed color. */
  color?: string;
  /** Line segments only: arrow direction ('ab' = a→b, 'ba' = b→a). */
  dir?: 'ab' | 'ba';
}

/** Ordered from the shadow location to the haven it menaces. */
export interface BattleLineDef {
  id: string;
  name: string;
  path: LocationId[];
  /** The line's printed color on the board (for display/verification). */
  color?: string;
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
  /**
   * This card's printed back. Which half of a flipped card resolves is
   * decided by the back of the NEXT card on the deck: a red flag back means
   * ADVANCE (top half), the dark Eye-banner back means REINFORCE (bottom).
   */
  back: 'flag' | 'banner';
  special?: 'drums_of_war' | 'wheels_of_saruman';
  /** Advance half: the battle line, named by its endpoints on the card. */
  lineFrom?: LocationId;
  lineTo?: LocationId;
  /** Reinforce half: location (always the line's origin) + special order. */
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
  /** The character whose Attack action triggered this battle, if any. */
  attacker?: CharacterId;
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

/**
 * An objective-card ordeal (Confront the Balrog / Shelob's Lair): 3 battle
 * dice whose faces cost hope, mitigated by the hero spending symbols before
 * confirming.
 */
export interface PendingOrdeal {
  type: 'ordeal';
  objective: 'confront_balrog' | 'shelobs_lair';
  player: PlayerId;
  location: LocationId;
  dice: BattleFace[];
  /** Dice bought off (Balrog: 1 Resistance each; Shelob: 1 Valor each). */
  ignored: number[];
  /** Hope losses bought off (Balrog: 1 Valor each; Shelob: 1 Friendship). */
  prevented: number;
}

/** The Wheels of Saruman: the current player picks one of three woes. */
export interface PendingWheels {
  type: 'wheels';
  /** Set once an option is chosen and targets remain to pick. */
  mode?: 'oath' | 'doubt';
  /** Doubt: the player who must give up cards/tokens. */
  player?: PlayerId;
  /** Targets still to remove/discard. */
  remaining?: number;
}

export type Pending = PendingSearch | PendingBattle | PendingDiscard | PendingWheels | PendingOrdeal;

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
  /** Lembas: extra actions granted to one of the current player's characters. */
  lembas?: { character: CharacterId; remaining: number };
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
  /**
   * Per-objective counters and flags: troops pinned to cards, once-per-game
   * rides taken, Nazgûl felled, fallen characters awaiting return, etc.
   */
  objProgress: Record<string, number>;
  /** Friendly troops set aside on objective cards until they complete. */
  objReserves: Record<string, { faction: Faction; count: number }>;
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
  | {
      /** Objective-card action (spend an action + costs to work toward it). */
      type: 'objective';
      id: string;
      character: CharacterId;
      /** Blessing of the Elves: which of the two printed costs to pay. */
      variant?: 'valor' | 'stealth';
      /** Hobbits' pledge: the Friendship region card discarded. */
      card?: string;
    }
  | { type: 'prepare'; character: CharacterId; card: string }
  | { type: 'muster'; character: CharacterId }
  | { type: 'attack'; character: CharacterId; dice: number }
  | {
      type: 'capture';
      character: CharacterId;
      /** Pay an objective card's alternative cost instead of 3 Valor. */
      alt?: boolean;
    }
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
  | {
      type: 'playEvent';
      card: string;
      location?: LocationId;
      /** Second location (destination of a move, target of a battle, ...). */
      location2?: LocationId;
      character?: CharacterId;
      characters?: CharacterId[];
      region?: RegionId;
      symbol?: SymbolKind;
      /** Troop count for events that move or add troops. */
      count?: number;
      /** Die indices for Tom Bombadil's rerolls. */
      dice?: number[];
      /** Roll the optional battle offered by the event. */
      battle?: boolean;
      /** Multi-leg travel destinations, in order. */
      path?: LocationId[];
      /** Receiving player for token handoffs. */
      toPlayer?: PlayerId;
      /** Card id target (Elrond's Foresight pick, Council solo Prepare). */
      pick?: string;
    }
  | { type: 'endTurn' }
  // Pending-resolution actions:
  | { type: 'reroll'; die: number; free?: boolean } // 1 resistance (or valor with Gandalf present); free uses a character's once-per-roll reroll
  | { type: 'ignoreDie'; die: number } // Sam's aid: 1 friendship neutralizes a harmful search die
  | { type: 'showValor' } // battle only: spend 1 valor, remove 1 shadow troop
  | { type: 'eowynStrike'; die: number } // Shieldmaiden card: 2 valor turns a battle die to the Nazgûl face
  | { type: 'preventHope' } // ordeal only: buy off 1 hope of the pending loss
  | { type: 'gandalfWhite'; faces: string[] } // Gandalf the White: 1 valor sets the roll's dice
  | { type: 'confirm' } // apply the pending roll and continue
  | { type: 'discard'; card: string } // resolve a pending hand-limit discard
  | {
      /** Resolve The Wheels of Saruman, one step at a time. */
      type: 'wheels';
      pick?: 'oath' | 'doubt' | 'despair';
      /** Oath: a location holding a friendly troop to remove (with faction). */
      location?: LocationId;
      faction?: Faction;
      /** Doubt: which player pays, then their card/token picks. */
      toPlayer?: PlayerId;
      card?: string;
      symbol?: SymbolKind;
    };

/** Structured visual payload so the client can animate what happened. */
export type EventFx =
  | {
      fx: 'move';
      piece: 'shadow' | 'friendly' | 'nazgul' | 'character';
      from: string; // LocationId, or RegionId for nazgul
      to: string;
      count?: number;
      character?: CharacterId;
    }
  | { fx: 'eye'; to: RegionId }
  | { fx: 'spawn'; location: LocationId; count: number }
  | {
      fx: 'shadowCard';
      half: 'advance' | 'reinforce' | 'special';
      lineName?: string;
      lineColor?: string;
      reinforce?: LocationId;
      order?: ShadowOrder;
      specialName?: string;
    }
  | { fx: 'darken'; location: LocationId };

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
  /** Optional animation payload. */
  fx?: EventFx;
}

export interface ActionResult {
  state: GameState;
  events: GameEvent[];
}
