import type { Channel } from "@/types/content";

export type { Channel };

// Mock data — stands in for a "GET /channels" response. Which titles
// belong to each channel now lives in data/titles.mock.ts (Title.channel,
// matched against Channel.name here) — this file is just the channel
// list/metadata itself.
export const channels: Channel[] = [
  { slug: "dramashort-originals", name: "DramaShort Originals" },
  { slug: "velvet-frame", name: "Velvet Frame" },
  { slug: "golden-hour-studios", name: "Golden Hour Studios" },
  { slug: "nightingale-pictures", name: "Nightingale Pictures" },
];
