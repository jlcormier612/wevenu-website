/**
 * Decision A — New Message (`message_received`) email recipients.
 *
 * Eligible: venue owner (auth account for venues.owner_user_id) + staff
 * assigned to the affected lead (leads.assigned_staff_id → venue_staff),
 * when the venue-level pref_message_received gate already allowed the
 * notification (needs_email). Deduped by email. Never selects a customer
 * address merely because it appears on the lead/venue contact fields.
 *
 * Does not invent recipients when ownership/assignment/email is missing.
 */

export type MessageReceivedRecipientRole = "owner" | "lead_assignee";

export type MessageReceivedRecipient = {
  email: string;
  role: MessageReceivedRecipientRole;
  staffId?: string | null;
  userId?: string | null;
};

export type MessageReceivedRecipientInputs = {
  /** Venue New message preference (venue-level; no per-person email prefs). */
  prefMessageReceived: boolean;
  ownerAuthEmail: string | null;
  assigneeStaffEmail: string | null;
  assigneeStaffId?: string | null;
  ownerUserId?: string | null;
  /** Contact addresses on the customer record — never selected as internal recipients alone. */
  customerEmails?: Array<string | null | undefined>;
  /** Venue contact email — not a substitute for owner auth email. */
  venueContactEmail?: string | null;
};

function normalizeEmail(raw: string | null | undefined): string | null {
  const email = raw?.trim().toLowerCase() ?? "";
  return email.includes("@") ? email : null;
}

/**
 * Pure recipient selection for unit tests and the dispatcher.
 * Owner comes only from ownerAuthEmail (auth account). Assignee from staff email.
 * venues.email is ignored as a recipient source.
 */
export function selectMessageReceivedRecipients(
  input: MessageReceivedRecipientInputs,
): MessageReceivedRecipient[] {
  if (!input.prefMessageReceived) return [];

  const out: MessageReceivedRecipient[] = [];
  const seen = new Set<string>();

  const owner = normalizeEmail(input.ownerAuthEmail);
  if (owner) {
    seen.add(owner);
    out.push({
      email: owner,
      role: "owner",
      userId: input.ownerUserId ?? null,
    });
  }

  const assignee = normalizeEmail(input.assigneeStaffEmail);
  if (assignee && !seen.has(assignee)) {
    seen.add(assignee);
    out.push({
      email: assignee,
      role: "lead_assignee",
      staffId: input.assigneeStaffId ?? null,
    });
  }

  // customerEmails / venueContactEmail are intentionally unused for inclusion —
  // documented so callers do not treat them as recipient sources.
  void input.customerEmails;
  void input.venueContactEmail;

  return out;
}

/** Extract lead UUID from notification deep links like `/leads/{id}#messages`. */
export function leadIdFromNotificationLink(link: string | null | undefined): string | null {
  if (!link) return null;
  const match = link.match(/\/leads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return match?.[1] ?? null;
}

type ServiceClient = {
  from: (table: string) => any;
  auth: { admin: { getUserById: (id: string) => Promise<{ data: { user: { email?: string | null } | null } | null }> } };
};

/**
 * Resolve owner auth email + lead assignee staff email for a message_received row.
 * Pref is implied true when needs_email was set; still re-check for safety.
 */
export async function resolveMessageReceivedRecipients(
  supabase: ServiceClient,
  row: { venue_id: string; link: string | null },
): Promise<MessageReceivedRecipient[]> {
  const { data: venue } = await supabase
    .from("venues")
    .select("owner_user_id, email")
    .eq("id", row.venue_id)
    .maybeSingle();

  const ownerUserId = (venue?.owner_user_id as string | null) ?? null;
  let ownerAuthEmail: string | null = null;
  if (ownerUserId) {
    try {
      const { data } = await supabase.auth.admin.getUserById(ownerUserId);
      ownerAuthEmail = normalizeEmail(data?.user?.email ?? null);
    } catch {
      ownerAuthEmail = null;
    }
    // Safe fallback: accepted owner staff row linked to that user_id (not venues.email).
    if (!ownerAuthEmail) {
      const { data: ownerStaff } = await supabase
        .from("venue_staff")
        .select("email")
        .eq("venue_id", row.venue_id)
        .eq("user_id", ownerUserId)
        .eq("is_owner", true)
        .eq("is_active", true)
        .maybeSingle();
      ownerAuthEmail = normalizeEmail(ownerStaff?.email ?? null);
    }
  }

  const leadId = leadIdFromNotificationLink(row.link);
  let assigneeStaffEmail: string | null = null;
  let assigneeStaffId: string | null = null;
  let customerEmails: Array<string | null> = [];

  if (leadId) {
    const { data: lead } = await supabase
      .from("leads")
      .select("assigned_staff_id, email, partner_email")
      .eq("id", leadId)
      .eq("venue_id", row.venue_id)
      .maybeSingle();

    customerEmails = [lead?.email ?? null, lead?.partner_email ?? null];
    assigneeStaffId = (lead?.assigned_staff_id as string | null) ?? null;
    if (assigneeStaffId) {
      const { data: staff } = await supabase
        .from("venue_staff")
        .select("email, user_id, is_active")
        .eq("id", assigneeStaffId)
        .eq("venue_id", row.venue_id)
        .maybeSingle();
      if (staff?.is_active !== false) {
        assigneeStaffEmail = normalizeEmail(staff?.email ?? null);
        // Prefer linked auth email when staff has a user_id.
        if (staff?.user_id) {
          try {
            const { data } = await supabase.auth.admin.getUserById(staff.user_id as string);
            const authEmail = normalizeEmail(data?.user?.email ?? null);
            if (authEmail) assigneeStaffEmail = authEmail;
          } catch {
            /* keep staff.email */
          }
        }
      }
    }
  }

  const { data: prefs } = await supabase
    .from("venue_notification_preferences")
    .select("pref_message_received")
    .eq("venue_id", row.venue_id)
    .maybeSingle();

  const prefMessageReceived = prefs == null
    ? true
    : Boolean(prefs.pref_message_received);

  return selectMessageReceivedRecipients({
    prefMessageReceived,
    ownerAuthEmail,
    ownerUserId,
    assigneeStaffEmail,
    assigneeStaffId,
    customerEmails,
    venueContactEmail: (venue?.email as string | null) ?? null,
  });
}
