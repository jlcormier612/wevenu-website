import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SalesOffersPanel } from "@/components/relationships/sales-offers-panel";
import { getRelationship } from "@/lib/data/store";
import { actorCan, getActingMember } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";
import { resolveRelationshipStandardDiscount } from "@shared/relationships";

export const metadata = { title: "Custom Offer" };

export default async function CustomOfferDetailPage({
  params,
}: {
  params: Promise<{ id: string; offerId: string }>;
}) {
  await ensureProgram4Data();
  const actor = await getActingMember();
  if (!actor) redirect("/login");

  const { id, offerId } = await params;
  const relationship = getRelationship(id);
  if (!relationship) notFound();

  const canManage = await actorCan("manage_product_sync");
  if (!canManage && actor.role !== "owner" && actor.role !== "administrator") {
    redirect(`/relationships/${id}`);
  }

  const standardDiscount = resolveRelationshipStandardDiscount(relationship);
  const returnHref = `/relationships/${id}`;

  return (
    <div className="space-y-4">
      <Link
        href={returnHref}
        className="inline-block text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
      >
        ← Back to {relationship.venue.name}
      </Link>
      <SalesOffersPanel
        relationshipId={id}
        venueName={relationship.venue.name}
        ownerName={`${relationship.owner.firstName} ${relationship.owner.lastName}`.trim()}
        ownerEmail={relationship.owner.email}
        planId={relationship.planId}
        canManage
        dedicatedPage
        initialOfferId={offerId}
        returnHref={returnHref}
        foundingMember={Boolean(relationship.foundingMember)}
        welcomeBackRequested={Boolean(relationship.welcomeBackRequested)}
        welcomeBackVerified={relationship.welcomeBackVerified}
        relationshipStandardDiscountEligibility={standardDiscount.eligibility}
      />
    </div>
  );
}
