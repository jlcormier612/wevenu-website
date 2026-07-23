/**
 * Luv's Success Library (Hospitality Success Platform §4, 2026-07-22).
 * Server-only. Platform-wide content — every function here reads/writes
 * success_library_articles directly, with no venue_id scoping (the table
 * has none); RLS itself is what separates "any authenticated venue user
 * reads published articles" from "only HQ staff can write, drafts
 * included" — see the migration's own policies.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireAdminUser } from "@/lib/hq/crm-service";
import type {
  RelatedFeatureLink,
  SuccessLibraryArticle,
  SuccessLibraryArticleInput,
  SuccessLibraryCategory,
} from "@/lib/success-library/types";

type ArticleRow = {
  id: string; slug: string; title: string; goal_category: string;
  why_it_matters: string; when_to_use: string; best_practices: string; common_mistakes: string;
  related_features: RelatedFeatureLink[]; linked_gap_keys: string[];
  status: "draft" | "published"; version: number; created_at: string; updated_at: string;
};

function mapArticle(r: ArticleRow): SuccessLibraryArticle {
  return {
    id: r.id, slug: r.slug, title: r.title, goalCategory: r.goal_category,
    whyItMatters: r.why_it_matters, whenToUse: r.when_to_use, bestPractices: r.best_practices, commonMistakes: r.common_mistakes,
    relatedFeatures: r.related_features ?? [], linkedGapKeys: r.linked_gap_keys ?? [],
    status: r.status, version: r.version, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

const SELECT_COLUMNS = "id, slug, title, goal_category, why_it_matters, when_to_use, best_practices, common_mistakes, related_features, linked_gap_keys, status, version, created_at, updated_at";

// ---- venue-facing reads (published only, via RLS) --------------------------

export async function getPublishedCategories(): Promise<SuccessLibraryCategory[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("success_library_articles")
    .select("slug, title, goal_category")
    .eq("status", "published")
    .order("goal_category").order("title");
  const rows = (data ?? []) as { slug: string; title: string; goal_category: string }[];

  const byCategory = new Map<string, { slug: string; title: string }[]>();
  for (const r of rows) {
    const list = byCategory.get(r.goal_category) ?? [];
    list.push({ slug: r.slug, title: r.title });
    byCategory.set(r.goal_category, list);
  }
  return Array.from(byCategory.entries()).map(([category, articles]) => ({ category, articles }));
}

export async function getPublishedArticleBySlug(slug: string): Promise<SuccessLibraryArticle | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("success_library_articles")
    .select(SELECT_COLUMNS).eq("slug", slug).eq("status", "published").maybeSingle<ArticleRow>();
  return data ? mapArticle(data) : null;
}

/** Guided Setup §4.2 — one published article per gap key, for the Getting Started card's secondary "read more" link. Never the primary CTA — see the plan's "Luv is a companion, not documentation" rule. */
export async function getArticlesForGapKeys(gapKeys: string[]): Promise<Map<string, SuccessLibraryArticle>> {
  if (!isSupabaseConfigured || gapKeys.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("success_library_articles")
    .select(SELECT_COLUMNS).eq("status", "published").overlaps("linked_gap_keys", gapKeys);
  const map = new Map<string, SuccessLibraryArticle>();
  for (const row of (data ?? []) as ArticleRow[]) {
    const article = mapArticle(row);
    for (const key of article.linkedGapKeys) {
      if (gapKeys.includes(key) && !map.has(key)) map.set(key, article);
    }
  }
  return map;
}

// ---- HQ authoring (drafts + published, is_hq_admin()-gated via RLS) --------

export async function getAllArticlesForAdmin(): Promise<SuccessLibraryArticle[]> {
  const actor = await requireAdminUser();
  if (!actor || !isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("success_library_articles")
    .select(SELECT_COLUMNS).order("goal_category").order("title");
  return ((data ?? []) as ArticleRow[]).map(mapArticle);
}

export async function getArticleForAdmin(id: string): Promise<SuccessLibraryArticle | null> {
  const actor = await requireAdminUser();
  if (!actor || !isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("success_library_articles")
    .select(SELECT_COLUMNS).eq("id", id).maybeSingle<ArticleRow>();
  return data ? mapArticle(data) : null;
}

export type SuccessLibraryActionResult = { ok: true; id: string } | { ok: false; message: string };

function toRow(input: SuccessLibraryArticleInput) {
  return {
    slug: input.slug.trim(), title: input.title.trim(), goal_category: input.goalCategory.trim(),
    why_it_matters: input.whyItMatters, when_to_use: input.whenToUse,
    best_practices: input.bestPractices, common_mistakes: input.commonMistakes,
    related_features: input.relatedFeatures, linked_gap_keys: input.linkedGapKeys,
    status: input.status,
  };
}

export async function createArticle(input: SuccessLibraryArticleInput): Promise<SuccessLibraryActionResult> {
  const actor = await requireAdminUser();
  if (!actor) return { ok: false, message: "Not signed in as an HQ admin." };
  if (!input.slug.trim() || !input.title.trim()) return { ok: false, message: "Slug and title are required." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("success_library_articles")
    .insert({ ...toRow(input), created_by: actor.userId, updated_by: actor.userId })
    .select("id").single<{ id: string }>();
  if (error) return { ok: false, message: error.message };
  return { ok: true, id: data.id };
}

export async function updateArticle(id: string, input: SuccessLibraryArticleInput): Promise<SuccessLibraryActionResult> {
  const actor = await requireAdminUser();
  if (!actor) return { ok: false, message: "Not signed in as an HQ admin." };
  if (!input.slug.trim() || !input.title.trim()) return { ok: false, message: "Slug and title are required." };
  const supabase = await createClient();
  const { data: current } = await supabase.from("success_library_articles").select("version").eq("id", id).maybeSingle<{ version: number }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("success_library_articles") as any)
    .update({ ...toRow(input), updated_by: actor.userId, version: (current?.version ?? 0) + 1 })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, id };
}

export async function deleteArticle(id: string): Promise<SuccessLibraryActionResult> {
  const actor = await requireAdminUser();
  if (!actor) return { ok: false, message: "Not signed in as an HQ admin." };
  const supabase = await createClient();
  const { error } = await supabase.from("success_library_articles").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, id };
}
