/**
 * /api/portal/journal
 *
 * GET  ?token=...
 *   Returns all journal entries for the couple, ordered by entry_date desc.
 *
 * POST { token, date, title?, body, milestone?, mediaId? }
 *   Creates a new journal entry.
 *
 * DELETE { token, entryId }
 *   Removes a journal entry (couple only — enforced by SECURITY DEFINER).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import type { JournalEntry } from "@/lib/portal/types";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_journal_entries", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const raw = data as { entries?: JournalEntry[]; error?: string } | null;
  if (raw?.error) return NextResponse.json({ error: raw.error }, { status: 401 });

  return NextResponse.json({ entries: raw?.entries ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json() as {
    token: string;
    date?: string;
    title?: string;
    body: string;
    milestone?: string;
    mediaId?: string;
  };

  const { token, date, title, body: entryBody, milestone, mediaId } = body;
  if (!token || !entryBody?.trim()) {
    return NextResponse.json({ ok: false, error: "Missing token or body." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_journal_entry", {
    p_token:     token,
    p_date:      date ?? new Date().toISOString().split("T")[0],
    p_title:     title ?? "",
    p_body:      entryBody,
    p_milestone: milestone ?? null,
    p_media_id:  mediaId ?? null,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: false });
}

export async function DELETE(request: Request) {
  const body = await request.json() as { token: string; entryId: string };
  const { token, entryId } = body;

  if (!token || !entryId) {
    return NextResponse.json({ ok: false, error: "Missing token or entryId." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_journal_entry", {
    p_token:    token,
    p_entry_id: entryId,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: false });
}
