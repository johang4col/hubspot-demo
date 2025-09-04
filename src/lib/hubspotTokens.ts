// HubSpot OAuth tokens with automatic refresh + Redis persistence
import { redis } from "./redis";

export type Tokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  expires_at: number; // epoch ms
  scope?: string;
  token_type?: string;
};

const REDIS_KEY = "hs:oauth:tokens";

declare global {
  var __HS_TOKENS__: Tokens | null | undefined;

  var __HS_LOADING__: Promise<void> | null | undefined;

  var __HS_REFRESHING__: Promise<void> | null | undefined;
}
const g = globalThis as any;
if (typeof g.__HS_TOKENS__ === "undefined") g.__HS_TOKENS__ = null;
if (typeof g.__HS_LOADING__ === "undefined") g.__HS_LOADING__ = null;
if (typeof g.__HS_REFRESHING__ === "undefined") g.__HS_REFRESHING__ = null;

function reqEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function loadOnceFromRedis() {
  if (g.__HS_LOADING__) return g.__HS_LOADING__;
  g.__HS_LOADING__ = (async () => {
    try {
      const t = await redis.get<Tokens>(REDIS_KEY);
      if (t) g.__HS_TOKENS__ = t;
    } catch (e) {
      console.warn("Redis load tokens failed:", (e as any)?.message || e);
    }
  })();
  await g.__HS_LOADING__;
}

async function saveToRedis(tokens: Tokens) {
  const ttlSeconds = Math.max(
    3600,
    Math.ceil((tokens.expires_at - Date.now()) / 1000)
  );
  await redis.set(REDIS_KEY, tokens, { ex: ttlSeconds });
}

export async function setTokens(t: Omit<Tokens, "expires_at">) {
  const tokens: Tokens = { ...t, expires_at: Date.now() + t.expires_in * 1000 };
  g.__HS_TOKENS__ = tokens;
  try {
    await saveToRedis(tokens);
  } catch (e) {
    console.warn("Redis save tokens failed:", (e as any)?.message || e);
  }
}

export async function getTokens(): Promise<Tokens | null> {
  if (!g.__HS_TOKENS__) await loadOnceFromRedis();
  return g.__HS_TOKENS__ ?? null;
}

export async function clearTokens() {
  g.__HS_TOKENS__ = null;
  try {
    await redis.del(REDIS_KEY);
  } catch {}
}

// Return a valid access token; refresh automatically if near expiry.
export async function ensureAccessToken(): Promise<string | null> {
  let tok = await getTokens();
  if (!tok) return null;

  const skewMs = 30_000;
  if (Date.now() + skewMs < tok.expires_at) return tok.access_token;

  // Coalesce refresh
  if (g.__HS_REFRESHING__) {
    await g.__HS_REFRESHING__;
    return (await getTokens())?.access_token ?? null;
  }

  g.__HS_REFRESHING__ = refreshWithRetry(tok.refresh_token)
    .catch((e: any) => {
      console.error("HubSpot refresh failed:", e?.message || e);
      return clearTokens();
    })
    .finally(() => {
      g.__HS_REFRESHING__ = null;
    });

  await g.__HS_REFRESHING__;
  return (await getTokens())?.access_token ?? null;
}

async function refreshWithRetry(refreshToken: string) {
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const attempts = [0, 250, 500];

  const clientId = reqEnv("HUBSPOT_CLIENT_ID");
  const clientSecret = reqEnv("HUBSPOT_CLIENT_SECRET");
  const tokenUrl = "https://api.hubapi.com/oauth/v1/token";

  for (let i = 0; i < attempts.length; i++) {
    if (attempts[i] > 0) await delay(attempts[i]);

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });

    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (res.ok) {
      const data = (await res.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        token_type: string;
        scope: string;
      };

      const next: Omit<Tokens, "expires_at"> = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken,
        expires_in: data.expires_in,
        token_type: data.token_type,
        scope: data.scope,
      };
      await setTokens(next);
      return;
    }

    const txt = await res.text().catch(() => "");
    if (i === attempts.length - 1) {
      throw new Error(
        `Refresh token failed: ${res.status} ${txt || res.statusText}`
      );
    }
  }
}
