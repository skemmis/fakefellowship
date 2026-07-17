import type { HeroDef, HeroId } from '../types.js';

/**
 * The eight heroes of Emberfall (original characters). Each player controls
 * two of them. Wick Fernby, the shardbearer carrying the Ember, is not a
 * hero — the heroes escort and guide him.
 */
export const HEROES: HeroDef[] = [
  {
    id: 'alric',
    name: 'Alric',
    title: 'Shield-Marshal of the Vale',
    ability: 'battle_die',
    abilityText: 'Rolls 4 battle dice instead of 3.',
    color: '#b23a48',
  },
  {
    id: 'sylra',
    name: 'Sylra',
    title: 'the Farstrider',
    ability: 'swift',
    abilityText: 'Her Move action covers up to 2 connections.',
    color: '#2a7f62',
  },
  {
    id: 'maelis',
    name: 'Maelis',
    title: 'the Lampwright',
    ability: 'kindle',
    abilityText: 'Once per turn (free), while at a standing sanctuary: +1 hope.',
    color: '#e0a458',
  },
  {
    id: 'berrin',
    name: 'Berrin',
    title: 'Deepdelver of the Crags',
    ability: 'muster',
    abilityText: 'His Muster action places 1 extra troop.',
    color: '#7d5ba6',
  },
  {
    id: 'tansy',
    name: 'Tansy',
    title: 'Underbough Scout',
    ability: 'guide',
    abilityText: 'Her Guide action moves the shardbearer up to 2 connections.',
    color: '#4e937a',
  },
  {
    id: 'corwin',
    name: 'Corwin',
    title: 'Captain of Candlecross',
    ability: 'bulwark',
    abilityText: 'Skull results in his battles never cost allied troops.',
    color: '#3d5a80',
  },
  {
    id: 'nim',
    name: 'Nim',
    title: 'the Whisperer',
    ability: 'insight',
    abilityText: 'Her player draws 1 extra card at end of turn.',
    color: '#9a8c98',
  },
  {
    id: 'elowen',
    name: 'Elowen',
    title: 'Warden of Heartwood',
    ability: 'longshot',
    abilityText: 'May Battle shadow troops in an adjacent location.',
    color: '#606c38',
  },
];

export const HERO_MAP: Record<HeroId, HeroDef> = Object.fromEntries(
  HEROES.map((h) => [h.id, h]),
);

export const SHARDBEARER_NAME = 'Wick Fernby';
