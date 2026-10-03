/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
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
    ],
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
