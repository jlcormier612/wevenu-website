export type ActionStatus = "pending" | "started" | "completed" | "dismissed" | "expired";

export type RawActionOutcomeRow = {
  action_id:    string;
  action_type:  string;
  started_at:   string;
  completed_at: string | null;
  metric_name:  string;
  before_value: number | null;
  after_value:  number | null;
  delta:        number | null;
  observed_at:  string;
};

export type RawPendingActionRow = {
  action_id:          string;
  action_type:        string;
  started_at:         string;
  measure_after_days: number;
};

export type RawPerformanceSummaryRow = {
  action_type:      string;
  metric_name:      string;
  total_actions:    number;
  total_outcome:    number;
  avg_outcome:      number;
  best_month_name:  string | null;
  best_month_avg:   number | null;
  worst_month_name: string | null;
  worst_month_avg:  number | null;
};
