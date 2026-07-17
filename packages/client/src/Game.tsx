import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BEARER,
  CHARACTER_MAP,
  connection,
  EVENTS,
  legalActions,
  MAP,
  OBJECTIVE_MAP,
  REGION_MAP,
  REGIONS,
  SYMBOL_INFO,
  THREAT_TRACK,
  type Action,
  type CharacterId,
  type Faction,
  type GameEvent,
  type GameState,
  type LocationId,
  type PlayerCard,
  type SymbolKind,
} from '@emberfall/engine';
import { net } from './net.js';
import { MapView } from './MapView.js';

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

  const [mode, setMode] = useState<
    | { kind: 'idle' }
    | { kind: 'travel'; character: CharacterId }
    | { kind: 'travelPlan'; plan: TravelPlan }
    | { kind: 'eventTarget'; card: string; event: string }
  >({ kind: 'idle' });
  const [chatText, setChatText] = useState('');
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
        <div className="map-pane">
          <MapView
            state={state}
            highlights={highlights}
            selectedLoc={mode.kind === 'travel' ? state.characters[mode.character]?.location ?? null : null}
            onClickLocation={onClickLocation}
          />
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
                      {SYMBOL_GLYPH[sym]}
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
                Region cards are spent for their symbol {SYMBOL_GLYPH.friendship}❤=muster, {SYMBOL_GLYPH.valor}=battle/capture,{' '}
                {SYMBOL_GLYPH.stealth}=hide Frodo, {SYMBOL_GLYPH.resistance}=reroll — or banked as tokens with Prepare at a haven.
              </p>
            </section>
          )}

          {/* Objectives */}
          <section className="panel">
            <h3>Objectives {objectivesLeft > 0 ? `(${objectivesLeft} to go, then Mount Doom)` : '— the way is open!'}</h3>
            <ul className="objectives">
              {state.objectives.map((o) => {
                const def = { destroy_ring: null }; // names resolved below
                return (
                  <li key={o.id} className={o.complete ? 'done' : ''}>
                    {o.complete ? '✅' : '⬜'} <ObjectiveText id={o.id} />
                  </li>
                );
              })}
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
                      .map((c) => `${CHARACTER_MAP[c].name} — ${MAP[state.characters[c].location].name}`)
                      .join(' · ')}
                  </div>
                  <div className="hint">
                    {p.hand.length} cards
                    {(Object.keys(SYMBOL_GLYPH) as SymbolKind[])
                      .filter((sym) => p.tokens[sym] > 0)
                      .map((sym) => ` · ${SYMBOL_GLYPH[sym]}×${p.tokens[sym]}`)
                      .join('')}
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
          {fellowships.length > 0 && (
            <button onClick={() => onAct(fellowships[0])} title="Trade a region card matching this region with a co-located player.">
              Fellowship
            </button>
          )}
          {can('ability') && (
            <button onClick={() => onAct({ type: 'ability', character })} title={def.abilityText}>
              Use ability
            </button>
          )}
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
        <span className="card-symbol">{SYMBOL_GLYPH[card.symbol]}</span>
        <span className="card-number">{card.number}</span>
      </div>
    );
  }
  if (card.kind === 'event') {
    const def = EVENTS.find((e) => e.key === card.event)!;
    const direct = legal.find((a) => a.type === 'playEvent' && a.card === card.id && !a.location);
    const needsTarget = ['eagles', 'rohirrim_charge', 'ents', 'oath_dead', 'haven_cloaks', 'ranger_paths', 'shadowfax'].includes(card.event);
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

  const isSearch = pend.type === 'search';
  const faces = pend.dice;
  const canReroll = legal.some((a) => a.type === 'reroll');
  const canValor = legal.some((a) => a.type === 'showValor');
  const canConfirm = legal.some((a) => a.type === 'confirm');
  const phial = legal.find((a) => a.type === 'playEvent');

  return (
    <section className="panel pending">
      <h3>
        {isSearch ? '🔎 Search' : '⚔ Battle'} at {MAP[pend.location].name}
      </h3>
      <p className="hint">
        {isSearch
          ? 'The enemy hunts for Frodo. Anyone with a character here may spend Resistance ◎ to reroll a die. Then the current player confirms.'
          : 'Anyone with a character here may spend Resistance ◎ to reroll a die, or Valor ⚔ to slay an extra shadow troop. Then the current player confirms.'}
      </p>
      <div className="dice-row">
        {faces.map((f, i) => (
          <div key={i} className={`die die-${f}`} title={(isSearch ? SEARCH_FACE_INFO : BATTLE_FACE_INFO)[f]}>
            <span className="die-face">{f}</span>
            {canReroll && (
              <button className="mini" onClick={() => onAct({ type: 'reroll', die: i })} title="Spend 1 Resistance to reroll this die">
                ↻ ◎
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="dice-legend hint">
        {Object.entries(isSearch ? SEARCH_FACE_INFO : BATTLE_FACE_INFO).map(([k, v]) => (
          <div key={k}>
            <strong>{k}</strong>: {v.split('— ')[1]}
          </div>
        ))}
      </div>
      <div className="pending-actions">
        {canValor && pend.type === 'battle' && (
          <button onClick={() => onAct({ type: 'showValor' })} title="Spend 1 Valor: one more shadow troop falls">
            Show Valor ⚔ (+1 slain{pend.valorKills > 0 ? `, ${pend.valorKills} so far` : ''})
          </button>
        )}
        {phial && (
          <button onClick={() => onAct(phial)} title="The Light of Eärendil: every search die becomes Slip By">
            ✨ Play The Light of Eärendil
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
          Special path — costs {conn.cost.map((c) => `${SYMBOL_GLYPH[c]} ${c}`).join(' + ')}
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
              🌿 Stealth ({stealthAvailable} available)
            </button>
            <button onClick={() => onGo('search')} title="Risk it: roll the search dice at the destination.">
              🎲 Risk a search ({searchDice} dice)
            </button>
            <button
              onClick={() => onGo('ring')}
              title="Put on the Ring: lose 1 hope, the Eye moves to Frodo's region, but the search ignores shadow troops."
            >
              💍 Put on the Ring ({Math.min(7, state.wraiths[destRegion] ?? 0)} dice, −1 hope, Eye follows)
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
