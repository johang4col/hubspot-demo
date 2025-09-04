import { NextRequest, NextResponse } from "next/server";
import { ensureAccessToken } from "@/lib/hubspotTokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE = process.env.HUBSPOT_BASE_URL || "https://api.hubapi.com";

type HubSpotContact = {
  id: string;
  properties?: Record<string, string>;
};

type HubSpotDeal = {
  id: string;
  properties?: Record<string, string>;
};

type HubSpotLineItem = {
  id: string;
  properties?: Record<string, string>;
};

type HubSpotSearchResult = {
  results?: HubSpotContact[];
};

type HubSpotAssociationResult = {
  results?: Array<{ toObjectId?: string }>;
};

type HubSpotBatchResult = {
  results?: HubSpotLineItem[];
};

type HubSpotErrorPayload = {
  message?: string;
  errors?: Array<{ message?: string }>;
};

type CacheEntry = { at: number; payload: unknown };
type InFlightMap = Map<string, Promise<unknown>>;

declare global {
  var __HS_DEMO_CACHE__: Map<string, CacheEntry> | undefined;
  var __HS_DEMO_INFLIGHT__: InFlightMap | undefined;
}

const g = globalThis as Record<string, unknown>;
if (!g.__HS_DEMO_CACHE__) g.__HS_DEMO_CACHE__ = new Map();
if (!g.__HS_DEMO_INFLIGHT__) g.__HS_DEMO_INFLIGHT__ = new Map();
const CACHE: Map<string, CacheEntry> = g.__HS_DEMO_CACHE__ as Map<
  string,
  CacheEntry
>;
const INFLIGHT: InFlightMap = g.__HS_DEMO_INFLIGHT__ as InFlightMap;

const CACHE_TTL_MS = 30_000;

async function hs(
  path: string,
  token: string,
  init?: RequestInit
): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {}
    const errorPayload = payload as HubSpotErrorPayload;
    const msg =
      errorPayload?.message ||
      errorPayload?.errors?.[0]?.message ||
      (await res.text().catch(() => res.statusText));
    throw new Error(`HubSpot ${res.status} ${path}: ${msg}`);
  }
  return res.json();
}

async function readSnapshot(email: string, token: string) {
  const search = (await hs(`/crm/v3/objects/contacts/search`, token, {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [
        { filters: [{ propertyName: "email", operator: "EQ", value: email }] },
      ],
      properties: ["email", "firstname", "lastname"],
      limit: 1,
    }),
  })) as HubSpotSearchResult;

  if (!search?.results?.length) return { contact: null, deals: [] };

  const contact = search.results[0];
  const contactId: string = contact.id;

  const assocDeals = (await hs(
    `/crm/v4/objects/contacts/${contactId}/associations/deals?limit=1`,
    token
  )) as HubSpotAssociationResult;

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

  const deal = (await hs(`/crm/v3/objects/deals/${dealId}`, token, {
    method: "GET",
  })) as HubSpotDeal;

  const assocLI = (await hs(
    `/crm/v4/objects/deals/${dealId}/associations/line_items?limit=200`,
    token
  )) as HubSpotAssociationResult;

  const liIds: string[] =
    (assocLI?.results?.map((r) => r.toObjectId).filter(Boolean) as string[]) ||
    [];

  let items: Array<{
    id: string;
    name?: string;
    quantity: number;
    price: number;
    subtotal: number;
  }> = [];

  if (liIds.length) {
    const liBatch = (await hs(`/crm/v3/objects/line_items/batch/read`, token, {
      method: "POST",
      body: JSON.stringify({
        properties: ["name", "quantity", "price"],
        inputs: liIds.map((id) => ({ id })),
      }),
    })) as HubSpotBatchResult;

    items = (liBatch?.results || []).map((li) => ({
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

    const tasks = Array.from({
      length: Math.max(1, Math.min(20, Number(parallel) || 5)),
    }).map(() => coalescedRead(email.trim(), token));

    const start = Date.now();
    const results = await Promise.all(tasks);
    const ms = Date.now() - start;

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

    return NextResponse.json(
      {
        ...(results[0].payload as Record<string, unknown>),
        meta,
      },
      { status: 200 }
    );
  } catch (e) {
    const error = e as Error;
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}
