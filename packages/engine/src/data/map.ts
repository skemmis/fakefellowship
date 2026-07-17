import type { LocationDef, LocationId } from '../types.js';

/**
 * The world of Emberfall — an original map. Heroes start in the Hearthshires
 * in the far west; the Cindermaw, where the Ember must be destroyed, lies in
 * Ashenfell in the far east.
 */
const defs: Omit<LocationDef, 'adjacent'>[] = [
  // The Hearthshires
  { id: 'hearthden', name: 'Hearthden', region: 'The Hearthshires', x: 90, y: 340 },
  { id: 'greenhollow', name: 'Greenhollow', region: 'The Hearthshires', x: 185, y: 240 },
  { id: 'ferryford', name: 'Ferryford', region: 'The Hearthshires', x: 195, y: 440 },
  // Vale of Lanterns
  { id: 'lanternhold', name: 'Lanternhold', region: 'Vale of Lanterns', x: 315, y: 150, sanctuary: 'vale' },
  { id: 'brightmoor', name: 'Brightmoor', region: 'Vale of Lanterns', x: 450, y: 95 },
  { id: 'candlecross', name: 'Candlecross', region: 'Vale of Lanterns', x: 340, y: 300 },
  { id: 'palewatch', name: 'Palewatch', region: 'Vale of Lanterns', x: 475, y: 225 },
  // Windward Steppe
  { id: 'windmoot', name: 'Windmoot', region: 'Windward Steppe', x: 605, y: 110, sanctuary: 'riders' },
  { id: 'gale_downs', name: 'Gale Downs', region: 'Windward Steppe', x: 720, y: 175 },
  { id: 'stonefold', name: 'Stonefold', region: 'Windward Steppe', x: 590, y: 255 },
  { id: 'redgrass', name: 'Redgrass', region: 'Windward Steppe', x: 715, y: 290 },
  // Sylvan Reach
  { id: 'mistglade', name: 'Mistglade', region: 'Sylvan Reach', x: 330, y: 475 },
  { id: 'heartwood', name: 'Heartwood', region: 'Sylvan Reach', x: 440, y: 555, sanctuary: 'sylvan' },
  { id: 'silverbrook', name: 'Silverbrook', region: 'Sylvan Reach', x: 540, y: 465 },
  { id: 'thornfen', name: 'Thornfen', region: 'Sylvan Reach', x: 645, y: 555 },
  // Deepholm Crags
  { id: 'deepholm_gate', name: 'Deepholm Gate', region: 'Deepholm Crags', x: 615, y: 380, sanctuary: 'deepholm' },
  { id: 'cragspire', name: 'Cragspire', region: 'Deepholm Crags', x: 730, y: 425 },
  { id: 'undervault', name: 'Undervault', region: 'Deepholm Crags', x: 775, y: 530 },
  { id: 'emberpass', name: 'Emberpass', region: 'Deepholm Crags', x: 815, y: 350 },
  // Ashenfell
  { id: 'ashgate', name: 'Ashgate', region: 'Ashenfell', x: 855, y: 240, stronghold: true },
  { id: 'sootplain', name: 'Sootplain', region: 'Ashenfell', x: 880, y: 445 },
  { id: 'wraithspire', name: 'Wraithspire', region: 'Ashenfell', x: 935, y: 330, stronghold: true },
  { id: 'cinder_approach', name: 'Cinder Approach', region: 'Ashenfell', x: 925, y: 560 },
  { id: 'cindermaw', name: 'The Cindermaw', region: 'Ashenfell', x: 965, y: 455 },
];

const edges: [LocationId, LocationId][] = [
  ['hearthden', 'greenhollow'],
  ['hearthden', 'ferryford'],
  ['greenhollow', 'lanternhold'],
  ['greenhollow', 'candlecross'],
  ['ferryford', 'candlecross'],
  ['ferryford', 'mistglade'],
  ['lanternhold', 'brightmoor'],
  ['lanternhold', 'candlecross'],
  ['brightmoor', 'palewatch'],
  ['brightmoor', 'windmoot'],
  ['candlecross', 'palewatch'],
  ['candlecross', 'mistglade'],
  ['palewatch', 'stonefold'],
  ['palewatch', 'windmoot'],
  ['windmoot', 'gale_downs'],
  ['gale_downs', 'redgrass'],
  ['gale_downs', 'stonefold'],
  ['stonefold', 'redgrass'],
  ['stonefold', 'deepholm_gate'],
  ['stonefold', 'silverbrook'],
  ['redgrass', 'ashgate'],
  ['mistglade', 'heartwood'],
  ['heartwood', 'silverbrook'],
  ['silverbrook', 'deepholm_gate'],
  ['silverbrook', 'thornfen'],
  ['thornfen', 'undervault'],
  ['deepholm_gate', 'cragspire'],
  ['cragspire', 'emberpass'],
  ['cragspire', 'undervault'],
  ['undervault', 'cinder_approach'],
  ['emberpass', 'ashgate'],
  ['emberpass', 'sootplain'],
  ['ashgate', 'wraithspire'],
  ['sootplain', 'wraithspire'],
  ['sootplain', 'cinder_approach'],
  ['cinder_approach', 'cindermaw'],
  ['wraithspire', 'cindermaw'],
];

function buildMap(): Record<LocationId, LocationDef> {
  const map: Record<LocationId, LocationDef> = {};
  for (const d of defs) map[d.id] = { ...d, adjacent: [] };
  for (const [a, b] of edges) {
    if (!map[a] || !map[b]) throw new Error(`bad edge ${a}-${b}`);
    map[a].adjacent.push(b);
    map[b].adjacent.push(a);
  }
  return map;
}

export const MAP: Record<LocationId, LocationDef> = buildMap();
export const LOCATIONS: LocationDef[] = Object.values(MAP);
export const SANCTUARIES: LocationDef[] = LOCATIONS.filter((l) => l.sanctuary);
export const START_LOCATION: LocationId = 'hearthden';
export const GOAL_LOCATION: LocationId = 'cindermaw';

export function areAdjacent(a: LocationId, b: LocationId): boolean {
  return MAP[a]?.adjacent.includes(b) ?? false;
}

/** Next step from `from` along a shortest path to `to` (BFS). */
export function stepToward(from: LocationId, to: LocationId): LocationId {
  if (from === to) return from;
  const prev: Record<LocationId, LocationId | null> = { [from]: null };
  const queue: LocationId[] = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of MAP[cur].adjacent) {
      if (!(n in prev)) {
        prev[n] = cur;
        queue.push(n);
      }
    }
  }
  if (!(to in prev)) return from; // unreachable (shouldn't happen: map is connected)
  let node = to;
  while (prev[node] !== from) node = prev[node]!;
  return node;
}

/** BFS distance between two locations. */
export function distance(a: LocationId, b: LocationId): number {
  if (a === b) return 0;
  const dist: Record<LocationId, number> = { [a]: 0 };
  const queue: LocationId[] = [a];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of MAP[cur].adjacent) {
      if (!(n in dist)) {
        dist[n] = dist[cur] + 1;
        if (n === b) return dist[n];
        queue.push(n);
      }
    }
  }
  return Infinity;
}
