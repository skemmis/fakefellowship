import type { CharacterDef, CharacterId } from '../types.js';

/**
 * The 13 playable characters. Names and starting locations are from the
 * rulebook; abilities are implemented from a community reference sheet and
 * paraphrased here in our own words — spot-check against the printed cards.
 * `abilityReconstructed` stays true only where our implementation knowingly
 * simplifies (noted inline).
 */
export const CHARACTERS: CharacterDef[] = [
  {
    id: 'frodo_sam',
    name: 'Frodo & Sam',
    title: 'The Ring-bearers',
    start: 'the_shire',
    bearer: true,
    abilityText:
      'Every Travel costs 1 Stealth or a search. Sam can spend Friendship during a search to cancel harmful dice (1 each). Preparing at a haven inside the card\'s own region banks an extra token. Frodo may put on the Ring when traveling: lose 1 hope and draw the Eye, but the search ignores shadow troops.',
    abilityReconstructed: false,
    color: '#e0a458',
  },
  {
    id: 'merry_pippin',
    name: 'Merry & Pippin',
    title: 'The Young Hobbits',
    start: 'the_shire',
    abilityText:
      'Once per turn (action): gain a Friendship token. In Frodo\'s location, an action and 3 Friendship buy 2 hope. Any time fewer than 4 Nazgûl haunt their region: 1 Friendship lures 2 Nazgûl into it.',
    abilityReconstructed: false,
    color: '#9bc06e',
  },
  {
    id: 'aragorn',
    name: 'Aragorn',
    title: 'Heir of Isildur',
    start: 'weather_hills',
    abilityText:
      'One free reroll on each search where he is present. In his battles, each Rout fells 2 shadow troops. Once per turn (action), after any objective is complete: his blade removes 1 shadow troop from his location.',
    abilityReconstructed: false,
    color: '#3d5a80',
  },
  {
    id: 'arwen',
    name: 'Arwen',
    title: 'Evenstar',
    start: 'rivendell',
    abilityText:
      'Musters at Elven locations without spending Friendship. When she Prepares, if a character stands in the card\'s region, an Elven troop travels from her to them. Once per turn, her Fellowship at a haven needs no matching region.',
    abilityReconstructed: false,
    color: '#8ea8c3',
  },
  {
    id: 'boromir',
    name: 'Boromir',
    title: 'Captain of the White Tower',
    start: 'minas_tirith',
    abilityText:
      'Musters at Gondor locations without spending Friendship. Capture costs him 1 less Valor. But the Ring tempts him: his Fellowship can never pass Resistance cards.',
    abilityReconstructed: false,
    color: '#b23a48',
  },
  {
    id: 'eomer',
    name: 'Éomer',
    title: 'Marshal of the Mark',
    start: 'eastemnet',
    abilityText:
      'Once per turn he rides: a free bonus Travel. In battles at his location with Rohirrim present, 1 friendly-troop loss is ignored.',
    abilityReconstructed: false,
    color: '#a1683a',
  },
  {
    id: 'eowyn',
    name: 'Éowyn',
    title: 'Shieldmaiden of Rohan',
    start: 'edoras',
    abilityText:
      'Musters at Rohirrim locations without spending Friendship. When she stands in a rolled battle, each Nazgûl! result destroys a Nazgûl in her region instead of costing 2 friendly troops.',
    abilityReconstructed: false,
    color: '#d9c26a',
  },
  {
    id: 'faramir',
    name: 'Faramir',
    title: 'Ranger of Ithilien',
    start: 'minas_tirith',
    abilityText:
      'Special paths cost him 1 fewer symbol. When he Travels with friendly troops, he may Attack at his destination as a free action. Once per turn (action), at a haven: retrieve a region card matching his region from the discard pile.',
    abilityReconstructed: false,
    color: '#5d7052',
  },
  {
    id: 'galadriel',
    name: 'Galadriel',
    title: 'Lady of Lórien',
    start: 'lorien',
    abilityText:
      'In battles with an Elven troop present, one free reroll. At a haven (any player\'s turn): 1 Friendship summons a random event left out of the game. Once per turn (action): her Mirror reveals the next 4 player cards.',
    abilityReconstructed: true, // Mirror: the printed card also lets you rearrange them
    color: '#e8e2d5',
  },
  {
    id: 'gandalf',
    name: 'Gandalf',
    title: 'The Grey Pilgrim',
    start: 'tharbad',
    abilityText:
      'His Muster adds an extra troop. Traveling alone on ordinary roads, he covers 2 connections. In battles where he stands, Valor may pay for die rerolls.',
    abilityReconstructed: true, // printed card changes dice rather than rerolling
    color: '#a0a0b8',
  },
  {
    id: 'gimli',
    name: 'Gimli',
    title: 'Son of Glóin',
    start: 'erebor',
    abilityText:
      'Musters at Dwarven locations without spending Friendship. Once per turn (action): his craft yields a Valor token.',
    abilityReconstructed: false,
    color: '#7d5ba6',
  },
  {
    id: 'gollum',
    name: 'Gollum',
    title: 'The Wretched Guide',
    start: 'moria',
    abilityText:
      'Cannot Muster, Attack, or Capture — and hope frays (−1 at turn\'s end) while he keeps company with Frodo & Sam. Searches where he lurks roll 3 fewer dice. He Prepares anywhere (no haven needed). Once per turn (action): he filches any card from the discard pile.',
    abilityReconstructed: false,
    color: '#6f8f6a',
  },
  {
    id: 'legolas',
    name: 'Legolas',
    title: 'Prince of the Woodland Realm',
    start: 'woodland_realm',
    abilityText:
      'Once per turn (action): gain a Stealth token. Any player\'s turn: 1 Stealth lets him shoot — remove a shadow troop at or beside him, or send a Nazgûl in his region back to Mordor. Once per turn (free): peek at the top shadow card.',
    abilityReconstructed: false,
    color: '#2a7f62',
  },
];

export const CHARACTER_MAP: Record<CharacterId, CharacterDef> = Object.fromEntries(
  CHARACTERS.map((c) => [c.id, c]),
);

export const BEARER: CharacterId = 'frodo_sam';
