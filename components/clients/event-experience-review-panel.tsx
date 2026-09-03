import Link from "next/link";

import type { EventExperienceReviewModel } from "@/lib/clients/event-experience-review";

export function EventExperienceReviewPanel({
  experience,
}: {
  experience: EventExperienceReviewModel;
}) {
  return (
    <div
      id="event-experience"
      className="rounded-sm border px-6 py-5 text-left"
      style={{ borderColor: "#D8A7AA40", background: "#FDF8F8" }}
    >
      <p className="mb-1 text-xs font-medium uppercase tracking-widest" style={{ color: "#9ca3af" }}>
        {experience.heading}
      </p>
      <p className="mb-1 text-sm font-medium" style={{ color: "#3D2F30" }}>
        {experience.experienceName}
      </p>
      <p className="mb-4 text-sm" style={{ color: "#3D2F30" }}>
        {experience.summary}
      </p>
      <p className="mb-4 text-xs text-muted-foreground leading-relaxed">{experience.reviewNote}</p>
      <ul className="space-y-3">
        {experience.rows.map((row) => (
          <li key={row.key} className="flex items-start gap-3 text-sm">
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              style={{ background: "transparent", color: "#9ca3af" }}
            >
              ○
            </span>
            <div className="min-w-0 flex-1">
              <p style={{ color: "#3D2F30" }}>{row.label}</p>
              <p className="text-xs text-muted-foreground">{row.detail}</p>
            </div>
            <Link
              href={row.href}
              className="shrink-0 text-xs font-medium underline-offset-2 hover:underline"
              style={{ color: "#5A3235" }}
            >
              {row.actionLabel}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
