export type LeadFunnel = {
  total: number;
  contacted: number;
  toured: number;
  proposal: number;
  booked: number;
  lost: number;
  conversionRate: number;
  bySource: { source: string; total: number; booked: number; rate: number }[];
};

export type EventsMetrics = {
  total: number;
  upcoming: number;
  thisMonth: number;
  nextMonth: number;
  avgGuestCount: number;
  byMonth: { month: string; label: string; count: number }[];
};

export type PaymentsMetrics = {
  totalOutstanding: number;
  totalOverdue: number;
  overdueCount: number;
  totalBilled: number;
  totalCollected: number;
  completionRate: number;
};

export type FeatureAdoption = {
  totalActiveEvents: number;
  websitePublished: number;
  websiteStarted: number;
  budgetConfigured: number;
  seatingStarted: number;
  vendorsLinked: number;
  documentsUploaded: number;
  playbooksActive: number;
  guestsAdded: number;
};

export type CoupleEngagement = {
  totalActiveClients: number;
  portalAdoption: number;
  activeThisWeek: number;
  rsvpCompletionAvg: number;
};

export type VenueAnalytics = {
  leadFunnel: LeadFunnel;
  events: EventsMetrics;
  payments: PaymentsMetrics;
  featureAdoption: FeatureAdoption;
  coupleEngagement: CoupleEngagement;
};

export type HealthTier = "at_risk" | "needs_attention" | "healthy" | "champion";

export type ClientSignals = {
  atRisk: string[];
  healthy: string[];
  champion: string[];
};

export type ClientMetrics = {
  daysSinceLogin: number | null;
  hasPortal: boolean;
  guestCount: number;
  rsvpResponded: number;
  rsvpRate: number;
  websitePublished: boolean;
  websiteStarted: boolean;
  budgetConfigured: boolean;
  paymentsOverdue: number;
  tasksOverdue: number;
};

export type ClientHealthScore = {
  eventId: string;
  clientId: string;
  clientName: string;
  eventDate: string;
  daysUntilEvent: number;
  eventType: string | null;
  health: HealthTier;
  score: number;
  signals: ClientSignals;
  metrics: ClientMetrics;
};

export type HealthScores = {
  clients: ClientHealthScore[];
};
