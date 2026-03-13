/**
 * Google OAuth 2.0 handler
 * Registers /api/auth/google and /api/auth/google/callback routes.
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *
 * If those are not set, the routes return a 501 "not configured" response
 * so the rest of the app still works.
 */

import type { Express, Request, Response } from "express";
import { loginWithGoogle, generateToken } from "./customAuth";
import { CUSTOM_AUTH_COOKIE, ONE_YEAR_MS } from "@shared/const";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return { clientId, clientSecret, configured: !!(clientId && clientSecret) };
}

export function registerGoogleAuthRoutes(app: Express) {
  // Step 1: Redirect to Google
  app.get("/api/auth/google", (req: Request, res: Response) => {
    const { clientId, configured } = getGoogleConfig();
    if (!configured) {
      return res.status(501).json({ error: "Google OAuth not configured" });
    }

    const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
    const state = (req.query.origin as string) || req.headers.referer || "";

    const params = new URLSearchParams({
      client_id: clientId!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "offline",
      prompt: "select_account",
    });

    res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  });

  // Step 2: Handle Google callback
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const { clientId, clientSecret, configured } = getGoogleConfig();
    if (!configured) {
      return res.status(501).json({ error: "Google OAuth not configured" });
    }

    const code = req.query.code as string;
    const state = (req.query.state as string) || "";

    if (!code) {
      return res.redirect(`/login?error=google_cancelled`);
    }

    try {
      const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/google/callback`;

      // Exchange code for tokens
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId!,
          client_secret: clientSecret!,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        throw new Error("Failed to exchange code for token");
      }

      const tokenData = await tokenRes.json() as { access_token: string };

      // Get user info from Google
      const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userInfoRes.ok) {
        throw new Error("Failed to get user info from Google");
      }

      const googleUser = await userInfoRes.json() as {
        sub: string;
        email: string;
        name: string;
        picture?: string;
      };

      // Create or link user account
      const { token } = await loginWithGoogle({
        googleId: googleUser.sub,
        email: googleUser.email,
        name: googleUser.name,
        avatarUrl: googleUser.picture,
      });

      // Set session cookie
      res.cookie(CUSTOM_AUTH_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: ONE_YEAR_MS,
        path: "/",
      });

      // Redirect back to dashboard (or origin)
      const origin = state && state.startsWith("http") ? state : "";
      res.redirect(`${origin}/dashboard`);
    } catch (error) {
      console.error("[Google Auth] Error:", error);
      res.redirect(`/login?error=google_failed`);
    }
  });
}
