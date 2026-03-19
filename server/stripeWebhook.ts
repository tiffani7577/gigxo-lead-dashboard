/**
 * Stripe Webhook Handler — Production-Ready
 *
 * Security model:
 *  - In production (STRIPE_WEBHOOK_SECRET set): every request MUST pass
 *    stripe.webhooks.constructEvent() signature verification. Requests that
 *    fail verification are rejected with HTTP 400.
 *  - In development / test (no secret): the raw body is parsed as JSON so
 *    local testing with the Stripe CLI still works, but a warning is logged.
 *
 * Idempotency:
 *  - Each event type checks whether the action has already been applied
 *    before writing to the database, so Stripe retries are safe.
 *
 * Registered events (configure these in the Stripe Dashboard):
 *  - payment_intent.succeeded        → fulfill lead unlock
 *  - checkout.session.completed      → fulfill subscription checkout
 *  - customer.subscription.updated   → sync subscription status
 *  - customer.subscription.deleted   → cancel subscription
 *  - invoice.payment_succeeded       → renew subscription credits
 */
import type { Express, Request, Response } from "express";
import express from "express";
import { getStripe } from "./stripe";
import { ENV } from "./_core/env";

// ─── Public registration ────────────────────────────────────────────────────

export function registerStripeWebhook(app: Express) {
  // MUST be registered BEFORE express.json() so req.body is a raw Buffer.
  // type: '*/*' — Stripe sends application/json (often with charset); strict
  // 'application/json' can skip parsing, fall through to express.json(), → 415.
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "*/*", limit: "2mb" }),
    handleStripeWebhook
  );
}

// ─── Main handler ────────────────────────────────────────────────────────────

export async function handleStripeWebhook(req: Request, res: Response) {
  const stripe = getStripe();
  if (!stripe) {
    console.error("[Webhook] Stripe not configured — rejecting request");
    return res.status(400).json({ error: "Stripe not configured" });
  }

  const sig = req.headers["stripe-signature"] as string | undefined;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || ENV.stripeWebhookSecret;

  let event: import("stripe").Stripe.Event;

  // ── Signature verification ─────────────────────────────────────────────────
  if (webhookSecret) {
    if (!sig) {
      console.error("[Webhook] Missing stripe-signature header");
      return res.status(400).json({ error: "Missing stripe-signature header" });
    }
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error("[Webhook] Signature verification failed:", err.message);
      return res.status(400).json({ error: `Webhook signature invalid: ${err.message}` });
    }
  } else {
    // Development / Stripe CLI without a signing secret — parse raw body directly
    console.warn("[Webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature verification (dev only)");
    try {
      const body = req.body instanceof Buffer ? req.body.toString("utf8") : String(req.body);
      event = JSON.parse(body);
    } catch (err: any) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
  }

  // ── Test-event short-circuit (Stripe Dashboard "Send test webhook") ────────
  if (event.id.startsWith("evt_test_")) {
    console.log("[Webhook] Test event detected — returning verification response");
    return res.json({ verified: true });
  }

  console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

  // ── Event dispatch ─────────────────────────────────────────────────────────
  try {
    switch (event.type) {
      // ── Lead unlock fulfillment ────────────────────────────────────────────
      case "payment_intent.succeeded": {
        const pi = event.data.object as import("stripe").Stripe.PaymentIntent;
        const { userId, leadId, type } = pi.metadata ?? {};

        if (type === "lead_unlock" && userId && leadId) {
          await fulfillLeadUnlock({
            userId: parseInt(userId, 10),
            leadId: parseInt(leadId, 10),
            paymentIntentId: pi.id,
            amountCents: pi.amount,
          });
        } else {
          console.log(`[Webhook] payment_intent.succeeded — no lead_unlock metadata, skipping (pi=${pi.id})`);
        }
        break;
      }

      // ── Subscription checkout fulfillment ──────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as import("stripe").Stripe.Checkout.Session;
        const userId = session.metadata?.user_id ?? session.client_reference_id;

        if (userId && session.mode === "subscription" && session.subscription) {
          await fulfillSubscription(parseInt(userId, 10), session.subscription as string);
        }
        break;
      }

      // ── Subscription status sync ───────────────────────────────────────────
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as import("stripe").Stripe.Subscription;
        await syncSubscriptionStatus(sub.id, sub.status);
        break;
      }

      // ── Subscription renewal ───────────────────────────────────────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as import("stripe").Stripe.Invoice;
        const raw = invoice as any;
        const subId = typeof raw.subscription === "string" ? raw.subscription : raw.parent?.subscription_details?.subscription ? (typeof raw.parent.subscription_details.subscription === "string" ? raw.parent.subscription_details.subscription : raw.parent.subscription_details.subscription?.id) : undefined;
        if (subId && raw.billing_reason === "subscription_cycle") {
          await handleSubscriptionRenewal(subId);
        }
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`[Webhook] Error processing ${event.type} (${event.id}):`, err);
    // Return 500 so Stripe will retry the event
    return res.status(500).json({ error: "Webhook processing failed" });
  }

  return res.json({ received: true });
}

// ─── Fulfillment helpers ─────────────────────────────────────────────────────

interface LeadUnlockParams {
  userId: number;
  leadId: number;
  paymentIntentId: string;
  amountCents: number;
}

/**
 * Idempotently record a lead unlock triggered by a Stripe payment.
 * Safe to call multiple times for the same paymentIntentId.
 */
export async function fulfillLeadUnlock({ userId, leadId, paymentIntentId, amountCents }: LeadUnlockParams) {
  const { getDb } = await import("./db");
  const db = await getDb();
  if (!db) {
    console.error("[Webhook] fulfillLeadUnlock: database unavailable");
    return;
  }

  const { leadUnlocks, transactions } = await import("../drizzle/schema");
  const { eq, and } = await import("drizzle-orm");

  // ── Idempotency check: skip if already unlocked ───────────────────────────
  const existing = await db
    .select({ id: leadUnlocks.id })
    .from(leadUnlocks)
    .where(and(eq(leadUnlocks.userId, userId), eq(leadUnlocks.leadId, leadId)))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[Webhook] Lead ${leadId} already unlocked for user ${userId} — skipping (idempotent)`);
    return;
  }

  // ── Record the unlock ─────────────────────────────────────────────────────
  await db.insert(leadUnlocks).values({ userId, leadId });

  // ── Upsert the transaction record ─────────────────────────────────────────
  // The tRPC confirmPayment procedure may have already written a "completed"
  // transaction. If so, update it; otherwise insert a new one.
  const existingTx = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.stripePaymentIntentId, paymentIntentId))
    .limit(1);

  if (existingTx.length > 0) {
    await db
      .update(transactions)
      .set({ status: "completed" })
      .where(eq(transactions.stripePaymentIntentId, paymentIntentId));
  } else {
    await db.insert(transactions).values({
      userId,
      leadId,
      amount: amountCents,
      transactionType: "lead_unlock",
      stripePaymentIntentId: paymentIntentId,
      status: "completed",
    });
  }

  console.log(`[Webhook] ✓ Lead ${leadId} unlocked for user ${userId} (pi=${paymentIntentId})`);
}

/**
 * Activate or create a premium subscription for a user.
 * Fetches period from Stripe so ensureProMonthlyCredits can grant 5 credits.
 */
async function fulfillSubscription(userId: number, stripeSubscriptionId: string) {
  const { getDb } = await import("./db");
  const db = await getDb();
  if (!db) return;

  const stripe = getStripe();
  let currentPeriodStart: Date | null = null;
  let currentPeriodEnd: Date | null = null;
  if (stripe) {
    try {
      const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      currentPeriodStart = new Date((sub as any).current_period_start * 1000);
      currentPeriodEnd = new Date((sub as any).current_period_end * 1000);
    } catch (e) {
      console.warn("[Webhook] Could not retrieve subscription period from Stripe:", (e as Error).message);
    }
  }

  const { subscriptions } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  const existing = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  const periodPayload = {
    stripeSubscriptionId,
    status: "active" as const,
    tier: "premium" as const,
    ...(currentPeriodStart && { currentPeriodStart }),
    ...(currentPeriodEnd && { currentPeriodEnd }),
  };

  if (existing.length > 0) {
    await db
      .update(subscriptions)
      .set(periodPayload)
      .where(eq(subscriptions.userId, userId));
  } else {
    await db.insert(subscriptions).values({
      userId,
      ...periodPayload,
    });
  }

  console.log(`[Webhook] ✓ Premium subscription activated for user ${userId}`);
}

/**
 * Sync subscription status from Stripe to the local database.
 */
async function syncSubscriptionStatus(stripeSubscriptionId: string, status: string) {
  const { getDb } = await import("./db");
  const db = await getDb();
  if (!db) return;

  const { subscriptions } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  const mappedStatus: "active" | "canceled" | "past_due" =
    status === "active" ? "active" : status === "past_due" ? "past_due" : "canceled";

  await db
    .update(subscriptions)
    .set({ status: mappedStatus })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));

  console.log(`[Webhook] ✓ Subscription ${stripeSubscriptionId} → ${mappedStatus}`);
}

/**
 * Handle a subscription renewal cycle — update period from Stripe so next ensureProMonthlyCredits grants 5 new credits.
 */
async function handleSubscriptionRenewal(stripeSubscriptionId: string) {
  const { getDb } = await import("./db");
  const db = await getDb();
  if (!db) return;

  const stripe = getStripe();
  let currentPeriodStart: Date | null = null;
  let currentPeriodEnd: Date | null = null;
  if (stripe) {
    try {
      const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      currentPeriodStart = new Date((sub as any).current_period_start * 1000);
      currentPeriodEnd = new Date((sub as any).current_period_end * 1000);
    } catch (e) {
      console.warn("[Webhook] Could not retrieve subscription period on renewal:", (e as Error).message);
    }
  }

  const { subscriptions } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  const updatePayload: Record<string, unknown> = { status: "active" };
  if (currentPeriodStart) updatePayload.currentPeriodStart = currentPeriodStart;
  if (currentPeriodEnd) updatePayload.currentPeriodEnd = currentPeriodEnd;

  await db
    .update(subscriptions)
    .set(updatePayload as any)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));

  console.log(`[Webhook] ✓ Subscription ${stripeSubscriptionId} renewed`);
}
