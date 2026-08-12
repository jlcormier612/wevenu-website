import { redirect } from "next/navigation";

/** Legacy Success Library home → Help & Guides. */
export default function SuccessLibraryRedirectPage() {
  redirect("/help");
}
