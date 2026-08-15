# Relationship Workspace (CRM) - ECS deployment.
# docs/aws-cloudformation-ecs-deployment-plan.md
#
# Build context MUST be the repo root, not workspace/ itself - same reason
# as marketing/Dockerfile: imports @shared/relationships, @shared/email,
# @shared/product-account from ../shared.
#
#   docker build -f workspace/Dockerfile -t htc-workspace .
#
# NEXT_PUBLIC_* values are baked into the client bundle at BUILD time - pass
# real values via --build-arg in the deploy pipeline's image build step.
#
# Instance count note (deliberately not addressed by this Dockerfile):
# this app's CRM/"Relationship" data is a local on-disk JSON store
# (shared/relationships), not Postgres - run this service at desired
# count = 1 in ECS, not autoscaled, per the approved deployment plan.

FROM node:22-alpine AS deps
WORKDIR /repo/workspace
COPY workspace/package.json workspace/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /repo
COPY --from=deps /repo/workspace/node_modules ./workspace/node_modules
COPY shared ./shared
COPY workspace ./workspace
WORKDIR /repo/workspace

ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_MARKETING_URL
ARG NEXT_PUBLIC_PRODUCT_APP_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_WORKSPACE_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_MARKETING_URL=$NEXT_PUBLIC_MARKETING_URL \
    NEXT_PUBLIC_PRODUCT_APP_URL=$NEXT_PUBLIC_PRODUCT_APP_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_WORKSPACE_URL=$NEXT_PUBLIC_WORKSPACE_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /repo/workspace/.next/standalone ./
COPY --from=builder /repo/workspace/.next/static ./workspace/.next/static
COPY --from=builder /repo/workspace/public ./workspace/public

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "workspace/server.js"]
