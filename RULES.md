# Implemented Ruleset & Fidelity Matrix

This digital edition implements the cooperative board game *The Lord of the
Rings: Fate of the Fellowship* (designed by Matt Leacock, published by Z-Man
Games) for personal hobby use. Game mechanics were transcribed from the
publisher's rulebook and a photograph of the board; all rule text in this
repository is paraphrased, and no artwork or card text is copied.

## Fidelity matrix

**Transcribed from the rulebook / board (exact):**

- Turn structure: up to 4 actions with one of your two characters and up to 1
  with the other, finishing one character before the other; then draw 2 player
  cards; then resolve shadow cards equal to the threat rate. Hand limit 7.
- The six actions: Travel (paths / symbol-costed special paths / battle
  lines; bringing troops and characters along; Frodo must spend Stealth or
  face a search), Fellowship (trade a region card matching your current
  region with a co-located player), Prepare (at a haven, bank a region card's
  symbol as a token), Muster (1 Friendship → 1 matching troop), Attack
  (shifts the Eye of Sauron to the region, then up to 3 battle dice — 1 per
  friendly troop, roll fewer if you like), Capture (3 Valor at a cleared
  stronghold with a friendly troop → it becomes a haven, +2 hope, Eye
  arrives).
- Search rolls: 1 die per Nazgûl in Frodo's region + 1 per shadow troop in
  his location, max 7. Faces: Slip By / Weary (−1 hope) / Exposed (−1 hope,
  ignored in havens) / Recall (a Nazgûl returns to Mordor). Resistance
  rerolls by present characters.
- Battle rolls: Rout / Exchange / Overrun (ignored in havens) / Nazgûl!
  (−2 friendly troops if Nazgûl are in the region). Valor kills and
  Resistance rerolls by present characters. Shadow-card battles roll 1 die
  per shadow troop (max 3) and do not move the Eye.
- Putting on the Ring: −1 hope, Eye to Frodo's region, search ignores shadow
  troops.
- The shadow deck's two-backed mechanism: the back of the next card decides
  whether the flipped card's Advance (move every troop on a battle line one
  step, then battles front-to-back) or Reinforce (+1 troop, battle if
  garrisoned, then a special order) half resolves. Special orders: shift the
  Eye to Frodo's region (search if already there) ×16, move the 2 nearest
  Nazgûl one region closer ×16, deploy 3 Nazgûl from Mordor to the Eye (or
  recall 3 if the Eye is in Mordor) ×16. Two special shadow cards begin in
  the discard and only enter play when the skies darken.
- Skies Darken: threat +1; Eye to Frodo's region or −2 hope if already
  there; +3 shadow troops (battle if garrisoned); shadow discard shuffled
  onto the deck. Removed from the game, no replacement draw.
- Losing: only by hope reaching 0. Shortfalls (unplaceable shadow troops,
  undrawable player cards) each cost 1 hope. A haven overrun with no
  defenders becomes a stronghold, −3 hope.
- Winning: complete every other objective, then Frodo at Mount Doom spends
  5 Resistance and survives a final search (+1 die per missing hope, max 7
  total). Any hope remaining = victory.
- Setup: all starting troop/Nazgûl/Eye placements, the 9 seeding shadow
  draws, per-player-count event mix and hand sizes, difficulty table
  (4/5/5/6/6 darkenings; 4/4/5/5/6 objectives), first player = lowest region
  card number, hope starts at 6 (max 8), threat track 2/2/3/3/4/4/5.
- Characters: all 13 names and starting locations; Frodo & Sam and
  Merry & Pippin are single units; Frodo is always in play. Éowyn's ability
  is transcribed from her card.

**Reconstructed (mechanically plausible stand-ins, marked ≈ in the UI —
correct these against the physical game and edit the data files):**

- The exact routes of some paths and battle lines (`engine/src/data/board.ts`)
  — read from a board photo, a few orderings are judgment calls.
- Search/battle die face distributions (`SEARCH_DIE` / `BATTLE_DIE`).
- The 14 event cards' effects, 11 of 13 character abilities, objective
  requirements and rewards, the 2 special shadow cards' effects, region-card
  symbol distribution and flavor numbers, Skies Darken troop-drop locations.

**Not yet implemented:**

- Consent prompts when traveling with another player's character (the UI
  notes "ask their player!" and the log announces it; the move is allowed).
- The full 24-objective deck (9 objectives implemented; each game deals the
  finale plus 3–5 others per difficulty).

**Solo variant (implemented):** one player runs Frodo & Sam plus 4 random
characters. A solo token rotates each turn: the token character takes up to
4 actions and Frodo & Sam take 1 bonus action. Fellowship is skipped (one
shared hand) and Prepare requires a region card matching the character's
current region. One relaxation: the rulebook has the Frodo action come
strictly before or after the token character's actions; this edition lets it
interleave.

## Known state

- 28 engine tests green; 1000+ headless bot games run with zero invariant
  violations and guaranteed termination.
- The built-in bots lose essentially every game — they are coverage tools,
  not competent players. Two humans coordinating stealth, garrisons, and Eye
  manipulation play far better. If real play still feels hopeless, the prime
  suspects are the reconstructed die faces and objective/event content above.

## Headless debugging

```bash
npm run build -w @emberfall/engine
node packages/engine/dist/cli.js 500 --players 3            # stats + crash hunt
node packages/engine/dist/cli.js 1 --trace --seed 42        # full game log
node packages/engine/dist/cli.js 300 --bot random           # chaos-monkey
node packages/engine/dist/cli.js 200 --difficulty legendary
```

Every game is reproducible from its seed; invariants (troop/card/token
conservation, bounds) are checked after every action.
