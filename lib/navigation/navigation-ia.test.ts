/**
 * Final venue left-navigation IA. Section order, item order, and labels are a
 * locked product decision — these assertions exist so a well-meaning edit
 * cannot quietly reintroduce an Admin section, a second Requests entry, or the
 * retired "Help & Guides" / "Your People" / "Sales" wording.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { NAV_ITEMS, NAV_SECTIONS } from "@/lib/navigation";

describe("venue navigation IA", () => {
  it("has exactly the eight sections in the locked order", () => {
    assert.deepEqual(
      NAV_SECTIONS.map((s) => s.id),
      [
        "overview",
        "relationships",
        "scheduling",
        "communication",
        "library",
        "financials",
        "to-dos",
        "your-venue",
      ],
    );
    assert.deepEqual(
      NAV_SECTIONS.map((s) => s.label),
      [
        "Overview",
        "Your Relationships",
        "Scheduling",
        "Communication",
        "Library",
        "Financials",
        "To Do’s",
        "Your Venue",
      ],
    );
  });

  it("has exactly the locked items, in order, in every section", () => {
    const shape = Object.fromEntries(
      NAV_SECTIONS.map((s) => [s.id, s.items.map((i) => i.title)]),
    );
    assert.deepEqual(shape, {
      overview: ["Dashboard", "Reports", "Guidance"],
      relationships: ["Leads", "Clients", "Vendors"],
      scheduling: ["Calendar", "Tours"],
      communication: ["Inbox", "Automations"],
      library: ["Templates", "Documents"],
      financials: ["Contracts", "Invoices", "Payments"],
      "to-dos": ["Task Center", "Requests"],
      "your-venue": ["Setup", "Settings", "Venue Guide", "Feedback"],
    });
  });

  it("has no Admin section, empty or otherwise", () => {
    for (const section of NAV_SECTIONS) {
      assert.doesNotMatch(section.label, /admin/i);
      assert.ok(section.items.length > 0, `${section.id} must not be an empty section`);
      for (const item of section.items) {
        assert.ok(
          !item.href.startsWith("/admin"),
          `${item.id} points at the HQ console: ${item.href}`,
        );
      }
    }
    // The gating flag that used to reveal an admin-only section is gone too.
    const sidebar = readFileSync(resolve("components/shell/sidebar-nav.tsx"), "utf8");
    assert.doesNotMatch(sidebar, /NEXT_PUBLIC_WEVENU_ADMIN/);
    assert.doesNotMatch(sidebar, /adminOnly/);
  });

  it("shows Requests exactly once, under To Do’s", () => {
    const owners = NAV_SECTIONS.filter((s) => s.items.some((i) => i.id === "requests"));
    assert.equal(owners.length, 1);
    assert.equal(owners[0].id, "to-dos");
    assert.equal(NAV_ITEMS.filter((i) => i.href === "/requests").length, 1);
  });

  it("shows Feedback exactly once, as the last Your Venue item", () => {
    const owners = NAV_SECTIONS.filter((s) => s.items.some((i) => i.id === "feedback"));
    assert.equal(owners.length, 1);
    assert.equal(owners[0].id, "your-venue");
    assert.equal(owners[0].items.at(-1)?.id, "feedback");
    // Venue-facing, not the HQ triage console.
    assert.equal(NAV_ITEMS.find((i) => i.id === "feedback")?.href, "/feedback");
  });

  it("keeps Guidance and Venue Guide as separate destinations", () => {
    const guidance = NAV_ITEMS.find((i) => i.id === "guidance");
    const venueGuide = NAV_ITEMS.find((i) => i.id === "venue-guide");
    assert.equal(guidance?.title, "Guidance");
    assert.equal(guidance?.href, "/help");
    assert.equal(venueGuide?.title, "Venue Guide");
    assert.equal(venueGuide?.href, "/guide");
    assert.notEqual(guidance?.href, venueGuide?.href);
  });

  it("uses none of the retired navigation labels", () => {
    const labels = NAV_SECTIONS.map((s) => s.label);
    const titles = NAV_ITEMS.map((i) => i.title);
    for (const retired of ["Sales", "Tasks", "Your People", "Help"]) {
      assert.ok(!labels.includes(retired), `retired section label present: ${retired}`);
    }
    for (const retired of ["Help & Guides", "Feedback/Requests", "Library"]) {
      assert.ok(!titles.includes(retired), `retired item title present: ${retired}`);
    }
  });

  it("gives every section and item a unique stable id", () => {
    assert.equal(new Set(NAV_SECTIONS.map((s) => s.id)).size, NAV_SECTIONS.length);
    assert.equal(new Set(NAV_ITEMS.map((i) => i.id)).size, NAV_ITEMS.length);
    assert.equal(new Set(NAV_ITEMS.map((i) => i.href)).size, NAV_ITEMS.length);
  });

  it("renders from ids rather than labels", () => {
    const sidebar = readFileSync(resolve("components/shell/sidebar-nav.tsx"), "utf8");
    assert.match(sidebar, /key=\{section\.id\}/);
    assert.match(sidebar, /key=\{item\.id\}/);
    assert.doesNotMatch(sidebar, /key=\{section\.label\}/);
    // Inbox's unread badge keys off the id now, not a hardcoded href.
    assert.match(sidebar, /item\.id === "inbox"/);
  });

  it("keeps Templates and Documents from both lighting up at once", () => {
    const sidebar = readFileSync(resolve("components/shell/sidebar-nav.tsx"), "utf8");
    // /library prefixes /library/documents, so Templates must exclude it.
    assert.match(sidebar, /item\.id === "templates"/);
    assert.match(sidebar, /!pathname\.startsWith\("\/library\/documents"\)/);
  });
});

describe("navigation terminology in user-facing copy", () => {
  it("names the guidance destination Guidance", () => {
    const areas = readFileSync(resolve("lib/help-guides/areas.ts"), "utf8");
    assert.match(areas, /HELP_GUIDES_TITLE = "Guidance"/);
  });

  it("routes article copy to Your Relationships → Leads", () => {
    const articles = readFileSync(resolve("lib/help-guides/final-articles.ts"), "utf8");
    assert.match(articles, /Your Relationships → Leads/);
    assert.doesNotMatch(articles, /Sales → Leads/);
  });

  it("ships a new migration for the already-seeded article bodies", () => {
    // The applied content migration must not be edited in place.
    const sql = readFileSync(
      resolve("supabase/migrations/20261399300000_nav_ia_guidance_relationships_copy.sql"),
      "utf8",
    );
    assert.match(sql, /update public\.success_library_articles/);
    assert.match(sql, /'Sales → Leads', 'Your Relationships → Leads'/);
    // There is no "body" column — the editorial body lives in why_it_matters.
    assert.match(sql, /why_it_matters/);
    assert.doesNotMatch(sql, /\bset body\b|where body\b/);
    const seeded = readFileSync(
      resolve("supabase/migrations/20261386000000_help_guides_final_content.sql"),
      "utf8",
    );
    assert.match(seeded, /Sales → Leads/, "the applied migration should stay untouched");
  });

  it("renames only the team setup guide's shortTitle, not every 'Your People'", () => {
    const guides = readFileSync(resolve("lib/help-guides/setup-guides.ts"), "utf8");
    const team = guides.match(/slug: "setup-your-team"[\s\S]{0,200}/)?.[0] ?? "";
    assert.match(team, /shortTitle: "Team"/);
    assert.doesNotMatch(guides, /shortTitle: "Your People"/);
  });
});
