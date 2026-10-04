import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { getApiErrorMessage, readJsonSafely } from "@/lib/api/error-message";

describe("API response envelope (Task 10.3)", () => {
  it("apiError returns { success: false, error: { code, message } } with the status", async () => {
    const res = apiError("NOT_FOUND", "Drama not found.", 404);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), {
      success: false,
      error: { code: "NOT_FOUND", message: "Drama not found." },
    });
  });

  it("apiError includes details only when provided", async () => {
    const details = [{ field: "title", message: "title is required." }];
    const res = apiError("VALIDATION_ERROR", "Invalid drama payload.", 400, details);
    assert.deepEqual((await res.json()).error.details, details);
  });

  it("apiSuccess wraps data with the given status", async () => {
    const res = apiSuccess({ id: "x" }, 201);
    assert.equal(res.status, 201);
    assert.deepEqual(await res.json(), { success: true, data: { id: "x" } });
  });
});

describe("Client error message extraction", () => {
  it("reads the structured error message", () => {
    const payload = { success: false, error: { code: "FORBIDDEN", message: "Administrator privileges required." } };
    assert.equal(getApiErrorMessage(payload, "fallback"), "Administrator privileges required.");
  });

  it("appends field validation messages", () => {
    const payload = {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid drama payload.",
        details: [
          { field: "title", message: "title is required." },
          { field: "status", message: "status must be one of: Published, Draft, Scheduled, Archived." },
        ],
      },
    };
    assert.equal(
      getApiErrorMessage(payload, "fallback"),
      "Invalid drama payload. title is required. status must be one of: Published, Draft, Scheduled, Archived."
    );
  });

  it("supports the legacy string error and falls back otherwise", () => {
    assert.equal(getApiErrorMessage({ error: "Old style" }, "fallback"), "Old style");
    assert.equal(getApiErrorMessage(null, "fallback"), "fallback");
    assert.equal(getApiErrorMessage({ error: {} }, "fallback"), "fallback");
    assert.equal(getApiErrorMessage("<html>", "fallback"), "fallback");
  });

  it("readJsonSafely returns null for non-JSON bodies", async () => {
    assert.equal(await readJsonSafely(new Response("<html>not json</html>")), null);
    assert.deepEqual(await readJsonSafely(new Response('{"a":1}')), { a: 1 });
  });
});
