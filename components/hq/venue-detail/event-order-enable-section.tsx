import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { setEventOrderEnabledAction } from "@/app/admin/actions";

/**
 * HQ-only per-venue Event Orders rollout control.
 * Does not create Event Orders or mutate existing ones — only flips
 * venues.event_order_enabled for this venue.
 */
export function EventOrderEnableSection({
  venueId,
  enabled,
}: {
  venueId: string;
  enabled: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="font-heading text-sm font-semibold text-heading">Event Orders</h2>
        <p className="text-xs text-muted-foreground">
          Internal rollout control. Enabling shows the Event Order tab on this venue&apos;s event workspace.
          Disabling hides the tab; existing Event Order data is not deleted.
        </p>
      </CardHeader>
      <CardContent className="pt-0 flex flex-wrap items-center gap-3">
        <p className="text-sm text-foreground">
          Status:{" "}
          <span className="font-medium">
            {enabled ? "Enabled" : "Disabled"}
          </span>
        </p>
        {enabled ? (
          <form action={setEventOrderEnabledAction.bind(null, venueId)}>
            <input type="hidden" name="enabled" value="false" />
            <Button type="submit" variant="outline" size="sm">
              Disable Event Orders
            </Button>
          </form>
        ) : (
          <form action={setEventOrderEnabledAction.bind(null, venueId)}>
            <input type="hidden" name="enabled" value="true" />
            <Button type="submit" size="sm">
              Enable Event Orders
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
