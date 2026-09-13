import { redirect } from "next/navigation";

/**
 * Online payments live at Settings → Financials & Integrations.
 * Keep this Setup Hub path as a thin redirect so old bookmarks still work.
 */
export default function SetupHubFinancialsRedirect() {
  redirect("/settings/integrations");
}
