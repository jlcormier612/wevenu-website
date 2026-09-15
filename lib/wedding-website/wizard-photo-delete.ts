/**
 * Safe cover-photo handling when a couple deletes an engagement photo from
 * the Website Studio wizard. Does not invent a second asset model — callers
 * still delete via DELETE /api/portal/media (delete_couple_media).
 */

export type WizardPhoto = { id: string; url: string };

export function afterWizardPhotoDeleted(input: {
  deletedId: string;
  deletedUrl: string;
  photos: WizardPhoto[];
  selectedPhotoUrl: string;
  coverImageUrl?: string | null;
}): {
  photos: WizardPhoto[];
  selectedPhotoUrl: string;
  /** True when the website cover pointed at the deleted asset and must be cleared. */
  clearCover: boolean;
} {
  const photos = input.photos.filter((p) => p.id !== input.deletedId);
  const wasSelected = input.selectedPhotoUrl === input.deletedUrl;
  const coverWasDeleted = !!input.coverImageUrl && input.coverImageUrl === input.deletedUrl;
  const selectedPhotoUrl = wasSelected ? (photos[0]?.url ?? "") : input.selectedPhotoUrl;
  return {
    photos,
    selectedPhotoUrl,
    clearCover: coverWasDeleted,
  };
}
