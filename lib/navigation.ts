import {
  Boxes,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileSignature,
  LayoutDashboard,
  LayoutTemplate,
  type LucideIcon,
  MessagesSquare,
  PartyPopper,
  Settings,
  ShieldCheck,
  Store,
  Users,
  UserSquare2,
  Workflow,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

/**
 * Workspace navigation model.
 *
 * Each entry maps to an EMPTY placeholder page for a future module (Sprint 1
 * builds navigation + shells only — no business functionality). The structure
 * mirrors the modules defined in the Wevenu Product Blueprint (Book 3).
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Calendar", href: "/calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Relationships",
    items: [
      { title: "Leads", href: "/leads", icon: Workflow },
      { title: "Clients", href: "/clients", icon: Users },
      { title: "Vendors", href: "/vendors", icon: Store },
    ],
  },
  {
    label: "Events",
    items: [
      { title: "Events", href: "/events", icon: PartyPopper },
      { title: "Tasks", href: "/tasks", icon: ClipboardList },
      { title: "Timeline", href: "/timeline", icon: CalendarDays },
      { title: "Floor Plan", href: "/floor-plan", icon: LayoutTemplate },
    ],
  },
  {
    label: "Catalog",
    items: [
      { title: "Packages & Inventory", href: "/packages", icon: Boxes },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Contracts", href: "/contracts", icon: FileSignature },
      { title: "Payments", href: "/payments", icon: CreditCard },
    ],
  },
  {
    label: "Communication",
    items: [
      { title: "Messaging", href: "/messaging", icon: MessagesSquare },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Analytics", href: "/analytics", icon: UserSquare2 },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Operations", href: "/operations", icon: ShieldCheck },
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

/** Flat list of all navigable items, useful for lookups (e.g. page titles). */
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap(
  (section) => section.items,
);
