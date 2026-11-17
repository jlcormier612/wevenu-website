import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const hq = readFileSync(resolve("app/admin/onboarding/import-actions.ts"), "utf8");
const selfServe = readFileSync(resolve("app/(app)/settings/import/actions.ts"), "utf8");
const bookClient = readFileSync(resolve("lib/booking-journey/book-client.ts"), "utf8");
const extra = readFileSync(resolve("lib/booking-journey/add-imported-event.ts"), "utf8");

describe("HQ White-Glove client+event parity with self-service", () => {
  const hqCouples = hq.slice(
    hq.indexOf("export async function importCouplesForVenueAction"),
    hq.indexOf("export async function importLeadsForVenueAction"),
  );
  const csvCouples = selfServe.slice(
    selfServe.indexOf("export async function importCouplesAction"),
    selfServe.indexOf("export async function importLeadsAction"),
  );

  it("reuses the shared classify + commit path instead of a third booking implementation", () => {
    assert.match(hqCouples, /classifyClientImportRow/);
    assert.match(hqCouples, /commitImportedClientAndEvent/);
    assert.match(hqCouples, /isAdmin: true/);
    assert.doesNotMatch(hqCouples, /createClientForVenue\(/);
  });

  it("does not auto-skip same-date Events; venue confirmation drives additional Events", () => {
    assert.match(hqCouples, /classifyClientEventMatch/);
    assert.match(hqCouples, /resolveConfirmedClientEventAction/);
    assert.match(hqCouples, /allowAdditionalEvent: action === "create_same_person"/);
    assert.match(hqCouples, /existingClientId: action === "create_same_person"/);
    assert.doesNotMatch(hqCouples, /seenEvents/);
    assert.doesNotMatch(hqCouples, /same person and date/);
    assert.doesNotMatch(hqCouples, /seenEmails/);
  });

  it("never silently merges email-only likely matches", () => {
    assert.match(hqCouples, /resolveConfirmedClientEventAction/);
    assert.match(hqCouples, /clientEventMatchSkipMessage/);
    assert.match(selfServe, /previewPersonMatchesAction[\s\S]*venueId/);
  });

  it("does not weaken bookClient idempotency", () => {
    assert.match(bookClient, /A second call does not create another event/);
    assert.match(extra, /bookClient stays idempotent/);
    assert.match(extra, /addImportedEventToClient/);
    assert.match(extra, /if \(duplicate && !opts.allowAdditional\)/);
  });

  it("keeps occupancy holds and historical complete on the shared classifier", () => {
    assert.match(hqCouples, /classified.kind === "hold"/);
    assert.match(csvCouples, /classified.kind === "hold"/);
  });
});
