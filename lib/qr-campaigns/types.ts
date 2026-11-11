export type QrDestinationType =
  | "inquiry_form"
  | "tour_booking"
  | "wedding_website"
  | "external_url"
  | "public_form";

export type QrCampaign = {
  id: string;
  venueId: string;
  name: string;
  code: string;
  destinationType: QrDestinationType;
  destinationUrl: string | null;
  /** Set when destinationType is public_form. */
  publicFormId: string | null;
  status: "active" | "archived";
  sourceMasterKey: string | null;
  createdAt: string;
};

export type QrCampaignInput = {
  name: string;
  destinationType: QrDestinationType;
  destinationUrl?: string;
  publicFormId?: string;
};

export type QrCampaignAnalytics = {
  id: string;
  name: string;
  destinationType: QrDestinationType;
  scans: number;
  conversions: number;
};

export type QrCampaignActionResult = { ok: true; id?: string } | { ok: false; message?: string };
