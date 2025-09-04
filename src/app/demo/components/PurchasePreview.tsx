"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Contact, LineItem } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

type Props = {
  customer: Contact;
  items: LineItem[];
  total: number;
};

export default function PurchasePreview({ customer, items, total }: Props) {
  if (!customer?.email && items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchase Preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <div className="font-medium">
            {[customer.firstname, customer.lastname]
              .filter(Boolean)
              .join(" ") || "—"}
          </div>
          <div className="text-neutral-600">{customer.email || "—"}</div>
        </div>

        <div className="space-y-1">
          {items.map((it) => (
            <div key={it.id} className="flex justify-between">
              <div>
                {it.name || "Product"} ({it.quantity} ×{" "}
                {formatCurrency(it.price)})
              </div>
              <div>{formatCurrency(it.subtotal)}</div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-neutral-500">No products</div>
          )}
        </div>

        <div className="pt-2 border-t font-semibold flex justify-between">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>

        <p className="text-xs text-neutral-500">
          This is a preview. The deal will be created when purchase is
          submitted.
        </p>
      </CardContent>
    </Card>
  );
}
