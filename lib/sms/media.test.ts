import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseInboundTwilioMedia } from "@/lib/sms/media";

describe("parseInboundTwilioMedia", () => {
  it("returns empty when NumMedia is 0", () => {
    const params = new URLSearchParams({ NumMedia: "0", Body: "hi" });
    assert.equal(parseInboundTwilioMedia(params).length, 0);
  });

  it("parses MediaUrl and ContentType indexes", () => {
    const params = new URLSearchParams({
      NumMedia: "2",
      MediaUrl0: "https://api.twilio.com/media/1",
      MediaContentType0: "image/jpeg",
      MediaUrl1: "https://api.twilio.com/media/2",
      MediaContentType1: "application/pdf",
    });
    const media = parseInboundTwilioMedia(params);
    assert.equal(media.length, 2);
    assert.equal(media[0]!.url, "https://api.twilio.com/media/1");
    assert.equal(media[0]!.contentType, "image/jpeg");
    assert.equal(media[1]!.contentType, "application/pdf");
  });
});
