export type QrDestinationType = "inquiry_form" | "tour_booking" | "wedding_website" | "external_url";

export type QrCampaign = {
  id: string;
  venueId: string;
  name: string;
  code: string;
  destinationType: QrDestinationType;
  destinationUrl: string | null;
  status: "active" | "archived";
  createdAt: string;
};

export type QrCampaignInput = {
  name: string;
  destinationType: QrDestinationType;
  destinationUrl?: string;
};

export type QrCampaignAnalytics = {
  id: string;
  name: string;
  destinationType: QrDestinationType;
  scans: number;
  conversions: number;
};

export type QrCampaignActionResult = { ok: true; id?: string } | { ok: false; message?: string };
