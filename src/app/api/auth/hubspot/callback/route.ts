import { NextRequest, NextResponse } from "next/server";
import { setTokens } from "@/lib/hubspotTokens";

export const runtime = "nodejs";

function reqEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const code = search.get("code");
  const state = search.get("state");
  const savedState = req.cookies.get("hs_oauth_state")?.value || "";

  if (!code)
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  if (!state || state !== savedState) {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  const clientId = reqEnv("HUBSPOT_CLIENT_ID");
  const clientSecret = reqEnv("HUBSPOT_CLIENT_SECRET");
  const redirectUri = reqEnv("HUBSPOT_REDIRECT_URI");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const resp = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    return NextResponse.json(
      { error: "Token exchange failed", details: text },
      { status: 500 }
    );
  }

  const data = (await resp.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
  };

  // store tokens (in-memory for demo)
  setTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    token_type: data.token_type,
    scope: data.scope,
  });

  const res = NextResponse.redirect(new URL("/demo?connected=1", req.url));
  res.headers.append(
    "Set-Cookie",
    "hs_oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"
  );
  res.headers.append(
    "Set-Cookie",
    "hs_connected=1; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax"
  );
  return res;
}
