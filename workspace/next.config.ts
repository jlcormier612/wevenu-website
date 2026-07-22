import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Repo root so workspace can import shared/relationships.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
