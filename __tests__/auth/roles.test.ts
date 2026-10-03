import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getUserRole, hasRole } from "@/lib/auth/roles";

describe("Auth Roles & Privilege Security (Task 10.1)", () => {
  it("authorizes user when app_metadata.role is 'admin'", () => {
    const adminUser = {
      id: "u-admin-1",
      email: "admin@dramashort.com",
      app_metadata: { role: "admin" },
      user_metadata: {},
    };

    assert.equal(getUserRole(adminUser), "admin");
    assert.equal(hasRole(adminUser, ["admin"]), true);
    assert.equal(hasRole(adminUser, ["editor"]), false);
  });

  it("authorizes user when app_metadata.role is 'editor'", () => {
    const editorUser = {
      id: "u-editor-1",
      email: "editor@dramashort.com",
      app_metadata: { role: "editor" },
      user_metadata: {},
    };

    assert.equal(getUserRole(editorUser), "editor");
    assert.equal(hasRole(editorUser, ["editor"]), true);
    assert.equal(hasRole(editorUser, ["admin", "editor"]), true);
    assert.equal(hasRole(editorUser, ["admin"]), false);
  });

  it("rejects client-side self-elevation when user_metadata.role is 'admin' but app_metadata is missing", () => {
    // Malicious or exploited payload where client called supabase.auth.updateUser({ data: { role: 'admin' } })
    const attackerUser = {
      id: "u-attacker-1",
      email: "attacker@example.com",
      app_metadata: {}, // no service-role assigned role
      user_metadata: { role: "admin", display_name: "Hacker" },
    };

    assert.equal(getUserRole(attackerUser), null);
    assert.equal(hasRole(attackerUser, ["admin"]), false);
    assert.equal(hasRole(attackerUser, ["admin", "editor"]), false);
  });

  it("rejects unknown or invalid role strings in app_metadata", () => {
    const invalidRoleUser = {
      id: "u-invalid-1",
      email: "user@example.com",
      app_metadata: { role: "superuser" },
      user_metadata: {},
    };

    assert.equal(getUserRole(invalidRoleUser), null);
    assert.equal(hasRole(invalidRoleUser), false);
  });

  it("safely handles null, undefined, or empty user objects", () => {
    assert.equal(getUserRole(null), null);
    assert.equal(getUserRole(undefined), null);
    assert.equal(getUserRole({}), null);
    assert.equal(hasRole(null), false);
    assert.equal(hasRole(undefined), false);
  });
});
