import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { POST as postCreateCheckoutRoute } from "@/app/api/payments/create-checkout/route";
import { POST as postWebhookRoute } from "@/app/api/payments/webhook/route";
import {
  setTestUserServerClientFactory,
  setTestUserServiceRoleClientFactory,
} from "@/lib/supabase/user-server";
import {
  generateWebhookSignature,
  verifyWebhookSignature,
} from "@/lib/payments/webhook-signature";
import {
  fulfillPaymentOrderServer,
  processPaymentFulfillmentServer,
} from "@/lib/server/wallet";
import {
  signPlaybackToken,
  verifyPlaybackToken,
  signPlaybackUrl,
} from "@/lib/server/playback";
import { getClientIp, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limiter";

/**
 * In-memory test client mocking Supabase User DB with payment_orders and webhook events.
 */
function createFullMockUserDbClient(initialData?: {
  wallets?: any[];
  profiles?: any[];
  coinTransactions?: any[];
  paymentOrders?: any[];
  paymentWebhookEvents?: any[];
}) {
  const wallets = [...(initialData?.wallets || [])];
  const profiles = [...(initialData?.profiles || [])];
  const coinTransactions = [...(initialData?.coinTransactions || [])];
  const paymentOrders = [...(initialData?.paymentOrders || [])];
  const paymentWebhookEvents = [...(initialData?.paymentWebhookEvents || [])];

  const client: any = {
    _wallets: wallets,
    _profiles: profiles,
    _coinTransactions: coinTransactions,
    _paymentOrders: paymentOrders,
    _paymentWebhookEvents: paymentWebhookEvents,
    from(tableName: string) {
      let activeTable: any[];
      if (tableName === "wallets") activeTable = wallets;
      else if (tableName === "profiles") activeTable = profiles;
      else if (tableName === "coin_transactions") activeTable = coinTransactions;
      else if (tableName === "payment_orders") activeTable = paymentOrders;
      else if (tableName === "payment_webhook_events") activeTable = paymentWebhookEvents;
      else activeTable = [];

      let filters: Array<(row: any) => boolean> = [];

      const builder: any = {
        select(_columns?: string) {
          return builder;
        },
        eq(col: string, val: any) {
          filters.push((row: any) => row[col] === val);
          return builder;
        },
        maybeSingle() {
          const matched = activeTable.filter((row) => filters.every((f) => f(row)));
          return Promise.resolve({ data: matched[0] || null, error: null });
        },
        single() {
          const matched = activeTable.filter((row) => filters.every((f) => f(row)));
          if (matched.length === 0) {
            return Promise.resolve({ data: null, error: { message: "Row not found", code: "PGRST116" } });
          }
          return Promise.resolve({ data: matched[0], error: null });
        },
        insert(data: any) {
          const rows = Array.isArray(data) ? data : [data];
          const inserted: any[] = [];
          for (const r of rows) {
            // Check primary key on payment_webhook_events
            if (tableName === "payment_webhook_events") {
              const exists = activeTable.some(
                (e) => e.provider === r.provider && e.event_id === r.event_id
              );
              if (exists) {
                const errRes = { error: { code: "23505", message: "duplicate key value violates unique constraint" } };
                const p: any = Promise.resolve(errRes);
                p.select = () => ({ single: () => Promise.resolve(errRes), maybeSingle: () => Promise.resolve(errRes) });
                return p;
              }
            }
            // Check unique index on coin_transactions (reference_id)
            if (tableName === "coin_transactions" && r.transaction_type === "purchase" && r.reference_id) {
              const duplicate = activeTable.some(
                (tx) => tx.transaction_type === "purchase" && tx.reference_id === r.reference_id
              );
              if (duplicate) {
                const errRes = { error: { code: "23505", message: "duplicate key value violates unique constraint" } };
                const p: any = Promise.resolve(errRes);
                p.select = () => ({ single: () => Promise.resolve(errRes), maybeSingle: () => Promise.resolve(errRes) });
                return p;
              }
            }
            const rowWithId = { id: r.id || `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...r };
            activeTable.push(rowWithId);
            inserted.push(rowWithId);
          }

          const res = { data: inserted, error: null };
          const ret: any = Promise.resolve(res);
          ret.select = (_cols?: string) => ({
            single() {
              return Promise.resolve({ data: inserted[0], error: null });
            },
            maybeSingle() {
              return Promise.resolve({ data: inserted[0], error: null });
            },
          });
          return ret;
        },
        update(updates: any) {
          return {
            eq(col: string, val: any) {
              for (const row of activeTable) {
                if (row[col] === val) {
                  Object.assign(row, updates);
                }
              }
              return Promise.resolve({ error: null });
            },
          };
        },
      };
      return builder;
    },
  };

  return client;
}

describe("Security & Stability Fix Plan Verification Suite", () => {
  describe("Phase A: Checkout Production Guard & Open Redirect Prevention (P0 Step 1 & 5)", () => {
    it("returns 503 and writes ZERO ledger rows in production environment", async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalSimulated = process.env.ENABLE_SIMULATED_CHECKOUT;

      (process.env as any).NODE_ENV = "production";
      process.env.ENABLE_SIMULATED_CHECKOUT = "true";

      const mockClient = createFullMockUserDbClient({
        wallets: [{ user_id: "usr-prod-victim", balance: 50, is_vip: false }],
      });
      const user = { id: "usr-prod-victim", email: "user@prod.local" } as User;

      setTestUserServerClientFactory(() => ({
        auth: { getUser: () => Promise.resolve({ data: { user }, error: null }) },
        ...mockClient,
      }));
      setTestUserServiceRoleClientFactory(() => mockClient);

      try {
        const req = new NextRequest("http://localhost:3000/api/payments/create-checkout", {
          method: "POST",
          body: JSON.stringify({ packageId: "coins_starter_100" }),
        });
        const res = await postCreateCheckoutRoute(req);
        assert.equal(res.status, 503);
        const json = await res.json();
        assert.equal(json.error, "PAYMENT_PROVIDER_NOT_CONFIGURED");

        // Hard verification: no transaction and no balance change
        assert.equal(mockClient._coinTransactions.length, 0);
        assert.equal(mockClient._wallets[0].balance, 50);
      } finally {
        (process.env as any).NODE_ENV = originalNodeEnv;
        if (originalSimulated !== undefined) process.env.ENABLE_SIMULATED_CHECKOUT = originalSimulated;
        else delete process.env.ENABLE_SIMULATED_CHECKOUT;
        setTestUserServerClientFactory(null);
        setTestUserServiceRoleClientFactory(null);
      }
    });

    it("rejects open redirect attacks in returnUrl with HTTP 400", async () => {
      const originalSim = process.env.ENABLE_SIMULATED_CHECKOUT;
      process.env.ENABLE_SIMULATED_CHECKOUT = "true";

      const user = { id: "usr-redir", email: "u@test.local" } as User;
      setTestUserServerClientFactory(() => ({
        auth: { getUser: () => Promise.resolve({ data: { user }, error: null }) },
      }));

      try {
        const attackVectors = [
          "//evil.com",
          "https://evil.com/phish",
          "http://attacker.com",
          "javascript:alert(1)",
        ];

        for (const attackUrl of attackVectors) {
          const req = new NextRequest("http://localhost:3000/api/payments/create-checkout", {
            method: "POST",
            body: JSON.stringify({ packageId: "coins_starter_100", returnUrl: attackUrl }),
          });
          const res = await postCreateCheckoutRoute(req);
          assert.equal(res.status, 400);
          const json = await res.json();
          assert.equal(json.error, "INVALID_RETURN_URL");
        }
      } finally {
        if (originalSim !== undefined) process.env.ENABLE_SIMULATED_CHECKOUT = originalSim;
        else delete process.env.ENABLE_SIMULATED_CHECKOUT;
        setTestUserServerClientFactory(null);
      }
    });
  });

  describe("Phase D: Webhook Security, Fail-Closed & Deduplication (P0 Step 6)", () => {
    it("fails closed with 500 when PAYMENT_WEBHOOK_SECRET is unconfigured", async () => {
      const orig = process.env.PAYMENT_WEBHOOK_SECRET;
      delete process.env.PAYMENT_WEBHOOK_SECRET;

      try {
        const req = new NextRequest("http://localhost:3000/api/payments/webhook", {
          method: "POST",
          body: JSON.stringify({ eventType: "payment.completed" }),
        });
        const res = await postWebhookRoute(req);
        assert.equal(res.status, 500);
        const json = await res.json();
        assert.equal(json.error, "WEBHOOK_NOT_CONFIGURED");
      } finally {
        if (orig !== undefined) process.env.PAYMENT_WEBHOOK_SECRET = orig;
      }
    });

    it("rejects stale webhook requests (> 5 minutes old) with 401 STALE_TIMESTAMP", async () => {
      const secret = "whsec_stale_test_secret";
      const orig = process.env.PAYMENT_WEBHOOK_SECRET;
      process.env.PAYMENT_WEBHOOK_SECRET = secret;

      try {
        const staleTimestampMs = Date.now() - 10 * 60 * 1000; // 10 minutes ago
        const body = JSON.stringify({ eventId: "evt-stale", eventType: "payment.completed" });
        const signature = generateWebhookSignature(body, secret, staleTimestampMs);

        const req = new NextRequest("http://localhost:3000/api/payments/webhook", {
          method: "POST",
          headers: { "x-webhook-signature": signature },
          body,
        });

        const res = await postWebhookRoute(req);
        assert.equal(res.status, 401);
        const json = await res.json();
        assert.equal(json.error, "STALE_TIMESTAMP");
      } finally {
        if (orig !== undefined) process.env.PAYMENT_WEBHOOK_SECRET = orig;
        else delete process.env.PAYMENT_WEBHOOK_SECRET;
      }
    });

    it("deduplicates identical eventId and prevents double-crediting", async () => {
      const secret = "whsec_dedup_secret";
      const orig = process.env.PAYMENT_WEBHOOK_SECRET;
      process.env.PAYMENT_WEBHOOK_SECRET = secret;

      const orderId = "order-uuid-1111";
      const mockClient = createFullMockUserDbClient({
        wallets: [{ user_id: "usr-dedup", balance: 0, is_vip: false }],
        paymentOrders: [
          {
            id: orderId,
            user_id: "usr-dedup",
            package_id: "coins_popular_350",
            amount_minor: 299,
            currency: "USD",
            status: "pending",
          },
        ],
      });
      setTestUserServiceRoleClientFactory(() => mockClient);

      try {
        const payload = {
          eventId: "evt-replay-unique-99",
          eventType: "payment.completed",
          orderId,
          amountMinor: 299,
          currency: "USD",
        };
        const rawBody = JSON.stringify(payload);
        const signature = generateWebhookSignature(rawBody, secret, Date.now());

        // Delivery 1
        const req1 = new NextRequest("http://localhost:3000/api/payments/webhook", {
          method: "POST",
          headers: { "x-webhook-signature": signature },
          body: rawBody,
        });
        const res1 = await postWebhookRoute(req1);
        assert.equal(res1.status, 200);
        const json1 = await res1.json();
        assert.equal(json1.success, true);
        assert.equal(json1.duplicate, false);
        assert.equal(json1.coinsCredited, 350);

        // Delivery 2 (Immediate duplicate replay)
        const req2 = new NextRequest("http://localhost:3000/api/payments/webhook", {
          method: "POST",
          headers: { "x-webhook-signature": signature },
          body: rawBody,
        });
        const res2 = await postWebhookRoute(req2);
        assert.equal(res2.status, 200);
        const json2 = await res2.json();
        assert.equal(json2.duplicate, true);

        // Assert balance credited strictly ONCE
        assert.equal(mockClient._wallets[0].balance, 350);
      } finally {
        if (orig !== undefined) process.env.PAYMENT_WEBHOOK_SECRET = orig;
        else delete process.env.PAYMENT_WEBHOOK_SECRET;
        setTestUserServiceRoleClientFactory(null);
      }
    });

    it("never trusts spoofed userId in body; credits strictly the order.user_id", async () => {
      const secret = "whsec_trust_order_secret";
      const orig = process.env.PAYMENT_WEBHOOK_SECRET;
      process.env.PAYMENT_WEBHOOK_SECRET = secret;

      const orderId = "order-legit-uuid-222";
      const mockClient = createFullMockUserDbClient({
        wallets: [
          { user_id: "usr-legit-buyer", balance: 10, is_vip: false },
          { user_id: "usr-attacker", balance: 0, is_vip: false },
        ],
        paymentOrders: [
          {
            id: orderId,
            user_id: "usr-legit-buyer",
            package_id: "coins_starter_100",
            amount_minor: 99,
            currency: "USD",
            status: "pending",
          },
        ],
      });
      setTestUserServiceRoleClientFactory(() => mockClient);

      try {
        // Attacker intercepts and sends payload with their own userId
        const spoofedPayload = {
          eventId: "evt-spoof-1",
          eventType: "payment.completed",
          orderId,
          userId: "usr-attacker", // Spoofed!
          packageId: "coins_binge_800", // Spoofed higher tier!
          amountMinor: 99,
          currency: "USD",
        };
        const rawBody = JSON.stringify(spoofedPayload);
        const sig = generateWebhookSignature(rawBody, secret, Date.now());

        const req = new NextRequest("http://localhost:3000/api/payments/webhook", {
          method: "POST",
          headers: { "x-webhook-signature": sig },
          body: rawBody,
        });

        const res = await postWebhookRoute(req);
        assert.equal(res.status, 200);

        // Verification: Attacker received 0 coins!
        const attackerWallet = mockClient._wallets.find((w: any) => w.user_id === "usr-attacker");
        assert.equal(attackerWallet.balance, 0);

        // Legit buyer received 100 coins (package on order), not 800!
        const legitWallet = mockClient._wallets.find((w: any) => w.user_id === "usr-legit-buyer");
        assert.equal(legitWallet.balance, 110);
      } finally {
        if (orig !== undefined) process.env.PAYMENT_WEBHOOK_SECRET = orig;
        else delete process.env.PAYMENT_WEBHOOK_SECRET;
        setTestUserServiceRoleClientFactory(null);
      }
    });

    it("rejects payment amount mismatch between event and recorded order with 400", async () => {
      const secret = "whsec_amount_test";
      const orig = process.env.PAYMENT_WEBHOOK_SECRET;
      process.env.PAYMENT_WEBHOOK_SECRET = secret;

      const orderId = "order-amount-check";
      const mockClient = createFullMockUserDbClient({
        wallets: [{ user_id: "usr-buyer", balance: 0, is_vip: false }],
        paymentOrders: [
          {
            id: orderId,
            user_id: "usr-buyer",
            package_id: "coins_popular_350",
            amount_minor: 299, // $2.99
            currency: "USD",
            status: "pending",
          },
        ],
      });
      setTestUserServiceRoleClientFactory(() => mockClient);

      try {
        const tamperedPayload = {
          eventId: "evt-amount-tamper",
          eventType: "payment.completed",
          orderId,
          amountMinor: 99, // Underpaid $0.99!
          currency: "USD",
        };
        const rawBody = JSON.stringify(tamperedPayload);
        const sig = generateWebhookSignature(rawBody, secret, Date.now());

        const req = new NextRequest("http://localhost:3000/api/payments/webhook", {
          method: "POST",
          headers: { "x-webhook-signature": sig },
          body: rawBody,
        });
        const res = await postWebhookRoute(req);
        assert.equal(res.status, 400);
        const json = await res.json();
        assert.equal(json.error, "AMOUNT_MISMATCH");

        // Order remains pending and uncredited
        assert.equal(mockClient._paymentOrders[0].status, "pending");
        assert.equal(mockClient._wallets[0].balance, 0);
      } finally {
        if (orig !== undefined) process.env.PAYMENT_WEBHOOK_SECRET = orig;
        else delete process.env.PAYMENT_WEBHOOK_SECRET;
        setTestUserServiceRoleClientFactory(null);
      }
    });
  });

  describe("Phase E: Playback Token Signing & Expiration Hardening (P1 Step 10)", () => {
    it("generates valid HMAC playback token and verifies expiration boundary", () => {
      const episodeId = "ep-uuid-stream-123";
      const nowMs = Date.now();
      const validEpochMs = nowMs + 15 * 60 * 1000; // 15 mins

      const token = signPlaybackToken(episodeId, validEpochMs);
      assert.ok(token);
      assert.equal(typeof token, "string");

      // Valid token within TTL passes
      const isValid = verifyPlaybackToken(episodeId, token, validEpochMs);
      assert.equal(isValid, true);

      // Wrong episodeId fails
      assert.equal(verifyPlaybackToken("ep-other-456", token, validEpochMs), false);

      // Expired token fails
      const expiredEpochMs = nowMs - 1000; // Expired 1 second ago
      assert.equal(verifyPlaybackToken(episodeId, token, expiredEpochMs), false);
    });

    it("signPlaybackUrl attaches token and expires query parameters cleanly", () => {
      const streamUrl = "https://cdn.example.com/hls/master.m3u8";
      const episodeId = "ep-777";
      const result = signPlaybackUrl(streamUrl, episodeId, 900);

      assert.ok(result.url.includes("token="));
      assert.ok(result.url.includes("expires="));
      assert.ok(result.token);
      assert.ok(result.expiresAt);
    });
  });

  describe("Phase E: Rate Limiter Verified Client IP Extraction (P1 Step 9)", () => {
    it("prioritizes trusted x-real-ip over untrusted x-forwarded-for spoofing", () => {
      const req = new NextRequest("http://localhost:3000/api/test", {
        headers: {
          "x-real-ip": "203.0.113.195",
          "x-forwarded-for": "198.51.100.1, 10.0.0.1",
        },
      });

      const resolvedIp = getClientIp(req);
      assert.equal(resolvedIp, "203.0.113.195");
    });

    it("verifies dedicated rate limit policies exist for checkout and webhook", () => {
      assert.ok(RATE_LIMIT_POLICIES.checkout);
      assert.equal(RATE_LIMIT_POLICIES.checkout.maxRequests, 10);
      assert.equal(RATE_LIMIT_POLICIES.checkout.windowMs, 5 * 60 * 1000);

      assert.ok(RATE_LIMIT_POLICIES.webhook);
      assert.equal(RATE_LIMIT_POLICIES.webhook.maxRequests, 60);
    });
  });
});
