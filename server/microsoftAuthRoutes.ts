/**
 * Microsoft OAuth routes for inbox connection.
 * GET /api/auth/microsoft/login
 * GET /api/auth/microsoft/callback
 */

import type { Express, Request, Response } from "express";
import {
  getMicrosoftConfig,
  getMicrosoftLoginUrl,
  exchangeCodeForTokens,
  storeConnection,
} from "./services/microsoftAuth";

const GRAPH_ME = "https://graph.microsoft.com/v1.0/me";

async function getMeEmail(accessToken: string): Promise<string> {
  const res = await fetch(GRAPH_ME, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Graph /me failed: ${res.status}`);
  const data = (await res.json()) as { mail?: string; userPrincipalName?: string };
  return data.mail ?? data.userPrincipalName ?? "";
}

export function registerMicrosoftAuthRoutes(app: Express) {
  app.get("/api/auth/microsoft/login", (req: Request, res: Response) => {
    const { configured } = getMicrosoftConfig();
    if (!configured) {
      return res.status(501).json({ error: "Microsoft OAuth not configured (MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REDIRECT_URI)" });
    }
    const state = (req.query.redirect as string) || "/admin/outreach";
    const url = getMicrosoftLoginUrl(state);
    res.redirect(url);
  });

  app.get("/api/auth/microsoft/callback", async (req: Request, res: Response) => {
    const { configured } = getMicrosoftConfig();
    if (!configured) {
      return res.redirect("/admin/outreach?error=not_configured");
    }
    const code = req.query.code as string;
    const state = (req.query.state as string) || "/admin/outreach";
    if (!code) {
      return res.redirect(`${state}?error=no_code`);
    }
    try {
      const tokens = await exchangeCodeForTokens(code);
      const email = await getMeEmail(tokens.access_token);
      const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));
      await storeConnection({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt,
        connectedEmail: email || "teryn@gigxo.com",
      });
      res.redirect(state);
    } catch (e) {
      console.error("[Microsoft OAuth callback]", e);
      res.redirect(`${state}?error=callback_failed`);
    }
  });
}
