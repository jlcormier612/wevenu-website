import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildQrCreateReturnPath,
  parseQrCreateSearchParams,
  safePublicFormEditorReturnTo,
  safeQrCampaignsReturnTo,
} from "@/lib/qr-campaigns/qr-form-return";

describe("qr-form-return", () => {
  it("builds a return path that reopens QR create with public_form selected", () => {
    const path = buildQrCreateReturnPath({
      publicFormId: "form-1",
      name: "Wedding Expo Entrance",
    });
    assert.equal(
      path,
      "/library/qr-campaigns?new=1&destination=public_form&publicFormId=form-1&name=Wedding+Expo+Entrance",
    );
  });

  it("parses return search params into create state", () => {
    const state = parseQrCreateSearchParams(
      new URLSearchParams("new=1&destination=public_form&publicFormId=abc&name=Booth"),
    );
    assert.deepEqual(state, {
      openCreate: true,
      destinationType: "public_form",
      publicFormId: "abc",
      name: "Booth",
    });
  });

  it("rejects unsafe returnTo targets", () => {
    assert.equal(safeQrCampaignsReturnTo("https://evil.example/x"), null);
    assert.equal(safeQrCampaignsReturnTo("//evil.example"), null);
    assert.equal(safeQrCampaignsReturnTo("/library/public-forms"), null);
    assert.equal(
      safeQrCampaignsReturnTo("/library/qr-campaigns?new=1&publicFormId=x"),
      "/library/qr-campaigns?new=1&publicFormId=x",
    );
  });

  it("allows public form editor returnTo for QR create or public-forms paths", () => {
    assert.equal(
      safePublicFormEditorReturnTo("/library/qr-campaigns?new=1&publicFormId=x"),
      "/library/qr-campaigns?new=1&publicFormId=x",
    );
    assert.equal(safePublicFormEditorReturnTo("/library/public-forms"), "/library/public-forms");
    assert.equal(safePublicFormEditorReturnTo("/dashboard"), null);
  });
});
