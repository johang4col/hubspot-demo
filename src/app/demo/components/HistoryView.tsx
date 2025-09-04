"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type LineItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
};
type Deal = {
  id: string;
  dealname: string;
  amount: number;
  pipeline: string;
  dealstage: string;
  createdate?: string;
  lineItems: LineItem[];
};
type Contact = {
  id: string;
  email: string;
  firstname?: string;
  lastname?: string;
} | null;

export default function HistoryView() {
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState<Contact>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reqCounter = useRef(0);

  async function onSearch(e?: React.FormEvent) {
    e?.preventDefault();

    const q = email.trim();
    if (!q) {
      setError("Enter an email");
      return;
    }

    setLoading(true);
    setError(null);
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

      const data = await res.json();

      if (myReqId !== reqCounter.current) return;

      if (!res.ok) {
        throw new Error(data?.error || "Request failed");
      }
      setContact(data.contact);
      setDeals(Array.isArray(data.deals) ? data.deals : []);
    } catch (err: any) {
      if (myReqId !== reqCounter.current) return;
      setError(err?.message || "Error");
    } finally {
      if (myReqId === reqCounter.current) setLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Search History</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <form onSubmit={onSearch} className="flex gap-2">
            <Input
              placeholder="Search by email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </Button>
          </form>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          {!loading && contact === null && deals.length === 0 && !error && (
            <div className="text-sm text-neutral-600">
              Enter an email and click Search.
            </div>
          )}
        </CardContent>
      </Card>

      {contact && (
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="font-semibold">
              {contact.firstname} {contact.lastname}
            </div>
            <div className="text-sm text-neutral-600">{contact.email}</div>
            <div className="text-xs text-neutral-500">ID: {contact.id}</div>
          </CardContent>
        </Card>
      )}

      {deals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Deals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="py-2 pr-4">Deal</th>
                    <th className="py-2 pr-4">Stage</th>
                    <th className="py-2 pr-4">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((d) => (
                    <tr key={d.id} className="border-t">
                      <td className="py-2 pr-4">
                        {d.dealname}
                        <div className="text-xs text-neutral-500">
                          ID: {d.id}
                        </div>
                        {d.lineItems.length > 0 && (
                          <>
                            <Separator className="my-2" />
                            <div className="space-y-1">
                              {d.lineItems.map((li) => (
                                <div key={li.id} className="text-neutral-700">
                                  <span className="mr-2">▸ {li.name}</span>
                                  <span className="mr-2">
                                    ({li.quantity} × {li.price})
                                  </span>
                                  <span className="font-medium">
                                    → {li.subtotal}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </td>
                      <td className="py-2 pr-4">{d.dealstage}</td>
                      <td className="py-2 pr-4">{d.amount} USD</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
