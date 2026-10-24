# Event Order workflow + selection email link

## Status

**BLOCKED / NOT GREEN** — link and stage-visibility corrections are in the working tree. Full deployed browser journey (acceptance steps 1–28) is not yet proven against a new serving SHA.

## Serving before this change

| Field | Value |
| --- | --- |
| Image | `405254329873.dkr.ecr.us-east-1.amazonaws.com/htc-sandbox-venue-app:49b3c72dcc0ef251f19fc35b40a7055ed54da87e` |
| Digest | `sha256:44c06727274575b855b9ad014e322fdeaa44a6750ce329040efa0ab16bfc0f88` |
| Prior deploy of `0acf5305` | https://github.com/jlcormier612/wevenu-website/actions/runs/40051465891 **failure** (team Select `onValueChange` type). That type error is fixed in the same commit so Sandbox can build. |

## Why earlier E2E missed this

P2-E (GREEN on `1939228e`) checked that the email HTML contained `#choices` and opened a couple portal token the harness already held. It did not resolve the session the sender picks when the only stored portal session is the invoice `financial` token. That token always renders Invoice & Payment Plan.

## Unit checks run

`lib/client-choices/choices-portal-link.test.ts` + `couple-email.test.ts` + `payment-access.test.ts` — pass (see test output when recorded).

## Not yet done

- Sandbox deploy of this correction
- Fresh couple browser opening the generated selection URL (not a staff page)
- Invoice link still opening PaymentAccessShell
- Full Create Event Order → finalize → invoice → Documents journey on that SHA
- Production untouched; unrelated dirty files preserved
