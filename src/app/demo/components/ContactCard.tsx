"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type Contact = {
  id: string;
  email: string;
  firstname?: string;
  lastname?: string;
};

export default function ContactCard({ contact }: { contact: Contact | null }) {
  if (!contact) return null;
  const fullName = [contact.firstname, contact.lastname]
    .filter(Boolean)
    .join(" ");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="font-medium">{fullName || "—"}</div>
        <div className="text-sm text-neutral-600">{contact.email}</div>
        <div className="text-xs text-neutral-500">ID: {contact.id}</div>
      </CardContent>
    </Card>
  );
}
