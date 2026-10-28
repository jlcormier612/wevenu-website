# Requests searchable client selector — STATUS

**Verdict: GREEN**  
**Serving commit:** `0b3838d38aadeeda9b7a5cb22905d17f3fbb04f3`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/40724117984  
**Production:** untouched  

## Change

Replaced the unbounded Client `<select>` on New Request with `RequestClientPicker`, matching the Calendar **Related to** searchable pattern (`ScheduleRelationPicker`): debounced server search, anchored results panel, clear/reselect, keyboard arrows/Enter/Escape.

Search is venue-scoped via `searchRequestClients` → `clients.venue_id = current venue`, capped at 12 results. Fancy had 186 clients at verification — search did not render the full list.

## Evidence

- Unit: `lib/requests/client-search.test.ts` (+ calendar relation search) 26/26  
- Browser: `browser-results.json` / `shots/` — search, partner name, clear/preserve fields, create request, foreign-venue exclusion, 390px  
