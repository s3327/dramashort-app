import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { titles } from "../data/titles.mock";
import { channels } from "../data/channels.mock";
import { getChannelCode, createDramaSlug } from "../lib/slug";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const contentUrl = process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL;
const serviceKey =
  process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_CONTENT_SUPABASE_ANON_KEY;

if (!contentUrl || !serviceKey) {
  console.error("❌ Missing NEXT_PUBLIC_CONTENT_SUPABASE_URL or CONTENT_SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(contentUrl, serviceKey, {
  auth: { persistSession: false },
});

const isCleanOnly = process.argv.includes("--clean");
const shouldReset = process.argv.includes("--reset") || isCleanOnly;

async function run() {
  console.log("🚀 Starting Content Database Seed / Maintenance Script...");

  if (shouldReset) {
    console.log("🧹 Cleaning existing development data...");
    // Cascades or delete in order: episodes -> titles -> channels
    await supabase.from("episodes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("titles").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("channels").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    console.log("✅ Tables cleared.");

    if (isCleanOnly) {
      console.log("Done clean.");
      return;
    }
  }

  // 1. Seed Channels
  console.log("📡 Seeding channels with acronym codes...");
  const channelInserts = channels.map((c) => ({
    name: c.name,
    slug: c.slug,
    code: getChannelCode(c.slug),
    description: `Official channel for ${c.name}`,
  }));

  const { data: insertedChannels, error: chanErr } = await supabase
    .from("channels")
    .upsert(channelInserts, { onConflict: "slug" })
    .select();

  if (chanErr) {
    console.error("❌ Error inserting channels:", chanErr);
    process.exit(1);
  }

  const channelMap = new Map<string, { id: string; code: string; name: string }>();
  insertedChannels?.forEach((c) => {
    channelMap.set(c.name, { id: c.id, code: c.code, name: c.name });
  });

  // 2. Seed Titles with new -<acronym> slugs
  console.log(`🎬 Seeding ${titles.length} mock drama titles with channel-acronym slugs...`);

  const titleRows = titles.map((t) => {
    const chan = channelMap.get(t.channel) || {
      id: undefined,
      code: getChannelCode(t.channel),
      name: t.channel,
    };
    const newSlug = createDramaSlug(t.title, chan.code);

    return {
      title: t.title,
      slug: newSlug,
      channel_id: chan.id,
      channel_name: chan.name,
      channel_code: chan.code,
      poster_url: t.poster,
      synopsis: t.synopsis,
      genre: t.genre,
      tags: t.tags || [],
      total_episodes: t.totalEpisodes || 1,
      rating: t.rating || 0.0,
      views_count: t.views || 0,
      status: t.status || "Published",
      release_year: t.year || 2026,
    };
  });

  const { data: insertedTitles, error: titleErr } = await supabase
    .from("titles")
    .upsert(titleRows, { onConflict: "slug" })
    .select();

  if (titleErr) {
    console.error("❌ Error inserting titles:", titleErr);
    process.exit(1);
  }

  console.log(`✅ Successfully seeded ${insertedTitles?.length || 0} titles!`);

  // 3. Seed Sample Episodes (first 5 episodes for each title as demo)
  console.log("🎞️ Seeding demo episodes for each title...");
  const episodeRows: any[] = [];

  insertedTitles?.forEach((title) => {
    const episodeCount = Math.min(title.total_episodes, 5);
    for (let ep = 1; ep <= episodeCount; ep++) {
      episodeRows.push({
        title_id: title.id,
        episode_number: ep,
        title: `Episode ${ep}`,
        video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        thumbnail_url: title.poster_url,
        duration_seconds: 90,
        is_free: ep <= 3,
      });
    }
  });

  const { error: epErr } = await supabase
    .from("episodes")
    .upsert(episodeRows, { onConflict: "title_id,episode_number" });

  if (epErr) {
    console.warn("⚠️ Warning: could not seed sample episodes:", epErr.message);
  } else {
    console.log(`✅ Seeded ${episodeRows.length} sample episodes.`);
  }

  console.log("\n🎉 Development Content Database is ready!");
  console.log("Sample Slugs Generated:");
  insertedTitles?.slice(0, 5).forEach((t) => {
    console.log(` - /drama/${t.slug} (${t.channel_name})`);
  });
}

run().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
