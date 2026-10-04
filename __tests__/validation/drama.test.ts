import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DRAMA_LIMITS,
  escapeLikePattern,
  isAllowedImageUrl,
  isUuid,
  validateDramaPayload,
} from "@/lib/validation/drama";

function fieldsOf(result: ReturnType<typeof validateDramaPayload>): string[] {
  return result.ok ? [] : result.errors.map((e) => e.field);
}

describe("Drama payload validation (Task 10.3)", () => {
  it("accepts a full create payload and normalizes it", () => {
    const result = validateDramaPayload(
      {
        title: "  The CEO's Secret Wife  ",
        synopsis: " A story. ",
        genre: "Romance",
        tags: "CEO, Revenge, ceo, ,Marriage",
        channel: "DramaShort Originals",
        totalEpisodes: 40,
        poster: "https://images.unsplash.com/photo-1?w=800",
        status: "Draft",
        unknownField: "ignored",
      },
      "create"
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.value, {
      title: "The CEO's Secret Wife",
      synopsis: "A story.",
      genre: "Romance",
      tags: ["CEO", "Revenge", "Marriage"],
      channelName: "DramaShort Originals",
      totalEpisodes: 40,
      posterUrl: "https://images.unsplash.com/photo-1?w=800",
      status: "Draft",
    });
  });

  it("requires title on create but not on update", () => {
    assert.deepEqual(fieldsOf(validateDramaPayload({}, "create")), ["title"]);
    const update = validateDramaPayload({ genre: "Fantasy" }, "update");
    assert.equal(update.ok, true);
  });

  it("rejects empty, non-string, and over-long titles", () => {
    assert.deepEqual(fieldsOf(validateDramaPayload({ title: "   " }, "update")), ["title"]);
    assert.deepEqual(fieldsOf(validateDramaPayload({ title: 42 }, "update")), ["title"]);
    assert.deepEqual(
      fieldsOf(validateDramaPayload({ title: "x".repeat(DRAMA_LIMITS.titleMax + 1) }, "update")),
      ["title"]
    );
  });

  it("allows an empty synopsis but enforces its maximum length", () => {
    assert.equal(validateDramaPayload({ synopsis: "" }, "update").ok, true);
    assert.deepEqual(
      fieldsOf(validateDramaPayload({ synopsis: "x".repeat(DRAMA_LIMITS.synopsisMax + 1) }, "update")),
      ["synopsis"]
    );
  });

  it("only accepts known statuses", () => {
    for (const status of ["Published", "Draft", "Scheduled", "Archived"]) {
      assert.equal(validateDramaPayload({ status }, "update").ok, true, status);
    }
    assert.deepEqual(fieldsOf(validateDramaPayload({ status: "published" }, "update")), ["status"]);
    assert.deepEqual(fieldsOf(validateDramaPayload({ status: "Deleted" }, "update")), ["status"]);
  });

  it("validates totalEpisodes as a whole number within range (either key)", () => {
    const ok = validateDramaPayload({ total_episodes: "80" }, "update");
    assert.equal(ok.ok && ok.value.totalEpisodes, 80);
    for (const bad of [0, 501, 2.5, "abc", "", null, true]) {
      assert.deepEqual(
        fieldsOf(validateDramaPayload({ totalEpisodes: bad }, "update")),
        ["totalEpisodes"],
        `value ${JSON.stringify(bad)}`
      );
    }
  });

  it("validates tags: count, length, and element type", () => {
    const many = Array.from({ length: DRAMA_LIMITS.tagsMax + 1 }, (_, i) => `tag${i}`);
    assert.deepEqual(fieldsOf(validateDramaPayload({ tags: many }, "update")), ["tags"]);
    assert.deepEqual(
      fieldsOf(validateDramaPayload({ tags: ["x".repeat(DRAMA_LIMITS.tagMax + 1)] }, "update")),
      ["tags"]
    );
    assert.deepEqual(fieldsOf(validateDramaPayload({ tags: ["ok", 5] }, "update")), ["tags"]);
    assert.deepEqual(fieldsOf(validateDramaPayload({ tags: { a: 1 } }, "update")), ["tags"]);
    const cleared = validateDramaPayload({ tags: [] }, "update");
    assert.equal(cleared.ok && cleared.value.tags?.length, 0);
  });

  it("rejects non-object bodies", () => {
    for (const body of [null, [], "text", 7]) {
      assert.deepEqual(fieldsOf(validateDramaPayload(body, "update")), ["body"]);
    }
  });

  it("reports every invalid field at once", () => {
    const result = validateDramaPayload(
      { title: "", status: "Nope", totalEpisodes: -1, poster: "http://evil.example/x.png" },
      "create"
    );
    assert.deepEqual(fieldsOf(result).sort(), ["poster", "status", "title", "totalEpisodes"]);
  });
});

describe("Poster host allow-list (shared with next.config.mjs remotePatterns)", () => {
  it("accepts configured hosts", () => {
    assert.equal(isAllowedImageUrl("https://images.unsplash.com/photo-123?w=800"), true);
    assert.equal(
      isAllowedImageUrl("https://abcdefghij.supabase.co/storage/v1/object/public/posters/a.jpg"),
      true
    );
    assert.equal(isAllowedImageUrl("https://czkkzoiuyqybafacpgsp.supabase.co/anything/here.png"), true);
  });

  it("rejects disallowed protocols, hosts, paths, and credentials", () => {
    for (const url of [
      "http://images.unsplash.com/photo-123",
      "https://evil.example/poster.png",
      "https://images.unsplash.com.evil.example/x.png",
      "https://a.b.supabase.co/storage/v1/object/public/x.png",
      "https://abcdefghij.supabase.co/storage/v1/object/sign/x.png",
      "https://user:pass@images.unsplash.com/photo-1",
      "javascript:alert(1)",
      "not a url",
    ]) {
      assert.equal(isAllowedImageUrl(url), false, url);
    }
  });

  it("surfaces a poster error through payload validation", () => {
    assert.deepEqual(
      fieldsOf(validateDramaPayload({ poster: "https://evil.example/a.png" }, "update")),
      ["poster"]
    );
    assert.deepEqual(fieldsOf(validateDramaPayload({ poster: "  " }, "update")), ["poster"]);
  });
});

describe("Helpers", () => {
  it("isUuid accepts canonical UUIDs only", () => {
    assert.equal(isUuid("11111111-1111-1111-1111-111111111111"), true);
    assert.equal(isUuid("t-1"), false);
    assert.equal(isUuid("ceo-secret-wife"), false);
  });

  it("escapeLikePattern escapes wildcards and backslashes", () => {
    assert.equal(escapeLikePattern("100%_real\\"), "100\\%\\_real\\\\");
    assert.equal(escapeLikePattern("Velvet Frame"), "Velvet Frame");
  });
});
