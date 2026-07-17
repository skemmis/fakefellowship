import { useEffect, useMemo, useRef, useState } from 'react';
import {
  actionsRemaining,
  CARD_INFO,
  HERO_MAP,
  legalActions,
  MAP,
  SHARDBEARER_NAME,
  THREAT_TRACK,
  type Action,
  type GameEvent,
  type GameState,
  type HeroId,
  type LocationId,
} from '@emberfall/engine';
import { net } from './net.js';
import { MapView } from './MapView.js';

type PendingTarget =
  | { kind: 'move'; hero: HeroId }
  | { kind: 'battle'; hero: HeroId }
  | { kind: 'guide'; hero: HeroId }
  | { kind: 'card'; cardId: string; cardKind: string };

export function Game({
  state,
  playerId,
  log,
  chat,
}: {
  state: GameState;
  playerId: string;
  log: GameEvent[];
  chat: { from: string; text: string }[];
}) {
  const me = state.players.find((p) => p.id === playerId);
  const active = state.players[state.turn.playerIdx];
  const myTurn = active.id === playerId && state.phase === 'playing';

  const [selectedHero, setSelectedHero] = useState<HeroId | null>(null);
  const [pending, setPending] = useState<PendingTarget | null>(null);
  const [chatText, setChatText] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log.length]);

  // Reset selection when the turn passes.
  useEffect(() => {
    setPending(null);
    if (me && !me.heroes.includes(selectedHero as HeroId)) {
      setSelectedHero(me.heroes[0] ?? null);
    } else if (!selectedHero && me) {
      setSelectedHero(me.heroes[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.turn.playerIdx, state.turnNumber]);

  const legal = useMemo(() => (myTurn ? legalActions(state) : []), [state, myTurn]);
  const remaining = useMemo(() => actionsRemaining(state), [state]);

  // Which locations are valid targets for the pending choice?
  const highlights = useMemo(() => {
    const set = new Set<LocationId>();
    if (!pending) return set;
    for (const a of legal) {
      if (pending.kind === 'move' && a.type === 'move' && a.hero === pending.hero) {
        set.add(a.path[a.path.length - 1]);
      } else if (pending.kind === 'battle' && a.type === 'battle' && a.hero === pending.hero) {
        set.add(a.location);
      } else if (pending.kind === 'guide' && a.type === 'guide' && a.hero === pending.hero) {
        set.add(a.path[a.path.length - 1]);
      } else if (
        pending.kind === 'card' &&
        a.type === 'playCard' &&
        a.card === pending.cardId
      ) {
        if (a.location) set.add(a.location);
        if (a.path) set.add(a.path[a.path.length - 1]);
      }
    }
    return set;
  }, [pending, legal]);

  const sendAction = (action: Action) => {
    net.send({ type: 'action', action });
    setPending(null);
  };

  const onClickLocation = (loc: LocationId) => {
    if (!pending || !highlights.has(loc)) return;
    if (pending.kind === 'move') {
      sendAction({ type: 'move', hero: pending.hero, path: [loc] });
    } else if (pending.kind === 'battle') {
      sendAction({ type: 'battle', hero: pending.hero, location: loc });
    } else if (pending.kind === 'guide') {
      sendAction({ type: 'guide', hero: pending.hero, path: [loc] });
    } else if (pending.kind === 'card') {
      const match = legal.find(
        (a) =>
          a.type === 'playCard' &&
          a.card === pending.cardId &&
          (a.location === loc || (a.path && a.path[a.path.length - 1] === loc)),
      );
      if (match) sendAction(match);
    }
  };

  const heroCan = (hero: HeroId, type: Action['type']) =>
    legal.some((a) => 'hero' in a && a.hero === hero && a.type === type);

  const cardTargets = (cardId: string) =>
    legal.filter((a) => a.type === 'playCard' && a.card === cardId);

  const objectivesDone = state.objectives.filter((o) => o.complete).length;

  return (
    <div className="game">
      {/* ---- Top banner: whose turn, phase, vital stats ---- */}
      <header className="topbar">
        <div className={`turn-banner ${myTurn ? 'my-turn' : ''}`}>
          {state.phase === 'won' && '🎉 Victory! The Ember is destroyed.'}
          {state.phase === 'lost' && `💀 Defeat — ${state.lossReason}.`}
          {state.phase === 'playing' &&
            (myTurn ? 'Your turn' : `${active.name}'s turn`)}
          {state.phase === 'playing' && (
            <span className="actions-left">
              {remaining.map(({ hero, remaining: r }) => (
                <span key={hero} className="action-chip" style={{ borderColor: HERO_MAP[hero].color }}>
                  {HERO_MAP[hero].name}: {r}
                </span>
              ))}
            </span>
          )}
        </div>
        <div className="stats">
          <Stat label="Hope" value={`${state.hope}/8`} warn={state.hope <= 3} />
          <Stat
            label="Corruption"
            value={`${state.shardbearer.corruption}/8`}
            warn={state.shardbearer.corruption >= 5}
          />
          <Stat label="Threat" value={`${THREAT_TRACK[state.threatIdx]}/turn`} warn={state.threatIdx >= 3} />
          <Stat label="Shadow supply" value={String(state.supply.shadow)} warn={state.supply.shadow <= 8} />
          <Stat label="Deck" value={String(state.playerDeck.length)} warn={state.playerDeck.length <= 8} />
          <Stat label="Objectives" value={`${objectivesDone}/3`} />
        </div>
      </header>

      <div className="main">
        {/* ---- Map ---- */}
        <div className="map-pane">
          <MapView
            state={state}
            highlights={highlights}
            selectedLoc={selectedHero ? state.heroes[selectedHero].location : null}
            onClickLocation={onClickLocation}
          />
          {pending && (
            <div className="target-hint">
              Choose a highlighted destination for{' '}
              {pending.kind === 'card'
                ? CARD_INFO[pending.cardKind as keyof typeof CARD_INFO].name
                : `${HERO_MAP[(pending as { hero: HeroId }).hero].name}'s ${pending.kind}`}
              … <button onClick={() => setPending(null)}>cancel</button>
            </div>
          )}
        </div>

        {/* ---- Sidebar ---- */}
        <aside className="sidebar">
          {/* Shardbearer status */}
          <section className="panel">
            <h3>
              🔥 {SHARDBEARER_NAME}{' '}
              <span className="hint">
                at {MAP[state.shardbearer.location].name}
                {state.shardbearer.hidden ? ' (hidden)' : ''}
              </span>
            </h3>
          </section>

          {/* Objectives */}
          <section className="panel">
            <h3>Objectives (complete {2} to unlock the Cindermaw)</h3>
            <ul className="objectives">
              {state.objectives.map((o) => (
                <li key={o.id} className={o.complete ? 'done' : ''}>
                  {o.complete ? '✅' : '⬜'} <strong>{o.name}</strong> — {o.text}
                </li>
              ))}
            </ul>
          </section>

          {/* My heroes + actions */}
          {me && (
            <section className="panel">
              <h3>Your heroes</h3>
              {me.heroes.map((hero) => {
                const h = state.heroes[hero];
                const def = HERO_MAP[hero];
                const rem = remaining.find((r) => r.hero === hero)?.remaining ?? 0;
                return (
                  <div
                    key={hero}
                    className={`hero-panel ${selectedHero === hero ? 'selected' : ''}`}
                    onClick={() => setSelectedHero(hero)}
                  >
                    <div className="hero-head">
                      <span className="hero-dot" style={{ background: def.color }} />
                      <strong>{def.name}</strong>
                      <span className="hint">
                        {' '}
                        at {MAP[h.location].name}
                        {myTurn ? ` — ${rem} actions` : ''}
                      </span>
                    </div>
                    <div className="hero-ability hint">{def.abilityText}</div>
                    {myTurn && (
                      <div className="action-buttons">
                        <button
                          disabled={!heroCan(hero, 'move')}
                          onClick={() => setPending({ kind: 'move', hero })}
                        >
                          Move
                        </button>
                        <button
                          disabled={!heroCan(hero, 'battle')}
                          onClick={() => setPending({ kind: 'battle', hero })}
                        >
                          Battle
                        </button>
                        <button
                          disabled={!heroCan(hero, 'muster')}
                          onClick={() => sendAction({ type: 'muster', hero })}
                        >
                          Muster
                        </button>
                        <button
                          disabled={!heroCan(hero, 'guide')}
                          onClick={() => setPending({ kind: 'guide', hero })}
                        >
                          Guide
                        </button>
                        <button
                          disabled={!heroCan(hero, 'hide')}
                          onClick={() => sendAction({ type: 'hide', hero })}
                        >
                          Hide
                        </button>
                        {heroCan(hero, 'kindle') && (
                          <button onClick={() => sendAction({ type: 'kindle', hero })}>
                            Kindle ✨
                          </button>
                        )}
                        {heroCan(hero, 'destroyEmber') && (
                          <button
                            className="primary"
                            onClick={() => sendAction({ type: 'destroyEmber', hero })}
                          >
                            Destroy the Ember 🌋
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {myTurn && (
                <button className="end-turn" onClick={() => sendAction({ type: 'endTurn' })}>
                  End turn (draw cards, then the shadow stirs)
                </button>
              )}
            </section>
          )}

          {/* Hand */}
          {me && (
            <section className="panel">
              <h3>Your hand ({me.hand.length}/7)</h3>
              <div className="hand">
                {me.hand.map((card) => {
                  const info = CARD_INFO[card.kind];
                  const targets = myTurn ? cardTargets(card.id) : [];
                  const needsTarget = targets.some(
                    (a) => a.type === 'playCard' && (a.location || a.path),
                  );
                  const simple = targets.find(
                    (a) => a.type === 'playCard' && !a.location && !a.path && !a.hide && !a.cleanse,
                  );
                  const hideOpt = targets.find((a) => a.type === 'playCard' && a.hide);
                  const cleanseOpt = targets.find((a) => a.type === 'playCard' && a.cleanse);
                  return (
                    <div key={card.id} className={`card ${targets.length ? 'playable' : ''}`}>
                      <div className="card-name">{info.name}</div>
                      <div className="card-text">{info.text}</div>
                      {myTurn && targets.length > 0 && (
                        <div className="card-actions">
                          {simple && <button onClick={() => sendAction(simple)}>Play</button>}
                          {needsTarget && (
                            <button
                              onClick={() =>
                                setPending({ kind: 'card', cardId: card.id, cardKind: card.kind })
                              }
                            >
                              Play → pick target
                            </button>
                          )}
                          {hideOpt && (
                            <button onClick={() => sendAction(hideOpt)}>Play: hide</button>
                          )}
                          {cleanseOpt && (
                            <button onClick={() => sendAction(cleanseOpt)}>Play: cleanse</button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {me.hand.length === 0 && <p className="hint">No cards in hand.</p>}
              </div>
            </section>
          )}

          {/* Other players */}
          <section className="panel">
            <h3>Fellowship</h3>
            <ul className="fellowship">
              {state.players.map((p) => (
                <li key={p.id} className={p.id === active.id ? 'active-player' : ''}>
                  <strong>{p.name}</strong>
                  {p.id === active.id && ' ← playing'}
                  <div className="hint">
                    {p.heroes
                      .map((h) => `${HERO_MAP[h].name} (${MAP[state.heroes[h].location].name})`)
                      .join(' · ')}
                    {' · '}
                    {p.hand.length} cards
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Log + chat */}
          <section className="panel log-panel">
            <h3>Journey log</h3>
            <div className="log" ref={logRef}>
              {log.map((e, i) => (
                <div key={i} className={`log-line log-${e.kind}`}>
                  {e.text}
                </div>
              ))}
              {chat.slice(-8).map((c, i) => (
                <div key={`c${i}`} className="log-line log-chat">
                  💬 {c.from}: {c.text}
                </div>
              ))}
            </div>
            <form
              className="chat-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (chatText.trim()) net.send({ type: 'chat', text: chatText.trim() });
                setChatText('');
              }}
            >
              <input
                value={chatText}
                placeholder="Table talk…"
                onChange={(e) => setChatText(e.target.value)}
              />
              <button type="submit">Send</button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`stat ${warn ? 'warn' : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}
