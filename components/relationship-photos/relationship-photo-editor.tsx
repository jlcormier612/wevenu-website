"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  removeVenuePhotoAction,
  setVenuePhotoAction,
  useClientPhotoAction,
  useVenuePhotoAction,
} from "@/app/(app)/relationship-photos/actions";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import type { VenueFacingPhotoState } from "@/lib/relationship-photos/model";

/**
 * Single relationship photo control for Lead/Client edit.
 * Upload writes the venue photo; a shared couple photo can be selected
 * into the same preview — no second uploader section.
 */
export function RelationshipPhotoEditor({
  relationshipId,
  venueId,
  initial,
  leadId,
  clientId,
}: {
  relationshipId: string;
  venueId: string;
  initial: VenueFacingPhotoState;
  leadId?: string;
  clientId?: string;
}) {
  const router = useRouter();
  const [state, setState] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();
  const opts = { leadId, clientId };

  React.useEffect(() => {
    setState(initial);
  }, [initial]);

  const path = `${venueId}/relationships/${relationshipId}/venue-photo`;
  const showingClient = state.effectiveDisplaySource === "client";
  const showingVenue = state.effectiveDisplaySource === "venue";

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-heading">Photo</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a photo to this Lead and Client record. You can upload one here or use a photo the couple has shared with you. The photo stays with the relationship if this lead becomes a client.
        </p>
      </div>

      <ImageUpload
        currentUrl={state.displayedPhotoUrl}
        bucket="uploads"
        path={path}
        label="Photo"
        hint="JPG, PNG, or WEBP up to 5 MB. Uploading sets the photo on this record."
        aspectRatio="aspect-square"
        objectFit="cover"
        className="max-w-[10rem]"
        onUpload={async (url) => {
          const result = await setVenuePhotoAction(relationshipId, url, opts);
          if (!result.ok) {
            toast.error(result.message ?? "Could not save the photo.");
            throw new Error(result.message);
          }
          toast.success("Photo saved.");
          router.refresh();
        }}
        onRemove={
          showingVenue && state.venuePhotoUrl
            ? async () => {
                const result = await removeVenuePhotoAction(relationshipId, opts);
                if (!result.ok) {
                  toast.error(result.message ?? "Could not remove the photo.");
                  throw new Error(result.message);
                }
                toast.success("Photo removed.");
                router.refresh();
              }
            : undefined
        }
      />

      {showingClient ? (
        <p className="text-sm text-muted-foreground">
          Showing the photo this couple shared. Upload above to put a venue photo on this record instead.
          {state.venuePhotoUrl ? (
            <>
              {" "}
              <button
                type="button"
                className="font-medium text-heading underline underline-offset-2 disabled:opacity-50"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await useVenuePhotoAction(relationshipId, opts);
                    if (!result.ok) toast.error(result.message ?? "Could not switch photo.");
                    else {
                      toast.success("Now showing your venue photo.");
                      router.refresh();
                    }
                  })
                }
              >
                Use your venue photo
              </button>
            </>
          ) : null}
        </p>
      ) : null}

      {state.clientPhotoAvailable && state.clientPhotoUrl ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={state.clientPhotoUrl}
            alt=""
            className="h-12 w-12 rounded-full object-cover border border-border"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium text-heading">Couple shared a photo</p>
            <p className="text-sm text-muted-foreground">
              Use it on this Lead and Client record, or keep your uploaded photo.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await useClientPhotoAction(relationshipId, opts);
                if (!result.ok) toast.error(result.message ?? "Could not use the shared photo.");
                else {
                  toast.success("Now showing the couple’s shared photo.");
                  router.refresh();
                }
              })
            }
          >
            Use shared photo
          </Button>
        </div>
      ) : null}
    </div>
  );
}
