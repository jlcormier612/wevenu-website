import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { HqCouple, HqTeamMember, HqVendorInvite } from "@/lib/hq/venue-detail-types";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function EngagementSection({
  team,
  vendors,
  couples,
}: {
  team: HqTeamMember[];
  vendors: HqVendorInvite[];
  couples: HqCouple[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="font-heading text-sm font-semibold text-heading">Engagement</h2>
        <p className="text-xs text-muted-foreground">Team, vendor, and couple adoption for this venue.</p>
      </CardHeader>
      <CardContent className="pt-0 grid gap-6 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Team ({team.length})</p>
          <ul className="space-y-1.5">
            {team.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-xs">
                <span className="text-heading">{t.name}{t.isOwner && <span className="text-muted-foreground"> (Owner)</span>}</span>
                <span className="text-muted-foreground">{t.acceptedAt ? fmt(t.lastActiveAt) : "Invited"}</span>
              </li>
            ))}
            {team.length === 0 && <li className="text-xs text-muted-foreground/60">No team members</li>}
          </ul>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Vendors ({vendors.length})</p>
          <ul className="space-y-1.5">
            {vendors.map((v) => (
              <li key={v.id} className="flex items-center justify-between text-xs">
                <span className="text-heading">{v.vendorName ?? v.email}</span>
                <span className="text-muted-foreground capitalize">{v.status}</span>
              </li>
            ))}
            {vendors.length === 0 && <li className="text-xs text-muted-foreground/60">No vendor invitations</li>}
          </ul>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Couples ({couples.length})</p>
          <ul className="space-y-1.5">
            {couples.slice(0, 8).map((c) => (
              <li key={c.id} className="flex items-center justify-between text-xs">
                <span className="text-heading">{c.name}</span>
                <span className="text-muted-foreground">{c.portalLastAccess ? fmt(c.portalLastAccess) : "No portal activity"}</span>
              </li>
            ))}
            {couples.length === 0 && <li className="text-xs text-muted-foreground/60">No couples imported</li>}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
