import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ECS/Docker deployment — docs/aws-cloudformation-ecs-deployment-plan.md.
  output: "standalone",
  // Repo root so workspace can import shared/relationships, shared/email,
  // shared/product-account, etc. — also required so the standalone output's
  // file tracer includes those sibling files (they live outside this app's
  // own directory), not just so Turbopack can resolve them at build time.
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
