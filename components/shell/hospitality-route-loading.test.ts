import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const ROOT = join(process.cwd(), "app/(app)");

function collectLoadingFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collectLoadingFiles(full, acc);
    else if (name === "loading.tsx") acc.push(full);
  }
  return acc;
}

describe("hospitality route loading shells (Wave B)", () => {
  it("exports honest busy-region loading UI", () => {
    const src = readFileSync("components/shell/hospitality-route-loading.tsx", "utf8");
    assert.match(src, /role="status"/);
    assert.match(src, /aria-busy="true"/);
    assert.match(src, /aria-live="polite"/);
    assert.match(src, /htc-hospitality-page/);
    assert.match(src, /data-testid="hospitality-route-loading"/);
    assert.doesNotMatch(src, /\b(Successfully loaded|Load complete|Done loading)\b/i);
    assert.match(src, /do not claim data has loaded/);
  });

  it("wires loading.tsx on high-traffic venue routes", () => {
    const files = collectLoadingFiles(ROOT).map((f) => f.replace(/\\/g, "/"));
    const required = [
      "app/(app)/dashboard/loading.tsx",
      "app/(app)/leads/loading.tsx",
      "app/(app)/leads/[id]/loading.tsx",
      "app/(app)/clients/loading.tsx",
      "app/(app)/clients/[id]/loading.tsx",
      "app/(app)/events/loading.tsx",
      "app/(app)/events/[id]/loading.tsx",
      "app/(app)/calendar/loading.tsx",
      "app/(app)/reporting/loading.tsx",
      "app/(app)/payments/loading.tsx",
      "app/(app)/invoices/loading.tsx",
      "app/(app)/contracts/loading.tsx",
      "app/(app)/contracts/[id]/loading.tsx",
      "app/(app)/tours/loading.tsx",
      "app/(app)/messaging/loading.tsx",
      "app/(app)/vendors/loading.tsx",
      "app/(app)/setup-hub/loading.tsx",
    ];
    for (const rel of required) {
      assert.ok(
        files.some((f) => f.endsWith(rel)),
        `missing ${rel}`,
      );
      const body = readFileSync(rel, "utf8");
      assert.match(body, /HospitalityRouteLoading/);
    }
  });

  it("does not use null Suspense fallback on the Clients list", () => {
    const page = readFileSync("app/(app)/clients/page.tsx", "utf8");
    assert.doesNotMatch(page, /fallback=\{null\}/);
    assert.match(page, /HospitalityRouteLoading/);
  });
});
