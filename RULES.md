# Emberfall — Rules (v0)

These are the exact rules the engine enforces. Everything here is tunable in
`packages/engine/src/data/constants.ts`; the headless simulator
(`packages/engine/dist/cli.js`) is the fastest way to check the effect of a
change.

## Goal

Win together by destroying the **Ember**: get the shardbearer **Wick Fernby**
to **the Cindermaw**, with at least **2 of the 3 objectives** complete, a hero
standing beside him, and no wraiths at the Cindermaw — then take the
**Destroy the Ember** action.

You all lose immediately if any of these happen:

- **Hope reaches 0.**
- **Corruption reaches 8** (Wick succumbs to the Ember).
- **2 sanctuaries have fallen.**
- **The shadow troop supply runs out** when a spawn is required.
- **The player deck runs out** when a draw is required (time runs out).

## Setup

- 1–4 players; each controls **two heroes** with unique abilities.
- All heroes and Wick start in **Hearthden**.
- Shadow troops start on the board, heaviest in Ashenfell; 3 wraiths begin at
  the strongholds (Wraithspire ×2, Ashgate ×1).
- Hope starts at **6** (max 8). Threat starts at 2 shadow cards per turn.
- Each player is dealt 2 cards; then 4 **Ashen Surge** cards are shuffled into
  the player deck. Games with 3–4 players add a few extra travel/support cards
  to the deck (the clock scales with the table size).

## On your turn

**1. Actions.** Split actions between your two heroes: one hero may take up to
**4** actions, the other up to **1** (you choose implicitly by spending them).

| Action | Effect |
| --- | --- |
| **Move** | Move your hero along 1 connection (Sylra: up to 2). |
| **Muster** | At a standing sanctuary: place 2 troops of its faction from the supply (Berrin: 3). |
| **Battle** | Roll 3 battle dice against shadow troops in your hero's location (Alric: 4 dice; Elowen: may target an adjacent location). Each die: 1/6 crit (slay 2), 2/6 hit (slay 1), 2/6 miss, 1/6 skull (one allied troop present is lost; Corwin ignores skulls). |
| **Guide** | If your hero is at or adjacent to Wick: move him 1 connection (Tansy: up to 2). Moving reveals him. If he ends at a standing sanctuary, corruption eases by 1. |
| **Hide** | If your hero is with Wick: he becomes hidden. |
| **Destroy the Ember** | See Goal above. Wins the game. |

**Free actions** (don't cost an action): playing cards from your hand, and
Maelis's **Kindle** (once per turn, at a standing sanctuary: +1 hope).

**2. Draw.** Draw 2 player cards (3 if you control Nim). Hand limit 7.
If you draw an **Ashen Surge**: threat rises one step (2→2→2→3→3→4), 3 shadow
troops spawn at the location of the shadow deck's bottom card, a new wraith
rides out from Wraithspire (max 5), and the shadow discard is shuffled back
into the deck — old perils return.

**3. The shadow stirs.** Draw shadow cards equal to the current threat:

- **Location card**: 1 shadow troop spawns there (2 at a stronghold).
- **The Hunt** (4 in the deck): every wraith moves 1 step toward Wick.

Then, if any wraiths share Wick's location, they **search**: each rolls a die
with a 1/3 chance of an *eye*. If Wick is hidden, any eye merely reveals him.
If he is revealed, corruption rises by the number of eyes.

## Sieges

Sanctuaries (Lanternhold, Windmoot, Heartwood, Deepholm Gate) are where you
muster, rest Wick, and Kindle. Allied troops garrison them: **a spawn at a
garrisoned location is absorbed** — one ally falls instead of the shadow troop
landing.

- 3+ shadow troops at a sanctuary: **besieged** (−1 hope). Battle the troops
  below 3 to break the siege.
- A spawn at a besieged sanctuary with 5+ shadow troops: it **falls**
  (−2 hope, no more mustering, and it counts toward the 2-fallen loss).

## Cards

| Card (count) | Effect |
| --- | --- |
| Swift March (6) | Move one of your heroes up to 2 connections. |
| Rally Banner (5) | Place 2 troops at any standing sanctuary. |
| Ambush (5) | Slay 2 shadow troops at/adjacent to one of your heroes. |
| Fernpath (5) | Move Wick 1 connection, or hide him. |
| Lantern Oil (4) | +1 hope, **or** cleanse 1 corruption. |
| Farsight (4) | Reveal the next 3 shadow cards to everyone. |
| Hearthsong (3) | +2 hope. |
| Ashen Surge (4) | Never playable — resolves when drawn (see above). |

## Objectives

Complete any 2 to unlock the endgame (all 3 for glory):

1. **Garrison the Realm** — 3+ allied troops at every standing sanctuary.
2. **Purge the Shadow** — slay 12 shadow troops in battle (cumulative).
3. **Light the Beacons** — raise hope to 7+.

## Balance snapshot (headless bots)

Win rates with the built-in greedy bot, 300 games per count:
solo ≈ 71%, 2p ≈ 62%, 3p ≈ 45%, 4p ≈ 22%. Humans who coordinate should do
better, particularly at higher player counts. Tune via `constants.ts`.

## Roadmap toward full fidelity

v0 is a complete, winnable core loop. Known simplifications to revisit:

- Objectives are 3 fixed ones; the goal is a rotating objective deck.
- Hero abilities are passive/simple; richer unique powers to come.
- No card trading between players yet, and no per-hero hand separation.
- Wraith behavior is simple pursuit; no patrol/garrison modes.
- Solo mode is just 1 player with 2 heroes (no dedicated solo rules).
