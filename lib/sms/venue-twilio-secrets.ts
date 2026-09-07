/**
 * Load per-venue Twilio credentials from AWS Secrets Manager.
 *
 * Secret id: `${prefix}/{AccountSid}` where prefix is resolved by
 * venueTwilioSecretPrefix() (htc/{sandbox|production}/twilio/venues).
 *
 * Expected JSON:
 *   { account_sid, auth_token, api_key_sid, api_key_secret }
 *
 * TWILIO_VENUE_SECRETS_JSON is test-only (NODE_ENV=test). Never used in
 * production or ECS sandbox (both set NODE_ENV=production).
 * Never store these values in Postgres.
 */
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import {
  twilioVenueTestOverridesAllowed,
  venueTwilioSecretPrefix,
} from "@/lib/sms/venue-twilio-runtime";

export type VenueTwilioSecret = {
  accountSid: string;
  authToken: string;
  apiKeySid: string;
  apiKeySecret: string;
};

const cache = new Map<string, { expiresAt: number; value: VenueTwilioSecret }>();
const CACHE_MS = 60_000;

export { venueTwilioSecretPrefix } from "@/lib/sms/venue-twilio-runtime";

export function venueTwilioSecretId(accountSid: string): string {
  return `${venueTwilioSecretPrefix()}/${accountSid}`;
}

function parseSecretJson(raw: string, expectedAccountSid: string): VenueTwilioSecret {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const accountSid = String(parsed.account_sid ?? parsed.accountSid ?? "").trim();
  const authToken = String(parsed.auth_token ?? parsed.authToken ?? "").trim();
  const apiKeySid = String(parsed.api_key_sid ?? parsed.apiKeySid ?? "").trim();
  const apiKeySecret = String(parsed.api_key_secret ?? parsed.apiKeySecret ?? "").trim();
  if (!accountSid || accountSid !== expectedAccountSid) {
    throw new Error("Twilio venue secret account_sid mismatch.");
  }
  if (!authToken) throw new Error("Twilio venue secret missing auth_token.");
  if (!apiKeySid || !apiKeySecret) {
    throw new Error("Twilio venue secret missing api_key_sid/api_key_secret.");
  }
  return { accountSid, authToken, apiKeySid, apiKeySecret };
}

/** Test-only override: JSON object keyed by AccountSid. */
function fromEnvJson(accountSid: string): VenueTwilioSecret | null {
  if (!twilioVenueTestOverridesAllowed()) return null;
  const raw = process.env.TWILIO_VENUE_SECRETS_JSON?.trim();
  if (!raw) return null;
  const map = JSON.parse(raw) as Record<string, unknown>;
  const entry = map[accountSid];
  if (!entry || typeof entry !== "object") return null;
  return parseSecretJson(JSON.stringify(entry), accountSid);
}

async function fromAwsSecretsManager(accountSid: string): Promise<VenueTwilioSecret> {
  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1",
  });
  const out = await client.send(new GetSecretValueCommand({
    SecretId: venueTwilioSecretId(accountSid),
  }));
  const raw = out.SecretString;
  if (!raw) throw new Error("Twilio venue secret is empty.");
  return parseSecretJson(raw, accountSid);
}

export async function loadVenueTwilioSecret(accountSid: string): Promise<VenueTwilioSecret> {
  const sid = accountSid.trim();
  if (!sid) throw new Error("Twilio account SID required.");

  const cached = cache.get(sid);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const fromEnv = (() => {
    try {
      return fromEnvJson(sid);
    } catch {
      return null;
    }
  })();

  const value = fromEnv ?? await fromAwsSecretsManager(sid);
  cache.set(sid, { value, expiresAt: Date.now() + CACHE_MS });
  return value;
}

/** Test helper — clear in-memory secret cache. */
export function clearVenueTwilioSecretCache(): void {
  cache.clear();
}

export function twilioRestBasicAuth(secret: VenueTwilioSecret): string {
  return Buffer.from(`${secret.apiKeySid}:${secret.apiKeySecret}`).toString("base64");
}

/** Media download uses the same API-key Basic auth as REST sends. */
export function twilioMediaBasicAuth(secret: VenueTwilioSecret): string {
  return twilioRestBasicAuth(secret);
}
