import path from "path";
import type { NextConfig } from "next";

const redirects = [
  // Legacy Wevenu marketing path — no customer-facing Wevenu branding on destination.
  { source: "/why-wevenu", destination: "/our-story", permanent: true },
  // Retired public marketing Resources/Library directory (not the in-app Library).
  // next.config is the sole authority (resources page removed to avoid duplicate redirects).
  { source: "/resources", destination: "/features", permanent: true },
  { source: "/resources/", destination: "/features", permanent: true },
  { source: "/resources/:path*", destination: "/features", permanent: true },
  // Retired public System Status page — send visitors to Our Promise.
  { source: "/status", destination: "/trust", permanent: true },
  { source: "/status/", destination: "/trust", permanent: true },
];

const nextConfig: NextConfig = {
  // ECS/Docker deployment — docs/aws-cloudformation-ecs-deployment-plan.md.
  output: "standalone",
  // Repo root so marketing can import shared/relationships, shared/email,
  // shared/product-account, etc. — also required so the standalone output's
  // file tracer includes those sibling files (they live outside this app's
  // own directory), not just so Turbopack can resolve them at build time.
  outputFileTracingRoot: path.join(__dirname, ".."),
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
    return redirects;
  },
};

export default nextConfig;
