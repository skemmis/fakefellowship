import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BATTLE_LINES,
  LOCATIONS,
  PATHS,
  REGIONS,
  type BattleLineDef,
  type Faction,
  type LocationDef,
  type LocationId,
  type PathDef,
  type RegionDef,
  type SymbolKind,
} from '@emberfall/engine';

/**
 * Board verification editor (open the game with #editor).
 *
 * Draws the full board dataset over the artwork so mismatches are obvious,
 * and lets a human with the physical board correct everything: drag nodes
 * into place, reassign regions, fix haven/stronghold/muster flags, add or
 * remove paths and set their symbol costs, redraw battle lines, and adjust
 * region adjacency. Export downloads a JSON file to send back for applying.
 */

const SYMBOLS: SymbolKind[] = ['friendship', 'valor', 'stealth', 'resistance'];
const GLYPH: Record<SymbolKind, string> = { friendship: '❤', valor: '⚔', stealth: '🌿', resistance: '◎' };
const FACTIONS: (Faction | 'none')[] = ['none', 'vale', 'riders', 'sylvan', 'deepholm'];
const REGION_COLORS = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4',
  '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080', '#e6beff',
];

type Mode = 'move' | 'region' | 'flags' | 'path' | 'line';

interface BoardData {
  regions: RegionDef[];
  locations: LocationDef[];
  paths: PathDef[];
  battleLines: BattleLineDef[];
}

const STORAGE_KEY = 'fellowship.boardEdits.v1';

function initialData(): BoardData {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as BoardData;
      if (parsed.locations?.length && parsed.paths?.length) return parsed;
    } catch {
      // fall through to fresh data
    }
  }
  return JSON.parse(
    JSON.stringify({ regions: REGIONS, locations: LOCATIONS, paths: PATHS, battleLines: BATTLE_LINES }),
  ) as BoardData;
}

export function Editor() {
  const [data, setData] = useState<BoardData>(initialData);
  const [mode, setMode] = useState<Mode>('move');
  const [selected, setSelected] = useState<LocationId | null>(null);
  const [pathFrom, setPathFrom] = useState<LocationId | null>(null);
  const [selPath, setSelPath] = useState<number | null>(null);
  const [selLine, setSelLine] = useState<string | null>(null);
  const [drawingLine, setDrawingLine] = useState<LocationId[] | null>(null);
  const [selRegion, setSelRegion] = useState<string>(REGIONS[0].id);
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

  const clickLocation = (id: LocationId) => {
    if (mode === 'move' || mode === 'flags') setSelected(id);
    if (mode === 'region') {
      setSelected(id);
      update((d) => {
        d.locations.find((l) => l.id === id)!.region = selRegion;
      });
    }
    if (mode === 'path') {
      if (!pathFrom) {
        setPathFrom(id);
        setSelPath(null);
      } else if (pathFrom === id) {
        setPathFrom(null);
      } else {
        const idx = data.paths.findIndex(
          (p) => (p.a === pathFrom && p.b === id) || (p.a === id && p.b === pathFrom),
        );
        if (idx >= 0) {
          setSelPath(idx);
        } else {
          update((d) => d.paths.push({ a: pathFrom, b: id }));
          setSelPath(data.paths.length);
        }
        setPathFrom(null);
      }
    }
    if (mode === 'line' && drawingLine) {
      setDrawingLine([...drawingLine, id]);
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'fate-board.json';
    a.click();
  };

  const line = selLine ? data.battleLines.find((l) => l.id === selLine) : null;

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

          {/* Paths with cost badges */}
          {data.paths.map((p, i) => {
            const a = locMap[p.a];
            const b = locMap[p.b];
            if (!a || !b) return null;
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            return (
              <g key={i} onClick={() => mode === 'path' && (setSelPath(i), setPathFrom(null))}>
                <line
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  className={`ed-path ${p.cost ? 'special' : ''} ${selPath === i ? 'selected' : ''}`}
                />
                {p.cost && (
                  <g>
                    <rect x={mx - 34} y={my - 20} width={68} height={40} rx={8} className="ed-cost-bg" />
                    <text x={mx} y={my + 10} textAnchor="middle" className="ed-cost-text">
                      {p.cost.map((c) => GLYPH[c]).join('')}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Selected battle line route */}
          {(line || drawingLine) && (
            <polyline
              points={(drawingLine ?? line!.path).map((id) => `${locMap[id]?.x},${locMap[id]?.y}`).join(' ')}
              className="ed-line"
            />
          )}
          {(drawingLine ?? line?.path ?? []).map((id, i) => (
            <text key={i} x={locMap[id]?.x} y={(locMap[id]?.y ?? 0) - 46} textAnchor="middle" className="ed-line-num">
              {i + 1}
            </text>
          ))}

          {/* Location nodes, ringed in their region's color */}
          {data.locations.map((l) => (
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
                className={`ed-node ${selected === l.id ? 'selected' : ''} ${pathFrom === l.id ? 'pathfrom' : ''}`}
                stroke={regionColor[l.region]}
              />
              <text x={l.x} y={l.y - 44} textAnchor="middle" className="ed-node-label">
                {l.name}
                {l.haven ? ' 🏠' : ''}{l.stronghold ? ' 🏴' : ''}{l.shadowLoc ? ' 🔴' : ''}
                {l.muster ? ` +${l.muster[0]}` : ''}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <aside className="editor-side">
        <h2>Board editor</h2>
        <p className="hint">
          Compare against your physical board; every change saves locally. When done, Export and
          send the file back to be applied to the game data.
        </p>
        <div className="ed-modes">
          {(['move', 'region', 'flags', 'path', 'line'] as Mode[]).map((m) => (
            <button key={m} className={mode === m ? 'primary' : ''} onClick={() => { setMode(m); setPathFrom(null); setSelPath(null); }}>
              {m === 'move' ? 'Positions' : m === 'region' ? 'Regions' : m === 'flags' ? 'Location flags' : m === 'path' ? 'Paths & costs' : 'Battle lines'}
            </button>
          ))}
        </div>

        {mode === 'move' && (
          <section className="panel">
            <h3>Positions</h3>
            <p className="hint">Drag any node onto its printed circle on the artwork. {selected ? `Selected: ${locMap[selected]?.name} (${locMap[selected]?.x}, ${locMap[selected]?.y})` : ''}</p>
          </section>
        )}

        {mode === 'region' && (
          <section className="panel">
            <h3>Regions</h3>
            <p className="hint">Pick a region, then click locations to assign them. Ring colors show current assignments.</p>
            <div className="ed-chiprow">
              {data.regions.map((r) => (
                <button
                  key={r.id}
                  className={selRegion === r.id ? 'primary' : ''}
                  style={{ borderColor: regionColor[r.id] }}
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
                      <option key={f} value={f}>{f === 'vale' ? 'gondor (blue)' : f === 'riders' ? 'rohirrim (brown)' : f === 'sylvan' ? 'elven (green)' : f === 'deepholm' ? 'dwarven (grey)' : 'none'}</option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <p className="hint">Click a location to edit its flags.</p>
            )}
          </section>
        )}

        {mode === 'path' && (
          <section className="panel">
            <h3>Paths &amp; costs</h3>
            <p className="hint">
              Click two locations to select their path (or create one if missing).
              {pathFrom ? ` First: ${locMap[pathFrom]?.name} — now click the other end.` : ''}
            </p>
            {selPath !== null && data.paths[selPath] && (
              <>
                <p>
                  <strong>{locMap[data.paths[selPath].a]?.name} ↔ {locMap[data.paths[selPath].b]?.name}</strong>
                  {' — cost: '}
                  {data.paths[selPath].cost?.map((c) => GLYPH[c]).join('') || 'free'}
                </p>
                <div className="ed-chiprow">
                  {SYMBOLS.map((sym) => (
                    <button key={sym} onClick={() => update((d) => {
                      const p = d.paths[selPath];
                      p.cost = [...(p.cost ?? []), sym];
                    })}>
                      +{GLYPH[sym]}
                    </button>
                  ))}
                  <button onClick={() => update((d) => { delete d.paths[selPath].cost; })}>Clear cost</button>
                  <button
                    onClick={() => {
                      update((d) => d.paths.splice(selPath, 1));
                      setSelPath(null);
                    }}
                  >
                    🗑 Delete path
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {mode === 'line' && (
          <section className="panel">
            <h3>Battle lines</h3>
            <p className="hint">Select a line to see its route numbered on the map. Redraw = click locations in order from the shadow location to the haven, then Finish.</p>
            <div className="ed-chiprow">
              {data.battleLines.map((l) => (
                <button key={l.id} className={selLine === l.id ? 'primary' : ''} onClick={() => { setSelLine(l.id); setDrawingLine(null); }}>
                  {l.name}
                </button>
              ))}
            </div>
            {selLine && !drawingLine && (
              <button onClick={() => setDrawingLine([])}>✏️ Redraw this line</button>
            )}
            {drawingLine && (
              <>
                <p className="hint">Clicked so far: {drawingLine.map((id) => locMap[id]?.name).join(' → ') || '(none)'}</p>
                <button
                  className="primary"
                  disabled={drawingLine.length < 2}
                  onClick={() => {
                    update((d) => {
                      const l = d.battleLines.find((x) => x.id === selLine)!;
                      l.path = drawingLine;
                      l.name = `${locMap[drawingLine[0]]?.name} → ${locMap[drawingLine[drawingLine.length - 1]]?.name}`;
                    });
                    setDrawingLine(null);
                  }}
                >
                  Finish line
                </button>
                <button onClick={() => setDrawingLine(null)}>Cancel</button>
              </>
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
            Edits persist in this browser until exported. Send the exported file back (chat upload
            or commit it to the repo as fate-board.json) and it will be applied to the game.
          </p>
        </section>
        <a href="#" onClick={() => location.reload()}>← Back to the game</a>
      </aside>
    </div>
  );
}
