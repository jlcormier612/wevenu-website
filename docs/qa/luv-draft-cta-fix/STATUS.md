# Luv “Ask Luv to draft a follow-up” — GREEN on Sandbox

| Field | Value |
|---|---|
| Tip | `0425c4558dab474d0c90b200703801a4689c3971` |
| Deploy | [Deploy Sandbox](https://github.com/jlcormier612/wevenu-website/actions/runs/38198957084) success |
| Root cause | Same-record soft `Link` to `?luv=` did not open drafting on the already-open lead |
| Fix | Same-record draft CTAs call `handleGenerate` (button); Overview bumps `externalDraftRequest` and switches to Luv |

## Browser proof

`scripts/qa/luv-draft-cta-browser.mts` → `browser-results.json` — **6/6 PASS**

- Noticed CTA present on Luv tab
- Click opens drafting (`drafts 0→1`, pending review UI)
- No auto-send
- No unbounded duplicate drafts

## Unit

`lib/luv/same-record-draft-cta.test.ts` — PASS
