import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { documentFileExtension, venueLibraryDocumentPath } from "@/lib/documents/storage-path";

/**
 * Two venue-level uploaders were still writing `venue/${docId}.${ext}` after
 * 20261370000000_documents_workspace_completion.sql tightened the documents
 * bucket to require the venue id in the first path segment. The literal
 * `venue/` can never equal a venue uuid, so every upload from the Message
 * Template attachment field and the Setup migration step was rejected by RLS.
 *
 * These tests pin the corrected construction to the policy it has to satisfy,
 * so the two can't drift apart again silently.
 */

const VENUE = "3f1c9a44-0b2e-4d7f-9a55-1c8e6b2d4f70";
const OTHER_VENUE = "8a2d7e10-4c3b-4a91-8e77-2f5b9c1d3a06";

/** JS equivalent of postgres storage.foldername(name) — the folder segments. */
function foldername(objectName: string): string[] {
  const parts = objectName.split("/");
  return parts.slice(0, -1);
}

describe("venue-level document storage paths", () => {
  it("puts the venue id in the segment the bucket policy checks", () => {
    const path = venueLibraryDocumentPath(VENUE, "brochure.pdf");
    // Policy compares (storage.foldername(name))[1], i.e. the first segment.
    assert.equal(foldername(path)[0], VENUE);
  });

  it("does not use the obsolete literal prefix", () => {
    const path = venueLibraryDocumentPath(VENUE, "brochure.pdf");
    assert.ok(!path.startsWith("venue/"), `still literal-prefixed: ${path}`);
  });

  it("files venue-level uploads under the library entity slot", () => {
    const path = venueLibraryDocumentPath(VENUE, "brochure.pdf", "obj-1");
    assert.equal(path, `${VENUE}/library/obj-1.pdf`);
  });

  it("matches the path the closed Library Documents uploader writes", () => {
    const manager = readFileSync(
      resolve("components/library/library-documents-manager.tsx"),
      "utf8",
    );
    // Same convention, character for character, so this fix introduces no
    // second storage layout for the same kind of file.
    assert.match(manager, /\$\{venueId\}\/library\/\$\{crypto\.randomUUID\(\)\}\.\$\{ext\}/);
  });

  it("keeps the extension, lowercased", () => {
    assert.equal(venueLibraryDocumentPath(VENUE, "Pricing.PDF", "o").endsWith(".pdf"), true);
    assert.equal(documentFileExtension("floor-plan.DOCX"), "docx");
  });

  it("gives each upload its own object name", () => {
    const a = venueLibraryDocumentPath(VENUE, "same-name.pdf");
    const b = venueLibraryDocumentPath(VENUE, "same-name.pdf");
    assert.notEqual(a, b);
  });

  it("scopes one venue's object outside another venue's readable prefix", () => {
    const path = venueLibraryDocumentPath(VENUE, "insurance.pdf");
    // The select policy is the same first-segment comparison, so a second
    // venue's session cannot read this object.
    assert.notEqual(foldername(path)[0], OTHER_VENUE);
  });

  it("is the construction the server action hands to clients", () => {
    const actions = readFileSync(resolve("app/(app)/documents/actions.ts"), "utf8");
    const fn = actions.match(/export async function venueDocumentUploadPathAction[\s\S]*?\n}/)?.[0];
    assert.ok(fn, "expected venueDocumentUploadPathAction to exist");
    // Venue read from the session, never accepted as an argument.
    assert.match(fn, /getCurrentVenue\(\)/);
    assert.match(fn, /venueLibraryDocumentPath\(venue\.id, fileName\)/);
    assert.doesNotMatch(fn, /venueId\s*[:,)]/);
  });
});

describe("the two repaired uploaders", () => {
  const files = {
    "Message Template attachments": "components/communication/template-attachments-field.tsx",
    "Setup migration upload": "components/setup/setup-migration-steps.tsx",
  } as const;

  for (const [label, path] of Object.entries(files)) {
    describe(label, () => {
      const src = readFileSync(resolve(path), "utf8");

      it("no longer builds the RLS-rejected literal path", () => {
        assert.doesNotMatch(src, /`venue\/\$\{/);
      });

      it("resolves its path through the venue-scoped action", () => {
        assert.match(src, /venueDocumentUploadPathAction\(file\.name\)/);
        assert.match(
          src,
          /import \{ saveVenueDocumentAction, venueDocumentUploadPathAction \} from "@\/app\/\(app\)\/documents\/actions"/,
        );
      });

      it("still uploads to the documents bucket at that path", () => {
        assert.match(src, /storage[\s\S]{0,40}\.from\("documents"\)\s*\n?\s*\.?upload\(storagePath, file/);
      });

      it("still registers the file as a venue-level document", () => {
        assert.match(src, /saveVenueDocumentAction\(\{/);
        assert.match(src, /storagePath,/);
      });

      it("still removes the stored object when the row fails to save", () => {
        assert.match(src, /storage\.from\("documents"\)\.remove\(\[storagePath\]\)/);
      });
    });
  }

  it("preserves the Setup step's setup_import tag and per-file error handling", () => {
    const src = readFileSync(resolve(files["Setup migration upload"]), "utf8");
    assert.match(src, /tags: "setup_import"/);
    // A path failure skips that one file rather than aborting the batch.
    const block = src.match(/const pathResult = await venueDocumentUploadPathAction[\s\S]*?\n {6}\}/)?.[0];
    assert.ok(block, "expected the path guard block");
    assert.match(block, /continue;/);
  });

  it("preserves the Template field's single-file abort", () => {
    const src = readFileSync(resolve(files["Message Template attachments"]), "utf8");
    assert.match(src, /if \(!pathResult\.ok\) \{ toast\.error\(pathResult\.message\); return; \}/);
  });
});

describe("documents bucket policy this fix targets", () => {
  const migration = readFileSync(
    resolve("supabase/migrations/20261370000000_documents_workspace_completion.sql"),
    "utf8",
  );

  it("still compares the first path segment to the caller's venue", () => {
    const matches = migration.match(
      /\(storage\.foldername\(name\)\)\[1\] = public\.current_user_venue_id\(\)::text/g,
    );
    // insert, select, update-using, update-check, delete
    assert.ok((matches?.length ?? 0) >= 5, `expected the policy set, got ${matches?.length}`);
  });
});
