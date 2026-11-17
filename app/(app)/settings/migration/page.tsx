import { redirect } from "next/navigation";

import { legacyMigrationRedirectHref } from "@/lib/setup-hub/bring-your-business-journey";

export const metadata = { title: "Bring your dates and bookings — Setup" };

export default async function MigrationCenterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sourceParam = params.source;
  const source = Array.isArray(sourceParam) ? sourceParam[0] ?? null : sourceParam ?? null;
  redirect(legacyMigrationRedirectHref(source));
}
