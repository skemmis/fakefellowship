import { useEffect, useRef, useState } from 'react';
import type { GameEvent, GameState, GameSummary, RoomInfo, ServerMessage } from '@emberfall/engine';
import { net, clientId } from './net.js';
import { Lobby } from './Lobby.js';
import { Game } from './Game.js';
import { GameSwitcher } from './GameSwitcher.js';
import { Editor } from './Editor.js';
import { IconTool } from './IconTool.js';

export function App() {
  const [route, setRoute] = useState(location.hash);
  useEffect(() => {
    const onHash = () => setRoute(location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  if (route === '#editor') return <Editor />;
  if (route === '#icons') return <IconTool />;
  return <GameApp />;
}

function GameApp() {
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [log, setLog] = useState<GameEvent[]>([]);
  const [batch, setBatch] = useState<{ events: GameEvent[]; id: number }>({ events: [], id: 0 });
  const [chat, setChat] = useState<{ from: string; text: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const autoResumed = useRef(false);

  // Leave the current game's view (without abandoning the seat) to reach the lobby.
  const toLobby = () => {
    localStorage.removeItem('emberfall.room');
    net.rejoin = null;
    setGame(null);
    setRoom(null);
    setPlayerId(null);
    setLog([]);
    setShowSwitcher(false);
  };

  const resume = (code: string) => {
    localStorage.setItem('emberfall.room', code);
    net.rejoin = { room: code, name: localStorage.getItem('fellowship.name') ?? 'Traveler' };
    net.send({ type: 'join', room: code, name: net.rejoin.name, clientId: clientId() });
    setShowSwitcher(false);
  };

  const abandon = (code: string) => {
    net.send({ type: 'leaveGame', room: code });
    if ((localStorage.getItem('emberfall.room') ?? '') === code) toLobby();
  };

  useEffect(() => {
    const offMsg = net.onMessage((msg: ServerMessage) => {
      switch (msg.type) {
        case 'joined':
          setPlayerId(msg.playerId);
          localStorage.setItem('emberfall.room', msg.room);
          setError(null);
          break;
        case 'room':
          setRoom(msg.info);
          break;
        case 'games':
          setGames(msg.games);
          // On first load, resume the most recent active game if we aren't
          // already headed into one.
          if (!autoResumed.current) {
            autoResumed.current = true;
            const saved = localStorage.getItem('emberfall.room');
            const target = msg.games.find((g) => g.code === saved) ?? msg.games[0];
            if (target && !saved) localStorage.setItem('emberfall.room', target.code);
          }
          break;
        case 'game': {
          setGame(msg.state);
          // A Reset Turn (replace) or full-history reconnect replaces the log
          // wholesale; ordinary updates append. Reset fires no map animation.
          const isReplay = msg.events.length > 20;
          if (msg.replace) {
            setLog(msg.events.slice(-400));
            setBatch((b) => ({ events: [], id: b.id + 1 }));
          } else {
            setLog((prev) =>
              isReplay && prev.length === 0 ? msg.events : [...prev, ...msg.events].slice(-400),
            );
            if (!isReplay) setBatch((b) => ({ events: msg.events, id: b.id + 1 }));
          }
          break;
        }
        case 'chat':
          setChat((prev) => [...prev.slice(-100), { from: msg.from, text: msg.text }]);
          break;
        case 'error':
          setError(msg.message);
          setTimeout(() => setError(null), 5000);
          break;
      }
    });
    const offStatus = net.onStatus(setStatus);
    net.connect();
    return () => {
      offMsg();
      offStatus();
      net.close();
    };
  }, []);

  return (
    <div className="app">
      {status !== 'open' && (
        <div className="banner banner-warn">
          {status === 'connecting' ? 'Connecting to the realm…' : 'Connection lost — reconnecting…'}
        </div>
      )}
      {error && <div className="banner banner-error">{error}</div>}
      {(games.length > 0 || game) && (
        <button className="games-toggle" onClick={() => setShowSwitcher((s) => !s)} title="Your active games">
          ⇄ Games{games.length > 0 ? ` (${games.length})` : ''}
        </button>
      )}
      {showSwitcher && (
        <GameSwitcher
          games={games}
          currentRoom={room?.code ?? localStorage.getItem('emberfall.room')}
          onResume={resume}
          onAbandon={abandon}
          onNew={toLobby}
          onClose={() => setShowSwitcher(false)}
        />
      )}
      {game && playerId ? (
        <Game state={game} playerId={playerId} log={log} chat={chat} batch={batch} />
      ) : (
        <Lobby room={room} playerId={playerId} games={games} onResume={resume} onAbandon={abandon} />
      )}
    </div>
  );
}
