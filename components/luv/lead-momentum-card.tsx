/**
 * LeadMomentumCard — Relationship Health display on the Lead Luv tab.
 *
 * Shows three dimensions as a warm visual (filled dots, not numbers).
 * Generates a human-language summary via Luv's voice.
 * No scores displayed to the coordinator — just warmth and guidance.
 */

import { LuvHeart } from "@/components/dashboard/luv-widget";
import { generateMomentumLanguage, scoreDescriptor } from "@/lib/leads/momentum";

const DUSTY_ROSE = "#D8A7AA";

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

function DimensionRow({
  label,
  score,
  descriptor,
  color,
}: {
  label: string;
  score: number;
  descriptor: string;
  color: string;
}) {
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

export function LeadMomentumCard({
  firstName,
  commitmentScore,
  responsivenessScore,
  interestScore,
  lastContactedAt,
}: {
  firstName: string;
  commitmentScore: number;
  responsivenessScore: number;
  interestScore: number;
  lastContactedAt?: string | null;
}) {
  const daysSince = lastContactedAt
    ? Math.floor((Date.now() - new Date(lastContactedAt).getTime()) / 86_400_000)
    : null;

  const summary = generateMomentumLanguage(
    firstName, commitmentScore, responsivenessScore, interestScore, daysSince,
  );

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{
        borderColor: `${DUSTY_ROSE}30`,
        background: `color-mix(in oklch, ${DUSTY_ROSE} 4%, var(--card))`,
      }}
    >
      <div className="flex items-center gap-1.5">
        <LuvHeart size={14} />
        <p className="text-sm font-semibold text-heading">Relationship Health</p>
      </div>

      <div>
        <DimensionRow
          label="Interest"
          score={interestScore}
          descriptor={scoreDescriptor("interest", interestScore)}
          color="#C7A66A"  // amber for interest (active engagement)
        />
        <DimensionRow
          label="Responsiveness"
          score={responsivenessScore}
          descriptor={scoreDescriptor("responsiveness", responsivenessScore)}
          color="#5D6F5D"  // heritage sage for responsiveness
        />
        <DimensionRow
          label="Commitment"
          score={commitmentScore}
          descriptor={scoreDescriptor("commitment", commitmentScore)}
          color="#B9D1C2"  // soft sage for commitment (milestones = calm progress)
        />
      </div>

      {summary && (
        <div
          className="rounded-lg px-3 py-2.5 flex items-start gap-2"
          style={{ background: `${DUSTY_ROSE}10`, border: `1px solid ${DUSTY_ROSE}20` }}
        >
          <LuvHeart size={12} />
          <p className="text-xs text-heading leading-relaxed">{summary}</p>
        </div>
      )}
    </div>
  );
}
