import { HERO_MAP } from './data/heroes.js';
import { GOAL_LOCATION, MAP } from './data/map.js';
import { OBJECTIVES_REQUIRED } from './data/constants.js';
import { canAct } from './rules.js';
import type { Action, GameState, HeroId, LocationId } from './types.js';

/**
 * Enumerate every legal action for the active player. Used by the headless
 * simulator (bots pick from this list) and by the client to highlight what a
 * player may do — the engine remains the single source of truth for legality.
 *
 * Multi-step moves are enumerated as single steps (bots just move twice);
 * swift/guide 2-step paths are still accepted by the reducer.
 */
export function legalActions(s: GameState): Action[] {
  if (s.phase !== 'playing') return [];
  const p = s.players[s.turn.playerIdx];
  const out: Action[] = [];

  for (const hero of p.heroes) {
    const h = s.heroes[hero];
    const ability = HERO_MAP[hero].ability;

    if (canAct(s, hero)) {
      // Moves
      for (const n of MAP[h.location].adjacent) {
        out.push({ type: 'move', hero, path: [n] });
      }
      // Muster
      const def = MAP[h.location];
      if (
        def.sanctuary &&
        s.sanctuaries[h.location] !== 'fallen' &&
        s.supply.factions[def.sanctuary] > 0
      ) {
        out.push({ type: 'muster', hero });
      }
      // Battle
      const targets: LocationId[] = [h.location];
      if (ability === 'longshot') targets.push(...MAP[h.location].adjacent);
      for (const t of targets) {
        if ((s.shadow[t] ?? 0) > 0) out.push({ type: 'battle', hero, location: t });
      }
      // Guide / Hide
      const nearBearer =
        h.location === s.shardbearer.location ||
        MAP[h.location].adjacent.includes(s.shardbearer.location);
      if (nearBearer) {
        for (const n of MAP[s.shardbearer.location].adjacent) {
          out.push({ type: 'guide', hero, path: [n] });
        }
      }
      if (h.location === s.shardbearer.location && !s.shardbearer.hidden) {
        out.push({ type: 'hide', hero });
      }
      // Destroy the Ember
      if (
        s.shardbearer.location === GOAL_LOCATION &&
        h.location === GOAL_LOCATION &&
        !s.wraiths.some((w) => w.location === GOAL_LOCATION) &&
        s.objectives.filter((o) => o.complete).length >= OBJECTIVES_REQUIRED
      ) {
        out.push({ type: 'destroyEmber', hero });
      }
    }

    // Free actions
    if (
      ability === 'kindle' &&
      !s.turn.kindleUsed &&
      MAP[h.location].sanctuary &&
      s.sanctuaries[h.location] !== 'fallen'
    ) {
      out.push({ type: 'kindle', hero });
    }
  }

  // Cards (free actions)
  for (const card of p.hand) {
    switch (card.kind) {
      case 'swift_march':
        for (const hero of p.heroes) {
          for (const n of MAP[s.heroes[hero].location].adjacent) {
            out.push({ type: 'playCard', card: card.id, hero, path: [n] });
          }
        }
        break;
      case 'rally_banner':
        for (const [loc, status] of Object.entries(s.sanctuaries)) {
          const f = MAP[loc].sanctuary!;
          if (status !== 'fallen' && s.supply.factions[f] > 0) {
            out.push({ type: 'playCard', card: card.id, location: loc });
          }
        }
        break;
      case 'ambush': {
        const near = new Set<LocationId>();
        for (const hero of p.heroes) {
          near.add(s.heroes[hero].location);
          for (const n of MAP[s.heroes[hero].location].adjacent) near.add(n);
        }
        for (const loc of near) {
          if ((s.shadow[loc] ?? 0) > 0) {
            out.push({ type: 'playCard', card: card.id, location: loc });
          }
        }
        break;
      }
      case 'lantern_oil':
        out.push({ type: 'playCard', card: card.id });
        if (s.shardbearer.corruption > 0) {
          out.push({ type: 'playCard', card: card.id, cleanse: true });
        }
        break;
      case 'hearthsong':
        out.push({ type: 'playCard', card: card.id });
        break;
      case 'fernpath':
        for (const n of MAP[s.shardbearer.location].adjacent) {
          out.push({ type: 'playCard', card: card.id, path: [n] });
        }
        if (!s.shardbearer.hidden) {
          out.push({ type: 'playCard', card: card.id, hide: true });
        }
        break;
      case 'farsight':
        out.push({ type: 'playCard', card: card.id });
        break;
      case 'ashen_surge':
        break; // never playable
    }
  }

  out.push({ type: 'endTurn' });
  return out;
}
