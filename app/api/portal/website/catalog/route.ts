import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import type { HostedExperienceCatalog } from "@/lib/wedding-website/types";

// Hosted Experience Platform — the Studio's four independent pickers
// (Layout Collection, Color Story, Typography, Photo Style) all read from
// here. Public catalog data (every table grants select to anon,
// authenticated with a permissive RLS policy) — no portal token needed,
// same as any other read-only reference data.
//
// 2026-07-24, four independent dimensions: Color Story is still returned
// nested under its Collection (a real, useful curated "quick start" list —
// see wedding-website-hosted-experience-four-dimensions-report.md), but is
// no longer the only way to set color — the couple's own custom
// color_primary/secondary/accent/neutral/background/text columns on
// couple_websites always take precedence when set (Part 2: reuse the exact
// venue color-picker, not a locked preset). Typography and the new Photo
// Style catalog are both flat, collection-independent lists.
export async function GET() {
  const supabase = await createClient();

  const [{ data: collections }, { data: colorStories }, { data: typographyStyles }, { data: photoStyles }] = await Promise.all([
    supabase.from("collections").select("id, key, name, description, is_premium, sort_order, swatch_accent, layout_config")
      .eq("is_active", true).order("sort_order"),
    supabase.from("color_stories").select("id, collection_id, key, name, sort_order, tokens").order("sort_order"),
    supabase.from("typography_styles").select("id, key, name, sort_order, tokens").order("sort_order"),
    supabase.from("photo_styles").select("id, key, name, description, sort_order, tokens")
      .eq("is_active", true).order("sort_order"),
  ]);

  const catalog: HostedExperienceCatalog = {
    collections: (collections ?? []).map((c) => ({
      id: c.id, key: c.key, name: c.name, description: c.description,
      isPremium: c.is_premium, sortOrder: c.sort_order, swatchAccent: c.swatch_accent,
      layoutConfig: c.layout_config ?? {},
      colorStories: (colorStories ?? [])
        .filter((cs) => cs.collection_id === c.id)
        .map((cs) => ({ id: cs.id, key: cs.key, name: cs.name, sortOrder: cs.sort_order, tokens: cs.tokens })),
    })),
    typographyStyles: (typographyStyles ?? []).map((t) => ({
      id: t.id, key: t.key, name: t.name, sortOrder: t.sort_order, tokens: t.tokens,
    })),
    photoStyles: (photoStyles ?? []).map((p) => ({
      id: p.id, key: p.key, name: p.name, description: p.description, sortOrder: p.sort_order, tokens: p.tokens,
    })),
  };

  return NextResponse.json(catalog);
}
