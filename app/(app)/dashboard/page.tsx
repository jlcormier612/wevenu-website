import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Welcome to your venue workspace."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Foundation ready</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            The Wevenu application foundation is in place: authentication,
            navigation, theming and a responsive workspace shell.
          </p>
          <p>
            Business modules — CRM, Calendar, Events, Payments and more — will be
            built in upcoming sprints. Use the navigation to explore where each
            module will live.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
