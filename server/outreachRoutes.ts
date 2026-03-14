/**
 * POST /api/outreach/send — manual send only (admin must click Send).
 * Body: { leadId, subject, body, templateId? }
 */

import type { Express, Request, Response } from "express";
import { CUSTOM_AUTH_COOKIE } from "@shared/const";
import { sendOutreachEmail } from "./services/outreach";

function parseCookies(cookieHeader: string | undefined): Map<string, string> {
  if (!cookieHeader) return new Map();
  const map = new Map<string, string>();
  cookieHeader.split(";").forEach((part) => {
    const [key, ...rest] = part.trim().split("=");
    if (key) map.set(key.trim(), decodeURIComponent(rest.join("=").trim()));
  });
  return map;
}

function getJwtFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies.get(CUSTOM_AUTH_COOKIE) ?? null;
}

export function registerOutreachRoutes(app: Express) {
  app.post("/api/outreach/send", async (req: Request, res: Response) => {
    try {
      const jwt = getJwtFromRequest(req);
      if (!jwt) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { verifyToken, getUserById } = await import("./customAuth");
      const payload = verifyToken(jwt);
      if (!payload?.id) {
        return res.status(401).json({ error: "Invalid session" });
      }
      const user = await getUserById(payload.id);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin only" });
      }

      const { leadId, subject, body, templateId } = req.body ?? {};
      if (leadId == null || typeof subject !== "string" || typeof body !== "string") {
        return res.status(400).json({ error: "Missing leadId, subject, or body" });
      }

      const result = await sendOutreachEmail({
        leadId: Number(leadId),
        subject: String(subject).trim(),
        body: String(body).trim(),
        templateId: templateId != null ? Number(templateId) : null,
      });

      res.json({ success: true, messageId: result.messageId });
    } catch (e: any) {
      console.error("[POST /api/outreach/send]", e);
      res.status(500).json({ error: e?.message ?? "Send failed" });
    }
  });
}
