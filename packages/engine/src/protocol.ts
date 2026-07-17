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

export type ClientMessage =
  | { type: 'create'; name: string; playerToken?: string }
  | { type: 'join'; room: string; name: string; playerToken?: string }
  | { type: 'setDifficulty'; difficulty: Difficulty }
  | { type: 'start' }
  | { type: 'action'; action: Action }
  | { type: 'chat'; text: string };

export type ServerMessage =
  | { type: 'joined'; room: string; playerId: string; playerToken: string }
  | { type: 'room'; info: RoomInfo }
  | { type: 'game'; state: GameState; events: GameEvent[] }
  | { type: 'chat'; from: string; text: string }
  | { type: 'error'; message: string };
