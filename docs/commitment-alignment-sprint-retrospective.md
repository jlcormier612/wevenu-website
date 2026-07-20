# Commitment Alignment Sprint — Retrospective

Not a status report. The final report already covers what shipped. This is about what we learned getting there, and what should carry forward into whatever comes next.

---

## What architectural principles were discovered?

Only one, really, and it kept arriving disguised as something new until we finally recognized it as one thing: **a commitment is the moment private work intentionally becomes operational work.** That sentence didn't exist at the start of this arc. It got discovered, not designed — found independently, three separate times, under three different names (Private Until Committed for the Client Workspace, the Timeline authoritative-source correction, and finally this document), before anyone noticed it was the same insight wearing different clothes each time. The Commitment Lifecycle Architecture document exists because writing the pattern down once, by name, was cheaper than re-deriving it a fourth time.

A second principle earned its keep this sprint specifically: **one canonical owner, many consumers.** It showed up as the guest-count/event-type/event-date triplication fix, and again — independently, from you — as the instruction that Venue Brand Experience should feed off the venue's existing Venue Style rather than ask them to classify themselves twice. Different domains, same shape of mistake: a fact gets asked for or written in more than one place, and the moment those places can disagree, something is already quietly wrong even before anyone notices.

A third, smaller but load-bearing: **Delegation is categorically different from ordinary access.** Seating forced this distinction into the open — a venue reading data it operates on day-to-day is not the same relationship as a venue being handed explicit, scoped, revocable authorship over a couple's still-private work. Before Seating, "who can see this" and "who can edit this" were treated as roughly the same question. They aren't.

## What assumptions changed?

The biggest one: we assumed, going in, that "Commitment Lifecycle" meant every domain needed the full Draft → Submitted → Committed → Superseded → Archived shape, end to end. It didn't. Contract and Event Order never needed an Accepted step, because their Workspace Owner and Operational Owner are the same party — there's no second party to accept anything from. RSVPs never needed a Draft stage at all — a guest's response either was submitted or it wasn't, no live-watched in-between. The architecture had to earn the right to *not* apply uniformly before it could be trusted anywhere. That's a harder thing to hold onto than "apply the pattern everywhere" would have been, and it's the reason the Domain Mapping Matrix has real variation in it instead of five identical rows.

A second assumption that quietly flipped mid-sprint: the Event Order row's own gap — "completing an event has zero cascading effect" — was originally going to be closed by building the full platform-level Archive-on-Event-Complete hook this document itself proposed. Partway into Booking Financial, it became clear that was more than the actual gap required: `finalized` already served as Event Order's Committed state, so a UI-level warning closed the real problem without a new automatic transition. We caught ourselves about to over-build the theoretically-elegant version of a fix when a narrower one already worked — and said so in the doc, rather than quietly shipping the bigger thing because it was already designed.

A third: we came in assuming `is_couple_visible` was dead code, worth deleting. It turned out to be worse than dead — it was *live and wrong*, defaulting to `true` and actually gating a real query, just never actually set by anything. "Unused" and "silently leaking by default" look identical in a code search. They are not identical in consequence.

## Which findings surprised us?

The one that should have been embarrassing and instead turned out to be reassuring: Seating's original problem statement — "the venue has no way to see the couple's seating plan until they submit it" — was backwards. Live verification showed the venue already had *full, ungated, continuous* read access the whole time, the opposite failure from what was assumed. Worth naming honestly: the fix built was still the right fix, but the reasoning for building it had to be corrected first. Assuming the worse case and then testing it saved us from fixing a problem that wasn't the actual problem.

The recurring bug was more surprising the second and third time than the first. A raw `.from("client_portal_sessions").select(...)` silently returning nothing for anonymous portal requests — because no RLS policy grants `anon` access to that table — broke task auto-completion for Seating, then Vendor Selection, independently, in code that had no reason to share a bug. The honest read isn't "we found and fixed three bugs." It's "this shape of mistake was easy enough to make that three different implementations made it independently, and the actual fix wasn't patching each one — it was noticing that doing task-completion natively inside an already-authenticated SECURITY DEFINER RPC makes the whole bug class structurally impossible, not just handled."

The contract `"__default__"` bug wasn't found by the sprint at all — it was found because you tried to send a contract and hit a wall, mid-conversation, on a day this sprint was paused for other work. Worth sitting with: an architecturally clean sprint doesn't guarantee the product works for a first-time user hitting an edge case the architecture never considered. Both kinds of correctness matter, and they don't substitute for each other.

And the smallest, least dramatic surprise: `invoices.balance_due` having two independent writers wasn't a new bug introduced by this sprint — it predated it entirely, sitting in four different documents as a confidently-stated "exactly one writer" that was simply never re-verified after the second writer was added in a later phase. Nobody was wrong on purpose. The claim was just never checked again after the code around it changed. That's a cheaper mistake to make than it looks, and a completely avoidable one.

## Which future initiatives were intentionally deferred?

Two, both for the same reason stated the same way: **this sprint's job was aligning what already exists, not building new commercial capability.**

Commercial Proposal Architecture — a real pricing/packages/revisions/acceptance artifact preceding Booking — was named, reasoned about carefully (it is *not* a Commitment Lifecycle artifact, and should never be treated as one just because it happens to come before commitment), and explicitly protected from being flattened into "just a status label" along the way. The instinct to simplify it down to something buildable-today was there and was explicitly declined.

Venue Brand Experience — feeding the venue's existing Venue Style into a recommendation engine for Collections, Color Stories, Typography, Gallery Style, and Motion — was scoped, refined once (no second self-classification field), and deferred the same way, for the same reason. It came from a side conversation, not the sprint's own backlog, and stayed a side conversation rather than getting pulled into scope just because the sprint was already touching adjacent territory.

Neither deferral was a soft "later, maybe." Both are written down with enough reasoning that picking them up in six months won't require re-deriving why they matter or what shape they should take.

## What now governs future implementation?

`docs/commitment-lifecycle-architecture.md` does — not as a rule to consult occasionally, but as the thing any future domain of this shape gets checked against before its own design work starts, the same way a new feature already gets checked against the Product Promise. The Domain Mapping Matrix inside it is no longer a one-time audit artifact; it's now current, current because this sprint verified every row against real, running code rather than trusting the document's own prior claims about itself.

Two working habits earned their place this sprint and are worth naming so they don't quietly erode: **surface the architectural inconsistency before writing the fix**, even when the fix seems obvious — Item 4 alone found four things (the triplication, the Proposal question, the balance_due drift, the stale docs) that a "just implement it" pass would have walked past. And **verify against real data through real code paths, not superuser simulation** — every claim in every closing report this sprint traces back to an actual authenticated session hitting an actual running route, because RLS and grants bugs specifically don't show up any other way, and this sprint kept finding exactly that class of bug.

The sprint is done. The habit of checking new work against this document, and against real data before calling it done, is the part meant to outlast it.
