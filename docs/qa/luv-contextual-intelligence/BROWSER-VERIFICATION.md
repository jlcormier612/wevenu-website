# Browser verification — Luv contextual intelligence + dashboard presence

Serving: `ad4d5b8b52002a3a9154fe311d7d196878fb82e8`  
Digest: `sha256:a25e67919ca7775ba51a7fda24e9c23cd081906bf3856316715cd44af3a122db`  
Harness: `verify-browser.mts` → **GREEN** (`browser-results.json`)

| Check | Result |
|-------|--------|
| No “tasks are past due / Want to clear them?” | PASS |
| Focus still lists overdue tasks | PASS |
| Luv present when Calendar Focus applies (today’s tour) | PASS — “I noticed … tour … schedule” |
| Scheduled tour: no all-set / Good luck | PASS |
| Confirmation actions still offered while scheduled | PASS |
| After confirm: unconfirmed copy gone; status confirmed | PASS |

Shots: `shots/dashboard-overdue-1280.png`, `dashboard-presence-1280.png`, `lead-scheduled-unconfirmed-1280.png`, `lead-confirmed-1280.png`.

## Screenshot interpretation

A Tasks-only Focus with no other L1 candidates correctly omits the Luv card (scoped silence). With a today tour in Focus Calendar, Luv reappears with a useful non-Tasks interpretation — proving Luv was not globally disabled.
