/**
 * Client-safe momentum utilities — no server imports.
 * Pure functions for generating warm language from engagement scores.
 * Used by both server and client components.
 */

export type MomentumTier = "heating_up" | "cooling_off" | "neutral";

export function getMomentumTier(
  commitment: number,
  responsiveness: number,
  interest: number,
  daysSinceContact: number | null,
  status: string,
): MomentumTier {
  if (status === "won" || status === "lost" || status === "cancelled") return "neutral";
  if (interest >= 40 || (responsiveness >= 50 && commitment >= 10)) return "heating_up";
  if (commitment >= 25 && daysSinceContact !== null && daysSinceContact >= 14) return "cooling_off";
  return "neutral";
}

export function generateMomentumLanguage(
  firstName: string,
  commitment: number,
  responsiveness: number,
  interest: number,
  daysSinceContact: number | null,
): string | null {
  if (commitment >= 90) return `${firstName} has completed all major milestones — looking great.`;
  if (interest >= 50 && responsiveness >= 50) return `${firstName} is showing strong interest and has been very responsive this week.`;
  if (interest >= 50) return `${firstName} is showing strong interest right now.`;
  if (responsiveness >= 60) return `${firstName} has been highly responsive this week.`;
  if (commitment >= 50 && responsiveness >= 30) return `${firstName} is well along in the booking journey and staying engaged.`;
  if (commitment >= 30 && interest >= 30) return `${firstName} is engaged and progressing — good momentum.`;
  if (commitment >= 30 && daysSinceContact !== null && daysSinceContact >= 14) return `${firstName} may be cooling off — it may be worth a gentle follow-up.`;
  if (daysSinceContact !== null && daysSinceContact >= 21 && commitment < 20) return `${firstName} has gone quiet. A brief check-in could reignite the conversation.`;
  return null;
}

export function scoreDescriptor(dimension: "interest" | "responsiveness" | "commitment", score: number): string {
  if (dimension === "interest") {
    if (score >= 70) return "Very high — showing strong signals";
    if (score >= 40) return "Active — engaged recently";
    if (score >= 15) return "Some signals";
    return "Quiet — few signals yet";
  }
  if (dimension === "responsiveness") {
    if (score >= 60) return "Replies quickly and often";
    if (score >= 35) return "Generally responsive";
    if (score >= 15) return "Occasionally responsive";
    return "Has been quiet lately";
  }
  if (score >= 70) return "Several milestones completed";
  if (score >= 40) return "Progressing toward booking";
  if (score >= 20) return "Early stages";
  return "Just getting started";
}
