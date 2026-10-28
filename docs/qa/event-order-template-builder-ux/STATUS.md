# Event Order Template Builder UX — STATUS

**Verdict: OPEN (NOT GREEN)** — product UX fix pushed; Sandbox deploy in flight; browser acceptance pending serving tip.

## Root cause
Fixed lines were labeled **“Included in …”** (conflating placement with free/in-price). Couple choices were framed as **“major choices from your Offerings catalog”** (conflating catalog hierarchy with EO choice groups). Model already supported package items / primary questions / dependent follow-ups.

## Commit
`3865e4c1494fae80572ef3640b35bf7c907713e9`

## Focused tests
`builder-ux.test.ts` + `guided-setup.test.ts` + `template-catalog-integration.test.ts` → **50 pass / 0 fail**

## Deploy
https://github.com/jlcormier612/wevenu-website/actions/runs/40782882893 — queued/in progress for `3865e4c1`  
No competing deploy was started while another was active.

## Browser (after serving)
```bash
EXPECTED_SHA=3865e4c1494fae80572ef3640b35bf7c907713e9 \
  npx tsx docs/qa/event-order-template-builder-ux/verify-browser.mts
```

## Artifacts
- `AUDIT.md` — forensic answers
- `verify-browser.mts` — end-to-end venue-owner scenario harness

## Production
Untouched. Unrelated dirty/untracked work preserved.
