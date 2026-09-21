import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  canToggleVendorPick,
  vendorPickSaveErrorMessage,
} from "@/lib/portal/vendor-pick-errors";

describe("vendor pick Commitment Alignment — error mapping", () => {
  it("surfaces event_not_found instead of the generic toast copy", () => {
    assert.equal(
      vendorPickSaveErrorMessage("event_not_found"),
      "Your event isn't set up yet, so picks can't be saved. Please contact your venue.",
    );
    assert.notEqual(
      vendorPickSaveErrorMessage("event_not_found"),
      "Couldn't save your pick. Please try again.",
    );
  });

  it("keeps a generic fallback for unknown codes", () => {
    assert.equal(
      vendorPickSaveErrorMessage("something_new"),
      "Couldn't save your pick. Please try again.",
    );
    assert.equal(
      vendorPickSaveErrorMessage(null),
      "Couldn't save your pick. Please try again.",
    );
  });

  it("only allows Pick when the portal has an event date", () => {
    assert.equal(canToggleVendorPick("2027-12-04"), true);
    assert.equal(canToggleVendorPick(null), false);
    assert.equal(canToggleVendorPick(undefined), false);
    assert.equal(canToggleVendorPick(""), false);
  });
});

describe("vendor pick Commitment Alignment — wiring", () => {
  const route = readFileSync(resolve("app/api/portal/vendors/route.ts"), "utf8");
  const ui = readFileSync(resolve("components/portal/vendor-section.tsx"), "utf8");
  const togglePick = readFileSync(
    resolve("supabase/migrations/20261026000000_commitment_alignment_vendor_selection_submission.sql"),
    "utf8",
  );
  const directoryPick = readFileSync(
    resolve("supabase/migrations/20261364000000_vendor_inactive_filter_and_checkin_notification.sql"),
    "utf8",
  );

  it("POST uses private pick RPCs — never selected_at / never client-side DB writes", () => {
    assert.match(route, /toggle_vendor_pick/);
    assert.match(route, /toggle_directory_vendor_pick/);
    assert.doesNotMatch(route, /select_event_vendor_recommendation/);
    assert.doesNotMatch(route, /\.from\(["']event_vendor_recommendations["']\)/);
    assert.match(togglePick, /set picked_at = case when p_picked/);
    assert.match(togglePick, /return jsonb_build_object\('ok', true\)/);
    const pickFn = togglePick.match(
      /create or replace function public\.toggle_vendor_pick[\s\S]*?end \$\$;/,
    )?.[0] ?? "";
    assert.match(pickFn, /picked_at/);
    assert.doesNotMatch(pickFn, /selected_at/);
  });

  it("directory pick upserts source=couple with picked_at only", () => {
    const fn = directoryPick.slice(
      directoryPick.indexOf("create or replace function public.toggle_directory_vendor_pick"),
      directoryPick.indexOf("create or replace function public.get_venue_vendor_directory"),
    );
    assert.match(fn, /picked_at/);
    assert.match(fn, /'couple'/);
    assert.doesNotMatch(fn, /selected_at/);
    assert.match(fn, /event_not_found/);
  });

  it("UI gates Pick on event date and surfaces RPC error codes", () => {
    assert.match(ui, /canToggleVendorPick\(eventDate\)/);
    assert.match(ui, /vendorPickSaveErrorMessage/);
    assert.match(ui, /handleToggleRecommendation/);
    assert.match(ui, /handleToggleDirectory/);
    assert.match(ui, /\/api\/portal\/vendors\/submit/);
  });

  it("submit route remains the only Commitment gate to selected_at", () => {
    const submit = readFileSync(resolve("app/api/portal/vendors/submit/route.ts"), "utf8");
    assert.match(submit, /submit_vendor_list/);
    assert.match(togglePick, /set selected_at = case when picked_at is not null/);
  });
});
