/**
 * Deterministic test-text generation — same config + seed ⇒ same words,
 * which is what makes "repeat this exact test" possible.
 */

import { createRng } from "@/lib/engine/rng";
import type { Quote, TestConfig } from "@/lib/types";

import { QUOTES } from "./quotes";
import { COMMON_WORDS } from "./words";

const SENTENCE_MIN = 6;
const SENTENCE_MAX = 14;
const TERMINALS = [".", ".", ".", ".", "?", "!"];

function capitalize(w: string): string {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** Sprinkle realistic prose punctuation over a word stream. */
function punctuate(words: string[], rng: () => number): string[] {
  const out: string[] = [];
  let sentencePos = 0;
  let sentenceLen =
    SENTENCE_MIN + Math.floor(rng() * (SENTENCE_MAX - SENTENCE_MIN + 1));

  for (let i = 0; i < words.length; i++) {
    let w = words[i];

    if (sentencePos === 0) {
      w = capitalize(w);
    } else {
      const r = rng();
      if (r < 0.06) {
        w = `"${w}"`;
      } else if (r < 0.1 && i < words.length - 1) {
        w = `${w}-${words[i + 1]}`;
        i++;
      } else if (r < 0.14 && !w.endsWith("s")) {
        w = `${w}'s`;
      }
    }

    sentencePos++;
    const last = i === words.length - 1;
    if (sentencePos >= sentenceLen || last) {
      w += TERMINALS[Math.floor(rng() * TERMINALS.length)];
      sentencePos = 0;
      sentenceLen =
        SENTENCE_MIN + Math.floor(rng() * (SENTENCE_MAX - SENTENCE_MIN + 1));
    } else if (rng() < 0.12) {
      w += ",";
    }
    out.push(w);
  }
  return out;
}

function randomNumber(rng: () => number): string {
  const digits = 1 + Math.floor(rng() * 4);
  let n = "";
  for (let i = 0; i < digits; i++) {
    n += Math.floor(rng() * (i === 0 && digits > 1 ? 9 : 10) + (i === 0 && digits > 1 ? 1 : 0));
  }
  return n;
}

/** Pick a quote matching the config's length filter; null outside quote mode. */
export function getQuote(config: TestConfig, seed: number): Quote | null {
  if (config.mode !== "quote") return null;
  const rng = createRng(seed);
  const pool =
    config.quoteLength === "all"
      ? QUOTES
      : QUOTES.filter((q) => q.length === config.quoteLength);
  const usable = pool.length > 0 ? pool : QUOTES;
  return usable[Math.floor(rng() * usable.length)];
}

/**
 * Generate the word stream for a test. Deterministic per (config, seed).
 * count defaults: words-mode wordCount, otherwise 80 (time/zen initial batch).
 */
export function generateWords(
  config: TestConfig,
  seed: number,
  count?: number,
): string[] {
  if (config.mode === "zen") return [];

  if (config.mode === "custom") {
    return (config.customText ?? "").trim().split(/\s+/).filter(Boolean);
  }

  if (config.mode === "quote") {
    const quote = getQuote(config, seed);
    return quote ? quote.text.trim().split(/\s+/).filter(Boolean) : [];
  }

  const rng = createRng(seed);
  const n =
    count ?? (config.mode === "words" ? Math.max(1, config.wordCount) : 80);

  const words: string[] = [];
  let prev = "";
  while (words.length < n) {
    if (config.numbers && rng() < 0.15) {
      words.push(randomNumber(rng));
      prev = "";
      continue;
    }
    const w = COMMON_WORDS[Math.floor(rng() * COMMON_WORDS.length)];
    if (w === prev) continue; // no immediate repeats
    words.push(w);
    prev = w;
  }

  return config.punctuation ? punctuate(words, rng) : words;
}
