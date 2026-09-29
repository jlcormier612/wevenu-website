import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ECS/Docker deployment — docs/aws-cloudformation-ecs-deployment-plan.md.
  // Produces a minimal, self-contained .next/standalone server instead of
  // requiring the full node_modules tree in the container image.
  output: "standalone",
  // Version skew protection. The venue-app image build sets NEXT_DEPLOYMENT_ID
  // to the git SHA. Unset locally, so `next dev` does not invent an id.
  deploymentId: process.env.NEXT_DEPLOYMENT_ID || undefined,
  // Local Playwright/acceptance often hits 127.0.0.1 while Next serves as localhost.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
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
