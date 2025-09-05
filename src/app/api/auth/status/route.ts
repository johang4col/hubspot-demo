import { NextRequest, NextResponse } from "next/server";
import { getTokens } from "@/lib/hubspotTokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const t = await getTokens();
  const cookieConnected = req.cookies.get("hs_connected")?.value === "1";

  if (!t) {
    return NextResponse.json({
      connected: false,
      cookieConnected,
      reason: "no_tokens_in_memory",
    });
  }

  const secondsLeft = Math.max(
    0,
    Math.floor((t.expires_at - Date.now()) / 1000)
  );

  return NextResponse.json({
    connected: true,
    expires_in_seconds: secondsLeft,
    scope: t.scope,
    cookieConnected,
  });
}
