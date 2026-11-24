import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { getDb, schema } from "@/lib/db";
import { env } from "@/lib/env";

function createAuth() {
  const e = env();
  const google =
    e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET, prompt: "select_account" as const } }
      : {};

  return betterAuth({
    baseURL: e.APP_URL,
    secret: e.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    socialProviders: google,
    // Dev-only sign-in for local work and Playwright. env() refuses to start
    // production with this enabled.
    emailAndPassword: { enabled: e.ENABLE_DEV_LOGIN, autoSignIn: true },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    account: {
      accountLinking: { enabled: true, trustedProviders: ["google"] },
    },
    rateLimit: {
      customRules: {
        // Better Auth allows 3 sign-ins per 10 seconds per IP by default. A class signing in with
        // Google at the start of a period shares one school IP. Starting the Google flow only
        // redirects to Google, which does the password checks, so a class-sized limit is safe.
        "/sign-in/social": { window: 60, max: 300 },
        // Dev login never runs on a public URL (env.ts refuses it); tests sign in several accounts.
        ...(e.ENABLE_DEV_LOGIN
          ? { "/sign-in/email": { window: 10, max: 100 }, "/sign-up/email": { window: 10, max: 100 } }
          : {}),
      },
    },
    advanced: {
      useSecureCookies: e.APP_URL.startsWith("https://"),
      database: { generateId: () => crypto.randomUUID() },
    },
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
const globalForAuth = globalThis as unknown as { __auth?: Auth };

export function getAuth(): Auth {
  if (!globalForAuth.__auth) globalForAuth.__auth = createAuth();
  return globalForAuth.__auth;
}

export function googleSignInEnabled() {
  const e = env();
  return Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET);
}
