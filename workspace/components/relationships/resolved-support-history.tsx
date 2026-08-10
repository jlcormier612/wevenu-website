import {
  type SupportResolveItem,
  typeLabel,
} from "@/components/relationships/support-preview";
import { formatDateTime } from "@/lib/utils";

/** Recent resolved Feedback & support items — venue health / relationship history. */
export function ResolvedSupportHistory({
  items,
  limit = 6,
}: {
  items: SupportResolveItem[];
  limit?: number;
}) {
  const resolved = items
    .filter((i) => i.status === "resolved")
    .slice()
    .sort((a, b) => {
      const aAt = a.resolvedAt || a.createdAt;
      const bAt = b.resolvedAt || b.createdAt;
      return new Date(bAt).getTime() - new Date(aAt).getTime();
    })
    .slice(0, limit);

  if (resolved.length === 0) return null;

  return (
    <div className="ws-panel border-[color-mix(in_srgb,var(--taupe-medium)_40%,transparent)] p-5">
      <p className="ws-eyebrow">Relationship history</p>
      <h2 className="mt-1 font-heading text-xl">Resolved feedback</h2>
      <p className="mt-2 text-sm ws-muted">
        Resolved items stay on this relationship for venue health context, and
        each Resolve writes a Timeline entry (“Support / feedback resolved”).
      </p>
      <ul className="mt-4 divide-y divide-[color-mix(in_srgb,var(--taupe-medium)_30%,transparent)]">
        {resolved.map((item) => (
          <li key={item.id} className="py-3 first:pt-0 last:pb-0">
            <p className="text-sm font-medium">
              {typeLabel(item.type)}
              {item.subject ? ` · ${item.subject}` : ""}
            </p>
            <p className="mt-0.5 text-xs ws-muted">
              {formatDateTime(item.resolvedAt || item.createdAt)}
            </p>
            {item.body ? (
              <p className="mt-1.5 line-clamp-2 text-sm ws-muted">{item.body}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
