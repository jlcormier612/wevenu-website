/**
 * Guidance landing index. Editorial publishable articles are always listed;
 * extra published DB rows can appear, but matching slugs are not duplicated.
 */

export type HelpLandingArticle = { slug: string; title: string };

export type EditorialLandingArticle = {
  slug: string;
  title: string;
  category: string;
};

export type PublishedLandingRow = {
  slug: string;
  title: string;
  goal_category: string;
};

export function collectPublishedHelpArticlesByCategory(
  editorial: readonly EditorialLandingArticle[],
  dbRows: readonly PublishedLandingRow[],
): Map<string, HelpLandingArticle[]> {
  const byCategory = new Map<string, HelpLandingArticle[]>();
  const seen = new Set<string>();

  for (const article of editorial) {
    const list = byCategory.get(article.category) ?? [];
    list.push({ slug: article.slug, title: article.title });
    byCategory.set(article.category, list);
    seen.add(article.slug);
  }

  for (const row of dbRows) {
    if (seen.has(row.slug)) continue;
    const list = byCategory.get(row.goal_category) ?? [];
    list.push({ slug: row.slug, title: row.title });
    byCategory.set(row.goal_category, list);
    seen.add(row.slug);
  }

  return byCategory;
}
