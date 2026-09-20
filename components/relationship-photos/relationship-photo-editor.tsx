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

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-heading">Photo</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a photo to this Lead and Client record. You can upload one here or use a photo the couple has shared with you. The photo stays with the relationship if this lead becomes a client.
        </p>
      </div>

      {state.displayedPhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={state.displayedPhotoUrl}
          alt=""
          className="h-24 w-24 rounded-full object-cover border border-border"
        />
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium text-heading">Venue Photo</p>
        <p className="text-sm text-muted-foreground">
          Upload a photo from your venue to use on this record.
        </p>
        <ImageUpload
          currentUrl={state.venuePhotoUrl}
          bucket="uploads"
          path={path}
          label="Venue Photo"
          hint="JPG, PNG, or WEBP up to 5 MB. Uploading a venue photo makes it the one on the record."
          aspectRatio="aspect-square"
          objectFit="cover"
          className="max-w-[10rem]"
          onUpload={async (url) => {
            const result = await setVenuePhotoAction(relationshipId, url, opts);
            if (!result.ok) {
              toast.error(result.message ?? "Could not save the photo.");
              throw new Error(result.message);
            }
            toast.success("Venue photo saved.");
            router.refresh();
          }}
          onRemove={state.venuePhotoUrl ? async () => {
            const result = await removeVenuePhotoAction(relationshipId, opts);
            if (!result.ok) {
              toast.error(result.message ?? "Could not remove the photo.");
              throw new Error(result.message);
            }
            toast.success("Venue photo removed.");
            router.refresh();
          } : undefined}
        />
      </div>

      {state.effectiveDisplaySource === "client" ? (
        <div className="rounded-lg border border-border px-3 py-3 space-y-2">
          <p className="text-sm font-medium text-heading">Showing client photo</p>
          <p className="text-sm text-muted-foreground">
            This couple shared a photo and you chose to use it on their record.
          </p>
          {state.venuePhotoUrl ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => startTransition(async () => {
                const result = await useVenuePhotoAction(relationshipId, opts);
                if (!result.ok) toast.error(result.message ?? "Could not switch photo.");
                else {
                  toast.success("Now showing your venue photo.");
                  router.refresh();
                }
              })}
            >
              Use venue photo
            </Button>
          ) : null}
        </div>
      ) : null}

      {state.clientPhotoAvailable ? (
        <div className="rounded-lg border border-border px-3 py-3 space-y-2">
          <p className="text-sm font-medium text-heading">Client shared a photo</p>
          <p className="text-sm text-muted-foreground">
            Your venue photo stays on the record until you choose otherwise.
          </p>
          <div className="flex flex-wrap gap-2">
            {state.clientPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={state.clientPhotoUrl}
                alt=""
                className="h-12 w-12 rounded-full object-cover border border-border"
              />
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => startTransition(async () => {
                const result = await useClientPhotoAction(relationshipId, opts);
                if (!result.ok) toast.error(result.message ?? "Could not use the client photo.");
                else {
                  toast.success("Now showing the client photo.");
                  router.refresh();
                }
              })}
            >
              Use client photo
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
