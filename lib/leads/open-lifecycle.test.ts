/**
 * Open-lead lifecycle — reporting category vs sales_stage, no client_id / exclude gate.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  activeSalesLeads,
  closedRelationshipLeads,
  isActiveSalesLead,
  isOpenLeadLifecycle,
  isOpenLeadOpportunity,
  isOpenReportingCategory,
  TERMINAL_LEAD_LIFECYCLE_STATES,
} from "@/lib/leads/open-lifecycle";

const root = path.join(import.meta.dirname, "../..");

describe("isOpenLeadLifecycle", () => {
  it("excludes booked / lost / won / cancelled only", () => {
    for (const t of TERMINAL_LEAD_LIFECYCLE_STATES) {
      assert.equal(isOpenLeadLifecycle(t), false);
    }
    assert.equal(isOpenLeadLifecycle("new_inquiry"), true);
    assert.equal(isOpenLeadLifecycle("tour_scheduled"), true);
    assert.equal(isOpenLeadLifecycle("proposal_sent"), true);
    assert.equal(isOpenLeadLifecycle("enrolled_in_sequence"), true);
    assert.equal(isOpenLeadLifecycle("custom_anything"), true);
  });
});

describe("isOpenReportingCategory", () => {
  it("uses reporting categories, not venue stage names", () => {
    assert.equal(isOpenReportingCategory("inquiry"), true);
    assert.equal(isOpenReportingCategory("tour"), true);
    assert.equal(isOpenReportingCategory("proposal"), true);
    assert.equal(isOpenReportingCategory("decision"), true);
    assert.equal(isOpenReportingCategory("unmapped"), true);
    assert.equal(isOpenReportingCategory("booked"), false);
    assert.equal(isOpenReportingCategory("lost"), false);
    assert.equal(isOpenReportingCategory("cancelled"), false);
  });
});

describe("isOpenLeadOpportunity", () => {
  it("terminal sales_stage leaves the funnel even if the venue stage is still open", () => {
    assert.equal(
      isOpenLeadOpportunity({ salesStage: "booked", canonicalStage: "decision" }),
      false,
    );
    assert.equal(
      isOpenLeadOpportunity({ salesStage: "new_inquiry", canonicalStage: "booked" }),
      false,
    );
    assert.equal(
      isOpenLeadOpportunity({ salesStage: "tour_scheduled" }),
      true,
    );
  });

  it("module executable body does not gate on client_id or exclude flag", () => {
    const src = readFileSync(path.join(root, "lib/leads/open-lifecycle.ts"), "utf8");
    const body = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(body, /client_id|exclude_from_business_reporting|excludeFromBusinessReporting/);
    assert.match(body, /isOpenReportingCategory|isOpenLeadLifecycle/);
  });
});

describe("active sales working bucket", () => {
  const rows = [
    { id: "open", salesStage: "new_inquiry", status: "new_inquiry" },
    { id: "booked", salesStage: "booked", status: "booked" },
    { id: "lost", salesStage: "lost", status: "lost" },
    { id: "cancelled", salesStage: "cancelled", status: "cancelled" },
    { id: "won", salesStage: "won", status: "won" },
  ];

  it("keeps only open sales stages in the active queue", () => {
    assert.deepEqual(activeSalesLeads(rows).map((r) => r.id), ["open"]);
    assert.equal(isActiveSalesLead(rows[1]!), false);
  });

  it("keeps booked, lost, and cancelled as closed history, not a new record", () => {
    assert.deepEqual(
      closedRelationshipLeads(rows).map((r) => r.id),
      ["booked", "lost", "cancelled", "won"],
    );
    assert.equal(closedRelationshipLeads(rows)[0], rows[1]);
  });

  it("does not treat a leftover pipeline stage as still active once sales_stage is booked", () => {
    assert.equal(
      isActiveSalesLead({ salesStage: "booked", status: "booked" }),
      false,
    );
    assert.equal(isOpenLeadLifecycle("booked"), false);
  });
});

describe("Leads surfaces", () => {
  it("working pages partition the inventory; getLeads stays the full inventory", () => {
    const leadsPage = readFileSync(path.join(root, "app/(app)/leads/page.tsx"), "utf8");
    const pipelinePage = readFileSync(path.join(root, "app/(app)/leads/pipeline/page.tsx"), "utf8");
    const list = readFileSync(path.join(root, "components/leads/lead-list.tsx"), "utf8");
    const repo = readFileSync(path.join(root, "lib/leads/repository.ts"), "utf8");
    const brochure = readFileSync(path.join(root, "app/(app)/library/brochures/[id]/page.tsx"), "utf8");
    const palette = readFileSync(path.join(root, "components/shell/command-palette.tsx"), "utf8");

    assert.match(leadsPage, /view === "lost"/);
    assert.match(leadsPage, /initialOutcome=\{initialOutcome\}/);
    assert.match(leadsPage, /getLeads\(\)/);
    assert.doesNotMatch(leadsPage, /activeSalesLeads\(/);
    assert.doesNotMatch(leadsPage, /view === "closed"/);

    assert.match(pipelinePage, /PipelineBoard leads=\{inventory\}/);
    assert.doesNotMatch(pipelinePage, /activeSalesLeads\(inventory\)/);
    assert.match(list, /isOpenLeadLifecycle/);
    assert.match(list, /kind: "booked"/);
    assert.match(list, /href="\/clients\?filter=all"/);
    assert.match(list, /view=lost/);
    assert.match(list, /transitionKindForCanonical/);
    assert.doesNotMatch(list, /scope === "closed"/);

    const getLeadsFn = repo.slice(repo.indexOf("export async function getLeads"), repo.indexOf("export async function getLead"));
    assert.doesNotMatch(getLeadsFn, /isOpenLeadLifecycle|activeSalesLeads|booked,lost/);

    assert.match(brochure, /getLeads\(\)/);
    assert.doesNotMatch(brochure, /activeSalesLeads/);
    assert.match(palette, /item\.kind === "lead" && item\.id \? `\/leads\/\$\{item\.id\}`/);
  });
});
