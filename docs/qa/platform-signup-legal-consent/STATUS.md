# Platform-wide Terms, Privacy & Consent — STATUS

## Verdict: NOT GREEN (code + unit tests done; Sandbox browser pending serving SHA)

## Commit
Pending commit of this workstream (see chat report for SHA after push).

## Gaps fixed
1. **Client invite signup** (`/client/accept`, `/client/accept-participant`) — added affirmative Terms + Privacy UI; server rejects without `legalAccepted`; records Couple Invitation acceptances after create.
2. **Vendor invite signup** (`/vendor/accept` create path) — same pattern with Vendor Terms + Privacy.
3. **Venue enrollment activate API** — requires `legalAccepted: true` (closes Bearer bypass of UI-only legal).

## Already compliant (unchanged)
- Venue Activate Account form + `completeVenueActivateLegalViaProduct`
- Welcome Experience / proxy gates for version updates
- Client/vendor login (no false consent)

## Tests
```
npx tsx --test lib/legal/signup-consent.test.ts workspace/lib/program4/activate-account-form.test.ts
```

## Browser verify (after ECS serves commit)
```
EXPECTED_SHA=<sha> npx tsx docs/qa/platform-signup-legal-consent/verify-browser.mts
```

Production untouched.
