/**
 * Environment isolation for Resend inbound webhooks.
 *
 * Separate webhook URLs + signing secrets authenticate the receiver; they do
 * not stop Resend from delivering the same email.received event to every
 * webhook subscribed to a shared receiving domain.
 *
 * This guard fail-closes unless:
 *   1. RESEND_INBOUND_ADDRESS is configured for this deployment, and
 *   2. the event's to / received_for addresses target that address's domain.
 *
 * Use distinct receiving domains (or distinct inbound addresses) per
 * environment so Production and Sandbox never share the same event stream.
 */

export type InboundEnvGuardResult =
  | { ok: true; domain: string }
  | {
      ok: false;
      reason: "inbound_address_unconfigured" | "wrong_inbound_domain";
    };

export function extractEmailDomain(address: string): string | null {
  const trimmed = address.trim().toLowerCase();
  if (!trimmed) return null;
  const angle = trimmed.match(/<([^>]+)>/);
  const email = (angle?.[1] ?? trimmed).trim();
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).replace(/\.$/, "");
}

/**
 * CloudFormation / GH Environment placeholders that must never be treated as
 * a real inbound address (Production currently stores literal `NONE`).
 */
const UNCONFIGURED_TOKENS = new Set([
  "",
  "none",
  "null",
  "undefined",
  "n/a",
  "na",
  "-",
  "placeholder",
]);

export function isInboundAddressConfigured(
  inboundAddress: string | undefined | null = process.env.RESEND_INBOUND_ADDRESS,
): boolean {
  const raw = inboundAddress?.trim() ?? "";
  if (!raw) return false;
  if (UNCONFIGURED_TOKENS.has(raw.toLowerCase())) return false;
  return true;
}

/**
 * Accepts full addresses (`inbox@replies.example.com`) or bare domains
 * (`replies.example.com`) from RESEND_INBOUND_ADDRESS.
 * Returns null for empty / placeholder values (fail-closed).
 */
export function expectedInboundDomain(
  inboundAddress: string | undefined | null = process.env.RESEND_INBOUND_ADDRESS,
): string | null {
  if (!isInboundAddressConfigured(inboundAddress)) return null;
  const raw = inboundAddress!.trim();
  if (raw.includes("@")) return extractEmailDomain(raw);
  return raw.toLowerCase().replace(/^\.+|\.+$/g, "") || null;
}

export function inboundEventTargetsEnvironment(opts: {
  to?: string[] | null;
  receivedFor?: string[] | null;
  cc?: string[] | null;
  inboundAddress?: string | null;
}): InboundEnvGuardResult {
  const domain = expectedInboundDomain(opts.inboundAddress);
  if (!domain) {
    return { ok: false, reason: "inbound_address_unconfigured" };
  }

  const candidates = [
    ...(opts.to ?? []),
    ...(opts.receivedFor ?? []),
    ...(opts.cc ?? []),
  ];
  const hit = candidates.some((addr) => extractEmailDomain(addr) === domain);
  if (!hit) {
    return { ok: false, reason: "wrong_inbound_domain" };
  }
  return { ok: true, domain };
}
