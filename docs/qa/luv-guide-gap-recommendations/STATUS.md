# Luv Guide Gap Recommendations — STATUS

## GREEN (unit + Fancy signal regression)

| Field | Value |
|---|---|
| Scope | Couple Ask `information_gap` → Guide-gap recommendations on existing `luv_recommendations` |
| Threshold | ≥3 qualifying gaps / rolling 30 days |
| Topics | `pet_policy`, `exotic_animal_policy`, `alcohol_policy` |
| CTA | Open Venue Guide → `/guide` |
| Production | untouched |

## Classifier → Guide sections (client projection)

| Topic | High-confidence terms (summary) | Guide sections inspected |
|---|---|---|
| `pet_policy` | pet(s), dog(s), cat(s), puppy/kitten, service/ESA animal | policies, faqs |
| `exotic_animal_policy` | elephant, llama, alpaca, livestock, farm/exotic/wild animal, horse/pony, goat/sheep/cow/pig, camel/zebra/tiger/lion/peacock, donkey | policies, faqs |
| `alcohol_policy` | alcohol, BYOB, corkage, outside alcohol/beer/wine/liquor, open bar | policies, faqs |

Exotic is matched **before** pet. Phrase-help, payment/portal, contract/docs, and HTC how-to questions are excluded.

Coverage is topic-specific: published “pets case-by-case” does **not** cover exotic animals.

## Files

- `lib/luv/ask-gap-topics.ts` — classifier + coverage
- `lib/luv/ask-gap-recommendations.ts` — evaluate + sync
- `lib/luv/recommendation-service.ts` — call sync after `generate_venue_recommendations`
- `supabase/migrations/20261408600000_luv_client_ask_gap_recommendations.sql` — `sync_client_ask_gap_recommendations`
- `lib/luv/ask-gap-recommendations.test.ts`

## Fancy Sandbox expected

| Signal class | Result |
|---|---|
| Dogs (`answered_venue_guide`) | No `pet_policy` recommendation |
| 2× elephants + 1× llama (`information_gap`) | `client_ask_gap_exotic_animal_policy` (≥3) |
| Phrase-help about elephants | Excluded |
| Alcohol (1 gap) | No recommendation |
| Payment / portal gaps | No Guide-gap recommendation |

## Tests

`npx tsx --test lib/luv/ask-gap-recommendations.test.ts` → pass
