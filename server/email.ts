/**
 * Email Service using Resend
 * Handles welcome emails, daily digests, referral reminders, and re-engagement
 */
import { Resend } from "resend";
import { ENV } from "./_core/env";

let resendInstance: Resend | null = null;

function getResend(): Resend | null {
  if (!ENV.resendApiKey) {
    return null;
  }
  if (!resendInstance) {
    resendInstance = new Resend(ENV.resendApiKey);
  }
  return resendInstance;
}

const FROM_EMAIL = "Gigxo <teryn@gigxo.com>";
const REPLY_TO = "teryn@gigxo.com";

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const resend = getResend();

  if (!resend) {
    // Demo mode - log to console
    console.log(`[Email Demo] To: ${to}`);
    console.log(`[Email Demo] Subject: ${subject}`);
    console.log(`[Email Demo] Body preview: ${html.slice(0, 200)}...`);
    return true;
  }

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      replyTo: REPLY_TO,
    });
    console.log(`[Email] Sent to ${to}: ${subject}`, result);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send to ${to}:`, error);
    return false;
  }
}

/**
 * Send admin outreach email (venue/lead one-click or bulk). Uses same Resend infra.
 * Returns { success, error? } for logging to outreachLog.
 */
export async function sendOutreachEmail(
  to: string,
  subject: string,
  bodyPlain: string,
  fromEmail: string = FROM_EMAIL
): Promise<{ success: boolean; error?: string }> {
  const html = `<!DOCTYPE html><html><body style="font-family: sans-serif; white-space: pre-wrap;">${bodyPlain.replace(/\n/g, "<br>")}</body></html>`;
  const resend = getResend();

  if (!resend) {
    console.log(`[Outreach Demo] From: ${fromEmail}, To: ${to}, Subject: ${subject}`);
    return { success: true };
  }

  try {
    await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html,
      replyTo: REPLY_TO,
    });
    return { success: true };
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error(`[Outreach] Failed to ${to}:`, msg);
    return { success: false, error: msg };
  }
}

/**
 * Welcome email sent when an artist signs up
 */
export async function sendWelcomeEmail(
  email: string,
  name: string,
  referralCode: string
): Promise<boolean> {
  const subject = "Welcome to Gigxo — Your first gig leads are waiting 🎵";
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
  <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="color: #7c3aed; font-size: 28px; margin: 0;">Gigxo</h1>
      <p style="color: #6b7280; margin: 4px 0 0;">Miami & Fort Lauderdale Gig Leads</p>
    </div>
    
    <h2 style="color: #1f2937; font-size: 22px;">Hey ${name || "there"} 👋</h2>
    
    <p style="color: #374151; line-height: 1.6;">
      Welcome to Gigxo — the performer lead marketplace powered by better intelligence. You now have access to curated gig leads for Miami and Fort Lauderdale, updated daily from Eventbrite, Thumbtack, local event groups, and our network.
    </p>
    
    <div style="background: #f3f0ff; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <h3 style="color: #7c3aed; margin: 0 0 12px;">How it works:</h3>
      <ol style="color: #374151; line-height: 1.8; margin: 0; padding-left: 20px;">
        <li>Browse gig leads (title, budget, location visible for free)</li>
        <li>Discovery leads start at <strong>$3</strong> (starter tier)</li>
        <li>Standard leads are <strong>$7</strong> and premium leads <strong>$15</strong> — or go <strong>Pro for $49/mo</strong> and get 5 unlock credits included</li>
        <li>Reach out directly and book the gig (no commission)</li>
      </ol>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="https://gigxo.com/dashboard" style="background: #7c3aed; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
        Browse Gig Leads →
      </a>
    </div>
    
    <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px;">
      <h3 style="color: #1f2937; font-size: 16px;">Earn free leads with referrals 🎁</h3>
      <p style="color: #374151; line-height: 1.6;">
        Share your referral link with other Miami/Fort Lauderdale artists. When they sign up and unlock their first lead, 
        you get a <strong>$7 credit</strong> — that's one free lead unlock!
      </p>
      <p style="color: #6b7280; font-size: 14px;">Your referral link: <a href="https://gigxo.com/signup?ref=${referralCode}" style="color: #7c3aed;">gigxo.com/signup?ref=${referralCode}</a></p>
    </div>
    
    <p style="color: #9ca3af; font-size: 12px; margin-top: 32px; text-align: center;">
      Gigxo · Miami, FL · <a href="https://gigxo.com/unsubscribe" style="color: #9ca3af;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>
  `;
  
  return sendEmail(email, subject, html);
}

/**
 * Daily digest email with new gig leads
 */
export async function sendDailyDigest(
  email: string,
  name: string,
  leads: Array<{
    id: number;
    title: string;
    location: string;
    budget: number | null;
    eventType: string | null;
    eventDate: Date | null;
  }>
): Promise<boolean> {
  if (leads.length === 0) return true; // Don't send empty digests
  
  const subject = `🎵 ${leads.length} new gig${leads.length > 1 ? 's' : ''} in Miami/Fort Lauderdale today`;
  
  const leadCards = leads.map(lead => `
    <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 12px 0;">
      <h3 style="color: #1f2937; margin: 0 0 8px; font-size: 16px;">${lead.title}</h3>
      <div style="display: flex; gap: 16px; flex-wrap: wrap;">
        ${lead.budget ? `<span style="color: #059669; font-weight: 600;">$${(lead.budget / 100).toLocaleString()}</span>` : ''}
        <span style="color: #6b7280;">📍 ${lead.location}</span>
        ${lead.eventType ? `<span style="color: #6b7280;">🎪 ${lead.eventType}</span>` : ''}
        ${lead.eventDate ? `<span style="color: #6b7280;">📅 ${new Date(lead.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>` : ''}
      </div>
      <a href="https://gigxo.com/dashboard?lead=${lead.id}" style="display: inline-block; margin-top: 12px; background: #7c3aed; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
        Unlock from $3 →
      </a>
    </div>
  `).join('');
  
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
  <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #7c3aed; font-size: 24px; margin: 0;">Gigxo Daily Digest</h1>
      <p style="color: #6b7280; margin: 4px 0 0;">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
    </div>
    
    <p style="color: #374151; line-height: 1.6;">
      Hey ${name || "there"}, here are today's fresh gig leads for Miami and Fort Lauderdale:
    </p>
    
    ${leadCards}
    
    <div style="text-align: center; margin: 24px 0;">
      <a href="https://gigxo.com/dashboard" style="background: #7c3aed; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        View All Leads →
      </a>
    </div>
    
    <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; text-align: center;">
      Gigxo · Miami, FL · <a href="https://gigxo.com/unsubscribe" style="color: #9ca3af;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>
  `;
  
  return sendEmail(email, subject, html);
}

const ADMIN_EMAIL = "teryn@gigxo.com";

/**
 * Notify admin when a new inbound lead is submitted (SEO form).
 * Subject: "New inbound lead: {title}", body: name, email, phone, event type, event date, location, budget.
 */
export async function sendInboundLeadNotification(lead: {
  title: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  eventType: string;
  eventDate: string;
  location: string;
  budget: number | null;
  description?: string | null;
}): Promise<boolean> {
  const subject = `New inbound lead: ${lead.title}`;
  const budgetDisplay = lead.budget != null ? `$${(lead.budget / 100).toLocaleString()}` : "Not specified";
  const body = [
    `Name: ${lead.contactName}`,
    `Email: ${lead.contactEmail}`,
    `Phone: ${lead.contactPhone ?? "Not provided"}`,
    `Event type: ${lead.eventType}`,
    `Event date: ${lead.eventDate}`,
    `Location: ${lead.location}`,
    `Client's stated budget: ${budgetDisplay}`,
    lead.description ? `\nDescription:\n${lead.description}` : "",
  ].filter(Boolean).join("\n");
  const html = `<!DOCTYPE html><html><body style="font-family: sans-serif; white-space: pre-wrap;">${body.replace(/\n/g, "<br>")}</body></html>`;
  return sendEmail(ADMIN_EMAIL, subject, html);
}

/**
 * Lead unlock confirmation email with contact details
 */
export async function sendLeadUnlockConfirmation(
  email: string,
  name: string,
  lead: {
    title: string;
    location: string;
    eventType: string | null;
    eventDate: Date | null;
    budget: number | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    description: string | null;
  }
): Promise<boolean> {
  const subject = `✅ Lead Unlocked: ${lead.title}`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
  <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="background: #d1fae5; border-radius: 50%; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;">
        <span style="font-size: 32px;">✅</span>
      </div>
      <h1 style="color: #1f2937; font-size: 22px; margin: 0;">Lead Unlocked!</h1>
    </div>
    
    <div style="background: #f3f0ff; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <h2 style="color: #7c3aed; margin: 0 0 12px; font-size: 18px;">${lead.title}</h2>
      <div style="color: #374151; line-height: 1.8;">
        ${lead.budget ? `<div>💰 Budget: <strong>$${(lead.budget / 100).toLocaleString()}</strong></div>` : ''}
        <div>📍 Location: ${lead.location}</div>
        ${lead.eventType ? `<div>🎪 Event Type: ${lead.eventType}</div>` : ''}
        ${lead.eventDate ? `<div>📅 Date: ${new Date(lead.eventDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>` : ''}
      </div>
    </div>
    
    <div style="background: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <h3 style="color: #065f46; margin: 0 0 12px; font-size: 16px;">Contact Information</h3>
      <div style="color: #374151; line-height: 1.8;">
        ${lead.contactName ? `<div>👤 Name: <strong>${lead.contactName}</strong></div>` : ''}
        ${lead.contactEmail ? `<div>📧 Email: <a href="mailto:${lead.contactEmail}" style="color: #7c3aed;">${lead.contactEmail}</a></div>` : ''}
        ${lead.contactPhone ? `<div>📱 Phone: <a href="tel:${lead.contactPhone}" style="color: #7c3aed;">${lead.contactPhone}</a></div>` : ''}
      </div>
    </div>
    
    ${lead.description ? `
    <div style="margin-bottom: 24px;">
      <h3 style="color: #1f2937; font-size: 16px;">Gig Details</h3>
      <p style="color: #374151; line-height: 1.6;">${lead.description}</p>
    </div>
    ` : ''}
    
    <div style="background: #fffbeb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <h3 style="color: #92400e; margin: 0 0 8px; font-size: 14px;">💡 Pro Tips for Booking</h3>
      <ul style="color: #374151; line-height: 1.8; margin: 0; padding-left: 20px; font-size: 14px;">
        <li>Reach out within 24 hours — first responders win more gigs</li>
        <li>Mention your experience with similar events in your first message</li>
        <li>Include a link to your best performance video or mix</li>
        <li>Be specific about your setup and what you bring to the table</li>
      </ul>
    </div>
    
    <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; text-align: center;">
      Gigxo · Miami, FL · <a href="https://gigxo.com/dashboard" style="color: #9ca3af;">View Dashboard</a>
    </p>
  </div>
</body>
</html>
  `;
  
  return sendEmail(email, subject, html);
}

/**
 * Referral credit notification
 */
export async function sendReferralCreditEmail(
  email: string,
  name: string,
  referredName: string,
  creditAmount: number
): Promise<boolean> {
  const subject = `🎁 You earned a $${creditAmount} credit — ${referredName} just joined Gigxo!`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
  <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color: #1f2937;">Hey ${name || "there"} 🎉</h2>
    <p style="color: #374151; line-height: 1.6;">
      <strong>${referredName}</strong> just signed up for Gigxo using your referral link and unlocked their first lead!
    </p>
    <div style="background: #d1fae5; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
      <p style="color: #065f46; font-size: 24px; font-weight: 700; margin: 0;">+$${creditAmount} Credit Added</p>
      <p style="color: #374151; margin: 8px 0 0;">Use it to unlock your next gig lead for free!</p>
    </div>
    <div style="text-align: center;">
      <a href="https://gigxo.com/dashboard" style="background: #7c3aed; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        Use My Credit →
      </a>
    </div>
  </div>
</body>
</html>
  `;
  
  return sendEmail(email, subject, html);
}

/**
 * Re-engagement email for inactive users (7+ days since last login)
 */
export async function sendReEngagementEmail(
  email: string,
  name: string,
  newLeadCount: number
): Promise<boolean> {
  const subject = `${newLeadCount} new gig leads in Miami/Fort Lauderdale — don't miss out`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
  <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color: #1f2937;">Hey ${name || "there"}, we miss you 👋</h2>
    <p style="color: #374151; line-height: 1.6;">
      It's been a while since you checked Gigxo. While you were away, 
      <strong>${newLeadCount} new gig leads</strong> were added for Miami and Fort Lauderdale artists.
    </p>
    <p style="color: #374151; line-height: 1.6;">
      These leads include weddings, corporate events, nightclub gigs, and private parties — 
      all with budgets ranging from $250 to $5,000+.
    </p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="https://gigxo.com/dashboard" style="background: #7c3aed; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
        See New Leads →
      </a>
    </div>
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
      <a href="https://gigxo.com/unsubscribe" style="color: #9ca3af;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>
  `;
  
  return sendEmail(email, subject, html);
}

/**
 * Password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetToken: string,
  origin: string = "https://gigxo.com"
): Promise<boolean> {
  const resetUrl = `${origin}/reset-password?token=${resetToken}`;
  const subject = "Reset your Gigxo password";
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
  <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="width: 48px; height: 48px; background: #7c3aed; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">
        <span style="color: white; font-size: 24px;">🔑</span>
      </div>
    </div>
    <h2 style="color: #1f2937; text-align: center;">Reset your password</h2>
    <p style="color: #374151; line-height: 1.6;">
      Hey ${name || "there"}, we received a request to reset your Gigxo password. 
      Click the button below to choose a new password.
    </p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${resetUrl}" style="background: #7c3aed; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
        Reset Password →
      </a>
    </div>
    <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
      This link expires in 2 hours. If you didn't request a password reset, you can safely ignore this email.
    </p>
    <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">
      Or copy this link: <a href="${resetUrl}" style="color: #7c3aed;">${resetUrl}</a>
    </p>
  </div>
</body>
</html>
  `;

  return sendEmail(email, subject, html);
}

/**
 * Email verification email sent on signup
 */
export async function sendVerificationEmail(
  email: string,
  name: string,
  verificationToken: string,
  origin: string = "https://gigxo.com"
): Promise<boolean> {
  const verifyUrl = `${origin}/verify-email?token=${verificationToken}`;
  const subject = "Verify your Gigxo email address";
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
  <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="width: 64px; height: 64px; background: #7c3aed; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
        <span style="color: white; font-size: 32px;">🎵</span>
      </div>
      <h1 style="color: #7c3aed; font-size: 24px; margin: 0;">Gigxo</h1>
    </div>

    <h2 style="color: #1f2937; text-align: center; font-size: 20px;">Verify your email, ${name || "there"} 👋</h2>

    <p style="color: #374151; line-height: 1.6; text-align: center;">
      You're almost in! Click the button below to verify your email and start browsing gig leads.
    </p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${verifyUrl}" style="background: #7c3aed; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
        Verify Email →
      </a>
    </div>

    <p style="color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">
      This link expires in 24 hours. If you didn't create a Gigxo account, you can safely ignore this email.
    </p>

    <p style="color: #9ca3af; font-size: 12px; margin-top: 16px; text-align: center;">
      Or copy this link: <a href="${verifyUrl}" style="color: #7c3aed;">${verifyUrl}</a>
    </p>

    <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; text-align: center;">
      Gigxo · Miami, FL
    </p>
  </div>
</body>
</html>
  `;

  return sendEmail(email, subject, html);
}

/**
 * Booking inquiry notification sent to artist
 */
export async function sendBookingInquiryEmail(
  artistEmail: string,
  artistName: string,
  inquirerName: string,
  inquirerEmail: string,
  eventType: string,
  eventDate: string,
  message: string
): Promise<boolean> {
  const subject = `New Booking Inquiry from ${inquirerName} — Gigxo`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
  <div style="background: white; border-radius: 12px; padding: 32px;">
    <h1 style="color: #7c3aed;">Gigxo — New Booking Inquiry</h1>
    <p>Hi ${artistName}, someone wants to book you!</p>
    <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding:8px; background:#f3f4f6; font-weight:bold;">From</td><td style="padding:8px;">${inquirerName} (${inquirerEmail})</td></tr>
      <tr><td style="padding:8px; background:#f3f4f6; font-weight:bold;">Event Type</td><td style="padding:8px;">${eventType}</td></tr>
      <tr><td style="padding:8px; background:#f3f4f6; font-weight:bold;">Event Date</td><td style="padding:8px;">${eventDate}</td></tr>
      <tr><td style="padding:8px; background:#f3f4f6; font-weight:bold;">Message</td><td style="padding:8px;">${message || 'No message provided.'}</td></tr>
    </table>
    <p><a href="mailto:${inquirerEmail}" style="background:#7c3aed; color:white; padding:10px 24px; border-radius:6px; text-decoration:none;">Reply to ${inquirerName}</a></p>
    <p style="color:#9ca3af; font-size:12px;">Gigxo · Miami, FL</p>
  </div>
</body>
</html>
  `;
  return sendEmail(artistEmail, subject, html);
}



export async function sendLeadMatchEmail(
  artistEmail: string,
  artistName: string,
  lead: {
    id: number;
    title: string;
    location: string;
    eventType: string | null;
    eventDate: Date | null;
    budget: number | null;
    description: string | null;
    unlockPriceCents?: number | null;
  },
  matchScore: number,
  origin: string = "https://gigxo.com"
): Promise<boolean> {
  const budgetDisplay = lead.budget
    ? `Client budget: $${(lead.budget / 100).toLocaleString()}`
    : null;
  const unlockPriceCents = lead.unlockPriceCents ?? 700;
  const unlockPriceLabel = `$${Math.round(unlockPriceCents / 100)}`;
  const dateDisplay = lead.eventDate
    ? new Date(lead.eventDate).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      })
    : "Date flexible";
  const scoreLabel =
    matchScore >= 90 ? "Perfect Match" : matchScore >= 75 ? "Strong Match" : "Good Match";
  const scoreColor =
    matchScore >= 90 ? "#059669" : matchScore >= 75 ? "#7c3aed" : "#d97706";
  const raw = lead.description ?? "Details available after unlock.";
  const descPreview =
    raw.slice(0, 25) +
    raw.slice(25, 80).replace(/[a-zA-Z0-9]/g, "\u2588") +
    "...";
  const unlockUrl = `${origin}/dashboard?lead=${lead.id}`;
  const subject = `${scoreLabel}: "${lead.title}" - Unlock for ${unlockPriceLabel}`;
  const html = [
    "<!DOCTYPE html><html><head><meta charset='utf-8'></head>",
    "<body style='font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8f9fa;'>",
    "<div style='background:white;border-radius:12px;padding:32px;'>",
    "<h1 style='color:#7c3aed;text-align:center;'>Gigxo</h1>",
    `<div style='background:#f3f0ff;border-radius:10px;padding:20px;border-left:4px solid ${scoreColor};margin:20px 0;'>`,
    `<span style='background:${scoreColor};color:white;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;'>${scoreLabel}</span>`,
    `<h2 style='color:#1f2937;margin:12px 0 8px;'>${lead.title}</h2>`,
    "<div style='color:#374151;font-size:14px;line-height:1.8;'>",
    `<div>Location: ${lead.location}</div>`,
    ...(budgetDisplay ? [`<div style='color:#059669;font-weight:700;font-size:16px;'>${budgetDisplay}</div>`] : []),
    `<div>${dateDisplay}</div>`,
    "</div></div>",
    "<div style='background:#f9fafb;border:1px dashed #d1d5db;border-radius:8px;padding:16px;margin:16px 0;'>",
    `<p style='color:#374151;font-size:14px;margin:0;'>${descPreview}</p>`,
    "</div>",
    "<div style='text-align:center;margin:28px 0;'>",
    `<a href='${unlockUrl}' style='background:#7c3aed;color:white;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block;'>Unlock This Lead for ${unlockPriceLabel}</a>`,
    "</div>",
    `<p style='color:#4b5563;font-size:13px;text-align:center;margin:0 0 10px;'>This is a lead - unlock to get client contact info.</p>`,
    `<p style='color:#9ca3af;font-size:12px;text-align:center;'>Gigxo Miami - <a href='${origin}/dashboard' style='color:#9ca3af;'>View All Leads</a></p>`,
    "</div></body></html>",
  ].join("\n");
  return sendEmail(artistEmail, subject, html);
}

/**
 * Day 3 drip: "You haven't unlocked yet — here's a free preview"
 */
export async function sendDay3DripEmail(
  email: string,
  name: string,
  sampleLeadTitle: string,
  sampleBudget: number | null,
  sampleLocation: string,
  origin: string = "https://gigxo.com"
): Promise<boolean> {
  const budgetDisplay = sampleBudget ? `$${(sampleBudget / 100).toLocaleString()}` : "$500+";
  const subject = `${name ? name.split(" ")[0] : "Hey"}, this gig is still available 👀`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
  <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <h1 style="color: #7c3aed; text-align: center; font-size: 24px; margin: 0 0 24px;">Gigxo</h1>
    <h2 style="color: #1f2937; font-size: 20px;">Hey ${name ? name.split(" ")[0] : "there"} 👋</h2>
    <p style="color: #374151; line-height: 1.6;">
      You signed up 3 days ago but haven't unlocked a lead yet. Here's one that might be a fit:
    </p>
    <div style="background: #f3f0ff; border-radius: 10px; padding: 20px; margin: 20px 0; border-left: 4px solid #7c3aed;">
      <h3 style="color: #1f2937; margin: 0 0 10px;">${sampleLeadTitle}</h3>
      <div style="color: #374151; font-size: 14px; line-height: 1.8;">
        <div>📍 ${sampleLocation}</div>
        ${budgetDisplay ? `<div style="color: #059669; font-weight: 700; font-size: 16px;">💰 ${budgetDisplay}</div>` : ""}
        <div style="color: #6b7280; margin-top: 8px;">Contact info hidden — unlock for $7 to see name, email & phone</div>
      </div>
    </div>
    <p style="color: #374151; line-height: 1.6;">
      One booking from a $${(sampleBudget ?? 50000) / 100} gig pays for <strong>71 lead unlocks</strong>. 
      The math works — most artists book their first gig within 3–5 unlocks.
    </p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${origin}/dashboard" style="background: #7c3aed; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block;">
        Unlock This Lead for $7 →
      </a>
    </div>
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
      Gigxo · Miami, FL · <a href="${origin}/unsubscribe" style="color: #9ca3af;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>
  `;
  return sendEmail(email, subject, html);
}

/**
 * Day 7 drip: "Your referral link = free leads forever"
 */
export async function sendDay7DripEmail(
  email: string,
  name: string,
  referralCode: string,
  origin: string = "https://gigxo.com"
): Promise<boolean> {
  const referralLink = `${origin}/signup?ref=${referralCode}`;
  const subject = `One share = free leads forever (your referral link inside)`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
  <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <h1 style="color: #7c3aed; text-align: center; font-size: 24px; margin: 0 0 24px;">Gigxo</h1>
    <h2 style="color: #1f2937; font-size: 20px;">Hey ${name ? name.split(" ")[0] : "there"} 🎁</h2>
    <p style="color: #374151; line-height: 1.6;">
      Quick tip: every artist you refer to Gigxo earns you a <strong>$7 credit</strong> — that's one free lead unlock per referral.
    </p>
    <div style="background: #d1fae5; border-radius: 10px; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="color: #065f46; font-size: 18px; font-weight: 700; margin: 0 0 8px;">Refer 5 artists → 5 free unlocks</p>
      <p style="color: #374151; margin: 0; font-size: 14px;">Share your link in DJ groups, with your DJ friends, or on your IG story</p>
    </div>
    <div style="background: #f3f0ff; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 8px;">Your referral link:</p>
      <a href="${referralLink}" style="color: #7c3aed; font-weight: 600; word-break: break-all;">${referralLink}</a>
    </div>
    <div style="background: #fffbeb; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="color: #92400e; font-weight: 600; margin: 0 0 8px;">📋 Copy & paste for DJ Facebook groups:</p>
      <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0; font-style: italic;">
        "Anyone else using Gigxo for gig leads? They have wedding, corporate, and club gigs in Miami/Fort Lauderdale — $7 to unlock the contact info. Way cheaper than GigSalad commission. Use my link for 50% off your first unlock: ${referralLink}"
      </p>
    </div>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${origin}/dashboard" style="background: #7c3aed; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block;">
        Go to My Dashboard →
      </a>
    </div>
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
      Gigxo · Miami, FL · <a href="${origin}/unsubscribe" style="color: #9ca3af;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>
  `;
  return sendEmail(email, subject, html);
}

/**
 * New lead alert: sent when a lead matching the artist's type/city is approved
 */
export async function sendNewLeadAlertEmail(
  email: string,
  name: string,
  leadCount: number,
  topLead: { title: string; budget: number | null; location: string; eventType: string | null },
  origin: string = "https://gigxo.com"
): Promise<boolean> {
  const budgetDisplay = topLead.budget ? `Client budget: $${(topLead.budget / 100).toLocaleString()}` : null;
  const subject = `🔔 ${leadCount} new gig${leadCount > 1 ? "s" : ""} match your profile — act fast`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
  <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <h1 style="color: #7c3aed; text-align: center; font-size: 24px; margin: 0 0 24px;">Gigxo</h1>
    <h2 style="color: #1f2937; font-size: 20px;">New leads just dropped, ${name ? name.split(" ")[0] : "there"} 🔔</h2>
    <p style="color: #374151; line-height: 1.6;">
      <strong>${leadCount} new gig lead${leadCount > 1 ? "s" : ""}</strong> matching your profile just became available. 
      First to reach out wins the gig.
    </p>
    <div style="background: #f3f0ff; border-radius: 10px; padding: 20px; margin: 20px 0; border-left: 4px solid #7c3aed;">
      <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 600; margin: 0 0 8px;">Top Match</p>
      <h3 style="color: #1f2937; margin: 0 0 10px;">${topLead.title}</h3>
      <div style="color: #374151; font-size: 14px; line-height: 1.8;">
        <div>📍 ${topLead.location}</div>
        ${topLead.eventType ? `<div>🎪 ${topLead.eventType}</div>` : ""}
        ${budgetDisplay ? `<div style="color: #059669; font-weight: 700; font-size: 16px;">💰 ${budgetDisplay}</div>` : ""}
      </div>
    </div>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${origin}/dashboard" style="background: #7c3aed; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block;">
        View All ${leadCount} Leads →
      </a>
    </div>
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
      Gigxo · Miami, FL · <a href="${origin}/unsubscribe" style="color: #9ca3af;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>
  `;
  return sendEmail(email, subject, html);
}
