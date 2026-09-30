"use client";

import { Target } from "lucide-react";

import { GlassButton } from "@/components/glass";

export interface MissedWordsProps {
  words: { word: string; count: number }[];
  onPractice: (words: string[]) => void;
}

/** The words you actually fumble, with a one-click practice test. */
export function MissedWords({ words, onPractice }: MissedWordsProps) {
  const top = words.slice(0, 12);
  return (
    <div className="flex h-full flex-col">
      <h3 className="card-title mb-4">
        most-missed words
      </h3>
      {top.length === 0 ? (
        <div className="grid flex-1 place-items-center py-6 text-sm text-muted-foreground">
          nothing yet — nice and clean
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-1.5">
            {top.map(({ word, count }) => (
              <span
                key={word}
                className="glass-subtle rounded-full px-3 py-1 font-mono text-[13px] text-foreground"
              >
                {word}
                {count > 1 && (
                  <span className="ml-1 text-[11px] text-faint-foreground">
                    ×{count}
                  </span>
                )}
              </span>
            ))}
          </div>
          <div className="mt-auto">
            <GlassButton
              size="sm"
              variant="primary"
              icon={<Target />}
              onClick={() => onPractice(top.map((w) => w.word))}
            >
              practice these
            </GlassButton>
          </div>
        </>
      )}
    </div>
  );
}
