import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GET } from "@/app/api/playback/[episodeId]/route";
import { NextRequest } from "next/server";

describe("GET /api/playback/[episodeId] Route Handler (Task 10.6)", () => {
  it("rejects non-UUID episode ID with 400 INVALID_ID", async () => {
    const request = new NextRequest("http://localhost:3000/api/playback/invalid-ep-id");
    const params = Promise.resolve({ episodeId: "invalid-ep-id" });

    const response = await GET(request, { params });
    assert.equal(response.status, 400);

    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error?.code, "INVALID_ID");
  });

  it("rejects SQL injection attempt in episodeId with 400 INVALID_ID", async () => {
    const badId = "11111111-1111-4111-8111-111111111111' OR '1'='1";
    const request = new NextRequest(`http://localhost:3000/api/playback/${encodeURIComponent(badId)}`);
    const params = Promise.resolve({ episodeId: badId });

    const response = await GET(request, { params });
    assert.equal(response.status, 400);

    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error?.code, "INVALID_ID");
  });
});
