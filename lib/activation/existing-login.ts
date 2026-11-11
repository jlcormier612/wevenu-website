import type { createAdminClient } from "@/integrations/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Same gate as enrollment activate: an existing accepted membership means
 * the purchaser already has an HTC login. Password must not be overwritten.
 */
export async function purchaserAlreadyHasLogin(
  admin: Admin,
  input: {
    ownerEmail: string | null | undefined;
    enrollmentVenueId?: string | null;
    enrollmentStatus?: string | null;
  },
): Promise<boolean> {
  if (input.enrollmentStatus === "activated") return true;

  const email = input.ownerEmail?.trim().toLowerCase() || "";
  if (!email || !email.includes("@")) return false;

  const userId = await findExistingAuthUserIdByEmail(admin, email);
  if (!userId) return false;

  let query = admin
    .from("venue_staff")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_active", true)
    .not("accepted_at", "is", null);
  if (input.enrollmentVenueId) {
    query = query.neq("venue_id", input.enrollmentVenueId);
  }
  const { count, error } = await query;
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function findExistingAuthUserIdByEmail(
  admin: Admin,
  email: string,
): Promise<string | null> {
  const { data, error } = await admin
    .schema("auth")
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!error && data && typeof (data as { id?: string }).id === "string") {
    return (data as { id: string }).id;
  }

  for (let page = 1; page <= 10; page += 1) {
    const { data: listed, error: listErr } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (listErr) return null;
    const match = (listed.users ?? []).find(
      (u) => (u.email ?? "").trim().toLowerCase() === email,
    );
    if (match?.id) return match.id;
    if ((listed.users?.length ?? 0) < 200) break;
  }
  return null;
}
