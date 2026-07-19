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
- Characters: all 13 names, starting locations, and abilities, verified
  against the printed character cards (paraphrased). Frodo & Sam and
  Merry & Pippin are single units; Frodo is always in play. Gandalf's Light
  and Flame sets battle dice for Valor (searches too once he is the White);
  Gollum's treachery costs 1 hope whenever he, Frodo, and a friendly troop
  gather in one location, and his Prepare may nudge a friendly troop to an
  adjacent location; Arwen's off-region Prepare (solo) and Send Aid are in.
  Galadriel's Mirror reveals the top 4 player cards and lets her player
  reorder them; Legolas's Keen Sight peek fires when he Prepares; Faramir's
  Ambush lets 1 Stealth turn a battle die to a kill on his free Attack, and
  his Wisdom takes a matching Resistance card from the discard. Remaining
  simplifications: Arwen's Send Aid picks its beneficiary automatically; the
  solo "Frodo before or after the token character" ordering may interleave.
- Captured strongholds never receive card-driven shadow troops.

**Transcribed from the physical cards (photos supplied by the owner):**

- The full shadow deck: all 48 regular cards (battle-line endpoints,
  reinforce origins, 16/16/16 special orders) with their real printed backs
  (25 red-flag / 25 Eye-banner), plus both specials — The Drums of War
  (+1 troop at every Mordor shadow stronghold) and The Wheels of Saruman
  (the current player picks: remove 2 friendly troops / one player gives up
  2 cards or tokens / lose 1 hope).
- All 14 event cards, all 48 region cards (symbols + corner numbers), and
  all 12 Skies Darken troop-drop locations.
- Both dice: search 2 slip / 2 weary / 1 exposed / 1 recall; battle 2 rout /
  2 exchange / 1 overrun / 1 Nazgûl (counts confirmed by the owner).
- All 24 objective cards: character-binding setup ("use X" cards pull that
  character into the game), extra setup shadow troops, troops reserved on
  cards, objective-card actions, plain-location Captures (Osgiliath,
  Dunland), counters (Legolas's tally, Éomer's pinned troops, the hobbits'
  pledges, Éowyn's Nazgûl), Aragorn's once-per-game ride, Boromir's last
  stand and replacement, and Gandalf's fall and return in white.

**Reconstructed (stand-ins pending confirmation — see `uncertain` notes in
`engine/src/data/cards.ts`):**

- The exact routes of some paths and battle lines (`engine/src/data/board.ts`)
  — being trued up with the in-browser board editor.
- A few unreadable objective-card details: some alternative Capture costs,
  three symbol costs (Unseat Denethor, Free Théoden, Attain the Blessing),
  the reward token types, and the exact die-outcome tables for Confront the
  Balrog and Shelob's Lair.
- Gandalf the White's upgraded battle magic and Éowyn's die-changing grant
  (not yet implemented).

**Not yet implemented:**

- Consent prompts when traveling with another player's character (the UI
  notes "ask their player!" and the log announces it; the move is allowed).
- Optional troop-repositioning rewards on a few objectives (Subdue Umbar,
  Rangers Secure Eriador, Bring Light to Mirkwood, Avenge Balin) — the
  objective completes; the free move is skipped.
- Infiltrate Minas Morgul's deck surgery is automated (both top shadow
  cards are removed rather than player-chosen).

**Solo variant (implemented):** one player runs Frodo & Sam plus 4 random
characters. A solo token rotates each turn: the token character takes up to
4 actions and Frodo & Sam take 1 bonus action. Fellowship is skipped (one
shared hand) and Prepare requires a region card matching the character's
current region. One relaxation: the rulebook has the Frodo action come
strictly before or after the token character's actions; this edition lets it
interleave.

## Known state

- 32 engine tests green; 1000+ headless bot games run with zero invariant
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
