/**
 * Vercel Cron + ops auth for workspace schedulers.
 * When `CRON_SECRET` is set, require `Authorization: Bearer <CRON_SECRET>`.
 * Local demo: secret unset → allow (unless NODE_ENV=production).
 */
export function isCronAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export function cronUnauthorizedResponse(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
