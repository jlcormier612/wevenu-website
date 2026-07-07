export type HealthTier = "thriving" | "growing" | "needs_attention";

export type HealthDimension = {
  score:  number;
  label:  string;
  weight: number;
};

export type VenueHealthScore = {
  score:      number;
  tier:       HealthTier;
  dimensions: Record<string, HealthDimension>;
  strengths:  string[];
  gaps:       string[];
  computedAt: string;
};

export type RawHealthRow = {
  score:       number;
  tier:        HealthTier;
  dimensions:  Record<string, HealthDimension>;
  strengths:   string[];
  gaps:        string[];
  computed_at: string;
};
