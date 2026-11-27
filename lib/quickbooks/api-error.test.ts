import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  formatQuickBooksApiError,
  parseQuickBooksApiErrorParts,
} from "@/lib/quickbooks/api-error";

describe("formatQuickBooksApiError", () => {
  it("includes HTTP status, operation, intuit_tid, and Fault code", () => {
    const message = formatQuickBooksApiError({
      method: "POST",
      path: "/invoice?minorversion=65",
      status: 400,
      intuitTid: "1-abc123",
      body: JSON.stringify({
        Fault: {
          Error: [
            {
              code: "2020",
              Message: "Required parameter IncomeAccountRef is missing",
            },
          ],
        },
      }),
    });
    assert.match(message, /QuickBooks API error 400 on POST \/invoice/);
    assert.match(message, /intuit_tid=1-abc123/);
    assert.match(message, /code=2020/);
    assert.match(message, /IncomeAccountRef/);
    assert.doesNotMatch(message, /Bearer |access_token|refresh_token/i);
  });

  it("records intuit_tid=none when the header is absent", () => {
    const message = formatQuickBooksApiError({
      method: "GET",
      path: "/query",
      status: 400,
      intuitTid: null,
      body: "not-json validation failure",
    });
    assert.match(message, /intuit_tid=none/);
    assert.match(message, /not-json validation failure/);
  });

  it("parseQuickBooksApiErrorParts recovers tid and code for support correlation", () => {
    const message = formatQuickBooksApiError({
      method: "POST",
      path: "/customer",
      status: 400,
      intuitTid: "1-deadbeef",
      body: JSON.stringify({ Fault: { Error: [{ code: "6240", Message: "Duplicate Name Exists Error" }] } }),
    });
    const parts = parseQuickBooksApiErrorParts(message);
    assert.equal(parts.httpStatus, 400);
    assert.equal(parts.operation, "POST /customer");
    assert.equal(parts.intuitTid, "1-deadbeef");
    assert.equal(parts.intuitCode, "6240");
  });
});

describe("quickBooksFetch intuit_tid wiring", () => {
  it("client formats failures with intuit_tid headers and structured log helper", () => {
    const src = readFileSync("lib/quickbooks/client.ts", "utf8");
    assert.match(src, /formatQuickBooksApiError/);
    assert.match(src, /logQuickBooksApiFailure/);
    assert.match(src, /headers\.get\("intuit_tid"\)/);
  });
});
