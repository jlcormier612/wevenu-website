# Corrective pass — Planning clarity, Timeline ordering, Floor Plans — STATUS

**Overall verdict: PARTIAL**

Planning Overview copy, Timeline chronological persistence (DB + reorder proof), Floor Plans **offer** add/withdraw/isolation, and Phase 1–5 booking→release→invite paths are verified on the live Sandbox app.  
Full Floor Plans lifecycle is **not** claimed GREEN: client portal selection and seating mutation were not end-to-end exercised on this fixture.

Production untouched. Unrelated dirty tree preserved.

---

## SHAs and deploys

| Item | Value |
| --- | --- |
| Corrective product commit | `f6c51944e87eeb0ffdb9745a05fff348f236cb95` |
| Deploy for that commit | [39707370352](https://github.com/jlcormier612/wevenu-website/actions/runs/39707370352) — **success** |
| Exact serving of `f6c51944` | Confirmed earlier in this pass (`dpl=f6c51944…`); then superseded by follow-on deploy |
| Follow-on product commit (includes `f6c51944`) | `b910759d66a2ca1566a23e746ed5c38cb98a25b9` |
| Follow-on deploy | [39709499046](https://github.com/jlcormier612/wevenu-website/actions/runs/39709499046) — **success** |
| **Acceptance serving SHA** | `b910759d66a2ca1566a23e746ed5c38cb98a25b9` (Link `dpl=` match) |
| Evidence commit | _(this STATUS + browser-results + harness updates)_ |
| Branch | `feat/spaces-booking-e1-smart-fields` |

`f6c51944` is an ancestor of serving `b910759d`. Browser acceptance was run against the live tip so it includes the corrective Planning/Timeline/Floor editor changes **and** the later Timeline Save-All/AM-PM work. Exact tip-of-tree for acceptance is **`b910759d`**, not `f6c51944`.

---

## Commands and counts

```text
node --import tsx --test \
  ./lib/event-setup/readiness-detail.test.ts \
  ./lib/timeline/chronological-order.test.ts \
  ./lib/event-setup/floor-plans-setup-editor.test.ts
→ 33/33 pass

EXPECTED_SHA=b910759d66a2ca1566a23e746ed5c38cb98a25b9 \
  npx tsx scripts/qa/booking-to-portal-simplification-acceptance.mts
→ browser-results.json: status GREEN, passed=105, failed=0
```

Artifact: `docs/qa/booking-to-portal-simplification/browser-results.json`  
Log: `docs/qa/booking-to-portal-simplification/corrective-acceptance-run.log`

Fixture ids (acceptance run):  
`clientId=1595732a-3405-4e1c-a10a-6aebe3827a42` · `eventId=485eb921-9225-421d-9f92-4a6578571d45` · tag `B2P-1792635697551-6e63`

---

## Planning Overview copy — GREEN

Live Overview card (persisted both applications):

- States **both checklists are set up** with client checklist name + **not released yet**.
- Names venue/internal checklist and that it **stays internal**.
- Exposes **Change for this event** (and Don’t include).
- Copy distinguishes Change (event-only; Library unchanged) vs Release vs Open Planning.
- Event-only customize tasks persisted; Library hit count stayed 0.
- Release via Overview Prepare released client checklist only; venue stayed internal; no invite/questionnaire/invoice side effects from prepare.

Screenshots: `03-event-setup-before-release-1280.png`, `03c-planning-setup-editor-1280.png`, `03d-venue-planning-setup-editor-1280.png`, `04-after-prepare-release-1280.png`.

---

## Timeline chronological ordering — GREEN (DB + replace); browser scrape limited

| Check | Result |
| --- | --- |
| Template replace (Reception Only) persists after apply | PASS — 28 venue rows; editor stayed open |
| Seeded times chronological in DB | PASS — `14:00 → 18:00 → 20:00` |
| Edit earlier reorders persist | PASS — bumped to `13:00` became first |
| Edit later reorders persist | PASS — bumped to `22:00` became last |
| Open Timeline workspace | PASS |
| Browser display scrape | PASS in harness, but scraped `05:00,05:00,05:00` (weak signal; **do not treat as strong UI proof**) |

Primary proof is **persisted order** via `entry_time` / `day_offset` after replace + earlier/later edits, matching `compareTimelineEntries`. Day-of/print paths share that comparator (unit contract).

Screenshots: `03e-timeline-setup-editor-1280.png`, `03e2-timeline-template-replaced-1280.png`.

---

## Floor Plans lifecycle — stage matrix

| Stage | Verdict | Evidence |
| --- | --- | --- |
| 1. Library templates | GREEN | Count unchanged before/after (3→3); offers do not mutate Library |
| 2. Event-specific offers | GREEN | Offer persisted; withdraw → `is_offered=false`; survives reopen; no operational `floor_plans` row created by offer; other events’ offer count unchanged; Change editor keeps offer mgmt in-sheet |
| 3. Client selection | PARTIAL | `couple_selected_floor_plan_id` column present on event (**null** on this fixture). **Portal select / unoffered rejection not browser-exercised in this pass.** |
| 4. Working / operational layout | PARTIAL | Change editor distinguishes working layout vs offers (“No working layout yet” on this booking). Open Floor Plans reaches `#floorplan`. Working layouts exist on **other** Fancy events; **this booking did not create/save a working layout.** |
| 5. Seating assignments | PARTIAL | Sample working layout on another Fancy event had **0** `guest_seat_assignments`. Scope is via `floor_plan_id` (no silent cross-event transfer proven by mutation). **No seat assign/edit/reload mutation in this pass.** |
| 6. Isolation / release | GREEN (offers) | Library + other-event offers unchanged; prepare did not invite/send questionnaires/create invoices |

Screenshots: `03h-floor-plans-setup-editor-1280.png`.

---

## Phase 1–5 regression (same harness)

PASS paths included: profile → book → Inventory/EO/Planning/Timeline/Floor/Vendors Change editors → Open management → Prepare release → separate Invite (`.invalid` address) → no questionnaire/invoice side effects → profile refs unchanged.

---

## Root causes (product `f6c51944`) — unchanged

- **Planning:** Overview detail did not spell out both checklists / Change vs Release vs Open Planning when both apps persisted.
- **Timeline:** Venue UI sorted by `sortOrder` only; now uses `compareTimelineEntries`.
- **Floor Plans Change editor:** Offer vs working-layout copy and in-sheet offer add/withdraw; Select `value={templateId \|\| undefined}`.

---

## Remaining limitations (why not full GREEN)

1. Acceptance serving tip is **`b910759d`**, not exact `f6c51944` (descendant includes corrective commit).
2. Timeline **browser** time-order scrape is weak; rely on DB earlier/later proofs.
3. Floor Plans **client portal selection** and **seating mutation** not fully browser-proven here → stages 3 and 5 remain PARTIAL.
4. Working layout create/edit on the acceptance booking was not performed.

To promote overall GREEN: exercise portal layout select + one seating assign/reload on a working layout against the same serving SHA, and optionally pin acceptance to an exact SHA if required.

---

## Side effects / isolation

- No Production deploys.
- Prepare did not invite / send questionnaires / create invoices.
- Invite used `*@hellotocheers-test.invalid` only.
- Setup Profile template refs unchanged after the run.
- Library timeline/floor templates not mutated by event Change flows.
