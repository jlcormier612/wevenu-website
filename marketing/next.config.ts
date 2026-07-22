import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Repo root so marketing can import shared/relationships.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
