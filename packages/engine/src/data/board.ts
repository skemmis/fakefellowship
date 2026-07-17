import type {
  BattleLineDef,
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
  { id: 'eriador', name: 'Eriador', adjacent: ['rhudaur', 'enedwaith'], x: 200, y: 345 },
  { id: 'rhudaur', name: 'Rhudaur', adjacent: ['eriador', 'misty_mountains'], x: 385, y: 68 },
  { id: 'misty_mountains', name: 'Misty Mountains', adjacent: ['rhudaur', 'enedwaith', 'rohan', 'mirkwood'], x: 490, y: 318 },
  { id: 'enedwaith', name: 'Enedwaith', adjacent: ['eriador', 'misty_mountains', 'rohan', 'gondor'], x: 285, y: 425 },
  { id: 'rohan', name: 'Rohan', adjacent: ['enedwaith', 'misty_mountains', 'mirkwood', 'rhovanion', 'gondor'], x: 585, y: 448 },
  { id: 'gondor', name: 'Gondor', adjacent: ['enedwaith', 'rohan', 'ithilien', 'haradwaith'], x: 380, y: 735 },
  { id: 'ithilien', name: 'Ithilien', adjacent: ['gondor', 'mordor', 'haradwaith', 'rhovanion'], x: 800, y: 700 },
  { id: 'mordor', name: 'Mordor', adjacent: ['ithilien', 'rhovanion', 'haradwaith'], x: 905, y: 435 },
  { id: 'rhovanion', name: 'Rhovanion', adjacent: ['rohan', 'mirkwood', 'dale', 'mordor', 'ithilien'], x: 815, y: 340 },
  { id: 'mirkwood', name: 'Mirkwood', adjacent: ['misty_mountains', 'rohan', 'rhovanion', 'dale'], x: 640, y: 222 },
  { id: 'dale', name: 'Dale', adjacent: ['mirkwood', 'rhovanion'], x: 862, y: 42 },
  { id: 'haradwaith', name: 'Haradwaith', adjacent: ['gondor', 'ithilien', 'mordor'], x: 620, y: 810 },
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
  L('grey_havens', 'Grey Havens', 'eriador', 90, 210, { haven: true, muster: 'sylvan' }),
  L('ered_luin', 'Ered Luin', 'eriador', 115, 115, { muster: 'deepholm' }),
  L('the_shire', 'The Shire', 'eriador', 195, 165, { haven: true }),
  L('bree', 'Bree', 'eriador', 285, 200),
  L('sarn_ford', 'Sarn Ford', 'eriador', 235, 290),
  L('weather_hills', 'Weather Hills', 'eriador', 345, 165),
  L('tharbad', 'Tharbad', 'eriador', 330, 275),
  // Rhudaur
  L('rivendell', 'Rivendell', 'rhudaur', 455, 105, { haven: true, muster: 'sylvan' }),
  // Misty Mountains
  L('hollin', 'Hollin', 'misty_mountains', 445, 220),
  L('moria', 'Moria', 'misty_mountains', 520, 225, { shadowLoc: true, stronghold: true, stopsSpawnWhenCaptured: true }),
  L('gladden_fields', 'Gladden Fields', 'misty_mountains', 580, 215),
  L('carrock', 'Carrock', 'misty_mountains', 555, 120),
  // Enedwaith
  L('dunland', 'Dunland', 'enedwaith', 385, 335, { shadowLoc: true }),
  L('isengard', 'Isengard', 'enedwaith', 440, 385, { shadowLoc: true, stronghold: true, stopsSpawnWhenCaptured: true }),
  L('druwaith_iaur', 'Drúwaith Iaur', 'enedwaith', 335, 480),
  // Rohan
  L('fords_of_isen', 'Fords of Isen', 'rohan', 430, 450, { muster: 'riders' }),
  L('helms_deep', "Helm's Deep", 'rohan', 505, 470, { haven: true, muster: 'riders' }),
  L('edoras', 'Edoras', 'rohan', 570, 490, { muster: 'riders' }),
  L('eastemnet', 'Eastemnet', 'rohan', 625, 425, { muster: 'riders' }),
  L('fangorn_forest', 'Fangorn Forest', 'rohan', 530, 385),
  // Gondor
  L('minas_tirith', 'Minas Tirith', 'gondor', 660, 590, { haven: true, muster: 'vale' }),
  L('osgiliath', 'Osgiliath', 'gondor', 715, 565),
  L('druadan_forest', 'Drúadan Forest', 'gondor', 600, 560),
  L('pelargir', 'Pelargir', 'gondor', 655, 660, { muster: 'vale' }),
  L('dol_amroth', 'Dol Amroth', 'gondor', 480, 690, { haven: true, muster: 'vale' }),
  L('lamedon', 'Lamedon', 'gondor', 520, 630, { muster: 'vale' }),
  L('erech', 'Erech', 'gondor', 450, 570),
  L('pinnath_gelin', 'Pinnath Gelin', 'gondor', 380, 620),
  // Ithilien
  L('north_ithilien', 'North Ithilien', 'ithilien', 745, 500),
  L('south_ithilien', 'South Ithilien', 'ithilien', 730, 655),
  // Mordor
  L('minas_morgul', 'Minas Morgul', 'mordor', 775, 625, { shadowLoc: true, stronghold: true }),
  L('mount_doom', 'Mount Doom', 'mordor', 858, 545),
  L('plateau_of_gorgoroth', 'Plateau of Gorgoroth', 'mordor', 900, 638, { shadowLoc: false }),
  L('barad_dur', 'Barad-dûr', 'mordor', 925, 512, { shadowLoc: true, stronghold: true }),
  L('udun', 'Udûn', 'mordor', 830, 462, { stronghold: true }),
  L('nurn', 'Núrn', 'mordor', 975, 705, { shadowLoc: true }),
  // Rhovanion
  L('brown_lands', 'Brown Lands', 'rhovanion', 705, 335),
  L('emyn_muil', 'Emyn Muil', 'rhovanion', 700, 415),
  L('dagorlad', 'Dagorlad', 'rhovanion', 775, 405),
  L('rhun', 'Rhûn', 'rhovanion', 965, 300, { shadowLoc: true }),
  // Mirkwood
  L('lorien', 'Lórien', 'mirkwood', 610, 280, { haven: true, muster: 'sylvan' }),
  L('dol_guldur', 'Dol Guldur', 'mirkwood', 680, 290, { shadowLoc: true, stronghold: true, stopsSpawnWhenCaptured: true }),
  L('southern_mirkwood', 'Southern Mirkwood', 'mirkwood', 745, 250),
  L('old_forest_road', 'Old Forest Road', 'mirkwood', 715, 155),
  L('woodland_realm', 'Woodland Realm', 'mirkwood', 700, 75, { haven: true, muster: 'sylvan' }),
  // Dale
  L('erebor', 'Erebor', 'dale', 810, 65, { haven: true, muster: 'deepholm' }),
  L('iron_hills', 'Iron Hills', 'dale', 925, 75, { muster: 'deepholm' }),
  L('lake_town', 'Lake Town', 'dale', 810, 140),
  L('dorwinion', 'Dorwinion', 'dale', 900, 200),
  // Haradwaith
  L('harondor', 'Harondor', 'haradwaith', 690, 745),
  L('near_harad', 'Near Harad', 'haradwaith', 755, 820, { shadowLoc: true }),
  L('umbar', 'Umbar', 'haradwaith', 590, 840, { shadowLoc: true, stronghold: true, stopsSpawnWhenCaptured: true }),
];

/**
 * Paths. `cost` marks a special path. The Rivendell-Carrock stealth pass and
 * the Hollin-Moria friendship pass are confirmed by rulebook examples; other
 * costed paths are read from symbol badges on the map photo.
 */
export const PATHS: PathDef[] = [
  // Eriador
  { a: 'grey_havens', b: 'ered_luin' },
  { a: 'grey_havens', b: 'the_shire' },
  { a: 'grey_havens', b: 'sarn_ford' },
  { a: 'ered_luin', b: 'the_shire' },
  { a: 'the_shire', b: 'bree' },
  { a: 'the_shire', b: 'sarn_ford' },
  { a: 'bree', b: 'weather_hills' },
  { a: 'bree', b: 'sarn_ford' },
  { a: 'sarn_ford', b: 'tharbad' },
  { a: 'weather_hills', b: 'rivendell' },
  { a: 'tharbad', b: 'bree' },
  // North & Misty Mountains
  { a: 'rivendell', b: 'hollin' },
  { a: 'rivendell', b: 'carrock', cost: ['stealth'] }, // the High Pass
  { a: 'hollin', b: 'moria', cost: ['friendship'] }, // the doors of Moria
  { a: 'hollin', b: 'carrock', cost: ['resistance'] }, // over Caradhras
  { a: 'hollin', b: 'dunland' },
  { a: 'hollin', b: 'tharbad' },
  { a: 'moria', b: 'gladden_fields' },
  { a: 'gladden_fields', b: 'carrock' },
  { a: 'gladden_fields', b: 'lorien' },
  { a: 'carrock', b: 'old_forest_road' },
  // Enedwaith
  { a: 'tharbad', b: 'dunland' },
  { a: 'tharbad', b: 'druwaith_iaur' },
  { a: 'dunland', b: 'isengard' },
  { a: 'druwaith_iaur', b: 'pinnath_gelin' },
  { a: 'druwaith_iaur', b: 'fords_of_isen' },
  { a: 'isengard', b: 'fangorn_forest', cost: ['stealth'] },
  { a: 'isengard', b: 'fords_of_isen' },
  // Rohan
  { a: 'fangorn_forest', b: 'lorien', cost: ['friendship'] },
  { a: 'fangorn_forest', b: 'eastemnet' },
  { a: 'fangorn_forest', b: 'fords_of_isen' },
  { a: 'fords_of_isen', b: 'helms_deep' },
  { a: 'helms_deep', b: 'edoras' },
  { a: 'edoras', b: 'eastemnet' },
  { a: 'edoras', b: 'druadan_forest' },
  { a: 'edoras', b: 'erech', cost: ['stealth'] }, // the Paths of the Dead
  { a: 'eastemnet', b: 'emyn_muil' },
  { a: 'eastemnet', b: 'brown_lands' },
  // Gondor
  { a: 'druadan_forest', b: 'minas_tirith' },
  { a: 'minas_tirith', b: 'osgiliath' },
  { a: 'minas_tirith', b: 'pelargir' },
  { a: 'pelargir', b: 'lamedon' },
  { a: 'pelargir', b: 'south_ithilien' },
  { a: 'pelargir', b: 'harondor' },
  { a: 'dol_amroth', b: 'lamedon' },
  { a: 'dol_amroth', b: 'pinnath_gelin' },
  { a: 'lamedon', b: 'erech' },
  { a: 'erech', b: 'pinnath_gelin' },
  { a: 'grey_havens', b: 'dol_amroth', cost: ['friendship', 'friendship'] }, // the sea route
  // Ithilien & Mordor approaches. Mordor is webbed with stealth crossings —
  // badge counts below are read from a high-zoom board photo.
  { a: 'osgiliath', b: 'north_ithilien' },
  { a: 'osgiliath', b: 'south_ithilien' },
  { a: 'north_ithilien', b: 'south_ithilien' },
  { a: 'emyn_muil', b: 'north_ithilien', cost: ['resistance'] }, // the Dead Marshes
  { a: 'north_ithilien', b: 'udun', cost: ['stealth', 'stealth', 'stealth'] }, // the Black Gate
  { a: 'south_ithilien', b: 'minas_morgul', cost: ['stealth', 'stealth'] },
  { a: 'south_ithilien', b: 'harondor' },
  // Mordor interior
  { a: 'minas_morgul', b: 'mount_doom', cost: ['stealth', 'stealth'] }, // Cirith Ungol
  { a: 'minas_morgul', b: 'plateau_of_gorgoroth', cost: ['stealth'] },
  { a: 'mount_doom', b: 'plateau_of_gorgoroth', cost: ['stealth', 'stealth'] },
  { a: 'mount_doom', b: 'barad_dur' },
  { a: 'mount_doom', b: 'udun', cost: ['stealth', 'stealth', 'stealth'] },
  { a: 'plateau_of_gorgoroth', b: 'barad_dur' },
  { a: 'plateau_of_gorgoroth', b: 'nurn' },
  { a: 'barad_dur', b: 'udun', cost: ['stealth'] },
  { a: 'udun', b: 'dagorlad', cost: ['stealth'] },
  { a: 'nurn', b: 'near_harad' },
  // Rhovanion
  { a: 'brown_lands', b: 'emyn_muil' },
  { a: 'brown_lands', b: 'dagorlad' },
  { a: 'brown_lands', b: 'southern_mirkwood' },
  { a: 'dagorlad', b: 'rhun' },
  // Mirkwood & Dale
  { a: 'lorien', b: 'dol_guldur' },
  { a: 'dol_guldur', b: 'southern_mirkwood' },
  { a: 'southern_mirkwood', b: 'old_forest_road' },
  { a: 'old_forest_road', b: 'woodland_realm' },
  { a: 'woodland_realm', b: 'lake_town' },
  { a: 'lake_town', b: 'erebor' },
  { a: 'lake_town', b: 'dorwinion' },
  { a: 'erebor', b: 'iron_hills' },
  { a: 'iron_hills', b: 'dorwinion' },
  // Haradwaith
  { a: 'harondor', b: 'near_harad' },
  { a: 'umbar', b: 'near_harad' },
  { a: 'umbar', b: 'harondor' },
];

/** Battle lines (12): from a shadow location to the haven it menaces. */
export const BATTLE_LINES: BattleLineDef[] = [
  { id: 'moria_line', name: 'Moria → Rivendell', path: ['moria', 'hollin', 'weather_hills', 'rivendell'] },
  { id: 'shire_line', name: 'Dunland → The Shire', path: ['dunland', 'tharbad', 'sarn_ford', 'the_shire'] },
  { id: 'helms_line', name: "Isengard → Helm's Deep", path: ['isengard', 'fords_of_isen', 'helms_deep'] },
  { id: 'west_gondor_line', name: 'Isengard → Dol Amroth', path: ['isengard', 'druwaith_iaur', 'pinnath_gelin', 'lamedon', 'dol_amroth'] },
  { id: 'lorien_line', name: 'Dol Guldur → Lórien', path: ['dol_guldur', 'lorien'] },
  { id: 'wood_line', name: 'Dol Guldur → Woodland Realm', path: ['dol_guldur', 'old_forest_road', 'woodland_realm'] },
  { id: 'erebor_line', name: 'Rhûn → Erebor', path: ['rhun', 'dorwinion', 'lake_town', 'erebor'] },
  { id: 'rohan_line', name: "Barad-dûr → Helm's Deep", path: ['barad_dur', 'dagorlad', 'emyn_muil', 'eastemnet', 'edoras', 'helms_deep'] },
  { id: 'tirith_line', name: 'Núrn → Minas Tirith', path: ['nurn', 'plateau_of_gorgoroth', 'osgiliath', 'minas_tirith'] },
  { id: 'south_amroth_line', name: 'Minas Morgul → Dol Amroth', path: ['minas_morgul', 'south_ithilien', 'pelargir', 'dol_amroth'] },
  { id: 'harad_line', name: 'Near Harad → Minas Tirith', path: ['near_harad', 'harondor', 'south_ithilien', 'minas_tirith'] },
  { id: 'umbar_line', name: 'Umbar → Dol Amroth', path: ['umbar', 'dol_amroth'] },
];

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
