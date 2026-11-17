import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

function read(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

describe("Practice Run PM-03 client perspective", () => {
  it("wires an interactive Venue | Client switcher without unfinished copy", () => {
    const shell = read("components/setup-hub/practice-run-shell.tsx");
    assert.match(shell, /practice-run-perspective-switcher/);
    assert.match(shell, /practice-perspective-venue/);
    assert.match(shell, /practice-perspective-client/);
    assert.match(shell, /\/practice-run\/\$\{encodeURIComponent\(run\.id\)\}\/client/);
    assert.doesNotMatch(shell, /Coming next|Coming soon|Under construction/i);
  });

  it("authorizes Practice Run client view server-side for the owning venue only", () => {
    const access = read("lib/practice-run/client-perspective.ts");
    assert.match(access, /requirePracticeClientAccess/);
    assert.match(access, /getPracticeRunForVenue/);
    assert.match(access, /getRecordPracticeRunId/);
    assert.match(access, /ensurePracticePortalSession/);
    assert.match(access, /No general impersonation/);
    assert.match(access, /PRACTICE_PORTAL_SESSION_LABEL/);
  });

  it("renders the real PortalShell under the Practice Run client route", () => {
    const page = read("app/(practice-client)/practice-run/[runId]/client/page.tsx");
    assert.match(page, /requirePracticeClientAccess/);
    assert.match(page, /skipLegalGate/);
    assert.match(page, /PortalShell/);
    assert.match(page, /resolvePortalContext/);
    assert.match(page, /PracticeClientFrame/);
    assert.match(page, /needsAcceptance: false/);
  });

  it("keeps practice conversation in-app and blocks email fan-out for practice clients", () => {
    const convo = read("lib/practice-run/conversation-service.ts");
    assert.match(convo, /sendConversationMessage/);
    assert.match(convo, /\"portal\"/);
    assert.match(convo, /findOrCreateVenueCoupleConversation/);
    const messagesRoute = read("app/api/portal/messages/route.ts");
    assert.match(messagesRoute, /practice_run_id/);
    const notify = read("lib/conversations/notify.ts");
    assert.match(notify, /Practice Run clients/);
    assert.match(notify, /practice_run_id/);
  });
});
