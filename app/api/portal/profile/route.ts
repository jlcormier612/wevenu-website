/**
 * /api/portal/profile
 *
 * GET  ?token=...
 *   Returns couple profile (hashtag, our story, hero/couple photo URLs)
 *   plus categorised media (engagement, inspiration, memory photos).
 *
 * PATCH { token, ...fields }
 *   Dispatches to the right SECURITY DEFINER function based on which fields
 *   are present:
 *     heroPhotoId   → set_hero_photo
 *     couplePhotoId → set_couple_photo
 *     (anything else) → save_couple_profile (weddingHashtag, ourStory)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import type { CoupleProfile } from "@/lib/portal/types";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_couple_profile", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const raw = data as {
    profile?: Partial<CoupleProfile> | null;
    engagementPhotos?: CoupleProfile["engagementPhotos"];
    inspirationPhotos?: CoupleProfile["inspirationPhotos"];
    memoryPhotos?: CoupleProfile["memoryPhotos"];
    latestJournalEntry?: CoupleProfile["latestJournalEntry"];
    error?: string;
  } | null;

  if (raw?.error) return NextResponse.json({ error: raw.error }, { status: 401 });

  const profile: CoupleProfile = {
    weddingHashtag:     raw?.profile?.weddingHashtag  ?? null,
    ourStory:           raw?.profile?.ourStory         ?? null,
    heroPhotoId:        raw?.profile?.heroPhotoId      ?? null,
    heroPhotoUrl:       raw?.profile?.heroPhotoUrl     ?? null,
    couplePhotoId:      raw?.profile?.couplePhotoId    ?? null,
    couplePhotoUrl:     raw?.profile?.couplePhotoUrl   ?? null,
    engagementPhotos:   raw?.engagementPhotos          ?? [],
    inspirationPhotos:  raw?.inspirationPhotos         ?? [],
    memoryPhotos:       raw?.memoryPhotos              ?? [],
    latestJournalEntry: raw?.latestJournalEntry        ?? null,
  };

  return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
  const body = await request.json() as {
    token: string;
    heroPhotoId?: string;
    couplePhotoId?: string;
    weddingHashtag?: string;
    ourStory?: string;
  };

  const { token, heroPhotoId, couplePhotoId, weddingHashtag, ourStory } = body;
  if (!token) return NextResponse.json({ ok: false, error: "Missing token." }, { status: 400 });

  const supabase = await createClient();

  if (heroPhotoId !== undefined) {
    const { data, error } = await supabase.rpc("set_hero_photo", {
      p_token: token, p_media_id: heroPhotoId,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data ?? { ok: false });
  }

  if (couplePhotoId !== undefined) {
    const { data, error } = await supabase.rpc("set_couple_photo", {
      p_token: token, p_media_id: couplePhotoId,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data ?? { ok: false });
  }

  // Default: update text fields
  const { data, error } = await supabase.rpc("save_couple_profile", {
    p_token:            token,
    p_wedding_hashtag:  weddingHashtag ?? "",
    p_our_story:        ourStory ?? "",
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: false });
}
