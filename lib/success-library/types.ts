/**
 * Help & Guides content store (formerly Success Library).
 * Table remains success_library_articles — canonical HQ-authored pipeline.
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

/** Landing page grouping — one Help & Guides area and its published articles (may be empty). */
export type SuccessLibraryCategory = {
  category: string;
  description: string;
  articles: { slug: string; title: string }[];
};
