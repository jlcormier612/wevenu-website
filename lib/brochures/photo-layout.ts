/**
 * Curated brochure photo presentation styles.
 * Hello to Cheers owns spacing/cropping; the venue only chooses the style
 * and the ordered photo list (index 0 = primary/hero).
 */

import { sameBrochurePhotoUrl } from "@/lib/brochures/photo-storage";

export const BROCHURE_PHOTO_LAYOUTS = ["classic", "gallery", "story", "editorial"] as const;

export type BrochurePhotoLayout = (typeof BROCHURE_PHOTO_LAYOUTS)[number];

export const BROCHURE_PHOTO_LAYOUT_LABELS: Record<BrochurePhotoLayout, string> = {
  classic: "Classic",
  gallery: "Gallery",
  story: "Story",
  editorial: "Editorial",
};

export const BROCHURE_PHOTO_LAYOUT_HINTS: Record<BrochurePhotoLayout, string> = {
  classic: "One large hero with two supporting images.",
  gallery: "A large primary image with a supporting gallery.",
  story: "A large image, then content rhythm with a supporting image.",
  editorial: "An asymmetric, curated composition.",
};

export function isBrochurePhotoLayout(value: string | null | undefined): value is BrochurePhotoLayout {
  return BROCHURE_PHOTO_LAYOUTS.includes(value as BrochurePhotoLayout);
}

export function normalizeBrochurePhotoLayout(
  value: string | null | undefined,
): BrochurePhotoLayout {
  return isBrochurePhotoLayout(value) ? value : "classic";
}

export function normalizeBrochurePhotoUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return [];
  const out: string[] = [];
  for (const item of urls) {
    const url = typeof item === "string" ? item.trim() : "";
    if (!url) continue;
    // Collapse query-string variants of the same object (e.g. hero.png?v=… vs ?t=…).
    if (out.some((existing) => sameBrochurePhotoUrl(existing, url))) continue;
    out.push(url);
  }
  return out;
}

/** Photos actually composed for a layout — never empty broken slots. */
export function photosForBrochureLayout(
  urls: string[],
  layout: BrochurePhotoLayout,
): { hero: string | null; supporting: string[] } {
  const photos = normalizeBrochurePhotoUrls(urls);
  const hero = photos[0] ?? null;
  const rest = photos.slice(1);
  if (!hero) return { hero: null, supporting: [] };
  if (layout === "classic") return { hero, supporting: rest.slice(0, 2) };
  if (layout === "story") return { hero, supporting: rest.slice(0, 1) };
  if (layout === "editorial") return { hero, supporting: rest.slice(0, 3) };
  return { hero, supporting: rest };
}

export function moveBrochurePhoto(
  urls: string[],
  fromIndex: number,
  toIndex: number,
): string[] {
  const next = [...normalizeBrochurePhotoUrls(urls)];
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= next.length ||
    toIndex >= next.length ||
    fromIndex === toIndex
  ) {
    return next;
  }
  const [item] = next.splice(fromIndex, 1);
  if (!item) return next;
  next.splice(toIndex, 0, item);
  return next;
}

export function setPrimaryBrochurePhoto(urls: string[], url: string): string[] {
  const next = normalizeBrochurePhotoUrls(urls);
  const i = next.findIndex((item) => sameBrochurePhotoUrl(item, url));
  if (i <= 0) return next;
  return moveBrochurePhoto(next, i, 0);
}

export function removeBrochurePhoto(urls: string[], url: string): string[] {
  return normalizeBrochurePhotoUrls(urls).filter((u) => !sameBrochurePhotoUrl(u, url));
}

export function addBrochurePhoto(urls: string[], url: string): string[] {
  const next = normalizeBrochurePhotoUrls(urls);
  if (!url.trim() || next.some((item) => sameBrochurePhotoUrl(item, url))) return next;
  return normalizeBrochurePhotoUrls([...next, url.trim()]);
}
