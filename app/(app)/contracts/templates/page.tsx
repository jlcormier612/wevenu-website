import type { Metadata } from "next";
import { redirect } from "next/navigation";

/**
 * Legacy URL — canonical Contract Templates list lives under Templates hub.
 * Edit/new stay on /contracts/templates/*; list traffic goes to /library/contracts.
 */
export const metadata: Metadata = { title: "Contract Templates" };

export default function TemplatesPage() {
  redirect("/library/contracts");
}
