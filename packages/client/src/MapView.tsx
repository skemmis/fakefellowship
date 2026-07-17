import { Fragment } from 'react';
import {
  BATTLE_LINES,
  CHARACTER_MAP,
  LOCATIONS,
  MAP,
  PATHS,
  REGIONS,
  type GameState,
  type LocationId,
} from '@emberfall/engine';

const LINE_COLORS: Record<string, string> = {
  moria_line: '#7fae6f',
  shire_line: '#9a6fae',
  helms_line: '#5fb3a1',
  west_gondor_line: '#d1766a',
  lorien_line: '#d9c26a',
  wood_line: '#6fa8d1',
  erebor_line: '#c98ad1',
  rohan_line: '#66c2d6',
  tirith_line: '#e0c050',
  south_amroth_line: '#b08ad1',
  harad_line: '#e08a6a',
  umbar_line: '#8a9ad1',
};

const SYMBOL_GLYPH: Record<string, string> = {
  friendship: '❤',
  valor: '⚔',
  stealth: '🌿',
  resistance: '◎',
};

export function MapView({
  state,
  highlights,
  selectedLoc,
  onClickLocation,
}: {
  state: GameState;
  highlights: Map<LocationId, string>;
  selectedLoc: LocationId | null;
  onClickLocation: (loc: LocationId) => void;
}) {
  const frodoLoc = state.characters['frodo_sam']?.location;
  return (
    <svg className="map" viewBox="30 30 1000 850" preserveAspectRatio="xMidYMid meet">
      <rect x="30" y="30" width="1000" height="850" className="map-bg" />

      {/* Region labels + Nazgûl + the Eye */}
      {REGIONS.map((r) => {
        const wraiths = state.wraiths[r.id] ?? 0;
        const hasEye = state.eye === r.id;
        return (
          <g key={r.id} className="region-label">
            <text x={r.x} y={r.y} textAnchor="middle" className="region-name">
              {r.name.toUpperCase()}
            </text>
            {(wraiths > 0 || hasEye) && (
              <text x={r.x} y={r.y + 22} textAnchor="middle" className="region-badges">
                {hasEye ? '👁 ' : ''}
                {wraiths > 0 ? `🐉×${wraiths}` : ''}
                <title>
                  {r.name}: {wraiths} Nazgûl{hasEye ? ' — the Eye of Sauron watches this region' : ''}
                </title>
              </text>
            )}
          </g>
        );
      })}

      {/* Battle lines (under paths) */}
      {BATTLE_LINES.map((line) => {
        const pts = line.path.map((id) => MAP[id]);
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
        return (
          <g key={line.id}>
            <path d={d} className="battle-line" stroke={LINE_COLORS[line.id] ?? '#888'}>
              <title>Battle line: {line.name}</title>
            </path>
          </g>
        );
      })}

      {/* Normal + special paths */}
      {PATHS.map((p, i) => {
        const a = MAP[p.a];
        const b = MAP[p.b];
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        return (
          <g key={i}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={p.cost ? 'path special' : 'path'} />
            {p.cost && (
              <g>
                <rect x={midX - 13} y={midY - 9} width={26} height={18} rx={4} className="cost-badge" />
                <text x={midX} y={midY + 4} textAnchor="middle" className="cost-text">
                  {p.cost.map((c) => SYMBOL_GLYPH[c]).join('')}
                </text>
                <title>{`Special path: costs ${p.cost.join(' + ')} to travel`}</title>
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
        const charsHere = Object.keys(state.characters).filter(
          (c) => state.characters[c].location === loc.id,
        );
        const highlight = highlights.get(loc.id);
        const isDoom = loc.id === 'mount_doom';

        const tooltip = [
          `${loc.name} (${REGIONS.find((r) => r.id === loc.region)?.name})`,
          status === 'haven' ? 'Haven — Frodo ignores Exposed here; Prepare is possible' : '',
          status === 'stronghold' ? 'Shadow stronghold — capture with a troop, no shadow, and 3 Valor' : '',
          loc.muster ? `Muster: ${loc.muster}` : '',
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
              {highlight && <circle cx={loc.x} cy={loc.y} r={24} className={`halo halo-${highlight}`} />}
              <circle
                cx={loc.x}
                cy={loc.y}
                r={isDoom ? 17 : 14}
                className={[
                  'loc-node',
                  status === 'haven' ? 'haven' : '',
                  status === 'stronghold' ? 'stronghold' : '',
                  loc.shadowLoc ? 'shadow-loc' : '',
                  isDoom ? 'doom' : '',
                  selectedLoc === loc.id ? 'selected' : '',
                ].join(' ')}
              />
              {loc.muster && (
                <text x={loc.x} y={loc.y + 4} textAnchor="middle" className={`muster-glyph muster-${loc.muster}`}>
                  {loc.muster === 'deepholm' ? '⛏' : loc.muster === 'sylvan' ? '☘' : loc.muster === 'riders' ? '🐎' : '🌳'}
                </text>
              )}
              {isDoom && (
                <text x={loc.x} y={loc.y + 5} textAnchor="middle" className="doom-glyph">
                  🌋
                </text>
              )}
              <text x={loc.x} y={loc.y + 28} textAnchor="middle" className="loc-name">
                {loc.name}
              </text>

              {/* Troops */}
              {shadow > 0 && (
                <g>
                  <circle cx={loc.x - 14} cy={loc.y - 12} r={9} className="badge shadow-badge" />
                  <text x={loc.x - 14} y={loc.y - 8} textAnchor="middle" className="badge-text">
                    {shadow}
                  </text>
                </g>
              )}
              {friendlyTotal > 0 && (
                <g>
                  <circle cx={loc.x + 14} cy={loc.y - 12} r={9} className="badge friendly-badge" />
                  <text x={loc.x + 14} y={loc.y - 8} textAnchor="middle" className="badge-text">
                    {friendlyTotal}
                  </text>
                </g>
              )}

              {/* Characters */}
              {charsHere.map((c, i) => (
                <circle
                  key={c}
                  cx={loc.x - 12 + (i % 4) * 8}
                  cy={loc.y + 13 + Math.floor(i / 4) * 8}
                  r={4.5}
                  fill={CHARACTER_MAP[c].color}
                  className={`char-pawn ${c === 'frodo_sam' ? 'frodo' : ''}`}
                >
                  <title>{CHARACTER_MAP[c].name}</title>
                </circle>
              ))}
              {frodoLoc === loc.id && (
                <text x={loc.x} y={loc.y - 20} textAnchor="middle" className="frodo-mark">
                  💍
                </text>
              )}
            </g>
          </Fragment>
        );
      })}
    </svg>
  );
}
