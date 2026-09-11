/**
 * Hello to Cheers QR Campaign starter masters.
 * Persistent master keys — starters remain available even when campaigns exist.
 */
export type QrStarterMasterKey = "QR-01" | "QR-02" | "QR-03";

export type QrStarterMaster = {
  key: QrStarterMasterKey;
  name: string;
  description: string;
  destinationType: "inquiry_form" | "tour_booking";
  destinationLabel: string;
};

export const QR_STARTER_MASTERS: readonly QrStarterMaster[] = [
  {
    key: "QR-01",
    name: "Bridal Show Lead Capture",
    description: "A ready-to-name starting point for printed signage at bridal shows and open houses.",
    destinationType: "inquiry_form",
    destinationLabel: "Inquiry form",
  },
  {
    key: "QR-02",
    name: "Front Gate Lead Capture",
    description: "A simple starting point for a permanent sign that turns venue visits into inquiries.",
    destinationType: "tour_booking",
    destinationLabel: "Tour booking",
  },
  {
    key: "QR-03",
    name: "Brochure QR",
    description: "A starting point for printed brochures that sends a prospective couple into your lead journey.",
    destinationType: "inquiry_form",
    destinationLabel: "Inquiry form",
  },
];

export function getQrStarterMaster(key: string): QrStarterMaster | undefined {
  return QR_STARTER_MASTERS.find((m) => m.key === key);
}
