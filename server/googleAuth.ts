/**
 * Google OAuth 2.0 — user login only (separate from Microsoft Graph / outreach).
 * Registers /api/auth/google, /api/auth/google/login, and /api/auth/google/callback.
 *
 * Env vars (Railway):
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REDIRECT_URI — must match Google Cloud Console exactly (e.g. https://www.gigxo.com/api/auth/google/callback if app is on www)
 *   APP_URL — frontend origin for redirect fallback when state is missing (e.g. https://www.gigxo.com); avoids redirecting to wrong host and "not found"
 */

import type { Express, Request, Response } from "express";
import { loginWithGoogle } from "./customAuth";
import { CUSTOM_AUTH_COOKIE, ONE_YEAR_MS } from "@shared/const";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

function getGoogleConfig(req?: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUriEnv = process.env.GOOGLE_REDIRECT_URI?.trim();
  const redirectUri = redirectUriEnv || (req ? `${req.protocol}://${req.get("host")}/api/auth/google/callback` : "");
  const configured = !!(clientId && clientSecret);
  return {
    clientId,
    clientSecret,
    redirectUri: redirectUri || undefined,
    configured,
    missing: [
      !clientId && "GOOGLE_CLIENT_ID",
      !clientSecret && "GOOGLE_CLIENT_SECRET",
    ].filter(Boolean) as string[],
  };
}

function handleGoogleLogin(req: Request, res: Response) {
  const { clientId, clientSecret, redirectUri, configured, missing } = getGoogleConfig(req);
  if (!configured) {
    return res.status(501).json({
      error: "Google OAuth not configured",
      message: missing.length ? `Missing in server env: ${missing.join(", ")}. Set them in Railway (or .env locally) and redeploy/restart.` : "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    });
  }
  if (!redirectUri) {
    return res.status(501).json({ error: "Google OAuth not configured", message: "Redirect URI could not be determined. Set GOOGLE_REDIRECT_URI in production." });
  }

  const state = (req.query.origin as string) || req.headers.referer || "";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "select_account",
  });

  res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}

export function registerGoogleAuthRoutes(app: Express) {
  // Step 1: Redirect to Google (both paths for flexibility)
  app.get("/api/auth/google", (req: Request, res: Response) => handleGoogleLogin(req, res));
  app.get("/api/auth/google/login", (req: Request, res: Response) => handleGoogleLogin(req, res));

  // Step 2: Handle Google callback — exchange code, fetch profile, find/create user, set session, redirect into app
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const { clientId, clientSecret, redirectUri, configured } = getGoogleConfig(req);
    if (!configured || !clientId || !clientSecret || !redirectUri) {
      return res.redirect("/login?error=google_failed");
    }

    const code = req.query.code as string;
    const state = (req.query.state as string) || "";

    if (!code) {
      return res.redirect("/login?error=google_cancelled");
    }

    try {
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        throw new Error(`Token exchange failed: ${err}`);
      }

      const tokenData = (await tokenRes.json()) as { access_token: string };

      const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userInfoRes.ok) {
        throw new Error("Failed to get user info from Google");
      }

      const googleUser = (await userInfoRes.json()) as {
        sub: string;
        email: string;
        name?: string;
        picture?: string;
      };

      const { token, user } = await loginWithGoogle({
        googleId: googleUser.sub,
        email: googleUser.email,
        name: googleUser.name ?? "",
        avatarUrl: googleUser.picture,
      });

      res.cookie(CUSTOM_AUTH_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: ONE_YEAR_MS,
        path: "/",
      });

      // Redirect to frontend dashboard. Prefer state (origin from login page); fallback to APP_URL.
      const baseUrl = (state && state.startsWith("http") ? state : null) || process.env.APP_URL?.trim() || "";
      const base = baseUrl ? baseUrl.replace(/\/+$/, "") : "";
      const redirectTo = base ? `${base}/dashboard` : "/dashboard";
      res.redirect(redirectTo);
    } catch (error) {
      console.error("[Google Auth] Error:", error);
      res.redirect("/login?error=google_failed");
    }
  });
}
