import { redirect } from "next/navigation";

// Program 4, Initiative C, Phase 9/10 (2026-07-23) — superseded by
// /vendor/partnerships, which is the same relationship list plus the
// venue-specific promotion editor. Kept as a redirect rather than deleted
// so an old bookmark or link doesn't 404.
export default function VendorVenuesPage() {
  redirect("/vendor/partnerships");
}
