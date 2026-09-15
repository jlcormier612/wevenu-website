"use client";

import * as React from "react";

import { ChevronDown, ChevronUp, Loader2, Star, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadToStorage, listPublicUploadUrls } from "@/lib/storage/upload";
import {
  addBrochurePhoto,
  BROCHURE_PHOTO_LAYOUT_HINTS,
  BROCHURE_PHOTO_LAYOUT_LABELS,
  BROCHURE_PHOTO_LAYOUTS,
  moveBrochurePhoto,
  normalizeBrochurePhotoLayout,
  removeBrochurePhoto,
  setPrimaryBrochurePhoto,
  type BrochurePhotoLayout,
} from "@/lib/brochures/photo-layout";
import { cn } from "@/lib/utils";

export function BrochurePhotosEditor({
  venueId,
  venueHeroUrl,
  photoUrls,
  photoLayout,
  onChange,
  pending,
}: {
  venueId: string;
  venueHeroUrl: string | null;
  photoUrls: string[];
  photoLayout: BrochurePhotoLayout;
  onChange: (next: { photoUrls: string[]; photoLayout: BrochurePhotoLayout }) => void;
  pending?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  const [library, setLibrary] = React.useState<string[]>(() => {
    const urls: string[] = [];
    if (venueHeroUrl) urls.push(venueHeroUrl);
    for (const url of photoUrls) if (!urls.includes(url)) urls.push(url);
    return urls;
  });

  React.useEffect(() => {
    let cancelled = false;
    void listPublicUploadUrls(`${venueId}/brochure-photos`).then((listed) => {
      if (cancelled) return;
      setLibrary((prev) => {
        const next = [...prev];
        for (const url of listed) {
          if (!next.some((existing) => existing.split("?")[0] === url.split("?")[0])) {
            next.push(url);
          }
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [venueId]);

  function persist(urls: string[], layout: BrochurePhotoLayout) {
    onChange({ photoUrls: urls, photoLayout: layout });
  }

  async function handleAddFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      let nextUrls = photoUrls;
      const added: string[] = [];
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} must be under 5 MB.`);
          continue;
        }
        const url = await uploadToStorage(
          "uploads",
          `${venueId}/brochure-photos/${crypto.randomUUID()}`,
          file,
        );
        nextUrls = addBrochurePhoto(nextUrls, url);
        added.push(url);
      }
      if (added.length > 0) {
        persist(nextUrls, photoLayout);
        setLibrary((prev) => {
          const next = [...prev];
          for (const url of added) if (!next.includes(url)) next.push(url);
          return next;
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add photo.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-heading">Photos</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose the photos you&apos;d like to feature in your brochure. Removing a photo here does not delete it from your venue.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/40">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Add photos
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={uploading || pending}
            onChange={handleAddFiles}
          />
        </label>
      </div>

      {library.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {library.map((url) => {
            const selected = photoUrls.includes(url);
            const isPrimary = selected && photoUrls[0] === url;
            const selectedIndex = photoUrls.indexOf(url);
            return (
              <div
                key={url}
                className={cn(
                  "overflow-hidden rounded-md border bg-muted/20",
                  selected ? "border-heading" : "border-border",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="aspect-[4/3] w-full object-cover" />
                <div className="flex flex-wrap items-center gap-1 p-2">
                  {selected ? (
                    <>
                      {isPrimary ? (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-heading">Primary</span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          disabled={pending}
                          onClick={() => persist(setPrimaryBrochurePhoto(photoUrls, url), photoLayout)}
                        >
                          <Star className="mr-1 h-3 w-3" />
                          Primary
                        </Button>
                      )}
                      {selectedIndex > 0 ? (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          disabled={pending}
                          aria-label="Move earlier"
                          onClick={() => persist(moveBrochurePhoto(photoUrls, selectedIndex, selectedIndex - 1), photoLayout)}
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                      {selectedIndex >= 0 && selectedIndex < photoUrls.length - 1 ? (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          disabled={pending}
                          aria-label="Move later"
                          onClick={() => persist(moveBrochurePhoto(photoUrls, selectedIndex, selectedIndex + 1), photoLayout)}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="ml-auto text-muted-foreground hover:text-destructive"
                        disabled={pending}
                        aria-label="Remove from brochure"
                        onClick={() => persist(removeBrochurePhoto(photoUrls, url), photoLayout)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={pending}
                      onClick={() => persist(addBrochurePhoto(photoUrls, url), photoLayout)}
                    >
                      Use in brochure
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No photos yet. Add a photo to begin.</p>
      )}

      <div className="space-y-2">
        <Label className="text-sm font-medium text-heading">Photo layout</Label>
        <p className="text-xs text-muted-foreground">
          A presentation style. Hello to Cheers handles spacing and cropping.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {BROCHURE_PHOTO_LAYOUTS.map((layout) => (
            <button
              key={layout}
              type="button"
              disabled={pending}
              onClick={() => persist(photoUrls, layout)}
              className={cn(
                "rounded-md border px-3 py-3 text-left",
                photoLayout === layout ? "border-heading bg-muted/40" : "border-border hover:bg-muted/20",
              )}
            >
              <p className="text-sm font-medium text-heading">{BROCHURE_PHOTO_LAYOUT_LABELS[layout]}</p>
              <p className="mt-1 text-xs text-muted-foreground">{BROCHURE_PHOTO_LAYOUT_HINTS[layout]}</p>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Current: {BROCHURE_PHOTO_LAYOUT_LABELS[normalizeBrochurePhotoLayout(photoLayout)]}
        </p>
      </div>
    </div>
  );
}
