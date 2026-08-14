import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ECS/Docker deployment — docs/aws-cloudformation-ecs-deployment-plan.md.
  // Produces a minimal, self-contained .next/standalone server instead of
  // requiring the full node_modules tree in the container image.
  output: "standalone",
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
