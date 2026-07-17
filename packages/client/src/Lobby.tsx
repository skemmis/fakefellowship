import { useState } from 'react';
import { DIFFICULTY_TABLE, type Difficulty, type RoomInfo } from '@emberfall/engine';
import { net } from './net.js';

const DIFFICULTIES: Difficulty[] = ['introductory', 'standard', 'heroic', 'epic', 'legendary'];

export function Lobby({ room, playerId }: { room: RoomInfo | null; playerId: string | null }) {
  const [name, setName] = useState(localStorage.getItem('fellowship.name') ?? '');
  const [code, setCode] = useState('');

  const saveName = (n: string) => {
    setName(n);
    localStorage.setItem('fellowship.name', n);
  };

  if (!room) {
    return (
      <div className="lobby">
        <h1 className="title">Fate of the Fellowship</h1>
        <p className="tagline">
          A cooperative journey for 2–5 players. Escort Frodo to Mount Doom, defend the havens,
          and keep hope alive. Play together from anywhere.
        </p>
        <div className="lobby-card">
          <label>
            Your name
            <input
              value={name}
              maxLength={24}
              placeholder="Traveler"
              onChange={(e) => saveName(e.target.value)}
            />
          </label>
          <div className="lobby-row">
            <button
              className="primary"
              disabled={!name.trim()}
              onClick={() => {
                net.rejoin = null;
                net.send({ type: 'create', name: name.trim() });
              }}
            >
              Host a new game
            </button>
          </div>
          <div className="lobby-row">
            <input
              value={code}
              placeholder="Room code"
              maxLength={4}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button
              disabled={!name.trim() || code.trim().length !== 4}
              onClick={() => {
                const r = code.trim().toUpperCase();
                net.rejoin = { room: r, name: name.trim() };
                net.send({ type: 'join', room: r, name: name.trim() });
              }}
            >
              Join
            </button>
          </div>
        </div>
      </div>
    );
  }

  const me = room.players.find((p) => p.id === playerId);

  return (
    <div className="lobby">
      <h1 className="title">Fate of the Fellowship</h1>
      <div className="lobby-card">
        <div className="room-code">
          Room code: <strong>{room.code}</strong>
          <span className="hint"> — share it with your fellowship (2–5 players)</span>
        </div>
        <h3>Travelers</h3>
        <ul className="player-list">
          {room.players.map((p) => (
            <li key={p.id}>
              <span className={p.connected ? '' : 'disconnected'}>
                {p.name} {p.isHost && '(host)'} {p.id === playerId && '(you)'}
              </span>
            </li>
          ))}
        </ul>
        <h3>Difficulty</h3>
        <div className="difficulty-row">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              className={`difficulty ${room.difficulty === d ? 'selected' : ''}`}
              disabled={!me?.isHost}
              onClick={() => net.send({ type: 'setDifficulty', difficulty: d })}
              title={`${DIFFICULTY_TABLE[d].darken} Skies Darken cards, ${DIFFICULTY_TABLE[d].objectives} objectives`}
            >
              {d}
              <span className="hint">
                {DIFFICULTY_TABLE[d].objectives} objectives · {DIFFICULTY_TABLE[d].darken} darkenings
              </span>
            </button>
          ))}
        </div>
        <p className="hint">
          Each player is dealt 2 random characters (Frodo &amp; Sam are always in play). Hands are
          public — this is a fully cooperative game, so talk it out.
        </p>
        {me?.isHost ? (
          <button
            className="primary start"
            disabled={room.players.length < 2}
            onClick={() => net.send({ type: 'start' })}
          >
            {room.players.length < 2 ? 'Waiting for at least 2 players…' : 'Begin the journey'}
          </button>
        ) : (
          <p className="hint">Waiting for the host to begin…</p>
        )}
      </div>
    </div>
  );
}
