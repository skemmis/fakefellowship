/**
 * Client <-> server wire protocol (shared types).
 */
import type { Action, Difficulty, GameEvent, GameState } from './types.js';

export interface LobbyPlayer {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
}

export interface RoomInfo {
  code: string;
  players: LobbyPlayer[];
  difficulty: Difficulty;
  started: boolean;
}

/** A summary of one active game a player belongs to, for the game switcher. */
export interface GameSummary {
  code: string;
  started: boolean;
  phase: 'lobby' | 'playing' | 'won' | 'lost';
  difficulty: Difficulty;
  players: string[];
  playerCount: number;
  /** True when it is this client's turn in that game. */
  yourTurn: boolean;
  /** Name of the player whose turn it is (null before the game starts). */
  activeName: string | null;
  /** ms timestamp of the last activity, for recency sorting. */
  lastActivity: number;
}

export type ClientMessage =
  | { type: 'create'; name: string; playerToken?: string; clientId?: string }
  | { type: 'join'; room: string; name: string; playerToken?: string; clientId?: string }
  | { type: 'setDifficulty'; difficulty: Difficulty }
  | { type: 'start' }
  | { type: 'action'; action: Action }
  | { type: 'resetTurn' }
  | { type: 'listGames'; clientId: string }
  | { type: 'leaveGame'; room: string }
  | { type: 'chat'; text: string };

export type ServerMessage =
  | { type: 'joined'; room: string; playerId: string; playerToken: string }
  | { type: 'room'; info: RoomInfo }
  | { type: 'game'; state: GameState; events: GameEvent[]; replace?: boolean }
  | { type: 'games'; games: GameSummary[] }
  | { type: 'chat'; from: string; text: string }
  | { type: 'error'; message: string };
