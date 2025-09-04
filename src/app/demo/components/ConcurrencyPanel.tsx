"use client";
import { Badge } from "@/components/ui/badge";

export type ConcurrencyMeta = {
  cache: "hit" | "miss";
  coalesced: boolean;
  apiCallsSaved: number;
  retries: number;
  ts: string; // ISO
};

export default function ConcurrencyPanel({ meta }: { meta: ConcurrencyMeta }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant={meta.cache === "hit" ? "default" : "destructive"}>
        cache: {meta.cache}
      </Badge>
      <Badge variant={meta.coalesced ? "default" : "secondary"}>
        coalesced: {meta.coalesced ? "yes" : "no"}
      </Badge>
      <Badge variant="secondary">apiCallsSaved: {meta.apiCallsSaved}</Badge>
      <Badge variant="secondary">retries: {meta.retries}</Badge>
      <span className="text-xs text-neutral-500">
        {new Date(meta.ts).toLocaleString()}
      </span>
    </div>
  );
}
