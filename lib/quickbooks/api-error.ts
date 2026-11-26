/**
 * Formats QuickBooks Online API failures for sync-queue / Settings diagnostics.
 *
 * Captures Intuit correlation (`intuit_tid`), HTTP status, and Fault codes when
 * present. Never includes Authorization headers, tokens, or full request bodies.
 */

export type QuickBooksApiErrorParts = {
  httpStatus: number;
  operation: string;
  intuitTid: string | null;
  intuitCode: string | null;
  intuitMessage: string | null;
  detailSnippet: string;
};

function extractFault(body: string): { code: string | null; message: string | null } {
  try {
    const parsed = JSON.parse(body) as {
      Fault?: { Error?: Array<{ code?: string; Message?: string; Detail?: string }> };
    };
    const first = parsed.Fault?.Error?.[0];
    if (!first) return { code: null, message: null };
    return {
      code: first.code?.trim() || null,
      message: (first.Message || first.Detail || "").trim() || null,
    };
  } catch {
    return { code: null, message: null };
  }
}

/**
 * Build a single-line diagnostic suitable for `last_error` / sync_log.message.
 * Example:
 * `QuickBooks API error 400 on POST /invoice (intuit_tid=1-abc; code=2020): Required parameter…`
 */
export function formatQuickBooksApiError(input: {
  method: string;
  path: string;
  status: number;
  intuitTid: string | null;
  body: string;
}): string {
  const pathOnly = input.path.split("?")[0] || input.path;
  const operation = `${input.method.toUpperCase()} ${pathOnly}`;
  const fault = extractFault(input.body);
  const snippet = (fault.message || input.body.replace(/\s+/g, " ").trim()).slice(0, 280);
  const tidPart = input.intuitTid ? `intuit_tid=${input.intuitTid}` : "intuit_tid=none";
  const codePart = fault.code ? `; code=${fault.code}` : "";
  const detail = snippet ? `: ${snippet}` : "";
  return `QuickBooks API error ${input.status} on ${operation} (${tidPart}${codePart})${detail}`;
}

export function parseQuickBooksApiErrorParts(message: string): Partial<QuickBooksApiErrorParts> {
  const statusMatch = message.match(/QuickBooks API error (\d+)/);
  const opMatch = message.match(/ on ([A-Z]+ \/[^\s(]+)/);
  const tidMatch = message.match(/intuit_tid=([^;)\s]+)/);
  const codeMatch = message.match(/code=([^)\s]+)/);
  return {
    httpStatus: statusMatch ? Number(statusMatch[1]) : undefined,
    operation: opMatch?.[1],
    intuitTid: tidMatch && tidMatch[1] !== "none" ? tidMatch[1] : null,
    intuitCode: codeMatch?.[1] ?? null,
  };
}

/** CloudWatch-safe structured line — no tokens. */
export function logQuickBooksApiFailure(parts: {
  venueId: string;
  method: string;
  path: string;
  status: number;
  intuitTid: string | null;
  message: string;
}): void {
  console.error(
    "[quickbooks] api_error",
    JSON.stringify({
      at: new Date().toISOString(),
      venueId: parts.venueId,
      method: parts.method.toUpperCase(),
      path: parts.path.split("?")[0],
      httpStatus: parts.status,
      intuit_tid: parts.intuitTid,
      message: parts.message.slice(0, 500),
    }),
  );
}
