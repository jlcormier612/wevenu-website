import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MEMORIES_DESTINATION,
  MEMORIES_EMPTY_CTA,
  MEMORIES_EMPTY_INVITE,
  MEMORIES_HEADING,
  MEMORIES_PHOTO_CAP,
  MEMORIES_PREVIEW_CTA,
  resolveHomeMemories,
  usesForbiddenMemoriesLanguage,
} from "@/lib/portal/memories";
import type { ClientMedia, JournalEntry } from "@/lib/portal/types";

function entry(over: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "j1",
    entryDate: "2026-07-04",
    title: "Tasting day",
    body: "We tried the lemon cake and both cried a little.",
    milestone: null,
    source: "manual",
    mediaId: null,
    mediaUrl: null,
    createdAt: "2026-07-04T18:00:00.000Z",
    ...over,
  };
}

function photo(id: string, over: Partial<ClientMedia> = {}): ClientMedia {
  return {
    id,
    fileUrl: `https://cdn.example.com/${id}.jpg`,
    mediaType: "image",
    category: "inspiration",
    visibility: "private",
    caption: null,
    createdAt: "2026-07-01T12:00:00.000Z",
    ...over,
  };
}

describe("resolveHomeMemories", () => {
  it("1. features an existing journal memory / photo", () => {
    const model = resolveHomeMemories({
      latestJournalEntry: entry({
        mediaUrl: "https://cdn.example.com/journal.jpg",
        mediaId: "m1",
      }),
      inspirationPhotos: [photo("p1"), photo("p2")],
    });
    assert.equal(model.kind, "preview");
    if (model.kind !== "preview") return;
    assert.equal(model.heading, MEMORIES_HEADING);
    assert.ok(model.featured);
    assert.equal(model.featured.url, "https://cdn.example.com/journal.jpg");
    assert.equal(model.collection.length, 0); // restrained — not a gallery
    assert.equal(model.destination, MEMORIES_DESTINATION);
    assert.equal(model.ctaLabel, MEMORIES_PREVIEW_CTA);
    assert.equal(usesForbiddenMemoriesLanguage(model.accessibleLabel), false);
  });

  it("2. shows a small horizontal collection when multiple inspiration photos exist", () => {
    const many = [photo("a"), photo("b"), photo("c"), photo("d"), photo("e")];
    const model = resolveHomeMemories({
      latestJournalEntry: null,
      inspirationPhotos: many,
    });
    assert.equal(model.kind, "preview");
    if (model.kind !== "preview") return;
    assert.equal(model.featured, null);
    assert.equal(model.collection.length, MEMORIES_PHOTO_CAP);
    assert.ok(model.collection.length < many.length);
    assert.equal(model.destination, "story");
    assert.doesNotMatch(model.accessibleLabel, /\d+\s*photos?/i);
    assert.equal(usesForbiddenMemoriesLanguage(model.ctaLabel), false);
  });

  it("3. uses a gentle empty invite when no memories or photos exist", () => {
    const model = resolveHomeMemories({
      latestJournalEntry: null,
      inspirationPhotos: [],
    });
    assert.equal(model.kind, "empty");
    if (model.kind !== "empty") return;
    assert.equal(model.inviteLine, MEMORIES_EMPTY_INVITE);
    assert.match(model.supportLine, /little moments/i);
    assert.equal(model.ctaLabel, MEMORIES_EMPTY_CTA);
    assert.equal(model.destination, "story");
    assert.equal(usesForbiddenMemoriesLanguage(model.inviteLine), false);
    assert.equal(usesForbiddenMemoriesLanguage(model.supportLine), false);
    assert.doesNotMatch(model.ctaLabel, /upload|complete|progress/i);
  });

  it("4. always CTA to the existing Story destination", () => {
    const withMemory = resolveHomeMemories({
      latestJournalEntry: entry(),
      inspirationPhotos: [],
    });
    const empty = resolveHomeMemories({
      latestJournalEntry: null,
      inspirationPhotos: undefined,
    });
    assert.equal(MEMORIES_DESTINATION, "story");
    assert.equal(withMemory.destination, "story");
    assert.equal(empty.destination, "story");
  });

  it("5. single inspiration photo becomes one featured image (mobile-friendly)", () => {
    const model = resolveHomeMemories({
      latestJournalEntry: null,
      inspirationPhotos: [photo("solo", { caption: "Wildflowers" })],
    });
    assert.equal(model.kind, "preview");
    if (model.kind !== "preview") return;
    assert.ok(model.featured);
    assert.equal(model.featured.alt, "Wildflowers");
    assert.equal(model.collection.length, 0);
  });

  it("6. desktop journal text preview stays warm and non-tasky", () => {
    const model = resolveHomeMemories({
      latestJournalEntry: entry(),
      inspirationPhotos: [],
    });
    assert.equal(model.kind, "preview");
    if (model.kind !== "preview") return;
    assert.equal(model.title, "Tasting day");
    assert.match(model.excerpt ?? "", /lemon cake/i);
    assert.equal(model.featured, null);
    assert.equal(model.collection.length, 0);
    assert.equal(model.ctaLabel, MEMORIES_PREVIEW_CTA);
    for (const text of [model.heading, model.title!, model.excerpt!, model.ctaLabel]) {
      assert.equal(usesForbiddenMemoriesLanguage(text), false);
    }
  });
});

describe("usesForbiddenMemoriesLanguage", () => {
  it("flags task-oriented memory copy", () => {
    assert.equal(usesForbiddenMemoriesLanguage("Upload more!"), true);
    assert.equal(usesForbiddenMemoriesLanguage("Complete your memories"), true);
    assert.equal(usesForbiddenMemoriesLanguage("Memory progress"), true);
    assert.equal(usesForbiddenMemoriesLanguage("3 photos"), true);
    assert.equal(usesForbiddenMemoriesLanguage(MEMORIES_HEADING), false);
  });
});
