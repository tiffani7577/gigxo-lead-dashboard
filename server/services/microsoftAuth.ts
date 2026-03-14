/**
 * Microsoft OAuth for inbox connection (Teryn — teryn@gigxo.com).
 * Scopes: openid, profile, offline_access, User.Read, Mail.Send
 */

import { getDb } from "../db";
import { microsoftInboxConnection } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize";
const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token";
const MICROSOFT_SCOPES = "openid profile offline_access User.Read Mail.Send";

export function getMicrosoftConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID || "common";
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
  return {
    clientId,
    clientSecret,
    tenantId,
    redirectUri,
    configured: !!(clientId && clientSecret && redirectUri),
  };
}

export function getMicrosoftLoginUrl(state?: string): string {
  const { clientId, tenantId, redirectUri, configured } = getMicrosoftConfig();
  if (!configured || !clientId || !redirectUri) {
    throw new Error("Microsoft OAuth not configured: set MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REDIRECT_URI");
  }
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: MICROSOFT_SCOPES,
    response_mode: "query",
    state: state ?? "",
    prompt: "consent",
  });
  const base = MICROSOFT_AUTH_URL.replace("{tenant}", tenantId);
  return `${base}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  const { clientId, clientSecret, tenantId, redirectUri, configured } = getMicrosoftConfig();
  if (!configured || !clientId || !clientSecret || !redirectUri) {
    throw new Error("Microsoft OAuth not configured");
  }
  const url = MICROSOFT_TOKEN_URL.replace("{tenant}", tenantId);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: MICROSOFT_SCOPES,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Microsoft token exchange failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  return data;
}

export async function refreshMicrosoftTokens(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const { clientId, clientSecret, tenantId, configured } = getMicrosoftConfig();
  if (!configured || !clientId || !clientSecret) {
    throw new Error("Microsoft OAuth not configured");
  }
  const url = MICROSOFT_TOKEN_URL.replace("{tenant}", tenantId);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Microsoft token refresh failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return data;
}

export async function getStoredConnection(): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  connectedEmail: string;
} | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(microsoftInboxConnection).limit(1);
  if (!row) return null;
  return {
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    expiresAt: row.expiresAt,
    connectedEmail: row.connectedEmail,
  };
}

export async function storeConnection(params: {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  connectedEmail: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(microsoftInboxConnection).limit(1);
  const expiresAt = params.expiresAt instanceof Date ? params.expiresAt : new Date(params.expiresAt);
  if (existing.length > 0) {
    await db.update(microsoftInboxConnection).set({
      accessToken: params.accessToken,
      refreshToken: params.refreshToken,
      expiresAt,
      connectedEmail: params.connectedEmail,
      updatedAt: new Date(),
    }).where(eq(microsoftInboxConnection.id, existing[0].id));
  } else {
    await db.insert(microsoftInboxConnection).values({
      accessToken: params.accessToken,
      refreshToken: params.refreshToken,
      expiresAt,
      connectedEmail: params.connectedEmail,
      provider: "microsoft",
    });
  }
}
