import { useEffect, useState } from 'react';
import type { GameEvent, GameState, RoomInfo, ServerMessage } from '@emberfall/engine';
import { net } from './net.js';
import { Lobby } from './Lobby.js';
import { Game } from './Game.js';
import { Editor } from './Editor.js';

export function App() {
  const [isEditor, setIsEditor] = useState(location.hash === '#editor');
  useEffect(() => {
    const onHash = () => setIsEditor(location.hash === '#editor');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  if (isEditor) return <Editor />;
  return <GameApp />;
}

function GameApp() {
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [log, setLog] = useState<GameEvent[]>([]);
  const [chat, setChat] = useState<{ from: string; text: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const offMsg = net.onMessage((msg: ServerMessage) => {
      switch (msg.type) {
        case 'joined':
          setPlayerId(msg.playerId);
          setError(null);
          break;
        case 'room':
          setRoom(msg.info);
          break;
        case 'game':
          setGame(msg.state);
          setLog((prev) =>
            // A full-history replay (reconnect) replaces the log; otherwise append.
            msg.events.length > 20 && prev.length === 0
              ? msg.events
              : [...prev, ...msg.events].slice(-400),
          );
          break;
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
      {game && playerId ? (
        <Game state={game} playerId={playerId} log={log} chat={chat} />
      ) : (
        <Lobby room={room} playerId={playerId} />
      )}
    </div>
  );
}
