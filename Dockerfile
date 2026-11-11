# Venue / product app - ECS deployment.
# docs/aws-cloudformation-ecs-deployment-plan.md
#
# Build context: repo root.
#   docker build -f Dockerfile -t htc-venue-app .
#
# NEXT_PUBLIC_* values are baked into the client bundle at BUILD time, not
# read at container runtime - pass real values via --build-arg in the image
# build step of the deploy pipeline. All other (server-only) env vars are
# supplied at ECS task runtime via Secrets Manager/Parameter Store, not here.

# Official Node image via AWS Public ECR (same library tag as Docker Hub).
# Avoids anonymous Docker Hub 429s on CI runners; Node 22 Alpine unchanged.
FROM public.ecr.aws/docker/library/node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY patches ./patches
# postinstall runs copy-pdf-worker.mjs — must exist before npm ci
COPY scripts/copy-pdf-worker.mjs ./scripts/copy-pdf-worker.mjs
RUN npm ci

FROM public.ecr.aws/docker/library/node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_MARKETING_URL
ARG NEXT_PUBLIC_STRIPE_CLIENT_ID
ARG NEXT_PUBLIC_FACEBOOK_APP_ID
ARG NEXT_PUBLIC_QUICKBOOKS_CLIENT_ID
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_NOTIFICATIONS_SECRET
ARG NEXT_PUBLIC_WEVENU_ADMIN
# Git SHA of this image. Next bakes it into the client as deploymentId so a
# browser that hits a different task during a rollout reloads instead of
# failing a Server Action. Must match the runtime env of the same name.
ARG NEXT_DEPLOYMENT_ID
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_MARKETING_URL=$NEXT_PUBLIC_MARKETING_URL \
    NEXT_PUBLIC_STRIPE_CLIENT_ID=$NEXT_PUBLIC_STRIPE_CLIENT_ID \
    NEXT_PUBLIC_FACEBOOK_APP_ID=$NEXT_PUBLIC_FACEBOOK_APP_ID \
    NEXT_PUBLIC_QUICKBOOKS_CLIENT_ID=$NEXT_PUBLIC_QUICKBOOKS_CLIENT_ID \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_PUBLIC_NOTIFICATIONS_SECRET=$NEXT_PUBLIC_NOTIFICATIONS_SECRET \
    NEXT_PUBLIC_WEVENU_ADMIN=$NEXT_PUBLIC_WEVENU_ADMIN \
    NEXT_DEPLOYMENT_ID=$NEXT_DEPLOYMENT_ID \
    NEXT_TELEMETRY_DISABLED=1
# Fail the image build rather than shipping a client bundle that inlined "".
# Also write .env.production so Next/Turbopack inlines NEXT_PUBLIC_* from an
# env file during `next build` (process.env alone was compiling to empty).
RUN test -n "$NEXT_PUBLIC_SUPABASE_URL" \
    && test -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    && test -n "$NEXT_DEPLOYMENT_ID" \
    && printf '%s\n' \
      "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}" \
      "NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
      "NEXT_DEPLOYMENT_ID=${NEXT_DEPLOYMENT_ID}" \
      > .env.production
RUN npm run build

FROM public.ecr.aws/docker/library/node:22-alpine AS runner
WORKDIR /app
ARG NEXT_DEPLOYMENT_ID
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 NEXT_DEPLOYMENT_ID=$NEXT_DEPLOYMENT_ID
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
