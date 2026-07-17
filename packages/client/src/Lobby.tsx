import { useState } from 'react';
import { HEROES, type RoomInfo } from '@emberfall/engine';
import { net } from './net.js';

export function Lobby({ room, playerId }: { room: RoomInfo | null; playerId: string | null }) {
  const [name, setName] = useState(localStorage.getItem('emberfall.name') ?? '');
  const [code, setCode] = useState('');

  const saveName = (n: string) => {
    setName(n);
    localStorage.setItem('emberfall.name', n);
  };

  if (!room) {
    return (
      <div className="lobby">
        <h1 className="title">Emberfall</h1>
        <p className="tagline">
          A cooperative journey for 1–4 players. Escort the shardbearer to the Cindermaw,
          hold the sanctuaries, and keep hope alive.
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
                const room = code.trim().toUpperCase();
                net.rejoin = { room, name: name.trim() };
                net.send({ type: 'join', room, name: name.trim() });
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
  const takenByOthers = new Set(
    room.players.filter((p) => p.id !== playerId).flatMap((p) => p.heroes),
  );

  const toggleHero = (heroId: string) => {
    if (!me) return;
    const current = me.heroes;
    const next = current.includes(heroId)
      ? current.filter((h) => h !== heroId)
      : [...current, heroId].slice(-2);
    net.send({ type: 'pickHeroes', heroes: next });
  };

  return (
    <div className="lobby">
      <h1 className="title">Emberfall</h1>
      <div className="lobby-card">
        <div className="room-code">
          Room code: <strong>{room.code}</strong>
          <span className="hint"> — share it with your fellowship (1–4 players)</span>
        </div>
        <h3>Travelers</h3>
        <ul className="player-list">
          {room.players.map((p) => (
            <li key={p.id}>
              <span className={p.connected ? '' : 'disconnected'}>
                {p.name} {p.isHost && '(host)'} {p.id === playerId && '(you)'}
              </span>
              <span className="picked-heroes">
                {p.heroes.map((h) => HEROES.find((d) => d.id === h)?.name).join(', ') || '—'}
              </span>
            </li>
          ))}
        </ul>
        <h3>Choose your two heroes</h3>
        <p className="hint">Unpicked heroes are assigned automatically at start.</p>
        <div className="hero-grid">
          {HEROES.map((h) => {
            const mine = me?.heroes.includes(h.id) ?? false;
            const taken = takenByOthers.has(h.id);
            return (
              <button
                key={h.id}
                className={`hero-card ${mine ? 'mine' : ''} ${taken ? 'taken' : ''}`}
                disabled={taken}
                onClick={() => toggleHero(h.id)}
                style={{ borderColor: h.color }}
              >
                <span className="hero-name" style={{ color: h.color }}>
                  {h.name}
                </span>
                <span className="hero-title">{h.title}</span>
                <span className="hero-ability">{h.abilityText}</span>
              </button>
            );
          })}
        </div>
        {me?.isHost ? (
          <button className="primary start" onClick={() => net.send({ type: 'start' })}>
            Begin the journey
          </button>
        ) : (
          <p className="hint">Waiting for the host to begin…</p>
        )}
      </div>
    </div>
  );
}
