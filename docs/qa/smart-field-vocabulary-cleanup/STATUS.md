# Smart Field vocabulary cleanup — STATUS

**Status: IMPLEMENTATION COMPLETE — awaiting Sandbox browser GREEN**  
**Production:** untouched  
**Database/seed migration:** none (no historical rows rewritten)

## What changed

Canonical customer-name Smart Field is `{{client_name}}` — primary client contact first + last.

Removed from supported authoring vocabulary (picker + resolver + starters):

- `couple_name`
- `primary_contact_name`
- `full_name`
- `partner_name` (never existed as a token; not introduced)
- `partner_first_name` / `partner_last_name` / `partner_full_name` (message catalog)

Additional people continue to use client contacts / required signers — not a guessed partner field.

Historical sent/signed/executed contracts and sent messages were not rewritten.

## Tests

`npx tsx --test` on vocabulary + starters + signers + token-preserving + message merge/preview + partner-email + client-first + event-spaces + package-merge: **all pass**.

## Sandbox

Deploy after this commit. Browser verification required before GREEN.
