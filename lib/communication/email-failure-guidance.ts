/**
 * Evidence-based email failure guidance for venue owners.
 *
 * Classifies from structured Resend HTTP signals and bounce webhook fields —
 * not vague guesses. Unknown stays unknown. Never invents bounce/reject/
 * temporary labels without supporting evidence.
 */

export type EmailFailureCategory =
  | "invalid_recipient"
  | "quota"
  | "rate_limit"
  | "configuration"
  | "temporary_provider"
  | "temporary_bounce"
  | "permanent_bounce"
  | "unknown";

export type EmailFailureGuidance = {
  category: EmailFailureCategory;
  /** Plain-language explanation of what the evidence establishes. */
  explanation: string;
  /** Recommended next step grounded in the category. */
  nextAction: string;
  /** Whether a manual retry is appropriate for this category. */
  retryAppropriate: boolean;
  /** Optional venue-safe diagnostic fragment (no secrets / emails). */
  diagnosticSafe: string | null;
};

/** Reserved for configuration / quota — not for routine unknown failures. */
const SUPPORT_NEXT =
  "If this keeps happening, contact Hello to Cheers support and share the message time so we can check delivery logs.";

/** Calm next step when evidence does not justify a support invitation. */
const UNKNOWN_NEXT =
  "Confirm the recipient details in the conversation. Try again later if this may have been temporary.";

function redactEmails(text: string): string {
  return text.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]");
}

function stripSensitive(text: string): string {
  return redactEmails(text)
    .replace(/Bearer\s+\S+/gi, "[redacted]")
    .replace(/api[_-]?key["']?\s*[:=]\s*["']?[^"'}\s]+/gi, "[redacted]")
    .trim();
}

/**
 * Remove sender-reputation scare clauses from provider bounce prose while
 * keeping the useful delivery fact. Full provider payloads remain in events.
 */
export function calmBounceExplanation(text: string): string {
  let t = stripSensitive(text);
  t = t.replace(
    /\s*Sending messages to addresses that produce hard bounces[^.]*\./gi,
    "",
  );
  t = t.replace(
    /\s*We recommend removing the recipient'?s email address from your mailing list\.?/gi,
    "",
  );
  t = t.replace(/\s*[^.]*negative impact on your reputation[^.]*\./gi, "");
  t = t.replace(/\s{2,}/g, " ").trim();
  return t;
}

function guidance(
  category: EmailFailureCategory,
  explanation: string,
  nextAction: string,
  retryAppropriate: boolean,
  diagnosticSafe: string | null = null,
): EmailFailureGuidance {
  return {
    category,
    explanation,
    nextAction,
    retryAppropriate,
    diagnosticSafe: diagnosticSafe ? stripSensitive(diagnosticSafe).slice(0, 280) : null,
  };
}

/** Parse Resend-style JSON error bodies when present. */
export function parseResendErrorBody(bodyText: string): {
  statusCode?: number;
  name?: string;
  message?: string;
} {
  const raw = (bodyText || "").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      statusCode: typeof parsed.statusCode === "number" ? parsed.statusCode : undefined,
      name: typeof parsed.name === "string" ? parsed.name : undefined,
      message: typeof parsed.message === "string" ? parsed.message : undefined,
    };
  } catch {
    // Legacy persisted form: Email send failed: {...}
    const m = raw.match(/Email send failed:\s*(\{[\s\S]*\})\s*$/i);
    if (m) {
      try {
        const parsed = JSON.parse(m[1]) as Record<string, unknown>;
        return {
          statusCode: typeof parsed.statusCode === "number" ? parsed.statusCode : undefined,
          name: typeof parsed.name === "string" ? parsed.name : undefined,
          message: typeof parsed.message === "string" ? parsed.message : undefined,
        };
      } catch {
        return {};
      }
    }
    return {};
  }
}

/**
 * Classify a Resend HTTP failure from status + body.
 * Prefer structured name/statusCode over loose substrings.
 */
export function classifyResendHttpFailureGuidance(opts: {
  status: number;
  bodyText: string;
}): EmailFailureGuidance {
  const status = opts.status;
  const parsed = parseResendErrorBody(opts.bodyText);
  const name = (parsed.name || "").toLowerCase();
  const message = (parsed.message || opts.bodyText || "").toLowerCase();
  const diagnostic = parsed.message
    ? stripSensitive(parsed.message)
    : null;

  const bodyLower = `${name} ${message} ${opts.bodyText || ""}`.toLowerCase();
  const quotaNamed =
    bodyLower.includes("quota")
    || bodyLower.includes("usage limit")
    || (bodyLower.includes("monthly") && bodyLower.includes("limit"))
    || (bodyLower.includes("daily") && bodyLower.includes("limit") && !bodyLower.includes("rate"));

  const rateNamed =
    bodyLower.includes("rate_limit")
    || bodyLower.includes("too many requests");

  if (status === 429 || rateNamed) {
    // Resend uses 429 for both; prefer quota when named and "rate" is absent.
    if (quotaNamed && !bodyLower.includes("rate")) {
      return guidance(
        "quota",
        "The email provider rejected this send because a sending quota was reached. The message was not accepted for delivery.",
        "Wait until the quota resets, or contact Hello to Cheers support. Do not keep retrying immediately.",
        false,
        diagnostic,
      );
    }
    return guidance(
      "rate_limit",
      "The email provider rejected this send because too many messages were submitted too quickly. The message was not accepted for delivery.",
      "Wait a short time, then send again from the conversation if still needed. Rapid retries can make this worse.",
      true,
      diagnostic,
    );
  }

  if (status === 402 || quotaNamed) {
    return guidance(
      "quota",
      "The email provider rejected this send because the account sending quota is exhausted. The message was not accepted for delivery.",
      "Contact Hello to Cheers support about sending capacity. Do not keep retrying immediately.",
      false,
      diagnostic,
    );
  }

  const invalidTo =
    status === 422
    && (
      name === "validation_error"
      || (message.includes("invalid") && (message.includes("`to`") || message.includes("to field") || message.includes("recipient")))
    );

  if (invalidTo) {
    return guidance(
      "invalid_recipient",
      "This message couldn't be sent because the recipient email address isn't valid for delivery.",
      "Verify the email address on the lead or client record, then send again.",
      false,
      diagnostic,
    );
  }

  if (
    status === 403
    || (message.includes("domain") && (message.includes("not verified") || message.includes("not found")))
  ) {
    return guidance(
      "configuration",
      "The email provider rejected this send because of a sender or account setup problem.",
      "Contact Hello to Cheers support — this usually cannot be fixed by editing the recipient address.",
      false,
      diagnostic,
    );
  }

  if (status >= 500) {
    return guidance(
      "temporary_provider",
      "The email provider returned a temporary error and did not accept this send.",
      "Try sending again later from the conversation. If it keeps failing, contact Hello to Cheers support.",
      true,
      diagnostic,
    );
  }

  return guidance(
    "unknown",
    "The email provider did not accept this send. The exact cause could not be determined from the available error details.",
    UNKNOWN_NEXT,
    false,
    diagnostic,
  );
}

export type ResendBounceFields = {
  type?: string | null;
  subType?: string | null;
  message?: string | null;
  diagnosticCode?: string[] | string | null;
};

/**
 * Classify a Resend bounce webhook using structured bounce fields.
 */
export function classifyResendBounceGuidance(bounce: ResendBounceFields | null | undefined): EmailFailureGuidance {
  const type = (bounce?.type || "").trim();
  const providerMessage = (bounce?.message || "").trim();
  const codes = Array.isArray(bounce?.diagnosticCode)
    ? bounce!.diagnosticCode!.filter(Boolean).join(" ")
    : (bounce?.diagnosticCode || "");
  const diagnostic = codes ? stripSensitive(String(codes)) : null;

  if (type === "Permanent") {
    const explanation = calmBounceExplanation(
      providerMessage
        || "The recipient's email provider permanently rejected this message after it was submitted.",
    );
    return guidance(
      "permanent_bounce",
      explanation
        || "The recipient's email provider permanently rejected this message after it was submitted.",
      "Verify the recipient email address on their record. If the address looks correct, try another channel or ask the couple for an updated email.",
      false,
      diagnostic,
    );
  }

  if (type === "Transient") {
    return guidance(
      "temporary_bounce",
      calmBounceExplanation(
        providerMessage
          || "The recipient's email provider temporarily could not accept this message after it was submitted.",
      ),
      "You can try sending again later. If the same address keeps failing, confirm the address with the couple or use another channel.",
      true,
      diagnostic,
    );
  }

  if (providerMessage) {
    return guidance(
      "unknown",
      calmBounceExplanation(providerMessage),
      UNKNOWN_NEXT,
      false,
      diagnostic,
    );
  }

  return guidance(
    "unknown",
    "This message could not be delivered. The bounce details were not specific enough to determine why.",
    UNKNOWN_NEXT,
    false,
    diagnostic,
  );
}

/**
 * Resolve guidance from a persisted failure_reason (including legacy raw JSON).
 * Safe for UI — does not invent categories without matching evidence.
 */
export function resolveEmailFailureGuidance(
  failureReason: string | null | undefined,
): EmailFailureGuidance {
  const raw = (failureReason || "").trim();
  if (!raw) {
    return guidance(
      "unknown",
      "This message could not be delivered. No further error detail was recorded.",
      UNKNOWN_NEXT,
      false,
    );
  }

  // Legacy / persisted Resend JSON bodies.
  if (/email send failed:\s*\{/i.test(raw) || /^\s*\{/.test(raw)) {
    const parsed = parseResendErrorBody(raw);
    const status = parsed.statusCode ?? 0;
    return classifyResendHttpFailureGuidance({
      status: status || 400,
      bodyText: raw.includes("{") ? (raw.match(/\{[\s\S]*\}/)?.[0] ?? raw) : raw,
    });
  }

  const lower = raw.toLowerCase();

  // Pass through / recognize already-classified venue copy.
  if (lower.includes("sending limit") || lower.includes("sending quota") || lower.includes("quota exhausted") || lower.includes("quota was reached")) {
    return guidance("quota", raw, "Wait until the quota resets, or contact Hello to Cheers support. Do not keep retrying immediately.", false);
  }
  if (lower.includes("rate limit") || lower.includes("too many messages were submitted too quickly")) {
    return guidance("rate_limit", raw, "Wait a short time, then send again from the conversation if still needed.", true);
  }
  if (
    lower.includes("recipient address is not valid")
    || lower.includes("isn't valid for delivery")
    || lower.includes("appears invalid")
  ) {
    return guidance("invalid_recipient", calmBounceExplanation(raw), "Verify the email address on the lead or client record, then send again.", false);
  }
  if (lower.includes("sender or account setup") || lower.includes("isn't fully set up") || lower.includes("isn't configured") || lower.includes("not configured")) {
    return guidance("configuration", raw, "Contact Hello to Cheers support — this usually cannot be fixed by editing the recipient address.", false);
  }
  if (lower.includes("temporary error") && lower.includes("did not accept")) {
    return guidance("temporary_provider", raw, "Try sending again later from the conversation. If it keeps failing, contact Hello to Cheers support.", true);
  }
  if (
    lower.includes("permanently rejected")
    || lower.includes("hard bounce")
    || (lower.includes("permanent") && lower.includes("bounce"))
  ) {
    return guidance(
      "permanent_bounce",
      calmBounceExplanation(raw),
      "Verify the recipient email address on their record. If it looks correct, try another channel or ask for an updated email.",
      false,
    );
  }
  if (
    lower.includes("temporarily could not accept")
    || lower.includes("temporarily couldn't accept")
    || lower.includes("general bounce message")
    || lower.includes("might be able to send a message to the same recipient in the future")
  ) {
    return guidance(
      "temporary_bounce",
      calmBounceExplanation(raw),
      "You can try sending again later. If the same address keeps failing, confirm the address or use another channel.",
      true,
    );
  }

  if (lower === "your message couldn't be delivered." || lower === "your message could not be delivered.") {
    return guidance(
      "unknown",
      "This message could not be delivered. The recorded error did not include enough detail to determine why.",
      UNKNOWN_NEXT,
      false,
    );
  }

  if (lower.includes("provider error")) {
    return guidance(
      "unknown",
      "The email provider did not accept this send. The exact cause could not be determined from the available error details.",
      UNKNOWN_NEXT,
      false,
    );
  }

  // Unknown but preserve the original diagnostic sentence when it is already venue-facing prose.
  if (raw.length <= 320 && !raw.includes("{") && !/stack|exception|bearer /i.test(raw)) {
    return guidance("unknown", calmBounceExplanation(raw), UNKNOWN_NEXT, false);
  }

  return guidance(
    "unknown",
    "This message could not be delivered. The exact cause could not be determined from the available error details.",
    UNKNOWN_NEXT,
    false,
  );
}

/** Venue-facing failure_reason string to persist (explanation only). */
export function emailFailureReasonForStorage(g: EmailFailureGuidance): string {
  return g.explanation;
}
