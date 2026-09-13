import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Event Order is always available (optional by use).
 * venues.event_order_enabled is retained but no longer a product gate.
 * This section is informational only — do not reintroduce UI gating here.
 */
export function EventOrderEnableSection({
  enabled: _enabled,
}: {
  venueId: string;
  enabled: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="font-heading text-sm font-semibold text-heading">Event Orders</h2>
        <p className="text-xs text-muted-foreground">
          Always available on the event workspace. Optional by use — not a feature flag.
          Package, Invoice, and Client Planning remain the commercial and planning sources of truth.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-foreground">
          Status: <span className="font-medium">Available</span>
        </p>
      </CardContent>
    </Card>
  );
}
