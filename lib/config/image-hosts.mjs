// Single source of truth for remote image hosts. Imported by next.config.mjs
// (images.remotePatterns) and by lib/validation/drama.ts, so the API rejects
// exactly the poster URLs that next/image would refuse to render.
// Hostname wildcards follow next/image: "*" = one subdomain label, "**" = any.
export const imageRemotePatterns = [
  {
    protocol: "https",
    hostname: "images.unsplash.com",
  },
  {
    protocol: "https",
    hostname: "*.supabase.co",
    pathname: "/storage/v1/object/public/**",
  },
  {
    protocol: "https",
    hostname: "czkkzoiuyqybafacpgsp.supabase.co",
  },
  {
    protocol: "https",
    hostname: "bpidsbcrvpkavvdvtpgh.supabase.co",
  },
];
