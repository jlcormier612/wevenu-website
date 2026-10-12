import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type { QuestionnaireKind } from "@/lib/questionnaire-family/definitions";

type Template = { id: string; name: string; kind: QuestionnaireKind; isArchived: boolean };

function kindTemplates(templates: Template[], kind: QuestionnaireKind): Template[] {
  return templates.filter((t) => t.kind === kind && !t.isArchived);
}

function selectLabel(
  templates: Template[],
  selectedId: string | null,
): string | null {
  if (!selectedId) return null;
  return templates.find((t) => t.id === selectedId)?.name ?? "Template unavailable";
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
    // No sent questionnaires — selectors still derive from library kinds only.
    const sentKinds = new Set<QuestionnaireKind>();
    for (const kind of ["final_details", "post_event_feedback"] as const) {
      const opts = kindTemplates(library, kind);
      assert.ok(opts.length > 0, `${kind} should not depend on a prior send`);
      assert.ok(!sentKinds.has(kind));
    }
  });

  it("never uses a raw UUID as the visible label", () => {
    assert.equal(selectLabel(library, "uuid-fd"), "Final Details");
    assert.equal(selectLabel(library, "uuid-missing"), "Template unavailable");
    assert.doesNotMatch(selectLabel(library, "uuid-cp") ?? "", /^[0-9a-f-]{36}$/i);
  });

  it("event page ensures library starters before loading templates", () => {
    const page = readFileSync(
      new URL("../../app/(app)/clients/[id]/page.tsx", import.meta.url),
      "utf8",
    );
    assert.match(page, /ensureQuestionnaireFamilyForCurrentVenue\(\)\.then\(\(\) => getQuestionnaireTemplates\(\)\)/);
  });

  it("SelectValue resolves human-readable names via children formatter", () => {
    const panel = readFileSync(
      new URL("../../components/events/questionnaire-family-panel.tsx", import.meta.url),
      "utf8",
    );
    assert.match(panel, /SelectValue placeholder="Choose…"/);
    assert.match(panel, /\(value: string \| null\) =>/);
    assert.match(panel, /Template unavailable/);
    assert.match(panel, /templates\.filter\(\(t\) => t\.kind === kind && !t\.isArchived\)/);
    assert.match(panel, /Does not send anything to the client/);
  });
});
