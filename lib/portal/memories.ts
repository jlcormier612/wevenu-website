/**
 * Couple Home — Memories / Planning Journal presentation (Impl 7).
 *
 * Soft emotional teaser at the bottom of Home (P4). Reuses existing
 * `latestJournalEntry` + `inspirationPhotos` from the portal profile payload —
 * no new memory system, tables, APIs, or photo processing.
 *
 * Destination SoT remains Story (`story`). Never task, progress, or venue ops.
 */

import type { ClientMedia, JournalEntry } from "@/lib/portal/types";

export const MEMORIES_HEADING = "A moment from your journey";
export const MEMORIES_DESTINATION: "story" = "story";
/** Very small horizontal collection — never a gallery. */
export const MEMORIES_PHOTO_CAP = 3;

export const MEMORIES_EMPTY_INVITE = "Your story is still beginning.";
export const MEMORIES_EMPTY_SUPPORT =
  "Save the little moments that make this celebration yours.";
export const MEMORIES_EMPTY_CTA = "Start your story";
export const MEMORIES_PREVIEW_CTA = "Open your story";

/** Task / ops language Memories must never use. */
const FORBIDDEN =
  /\b(upload more|complete your memories|add memories now|memory progress|photo count|\d+\s*photos?)\b/i;

export function usesForbiddenMemoriesLanguage(text: string): boolean {
  return FORBIDDEN.test(text);
}

export type HomeMemoryPhoto = {
  id: string;
  url: string;
  /** Meaningful alt when caption/title exists; empty string = decorative. */
  alt: string;
};

export type HomeMemoriesPreview = {
  kind: "preview";
  heading: typeof MEMORIES_HEADING;
  title: string | null;
  excerpt: string | null;
  dateLabel: string | null;
  /** One featured image when presenting a single visual. */
  featured: HomeMemoryPhoto | null;
  /** Small horizontal strip when several photos exist and no single featured. */
  collection: HomeMemoryPhoto[];
  ctaLabel: typeof MEMORIES_PREVIEW_CTA;
  destination: typeof MEMORIES_DESTINATION;
  accessibleLabel: string;
};

export type HomeMemoriesEmpty = {
  kind: "empty";
  heading: typeof MEMORIES_HEADING;
  inviteLine: typeof MEMORIES_EMPTY_INVITE;
  supportLine: typeof MEMORIES_EMPTY_SUPPORT;
  ctaLabel: typeof MEMORIES_EMPTY_CTA;
  destination: typeof MEMORIES_DESTINATION;
  accessibleLabel: string;
};

export type HomeMemoriesModel = HomeMemoriesPreview | HomeMemoriesEmpty;

export type HomeMemoriesInput = {
  latestJournalEntry: JournalEntry | null | undefined;
  inspirationPhotos: ClientMedia[] | null | undefined;
};

export function formatMemoryEntryDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function clipExcerpt(body: string, max = 120): string {
  const trimmed = body.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function photosFromInspiration(
  photos: ClientMedia[],
  captionFallback: string | null,
): HomeMemoryPhoto[] {
  return photos
    .filter((p) => Boolean(p.fileUrl))
    .slice(0, MEMORIES_PHOTO_CAP)
    .map((p) => ({
      id: p.id,
      url: p.fileUrl,
      alt: (p.caption?.trim() || captionFallback || "").trim(),
    }));
}

/**
 * Resolve the Home Memories strip from existing profile/journal data only.
 */
export function resolveHomeMemories(input: HomeMemoriesInput): HomeMemoriesModel {
  const entry = input.latestJournalEntry ?? null;
  const inspiration = input.inspirationPhotos ?? [];
  const inspPhotos = photosFromInspiration(
    inspiration,
    entry?.title?.trim() || null,
  );

  const hasJournal =
    Boolean(entry) &&
    Boolean(
      (entry!.title && entry!.title.trim()) ||
        (entry!.body && entry!.body.trim()) ||
        entry!.mediaUrl,
    );
  const hasPhotos = inspPhotos.length > 0 || Boolean(entry?.mediaUrl);

  if (!hasJournal && !hasPhotos) {
    return {
      kind: "empty",
      heading: MEMORIES_HEADING,
      inviteLine: MEMORIES_EMPTY_INVITE,
      supportLine: MEMORIES_EMPTY_SUPPORT,
      ctaLabel: MEMORIES_EMPTY_CTA,
      destination: MEMORIES_DESTINATION,
      accessibleLabel: `${MEMORIES_HEADING}. ${MEMORIES_EMPTY_INVITE} ${MEMORIES_EMPTY_CTA}`,
    };
  }

  const title = entry?.title?.trim() || null;
  const excerpt = entry?.body?.trim() ? clipExcerpt(entry.body) : null;
  const dateLabel = entry?.entryDate ? formatMemoryEntryDate(entry.entryDate) : null;

  let featured: HomeMemoryPhoto | null = null;
  let collection: HomeMemoryPhoto[] = [];

  if (entry?.mediaUrl) {
    // One featured memory from the journal — do not also render a gallery.
    featured = {
      id: `journal-${entry.id}`,
      url: entry.mediaUrl,
      alt: title || excerpt || "",
    };
  } else if (inspPhotos.length === 1) {
    featured = inspPhotos[0]!;
  } else if (inspPhotos.length > 1) {
    collection = inspPhotos;
  }

  const accessibleParts = [
    MEMORIES_HEADING,
    title,
    excerpt,
    MEMORIES_PREVIEW_CTA,
  ].filter(Boolean);

  return {
    kind: "preview",
    heading: MEMORIES_HEADING,
    title,
    excerpt,
    dateLabel,
    featured,
    collection,
    ctaLabel: MEMORIES_PREVIEW_CTA,
    destination: MEMORIES_DESTINATION,
    accessibleLabel: accessibleParts.join(". "),
  };
}
