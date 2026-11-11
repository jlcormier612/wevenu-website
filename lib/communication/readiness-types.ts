export type ReadinessState = "ready" | "not_ready" | "untested";

export type ReadinessItem = {
  key: string;
  label: string;
  state: ReadinessState;
  detail: string;
};

export type CommunicationReadiness = {
  allReady: boolean;
  items: ReadinessItem[];
  venueEmail: string | null;
  venuePhone: string | null;
  emailConfigured: boolean;
  smsConfigured: boolean;
};
