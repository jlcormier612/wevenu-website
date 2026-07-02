export type PeriodMetrics = {
  leads: number;
  tours: number;
  booked: number;
  paymentsCollected: number;
};

export type WeekMetrics = {
  leads: number;
  tours: number;
};

export type VenueTrends = {
  currentMonth: PeriodMetrics;
  priorMonth:   PeriodMetrics;
  currentWeek:  WeekMetrics;
  priorWeek:    WeekMetrics;
  insights: {
    bestTourDay:           string | null;
    bestTourDayRate:       number | null;
    avgTourConversionRate: number | null;
  };
};
