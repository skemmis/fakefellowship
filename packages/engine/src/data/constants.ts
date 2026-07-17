import type { PlayerCardKind } from '../types.js';

// Tunable game constants. Adjust here (and re-run the simulator) to balance.

export const HOPE_MAX = 8;
export const HOPE_START = 6;
export const CORRUPTION_MAX = 8;

export const SHADOW_SUPPLY = 40;
export const FACTION_SUPPLY = { vale: 10, riders: 8, sylvan: 9, deepholm: 8 } as const;

export const WRAITH_COUNT_MAX = 5;

/** Shadow cards drawn per shadow phase, indexed by threat level. */
export const THREAT_TRACK = [2, 2, 2, 3, 3, 4] as const;

export const HAND_LIMIT = 7;
export const CARDS_PER_TURN = 2;
export const ACTIONS_PRIMARY = 4;
export const ACTIONS_SECONDARY = 1;

/** Shadow troops at a sanctuary at/above this: besieged. */
export const SIEGE_THRESHOLD = 3;
/** A spawn at a besieged sanctuary already at/above this: it falls. */
export const FALL_THRESHOLD = 5;
/** Number of fallen sanctuaries that loses the game. */
export const FALLEN_LOSS = 2;

export const MUSTER_AMOUNT = 2;
export const BATTLE_DICE = 3;

/** Objective 'purge': total shadow troops slain in battles. */
export const PURGE_TARGET = 12;
/** Objective 'garrisons': allied troops needed at every standing sanctuary. */
export const GARRISON_TARGET = 3;
/** Objective 'beacon': hope level required. */
export const BEACON_TARGET = 7;
/** Objectives that must be complete before the Ember can be destroyed. */
export const OBJECTIVES_REQUIRED = 2;

/** Player deck composition (ashen_surge count sets game length/difficulty). */
export const PLAYER_DECK: Record<PlayerCardKind, number> = {
  swift_march: 6,
  rally_banner: 5,
  ambush: 5,
  lantern_oil: 4,
  fernpath: 5,
  farsight: 4,
  hearthsong: 3,
  ashen_surge: 4,
};

/**
 * Larger fellowships get a thicker deck: extra cards per player beyond 2,
 * so the game clock scales with the number of turns a round takes.
 */
export const PLAYER_DECK_EXTRA: Partial<Record<PlayerCardKind, number>> = {
  swift_march: 2,
  lantern_oil: 1,
  fernpath: 1,
};

export function playerDeckSize(playerCount: number): number {
  const base = Object.values(PLAYER_DECK).reduce((a, b) => a + b, 0);
  const extra = Object.values(PLAYER_DECK_EXTRA).reduce((a, b) => a + (b ?? 0), 0);
  return base + Math.max(0, playerCount - 2) * extra;
}

export const CARD_INFO: Record<PlayerCardKind, { name: string; text: string }> = {
  swift_march: {
    name: 'Swift March',
    text: 'Free: move one of your heroes up to 2 connections.',
  },
  rally_banner: {
    name: 'Rally Banner',
    text: 'Free: place 2 troops at any standing sanctuary (from its faction supply).',
  },
  ambush: {
    name: 'Ambush',
    text: 'Free: remove 2 shadow troops at or adjacent to one of your heroes.',
  },
  lantern_oil: {
    name: 'Lantern Oil',
    text: 'Free: raise hope by 1, OR cleanse 1 corruption from the shardbearer.',
  },
  fernpath: {
    name: 'Fernpath',
    text: 'Free: move the shardbearer 1 connection, or hide him.',
  },
  farsight: {
    name: 'Farsight',
    text: 'Free: reveal the next 3 shadow cards to all players.',
  },
  hearthsong: {
    name: 'Hearthsong',
    text: 'Free: raise hope by 2.',
  },
  ashen_surge: {
    name: 'Ashen Surge',
    text: 'Cannot be played. When drawn: threat rises, 3 shadow troops muster at the deepest peril, a new wraith rides out, and the shadow discard returns to the deck.',
  },
};
