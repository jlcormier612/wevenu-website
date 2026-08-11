/**
 * Brochures application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/brochures/repository";
import type {
  Brochure, BrochureActionResult, BrochureInput, BrochureRenderData, BrochureWithActivity,
  CreateBrochureResult,
} from "@/lib/brochures/types";
import { getCurrentVenue } from "@/lib/venue/service";
import { getPackages } from "@/lib/packages/service";
import { getLead } from "@/lib/leads/service";
import { leadDisplayName } from "@/lib/leads/constants";
import { sendEmail } from "@/lib/email/send";

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | BrochureActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

function validateInput(input: BrochureInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name.trim()) errors.name = "Give this brochure a name.";
  return errors;
}

// ---- reads --------------------------------------------------------------------

export async function getBrochures(includeArchived = false): Promise<Brochure[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getBrochures(await createClient(), venue.id, includeArchived);
}

export async function getBrochure(id: string): Promise<BrochureWithActivity | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getBrochure(await createClient(), venue.id, id);
}

/** Everything needed to render this brochure (venue session required) — used for the in-app Preview and authenticated PDF download. Packages/FAQs are resolved live, never stored on the brochure. */
export async function getBrochureRenderData(id: string): Promise<BrochureRenderData | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const brochure = await repo.getBrochure(supabase, venue.id, id);
  if (!brochure) return null;

  const [packagesAll, guideRes] = await Promise.all([
    brochure.includePackages ? getPackages(true) : Promise.resolve([]),
    brochure.includeFaqs
      ? supabase.from("venue_operational_info").select("faqs").eq("venue_id", venue.id).maybeSingle<{ faqs: { question: string; answer: string; audience?: string }[] }>()
      : Promise.resolve({ data: null }),
  ]);
  const faqsRaw = (guideRes.data?.faqs ?? []) as {
    question: string; answer: string; audience?: string; published?: boolean;
  }[];

  return {
    brochure: {
      id: brochure.id, name: brochure.name, welcomeText: brochure.welcomeText,
      includePackages: brochure.includePackages, includeFaqs: brochure.includeFaqs, closingText: brochure.closingText,
    },
    venue: {
      id: venue.id, name: venue.name ?? "Your Venue", businessName: venue.businessName ?? null,
      logoUrl: venue.logoUrl ?? null, story: venue.story ?? null, heroImageUrl: venue.heroImageUrl ?? null,
      primaryColor: venue.primaryColor || "#5D6F5D", secondaryColor: venue.secondaryColor || "#4F5F4F",
      accentColor: venue.accentColor || "#B8AEA1",
      email: venue.email ?? null, phone: venue.phone ?? null, website: venue.website ?? null,
    },
    packages: packagesAll.map((p) => ({ name: p.name, description: p.description, basePrice: p.basePrice, category: p.category })),
    faqs: faqsRaw
      .filter((f) => f.audience !== "vendors" && f.published !== false)
      .map((f) => ({ question: f.question, answer: f.answer })),
  };
}

type PublicBrochureRow = {
  id: string; name: string; welcome_text: string | null; include_packages: boolean; include_faqs: boolean; closing_text: string | null;
  venue_id: string; venue_name: string; venue_business_name: string | null; venue_logo_url: string | null; venue_story: string | null;
  venue_hero_image_url: string | null; venue_primary_color: string; venue_secondary_color: string; venue_accent_color: string;
  venue_email: string | null; venue_phone: string | null; venue_website: string | null;
  packages: { name: string; description: string | null; basePrice: number | null; category: string | null }[];
  faqs: { question: string; answer: string; audience?: string; published?: boolean }[];
};

/** Public — no venue session. Token-validated entirely inside the SECURITY DEFINER RPC, same discipline as get_contract_by_token. */
export async function getBrochureRenderDataByToken(token: string): Promise<BrochureRenderData | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_brochure_by_token", { p_token: token });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
  const row = (Array.isArray(data) ? data[0] : data) as PublicBrochureRow;
  if (!row?.id) return null;

  return {
    brochure: {
      id: row.id, name: row.name, welcomeText: row.welcome_text,
      includePackages: row.include_packages, includeFaqs: row.include_faqs, closingText: row.closing_text,
    },
    venue: {
      id: row.venue_id, name: row.venue_name ?? "Your Venue", businessName: row.venue_business_name,
      logoUrl: row.venue_logo_url, story: row.venue_story, heroImageUrl: row.venue_hero_image_url,
      primaryColor: row.venue_primary_color || "#5D6F5D", secondaryColor: row.venue_secondary_color || "#4F5F4F",
      accentColor: row.venue_accent_color || "#B8AEA1",
      email: row.venue_email, phone: row.venue_phone, website: row.venue_website,
    },
    packages: row.include_packages ? (row.packages ?? []).map((p) => ({ name: p.name, description: p.description, basePrice: p.basePrice, category: p.category })) : [],
    // RPC already applies filter_published_venue_faqs; keep published!==false as defense-in-depth.
    faqs: row.include_faqs
      ? (row.faqs ?? [])
          .filter((f) => f.audience !== "vendors" && f.published !== false)
          .map((f) => ({ question: f.question, answer: f.answer }))
      : [],
  };
}

// ---- CRUD --------------------------------------------------------------------

export async function createBrochure(input: BrochureInput): Promise<CreateBrochureResult> {
  const errors = validateInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    const brochureId = await repo.insertBrochure(supabase, venueId, input);
    await repo.insertActivity(supabase, venueId, brochureId, "created", "Brochure created");
    return { ok: true, brochureId } as CreateBrochureResult;
  });
  return result as CreateBrochureResult;
}

export async function updateBrochure_(id: string, input: BrochureInput): Promise<BrochureActionResult> {
  const errors = validateInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateBrochure(supabase, venueId, id, input);
    await repo.insertActivity(supabase, venueId, id, "updated", "Brochure updated");
    return { ok: true } as BrochureActionResult;
  });
  return result as BrochureActionResult;
}

export async function setBrochureArchived_(id: string, isArchived: boolean): Promise<BrochureActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.setBrochureArchived(supabase, venueId, id, isArchived);
    return { ok: true } as BrochureActionResult;
  });
  return result as BrochureActionResult;
}

export async function deleteBrochure_(id: string): Promise<BrochureActionResult> {
  const result = await withVenue(async (supabase, venueId) => repo.deleteBrochure(supabase, venueId, id));
  return result as BrochureActionResult;
}

export async function duplicateBrochure_(id: string, newName: string): Promise<CreateBrochureResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const brochureId = await repo.duplicateBrochure(supabase, venueId, id, newName);
    return { ok: true, brochureId } as CreateBrochureResult;
  });
  return result as CreateBrochureResult;
}

// ---- sharing --------------------------------------------------------------------

/**
 * Work Package D7B — shares a Brochure's public link with a chosen Lead.
 * Reuses ShareDialog's own recipient-resolution discipline (never a typed
 * free-text email) — the venue picks a Lead, this resolves their real
 * contact. The public link is the same `/brochure/[token]` route the
 * brochure always has (share_token generated at creation, not per-send).
 */
export async function sendBrochureToLead(brochureId: string, leadId: string, customMessage?: string): Promise<BrochureActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const [brochure, lead, venue] = await Promise.all([
      repo.getBrochure(supabase, venueId, brochureId),
      getLead(leadId),
      getCurrentVenue(),
    ]);
    if (!brochure) return { ok: false, message: "Brochure not found." } as BrochureActionResult;
    if (!lead?.email) return { ok: false, message: "This lead doesn't have an email address on file." } as BrochureActionResult;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.wevenu.com";
    const url = `${baseUrl}/brochure/${brochure.shareToken}`;
    const venueName = venue?.name ?? "Our venue";
    const recipientName = leadDisplayName(lead.firstName, lead.lastName, lead.partnerFirstName, lead.partnerLastName);
    const intro = customMessage?.trim() || `Thanks for your interest in ${venueName}! Here's a look at what we offer.`;

    const sendResult = await sendEmail({
      to: lead.email,
      subject: `${brochure.name} — ${venueName}`,
      text: `Hi ${lead.firstName || recipientName},\n\n${intro}\n\nView it here: ${url}\n\n— ${venueName}`,
      html: `<p>Hi ${lead.firstName || recipientName},</p><p>${intro}</p><p><a href="${url}">View ${brochure.name}</a></p><p>— ${venueName}</p>`,
    });
    if (!sendResult.ok) return { ok: false, message: sendResult.message } as BrochureActionResult;

    await repo.insertActivity(supabase, venueId, brochureId, "shared", `Shared with ${recipientName}`);
    return { ok: true } as BrochureActionResult;
  });
  return result as BrochureActionResult;
}
