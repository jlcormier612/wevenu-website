import { CustomPricingConsole } from "@/components/custom-pricing/custom-pricing-console";
import { PageHeader } from "@/components/shared/ui";

export default function CustomPricingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Commercial"
        title="Custom pricing"
        description="Create, preview, schedule, and end venue-scoped special pricing. Founding, Weven, and group benefits stay preserved; the customer always receives the single best eligible recurring amount."
      />
      <CustomPricingConsole />
    </div>
  );
}
