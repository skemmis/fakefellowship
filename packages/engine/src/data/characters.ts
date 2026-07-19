import type { CharacterDef, CharacterId } from '../types.js';

/**
 * The 13 playable characters. Names and starting locations are from the
 * rulebook; abilities are split out by their printed names and paraphrased
 * here in our own words. Symbol names in the text (Friendship / Valor /
 * Stealth / Resistance / hope / Nazgûl / shadow troop / Eye) are rendered as
 * icons in the UI.
 */
export const CHARACTERS: CharacterDef[] = [
  {
    id: 'frodo_sam',
    name: 'Frodo & Sam',
    title: 'The Ring-bearers',
    start: 'the_shire',
    bearer: true,
    color: '#e0a458',
    abilities: [
      { name: 'The Ring-bearers', text: 'Whenever Frodo Travels (or is brought along on a Travel), the current player must either spend 1 Stealth or roll a search at his destination.' },
      { name: "Elrond's Support", text: "Once per turn, when Frodo Prepares at a haven in the card's own region, bank 1 extra token." },
      { name: "Sam's Aid", text: 'Whenever a search is rolled, spend Friendship to ignore that many harmful dice (1 each).' },
      { name: 'Put on the Ring', text: 'Before a search, Frodo may ignore all shadow troops present — lose 1 hope and the Eye shifts to his region.' },
    ],
  },
  {
    id: 'merry_pippin',
    name: 'Merry & Pippin',
    title: 'The Young Hobbits',
    start: 'the_shire',
    color: '#9bc06e',
    abilities: [
      { name: 'Loyal Friend', text: 'Once per turn (action): gain a Friendship token.' },
      { name: 'Distract', text: 'Any turn: while fewer than 4 Nazgûl haunt their region, spend 1 Friendship to lure up to 2 Nazgûl into it.' },
      { name: 'Give Us a Song!', text: 'Action: in Frodo\'s location, spend 3 Friendship to gain 2 hope.' },
    ],
  },
  {
    id: 'aragorn',
    name: 'Aragorn',
    title: 'Heir of Isildur',
    start: 'weather_hills',
    color: '#3d5a80',
    abilities: [
      { name: 'Ranger of the North', text: 'Present at a search, he may reroll 1 die (free).' },
      { name: 'Captain of the West', text: 'Present at a battle, each Rout removes up to 2 shadow troops instead of 1.' },
      { name: 'Andúril', text: 'Once per turn (action): if at least 1 objective is complete, remove 1 shadow troop from his location.' },
    ],
  },
  {
    id: 'arwen',
    name: 'Arwen',
    title: 'Evenstar',
    start: 'rivendell',
    color: '#8ea8c3',
    abilities: [
      { name: 'Evenstar', text: 'Musters at Elven locations without spending Friendship.' },
      { name: 'Send Aid', text: "When she Prepares, if a character stands in the card's region, move 1 Elven troop from her location to them." },
      { name: 'Give Counsel', text: 'Once per turn, her Fellowship at a haven needs no matching region.' },
      { name: 'Solo Game', text: "Once per turn (solo), her Prepare card need not match her region." },
    ],
  },
  {
    id: 'boromir',
    name: 'Boromir',
    title: 'Captain of the White Tower',
    start: 'minas_tirith',
    color: '#b23a48',
    abilities: [
      { name: 'Heir to the Steward', text: 'Musters at Gondor locations without spending Friendship.' },
      { name: 'Hero of Gondor', text: 'His Capture costs 1 fewer Valor.' },
      { name: 'Tempted by Power', text: 'In the Fellowship action he can never give Resistance (and none may be taken from him).' },
    ],
  },
  {
    id: 'eomer',
    name: 'Éomer',
    title: 'Marshal of the Mark',
    start: 'eastemnet',
    color: '#a1683a',
    abilities: [
      { name: 'Rider of Rohan', text: 'Once per turn on his turn: a free bonus Travel action.' },
      { name: 'Marshal of the Mark', text: 'If Éomer and a Rohirrim troop are present at a battle, ignore the loss of 1 friendly troop.' },
    ],
  },
  {
    id: 'eowyn',
    name: 'Éowyn',
    title: 'Shieldmaiden of Rohan',
    start: 'edoras',
    color: '#d9c26a',
    abilities: [
      { name: 'Shieldmaiden of Rohan', text: 'Musters at Rohirrim locations without spending Friendship.' },
      { name: 'No Living Man Am I!', text: 'Present at a battle, each Nazgûl result destroys a Nazgûl in her region (removed from the game) instead of costing 2 friendly troops.' },
    ],
  },
  {
    id: 'faramir',
    name: 'Faramir',
    title: 'Ranger of Ithilien',
    start: 'minas_tirith',
    color: '#5d7052',
    abilities: [
      { name: 'Ambush', text: 'When he Travels with a friendly troop, he may make a free Attack at his destination — and on that ambush, 1 Stealth turns a battle die to a shadow-troop kill (Rout).' },
      { name: 'Stealthy', text: 'Special paths cost him 1 fewer symbol.' },
      { name: 'Wisdom of the Eldar', text: "Once per turn (action): from a haven, take a Resistance region card matching his region from the discard pile." },
    ],
  },
  {
    id: 'galadriel',
    name: 'Galadriel',
    title: 'Lady of Lórien',
    start: 'lorien',
    color: '#e8e2d5',
    abilities: [
      { name: 'Lady of Light', text: 'Any turn, while in a haven: spend 1 Friendship to draw a random event that was left out of the game at setup.' },
      { name: 'Mirror of Galadriel', text: 'Action: reveal the top 4 player cards and return them to the top in any order.' },
      { name: 'Nenya', text: 'If Galadriel and an Elven troop are present at a battle, reroll up to 1 die (free).' },
    ],
  },
  {
    id: 'gandalf',
    name: 'Gandalf',
    title: 'The Grey Pilgrim',
    start: 'tharbad',
    color: '#a0a0b8',
    abilities: [
      { name: 'Mithrandir', text: 'His Muster adds up to 2 troops instead of 1.' },
      { name: 'Shadowfax', text: 'Traveling alone on ordinary roads, he may move 2 locations (no special paths).' },
      { name: 'Light and Flame', text: 'Present at a battle, spend Valor to change that many battle dice to any faces you choose.' },
    ],
  },
  {
    id: 'gimli',
    name: 'Gimli',
    title: 'Son of Glóin',
    start: 'erebor',
    color: '#7d5ba6',
    abilities: [
      { name: 'Son of Glóin', text: 'Musters at Dwarven locations without spending Friendship.' },
      { name: 'Dwarven Craft', text: 'Once per turn (action): gain a Valor token.' },
    ],
  },
  {
    id: 'gollum',
    name: 'Gollum',
    title: 'The Wretched Guide',
    start: 'moria',
    color: '#6f8f6a',
    abilities: [
      { name: 'They Tricks Us!', text: 'When Gollum, Frodo, and a friendly troop come together in one location, lose 1 hope.' },
      { name: 'Guide', text: 'Searches where Gollum is present roll 3 fewer dice.' },
      { name: 'Slinker', text: 'Action (once per turn): take any 1 card from the player discard pile.' },
      { name: 'Cunning', text: 'He Prepares anywhere (no haven needed), and may send 1 friendly troop from his location to an adjacent one (no battle). He cannot Muster, Attack, or Capture.' },
    ],
  },
  {
    id: 'legolas',
    name: 'Legolas',
    title: 'Prince of the Woodland Realm',
    start: 'woodland_realm',
    color: '#2a7f62',
    abilities: [
      { name: 'Walk Silently', text: 'Action (once per turn): gain a Stealth token.' },
      { name: 'Sure Shot', text: "Any turn: spend 1 Stealth to remove a shadow troop from Legolas's location or an adjacent one, or send a Nazgûl in his region to Mordor." },
      { name: 'Keen Sight', text: 'When Legolas Prepares, look at the top card of the shadow deck.' },
    ],
  },
];

export const CHARACTER_MAP: Record<CharacterId, CharacterDef> = Object.fromEntries(
  CHARACTERS.map((c) => [c.id, c]),
);

export const BEARER: CharacterId = 'frodo_sam';
