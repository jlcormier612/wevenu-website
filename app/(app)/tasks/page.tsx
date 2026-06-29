import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/shell/module-placeholder";

export const metadata: Metadata = { title: "Task Center" };

export default function TasksPage() {
  return (
    <ModulePlaceholder
      title="Task Center"
      description="Your live event workspace — overdue tasks, due today, due this week, and blocked items across all events."
    />
  );
}
