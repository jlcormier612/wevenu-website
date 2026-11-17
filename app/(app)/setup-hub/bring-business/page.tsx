import { redirect } from "next/navigation";

import { BRING_YOUR_BUSINESS_ROUTES } from "@/lib/setup-hub/bring-your-business";

export const metadata = { title: "Bring your business with you — Setup" };

export default function BringBusinessPage() {
  redirect(BRING_YOUR_BUSINESS_ROUTES.guidedExperience);
}
