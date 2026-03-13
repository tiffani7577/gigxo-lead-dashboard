/**
 * Stripe Webhook Handler Tests
 *
 * Tests signature verification, event dispatch, idempotency, and error handling.
 * Uses vi.resetModules() before each test to avoid module caching issues.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    body: Buffer.from("{}"),
    ...overrides,
  } as unknown as Request;
}

function makeRes() {
  const res = {
    _status: 200,
    _body: {} as any,
    status(code: number) { this._status = code; return this; },
    json(body: any) { this._body = body; return this; },
  };
  return res as unknown as Response & { _status: number; _body: any };
}

function makeEvent(
  type: string,
  data: object,
  id = "evt_live_test_123"
): import("stripe").Stripe.Event {
  return {
    id,
    type,
    object: "event",
    api_version: "2026-02-25.clover",
    created: Math.floor(Date.now() / 1000),
    data: { object: data },
    livemode: false,
    pending_webhooks: 1,
    request: null,
  } as unknown as import("stripe").Stripe.Event;
}

/** Build a mock Stripe instance with a controllable constructEvent */
function makeStripeInstance(constructEventImpl: (...args: any[]) => any) {
  return {
    webhooks: { constructEvent: vi.fn().mockImplementation(constructEventImpl) },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("handleStripeWebhook — Stripe not configured", () => {
  beforeEach(() => { vi.resetModules(); });

  it("returns 400 when getStripe() returns null", async () => {
    vi.doMock("./stripe", () => ({ getStripe: () => null }));
    vi.doMock("./_core/env", () => ({ ENV: { stripeWebhookSecret: "", stripeSecretKey: "" } }));

    const { handleStripeWebhook } = await import("./stripeWebhook");
    const res = makeRes();
    await handleStripeWebhook(makeReq(), res);

    expect(res._status).toBe(400);
    expect(res._body.error).toMatch(/Stripe not configured/i);
  });
});

describe("handleStripeWebhook — signature verification", () => {
  beforeEach(() => { vi.resetModules(); });

  it("rejects when stripe-signature header is missing and webhookSecret is set", async () => {
    vi.doMock("./stripe", () => ({
      getStripe: () => makeStripeInstance(() => { throw new Error("should not be called"); }),
    }));
    vi.doMock("./_core/env", () => ({
      ENV: { stripeWebhookSecret: "whsec_test", stripeSecretKey: "sk_test_key" },
    }));

    const { handleStripeWebhook } = await import("./stripeWebhook");
    const req = makeReq({ headers: {} } as any);
    const res = makeRes();
    await handleStripeWebhook(req, res);

    expect(res._status).toBe(400);
    expect(res._body.error).toMatch(/stripe-signature/i);
  });

  it("rejects when constructEvent throws (bad signature)", async () => {
    vi.doMock("./stripe", () => ({
      getStripe: () => makeStripeInstance(() => {
        throw new Error("No signatures found matching the expected signature for payload");
      }),
    }));
    vi.doMock("./_core/env", () => ({
      ENV: { stripeWebhookSecret: "whsec_test", stripeSecretKey: "sk_test_key" },
    }));

    const { handleStripeWebhook } = await import("./stripeWebhook");
    const req = makeReq({ headers: { "stripe-signature": "t=bad,v1=bad" } } as any);
    const res = makeRes();
    await handleStripeWebhook(req, res);

    expect(res._status).toBe(400);
    expect(res._body.error).toMatch(/signature invalid/i);
  });

  it("accepts valid signature and processes event", async () => {
    const event = makeEvent("customer.created", { id: "cus_123" });
    vi.doMock("./stripe", () => ({
      getStripe: () => makeStripeInstance(() => event),
    }));
    vi.doMock("./_core/env", () => ({
      ENV: { stripeWebhookSecret: "whsec_test", stripeSecretKey: "sk_test_key" },
    }));

    const { handleStripeWebhook } = await import("./stripeWebhook");
    const req = makeReq({ headers: { "stripe-signature": "t=1,v1=valid" } } as any);
    const res = makeRes();
    await handleStripeWebhook(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toEqual({ received: true });
  });
});

describe("handleStripeWebhook — test event short-circuit", () => {
  beforeEach(() => { vi.resetModules(); });

  it("returns { verified: true } for events with evt_test_ prefix", async () => {
    const event = makeEvent(
      "payment_intent.succeeded",
      { id: "pi_test_123", metadata: {}, amount: 700 },
      "evt_test_abc123"
    );
    vi.doMock("./stripe", () => ({
      getStripe: () => makeStripeInstance(() => event),
    }));
    vi.doMock("./_core/env", () => ({
      ENV: { stripeWebhookSecret: "whsec_test", stripeSecretKey: "sk_test_key" },
    }));

    const { handleStripeWebhook } = await import("./stripeWebhook");
    const req = makeReq({ headers: { "stripe-signature": "t=1,v1=sig" } } as any);
    const res = makeRes();
    await handleStripeWebhook(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toEqual({ verified: true });
  });
});

describe("handleStripeWebhook — dev mode (no webhook secret)", () => {
  beforeEach(() => { vi.resetModules(); });

  it("processes events without signature when STRIPE_WEBHOOK_SECRET is empty", async () => {
    const event = makeEvent("customer.created", { id: "cus_dev_123" });
    // constructEvent should NOT be called in dev mode — mock it to throw to detect misuse
    vi.doMock("./stripe", () => ({
      getStripe: () => makeStripeInstance(() => {
        throw new Error("constructEvent should not be called in dev mode");
      }),
    }));
    vi.doMock("./_core/env", () => ({
      ENV: { stripeWebhookSecret: "", stripeSecretKey: "sk_test_key" },
    }));

    const { handleStripeWebhook } = await import("./stripeWebhook");
    const rawBody = Buffer.from(JSON.stringify(event));
    const req = makeReq({ headers: {}, body: rawBody } as any);
    const res = makeRes();
    await handleStripeWebhook(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toEqual({ received: true });
  });

  it("returns 400 for invalid JSON body in dev mode", async () => {
    vi.doMock("./stripe", () => ({
      getStripe: () => makeStripeInstance(() => { throw new Error("should not be called"); }),
    }));
    vi.doMock("./_core/env", () => ({
      ENV: { stripeWebhookSecret: "", stripeSecretKey: "sk_test_key" },
    }));

    const { handleStripeWebhook } = await import("./stripeWebhook");
    const req = makeReq({ headers: {}, body: Buffer.from("not valid json!!!") } as any);
    const res = makeRes();
    await handleStripeWebhook(req, res);

    expect(res._status).toBe(400);
    expect(res._body.error).toMatch(/Invalid JSON/i);
  });
});

describe("fulfillLeadUnlock — idempotency", () => {
  beforeEach(() => { vi.resetModules(); });

  it("skips insert when lead is already unlocked (idempotent)", async () => {
    const mockInsert = vi.fn();
    vi.doMock("./db", () => ({
      getDb: vi.fn().mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 99 }]), // already exists
            }),
          }),
        }),
        insert: mockInsert,
        update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
      }),
    }));
    vi.doMock("../drizzle/schema", () => ({
      leadUnlocks: { id: "id", userId: "userId", leadId: "leadId" },
      transactions: { id: "id", stripePaymentIntentId: "stripePaymentIntentId" },
    }));
    vi.doMock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn() }));

    const { fulfillLeadUnlock } = await import("./stripeWebhook");
    await fulfillLeadUnlock({ userId: 1, leadId: 42, paymentIntentId: "pi_test_done", amountCents: 700 });

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("inserts unlock when lead has not been unlocked yet", async () => {
    const mockInsertValues = vi.fn().mockResolvedValue(undefined);
    const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
    vi.doMock("./db", () => ({
      getDb: vi.fn().mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]), // not yet unlocked
            }),
          }),
        }),
        insert: mockInsert,
        update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
      }),
    }));
    vi.doMock("../drizzle/schema", () => ({
      leadUnlocks: { id: "id", userId: "userId", leadId: "leadId" },
      transactions: { id: "id", stripePaymentIntentId: "stripePaymentIntentId" },
    }));
    vi.doMock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn() }));

    const { fulfillLeadUnlock } = await import("./stripeWebhook");
    await fulfillLeadUnlock({ userId: 2, leadId: 55, paymentIntentId: "pi_test_new", amountCents: 1200 });

    expect(mockInsert).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalled();
  });

  it("handles database unavailability gracefully", async () => {
    vi.doMock("./db", () => ({
      getDb: vi.fn().mockResolvedValue(null), // DB unavailable
    }));
    vi.doMock("../drizzle/schema", () => ({}));
    vi.doMock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn() }));

    const { fulfillLeadUnlock } = await import("./stripeWebhook");
    // Should not throw even when DB is unavailable
    await expect(
      fulfillLeadUnlock({ userId: 3, leadId: 10, paymentIntentId: "pi_test_nodb", amountCents: 700 })
    ).resolves.toBeUndefined();
  });
});
