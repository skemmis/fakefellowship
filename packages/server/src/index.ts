/**
 * Emberfall game server: HTTP static hosting (production client build) plus
 * a WebSocket endpoint. The server is authoritative — clients send intents,
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
  HEROES,
  RuleError,
  type Action,
  type ClientMessage,
  type GameEvent,
  type GameState,
  type HeroId,
  type RoomInfo,
  type ServerMessage,
} from '@emberfall/engine';
import { randomBytes } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 8080);

interface RoomPlayer {
  id: string;
  token: string;
  name: string;
  heroes: HeroId[];
  ws: WebSocket | null;
}

interface Room {
  code: string;
  players: RoomPlayer[];
  hostId: string;
  state: GameState | null;
  /** Full event history so reconnecting clients can rebuild the log. */
  eventLog: GameEvent[];
  createdAt: number;
}

const rooms = new Map<string, Room>();

function roomCode(): string {
  // Unambiguous alphabet (no 0/O, 1/I).
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
  for (const p of room.players) {
    if (p.ws) send(p.ws, msg);
  }
}

function roomInfo(room: Room): RoomInfo {
  return {
    code: room.code,
    started: room.state !== null,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      heroes: p.heroes,
      connected: p.ws !== null,
      isHost: p.id === room.hostId,
    })),
  };
}

function pushRoom(room: Room): void {
  broadcast(room, { type: 'room', info: roomInfo(room) });
}

/** Assign unpicked heroes so every player has exactly two. */
function finalizeHeroes(room: Room): boolean {
  const taken = new Set<HeroId>();
  for (const p of room.players) {
    p.heroes = p.heroes.filter((h) => !taken.has(h)).slice(0, 2);
    for (const h of p.heroes) taken.add(h);
  }
  const free = HEROES.map((h) => h.id).filter((h) => !taken.has(h));
  for (const p of room.players) {
    while (p.heroes.length < 2) {
      const next = free.shift();
      if (!next) return false;
      p.heroes.push(next);
    }
  }
  return true;
}

function handleMessage(ws: WebSocket, ctx: ConnCtx, msg: ClientMessage): void {
  switch (msg.type) {
    case 'create': {
      const room: Room = {
        code: roomCode(),
        players: [],
        hostId: '',
        state: null,
        eventLog: [],
        createdAt: Date.now(),
      };
      rooms.set(room.code, room);
      joinRoom(ws, ctx, room, msg.name, msg.playerToken);
      room.hostId = room.players[0].id;
      pushRoom(room);
      break;
    }

    case 'join': {
      const room = rooms.get(msg.room.toUpperCase().trim());
      if (!room) return send(ws, { type: 'error', message: 'No such game room.' });
      joinRoom(ws, ctx, room, msg.name, msg.playerToken);
      break;
    }

    case 'pickHeroes': {
      const { room, player } = requireRoom(ws, ctx);
      if (!room || !player) return;
      if (room.state) return send(ws, { type: 'error', message: 'The game already started.' });
      const valid = msg.heroes.filter((h) => HEROES.some((d) => d.id === h)).slice(0, 2);
      const takenByOthers = new Set(
        room.players.filter((p) => p.id !== player.id).flatMap((p) => p.heroes),
      );
      player.heroes = valid.filter((h) => !takenByOthers.has(h));
      pushRoom(room);
      break;
    }

    case 'start': {
      const { room, player } = requireRoom(ws, ctx);
      if (!room || !player) return;
      if (player.id !== room.hostId) {
        return send(ws, { type: 'error', message: 'Only the host can start the game.' });
      }
      if (room.state) return send(ws, { type: 'error', message: 'Already started.' });
      if (room.players.length < 1 || room.players.length > 4) {
        return send(ws, { type: 'error', message: 'Emberfall is for 1-4 players.' });
      }
      if (!finalizeHeroes(room)) {
        return send(ws, { type: 'error', message: 'Not enough heroes for that many players.' });
      }
      const seed = randomBytes(4).readUInt32LE(0);
      room.state = createGame(
        room.players.map((p) => ({
          id: p.id,
          name: p.name,
          heroes: p.heroes as [HeroId, HeroId],
        })),
        seed,
      );
      const opening: GameEvent[] = [
        { kind: 'turn', text: `The fellowship sets out from Hearthden. ${room.players[0].name} goes first.` },
      ];
      room.eventLog.push(...opening);
      pushRoom(room);
      broadcast(room, { type: 'game', state: room.state, events: opening });
      break;
    }

    case 'action': {
      const { room, player } = requireRoom(ws, ctx);
      if (!room || !player) return;
      if (!room.state) return send(ws, { type: 'error', message: 'The game has not started.' });
      try {
        const result = applyAction(room.state, player.id, msg.action as Action);
        room.state = result.state;
        room.eventLog.push(...result.events);
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

    case 'chat': {
      const { room, player } = requireRoom(ws, ctx);
      if (!room || !player) return;
      const text = String(msg.text ?? '').slice(0, 500);
      if (text.trim()) broadcast(room, { type: 'chat', from: player.name, text });
      break;
    }
  }
}

interface ConnCtx {
  roomCode: string | null;
  playerId: string | null;
}

function requireRoom(
  ws: WebSocket,
  ctx: ConnCtx,
): { room: Room | null; player: RoomPlayer | null } {
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
  playerToken?: string,
): void {
  // Reconnect: a token identifies a seat across page reloads and drops.
  const existing = playerToken
    ? room.players.find((p) => p.token === playerToken)
    : undefined;
  if (existing) {
    if (existing.ws && existing.ws !== ws) existing.ws.close();
    existing.ws = ws;
    ctx.roomCode = room.code;
    ctx.playerId = existing.id;
    send(ws, { type: 'joined', room: room.code, playerId: existing.id, playerToken: existing.token });
    pushRoom(room);
    if (room.state) {
      send(ws, { type: 'game', state: room.state, events: room.eventLog });
    }
    return;
  }

  if (room.state) {
    send(ws, { type: 'error', message: 'That game already started.' });
    return;
  }
  if (room.players.length >= 4) {
    send(ws, { type: 'error', message: 'That room is full (4 players max).' });
    return;
  }
  const player: RoomPlayer = {
    id: `p${room.players.length + 1}-${randomBytes(3).toString('hex')}`,
    token: randomBytes(16).toString('hex'),
    name: (name || 'Traveler').slice(0, 24),
    heroes: [],
    ws,
  };
  room.players.push(player);
  ctx.roomCode = room.code;
  ctx.playerId = player.id;
  send(ws, { type: 'joined', room: room.code, playerId: player.id, playerToken: player.token });
  pushRoom(room);
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
    if (!path.startsWith(clientDist)) {
      res.writeHead(403).end();
      return;
    }
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
  const ctx: ConnCtx = { roomCode: null, playerId: null };
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

// Reap rooms idle for 24h.
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [code, room] of rooms) {
    const empty = room.players.every((p) => p.ws === null);
    if (empty && room.createdAt < cutoff) rooms.delete(code);
  }
}, 60 * 60 * 1000).unref();

httpServer.listen(PORT, () => {
  console.log(`Emberfall server listening on http://localhost:${PORT} (ws at /ws)`);
});
