# Marketing site - ECS deployment.
# docs/aws-cloudformation-ecs-deployment-plan.md
#
# Build context MUST be the repo root, not marketing/ itself - this app
# imports @shared/relationships, @shared/email, @shared/product-account from
# ../shared (confirmed via marketing/tsconfig.json + next.config.ts's
# outputFileTracingRoot). Building with marketing/ alone as context cannot
# resolve those imports.
#
#   docker build -f marketing/Dockerfile -t htc-marketing .
#
# NEXT_PUBLIC_* values are baked into the client bundle at BUILD time - pass
# real values via --build-arg in the deploy pipeline's image build step.

FROM node:22-alpine AS deps
WORKDIR /repo/marketing
COPY marketing/package.json marketing/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /repo
COPY --from=deps /repo/marketing/node_modules ./marketing/node_modules
COPY shared ./shared
COPY marketing ./marketing
WORKDIR /repo/marketing

ARG NEXT_PUBLIC_MARKETING_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_PRODUCT_APP_URL
ARG NEXT_PUBLIC_CALENDLY_URL
ENV NEXT_PUBLIC_MARKETING_URL=$NEXT_PUBLIC_MARKETING_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_PRODUCT_APP_URL=$NEXT_PUBLIC_PRODUCT_APP_URL \
    NEXT_PUBLIC_CALENDLY_URL=$NEXT_PUBLIC_CALENDLY_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# .next/standalone (traced from the repo root) contains both a root-level
# node_modules (shared/'s own deps) and a marketing/ subfolder (this app's
# server.js + its own node_modules) - confirmed by inspecting the actual
# build output, not assumed from Next.js docs alone. Copying the whole
# standalone dir preserves that structure correctly.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /repo/marketing/.next/standalone ./
COPY --from=builder /repo/marketing/.next/static ./marketing/.next/static
COPY --from=builder /repo/marketing/public ./marketing/public

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "marketing/server.js"]
