# Post-contract collaborative selections — UX + architecture decision

**IMPLEMENTATION STATUS: NOT READY**  
**Mode:** Architecture + UX/product design only. No code, migrations, schema, deploy, commit, Sandbox/Production changes.

**Inputs:**  
- `docs/qa/post-contract-selections-commercial-audit/AUDIT.md` (read in full)  
- Live UX/code evidence: Booking Details (`commercial-facts.tsx`), booking journey model, Event Order panel + invoice link, portal Event Order (read-only), Questionnaire lifecycle, portal Next Steps / Documents patterns  

---

## 0. Locked principle (restated)

```
TEMPLATE / LIBRARY
  → CUSTOMER-SPECIFIC WORKING ASSET   ← collaborative; NOT financial SoT
  → COLLABORATION (venue ↔ client)
  → VENUE FINALIZE
  → FINALIZED COMMERCIAL / OPERATIONAL RECORD  ← Event Order (extended)
  → EXISTING invoice freeze / amend + payment-plan review
  → Permanent visibility in venue + client portals
```

Do **not** invent a second invoice, payment plan, or financial ledger.

---

## 1. Why the existing booking workflow is teachable

### Where the venue starts

On the **lead/client Booking Journey** surface (“Booking Details / What they booked”), not buried in Settings.

Primary CTAs are plain English:

- **Create proposal** — “Let the couple choose”  
- **Select package** — “Choose the package now”

### What they create

| Path | Object | Customer sees |
|---|---|---|
| Path A | L1 `commercial_proposals` + options | `/offer/{token}` multi-option choose |
| Path B | L2 `commercial_selections` | `/offer/{token}` single Accept |

### Mental model the venue learns once

| Step | Meaning |
|---|---|
| Library (Packages) | Reusable catalog |
| Proposal / Selected package | Customer-specific commercial offer |
| Send / share link | Client action required |
| Accept | Client commitment moment |
| Contract | Legal agreement (immutable when FE) |
| Set up payments | Money from the frozen commercial snapshot |
| Portal | Client lives with the outcome |

### What becomes immutable / where it lives

- L2 snapshot freezes package name/price/items (catalog edits don’t rewrite it).  
- Contract FE does not mutate.  
- Invoice + payment schedule carry money.  
- Next step is always surfaced as a **named CTA** on the same Booking Details card (“Create share link”, “Create contract”, “Set up payments”).

**Why it works:** One card, sequential CTAs, one frozen commercial snapshot, money after commitment — not a freeform invoice editor as the starting point.

---

## 2. What Event Order is today (forensic answer)

**Verdict: C — both, with a hard authorship constraint.**

| Aspect | Evidence |
|---|---|
| **Venue-authored operational document** | `document-integration.ts`: behavior `venue_authored`; “no client editing, no signature.” Panel CTAs: Apply template, edit lines, **Share with Client**, **Finalize**, **Reopen for Editing**. |
| **Finalized commercial/operational record** | One EO per Event; lines carry priced commitments; draft invoice **projects** EO; send **freezes** EO lines onto invoice; drift/amend when EO changes after send. UI copy: “Event Order is not an invoice… Amount due lives on Invoice.” |
| **Portal** | Read-only “What you’re receiving” from last share snapshot — not a picker. |

So Event Order is already the right **finalized delivery SoT** after booking. It is **not** the right place to put collaborative client picking. Making EO itself collaborative would destroy the clear “venue authored delivery list / invoice projects from it” teaching.

**EO vs L2 package (already in UI):** Event Order panel can show “Package context: X (commercial purchase — not this Event Order)” — the product already teaches two layers.

---

## 3. User mental model — recommendation

### Yes: intentional facsimile of booking, not identity of objects

| Booking (already learned) | Post-contract Choices (parallel) |
|---|---|
| Package library | Choices template library (menus, bar, rentals…) |
| Create proposal / Select package | **Create Choices** for this event (from template) |
| Send share link | **Send to client** |
| Client Accept / choose | Client **Submit choices** |
| (Contract) | *(no new contract — see §9)* |
| Frozen L2 | **Venue Finalize** → writes into **Event Order** |
| Invoice / payment plan | Existing invoice amend + payment-plan review |

### Where they should resemble each other

1. Library → instance for this customer/event  
2. Send → client action → venue review → finalize  
3. Freeze at finalize; later changes are explicit revisions/amendments  
4. Money is a **consequence**, not the working surface  
5. Client sees progress in Next Steps + a permanent record later  

### Where they must differ (do not pretend sameness)

| Booking | Choices |
|---|---|
| Creates initial commercial commitment (L2) | Updates post-booking **delivery** record (Event Order) |
| Often precedes / feeds Contract | Must **not** rewrite FE Contract |
| One primary package commitment | Many topic-scoped choice sets (dinner, bar, linens…) |
| Accept ≈ commercial yes | Submit ≠ money; **Finalize** = venue commits operationally/financially |

**Do not** reuse L1/L2 proposal objects for this — vocabulary collision (“proposal”, “accept”) and wrong SoT (booking package vs delivery lines).

---

## 4. Where it lives in the product

### Venue: natural start

**Event workspace → Event Order area**, as a sibling card/section:

**“Client Choices”** with CTA **Create Choices** / **Send dinner choices**

Why:

- Post-contract work is **event-scoped** (same atomic unit as Event Order).  
- Staff already go here for “what are we delivering?”  
- Adjacent to Finalize / Share / Invoice link — financial consequences stay visible.  
- Booking Details stays about **package/contract/booking**; don’t overload it with menu pickers.

**Not** primary: Documents library alone, Inventory catalog, Offerings catalog (those are libraries), Calendar, generic Tasks list without event context.

Secondary: Client workspace can deep-link “Open event → Choices” for discoverability.

### Client: natural complete

1. **Your Next Steps** task: “Complete dinner choices” → dedicated portal section  
2. Portal nav item while active (same pattern as Questionnaire / Event Order)  
3. After finalize: permanent under **Documents** (and still summarized on Event Order / Payments if $ changed)

Client should **not** hunt inside Venue Guide or Messages for the only entry.

---

## 5. The working asset — recommendation

### User-facing name

**Choices** (venue: “Client Choices”; client: “Your Choices”)

Avoid: Selection Document, Change Order (legal-ish), Order (collides with Event Order), Add-On (only covers paid extras).

Optional topic subtitle: “Dinner Choices”, “Bar Choices” — instances of the same object type.

### Object shape (conceptual — not schema)

Hybrid of **guided form + commercial proposal**, not a freeform document editor:

- Created from a **Choices template** (library)  
- Bound to **event** (+ client via event)  
- Sections of choice groups: single-select / multi-select / quantity / optional notes  
- Each option references an **Offering** (preferred) and/or inventory-linked offering; carries `included` vs `additional` price snapshot at send time  
- Status + who-must-act  
- Activity/audit of venue vs client edits  
- Version: current working vs finalized snapshot id  

Closest existing **lifecycle** precedent: **Questionnaire** (sent → in progress → submitted → changes requested → complete).  
Closest existing **commercial freeze** precedent: **L2 / Event Order copy-at-commitment**.  
Closest existing **final delivery SoT**: **Event Order**.

---

## 6. End-to-end workflow (recommended)

```
VENUE                          CLIENT                         SYSTEM
─────                          ──────                         ──────
Create Choices from template
Customize for event
Send to client ─────────────→  Next Steps: Complete Choices
                               Make choices / quantities
                               Submit ─────────────────────→  status: Needs venue review
Review
  ├─ Request changes ────────→ Editable again
  └─ Finalize ────────────────────────────────────────────→ Apply to Event Order
                                                            Price delta?
                                                              no  → EO lines only
                                                              yes → EO + invoice amend
                                                                    + payment-plan review
Share / refresh Event Order ←─────────────────────────────  Portal: Event Order + Docs
                                                            + Payments if owed
```

Evaluated against the “example flow” in the brief: **yes, with three corrections:**

1. Finalize is **venue-only** (client Submit ≠ Finalize).  
2. Destination of finalize is **Event Order**, not a parallel commercial table for money.  
3. Documents hold the **frozen Choices PDF/snapshot**; Event Order holds **live delivery lines**.

---

## 7. Finalization boundary (unambiguous)

| Concept | Definition |
|---|---|
| **Submit** | Client says “I’m done for now.” Locks client edits; venue must act. **Not** financial. |
| **Request changes** | Venue unlocks client edits; prior submission kept in history. |
| **Finalize** | **Venue-only.** Working Choices stop being negotiable. Options are copied onto **Event Order lines** (and inventory allocations where applicable). Price-bearing deltas enter existing invoice/payment machinery. |
| **Who finalizes** | Venue staff with event-edit permission. Never the client. |
| **Immutable after Finalize** | That Choices version’s answers + price snapshots. EO lines from that finalize are normal EO lines (EO can still Reopen — see revisions). |
| **Post-finalize change** | Start **Choices revision** (new version) or venue edits EO directly for ops-only fixes. Revision → Submit → Finalize again → EO update → invoice amend if $. |
| **Authoritative for “what client chose”** | Latest **Finalized Choices** version. |
| **Authoritative for “what we’re delivering / may bill”** | **Event Order** (after apply) + **Invoice** for money owed. |

Avoid status soup that mixes client and venue without a “who acts next” answer.

---

## 8. Financial examples (using existing architecture)

### A — Included choice (Chicken → Salmon, $0)

- Finalize writes/updates EO line(s) as **included**, `$0` or package-covered.  
- **No** invoice amendment if totals unchanged.  
- Client sees choice on finalized Choices + Event Order.  
- No payment-plan noise.

### B — Add-on Late Night Snack $750

On Finalize:

1. EO gains priced offering line `$750`.  
2. If no sent invoice linked / only draft projecting EO → draft total grows (projection).  
3. If invoice already **sent** → **invoice amendment** (existing `amends_invoice_id` path) or reopen+drift → amend — **reuse existing**, don’t invent.  
4. Payment plan **Needs review** / regenerate remaining (existing).  
5. Venue may **Request payment** for new obligation (existing).  
6. Client: Payments shows new amount due; Docs shows finalized Choices; Event Order shows snack.

### C — Multiple add-ons $1,650

Same as B with multiple EO lines → one invoice amendment totaling +$1,650 (or draft projection if unsent) → one payment-plan review.

### D — Remove Premium Bar $1,500 after finalize

- New Choices revision or venue EO reopen removing line.  
- Invoice amendment reducing commitment.  
- If already **paid**: credit / refund via existing payment refund paths — **not** silent deletion of history.  
- Historical finalized Choices versions + prior invoice remain in audit trail.

### E — Price-neutral change

- EO description/offering identity updates.  
- Explicit rule: **skip invoice amendment when net invoice total unchanged** (avoid financial noise). Still record Choices version + EO activity.

---

## 9. Contract relationship

| Record | Role |
|---|---|
| **Fully executed Contract** | Original legal agreement — **immutable**; never rewritten by Choices |
| **Finalized Choices** | Subsequent operational/commercial decisions |
| **Event Order** | Delivery list derived from package + Choices (+ venue lines) |
| **Invoice / Payment plan** | Money owed |

Legal amendment remains the **explicit contract amendment** workflow. Choices must never imply “your contract now includes X” without that path.

Client copy: “Your contract stays as signed. These Choices update what we’ll deliver (and any new charges on your invoice).”

---

## 10. Portal experience

### Venue

| Location | Content |
|---|---|
| Event → **Client Choices** | Working + finalized versions, status, CTAs |
| Event → **Event Order** | Delivery lines after finalize; invoice link |
| Invoice / Payments | Financial consequences |
| Client Documents | Finalized Choices artifact(s) |

### Client

| Location | Content |
|---|---|
| **Your Next Steps** | Active: Complete / Revise Choices |
| Portal section **Your Choices** (while active or recent) | Form + status |
| **Event Order** | What you’re receiving (after share) |
| **Payments** | New amounts if any |
| **Documents** | Finalized Choices PDF/snapshot (permanent home) |

Documents alone is insufficient as the *only* active workspace; it is the right **permanent** home after finalize (same pattern as signed contracts / shared EO PDFs).

---

## 11. Minimum status model

Answer “Who acts next?” only:

| Status | Who acts |
|---|---|
| **Draft** | Venue |
| **Sent** | Client |
| **In progress** | Client (optional; can collapse into Sent) |
| **Submitted** | Venue |
| **Changes requested** | Client |
| **Finalized** | Nobody (terminal for this version) |

Optional collapsed set if we must go smaller: `Draft → Sent → Submitted → Changes requested → Finalized` (drop In progress).

Do **not** add “Ready to finalize” as separate if Submitted already means venue can Finalize.

---

## 12. Notifications / tasks (not calendar)

| Event | Mechanism |
|---|---|
| Sent | Client Next Steps task + notification |
| Incomplete / due soon | Reminder notification + task stays open (**not** calendar spam) |
| Submitted | Venue task/notification “Review choices” |
| Changes requested | Client task reopen |
| Finalized | Client notification; complete task; if $ → venue payment-plan review task / invoice attention |
| Financial attention | Existing payment-plan “needs review” / request payment |

---

## 13. Templates

| In library (Choices template) | In client instance |
|---|---|
| Sections, option lists, required/optional, included vs add-on flags | Selected answers, quantities, notes |
| Default offering links + suggested prices | **Price snapshots at Send** |
| Instructions / venue guidance | Event/client binding, status, versions |
| Reusable names: “Wedding Dinner”, “Bar Package”, “Linen Upgrade” | “Dinner Choices — Maya / Apr 18, 2032” |

Catalog (Offerings/Inventory) remains library; template references catalog ids; instance freezes display + price at send/finalize.

---

## 14. Inventory discipline (do not collapse)

| Stage | Authoritative state |
|---|---|
| Catalog | `inventory_items` / `offerings` |
| Template option | Points at offering (and optional inventory) |
| Client working Choices | Selected option ids + qty (not stock decrement yet) |
| Finalize | Event Order line (+ optional Event Inventory allocation) |
| Stock enforcement | Existing Event Inventory / floor-plan rules — improve later; don’t invent parallel stock ledger in Choices |
| Money | Invoice lines from EO freeze/amend only |

---

## 15. Naming (one vocabulary)

| Surface | Term |
|---|---|
| Venue UI, tasks, help | **Client Choices** |
| Client UI, notifications | **Your Choices** |
| Document title | “Dinner Choices — Finalized” / topic name |
| Event Order | Keep **Event Order** (“What you’re receiving”) |
| Never call Choices “Event Order” or “Invoice” or “Contract” |

Same concept name everywhere; topic adjective varies.

---

## 16. UX wireframe (words)

### Venue

1. Open **Event** for booked client.  
2. See **Event Order** card + new **Client Choices** card.  
3. CTA **Create Choices** → pick template “Wedding Dinner”.  
4. Customize options/prices → **Send to client**.  
5. Status **Sent**; task created for client.  
6. When **Submitted**: banner “Review dinner choices” → open review UI (answers + running total of add-ons).  
7. **Request changes** (note) or **Finalize**.  
8. On Finalize: toast “Event Order updated” + if $ “Invoice needs review” / link to invoice.  
9. Documents show finalized PDF; Event Order shows lines.

### Client

1. Home **Your Next Steps**: “Complete dinner choices”.  
2. Opens **Your Choices** form (clear included vs “+$750”).  
3. Select / qty / notes → **Save** (in progress) / **Submit**.  
4. Submit copy: “Your venue will review. This doesn’t charge your card by itself.”  
5. If changes requested: banner + edit again.  
6. After finalize: Next Steps clears; **Documents** + **Event Order** + maybe **Payments**.

### After finalization

- Venue: Choices Finalized + EO lines + invoice/payment attention if needed.  
- Client: read-only finalized Choices + updated receiving list + any new balance.

---

## 17. Reuse matrix

| Existing object | Classification |
|---|---|
| Packages | **Reference only** (booking commitment; may seed included options) |
| L1 Proposal | **Do not use** for post-contract Choices (wrong lifecycle/vocab) |
| L2 commercial_selections | **Do not use** as working Choices; **reference** package context only |
| Contract | **Do not mutate**; legal amend stays separate |
| **Event Order** | **Extend** as apply-target / delivery SoT |
| **Offerings** | **Reuse directly** as option catalog |
| Inventory | **Reference** via offerings / Event Inventory on finalize |
| **Invoice** | **Reuse directly** (projection / freeze / amend) |
| **Payment Plan** | **Reuse directly** (needs review / regenerate) |
| Documents | **Extend** to host finalized Choices artifact |
| Portal | **Extend** (Next Steps + Choices section + existing EO/Payments) |
| Tasks / Notifications | **Reuse** patterns (questionnaire / event_order_shared) |
| Questionnaire | **Reference only** for collaborative status UX — not the commercial object |

### Minimum new concept

**One:** `Client Choices` (template + event instance + versions + status).  
Everything else converges on Event Order + Invoice + Payment Plan + Documents + Tasks.

---

## 18. Explicitly do NOT build

- Second invoice or payment-plan system  
- Parallel payment ledger / duplicate commitment totals  
- Generic workflow engine / generic approval framework  
- Making Event Order a collaborative editor  
- Stuffing this into L1/L2 “proposal”  
- Calendar events for every Choices status  
- Mutating FE contracts from Choices  
- Second inventory system  
- Requiring legal contract amendment for every menu pick  
- Over-versioning framework beyond “working + finalized versions + EO reopen/invoice amend”

---

## 19. Explicit answers A–V

**A.** Facsimile: Template → Create Client Choices → Send → Client Submit → Venue Finalize → Event Order → existing money path.  

**B.** Working object: **Client Choices** (guided commercial form instance).  

**C.** Venue start: **Event workspace**, beside Event Order.  

**D.** Client complete: **Your Next Steps** → **Your Choices**; permanent in **Documents**.  

**E.** Finalize = venue-only; Submit ≠ Finalize.  

**F.** Authoritative “what they chose” = latest Finalized Choices version; authoritative “what we deliver/bill from” = Event Order + Invoice.  

**G.** Finalize copies/updates Event Order lines from Choices (offerings, qty, included/add-on, price snapshot).  

**H.** $0 → EO only; $+ → EO then draft projection or **invoice amendment** + **payment-plan review** (existing).  

**I.** Price-neutral: EO + Choices history; no invoice amend if total unchanged.  

**J.** Additions: priced EO lines → invoice amend / request payment as needed.  

**K.** Removals: revision/EO update → invoice amend; paid amounts via refund/credit history.  

**L.** Post-finalize: new Choices version or EO reopen; never silent rewrite of finalized Choices.  

**M.** Venue portal: Event Choices + EO + Invoice/Payments + Documents.  

**N.** Client portal: Next Steps, Your Choices, Event Order, Payments, Documents.  

**O.** Tasks/notifications for send, overdue complete, submit, changes requested, finalize, financial review — **not** calendar dumps.  

**P.** Minimum new: Choices template + instance + status/version; apply-to-EO; doc snapshot.  

**Q.** Do not change: invoice/payment core, FE contract immutability, EO as venue-authored delivery SoT, L2 booking meaning.  

**R.** Venue term: **Client Choices**.  

**S.** Client term: **Your Choices**.  

**T.** UX risks: conflating with Event Order/Proposal; client thinking Submit = charge; burying entry in Documents only; overloading Booking Details.  

**U.** Integrity risks: writing money without EO; double-entering invoice lines by hand; mutating FE contract; stock double-count; losing audit on removals.  

**V.** Feels natural if: same Library→Send→Client acts→Venue locks→Money follows pattern, with Event Order as the “what they get” twin of L2’s “what they bought.”

---

## 20. If we were building this tomorrow, I would build:

### User mental model

**“Choices” after booking work like a mini proposal:** library → send → client submits → venue finalizes → delivery list (Event Order) updates → invoice/payment plan only when dollars change.

### Venue entry point

Event page → **Client Choices** card next to **Event Order**.

### Client entry point

**Your Next Steps** → **Your Choices**; finalized copy in **Documents**.

### Working selection object

**Client Choices** instance from **Choices template**, offering-backed options, included vs add-on, quantities, notes, status, versions.

### Lifecycle

`Draft → Sent → Submitted → Changes requested → Finalized` (optional In progress).

### Finalization boundary

**Venue Finalize only**; copies into Event Order; client Submit never bills.

### Event Order relationship

EO remains venue-authored delivery SoT; Choices **feeds** it on Finalize; EO Share still how clients see “What you’re receiving.”

### Invoice / payment-plan relationship

Reuse projection / freeze / **amend** / **needs review** — no new money system.

### Portal locations

Venue: Event Choices + EO + Invoice.  
Client: Next Steps / Choices / EO / Payments / Documents (permanent).

### Minimum new architecture

Choices templates + event-bound Choices instances + finalize→EO apply + document snapshot + tasks/notifications.

### Explicitly NOT build

Second financial stack; collaborative Event Order editor; L1/L2 reuse for this; contract mutation; calendar spam; generic workflow engines.

---

# IMPLEMENTATION STATUS: NOT READY

Review and approve this architectural recommendation before any code, schema, or deploy work.
