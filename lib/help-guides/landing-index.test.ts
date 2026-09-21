import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { PUBLISHABLE_HELP_ARTICLES } from "@/lib/help-guides/final-articles";
import { collectPublishedHelpArticlesByCategory } from "@/lib/help-guides/landing-index";

const service = readFileSync(join(process.cwd(), "lib/success-library/service.ts"), "utf8");
const helpHome = readFileSync(join(process.cwd(), "app/(app)/help/page.tsx"), "utf8");

describe("Guidance landing index", () => {
  it("lists How Does Date Availability Work? under Finding & Booking Clients even when the DB row is missing", () => {
    const dbRows = PUBLISHABLE_HELP_ARTICLES
      .filter((a) => a.slug !== "how-does-date-availability-work")
      .map((a) => ({ slug: a.slug, title: a.title, goal_category: a.category }));

    const byCategory = collectPublishedHelpArticlesByCategory(PUBLISHABLE_HELP_ARTICLES, dbRows);
    const finding = byCategory.get("Finding & Booking Clients") ?? [];
    const titles = finding.map((a) => a.title);
    const slugs = finding.map((a) => a.slug);

    assert.equal(slugs.filter((slug) => slug === "how-does-date-availability-work").length, 1);
    assert.ok(titles.includes("How Does Date Availability Work?"));
    assert.equal(finding[0]?.slug, "how-does-date-availability-work");
    assert.equal(finding.length, 5);
  });

  it("does not duplicate an editorial article that is also published in the DB", () => {
    const dbRows = PUBLISHABLE_HELP_ARTICLES.map((a) => ({
      slug: a.slug,
      title: a.title,
      goal_category: a.category,
    }));
    const byCategory = collectPublishedHelpArticlesByCategory(PUBLISHABLE_HELP_ARTICLES, dbRows);
    const finding = byCategory.get("Finding & Booking Clients") ?? [];
    assert.equal(finding.filter((a) => a.slug === "how-does-date-availability-work").length, 1);
    assert.equal(finding.length, 5);
  });

  it("Guidance landing builds its list through the editorial-aware index helper", () => {
    assert.match(service, /collectPublishedHelpArticlesByCategory/);
    assert.match(service, /PUBLISHABLE_HELP_ARTICLES/);
    assert.match(helpHome, /getPublishedCategories/);
  });

  it("still includes extra published DB articles that are not in the editorial set", () => {
    const byCategory = collectPublishedHelpArticlesByCategory(PUBLISHABLE_HELP_ARTICLES, [
      {
        slug: "extra-published-guide",
        title: "Extra Published Guide",
        goal_category: "Finding & Booking Clients",
      },
    ]);
    const finding = byCategory.get("Finding & Booking Clients") ?? [];
    assert.ok(finding.some((a) => a.slug === "how-does-date-availability-work"));
    assert.ok(finding.some((a) => a.slug === "extra-published-guide"));
  });
});

describe("Date availability Guidance registration migration", () => {
  it("registers the existing slug once and does not insert a second article", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20261404600000_help_date_availability_guidance_index.sql"),
      "utf8",
    );
    assert.match(sql, /how-does-date-availability-work/);
    assert.match(sql, /How Does Date Availability Work\?/);
    assert.match(sql, /Finding & Booking Clients/);
    assert.match(sql, /You decide when a date is protected\./);
    assert.match(sql, /where not exists/i);
    assert.doesNotMatch(sql, /delete from public\.success_library_articles/i);
    assert.equal((sql.match(/how-does-date-availability-work/g) ?? []).length, 2);
  });
});
