import type { VenueAnalytics, HealthScores } from "@/lib/analytics/types";

export type LuvRollUpObservations = {
  whatIsWorking:  string;
  needsAttention: string;
  opportunities:  string;
  customerLove:   string;
};

export type LuvRollUp = {
  id:           string;
  generatedAt:  string;
  observations: LuvRollUpObservations;
  modelUsed:    string;
};

export type LuvRollUpSnapshot = {
  analytics: VenueAnalytics;
  health:    HealthScores;
  period:    string;
};
