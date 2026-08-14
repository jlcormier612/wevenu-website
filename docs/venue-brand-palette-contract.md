# Venue Brand Palette — Product Contract

**Type:** Product/architecture audit only. No code, schema, copy, or branding behavior was modified to produce this document.
**Method:** Every consumer claim below was traced directly in the current working tree — CSS custom-property injection points (`grep`-located, then read in full), every PDF/print-document generator, the shared email wrapper, and the two database RPCs that assemble client-facing context (`get_rsvp_context`, read via `\sf`). Counts are exact `grep -o` occurrence counts in the current tree, not estimates, and are called out as superseding the prior White-Label Certification's counts where the two differ — the product has visibly moved since that certification, and this document treats the current code as the only authority.

---

## 1. Executive Summary

**What the four colors mean today, in one paragraph:** Primary is the venue's true, universal brand color — it is wired into every client-facing surface found in this audit without exception. Secondary, Accent, and Neutral are not neglected or broken; they are **real, working, selectively-applied colors that already follow a coherent, if never-stated, design logic** — Secondary marks supporting headings on formal printed documents (Contract, Brochure, Event Order), Accent marks the one number or moment on a page that deserves emphasis (an RSVP milestone, an invoice's amount due, the current row on a day sheet), and Neutral provides structural background wash where a document needs one (an invoice header). None of the three is "barely used" by accident — each is already used *for something specific*, just never in a place where the venue is told what that something is.

**Where the real problem is:** not the palette, not the architecture, and not (mostly) the code. The problem is that the setup screen tells a venue their colors are "displayed throughout your workspace" — a claim that was never true and was never meant to be, since the venue's own internal workspace is deliberately Hello to Cheers-branded, not venue-branded, by design. **This is a copy gap, not a product gap**, and it is the single highest-leverage fix available.

**One genuine, narrow product gap found, not previously documented:** the shared email wrapper (`lib/email/venue-brand.ts`), which every branded email in the product — Conversations, contract invites, team invites, tour confirmations — is built on, has no concept of Secondary, Accent, or Neutral at all; its type only accepts `primaryColor`. This is defensible (HTML email is a genuinely constrained medium) but it is a real, permanent ceiling on the palette's reach that the eventual setup copy needs to account for honestly, not paper over.

**Confirmed, and worth stating plainly so it isn't re-litigated:** the Hosted Experience (Wedding Website) and RSVP are correctly, deliberately **not** part of this palette at all — `get_rsvp_context` sources its accent color from `couple_websites.accent_color`, a wholly separate, couple-owned table with no relationship to `venues.accentColor`. This is not a gap. It is the same "couple owns their own aesthetic" principle already established elsewhere in this product, confirmed still intact.

---

## 2. Current Reality

### Primary

- **Current role:** universal brand identity — the one color every client-facing surface uses.
- **Current consumers, all confirmed live in code:** Couple Portal (138 occurrences across portal components), Contract sign page, all three PDF generators (Contract, Event Order, Brochure — header border in each), both print documents (Invoice, Day Sheet), the public inquiry form, the public questionnaire form, the public Brochure page, and the shared email wrapper (CTA button color + top border) used by every branded email in the product.
- **Meaningful usage:** yes, comprehensive, no gaps found.
- **Important limitation:** none found. This is the one color with no open question.

### Secondary

- **Current role, as actually used:** supporting-heading color on **formal printed collateral** specifically — section rules, section headings, and signature-block titles.
- **Current consumers:** Contract PDF (3 occurrences — section rule border, section heading color, signature title), Brochure PDF (2), Event Order PDF (2), Couple Portal chrome (4, minor — general shell styling, not a distinct functional role), Website Studio editor chrome (1 — the venue-side *editing tool*, not the published site guests see).
- **Meaningful usage:** yes, but narrow and consistent — every real usage found is "a supporting heading on a formal document."
- **Important limitation:** absent from the Contract sign page itself (0 occurrences), absent from both print documents (Invoice, Day Sheet), absent from email. Its role is real but its reach is currently limited to three of the roughly dozen surfaces audited.

### Accent

- **Current role, as actually used:** **the one number or moment on a page that deserves emphasis** — not decoration, a specific, repeated, functional pattern.
- **Current consumers, with exact function confirmed by reading the surrounding code, not just counting references:**
  - Couple Portal: RSVP milestone celebration callouts ("Your first RSVP is in!") and native checkbox accent-color styling, concentrated almost entirely in the Guest, Budget, and Seating sections (20 occurrences, 13 of them in Guest alone).
  - Contract sign page (2 occurrences).
  - Invoice print document: the amount-due dollar figure specifically — the single largest, boldest number on the page.
  - Day Sheet print document: the current/active row highlight (2 occurrences).
- **Meaningful usage:** yes — this is arguably the most *coherent* color in the current system, even though it's the one most likely to look "barely used" from a raw count alone.
- **Important limitation:** absent from Contract, Brochure, and Event Order PDFs — none of those three documents has a "one number that matters" moment the way an invoice does, so this is plausibly correct restraint, not a gap (see §5).

### Neutral

- **Current role, as actually used:** background/structural wash.
- **Current consumers:** Couple Portal chrome (4, minor), Invoice print document (1 — the header band background).
- **Meaningful usage:** real but the thinnest of the four.
- **Important limitation:** absent from every PDF generator, the sign page, and email. Its one clear, confirmed job (a header background) only exists on one document today.

---

## 3. Intended Brand Palette Contract

Derived from the patterns already present in the product, not invented:

> **Primary should mean:** the venue's brand color, present everywhere a client-facing surface needs one color to feel like the venue's own — buttons, headers, borders, the default brand touch.
>
> **Secondary should mean:** a supporting heading and structure color, used on formal printed materials (contracts, brochures, event orders) to organize a document's sections without competing with Primary.
>
> **Accent should mean:** the color that marks the one thing on a page the venue most wants a client to notice — a milestone, an amount due, a highlighted row. Used sparingly and specifically, never as general decoration.
>
> **Neutral should mean:** the background and structural tone behind everything else — page canvas, section fills, header bands — present wherever a document or screen needs a soft background that isn't stark white.

This matches the brief's own example roles closely, but is not accepted uncritically — it is the pattern actually found by reading real, working code across nine distinct surfaces, which is why it can be stated with confidence rather than as a hopeful redesign.

---

## 4. Client-Facing Surface Matrix

| Surface | Primary today | Secondary today | Accent today | Neutral today | Should use palette? | Gap? |
|---|---|---|---|---|---|---|
| Couple / Client Portal | YES | LIMITED | YES | LIMITED | Yes — confirmed working | Secondary/Neutral could extend further, not urgent (P2) |
| Hosted Wedding Website | NO | NO | NO | NO | **Not applicable** — deliberately couple-owned palette (`couple_websites`), not venue's | None — correct as designed |
| RSVP experience | NO | NO | NO (uses couple's own accent) | NO | **Not applicable**, same reason as above | None — correct as designed |
| Client-facing questionnaires (public) | YES | NO | NO | NO | Yes, Primary is sufficient for a short form | None |
| Public inquiry form | YES | NO | NO | NO | Yes, Primary is sufficient | None |
| Conversations / client messages (email) | YES | NO | NO | NO | Yes, Primary is the email ceiling — see §2 | Channel limitation, not a bug (P3) |
| Contract-invite / team-invite / other transactional email | YES | NO | NO | NO | Same as above | Same as above |
| Contract (sign page) | YES | NO | YES | NO | Yes — Primary + Accent already coherent | None found |
| Contract PDF | YES | YES | NO | NO | Yes — Primary + Secondary already coherent for a formal document | None — Accent/Neutral appropriately absent |
| Brochure PDF | YES | YES | NO | NO | Yes, same pattern as Contract | None |
| Event Order / BEO PDF | YES | YES | NO | NO | Yes, same pattern | None |
| Invoice (print document) | YES | NO | YES | YES | Yes — Primary + Accent + Neutral already coherent | Secondary appropriately absent (no "supporting heading" need on an invoice) |
| Day Sheet (print document) | YES | NO | YES | NO | Yes, Primary + Accent already coherent | None |
| Public Brochure page (web) | YES | NO | NO | NO | Yes, Primary sufficient | None |

**Reading the matrix as a whole:** every "NO" in this table that isn't Hosted Experience/RSVP is a color that was never wired for that surface *because that surface never had a design reason to need it* — not because it was forgotten. This audit did not find a single surface where a color is missing for a reason the surface's own content would actually benefit from. That is the central, evidence-based finding of this document.

---

## 5. Current vs. Intended

| Surface | Current behavior | Intended behavior | Gap | Severity |
|---|---|---|---|---|
| Setup screen copy | Claims colors are "displayed throughout your workspace" | Should describe the actual, intended client-facing scope | **Real gap — copy, not code** | **P1** |
| Email (all types) | Primary only, architecturally fixed | Acceptable as a permanent, disclosed limitation | Not a functional gap; an honesty gap if setup copy implies otherwise | P2 (copy), not a product defect |
| Portal Secondary/Neutral reach | Minor, chrome-only | Could extend to a section heading or two, matching the PDF pattern | Real but small | P2 |
| Contract PDF branding freeze | **No snapshot mechanism found** — contract PDFs always render live venue colors | Invoices already snapshot color at send time (`invoice.brandingSnapshot`, confirmed in code, with a documented, intentional no-silent-backfill fallback) | Contracts lack the same freeze Invoices have | **P1 — a real, confirmed architectural inconsistency, not a copy issue** |
| Venue's own internal workspace | Not branded | Correctly not branded, per the venue-runs-the-business / brand-runs-the-client-experience principle | None | Intentional, no action |
| Hosted Experience / RSVP | Uses couple's own palette | Correct, confirmed intentional | None | Intentional, no action |

---

## 6. Setup Experience

**What is inaccurate today:** the phrase *"displayed throughout your workspace"* — "workspace" reads, to a venue owner, as the screens they themselves use daily, which these colors do not touch, by design.

**What the venue should actually be told:** that these colors shape what their *clients* see — the portal their couples log into, the contract they sign, the invoices and other documents they receive — not the venue's own day-to-day screens.

**Should the four colors have short explanatory labels?** The four hints already present (*"Main brand color — buttons, headers, accents," "Supports the primary — sidebar, badges,"* etc.) are individually reasonable but inherit the same "workspace" framing problem at the section level; fixing the one section-level sentence goes further than rewriting all four hints. The Secondary hint's specific claim ("sidebar, badges") is the one individual hint worth revisiting on its own merits, since "sidebar" most naturally reads as the venue's own sidebar, which it is not.

**Would a small visual preview be valuable?** One already exists (a swatch row plus a mock button/badge, confirmed live) — it is honest about the *colors* but silent about *where* they'll be seen; it does not show a couple-facing surface, which is the missing piece, not a missing feature.

**Would a simple "Where your brand appears" explanation be useful?** Yes — this is the smallest, most direct fix available, and it is the same fix already recommended (at the single-sentence level) in this engagement's own prior New Venue Morning prioritization pass. This document confirms that recommendation is still correct and now grounds it in the full, traced palette contract rather than a general impression.

**Is setup currently setting the right expectation?** No — confirmed, precisely, by the section header's own wording.

**Recommended language (not implemented):** replace *"Primary, secondary, accent, and neutral brand colors displayed throughout your workspace"* with language naming the actual audience — e.g., *"These colors shape what your couples see: their portal, their contract, and the documents and emails you send them."* This is a recommendation for the eventual copy pass, not an instruction executed here.

---

## 7. Product Gaps

Only two, both real, both narrow:

1. **Contract PDFs have no branding-freeze snapshot; Invoices do.** A venue who changes their colors between sending a contract and it being viewed or signed would see the contract shift color, while an equivalent invoice would not. **P1** — a real inconsistency in an otherwise coherent system, worth closing to match the pattern that already exists and already works for Invoices. Not a customer-trust emergency (the color would still be a valid brand color, just possibly not the one shown originally), but a genuine architectural gap.
2. **Email has no path to Secondary/Accent/Neutral at all.** Defensible as a permanent design constraint of the medium, but currently undocumented as a deliberate limitation anywhere a product decision would record it. **P3** — worth a one-line acknowledgment in whatever documents this contract going forward, not an engineering task.

Everything else examined in this audit is either working as intended or is a copy/documentation issue, not a product gap.

---

## 8. Copy / Education Gaps

- **Setup screen's "displayed throughout your workspace" claim** — the primary, highest-value item in this entire document. Fixable with one sentence.
- **Secondary's individual hint ("sidebar, badges")** — worth revisiting alongside the section-level fix, same root cause.
- **No disclosed limitation on email's palette reach** — a venue who notices their branded email only ever shows one color has no explanation available anywhere in the product for why. A short, honest note (in Help & Guides or inline near email-related settings) would close this without any code change.
- **No "where do my colors appear" reference anywhere in Help & Guides** — this engagement's own prior Help & Guides content-priority list already identified this exact topic as P0 content; this document confirms that priority and adds the precise, now-traced detail (Portal, Contract, Invoice, Brochure, Event Order, Day Sheet — not the venue's own workspace, not the Hosted Experience) that article should contain.

---

## 9. What NOT to Change

Stated explicitly, per the audit's own instruction not to reopen settled architecture:

- **The four-color model itself** — Primary/Secondary/Accent/Neutral, as a set, is sound and does not need to become three, five, or a generic token system.
- **The CSS-custom-property injection mechanism** (`--venue-primary` etc., set once at the Portal shell and the Contract sign page) — correct, minimal, and sufficient for every real consumer found.
- **The shared `resolvePdfBrandColors` / `resolvePrintBrandColors` helpers** — genuinely good infrastructure; every PDF and print document already goes through one canonical resolution path with a documented, sensible default fallback. This should be the reuse target for any future collateral, not a pattern to replace.
- **The Hosted Experience / RSVP's separate, couple-owned color system** — confirmed correct and intentional; do not merge it with the venue palette.
- **The venue's own internal workspace remaining Hello to Cheers-branded** — confirmed correct per the stated product principle; this was never a bug and should not become one.
- **Invoice's branding-snapshot-at-send mechanism** — genuinely well-built (real fallback, explicitly documented "no silent backfill" behavior); the recommendation in §7 is to extend this pattern to Contracts, not to change how it already works for Invoices.

---

## 10. Recommended Implementation Sequence

Sequenced by leverage, smallest and highest-confidence first — not prescribing implementation detail, per the audit's own scope:

1. **Setup expectation correction** — the one-sentence section-header fix (§6). Smallest possible change, highest trust impact, no code risk.
2. **Documentation/education** — a short "Where your brand appears" reference, likely as Help & Guides content already prioritized elsewhere in this engagement, reusing the exact surface list in §4.
3. **Foundational consumer correction** — extend Invoice's branding-snapshot pattern to Contracts, closing the one real product inconsistency found (§7.1).
4. **Optional polish** — modestly extending Secondary/Neutral's reach inside the Portal to match the "supporting heading / background" roles they already play elsewhere (§5), and a one-line documented acknowledgment of email's permanent Primary-only ceiling (§7.2).

---

## The One-Sentence Promise

> **"Your colors are what your couples see — on their portal, their contract, and everything you send them — never a color you have to hunt for in your own dashboard."**

This document ends here. No code, schema, copy, or branding behavior was changed in producing it.
