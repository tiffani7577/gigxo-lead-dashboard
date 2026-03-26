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

/** CAN-SPAM: valid postal address + clear opt-out on every Graph outreach message. */
const CAN_SPAM_FOOTER_HTML = `
<br/><br/>
<hr style="border:none;border-top:1px solid #ddd;margin:1.25em 0;max-width:36em;"/>
<p style="font-size:11px;color:#555;line-height:1.6;margin:0;">
Gigxo | Fort Lauderdale, FL 33316<br/>
To unsubscribe from Gigxo outreach, reply with UNSUBSCRIBE
</p>`;

function bodyWithCanSpamFooter(htmlContent: string): string {
  return `${htmlContent}${CAN_SPAM_FOOTER_HTML}`;
}

/** POST /me/sendMail; logs HTTP status, recipient, response body, and success/failure. */
export async function sendMailViaGraph(options: {
  recipientEmail: string;
  recipientName?: string | null;
  subject: string;
  htmlContent: string;
}): Promise<{ messageId?: string; senderEmail: string }> {
  const { accessToken, senderEmail } = await getValidAccessToken();
  const recipient = options.recipientEmail.trim();
  const message = {
    message: {
      subject: options.subject,
      body: {
        contentType: "HTML",
        content: bodyWithCanSpamFooter(options.htmlContent),
      },
      toRecipients: [
        {
          emailAddress: {
            address: recipient,
            name: options.recipientName ?? undefined,
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

  const httpStatus = res.status;
  const responseText = await res.text();
  const success = res.ok;
  const messageId = res.headers.get("request-id") ?? undefined;
  const responsePreview = responseText.length > 4000 ? `${responseText.slice(0, 4000)}…` : responseText;

  const logLine = {
    success,
    httpStatus,
    recipient,
    senderEmail,
    messageId,
    responseBody: success && !responsePreview ? "(empty)" : responsePreview || "(empty)",
  };

  if (!success) {
    console.error("[Microsoft Graph sendMail] FAILED", logLine);
    throw new Error(`Microsoft Graph sendMail failed: ${httpStatus} ${responseText}`);
  }

  console.log("[Microsoft Graph sendMail] OK", logLine);
  return { messageId, senderEmail };
}

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

  const recipientEmail = (lead.email ?? "").trim();
  const { messageId, senderEmail } = await sendMailViaGraph({
    recipientEmail,
    recipientName: lead.name,
    subject,
    htmlContent: body.replace(/\n/g, "<br>\n"),
  });

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

/** Self-addressed test message to verify Microsoft Graph sendMail (admin diagnostic). */
export async function sendMicrosoftTestEmail(): Promise<{ messageId?: string }> {
  const { messageId } = await sendMailViaGraph({
    recipientEmail: SENDER_EMAIL,
    subject: "Gigxo: Microsoft Graph send test",
    htmlContent:
      "<p>This is a self-test from the Gigxo admin <code>testMicrosoftEmail</code> endpoint.</p>",
  });
  return { messageId };
}
