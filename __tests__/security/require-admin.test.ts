import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { requireAdmin } from "@/lib/auth/require-admin";
import type { User } from "@supabase/supabase-js";

describe("requireAdmin Security Guard (Task 10.9)", () => {
  it("denies access with 401 UNAUTHORIZED when no session exists", async () => {
    let getUserCalled = false;
    const mockClient = {
      auth: {
        getUser: async () => {
          getUserCalled = true;
          return { data: { user: null }, error: null };
        },
      },
    };

    const result = await requireAdmin({ client: mockClient });
    assert.equal(getUserCalled, true);
    assert.equal(result.authorized, false);
    if (!result.authorized) {
      assert.equal(result.response.status, 401);
      const body = await result.response.json();
      assert.equal(body.success, false);
      assert.equal(body.error?.code, "UNAUTHORIZED");
    }
  });

  it("denies access with 401 UNAUTHORIZED when auth.getUser returns an error", async () => {
    const mockClient = {
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: new Error("JWT expired"),
        }),
      },
    };

    const result = await requireAdmin({ client: mockClient });
    assert.equal(result.authorized, false);
    if (!result.authorized) {
      assert.equal(result.response.status, 401);
      const body = await result.response.json();
      assert.equal(body.success, false);
      assert.equal(body.error?.code, "UNAUTHORIZED");
    }
  });

  it("handles unexpected client throw with 500 AUTH_VERIFICATION_ERROR", async () => {
    const mockClient = {
      auth: {
        getUser: async () => {
          throw new Error("Network / Supabase unreachable");
        },
      },
    };

    const result = await requireAdmin({ client: mockClient });
    assert.equal(result.authorized, false);
    if (!result.authorized) {
      assert.equal(result.response.status, 500);
      const body = await result.response.json();
      assert.equal(body.success, false);
      assert.equal(body.error?.code, "AUTH_VERIFICATION_ERROR");
    }
  });

  it("denies regular user with 403 FORBIDDEN when app_metadata.role is missing", async () => {
    const regularUser: User = {
      id: "usr-regular-1",
      email: "user@example.com",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };

    const mockClient = {
      auth: {
        getUser: async () => ({ data: { user: regularUser }, error: null }),
      },
    };

    const result = await requireAdmin({ client: mockClient });
    assert.equal(result.authorized, false);
    if (!result.authorized) {
      assert.equal(result.response.status, 403);
      const body = await result.response.json();
      assert.equal(body.success, false);
      assert.equal(body.error?.code, "FORBIDDEN");
    }
  });

  it("CRITICAL: rejects forged user_metadata.role = 'admin' (self-elevation attempt)", async () => {
    const attackerUser: User = {
      id: "usr-attacker-1",
      email: "attacker@example.com",
      app_metadata: {}, // Service-role granted metadata is empty
      user_metadata: { role: "admin", display_name: "Attacker" }, // Client injected
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };

    const mockClient = {
      auth: {
        getUser: async () => ({ data: { user: attackerUser }, error: null }),
      },
    };

    const result = await requireAdmin({ client: mockClient });
    assert.equal(result.authorized, false);
    if (!result.authorized) {
      assert.equal(result.response.status, 403);
      const body = await result.response.json();
      assert.equal(body.success, false);
      assert.equal(body.error?.code, "FORBIDDEN");
    }
  });

  it("rejects untrusted or unexpected roles in app_metadata with 403", async () => {
    for (const badRole of ["superuser", "root", "manager", "moderator", "ADMIN"]) {
      const untrustedUser: User = {
        id: "usr-bad-1",
        email: "user@example.com",
        app_metadata: { role: badRole },
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      };

      const mockClient = {
        auth: {
          getUser: async () => ({ data: { user: untrustedUser }, error: null }),
        },
      };

      const result = await requireAdmin({ client: mockClient });
      assert.equal(result.authorized, false, `Role ${badRole} must be rejected`);
      if (!result.authorized) {
        assert.equal(result.response.status, 403);
      }
    }
  });

  it("denies editor when resource strictly requires admin role", async () => {
    const editorUser: User = {
      id: "usr-editor-1",
      email: "editor@example.com",
      app_metadata: { role: "editor" },
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };

    const mockClient = {
      auth: {
        getUser: async () => ({ data: { user: editorUser }, error: null }),
      },
    };

    const result = await requireAdmin({ client: mockClient, roles: ["admin"] });
    assert.equal(result.authorized, false);
    if (!result.authorized) {
      assert.equal(result.response.status, 403);
      const body = await result.response.json();
      assert.equal(body.error?.code, "FORBIDDEN");
    }
  });

  it("authorizes editor when resource allows both admin and editor", async () => {
    const editorUser: User = {
      id: "usr-editor-1",
      email: "editor@example.com",
      app_metadata: { role: "editor" },
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };

    const mockClient = {
      auth: {
        getUser: async () => ({ data: { user: editorUser }, error: null }),
      },
    };

    const result = await requireAdmin({ client: mockClient, roles: ["admin", "editor"] });
    assert.equal(result.authorized, true);
    if (result.authorized) {
      assert.equal(result.role, "editor");
      assert.equal(result.user.id, "usr-editor-1");
    }
  });

  it("authorizes genuine admin with app_metadata.role = 'admin'", async () => {
    const adminUser: User = {
      id: "usr-admin-1",
      email: "admin@dramashort.com",
      app_metadata: { role: "admin" },
      user_metadata: { role: "user" }, // Even if user_metadata has 'user', app_metadata wins
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };

    const mockClient = {
      auth: {
        getUser: async () => ({ data: { user: adminUser }, error: null }),
      },
    };

    const result = await requireAdmin({ client: mockClient });
    assert.equal(result.authorized, true);
    if (result.authorized) {
      assert.equal(result.role, "admin");
      assert.equal(result.user.id, "usr-admin-1");
    }
  });
});
