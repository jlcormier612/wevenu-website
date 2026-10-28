# Event Order Template Builder UX — acceptance STATUS

**Verdict: GREEN**  
**Date:** 2026-10-28  
**Production:** untouched  
**Unrelated dirty/untracked work:** preserved

---

## Final serving SHA / deployment

| Item | Result |
|---|---|
| Residual copy-fix commit | `159e5a9d9f8404325242ae966487acc560609928` |
| Deploy run | [40784742660](https://github.com/jlcormier612/wevenu-website/actions/runs/40784742660) — **success** |
| ECS image | `…/htc-sandbox-venue-app:159e5a9d9f8404325242ae966487acc560609928` |
| Competing deploy at verification | none (PRIMARY `COMPLETED`) |
| Prior UX tip (still in history) | `3865e4c1494fae80572ef3640b35bf7c907713e9` via run `40782882893` |

---

## 1. Builder UX harness (final serving SHA)

```bash
EXPECTED_SHA=159e5a9d9f8404325242ae966487acc560609928 \
  npx tsx docs/qa/event-order-template-builder-ux/verify-browser.mts
→ GREEN — 35 pass / 0 fail
```

Evidence: `browser-results.json`, `browser-run.log` / `browser-run-159e5a9d.log`, `persisted-state.json`, `shots/01`–`08`.

Confirmed still valid on `159e5a9d`:

- Direct package items with covered vs additional-charge treatment  
- Template-only Champagne Toast `$150`  
- Dinner style → Buffet / Plated  
- Conditional Sides / Entrées  
- Preview path switch + validation  
- Reopen / edit persistence  
- Finalization integrity simulation + snapshot immutability  
- 390px layout  

UX residual on this SHA: sheet save actions read **Add package item** / **Save package item**.

---

## 2. Live portal finalization click path (closed)

Previously OPEN: live `finalizeClientChoices` via portal submit + venue Apply/Update CTA.

Harness (new, targeted; reuses SPF portal patterns + staff cookie auth):

```bash
EXPECTED_SHA=159e5a9d9f8404325242ae966487acc560609928 \
  npx tsx docs/qa/event-order-template-builder-ux/verify-portal-finalize.mts
→ GREEN — 19 pass / 0 fail
```

Evidence: `portal-finalize-results.json`, `portal-finalize-persisted.json`, `portal-finalize-run.log`, shots:

| Shot | Stage |
|---|---|
| `shots/portal-incomplete-reject-1280.png` | Portal rejects missing Entrée |
| `shots/portal-submitted-1280.png` | Valid plated path submitted |
| `shots/venue-before-finalize-1280.png` | Staff before Apply/Update |
| `shots/venue-after-finalize-1280.png` | After `finalizeClientChoices` |
| `shots/venue-rejected-finalize-1280.png` | Incomplete finalize rejected |
| `shots/portal-after-flow-1280.png` | Portal after flow |

### Portal + finalize results

| Check | Result |
|---|---|
| Incomplete follow-up submit rejected (Entrées) | PASS — no EO mutation (marker line only) |
| Over-max Sides blocked (3rd disabled at max 2) | PASS — status remains `sent` |
| Valid plated path portal submit | PASS — status `submitted`; answers dinner=plated, entrée=chicken |
| Submit does not create choice EO lines | PASS |
| Staff UI `choices-create-event-order` → `finalizeClientChoices` | PASS — status `finalized` |
| EO lines: Plated (included $0) + Chicken Marsala ($42 additional) | PASS |
| Unrelated venue marker line preserved | PASS |
| Duplicate finalize (Amend → submitted → Update) replaces lines, no duplicates | PASS — new `applied_line_ids`, counts stay 1/1/1 |
| Rejected finalize with incomplete answers | PASS — status stays `submitted`; EO line set unchanged |

Sibling reference (progress/max/submit without staff finalize click): `docs/qa/selection-progress-finalize/STATUS.md`.

---

## Remaining limitations

| Item | Status |
|---|---|
| Production | Not authorized — untouched |
| Full commercial invoice/share after choices finalize | Out of scope — not required for this closure |

No OPEN blockers for builder UX acceptance or live portal → finalizeClientChoices.

---

## Definition of done

- Residual deploy `40784742660` succeeded; serving SHA `159e5a9d` verified  
- Builder harness GREEN on that SHA  
- Live portal submit + staff finalize click path GREEN with persisted EO evidence  
- Production untouched; unrelated dirty work preserved  

**GREEN.**
