import { redirect } from "next/navigation";

/**
 * Timeline is real and shipped — but it's a per-event feature (a tab on
 * each event's own detail page, components/events/event-detail.tsx),
 * never a standalone top-level page. This route predates that and used
 * to render a "coming soon" placeholder, which was stale — the feature
 * it described ("build and share the run-of-show for each event")
 * already exists. Not linked from anywhere in the app's own nav
 * (lib/navigation.ts points "Timelines" at /library/timeline-templates),
 * so this only matters for a direct URL visit; redirect to Events so
 * that visit lands somewhere real instead of a false "coming soon."
 */
export default function TimelinePage() {
  redirect("/events");
}
