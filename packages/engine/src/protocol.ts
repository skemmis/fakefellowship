/**
 * Client <-> server wire protocol. Lives in the engine package so both sides
 * share one set of types.
 */
import type { Action, GameEvent, GameState, HeroId } from './types.js';

export interface LobbyPlayer {
  id: string;
  name: string;
  heroes: HeroId[];
  connected: boolean;
  isHost: boolean;
}

export interface RoomInfo {
  code: string;
  players: LobbyPlayer[];
  started: boolean;
}

export type ClientMessage =
  | { type: 'create'; name: string; playerToken?: string }
  | { type: 'join'; room: string; name: string; playerToken?: string }
  | { type: 'pickHeroes'; heroes: HeroId[] }
  | { type: 'start' }
  | { type: 'action'; action: Action }
  | { type: 'chat'; text: string };

export type ServerMessage =
  | { type: 'joined'; room: string; playerId: string; playerToken: string }
  | { type: 'room'; info: RoomInfo }
  | { type: 'game'; state: GameState; events: GameEvent[] }
  | { type: 'chat'; from: string; text: string }
  | { type: 'error'; message: string };
