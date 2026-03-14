/**
 * Send outreach email via Microsoft Graph (manual send only).
 * Loads tokens, refreshes if expired, sends via POST https://graph.microsoft.com/v1.0/me/sendMail,
 * logs in outreachMessages, updates lead status and lastContacted.
 */

import { getDb } from "../db";
import { leads, outreachMessages } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  getStoredConnection,
  refreshMicrosoftTokens,
  storeConnection,
} from "./microsoftAuth";

const SENDER_NAME = "Teryn";
const SENDER_EMAIL = "teryn@gigxo.com";

const GRAPH_SEND_MAIL = "https://graph.microsoft.com/v1.0/me/sendMail";

async function getValidAccessToken(): Promise<{ accessToken: string; senderEmail: string }> {
  const conn = await getStoredConnection();
  if (!conn) {
    throw new Error("Microsoft inbox not connected. Connect via Admin → Outreach → Connect Microsoft Inbox.");
  }
  let accessToken = conn.accessToken;
  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // refresh 5 min before expiry
  if (new Date(conn.expiresAt).getTime() - bufferMs < now.getTime() && conn.refreshToken) {
    const refreshed = await refreshMicrosoftTokens(conn.refreshToken);
    const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
    await storeConnection({
      accessToken: refreshed.access_token,
      refreshToken: conn.refreshToken,
      expiresAt,
      connectedEmail: conn.connectedEmail,
    });
    accessToken = refreshed.access_token;
  }
  return { accessToken, senderEmail: conn.connectedEmail };
}

export type SendOutreachParams = {
  leadId: number;
  subject: string;
  body: string;
  templateId?: number | null;
};

export async function sendOutreachEmail(params: SendOutreachParams): Promise<{ messageId?: string }> {
  const { leadId, subject, body, templateId } = params;
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) throw new Error("Lead not found");

  const { accessToken, senderEmail } = await getValidAccessToken();

  const message = {
    message: {
      subject,
      body: {
        contentType: "HTML",
        content: body.replace(/\n/g, "<br>\n"),
      },
      toRecipients: [
        {
          emailAddress: {
            address: lead.email ?? "",
            name: lead.name ?? undefined,
          },
        },
      ],
    },
    saveToSentItems: true,
  };

  const res = await fetch(GRAPH_SEND_MAIL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Microsoft Graph sendMail failed: ${res.status} ${err}`);
  }

  const messageId = res.headers.get("request-id") ?? undefined;

  await db.insert(outreachMessages).values({
    leadId,
    subject,
    body,
    templateId: templateId ?? null,
    senderName: SENDER_NAME,
    senderEmail,
    provider: "microsoft",
    messageId: messageId ?? null,
    status: "sent",
  });

  await db.update(leads).set({
    status: "contacted",
    lastContacted: new Date(),
  }).where(eq(leads.id, leadId));

  return { messageId };
}
