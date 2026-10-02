import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { z } from "zod";

import { dbAvailable, getDb } from "./db";
import { clientIp, securityLog } from "./guard";
import {
  clearLoginFailures,
  loginLocked,
  recordLoginFailure,
} from "./validate";

/**
 * Auth.js v5. JWT session strategy so sessions never require DB reads, and
 * the whole config stays bootable with zero env vars (providers are added
 * conditionally; without a DB the app simply stays in guest mode).
 */

const credentialsSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
});

/** Surfaces to the client as `signIn(...).code === "locked"`. */
class LockedOut extends CredentialsSignin {
  code = "locked";
}

/**
 * Compared against when the email has no password, so a miss costs the same
 * bcrypt time as a wrong password and response timing can't reveal which
 * emails have accounts.
 */
const TIMING_PAD_HASH =
  "$2b$12$m3mYuKtQtejkhnPdMpGKne3ioTyOgn/rb3CiRMkZikCFcMX82Uz3K";

const providers: NextAuthConfig["providers"] = [];

if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
  );
}

if (dbAvailable()) {
  providers.push(
    Credentials({
      name: "email & password",
      credentials: {
        email: { label: "email", type: "email" },
        password: { label: "password", type: "password" },
      },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();
        const ip = clientIp(request);
        if (loginLocked(email, ip)) {
          securityLog("login.locked", { email, ip });
          throw new LockedOut();
        }
        const db = getDb();
        const user = await db.user.findUnique({ where: { email } });
        const ok = await compare(
          parsed.data.password,
          user?.passwordHash ?? TIMING_PAD_HASH,
        );
        if (!user?.passwordHash || !ok) {
          recordLoginFailure(email, ip);
          securityLog("login.failed", { email, ip });
          return null;
        }
        clearLoginFailures(email);
        return {
          id: user.id,
          email: user.email,
          name: user.displayName ?? user.name,
        };
      },
    }),
  );
}

// Loud warning (not a crash — zero-config guest deploys must still boot) when a
// production build has accounts wired up but no signing secret: JWTs would be
// signed with the public constant below and sessions would be forgeable.
if (
  !process.env.AUTH_SECRET &&
  process.env.NODE_ENV === "production" &&
  (dbAvailable() || (!!process.env.GITHUB_ID && !!process.env.GITHUB_SECRET))
) {
  console.warn(
    "[auth] AUTH_SECRET is not set in production while accounts are enabled — " +
      "JWTs are signed with a public constant and sessions are forgeable. " +
      "Generate one with `openssl rand -base64 32` and set AUTH_SECRET.",
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // dev-only fallback: real deployments must set AUTH_SECRET — without it
  // JWTs are signed with a public constant and sessions are forgeable.
  secret: process.env.AUTH_SECRET ?? "nolook-dev-secret-do-not-deploy",
  trustHost: true,
  session: { strategy: "jwt" },
  adapter: dbAvailable() ? PrismaAdapter(getDb()) : undefined,
  providers,
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub && session.user) session.user.id = token.sub;
      return session;
    },
  },
});
