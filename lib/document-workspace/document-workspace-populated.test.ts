/**
 * In-memory render of DocumentWorkspace with a fake client-scoped file.
 * No Supabase, database, or network.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DocumentWorkspace } from "@/components/document-workspace/document-workspace";
import type { WorkspaceDocument } from "@/lib/document-workspace/types";

const CLIENT_ID = "client-preparing-1";
const VENUE_ID = "venue-fancy-1";

function preparingClientDocument(): WorkspaceDocument {
  return {
    docType: "document",
    id: "doc-preparing-1",
    name: "Signed proposal",
    category: "Other",
    rawStatus: null,
    status: "none",
    currentVersion: 1,
    ownerType: "client",
    leadId: null,
    clientId: CLIENT_ID,
    eventId: null,
    vendorId: null,
    relationshipName: "HoldConflict overlap-barn-morning",
    eventName: null,
    fileUrl: null,
    fileSize: 2048,
    mimeType: "application/pdf",
    isCoupleVisible: false,
    isVendorVisible: false,
    uploadedByType: "venue",
    createdAt: "2026-10-09T16:00:00.000Z",
    updatedAt: "2026-10-09T16:00:00.000Z",
  };
}

describe("DocumentWorkspace populated client document", () => {
  it("renders the file name and details and does not show the empty state", () => {
    const doc = preparingClientDocument();
    const html = renderToStaticMarkup(
      React.createElement(DocumentWorkspace, {
        title: "Documents",
        description: "Files for this client while you prepare the workspace.",
        documents: [doc],
        initialPinnedKeys: [],
        uploadTarget: { entityType: "client", entityId: CLIENT_ID, venueId: VENUE_ID },
        returnTo: `/clients/${CLIENT_ID}`,
      }),
    );

    assert.match(html, /Signed proposal/);
    assert.match(html, /HoldConflict overlap-barn-morning/);
    assert.match(html, /Updated /);
    assert.match(html, /Venue/);
    assert.match(html, /2\.0 KB/);
    assert.equal(html.includes("No documents yet"), false);
    assert.equal(html.includes(CLIENT_ID), false);
    assert.equal(html.includes(VENUE_ID), false);
  });
});
