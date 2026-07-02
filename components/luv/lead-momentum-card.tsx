"use client";

/**
 * LeadMomentumCard — Luv's Thoughts on the Lead Luv tab.
 *
 * Three confidence stages — Luv never makes judgments before she has data:
 *   Stage 1 "new"       — warm guidance, zero conclusions
 *   Stage 2 "observing" — factual observations, no scores
 *   Stage 3 "insights"  — dimension dots + momentum summary
 */

import { LuvHeart } from "@/components/dashboard/luv-widget";
import {
  generateMomentumLanguage,
  getConfidenceStage,
  getObservations,
  scoreDescriptor,
} from "@/lib/leads/momentum";

const DUSTY_ROSE = "#D8A7AA";

// ── Shared card shell ──────────────────────────────────────────────────────────

function LuvCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{
        borderColor: `${DUSTY_ROSE}30`,
        background: `color-mix(in oklch, ${DUSTY_ROSE} 4%, var(--card))`,
      }}
    >
      {children}
    </div>
  );
}

function LuvCardHeader({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <LuvHeart size={14} />
      <p className="text-sm font-semibold text-heading">{label ?? "Luv's Thoughts"}</p>
    </div>
  );
}

function LuvCallout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg px-3 py-2.5 flex items-start gap-2"
      style={{ background: `${DUSTY_ROSE}10`, border: `1px solid ${DUSTY_ROSE}20` }}
    >
      <LuvHeart size={12} />
      <p className="text-xs text-heading leading-relaxed">{children}</p>
    </div>
  );
}

// ── Stage 1: New Inquiry ───────────────────────────────────────────────────────

function NewInquiryView({ firstName }: { firstName: string }) {
  return (
    <LuvCard>
      <LuvCardHeader />

      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Couple</p>
        <p className="text-sm text-heading leading-relaxed">
          {firstName} is just beginning their planning journey. There isn&apos;t enough activity yet for me to draw any conclusions.
        </p>
      </div>

      <LuvCallout>
        No action needed yet — but couples who receive a warm, personal response early on tend to engage more deeply. This is a great moment to introduce yourself and share what makes your venue special.
      </LuvCallout>
    </LuvCard>
  );
}

// ── Stage 2: Observing ─────────────────────────────────────────────────────────

function ObservingView({
  firstName,
  interestScore,
  responsivenessScore,
  commitmentScore,
  daysSinceContact,
}: {
  firstName: string;
  interestScore: number;
  responsivenessScore: number;
  commitmentScore: number;
  daysSinceContact: number | null;
}) {
  const observations = getObservations(firstName, interestScore, responsivenessScore, commitmentScore, daysSinceContact);

  return (
    <LuvCard>
      <LuvCardHeader />

      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What I&apos;m Seeing</p>
        {observations.length > 0 ? (
          <ul className="space-y-1.5">
            {observations.map((obs, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-heading leading-relaxed">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: DUSTY_ROSE }} />
                {obs}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed">
            It&apos;s still early. I&apos;ll share more as {firstName} engages.
          </p>
        )}
      </div>

      <LuvCallout>
        It&apos;s still too early to draw firm conclusions — but the conversation is moving. A follow-up or helpful resource works well at this stage.
      </LuvCallout>
    </LuvCard>
  );
}

// ── Stage 3: True Insights ─────────────────────────────────────────────────────

function DotBar({ score, color }: { score: number; color: string }) {
  const filled = Math.round((score / 100) * 5);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full transition-all"
          style={{ backgroundColor: i < filled ? color : "var(--muted)" }}
        />
      ))}
    </div>
  );
}

function DimensionRow({ label, score, descriptor, color }: { label: string; score: number; descriptor: string; color: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border/50 last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-heading">{label}</p>
        <p className="text-xs text-muted-foreground">{descriptor}</p>
      </div>
      <DotBar score={score} color={color} />
    </div>
  );
}

function InsightsView({
  firstName,
  interestScore,
  responsivenessScore,
  commitmentScore,
  daysSinceContact,
}: {
  firstName: string;
  interestScore: number;
  responsivenessScore: number;
  commitmentScore: number;
  daysSinceContact: number | null;
}) {
  const summary = generateMomentumLanguage(firstName, commitmentScore, responsivenessScore, interestScore, daysSinceContact);

  return (
    <LuvCard>
      <LuvCardHeader label="Relationship Snapshot" />

      <div>
        <DimensionRow label="Interest" score={interestScore} descriptor={scoreDescriptor("interest", interestScore)} color="#C7A66A" />
        <DimensionRow label="Responsiveness" score={responsivenessScore} descriptor={scoreDescriptor("responsiveness", responsivenessScore)} color="#5D6F5D" />
        <DimensionRow label="Commitment" score={commitmentScore} descriptor={scoreDescriptor("commitment", commitmentScore)} color="#B9D1C2" />
      </div>

      {summary && <LuvCallout>{summary}</LuvCallout>}
    </LuvCard>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export function LeadMomentumCard({
  firstName,
  commitmentScore,
  responsivenessScore,
  interestScore,
  lastContactedAt,
  createdAt,
}: {
  firstName: string;
  commitmentScore: number;
  responsivenessScore: number;
  interestScore: number;
  lastContactedAt?: string | null;
  createdAt?: string | null;
}) {
  const daysSince = lastContactedAt
    ? Math.floor((Date.now() - new Date(lastContactedAt).getTime()) / 86_400_000)
    : null;

  const daysOld = createdAt
    ? Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
    : null;

  const stage = getConfidenceStage(interestScore, responsivenessScore, commitmentScore);

  // Force "new" stage if the lead is very young regardless of score thresholds
  const effectiveStage = (daysOld !== null && daysOld <= 3 && stage === "observing") ? "new" : stage;

  if (effectiveStage === "new") {
    return <NewInquiryView firstName={firstName} />;
  }

  if (effectiveStage === "observing") {
    return (
      <ObservingView
        firstName={firstName}
        interestScore={interestScore}
        responsivenessScore={responsivenessScore}
        commitmentScore={commitmentScore}
        daysSinceContact={daysSince}
      />
    );
  }

  return (
    <InsightsView
      firstName={firstName}
      interestScore={interestScore}
      responsivenessScore={responsivenessScore}
      commitmentScore={commitmentScore}
      daysSinceContact={daysSince}
    />
  );
}
