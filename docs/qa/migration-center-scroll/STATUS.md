# Migration Center cut-off / scroll — Sandbox

## Verdict

**IN PROGRESS** — root cause established; shell scrollport fix committed; awaiting Deploy Sandbox + browser verify on tip.

## Symptom

On `/settings/migration?source=honeybook` (new-venue Bring Your Business path), Migration Center content is clipped at the bottom of the application viewport with no apparent way to reach the rest of the page.

## Root cause (runtime evidence on tip `09745d75`)

1. Staff shell locks **document** scroll (`html/body { overflow: hidden }` under `.htc-staff`) and pins the chrome with `fixed inset-0`.
2. Module content is intended to scroll inside `<main class="overflow-y-auto">`.
3. Forensics on 1280×800: `main.scrollHeight=1481` > `clientHeight=732` (content overflows), but **scrollbar gutter = 0** (macOS overlay scrollbars) — no visible scroll control in screenshots.
4. **PageDown with focus still on `body` does not move `main`** (`scrollTop` stays 0). After clicking into the content, PageDown works. Wheel over `main` works, but the page looks permanently cut off when the user does not discover the nested scrollport.
5. Aside lacked `min-h-0` / `overflow-hidden`, so `.htc-staff` reported `scrollHeight > clientHeight` while its own overflow stayed `hidden` (clipped sidebar contribution).

Not a Migration Center content bug — shared workspace scrollport discoverability / keyboard reachability under the locked-document shell.

## Fix

- `components/shell/workspace-shell.tsx` — `main` uses `overflow-y-scroll overflow-x-clip overscroll-y-contain` + `data-workspace-main`; aside gets `h-full min-h-0 overflow-hidden`; page slot stays on the server shell.
- `components/shell/workspace-main-scroll-bridge.tsx` — forwards PageDown/PageUp/Home/End to `main` when focus is outside it (document scroll locked).
- `app/globals.css` — stable, always-painted scrollbar styles on `main[data-workspace-main]`.
- Venue switch hard navigation left intact (`window.location.assign`).

## Tests

- `lib/shell/workspace-main-scroll.test.ts`
- `lib/conversations/inbox-product.test.ts` (shell scroll contract updated)
- `lib/venue/venue-switcher.test.ts` (no regression)
- Browser: `scripts/qa/migration-center-scroll-browser.mts`

## Deploy / verify

| Item | Value |
|------|-------|
| Environment | Sandbox only |
| Intended SHA | _(fill after commit)_ |
| Run | _(fill after dispatch)_ |
| Production / public marketing | Untouched |
