import { Fragment } from 'react';
import {
  CHARACTER_MAP,
  LOCATIONS,
  MAP,
  REGIONS,
  type GameState,
  type LocationId,
} from '@emberfall/engine';

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
}: {
  state: GameState;
  highlights: Map<LocationId, string>;
  selectedLoc: LocationId | null;
  onClickLocation: (loc: LocationId) => void;
}) {
  const frodoLoc = state.characters['frodo_sam']?.location;

  return (
    <svg className="map" viewBox="0 0 2500 2143" preserveAspectRatio="xMidYMid meet">
      <image href="/board.jpg" x="0" y="0" width="2500" height="2143" />

      {/* Region chips: Nazgûl count + the Eye of Sauron */}
      {REGIONS.map((r) => {
        const wraiths = state.wraiths[r.id] ?? 0;
        const hasEye = state.eye === r.id;
        if (wraiths === 0 && !hasEye) return null;
        const label = `${hasEye ? '👁 ' : ''}${wraiths > 0 ? `🐉×${wraiths}` : ''}`;
        const w = 60 + label.length * 16;
        return (
          <g key={r.id} className="region-chip">
            <rect x={r.x - w / 2} y={r.y - 26} width={w} height={52} rx={14} className="chip-bg" />
            <text x={r.x} y={r.y + 12} textAnchor="middle" className="chip-text">
              {label}
            </text>
            <title>
              {r.name}: {wraiths} Nazgûl{hasEye ? ' — the Eye of Sauron watches this region' : ''}
            </title>
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

              {/* Characters */}
              {charsHere.map((c, i) => (
                <circle
                  key={c}
                  cx={loc.x - 27 + (i % 4) * 18}
                  cy={loc.y + 40 + Math.floor(i / 4) * 19}
                  r={10}
                  fill={CHARACTER_MAP[c].color}
                  className={`char-pawn ${c === 'frodo_sam' ? 'frodo' : ''}`}
                >
                  <title>{CHARACTER_MAP[c].name}</title>
                </circle>
              ))}
              {frodoLoc === loc.id && (
                <text x={loc.x} y={loc.y - 48} textAnchor="middle" className="frodo-mark">
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
