# Luv draft capability vs proactive silence — Sandbox closure

## Status: GREEN (matrix on live tip)

**Code tip (capability split):** `ef36871baf533b05fc638868011eed580bec1051`  
**Live verified tip:** `9e59f2784dd330c2da6464219b7c6da89847cad4` (ancestor includes `ef36871b`)  
**Failed deploy later succeeded:** [38211162496](https://github.com/jlcormier612/wevenu-website/actions/runs/38211162496) conclusion=success for `ef36871b`  
**Matrix command:** `EXPECTED_TIP_PREFIX=9e59f278 npx tsx scripts/qa/luv-draft-eligibility-matrix-browser.mts`  
**Results:** `eligibility-matrix-results.json` — **pass=true, 13/13** at `2026-10-12T07:02:21.158Z`

### Proven

| Scenario | Result |
|---|---|
| Eligible lead draft CTA + persist | PASS |
| Proactive silence copy without false outreach | PASS |
| Silence keeps owner draft CTA; Noticed not duplicated on Luv tab | PASS (`ctaCount=1 noticedLabels=0`) |
| Completed-tour actionable draft CTA | PASS |
| Ellie silence + draft CTA, no urging | PASS |
| Follow-up-sent owner draft without false outreach | PASS |
| Existing draft visible; concurrent click → one row | PASS |
| Lost lead no false outreach | PASS |

### Product lock

`draftCapable` ≠ `proactiveRecommended`. Owner may draft when proactive recommendation is silence. Drafts never auto-send. Discard deletes `luv_drafts` (covered by existing discard suites).
