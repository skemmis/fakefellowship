import { Fragment } from 'react';
import {
  HERO_MAP,
  LOCATIONS,
  MAP,
  type GameState,
  type LocationId,
} from '@emberfall/engine';

const REGION_COLORS: Record<string, string> = {
  'The Hearthshires': '#8fbf7f',
  'Vale of Lanterns': '#e8c96a',
  'Windward Steppe': '#c9a76a',
  'Sylvan Reach': '#6fae8f',
  'Deepholm Crags': '#a0a0b8',
  Ashenfell: '#b06a5a',
};

// Deduplicated edge list for drawing roads.
const EDGES: [LocationId, LocationId][] = [];
for (const loc of LOCATIONS) {
  for (const n of loc.adjacent) {
    if (loc.id < n) EDGES.push([loc.id, n]);
  }
}

export function MapView({
  state,
  highlights,
  selectedLoc,
  onClickLocation,
}: {
  state: GameState;
  highlights: Set<LocationId>;
  selectedLoc: LocationId | null;
  onClickLocation: (loc: LocationId) => void;
}) {
  return (
    <svg className="map" viewBox="0 0 1060 640" preserveAspectRatio="xMidYMid meet">
      <rect x="0" y="0" width="1060" height="640" className="map-bg" />
      {/* Roads */}
      {EDGES.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={MAP[a].x}
          y1={MAP[a].y}
          x2={MAP[b].x}
          y2={MAP[b].y}
          className="road"
        />
      ))}
      {/* Locations */}
      {LOCATIONS.map((loc) => {
        const shadow = state.shadow[loc.id] ?? 0;
        const allied = Object.values(state.allied[loc.id] ?? {}).reduce(
          (a, b) => a + (b ?? 0),
          0,
        );
        const sanctuary = state.sanctuaries[loc.id];
        const wraiths = state.wraiths.filter((w) => w.location === loc.id).length;
        const heroesHere = Object.values(state.heroes).filter(
          (h) => h.location === loc.id,
        );
        const bearerHere = state.shardbearer.location === loc.id;
        const highlighted = highlights.has(loc.id);
        const isGoal = loc.id === 'cindermaw';

        return (
          <Fragment key={loc.id}>
            <g
              className={`loc ${highlighted ? 'highlight' : ''} ${selectedLoc === loc.id ? 'selected' : ''}`}
              onClick={() => onClickLocation(loc.id)}
            >
              {/* Node */}
              <circle
                cx={loc.x}
                cy={loc.y}
                r={isGoal ? 26 : loc.sanctuary ? 24 : 18}
                fill={REGION_COLORS[loc.region] ?? '#999'}
                className={`loc-node ${sanctuary === 'fallen' ? 'fallen' : ''} ${loc.stronghold ? 'stronghold' : ''} ${isGoal ? 'goal' : ''}`}
              />
              {highlighted && (
                <circle cx={loc.x} cy={loc.y} r={isGoal ? 31 : loc.sanctuary ? 29 : 23} className="halo" />
              )}
              {sanctuary && (
                <text x={loc.x} y={loc.y - (loc.sanctuary ? 30 : 24)} className="sanctuary-mark" textAnchor="middle">
                  {sanctuary === 'standing' ? '🏰' : sanctuary === 'besieged' ? '⚔️🏰' : '🏚️'}
                </text>
              )}
              {loc.stronghold && (
                <text x={loc.x} y={loc.y - 24} className="sanctuary-mark" textAnchor="middle">
                  🗼
                </text>
              )}
              {isGoal && (
                <text x={loc.x} y={loc.y - 30} className="sanctuary-mark" textAnchor="middle">
                  🌋
                </text>
              )}
              {/* Name */}
              <text x={loc.x} y={loc.y + (loc.sanctuary || isGoal ? 40 : 34)} className="loc-name" textAnchor="middle">
                {loc.name}
              </text>
              {/* Troops */}
              {shadow > 0 && (
                <g>
                  <circle cx={loc.x - 16} cy={loc.y - 14} r={10} className="badge shadow-badge" />
                  <text x={loc.x - 16} y={loc.y - 10} className="badge-text" textAnchor="middle">
                    {shadow}
                  </text>
                </g>
              )}
              {allied > 0 && (
                <g>
                  <circle cx={loc.x + 16} cy={loc.y - 14} r={10} className="badge allied-badge" />
                  <text x={loc.x + 16} y={loc.y - 10} className="badge-text" textAnchor="middle">
                    {allied}
                  </text>
                </g>
              )}
              {/* Wraiths */}
              {wraiths > 0 && (
                <text x={loc.x} y={loc.y + 6} className="wraith-mark" textAnchor="middle">
                  {'👁'.repeat(Math.min(wraiths, 3))}
                  {wraiths > 3 ? `×${wraiths}` : ''}
                </text>
              )}
              {/* Heroes */}
              {heroesHere.map((h, i) => (
                <circle
                  key={h.id}
                  cx={loc.x - 12 + i * 8}
                  cy={loc.y + 16}
                  r={5}
                  fill={HERO_MAP[h.id].color}
                  className="hero-pawn"
                >
                  <title>{HERO_MAP[h.id].name}</title>
                </circle>
              ))}
              {/* Shardbearer */}
              {bearerHere && (
                <text x={loc.x} y={loc.y - 4} className="bearer-mark" textAnchor="middle">
                  {state.shardbearer.hidden ? '🍂' : '🔥'}
                </text>
              )}
            </g>
          </Fragment>
        );
      })}
    </svg>
  );
}
