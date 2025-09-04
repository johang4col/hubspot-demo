import { NextRequest, NextResponse } from "next/server";
import { ensureAccessToken } from "@/lib/hubspotTokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE = process.env.HUBSPOT_BASE_URL || "https://api.hubapi.com";

type HSObj = {
  id: string;
  properties?: Record<string, string>;
};

type HubSpotSearchResult = {
  results?: HSObj[];
};

type HubSpotAssociationResult = {
  results?: Array<{ toObjectId?: string }>;
};

type HubSpotBatchResult = {
  results?: HSObj[];
};

type HubSpotErrorPayload = {
  message?: string;
  errors?: Array<{ message?: string }>;
};

type LineItem = {
  id: string;
  name?: string;
  quantity: number;
  price: number;
  subtotal: number;
};

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

export async function GET(req: NextRequest) {
  const accessToken = await ensureAccessToken();
  if (!accessToken)
    return NextResponse.json(
      { error: "Not connected to HubSpot" },
      { status: 401 }
    );
  try {
    const token = accessToken;
    if (!token) {
      return NextResponse.json(
        { error: "Not connected to HubSpot" },
        { status: 401 }
      );
    }

    const email = req.nextUrl.searchParams.get("email")?.trim();
    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const search = (await hs(`/crm/v3/objects/contacts/search`, token, {
      method: "POST",
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [{ propertyName: "email", operator: "EQ", value: email }],
          },
        ],
        properties: ["email", "firstname", "lastname"],
        limit: 1,
      }),
    })) as HubSpotSearchResult;

    if (!search?.results?.length) {
      return NextResponse.json({ contact: null, deals: [] }, { status: 200 });
    }

    const contact: HSObj = search.results[0];
    const contactId = contact.id;

    const assocDeals = (await hs(
      `/crm/v4/objects/contacts/${contactId}/associations/deals?limit=100`,
      token
    )) as HubSpotAssociationResult;

    const dealIds: string[] =
      (assocDeals?.results
        ?.map((r) => r.toObjectId)
        .filter(Boolean) as string[]) || [];

    if (dealIds.length === 0) {
      return NextResponse.json(
        {
          contact: { id: contactId, properties: contact.properties },
          deals: [],
        },
        { status: 200 }
      );
    }

    const dealsBatch = (await hs(`/crm/v3/objects/deals/batch/read`, token, {
      method: "POST",
      body: JSON.stringify({
        properties: [
          "dealname",
          "amount",
          "pipeline",
          "dealstage",
          "createdate",
        ],
        inputs: dealIds.map((id) => ({ id })),
      }),
    })) as HubSpotBatchResult;

    const deals: HSObj[] = dealsBatch?.results || [];

    const lineItemsByDeal: Record<string, LineItem[]> = {};

    for (const d of deals) {
      const assocLI = (await hs(
        `/crm/v4/objects/deals/${d.id}/associations/line_items?limit=200`,
        token
      )) as HubSpotAssociationResult;

      const liIds: string[] =
        (assocLI?.results
          ?.map((r) => r.toObjectId)
          .filter(Boolean) as string[]) || [];

      if (liIds.length === 0) {
        lineItemsByDeal[d.id] = [];
        continue;
      }

      const liBatch = (await hs(
        `/crm/v3/objects/line_items/batch/read`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            properties: ["name", "quantity", "price"],
            inputs: liIds.map((id) => ({ id })),
          }),
        }
      )) as HubSpotBatchResult;

      lineItemsByDeal[d.id] = (liBatch?.results || []).map((li: HSObj) => ({
        id: li.id,
        name: li.properties?.name,
        quantity: Number(li.properties?.quantity ?? 0),
        price: Number(li.properties?.price ?? 0),
        subtotal:
          Number(li.properties?.price ?? 0) *
          Number(li.properties?.quantity ?? 0),
      }));
    }

    const out = {
      contact: {
        id: contactId,
        email: contact.properties?.email,
        firstname: contact.properties?.firstname,
        lastname: contact.properties?.lastname,
      },
      deals: deals
        .map((d) => ({
          id: d.id,
          dealname: d.properties?.dealname,
          amount: Number(d.properties?.amount ?? 0),
          pipeline: d.properties?.pipeline,
          dealstage: d.properties?.dealstage,
          createdate: d.properties?.createdate,
          lineItems: lineItemsByDeal[d.id] || [],
        }))
        .sort((a, b) => {
          const dateA = a.createdate || "";
          const dateB = b.createdate || "";
          return dateA > dateB ? -1 : 1;
        }),
    };

    return NextResponse.json(out, { status: 200 });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}
