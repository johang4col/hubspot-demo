import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function reqEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function GET(_req: NextRequest) {
  const clientId = reqEnv("HUBSPOT_CLIENT_ID");
  const redirectUri = reqEnv("HUBSPOT_REDIRECT_URI");
  const scopes = (process.env.HUBSPOT_SCOPES || "").trim();

  // Construir URL de autorización de HubSpot
  const url = new URL("https://app.hubspot.com/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scopes);

  // (Opcional) state simple para CSRF/trace (validaremos en callback)
  const state = crypto.randomUUID();
  url.searchParams.set("state", state);

  // Guardar state en cookie temporal (10 min)
  const res = NextResponse.redirect(url.toString(), 302);
  res.headers.append(
    "Set-Cookie",
    `hs_oauth_state=${state}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax`
  );
  return res;
}
