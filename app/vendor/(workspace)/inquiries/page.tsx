import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Messages — Vendor Portal" };

/**
 * Legacy VendorOS CRM inquiries route. Couple→vendor contact now lives in
 * Messages (conversation architecture). Keep URL friendly for old bookmarks.
 */
export default function VendorInquiriesRedirectPage() {
  redirect("/vendor/messages");
}
