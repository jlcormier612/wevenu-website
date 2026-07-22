import type { Metadata } from "next";

export const metadata: Metadata = { title: "Link no longer active" };

/**
 * Where a QR code redirects when its campaign is archived or the code is
 * invalid. A printed QR code (a brochure, a sign) can't be un-printed —
 * a dead link should say something, not just 404.
 */
export default function QrInactivePage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-sm space-y-2 text-center">
        <h1 className="font-heading text-xl font-medium text-heading">This code is no longer active</h1>
        <p className="text-sm text-muted-foreground">
          Please contact the venue directly, or check for an updated link.
        </p>
      </div>
    </div>
  );
}
