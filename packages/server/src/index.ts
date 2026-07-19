/**
 * Game server: HTTP static hosting (production client build) plus a
 * WebSocket endpoint. The server is authoritative — clients send intents,
 * the engine validates and applies them, and the resulting state + events
 * are broadcast to the whole room.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  applyAction,
  createGame,
  RuleError,
  type Action,
  type ClientMessage,
  type Difficulty,
  type GameEvent,
  type GameState,
  type GameSummary,
  type RoomInfo,
  type ServerMessage,
} from '@emberfall/engine';
import { randomBytes } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 8080);
const DIFFICULTIES: Difficulty[] = ['introductory', 'standard', 'heroic', 'epic', 'legendary'];

interface RoomPlayer {
  id: string;
  token: string;
  /** Durable browser identity, so a player resumes their seat across reloads. */
  clientId: string | null;
  name: string;
  ws: WebSocket | null;
}

interface Room {
  code: string;
  players: RoomPlayer[];
  hostId: string;
  difficulty: Difficulty;
  state: GameState | null;
  /** Full event history so reconnecting clients can rebuild the log. */
  eventLog: GameEvent[];
  /** State captured at the start of the active player's turn (for Reset Turn). */
  turnStartState: GameState | null;
  /** eventLog length at the start of the active player's turn. */
  turnStartLogLen: number;
  createdAt: number;
  /** ms of the last meaningful activity, for recency sorting. */
  lastActivity: number;
}

const rooms = new Map<string, Room>();

function roomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = randomBytes(4);
  for (let i = 0; i < 4; i++) code += alphabet[bytes[i] % alphabet.length];
  return rooms.has(code) ? roomCode() : code;
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(room: Room, msg: ServerMessage): void {
  for (const p of room.players) if (p.ws) send(p.ws, msg);
}

function roomInfo(room: Room): RoomInfo {
  return {
    code: room.code,
    started: room.state !== null,
    difficulty: room.difficulty,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.ws !== null,
      isHost: p.id === room.hostId,
    })),
  };
}

function pushRoom(room: Room): void {
  broadcast(room, { type: 'room', info: roomInfo(room) });
}

/** Summaries of every active game a given client belongs to, newest first. */
function gamesForClient(clientId: string): GameSummary[] {
  const out: GameSummary[] = [];
  for (const room of rooms.values()) {
    if (!room.players.some((p) => p.clientId === clientId)) continue;
    const st = room.state;
    const activeId = st && st.phase === 'playing' ? st.players[st.turn.playerIdx]?.id : null;
    const activePlayer = activeId ? room.players.find((p) => p.id === activeId) : null;
    out.push({
      code: room.code,
      started: st !== null,
      phase: st ? st.phase : 'lobby',
      difficulty: room.difficulty,
      players: room.players.map((p) => p.name),
      playerCount: room.players.length,
      yourTurn: !!activePlayer && activePlayer.clientId === clientId,
      activeName: activePlayer ? activePlayer.name : st ? st.players[st.turn.playerIdx]?.name ?? null : null,
      lastActivity: room.lastActivity,
    });
  }
  return out.sort((a, b) => b.lastActivity - a.lastActivity);
}

function sendGames(ws: WebSocket, clientId: string | null): void {
  if (clientId) send(ws, { type: 'games', games: gamesForClient(clientId) });
}

interface ConnCtx {
  roomCode: string | null;
  playerId: string | null;
  clientId: string | null;
}

function requireRoom(ws: WebSocket, ctx: ConnCtx): { room: Room | null; player: RoomPlayer | null } {
  const room = ctx.roomCode ? rooms.get(ctx.roomCode) ?? null : null;
  const player = room?.players.find((p) => p.id === ctx.playerId) ?? null;
  if (!room || !player) {
    send(ws, { type: 'error', message: 'You are not in a game room.' });
    return { room: null, player: null };
  }
  return { room, player };
}

function joinRoom(
  ws: WebSocket,
  ctx: ConnCtx,
  room: Room,
  name: string,
  opts: { clientId?: string; playerToken?: string },
): void {
  // Resume a seat by durable client identity first, then by legacy token.
  const existing =
    (opts.clientId && room.players.find((p) => p.clientId === opts.clientId)) ||
    (opts.playerToken && room.players.find((p) => p.token === opts.playerToken)) ||
    undefined;
  if (existing) {
    if (existing.ws && existing.ws !== ws) existing.ws.close();
    existing.ws = ws;
    if (opts.clientId) existing.clientId = opts.clientId;
    if (name.trim()) existing.name = name.slice(0, 24);
    ctx.roomCode = room.code;
    ctx.playerId = existing.id;
    if (opts.clientId) ctx.clientId = opts.clientId;
    room.lastActivity = Date.now();
    send(ws, { type: 'joined', room: room.code, playerId: existing.id, playerToken: existing.token });
    pushRoom(room);
    if (room.state) send(ws, { type: 'game', state: room.state, events: room.eventLog });
    sendGames(ws, ctx.clientId);
    return;
  }
  if (room.state) return send(ws, { type: 'error', message: 'That game already started.' });
  if (room.players.length >= 5) return send(ws, { type: 'error', message: 'That room is full (5 players max).' });
  const player: RoomPlayer = {
    id: `p${room.players.length + 1}-${randomBytes(3).toString('hex')}`,
    token: randomBytes(16).toString('hex'),
    clientId: opts.clientId ?? null,
    name: (name || 'Traveler').slice(0, 24),
    ws,
  };
  room.players.push(player);
  ctx.roomCode = room.code;
  ctx.playerId = player.id;
  if (opts.clientId) ctx.clientId = opts.clientId;
  room.lastActivity = Date.now();
  send(ws, { type: 'joined', room: room.code, playerId: player.id, playerToken: player.token });
  pushRoom(room);
  sendGames(ws, ctx.clientId);
}

function handleMessage(ws: WebSocket, ctx: ConnCtx, msg: ClientMessage): void {
  switch (msg.type) {
    case 'create': {
      const room: Room = {
        code: roomCode(),
        players: [],
        hostId: '',
        difficulty: 'introductory',
        state: null,
        eventLog: [],
        turnStartState: null,
        turnStartLogLen: 0,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };
      rooms.set(room.code, room);
      joinRoom(ws, ctx, room, msg.name, { clientId: msg.clientId, playerToken: msg.playerToken });
      room.hostId = room.players[0].id;
      pushRoom(room);
      break;
    }

    case 'join': {
      const room = rooms.get(msg.room.toUpperCase().trim());
      if (!room) return send(ws, { type: 'error', message: 'No such game room.' });
      joinRoom(ws, ctx, room, msg.name, { clientId: msg.clientId, playerToken: msg.playerToken });
      break;
    }

    case 'listGames': {
      ctx.clientId = msg.clientId;
      sendGames(ws, msg.clientId);
      break;
    }

    case 'leaveGame': {
      const room = rooms.get(msg.room.toUpperCase().trim());
      if (room && ctx.clientId) {
        const idx = room.players.findIndex((p) => p.clientId === ctx.clientId);
        if (idx >= 0) {
          const [gone] = room.players.splice(idx, 1);
          if (gone.ws && gone.ws !== ws) gone.ws.close();
          if (room.players.length === 0) {
            rooms.delete(room.code);
          } else {
            if (room.hostId === gone.id) room.hostId = room.players[0].id;
            room.lastActivity = Date.now();
            pushRoom(room);
          }
        }
      }
      // If they abandoned the room this connection was viewing, detach it.
      if (ctx.roomCode === msg.room.toUpperCase().trim()) {
        ctx.roomCode = null;
        ctx.playerId = null;
      }
      sendGames(ws, ctx.clientId);
      break;
    }

    case 'setDifficulty': {
      const { room, player } = requireRoom(ws, ctx);
      if (!room || !player) return;
      if (player.id !== room.hostId) return send(ws, { type: 'error', message: 'Only the host sets difficulty.' });
      if (room.state) return send(ws, { type: 'error', message: 'The game already started.' });
      if (!DIFFICULTIES.includes(msg.difficulty)) return send(ws, { type: 'error', message: 'Unknown difficulty.' });
      room.difficulty = msg.difficulty;
      pushRoom(room);
      break;
    }

    case 'start': {
      const { room, player } = requireRoom(ws, ctx);
      if (!room || !player) return;
      if (player.id !== room.hostId) return send(ws, { type: 'error', message: 'Only the host can start the game.' });
      if (room.state) return send(ws, { type: 'error', message: 'Already started.' });
      if (room.players.length < 1 || room.players.length > 5) {
        return send(ws, { type: 'error', message: 'This digital edition supports 1-5 players.' });
      }
      try {
        room.state = createGame(
          room.players.map((p) => ({ id: p.id, name: p.name })),
          randomBytes(4).readUInt32LE(0),
          room.difficulty,
        );
      } catch (err) {
        return send(ws, { type: 'error', message: (err as Error).message });
      }
      const opening: GameEvent[] = [
        {
          kind: 'turn',
          text: `The Fellowship sets out (${room.difficulty}). ${room.state.players[room.state.turn.playerIdx].name} takes the first turn.`,
        },
      ];
      room.eventLog.push(...opening);
      room.turnStartState = room.state;
      room.turnStartLogLen = room.eventLog.length;
      pushRoom(room);
      broadcast(room, { type: 'game', state: room.state, events: opening });
      break;
    }

    case 'action': {
      const { room, player } = requireRoom(ws, ctx);
      if (!room || !player) return;
      if (!room.state) return send(ws, { type: 'error', message: 'The game has not started.' });
      try {
        const prevTurn = room.state.turnNumber;
        const result = applyAction(room.state, player.id, msg.action as Action);
        room.state = result.state;
        room.eventLog.push(...result.events);
        room.lastActivity = Date.now();
        // A new turn has begun: fix this as the point Reset Turn rolls back to.
        // (applyAction never mutates its input, so the returned state is a safe
        // immutable snapshot to hold by reference.)
        if (room.state.turnNumber !== prevTurn) {
          room.turnStartState = room.state;
          room.turnStartLogLen = room.eventLog.length;
        }
        broadcast(room, { type: 'game', state: room.state, events: result.events });
      } catch (err) {
        if (err instanceof RuleError) {
          send(ws, { type: 'error', message: err.message });
        } else {
          console.error('engine error', err);
          send(ws, { type: 'error', message: 'Internal engine error.' });
        }
      }
      break;
    }

    case 'resetTurn': {
      const { room, player } = requireRoom(ws, ctx);
      if (!room || !player) return;
      if (!room.state || !room.turnStartState) {
        return send(ws, { type: 'error', message: 'Nothing to reset yet.' });
      }
      if (room.state.phase !== 'playing') {
        return send(ws, { type: 'error', message: 'The turn can no longer be reset.' });
      }
      const activeId = room.state.players[room.state.turn.playerIdx].id;
      if (player.id !== activeId) {
        return send(ws, { type: 'error', message: 'Only the active player may reset the turn.' });
      }
      // Roll back to the snapshot taken when this turn began.
      room.state = room.turnStartState;
      room.eventLog.length = room.turnStartLogLen;
      const notice: GameEvent = { kind: 'turn', text: `— ${player.name} resets the turn —` };
      room.eventLog.push(notice);
      broadcast(room, { type: 'game', state: room.state, events: room.eventLog, replace: true });
      break;
    }

    case 'chat': {
      const { room, player } = requireRoom(ws, ctx);
      if (!room || !player) return;
      const text = String(msg.text ?? '').slice(0, 500);
      if (text.trim()) broadcast(room, { type: 'chat', from: player.name, text });
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// HTTP: serve the built client (packages/client/dist) if present.
// ---------------------------------------------------------------------------

const clientDist = fileURLToPath(new URL('../../client/dist', import.meta.url));
const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

const httpServer = createServer(async (req, res) => {
  try {
    const url = (req.url ?? '/').split('?')[0];
    let path = normalize(join(clientDist, url === '/' ? 'index.html' : url));
    if (!path.startsWith(clientDist)) return void res.writeHead(403).end();
    try {
      const st = await stat(path);
      if (st.isDirectory()) path = join(path, 'index.html');
    } catch {
      path = join(clientDist, 'index.html'); // SPA fallback
    }
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found — build the client with: npm run build -w @emberfall/client');
  }
});

const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (ws) => {
  const ctx: ConnCtx = { roomCode: null, playerId: null, clientId: null };
  ws.on('message', (data) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(String(data)) as ClientMessage;
    } catch {
      return send(ws, { type: 'error', message: 'Bad message.' });
    }
    try {
      handleMessage(ws, ctx, msg);
    } catch (err) {
      console.error('server error', err);
      send(ws, { type: 'error', message: 'Internal server error.' });
    }
  });
  ws.on('close', () => {
    const room = ctx.roomCode ? rooms.get(ctx.roomCode) : undefined;
    const player = room?.players.find((p) => p.id === ctx.playerId);
    if (room && player && player.ws === ws) {
      player.ws = null;
      pushRoom(room);
    }
  });
});

setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [code, room] of rooms) {
    if (room.players.every((p) => p.ws === null) && room.createdAt < cutoff) rooms.delete(code);
  }
}, 60 * 60 * 1000).unref();

httpServer.listen(PORT, () => {
  console.log(`Fellowship server listening on http://localhost:${PORT} (ws at /ws)`);
});
