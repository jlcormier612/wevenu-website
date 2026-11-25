import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HTC_LOGO_PUBLIC_PATH } from "../../brand/logo";
import { wrapHelloHtml } from "./helpers";

describe("wrapHelloHtml branded shell", () => {
  it("includes the official HTC logo image, not a text-only eyebrow", () => {
    const html = wrapHelloHtml(
      "Inquiry welcome",
      "<p style=\"margin:0;font-size:16px;line-height:1.6;color:#2f3d2f\">Hi there,</p>",
    );
    assert.match(html, new RegExp(HTC_LOGO_PUBLIC_PATH.replace(/\./g, "\\.")));
    assert.match(html, /alt="Hello to Cheers"/);
    assert.equal(html.includes("letter-spacing:0.14em"), false);
    assert.match(html, /With care,/);
  });
});
