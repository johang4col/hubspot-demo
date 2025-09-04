"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

import PurchasePreview from "./PurchasePreview";
import PurchaseActivityLog from "./PurchaseActivityLog";
import ProductCart, { CartItem } from "./ProductCart";

import type { Contact, LineItem } from "@/lib/types";

export default function PurchaseForm() {
  const [email, setEmail] = useState("customer@demo.com");
  const [firstname, setFirstname] = useState("John");
  const [lastname, setLastname] = useState("Smith");
  const [items, setItems] = useState<CartItem[]>([
    { name: "Premium Notebook", price: 6.5, quantity: 2 },
    { name: "Pilot Pen", price: 1.2, quantity: 1 },
  ]);

  const [contactId, setContactId] = useState<string | undefined>();
  const [dealId, setDealId] = useState<string | undefined>();
  const [lineCount, setLineCount] = useState<number | undefined>();

  const [submitting, setSubmitting] = useState(false);

  const total = useMemo(
    () => items.reduce((s, i) => s + i.price * i.quantity, 0),
    [items]
  );

  const customer: Contact = { id: "", email, firstname, lastname };

  const lineItems: LineItem[] = items.map((it, idx) => ({
    id: String(idx),
    name: it.name,
    price: it.price,
    quantity: it.quantity,
    subtotal: it.price * it.quantity,
  }));

  const submitReal = async () => {
    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }
    if (items.length === 0) {
      toast.error("Add at least one product to cart");
      return;
    }
    if (items.some((i) => !i.name.trim())) {
      toast.error("All products must have a name");
      return;
    }
    if (items.some((i) => i.price <= 0 || i.quantity < 1)) {
      toast.error("Check prices and quantities");
      return;
    }

    setSubmitting(true);
    try {
      const idempotencyKey = crypto.randomUUID();

      const res = await fetch("/api/demo/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          email,
          firstname,
          lastname,
          products: items.map((i) => ({
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error registering purchase");

      setContactId(data.contactId);
      setDealId(data.dealId);
      setLineCount(
        Array.isArray(data.lineItemIds) ? data.lineItemIds.length : undefined
      );

      toast.success(
        `Purchase registered: $${total.toFixed(2)} (${items.length} products)`
      );
    } catch (err: any) {
      toast.error(err?.message || "Error registering purchase");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Input
              placeholder="Customer email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="First name"
                value={firstname}
                onChange={(e) => setFirstname(e.target.value)}
              />
              <Input
                placeholder="Last name"
                value={lastname}
                onChange={(e) => setLastname(e.target.value)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="text-sm text-neutral-600">
                Total:{" "}
                <span className="text-lg font-bold text-green-600">
                  ${total.toFixed(2)}
                </span>
              </div>
              <Button
                onClick={submitReal}
                className="bg-orange-600 hover:bg-orange-700"
                disabled={submitting || items.length === 0 || total === 0}
              >
                {submitting ? "Submitting..." : "Submit to HubSpot"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <ProductCart items={items} onItemsChange={setItems} />
      </div>

      <PurchasePreview customer={customer} items={lineItems} total={total} />

      <PurchaseActivityLog
        contactId={contactId}
        dealId={dealId}
        lineItems={lineCount}
      />
    </div>
  );
}
