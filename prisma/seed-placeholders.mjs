// Fills the leaderboard with a few placeholder typists (70–90 wpm) so every filter
// (15/30/60/120s × all time/this week/today × clean/assisted) has entries.
//
//   node prisma/seed-placeholders.mjs          # (re)seed — replaces old placeholders
//   node prisma/seed-placeholders.mjs --clean  # remove every placeholder
//
// Placeholder users are tagged by an @placeholder.typical email; deleting them
// cascades to their results, so real accounts are never touched.
import { PrismaClient } from "@prisma/client";

const DOMAIN = "placeholder.typical";
const NAMES = ["swiftkeys", "homerow_hero", "qwertyqueen", "tapdancer", "keysmith"];
const DURATIONS = [15, 30, 60, 120];
const DAY = 86_400_000;

const db = new PrismaClient();
// deterministic so re-seeding produces the same board
let seed = 1337;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const between = (a, b) => a + rand() * (b - a);

function timeline(seconds, wpm) {
  return Array.from({ length: seconds }, (_, i) => ({
    second: i + 1,
    wpm: Math.round(wpm * (0.85 + 0.15 * Math.min(1, (i + 1) / 5)) * 10) / 10,
    raw: Math.round(wpm * between(0.85, 1.15)),
    errors: rand() < 0.15 ? 1 : 0,
  }));
}

function result(userId, duration, skill, ageMs) {
  // shorter tests run hotter; every run wobbles around the typist's skill
  const wpm = Math.round(
    Math.min(90, Math.max(70, skill * (1 + (60 - duration) / 400) * between(0.9, 1.06))) * 10,
  ) / 10;
  const accuracy = Math.round(between(89, 99.8) * 10) / 10;
  const correct = Math.round((wpm * 5 * duration) / 60);
  const assisted = rand() < 0.3;
  const config = {
    mode: "time", duration, wordCount: 25, quoteLength: "all",
    punctuation: false, numbers: false, difficulty: "normal",
  };
  return {
    userId,
    mode: "time",
    config,
    configKey: `time-${duration}-p0-n0-normal`,
    wpmCorrect: wpm,
    wpmRaw: Math.round(wpm * between(1.01, 1.08) * 10) / 10,
    accuracy,
    consistency: Math.round(between(62, 92)),
    charStats: {
      correct,
      incorrect: Math.round(correct * (100 - accuracy) / 100),
      extra: Math.round(between(0, 3)),
      missed: Math.round(between(0, 2)),
    },
    durationMs: duration * 1000,
    timeline: timeline(duration, wpm),
    integrityStatus: assisted ? "assisted" : "clean",
    peekCount: assisted ? Math.round(between(1, 4)) : 0,
    peekTotalMs: assisted ? Math.round(between(400, 3000)) : 0,
    leaderboardEligible: true,
    createdAt: new Date(Date.now() - ageMs),
  };
}

async function clean() {
  const { count } = await db.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
  return count;
}

async function main() {
  const removed = await clean();
  if (process.argv.includes("--clean")) {
    console.log(`removed ${removed} placeholder users (and their results)`);
    return;
  }

  let runs = 0;
  for (const name of NAMES) {
    const user = await db.user.create({
      data: { name, displayName: name, email: `${name}@${DOMAIN}` },
    });
    const skill = between(72, 86);
    const rows = [];
    for (const d of DURATIONS) {
      rows.push(result(user.id, d, skill, between(0.05, 0.9) * DAY)); // today
      rows.push(result(user.id, d, skill, between(1.5, 6.5) * DAY)); // this week
      rows.push(result(user.id, d, skill, between(9, 90) * DAY)); // older
    }
    await db.testResult.createMany({ data: rows });
    runs += rows.length;
  }
  console.log(`seeded ${NAMES.length} placeholder users, ${runs} runs (replaced ${removed})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
