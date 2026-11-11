import { OrganizationsConsole } from "@/components/organizations/organizations-console";

export const metadata = { title: "Organizations — Founder CRM" };

export default function OrganizationsPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
        <p className="text-muted-foreground text-sm">
          Multi-venue billing organizations, group eligibility, and pending
          adjustments (Phase 4).
        </p>
      </div>
      <OrganizationsConsole />
    </div>
  );
}
