import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ exists: false });
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_my_website", { p_token: token });
  return NextResponse.json(data ?? { exists: false });
}

export async function POST(request: Request) {
  const body = await request.json() as {
    token: string;
    slug?: string;
    isPublished?: boolean;
    password?: string;
    clearPassword?: boolean;
    theme?: string;
    themePalette?: string;
    accentColor?: string;
    fontPairing?: string;
    sectionOrder?: string[];
    contentKey?: string;
    contentValue?: unknown;
    sectionsEnabled?: string[];
    scheduleSync?: boolean;
    collectionId?: string;
    colorStoryId?: string;
    typographyStyleId?: string;
    photoStyleId?: string;
    colorPrimary?: string;
    colorSecondary?: string;
    colorAccent?: string;
    colorNeutral?: string;
    colorBackground?: string;
    colorText?: string;
    clearCustomColors?: boolean;
  };

  const { token, slug, isPublished, password, clearPassword, theme, themePalette, accentColor,
          fontPairing, sectionOrder, contentKey, contentValue, sectionsEnabled, scheduleSync,
          collectionId, colorStoryId, typographyStyleId, photoStyleId,
          colorPrimary, colorSecondary, colorAccent, colorNeutral, colorBackground, colorText,
          clearCustomColors } = body;

  if (!token) return NextResponse.json({ ok: false, error: "Missing token." }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_my_website", {
    p_token:               token,
    p_slug:                slug             ?? null,
    p_is_published:        isPublished      ?? null,
    p_password:            password         ?? null,
    p_clear_password:      clearPassword    ?? false,
    p_theme:               theme            ?? null,
    p_theme_palette:       themePalette     ?? null,
    p_accent_color:        accentColor      ?? null,
    p_font_pairing:        fontPairing      ?? null,
    p_section_order:       sectionOrder     ?? null,
    p_content_key:         contentKey       ?? null,
    // Do NOT JSON.stringify here — supabase-js already serializes RPC params
    // for the request; p_content_value is a jsonb-typed parameter, so it must
    // be passed as a native object/array. Stringifying it first caused every
    // section saved through the Studio to be stored as a JSON *string* inside
    // the jsonb column instead of a nested object, which silently broke
    // guest-visible rendering (content.dress_code?.formality etc. is
    // undefined on a string, so the section renders as empty/fallback with
    // no error). See supabase/migrations/20261023000000_fix_website_content_double_encoding.sql
    // for the one-time repair of already-corrupted content.
    p_content_value:       contentValue     ?? null,
    p_sections_enabled:    sectionsEnabled  ?? null,
    p_schedule_sync:       scheduleSync     ?? null,
    // Hosted Experience Platform Phase 2 — the Studio now sends catalog IDs
    // instead of the theme/themePalette/fontPairing strings above; both are
    // still accepted (see the migration's own note on why), but the Studio
    // itself only ever sends these three going forward.
    p_collection_id:       collectionId       ?? null,
    p_color_story_id:      colorStoryId       ?? null,
    p_typography_style_id: typographyStyleId  ?? null,
    // Photo Style + full custom Color Story (2026-07-24) — Part 2/4's two
    // fully independent dimensions.
    p_photo_style_id:      photoStyleId       ?? null,
    p_color_primary:       colorPrimary       ?? null,
    p_color_secondary:     colorSecondary     ?? null,
    p_color_accent:        colorAccent        ?? null,
    p_color_neutral:       colorNeutral       ?? null,
    p_color_background:    colorBackground    ?? null,
    p_color_text:          colorText          ?? null,
    p_clear_custom_colors: clearCustomColors  ?? false,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 422 });

  return NextResponse.json(data ?? { ok: false });
}
