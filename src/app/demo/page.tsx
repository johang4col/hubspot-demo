"use client";

import { useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Header from "./components/Header";
import PurchaseForm from "./components/PurchaseForm";
import ConcurrencyPanel, {
  ConcurrencyMeta,
} from "./components/ConcurrencyPanel";
import ContactCard, { Contact } from "./components/ContactCard";
import DealsTable, { Deal } from "./components/DealsTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const MOCK_META: ConcurrencyMeta = {
  cache: "miss",
  coalesced: false,
  apiCallsSaved: 0,
  retries: 0,
  ts: new Date().toISOString(),
};

type ApiDealResponse = {
  id: string;
  dealname: string;
  dealstage: string;
  amount: number;
  lineItems?: Array<{
    id: string;
    name?: string;
    price: number;
    quantity: number;
    subtotal: number;
  }>;
};

type ApiContactResponse = {
  id: string;
  email: string;
  firstname?: string;
  lastname?: string;
};

type ApiHistoryResponse = {
  contact?: ApiContactResponse;
  deals?: ApiDealResponse[];
  meta?: {
    cache?: string;
    coalesced?: boolean;
    apiCallsSaved?: number;
    retries?: number;
    ts?: string;
  };
};

export default function DemoPage() {
  const [tab, setTab] = useState<"purchase" | "history">("purchase");

  const [email, setEmail] = useState("");
  const [contact, setContact] = useState<Contact | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [meta, setMeta] = useState<ConcurrencyMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reqCounter = useRef(0);

  async function searchHistory(e?: React.FormEvent) {
    e?.preventDefault();

    const q = email.trim();
    if (!q) {
      setErr("Enter an email");
      return;
    }

    setLoading(true);
    setErr(null);
    setContact(null);
    setDeals([]);
    const myReqId = ++reqCounter.current;

    try {
      const res = await fetch(
        `/api/demo/history?email=${encodeURIComponent(q)}`,
        {
          method: "GET",
          cache: "no-store",
          headers: { "cache-control": "no-cache" },
        }
      );

      const data = (await res.json()) as ApiHistoryResponse;

      if (myReqId !== reqCounter.current) return;

      if (!res.ok) {
        throw new Error(
          (data as unknown as { error?: string })?.error || "Request failed"
        );
      }

      const uiContact: Contact | null = data.contact
        ? {
            id: data.contact.id,
            email: data.contact.email,
            firstname: data.contact.firstname,
            lastname: data.contact.lastname,
          }
        : null;

      const uiDeals: Deal[] = Array.isArray(data.deals)
        ? data.deals.map((d) => ({
            id: d.id,
            dealname: d.dealname,
            stage: d.dealstage,
            amount: Number(d.amount ?? 0),
            lineItems: (d.lineItems || []).map((li) => ({
              id: li.id,
              name: li.name || "",
              price: Number(li.price ?? 0),
              quantity: Number(li.quantity ?? 0),
              subtotal: Number(li.subtotal ?? 0),
            })),
          }))
        : [];

      setContact(uiContact);
      setDeals(uiDeals);
      setMeta({ ...MOCK_META, ts: new Date().toISOString() });
    } catch (e) {
      if (myReqId !== reqCounter.current) return;
      const error = e as Error;
      setErr(error?.message || "Error");
    } finally {
      if (myReqId === reqCounter.current) setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <Header />
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as typeof tab)}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="purchase">Simulate Purchase</TabsTrigger>
          <TabsTrigger value="history">Search History</TabsTrigger>
        </TabsList>

        <TabsContent value="purchase" className="space-y-6">
          <PurchaseForm />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Search by Email</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={searchHistory} className="flex gap-3 flex-wrap">
                <Input
                  placeholder="customer@demo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-w-[260px]"
                />
                <Button type="submit" disabled={loading}>
                  {loading ? "Searching..." : "Search"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    const q = email.trim();
                    if (!q) {
                      setErr("Enter an email");
                      return;
                    }
                    setMeta(null);
                    try {
                      const res = await fetch("/api/demo/concurrency-test", {
                        method: "POST",
                        cache: "no-store",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: q, parallel: 8 }),
                      });
                      const data = (await res.json()) as ApiHistoryResponse;
                      if (!res.ok)
                        throw new Error(
                          (data as unknown as { error?: string })?.error ||
                            "Concurrency test failed"
                        );

                      const uiDeals: Deal[] = Array.isArray(data.deals)
                        ? data.deals.map((d) => ({
                            id: d.id,
                            dealname: d.dealname,
                            stage: d.dealstage,
                            amount: Number(d.amount ?? 0),
                            lineItems: (d.lineItems || []).map((li) => ({
                              id: li.id,
                              name: li.name || "",
                              price: Number(li.price ?? 0),
                              quantity: Number(li.quantity ?? 0),
                              subtotal: Number(li.subtotal ?? 0),
                            })),
                          }))
                        : [];
                      if (data.contact) {
                        setContact({
                          id: data.contact.id,
                          email: data.contact.email,
                          firstname: data.contact.firstname,
                          lastname: data.contact.lastname,
                        });
                      }
                      setDeals(uiDeals);

                      setMeta({
                        cache: (data.meta?.cache as "hit" | "miss") || "miss",
                        coalesced: !!data.meta?.coalesced,
                        apiCallsSaved: Number(data.meta?.apiCallsSaved || 0),
                        retries: Number(data.meta?.retries || 0),
                        ts: data.meta?.ts || new Date().toISOString(),
                      });
                    } catch (err) {
                      const error = err as Error;
                      setErr(error?.message || "Error");
                    }
                  }}
                >
                  Run concurrency test
                </Button>
              </form>
              {err && <div className="mt-2 text-sm text-red-600">{err}</div>}
            </CardContent>
          </Card>

          {meta && <ConcurrencyPanel meta={meta} />}
          <ContactCard contact={contact} />
          {!!deals.length && <DealsTable deals={deals} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
