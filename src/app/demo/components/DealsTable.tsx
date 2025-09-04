"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type LineItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
};
export type Deal = {
  id: string;
  dealname: string;
  amount: number;
  stage: string;
  createdAt?: string;
  lineItems?: LineItem[];
};

export default function DealsTable({ deals }: { deals: Deal[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {deals.map((deal) => (
          <div key={deal.id} className="rounded-md border bg-white">
            <div className="grid grid-cols-3 gap-3 px-4 py-3">
              <div className="font-medium">{deal.dealname}</div>
              <div className="text-sm text-neutral-600">{deal.stage}</div>
              <div className="text-right font-medium">{deal.amount} USD</div>
            </div>
            {deal.lineItems?.length ? (
              <div className="border-t px-4 py-3 text-sm">
                {deal.lineItems.map((li) => (
                  <div key={li.id} className="flex justify-between py-0.5">
                    <div>
                      {li.name} ({li.quantity} × {li.price})
                    </div>
                    <div>{li.subtotal.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
