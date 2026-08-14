import { NextResponse } from "next/server";

import {
  getActiveLegalDocuments,
  VENUE_SUBSCRIPTION_LEGAL_TYPES,
} from "@/lib/legal/service";
import { publicPathForLegalDocumentType } from "@/lib/legal/public-routes";
import type { LegalDocumentType } from "@/lib/legal/types";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Public: currently active legal documents (for checkout / acceptance UI links).
 * Query: ?types=venue_terms_of_service,privacy_policy (defaults to venue signup set).
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Legal documents are unavailable." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const raw = url.searchParams.get("types")?.trim();
  const types: LegalDocumentType[] = raw
    ? (raw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean) as LegalDocumentType[])
    : [...VENUE_SUBSCRIPTION_LEGAL_TYPES];

  try {
    const documents = await getActiveLegalDocuments(types);
    return NextResponse.json({
      documents: documents.map((d) => ({
        id: d.id,
        documentType: d.documentType,
        title: d.title,
        version: d.version,
        effectiveDate: d.effectiveDate,
        path: publicPathForLegalDocumentType(d.documentType),
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load legal documents.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
