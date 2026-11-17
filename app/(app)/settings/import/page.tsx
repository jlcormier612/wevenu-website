import { redirect } from "next/navigation";

import { legacyImportRedirectHref } from "@/lib/setup-hub/bring-your-business-journey";

export const metadata = { title: "Bring your people — Setup" };

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  redirect(legacyImportRedirectHref(params.type));
}
