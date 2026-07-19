import { Fragment, useEffect, useRef, useState } from 'react';
import {
  CHARACTER_MAP,
  LOCATIONS,
  MAP,
  REGIONS,
  TRACKS,
  trackPos,
  type GameState,
  type LocationId,
  type TrackDef,
} from '@emberfall/engine';
import type { FxMarkerState, FxPulseState, FxTrailState } from './Game.js';

/** Two-letter map monograms — distinct enough to tell the Gs and Es apart. */
const MONOGRAM: Record<string, string> = {
  frodo_sam: 'FS',
  merry_pippin: 'MP',
  aragorn: 'Ar',
  arwen: 'Aw',
  boromir: 'Bo',
  eomer: 'Ém',
  eowyn: 'Éo',
  faramir: 'Fa',
  galadriel: 'Ga',
  gandalf: 'Gn',
  gimli: 'Gi',
  gollum: 'Go',
  legolas: 'Le',
};

/** Pick black or white text for contrast against a hex fill. */
function inkFor(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#14120e' : '#ffffff';
}

/** A character's map marker: a colored shield with a monogram; the Ring-bearer
 * wears a gold ring. */
function CharPin({ id, x, y }: { id: string; x: number; y: number }) {
  const def = CHARACTER_MAP[id];
  const bearer = id === 'frodo_sam';
  const R = 19;
  return (
    <g className="char-pin" transform={`translate(${x}, ${y})`}>
      <title>{def.name}</title>
      {/* leader stem up toward the node */}
      <line x1={0} y1={-R} x2={0} y2={-R - 12} className="char-pin-stem" />
      {bearer && <circle r={R + 5} className="char-pin-bearer" />}
      <circle r={R} fill={def.color} className="char-pin-body" />
      <text y={6} textAnchor="middle" className="char-pin-label" fill={inkFor(def.color)}>
        {MONOGRAM[id] ?? def.name.slice(0, 2)}
      </text>
    </g>
  );
}

/** A marker that sits on a calibrated track (hope or threat), gliding along
 * it and leaving a colored tracer when its value changes. The tracer clears
 * turn-by-turn via the `turnKey` prop. */
function TrackMarker({
  track,
  value,
  spaces,
  icon,
  turnKey,
  upClass,
}: {
  track: TrackDef;
  value: number;
  spaces: number;
  icon: string;
  turnKey: string;
  /** 'good' = green when the value rises (hope); 'bad' = red when it rises (threat). */
  upClass: 'good' | 'bad';
}) {
  const v = Math.max(0, Math.min(spaces - 1, value));
  const [xy, setXy] = useState(() => trackPos(track, v, spaces));
  const [tracer, setTracer] = useState<{ a: { x: number; y: number }; b: { x: number; y: number }; up: boolean } | null>(null);
  const prev = useRef(v);
  const prevTurn = useRef(turnKey);

  useEffect(() => {
    if (turnKey !== prevTurn.current) {
      prevTurn.current = turnKey;
      setTracer(null);
    }
  }, [turnKey]);

  useEffect(() => {
    if (v === prev.current) return;
    const a = trackPos(track, prev.current, spaces);
    const b = trackPos(track, v, spaces);
    setTracer({ a, b, up: v > prev.current });
    prev.current = v;
    requestAnimationFrame(() => requestAnimationFrame(() => setXy(b)));
  }, [v]);

  // A rising tracer is green for hope but red for threat, and vice-versa.
  const cls = tracer ? (tracer.up === (upClass === 'good') ? 'up' : 'down') : '';
  return (
    <g className="hope-layer">
      {tracer && (
        <line x1={tracer.a.x} y1={tracer.a.y} x2={tracer.b.x} y2={tracer.b.y} className={`hope-tracer ${cls}`} />
      )}
      <g className="hope-marker" style={{ transform: `translate(${xy.x}px, ${xy.y}px)` }}>
        <circle r={30} className="hope-marker-ring" />
        <image href={`/icons/${icon}.png`} x={-26} y={-26} width={52} height={52} />
      </g>
    </g>
  );
}

/** A piece gliding from its origin to its destination. */
function FxMarker({ m }: { m: FxMarkerState }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    setGo(false);
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setGo(true)));
    return () => cancelAnimationFrame(raf);
  }, [m.id]);
  const x = go ? m.x2 : m.x1;
  const y = go ? m.y2 : m.y1;
  return (
    <g className="fx-marker" style={{ transform: `translate(${x}px, ${y}px)` }}>
      {m.piece === 'eye' ? (
        <image href="/icons/eye.png" x={-48} y={-48} width={96} height={96} />
      ) : m.piece === 'nazgul' ? (
        <image href="/icons/nazgul.png" x={-24} y={-24} width={48} height={48} />
      ) : (
        <>
          <circle r={22} fill={m.color} stroke="#14120e" strokeWidth={3} />
          {m.count && m.count > 1 && (
            <text textAnchor="middle" dy={9} className="fx-count">
              {m.count}
            </text>
          )}
        </>
      )}
    </g>
  );
}

/**
 * The illustrated board is the play surface: the game state is drawn as an
 * interactive overlay on top of the board artwork (public/board.jpg,
 * 2500x2143). Paths, battle lines, symbols, and labels are part of the art;
 * the overlay adds only live state — troops, characters, Nazgûl, the Eye,
 * haven/stronghold status changes, and click targets.
 */
export function MapView({
  state,
  highlights,
  selectedLoc,
  onClickLocation,
  fxMarker,
  fxTrails,
  fxPulse,
  turnKey,
}: {
  state: GameState;
  highlights: Map<LocationId, string>;
  selectedLoc: LocationId | null;
  onClickLocation: (loc: LocationId) => void;
  fxMarker?: FxMarkerState | null;
  fxTrails?: FxTrailState[];
  fxPulse?: FxPulseState | null;
  turnKey: string;
}) {
  const frodoLoc = state.characters['frodo_sam']?.location;

  return (
    <svg className="map" viewBox="0 0 2500 2143" preserveAspectRatio="xMidYMid meet">
      <image href="/board.jpg" x="0" y="0" width="2500" height="2143" />

      <TrackMarker track={TRACKS.hope} value={state.hope} spaces={9} icon="hope" turnKey={turnKey} upClass="good" />
      <TrackMarker track={TRACKS.threat} value={state.threatIdx} spaces={7} icon="threat" turnKey={turnKey} upClass="bad" />

      {/* Region overlays: the big Eye of Sauron + a Nazgûl count chip */}
      {REGIONS.map((r) => {
        const wraiths = state.wraiths[r.id] ?? 0;
        const hasEye = state.eye === r.id;
        if (wraiths === 0 && !hasEye) return null;
        // The Nazgûl chip sits just below the region point (or the Eye).
        const chipY = r.y + (hasEye ? 66 : 0);
        const cw = 100;
        return (
          <g key={r.id} className="region-chip">
            <title>
              {r.name}: {wraiths} Nazgûl{hasEye ? ' — the Eye of Sauron watches this region' : ''}
            </title>
            {hasEye && (
              <g className="eye-marker">
                <circle cx={r.x} cy={r.y} r={62} className="eye-glow" />
                <image href="/icons/eye.png" x={r.x - 58} y={r.y - 58} width={116} height={116} />
              </g>
            )}
            {wraiths > 0 && (
              <g>
                <rect x={r.x - cw / 2} y={chipY - 26} width={cw} height={52} rx={14} className="chip-bg" />
                <image href="/icons/nazgul.png" x={r.x - cw / 2 + 6} y={chipY - 22} width={44} height={44} />
                <text x={r.x - cw / 2 + 58} y={chipY + 11} className="chip-text">
                  ×{wraiths}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Locations */}
      {LOCATIONS.map((loc) => {
        const shadow = state.shadow[loc.id] ?? 0;
        const friendly = Object.entries(state.friendly[loc.id] ?? {}).filter(([, n]) => (n ?? 0) > 0);
        const friendlyTotal = friendly.reduce((a, [, n]) => a + (n ?? 0), 0);
        const status = state.siteStatus[loc.id];
        const flipped =
          (loc.haven && status === 'stronghold') || (loc.stronghold && status === 'haven');
        const charsHere = Object.keys(state.characters).filter(
          (c) => state.characters[c].location === loc.id,
        );
        const highlight = highlights.get(loc.id);
        const isDoom = loc.id === 'mount_doom';

        const tooltip = [
          `${loc.name} (${REGIONS.find((r) => r.id === loc.region)?.name})`,
          status === 'haven' ? 'Haven — Frodo ignores Exposed here; Prepare is possible' : '',
          status === 'stronghold' ? 'Shadow stronghold — capture with a troop, no shadow troops, and 3 Valor' : '',
          flipped ? '(status flipped from its printed side!)' : '',
          loc.muster ? `Muster location (${loc.muster})` : '',
          shadow ? `${shadow} shadow troops` : '',
          friendlyTotal ? `${friendlyTotal} friendly troops (${friendly.map(([f, n]) => `${n} ${f}`).join(', ')})` : '',
          charsHere.length ? `Characters: ${charsHere.map((c) => CHARACTER_MAP[c].name).join(', ')}` : '',
          isDoom ? 'Mount Doom — destroy the Ring here once every other objective is complete' : '',
        ]
          .filter(Boolean)
          .join('\n');

        return (
          <Fragment key={loc.id}>
            <g className={`loc ${highlight ? 'clickable' : ''}`} onClick={() => onClickLocation(loc.id)}>
              <title>{tooltip}</title>
              {highlight && <circle cx={loc.x} cy={loc.y} r={54} className={`halo halo-${highlight}`} />}
              {/* Click target + selection ring; near-invisible unless relevant */}
              <circle
                cx={loc.x}
                cy={loc.y}
                r={40}
                className={`loc-ring ${selectedLoc === loc.id ? 'selected' : ''} ${highlight ? 'lit' : ''}`}
              />
              {/* Status flip marker: captured stronghold or fallen haven */}
              {flipped && (
                <g>
                  <circle cx={loc.x} cy={loc.y} r={30} className={status === 'haven' ? 'flip-haven' : 'flip-stronghold'} />
                  <text x={loc.x} y={loc.y + 10} textAnchor="middle" className="flip-glyph">
                    {status === 'haven' ? '🕊' : '🔥'}
                  </text>
                </g>
              )}

              {/* Troops */}
              {shadow > 0 && (
                <g>
                  <circle cx={loc.x - 34} cy={loc.y - 34} r={22} className="badge shadow-badge" />
                  <text x={loc.x - 34} y={loc.y - 25} textAnchor="middle" className="badge-text">
                    {shadow}
                  </text>
                </g>
              )}
              {friendlyTotal > 0 && (
                <g>
                  <circle cx={loc.x + 34} cy={loc.y - 34} r={22} className="badge friendly-badge" />
                  <text x={loc.x + 34} y={loc.y - 25} textAnchor="middle" className="badge-text">
                    {friendlyTotal}
                  </text>
                </g>
              )}

              {/* Characters — bold monogram pins, clustered below the node */}
              {charsHere.map((c, i) => {
                const perRow = Math.min(charsHere.length, 3);
                const row = Math.floor(i / 3);
                const col = i % 3;
                const rowCount = Math.min(charsHere.length - row * 3, 3);
                return (
                  <CharPin
                    key={c}
                    id={c}
                    x={loc.x + (col - (rowCount - 1) / 2) * 44}
                    y={loc.y + 62 + row * 46}
                  />
                );
              })}
              {frodoLoc === loc.id && (
                <image href="/icons/resistance.png" x={loc.x - 16} y={loc.y - 76} width={32} height={32} className="frodo-mark" />
              )}
            </g>
          </Fragment>
        );
      })}

      {/* Animation layer: trails, pulses, moving pieces */}
      {(fxTrails ?? []).map((t) => (
        <line key={t.id} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.color} className="fx-trail" />
      ))}
      {fxPulse && (
        <g key={fxPulse.id}>
          <circle cx={fxPulse.x} cy={fxPulse.y} r={30} className="fx-pulse" />
          <text x={fxPulse.x} y={fxPulse.y - 54} textAnchor="middle" className="fx-spawn-text">
            +{fxPulse.count}
          </text>
        </g>
      )}
      {fxMarker && <FxMarker m={fxMarker} />}
    </svg>
  );
}
