"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { GlassButton, GlassPill } from "@/components/glass";

type Tab = "signin" | "register";

/** lucide dropped brand icons — inline GitHub mark. */
function GithubMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

function Field({
  label,
  ...props
}: React.ComponentPropsWithoutRef<"input"> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-foreground">
        {label}
      </span>
      <input
        className="h-11 w-full rounded-xl border border-glass-border bg-glass px-3.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-faint-foreground hover:border-faint-foreground/60 focus-visible:border-primary/70 focus-visible:shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_22%,transparent)] focus-visible:outline-none"
        {...props}
      />
    </label>
  );
}

/** Sign-in / register card. Guest mode always works — accounts are optional. */
export function AuthPanel() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasGithub, setHasGithub] = useState(false);
  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null);

  useEffect(() => {
    void fetch("/api/auth/providers")
      .then((r) => (r.ok ? r.json() : {}))
      .then((providers: Record<string, unknown>) => {
        setHasGithub("github" in providers);
        setHasCredentials("credentials" in providers);
      })
      .catch(() => setHasCredentials(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (tab === "register") {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password, displayName }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            offline?: boolean;
          };
          setError(
            data.offline
              ? "accounts need a configured database — you're in local mode"
              : (data.error ?? "registration failed"),
          );
          return;
        }
      }
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("wrong email or password");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("something went wrong — try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-strong rounded-[1.75rem] p-7 sm:p-8">
      <span
        aria-hidden
        className="btn-primary mb-5 flex size-10 items-center justify-center rounded-xl"
      >
        <span className="h-4.5 w-[3px] rounded-full bg-primary-foreground" />
      </span>
      <h1 className="text-[1.375rem] font-semibold tracking-tight text-foreground">
        {tab === "signin" ? "welcome back" : "create your account"}
      </h1>
      <p className="mb-6 mt-1.5 text-sm leading-relaxed text-muted-foreground">
        sync your history and enter the leaderboards — or keep practicing as a
        guest, everything works either way
      </p>

      <div className="mb-6">
        <GlassPill
          fullWidth
          ariaLabel="sign in or create account"
          options={[
            { value: "signin", label: "sign in" },
            { value: "register", label: "create account" },
          ]}
          value={tab}
          onChange={(v) => {
            setTab(v as Tab);
            setError(null);
          }}
        />
      </div>

      {hasCredentials === false ? (
        <p className="rounded-2xl border border-glass-border bg-glass p-4 text-sm leading-relaxed text-muted-foreground">
          accounts need a configured database — you&apos;re in local guest
          mode, and all your stats live safely in this browser
        </p>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
          <AnimatePresence mode="popLayout" initial={false}>
            {tab === "register" && (
              <motion.div
                key="name"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <Field
                  label="display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="how the leaderboard sees you"
                  minLength={2}
                  maxLength={40}
                  required
                />
              </motion.div>
            )}
          </AnimatePresence>
          <Field
            label="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <Field
            label="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="at least 8 characters"
            autoComplete={tab === "signin" ? "current-password" : "new-password"}
            minLength={8}
            required
          />

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, x: [-6, 6, -3, 0] }}
                exit={{ opacity: 0 }}
                transition={{ x: { duration: 0.35 } }}
                className="text-sm text-danger"
                role="alert"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <GlassButton
            variant="primary"
            size="lg"
            type="submit"
            disabled={busy || hasCredentials === null}
            className="mt-2 w-full"
            icon={busy ? <Loader2 className="animate-spin" /> : undefined}
          >
            {tab === "signin" ? "sign in" : "create account"}
          </GlassButton>
        </form>
      )}

      {hasGithub && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-faint-foreground">
            <span className="h-px flex-1 bg-glass-border" />
            or
            <span className="h-px flex-1 bg-glass-border" />
          </div>
          <GlassButton
            size="lg"
            className="w-full"
            icon={<GithubMark />}
            onClick={() => void signIn("github", { callbackUrl: "/" })}
          >
            continue with GitHub
          </GlassButton>
        </>
      )}

      <p className="mt-6 text-center text-[13px] text-muted-foreground">
        or{" "}
        <Link
          href="/"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          keep typing as a guest
        </Link>
      </p>
    </div>
  );
}
