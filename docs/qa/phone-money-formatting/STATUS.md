# Phone & money formatting — inventory and closure

Branch: `feat/spaces-booking-e1-smart-fields`  
Canonical display helpers:

- Phone: `lib/sms/phone.ts` → `formatPhoneDisplay` / `normalizeVenuePhoneInput` / `toE164`
- Money: `lib/money/format.ts` → `formatMoneyDisplay` (whole dollars omit `.00`)

## Inventory (high-signal surfaces)

| Surface | Field | Prior path | Defect | Fix / status |
|---|---|---|---|---|
| Lead detail contact | phone | raw `lead.phone` | Unformatted 10-digit | `formatPhoneDisplay` — OK |
| Lead create/update | phone | `trim()` only | Saved raw digits | `normalizeVenuePhoneInput` — OK |
| Client create/update | phone | `trim()` only | Saved raw digits | `normalizeVenuePhoneInput` — OK |
| Client People tab | phone | raw | Unformatted | `formatPhoneDisplay` — OK |
| Vendor detail | phone | raw + `tel:` raw | Unformatted | display + `toE164` for tel — OK |
| Vendor create/update | phone | `trim()` only | Saved raw | `normalizeVenuePhoneInput` — OK |
| Invoice print/PDF | venue phone | raw snap/venue | Unformatted | `formatPhoneDisplay` — OK |
| Portal vendor / venue guide | phone | raw | Unformatted | display + `toE164` — OK |
| Venue settings phone | phone | already normalized | OK | keep |
| Email brand signature | phone | `formatPhoneDisplay` | OK | keep |
| Contract merge `venue_phone` / `client_phone` | phone | raw `trim()` | Unformatted in venue section | `formatPhoneDisplay` in `lib/contracts/service.ts` |
| Contract brand presentation / PDF header | phone | raw snapshot/venue | Unformatted | `resolveContractBrandPresentation` formats phone |
| Inquiry tour confirmation | venuePhone | raw | Unformatted | `formatPhoneDisplay` in confirmations |
| Tour scheduler confirmation (legacy) | venuePhone | raw | Unformatted | `formatPhoneDisplay` |
| Twilio E.164 payloads | phone | `toE164` | Intentional machine form | leave |
| Editable money inputs | string | `parseMoneyInput` / blur format | Intentional | leave |

## Tests

- `lib/money/format.test.ts`
- `lib/leads/money-format.test.ts`
- `lib/sms/phone.test.ts` (includes `9788703988` → `(978) 870-3988`)
- `lib/contracts/venue-phone-display.test.ts`

## Runtime status — GREEN on Sandbox

Deployed revision: `10ff7fb1c99c9f79a3afc939ebaf73ac32cf8fed`  
Deploy: https://github.com/jlcormier612/wevenu-website/actions/runs/38015446672  
Health: ok · ECS `htc-sandbox-venue-app:645`

Browser / data proof (`docs/qa/phone-money-formatting/contract-phone-results.json`):

1. Fancy stored phone `603-555-3647` → display `(603) 555-3647`; E.164 `+16035553647` unchanged
2. Contract staff UI and `/sign/{token}` show `(603) 555-3647` in the venue section
3. Branding snapshot keeps stored value; presentation formats at resolve time
4. No dedicated `/print` HTML route (404); PDF path uses the same brand formatter
5. PhoneProof fixtures cleaned up

Exception: contracts already released before this fix retain whatever phone string was merged into frozen `content`. New merges and brand presentation are corrected.
