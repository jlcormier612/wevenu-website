/**
 * Runtime guards for venue Twilio ISV config/secrets.
 *
 * HTC ECS sets NODE_ENV=production for both sandbox and production
 * (infra/htc-ecs-stack.json). Deploy env is distinguished by
 * EnvironmentName → QUICKBOOKS_ENVIRONMENT (sandbox|production) today.
 * Secret namespaces follow htc/{sandbox|production}/…
 */
export type HtcDeployEnvironment = "sandbox" | "production";

/** True only for automated tests — never on ECS (NODE_ENV=production). */
export function twilioVenueTestOverridesAllowed(): boolean {
  return process.env.NODE_ENV === "test";
}

/**
 * Resolve sandbox vs production for secret namespaces.
 * Returns null when production-like runtime cannot establish the env → fail closed.
 */
export function resolveHtcDeployEnvironment(): HtcDeployEnvironment | null {
  const qb = process.env.QUICKBOOKS_ENVIRONMENT?.trim();
  if (qb === "sandbox" || qb === "production") return qb;

  const htc = (process.env.HTC_ENVIRONMENT ?? process.env.EnvironmentName)?.trim();
  if (htc === "sandbox" || htc === "production") return htc;

  // Local / unit tests (NODE_ENV is never "production" on ECS sandbox/prod tasks).
  if (process.env.NODE_ENV !== "production") return "sandbox";

  return null;
}

/**
 * Secrets Manager prefix for per-venue Twilio credentials:
 *   htc/sandbox/twilio/venues/{AccountSid}
 *   htc/production/twilio/venues/{AccountSid}
 *
 * Explicit TWILIO_VENUE_SECRET_PREFIX wins when set, but production cannot
 * point at the sandbox namespace.
 */
export function venueTwilioSecretPrefix(): string {
  const explicit = process.env.TWILIO_VENUE_SECRET_PREFIX?.trim();
  const deployEnv = resolveHtcDeployEnvironment();

  if (explicit) {
    if (deployEnv === "production" && /(^|\/)sandbox(\/|$)/i.test(explicit)) {
      throw new Error(
        "Twilio venue secret prefix cannot use the sandbox namespace in production.",
      );
    }
    return explicit.replace(/\/+$/, "");
  }

  if (!deployEnv) {
    throw new Error(
      "Twilio venue secret prefix is not configured for this environment.",
    );
  }

  return `htc/${deployEnv}/twilio/venues`;
}
