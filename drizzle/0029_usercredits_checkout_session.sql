-- Idempotent credit-pack fulfillment via Stripe Checkout (checkout.session.completed)
ALTER TABLE userCredits
  ADD COLUMN stripeCheckoutSessionId VARCHAR(255) NULL DEFAULT NULL AFTER isUsed;

CREATE INDEX userCredits_stripeCheckoutSessionId_idx ON userCredits (stripeCheckoutSessionId);
