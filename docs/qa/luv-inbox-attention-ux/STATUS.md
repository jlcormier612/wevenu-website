# Luv → Inbox Attention UX

## Semantics (locked)

| Signal | Meaning | Source | Population |
| --- | --- | --- | --- |
| **Nav Inbox pink badge** | Unread messages you have not opened | `sum(conversations.venue_unread)` via `get_conversation_unread_count()` | Working Inbox only (`inbox_conversation_in_working_population`) |
| **Inbox header “N unread messages”** | Same unread concept | `get_conversation_inbox.total_unread` | Working Inbox only |
| **Inbox header “N need response”** | Latest meaningful message is inbound and awaiting a venue reply | `conversations.needs_response` / `total_needs_response` | Working Inbox only |
| **Luv recommendations** | Relationship / workflow intelligence (e.g. unattended inquiry pattern) | `luv_recommendations` + observation model | Not an Inbox reply obligation |

**Unread ≠ needs response.** A conversation may be unread without needing a reply, or read and still need a reply.

**Orphan / deleted-lead threads** may retain communication history and nonzero `venue_unread` / `needs_response` flags. They are intentionally excluded from the working Inbox and therefore from the nav unread badge and Inbox header counts. Do not delete them merely to clear a badge.

**Accessible label:** Inbox badge announces “N unread message(s)” — never generic “need attention.”

## P-A1

P-A1 unattended-inquiry detection remains GREEN/CLOSED on `88ae73af` and is out of scope for this pass.
