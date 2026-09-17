import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { venueMigrationArtifactPath } from "@/lib/documents/storage-path";

/**
 * Retained migration source files — the CSV a venue imported from, and the
 * batch ZIP a floor-plan import came from.
 *
 * Both browser uploaders wrote `migration/{sessionId}/{uuid}.{ext}`, whose
 * first segment is the literal word "migration". Since
 * 20261370000000_documents_workspace_completion.sql the documents bucket
 * compares that segment to current_user_venue_id() on every verb, so neither
 * upload could ever have stored anything — and neither one looked at the error.
 * One reported a reassuring half-truth; the other reported nothing at all.
 *
 * These tests pin three things: the path the policy actually accepts, the fact
 * that the session id is a grouping rather than the boundary, and the honesty
 * of what each surface tells a coordinator when retention fails.
 */

const VENUE = "3f1c9a44-0b2e-4d7f-9a55-1c8e6b2d4f70";
const OTHER_VENUE = "8a2d7e10-4c3b-4a91-8e77-2f5b9c1d3a06";
const SESSION = "5c7b1e93-2a4d-4f81-b6c2-9d0e3a7f8b15";

/** JS equivalent of postgres storage.foldername(name) — the folder segments. */
function foldername(objectName: string): string[] {
  return objectName.split("/").slice(0, -1);
}

const MIGRATION_CENTER = readFileSync(resolve("components/settings/migration-center.tsx"), "utf8");
const FLOOR_PLAN_IMPORT = readFileSync(resolve("components/settings/floor-plan-migration-import.tsx"), "utf8");
const MIGRATION_ACTIONS = readFileSync(resolve("app/(app)/settings/migration-actions.ts"), "utf8");

describe("migration artifact storage path", () => {
  it("leads with the venue id, which is the segment the bucket policy checks", () => {
    assert.equal(foldername(venueMigrationArtifactPath(VENUE, SESSION, "clients.csv"))[0], VENUE);
  });

  it("no longer leads with the literal word the policy rejects", () => {
    const path = venueMigrationArtifactPath(VENUE, SESSION, "clients.csv");
    assert.ok(!path.startsWith("migration/"), `still literal-prefixed: ${path}`);
  });

  it("keeps the import session as the entity slot, not as the boundary", () => {
    const path = venueMigrationArtifactPath(VENUE, SESSION, "clients.csv", "obj-1");
    assert.equal(path, `${VENUE}/migration/${SESSION}/obj-1.csv`);
    // {venue_id}/{entity_type}/{entity_id}/{file} — the documented convention.
    assert.deepEqual(foldername(path), [VENUE, "migration", SESSION]);
  });

  it("matches the migration artifact path the server already stores successfully", () => {
    // proposeActiveCommitmentFromFileAction has always been venue-first and has
    // always worked; this fix adopts its shape rather than inventing a third.
    assert.match(MIGRATION_ACTIONS, /\$\{venue\.id\}\/migration\/active-commitment\//);
  });

  it("matches the floor-plan source path in the same import flow", () => {
    const upload = readFileSync(resolve("lib/floor-plans/client-background-upload.ts"), "utf8");
    assert.match(upload, /\$\{venueId\}\/floor_plan\/\$\{planId\}\//);
  });

  it("keeps the real extension so the stored object is not mislabelled", () => {
    assert.ok(venueMigrationArtifactPath(VENUE, SESSION, "batch.ZIP", "o").endsWith(".zip"));
    assert.ok(venueMigrationArtifactPath(VENUE, SESSION, "clients.csv", "o").endsWith(".csv"));
  });

  it("gives each retained file its own object name", () => {
    assert.notEqual(
      venueMigrationArtifactPath(VENUE, SESSION, "clients.csv"),
      venueMigrationArtifactPath(VENUE, SESSION, "clients.csv"),
    );
  });

  it("puts one venue's artifact outside another venue's readable prefix", () => {
    // The select policy is the same first-segment comparison, so sharing a
    // session id would still not let a second venue read this object.
    const mine = venueMigrationArtifactPath(VENUE, SESSION, "clients.csv");
    const theirs = venueMigrationArtifactPath(OTHER_VENUE, SESSION, "clients.csv");
    assert.notEqual(foldername(mine)[0], foldername(theirs)[0]);
    assert.notEqual(foldername(mine)[0], OTHER_VENUE);
  });
});

describe("the action that hands the path to the browser", () => {
  const fn = MIGRATION_ACTIONS.match(
    /export async function migrationArtifactUploadPathAction[\s\S]*?\n}/,
  )?.[0];

  it("exists", () => {
    assert.ok(fn, "expected migrationArtifactUploadPathAction");
  });

  it("reads the venue from the session instead of trusting the caller", () => {
    assert.match(fn!, /getCurrentVenue\(\)/);
    assert.doesNotMatch(fn!, /venueId\s*:/);
  });

  it("refuses a session that is not this venue's before returning a path", () => {
    assert.match(fn!, /repo\.getSession\(supabase, venue\.id, sessionId\)/);
    assert.match(fn!, /if \(!session\) return \{ ok: false/);
    // Ownership is checked before any path is built.
    assert.ok(
      fn!.indexOf("getSession") < fn!.indexOf("venueMigrationArtifactPath"),
      "session ownership must be verified before the path is produced",
    );
  });

  it("scopes the returned path to the session's own venue", () => {
    assert.match(fn!, /venueMigrationArtifactPath\(venue\.id, sessionId, fileName\)/);
  });
});

describe("both retention callers", () => {
  const callers = {
    "Migration Center CSV": MIGRATION_CENTER,
    "Floor plan batch ZIP": FLOOR_PLAN_IMPORT,
  } as const;

  for (const [label, src] of Object.entries(callers)) {
    describe(label, () => {
      it("builds no path of its own", () => {
        assert.doesNotMatch(src, /`migration\/\$\{/);
        assert.match(src, /migrationArtifactUploadPathAction\(/);
      });

      it("stops when the path cannot be resolved", () => {
        assert.match(src, /if \(!pathResult\.ok\) return pathResult;/);
      });

      it("reads the upload error instead of discarding it", () => {
        assert.match(src, /const \{ error: uploadError \} = await supabase\.storage/);
        assert.match(src, /if \(uploadError\) return \{ ok: false, message: uploadError\.message \};/);
      });

      it("reads the registration result too", () => {
        assert.match(src, /const attached = await attachMigrationSourceFileAction\(/);
        assert.match(src, /if \(!attached\.ok\) \{/);
      });

      it("removes the stored object when the row fails, leaving nothing orphaned", () => {
        assert.match(src, /storage\.from\("documents"\)\.remove\(\[(?:fullPath|path)\]\)/);
      });

      it("still registers the artifact as a venue-level document", () => {
        assert.match(src, /storagePath: (?:fullPath|path), storageUrl: urlData\.publicUrl/);
      });

      it("reports the outcome rather than swallowing the failure", () => {
        assert.match(src, /console\.error\(/);
        assert.match(src, /toast\.warning\(/);
      });
    });
  }
});

describe("what the Migration Center tells a coordinator", () => {
  it("has dropped the claim that asserted the import before the rows were sent", () => {
    assert.doesNotMatch(MIGRATION_CENTER, /your data was still read and imported/i);
  });

  it("does not report retention as a success", () => {
    const warn = MIGRATION_CENTER.match(/toast\.warning\([\s\S]*?\);/)?.[0];
    assert.ok(warn, "expected a warning toast");
    assert.doesNotMatch(warn, /toast\.success/);
  });

  it("speaks only after the import outcome is known", () => {
    const fn = MIGRATION_CENTER.match(/async function handleStartAndUpload\(\)[\s\S]*?\n {2}\}/)?.[0];
    assert.ok(fn, "expected handleStartAndUpload");
    // The rows must be added and deduped, and their failures returned, before
    // anything is said about the retained copy.
    assert.ok(fn.indexOf("if (!added.ok)") < fn.indexOf("toast.warning"));
    assert.ok(fn.indexOf("if (!deduped.ok)") < fn.indexOf("toast.warning"));
  });

  it("tells the user what was preserved, what was not, and what to do", () => {
    const warn = MIGRATION_CENTER.match(/toast\.warning\([\s\S]*?\);/)![0];
    assert.match(warn, /rows were imported/);          // what worked
    assert.match(warn, /couldn't keep a copy/);         // what didn't
    assert.match(warn, /hold on to your own copy/);     // what to do
    assert.match(warn, /\$\{sourceFile\.name\}/);       // which file
  });

  it("says nothing about retention when there was no file to retain", () => {
    const fn = MIGRATION_CENTER.match(/async function handleStartAndUpload\(\)[\s\S]*?\n {2}\}/)![0];
    assert.match(fn, /if \(sourceFile && retained && !retained\.ok\)/);
  });
});

describe("what the floor plan import tells a coordinator", () => {
  it("does not lose an otherwise good import over the ZIP copy", () => {
    // The plans are uploaded and registered before this runs, so a ZIP failure
    // is collected, never thrown.
    assert.match(FLOOR_PLAN_IMPORT, /const zipFailures: string\[\] = \[\];/);
    assert.match(FLOOR_PLAN_IMPORT, /zipFailures\.push\(f\.name\)/);
    const helper = FLOOR_PLAN_IMPORT.match(/async function retainBatchZip[\s\S]*?\n}/)![0];
    assert.doesNotMatch(helper, /throw /);
  });

  it("still reports the plans as the success and the ZIP as the exception", () => {
    const fn = FLOOR_PLAN_IMPORT.match(/async function handleFilesSelected\([\s\S]*?\n {2}\}/)![0];
    assert.ok(fn.indexOf("floor plan${rows.length === 1") < fn.indexOf("toast.warning"));
    const warn = FLOOR_PLAN_IMPORT.match(/toast\.warning\([\s\S]*?\);/)![0];
    assert.match(warn, /floor plans are in/);
    assert.match(warn, /couldn't keep a copy/);
    assert.match(warn, /hold on to your own copy/);
    assert.match(warn, /zipFailures\.join/);
  });

  it("names every ZIP that failed, not just the last one", () => {
    assert.match(FLOOR_PLAN_IMPORT, /zipFailures\.length > 0/);
    assert.match(FLOOR_PLAN_IMPORT, /zipFailures\.join\(", "\)/);
  });
});

describe("no storage vocabulary reaches the venue-facing message", () => {
  const jargon = [/bucket/i, /storage object/i, /signed url/i, /\bRLS\b/, /row.level security/i, /policy/i];

  for (const [label, src] of Object.entries({
    "Migration Center": MIGRATION_CENTER,
    "Floor plan import": FLOOR_PLAN_IMPORT,
  })) {
    it(`keeps ${label}'s toast free of it`, () => {
      const toasts = src.match(/toast\.(?:success|error|warning|info)\([\s\S]*?\);/g) ?? [];
      assert.ok(toasts.length > 0);
      for (const t of toasts) {
        for (const word of jargon) {
          assert.doesNotMatch(t, word, `technical term in a toast: ${t}`);
        }
      }
    });
  }

  it("sends the technical reason to the console instead", () => {
    assert.match(MIGRATION_CENTER, /console\.error\("Migration source file retention failed:", retained\.message\)/);
    assert.match(FLOOR_PLAN_IMPORT, /console\.error\(`Migration ZIP retention failed for \$\{f\.name\}:`, retained\.message\)/);
  });
});

describe("retrieval of a retained original", () => {
  it("goes through the authorized route, not the stored public URL", () => {
    // The bucket is private, so the stored URL resolves to nothing; every other
    // Documents surface links through this same helper.
    assert.match(MIGRATION_CENTER, /href=\{venueFileHref\(f\.documentId\)\}/);
    assert.match(MIGRATION_CENTER, /import \{ venueFileHref \} from "@\/lib\/documents\/access"/);
    assert.doesNotMatch(MIGRATION_CENTER, /href=\{f\.storageUrl\}/);
  });

  it("is served only to the venue that owns the document", () => {
    const route = readFileSync(resolve("app/api/documents/[id]/file/route.ts"), "utf8");
    assert.match(route, /getCurrentVenue\(\)/);
    assert.match(route, /canAccessDocumentFile\(\{ kind: "venue", venueId: venue\.id \}, row\)/);
    assert.match(route, /status: 404/);
  });

  it("is still owned by a venue-scoped Documents row", () => {
    const service = readFileSync(resolve("lib/migration/service.ts"), "utf8");
    const fn = service.match(/export async function attachSourceFileToOwnSession[\s\S]*?\n}/)![0];
    assert.match(fn, /resolveVenueActor\(\)/);
    assert.match(fn, /repo\.getSession\(actor\.client, actor\.venueId, sessionId\)/);
    assert.match(fn, /insertVenueDocument\(actor\.client, actor\.venueId/);
    assert.match(fn, /tags: "migration_source"/);
  });

  it("only ever lists documents belonging to the reading venue", () => {
    const service = readFileSync(resolve("lib/migration/service.ts"), "utf8");
    const fn = service.match(/export async function getOwnSessionSourceFiles[\s\S]*?\n}/)![0];
    assert.match(fn, /\.eq\("venue_id", actor\.venueId\)/);
  });
});

describe("the bucket policy all of this has to satisfy", () => {
  it("still compares the first path segment to the caller's venue", () => {
    const sql = readFileSync(
      resolve("supabase/migrations/20261370000000_documents_workspace_completion.sql"),
      "utf8",
    );
    const matches = sql.match(
      /\(storage\.foldername\(name\)\)\[1\] = public\.current_user_venue_id\(\)::text/g,
    );
    assert.ok((matches?.length ?? 0) >= 5, `expected the policy set, got ${matches?.length}`);
    // And the fix did not loosen it to make the upload succeed.
    assert.match(sql, /set public = false\s*\n\s*where id = 'documents'/);
  });
});
