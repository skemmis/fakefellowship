# Emberfall

A cooperative fantasy strategy game for 1–4 players, playable online in real
time from different locations. Escort **Wick Fernby**, the shardbearer, across
the realm to cast the **Ember** into the **Cindermaw** — while wraiths hunt
him, shadow armies besiege the sanctuaries, and hope runs thin.

Emberfall is an original game inspired by the cooperative "escort and hold the
line" genre. All names, text, art, and data in this repository are original.
The exact rules implemented are documented in [RULES.md](RULES.md).

## Playing

One person runs the server (or you deploy it somewhere); everyone else just
needs a browser.

```bash
npm install
npm run build
npm start           # serves the game at http://localhost:8080
```

The host clicks **Host a new game** and shares the 4-letter room code. Friends
enter the code to join, everyone picks two heroes, and the host starts the
game. Disconnected players can reload the page and rejoin the same seat —
the server replays the full game state and log.

To play across the internet, deploy anywhere that runs Node 20+ (Fly.io,
Railway, a VPS) or expose your local server with a tunnel (e.g. `cloudflared`,
`tailscale funnel`). The server is a single process with in-memory rooms.

## Development

```bash
npm run dev:server   # game server on :8080 (auto-restarts)
npm run dev:client   # Vite dev server on :5173, proxies /ws to :8080
npm test             # engine unit tests (rules, invariants, full-game sims)
```

### Headless playtesting

The engine is a pure, deterministic state machine (seeded RNG lives in the
game state), so entire games can be played without a UI. The simulator plays
bot games while checking conservation invariants after every single action:

```bash
npm run build -w @emberfall/engine
node packages/engine/dist/cli.js 500                 # 500 games, stats
node packages/engine/dist/cli.js 300 --players 4     # balance by player count
node packages/engine/dist/cli.js 1 --trace --seed 42 # watch one full game log
node packages/engine/dist/cli.js 200 --bot random    # chaos-monkey the rules
```

Use it to reproduce gameplay bugs deterministically (`--seed`), to verify rule
changes don't break invariants, and to tune balance (constants live in
`packages/engine/src/data/constants.ts`).

## Architecture

```
packages/
  engine/   Pure TypeScript rules engine. No IO, no network. applyAction(state,
            playerId, action) -> {state, events}. Also: legal-action
            enumerator, seeded RNG, bot simulator, invariant checker.
  server/   Node WebSocket server. Authoritative: applies actions via the
            engine, broadcasts state + events to the room. Rooms, seats,
            reconnect tokens, chat. Serves the built client.
  client/   React + Vite. SVG map with legal-target highlighting, turn banner,
            hand/objectives/log panels, lobby with hero drafting.
```

Design principles:

- **The engine is the only rulebook.** The server never edits state by hand;
  the client never computes outcomes. The client's buttons are driven by the
  same `legalActions()` the bots use, so the UI can only offer legal plays.
- **Determinism everywhere.** Same seed + same action list = same game. This
  gives replays, reconnection, and reproducible bug reports for free.
- **Content is data.** Cards, heroes, map, and tuning constants are data files
  in `engine/src/data/` — adding cards or rebalancing is data entry.
