import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PortalShell } from "@/components/portal/portal-shell";
import { resolvePortalContext, resolvePortalTasks } from "@/lib/portal/service";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const ctx = await resolvePortalContext(token);
  if (!ctx) return { title: "Wedding Workspace" };
  const coupleName = [ctx.client.firstName, ctx.client.partnerFirstName].filter(Boolean).join(" & ");
  return {
    title: `${coupleName} — ${ctx.venue.name}`,
    description: `Your wedding planning workspace at ${ctx.venue.name}`,
  };
}

export default async function PortalPage({ params }: Props) {
  const { token } = await params;
  const [context, tasks] = await Promise.all([
    resolvePortalContext(token),
    resolvePortalTasks(token),
  ]);
  // Log portal visit (non-blocking — get_portal_context already updates last_accessed_at)
  // The SECURITY DEFINER log_couple_event fires the activity signal
  if (!context) notFound();

  return <PortalShell token={token} context={context} initialTasks={tasks} />;
}
