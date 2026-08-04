/**
 * Compatibility alias — older links and digests used `/messages`.
 * Canonical venue Conversation inbox lives at `/messaging` (nav: Inbox).
 */
import { redirect } from "next/navigation";

export default async function MessagesAliasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value)) for (const v of value) qs.append(key, v);
  }
  const suffix = qs.size > 0 ? `?${qs.toString()}` : "";
  redirect(`/messaging${suffix}`);
}
