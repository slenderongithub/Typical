import { GitBranch, Mail, NotebookText } from "lucide-react";

import pkg from "../../../package.json";

// brand marks (simple-icons, CC0) — lucide v1 dropped its brand icons
const BRANDS = {
  github:
    "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  twitter:
    "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  linkedin:
    "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
};

const Brand = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden className="size-3.5 fill-current">
    <path d={d} />
  </svg>
);

const LINKS = [
  { label: "contact", href: "mailto:slenderisincollege@gmail.com", icon: <Mail aria-hidden className="size-3.5" /> },
  { label: "github", href: "https://github.com/slenderongithub/Typical", icon: <Brand d={BRANDS.github} /> },
  { label: "twitter", href: "https://x.com/slenderlocksin", icon: <Brand d={BRANDS.twitter} /> },
  { label: "linkedin", href: "https://www.linkedin.com/in/shubhadeep-datta-379128202", icon: <Brand d={BRANDS.linkedin} /> },
];

const GLOSSARY: [string, string][] = [
  ["wpm", "correct characters ÷ 5 per minute"],
  ["raw", "every keystroke counted, mistakes included"],
  ["accuracy", "share of keystrokes that were right"],
  ["consistency", "how steady your speed stayed, second to second"],
  ["tracked", "camera on and calibrated — looks at the keyboard are checked"],
  ["untracked", "camera off — no integrity check, no penalty"],
  ["clean", "tracked, and you never looked down"],
  ["assisted", "tracked, but you peeked at the keyboard"],
  ["peek", "a look down held for 0.4s or longer"],
  ["penalty", "verified score docks wpm per peek, time looking down and time out of frame, at most 75%"],
  ["expert", "fails on any word finished with an error"],
  ["master", "fails on any mistake, or any look away with the camera on"],
  ["leaderboard", "signed-in runs only, clean by default; zen never ranks"],
];

/** Quiet monkeytype-style footer: links left, version right. */
export function Footer() {
  return (
    <footer className="typing-chrome mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 pb-4 text-xs text-faint-foreground">
      <nav aria-label="links" className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {LINKS.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target={l.href.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            {l.icon}
            {l.label}
          </a>
        ))}
      </nav>
      <span className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <GitBranch aria-hidden className="size-3.5" />v{pkg.version}
        </span>
        {/* native popover: light-dismiss + Esc for free, no client JS */}
        <button
          type="button"
          popoverTarget="glossary"
          className="flex items-center gap-1.5 transition-colors hover:text-foreground"
        >
          <NotebookText aria-hidden className="size-3.5" />
          notes
        </button>
      </span>
      <div
        id="glossary"
        popover="auto"
        aria-label="glossary"
        className="island fixed inset-auto bottom-12 right-4 m-0 w-[min(22rem,calc(100vw-2rem))] rounded-3xl p-5 text-surface-foreground"
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
          {GLOSSARY.map(([term, meaning]) => (
            <div key={term} className="contents">
              <dt className="font-semibold">{term}</dt>
              <dd className="text-surface-muted">{meaning}</dd>
            </div>
          ))}
        </dl>
      </div>
    </footer>
  );
}
