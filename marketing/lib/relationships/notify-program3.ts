/**
 * Best-effort notify workspace Program 3 after marketing CRM ingest.
 * Failures must never break the visitor form or Calendly webhook.
 */

export type Program3IngestNotifyInput = {
  event: "status_enter" | "status_leave" | "walkthrough_canceled";
  relationshipId: string;
  status?: string;
  previousStatus?: string | null;
  sourceId?: string | null;
};

function workspaceAutomationsUrl(): string | null {
  const base = (
    process.env.WORKSPACE_URL?.trim() ||
    process.env.NEXT_PUBLIC_WORKSPACE_URL?.trim() ||
    ""
  ).replace(/\/$/, "");
  if (!base) return null;
  return `${base}/api/automations/ingest-event`;
}

export async function notifyProgram3IngestEvent(
  input: Program3IngestNotifyInput,
): Promise<void> {
  const url = workspaceAutomationsUrl();
  const key = process.env.PRODUCT_SYNC_API_KEY?.trim();
  if (!url || !key) {
    console.warn(
      "[program3] skip automation notify — WORKSPACE_URL or PRODUCT_SYNC_API_KEY unset",
    );
    return;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        "[program3] automation notify failed",
        res.status,
        text.slice(0, 300),
      );
    }
  } catch (error) {
    console.error("[program3] automation notify error", error);
  }
}
