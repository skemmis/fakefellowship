import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BEARER,
  CHARACTER_MAP,
  connection,
  EVENTS,
  FACTION_NAMES,
  legalActions,
  MAP,
  OBJECTIVE_MAP,
  REGION_MAP,
  REGIONS,
  SYMBOL_INFO,
  THREAT_TRACK,
  type Action,
  type BattleFace,
  type CharacterId,
  type Faction,
  type SearchFace,
  type GameEvent,
  type GameState,
  type LocationId,
  type PlayerCard,
  type SymbolKind,
} from '@emberfall/engine';
import { net } from './net.js';
import { MapView } from './MapView.js';
import { DieFace, GIcon, Sym } from './icons.js';

const SYMBOL_GLYPH: Record<SymbolKind, string> = {
  friendship: '❤',
  valor: '⚔',
  stealth: '🌿',
  resistance: '◎',
};

const SEARCH_FACE_INFO: Record<string, string> = {
  slip: 'Slip By — no effect',
  weary: 'Weary — lose 1 hope',
  exposed: 'Exposed — lose 1 hope (ignored in a haven)',
  recall: 'Recall — a Nazgûl returns to Mordor',
};
const BATTLE_FACE_INFO: Record<string, string> = {
  rout: 'Rout — remove 1 shadow troop',
  exchange: 'Exchange — remove 1 shadow troop and 1 friendly troop',
  overrun: 'Overrun — remove 1 friendly troop (ignored in a haven)',
  wraith: 'Nazgûl! — lose 2 friendly troops if Nazgûl are in this region',
};

type TravelPlan = {
  character: CharacterId;
  to: LocationId;
  companions: CharacterId[];
  troops: Partial<Record<Faction, number>>;
};

// ---------------------------------------------------------------------------
// Animation of engine fx: moving pieces, trails, card reveals.
// ---------------------------------------------------------------------------

export interface FxMarkerState {
  id: number;
  piece: 'shadow' | 'friendly' | 'nazgul' | 'character' | 'eye';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  count?: number;
  color?: string;
}
export interface FxTrailState {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}
export interface FxPulseState {
  id: number;
  x: number;
  y: number;
  count: number;
}
export interface FxRevealState {
  id: number;
  title: string;
  detail: string;
  color?: string;
  dark?: boolean;
}

function fxPos(id: string): { x: number; y: number } | null {
  const loc = MAP[id];
  if (loc) return { x: loc.x, y: loc.y };
  const region = REGION_MAP[id];
  if (region) return { x: region.x, y: region.y };
  return null;
}

function useFx(batch: { events: GameEvent[]; id: number }) {
  const [marker, setMarker] = useState<FxMarkerState | null>(null);
  const [trails, setTrails] = useState<FxTrailState[]>([]);
  const [pulse, setPulse] = useState<FxPulseState | null>(null);
  const [reveal, setReveal] = useState<FxRevealState | null>(null);
  const queue = useRef<NonNullable<GameEvent['fx']>[]>([]);
  const busy = useRef(false);
  const seq = useRef(0);

  const pump = () => {
    if (busy.current) return;
    const fx = queue.current.shift();
    if (!fx) return;
    busy.current = true;
    const id = ++seq.current;
    const done = (ms: number) => {
      setTimeout(() => {
        busy.current = false;
        pump();
      }, ms);
    };
    if (fx.fx === 'move') {
      const a = fxPos(fx.from);
      const b = fxPos(fx.to);
      if (!a || !b) return done(0);
      const color =
        fx.piece === 'shadow' ? '#c0392b' : fx.piece === 'friendly' ? '#3c8b4a' : fx.piece === 'nazgul' ? '#222' : CHARACTER_MAP[fx.character ?? '']?.color ?? '#ddd';
      setMarker({ id, piece: fx.piece, x1: a.x, y1: a.y, x2: b.x, y2: b.y, count: fx.count, color });
      setTimeout(() => {
        setMarker(null);
        setTrails((t) => [...t.slice(-7), { id, x1: a.x, y1: a.y, x2: b.x, y2: b.y, color }]);
        setTimeout(() => setTrails((t) => t.filter((x) => x.id !== id)), 6000);
      }, 850);
      done(900);
    } else if (fx.fx === 'eye') {
      const b = fxPos(fx.to);
      if (!b) return done(0);
      setMarker({ id, piece: 'eye', x1: b.x, y1: b.y - 220, x2: b.x, y2: b.y, color: '#c0392b' });
      setTimeout(() => setMarker(null), 850);
      done(900);
    } else if (fx.fx === 'spawn') {
      const a = fxPos(fx.location);
      if (!a) return done(0);
      setPulse({ id, x: a.x, y: a.y, count: fx.count });
      setTimeout(() => setPulse(null), 800);
      done(850);
    } else if (fx.fx === 'shadowCard') {
      setReveal({
        id,
        title:
          fx.half === 'special'
            ? `SPECIAL: ${fx.specialName}`
            : fx.half === 'advance'
              ? 'SHADOW CARD — ADVANCE'
              : 'SHADOW CARD — REINFORCE',
        detail:
          fx.half === 'advance'
            ? `The ${fx.lineName ?? ''} line marches one step`
            : fx.half === 'reinforce'
              ? `+1 troop at ${MAP[fx.reinforce ?? '']?.name ?? ''} · order: ${fx.order === 'eye' ? 'the Eye seeks Frodo' : fx.order === 'hunt2' ? '2 Nazgûl close in' : '3 Nazgûl deploy to the Eye'}`
              : '',
        color: fx.lineColor,
      });
      setTimeout(() => setReveal((r) => (r?.id === id ? null : r)), 2600);
      done(1100);
    } else if (fx.fx === 'darken') {
      setReveal({
        id,
        title: 'SKIES DARKEN',
        detail: `Threat rises · the Eye seeks Frodo · 3 troops at ${MAP[fx.location]?.name ?? ''} · old perils return`,
        dark: true,
      });
      setTimeout(() => setReveal((r) => (r?.id === id ? null : r)), 3200);
      done(1400);
    } else {
      done(0);
    }
  };

  useEffect(() => {
    for (const e of batch.events) if (e.fx) queue.current.push(e.fx);
    pump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch.id]);

  return { marker, trails, pulse, reveal };
}

export function Game({
  state,
  playerId,
  log,
  chat,
  batch,
}: {
  state: GameState;
  playerId: string;
  log: GameEvent[];
  chat: { from: string; text: string }[];
  batch: { events: GameEvent[]; id: number };
}) {
  const fx = useFx(batch);
  const me = state.players.find((p) => p.id === playerId);
  const active = state.players[state.turn.playerIdx];
  const myTurn = active.id === playerId && state.phase === 'playing';

  const [mode, setMode] = useState<
    | { kind: 'idle' }
    | { kind: 'travel'; character: CharacterId }
    | { kind: 'travelPlan'; plan: TravelPlan }
    | { kind: 'eventTarget'; card: string; event: string }
  >({ kind: 'idle' });
  const [chatText, setChatText] = useState('');
  const [boardOnly, setBoardOnly] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log.length, chat.length]);

  useEffect(() => {
    setMode({ kind: 'idle' });
  }, [state.turn.playerIdx, state.turnNumber]);

  const legal = useMemo(() => legalActions(state, playerId), [state, playerId]);
  const pend = state.pending;

  // Which locations are clickable right now, and why (drives map halos).
  const highlights = useMemo(() => {
    const m = new Map<LocationId, string>();
    if (mode.kind === 'travel') {
      const from = state.characters[mode.character]?.location;
      if (from) {
        for (const a of legal) {
          if (a.type === 'travel' && a.character === mode.character) m.set(a.to, 'move');
        }
      }
    } else if (mode.kind === 'eventTarget') {
      for (const a of legal) {
        if (a.type === 'playEvent' && a.card === mode.card && a.location) m.set(a.location, 'card');
      }
      // Rich targeting for haven_cloaks/ranger_paths/eagles composed here:
      if (mode.event === 'eagles') {
        for (const [loc, st] of Object.entries(state.siteStatus)) if (st === 'haven') m.set(loc, 'card');
      }
      if (mode.event === 'oath_dead') {
        for (const loc of Object.keys(state.shadow)) if (MAP[loc].region === 'gondor') m.set(loc, 'card');
      }
      if (mode.event === 'ents') {
        for (const loc of ['isengard', 'fangorn_forest', ...(MAP['fangorn_forest'] ? [] : [])]) {
          if ((state.shadow[loc] ?? 0) > 0) m.set(loc, 'card');
        }
      }
      if (mode.event === 'rohirrim_charge') {
        for (const loc of Object.keys(state.shadow)) {
          const friendly = Object.values(state.friendly[loc] ?? {}).reduce((a, b) => a + (b ?? 0), 0);
          if (friendly > 0) m.set(loc, 'card');
        }
      }
    }
    return m;
  }, [mode, legal, state]);

  const send = (action: Action) => {
    net.send({ type: 'action', action });
    setMode({ kind: 'idle' });
  };

  const onClickLocation = (loc: LocationId) => {
    if (!highlights.has(loc)) return;
    if (mode.kind === 'travel') {
      const character = mode.character;
      const from = state.characters[character].location;
      const bearerHere = state.characters[BEARER]?.location === from;
      const troopsHere = state.friendly[from] ?? {};
      const othersHere = Object.keys(state.characters).filter(
        (c) => c !== character && state.characters[c].location === from,
      );
      const needsPlan =
        character === BEARER || bearerHere || othersHere.length > 0 || Object.values(troopsHere).some((n) => (n ?? 0) > 0);
      if (needsPlan) {
        setMode({ kind: 'travelPlan', plan: { character, to: loc, companions: [], troops: {} } });
      } else {
        send({ type: 'travel', character, to: loc });
      }
    } else if (mode.kind === 'eventTarget') {
      const character = me?.characters.find((c) => state.characters[c]);
      send({ type: 'playEvent', card: mode.card, location: loc, character });
    }
  };

  // ---- Derived turn info -------------------------------------------------
  const actionInfo = useMemo(() => {
    const p = active;
    return p.characters.map((c) => {
      const used = state.turn.actionsUsed[c] ?? 0;
      if (state.solo) {
        const token = state.solo.order[state.solo.idx];
        const cap = c === token ? 4 : c === BEARER ? 1 : 0;
        return { character: c, used, cap, locked: used >= cap };
      }
      const order = state.turn.actedOrder;
      let cap = 4;
      if (order.length >= 1 && order[0] !== c) {
        const firstUsed = state.turn.actionsUsed[order[0]] ?? 0;
        cap = firstUsed <= 1 ? 4 : 1;
      }
      if (order.length >= 1 && order[0] === c && order.length === 2) cap = used; // locked out
      const locked = order.length === 2 && order[1] !== c;
      return { character: c, used, cap, locked: locked || used >= cap };
    });
  }, [state, active]);

  const objectivesLeft = state.objectives.filter((o) => !o.complete && o.id !== 'destroy_ring').length;

  return (
    <div className="game">
      {/* ---- Top banner ---- */}
      <header className="topbar">
        <div className={`turn-banner ${myTurn ? 'my-turn' : ''}`}>
          {state.phase === 'won' && '🎉 The Ring is destroyed — victory!'}
          {state.phase === 'lost' && `💀 ${state.lossReason}. The quest fails.`}
          {state.phase === 'playing' && (
            <>
              {pend
                ? pend.type === 'discard'
                  ? `${state.players.find((p) => p.id === pend.player)?.name} must discard to 7 cards`
                  : pend.type === 'wheels'
                    ? 'The Wheels of Saruman turn — a price must be paid'
                    : `${pend.type === 'search' ? 'Search' : 'Battle'} at ${MAP[pend.location].name} — resolve the dice`
                : myTurn
                  ? 'Your turn'
                  : `${active.name}'s turn`}
              <span className="actions-left">
                {actionInfo.map(({ character, used, cap, locked }) => (
                  <span
                    key={character}
                    className={`action-chip ${locked ? 'locked' : ''}`}
                    style={{ borderColor: CHARACTER_MAP[character].color }}
                    title={
                      locked
                        ? 'Finished for this turn (one character takes up to 4 actions, the other up to 1 — no switching back)'
                        : `${cap - used} actions left`
                    }
                  >
                    {CHARACTER_MAP[character].name}: {locked ? '✓' : `${cap - used}`}
                  </span>
                ))}
              </span>
            </>
          )}
        </div>
        <div className="stats">
          <Stat label="Hope" value={`${state.hope}/8`} warn={state.hope <= 3} title="If hope reaches 0, everyone loses. Searches, darkened skies, and lost havens drain it; captures and objectives restore it." />
          <Stat label="Threat" value={`${THREAT_TRACK[state.threatIdx]}/turn`} warn={state.threatIdx >= 4} title="Shadow cards resolved at the end of every turn. Rises when the skies darken." />
          <Stat label="Eye" value={REGION_MAP[state.eye].name} warn={state.eye === (state.characters[BEARER] ? MAP[state.characters[BEARER].location].region : '')} title="The Eye of Sauron. Attacks and captures drag it to their region — keep it away from Frodo." />
          <Stat label="Shadow supply" value={String(state.supply.shadow)} warn={state.supply.shadow <= 6} title="When a shadow troop can't be placed, hope falls instead. Battles send them back to the supply." />
          <Stat label="Deck" value={String(state.playerDeck.length)} warn={state.playerDeck.length <= 8} title="When the player deck runs out, hope falls for every card that can't be drawn." />
          <Stat label="Objectives" value={`${state.objectives.filter((o) => o.complete).length}/${state.objectives.length}`} title="Complete every other objective, then destroy the Ring at Mount Doom." />
        </div>
      </header>

      <div className="main">
        {/* ---- Map ---- */}
        <div className={`map-pane ${boardOnly ? 'board-only' : ''}`}>
          <MapView
            state={state}
            highlights={highlights}
            selectedLoc={mode.kind === 'travel' ? state.characters[mode.character]?.location ?? null : null}
            onClickLocation={onClickLocation}
            fxMarker={fx.marker}
            fxTrails={fx.trails}
            fxPulse={fx.pulse}
          />
          {fx.reveal && (
            <div className={`fx-reveal ${fx.reveal.dark ? 'dark' : ''}`} style={fx.reveal.color ? { borderColor: fx.reveal.color } : undefined}>
              <div className="fx-reveal-title">{fx.reveal.title}</div>
              <div className="fx-reveal-detail">{fx.reveal.detail}</div>
            </div>
          )}
          <button
            className="board-only-toggle"
            title="Toggle the game overlay to see the board art underneath"
            onClick={() => setBoardOnly(!boardOnly)}
          >
            {boardOnly ? '👁 Show game' : '🗺 Board only'}
          </button>
          {mode.kind === 'travel' && (
            <div className="overlay-hint">
              Choose a destination for {CHARACTER_MAP[mode.character].name} (badged paths cost symbols)…{' '}
              <button onClick={() => setMode({ kind: 'idle' })}>cancel</button>
            </div>
          )}
          {mode.kind === 'eventTarget' && (
            <div className="overlay-hint">
              Choose a target for {EVENTS.find((e) => e.key === mode.event)?.name}…{' '}
              <button onClick={() => setMode({ kind: 'idle' })}>cancel</button>
            </div>
          )}
          {mode.kind === 'travelPlan' && (
            <TravelDialog
              state={state}
              me={me!}
              plan={mode.plan}
              onChange={(plan) => setMode({ kind: 'travelPlan', plan })}
              onCancel={() => setMode({ kind: 'idle' })}
              onGo={(cover) => {
                const { plan } = mode;
                send({
                  type: 'travel',
                  character: plan.character,
                  to: plan.to,
                  companions: plan.companions,
                  troops: plan.troops,
                  ...(cover ? { cover } : {}),
                });
              }}
            />
          )}
        </div>

        {/* ---- Sidebar ---- */}
        <aside className="sidebar">
          {pend && <PendingPanel state={state} playerId={playerId} legal={legal} onAct={send} />}

          {state.phase === 'playing' && !pend && me && (
            <section className="panel">
              <h3>Your characters</h3>
              {me.characters.map((c) => (
                <CharacterPanel
                  key={c}
                  state={state}
                  character={c}
                  myTurn={myTurn}
                  legal={legal}
                  onTravel={() => setMode({ kind: 'travel', character: c })}
                  onAct={send}
                />
              ))}
              {myTurn && (
                <button
                  className="end-turn"
                  title="Draw 2 player cards, then the shadow acts (resolves shadow cards equal to the threat rate)."
                  onClick={() => send({ type: 'endTurn' })}
                >
                  End turn → draw cards, then the Shadow moves
                </button>
              )}
            </section>
          )}

          {/* Hand + tokens */}
          {me && (
            <section className="panel">
              <h3>
                Your hand ({me.hand.length}/7)
                <span className="tokens">
                  {(Object.keys(SYMBOL_GLYPH) as SymbolKind[]).map((sym) => (
                    <span key={sym} className="token" title={`${SYMBOL_INFO[sym].name} tokens — ${SYMBOL_INFO[sym].note}`}>
                      <Sym s={sym} />
                      {me.tokens[sym]}
                    </span>
                  ))}
                </span>
              </h3>
              <div className="hand">
                {me.hand.map((card) => (
                  <CardView
                    key={card.id}
                    card={card}
                    legal={legal}
                    onPlay={(a) => {
                      if (a) send(a);
                      else if (card.kind === 'event') setMode({ kind: 'eventTarget', card: card.id, event: card.event });
                    }}
                  />
                ))}
                {me.hand.length === 0 && <p className="hint">No cards. You draw 2 at the end of your turn.</p>}
              </div>
              <p className="hint">
                Region cards are spent for their symbol: <Sym s="friendship" />=muster, <Sym s="valor" />=battle/capture,{' '}
                <Sym s="stealth" />=hide Frodo, <Sym s="resistance" />=reroll — or banked as tokens with Prepare at a haven.
              </p>
            </section>
          )}

          {/* Objectives */}
          <section className="panel">
            <h3>Objectives {objectivesLeft > 0 ? `(${objectivesLeft} to go, then Mount Doom)` : '— the way is open!'}</h3>
            <ul className="objectives">
              {state.objectives.map((o) => (
                <li key={o.id} className={o.complete ? 'done' : ''}>
                  {o.complete ? '✅' : '⬜'} <ObjectiveText id={o.id} />
                </li>
              ))}
            </ul>
          </section>

          {/* Fellowship overview */}
          <section className="panel">
            <h3>Fellowship</h3>
            <ul className="fellowship">
              {state.players.map((p) => (
                <li key={p.id} className={p.id === active.id ? 'active-player' : ''}>
                  <strong>{p.name}</strong>
                  {p.id === active.id && ' ← playing'} {p.id === playerId && ' (you)'}
                  <div className="hint">
                    {p.characters
                      .map((c) => `${CHARACTER_MAP[c].name} — ${state.characters[c] ? MAP[state.characters[c].location].name : 'fallen (for now)'}`)
                      .join(' · ')}
                  </div>
                  <div className="hint">
                    {p.hand.length} cards
                    {(Object.keys(SYMBOL_GLYPH) as SymbolKind[])
                      .filter((sym) => p.tokens[sym] > 0)
                      .map((sym) => (
                        <span key={sym}>
                          {' · '}
                          <Sym s={sym} />×{p.tokens[sym]}
                        </span>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Log + chat */}
          <section className="panel log-panel">
            <h3>Journey log</h3>
            <div className="log" ref={logRef}>
              {log.slice(-250).map((e, i) => (
                <div key={i} className={`log-line log-${e.kind}`}>
                  {e.text}
                </div>
              ))}
              {chat.slice(-10).map((c, i) => (
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
              <input value={chatText} placeholder="Table talk…" onChange={(e) => setChatText(e.target.value)} />
              <button type="submit">Send</button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ObjectiveText({ id }: { id: string }) {
  const def = OBJECTIVE_MAP[id];
  return (
    <span title={def.text}>
      <strong>{def.name}</strong> <span className="hint">— {def.text}</span>
    </span>
  );
}

function abilityLabel(a: Extract<Action, { type: 'ability' }>): string {
  switch (a.character) {
    case 'aragorn':
      return "Andúril's edge ⚔";
    case 'eomer':
      return `Ride free → ${a.to ? MAP[a.to].name : ''}`;
    case 'gimli':
      return 'Craft (gain ⚔ token)';
    case 'legolas':
      if (a.mode === 'peek') return 'Keen sight (peek shadow deck)';
      if (a.mode === 'nazgul') return 'Sure shot → Nazgûl (🌿1)';
      if (a.to) return `Sure shot → ${MAP[a.to].name} (🌿1)`;
      return 'Walk silently (gain 🌿 token)';
    case 'merry_pippin':
      if (a.mode === 'song') return 'Sing! (❤3 → +2 hope)';
      if (a.mode === 'distract') return 'Distract Nazgûl here (❤1)';
      return 'Loyal friends (gain ❤ token)';
    case 'galadriel':
      return a.mode === 'summon' ? 'Summon lost event (❤1)' : 'Mirror (peek 4 cards)';
    case 'faramir':
      return 'Recover discard card';
    case 'gollum':
      return 'Slink (steal from discard)';
    default:
      return 'Use ability';
  }
}

function Stat({ label, value, warn, title }: { label: string; value: string; warn?: boolean; title?: string }) {
  return (
    <div className={`stat ${warn ? 'warn' : ''}`} title={title}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function CharacterPanel({
  state,
  character,
  myTurn,
  legal,
  onTravel,
  onAct,
}: {
  state: GameState;
  character: CharacterId;
  myTurn: boolean;
  legal: Action[];
  onTravel: () => void;
  onAct: (a: Action) => void;
}) {
  const def = CHARACTER_MAP[character];
  const loc = state.characters[character]?.location;
  if (!loc) return null;
  const can = (type: Action['type']) => legal.some((a) => 'character' in a && a.character === character && a.type === type);
  const attack = legal.find((a) => a.type === 'attack' && a.character === character);
  const fellowships = legal.filter((a) => a.type === 'fellowship' && a.character === character);
  const prepares = legal.filter((a) => a.type === 'prepare' && a.character === character);
  const destroy = legal.find((a) => a.type === 'destroyEmber');

  return (
    <div className="char-panel">
      <div className="char-head">
        <span className="char-dot" style={{ background: def.color }} />
        <strong>{def.name}</strong>
        <span className="hint"> at {MAP[loc].name}</span>
      </div>
      <div className="hint ability" title={def.abilityReconstructed ? 'Reconstructed ability — verify against your physical card' : 'Transcribed from the printed card'}>
        {def.abilityText} {def.abilityReconstructed ? '≈' : ''}
      </div>
      {myTurn && (
        <div className="action-buttons">
          <button disabled={!can('travel')} onClick={onTravel} title="Move along a path or battle line. Bring troops and companions from your location. Special paths cost the badged symbols.">
            Travel
          </button>
          <button
            disabled={!attack}
            onClick={() => attack && onAct(attack)}
            title="Roll battle dice (1 per friendly troop here, max 3). Shifts the Eye of Sauron to this region!"
          >
            Attack
          </button>
          <button
            disabled={!can('muster')}
            onClick={() => onAct({ type: 'muster', character })}
            title="Spend 1 Friendship to add a troop matching this location's muster icon."
          >
            Muster
          </button>
          {prepares.length > 0 && (
            <button
              onClick={() => onAct(prepares[0])}
              title="At a haven: discard a region card to bank its symbol as a token."
            >
              Prepare
            </button>
          )}
          <button
            disabled={!can('capture')}
            onClick={() => onAct({ type: 'capture', character })}
            title="At a cleared stronghold with a friendly troop: spend 3 Valor to turn it into a haven (+2 hope, Eye comes here)."
          >
            Capture
          </button>
          {legal.some((a) => a.type === 'capture' && a.character === character && a.alt) && (
            <button
              onClick={() => onAct({ type: 'capture', character, alt: true })}
              title="An objective card's alternative Capture cost (instead of 3 Valor)."
            >
              Capture (alt cost)
            </button>
          )}
          {fellowships.length > 0 && (
            <button onClick={() => onAct(fellowships[0])} title="Trade a region card matching this region with a co-located player.">
              Fellowship
            </button>
          )}
          {legal
            .filter((a): a is Extract<Action, { type: 'ability' }> => a.type === 'ability' && a.character === character)
            .map((a, i) => (
              <button key={i} onClick={() => onAct(a)} title={def.abilityText}>
                {abilityLabel(a)}
              </button>
            ))}
          {legal
            .filter((a): a is Extract<Action, { type: 'objective' }> => a.type === 'objective' && a.character === character)
            .map((a) => (
              <button
                key={a.id}
                className="primary"
                onClick={() => onAct(a)}
                title={OBJECTIVE_MAP[a.id]?.text}
              >
                ★ {OBJECTIVE_MAP[a.id]?.name}
              </button>
            ))}
          {destroy && character === BEARER && (
            <button className="primary" onClick={() => onAct(destroy)} title="Spend 5 Resistance and survive one final search. If any hope remains, you win.">
              Destroy the Ring 🌋
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CardView({
  card,
  legal,
  onPlay,
}: {
  card: PlayerCard;
  legal: Action[];
  onPlay: (a: Action | null) => void;
}) {
  if (card.kind === 'region') {
    const region = REGIONS.find((r) => r.id === card.region);
    return (
      <div className="card region-card" title={`Region card: spend for ${card.symbol} anywhere, Prepare it at a haven, or pass it with Fellowship while in ${region?.name}.`}>
        <span className="card-name">{region?.name}</span>
        <span className="card-symbol"><Sym s={card.symbol} /></span>
        <span className="card-number">{card.number}</span>
      </div>
    );
  }
  if (card.kind === 'event') {
    const def = EVENTS.find((e) => e.key === card.event)!;
    const direct = legal.find((a) => a.type === 'playEvent' && a.card === card.id && !a.location);
    const needsTarget = ['eagles', 'orc_infighting', 'conflicting_orders', 'red_arrow', 'gwaihir'].includes(card.event);
    return (
      <div className="card event-card">
        <div>
          <span className="card-name">{def.name}</span>
          <div className="card-text">{def.text}{def.reconstructed ? ' ≈' : ''}</div>
        </div>
        <div className="card-actions">
          {direct && !needsTarget && <button onClick={() => onPlay(direct)}>Play</button>}
          {needsTarget && <button onClick={() => onPlay(null)}>Play…</button>}
        </div>
      </div>
    );
  }
  return null;
}

function PendingPanel({
  state,
  playerId,
  legal,
  onAct,
}: {
  state: GameState;
  playerId: string;
  legal: Action[];
  onAct: (a: Action) => void;
}) {
  const pend = state.pending!;
  if (pend.type === 'discard') {
    const mine = pend.player === playerId;
    const p = state.players.find((pl) => pl.id === pend.player)!;
    return (
      <section className="panel pending">
        <h3>Hand limit</h3>
        <p className="hint">{mine ? 'You are' : `${p.name} is`} over 7 cards and must discard.</p>
        {mine && (
          <div className="hand">
            {p.hand.map((c) => (
              <button key={c.id} onClick={() => onAct({ type: 'discard', card: c.id })}>
                Discard {c.kind === 'region' ? REGIONS.find((r) => r.id === c.region)?.name : EVENTS.find((e) => e.key === (c as { event: string }).event)?.name}
              </button>
            ))}
          </div>
        )}
      </section>
    );
  }

  if (pend.type === 'wheels') {
    const active = state.players[state.turn.playerIdx];
    const wheelsActs = legal.filter((a) => a.type === 'wheels');
    const iChoose = wheelsActs.length > 0;
    return (
      <section className="panel pending">
        <h3>⚙ The Wheels of Saruman</h3>
        {!pend.mode && pend.remaining === undefined ? (
          <>
            <p className="hint">
              {iChoose ? 'Choose the least of three evils:' : `${active.name} chooses the price to pay.`}
            </p>
            {iChoose && (
              <div className="hand">
                {wheelsActs.filter((a) => a.pick === 'oath').slice(0, 1).map((a) => (
                  <button key="oath" onClick={() => onAct(a)}>Break Oath — remove 2 friendly troops</button>
                ))}
                {wheelsActs.filter((a) => a.pick === 'doubt').map((a) => (
                  <button key={`d${a.toPlayer}`} onClick={() => onAct(a)}>
                    Doubt — {state.players.find((p) => p.id === a.toPlayer)?.name} gives up 2 cards/tokens
                  </button>
                ))}
                {wheelsActs.filter((a) => a.pick === 'despair').map((a) => (
                  <button key="despair" onClick={() => onAct(a)}>Despair — lose 1 hope</button>
                ))}
              </div>
            )}
          </>
        ) : pend.mode === 'oath' ? (
          <>
            <p className="hint">
              {iChoose ? `Pick ${pend.remaining} troop${(pend.remaining ?? 0) > 1 ? 's' : ''} to remove:` : `${active.name} picks ${pend.remaining} troop(s) to remove.`}
            </p>
            {iChoose && (
              <div className="hand">
                {wheelsActs.map((a, i) => (
                  <button key={i} onClick={() => onAct(a)}>
                    {FACTION_NAMES[a.faction!]} troop at {MAP[a.location!].name}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="hint">
              {iChoose
                ? `Give up ${pend.remaining} more card${(pend.remaining ?? 0) > 1 ? 's' : ''}/token${(pend.remaining ?? 0) > 1 ? 's' : ''}:`
                : `${state.players.find((p) => p.id === pend.player)?.name} must give up ${pend.remaining} card(s)/token(s).`}
            </p>
            {iChoose && (
              <div className="hand">
                {wheelsActs.map((a, i) => (
                  <button key={i} onClick={() => onAct(a)}>
                    {a.card
                      ? `Discard ${(() => { const c = state.players.find((p) => p.id === playerId)!.hand.find((h) => h.id === a.card)!; return c.kind === 'region' ? REGIONS.find((r) => r.id === c.region)?.name : EVENTS.find((e) => e.key === (c as { event: string }).event)?.name; })()}`
                      : `Return a ${a.symbol} token`}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    );
  }

  const isSearch = pend.type === 'search';
  const faces = pend.dice;
  const canReroll = legal.some((a) => a.type === 'reroll');
  const canValor = legal.some((a) => a.type === 'showValor');
  const canConfirm = legal.some((a) => a.type === 'confirm');
  const bombadil = legal.find((a) => a.type === 'playEvent');

  return (
    <section className="panel pending">
      <h3>
        <GIcon name={isSearch ? 'die_search' : 'die_battle'} size={22} /> {isSearch ? 'Search' : 'Battle'} at {MAP[pend.location].name}
      </h3>
      <p className="hint">
        {isSearch ? (
          <>The enemy hunts for Frodo. Anyone with a character here may spend Resistance <Sym s="resistance" /> to reroll a die. Then the current player confirms.</>
        ) : (
          <>Anyone with a character here may spend Resistance <Sym s="resistance" /> to reroll a die, or Valor <Sym s="valor" /> to slay an extra shadow troop. Then the current player confirms.</>
        )}
      </p>
      <div className="dice-row">
        {faces.map((f, i) => {
          const ignored = pend.type === 'search' && pend.ignored.includes(i);
          const canIgnore = legal.some((a) => a.type === 'ignoreDie' && a.die === i);
          const canFree = legal.some((a) => a.type === 'reroll' && a.die === i && a.free);
          return (
            <div key={i} className={`die die-${f} ${ignored ? 'ignored' : ''}`} title={(isSearch ? SEARCH_FACE_INFO : BATTLE_FACE_INFO)[f]}>
              <span className="die-face">
                <DieFace f={f} /> {ignored && '✗'}
              </span>
              {canReroll && !ignored && (
                <button className="mini" onClick={() => onAct({ type: 'reroll', die: i })} title="Spend 1 Resistance to reroll this die (Valor works too when Gandalf stands here)">
                  ↻ <Sym s="resistance" />
                </button>
              )}
              {canFree && !ignored && (
                <button className="mini" onClick={() => onAct({ type: 'reroll', die: i, free: true })} title="A free reroll granted by a character present (once per roll)">
                  ↻ free
                </button>
              )}
              {canIgnore && (
                <button className="mini" onClick={() => onAct({ type: 'ignoreDie', die: i })} title="Sam's aid: spend 1 Friendship to shrug off this result">
                  ✗ <Sym s="friendship" />
                </button>
              )}
              {legal.some((a) => a.type === 'eowynStrike' && a.die === i) && (
                <button className="mini" onClick={() => onAct({ type: 'eowynStrike', die: i })} title="Shieldmaiden No Longer: spend 2 Valor to turn this die to the Nazgûl face (Éowyn then destroys a Nazgûl in this region)">
                  <Sym s="valor" />
                  <Sym s="valor" /> → <GIcon name="wraith" size={18} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="dice-legend hint">
        {Object.entries(isSearch ? SEARCH_FACE_INFO : BATTLE_FACE_INFO).map(([k, v]) => (
          <div key={k}>
            <DieFace f={k as SearchFace | BattleFace} /> <strong>{k}</strong>: {v.split('— ')[1]}
          </div>
        ))}
      </div>
      <div className="pending-actions">
        {canValor && pend.type === 'battle' && (
          <button onClick={() => onAct({ type: 'showValor' })} title="Spend 1 Valor: one more shadow troop falls">
            Show Valor <Sym s="valor" /> (+1 slain{pend.valorKills > 0 ? `, ${pend.valorKills} so far` : ''})
          </button>
        )}
        {bombadil && (
          <button onClick={() => onAct(bombadil)} title="Tom Bombadil: reroll up to 3 dice of this roll">
            🎵 Play Tom Bombadil (reroll up to 3 dice)
          </button>
        )}
        {canConfirm ? (
          <button className="primary" onClick={() => onAct({ type: 'confirm' })}>
            Confirm & resolve
          </button>
        ) : (
          <p className="hint">Waiting for {state.players[state.turn.playerIdx].name} to confirm…</p>
        )}
      </div>
    </section>
  );
}

function TravelDialog({
  state,
  me,
  plan,
  onChange,
  onCancel,
  onGo,
}: {
  state: GameState;
  me: { id: string; characters: CharacterId[]; tokens: Record<SymbolKind, number>; hand: PlayerCard[] };
  plan: TravelPlan;
  onChange: (p: TravelPlan) => void;
  onCancel: () => void;
  onGo: (cover?: 'stealth' | 'search' | 'ring') => void;
}) {
  const from = state.characters[plan.character].location;
  const conn = connection(from, plan.to);
  const othersHere = Object.keys(state.characters).filter(
    (c) => c !== plan.character && state.characters[c].location === from,
  );
  const troopsHere = Object.entries(state.friendly[from] ?? {}).filter(([, n]) => (n ?? 0) > 0) as [Faction, number][];
  const bearerMoving = plan.character === BEARER || plan.companions.includes(BEARER);

  // Search preview: how many dice would Frodo face at the destination?
  const destRegion = MAP[plan.to].region;
  const searchDice = Math.min(7, (state.wraiths[destRegion] ?? 0) + (state.shadow[plan.to] ?? 0));
  const stealthAvailable =
    me.tokens.stealth + me.hand.filter((c) => c.kind === 'region' && c.symbol === 'stealth').length;

  return (
    <div className="dialog">
      <h3>
        Travel: {CHARACTER_MAP[plan.character].name} → {MAP[plan.to].name}
      </h3>
      {conn?.cost && (
        <p className="hint">
          Special path — costs{' '}
          {conn.cost.map((c, i) => (
            <span key={i}>
              {i > 0 && ' + '}
              <Sym s={c} /> {c}
            </span>
          ))}
          {plan.character === 'gollum' ? ' (free for Gollum)' : ''}.
        </p>
      )}
      {othersHere.length > 0 && (
        <div className="dialog-row">
          <span>Bring along:</span>
          {othersHere.map((c) => (
            <label key={c} className="check">
              <input
                type="checkbox"
                checked={plan.companions.includes(c)}
                onChange={(e) =>
                  onChange({
                    ...plan,
                    companions: e.target.checked
                      ? [...plan.companions, c]
                      : plan.companions.filter((x) => x !== c),
                  })
                }
              />
              {CHARACTER_MAP[c].name}
              {!me.characters.includes(c) && <span className="hint"> (ask their player!)</span>}
            </label>
          ))}
        </div>
      )}
      {troopsHere.length > 0 && (
        <div className="dialog-row">
          <span>Troops:</span>
          {troopsHere.map(([f, n]) => (
            <label key={f} className="check">
              {f}:
              <select
                value={plan.troops[f] ?? 0}
                onChange={(e) => onChange({ ...plan, troops: { ...plan.troops, [f]: Number(e.target.value) } })}
              >
                {Array.from({ length: n + 1 }, (_, i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      {bearerMoving ? (
        <div className="dialog-row cover">
          <p>
            <strong>Frodo is moving.</strong> A search at {MAP[plan.to].name} would roll{' '}
            <strong>{searchDice}</strong> {searchDice === 1 ? 'die' : 'dice'} ({state.wraiths[destRegion] ?? 0} Nazgûl in{' '}
            {REGION_MAP[destRegion].name}, {state.shadow[plan.to] ?? 0} shadow troops there).
          </p>
          <div className="cover-buttons">
            <button disabled={stealthAvailable < 1} onClick={() => onGo('stealth')} title="Spend 1 Stealth: no search at all.">
              <Sym s="stealth" /> Stealth ({stealthAvailable} available)
            </button>
            <button onClick={() => onGo('search')} title="Risk it: roll the search dice at the destination.">
              <GIcon name="die_search" size={18} /> Risk a search ({searchDice} dice)
            </button>
            <button
              onClick={() => onGo('ring')}
              title="Put on the Ring: lose 1 hope, the Eye moves to Frodo's region, but the search ignores shadow troops."
            >
              <Sym s="resistance" /> Put on the Ring ({Math.min(7, state.wraiths[destRegion] ?? 0)} dice, −1 hope, Eye follows)
            </button>
          </div>
        </div>
      ) : (
        <div className="dialog-row">
          <button className="primary" onClick={() => onGo()}>
            Go
          </button>
        </div>
      )}
      <button className="dialog-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
