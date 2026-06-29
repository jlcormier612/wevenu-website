import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VendorPortalShell } from "@/components/vendor-portal/vendor-portal-shell";
import { resolveVendorPortalContext } from "@/lib/vendor-portal/service";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const ctx = await resolveVendorPortalContext(token);
  if (!ctx) return { title: "Vendor Portal" };
  return { title: `${ctx.vendor.name} — ${ctx.venue.name}` };
}

export default async function VendorPortalPage({ params }: Props) {
  const { token } = await params;
  const context = await resolveVendorPortalContext(token);
  if (!context) notFound();
  return <VendorPortalShell token={token} context={context} />;
}
