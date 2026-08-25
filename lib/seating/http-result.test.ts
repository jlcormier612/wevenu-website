import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { seatingRpcHttpResult } from "@/lib/seating/http-result";

describe("venue Seating HTTP semantics", () => {
  it("keeps successful boolean and JSON RPC outcomes successful", () => {
    assert.deepEqual(seatingRpcHttpResult(true), { body: { ok: true }, status: 200 });
    assert.deepEqual(
      seatingRpcHttpResult({ ok: true, submissionId: "submission-1" }),
      { body: { ok: true, submissionId: "submission-1" }, status: 200 },
    );
  });

  it("returns non-2xx when a boolean RPC rejects the operation", () => {
    assert.deepEqual(
      seatingRpcHttpResult(false),
      { body: { ok: false, error: "operation_rejected" }, status: 409 },
    );
  });

  it("maps genuine authorization, lookup, delegation, and validation failures", () => {
    assert.equal(seatingRpcHttpResult({ ok: false, error: "not_authorized" }).status, 403);
    assert.equal(seatingRpcHttpResult({ error: "event_not_found" }).status, 404);
    assert.equal(seatingRpcHttpResult({ ok: false, error: "not_delegated" }).status, 409);
    assert.equal(seatingRpcHttpResult({ ok: false, error: "unexpected_failure" }).status, 422);
  });

  it("is applied by every venue Seating RPC route", () => {
    const routes = [
      "app/api/venue/seating/route.ts",
      "app/api/venue/seating/assign/route.ts",
      "app/api/venue/seating/submit/route.ts",
      "app/api/venue/seating/delegate/route.ts",
    ];
    for (const route of routes) {
      const source = readFileSync(resolve(route), "utf8");
      assert.match(source, /seatingRpcHttpResult\(data\)/, route);
      assert.match(source, /status: result\.status/, route);
    }
  });
});
