import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/success-library", destination: "/help", permanent: true },
      { source: "/success-library/:slug", destination: "/help/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
