"use client";

import { VendorLibrarySection } from "@/components/vendor-app/vendor-library-section";
import type { VendorLibraryDocument } from "@/lib/vendor-documents/types";

/** Vendor Document library hub — reusable files for attaching to events. */
export function VendorDocumentsList({
  library,
}: {
  library: VendorLibraryDocument[];
}) {
  return <VendorLibrarySection initialDocuments={library} />;
}
