# Phone & money formatting — inventory and closure

Branch: `feat/spaces-booking-e1-smart-fields`  
Canonical display helpers:

- Phone: `lib/sms/phone.ts` → `formatPhoneDisplay` / `normalizeVenuePhoneInput` / `toE164`
- Money: `lib/money/format.ts` → `formatMoneyDisplay` (whole dollars omit `.00`)

## Inventory (high-signal surfaces)

| Surface | Field | Prior path | Defect | Fix |
|---|---|---|---|---|
| Lead detail contact | phone | raw `lead.phone` | Unformatted 10-digit | `formatPhoneDisplay` |
| Lead create/update | phone | `trim()` only | Saved raw digits | `normalizeVenuePhoneInput` |
| Client create/update | phone | `trim()` only | Saved raw digits | `normalizeVenuePhoneInput` |
| Client People tab | phone | raw | Unformatted | `formatPhoneDisplay` |
| Vendor detail | phone | raw + `tel:` raw | Unformatted | display + `toE164` for tel |
| Vendor create/update | phone | `trim()` only | Saved raw | `normalizeVenuePhoneInput` |
| Invoice print/PDF | venue phone | raw snap/venue | Unformatted | `formatPhoneDisplay` |
| Portal vendor cards | phone | raw | Unformatted | display + `toE164` |
| Venue settings phone | phone | already normalized | OK | keep |
| Email brand signature | phone | `formatPhoneDisplay` | OK | keep |
| Invoice/payment/package/event-order money | amounts | `Intl` default 2 frac digits | `$20,000.00` | delegate to `formatMoneyDisplay` |
| Leads money | amounts | local whole-dollar rule | OK → now shared | `formatMoneyDisplay` |
| Payments `formatMoney` | amounts | min 0 already | Aligned | shared |
| Portal budget | amounts | maxFrac 0 always | Aligned | shared |
| Twilio E.164 payloads | phone | `toE164` | Intentional machine form | leave |
| Editable money inputs | string | `parseMoneyInput` / blur format | Intentional | leave |

## Tests

- `lib/money/format.test.ts`
- `lib/leads/money-format.test.ts`
- `lib/sms/phone.test.ts` (includes `9788703988` → `(978) 870-3988`)

## Runtime status

NOT GREEN until Sandbox browser proof on the exact deployed revision confirms:

1. Venue / lead / vendor phone displays `(978) 870-3988` after save of `9788703988`
2. Invoice / payment surfaces show `$20,000` for whole dollars
3. SMS / dial still receive E.164 where required
