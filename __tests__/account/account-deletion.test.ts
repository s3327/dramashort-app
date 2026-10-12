import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { DELETE } from "@/app/api/account/route";
import {
  setTestUserServerClientFactory,
  setTestUserServiceRoleClientFactory,
} from "@/lib/supabase/user-server";

describe("Account Deletion & Data Erasure (Task 11.3)", () => {
  afterEach(() => {
    setTestUserServerClientFactory(null);
    setTestUserServiceRoleClientFactory(null);
  });

  describe("DELETE /api/account Route Handler", () => {
    const makeDeleteRequest = (body: unknown) => {
      return new NextRequest("http://localhost:3000/api/account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    };

    it("returns 401 UNAUTHORIZED when no authenticated user session exists", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({
            data: { user: null },
            error: { message: "No active session", status: 401 },
          }),
        },
      }));

      const req = makeDeleteRequest({ confirmationText: "DELETE" });
      const res = await DELETE(req);
      assert.equal(res.status, 401);

      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, "UNAUTHORIZED");
    });

    it("returns 400 VALIDATION_ERROR when confirmationText is not 'DELETE'", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({
            data: {
              user: {
                id: "user-123",
                email: "test@example.com",
                last_sign_in_at: new Date().toISOString(),
              },
            },
            error: null,
          }),
        },
      }));

      const invalidBodies = [
        {},
        { confirmationText: "delete" },
        { confirmationText: "yes" },
        { confirmationText: "REMOVE" },
      ];

      for (const body of invalidBodies) {
        const req = makeDeleteRequest(body);
        const res = await DELETE(req);
        assert.equal(res.status, 400);

        const json = await res.json();
        assert.equal(json.error.code, "VALIDATION_ERROR");
      }
    });

    it("returns 403 REAUTHENTICATION_REQUIRED when session is stale (> 5 min) and no password supplied", async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({
            data: {
              user: {
                id: "user-stale-123",
                email: "stale@example.com",
                last_sign_in_at: tenMinutesAgo,
                app_metadata: { provider: "email" },
              },
            },
            error: null,
          }),
        },
      }));

      const req = makeDeleteRequest({ confirmationText: "DELETE" });
      const res = await DELETE(req);
      assert.equal(res.status, 403);

      const json = await res.json();
      assert.equal(json.error.code, "REAUTHENTICATION_REQUIRED");
    });

    it("returns 400 INVALID_CREDENTIALS when password verification fails", async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({
            data: {
              user: {
                id: "user-123",
                email: "test@example.com",
                last_sign_in_at: tenMinutesAgo,
                app_metadata: { provider: "email" },
              },
            },
            error: null,
          }),
          signInWithPassword: async () => ({
            data: null,
            error: { message: "Invalid login credentials" },
          }),
        },
      }));

      const req = makeDeleteRequest({
        confirmationText: "DELETE",
        password: "WrongPassword123!",
      });
      const res = await DELETE(req);
      assert.equal(res.status, 400);

      const json = await res.json();
      assert.equal(json.error.code, "INVALID_CREDENTIALS");
    });

    it("successfully deletes user when recently signed in (< 5 min) and calls auth.admin.deleteUser", async () => {
      let deletedUserId = "";
      const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000).toISOString();

      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({
            data: {
              user: {
                id: "target-user-456",
                email: "recent@example.com",
                last_sign_in_at: oneMinuteAgo,
                app_metadata: { provider: "google" },
              },
            },
            error: null,
          }),
        },
      }));

      setTestUserServiceRoleClientFactory(() => ({
        auth: {
          admin: {
            deleteUser: async (id: string) => {
              deletedUserId = id;
              return { data: { user: null }, error: null };
            },
          },
        },
      }));

      const req = makeDeleteRequest({ confirmationText: "DELETE" });
      const res = await DELETE(req);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.deleted, true);
      assert.equal(deletedUserId, "target-user-456");
    });

    it("successfully deletes user when valid password is provided despite older session", async () => {
      let deletedUserId = "";
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({
            data: {
              user: {
                id: "pwd-user-789",
                email: "password@example.com",
                last_sign_in_at: thirtyMinutesAgo,
                app_metadata: { provider: "email" },
              },
            },
            error: null,
          }),
          signInWithPassword: async () => ({
            data: { session: {} },
            error: null,
          }),
        },
      }));

      setTestUserServiceRoleClientFactory(() => ({
        auth: {
          admin: {
            deleteUser: async (id: string) => {
              deletedUserId = id;
              return { data: { user: null }, error: null };
            },
          },
        },
      }));

      const req = makeDeleteRequest({
        confirmationText: "DELETE",
        password: "ValidPassword123!",
      });
      const res = await DELETE(req);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(deletedUserId, "pwd-user-789");
    });

    it("handles service-role deleteUser failure with 500 DELETION_FAILED", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({
            data: {
              user: {
                id: "err-user-999",
                email: "err@example.com",
                last_sign_in_at: new Date().toISOString(),
              },
            },
            error: null,
          }),
        },
      }));

      setTestUserServiceRoleClientFactory(() => ({
        auth: {
          admin: {
            deleteUser: async () => {
              return { data: null, error: { message: "Internal Auth Gateway Timeout" } };
            },
          },
        },
      }));

      const req = makeDeleteRequest({ confirmationText: "DELETE" });
      const res = await DELETE(req);
      assert.equal(res.status, 500);

      const json = await res.json();
      assert.equal(json.error.code, "DELETION_FAILED");
    });
  });

  describe("Database Cascading Foreign Key Contracts", () => {
    const userMigrationPath = path.resolve(
      process.cwd(),
      "supabase/migrations/20261012100000_user_schema.sql"
    );

    it("enforces ON DELETE CASCADE on profiles referencing auth.users", () => {
      const sql = fs.readFileSync(userMigrationPath, "utf-8");
      assert.ok(
        /profiles[\s\S]*?REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+CASCADE/i.test(
          sql
        ),
        "profiles must reference auth.users(id) ON DELETE CASCADE"
      );
    });

    it("enforces ON DELETE CASCADE on favorites, watch_history, and custom_lists", () => {
      const sql = fs.readFileSync(userMigrationPath, "utf-8");
      assert.ok(
        /favorites[\s\S]*?REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+CASCADE/i.test(
          sql
        ),
        "favorites must cascade on auth.users(id) delete"
      );
      assert.ok(
        /watch_history[\s\S]*?REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+CASCADE/i.test(
          sql
        ),
        "watch_history must cascade on auth.users(id) delete"
      );
      assert.ok(
        /custom_lists[\s\S]*?REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+CASCADE/i.test(
          sql
        ),
        "custom_lists must cascade on auth.users(id) delete"
      );
    });
  });

  describe("ADR-0001 Architecture Decision Record", () => {
    const adrPath = path.resolve(
      process.cwd(),
      "docs/adr/0001-account-deletion-and-data-retention.md"
    );

    it("exists and specifies right to erasure, reauthentication, and financial anonymization", () => {
      assert.ok(fs.existsSync(adrPath), "ADR-0001 must exist on disk");
      const content = fs.readFileSync(adrPath, "utf-8");
      assert.ok(content.includes("Right to erasure"), "ADR-0001 mentions right to erasure");
      assert.ok(content.includes("Financial & Ledger Retention Anonymization"), "ADR-0001 records financial retention policy");
      assert.ok(content.includes("DELETE"), "ADR-0001 specifies DELETE confirmation keyword");
    });
  });
});
