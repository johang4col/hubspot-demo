import { NextRequest, NextResponse } from "next/server";
import { ensureAccessToken } from "@/lib/hubspotTokens";

export const runtime = "nodejs";

type PurchaseResponse = {
  contactId: string;
  dealId: string;
  lineItemIds: string[];
  amount: number;
};

type Stored = { at: number; response: PurchaseResponse };

declare global {
  var __IDEMP_STORE__: Map<string, Stored> | undefined;
}

const g = globalThis as Record<string, unknown>;
if (!g.__IDEMP_STORE__) g.__IDEMP_STORE__ = new Map<string, Stored>();
const IDEMP = g.__IDEMP_STORE__ as Map<string, Stored>;
const IDEMP_TTL_MS = 5 * 60 * 1000;

function getIdem(key: string | null): Stored | null {
  if (!key) return null;
  const s = IDEMP.get(key);
  if (!s) return null;
  if (Date.now() - s.at > IDEMP_TTL_MS) {
    IDEMP.delete(key);
    return null;
  }
  return s;
}

function setIdem(key: string, response: PurchaseResponse) {
  IDEMP.set(key, { at: Date.now(), response });
}

type Product = { name: string; price: number; quantity: number };

type HubSpotErrorPayload = {
  message?: string;
  errors?: Array<{ message?: string }>;
};

type HubSpotSearchResult = {
  results?: Array<{ id: string; properties?: Record<string, string> }>;
};

type HubSpotCreateResult = {
  id: string;
};

function sumAmount(products: Product[]) {
  return products.reduce(
    (acc, p) => acc + Number(p.price) * Number(p.quantity),
    0
  );
}

export async function POST(req: NextRequest) {
  try {
    const idemKey = req.headers.get("x-idempotency-key");
    const cached = getIdem(idemKey);
    if (cached) {
      return NextResponse.json(
        { ...cached.response, idempotent: true },
        { status: 200 }
      );
    }

    const accessToken = await ensureAccessToken();
    if (!accessToken)
      return NextResponse.json(
        { error: "Not connected to HubSpot" },
        { status: 401 }
      );

    if (!accessToken) {
      return NextResponse.json(
        { error: "Not connected to HubSpot" },
        { status: 401 }
      );
    }

    const body = (await req.json()) as {
      email: string;
      firstname?: string;
      lastname?: string;
      products: Product[];
      pipeline?: string;
      dealstage?: string;
    };

    if (
      !body?.email ||
      !Array.isArray(body.products) ||
      body.products.length < 1
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const invalid = body.products.some(
      (p) => !p.name?.trim() || Number(p.price) <= 0 || Number(p.quantity) < 1
    );
    if (invalid) {
      return NextResponse.json({ error: "Invalid products" }, { status: 400 });
    }

    const amount = Number(sumAmount(body.products).toFixed(2));
    const pipeline = body.pipeline || process.env.DEFAULT_PIPELINE || "default";
    const dealstage =
      body.dealstage || process.env.DEFAULT_DEALSTAGE || "appointmentscheduled";
    const baseUrl = process.env.HUBSPOT_BASE_URL || "https://api.hubapi.com";

    const hs = async (path: string, init?: RequestInit): Promise<unknown> => {
      const res = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
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
    };

    const search = (await hs(`/crm/v3/objects/contacts/search`, {
      method: "POST",
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              { propertyName: "email", operator: "EQ", value: body.email },
            ],
          },
        ],
        properties: ["email", "firstname", "lastname"],
        limit: 1,
      }),
    })) as HubSpotSearchResult;

    let contactId: string;
    if (search?.results?.length) {
      contactId = search.results[0].id;
      if (body.firstname || body.lastname) {
        await hs(`/crm/v3/objects/contacts/${contactId}`, {
          method: "PATCH",
          body: JSON.stringify({
            properties: {
              firstname: body.firstname || null,
              lastname: body.lastname || null,
            },
          }),
        });
      }
    } else {
      const created = (await hs(`/crm/v3/objects/contacts`, {
        method: "POST",
        body: JSON.stringify({
          properties: {
            email: body.email,
            firstname: body.firstname || null,
            lastname: body.lastname || null,
          },
        }),
      })) as HubSpotCreateResult;
      contactId = created.id;
    }

    const deal = (await hs(`/crm/v3/objects/deals`, {
      method: "POST",
      body: JSON.stringify({
        properties: {
          dealname: `Order for ${body.email} - ${new Date().toISOString()}`,
          amount,
          pipeline,
          dealstage,
        },
      }),
    })) as HubSpotCreateResult;
    const dealId: string = deal.id;

    await hs(
      `/crm/v3/objects/deals/${dealId}/associations/contacts/${contactId}/deal_to_contact`,
      { method: "PUT" }
    );

    const lineItemIds: string[] = [];
    for (const p of body.products) {
      const li = (await hs(`/crm/v3/objects/line_items`, {
        method: "POST",
        body: JSON.stringify({
          properties: {
            name: p.name,
            quantity: String(p.quantity),
            price: Number(p.price),
          },
        }),
      })) as HubSpotCreateResult;
      lineItemIds.push(li.id);

      await hs(
        `/crm/v3/objects/deals/${dealId}/associations/line_items/${li.id}/deal_to_line_item`,
        { method: "PUT" }
      );
    }

    const payload = { contactId, dealId, lineItemIds, amount };
    if (idemKey) setIdem(idemKey, payload);

    return NextResponse.json(payload, { status: 201 });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}
