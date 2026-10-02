import { redirect } from "next/navigation";

/** Legacy / bookmarked path — Automations live at /communication/series. */
export default function AutomationsAliasPage() {
  redirect("/communication/series");
}
