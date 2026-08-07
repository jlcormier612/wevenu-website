import Link from "next/link";
import { notFound } from "next/navigation";

import { LuvMark } from "@/components/luv/luv-mark";
import { LuvRelationshipAdvisor } from "@/components/luv/luv-relationship-advisor";
import { LegalComplianceCard } from "@/components/relationships/legal-compliance-card";
import { LifecycleActions } from "@/components/relationships/lifecycle-actions";
import { ProductSyncPanel } from "@/components/relationships/product-sync-panel";
import {
  RelationshipDetails,
  RelationshipSnapshot,
  RelationshipTimeline,
  SecondaryLists,
  CustomerSuccessPanels,
  resolveSnapshotMode,
  type SnapshotPreferredView,
} from "@/components/relationships/relationship-workspace";
import { fetchLegalComplianceViaProduct } from "@/lib/legal/product-legal";
import { StatusMoveControl } from "@/components/relationships/status-move-control";
import { SupportResolveControl } from "@/components/relationships/support-resolve-control";
import { Panel, StatusPill } from "@/components/shared/ui";
import { LogWalkthroughForm } from "@/components/walkthroughs/log-walkthrough-form";
import {
  EnrollSequenceButton,
  SequenceEnrollmentControls,
} from "@/components/sequences/sequence-controls";
import {
  EnrollWorkflowButton,
  WorkflowRunControls,
} from "@/components/workflows/workflow-controls";
import {
  getCommunications,
  getDocuments,
  getInvoices,
  getOnboardingMilestones,
  getRelationship,
  getSubscriptions,
  getTasks,
  getTeamMembers,
  getTimelineForRelationship,
} from "@/lib/data/store";
import { loadLuvRelationshipAdvisor } from "@/lib/luv/load";
import { isInCustomerSuccessView } from "@/lib/sales-cs";
import { tickWorkflows } from "@/lib/program3/engine";
import { tickSequences } from "@/lib/program3/sequence-engine";
import {
  appendRelationshipPatch,
  ensureProgram3Data,
  getSequenceEnrollmentsSync,
  getSequencesSync,
  getWorkflowRunsSync,
  getWorkflowsSync,
} from "@/lib/program3/store";
import { actorCan, getActingMember } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";
import { ensureWhiteGloveChecklistsInWorkspace } from "@/lib/white-glove/ensure-checklist";
import { formatDateTime } from "@/lib/utils";
import {
  clearRelationshipAutoArrival,
  hasLiveRelationshipsSync,
  refreshRelationshipHealth,
  tickRenewalStageForRelationship,
} from "@shared/relationships";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const relationship = getRelationship(id);
  return {
    title: relationship ? relationship.venue.name : "Relationship",
  };
}

export default async function RelationshipDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; panel?: string }>;
}) {
  const { id } = await params;
  const { from, panel } = await searchParams;
  const preferredView: SnapshotPreferredView | undefined =
    from === "sales" || from === "customer-success" ? from : undefined;
  const focusSupport = panel === "support";
  await ensureProgram4Data();
  await ensureProgram3Data();
  await ensureWhiteGloveChecklistsInWorkspace();
  await tickWorkflows(getRelationship);
  await tickSequences(getRelationship);
  await refreshRelationshipHealth(id).catch(() => null);
  if (hasLiveRelationshipsSync()) {
    await tickRenewalStageForRelationship(id).catch(() => null);
  }

  // Opening from Sales / CS acknowledges any auto-arrival highlight on this record.
  if (preferredView) {
    if (hasLiveRelationshipsSync()) {
      await clearRelationshipAutoArrival(id).catch(() => null);
    }
    await appendRelationshipPatch({
      relationshipId: id,
      lastAutoArrival: null,
      updatedAt: new Date().toISOString(),
    }).catch(() => null);
  }

  const relationship = getRelationship(id);
  if (!relationship) notFound();

  const actor = await getActingMember();
  const { insights, drafts, actorFirstName } = loadLuvRelationshipAdvisor(
    relationship,
    actor,
  );
  const canVerifyWelcomeBack = await actorCan("manage_welcome_back");
  const canProvisionProduct = await actorCan("manage_product_sync");
  const canManageWalkthroughs = await actorCan("manage_walkthroughs");
  const canEditRelationships = await actorCan("edit_relationships");
  const canManageOnboarding = await actorCan("manage_onboarding");
  const canViewFinance = await actorCan("view_finance");
  const canManageCommunications = await actorCan("manage_communications");
  const canResolveSupport = canEditRelationships || canManageCommunications;
  const canOwnerTools = canEditRelationships || canManageCommunications;
  const showWelcomeBackActions =
    canVerifyWelcomeBack &&
    relationship.welcomeBackRequested &&
    relationship.welcomeBackVerified === "pending";
  const openFeedbackItems = (relationship.openFeedbackItems ?? []).filter(
    (i) => i.status === "open",
  );
  const showSupportPanel =
    (relationship.supportOpenCount || 0) > 0 || openFeedbackItems.length > 0;

  const timeline = getTimelineForRelationship(id);
  const tasks = getTasks({ relationshipId: id });
  const communications = getCommunications({ relationshipId: id });
  const documents = getDocuments(id);
  const invoices = getInvoices(id);
  const subscriptions = getSubscriptions(id);
  const milestones = getOnboardingMilestones(id);
  const legalCompliance = await fetchLegalComplianceViaProduct({
    subject: "venue",
    relationshipId: id,
    email: relationship.owner.email,
  });
  const workflows = getWorkflowsSync();
  const runs = getWorkflowRunsSync({ relationshipId: id });
  const sequences = getSequencesSync();
  const sequenceEnrollments = getSequenceEnrollmentsSync({ relationshipId: id });
  const teamOptions = getTeamMembers().map((m) => ({ id: m.id, name: m.name }));
  const pipelineBucket = isInCustomerSuccessView(relationship)
    ? ("customers" as const)
    : ("prospects" as const);
  const backHref = isInCustomerSuccessView(relationship)
    ? "/customer-success"
    : "/sales";
  const backLabel = isInCustomerSuccessView(relationship)
    ? "← Customer Success"
    : "← Sales";
  /** Same hard switch as snapshot: subscribed wins; Sales / !subscribed hides customer-only controls. */
  const showCustomerActions =
    resolveSnapshotMode(relationship, preferredView) === "cs";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-block text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
        >
          {backLabel}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          {canManageWalkthroughs && !showCustomerActions ? (
            <LogWalkthroughForm
              relationships={[]}
              teamMembers={teamOptions}
              defaultRelationshipId={id}
              compact
            />
          ) : null}
          <span className="inline-flex items-center gap-1.5 text-xs tracking-wide text-[var(--dusty-rose)]">
            <LuvMark size={11} />
            Luv advising
          </span>
        </div>
      </div>

      <RelationshipSnapshot
        relationship={relationship}
        preferredView={preferredView}
        canVerifyWelcomeBack={canVerifyWelcomeBack}
      />
      <LuvRelationshipAdvisor
        venueName={relationship.venue.name}
        insights={insights}
        drafts={drafts}
        actorFirstName={actorFirstName}
        showWelcomeBackVerify={showWelcomeBackActions}
      />
      {showSupportPanel ? (
        <SupportResolveControl
          relationshipId={id}
          venueName={relationship.venue.name}
          ownerEmail={relationship.owner.email}
          ownerFirstName={relationship.owner.firstName}
          openCount={relationship.supportOpenCount || 0}
          items={(relationship.openFeedbackItems ?? []).map((i) => ({
            id: i.id,
            type: i.type,
            subject: i.subject,
            body: i.body,
            createdAt: i.createdAt,
            status: i.status,
          }))}
          autoFocus={focusSupport}
          canAct={canResolveSupport}
        />
      ) : null}
      <LifecycleActions
        relationshipId={id}
        planId={relationship.planId}
        onboardingType={relationship.onboardingType}
        status={relationship.status}
        hasStripeCustomer={Boolean(relationship.stripeCustomerId)}
        showCustomerActions={showCustomerActions}
        canSendLink={canEditRelationships}
        canManualSub={canProvisionProduct}
        canLaunch={canManageOnboarding || canProvisionProduct}
        canSuspend={canProvisionProduct}
        canManageBilling={canEditRelationships || canViewFinance}
        canOwnerTools={canOwnerTools}
        ownerEmail={relationship.owner.email}
        ownerFirstName={relationship.owner.firstName}
        venueName={relationship.venue.name}
      />
      <StatusMoveControl relationship={relationship} />
      <CustomerSuccessPanels relationship={relationship} />
      <LegalComplianceCard summary={legalCompliance} />
      {showCustomerActions ? (
        <ProductSyncPanel
          relationshipId={id}
          productSync={relationship.productSync}
          canProvision={canProvisionProduct}
        />
      ) : null}
      <EnrollSequenceButton
        relationshipId={id}
        sequences={sequences}
        pipelineBucket={pipelineBucket}
      />
      <EnrollWorkflowButton relationshipId={id} workflows={workflows} />

      {sequenceEnrollments.length > 0 ? (
        <Panel title="Sequence enrollments">
          <ul className="space-y-4">
            {sequenceEnrollments.map((enrollment) => (
              <li
                key={enrollment.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--taupe-medium)_30%,transparent)] pb-4 last:border-0 last:pb-0"
              >
                <div>
                  <Link
                    href="/sequences"
                    className="font-medium hover:text-[var(--heritage-sage)]"
                  >
                    {enrollment.sequenceName}
                  </Link>
                  <p className="text-sm ws-muted">
                    {formatDateTime(enrollment.enrolledAt)} · step{" "}
                    {Math.min(
                      enrollment.currentStepIndex + 1,
                      enrollment.steps.length,
                    )}
                    /{enrollment.steps.length}
                  </p>
                </div>
                <SequenceEnrollmentControls enrollment={enrollment} />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {runs.length > 0 ? (
        <Panel title="Workflow runs">
          <ul className="space-y-4">
            {runs.map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--taupe-medium)_30%,transparent)] pb-4 last:border-0 last:pb-0"
              >
                <div>
                  <Link
                    href={`/workflows/${run.workflowId}?run=${run.id}`}
                    className="font-medium hover:text-[var(--heritage-sage)]"
                  >
                    {run.workflowName}
                  </Link>
                  <p className="text-sm ws-muted">
                    {formatDateTime(run.enrolledAt)} · step {run.currentStepIndex + 1}/
                    {run.steps.length}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill>{run.status}</StatusPill>
                  <WorkflowRunControls run={run} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <RelationshipTimeline events={timeline} />
      <RelationshipDetails relationship={relationship} />
      <SecondaryLists
        relationshipId={id}
        tasks={tasks}
        communications={communications}
        documents={documents}
        invoices={invoices}
        subscriptions={subscriptions}
        milestones={milestones}
      />
    </div>
  );
}
