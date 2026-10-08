import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as postUploadArtworkRoute } from "@/app/api/admin/artwork/upload/route";
import { POST as postSignedUrlRoute } from "@/app/api/admin/artwork/signed-url/route";
import { POST as postDramaRoute } from "@/app/api/admin/dramas/route";
import { PATCH as patchDramaRoute } from "@/app/api/admin/dramas/[id]/route";
import {
  validateArtworkFile,
  detectImageDimensions,
  ARTWORK_LIMITS,
} from "@/lib/validation/artwork";
import { setTestUserServerClientFactory } from "@/lib/supabase/user-server";
import { setTestContentAdminClientFactory } from "@/lib/supabase/content";
import type { User } from "@supabase/supabase-js";

/* -------------------------------------------------------------------------- */
/* Helpers: Synthetic Image Buffer Generators                                  */
/* -------------------------------------------------------------------------- */

/**
 * Creates a valid synthetic PNG buffer with custom width and height in IHDR.
 */
function createMockPng(width: number, height: number): Buffer {
  const buf = Buffer.alloc(33);
  // PNG Magic bytes
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  buf[4] = 0x0d;
  buf[5] = 0x0a;
  buf[6] = 0x1a;
  buf[7] = 0x0a;

  // IHDR chunk length (13)
  buf.writeUInt32BE(13, 8);
  // IHDR chunk type
  buf.write("IHDR", 12, "ascii");
  // Width & Height
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  // Bit depth, Color type, Comp, Filter, Interlace
  buf[24] = 8;
  buf[25] = 2;
  buf[26] = 0;
  buf[27] = 0;
  buf[28] = 0;
  // CRC
  buf.writeUInt32BE(0, 29);
  return buf;
}

/**
 * Creates a valid synthetic JPEG buffer with custom width and height in SOF0.
 */
function createMockJpeg(width: number, height: number): Buffer {
  const buf = Buffer.alloc(30);
  // SOI marker
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  // SOF0 marker
  buf[3] = 0xc0;
  // Segment length (17)
  buf.writeUInt16BE(17, 4);
  // Data precision
  buf[6] = 8;
  // Height & Width
  buf.writeUInt16BE(height, 7);
  buf.writeUInt16BE(width, 9);
  // Number of components
  buf[11] = 3;
  // Dummy bytes
  buf.fill(0, 12, 28);
  // EOI marker
  buf[28] = 0xff;
  buf[29] = 0xd9;
  return buf;
}

/**
 * Creates a valid synthetic WebP buffer with custom width and height in VP8 chunk.
 */
function createMockWebp(width: number, height: number): Buffer {
  const buf = Buffer.alloc(32);
  // RIFF
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(24, 4);
  // WEBP
  buf.write("WEBP", 8, "ascii");
  // VP8 chunk
  buf.write("VP8 ", 12, "ascii");
  buf.writeUInt32LE(16, 16); // chunk size
  // Frame tag (3 bytes)
  buf[20] = 0;
  buf[21] = 0;
  buf[22] = 0;
  // Start code
  buf[23] = 0x9d;
  buf[24] = 0x01;
  buf[25] = 0x2a;
  // Width & Height (14 bits each LE)
  buf.writeUInt16LE(width & 0x3fff, 26);
  buf.writeUInt16LE(height & 0x3fff, 28);
  return buf;
}

/* -------------------------------------------------------------------------- */
/* Mock Users & State                                                         */
/* -------------------------------------------------------------------------- */

const mockAdminUser: User = {
  id: "admin-uuid-1",
  email: "admin@dramashort.com",
  app_metadata: { role: "admin" },
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

const mockRegularUser: User = {
  id: "user-uuid-1",
  email: "user@example.com",
  app_metadata: { role: "authenticated" },
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

describe("Artwork Uploads & Aspect Ratio Validation (Task 16.2)", () => {
  let mockStorageUploads: any[] = [];
  let mockTitles: any[] = [];
  let mockChannels: any[] = [];

  function setupMockClients() {
    setTestContentAdminClientFactory(() => ({
      storage: {
        from: (bucket: string) => ({
          upload: async (path: string, buffer: Buffer, opts?: any) => {
            mockStorageUploads.push({ bucket, path, size: buffer.length, opts });
            return { error: null };
          },
          getPublicUrl: (path: string) => ({
            data: {
              publicUrl: `https://test-project.supabase.co/storage/v1/object/public/${bucket}/${path}`,
            },
          }),
          createSignedUploadUrl: async (path: string) => ({
            data: {
              signedUrl: `https://test-project.supabase.co/storage/v1/object/upload/sign/${bucket}/${path}?token=mock-token`,
              token: "mock-token",
              path,
            },
            error: null,
          }),
        }),
      },
      from: (table: string) => {
        let currentTable = table;
        let selectedRows: any[] = [];
        let filters: Array<(row: any) => boolean> = [];

        function getTargetStore() {
          if (currentTable === "titles") return mockTitles;
          if (currentTable === "channels") return mockChannels;
          return [];
        }

        const qb: any = {
          select: (cols = "*") => {
            selectedRows = [...getTargetStore()];
            return qb;
          },
          insert: (data: any) => {
            const arr = Array.isArray(data) ? data : [data];
            const store = getTargetStore();
            const inserted = arr.map((item) => {
              const row = {
                id: item.id || `title-${Math.random().toString(36).substring(2, 9)}`,
                created_at: new Date().toISOString(),
                ...item,
              };
              store.push(row);
              return row;
            });
            return {
              select: () => ({
                single: async () => ({ data: inserted[0], error: null }),
              }),
            };
          },
          update: (data: any) => {
            return {
              eq: (col: string, val: any) => {
                const store = getTargetStore();
                const matched = store.filter((r) => r[col] === val);
                matched.forEach((r) => Object.assign(r, data));
                return {
                  select: () => ({
                    single: async () => ({ data: matched[0] || null, error: null }),
                    maybeSingle: async () => ({ data: matched[0] || null, error: null }),
                  }),
                };
              },
            };
          },
          eq: (col: string, val: any) => {
            filters.push((r) => r[col] === val);
            return qb;
          },
          neq: (col: string, val: any) => {
            filters.push((r) => r[col] !== val);
            return qb;
          },
          ilike: (col: string, pattern: string) => {
            const raw = pattern.replace(/%/g, "").toLowerCase();
            filters.push((r) => String(r[col] || "").toLowerCase().includes(raw));
            return qb;
          },
          limit: () => qb,
          maybeSingle: async () => {
            let res = selectedRows;
            for (const f of filters) res = res.filter(f);
            return { data: res[0] || null, error: null };
          },
          single: async () => {
            let res = selectedRows;
            for (const f of filters) res = res.filter(f);
            return { data: res[0] || null, error: null };
          },
        };
        return qb;
      },
    } as any));
  }

  beforeEach(() => {
    mockStorageUploads = [];
    mockTitles = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "Test Existing Drama",
        slug: "test-existing-drama",
        poster_url: "https://example.com/poster.jpg",
        banner_url: "https://example.com/banner.jpg",
        status: "Draft",
        channel_name: "DramaShort Originals",
        total_episodes: 40,
        free_episodes_count: 5,
        created_at: new Date().toISOString(),
      },
    ];
    mockChannels = [
      {
        id: "chan-1",
        name: "DramaShort Originals",
        slug: "dramashort-originals",
        code: "ds",
      },
    ];
    setupMockClients();
  });

  afterEach(() => {
    setTestUserServerClientFactory(null);
    setTestContentAdminClientFactory(null);
  });

  /* ------------------------------------------------------------------------ */
  /* 1. Pure Binary Dimension & Aspect Ratio Validator                        */
  /* ------------------------------------------------------------------------ */

  describe("Binary Image Parser & Validator (validateArtworkFile)", () => {
    it("detects PNG, JPEG, and WebP dimensions correctly", () => {
      const png = createMockPng(600, 900);
      const pngDim = detectImageDimensions(png);
      assert.deepEqual(pngDim, { width: 600, height: 900, format: "png" });

      const jpeg = createMockJpeg(1280, 720);
      const jpegDim = detectImageDimensions(jpeg);
      assert.deepEqual(jpegDim, { width: 1280, height: 720, format: "jpeg" });

      const webp = createMockWebp(1920, 1080);
      const webpDim = detectImageDimensions(webp);
      assert.deepEqual(webpDim, { width: 1920, height: 1080, format: "webp" });
    });

    it("rejects empty buffer", () => {
      const res = validateArtworkFile(Buffer.alloc(0), "image/png", "poster");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.match(res.error, /Empty file received/);
      }
    });

    it("rejects file exceeding max size (5 MB)", () => {
      const largeBuffer = Buffer.alloc(ARTWORK_LIMITS.maxSizeBytes + 1024);
      const res = validateArtworkFile(largeBuffer, "image/png", "poster");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.match(res.error, /exceeds the 5 MB limit/);
      }
    });

    it("rejects unsupported MIME types", () => {
      const buf = createMockPng(600, 900);
      const res = validateArtworkFile(buf, "image/gif", "poster");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.match(res.error, /Unsupported image format/);
      }
    });

    it("validates compliant poster artwork (~2:3 vertical aspect ratio)", () => {
      // 600x900 is exactly 2:3 (ratio 0.6667)
      const validPoster = createMockPng(600, 900);
      const res = validateArtworkFile(validPoster, "image/png", "poster");
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value.width, 600);
        assert.equal(res.value.height, 900);
        assert.equal(res.value.format, "png");
        assert.ok(Math.abs(res.value.aspectRatio - 2 / 3) < 0.01);
      }
    });

    it("rejects square (1:1) or landscape image uploaded as poster", () => {
      const squareImage = createMockPng(600, 600);
      const resSquare = validateArtworkFile(squareImage, "image/png", "poster");
      assert.equal(resSquare.ok, false);
      if (!resSquare.ok) {
        assert.match(resSquare.error, /Invalid poster aspect ratio/);
      }

      const landscapeImage = createMockPng(1200, 800);
      const resLandscape = validateArtworkFile(landscapeImage, "image/png", "poster");
      assert.equal(resLandscape.ok, false);
      if (!resLandscape.ok) {
        assert.match(resLandscape.error, /Invalid poster aspect ratio/);
      }
    });

    it("rejects poster images below minimum resolution (300x450)", () => {
      const smallPoster = createMockPng(200, 300); // 2:3 ratio but too small
      const res = validateArtworkFile(smallPoster, "image/png", "poster");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.match(res.error, /Poster image is too small/);
      }
    });

    it("validates compliant banner artwork (~16:9 landscape aspect ratio)", () => {
      // 1280x720 is exactly 16:9 (ratio 1.7778)
      const validBanner = createMockJpeg(1280, 720);
      const res = validateArtworkFile(validBanner, "image/jpeg", "banner");
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value.width, 1280);
        assert.equal(res.value.height, 720);
        assert.equal(res.value.format, "jpeg");
        assert.ok(Math.abs(res.value.aspectRatio - 16 / 9) < 0.01);
      }
    });

    it("rejects portrait (2:3) or square image uploaded as banner", () => {
      const portraitBanner = createMockJpeg(800, 1200);
      const resPortrait = validateArtworkFile(portraitBanner, "image/jpeg", "banner");
      assert.equal(resPortrait.ok, false);
      if (!resPortrait.ok) {
        assert.match(resPortrait.error, /Invalid banner aspect ratio/);
      }
    });

    it("rejects banner images below minimum resolution (640x360)", () => {
      const smallBanner = createMockJpeg(480, 270); // 16:9 ratio but too small
      const res = validateArtworkFile(smallBanner, "image/jpeg", "banner");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.match(res.error, /Banner image is too small/);
      }
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 2. Direct Multipart Upload Route: POST /api/admin/artwork/upload          */
  /* ------------------------------------------------------------------------ */

  describe("Artwork Multipart Upload Endpoint (POST /api/admin/artwork/upload)", () => {
    it("rejects unauthenticated requests with 401", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: null }, error: null }),
        },
      } as any));

      const req = new NextRequest("http://localhost/api/admin/artwork/upload", {
        method: "POST",
      });
      const res = await postUploadArtworkRoute(req);
      assert.equal(res.status, 401);
    });

    it("rejects non-admin users with 403", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: mockRegularUser }, error: null }),
        },
      } as any));

      const req = new NextRequest("http://localhost/api/admin/artwork/upload", {
        method: "POST",
      });
      const res = await postUploadArtworkRoute(req);
      assert.equal(res.status, 403);
    });

    it("rejects requests missing file or invalid type", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: mockAdminUser }, error: null }),
        },
      } as any));

      const formData = new FormData();
      formData.append("type", "poster");

      const req = new NextRequest("http://localhost/api/admin/artwork/upload", {
        method: "POST",
        body: formData,
      });

      const res = await postUploadArtworkRoute(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.match(json.error.message, /valid image file is required/);
    });

    it("rejects invalid aspect ratio with 400 validation error", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: mockAdminUser }, error: null }),
        },
      } as any));

      const squarePng = createMockPng(600, 600);
      const blob = new Blob([squarePng], { type: "image/png" });
      const formData = new FormData();
      formData.append("file", blob, "square.png");
      formData.append("type", "poster");

      const req = new NextRequest("http://localhost/api/admin/artwork/upload", {
        method: "POST",
        body: formData,
      });

      const res = await postUploadArtworkRoute(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.match(json.error.message, /Invalid poster aspect ratio/);
    });

    it("successfully uploads valid poster (2:3) to storage bucket", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: mockAdminUser }, error: null }),
        },
      } as any));

      const posterPng = createMockPng(600, 900);
      const blob = new Blob([posterPng], { type: "image/png" });
      const formData = new FormData();
      formData.append("file", blob, "poster.png");
      formData.append("type", "poster");

      const req = new NextRequest("http://localhost/api/admin/artwork/upload", {
        method: "POST",
        body: formData,
      });

      const res = await postUploadArtworkRoute(req);
      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.type, "poster");
      assert.equal(json.data.width, 600);
      assert.equal(json.data.height, 900);
      assert.equal(json.data.format, "png");
      assert.match(json.data.url, /supabase\.co\/storage\/v1\/object\/public\/artwork\/posters\//);

      // Verify storage call
      assert.equal(mockStorageUploads.length, 1);
      assert.equal(mockStorageUploads[0].bucket, "artwork");
      assert.match(mockStorageUploads[0].path, /^posters\//);
    });

    it("successfully uploads valid banner (16:9) to storage bucket", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: mockAdminUser }, error: null }),
        },
      } as any));

      const bannerJpeg = createMockJpeg(1280, 720);
      const blob = new Blob([bannerJpeg], { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", blob, "banner.jpg");
      formData.append("type", "banner");

      const req = new NextRequest("http://localhost/api/admin/artwork/upload", {
        method: "POST",
        body: formData,
      });

      const res = await postUploadArtworkRoute(req);
      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.type, "banner");
      assert.equal(json.data.width, 1280);
      assert.equal(json.data.height, 720);
      assert.equal(json.data.format, "jpeg");
      assert.match(json.data.url, /supabase\.co\/storage\/v1\/object\/public\/artwork\/banners\//);

      assert.equal(mockStorageUploads.length, 1);
      assert.equal(mockStorageUploads[0].bucket, "artwork");
      assert.match(mockStorageUploads[0].path, /^banners\//);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 3. Signed URL Endpoint: POST /api/admin/artwork/signed-url                 */
  /* ------------------------------------------------------------------------ */

  describe("Signed Upload URL Endpoint (POST /api/admin/artwork/signed-url)", () => {
    it("rejects unauthorized calls", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: null }, error: null }),
        },
      } as any));

      const req = new NextRequest("http://localhost/api/admin/artwork/signed-url", {
        method: "POST",
        body: JSON.stringify({ type: "poster", filename: "test.png", mimeType: "image/png" }),
      });
      const res = await postSignedUrlRoute(req);
      assert.equal(res.status, 401);
    });

    it("rejects unsupported MIME type", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: mockAdminUser }, error: null }),
        },
      } as any));

      const req = new NextRequest("http://localhost/api/admin/artwork/signed-url", {
        method: "POST",
        body: JSON.stringify({ type: "poster", filename: "test.gif", mimeType: "image/gif" }),
      });
      const res = await postSignedUrlRoute(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.match(json.error.message, /Unsupported mimeType/);
    });

    it("rejects declared fileSize exceeding 5 MB", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: mockAdminUser }, error: null }),
        },
      } as any));

      const req = new NextRequest("http://localhost/api/admin/artwork/signed-url", {
        method: "POST",
        body: JSON.stringify({
          type: "banner",
          filename: "test.jpg",
          mimeType: "image/jpeg",
          fileSize: 10 * 1024 * 1024,
        }),
      });
      const res = await postSignedUrlRoute(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.match(json.error.message, /File size exceeds 5 MB limit/);
    });

    it("returns signed URL and publicUrl for valid request", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: mockAdminUser }, error: null }),
        },
      } as any));

      const req = new NextRequest("http://localhost/api/admin/artwork/signed-url", {
        method: "POST",
        body: JSON.stringify({
          type: "poster",
          filename: "poster-upload.webp",
          mimeType: "image/webp",
          fileSize: 1024 * 1024,
        }),
      });
      const res = await postSignedUrlRoute(req);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.signedUrl);
      assert.ok(json.data.token);
      assert.match(json.data.path, /^posters\//);
      assert.match(json.data.publicUrl, /supabase\.co\/storage\/v1\/object\/public\/artwork\/posters\//);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 4. Drama API Integration with Banner URL                                 */
  /* ------------------------------------------------------------------------ */

  describe("Drama API Artwork Persistence", () => {
    it("creates drama with banner_url and poster_url in POST /api/admin/dramas", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: mockAdminUser }, error: null }),
        },
      } as any));

      const req = new NextRequest("http://localhost/api/admin/dramas", {
        method: "POST",
        body: JSON.stringify({
          title: "New Drama with Artwork",
          posterUrl: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=800",
          bannerUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1600",
          genre: "Revenge",
          status: "Draft",
        }),
      });

      const res = await postDramaRoute(req);
      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.bannerUrl, "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1600");

      // Verify row in mock table
      const createdRow = mockTitles.find((r) => r.title === "New Drama with Artwork");
      assert.ok(createdRow);
      assert.equal(createdRow.banner_url, "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1600");
    });

    it("updates drama banner_url in PATCH /api/admin/dramas/[id]", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: mockAdminUser }, error: null }),
        },
      } as any));

      const dramaId = "11111111-1111-4111-8111-111111111111";
      const newBanner = "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1600";

      const req = new NextRequest(`http://localhost/api/admin/dramas/${dramaId}`, {
        method: "PATCH",
        body: JSON.stringify({
          bannerUrl: newBanner,
        }),
      });

      const res = await patchDramaRoute(req, { params: Promise.resolve({ id: dramaId }) });
      assert.equal(res.status, 200);

      const updatedRow = mockTitles.find((r) => r.id === dramaId);
      assert.ok(updatedRow);
      assert.equal(updatedRow.banner_url, newBanner);
    });
  });
});
