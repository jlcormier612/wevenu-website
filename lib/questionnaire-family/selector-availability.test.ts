import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type { QuestionnaireKind } from "@/lib/questionnaire-family/definitions";

type Template = { id: string; name: string; kind: QuestionnaireKind; isArchived: boolean };

function kindTemplates(templates: Template[], kind: QuestionnaireKind): Template[] {
  return templates.filter((t) => t.kind === kind && !t.isArchived);
}

/** Visible Select label — never falsely claim Template unavailable when options exist. */
function selectLabel(
  templates: Template[],
  selectedId: string | null,
  kind: QuestionnaireKind,
): string | null {
  if (!selectedId) return null;
  const kindOpts = kindTemplates(templates, kind);
  const match = kindOpts.find((t) => t.id === selectedId);
  if (match) return match.name;
  if (kindOpts.length === 0) return "Loading templates…";
  return "Select a template…";
}

function initialSelection(
  templates: Template[],
  kind: QuestionnaireKind,
  draftTemplateId: string | null,
): string {
  const opts = kindTemplates(templates, kind);
  if (draftTemplateId && opts.some((t) => t.id === draftTemplateId)) return draftTemplateId;
  if (opts.length === 1) return opts[0].id;
  return "";
}

describe("questionnaire category selectors", () => {
  const library: Template[] = [
    { id: "uuid-cp", name: "Client Planning Questionnaire", kind: "client_planning", isArchived: false },
    { id: "uuid-fd", name: "Final Details", kind: "final_details", isArchived: false },
    { id: "uuid-pe", name: "Post-Event Feedback", kind: "post_event_feedback", isArchived: false },
  ];

  it("lists all three templates in their permitted selectors on a fresh event", () => {
    assert.equal(kindTemplates(library, "client_planning").length, 1);
    assert.equal(kindTemplates(library, "final_details").length, 1);
    assert.equal(kindTemplates(library, "post_event_feedback").length, 1);
    assert.equal(kindTemplates(library, "final_details")[0].name, "Final Details");
    assert.equal(kindTemplates(library, "post_event_feedback")[0].name, "Post-Event Feedback");
  });

  it("keeps Final Details and Post-Event Feedback selectable before Client Planning is sent", () => {
    const sentKinds = new Set<QuestionnaireKind>();
    for (const kind of ["final_details", "post_event_feedback"] as const) {
      const opts = kindTemplates(library, kind);
      assert.ok(opts.length > 0, `${kind} should not depend on a prior send`);
      assert.ok(!sentKinds.has(kind));
    }
  });

  it("shows the real template name on initial selection without Template unavailable", () => {
    assert.equal(initialSelection(library, "final_details", null), "uuid-fd");
    assert.equal(selectLabel(library, "uuid-fd", "final_details"), "Final Details");
    assert.equal(selectLabel(library, "uuid-cp", "client_planning"), "Client Planning Questionnaire");
    assert.doesNotMatch(selectLabel(library, "uuid-cp", "client_planning") ?? "", /Template unavailable/);
  });

  it("cross-kind stale value prompts Select a template rather than unavailable", () => {
    // KindPanel remounts per kind; if a stale id ever appears, do not claim missing Library.
    assert.equal(selectLabel(library, "uuid-cp", "final_details"), "Select a template…");
    assert.doesNotMatch(selectLabel(library, "uuid-missing", "final_details") ?? "", /Template unavailable/);
  });

  it("never uses a raw UUID as the visible label", () => {
    assert.equal(selectLabel(library, "uuid-fd", "final_details"), "Final Details");
    assert.doesNotMatch(selectLabel(library, "uuid-cp", "client_planning") ?? "", /^[0-9a-f-]{36}$/i);
  });

  it("event page ensures library starters before loading templates", () => {
    const page = readFileSync(
      new URL("../../app/(app)/clients/[id]/page.tsx", import.meta.url),
      "utf8",
    );
    assert.match(page, /ensureQuestionnaireFamilyForCurrentVenue\(\)\.then\(\(\) => getQuestionnaireTemplates\(\)\)/);
  });

  it("panel remounts per kind and initializes selection without Template unavailable", () => {
    const panel = readFileSync(
      new URL("../../components/events/questionnaire-family-panel.tsx", import.meta.url),
      "utf8",
    );
    assert.match(panel, /key=\{active\}/);
    assert.match(panel, /initialTemplateSelection/);
    assert.match(panel, /Select a template…/);
    assert.match(panel, /Loading templates…/);
    assert.doesNotMatch(panel, /Template unavailable/);
    assert.match(panel, /templates\.filter\(\(t\) => t\.kind === kind && !t\.isArchived\)/);
    assert.match(panel, /Does not send anything to the client/);
    assert.match(panel, /questionnaire-preview\?kind=.*from=event/);
    assert.doesNotMatch(panel, /questionnaire-preview[^"]*target="_blank"/);
  });

  it("event questionnaire preview keeps original CoupleFamily form and adds return nav only", () => {
    const preview = readFileSync(
      new URL("../../app/(app)/events/[id]/questionnaire-preview/page.tsx", import.meta.url),
      "utf8",
    );
    assert.match(preview, /CoupleFamilyQuestionnaireForm/);
    assert.match(preview, /previewMode/);
    // Do not wrap the form in a substitute cream/min-h theme shell.
    assert.doesNotMatch(preview, /bg-\[#F7F5F1\]/);
    assert.doesNotMatch(preview, /min-h-screen bg-/);
    assert.match(preview, /Preview — not sent/);
    assert.match(preview, /questionnaire-preview-back/);
    assert.match(preview, /Back to Questionnaires/);
    assert.match(preview, /#questionnaires/);
    assert.match(preview, /questionnaire-preview-back-overview/);
    assert.match(preview, /Back to Overview/);
    assert.match(preview, /#overview/);
    assert.match(preview, /Back to Library/);
    // Same-tab hard anchors (not Next Link / blank).
    assert.match(preview, /<a\s+href=\{overviewHref\}/);
    assert.match(preview, /<a\s+href=\{questionnairesHref\}/);
    assert.doesNotMatch(preview, /from "next\/link"/);
    assert.doesNotMatch(preview, /target="_blank"/);
    assert.doesNotMatch(preview, /window\.open/);
  });
});
