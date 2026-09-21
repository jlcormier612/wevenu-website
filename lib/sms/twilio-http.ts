/**
 * Low-level Twilio REST helper (form-urlencoded). No product logic.
 */
export type TwilioHttpResult = {
  status: number;
  body: Record<string, unknown>;
  raw: string;
};

export type TwilioCredentials = {
  accountSid: string;
  authToken: string;
};

function basicAuth(accountSid: string, authToken: string): string {
  return Buffer.from(`${accountSid}:${authToken}`).toString("base64");
}

export async function twilioRequest(input: {
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  credentials: TwilioCredentials;
  form?: Record<string, string | undefined | null>;
  pairs?: Array<[string, string]>;
}): Promise<TwilioHttpResult> {
  const headers: Record<string, string> = {
    Authorization: `Basic ${basicAuth(input.credentials.accountSid, input.credentials.authToken)}`,
  };
  let body: string | undefined;
  if (input.pairs) {
    body = new URLSearchParams(input.pairs).toString();
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  } else if (input.form) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(input.form)) {
      if (v === undefined || v === null) continue;
      params.append(k, v);
    }
    body = params.toString();
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  const resp = await fetch(input.url, {
    method: input.method,
    headers,
    body: input.method === "GET" || input.method === "DELETE" ? undefined : body,
  });
  const raw = await resp.text();
  let parsed: Record<string, unknown> = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = { message: raw };
    }
  }
  return { status: resp.status, body: parsed, raw };
}

export function twilioErrorMessage(body: Record<string, unknown>): string {
  const msg = body.message ?? body.error_message ?? body.detail;
  return typeof msg === "string" && msg.trim() ? msg.trim() : "Twilio request failed.";
}

export function twilioErrorCode(body: Record<string, unknown>): string | null {
  const code = body.code;
  if (typeof code === "number") return String(code);
  if (typeof code === "string" && code.trim()) return code.trim();
  return null;
}
