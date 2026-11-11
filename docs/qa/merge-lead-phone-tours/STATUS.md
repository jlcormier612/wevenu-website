# STATUS — Merge Lead phone formatting + tour appointment clarity

**Verdict: GREEN / CLOSED**

## Phone — root cause (multi-layer)

| Layer | Finding |
|-------|---------|
| **Stored data** | Mixed shapes coexist: digits-only (`6984238542`) and venue display form (`(789) 543-6597`). Not wrong numbers — inconsistent write normalization. |
| **Write / sourcing** | Manual lead create/update uses `normalizeVenuePhoneInput`. Public intake (`normalizeLeadInput` → inquire / public forms / tour booking) only trimmed, so raw digits were stored. |
| **Merge preview** | Field diffs showed raw `*Value` strings with no `formatPhoneDisplay`, so mixed storage looked inconsistent. Lead detail already formatted. |
| **Merge compare** | String equality treated digit-equivalent phones as conflicts. |

**Not** a wrong-field mapping or fabricated number. Digits were authoritative; display/write paths disagreed.

### Fix

Commit `c6c870ad84e8752da0e2c358d2be0f91428f3752`

- `lib/lead-intake/normalize.ts` — store phones via `normalizeVenuePhoneInput` (shared with lead repository)
- `lib/leads/merge.ts` — `applyPhoneDisplays`; digit-equivalent → `same`; `phonePatchValue` on fill/conflict persist
- Dialog cards/candidates use `formatPhoneDisplay`
- No broad historical phone rewrite

### Before → after (controlled fixtures)

| | Stored | Preview choice | Persisted after keep-primary |
|--|--------|----------------|------------------------------|
| Primary | `6984238542` | `(698) 423-8542` | `(698) 423-8542` |
| Secondary | `(789) 543-6597` | `(789) 543-6597` | (not chosen) |

Radio values remained the stored strings; only display and post-merge storage normalizer changed shape without inventing digits.

### Other phone workflows verified

| Path | Status |
|------|--------|
| Manual lead create/update (`repository` + `normalizeVenuePhoneInput`) | Already correct; unchanged |
| Public intake (`normalizeLeadInput`) | **Fixed** — now normalizes |
| Lead detail display (`formatPhoneDisplay`) | Already correct; merge now matches |
| Historical mixed rows | Preserved; display formatted in merge/detail; no mass cleanup |

## Tours — root cause

Product rule: appointments are **separate records**, all reassociated to the survivor unless the venue cancels an **active** (`scheduled`/`confirmed`) tour. Completed rows correctly had no cancel control, so they looked like non-working selectors.

### Fix

- Explicit policy copy: all kept/reassociated; completed not cancellable here
- Per completed/past row: “Kept — will reassociate… No choice needed”
- Active rows: accessible keep/cancel checkbox with clear selected state
- `tourCancelIds` preserved across survivor reorientation
- Final confirm summarizes reassociate vs cancel counts

## Serving evidence (Sandbox)

| Item | Value |
|------|--------|
| Deploy | [40267718908](https://github.com/jlcormier612/wevenu-website/actions/runs/40267718908) **success** |
| Image SHA | `c6c870ad84e8752da0e2c358d2be0f91428f3752` |
| Digest | `sha256:39ac9c91a4b70bec5ead5abb75be2a4639e1e827a0201bdbe3d971df4a8077ea` |
| Browser | **GREEN** — `browser-run.log` |

## Tests / build

| Check | Result |
|-------|--------|
| Unit | **47 pass** (`unit-test.log`) |
| `npm run build` | **EXIT 0** |
| Browser + persist | **GREEN** — phone both formatted; kept primary normalized; completed tours keep-notes; cancel leaves tours; reverse survivor + tour reassociation intact |

## Preserved prior behavior

Survivor either-direction, FK name labels, Continue-gate, final confirm, cancel-without-mutation — all still passing in the same harness.

## Production

**Untouched.**
