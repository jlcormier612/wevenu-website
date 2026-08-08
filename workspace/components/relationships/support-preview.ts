export type SupportResolveItem = {
  id: string;
  type: string;
  subject: string;
  body?: string;
  createdAt: string;
  status: string;
};

const TYPE_LABELS: Record<string, string> = {
  support: "Support",
  bug: "Bug",
  feature: "Idea",
  nps: "NPS",
  general: "Feedback",
};

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? "Feedback";
}

export function snippet(text: string | undefined, max = 90): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Preview line for Today / list rows */
export function supportItemPreview(items: SupportResolveItem[]): string {
  const open = items.filter((i) => i.status === "open");
  const first = open[0];
  if (!first) return "Support open";
  const label = typeLabel(first.type);
  const bodySnip = snippet(first.body || first.subject);
  if (open.length === 1) {
    return bodySnip ? `${label}: ${bodySnip}` : label;
  }
  return bodySnip
    ? `${label}: ${bodySnip} · +${open.length - 1} more`
    : `${open.length} open items`;
}
