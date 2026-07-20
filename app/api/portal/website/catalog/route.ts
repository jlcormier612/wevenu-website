import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import type { HostedExperienceCatalog } from "@/lib/wedding-website/types";

// Hosted Experience Platform Phase 1/2 — the Studio's Appearance picker
// reads from here instead of the hardcoded THEMES/FONT_PAIRINGS arrays
// that used to live only in components/portal/website-editor.tsx. Public
// catalog data (collections/color_stories/typography_styles all grant
// select to anon, authenticated with a permissive RLS policy) — no
// portal token needed, same as any other read-only reference data.
export async function GET() {
  const supabase = await createClient();

  const [{ data: collections }, { data: colorStories }, { data: typographyStyles }] = await Promise.all([
    supabase.from("collections").select("id, key, name, description, is_premium, sort_order, swatch_accent")
      .eq("is_active", true).order("sort_order"),
    supabase.from("color_stories").select("id, collection_id, key, name, sort_order, tokens").order("sort_order"),
    supabase.from("typography_styles").select("id, key, name, sort_order, tokens").order("sort_order"),
  ]);

  const catalog: HostedExperienceCatalog = {
    collections: (collections ?? []).map((c) => ({
      id: c.id, key: c.key, name: c.name, description: c.description,
      isPremium: c.is_premium, sortOrder: c.sort_order, swatchAccent: c.swatch_accent,
      colorStories: (colorStories ?? [])
        .filter((cs) => cs.collection_id === c.id)
        .map((cs) => ({ id: cs.id, key: cs.key, name: cs.name, sortOrder: cs.sort_order, tokens: cs.tokens })),
    })),
    typographyStyles: (typographyStyles ?? []).map((t) => ({
      id: t.id, key: t.key, name: t.name, sortOrder: t.sort_order, tokens: t.tokens,
    })),
  };

  return NextResponse.json(catalog);
}
