import type {
  BattleLineDef,
  EdgeDef,
  LocationDef,
  LocationId,
  PathDef,
  RegionDef,
  RegionId,
  SymbolKind,
} from '../types.js';

/**
 * The board, transcribed from the rulebook and a high-resolution photograph
 * of the game map: 12 regions, 52 locations, 9 printed havens, 7 shadow
 * strongholds, 10 shadow (spawn) locations, 12 battle lines.
 *
 * Anything that couldn't be read with certainty (a few path routes and
 * battle-line orderings) is a best-effort reconstruction — each is a
 * one-line fix here when checked against the physical board.
 */

export const REGIONS: RegionDef[] = [
  // The rulebook's Nazgûl example implies the Misty Mountains do not border
  // Eriador directly (movement from there goes via Rhudaur or Enedwaith).
  { id: 'eriador', name: 'Eriador', adjacent: ['rhudaur', 'enedwaith'], x: 350, y: 700 },
  { id: 'rhudaur', name: 'Rhudaur', adjacent: ['eriador', 'misty_mountains'], x: 1258, y: 330 },
  { id: 'misty_mountains', name: 'Misty Mountains', adjacent: ['rhudaur', 'enedwaith', 'rohan', 'mirkwood'], x: 1085, y: 655 },
  { id: 'enedwaith', name: 'Enedwaith', adjacent: ['eriador', 'misty_mountains', 'rohan', 'gondor'], x: 700, y: 800 },
  { id: 'rohan', name: 'Rohan', adjacent: ['enedwaith', 'misty_mountains', 'mirkwood', 'rhovanion', 'gondor'], x: 1370, y: 850 },
  { id: 'gondor', name: 'Gondor', adjacent: ['enedwaith', 'rohan', 'ithilien', 'haradwaith'], x: 930, y: 1340 },
  { id: 'ithilien', name: 'Ithilien', adjacent: ['gondor', 'mordor', 'haradwaith', 'rhovanion'], x: 1610, y: 1480 },
  { id: 'mordor', name: 'Mordor', adjacent: ['ithilien', 'rhovanion', 'haradwaith'], x: 2140, y: 1560 },
  { id: 'rhovanion', name: 'Rhovanion', adjacent: ['rohan', 'mirkwood', 'dale', 'mordor', 'ithilien'], x: 2075, y: 795 },
  { id: 'mirkwood', name: 'Mirkwood', adjacent: ['misty_mountains', 'rohan', 'rhovanion', 'dale'], x: 1500, y: 470 },
  { id: 'dale', name: 'Dale', adjacent: ['mirkwood', 'rhovanion'], x: 1870, y: 100 },
  { id: 'haradwaith', name: 'Haradwaith', adjacent: ['gondor', 'ithilien', 'mordor'], x: 1330, y: 1700 },
];

const L = (
  id: LocationId,
  name: string,
  region: RegionId,
  x: number,
  y: number,
  opts: Partial<LocationDef> = {},
): LocationDef => ({ id, name, region, x, y, ...opts });

export const LOCATIONS: LocationDef[] = [
  // Eriador
  L('grey_havens', 'Grey Havens', 'eriador', 233, 390, { haven: true, muster: 'sylvan' }),
  L('ered_luin', 'Ered Luin', 'eriador', 205, 240, { muster: 'deepholm' }),
  L('the_shire', 'The Shire', 'eriador', 383, 325, { haven: true }),
  L('bree', 'Bree', 'eriador', 563, 395),
  L('sarn_ford', 'Sarn Ford', 'eriador', 455, 560),
  L('weather_hills', 'Weather Hills', 'eriador', 720, 350),
  L('tharbad', 'Tharbad', 'eriador', 723, 555),
  // Rhudaur
  L('rivendell', 'Rivendell', 'rhudaur', 1023, 225, { haven: true, muster: 'sylvan' }),
  // Misty Mountains
  L('hollin', 'Hollin', 'misty_mountains', 995, 435),
  L('moria', 'Moria', 'misty_mountains', 1205, 445, { shadowLoc: true, stronghold: true, stopsSpawnWhenCaptured: true }),
  L('gladden_fields', 'Gladden Fields', 'misty_mountains', 1330, 430),
  L('carrock', 'Carrock', 'misty_mountains', 1278, 230),
  // Enedwaith
  L('dunland', 'Dunland', 'enedwaith', 878, 630, { shadowLoc: true }),
  L('isengard', 'Isengard', 'enedwaith', 995, 748, { shadowLoc: true, stronghold: true, stopsSpawnWhenCaptured: true }),
  L('druwaith_iaur', 'Drúwaith Iaur', 'enedwaith', 665, 909),
  // Rohan
  L('fords_of_isen', 'Fords of Isen', 'rohan', 872, 940, { muster: 'riders' }),
  L('helms_deep', "Helm's Deep", 'rohan', 1063, 949, { haven: true, muster: 'riders' }),
  L('edoras', 'Edoras', 'rohan', 1193, 1024, { muster: 'riders' }),
  L('eastemnet', 'Eastemnet', 'rohan', 1313, 909, { muster: 'riders' }),
  L('fangorn_forest', 'Fangorn Forest', 'rohan', 1128, 742),
  // Gondor
  L('minas_tirith', 'Minas Tirith', 'gondor', 1480, 1205, { haven: true, muster: 'vale' }),
  L('osgiliath', 'Osgiliath', 'gondor', 1660, 1175),
  L('druadan_forest', 'Drúadan Forest', 'gondor', 1360, 1135),
  L('pelargir', 'Pelargir', 'gondor', 1450, 1352, { muster: 'vale' }),
  L('dol_amroth', 'Dol Amroth', 'gondor', 1068, 1400, { haven: true, muster: 'vale' }),
  L('lamedon', 'Lamedon', 'gondor', 1290, 1280, { muster: 'vale' }),
  L('erech', 'Erech', 'gondor', 1053, 1139),
  L('pinnath_gelin', 'Pinnath Gelin', 'gondor', 665, 1244),
  // Ithilien
  L('north_ithilien', 'North Ithilien', 'ithilien', 1560, 1040),
  L('south_ithilien', 'South Ithilien', 'ithilien', 1635, 1338),
  // Mordor
  L('minas_morgul', 'Minas Morgul', 'mordor', 1827, 1295, { shadowLoc: true, stronghold: true }),
  L('mount_doom', 'Mount Doom', 'mordor', 1870, 1127),
  L('plateau_of_gorgoroth', 'Plateau of Gorgoroth', 'mordor', 2052, 1200, { shadowLoc: false }),
  L('barad_dur', 'Barad-dûr', 'mordor', 1992, 1032, { shadowLoc: true, stronghold: true }),
  L('udun', 'Udûn', 'mordor', 1730, 1027, { stronghold: true }),
  L('nurn', 'Núrn', 'mordor', 2280, 1230, { shadowLoc: true }),
  // Rhovanion
  L('brown_lands', 'Brown Lands', 'rhovanion', 1665, 775),
  L('emyn_muil', 'Emyn Muil', 'rhovanion', 1532, 860),
  L('dagorlad', 'Dagorlad', 'rhovanion', 1767, 864),
  L('rhun', 'Rhûn', 'rhovanion', 2358, 716, { shadowLoc: true }),
  // Mirkwood
  L('lorien', 'Lórien', 'mirkwood', 1228, 595, { haven: true, muster: 'sylvan' }),
  L('dol_guldur', 'Dol Guldur', 'mirkwood', 1473, 617, { shadowLoc: true, stronghold: true, stopsSpawnWhenCaptured: true }),
  L('southern_mirkwood', 'Southern Mirkwood', 'mirkwood', 1680, 520),
  L('old_forest_road', 'Old Forest Road', 'mirkwood', 1563, 278),
  L('woodland_realm', 'Woodland Realm', 'mirkwood', 1473, 140, { haven: true, muster: 'sylvan' }),
  // Dale
  L('erebor', 'Erebor', 'dale', 1692, 120, { haven: true, muster: 'deepholm' }),
  L('iron_hills', 'Iron Hills', 'dale', 1965, 205, { muster: 'deepholm' }),
  L('lake_town', 'Lake Town', 'dale', 1767, 285),
  L('dorwinion', 'Dorwinion', 'dale', 1997, 505),
  // Haradwaith
  L('harondor', 'Harondor', 'haradwaith', 1672, 1660),
  L('near_harad', 'Near Harad', 'haradwaith', 1792, 1878, { shadowLoc: true }),
  L('umbar', 'Umbar', 'haradwaith', 1543, 1898, { shadowLoc: true, stronghold: true, stopsSpawnWhenCaptured: true }),
];

/**
 * Edges: every connection between two locations is EITHER a white path
 * (players only; may carry a symbol cost) OR a battle line segment (a
 * colored, directed arrow; shadow troops advance along it, and players may
 * travel it too). Multiple edges may join the same pair of locations.
 *
 * Full battle lines are DERIVED by chaining same-colored segments head to
 * tail. This entire list is editable in the in-game board editor (#editor).
 */
export const EDGES: EdgeDef[] = [
  { a: "grey_havens", b: "ered_luin", kind: "path" },
  { a: "grey_havens", b: "the_shire", kind: "path" },
  { a: "grey_havens", b: "sarn_ford", kind: "path" },
  { a: "ered_luin", b: "the_shire", kind: "path" },
  { a: "the_shire", b: "bree", kind: "path" },
  { a: "the_shire", b: "sarn_ford", kind: "path" },
  { a: "bree", b: "weather_hills", kind: "path" },
  { a: "bree", b: "sarn_ford", kind: "path" },
  { a: "sarn_ford", b: "tharbad", kind: "path" },
  { a: "weather_hills", b: "rivendell", kind: "path" },
  { a: "tharbad", b: "bree", kind: "path" },
  { a: "rivendell", b: "hollin", kind: "path" },
  { a: "rivendell", b: "carrock", kind: "path", cost: ["stealth"] },
  { a: "hollin", b: "moria", kind: "path", cost: ["friendship"] },
  { a: "hollin", b: "carrock", kind: "path", cost: ["resistance"] },
  { a: "hollin", b: "dunland", kind: "path" },
  { a: "hollin", b: "tharbad", kind: "path" },
  { a: "moria", b: "gladden_fields", kind: "path" },
  { a: "gladden_fields", b: "carrock", kind: "path" },
  { a: "gladden_fields", b: "lorien", kind: "path" },
  { a: "carrock", b: "old_forest_road", kind: "path" },
  { a: "tharbad", b: "dunland", kind: "path" },
  { a: "tharbad", b: "druwaith_iaur", kind: "path" },
  { a: "dunland", b: "isengard", kind: "path" },
  { a: "druwaith_iaur", b: "pinnath_gelin", kind: "path" },
  { a: "druwaith_iaur", b: "fords_of_isen", kind: "path" },
  { a: "isengard", b: "fangorn_forest", kind: "path", cost: ["stealth"] },
  { a: "isengard", b: "fords_of_isen", kind: "path" },
  { a: "fangorn_forest", b: "lorien", kind: "path", cost: ["friendship"] },
  { a: "fangorn_forest", b: "eastemnet", kind: "path" },
  { a: "fangorn_forest", b: "fords_of_isen", kind: "path" },
  { a: "fords_of_isen", b: "helms_deep", kind: "path" },
  { a: "helms_deep", b: "edoras", kind: "path" },
  { a: "edoras", b: "eastemnet", kind: "path" },
  { a: "edoras", b: "druadan_forest", kind: "path" },
  { a: "edoras", b: "erech", kind: "path", cost: ["stealth"] },
  { a: "eastemnet", b: "emyn_muil", kind: "path" },
  { a: "eastemnet", b: "brown_lands", kind: "path" },
  { a: "druadan_forest", b: "minas_tirith", kind: "path" },
  { a: "minas_tirith", b: "osgiliath", kind: "path" },
  { a: "minas_tirith", b: "pelargir", kind: "path" },
  { a: "pelargir", b: "lamedon", kind: "path" },
  { a: "pelargir", b: "south_ithilien", kind: "path" },
  { a: "pelargir", b: "harondor", kind: "path" },
  { a: "dol_amroth", b: "lamedon", kind: "path" },
  { a: "dol_amroth", b: "pinnath_gelin", kind: "path" },
  { a: "lamedon", b: "erech", kind: "path" },
  { a: "erech", b: "pinnath_gelin", kind: "path" },
  { a: "grey_havens", b: "dol_amroth", kind: "path", cost: ["friendship", "friendship"] },
  { a: "osgiliath", b: "north_ithilien", kind: "path" },
  { a: "osgiliath", b: "south_ithilien", kind: "path" },
  { a: "north_ithilien", b: "south_ithilien", kind: "path" },
  { a: "emyn_muil", b: "north_ithilien", kind: "path", cost: ["resistance"] },
  { a: "north_ithilien", b: "udun", kind: "path", cost: ["stealth", "stealth", "stealth"] },
  { a: "south_ithilien", b: "minas_morgul", kind: "path", cost: ["stealth", "stealth"] },
  { a: "south_ithilien", b: "harondor", kind: "path" },
  { a: "minas_morgul", b: "mount_doom", kind: "path", cost: ["stealth", "stealth"] },
  { a: "minas_morgul", b: "plateau_of_gorgoroth", kind: "path", cost: ["stealth"] },
  { a: "mount_doom", b: "plateau_of_gorgoroth", kind: "path", cost: ["stealth", "stealth"] },
  { a: "mount_doom", b: "barad_dur", kind: "path" },
  { a: "mount_doom", b: "udun", kind: "path", cost: ["stealth", "stealth", "stealth"] },
  { a: "plateau_of_gorgoroth", b: "barad_dur", kind: "path" },
  { a: "plateau_of_gorgoroth", b: "nurn", kind: "path" },
  { a: "barad_dur", b: "udun", kind: "path", cost: ["stealth"] },
  { a: "udun", b: "dagorlad", kind: "path", cost: ["stealth"] },
  { a: "nurn", b: "near_harad", kind: "path" },
  { a: "brown_lands", b: "emyn_muil", kind: "path" },
  { a: "brown_lands", b: "dagorlad", kind: "path" },
  { a: "brown_lands", b: "southern_mirkwood", kind: "path" },
  { a: "dagorlad", b: "rhun", kind: "path" },
  { a: "lorien", b: "dol_guldur", kind: "path" },
  { a: "dol_guldur", b: "southern_mirkwood", kind: "path" },
  { a: "southern_mirkwood", b: "old_forest_road", kind: "path" },
  { a: "old_forest_road", b: "woodland_realm", kind: "path" },
  { a: "woodland_realm", b: "lake_town", kind: "path" },
  { a: "lake_town", b: "erebor", kind: "path" },
  { a: "lake_town", b: "dorwinion", kind: "path" },
  { a: "erebor", b: "iron_hills", kind: "path" },
  { a: "iron_hills", b: "dorwinion", kind: "path" },
  { a: "harondor", b: "near_harad", kind: "path" },
  { a: "umbar", b: "near_harad", kind: "path" },
  { a: "umbar", b: "harondor", kind: "path" },
  { a: "moria", b: "hollin", kind: "line", color: "#7fbf5f", dir: "ab" },
  { a: "hollin", b: "weather_hills", kind: "line", color: "#7fbf5f", dir: "ab" },
  { a: "weather_hills", b: "rivendell", kind: "line", color: "#7fbf5f", dir: "ab" },
  { a: "dunland", b: "tharbad", kind: "line", color: "#8f6fc0", dir: "ab" },
  { a: "tharbad", b: "sarn_ford", kind: "line", color: "#8f6fc0", dir: "ab" },
  { a: "sarn_ford", b: "the_shire", kind: "line", color: "#8f6fc0", dir: "ab" },
  { a: "isengard", b: "fords_of_isen", kind: "line", color: "#5fb3a1", dir: "ab" },
  { a: "fords_of_isen", b: "helms_deep", kind: "line", color: "#5fb3a1", dir: "ab" },
  { a: "isengard", b: "druwaith_iaur", kind: "line", color: "#e8836a", dir: "ab" },
  { a: "druwaith_iaur", b: "pinnath_gelin", kind: "line", color: "#e8836a", dir: "ab" },
  { a: "pinnath_gelin", b: "lamedon", kind: "line", color: "#e8836a", dir: "ab" },
  { a: "lamedon", b: "dol_amroth", kind: "line", color: "#e8836a", dir: "ab" },
  { a: "dol_guldur", b: "lorien", kind: "line", color: "#e0c050", dir: "ab" },
  { a: "dol_guldur", b: "old_forest_road", kind: "line", color: "#6fb8e8", dir: "ab" },
  { a: "old_forest_road", b: "woodland_realm", kind: "line", color: "#6fb8e8", dir: "ab" },
  { a: "rhun", b: "dorwinion", kind: "line", color: "#c98ad1", dir: "ab" },
  { a: "dorwinion", b: "lake_town", kind: "line", color: "#c98ad1", dir: "ab" },
  { a: "lake_town", b: "erebor", kind: "line", color: "#c98ad1", dir: "ab" },
  { a: "barad_dur", b: "dagorlad", kind: "line", color: "#55c8dc", dir: "ab" },
  { a: "dagorlad", b: "emyn_muil", kind: "line", color: "#55c8dc", dir: "ab" },
  { a: "emyn_muil", b: "eastemnet", kind: "line", color: "#55c8dc", dir: "ab" },
  { a: "eastemnet", b: "edoras", kind: "line", color: "#55c8dc", dir: "ab" },
  { a: "edoras", b: "helms_deep", kind: "line", color: "#55c8dc", dir: "ab" },
  { a: "nurn", b: "plateau_of_gorgoroth", kind: "line", color: "#e8d060", dir: "ab" },
  { a: "plateau_of_gorgoroth", b: "osgiliath", kind: "line", color: "#e8d060", dir: "ab" },
  { a: "osgiliath", b: "minas_tirith", kind: "line", color: "#e8d060", dir: "ab" },
  { a: "minas_morgul", b: "south_ithilien", kind: "line", color: "#a98ae0", dir: "ab" },
  { a: "south_ithilien", b: "pelargir", kind: "line", color: "#a98ae0", dir: "ab" },
  { a: "pelargir", b: "dol_amroth", kind: "line", color: "#a98ae0", dir: "ab" },
  { a: "near_harad", b: "harondor", kind: "line", color: "#e8946a", dir: "ab" },
  { a: "harondor", b: "south_ithilien", kind: "line", color: "#e8946a", dir: "ab" },
  { a: "south_ithilien", b: "minas_tirith", kind: "line", color: "#e8946a", dir: "ab" },
  { a: "umbar", b: "dol_amroth", kind: "line", color: "#8a9ae0", dir: "ab" },
];

/** White paths (derived from EDGES; kept for compatibility). */
export const PATHS: PathDef[] = EDGES.filter((e) => e.kind === 'path').map((e) => ({
  a: e.a,
  b: e.b,
  ...(e.cost ? { cost: e.cost } : {}),
}));

/**
 * Battle lines, derived by chaining same-colored directed segments.
 * A chain starts at a node with no incoming segment of that color and
 * follows the arrows to its end.
 */
function deriveBattleLines(edges: EdgeDef[]): BattleLineDef[] {
  const byColor = new Map<string, { from: LocationId; to: LocationId }[]>();
  for (const e of edges) {
    if (e.kind !== 'line') continue;
    const color = e.color ?? '#999999';
    const from = e.dir === 'ba' ? e.b : e.a;
    const to = e.dir === 'ba' ? e.a : e.b;
    if (!byColor.has(color)) byColor.set(color, []);
    byColor.get(color)!.push({ from, to });
  }
  const lines: BattleLineDef[] = [];
  for (const [color, segs] of byColor) {
    const outgoing = new Map<LocationId, LocationId[]>();
    const hasIncoming = new Set<LocationId>();
    for (const s of segs) {
      if (!outgoing.has(s.from)) outgoing.set(s.from, []);
      outgoing.get(s.from)!.push(s.to);
      hasIncoming.add(s.to);
    }
    const starts = [...outgoing.keys()].filter((n) => !hasIncoming.has(n)).sort();
    for (const start of starts) {
      // Follow each branch from the start (branches split into separate lines).
      const walk = (node: LocationId, path: LocationId[], guard: number): void => {
        const nexts = outgoing.get(node) ?? [];
        if (nexts.length === 0 || guard > 40) {
          if (path.length >= 2) {
            const id = `bl_${color.replace('#', '')}_${path[0]}_${path[path.length - 1]}`;
            const name = `${path[0]} \u2192 ${path[path.length - 1]}`;
            lines.push({ id, name, path: [...path], color });
          }
          return;
        }
        for (const nxt of nexts) walk(nxt, [...path, nxt], guard + 1);
      };
      walk(start, [start], 0);
    }
  }
  lines.sort((a, b) => a.id.localeCompare(b.id));
  return lines;
}

const LOC_NAME: Record<LocationId, string> = Object.fromEntries(
  LOCATIONS.map((l) => [l.id, l.name]),
);

export const BATTLE_LINES: BattleLineDef[] = deriveBattleLines(EDGES).map((l) => ({
  ...l,
  name: `${LOC_NAME[l.path[0]]} \u2192 ${LOC_NAME[l.path[l.path.length - 1]]}`,
}));

/**
 * Resolve the battle line a shadow card names by its endpoints. Falls back to
 * any line leaving the same origin while the drawn board data is still being
 * trued up against the physical map; returns undefined if none exists.
 */
export function findBattleLine(from: LocationId, to: LocationId): BattleLineDef | undefined {
  return (
    BATTLE_LINES.find((l) => l.path[0] === from && l.path[l.path.length - 1] === to) ??
    BATTLE_LINES.find((l) => l.path[0] === from)
  );
}

// ---------------------------------------------------------------------------
// Derived lookups
// ---------------------------------------------------------------------------

export const MAP: Record<LocationId, LocationDef> = Object.fromEntries(
  LOCATIONS.map((l) => [l.id, l]),
);
export const REGION_MAP: Record<RegionId, RegionDef> = Object.fromEntries(
  REGIONS.map((r) => [r.id, r]),
);

export interface Connection {
  to: LocationId;
  cost?: SymbolKind[];
  viaBattleLine?: boolean;
}

/** All ways to travel out of each location (paths + battle-line segments). */
export const CONNECTIONS: Record<LocationId, Connection[]> = (() => {
  const out: Record<LocationId, Connection[]> = {};
  for (const l of LOCATIONS) out[l.id] = [];
  const add = (from: LocationId, to: LocationId, cost?: SymbolKind[], viaBattleLine?: boolean) => {
    const existing = out[from].find((c) => c.to === to);
    if (existing) {
      // Battle lines are drawn ALONG paths on the board: a line overlapping a
      // special path never waives the path's symbol cost. Line-derived edges
      // only add connectivity where no path exists at all.
      if (viaBattleLine) existing.viaBattleLine = true;
      return;
    }
    out[from].push({ to, ...(cost ? { cost } : {}), ...(viaBattleLine ? { viaBattleLine: true } : {}) });
  };
  for (const p of PATHS) {
    if (!MAP[p.a] || !MAP[p.b]) throw new Error(`bad path ${p.a}-${p.b}`);
    add(p.a, p.b, p.cost);
    add(p.b, p.a, p.cost);
  }
  for (const line of BATTLE_LINES) {
    for (let i = 0; i + 1 < line.path.length; i++) {
      if (!MAP[line.path[i]] || !MAP[line.path[i + 1]]) {
        throw new Error(`bad battle line ${line.id}`);
      }
      add(line.path[i], line.path[i + 1], undefined, true);
      add(line.path[i + 1], line.path[i], undefined, true);
    }
  }
  return out;
})();

export function connection(from: LocationId, to: LocationId): Connection | undefined {
  return CONNECTIONS[from]?.find((c) => c.to === to);
}

/** BFS distance between regions (for Nazgûl movement). */
export function regionDistance(a: RegionId, b: RegionId): number {
  if (a === b) return 0;
  const dist: Record<RegionId, number> = { [a]: 0 };
  const queue = [a];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of REGION_MAP[cur].adjacent) {
      if (!(n in dist)) {
        dist[n] = dist[cur] + 1;
        if (n === b) return dist[n];
        queue.push(n);
      }
    }
  }
  return Infinity;
}

/** Regions one step closer to `target` from `from`. */
export function regionsToward(from: RegionId, target: RegionId): RegionId[] {
  const d = regionDistance(from, target);
  return REGION_MAP[from].adjacent.filter((n) => regionDistance(n, target) === d - 1);
}

export const SHADOW_LOCATIONS = LOCATIONS.filter((l) => l.shadowLoc).map((l) => l.id);
export const PRINTED_HAVENS = LOCATIONS.filter((l) => l.haven).map((l) => l.id);
export const MORDOR: RegionId = 'mordor';
export const MOUNT_DOOM: LocationId = 'mount_doom';
