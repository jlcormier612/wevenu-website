import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatPhoneDisplay, toE164 } from "@/lib/sms/phone";

describe("phone display for the SMS composer", () => {
  it("formats a US number the same way send validation would accept it", () => {
    assert.equal(toE164("(615) 555-1234"), "+16155551234");
    assert.equal(formatPhoneDisplay("(615) 555-1234"), "(615) 555-1234");
    assert.equal(formatPhoneDisplay("+16155551234"), "(615) 555-1234");
  });
});
