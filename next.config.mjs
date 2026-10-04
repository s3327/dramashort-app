import { imageRemotePatterns } from "./lib/config/image-hosts.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: imageRemotePatterns,
  },
  async redirects() {
    return [
      {
        source: "/new",
        destination: "/new-release",
        permanent: true,
      },
      {
        source: "/admin/titles",
        destination: "/admin/dramas",
        permanent: true,
      },
      {
        source: "/admin/titles/:id/edit",
        destination: "/admin/dramas/:id/edit",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
