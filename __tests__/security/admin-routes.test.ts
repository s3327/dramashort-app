import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as getDramas, POST as postDrama } from "@/app/api/admin/dramas/route";
import { GET as getDramaById, PATCH as patchDramaById } from "@/app/api/admin/dramas/[id]/route";
import { setTestUserServerClientFactory } from "@/lib/supabase/user-server";
import { setTestContentAdminClientFactory } from "@/lib/supabase/content";
import type { User } from "@supabase/supabase-js";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

describe("Admin Route Handlers Security (Task 10.9)", () => {
  afterEach(() => {
    setTestUserServerClientFactory(null);
    setTestContentAdminClientFactory(null);
  });

  describe("GET /api/admin/dramas", () => {
    it("returns 401 UNAUTHORIZED when unauthenticated", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: null }, error: null }),
        },
      }));

      const response = await getDramas(new NextRequest("http://localhost:3000/api/admin/dramas"));
      assert.equal(response.status, 401);

      const body = await response.json();
      assert.equal(body.success, false);
      assert.equal(body.error?.code, "UNAUTHORIZED");
    });

    it("returns 403 FORBIDDEN for regular user with client-forged user_metadata.role", async () => {
      const attacker: User = {
        id: "attacker-1",
        email: "hacker@test.local",
        app_metadata: {},
        user_metadata: { role: "admin" },
        aud: "authenticated",
        created_at: new Date().toISOString(),
      };

      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: attacker }, error: null }),
        },
      }));

      const response = await getDramas(new NextRequest("http://localhost:3000/api/admin/dramas"));
      assert.equal(response.status, 403);

      const body = await response.json();
      assert.equal(body.success, false);
      assert.equal(body.error?.code, "FORBIDDEN");
    });

    it("returns 200 OK when authenticated as admin", async () => {
      const admin: User = {
        id: "admin-1",
        email: "admin@dramashort.com",
        app_metadata: { role: "admin" },
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      };

      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: admin }, error: null }),
        },
      }));

      setTestContentAdminClientFactory(() => ({
        from: (table: string) => {
          assert.equal(table, "titles");
          const qb: any = {
            order: () => qb,
            ilike: () => qb,
            eq: () => qb,
            range: async () => ({ data: [], count: 0, error: null }),
            then: (resolve: any) => resolve({ data: [], count: 0, error: null }),
          };
          return {
            select: () => qb,
          };
        },
      }));

      const response = await getDramas(new NextRequest("http://localhost:3000/api/admin/dramas"));
      assert.equal(response.status, 200);

      const body = await response.json();
      assert.equal(body.success, true);
      assert.deepEqual(body.data.items, []);
      assert.equal(body.data.total, 0);
    });
  });

  describe("POST /api/admin/dramas", () => {
    it("returns 401 UNAUTHORIZED when unauthenticated", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: null }, error: null }),
        },
      }));

      const req = new NextRequest("http://localhost:3000/api/admin/dramas", {
        method: "POST",
        body: JSON.stringify({ title: "New Drama" }),
      });

      const response = await postDrama(req);
      assert.equal(response.status, 401);
    });

    it("returns 403 FORBIDDEN when user lacks admin in app_metadata", async () => {
      const regularUser: User = {
        id: "reg-1",
        email: "reg@test.local",
        app_metadata: {},
        user_metadata: { role: "admin" },
        aud: "authenticated",
        created_at: new Date().toISOString(),
      };

      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: regularUser }, error: null }),
        },
      }));

      const req = new NextRequest("http://localhost:3000/api/admin/dramas", {
        method: "POST",
        body: JSON.stringify({ title: "New Drama" }),
      });

      const response = await postDrama(req);
      assert.equal(response.status, 403);
    });

    it("returns 400 when payload validation fails for authenticated admin", async () => {
      const admin: User = {
        id: "admin-1",
        email: "admin@dramashort.com",
        app_metadata: { role: "admin" },
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      };

      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: admin }, error: null }),
        },
      }));

      const req = new NextRequest("http://localhost:3000/api/admin/dramas", {
        method: "POST",
        body: JSON.stringify({}), // Missing required fields
      });

      const response = await postDrama(req);
      assert.equal(response.status, 400);

      const body = await response.json();
      assert.equal(body.success, false);
      assert.equal(body.error?.code, "VALIDATION_ERROR");
    });
  });

  describe("GET /api/admin/dramas/[id]", () => {
    it("returns 401 UNAUTHORIZED when unauthenticated", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: null }, error: null }),
        },
      }));

      const req = new NextRequest(`http://localhost:3000/api/admin/dramas/${VALID_UUID}`);
      const params = Promise.resolve({ id: VALID_UUID });

      const response = await getDramaById(req, { params });
      assert.equal(response.status, 401);
    });

    it("returns 403 FORBIDDEN for regular user", async () => {
      const regularUser: User = {
        id: "reg-1",
        email: "user@test.local",
        app_metadata: {},
        user_metadata: { role: "admin" },
        aud: "authenticated",
        created_at: new Date().toISOString(),
      };

      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: regularUser }, error: null }),
        },
      }));

      const req = new NextRequest(`http://localhost:3000/api/admin/dramas/${VALID_UUID}`);
      const params = Promise.resolve({ id: VALID_UUID });

      const response = await getDramaById(req, { params });
      assert.equal(response.status, 403);
    });

    it("returns 400 INVALID_ID for non-UUID parameter", async () => {
      const admin: User = {
        id: "admin-1",
        email: "admin@dramashort.com",
        app_metadata: { role: "admin" },
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      };

      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: admin }, error: null }),
        },
      }));

      const req = new NextRequest("http://localhost:3000/api/admin/dramas/invalid-slug-123");
      const params = Promise.resolve({ id: "invalid-slug-123" });

      const response = await getDramaById(req, { params });
      assert.equal(response.status, 400);

      const body = await response.json();
      assert.equal(body.error?.code, "INVALID_ID");
    });
  });

  describe("PATCH /api/admin/dramas/[id]", () => {
    it("returns 401 UNAUTHORIZED when unauthenticated", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: null }, error: null }),
        },
      }));

      const req = new NextRequest(`http://localhost:3000/api/admin/dramas/${VALID_UUID}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated" }),
      });
      const params = Promise.resolve({ id: VALID_UUID });

      const response = await patchDramaById(req, { params });
      assert.equal(response.status, 401);
    });

    it("returns 403 FORBIDDEN for regular user with forged metadata", async () => {
      const attacker: User = {
        id: "attacker-1",
        email: "hacker@test.local",
        app_metadata: {},
        user_metadata: { role: "admin" },
        aud: "authenticated",
        created_at: new Date().toISOString(),
      };

      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: attacker }, error: null }),
        },
      }));

      const req = new NextRequest(`http://localhost:3000/api/admin/dramas/${VALID_UUID}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated" }),
      });
      const params = Promise.resolve({ id: VALID_UUID });

      const response = await patchDramaById(req, { params });
      assert.equal(response.status, 403);
    });

    it("returns 400 for empty update payload", async () => {
      const admin: User = {
        id: "admin-1",
        email: "admin@dramashort.com",
        app_metadata: { role: "admin" },
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      };

      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: admin }, error: null }),
        },
      }));

      setTestContentAdminClientFactory(() => ({
        from: () => ({
          update: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }));

      const req = new NextRequest(`http://localhost:3000/api/admin/dramas/${VALID_UUID}`, {
        method: "PATCH",
        body: JSON.stringify({}),
      });
      const params = Promise.resolve({ id: VALID_UUID });

      const response = await patchDramaById(req, { params });
      assert.equal(response.status, 400);

      const body = await response.json();
      assert.equal(body.error?.code, "VALIDATION_ERROR");
    });
  });
});
