export type LocationId = string;
export type HeroId = string;
export type PlayerId = string;

export type Faction = 'vale' | 'riders' | 'sylvan' | 'deepholm';

export interface LocationDef {
  id: LocationId;
  name: string;
  region: string;
  adjacent: LocationId[];
  /** Map coordinates for rendering (0-1000 x 0-700). */
  x: number;
  y: number;
  /** If set, this location is a sanctuary of the given faction. */
  sanctuary?: Faction;
  /** Enemy stronghold: spawns are heavier here. */
  stronghold?: boolean;
}

export type HeroAbility =
  | 'battle_die'  // rolls an extra battle die
  | 'swift'       // Move action covers up to 2 connections
  | 'kindle'      // once per turn, free: +1 hope while at a standing sanctuary
  | 'muster'      // Muster places 1 extra troop
  | 'guide'       // Guide moves the shardbearer up to 2 connections
  | 'bulwark'     // skull results in battle don't cost allied troops
  | 'insight'     // owner draws 1 extra card at end of turn
  | 'longshot';   // may Battle an adjacent location

export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  ability: HeroAbility;
  abilityText: string;
  color: string;
}

export type PlayerCardKind =
  | 'swift_march'   // move one of your heroes up to 2 connections
  | 'rally_banner'  // muster 2 troops at any standing sanctuary
  | 'ambush'        // remove 2 shadow troops at or adjacent to one of your heroes
  | 'lantern_oil'   // +1 hope
  | 'fernpath'      // move the shardbearer 1 connection, or hide them
  | 'farsight'      // reveal the top 3 shadow cards (public knowledge)
  | 'hearthsong'    // +2 hope
  | 'ashen_surge';  // escalation: threat rises, heavy spawn, shadow discard reshuffled

export interface PlayerCard {
  id: string;
  kind: PlayerCardKind;
}

export type ShadowCardKind = 'spawn' | 'hunt';

export interface ShadowCard {
  id: string;
  kind: ShadowCardKind;
  /** For spawn cards: where the shadow rises. */
  location?: LocationId;
}

export type SanctuaryStatus = 'standing' | 'besieged' | 'fallen';

export interface Wraith {
  id: number;
  location: LocationId;
}

export interface HeroState {
  id: HeroId;
  location: LocationId;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  heroes: [HeroId, HeroId];
  hand: PlayerCard[];
}

export interface TurnState {
  playerIdx: number;
  /** Actions used this turn, per hero. One hero may use up to 4, the other up to 1. */
  actionsUsed: Record<HeroId, number>;
  /** Kindle (Maelis) is once per turn. */
  kindleUsed: boolean;
  stage: 'actions' | 'over';
}

export type ObjectiveId = 'garrisons' | 'purge' | 'beacon';

export interface ObjectiveState {
  id: ObjectiveId;
  name: string;
  text: string;
  complete: boolean;
}

export interface GameState {
  version: 1;
  rngState: number;
  phase: 'playing' | 'won' | 'lost';
  /** Set when phase is 'lost'. */
  lossReason?: string;
  players: PlayerState[];
  heroes: Record<HeroId, HeroState>;
  shardbearer: {
    location: LocationId;
    hidden: boolean;
    corruption: number; // 0..CORRUPTION_MAX; max = loss
  };
  wraiths: Wraith[];
  /** Shadow troops per location. */
  shadow: Record<LocationId, number>;
  /** Allied troops per location, per faction. */
  allied: Record<LocationId, Partial<Record<Faction, number>>>;
  supply: {
    shadow: number;
    factions: Record<Faction, number>;
  };
  sanctuaries: Record<LocationId, SanctuaryStatus>;
  hope: number; // 0..HOPE_MAX; 0 = loss
  /** Index into THREAT_TRACK; advanced by ashen_surge cards. */
  threatIdx: number;
  playerDeck: PlayerCard[];
  playerDiscard: PlayerCard[];
  shadowDeck: ShadowCard[];
  shadowDiscard: ShadowCard[];
  /** Set by farsight: the next N shadow cards, publicly known. */
  foreseen: ShadowCard[];
  objectives: ObjectiveState[];
  /** Battles won counter for the 'purge' objective. */
  shadowSlain: number;
  turn: TurnState;
  turnNumber: number;
}

// ---------------------------------------------------------------------------
// Actions (client intents). All randomness happens inside the engine.
// ---------------------------------------------------------------------------

export type Action =
  | { type: 'move'; hero: HeroId; path: LocationId[] }
  | { type: 'muster'; hero: HeroId }
  | { type: 'battle'; hero: HeroId; location: LocationId }
  | { type: 'guide'; hero: HeroId; path: LocationId[] }
  | { type: 'hide'; hero: HeroId }
  | { type: 'kindle'; hero: HeroId }
  | { type: 'destroyEmber'; hero: HeroId }
  | {
      type: 'playCard';
      card: string; // card id in the acting player's hand
      // Optional targets depending on the card kind:
      hero?: HeroId;
      path?: LocationId[];
      location?: LocationId;
      hide?: boolean;
      cleanse?: boolean;
    }
  | { type: 'endTurn' };

// ---------------------------------------------------------------------------
// Events (facts that happened; drives the client log and animations).
// ---------------------------------------------------------------------------

export interface GameEvent {
  text: string;
  kind:
    | 'action'
    | 'card'
    | 'shadow'
    | 'hunt'
    | 'siege'
    | 'objective'
    | 'turn'
    | 'win'
    | 'loss';
}

export interface ActionResult {
  state: GameState;
  events: GameEvent[];
}
