import { imageRemotePatterns } from "./lib/config/image-hosts.mjs";
import { getSecurityHeaders } from "./lib/config/security-headers.mjs";
import { validateEnvironment } from "./lib/config/env-validator.mjs";

if (process.env.NODE_ENV === "production") {
  validateEnvironment(process.env, { throws: true });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: imageRemotePatterns,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: getSecurityHeaders(),
      },
    ];
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
