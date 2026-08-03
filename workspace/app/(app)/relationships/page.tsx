import { redirect } from "next/navigation";

/** Legacy Relationships list → Sales board. Detail stays at /relationships/[id]. */
export default function RelationshipsRedirectPage() {
  redirect("/sales");
}
