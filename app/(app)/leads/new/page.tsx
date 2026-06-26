import type { Metadata } from "next";

import { NewInquiryForm } from "@/components/leads/new-inquiry-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "New Inquiry" };

export default function NewLeadPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New Inquiry"
        description="Record a new lead from a call, email, or walk-in."
      />
      <Card>
        <CardHeader>
          <CardTitle>Inquiry details</CardTitle>
          <CardDescription>
            Fill in what you know. Everything is editable later from the lead
            record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewInquiryForm />
        </CardContent>
      </Card>
    </div>
  );
}
