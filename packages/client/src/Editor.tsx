import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BATTLE_LINES,
  EDGES,
  LOCATIONS,
  REGIONS,
  type EdgeDef,
  type Faction,
  type LocationDef,
  type LocationId,
  type RegionDef,
  type SymbolKind,
} from '@emberfall/engine';

/**
 * Board verification editor (open the game with #editor).
 *
 * The board is a set of NODES (locations) joined by EDGES. Each edge is
 * either a white path (players only, optional symbol cost) or a battle line
 * segment (colored, directed arrow). Select two nodes to declare exactly
 * what runs between them. Full battle lines are derived automatically by
 * chaining same-colored segments, and shown for verification.
 */

const SYMBOLS: SymbolKind[] = ['friendship', 'valor', 'stealth', 'resistance'];
const GLYPH: Record<SymbolKind, string> = { friendship: '❤', valor: '⚔', stealth: '🌿', resistance: '◎' };
const FACTIONS: (Faction | 'none')[] = ['none', 'vale', 'riders', 'sylvan', 'deepholm'];
const REGION_COLORS = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4',
  '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080', '#e6beff',
];
/**
 * The board's six printed battle-line colors. Routes outnumber colors, so
 * a color repeats on routes that never touch (the derivation splits
 * disconnected same-color chains into separate lines).
 */
const LINE_PALETTE = [
  '#e8834a', // orange
  '#3fa8a0', // teal
  '#e8cf4f', // yellow
  '#9acd5a', // light green
  '#8f6fc0', // purple
  '#e87fb0', // pink
];

type Mode = 'move' | 'region' | 'flags' | 'edges';

interface BoardData {
  regions: RegionDef[];
  locations: LocationDef[];
  edges: EdgeDef[];
}

const STORAGE_KEY = 'fellowship.boardEdits.v2';

function initialData(): BoardData {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as BoardData;
      if (parsed.locations?.length && parsed.edges) return parsed;
    } catch {
      // fall through
    }
  }
  return JSON.parse(JSON.stringify({ regions: REGIONS, locations: LOCATIONS, edges: EDGES })) as BoardData;
}

/** Chain same-colored directed segments into full battle lines (preview). */
function deriveLines(edges: EdgeDef[], locName: (id: LocationId) => string) {
  const byColor = new Map<string, { from: LocationId; to: LocationId }[]>();
  for (const e of edges) {
    if (e.kind !== 'line') continue;
    const color = e.color ?? '#999';
    const from = e.dir === 'ba' ? e.b : e.a;
    const to = e.dir === 'ba' ? e.a : e.b;
    if (!byColor.has(color)) byColor.set(color, []);
    byColor.get(color)!.push({ from, to });
  }
  const out: { color: string; route: string; stops: number }[] = [];
  for (const [color, segs] of byColor) {
    const outgoing = new Map<LocationId, LocationId[]>();
    const incoming = new Set<LocationId>();
    for (const s of segs) {
      if (!outgoing.has(s.from)) outgoing.set(s.from, []);
      outgoing.get(s.from)!.push(s.to);
      incoming.add(s.to);
    }
    const starts = [...outgoing.keys()].filter((n) => !incoming.has(n)).sort();
    if (starts.length === 0 && segs.length > 0) {
      out.push({ color, route: '⚠ segments form a loop — check directions', stops: segs.length });
    }
    for (const start of starts) {
      const walk = (node: LocationId, path: LocationId[], guard: number): void => {
        const nexts = outgoing.get(node) ?? [];
        if (nexts.length === 0 || guard > 40) {
          if (path.length >= 2) {
            out.push({ color, route: path.map(locName).join(' → '), stops: path.length });
          }
          return;
        }
        for (const n of nexts) walk(n, [...path, n], guard + 1);
      };
      walk(start, [start], 0);
    }
  }
  return out.sort((a, b) => a.color.localeCompare(b.color));
}

export function Editor() {
  const [data, setData] = useState<BoardData>(initialData);
  const [mode, setMode] = useState<Mode>('edges');
  const [selected, setSelected] = useState<LocationId | null>(null);
  const [pair, setPair] = useState<[LocationId, LocationId] | null>(null);
  const [pairFrom, setPairFrom] = useState<LocationId | null>(null);
  const [selRegion, setSelRegion] = useState<string>(REGIONS[0].id);
  const [view, setView] = useState({ nodes: true, paths: true, lines: true, labels: true });
  const [boardOnly, setBoardOnly] = useState(false);
  const [lastPaint, setLastPaint] = useState<string | null>(null);
  const dragging = useRef<LocationId | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const locMap = useMemo(() => Object.fromEntries(data.locations.map((l) => [l.id, l])), [data]);
  const regionColor = useMemo(
    () => Object.fromEntries(data.regions.map((r, i) => [r.id, REGION_COLORS[i % REGION_COLORS.length]])),
    [data.regions],
  );
  const derivedLines = useMemo(
    () => deriveLines(data.edges, (id) => locMap[id]?.name ?? id),
    [data.edges, locMap],
  );

  const toSvg = (e: React.PointerEvent): { x: number; y: number } => {
    const svg = svgRef.current!;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: Math.round(pt.x), y: Math.round(pt.y) };
  };

  const update = (fn: (d: BoardData) => void) => {
    setData((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as BoardData;
      fn(next);
      return next;
    });
  };

  const samePair = (e: EdgeDef, x: LocationId, y: LocationId) =>
    (e.a === x && e.b === y) || (e.a === y && e.b === x);

  const pairEdges = pair ? data.edges.map((e, i) => ({ e, i })).filter(({ e }) => samePair(e, pair[0], pair[1])) : [];

  const clickLocation = (id: LocationId) => {
    if (mode === 'move' || mode === 'flags') setSelected(id);
    if (mode === 'region') {
      setSelected(id);
      update((d) => {
        d.locations.find((l) => l.id === id)!.region = selRegion;
      });
      setLastPaint(`${locMap[id]?.name} → ${data.regions.find((r) => r.id === selRegion)?.name}`);
    }
    if (mode === 'edges') {
      if (!pairFrom) {
        setPairFrom(id);
        setPair(null);
      } else if (pairFrom === id) {
        setPairFrom(null);
      } else {
        setPair([pairFrom, id]);
        setPairFrom(null);
      }
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ version: 2, ...data }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'fate-board.json';
    a.click();
  };

  // Group edges by pair for parallel-offset rendering.
  const pairKey = (e: EdgeDef) => [e.a, e.b].sort().join('|');
  const edgeGroups = useMemo(() => {
    const groups = new Map<string, number>();
    return data.edges.map((e) => {
      const k = pairKey(e);
      const idx = groups.get(k) ?? 0;
      groups.set(k, idx + 1);
      return idx;
    });
  }, [data.edges]);
  const groupSizes = useMemo(() => {
    const sizes = new Map<string, number>();
    for (const e of data.edges) sizes.set(pairKey(e), (sizes.get(pairKey(e)) ?? 0) + 1);
    return sizes;
  }, [data.edges]);

  return (
    <div className="editor">
      <div className="editor-map">
        <svg
          ref={svgRef}
          viewBox="0 0 2500 2143"
          preserveAspectRatio="xMidYMid meet"
          onPointerMove={(e) => {
            if (dragging.current) {
              const { x, y } = toSvg(e);
              update((d) => {
                const l = d.locations.find((ll) => ll.id === dragging.current);
                if (l) {
                  l.x = x;
                  l.y = y;
                }
              });
            }
          }}
          onPointerUp={() => (dragging.current = null)}
        >
          <image href="/board.jpg" x="0" y="0" width="2500" height="2143" />

          {/* Edges */}
          {data.edges.map((e, i) => {
            if (boardOnly) return null;
            if (e.kind === 'line' && !view.lines) return null;
            if (e.kind === 'path' && !view.paths) return null;
            const a = locMap[e.a];
            const b = locMap[e.b];
            if (!a || !b) return null;
            // Parallel offset when several edges join the same pair.
            const n = groupSizes.get(pairKey(e)) ?? 1;
            const off = (edgeGroups[i] - (n - 1) / 2) * 16;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 1;
            const ox = (-dy / len) * off;
            const oy = (dx / len) * off;
            const x1 = a.x + ox, y1 = a.y + oy, x2 = b.x + ox, y2 = b.y + oy;
            const isSel = pair && samePair(e, pair[0], pair[1]);
            // Arrowhead for line segments (at 62% along, pointing with the arrow).
            let arrow = null;
            if (e.kind === 'line') {
              const fx = e.dir === 'ba' ? x2 : x1;
              const fy = e.dir === 'ba' ? y2 : y1;
              const tx = e.dir === 'ba' ? x1 : x2;
              const ty = e.dir === 'ba' ? y1 : y2;
              const t = 0.62;
              const mx = fx + (tx - fx) * t;
              const my = fy + (ty - fy) * t;
              const ang = (Math.atan2(ty - fy, tx - fx) * 180) / Math.PI;
              arrow = (
                <polygon
                  points="0,-14 26,0 0,14"
                  transform={`translate(${mx},${my}) rotate(${ang})`}
                  fill={e.color ?? '#999'}
                  stroke="#14120e"
                  strokeWidth="2"
                />
              );
            }
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            return (
              <g key={i} onClick={() => mode === 'edges' && (setPair([e.a, e.b]), setPairFrom(null))}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  className={`ed-edge ${e.kind} ${isSel ? 'selected' : ''}`}
                  stroke={e.kind === 'line' ? e.color ?? '#999' : undefined}
                />
                {arrow}
                {e.cost && (
                  <g>
                    <rect x={mx - 34} y={my - 20} width={68} height={40} rx={8} className="ed-cost-bg" />
                    <text x={mx} y={my + 10} textAnchor="middle" className="ed-cost-text">
                      {e.cost.map((c) => GLYPH[c]).join('')}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Location nodes */}
          {!boardOnly &&
            view.nodes &&
            data.locations.map((l) => (
              <g
                key={l.id}
                onPointerDown={(e) => {
                  if (mode === 'move') {
                    dragging.current = l.id;
                    setSelected(l.id);
                    e.preventDefault();
                  }
                }}
                onClick={() => clickLocation(l.id)}
              >
                <circle
                  cx={l.x} cy={l.y} r={38}
                  className={`ed-node ${selected === l.id || pair?.includes(l.id) ? 'selected' : ''} ${pairFrom === l.id ? 'pathfrom' : ''}`}
                  stroke={regionColor[l.region]}
                  style={mode === 'region' ? { fill: regionColor[l.region], fillOpacity: 0.5 } : undefined}
                />
                {view.labels && (
                  <text x={l.x} y={l.y - 44} textAnchor="middle" className="ed-node-label">
                    {l.name}
                    {l.haven ? ' 🏠' : ''}{l.stronghold ? ' 🏴' : ''}{l.shadowLoc ? ' 🔴' : ''}
                    {l.muster ? ` +${l.muster[0]}` : ''}
                  </text>
                )}
              </g>
            ))}
        </svg>
      </div>

      <aside className="editor-side">
        <h2>Board editor</h2>
        <div className="ed-modes">
          {(['edges', 'move', 'region', 'flags'] as Mode[]).map((m) => (
            <button key={m} className={mode === m ? 'primary' : ''} onClick={() => { setMode(m); setPairFrom(null); }}>
              {m === 'edges' ? 'Edges' : m === 'move' ? 'Positions' : m === 'region' ? 'Regions' : 'Location flags'}
            </button>
          ))}
        </div>

        <section className="panel">
          <h3>View</h3>
          <div className="ed-chiprow">
            <button
              className={boardOnly ? 'primary' : ''}
              onClick={() => setBoardOnly(!boardOnly)}
              title="Hide every overlay to inspect the raw board art"
            >
              🗺 Board only
            </button>
            {(
              [
                ['nodes', 'Nodes'],
                ['labels', 'Labels'],
                ['paths', 'White paths'],
                ['lines', 'Line segments'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="check">
                <input
                  type="checkbox"
                  checked={view[key]}
                  disabled={boardOnly}
                  onChange={(e) => setView({ ...view, [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
        </section>

        {mode === 'edges' && (
          <>
            <section className="panel">
              <h3>Edges</h3>
              <p className="hint">
                Click two nodes (or an existing edge) to select a pair, then declare what connects
                them: a white path (with any symbol cost) and/or battle line segments (colored,
                with an arrow direction).
                {pairFrom ? ` First node: ${locMap[pairFrom]?.name} — click the second.` : ''}
              </p>
              {pair && (
                <>
                  <p>
                    <strong>{locMap[pair[0]]?.name} ↔ {locMap[pair[1]]?.name}</strong>
                  </p>
                  {pairEdges.length === 0 && <p className="hint">No edges between these yet.</p>}
                  {pairEdges.map(({ e, i }) => (
                    <div key={i} className="ed-edge-row">
                      {e.kind === 'path' ? (
                        <>
                          <span>⚪ White path — cost: {e.cost?.map((c) => GLYPH[c]).join('') || 'free'}</span>
                          <div className="ed-chiprow">
                            {SYMBOLS.map((sym) => (
                              <button key={sym} className="mini" onClick={() => update((d) => {
                                d.edges[i].cost = [...(d.edges[i].cost ?? []), sym];
                              })}>
                                +{GLYPH[sym]}
                              </button>
                            ))}
                            <button className="mini" onClick={() => update((d) => { delete d.edges[i].cost; })}>free</button>
                            <button className="mini" onClick={() => update((d) => { d.edges.splice(i, 1); })}>🗑</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span>
                            <span className="ed-swatch" style={{ background: e.color }} /> Battle line segment,{' '}
                            arrow: {locMap[e.dir === 'ba' ? e.b : e.a]?.name} → {locMap[e.dir === 'ba' ? e.a : e.b]?.name}
                            {' — '}player cost: {e.cost?.map((c) => GLYPH[c]).join('') || 'free'}
                          </span>
                          <div className="ed-chiprow">
                            {SYMBOLS.map((sym) => (
                              <button key={sym} className="mini" title={`Players traversing this segment spend ${sym}`} onClick={() => update((d) => {
                                d.edges[i].cost = [...(d.edges[i].cost ?? []), sym];
                              })}>
                                +{GLYPH[sym]}
                              </button>
                            ))}
                            <button className="mini" onClick={() => update((d) => { delete d.edges[i].cost; })}>free</button>
                          </div>
                          <div className="ed-chiprow">
                            {LINE_PALETTE.map((c, ci) => (
                              <button
                                key={c}
                                className={`ed-swatch-btn ${e.color === c ? 'selected' : ''}`}
                                style={{ background: c }}
                                title={['orange', 'teal', 'yellow', 'light green', 'purple', 'pink'][ci]}
                                onClick={() => update((d) => { d.edges[i].color = c; })}
                              />
                            ))}
                            <button className="mini" onClick={() => update((d) => {
                              d.edges[i].dir = d.edges[i].dir === 'ba' ? 'ab' : 'ba';
                            })}>
                              ⇄ flip arrow
                            </button>
                            <button className="mini" onClick={() => update((d) => { d.edges.splice(i, 1); })}>🗑</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  <div className="ed-chiprow">
                    <button onClick={() => update((d) => d.edges.push({ a: pair[0], b: pair[1], kind: 'path' }))}>
                      ➕ White path
                    </button>
                    <button
                      onClick={() =>
                        update((d) =>
                          d.edges.push({
                            a: pair[0],
                            b: pair[1],
                            kind: 'line',
                            color: LINE_PALETTE[d.edges.filter((x) => x.kind === 'line').length % LINE_PALETTE.length],
                            dir: 'ab',
                          }),
                        )
                      }
                    >
                      ➕ Line segment
                    </button>
                  </div>
                </>
              )}
              <div className="ed-chiprow">
                <button
                  onClick={() => {
                    if (confirm('Delete ALL edges (paths and line segments) and rebuild from scratch?')) {
                      update((d) => {
                        d.edges = [];
                      });
                      setPair(null);
                    }
                  }}
                >
                  🗑 Clear ALL edges
                </button>
              </div>
            </section>
            <section className="panel">
              <h3>Derived battle lines ({derivedLines.length})</h3>
              <p className="hint">
                Chained automatically from same-colored segments — check each matches a printed route.
              </p>
              <ul className="ed-derived">
                {derivedLines.map((l, i) => (
                  <li key={i}>
                    <span className="ed-swatch" style={{ background: l.color }} /> {l.route}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {mode === 'move' && (
          <section className="panel">
            <h3>Positions</h3>
            <p className="hint">
              Drag any node onto its printed circle.{' '}
              {selected ? `Selected: ${locMap[selected]?.name} (${locMap[selected]?.x}, ${locMap[selected]?.y})` : ''}
            </p>
          </section>
        )}

        {mode === 'region' && (
          <section className="panel">
            <h3>Regions</h3>
            <p className="hint">
              Pick a region, then click locations to paint them — nodes fill with their region's
              color in this mode.
            </p>
            {lastPaint && <p className="ed-feedback">✔ Painted: {lastPaint}</p>}
            <div className="ed-chiprow">
              {data.regions.map((r) => (
                <button
                  key={r.id}
                  className={selRegion === r.id ? 'primary' : ''}
                  style={{ borderColor: regionColor[r.id], borderWidth: 2 }}
                  onClick={() => setSelRegion(r.id)}
                >
                  {r.name}
                </button>
              ))}
            </div>
            <h3>Region adjacency (Nazgûl movement)</h3>
            <p className="hint">Toggle which regions border {data.regions.find((r) => r.id === selRegion)?.name}:</p>
            <div className="ed-chiprow">
              {data.regions.filter((r) => r.id !== selRegion).map((r) => {
                const cur = data.regions.find((x) => x.id === selRegion)!;
                const adj = cur.adjacent.includes(r.id);
                return (
                  <button
                    key={r.id}
                    className={adj ? 'primary' : ''}
                    onClick={() =>
                      update((d) => {
                        const a = d.regions.find((x) => x.id === selRegion)!;
                        const b = d.regions.find((x) => x.id === r.id)!;
                        if (a.adjacent.includes(r.id)) {
                          a.adjacent = a.adjacent.filter((x) => x !== r.id);
                          b.adjacent = b.adjacent.filter((x) => x !== selRegion);
                        } else {
                          a.adjacent.push(r.id);
                          b.adjacent.push(selRegion);
                        }
                      })
                    }
                  >
                    {r.name}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {mode === 'flags' && (
          <section className="panel">
            <h3>Location flags</h3>
            {selected ? (
              <>
                <p><strong>{locMap[selected]?.name}</strong></p>
                {(['haven', 'stronghold', 'shadowLoc', 'stopsSpawnWhenCaptured'] as const).map((flag) => (
                  <label key={flag} className="check">
                    <input
                      type="checkbox"
                      checked={Boolean(locMap[selected]?.[flag])}
                      onChange={(e) =>
                        update((d) => {
                          const l = d.locations.find((ll) => ll.id === selected)!;
                          const rec = l as unknown as Record<string, unknown>;
                          if (e.target.checked) rec[flag] = true;
                          else delete rec[flag];
                        })
                      }
                    />
                    {flag === 'haven' ? 'Haven 🏠' : flag === 'stronghold' ? 'Shadow stronghold 🏴' : flag === 'shadowLoc' ? 'Shadow (red) location 🔴' : 'Capture stops spawns'}
                  </label>
                ))}
                <label className="check">
                  Muster:
                  <select
                    value={locMap[selected]?.muster ?? 'none'}
                    onChange={(e) =>
                      update((d) => {
                        const l = d.locations.find((ll) => ll.id === selected)!;
                        if (e.target.value === 'none') delete l.muster;
                        else l.muster = e.target.value as Faction;
                      })
                    }
                  >
                    {FACTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f === 'vale' ? 'gondor (blue)' : f === 'riders' ? 'rohirrim (brown)' : f === 'sylvan' ? 'elven (green)' : f === 'deepholm' ? 'dwarven (grey)' : 'none'}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <p className="hint">Click a location to edit its flags.</p>
            )}
          </section>
        )}

        <section className="panel">
          <h3>Save / export</h3>
          <div className="ed-chiprow">
            <button className="primary" onClick={exportJson}>⬇ Export fate-board.json</button>
            <button
              onClick={() => {
                if (confirm('Discard all local edits and reload the shipped board data?')) {
                  localStorage.removeItem(STORAGE_KEY);
                  location.reload();
                }
              }}
            >
              Reset to shipped data
            </button>
          </div>
          <p className="hint">
            Edits persist in this browser until exported. Send the exported file back and it
            becomes the game's board data.
          </p>
        </section>
        <a href="#" onClick={() => location.reload()}>← Back to the game</a>
      </aside>
    </div>
  );
}
