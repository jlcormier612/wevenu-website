# Phase 3 as a Trust Migration — Design and Sequencing Recommendation

**Status: design discussion, no implementation yet.** Seventh document in the series. This reframes Phase 3 around the question you posed — not "can Invoice read from Event Order," but "can we guarantee no coordinator ever sends, edits, or collects against an Invoice that silently differs from what they intended" — and, per your instruction, stops to recommend a sequencing change before writing code, because working through the mechanics changed the shape of the phase.

---

## 1. The mental model that falls out of taking trust seriously

Restating your five constraints as one mechanism, not five separate rules:

- **Event Order is the operational commitment** — already true, unchanged.
- **A Draft Invoice is a *projection*, not a record.** This is the load-bearing idea: while an Invoice is `draft`, it should have **no stored data of its own** for anything sourced from Event Order. It should compute those lines live, every time it's viewed — not sync, not cache, not periodically refresh. A projection that's recomputed on every read cannot go stale, by construction, because there's nothing stored to *be* stale. This is a stronger guarantee than "sync it correctly" — it removes the category of bug entirely.
- **Sending is the commitment moment.** The instant an Invoice is sent, its currently-computed Event-Order-derived lines get copied into real, frozen `invoice_line_items` rows for the first time. Before that instant, there was no copy. After it, there's a permanent one.
- **Once frozen, nothing rewrites it silently.** Event Order keeps changing freely — it's still the operational commitment, still meant to evolve as a booking firms up. But the frozen Invoice doesn't follow it automatically anymore. A detected difference surfaces; it never applies itself.
- **Every mismatch resolution is a human decision, with a full menu of honest options** — not a single "sync" button pretending there's only one right answer.

### Why this is "Copy at Commitment," recognized one layer up

The Event Order documents already established this exact mechanic once: a Package's price is copied into an Event Order line at the moment a coordinator commits to it, never live-referenced afterward. What I hadn't stated explicitly until working through your trust framing is that **the same mechanic recurs at the Invoice boundary** — "commitment" isn't a single event in this system, it's a *recurring transition* that happens wherever a live projection becomes a permanent record. Event Order commits from Package/Inventory at the moment a line is added. Invoice commits from Event Order at the moment it's sent. Same shape, different layer.

**Worth naming as its own principle**: *Copy at Commitment is recursive — it applies at every projection-to-record boundary in this system, not once at the top.* This is genuinely useful going forward: whenever this platform introduces another document that eventually gets "shown to someone real" (a Contract, a printed floor plan, a couple-facing timeline), the same question is worth asking — is there a moment before which it's a live projection, and after which it's a frozen record? If so, the Invoice/Event Order mechanic is the template, not a one-off.

---

## 2. The resolution model — working out what "calm, not scary" actually requires

Your four actions aren't just copy — each one implies something structural. Working through them in order of increasing risk:

### Review Changes — lowest risk, purely informational
A structured diff between what's frozen on the Invoice and what Event Order currently says: lines added, lines removed, and lines whose quantity/price/description changed. This is answerable directly by comparing the Invoice's frozen lines (each tagged with which Event Order line it came from) against Event Order's current lines, matched by that same tag. No mutation, no risk — this is the "surfaces clearly" half of your trust question, on its own, before anything about *acting* on the difference.

### Leave As Is — low risk, but needs one real decision recorded
This can't just be "make the banner go away" — that would mean a coordinator could dismiss it once and never be told again, which quietly reintroduces the exact silent-drift problem this whole phase exists to prevent. The calm, correct version: dismissing records *which* Event Order state was acknowledged. If Event Order changes again after that, it's a new, unacknowledged difference — the banner returns. If it doesn't change again, staying quiet is correct, not silent (the coordinator already looked and chose this). This is the same shape as a code-review tool dismissing a stale review only until the next real change — which is exactly the GitHub feeling you described, and I think it's worth naming as its own small principle: *dismissal is scoped to what was reviewed, not permanent.* It'll recur — Phase 4's Floor Plan/Event Order reconciliation banner should almost certainly work the same way once it's built.

### Update Draft Invoice — real risk, needs a real guardrail
Read literally, this reopens the *same* sent invoice, resyncs its lines to Event Order's current state, and returns it to `draft` for the coordinator to review and resend. This is exactly right when nothing has been paid yet — a couple saw a number, it wasn't final, correcting the same invoice is honest and simple. It becomes exactly the danger this whole effort exists to prevent the moment *any* payment has already been recorded against it — retroactively changing figures money has already moved against is the TR-M2 failure shape, just triggered from a new direction. **This action should be unavailable — not just discouraged, structurally disabled — the moment `balanceDue < total` on that invoice.** Once that's true, only the next option is offered.

### Create Amended Invoice — highest risk, and the one open question I haven't resolved
This creates a new Invoice, linked back to the one it amends, carrying the *current* Event Order state — the original stays exactly as it was, sent or paid, an untouched historical record. This is unambiguously the right shape once money has moved. But it raises a real question I don't think I should guess at: **what happens to a Payment Plan already linked to the original invoice?** Decision 5 already established Payment Plan always derives its total from its one Invoice — if a new Invoice supersedes the old one, does the existing Payment Plan's remaining installments need to be re-anchored to the new total (crediting whatever was already collected), or does a fresh Payment Plan get created against the amended invoice while the old one closes out at whatever it collected? Both are defensible; I'd want your read before building either, since it's a real product decision about what a venue owner would expect to see, not something the architecture alone answers.

---

## 3. The sequencing recommendation

This is the "stop and recommend" moment. Having worked through the above, I don't think Phase 3 as originally scoped in the roadmap is the right shape to build in one pass anymore — not because the destination changed, but because the risk profile inside it is uneven, and bundling it hides that.

**I'm recommending Phase 3 split into three sub-phases, each independently shippable and independently safe:**

- **Phase 3a — Draft as a live projection.** Add `invoices.event_order_id` and `invoice_line_items.event_order_line_id` (both nullable, additive). A Draft Invoice linked to an Event Order computes its Event-Order-sourced lines live on every read — no stored sync, no risk of staleness, because nothing is stored yet. Zero resolution UX needed, because there's nothing to resolve until something's been frozen. This alone is real, valuable, and fully testable in isolation.
- **Phase 3b — The freeze, detection, and the calm, non-mutating half of the banner.** On send, materialize the current Event-Order lines into real, frozen, tagged `invoice_line_items`. Detect drift by comparing that frozen state against Event Order's current state. Ship the calm banner with **Review Changes** and **Leave As Is** only. This delivers the entire "surfaces clearly, never silently" half of your trust question, fully, before touching the harder half.
- **Phase 3c — The two mutating resolutions.** **Update Draft Invoice** (with the payment-guardrail above) and **Create Amended Invoice** (once we've agreed on the Payment Plan question above). This is where the real risk concentrates, and it deserves to be reviewed and tested on its own, not folded into the same pass as 3a/3b's lower-risk work.

Each sub-phase leaves the platform fully functional on its own — 3a is invisible to anyone not linking an invoice to an Event Order; 3b adds a banner nobody sees until 3a-linked invoices exist and drift; 3c adds two buttons to that banner. Nothing in this split requires guessing ahead at what a later sub-phase will need.

---

## 3a. Decided — sequencing, banner, and Payment Plans

The three open questions from §4 (below, kept for the record) are resolved:

**The split is confirmed.** 3a ships alone first: no sync, no stored duplicate data, no "Update" button — a Draft Invoice answers exactly one question, "what would we invoice if we sent it right now," computed live. Nothing about 3b or 3c needs to be guessed at to build this correctly.

**The 3b banner ships with two actions, not four**: *Review Changes* and *Dismiss for now*. Not "Update," not "Replace," not "Amend, Not Yet" — the point is that a coordinator's first reaction to drift should be *recognition*, not a decision under pressure. The banner's copy:

> Event Order changed after this invoice was sent.
> The invoice still reflects what was originally sent.
> Review the changes before deciding whether to send an updated invoice.

`Review Changes` / `Dismiss for now`. The two mutating actions arrive in 3c as genuinely additive, once the trust experience is already proven — not because they're less important, but because introducing all four at once would make the first thing a coordinator ever sees from this system a decision menu instead of a fact.

**Payment Plans never move automatically — full stop, not just "guard the risky path."** I'd originally framed the open question as "how does an existing Payment Plan's total get carried forward when an Invoice is amended" — that framing was already wrong. A Payment Plan is a specific agreement with a specific client — a deposit, a second payment, a final payment, each a promise about *when* and *how much*. Nothing about Event Order or Invoice changing gets to silently renegotiate that agreement, ever, for any reason, including a reason that seems obviously correct to the system.

Instead, a Payment Plan gets its own small status, independent of whether its Invoice has drifted:

- 🟢 **Current** — its total still matches its Invoice's total.
- 🟡 **Needs Review** — its Invoice's total has changed since this Payment Plan was created or last confirmed. Nothing about the schedule itself changes — same installments, same amounts, same dates — only a visible flag appears.

Resolving "Needs Review" is always a human choice, never a default path: keep the existing schedule exactly as it is, regenerate it from the new total, add one additional installment for the difference, or collect the balance manually outside the schedule entirely. The system's job is to make the mismatch impossible to miss and to make every option easy to take — never to pick one on the coordinator's behalf. This resolves the open Payment-Plan question from §2 by rejecting the premise that carry-forward should be automatic in either direction.

## The principle underneath all of this

Across Catalog vs. Commitment, Copy at Commitment (and its recursive form), and Grouping is disposable but commitments are not, one sentence turns out to explain all four:

> **Never silently change an agreement.**

Once two humans have agreed on something — a price, a schedule, a date, a promise — the system's job changes completely. It can recommend, warn, compare, highlight, and prepare. It cannot quietly rewrite what was agreed. This isn't specific to Invoices or Event Order — it's the same reason a signed Contract is immutable, the same reason a sent Message is frozen at send time, the same reason `markLineItemPaid` can't be silently overwritten, and now the same reason a Payment Plan gets a status flag instead of a silent update. Every one of the more specific principles this series has named is really this one rule, applied at a different layer of the system. Worth treating as a defining characteristic of the platform going forward, not just a rule for this feature.

## 4. Where this landed (original open questions, kept for the record)

All three questions this section originally asked are answered in §3a above: the split is confirmed, the 3b banner ships with two actions, and Payment Plans never move automatically — they get a status instead. The "Update Draft Invoice" copy question is moot for now, since that action no longer ships in 3b; it'll be worth revisiting when 3c actually builds it.

Phase 3a is in progress as of this update.
