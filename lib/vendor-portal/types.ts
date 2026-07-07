export type VendorPortalContext = {
  sessionId: string;
  accessLevel: "full" | "view_only";
  vendor: {
    id: string;
    businessName: string;
    category: string | null;
    email: string | null;
    phone: string | null;
  };
  venue: {
    id: string;
    name: string;
  };
  events: VendorEvent[];
};

export type VendorEvent = {
  eventId: string;
  eventName: string;
  eventDate: string;
  eventType: string | null;
  status: string;
  coupleNames: string;
  // Assignment details (Sprint 82)
  assignmentId: string;
  arrivalTime: string | null;
  setupLocation: string | null;
  loadInNotes: string | null;
  checkedInAt: string | null;
  setupCompleteAt: string | null;
  role: string | null;
};

export type VendorTimelineEntry = {
  id: string;
  time: string | null;
  title: string;
  description: string | null;
  audiences: string[];
};

export type VendorTask = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  visibility: "vendor_visible" | "vendor_owned";
  dueDate: string | null;
  status: string;
  isRequired: boolean;
  completedAt: string | null;
  canComplete: boolean;
};

export type VendorDocument = {
  id: string;
  name: string;
  category: string;
  storageUrl: string;
  mimeType: string | null;
  notes: string | null;
};
