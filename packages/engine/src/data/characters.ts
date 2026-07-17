import type { CharacterDef, CharacterId } from '../types.js';

/**
 * The 13 playable characters. Names and starting locations are from the
 * rulebook. Frodo & Sam form a single unit (as do Merry & Pippin).
 *
 * Only Éowyn's ability is transcribed from a card visible in the rulebook;
 * the rest are reconstructions in the spirit of each character
 * (abilityReconstructed: true) — replace with the real card text as you
 * verify each one against the physical game.
 */
export const CHARACTERS: CharacterDef[] = [
  {
    id: 'frodo_sam',
    name: 'Frodo & Sam',
    title: 'The Ring-bearers',
    start: 'the_shire',
    bearer: true,
    abilityText:
      'Carry the One Ring. When traveling without spending Stealth, Frodo may instead put on the Ring: lose 1 hope, shift the Eye to his region, then roll the search ignoring shadow troops (Nazgûl still count).',
    abilityReconstructed: false, // the Ring procedure is from the rulebook's fine points
    color: '#e0a458',
  },
  {
    id: 'merry_pippin',
    name: 'Merry & Pippin',
    title: 'The Young Hobbits',
    start: 'the_shire',
    abilityText: 'Once per turn, they may do the Fellowship action as a free action.',
    abilityReconstructed: true,
    color: '#9bc06e',
  },
  {
    id: 'aragorn',
    name: 'Aragorn',
    title: 'Heir of Isildur',
    start: 'weather_hills',
    abilityText: 'When Aragorn Travels along normal paths, he may move 2 connections.',
    abilityReconstructed: true,
    color: '#3d5a80',
  },
  {
    id: 'arwen',
    name: 'Arwen',
    title: 'Evenstar',
    start: 'rivendell',
    abilityText: 'Searches rolled while Arwen is in Frodo\'s location roll 1 fewer die (minimum 1).',
    abilityReconstructed: true,
    color: '#8ea8c3',
  },
  {
    id: 'boromir',
    name: 'Boromir',
    title: 'Captain of the White Tower',
    start: 'minas_tirith',
    abilityText: 'When Boromir does the Attack action, he may roll up to 4 battle dice.',
    abilityReconstructed: true,
    color: '#b23a48',
  },
  {
    id: 'eomer',
    name: 'Éomer',
    title: 'Marshal of the Mark',
    start: 'eastemnet',
    abilityText: 'When Éomer Musters, he adds 2 Rohirrim troops instead of 1.',
    abilityReconstructed: true,
    color: '#a1683a',
  },
  {
    id: 'eowyn',
    name: 'Éowyn',
    title: 'Shieldmaiden of Rohan',
    start: 'edoras',
    abilityText:
      'When Éowyn Musters at a Rohirrim location, she spends no Friendship. If she is present when a battle is rolled, each Nazgûl! result removes 1 Nazgûl from her region instead of costing 2 friendly troops.',
    abilityReconstructed: false, // transcribed from her card shown in the rulebook
    color: '#d9c26a',
  },
  {
    id: 'faramir',
    name: 'Faramir',
    title: 'Ranger of Ithilien',
    start: 'minas_tirith',
    abilityText: 'Battles rolled in Faramir\'s location ignore Overrun results.',
    abilityReconstructed: true,
    color: '#5d7052',
  },
  {
    id: 'galadriel',
    name: 'Galadriel',
    title: 'Lady of Lórien',
    start: 'lorien',
    abilityText: 'When Galadriel does the Prepare action, she takes 2 matching symbol tokens if available.',
    abilityReconstructed: true,
    color: '#e8e2d5',
  },
  {
    id: 'gandalf',
    name: 'Gandalf',
    title: 'The Grey Pilgrim',
    start: 'tharbad',
    abilityText: 'Once per turn (free), while Gandalf is at a haven: gain 1 hope.',
    abilityReconstructed: true,
    color: '#a0a0b8',
  },
  {
    id: 'gimli',
    name: 'Gimli',
    title: 'Son of Glóin',
    start: 'erebor',
    abilityText: 'The Capture action costs Gimli 2 Valor instead of 3.',
    abilityReconstructed: true,
    color: '#7d5ba6',
  },
  {
    id: 'gollum',
    name: 'Gollum',
    title: 'The Wretched Guide',
    start: 'moria',
    abilityText: 'Gollum Travels along special paths without paying their symbol costs.',
    abilityReconstructed: true,
    color: '#6f8f6a',
  },
  {
    id: 'legolas',
    name: 'Legolas',
    title: 'Prince of the Woodland Realm',
    start: 'woodland_realm',
    abilityText: 'Legolas may do the Attack action against a connected location, using the friendly troops there.',
    abilityReconstructed: true,
    color: '#2a7f62',
  },
];

export const CHARACTER_MAP: Record<CharacterId, CharacterDef> = Object.fromEntries(
  CHARACTERS.map((c) => [c.id, c]),
);

export const BEARER: CharacterId = 'frodo_sam';
