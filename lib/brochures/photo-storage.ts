/**
 * Brochure photo files live in the public uploads bucket at
 * {venueId}/brochure-photos/{file}. The venue hero image is a different
 * asset and must not be deleted from this library.
 */

export function brochurePhotoObjectPath(url: string, venueId: string): string | null {
  if (!url.trim() || !venueId.trim()) return null;
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const marker = `/object/public/uploads/${venueId}/brochure-photos/`;
  const at = pathname.indexOf(marker);
  if (at < 0) return null;
  const file = decodeURIComponent(pathname.slice(at + marker.length));
  if (!file || file.includes("/") || file.includes("\\") || file.includes("..")) return null;
  return `${venueId}/brochure-photos/${file}`;
}

export function isDeletableBrochurePhoto(url: string, venueId: string): boolean {
  return brochurePhotoObjectPath(url, venueId) !== null;
}

export function sameBrochurePhotoUrl(a: string, b: string): boolean {
  return a.split("?")[0] === b.split("?")[0];
}

/** Drop every query-string variant. Order of the survivors is unchanged, so the next photo becomes primary. */
export function withoutBrochurePhoto(urls: string[], url: string): string[] {
  return urls.filter((item) => !sameBrochurePhotoUrl(item, url));
}
