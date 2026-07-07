import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getVendorUser } from "@/lib/vendor-auth/service";

export const metadata: Metadata = { title: "Messages — Vendor Portal" };

export default async function VendorMessagesPage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground">Messages</h1>
      <p className="text-sm text-muted-foreground">
        Messages are organized by event. Open an event to view and reply to message threads.
      </p>
      <div className="rounded-xl border border-dashed border-border py-14 text-center">
        <p className="text-sm text-muted-foreground">No message threads yet.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Standalone message compose is coming in Sprint 107.
        </p>
      </div>
    </div>
  );
}
