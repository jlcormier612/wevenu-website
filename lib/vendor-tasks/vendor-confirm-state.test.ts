import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  vendorConfirmCouplePhase,
  vendorConfirmNeedsCoupleAck,
  vendorConfirmReadyToConfirm,
} from "@/lib/vendor-tasks/vendor-confirm-state";

describe("vendor_confirm dual-state helpers", () => {
  it("couple phases: open → waiting → complete", () => {
    assert.equal(
      vendorConfirmCouplePhase({
        completionAuthority: "vendor_confirm",
        status: "pending",
        coupleAcknowledgedAt: null,
      }),
      "open",
    );
    assert.equal(
      vendorConfirmCouplePhase({
        completionAuthority: "vendor_confirm",
        status: "pending",
        coupleAcknowledgedAt: "2026-08-10T12:00:00Z",
      }),
      "waiting",
    );
    assert.equal(
      vendorConfirmCouplePhase({
        completionAuthority: "vendor_confirm",
        status: "complete",
        coupleAcknowledgedAt: "2026-08-10T12:00:00Z",
      }),
      "complete",
    );
    assert.equal(
      vendorConfirmCouplePhase({
        completionAuthority: "couple_acknowledge",
        status: "pending",
        coupleAcknowledgedAt: null,
      }),
      null,
    );
  });

  it("vendor Confirm only when owned + pending + acked", () => {
    assert.equal(
      vendorConfirmNeedsCoupleAck({
        completionAuthority: "vendor_confirm",
        coupleVisibility: "owned",
        status: "pending",
        coupleAcknowledgedAt: null,
      }),
      true,
    );
    assert.equal(
      vendorConfirmReadyToConfirm({
        completionAuthority: "vendor_confirm",
        coupleVisibility: "owned",
        status: "pending",
        coupleAcknowledgedAt: "2026-08-10T12:00:00Z",
      }),
      true,
    );
    assert.equal(
      vendorConfirmReadyToConfirm({
        completionAuthority: "vendor_confirm",
        coupleVisibility: "owned",
        status: "pending",
        coupleAcknowledgedAt: null,
      }),
      false,
    );
    assert.equal(
      vendorConfirmReadyToConfirm({
        completionAuthority: "vendor_confirm",
        coupleVisibility: "visible",
        status: "pending",
        coupleAcknowledgedAt: null,
      }),
      false,
    );
  });
});
