/**
 * Luv's Success Library (Hospitality Success Platform §4, 2026-07-22).
 * Pure types — no framework or database imports.
 */

export type RelatedFeatureLink = { label: string; href: string };

export type SuccessLibraryArticleStatus = "draft" | "published";

export type SuccessLibraryArticle = {
  id: string;
  slug: string;
  title: string;
  goalCategory: string;
  whyItMatters: string;
  whenToUse: string;
  bestPractices: string;
  commonMistakes: string;
  relatedFeatures: RelatedFeatureLink[];
  linkedGapKeys: string[];
  status: SuccessLibraryArticleStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type SuccessLibraryArticleInput = {
  slug: string;
  title: string;
  goalCategory: string;
  whyItMatters: string;
  whenToUse: string;
  bestPractices: string;
  commonMistakes: string;
  relatedFeatures: RelatedFeatureLink[];
  linkedGapKeys: string[];
  status: SuccessLibraryArticleStatus;
};

/** Landing page grouping — one goal category, its published articles. */
export type SuccessLibraryCategory = {
  category: string;
  articles: { slug: string; title: string }[];
};
