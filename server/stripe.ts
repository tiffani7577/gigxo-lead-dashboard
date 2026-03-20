/**
 * Stripe Payment Service
 * Handles $7 lead unlock payments
 */
import Stripe from "stripe";
import { ENV } from "./_core/env";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = ENV.stripeSecretKey?.trim();
  if (!key) {
    console.warn("[Stripe] No secret key configured - running in demo mode");
    return null;
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(key, {
      apiVersion: "2026-02-25.clover",
    });
  }
  return stripeInstance;
}

export const LEAD_UNLOCK_PRICE_CENTS = 700; // $7.00

/** Server log for Checkout Session failures — full Stripe metadata for support/debug. */
export function logStripeCheckoutSessionError(context: string, err: unknown): void {
  if (err instanceof Stripe.errors.StripeError) {
    console.error(`[${context}] Stripe API error`, {
      type: err.type,
      code: err.code,
      decline_code: err.decline_code,
      statusCode: err.statusCode,
      message: err.message,
      requestId: err.requestId,
    });
    return;
  }
  if (err instanceof Error) {
    console.error(`[${context}] Error`, { name: err.name, message: err.message, stack: err.stack });
    return;
  }
  console.error(`[${context}] Unknown error`, err);
}

/** Safe message for tRPC after logging the full error. */
export function checkoutErrorUserMessage(err: unknown, fallback: string): string {
  if (err instanceof Stripe.errors.StripeError && err.message?.trim()) {
    return err.message.trim();
  }
  if (err instanceof Error && err.message?.trim()) {
    return err.message.trim();
  }
  return fallback;
}

/**
 * Create a Stripe PaymentIntent for unlocking a lead
 */
export async function createLeadUnlockPaymentIntent(
  userId: number,
  leadId: number,
  leadTitle: string,
  priceCents?: number
): Promise<{ clientSecret: string; paymentIntentId: string } | { demoMode: true; clientSecret: string; paymentIntentId: string }> {
  const stripe = getStripe();
  const amount = priceCents ?? LEAD_UNLOCK_PRICE_CENTS;
  
  if (!stripe) {
    // Demo mode - return a fake client secret
    const fakeId = `pi_demo_${userId}_${leadId}_${Date.now()}`;
    return {
      demoMode: true,
      clientSecret: `${fakeId}_secret_demo`,
      paymentIntentId: fakeId,
    };
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: "usd",
    metadata: {
      userId: userId.toString(),
      leadId: leadId.toString(),
      leadTitle: leadTitle.slice(0, 100),
      type: "lead_unlock",
    },
    description: `Gigxo Lead Unlock: ${leadTitle.slice(0, 100)}`,
  });

  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
  };
}

/**
 * Verify a payment intent was successful
 */
export async function verifyPaymentIntent(paymentIntentId: string): Promise<boolean> {
  const stripe = getStripe();
  
  if (!stripe) {
    // Demo mode - all payments succeed
    return paymentIntentId.startsWith("pi_demo_");
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent.status === "succeeded";
  } catch (error) {
    console.error("[Stripe] Failed to verify payment intent:", error);
    return false;
  }
}
