# Luv voice — “Thanks for having us” card

## Source

Template path: `lib/luv/completed-tour-intelligence.ts` → `unresolvedQuestionInsightCopy` → Contextual “Luv noticed”.

## Why the bad copy shipped

1. Prior writing-quality “fix” intentionally introduced robotic review language (“Check the conversation…”, “A written reply is not on the thread yet — confirm in the conversation…”).
2. `looksLikeThanksOnly` only matched bare `Thanks` / `Thank you`, not `Thanks for having us`.
3. `topicFromExcerpt` took the first clause, so courtesy + later question became “asked about Thanks for having us”.
4. Missing reply was treated as an actionable obligation for any `looksLikeCustomerQuestion` hit.

## Fix

- Broaden courtesy detection; silence courtesy-only threads.
- Topic from full inbound text, preferring the question clause.
- Natural copy: observation + optional draft offer; no DB narration / repeated inspect instructions.
