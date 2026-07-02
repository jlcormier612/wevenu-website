import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/module-placeholder";
import { VenueGuideEditor } from "@/components/guide/venue-guide-editor";
import { loadVenueGuideAction } from "./actions";

export const metadata: Metadata = { title: "Venue Guide" };

export default async function VenueGuidePage() {
  const initial = await loadVenueGuideAction();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Venue Guide"
        description="Everything your couples need to know — parking, policies, FAQs, and more. Couples browse this in their portal and Luv answers questions from it."
      />
      <VenueGuideEditor initial={initial} />
    </div>
  );
}
