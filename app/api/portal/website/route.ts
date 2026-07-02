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
  };

  const { token, slug, isPublished, password, clearPassword, theme, themePalette, accentColor,
          fontPairing, sectionOrder, contentKey, contentValue, sectionsEnabled, scheduleSync } = body;

  if (!token) return NextResponse.json({ ok: false, error: "Missing token." }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_my_website", {
    p_token:            token,
    p_slug:             slug             ?? null,
    p_is_published:     isPublished      ?? null,
    p_password:         password         ?? null,
    p_clear_password:   clearPassword    ?? false,
    p_theme:            theme            ?? null,
    p_theme_palette:    themePalette     ?? null,
    p_accent_color:     accentColor      ?? null,
    p_font_pairing:     fontPairing      ?? null,
    p_section_order:    sectionOrder     ?? null,
    p_content_key:      contentKey       ?? null,
    p_content_value:    contentValue     ? JSON.stringify(contentValue) : null,
    p_sections_enabled: sectionsEnabled  ?? null,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 422 });

  // scheduleSync still handled via direct update (pre-Sprint-68 pattern)
  if (scheduleSync !== undefined && (data as Record<string, unknown>)?.siteId) {
    const siteId = (data as Record<string, unknown>).siteId as string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("couple_websites") as any)
      .update({ schedule_sync: scheduleSync })
      .eq("id", siteId);
  }

  return NextResponse.json(data ?? { ok: false });
}
