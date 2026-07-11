# Planning Templates — Bring Your Existing Checklist

**Status: Approved, moving to implementation (Phase 1).** Written in response to "Planning Templates - Remaining Product Work" (2026-07-09), item 1; refined 2026-07-10 with an explicit framing correction from the user: *this is not an AI document-parsing feature.* It's the "Bring Your Existing Checklist" story — a venue that has run weddings for years already has the checklist. Re-typing years of accumulated planning knowledge into Wevenu one task at a time, by hand, is a real barrier to a venue actually switching to Planning Templates. That's the problem this solves. Everything else — Luv, file parsing, phasing — is implementation detail in service of that one goal, not the point of the feature.

## The user story

*"I've been running weddings at this venue for eleven years. I have a checklist. It's in a Word document, it's a little messy, some of the timing is written as notes to myself rather than clean numbers — but it's real, it's mine, and it works. I should not have to type all of that into a web form one task at a time to start using Wevenu."*

That's who this is for. Success looks like: a coordinator pastes in what they already have, and a few seconds later they're looking at that same checklist, structured, inside the Template Editor they already know how to use — not a new tool to learn, just fewer hours of re-typing.

**Luv's role is narrow and stays narrow:** it reads the pasted text once and proposes a first-pass structure — which is exactly the same "system proposes, human confirms" pattern already used for Luv-drafted emails. It doesn't run in the background, it doesn't "understand" the venue, and it isn't a chat feature. It converts once, at import time, and then gets out of the way — the coordinator finishes the work in the same Template Editor used for every other template, exactly as the user asked.

**Refinement (2026-07-11): the venue's document is the source of truth, not a starting point for Luv's own ideas.** Luv's job is organizing and transcribing what's actually there — not inventing tasks, not significantly restructuring a checklist that already has its own sections and order. If the source document already groups its own content into sections, Luv preserves that grouping and order verbatim rather than imposing a different (even "more logical") structure. Luv only invents a section structure when the source text is genuinely a flat, ungrouped list with none of its own — and even then, the invented structure is the minimum needed to make the list reviewable, not a redesign. The one place Luv still infers something the source may not state explicitly is due-date timing (`daysOffset`), which is unavoidable — a checklist item like "send final invoice" needs *some* due date to become a real task — and those inferred dates are exactly what the post-import summary banner flags for the coordinator to check first.

---

## Implementation notes (secondary to the story above)

**Grounding facts, confirmed against the current codebase:**
- **Luv is a real capability, not a stub** — it calls the actual Anthropic API today (`lib/luv/drafts.ts`, `lib/luv/client-drafts.ts`, `lib/luv/import-assist.ts`, gated behind `ANTHROPIC_API_KEY`). Its existing jobs are drafting outbound communications and (as of the Vendor Management import work) turning pasted text into structured rows for CSV-shaped entities. Converting pasted text into a milestones-and-tasks structure is the same kind of job, new only in its output shape.
- **No document text-extraction exists for this feature's Phase 1** — Word/PDF upload for Planning Templates is deliberately deferred (see phasing below); Copy/Paste needs none of that infrastructure.
- **No Google API/OAuth integration exists anywhere in this codebase.** Deferred to a documented workaround, not built (see §4, unchanged from the original analysis).

None of that changes the plan below — it's the same reason Copy/Paste ships first: it's the cheapest way to prove the actual thing that matters (is the proposed checklist good enough to be worth reviewing) before spending effort on file parsing.

---

## 1. The actual mechanism is the same for all five sources

Whatever the source, the real work is identical once you have plain text in hand: **hand that text to Luv, get back a proposed set of milestones and tasks, let the coordinator review and adjust before anything is saved as a real template.** That's one pipeline, not five:

```
[ some source of text ] → [ plain text ] → [ Luv proposes a draft template ] → [ coordinator reviews & edits ] → [ real Planning Template ]
```

The five sources named in the request are five different ways of getting to "plain text" — which is exactly why they don't all cost the same to build.

| Source | Getting to plain text | New infrastructure needed |
|---|---|---|
| Copy/Paste, Existing text | Already plain text | **None** |
| Word documents (.docx) | Extract text from the file | One new library (e.g. a `.docx`→text extractor) |
| PDFs | Extract text from the file | One new library — **with a caveat below** |
| Google Docs | Extract text from the file | Either real Google API integration (large, new), or a documented workaround (see §4) |

**Recommendation: build the pipeline once, against plain text, then add sources to it one at a time — cheapest first.** Copy/Paste needs nothing new and validates whether Luv-assisted conversion is actually good enough to trust, before investing in file parsing at all.

---

## 2. The conversion pipeline (the part that's new regardless of source)

### 2.1 Input
A coordinator pastes or uploads their existing planning document, and picks which kind of checklist it's meant to become — **Client Planning or Venue Planning** (the same fork that already exists everywhere else in this feature; it can't be guessed reliably from text alone, so ask rather than infer).

### 2.2 Luv proposes a draft
This is new work for Luv, following its existing pattern (direct Anthropic call, human-reviewed output, nothing auto-committed) rather than a new mechanism:
- Input: the raw text + the chosen kind (Client/Venue).
- Output: a structured proposal — milestones (sections), and within each, tasks with a title, instructions, and a **relative due date guess expressed in plain language** ("about 30 days before the event" — Luv reads relative phrasing already present in the source text where it exists, e.g. "send 2 weeks before," and otherwise makes a reasonable guess it flags as a guess).
- Luv does not guess Owner/Wait-until/Escalation for Venue Planning tasks, and does not guess attachments — those stay coordinator-set, same as building a template by hand.

### 2.3 The draft opens directly in the existing Template Editor
Luv's proposal is created as a **real template** — the same mechanism the "Standard Wedding" starter already uses (`createFromReference` in `lib/playbooks/service.ts`: one template row, its milestones, its tasks, in one pass) — and the coordinator lands directly in the Template Editor they already use for every other template. There's no second, parallel "review the AI's work" screen to learn; editing a task Luv proposed and editing a task typed by hand are the same action, because they end up as the same kind of row. Due dates Luv had to guess (the source text didn't state a timing) are called out once in a summary banner right after creation, so the coordinator knows what to double-check first — not tracked per-task forever after.

### 2.4 Where this lives in the product
- **A fourth option in the existing starter picker**, alongside "Standard Wedding," "Duplicate one of your own," and "Start from scratch": *"Import an existing checklist."* Low-effort to surface since the starter picker already exists — this is Phase 1's entry point.
- **A first-class step in venue onboarding** (`components/setup/`) remains a named future integration point — the request specifically calls this out as "a first-class onboarding path" — but isn't required to ship Phase 1, which needs to exist and prove itself in the Template Library first.

---

## 3. PDFs need one more caveat: not every PDF has real text in it

A PDF that was exported from Word has real, extractable text. A PDF that's a **scanned photo of a printed checklist** has none — it's an image, and text extraction returns nothing usable without OCR (a meaningfully bigger, separate capability). Recommendation: extract text where possible; when a PDF yields little or no text, tell the coordinator plainly ("We couldn't read text from this file — try copy/paste instead") rather than silently producing an empty or garbled template. Don't build OCR for V1 — it's a legitimate future enhancement if scanned documents turn out to be common, not a blocker for shipping the rest of this.

---

## 4. Google Docs: a pragmatic V1 answer instead of new OAuth infrastructure

Real Google Docs API integration is a genuinely separate, larger effort — new Google Cloud project, OAuth consent screens, token storage and refresh, ongoing API maintenance. Building it just for this feature is disproportionate to the problem.

**Proposed V1 answer: don't integrate the API — rely on Google Docs' own export.** Every Google Doc can be downloaded as `.docx` or copied and pasted directly (Google Docs preserves plain text on copy). Once Word-document import and Copy/Paste both exist (§1), a venue with planning materials in Google Docs already has two ways in without any Google-specific code. The onboarding copy can say so directly: *"Have this in Google Docs? Download it as a Word document, or just copy and paste the text."*

**True "connect your Google account and pick a Doc"** stays a named, real future item — worth its own scoping pass if venues push back on the export/paste workaround — but shouldn't block or bloat this one.

---

## 5. Phasing — Phase 1 is what's being built now

1. **Copy/Paste + Luv conversion + Template Editor review — building now.** No new dependencies. Validates the actual hard part (is Luv's proposal good enough to be worth reviewing rather than starting from scratch) before spending effort on file parsing.
2. **Word (.docx) upload**, feeding the same pipeline via one new text-extraction library. Not started.
3. **PDF upload**, same pipeline, with the "couldn't read this file" fallback from §3. Not started.
4. **Google Docs** via the export/paste workaround in §4 — documentation and onboarding copy, not new code — with true API integration named as a separate future item, not built now.

This sequencing directly serves the "Bring Your Existing Checklist" story: a coordinator can eliminate manual re-entry today with Copy/Paste alone — most existing planning documents can be opened and copied regardless of original format — while file-upload conveniences layer on afterward as their own, smaller passes.

---

Phase 1 implementation in progress.
