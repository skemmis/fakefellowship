# Fate of the Fellowship — Online Multiplayer

A digital, real-time multiplayer implementation of the cooperative board game
*The Lord of the Rings: Fate of the Fellowship* (Matt Leacock / Z-Man Games)
for personal hobby play with friends in different locations. 2–5 players,
each controlling two characters, escorting Frodo to Mount Doom.

Rules were transcribed from the publisher's rulebook; everything the rulebook
doesn't spell out (most card content, die faces, some board routes) is
reconstructed and clearly marked — see [RULES.md](RULES.md) for the exact
fidelity matrix. All text here is paraphrased and no art or card text is
copied. Not affiliated with Z-Man Games or Middle-earth Enterprises; buy the
real game — it's excellent.

## Playing

```bash
npm install
npm run build
npm start           # serves the game at http://localhost:8080
```

The host clicks **Host a new game**, picks a difficulty, and shares the
4-letter room code. Friends enter the code, and the host starts the game —
characters are dealt automatically (Frodo & Sam always in play). Reloading
the page rejoins your seat with the full game state and log restored.

Deployed on Railway (see `railway.json`): connect the repo, set the branch,
generate a domain — every push redeploys.

## Interface notes

- **Everything is hover-documented**: locations, stats, dice faces, actions,
  and cards all carry tooltips explaining the rule behind them.
- The engine only offers **legal moves** — buttons disable themselves and the
  map highlights valid targets, so rules arguments can't happen.
- Dice rolls pause in a **resolution panel**: anyone with a character present
  can spend Resistance to reroll or Valor to slay before the roll is
  confirmed, just like at the table.
- Moving Frodo opens a **cover picker** that previews exactly how many search
  dice each choice risks (stealth / open travel / putting on the Ring).
- The **4+1 action rule** is tracked visually — the turn banner shows each
  character's remaining actions. Either character can act first; the 4-action
  slot locks in only once a character takes its second action.

## Architecture

```
packages/
  engine/   Pure deterministic rules engine (seeded RNG lives in the game
            state). Board/cards/characters as data. Legal-action enumerator,
            invariant checker, bot simulator + CLI for headless debug loops.
  server/   Authoritative Node WebSocket server: rooms, join codes, seat
            tokens for reconnect, chat. Serves the built client.
  client/   React + Vite. SVG board, guided dialogs, dice panels, tooltips.
```

Development: `npm run dev:server` + `npm run dev:client` (Vite on :5173
proxies websockets to :8080). Tests: `npm test`. Headless playtesting: see
RULES.md.
