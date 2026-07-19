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
 * The board, built in the in-browser editor and verified against the
 * physical game map: 12 regions, 52 locations, havens, shadow strongholds,
 * shadow (spawn) locations, and the battle-line segments whose chained
 * colors derive all 21 shadow-card battle lines. Coordinates are in
 * board.jpg image-pixel space. Regenerated from board-data/fate-board.json.
 */

export const REGIONS: RegionDef[] = [
  { id: 'eriador', name: "Eriador", adjacent: ['rhudaur', 'enedwaith'], x: 350, y: 700 },
  { id: 'rhudaur', name: "Rhudaur", adjacent: ['eriador', 'misty_mountains'], x: 1258, y: 330 },
  { id: 'misty_mountains', name: "Misty Mountains", adjacent: ['rhudaur', 'enedwaith', 'rohan', 'mirkwood'], x: 1085, y: 655 },
  { id: 'enedwaith', name: "Enedwaith", adjacent: ['eriador', 'misty_mountains', 'rohan', 'gondor'], x: 700, y: 800 },
  { id: 'rohan', name: "Rohan", adjacent: ['enedwaith', 'misty_mountains', 'mirkwood', 'rhovanion', 'gondor'], x: 1370, y: 850 },
  { id: 'gondor', name: "Gondor", adjacent: ['enedwaith', 'rohan', 'ithilien', 'haradwaith'], x: 930, y: 1340 },
  { id: 'ithilien', name: "Ithilien", adjacent: ['gondor', 'mordor', 'haradwaith', 'rhovanion'], x: 1610, y: 1480 },
  { id: 'mordor', name: "Mordor", adjacent: ['ithilien', 'rhovanion', 'haradwaith'], x: 2140, y: 1560 },
  { id: 'rhovanion', name: "Rhovanion", adjacent: ['rohan', 'mirkwood', 'dale', 'mordor', 'ithilien'], x: 2075, y: 795 },
  { id: 'mirkwood', name: "Mirkwood", adjacent: ['misty_mountains', 'rohan', 'rhovanion', 'dale'], x: 1500, y: 470 },
  { id: 'dale', name: "Dale", adjacent: ['mirkwood', 'rhovanion'], x: 1870, y: 100 },
  { id: 'haradwaith', name: "Haradwaith", adjacent: ['gondor', 'ithilien', 'mordor'], x: 1330, y: 1700 },
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
  L('grey_havens', "Grey Havens", 'eriador', 235, 418, { haven: true, muster: "sylvan" }),
  L('ered_luin', "Ered Luin", 'eriador', 212, 245, { muster: "deepholm" }),
  L('the_shire', "The Shire", 'eriador', 379, 334, { haven: true }),
  L('bree', "Bree", 'eriador', 563, 395),
  L('sarn_ford', "Sarn Ford", 'eriador', 453, 560),
  L('weather_hills', "Weather Hills", 'eriador', 720, 350),
  L('tharbad', "Tharbad", 'eriador', 726, 548),
  L('rivendell', "Rivendell", 'rhudaur', 1044, 231, { haven: true, muster: "sylvan" }),
  L('hollin', "Hollin", 'rhudaur', 993, 429),
  L('moria', "Moria", 'misty_mountains', 1194, 469, { stronghold: true, shadowLoc: true, stopsSpawnWhenCaptured: true }),
  L('gladden_fields', "Gladden Fields", 'misty_mountains', 1348, 435),
  L('carrock', "Carrock", 'misty_mountains', 1281, 232),
  L('dunland', "Dunland", 'enedwaith', 877, 641, { shadowLoc: true }),
  L('isengard', "Isengard", 'misty_mountains', 1017, 746, { stronghold: true, shadowLoc: true, stopsSpawnWhenCaptured: true }),
  L('druwaith_iaur', "Dr\u00fawaith Iaur", 'enedwaith', 674, 913),
  L('fords_of_isen', "Fords of Isen", 'rohan', 867, 933, { muster: "riders" }),
  L('helms_deep', "Helm's Deep", 'rohan', 1065, 964, { haven: true, muster: "riders" }),
  L('edoras', "Edoras", 'rohan', 1197, 1015, { muster: "riders" }),
  L('eastemnet', "Eastemnet", 'rohan', 1312, 880, { muster: "riders" }),
  L('fangorn_forest', "Fangorn Forest", 'misty_mountains', 1135, 745),
  L('minas_tirith', "Minas Tirith", 'gondor', 1480, 1205, { haven: true, muster: "vale" }),
  L('osgiliath', "Osgiliath", 'ithilien', 1660, 1175),
  L('druadan_forest', "Dr\u00faadan Forest", 'gondor', 1367, 1137),
  L('pelargir', "Pelargir", 'gondor', 1466, 1355, { muster: "vale" }),
  L('dol_amroth', "Dol Amroth", 'gondor', 1071, 1384, { haven: true, muster: "vale" }),
  L('lamedon', "Lamedon", 'gondor', 1269, 1271, { muster: "vale" }),
  L('erech', "Erech", 'gondor', 1053, 1139),
  L('pinnath_gelin', "Pinnath Gelin", 'gondor', 668, 1254),
  L('north_ithilien', "North Ithilien", 'ithilien', 1558, 1048),
  L('south_ithilien', "South Ithilien", 'ithilien', 1640, 1329),
  L('minas_morgul', "Minas Morgul", 'mordor', 1827, 1295, { stronghold: true, shadowLoc: true }),
  L('mount_doom', "Mount Doom", 'mordor', 1870, 1127),
  L('plateau_of_gorgoroth', "Plateau of Gorgoroth", 'mordor', 2058, 1195),
  L('barad_dur', "Barad-d\u00fbr", 'mordor', 2001, 1032, { stronghold: true, shadowLoc: true }),
  L('udun', "Ud\u00fbn", 'mordor', 1733, 1021, { stronghold: true }),
  L('nurn', "N\u00farn", 'mordor', 2298, 1224, { shadowLoc: true }),
  L('brown_lands', "Brown Lands", 'rhovanion', 1665, 775),
  L('emyn_muil', "Emyn Muil", 'rhovanion', 1523, 874),
  L('dagorlad', "Dagorlad", 'rhovanion', 1767, 864),
  L('rhun', "Rh\u00fbn", 'rhovanion', 2356, 724, { shadowLoc: true }),
  L('lorien', "L\u00f3rien", 'misty_mountains', 1233, 616, { haven: true, muster: "sylvan" }),
  L('dol_guldur', "Dol Guldur", 'mirkwood', 1479, 625, { stronghold: true, shadowLoc: true, stopsSpawnWhenCaptured: true }),
  L('southern_mirkwood', "Southern Mirkwood", 'mirkwood', 1684, 528),
  L('old_forest_road', "Old Forest Road", 'mirkwood', 1563, 278),
  L('woodland_realm', "Woodland Realm", 'mirkwood', 1482, 155, { haven: true, muster: "sylvan" }),
  L('erebor', "Erebor", 'dale', 1708, 146, { haven: true, muster: "deepholm" }),
  L('iron_hills', "Iron Hills", 'dale', 1965, 205, { muster: "deepholm" }),
  L('lake_town', "Lake Town", 'dale', 1767, 285),
  L('dorwinion', "Dorwinion", 'rhovanion', 1997, 505),
  L('harondor', "Harondor", 'haradwaith', 1677, 1652),
  L('near_harad', "Near Harad", 'haradwaith', 1813, 1879, { shadowLoc: true }),
  L('umbar', "Umbar", 'haradwaith', 1560, 1911, { stronghold: true, shadowLoc: true, stopsSpawnWhenCaptured: true }),
];

export const EDGES: EdgeDef[] = [
  { a: 'grey_havens', b: 'ered_luin', kind: 'line', color: '#8f6fc0', dir: 'ba' },
  { a: 'the_shire', b: 'ered_luin', kind: 'line', color: '#8f6fc0', dir: 'ab' },
  { a: 'bree', b: 'the_shire', kind: 'line', color: '#8f6fc0', dir: 'ab' },
  { a: 'sarn_ford', b: 'bree', kind: 'line', color: '#8f6fc0', dir: 'ab' },
  { a: 'sarn_ford', b: 'the_shire', kind: 'path' },
  { a: 'tharbad', b: 'sarn_ford', kind: 'line', color: '#8f6fc0', dir: 'ab' },
  { a: 'tharbad', b: 'bree', kind: 'line', color: '#9acd5a', dir: 'ab' },
  { a: 'bree', b: 'weather_hills', kind: 'line', color: '#9acd5a', dir: 'ab' },
  { a: 'weather_hills', b: 'rivendell', kind: 'line', color: '#9acd5a', dir: 'ab' },
  { a: 'weather_hills', b: 'hollin', kind: 'path' },
  { a: 'hollin', b: 'rivendell', kind: 'path' },
  { a: 'rivendell', b: 'carrock', kind: 'path', cost: ['stealth'] },
  { a: 'carrock', b: 'old_forest_road', kind: 'line', color: '#3fa8a0', dir: 'ab' },
  { a: 'carrock', b: 'gladden_fields', kind: 'line', color: '#3fa8a0', dir: 'ba' },
  { a: 'woodland_realm', b: 'old_forest_road', kind: 'line', color: '#3fa8a0', dir: 'ba' },
  { a: 'woodland_realm', b: 'erebor', kind: 'line', color: '#3fa8a0', dir: 'ab' },
  { a: 'erebor', b: 'woodland_realm', kind: 'line', color: '#e8834a', dir: 'ab' },
  { a: 'erebor', b: 'woodland_realm', kind: 'line', color: '#e87fb0', dir: 'ab' },
  { a: 'erebor', b: 'iron_hills', kind: 'line', color: '#e87fb0', dir: 'ba' },
  { a: 'lake_town', b: 'erebor', kind: 'line', color: '#e8834a', dir: 'ab' },
  { a: 'lake_town', b: 'iron_hills', kind: 'line', color: '#e87fb0', dir: 'ab' },
  { a: 'lake_town', b: 'woodland_realm', kind: 'path' },
  { a: 'dorwinion', b: 'lake_town', kind: 'line', color: '#e87fb0', dir: 'ab' },
  { a: 'dorwinion', b: 'iron_hills', kind: 'path' },
  { a: 'dorwinion', b: 'southern_mirkwood', kind: 'line', color: '#e8834a', dir: 'ab' },
  { a: 'southern_mirkwood', b: 'old_forest_road', kind: 'line', color: '#e8834a', dir: 'ab' },
  { a: 'southern_mirkwood', b: 'old_forest_road', kind: 'line', color: '#3fa8a0', dir: 'ab' },
  { a: 'dol_guldur', b: 'southern_mirkwood', kind: 'line', color: '#e8cf4f', dir: 'ab' },
  { a: 'dol_guldur', b: 'southern_mirkwood', kind: 'line', color: '#3fa8a0', dir: 'ab' },
  { a: 'dol_guldur', b: 'gladden_fields', kind: 'line', color: '#2f8f3e', dir: 'ab' },
  { a: 'dol_guldur', b: 'gladden_fields', kind: 'line', color: '#e8cf4f', dir: 'ba' },
  { a: 'gladden_fields', b: 'moria', kind: 'line', color: '#3fa8a0', dir: 'ba' },
  { a: 'gladden_fields', b: 'moria', kind: 'line', color: '#e8cf4f', dir: 'ba' },
  { a: 'gladden_fields', b: 'hollin', kind: 'path', cost: ['resistance'] },
  { a: 'moria', b: 'hollin', kind: 'line', color: '#9acd5a', dir: 'ab', cost: ['friendship'] },
  { a: 'hollin', b: 'tharbad', kind: 'line', color: '#9acd5a', dir: 'ab' },
  { a: 'dunland', b: 'hollin', kind: 'line', color: '#9acd5a', dir: 'ab' },
  { a: 'dunland', b: 'tharbad', kind: 'line', color: '#8f6fc0', dir: 'ab' },
  { a: 'lorien', b: 'gladden_fields', kind: 'line', color: '#2f8f3e', dir: 'ba' },
  { a: 'fangorn_forest', b: 'lorien', kind: 'line', color: '#2f8f3e', dir: 'ba' },
  { a: 'lorien', b: 'dol_guldur', kind: 'path' },
  { a: 'lorien', b: 'emyn_muil', kind: 'path', cost: ['friendship'] },
  { a: 'isengard', b: 'fangorn_forest', kind: 'path', cost: ['stealth'] },
  { a: 'brown_lands', b: 'dol_guldur', kind: 'line', color: '#3fa8a0', dir: 'ab' },
  { a: 'emyn_muil', b: 'brown_lands', kind: 'line', color: '#3fa8a0', dir: 'ab' },
  { a: 'brown_lands', b: 'dagorlad', kind: 'path' },
  { a: 'southern_mirkwood', b: 'dagorlad', kind: 'line', color: '#e8cf4f', dir: 'ab' },
  { a: 'dagorlad', b: 'dorwinion', kind: 'path' },
  { a: 'rhun', b: 'dagorlad', kind: 'line', color: '#e8cf4f', dir: 'ab' },
  { a: 'rhun', b: 'dorwinion', kind: 'line', color: '#e8834a', dir: 'ab' },
  { a: 'rhun', b: 'dorwinion', kind: 'line', color: '#e87fb0', dir: 'ab' },
  { a: 'dagorlad', b: 'emyn_muil', kind: 'line', color: '#3fa8a0', dir: 'ab' },
  { a: 'emyn_muil', b: 'eastemnet', kind: 'path' },
  { a: 'dagorlad', b: 'north_ithilien', kind: 'line', color: '#3fa8a0', dir: 'ba' },
  { a: 'dagorlad', b: 'north_ithilien', kind: 'line', color: '#e8cf4f', dir: 'ab' },
  { a: 'north_ithilien', b: 'emyn_muil', kind: 'path', cost: ['resistance'] },
  { a: 'fangorn_forest', b: 'eastemnet', kind: 'line', color: '#2f8f3e', dir: 'ab' },
  { a: 'eastemnet', b: 'helms_deep', kind: 'line', color: '#2f8f3e', dir: 'ab' },
  { a: 'fangorn_forest', b: 'helms_deep', kind: 'path' },
  { a: 'eastemnet', b: 'edoras', kind: 'path' },
  { a: 'edoras', b: 'helms_deep', kind: 'line', color: '#8f6fc0', dir: 'ab' },
  { a: 'helms_deep', b: 'edoras', kind: 'line', color: '#e87fb0', dir: 'ab' },
  { a: 'edoras', b: 'druadan_forest', kind: 'line', color: '#e87fb0', dir: 'ab' },
  { a: 'druadan_forest', b: 'edoras', kind: 'line', color: '#8f6fc0', dir: 'ab' },
  { a: 'druadan_forest', b: 'minas_tirith', kind: 'line', color: '#e87fb0', dir: 'ab' },
  { a: 'fords_of_isen', b: 'helms_deep', kind: 'line', color: '#e87fb0', dir: 'ab' },
  { a: 'fords_of_isen', b: 'helms_deep', kind: 'line', color: '#e8834a', dir: 'ab' },
  { a: 'isengard', b: 'fords_of_isen', kind: 'line', color: '#9acd5a', dir: 'ab' },
  { a: 'isengard', b: 'fords_of_isen', kind: 'line', color: '#e87fb0', dir: 'ab' },
  { a: 'isengard', b: 'fords_of_isen', kind: 'line', color: '#e8834a', dir: 'ab' },
  { a: 'fords_of_isen', b: 'dunland', kind: 'line', color: '#9acd5a', dir: 'ab' },
  { a: 'dunland', b: 'druwaith_iaur', kind: 'line', color: '#e8834a', dir: 'ab' },
  { a: 'pinnath_gelin', b: 'druwaith_iaur', kind: 'line', color: '#e8834a', dir: 'ab' },
  { a: 'druwaith_iaur', b: 'fords_of_isen', kind: 'line', color: '#e8834a', dir: 'ab' },
  { a: 'erech', b: 'pinnath_gelin', kind: 'line', color: '#e8834a', dir: 'ab' },
  { a: 'lamedon', b: 'erech', kind: 'line', color: '#e8834a', dir: 'ab' },
  { a: 'erech', b: 'edoras', kind: 'path', cost: ['stealth'] },
  { a: 'lamedon', b: 'dol_amroth', kind: 'path' },
  { a: 'grey_havens', b: 'dol_amroth', kind: 'line', color: '#e87fb0', dir: 'ba', cost: ['friendship', 'friendship'] },
  { a: 'pelargir', b: 'dol_amroth', kind: 'line', color: '#e87fb0', dir: 'ab' },
  { a: 'pelargir', b: 'lamedon', kind: 'line', color: '#e8834a', dir: 'ab' },
  { a: 'pelargir', b: 'south_ithilien', kind: 'line', color: '#8f6fc0', dir: 'ab' },
  { a: 'south_ithilien', b: 'pelargir', kind: 'line', color: '#e87fb0', dir: 'ab' },
  { a: 'minas_tirith', b: 'osgiliath', kind: 'line', color: '#e87fb0', dir: 'ab' },
  { a: 'osgiliath', b: 'minas_tirith', kind: 'line', color: '#8f6fc0', dir: 'ab' },
  { a: 'osgiliath', b: 'minas_tirith', kind: 'line', color: '#e8cf4f', dir: 'ab' },
  { a: 'south_ithilien', b: 'osgiliath', kind: 'line', color: '#3fa8a0', dir: 'ab' },
  { a: 'osgiliath', b: 'south_ithilien', kind: 'line', color: '#8f6fc0', dir: 'ba' },
  { a: 'osgiliath', b: 'south_ithilien', kind: 'line', color: '#e87fb0', dir: 'ab' },
  { a: 'harondor', b: 'pelargir', kind: 'line', color: '#e87fb0', dir: 'ab' },
  { a: 'harondor', b: 'pelargir', kind: 'line', color: '#e8834a', dir: 'ab' },
  { a: 'harondor', b: 'south_ithilien', kind: 'line', color: '#3fa8a0', dir: 'ab' },
  { a: 'harondor', b: 'south_ithilien', kind: 'line', color: '#8f6fc0', dir: 'ab' },
  { a: 'umbar', b: 'pelargir', kind: 'line', color: '#8f6fc0', dir: 'ab' },
  { a: 'umbar', b: 'harondor', kind: 'line', color: '#e87fb0', dir: 'ab' },
  { a: 'umbar', b: 'harondor', kind: 'line', color: '#e8834a', dir: 'ab' },
  { a: 'near_harad', b: 'harondor', kind: 'line', color: '#e8834a', dir: 'ab' },
  { a: 'near_harad', b: 'harondor', kind: 'line', color: '#3fa8a0', dir: 'ab' },
  { a: 'minas_morgul', b: 'south_ithilien', kind: 'line', color: '#8f6fc0', dir: 'ab', cost: ['stealth', 'stealth'] },
  { a: 'plateau_of_gorgoroth', b: 'minas_morgul', kind: 'line', color: '#8f6fc0', dir: 'ab', cost: ['stealth'] },
  { a: 'minas_morgul', b: 'udun', kind: 'path' },
  { a: 'barad_dur', b: 'udun', kind: 'line', color: '#3fa8a0', dir: 'ab', cost: ['stealth'] },
  { a: 'mount_doom', b: 'udun', kind: 'line', color: '#e8cf4f', dir: 'ab', cost: ['stealth', 'stealth', 'stealth'] },
  { a: 'plateau_of_gorgoroth', b: 'mount_doom', kind: 'line', color: '#e8cf4f', dir: 'ab', cost: ['stealth', 'stealth'] },
  { a: 'nurn', b: 'plateau_of_gorgoroth', kind: 'line', color: '#e8cf4f', dir: 'ab' },
  { a: 'nurn', b: 'plateau_of_gorgoroth', kind: 'line', color: '#3fa8a0', dir: 'ab' },
  { a: 'nurn', b: 'plateau_of_gorgoroth', kind: 'line', color: '#8f6fc0', dir: 'ab' },
  { a: 'plateau_of_gorgoroth', b: 'barad_dur', kind: 'line', color: '#3fa8a0', dir: 'ab' },
  { a: 'mount_doom', b: 'barad_dur', kind: 'path' },
  { a: 'north_ithilien', b: 'osgiliath', kind: 'line', color: '#e8cf4f', dir: 'ab' },
  { a: 'osgiliath', b: 'north_ithilien', kind: 'line', color: '#3fa8a0', dir: 'ab' },
  { a: 'udun', b: 'north_ithilien', kind: 'line', color: '#3fa8a0', dir: 'ab', cost: ['stealth', 'stealth', 'stealth', 'stealth'] },
  { a: 'udun', b: 'north_ithilien', kind: 'line', color: '#e8cf4f', dir: 'ab', cost: ['stealth', 'stealth', 'stealth', 'stealth'] },
  { a: 'old_forest_road', b: 'lake_town', kind: 'line', color: '#e8834a', dir: 'ab' },
  { a: 'minas_tirith', b: 'druadan_forest', kind: 'line', color: '#8f6fc0', dir: 'ab' },
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
 * Resolve the battle line a shadow card names by its endpoints. Battle lines
 * merge and pass through strongholds, so a card's origin can sit mid-chain on
 * a longer colored route; we search each color for a directed path from the
 * origin to the destination and return that specific sub-path. Prefers an
 * exact pre-derived line when one exists (identical result, stable id).
 */
export function findBattleLine(from: LocationId, to: LocationId): BattleLineDef | undefined {
  const exact = BATTLE_LINES.find((l) => l.path[0] === from && l.path[l.path.length - 1] === to);
  if (exact) return exact;

  // Directed same-color adjacency, built once per color as needed.
  for (const color of new Set(EDGES.filter((e) => e.kind === 'line').map((e) => e.color))) {
    const adj = new Map<LocationId, LocationId[]>();
    for (const e of EDGES) {
      if (e.kind !== 'line' || e.color !== color) continue;
      const a = e.dir === 'ba' ? e.b : e.a;
      const b = e.dir === 'ba' ? e.a : e.b;
      (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
    }
    // BFS for the shortest directed path from -> to in this color.
    const prev = new Map<LocationId, LocationId>();
    const seen = new Set<LocationId>([from]);
    const queue: LocationId[] = [from];
    while (queue.length) {
      const n = queue.shift()!;
      if (n === to) {
        const path: LocationId[] = [to];
        let cur = to;
        while (cur !== from) {
          cur = prev.get(cur)!;
          path.unshift(cur);
        }
        return {
          id: `bl_${(color ?? '').replace('#', '')}_${from}_${to}`,
          name: `${LOC_NAME[from]} → ${LOC_NAME[to]}`,
          path,
          color,
        };
      }
      for (const m of adj.get(n) ?? []) {
        if (!seen.has(m)) {
          seen.add(m);
          prev.set(m, n);
          queue.push(m);
        }
      }
    }
  }
  return undefined;
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
  // Battle-line segments are traversable by players in either direction and
  // may carry their own printed symbol cost.
  for (const e of EDGES) {
    if (e.kind !== 'line') continue;
    if (!MAP[e.a] || !MAP[e.b]) throw new Error(`bad battle line ${e.a}-${e.b}`);
    add(e.a, e.b, e.cost, true);
    add(e.b, e.a, e.cost, true);
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

// ---------------------------------------------------------------------------
// Marker tracks — where the hope and threat markers sit on the board art.
// Each track is a straight line between the first and last space; the marker
// for space i of n is the linear interpolation. Calibrate in the editor.
// ---------------------------------------------------------------------------

export interface TrackDef {
  /** Position of the first space (hope 0 / threat idx 0). */
  from: { x: number; y: number };
  /** Position of the last space (hope 8 / threat idx 6). */
  to: { x: number; y: number };
}

export const TRACKS: { hope: TrackDef; threat: TrackDef } = {
  hope: { from: { x: 108, y: 1575 }, to: { x: 108, y: 675 } },
  threat: { from: { x: 285, y: 158 }, to: { x: 905, y: 158 } },
};

/** Board-pixel position of space `i` of `n` on a track. */
export function trackPos(t: TrackDef, i: number, n: number): { x: number; y: number } {
  const f = n <= 1 ? 0 : Math.max(0, Math.min(n - 1, i)) / (n - 1);
  return { x: t.from.x + (t.to.x - t.from.x) * f, y: t.from.y + (t.to.y - t.from.y) * f };
}
