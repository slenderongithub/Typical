// Runnable check (no test runner here): npx jiti src/lib/engine/engine.check.ts
import assert from "node:assert";

import type { EngineResult, TestConfig } from "@/lib/types";

import { TypingEngine } from "./engine";

const cfg: TestConfig = {
  mode: "time",
  duration: 15,
  wordCount: 25,
  quoteLength: "all",
  punctuation: false,
  numbers: false,
  difficulty: "normal",
};
const e = new TypingEngine({ config: cfg, words: ["ab", "cd", "ef"] });
const out: { r?: EngineResult } = {};
e.subscribeFinish((r) => (out.r = r));
const t0 = performance.now();
e.input("a", t0);
e.input("b", t0 + 100);
// a key after the deadline ends the run instead of counting
e.input("c", t0 + 15_100);
assert.ok(out.r, "late key should finish the test");
assert.equal(out.r.durationMs, 15000);
assert.equal(out.r.chars.correct, 2, "late 'c' must not be counted");
e.dispose();
console.log("engine time-cutoff check: ok");
