"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";

type ActivityLogProps = {
  contactId?: string;
  dealId?: string;
  lineItems?: number;
};

export default function PurchaseActivityLog({
  contactId,
  dealId,
  lineItems,
}: ActivityLogProps) {
  if (!contactId && !dealId && !lineItems) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Log</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {contactId && (
            <ActivityItem text={`Contact created (id: ${contactId})`} />
          )}
          {dealId && <ActivityItem text={`Deal created (id: ${dealId})`} />}
          {lineItems && (
            <ActivityItem text={`Line items created (${lineItems})`} />
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

function ActivityItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2">
      <Check aria-hidden className="mt-0.5 h-4 w-4 text-emerald-600" />
      <span>{text}</span>
    </li>
  );
}
