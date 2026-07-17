#!/usr/bin/env node
/**
 * Headless playtest CLI.
 *
 *   node dist/cli.js [games] [--players N] [--bot random|greedy] [--trace] [--seed N]
 *
 * Examples:
 *   node dist/cli.js 500              # 500 greedy 2-player games, stats
 *   node dist/cli.js 1 --trace --seed 42   # watch one full game's log
 */
import { simulateGame, type BotKind, type SimResult } from './sim.js';

const argv = process.argv.slice(2);
const games = Number(argv.find((a) => /^\d+$/.test(a)) ?? 100);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const players = Number(flag('players') ?? 2);
const bot = (flag('bot') ?? 'greedy') as BotKind;
const trace = argv.includes('--trace');
const baseSeed = Number(flag('seed') ?? 1);

const results: SimResult[] = [];
const failures: { seed: number; error: string }[] = [];

for (let i = 0; i < games; i++) {
  const seed = baseSeed + i;
  try {
    results.push(simulateGame(seed, { players, bot, trace }));
  } catch (err) {
    failures.push({ seed, error: (err as Error).message.split('\n')[0] });
  }
}

const wins = results.filter((r) => r.phase === 'won');
const losses = results.filter((r) => r.phase === 'lost');
const avg = (xs: number[]) =>
  xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : '-';

console.log(`\nEmberfall headless playtest — ${games} games, ${players} players, ${bot} bot`);
console.log(`  wins:   ${wins.length} (${((wins.length / (results.length || 1)) * 100).toFixed(1)}%)`);
console.log(`  losses: ${losses.length}`);
console.log(`  avg turns: ${avg(results.map((r) => r.turns))}`);
console.log(`  avg objectives complete: ${avg(results.map((r) => r.objectivesComplete))}`);

if (losses.length) {
  const byReason = new Map<string, number>();
  for (const l of losses) {
    byReason.set(l.lossReason!, (byReason.get(l.lossReason!) ?? 0) + 1);
  }
  console.log('  loss reasons:');
  for (const [reason, n] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${n.toString().padStart(4)}  ${reason}`);
  }
}

if (failures.length) {
  console.log(`\n  ENGINE FAILURES: ${failures.length}`);
  for (const f of failures.slice(0, 10)) {
    console.log(`    seed ${f.seed}: ${f.error}`);
  }
  process.exit(1);
}
