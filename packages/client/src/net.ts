import type { ClientMessage, ServerMessage } from '@emberfall/engine';

export type NetListener = (msg: ServerMessage) => void;
export type StatusListener = (status: 'connecting' | 'open' | 'closed') => void;

/** The room code in the URL (`#g=ABCD`), if any — so a link/refresh targets one game. */
export function roomFromUrl(): string | null {
  const m = /[#&]g=([A-Za-z0-9]{4})\b/.exec(location.hash);
  return m ? m[1].toUpperCase() : null;
}

/** Point the URL at a game, so a hard refresh (or a shared link) reopens it. */
export function setRoomUrl(code: string | null): void {
  const next = code ? `#g=${code}` : '';
  if ((location.hash || '') === next) return;
  if (code) location.hash = next;
  else history.replaceState(null, '', location.pathname + location.search);
}

/** A durable per-browser identity so a player resumes their seat across reloads. */
export function clientId(): string {
  let id = localStorage.getItem('emberfall.clientId');
  if (!id) {
    id = (crypto.randomUUID?.() ?? `c${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem('emberfall.clientId', id);
  }
  return id;
}

/**
 * Thin WebSocket wrapper with auto-reconnect. On reconnect it replays the
 * join with the saved player token, so a dropped browser resumes its seat.
 */
export class Net {
  private ws: WebSocket | null = null;
  private listeners = new Set<NetListener>();
  private statusListeners = new Set<StatusListener>();
  private reconnectDelay = 500;
  private closedByUs = false;

  /** Set when we join/create so reconnects can re-join automatically. */
  rejoin: { room: string; name: string } | null = null;

  connect(): void {
    this.closedByUs = false;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.emitStatus('connecting');
    this.ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws.onopen = () => {
      this.reconnectDelay = 500;
      this.emitStatus('open');
      // Always tell the server who we are so it can list our active games.
      this.send({ type: 'listGames', clientId: clientId() });
      // Resume the game we were last viewing. The URL wins (a shared link or a
      // hard refresh targets one game); otherwise fall back to the last one.
      const room = this.rejoin?.room ?? roomFromUrl() ?? localStorage.getItem('emberfall.room') ?? null;
      const name = this.rejoin?.name ?? localStorage.getItem('fellowship.name') ?? 'Traveler';
      if (room) {
        this.send({ type: 'join', room, name, clientId: clientId() });
      }
    };
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data as string) as ServerMessage;
      if (msg.type === 'joined') {
        localStorage.setItem('emberfall.token', msg.playerToken);
        localStorage.setItem('emberfall.room', msg.room);
      }
      for (const l of this.listeners) l(msg);
    };
    this.ws.onclose = () => {
      this.emitStatus('closed');
      if (!this.closedByUs) {
        setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 8000);
      }
    };
  }

  close(): void {
    this.closedByUs = true;
    this.ws?.close();
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(l: NetListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  onStatus(l: StatusListener): () => void {
    this.statusListeners.add(l);
    return () => this.statusListeners.delete(l);
  }

  private emitStatus(s: 'connecting' | 'open' | 'closed'): void {
    for (const l of this.statusListeners) l(s);
  }
}

export const net = new Net();
