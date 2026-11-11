/**
 * Load QuickCloud / HTC parent Twilio credentials (subaccount create only).
 * Never use these as a venue Messaging Service / Brand / Campaign / phone.
 */
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { resolveHtcDeployEnvironment } from "@/lib/sms/venue-twilio-runtime";
import type { TwilioCredentials } from "@/lib/sms/twilio-http";
import { HTC_PRIMARY_CUSTOMER_PROFILE_SID } from "@/lib/sms/twilio-protected-resources";

export function parentTwilioSecretId(): string {
  const explicit = process.env.TWILIO_PARENT_SECRET_ID?.trim();
  if (explicit) return explicit;
  const env = resolveHtcDeployEnvironment();
  if (!env) {
    throw new Error("Parent Twilio secret id is not configured for this environment.");
  }
  return `htc/${env}/twilio`;
}

export function parentPrimaryCustomerProfileSid(): string {
  return (
    process.env.TWILIO_PRIMARY_CUSTOMER_PROFILE_SID?.trim()
    || HTC_PRIMARY_CUSTOMER_PROFILE_SID
  );
}

/** Trust Hub policy SIDs (Twilio-published). */
export const TWILIO_SECONDARY_CUSTOMER_PROFILE_POLICY_SID =
  "RNdfbf3fae0e1107f8aded0e7cead80bf5" as const;
export const TWILIO_A2P_MESSAGING_PROFILE_POLICY_SID =
  "RNb0d4771c2c98518d916a3d4cd70a8f8b" as const;

let cached: { expiresAt: number; value: TwilioCredentials } | null = null;

function parseParentSecret(raw: string): TwilioCredentials {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const accountSid = String(
    parsed.TWILIO_ACCOUNT_SID ?? parsed.account_sid ?? parsed.accountSid ?? "",
  ).trim();
  const authToken = String(
    parsed.TWILIO_AUTH_TOKEN ?? parsed.auth_token ?? parsed.authToken ?? "",
  ).trim();
  if (!accountSid || !authToken) {
    throw new Error("Parent Twilio secret missing account sid or auth token.");
  }
  return { accountSid, authToken };
}

/** Test-only: TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN env. */
function fromEnv(): TwilioCredentials | null {
  if (process.env.NODE_ENV !== "test") return null;
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!accountSid || !authToken) return null;
  return { accountSid, authToken };
}

export async function loadParentTwilioCredentials(): Promise<TwilioCredentials> {
  const fromTest = fromEnv();
  if (fromTest) return fromTest;

  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1",
  });
  const out = await client.send(new GetSecretValueCommand({
    SecretId: parentTwilioSecretId(),
  }));
  if (!out.SecretString) throw new Error("Parent Twilio secret is empty.");
  const value = parseParentSecret(out.SecretString);
  cached = { value, expiresAt: Date.now() + 60_000 };
  return value;
}

export function clearParentTwilioCredentialCache(): void {
  cached = null;
}
