/**
 * Phase 11C — Sales “Leads from this period” puts KPIs before methodology.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const sales = readFileSync("app/(app)/reporting/sales/page.tsx", "utf8");

describe("Phase 11C — Sales leads section hierarchy", () => {
  it("shows a short intro, then KPI tiles, then methodology details", () => {
    const title = sales.indexOf("Leads from this period");
    const shortIntro = sales.indexOf("leads created during ${range.label}");
    const kpis = sales.indexOf('data-sales-leads-kpis=""');
    const method = sales.indexOf('data-sales-leads-method=""');
    const howLabel = sales.indexOf("How these numbers are calculated");

    assert.ok(title >= 0);
    assert.ok(shortIntro > title);
    assert.ok(kpis > shortIntro);
    assert.ok(method > kpis);
    assert.ok(howLabel > method);

    assert.match(sales, /A lead can book after the selected period/);
    assert.match(sales, /Lost leads stay in this group/);
    assert.match(sales, /Bookings this period/);
    assert.match(sales, /Conversion rates use this lead cohort/);
  });

  it("does not keep the long CardDescription paragraph above the KPI tiles", () => {
    const headerEnd = sales.indexOf("</CardHeader>", sales.indexOf("Leads from this period"));
    const header = sales.slice(sales.indexOf("Leads from this period"), headerEnd);
    assert.doesNotMatch(header, /A lead can book after the selected period/);
    assert.doesNotMatch(header, /listed separately below/);
    assert.match(header, /later booked/);
  });
});
