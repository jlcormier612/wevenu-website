import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";

import { DashboardLuvEntryCard } from "@/components/dashboard/luv-dashboard-entry";
import { AttentionList } from "@/components/dashboard-system/attention-list";
import { ComingUpRow } from "@/components/dashboard-system/coming-up-row";
import { FocusAttentionRow } from "@/components/dashboard-system/focus-attention-row";
import { getDashboardData } from "@/lib/dashboard/service";
import {
  forensicCount,
  forensicExtra,
  forensicRecordL1,
  forensicTime,
  withDashboardForensic,
} from "@/lib/dashboard/forensic-timing";
import {
  classifyBriefingItems,
  classifyUpcomingItems,
  collectCrossSectionSubjects,
  excludeByCrossSectionSubject,
} from "@/lib/dashboard-system/decision-engine";
import { listDismissedDashboardAttentionKeys } from "@/lib/dashboard-system/attention-dismiss";
import { filterDismissedFocusItems } from "@/lib/dashboard-system/attention-identity";
import { selectLuvDashboardEntry } from "@/lib/dashboard-system/luv-entry";

/** Today's Focus, Luv entry, Coming Up, Reports link. */
export async function DashboardFocusIsland() {
  return withDashboardForensic(async () => {
    const data = await forensicTime("get_dashboard_data", () => getDashboardData());
    if (!data) return null;

    const assembly = await forensicTime("rsc_focus_l1_assembly", async () => {
      const dismissedKeys = new Set(await listDismissedDashboardAttentionKeys());
      const allFocusItems = filterDismissedFocusItems(classifyBriefingItems(data), dismissedKeys);
      const focusItems = allFocusItems.slice(0, 10);

      const claimedSubjects = collectCrossSectionSubjects(allFocusItems);
      const upcomingItems = excludeByCrossSectionSubject(classifyUpcomingItems(data), claimedSubjects).slice(0, 10);

      forensicCount("focus_items_classified", allFocusItems.length);
      forensicCount("focus_items_shown", focusItems.length);
      forensicCount("upcoming_items_shown", upcomingItems.length);
      forensicCount("luv_observations_in", data.luvObservations.length);
      forensicCount("insight_observations_in", data.insightObservations.length);
      forensicCount("recommendations_in", data.recommendations.length);

      const luvEntry = data.luvObservationsEnabled
        ? selectLuvDashboardEntry({
            focusItems,
            observations: data.luvObservations,
            recommendations: [],
          })
        : (forensicRecordL1({
            source: "NONE",
            type: "observations_disabled",
            candidate: null,
            path: "luv_observations_disabled",
          }), null);

      return { allFocusItems, focusItems, upcomingItems, luvEntry };
    });

    const { allFocusItems, focusItems, upcomingItems, luvEntry } = assembly;
    forensicExtra("rsc_serialization", "UNKNOWN");

    return (
      <>
        <section>
          <AttentionList
            icon={<CalendarClock className="h-4 w-4 text-primary" />}
            title="Today's Focus"
            description="What requires attention today."
            headerBand="eucalyptus"
            headerRight={allFocusItems.length > focusItems.length ? <span className="text-xs text-muted-foreground">{focusItems.length} of {allFocusItems.length}</span> : undefined}
            items={focusItems}
            getKey={(i) => i.id}
            emptyState={
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nothing urgent today — you&apos;re all caught up.
              </p>
            }
            renderRow={(item) => <FocusAttentionRow item={item} />}
          />
        </section>

        {luvEntry && <DashboardLuvEntryCard entry={luvEntry} />}

        <section>
          <AttentionList
            icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
            title="Coming up"
            description="Events in the next 30 days."
            headerBand="none"
            className="htc-surface-guidance"
            items={upcomingItems}
            getKey={(i) => i.id}
            emptyState={
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nothing on the horizon yet.
              </p>
            }
            renderRow={(item) => <ComingUpRow item={item} />}
          />
        </section>

        <section>
          <Link
            href="/reporting"
            className="flex items-center justify-between rounded-[0.75rem] border border-[color:var(--htc-border-warm)] bg-card px-4 py-3 text-sm hover:bg-muted/40 transition-colors"
          >
            <span className="font-medium text-foreground">View Reports</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </section>
      </>
    );
  });
}
