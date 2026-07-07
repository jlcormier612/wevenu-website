import { redirect } from "next/navigation";

/**
 * The Beta Command Center is now the default /admin home page (see
 * docs/wevenu-hq-architecture.md §"one additional thing") — this route
 * only exists so old bookmarks/links still land somewhere.
 */
export default function LegacyBetaRedirect() {
  redirect("/admin");
}
