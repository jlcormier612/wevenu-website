import { startViewAsAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

/**
 * Read-only impersonation entry point. Opens a dedicated, clearly-labeled
 * read-only snapshot of the venue (not a literal swap into the venue's own
 * session) — see docs/wevenu-hq-architecture.md §2.5 for the scope decision.
 * Logs an audited `hq.view_as` engagement event before navigating.
 */
export function ViewAsButton({ venueId }: { venueId: string }) {
  return (
    <form action={startViewAsAction.bind(null, venueId)}>
      <Button type="submit" variant="outline" size="sm">
        View As →
      </Button>
    </form>
  );
}
