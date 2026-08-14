import Link from "next/link";

import { SupportInboxList } from "@/components/support/support-inbox-list";
import { PageHeader } from "@/components/shared/ui";
import { getSupportInboxItems } from "@/lib/data/store";
import { ensureProgram4Data } from "@/lib/program4/store";

export const metadata = { title: "Support" };

type SurfaceFilter = "all" | "vendor" | "client";
type StatusFilter = "open" | "resolved" | "all";

const CHIP_ACTIVE =
  "inline-flex items-center rounded-sm bg-[var(--forest-sage)] px-3 py-1.5 text-sm text-[var(--true-white)]";
const CHIP_IDLE =
  "inline-flex items-center rounded-sm bg-[var(--true-white)] px-3 py-1.5 text-sm text-[var(--forest-sage)] ring-1 ring-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)] hover:bg-[var(--header-linen)]";

function buildHref(surface: SurfaceFilter, status: StatusFilter): string {
  const params = new URLSearchParams();
  if (surface !== "all") params.set("surface", surface);
  if (status !== "open") params.set("status", status);
  const qs = params.toString();
  return qs ? `/support?${qs}` : "/support";
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ surface?: string; status?: string; item?: string }>;
}) {
  await ensureProgram4Data();
  const sp = await searchParams;

  const surface: SurfaceFilter =
    sp.surface === "vendor" || sp.surface === "client" ? sp.surface : "all";
  const status: StatusFilter =
    sp.status === "resolved" || sp.status === "all" ? sp.status : "open";
  const focusItemId = sp.item?.trim() || null;

  let items = getSupportInboxItems({ surface, status });
  if (focusItemId && !items.some((i) => i.id === focusItemId)) {
    const focused = getSupportInboxItems({
      surface: "all",
      status: "all",
    }).find((i) => i.id === focusItemId);
    if (focused) items = [focused, ...items];
  }
  const openCount = getSupportInboxItems({ surface: "all", status: "open" }).length;

  return (
    <div>
      <PageHeader
        eyebrow="Support"
        title="Partner Support Inbox"
        description="Vendor and client product feedback. Venue Get Help continues to live on each Relationship — it is not listed here."
      />

      <p className="mb-4 text-sm text-[color-mix(in_oklch,var(--forest-sage)_70%,transparent)]">
        {openCount} open · Venue Relationship support stays on{" "}
        <Link href="/customer-success?stage=needs_support" className="underline decoration-dotted underline-offset-2">
          Customer Success
        </Link>
        .
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {(
          [
            { value: "all", label: "All" },
            { value: "vendor", label: "Vendor" },
            { value: "client", label: "Client" },
          ] as const
        ).map((chip) => (
          <Link
            key={chip.value}
            href={buildHref(chip.value, status)}
            className={surface === chip.value ? CHIP_ACTIVE : CHIP_IDLE}
          >
            {chip.label}
          </Link>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {(
          [
            { value: "open", label: "Open" },
            { value: "resolved", label: "Resolved" },
            { value: "all", label: "All statuses" },
          ] as const
        ).map((chip) => (
          <Link
            key={chip.value}
            href={buildHref(surface, chip.value)}
            className={status === chip.value ? CHIP_ACTIVE : CHIP_IDLE}
          >
            {chip.label}
          </Link>
        ))}
      </div>

      <SupportInboxList items={items} focusItemId={focusItemId} />
    </div>
  );
}
