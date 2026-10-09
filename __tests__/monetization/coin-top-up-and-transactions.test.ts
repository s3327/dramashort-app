import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  COIN_PACKAGES,
  getCoinPackageById,
  isValidCoinPackageId,
} from "@/lib/payments/packages";
import {
  grantVipAccessServer,
  processPaymentFulfillmentServer,
  getUserWalletServer,
} from "@/lib/server/wallet";
import { POST as postCreateCheckoutRoute } from "@/app/api/payments/create-checkout/route";
import { POST as postWebhookRoute } from "@/app/api/payments/webhook/route";
import {
  setTestUserServerClientFactory,
  setTestUserServiceRoleClientFactory,
} from "@/lib/supabase/user-server";
import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

/**
 * In-memory mock Supabase client for User DB state.
 */
function createMockUserDbClient(initialData?: {
  wallets?: any[];
  profiles?: any[];
  coinTransactions?: any[];
}) {
  const wallets = [...(initialData?.wallets || [])];
  const profiles = [...(initialData?.profiles || [])];
  const coinTransactions = [...(initialData?.coinTransactions || [])];

  const client: any = {
    _wallets: wallets,
    _profiles: profiles,
    _coinTransactions: coinTransactions,
    from(tableName: string) {
      let activeTable: any[];
      if (tableName === "wallets") activeTable = wallets;
      else if (tableName === "profiles") activeTable = profiles;
      else if (tableName === "coin_transactions") activeTable = coinTransactions;
      else activeTable = [];

      let filters: Array<(row: any) => boolean> = [];
      let sortFn: ((a: any, b: any) => number) | null = null;
      let limitCount: number | null = null;

      const builder: any = {
        select(_columns?: string, _options?: any) {
          return builder;
        },
        eq(column: string, value: any) {
          filters.push((row: any) => row[column] === value);
          return builder;
        },
        order(column: string, { ascending = true } = {}) {
          sortFn = (a: any, b: any) => {
            if (a[column] < b[column]) return ascending ? -1 : 1;
            if (a[column] > b[column]) return ascending ? 1 : -1;
            return 0;
          };
          return builder;
        },
        limit(count: number) {
          limitCount = count;
          return builder;
        },
        single() {
          let matched = activeTable.filter((row) => filters.every((f) => f(row)));
          if (sortFn) matched = [...matched].sort(sortFn);
          if (matched.length === 0) {
            return Promise.resolve({ data: null, error: { message: "Row not found", code: "PGRST116" } });
          }
          return Promise.resolve({ data: matched[0], error: null });
        },
        maybeSingle() {
          let matched = activeTable.filter((row) => filters.every((f) => f(row)));
          if (sortFn) matched = [...matched].sort(sortFn);
          return Promise.resolve({ data: matched[0] || null, error: null });
        },
        insert(data: any) {
          const rows = Array.isArray(data) ? data : [data];
          const inserted = rows.map((r) => ({
            id: r.id || `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            ...r,
          }));
          activeTable.push(...inserted);

          return {
            select(_cols?: string) {
              return {
                single() {
                  return Promise.resolve({ data: inserted[0], error: null });
                },
                maybeSingle() {
                  return Promise.resolve({ data: inserted[0], error: null });
                },
              };
            },
            single() {
              return Promise.resolve({ data: inserted[0], error: null });
            },
            maybeSingle() {
              return Promise.resolve({ data: inserted[0], error: null });
            },
          };
        },
        update(updates: any) {
          return {
            eq(column: string, value: any) {
              let updatedCount = 0;
              for (const row of activeTable) {
                if (row[column] === value) {
                  Object.assign(row, updates);
                  updatedCount++;
                }
              }
              return Promise.resolve({ data: null, error: null, count: updatedCount });
            },
          };
        },
      };

      return builder;
    },
  };

  return client;
}

describe("Task 8.5: Coin Top-Up Shop & Transaction Architecture", () => {
  describe("1. Coin Package Catalog & Helper Contracts", () => {
    it("defines 4 canonical coin packages with correct prices and coins", () => {
      assert.equal(COIN_PACKAGES.length, 4);

      const starter = getCoinPackageById("coins_starter_100");
      assert.ok(starter);
      assert.equal(starter.coins, 100);
      assert.equal(starter.totalCoins, 100);
      assert.equal(starter.priceUsd, 0.99);

      const popular = getCoinPackageById("coins_popular_350");
      assert.ok(popular);
      assert.equal(popular.coins, 300);
      assert.equal(popular.bonusCoins, 50);
      assert.equal(popular.totalCoins, 350);
      assert.equal(popular.priceUsd, 2.99);
      assert.equal(popular.popular, true);

      const binge = getCoinPackageById("coins_binge_800");
      assert.ok(binge);
      assert.equal(binge.coins, 600);
      assert.equal(binge.bonusCoins, 200);
      assert.equal(binge.totalCoins, 800);
      assert.equal(binge.priceUsd, 5.99);
      assert.equal(binge.bestValue, true);

      const vip = getCoinPackageById("vip_weekly_pass");
      assert.ok(vip);
      assert.equal(vip.isVipPass, true);
      assert.equal(vip.vipDays, 7);
      assert.equal(vip.priceUsd, 9.99);
    });

    it("validates package IDs correctly via isValidCoinPackageId", () => {
      assert.equal(isValidCoinPackageId("coins_starter_100"), true);
      assert.equal(isValidCoinPackageId("coins_popular_350"), true);
      assert.equal(isValidCoinPackageId("coins_binge_800"), true);
      assert.equal(isValidCoinPackageId("vip_weekly_pass"), true);
      assert.equal(isValidCoinPackageId("invalid_package"), false);
      assert.equal(isValidCoinPackageId(""), false);
    });
  });

  describe("2. Server VIP Pass Engine (grantVipAccessServer)", () => {
    it("activates VIP weekly pass for non-VIP user", async () => {
      const mockClient = createMockUserDbClient({
        wallets: [{ user_id: "usr-vip-1", balance: 50, is_vip: false, vip_expires_at: null }],
      });

      const res = await grantVipAccessServer("usr-vip-1", 7, "order_vip_test", mockClient);
      assert.equal(res.ok, true);
      assert.equal(res.value.isVip, true);
      assert.ok(new Date(res.value.vipExpiresAt) > new Date());

      // Verify wallet row in mock DB
      assert.equal(mockClient._wallets[0].is_vip, true);
      assert.equal(mockClient._wallets[0].vip_expires_at, res.value.vipExpiresAt);

      // Verify transaction ledger record
      assert.equal(mockClient._coinTransactions.length, 1);
      assert.equal(mockClient._coinTransactions[0].transaction_type, "purchase");
      assert.equal(mockClient._coinTransactions[0].amount, 0);
      assert.equal(mockClient._coinTransactions[0].reference_id, "order_vip_test");
    });

    it("extends existing VIP pass duration cumulatively", async () => {
      const existingExpiry = new Date(Date.now() + 3 * 86400000).toISOString();
      const mockClient = createMockUserDbClient({
        wallets: [{ user_id: "usr-vip-2", balance: 50, is_vip: true, vip_expires_at: existingExpiry }],
      });

      const res = await grantVipAccessServer("usr-vip-2", 7, "order_vip_extend", mockClient);
      assert.equal(res.ok, true);
      assert.equal(res.value.isVip, true);

      // Should be extended by 7 days from existing 3 days (~10 days from now)
      const expectedMinMs = new Date(existingExpiry).getTime() + 6.9 * 86400000;
      assert.ok(new Date(res.value.vipExpiresAt).getTime() >= expectedMinMs);
    });
  });

  describe("3. Idempotent Payment Fulfillment (processPaymentFulfillmentServer)", () => {
    it("credits coin bundle and prevents double-crediting on duplicate referenceId", async () => {
      const mockClient = createMockUserDbClient({
        wallets: [{ user_id: "usr-pay-1", balance: 25, is_vip: false }],
        profiles: [{ id: "usr-pay-1", coin_balance: 25 }],
      });

      const refId = "order_unique_123";

      // 1st fulfillment attempt
      const res1 = await processPaymentFulfillmentServer(
        "usr-pay-1",
        "coins_popular_350",
        refId,
        mockClient
      );
      assert.equal(res1.ok, true);
      assert.equal(res1.value.duplicate, false);
      assert.equal(res1.value.coinsCredited, 350);
      assert.equal(res1.value.newBalance, 375); // 25 + 350

      assert.equal(mockClient._wallets[0].balance, 375);
      assert.equal(mockClient._coinTransactions.length, 1);

      // 2nd fulfillment attempt with identical referenceId (idempotency check)
      const res2 = await processPaymentFulfillmentServer(
        "usr-pay-1",
        "coins_popular_350",
        refId,
        mockClient
      );
      assert.equal(res2.ok, true);
      assert.equal(res2.value.duplicate, true); // Detected duplicate!
      assert.equal(res2.value.coinsCredited, 350);
      assert.equal(res2.value.newBalance, 375); // Balance unchanged!

      // Assert no additional ledger row was created
      assert.equal(mockClient._coinTransactions.length, 1);
      assert.equal(mockClient._wallets[0].balance, 375);
    });

    it("fulfills VIP Weekly Pass via payment fulfillment", async () => {
      const mockClient = createMockUserDbClient({
        wallets: [{ user_id: "usr-pay-vip", balance: 10, is_vip: false }],
      });

      const res = await processPaymentFulfillmentServer(
        "usr-pay-vip",
        "vip_weekly_pass",
        "order_vip_pay",
        mockClient
      );

      assert.equal(res.ok, true);
      assert.equal(res.value.vipGranted, true);
      assert.equal(mockClient._wallets[0].is_vip, true);
    });

    it("rejects unknown package IDs", async () => {
      const mockClient = createMockUserDbClient();
      const res = await processPaymentFulfillmentServer(
        "usr-pay-err",
        "non_existent" as any,
        "ref-err",
        mockClient
      );
      assert.equal(res.ok, false);
      assert.match(res.error, /Invalid coin package ID/);
    });
  });

  describe("4. Payment Route Handlers Contracts", () => {
    it("POST /api/payments/create-checkout rejects unauthenticated caller with 401", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: () => Promise.resolve({ data: { user: null }, error: { message: "No session" } }),
        },
      }));

      try {
        const req = new NextRequest("http://localhost:3000/api/payments/create-checkout", {
          method: "POST",
          body: JSON.stringify({ packageId: "coins_starter_100" }),
        });
        const res = await postCreateCheckoutRoute(req);
        assert.equal(res.status, 401);
        const json = await res.json();
        assert.equal(json.error, "UNAUTHORIZED");
      } finally {
        setTestUserServerClientFactory(null);
      }
    });

    it("POST /api/payments/create-checkout fulfills valid package for authenticated user", async () => {
      const mockClient = createMockUserDbClient({
        wallets: [{ user_id: "usr-chk-auth", balance: 10, is_vip: false }],
      });
      const mockUser = { id: "usr-chk-auth", email: "user@example.com" } as User;

      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: () => Promise.resolve({ data: { user: mockUser }, error: null }),
        },
        ...mockClient,
      }));
      setTestUserServiceRoleClientFactory(() => mockClient);

      try {
        const req = new NextRequest("http://localhost:3000/api/payments/create-checkout", {
          method: "POST",
          body: JSON.stringify({ packageId: "coins_starter_100" }),
        });
        const res = await postCreateCheckoutRoute(req);
        assert.equal(res.status, 200);
        const json = await res.json();
        assert.equal(json.success, true);
        assert.equal(json.coinsCredited, 100);
        assert.equal(json.newBalance, 110);
        assert.ok(json.referenceId.startsWith("order_"));
      } finally {
        setTestUserServerClientFactory(null);
        setTestUserServiceRoleClientFactory(null);
      }
    });

    it("POST /api/payments/webhook processes payment.completed idempotently", async () => {
      const mockClient = createMockUserDbClient({
        wallets: [{ user_id: "usr-hook", balance: 0, is_vip: false }],
      });
      setTestUserServiceRoleClientFactory(() => mockClient);

      try {
        const webhookPayload = {
          eventId: "evt-123",
          eventType: "payment.completed",
          userId: "usr-hook",
          packageId: "coins_binge_800",
          referenceId: "stripe_ch_999",
          amountUsd: 5.99,
          createdAt: new Date().toISOString(),
        };

        const req1 = new NextRequest("http://localhost:3000/api/payments/webhook", {
          method: "POST",
          body: JSON.stringify(webhookPayload),
        });
        const res1 = await postWebhookRoute(req1);
        assert.equal(res1.status, 200);
        const json1 = await res1.json();
        assert.equal(json1.success, true);
        assert.equal(json1.duplicate, false);
        assert.equal(json1.coinsCredited, 800);
        assert.equal(json1.newBalance, 800);

        // Replay same webhook event (network duplicate)
        const req2 = new NextRequest("http://localhost:3000/api/payments/webhook", {
          method: "POST",
          body: JSON.stringify(webhookPayload),
        });
        const res2 = await postWebhookRoute(req2);
        assert.equal(res2.status, 200);
        const json2 = await res2.json();
        assert.equal(json2.success, true);
        assert.equal(json2.duplicate, true); // Safely deduplicated!
        assert.equal(json2.newBalance, 800);
      } finally {
        setTestUserServiceRoleClientFactory(null);
      }
    });

    it("POST /api/payments/webhook ignores non-completed events gracefully", async () => {
      const req = new NextRequest("http://localhost:3000/api/payments/webhook", {
        method: "POST",
        body: JSON.stringify({
          eventId: "evt-failed",
          eventType: "payment.failed",
        }),
      });
      const res = await postWebhookRoute(req);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.received, true);
      assert.equal(json.processed, false);
    });
  });

  describe("5. Component & Architectural Boundary Verification", () => {
    it("ensures zero server-only imports in CoinPurchaseModal", () => {
      const modalPath = path.join(process.cwd(), "components/wallet/CoinPurchaseModal.tsx");
      assert.ok(fs.existsSync(modalPath), "CoinPurchaseModal.tsx exists");
      const content = fs.readFileSync(modalPath, "utf-8");

      assert.ok(
        !content.includes("@/lib/server/"),
        "CoinPurchaseModal must not import from @/lib/server/"
      );
      assert.ok(
        !content.includes("from \"../server/"),
        "CoinPurchaseModal must not import from relative server paths"
      );
    });

    it("verifies account wallet page and navigation links exist", () => {
      const walletPagePath = path.join(process.cwd(), "app/account/wallet/page.tsx");
      assert.ok(fs.existsSync(walletPagePath), "app/account/wallet/page.tsx must exist");

      const sidebarPath = path.join(process.cwd(), "components/account/AccountSidebar.tsx");
      const sidebarContent = fs.readFileSync(sidebarPath, "utf-8");
      assert.ok(
        sidebarContent.includes("/account/wallet"),
        "AccountSidebar.tsx must link to /account/wallet"
      );
    });
  });
});
