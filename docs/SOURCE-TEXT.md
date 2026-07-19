# Fate of the Fellowship — Source Text (single source of truth)

Purpose: a plain-text transcription of everything the owner has actually provided,
so we never have to re-scan images or argue about what is known. **If it isn't in
this file, we don't have it** — see the "Still not fully pinned" section at the bottom
for the (now small) open gaps.

Provenance legend:
- `[RULEBOOK]` — the **official 24-page rulebook** (scratchpad `rulebook.pdf`). Authoritative.
- `[SHEET]` — fan-made "One Sheet To Rule Them All" v1.6 (handy, but not official).
- `[OBJ-PHOTO]` — photo of all 24 objective cards.
- `[OWNER]` — stated verbatim by the owner in chat.
- `[BOARD]` — the owner's board editor JSON (fateboard_10).
- `⚠️ ON-CARD-ONLY` — a value that lives only on the physical cards, not in the rulebook text.

Last reconciled: 2026-07-19. **Status: the engine's setup, component counts, army sizes,
Nazgûl/Eye placement, dice, character starts, abilities, and all 24 objectives are
confirmed against the official rulebook.** Only two data sets are not fully pinned (see
the last section).

---

## 1. Sequence of play `[RULEBOOK]`

Each turn: **1)** take actions (the 4+1 rule), **2)** draw 2 player cards (hand limit 7),
**3)** draw shadow cards according to the threat level.

Playing an **Event card is not an action** and may happen during any player's turn.

### The 4+1 action rule `[RULEBOOK]` `[OWNER]`
Up to 4 actions with one of your characters and up to 1 with the other. (Owner: the
"which is the 4" is decided when a character takes its 2nd action, so you can spend the
1-action character first.)

### Actions `[RULEBOOK]`
- **Travel** — move to a connected location; may bring troops / other characters;
  special paths cost the shown symbols; ignore battle-line arrows. **Frodo travel:
  always pay 1 Stealth OR Search at the destination.**
- **Fellowship** — if in the same location, players may exchange 1 card matching that
  location's region. Cannot exchange tokens. Solo: no Fellowship.
- **Prepare** — in a haven, discard any **one** region card for a matching token.
  Cannot exchange tokens. Solo: in a haven AND in that card's region.
- **Muster** — at a mustering location, spend 1 Friendship to add 1 matching troop
  (if available).
- **Attack / Battle** — only if shadow troops and a friendly troop are in the
  character's location. Initiating a battle rolls 1 battle die per friendly troop
  (min 1, max 3) → **shifts the Eye to that region**. May opt to roll fewer.
- **Capture** — character + friendly troop in a shadow stronghold with no shadow
  troops present: spend 3 Valor to place a haven; **shift the Eye to that region and
  gain 2 hope**. Captured strongholds cannot muster.

### Battle dice `[RULEBOOK]` `[OWNER]` (2 Rout / 2 Exchange / 1 Overrun / 1 Nazgûl)
- **Rout**: remove 1 shadow troop.
- **Exchange**: remove 1 shadow troop and 1 friendly troop.
- **Overrun**: remove 1 friendly troop, unless in a haven.
- **Nazgûl**: if a Nazgûl is present in the region, remove 2 friendly troops. (Does not shift the Eye.)
- After rolling: characters may reroll dice (paying Resistance), or remove dice (paying
  Valor). Battle ends — no additional rounds.
- After battle at a haven: if shadow troops present and no friendly troop, the haven is
  captured by the Shadow → place shadow stronghold + lose 3 hope.

### Search dice `[RULEBOOK]` `[OWNER]` (2 Slip / 2 Weary / 1 Exposed / 1 Recall)
Roll 1 per Nazgûl in the region and per shadow troop in the location, max 7.
- **Slip**: no effect.
- **Weary**: lose 1 hope.
- **Exposed**: lose 1 hope, unless in a haven.
- **Recall**: if a Nazgûl is present, move the bearer 1 toward/to Mordor.
- After rolling, characters may reroll dice (paying Resistance).

### Win / loss `[RULEBOOK]`
Frodo needs **5 rings (Resistance)** to destroy the One Ring; **there are only 12
rings in the whole game**. Complete every other objective, then destroy the Ring at
Mount Doom.

---

## 2. Shadow cards — resolve **Top or Bottom** `[RULEBOOK]`

### Advance
- Move every shadow troop on the shown battle line 1 space forward (frontmost location first).
- After moving, if shadow troops end up with a friendly troop: Battle (frontmost first).
- Shadow troops at the end of the line don't move but can still Attack.
- If shadow troops now occupy a haven with no friendly troop → captured: place shadow
  stronghold + lose 3 hope.

### Reinforce
- Add 1 shadow troop to the shown location.
- If not enough shadow troops in the supply, lose 1 hope for each missing.
- If a friendly troop is present: Battle.
- Follow instructions (choose when multiple are possible; current player decides):
  - Shift the Eye to Frodo's region (or Search if the Eye is already there).
  - Deploy 3 Nazgûl from Mordor to the Eye.
  - Move 2 Nazgûl closer to Frodo.

---

## 3. Character abilities `[RULEBOOK]` (authoritative — SMALL CAPS = location-bound; 1pT = once per turn)

- **Aragorn** — *Ranger of the North* (Search): reroll 1 die. *Captain of the West*
  (Battle): remove 2 shadow troops for each Nazgûl-face rolled. *Andúril* (Action, 1pT,
  after ≥1 objective completed): remove 1 shadow troop.
- **Arwen** — *Evenstar* (Muster Elven): don't spend Friendship. *Send Aid* (Prepare):
  if a character is in the card's region, move 1 Elf from Arwen to that character.
  *Give Counsel* (Fellowship in a haven, 1pT): no matching-region requirement. *Solo*
  (Prepare): same (no region match).
- **Boromir** — *Heir to the Steward* (Muster Gondor): don't spend Friendship. *Hero of
  Gondor* (Capture): spend 1 fewer Valor. *Tempted by Power* (Fellowship): cannot give
  or take Resistance.
- **Éomer** — *Rider of Rohan* (Action, 1pT): 1 bonus Travel action. *Marshal of the
  Mark* (Battle): if a Rohirrim troop is present, ignore 1 loss.
- **Éowyn** — *Shield Maiden of Rohan* (Muster Rohirrim): don't spend Friendship. *No
  Living Man Am I* (Battle): remove 1 Nazgûl for each Nazgûl-face (don't remove friendly troop).
- **Faramir** — *Ambush* (Travel): if he Travels with a friendly troop, bonus Attack
  action in the destination + spend Stealth to change dice to Rout. *Stealthy* (Travel):
  spends 1 fewer symbol on special paths. *Wisdom of the Eldar* (Action, 1pT): if in a
  haven, draw a card from the player discard pile if it matches the region.
- **Frodo & Sam** — (any Travel costs 1 Stealth OR a Search). *Elrond's Support*
  (Prepare, 1pT): if in a haven in the card's region, gain 1 extra token. *Sam's Aid*
  (Search): spend Friendship to ignore Weary/Exposed dice. *Put on the Ring* (Search):
  before the search is rolled, ignore shadow troops (lose 1 hope + shift the Eye to
  Frodo's region).
- **Galadriel** — *Lady of Light* (any player's turn): in a haven, spend 1 Friendship to
  draw a random unused Event. *Mirror of Galadriel* (Action): reveal up to 4 top cards
  of the player deck and rearrange. *Nenya* (Battle): if an Elf is present, reroll 1 die.
- **Gandalf** — *Mithrandir* (Muster): muster 1 extra troop. *Shadowfax* (Travel): if
  alone, move 2 (not special paths). *Light and Flame* (Battle): spend Valor to change dice.
- **Gimli** — *Son of Glóin* (Muster Dwarven): don't spend Friendship. *Dwarven Craft*
  (Action, 1pT): gain 1 Valor token.
- **Gollum** — (can't Muster, Attack, or Capture; lose 1 hope if with Frodo & Sam in one
  location). *Guide* (Search): roll 3 fewer dice. *Slinker* (Action, 1pT): take any card
  from the player discard pile. *Cunning* (Prepare): no haven needed + move 1 shadow
  troop to an adjacent location.
- **Legolas** — *Walk Silently* (Action, 1pT): gain 1 Stealth token. *Sure Shot* (any
  player's turn): spend 1 Stealth to remove 1 shadow troop from an (adjacent) location,
  OR to move 1 Nazgûl from the region to Mordor. *Keen Sight* (Prepare, 1pT): look at
  the top card of the shadow deck.
- **Merry & Pippin** — *Loyal Friend* (Action, 1pT): gain 1 Friendship token. *Distract*
  (any player's turn): if fewer than 4 Nazgûl in the region, spend 1 Friendship to move
  2 Nazgûl to their region. *Give Us a Song!* (Action): if in Frodo's location, spend 3
  Friendship to gain 2 hope.

---

## 4. Objectives — all 24 `[OBJ-PHOTO]`

Symbol key: 💜 Friendship (heart) · ⚔ Valor · 🗡 Stealth (cloak) · 💍 Resistance (ring).

1. **Secure the Crossing of the Anduin** — Use Faramir; place 1 shadow in Osgiliath.
   Faramir may Capture Osgiliath (not a stronghold) for 3 Valor, **or 2 Resistance + 1
   Stealth**. Complete: Osgiliath is a haven. Reward: add 1 Gondor troop to Osgiliath.
   (If later overrun by shadow troops, lose 3 hope and remove the haven.)
2. **"Saruman, Your Staff Is Broken"** — place 2 extra shadow in Isengard. Complete:
   Isengard is a haven AND Rohan free of shadow troops/strongholds. Reward: gain 1 Resistance token.
3. **Attain the Blessing of the Elves** — place 3 Elven troops on the card. Complete: a
   character in Rivendell spends **3 Valor (or 3 Stealth `[OWNER]`)** with another
   character present. Reward: troops to supply; each player with a character in Rivendell
   gains 1 Friendship token; gain 1 hope.
4. **Challenge Sauron** — a character spends an action in North Ithilien with **2
   Rohirrim, 2 Elven, and 3 Gondor** troops present. Reward: shift the Eye to Ithilien;
   move every shadow troop in Mordor to Udûn.
5. **Destroy the One Ring** (finale) — complete all other objectives first. Frodo spends
   5 Resistance at Mount Doom, then survives a final search rolling +1 die per missing
   hope (max 7). Win if he endures.
6. **Subdue Umbar** — Complete if either: Umbar is a haven; OR every Haradwaith location
   has a friendly troop and Haradwaith has no shadow troops. Reward: move any friendly
   troops from Haradwaith to Pelargir.
7. **Avenge Balin!** — Complete: Moria is a haven AND ≥2 Dwarven troops in Moria. Reward:
   move any Dwarven troops to Moria; if ≥4 there, gain 2 Valor tokens.
8. **Oathbreakers Fulfill Their Duty** — Use Aragorn. Once per game Aragorn Travels
   Edoras→Erech: add 2 shadow to Pelargir, move all Umbar's shadow to Pelargir, add up
   to 3 Gondor to Erech. Complete: he has ridden AND Gondor free of shadow
   troops/strongholds. Reward: gain 1 hope.
9. **Bring Light to Mirkwood** — place 1 shadow each in Old Forest Road and Southern
   Mirkwood. Complete: Mirkwood free of shadow troops (Dol Guldur need not be captured)
   AND an Elven troop in every Mirkwood location. Reward: move any Elven troops in
   Mirkwood; gain 1 hope.
10. **Arwen Unfurls the Banner** — Use Arwen. Arwen spends an action + 1 Friendship in
    Minas Tirith while ≥1 Gondor, 1 Rohirrim, 1 Elven, 1 Dwarven troop present AND Minas
    Tirith is a haven. Reward: gain 1 hope.
11. **Boromir Reclaims His Honor** — Use Boromir. Complete: Boromir + ≥1 other character
    where the last friendly troop is removed in a battle. Reward: remove up to 2 shadow
    troops there, then Boromir leaves the board; when the next objective completes, draw
    a random character to replace him at their start.
12. **Unseat Denethor** — place 4 Gondor troops on the card. Complete: a character in
    Minas Tirith spends 2 Stealth + 1 Friendship + 1 Valor with another present. Reward:
    troops to supply; add up to 3 Gondor to Minas Tirith; gain 1 hope.
13. **Shelob's Lair** — Use Gollum (Frodo's player can't hold Gollum). Sam spends an
    action in Minas Morgul rolling 3 battle dice with Gollum present: Overrun −1 hope,
    Exchange −2, Nazgûl −3, lone foe no effect. Also lose 1 hope per Resistance (card or
    token) the Gollum player holds (Solo: per Resistance card in hand). Sam may spend
    Valor to ignore dice and Friendship to prevent hope loss. Reward: if Frodo lost no
    hope doing it, he may take 1 extra action this turn.
14. **Hobbits Pledge Their Loyalty** — Use Merry & Pippin. In a haven, spend an action to
    discard a Friendship card matching their region → place a Friendship token from the
    supply on that haven's people symbol. Complete: tokens on 2 of the 4 peoples (havens
    shown: Grey Havens/Rivendell/Lórien/Woodland Realm = Elven, Erebor = Dwarven, Minas
    Tirith/Dol Amroth = Gondor, Helm's Deep = Rohirrim). Reward: give the 2 tokens to
    their player; gain 1 hope.
15. **"That Makes Six!"** — Use Legolas. Shadow troops Legolas removes with Sure Shot may
    go on this card instead of the supply. Complete: 6 on the card. Reward: return them
    to supply; gain 1 hope.
16. **Free Théoden's Mind** — place 4 Rohirrim troops on the card. Complete: a character
    in Edoras spends 2 Friendship + 1 Resistance with another present. Reward: troops to
    supply; add up to 2 Rohirrim to Edoras; gain 1 hope.
17. **Infiltrate Minas Morgul** — place 1 extra shadow in Minas Morgul. Capture it for 3
    Valor or 3 Stealth. Complete: it is a haven. Reward: gain 2 Stealth tokens; look at
    the top 2 shadow cards and remove **either 1 or both** from the game, returning any
    kept cards to the top in any order. *(Engine simplification: removes both.)*
18. **Ride with the Éored** — Use Éomer. When his Attack with Rohirrim present removes
    shadow troops, place 1 removed troop on the card's spot for its region (Rohan + each
    adjacent region). Complete: 4 on the card. Reward: return to supply; gain 1 hope.
19. **Confront the Balrog** — Use Gandalf. Gandalf spends an action in Moria rolling 3
    battle dice: Overrun −1 hope, Exchange −2, Nazgûl −3, lone foe none. May spend
    Resistance to ignore dice and Valor to prevent hope loss. Reward: Gandalf leaves the
    board; when the next Skies Darken card is drawn, place him in **Lórien** and **gain 2
    hope** — he is now **Gandalf the White**: when he uses Light and Flame, spend 1 Valor
    each to change any number of dice to the results you want.
20. **Rangers Secure Eriador** — Complete: Eriador free of shadow troops/strongholds AND
    a friendly troop in every Eriador location. Reward: move any friendly troops from
    Eriador to Weather Hills and/or Tharbad; gain 1 hope.
21. **Lift Shadow from Dwarven Lands** — Use Gimli; place 1 shadow in Ered Luin.
    Complete: no shadow troops in Ered Luin, ≥4 Dwarven troops there, and Dale free of
    shadow troops/strongholds. Reward: gain 2 Valor tokens; gain 1 hope.
22. **"Shieldmaiden No Longer"** — Use Éowyn. When a **battle** is rolled with Éowyn
    present, she may spend 2 Valor to change 1 **battle die** to the Nazgûl face.
    Complete: she has destroyed ≥2 Nazgûl AND Rohan free of shadow troops/strongholds.
    Reward: gain 1 hope. *(Note: owner once said "search die"; the card says battle — battle is implemented.)*
23. **Deal with Freca's Heirs** — Capture Dunland (not a stronghold) for 3 Valor or 3
    Friendship. Complete: Dunland is a haven with ≥2 Rohirrim troops. Reward: add 1
    Rohirrim to Dunland. (If later overrun, lose 3 hope and remove the haven.)
24. **Lay Bare the Pits** — Use Galadriel; place 1 extra shadow in Dol Guldur. Galadriel
    may Capture Dol Guldur for 3 Valor or **2 Resistance + 1 Valor**. Complete: Dol Guldur
    is a haven with ≥3 Elven troops. Reward: if Galadriel is there, gain 1 extra hope
    (on top of the Capture's 2).

**Reconciliation result:** every objective in the engine matches these cards, including
the ones I had flagged as reconstructed (Avenge Balin, Challenge Sauron, Oathbreakers,
Ride with the Éored, That Makes Six, Dwarven Lands, Boromir, Bring Light, Rangers,
Subdue Umbar). The only known engine simplifications are Infiltrate Minas Morgul's
deck-surgery choice (auto-removes both) and the "move troops as a reward" repositions,
which are left manual.

---

## 5. Dice `[OWNER]`
- Search die (6 faces): 2 Slip, 2 Weary, 1 Exposed, 1 Recall.
- Battle die (6 faces): 2 Rout, 2 Exchange, 1 Overrun, 1 Nazgûl.

---

## 6. Shadow deck & events
- 48-card shadow deck (each card = a battle-line or reinforce with a Top/Bottom choice) —
  transcribed from the owner's photos into `packages/engine/src/data/cards.ts`
  (`SHADOW_CARD_DATA`), plus 2 specials (Drums of War, Wheels of Saruman).
- 14 event cards — transcribed from photos into `EVENTS`; mechanics paraphrased.

---

## 7. Setup `[RULEBOOK p4-5, p7]` — CONFIRMED (matches the engine exactly)

- **Starting friendly troops** (`INITIAL_FRIENDLY`): Dwarven — 1 Ered Luin, 1 Erebor, 1
  Iron Hills. Elven — 1 Grey Havens, 1 Rivendell, 1 Lórien, 1 Woodland Realm. Rohirrim —
  1 Helm's Deep, 1 Edoras, 1 Eastemnet. Gondor — 2 Minas Tirith, 2 Dol Amroth, 1 Pelargir.
  (5 of each army remain in the supply afterward.)
- **Starting shadow troops** (18) (`INITIAL_SHADOW`): 1 Dunland, 1 Isengard, 2 Moria,
  1 Dol Guldur, 3 Rhûn, 2 Minas Morgul, 2 Barad-dûr, 3 Núrn, 1 Umbar, 2 Near Harad.
  Then draw 9 shadow cards and add 1 troop to each featured red location (27 placed, 21
  left in supply).
- **Nazgûl** (9) (`INITIAL_NAZGUL`): 2 Eriador, 1 Rhudaur, 1 Misty Mountains, 1 Gondor,
  4 Mordor.
- **Eye of Sauron**: starts on **Eriador** (`INITIAL_EYE`).
- **Character starts** (`start` fields, all confirmed): Aragorn — Weather Hills; Arwen —
  Rivendell; Boromir — Minas Tirith; Éomer — Eastemnet; Éowyn — Edoras; Faramir — Minas
  Tirith; Frodo & Sam — The Shire; Galadriel — Lórien; Gandalf — Tharbad; Gimli — Erebor;
  Gollum — Moria; Legolas — Woodland Realm; Merry & Pippin — The Shire.

## 8. Components `[RULEBOOK p2]` — CONFIRMED
74 player cards (48 Region, 14 Event, 12 Skies Darken); 24 Objective; 10 Reference (2 per
player); 13 Character cards + 13 figures; 9 Nazgûl; 50 shadow cards (48 troop-bearing + 2
specials); 3 battle dice; 7 search dice; **48 shadow troops**; **35 friendly troops
(8 Dwarven, 9 Elven, 8 Rohirrim, 10 Gondor)** — exactly `FACTION_TOTALS`; 6 haven/stronghold
tokens; **36 symbol tokens**.

## 9. Skies Darken cards `[RULEBOOK p15]` — mechanic CONFIRMED
Each has 4 steps: 1) The Shadow Grows — threat rate +1. 2) I See You! — if the Eye is in
Frodo's region lose 2 hope, else shift the Eye there. 3) Under Cover of Darkness — add 3
shadow troops to **the location the card shows** (battle there if friendly troops present;
lose 1 hope per troop that can't be placed). 4) The Danger Intensifies — reshuffle the
shadow discard pile onto the shadow deck. Resolve, then remove the card from the game.

## 10. Still not fully pinned (small, non-breaking)

1. **⚠️ ON-CARD-ONLY — the 12 Skies Darken target locations** (`DARKEN_TARGETS`). The
   step-3 troop-drop location lives only on each physical card; the rulebook shows just
   one example (South Ithilien). Current targets are a reasonable stand-in and don't
   affect correctness, only which locations get pressured. Photos of the 12 cards would
   pin this exactly.
2. **Symbol-token split** — the rulebook lists **36 symbol tokens** total but doesn't
   split them by symbol; the fan sheet says "only 12 rings (Resistance)". The engine uses
   9 of each (36 total). This only bounds how many tokens can be banked at once and never
   blocks the 5 needed to destroy the Ring, so it's cosmetic-ish. A component-list photo
   would confirm the exact split.
