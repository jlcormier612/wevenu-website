/**
 * Short emotional/design descriptors for Collection picker cards.
 * Keyed by `collections.key`. Kept independent of DB `description` so picker
 * copy can be tuned without reopening Collection DNA migrations.
 */
export const COLLECTION_DESCRIPTORS: Record<string, string> = {
  classic: "Organic, joyful & free-flowing", // Wildflower
  // Unified with collections.description (migration 20261242) — picker + carousel share one line.
  modern: "Cinematic night editorial — dark, dramatic, Vogue energy", // Midnight
  garden: "Charming, English & countryside", // Garden Party
  minimal: "Quiet, minimal & intimate", // Linen
  romance: "Romantic, soft & poetic", // Rosé
  coastal: "Airy, editorial & effortless", // Coastal
  champagne: "Elegant, formal & polished", // Champagne
  // Unified with collections.description (migration 20261243) — picker + carousel share one line.
  velvet: "Dramatic, moody & candlelit", // Velvet
  estate: "Romantic, refined & timeless", // European Estate
  rustic: "Warm, weathered & organic", // Rustic
  industrial: "Bold, editorial & structured", // Industrial
};

export function collectionDescriptor(key: string, fallback?: string | null): string {
  return COLLECTION_DESCRIPTORS[key] ?? fallback ?? "";
}
