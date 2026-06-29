export type VendorPortalContext = {
  sessionId: string;
  accessLevel: "full" | "view_only";
  vendor: {
    id: string;
    name: string;
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
  arrivalTime: string | null;
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
