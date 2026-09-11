/**
 * Hello to Cheers Planning Template starter masters.
 */
export type PlaybookStarterMasterKey = "PB-CLIENT-01" | "PB-VENUE-01";

export type PlaybookStarterMaster = {
  key: PlaybookStarterMasterKey;
  kind: "client" | "venue";
  name: string;
  description: string;
};

export const PLAYBOOK_STARTER_MASTERS: readonly PlaybookStarterMaster[] = [
  {
    key: "PB-CLIENT-01",
    kind: "client",
    name: "Standard Wedding — Client Planning",
    description: "A client-facing checklist from booking through post-event, ready for your venue to customize.",
  },
  {
    key: "PB-VENUE-01",
    kind: "venue",
    name: "Standard Wedding — Venue Planning",
    description: "An internal team checklist from booking through post-event, ready for your venue to customize.",
  },
];

export function getPlaybookStarterMaster(key: string): PlaybookStarterMaster | undefined {
  return PLAYBOOK_STARTER_MASTERS.find((m) => m.key === key);
}
