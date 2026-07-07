export type InsightConfidence = "low" | "medium" | "high";
export type InsightType = "seasonal_concentration" | "inquiry_pacing" | "momentum";

export type RawInsightRow = {
  id:               string;
  type:             string;
  title:            string;
  body:             string;
  confidence:       InsightConfidence;
  confidence_score: number;
  evidence:         Record<string, unknown>;
  is_actionable:    boolean;
  computed_at:      string;
  expires_at:       string | null;
};
