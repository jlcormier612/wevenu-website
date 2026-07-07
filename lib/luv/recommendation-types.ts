// cta.type = "navigate" in Sprint 100.
// Sprint 101 adds "generate" without any schema change — it drops in here.
export type RecommendationCtaType = "navigate" | "generate" | "action";

export type RecommendationCta = {
  label:  string;
  target: string;
  type:   RecommendationCtaType;
};

export type VenueRecommendation = {
  id:          string;
  insightId:   string | null;
  type:        string;
  title:       string;
  body:        string;
  priority:    number;
  ctas:        RecommendationCta[];
  metadata:    Record<string, unknown>;
  dismissedAt: string | null;
  completedAt: string | null;
  expiresAt:   string | null;
  createdAt:   string;
};

export type RawRecommendationRow = {
  id:           string;
  insight_id:   string | null;
  type:         string;
  title:        string;
  body:         string;
  priority:     number;
  ctas:         RecommendationCta[];
  metadata:     Record<string, unknown>;
  dismissed_at: string | null;
  completed_at: string | null;
  expires_at:   string | null;
  created_at:   string;
};
