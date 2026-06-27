"use client";

/**
 * Reusable image upload component (Sprint 19 — Shared Upload Infrastructure).
 *
 * Shows a preview of the current image (if any), a file input trigger,
 * upload progress, and an optional "Remove" action. Uses lib/storage/upload.ts
 * so the bucket/path pattern is consistent across the platform.
 */

import * as React from "react";

import { Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { uploadToStorage } from "@/lib/storage/upload";
import { cn } from "@/lib/utils";

export function ImageUpload({
  currentUrl,
  bucket,
  path,
  onUpload,
  onRemove,
  label = "Image",
  hint,
  accept = "image/*",
  maxSizeMB = 5,
  aspectRatio,
  className,
}: {
  currentUrl: string | null | undefined;
  /** Supabase Storage bucket name. */
  bucket: string;
  /** Base path without extension (e.g. "venue-abc123/logo"). */
  path: string;
  onUpload: (url: string) => Promise<void> | void;
  onRemove?: () => Promise<void> | void;
  label?: string;
  hint?: string;
  accept?: string;
  maxSizeMB?: number;
  /** Optional CSS aspect-ratio class applied to the preview container. */
  aspectRatio?: string;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<string | null>(currentUrl ?? null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File must be under ${maxSizeMB} MB.`);
      return;
    }

    // Optimistic local preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);

    try {
      const url = await uploadToStorage(bucket, path, file);
      await onUpload(url);
      setPreview(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setPreview(currentUrl ?? null);
    } finally {
      setUploading(false);
      // Reset the input so the same file can be re-selected after an error
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (!onRemove) return;
    setRemoving(true);
    try {
      await onRemove();
      setPreview(null);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Preview */}
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40",
          aspectRatio,
          !aspectRatio && "h-28 w-28",
        )}
      >
        {preview ? (
          <img
            src={preview}
            alt={label}
            className="h-full w-full object-contain"
          />
        ) : (
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <label className={cn(
          "flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-muted/40",
          uploading && "cursor-not-allowed opacity-50",
        )}>
          <Upload className="h-3.5 w-3.5" />
          {preview ? "Change" : `Upload ${label}`}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="sr-only"
            disabled={uploading || removing}
            onChange={handleChange}
          />
        </label>

        {preview && onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            disabled={removing || uploading}
            onClick={handleRemove}
          >
            {removing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Remove
          </Button>
        )}
      </div>

      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
