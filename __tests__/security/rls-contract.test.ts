import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Database RLS & Schema Access Contract (Task 10.9)", () => {
  const rootDir = process.cwd();

  describe("User Database Migration Contracts (Project 2)", () => {
    const userMigrationsDir = path.join(rootDir, "supabase", "user", "supabase", "migrations");
    const userSql = fs
      .readdirSync(userMigrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => fs.readFileSync(path.join(userMigrationsDir, file), "utf8"))
      .join("\n");

    it("verifies profiles table has Row Level Security enabled", () => {
      assert.match(userSql, /ALTER\s+TABLE\s+(public\.)?profiles\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
    });

    it("CRITICAL: verifies UPDATE grant on profiles strictly excludes the role column", () => {
      // Must grant only safe profile attributes, never role
      assert.match(
        userSql,
        /GRANT\s+UPDATE\s*\(\s*display_name\s*,\s*avatar_url\s*,\s*updated_at\s*\)\s*ON\s+TABLE\s+public\.profiles\s+TO\s+authenticated/i
      );

      // Must NOT grant update on all columns or on role
      assert.doesNotMatch(
        userSql,
        /GRANT\s+UPDATE\s+ON\s+TABLE\s+public\.profiles\s+TO\s+authenticated/i
      );
      assert.doesNotMatch(userSql, /GRANT\s+UPDATE\s*\([^)]*role[^)]*\)\s*ON/i);
    });

    it("verifies INSERT and DELETE on profiles are revoked from authenticated users", () => {
      assert.match(userSql, /REVOKE\s+ALL\s+ON\s+TABLE[\s\S]+?public\.profiles[\s\S]+?FROM\s+anon\s*,\s*authenticated/i);
    });

    it("verifies anon has no default or direct table access in User DB", () => {
      assert.match(userSql, /REVOKE\s+ALL\s+ON\s+TABLE[\s\S]+?FROM\s+anon/i);
      assert.match(userSql, /ALTER\s+DEFAULT\s+PRIVILEGES[\s\S]+?REVOKE\s+ALL\s+ON\s+TABLES\s+FROM\s+anon/i);
    });

    it("verifies cross-user isolation policies on user tables", () => {
      // Check that user_id isolation policies exist for favorites, watch_history, custom_lists
      assert.match(userSql, /ON\s+public\.favorites/i);
      assert.match(userSql, /\(select\s+auth\.uid\(\)\)\s*=\s*user_id/i);
      assert.match(userSql, /ON\s+public\.watch_history/i);
      assert.match(userSql, /ON\s+public\.custom_lists/i);
    });
  });

  describe("Content Database Migration Contracts (Project 1)", () => {
    const contentMigrationsDir = path.join(rootDir, "supabase", "content", "supabase", "migrations");
    const contentSql = fs
      .readdirSync(contentMigrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => fs.readFileSync(path.join(contentMigrationsDir, file), "utf8"))
      .join("\n");

    it("verifies episode_media table has Row Level Security enabled", () => {
      assert.match(contentSql, /ALTER\s+TABLE\s+(public\.)?episode_media\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
    });

    it("verifies episode_media table revokes public access from anon and authenticated", () => {
      assert.match(
        contentSql,
        /REVOKE\s+ALL\s+ON\s+TABLE\s+public\.episode_media\s+FROM\s+anon\s*,\s*authenticated/i
      );
    });

    it("verifies video_url column on episodes is revoked from anon and authenticated", () => {
      // Full table SELECT is revoked, and GRANT SELECT list excludes video_url
      assert.match(
        contentSql,
        /REVOKE\s+SELECT\s+ON\s+TABLE\s+public\.episodes\s+FROM\s+anon\s*,\s*authenticated/i
      );
      assert.match(
        contentSql,
        /GRANT\s+SELECT\s*\(\s*id,\s*title_id,\s*episode_number,\s*title,\s*thumbnail_url,\s*duration_seconds,\s*is_free,\s*created_at\s*\)\s*ON\s+TABLE\s+public\.episodes/i
      );
      assert.doesNotMatch(
        contentSql,
        /GRANT\s+SELECT\s*\([^)]*video_url[^)]*\)\s*ON\s+TABLE\s+public\.episodes/i
      );
    });

    it("verifies episodes SELECT policy restricts reading to Published titles only", () => {
      assert.match(
        contentSql,
        /CREATE\s+POLICY\s+"Public read episodes of published titles"\s+ON\s+public\.episodes\s+FOR\s+SELECT\s+USING\s*\(\s*EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+public\.titles/i
      );
      assert.match(contentSql, /status\s*=\s*'Published'/i);
    });
  });

  describe("Simulated RLS User Isolation Invariants", () => {
    interface UserRow {
      userId: string;
      titleSlug: string;
    }

    it("asserts User A cannot read or modify User B's rows under auth.uid() rule", () => {
      const userA = "11111111-1111-1111-1111-111111111111";
      const userB = "22222222-2222-2222-2222-222222222222";

      const favoritesTable: UserRow[] = [
        { userId: userA, titleSlug: "drama-a" },
        { userId: userB, titleSlug: "drama-b-secret" },
      ];

      // RLS Policy Simulation: auth.uid() = user_id
      const canRead = (actingUser: string, row: UserRow) => actingUser === row.userId;
      const canWrite = (actingUser: string, targetUser: string) => actingUser === targetUser;

      // User A queries favorites
      const visibleToA = favoritesTable.filter((row) => canRead(userA, row));
      assert.equal(visibleToA.length, 1);
      assert.equal(visibleToA[0].titleSlug, "drama-a");

      // User A attempts to write to User B
      assert.equal(canWrite(userA, userB), false);
    });
  });
});
