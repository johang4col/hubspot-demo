import { NextRequest, NextResponse } from "next/server";
import { ensureAccessToken } from "@/lib/hubspotTokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE = process.env.HUBSPOT_BASE_URL || "https://api.hubapi.com";

/**
 * In-memory cache + in-flight coalescing (demo).
 * If you already wired Upstash Redis for tokens, you could mirror this with Redis too.
 */
type CacheEntry = { at: number; payload: any };
type InFlightMap = Map<string, Promise<any>>;

declare global {
  // eslint-disable-next-line no-var
  var __HS_DEMO_CACHE__: Map<string, CacheEntry> | undefined;
  // eslint-disable-next-line no-var
  var __HS_DEMO_INFLIGHT__: InFlightMap | undefined;
}
const g = globalThis as any;
if (!g.__HS_DEMO_CACHE__) g.__HS_DEMO_CACHE__ = new Map();
if (!g.__HS_DEMO_INFLIGHT__) g.__HS_DEMO_INFLIGHT__ = new Map();
const CACHE: Map<string, CacheEntry> = g.__HS_DEMO_CACHE__;
const INFLIGHT: InFlightMap = g.__HS_DEMO_INFLIGHT__;

const CACHE_TTL_MS = 30_000; // 30s demo cache

async function hs(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let payload: any = null;
    try {
      payload = await res.json();
    } catch {}
    const msg =
      payload?.message ||
      payload?.errors?.[0]?.message ||
      (await res.text().catch(() => res.statusText));
    throw new Error(`HubSpot ${res.status} ${path}: ${msg}`);
  }
  return res.json();
}

// Core: read contact (and 1st deal & its items) – enough to stress concurrency.
async function readSnapshot(email: string, token: string) {
  // 1) find contact
  const search = await hs(`/crm/v3/objects/contacts/search`, token, {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [
        { filters: [{ propertyName: "email", operator: "EQ", value: email }] },
      ],
      properties: ["email", "firstname", "lastname"],
      limit: 1,
    }),
  });
  if (!search?.results?.length) return { contact: null, deals: [] };

  const contact = search.results[0];
  const contactId: string = contact.id;

  // 2) associated deals (limit 1 for demo)
  const assocDeals = await hs(
    `/crm/v4/objects/contacts/${contactId}/associations/deals?limit=1`,
    token
  );
  const dealId: string | undefined = assocDeals?.results?.[0]?.toObjectId;
  if (!dealId) {
    return {
      contact: {
        id: contactId,
        email: contact.properties?.email,
        firstname: contact.properties?.firstname,
        lastname: contact.properties?.lastname,
      },
      deals: [],
    };
  }

  // 3) read deal
  const deal = await hs(`/crm/v3/objects/deals/${dealId}`, token, {
    method: "GET",
  });

  // 4) line items for that deal
  const assocLI = await hs(
    `/crm/v4/objects/deals/${dealId}/associations/line_items?limit=200`,
    token
  );
  const liIds: string[] =
    assocLI?.results?.map((r: any) => r.toObjectId).filter(Boolean) || [];
  let items: any[] = [];
  if (liIds.length) {
    const liBatch = await hs(`/crm/v3/objects/line_items/batch/read`, token, {
      method: "POST",
      body: JSON.stringify({
        properties: ["name", "quantity", "price"],
        inputs: liIds.map((id) => ({ id })),
      }),
    });
    items = (liBatch?.results || []).map((li: any) => ({
      id: li.id,
      name: li.properties?.name,
      quantity: Number(li.properties?.quantity ?? 0),
      price: Number(li.properties?.price ?? 0),
      subtotal:
        Number(li.properties?.price ?? 0) *
        Number(li.properties?.quantity ?? 0),
    }));
  }

  return {
    contact: {
      id: contactId,
      email: contact.properties?.email,
      firstname: contact.properties?.firstname,
      lastname: contact.properties?.lastname,
    },
    deals: [
      {
        id: deal.id,
        dealname: deal.properties?.dealname,
        amount: Number(deal.properties?.amount ?? 0),
        dealstage: deal.properties?.dealstage,
        lineItems: items,
      },
    ],
  };
}

/**
 * Coalesced reader:
 * - If cache fresh → return cache (cache: "hit").
 * - If request for same key is in-flight → await same Promise (coalesced=true).
 * - Otherwise → do the HubSpot calls (cache: "miss"), then fill cache & resolve all waiters.
 */
async function coalescedRead(email: string, token: string) {
  const key = `contact:${email.toLowerCase()}`;
  const now = Date.now();

  const cached = CACHE.get(key);
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return {
      payload: cached.payload,
      meta: {
        cache: "hit" as const,
        coalesced: false,
        apiCallsSaved: 1,
        retries: 0,
      },
    };
  }

  const inFlight = INFLIGHT.get(key);
  if (inFlight) {
    const payload = await inFlight;
    return {
      payload,
      meta: {
        cache: "miss" as const,
        coalesced: true,
        apiCallsSaved: 1,
        retries: 0,
      },
    };
  }

  const p = (async () => {
    const data = await readSnapshot(email, token);
    CACHE.set(key, { at: Date.now(), payload: data });
    return data;
  })();

  INFLIGHT.set(key, p);

  try {
    const payload = await p;
    return {
      payload,
      meta: {
        cache: "miss" as const,
        coalesced: false,
        apiCallsSaved: 0,
        retries: 0,
      },
    };
  } finally {
    INFLIGHT.delete(key);
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = await ensureAccessToken();
    if (!token) {
      return NextResponse.json(
        { error: "Not connected to HubSpot" },
        { status: 401 }
      );
    }

    const { email, parallel = 5 } = (await req.json()) as {
      email: string;
      parallel?: number;
    };

    if (!email?.trim()) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    // Launch N parallel reads (simulate multiple users hitting the same key)
    const tasks = Array.from({
      length: Math.max(1, Math.min(20, Number(parallel) || 5)),
    }).map(() => coalescedRead(email.trim(), token));

    const start = Date.now();
    const results = await Promise.all(tasks);
    const ms = Date.now() - start;

    // Aggregate meta
    const meta = {
      cache: results[0].meta.cache,
      coalesced: results.some((r) => r.meta.coalesced),
      apiCallsSaved: results.reduce(
        (s, r) => s + (r.meta.apiCallsSaved || 0),
        0
      ),
      retries: results.reduce((s, r) => s + (r.meta.retries || 0), 0),
      ms,
      ts: new Date().toISOString(),
    };

    // Return the first payload (all are identical by coalescing) + meta
    return NextResponse.json({ ...results[0].payload, meta }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
