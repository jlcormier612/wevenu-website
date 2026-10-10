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
| **Contract merge `venue_phone` / `client_phone`** | phone | raw `trim()` | Unformatted in venue section | **`formatPhoneDisplay` in `lib/contracts/service.ts`** |
| **Contract brand presentation / PDF header** | phone | raw snapshot/venue | Unformatted | **`resolveContractBrandPresentation` formats phone; PDF contact line uses it** |
| Inquiry tour confirmation | venuePhone | raw | Unformatted | `formatPhoneDisplay` in confirmations |
| Tour scheduler confirmation (legacy) | venuePhone | raw | Unformatted | `formatPhoneDisplay` |
| Twilio E.164 payloads | phone | `toE164` | Intentional machine form | leave |
| Editable money inputs | string | `parseMoneyInput` / blur format | Intentional | leave |

## Tests

- `lib/money/format.test.ts`
- `lib/leads/money-format.test.ts`
- `lib/sms/phone.test.ts` (includes `9788703988` → `(978) 870-3988`)
- `lib/contracts/venue-phone-display.test.ts`

## Runtime status

GREEN only after Sandbox browser proof on the exact deployed revision confirms:

1. Contract venue section shows `(978) 870-3988` (or the venue's formatted number) for a US 10-digit stored value
2. Signing view / PDF header contact line match
3. Persisted venue.phone remains machine-usable via `toE164`
4. Lead / vendor / invoice surfaces remain formatted
