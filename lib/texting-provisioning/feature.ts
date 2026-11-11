/**
 * Feature + environment gates for live self-service texting provisioning.
 * Production stays fail-closed unless explicitly enabled (never by default).
 */
import { resolveHtcDeployEnvironment } from "@/lib/sms/venue-twilio-runtime";

/** Opt-in flag — Sandbox ECS should set TEXTING_SELF_SERVICE_ENABLED=1. */
export function isTextingSelfServiceProvisioningEnabled(): boolean {
  const raw = process.env.TEXTING_SELF_SERVICE_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  if (raw === "1" || raw === "true" || raw === "on") return true;
  // Default: enabled in sandbox/test only; never auto-on in production.
  const env = resolveHtcDeployEnvironment();
  return env === "sandbox" || process.env.NODE_ENV === "test";
}

/** Sandbox may use Twilio Mock Brand to complete review-dependent steps. */
export function isTwilioA2pMockEnabled(): boolean {
  const raw = process.env.TWILIO_A2P_USE_MOCK?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  if (raw === "1" || raw === "true" || raw === "on") return true;
  return resolveHtcDeployEnvironment() === "sandbox" || process.env.NODE_ENV === "test";
}
