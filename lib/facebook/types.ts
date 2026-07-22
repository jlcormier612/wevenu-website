export type FacebookConnectionStatus = "needs_page_selection" | "connected" | "disconnected" | "error";

export type FacebookConnection = {
  venueId: string;
  pageId: string | null;
  pageName: string | null;
  status: FacebookConnectionStatus;
  lastHealthCheckAt: string | null;
  lastHealthCheckOk: boolean | null;
  lastError: string | null;
  connectedAt: string;
};

export type FacebookLeadForm = {
  id: string;
  formId: string;
  formName: string | null;
  isEnabled: boolean;
};

export type FacebookActionResult = { ok: true } | { ok: false; message?: string };

export type FacebookLeadLogEntry = {
  id: string;
  leadgenId: string;
  outcome: "succeeded" | "failed" | "dead_lettered";
  attemptNumber: number;
  message: string | null;
  createdAt: string;
};
