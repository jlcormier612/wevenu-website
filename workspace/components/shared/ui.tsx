import Link from "next/link";

import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow ? <p className="ws-eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="font-heading text-4xl tracking-tight md:text-[2.75rem]">{title}</h1>
        {description ? (
          <p className="mt-3 text-[1.05rem] leading-relaxed ws-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Panel({
  children,
  className,
  title,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn("ws-panel p-6", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? <h2 className="font-heading text-xl">{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatTile({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: string | number;
  href?: string;
  hint?: string;
}) {
  const inner = (
    <>
      <p className="ws-eyebrow">{label}</p>
      <p className="mt-3 font-heading text-3xl tracking-tight">{value}</p>
      {hint ? <p className="mt-2 text-sm ws-muted">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="ws-panel block p-5 hover:border-[var(--heritage-sage)]/50"
      >
        {inner}
      </Link>
    );
  }

  return <div className="ws-panel p-5">{inner}</div>;
}

export function EmptyState({ message }: { message: string }) {
  return <p className="text-sm ws-muted">{message}</p>;
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "muted";
}) {
  const tones = {
    neutral: "bg-[var(--soft-sage)]/35 text-[var(--forest-sage)]",
    good: "bg-[var(--soft-sage)]/55 text-[var(--forest-sage)]",
    warn: "bg-[var(--dusty-rose)]/35 text-[var(--forest-sage)]",
    muted: "bg-[var(--taupe-light)]/60 text-[var(--forest-sage)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-xs tracking-wide",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function RelationshipLink({
  id,
  name,
  subtitle,
  href,
}: {
  id: string;
  name: string;
  subtitle?: string;
  /** Override default `/relationships/{id}` (e.g. deep-link `?panel=support`). */
  href?: string;
}) {
  return (
    <Link
      href={href ?? `/relationships/${id}`}
      className="group block rounded-sm py-1"
    >
      <span className="font-medium text-[var(--forest-sage)] group-hover:text-[var(--heritage-sage)]">
        {name}
      </span>
      {subtitle ? <span className="mt-0.5 block text-sm ws-muted">{subtitle}</span> : null}
    </Link>
  );
}

export function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  if (rows.length === 0) {
    return <EmptyState message="Nothing here yet." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)]">
            {headers.map((h) => (
              <th key={h} className="ws-eyebrow pb-3 pr-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr
              key={i}
              className="border-b border-[color-mix(in_srgb,var(--taupe-light)_70%,transparent)] last:border-0"
            >
              {cells.map((cell, j) => (
                <td key={j} className="py-3.5 pr-4 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
