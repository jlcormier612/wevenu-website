import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PortalShell } from "@/components/portal/portal-shell";
import {
  getCouplePortalLegalGateStatus,
  resolveCouplePortalLegalIdentity,
} from "@/lib/legal/service";
import type { CouplePortalLegalGateStatus } from "@/lib/legal/types";
import { resolvePortalContext, resolvePortalTasks, resolvePortalTimeline, resolvePortalVendorTasks } from "@/lib/portal/service";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const ctx = await resolvePortalContext(token);
  if (!ctx) return { title: "Wedding Workspace" };
  const coupleName = [ctx.client.firstName, ctx.client.partnerFirstName].filter(Boolean).join(" & ");
  return {
    // Venue Brand Experience Phase 1: `absolute` stops the root layout's
    // "%s · Hello to Cheers" template from appending to this customer-facing tab title.
    title: { absolute: `${coupleName} — ${ctx.venue.name}` },
    description: `Your wedding planning workspace at ${ctx.venue.name}`,
  };
}

async function resolvePortalLegalGate(
  token: string,
): Promise<CouplePortalLegalGateStatus> {
  try {
    const identity = await resolveCouplePortalLegalIdentity(token);
    if (!identity) return { needsAcceptance: true, documents: [] };
    return await getCouplePortalLegalGateStatus(identity);
  } catch (error) {
    console.error("[portal] legal gate resolution failed", error);
    return { needsAcceptance: true, documents: [] };
  }
}

export default async function PortalPage({ params }: Props) {
  const { token } = await params;
  const [context, tasks, vendorTasks, timeline, legalGate] = await Promise.all([
    resolvePortalContext(token),
    resolvePortalTasks(token),
    resolvePortalVendorTasks(token),
    resolvePortalTimeline(token),
    resolvePortalLegalGate(token),
  ]);
  // Log portal visit (non-blocking — get_portal_context already updates last_accessed_at)
  // The SECURITY DEFINER log_couple_event fires the activity signal
  if (!context) notFound();

  return (
    <PortalShell
      token={token} context={context} initialTasks={tasks} initialVendorTasks={vendorTasks}
      initialTimelineSections={timeline.sections} initialTimelineEntries={timeline.entries}
      initialTimelineLastSubmittedAt={timeline.lastSubmittedAt} initialTimelineHasUnpublishedChanges={timeline.hasUnpublishedChanges}
      initialLegalGate={legalGate}
    />
  );
}
