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

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY patches ./patches
RUN npm ci

FROM node:22-alpine AS builder
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
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
