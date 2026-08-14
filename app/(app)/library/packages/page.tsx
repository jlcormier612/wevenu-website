import { redirect } from "next/navigation";

/**
 * Canonical Packages route is `/packages`. This path is retained as a
 * redirect so Library bookmarks and older links keep working.
 */
export default function LibraryPackagesRedirectPage() {
  redirect("/packages");
}
