# Shared Template Architecture

**Status: Approved. No implementation yet.** Written in response to an explicit instruction to define one shared template mental model across Planning, Timeline, and Communication before building Timeline Templates — so Timeline doesn't become a fourth independent implementation of a concept the product already has three variations of (Planning's `daysOffset`, Timeline's `minutesOffset`, Communication's `offsetDays`, discovered during the Timeline Dependency Review).

**Revised** with two product decisions made at approval time: the shared **framework** (the nine questions/answers below) applies uniformly, but the **workflow** each template type actually exposes does not have to — §7 and §2 are updated accordingly, marked Decided. Nothing else below changed.

**This does not mean one database table.** It means one set of answers, asked the same way, of every template type the product has — Planning Templates, Timeline Templates (not yet built to this bar), and Message Templates/Automations. Where a domain's actual content differs, that's named explicitly; where it doesn't need to differ and currently does anyway, that's named too.

**Framework vs. workflow — the operating principle for everything below:** "one shared model" means every template type answers the same nine questions the same way, structurally. It does not mean every template type's UI has to look or behave identically, or that every capability the framework makes possible has to be switched on everywhere. Whether a given template type exposes a particular import path, a particular tag, or a particular option is a per-domain workflow decision, made on demonstrated need — not an automatic consequence of the framework supporting it.

**Out of scope, on purpose:** Timeline's collaboration model, visibility/audience behavior, guest-facing publishing, and Planning-integration ideas shared alongside this request are real and understood, but they describe how an *applied, live* Timeline behaves — not the template it was built from. They belong in a future Timeline product design document, not this one. Nothing below addresses them.

---

## The three template families, as they exist today

- **Planning Templates** — venue-owned, editable, apply to a Booking's Planning as Tasks. The most mature of the three; most of the shared model below already describes Planning's real behavior.
- **Timeline Templates** — four names, hardcoded into the application itself. Not venue-owned, not editable, not duplicable, not versioned — a static list, not really a template system in the same sense as the other two.
- **Message Templates / Automations** — venue-owned, editable, apply as an Automation's steps (each step referencing a Message Template plus a delay). Second-most mature; built this session with Planning's pattern as the explicit model.

---

## 1. What is this template?

**Shared answer:** A Template is a named, reusable definition a venue builds once and applies repeatedly to something Booking-specific. It is never itself "live" — applying it *copies* its content into a real, instance-specific thing (Tasks on a Booking's Planning; Entries on a Booking's Timeline; scheduled steps on an Automation's enrollment). Editing the template afterward never reaches back and changes something already applied — this snapshot behavior already holds for Planning and for Communication's Automations, and should hold identically for Timeline.

Structurally, every template has the same shape: a **Name**, a **Category** (a venue-facing organizing label — Planning already has one, Message Templates already have one, Timeline has none today), and an ordered list of **Items**.

**Where the domains genuinely differ:** what an Item *is*. A Planning Item is inline content (a task's title and description). A Timeline Item, by the product vision shared alongside this request, is also inline content (a schedule entry's title/time). A Communication Item is not inline content — it's a *reference* to a separate Message Template, plus a delay. This asymmetry is real and doesn't break the shared model (the nine questions below still apply the same way to the template wrapper itself), but it's worth naming plainly so Timeline Templates make a deliberate choice rather than an accidental one about whether an Item is content or a reference.

---

## 2. What event types is it for?

**Shared answer:** A Template can optionally target one or more Event Types (Wedding, Micro Wedding, Corporate Dinner, Fundraiser, Conference, Holiday Party). A Template with no Event Type set is general-purpose — usable for any event, the same way an untagged Planning Template works today.

**Space tagging — Decided, scoped to Timeline only.** The Timeline vision shared alongside this request adds a second, independent tag — **Space** (Grand Ballroom, Garden, Barn, Rooftop, Tent) — so a venue can have a "Wedding + Grand Ballroom" template distinct from a "Wedding + Garden" template, or a template that only cares about one axis. This was originally flagged as a candidate shared capability across all three domains; that's now decided against. Space stays Timeline-specific until Planning or Communication demonstrate a real need for it — not generalized into the shared framework preemptively. If that need shows up later, it's a small extension to add then; it isn't free to guess wrong about now.

---

## 3. Is it a default or venue-created template?

**Shared answer:** Two kinds of template exist in every domain: Wevenu-provided starting points (not venue-specific, a gallery to begin from) and venue-created templates (the venue's own, always editable). Within a venue's own templates for a given Event Type (and Space, if used), exactly one can be marked the **default** — the one Booking Creation applies automatically with no coordinator action, per the mechanism `docs/booking-workspace-design.md` §1.2 already designed for Planning and Timeline alike (`isDefault` + Event Type matching). This is already real for Planning. It should be the identical mechanism for Timeline once Timeline Templates exist, and the same mechanism for Communication's Automations wherever a default Automation makes sense to auto-start.

---

## 4. How is it applied?

**Shared answer:** One interaction pattern — a slide-in template picker, cards, preview before applying, one click to apply, everything editable afterward. This pattern already exists and has already been reused twice (Timeline's own picker was the original; Planning's Playbook Builder reused it) — the interaction itself doesn't need inventing a third time, only extending to cover a real, venue-owned Timeline Template instead of the hardcoded list it applies from today.

Applying always means the same thing regardless of domain: materialize the template's Items into real, instance-specific content, right now, as a snapshot — not a live link back to the template.

---

## 5. How are relative dates/times calculated?

This is the one where "same mental model, not same code" matters most, and where the product vision shared alongside this request gives the actual shared concept: every template Item has a **Reference Point** and a **Relative Offset** — not three separately-named offset fields meaning the same thing.

**Reference Point** is one of two kinds:
- A fixed anchor external to the template — the event date, the event's start time, the moment of enrollment/booking.
- **Another Item in the same template** — "2 hours before ceremony," "30 minutes after cocktail hour," a Planning task relative to another Planning task, an Automation step relative to the previous step.

**Relative Offset** is a signed duration from that Reference Point. The *unit* of that duration is a per-domain choice, not a violation of the shared model — Planning naturally works in days, Timeline naturally works in minutes/hours, Communication naturally works in days (with room for finer units later). Unifying the concept doesn't mean forcing everything into one unit; it means every domain answers "relative to what, and by how much" the same way, instead of three domains each inventing their own notion of "relative to what" independently.

**What this changes, concretely, per domain:**
- **Communication already has half of this.** An Automation step's delay is already relative to the previous step (or to enrollment, for the first step) — that's already "Reference Point = another Item," the harder half of this model, already built.
- **Planning does not have this today.** A Planning task's timing is only ever relative to the event date — there's no way for a task to be relative to another task. Adopting this shared model is new capability for Planning, not a renaming.
- **Timeline does not have this today either**, for the same reason — `minutesOffset` is only relative to event start. The product vision's "2 hours before ceremony" requires Reference Point to be able to name another Timeline Item, which doesn't exist yet.

---

## 6. Can the venue duplicate it?

**Shared answer:** Yes, uniformly, as a standard action on every template — venue-created or Wevenu-provided starter alike. Duplicating produces an independent copy the venue can then customize freely without touching the original. This is the direct answer to the venue's own "Wedding + Grand Ballroom becomes Wedding + Garden" scenario: duplicate, then change the Space tag and adjust the items that differ.

---

## 7. Can the venue import an existing version?

**Shared answer:** Yes — the gap already named this session for Message Templates ("upload my existing checklist" got built as "AI import," and those aren't the same request) is real, and the fix is shared: a real menu of starting points, not a single path forced through AI. That much applies everywhere.

**Decided: which specific paths a template type offers is a per-domain workflow choice, not a uniform mandate.** The framework should make every one of these available as a capability:

- Start from scratch
- Duplicate an existing template
- Upload (Word/PDF)
- Paste an existing version
- Import from Google Docs

But a given template type should present only the subset that actually makes sense for what it holds — not force all five into every "New Template" flow just because the framework supports them. A Planning checklist and a Google Doc are an obvious match; a Timeline's minute-by-minute schedule may not be. Which paths each domain actually exposes is named when that domain's workflow gets designed, not decided in the abstract here.

AI-assisted parsing (Luv proposing structured content from whatever was pasted/uploaded, for the venue to review before saving) is one *implementation* of the Upload/Paste paths, wherever a domain offers them — not a replacement for offering the plain paste/upload choice as the obvious, first thing a venue sees when it does.

---

## 8. Can the venue edit it?

**Shared answer:** Yes, always, for anything in the venue's own template library. Wevenu-provided starter templates are not edited in place — a venue duplicates one first, then edits the copy. This protects what "the default Wevenu Wedding template" means for every venue, and matches how a shared starting gallery has to work everywhere, not just in one domain.

Timeline is the one domain where this isn't true today — its four templates aren't editable at all, by anyone, which is the core gap this whole document exists to close before Timeline Templates get built for real.

---

## 9. How are updates/versioning handled?

**Shared answer, and it's the same unresolved gap in every domain:** applying a template is a snapshot, never a live reference — so editing a template later never silently changes a Booking that already applied it. That part already works, everywhere, by construction. What doesn't exist anywhere yet is **version awareness** — knowing which version of a template a given Booking's Planning, Timeline, or Automation came from, or offering to sync newer template changes into something already applied. This was already logged as its own backlog item for Planning specifically ("Planning Template Versioning"). Under this shared model, it's the same open question for all three domains, not three separate ones — worth designing once, together, whenever it's picked up, rather than solving it for Planning and then rediscovering the identical problem for Timeline and Communication later.

---

## What this changes, concretely

Adopting this model, before Timeline Templates get built, means:

- Timeline Templates need to be real — venue-owned, editable, duplicable, default-markable — not a fourth hardcoded list.
- Timeline (and Planning) need Reference Point to be able to name another Item in the same template, not only the event date/start time — Communication already proves this pattern works.
- Space tagging ships for Timeline only. Planning and Communication don't gain it in this pass, and shouldn't until a real need shows up for either.
- Every "New Template" flow gets to draw from the same five-option capability palette, but each domain picks only the options relevant to what it holds — Message Templates' existing flow (which currently skips straight to AI import) still needs fixing, but not into a mandatory five-option menu identical to every other domain's.
- Template versioning stays an explicitly open question everywhere, tracked as one problem, not rediscovered three times.

Nothing above is implemented. Timeline Templates remain unbuilt until this is approved — and the Timeline product vision (collaboration, visibility, guest publishing, Planning integration) remains a separate, not-yet-requested document.
