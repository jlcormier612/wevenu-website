# Luv “Wilmais” — forensic audit

## Live DOM on Sandbox (Wilma lead Luv tab)

`textContent` / `innerHTML`:

`Wilmais just beginning their planning journey. …`

Child nodes (two adjacent text nodes, **no space**):

1. `"Wilma"`
2. `"is just beginning their planning journey. …"`

`letter-spacing: normal`, `word-spacing: 0px`. Not CSS eating a space.

Accessibility tree inserts a space between text nodes, so it reads “Wilma is” even though the document concatenates to “Wilmais”.

## Source path

Lead → `LuvDraftPanel` → `LeadMomentumCard` → `NewInquiryView` → `{firstName} is just beginning…`

`firstName` is `lead.firstName` = `"Wilma"` (correct discrete first name).

The compiler/runtime emits the interpolation and the following text as **two children** and drops the JSX whitespace between `}` and `is`. That is why a previous “add a space in the JSX” fix regressed: the space was never a string token.

`lib/leads/momentum.ts` template strings (`${firstName} is showing…`) were never affected.

Not caused by Luv Phase 2A portal-context formatters. Same card source on `d253db31` and `46574963`.
