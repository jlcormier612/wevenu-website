/**
 * Give feedback: one way in, and four choices that actually do something.
 *
 * The shape being locked here came out of a live review. There were two ways to
 * give feedback — a nav item that opened a page of four descriptions, and a
 * button at the bottom of the sidebar that opened the form straight away — and
 * the four descriptions on that page were inert `div`s, so the only working
 * control on the whole page was a small "Share feedback" button in the corner
 * that asked which of the four you wanted all over again.
 *
 * These are source assertions rather than rendered-DOM assertions: the repo has
 * no component test runner, and every claim below is a structural one that
 * reading the file can settle. Rendered behaviour — a real click opening a real
 * wide frame, a real submission reaching the API — was verified against the
 * deployed Sandbox instead, which is the only place that can actually prove it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { NAV_ITEMS, NAV_SECTIONS } from "@/lib/navigation";

const read = (p: string) => readFileSync(resolve(p), "utf8");

const PAGE = "app/(app)/feedback/page.tsx";
const SHEET = "components/feedback/feedback-sheet.tsx";
const SHELL = "components/shell/workspace-shell.tsx";

/** The four choices, in the order the landing page offers them. */
const CHOICES = [
  { type: "support", label: "Get Help" },
  { type: "bug", label: "Report a Bug" },
  { type: "feature", label: "Suggest an Idea" },
  { type: "nps", label: "Rate Hello to Cheers" },
] as const;

describe("Give feedback — navigation", () => {
  it("offers exactly one destination, labelled Give feedback", () => {
    const entries = NAV_ITEMS.filter((i) => i.href === "/feedback");
    assert.equal(entries.length, 1);
    assert.equal(entries[0].title, "Give feedback");
  });

  it("puts it last under Your Venue, after Setup, Settings and Venue Guide", () => {
    const section = NAV_SECTIONS.find((s) => s.id === "your-venue");
    assert.ok(section);
    assert.deepEqual(section.items.map((i) => i.title), [
      "Setup",
      "Settings",
      "Venue Guide",
      "Give feedback",
    ]);
  });

  it("says Give feedback rather than Feedback", () => {
    // "Feedback" alone reads like a place where feedback is kept. The venue is
    // giving it to us, so the label is the verb.
    assert.ok(!NAV_ITEMS.some((i) => i.title === "Feedback"));
  });

  it("no longer pins a second trigger to the bottom of the sidebar", () => {
    const shell = read(SHELL);
    assert.doesNotMatch(shell, /FeedbackSheet/);
    assert.doesNotMatch(shell, /Give feedback</);
    // The nav is the only thing left in the sidebar column.
    assert.match(shell, /<SidebarNav staffRole=\{staffRole\} \/>/);
  });

  it("keeps the venue page separate from the HQ triage console", () => {
    assert.ok(!NAV_ITEMS.some((i) => i.href.startsWith("/admin")));
  });
});

describe("Give feedback — landing page", () => {
  const page = read(PAGE);

  it("shows all four choices", () => {
    for (const { label } of CHOICES) {
      assert.ok(page.includes(`"${label}"`), `landing page is missing ${label}`);
    }
  });

  it("offers them in the locked order", () => {
    const positions = CHOICES.map(({ label }) => page.indexOf(`"${label}"`));
    assert.deepEqual(
      [...positions].sort((a, b) => a - b),
      positions,
      "landing cards are out of order",
    );
  });

  it("wires each choice to its own feedback category", () => {
    for (const { type } of CHOICES) {
      assert.match(
        page,
        new RegExp(`type:\\s*"${type}"`),
        `landing page never asks for the ${type} category`,
      );
    }
  });

  it("uses the same wording as the category chip inside the form", () => {
    // A card that says "Report a Bug" opening a form whose selected chip says
    // something else would read as though the click went somewhere unintended.
    const sheet = read(SHEET);
    for (const { label } of CHOICES) {
      assert.ok(sheet.includes(`"${label}"`), `form chip label drifted from ${label}`);
    }
  });

  it("makes every choice a real button, not a bordered div", () => {
    assert.match(page, /CHANNELS\.map/);
    assert.match(page, /triggerAsButton/);
  });

  it("gives each card exactly one tab stop", () => {
    // The card is the trigger, rather than a real button wrapped in a
    // span[role=button][tabindex=0] — which is two stops for one card, the
    // outer one carrying no focus ring.
    const sheet = read(SHEET);
    assert.match(sheet, /triggerAsButton \? \(\s*<button type="button" className=\{triggerClassName\} \/>/);
    assert.match(sheet, /nativeButton=\{triggerAsButton\}/);
    assert.ok(!page.includes("<button"), "the page should hand over content, not a nested control");
  });

  it("gives the cards a visible keyboard focus state", () => {
    assert.match(page, /focus-visible:ring-3/);
    assert.match(page, /focus-visible:border-ring/);
  });

  it("opens the wide frame, not the sidebar drawer", () => {
    assert.match(page, /presentation="dialog"/);
  });

  it("no longer carries a competing Share feedback button", () => {
    // The cards are the call to action. A second one in the page header meant
    // choosing a category twice. (The retired label survives in a comment
    // explaining why it went, so this looks for the rendered control.)
    assert.ok(!page.includes(">Share feedback<"));
    assert.doesNotMatch(page, /actions=/);
    assert.doesNotMatch(page, /components\/ui\/button/);
  });

  it("keeps the header and the Venue Guide / Guidance explainer", () => {
    assert.match(page, /title="Give feedback"/);
    assert.match(page, /Venue Guide/);
    assert.match(page, /Guidance/);
  });
});

describe("Give feedback — form presentation", () => {
  const sheet = read(SHEET);

  it("centres the dialog and makes it substantially wider than the drawer", () => {
    // Drawer: sm:max-w-md (28rem). Dialog: sm:max-w-2xl (42rem), 50% wider, and
    // centred by DialogContent rather than pinned to the right edge.
    assert.match(sheet, /sm:max-w-2xl/);
    assert.match(sheet, /sm:max-w-md/);
  });

  it("pads the dialog more generously than the drawer", () => {
    assert.match(sheet, /presentation === "dialog" \? "px-6 py-5" : "px-5 py-4"/);
  });

  it("gives the dialog a title and keeps the built-in close control", () => {
    assert.match(sheet, /<DialogTitle>Give feedback<\/DialogTitle>/);
    // DialogContent renders its own close button and Escape handling; opting out
    // would need showCloseButton={false}, which is absent.
    assert.doesNotMatch(sheet, /showCloseButton/);
  });

  it("scrolls the fields, keeping header and Send button in place", () => {
    assert.match(sheet, /overflow-hidden/);
    assert.match(sheet, /flex-1 space-y-5 overflow-y-auto/);
  });

  it("opens on the category it was asked for, and resets to it", () => {
    assert.match(sheet, /initialType = "general"/);
    assert.match(sheet, /React\.useState<FeedbackType>\(initialType\)/);
    assert.match(sheet, /function reset\(\)\s*\{\s*setType\(initialType\)/);
  });

  it("leaves the picker in place so the category can still be changed", () => {
    assert.match(sheet, /FEEDBACK_TYPES\.map/);
  });
});

describe("Give feedback — submission is untouched", () => {
  const sheet = read(SHEET);

  it("shares one form between both frames", () => {
    // The fields exist once and are rendered into whichever frame is asked for,
    // so validation and submission cannot diverge between drawer and dialog.
    assert.equal((sheet.match(/const form = \(/g) ?? []).length, 1);
    assert.equal((sheet.match(/\{form\}/g) ?? []).length, 2);
    assert.equal((sheet.match(/const submitButton = \(/g) ?? []).length, 1);
    assert.equal((sheet.match(/\{submitButton\}/g) ?? []).length, 2);
  });

  it("keeps the same endpoints", () => {
    assert.match(sheet, /"\/api\/portal\/product-feedback"/);
    assert.match(sheet, /"\/api\/feedback"/);
    assert.match(sheet, /"\/api\/portal\/product-feedback\/upload"/);
    assert.match(sheet, /"\/api\/feedback\/upload"/);
    assert.match(sheet, /`\/api\/feedback\/features\/\$\{featureId\}\/vote`/);
  });

  it("keeps the same validation rule", () => {
    // A rating for the rating type, otherwise some words. Unchanged.
    assert.match(sheet, /canSend\s*=\s*isNps \? rating != null : body\.trim\(\)\.length > 0/);
    assert.match(sheet, /disabled=\{!canSend \|\| sending \|\| uploadingShot\}/);
  });

  it("keeps the same payload fields, including the public-share consent", () => {
    for (const field of [
      "type",
      "subject",
      "body",
      "rating",
      "surface",
      "related_venue_id",
      "allow_public_share",
      "attachments",
      "metadata",
    ]) {
      assert.ok(sheet.includes(field), `payload lost ${field}`);
    }
    assert.match(sheet, /allow_public_share: isNps \? allowPublicShare : false/);
  });

  it("keeps the same success and failure handling, and clears on close", () => {
    assert.match(sheet, /toast\.success\("Feedback sent — thank you!"\)/);
    assert.match(sheet, /toast\.error\("Couldn't send feedback\. Please try again\."\)/);
    assert.match(sheet, /if \(!o\) reset\(\)/);
  });

  it("still limits and sizes screenshot attachments the same way", () => {
    assert.match(sheet, /MAX_FEEDBACK_SCREENSHOTS/);
    assert.match(sheet, /MAX_FEEDBACK_SCREENSHOT_MB \* 1024 \* 1024/);
  });
});

describe("Give feedback — other surfaces keep the drawer", () => {
  it("defaults to the drawer, so nothing changes for anyone who didn't ask", () => {
    assert.match(read(SHEET), /presentation = "drawer"/);
  });

  it("leaves the couple portal and vendor app on the drawer", () => {
    // Those triggers sit beside other work in a sidebar or a page footer; a
    // full centred frame would be the wrong weight there, and neither was in
    // scope for this correction.
    for (const surface of [
      "components/portal/portal-shell.tsx",
      "components/vendor-app/vendor-app-shell.tsx",
    ]) {
      const src = read(surface);
      assert.match(src, /<FeedbackSheet/);
      assert.doesNotMatch(src, /presentation=/);
      assert.doesNotMatch(src, /triggerAsButton/);
    }
  });

  it("defaults triggerAsButton off, so their triggers still wrap as before", () => {
    assert.match(read(SHEET), /triggerAsButton = false/);
  });
});
