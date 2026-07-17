import type { ClientMessage, ServerMessage } from '@emberfall/engine';

export type NetListener = (msg: ServerMessage) => void;
export type StatusListener = (status: 'connecting' | 'open' | 'closed') => void;

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
      const token = localStorage.getItem('emberfall.token') ?? undefined;
      if (this.rejoin && token) {
        this.send({ type: 'join', room: this.rejoin.room, name: this.rejoin.name, playerToken: token });
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
