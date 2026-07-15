import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep this app isolated from the parent product workspace.
  turbopack: {
    root: path.join(__dirname),
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
