import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { authorizeCrmAssistedCheckout } from "./crm-checkout-auth";

describe("authorizeCrmAssistedCheckout", () => {
  const previous = process.env.PRODUCT_SYNC_API_KEY;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.PRODUCT_SYNC_API_KEY;
    } else {
      process.env.PRODUCT_SYNC_API_KEY = previous;
    }
  });

  it("rejects when PRODUCT_SYNC_API_KEY is unset", () => {
    delete process.env.PRODUCT_SYNC_API_KEY;
    const req = new Request("http://localhost/api/stripe/checkout", {
      headers: { Authorization: "Bearer anything" },
    });
    assert.equal(authorizeCrmAssistedCheckout(req), false);
  });

  it("rejects missing Authorization header", () => {
    process.env.PRODUCT_SYNC_API_KEY = "crm-checkout-secret";
    const req = new Request("http://localhost/api/stripe/checkout");
    assert.equal(authorizeCrmAssistedCheckout(req), false);
  });

  it("rejects wrong Bearer token (tampered)", () => {
    process.env.PRODUCT_SYNC_API_KEY = "crm-checkout-secret";
    const req = new Request("http://localhost/api/stripe/checkout", {
      headers: { Authorization: "Bearer wrong-secret" },
    });
    assert.equal(authorizeCrmAssistedCheckout(req), false);
  });

  it("rejects non-Bearer schemes", () => {
    process.env.PRODUCT_SYNC_API_KEY = "crm-checkout-secret";
    const req = new Request("http://localhost/api/stripe/checkout", {
      headers: { Authorization: "Basic crm-checkout-secret" },
    });
    assert.equal(authorizeCrmAssistedCheckout(req), false);
  });

  it("accepts exact Bearer PRODUCT_SYNC_API_KEY", () => {
    process.env.PRODUCT_SYNC_API_KEY = "crm-checkout-secret";
    const req = new Request("http://localhost/api/stripe/checkout", {
      headers: { Authorization: "Bearer crm-checkout-secret" },
    });
    assert.equal(authorizeCrmAssistedCheckout(req), true);
  });

  it("is case-insensitive on the Bearer scheme prefix", () => {
    process.env.PRODUCT_SYNC_API_KEY = "crm-checkout-secret";
    const req = new Request("http://localhost/api/stripe/checkout", {
      headers: { Authorization: "bearer crm-checkout-secret" },
    });
    assert.equal(authorizeCrmAssistedCheckout(req), true);
  });
});
