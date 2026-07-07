import {
  Boxes,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileSignature,
  FileText,
  Info,
  LayoutDashboard,
  LayoutTemplate,
  type LucideIcon,
  MessagesSquare,
  MessageSquareDot,
  PartyPopper,
  Settings,
  ShieldCheck,
  Store,
  TrendingUp,
  Users,
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
  adminOnly?: boolean;
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
      { title: "Tours", href: "/tours", icon: CalendarCheck },
      { title: "Task Center", href: "/tasks", icon: ClipboardList },
      { title: "Timeline", href: "/timeline", icon: CalendarDays },
      { title: "Floor Plan", href: "/floor-plan", icon: LayoutTemplate },
    ],
  },
  {
    label: "Library",
    items: [
      { title: "Task Playbooks",       href: "/library/playbooks", icon: BookOpen },
      { title: "Contract Templates",  href: "/library/contracts", icon: FileSignature },
      { title: "Packages",            href: "/library/packages",  icon: Boxes },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Contracts", href: "/contracts", icon: FileSignature },
      { title: "Invoices",  href: "/invoices",  icon: FileText },
      { title: "Payments",  href: "/payments",  icon: CreditCard },
    ],
  },
  {
    label: "Communication",
    items: [
      { title: "Messaging",    href: "/messaging", icon: MessagesSquare },
      { title: "Venue Guide",  href: "/guide",     icon: Info },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Insights", href: "/analytics", icon: TrendingUp },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Operations", href: "/operations", icon: ShieldCheck },
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
  {
    label: "Wevenu",
    adminOnly: true,
    items: [
      { title: "Feedback Inbox", href: "/admin/feedback", icon: MessageSquareDot },
    ],
  },
];

/** Flat list of all navigable items, useful for lookups (e.g. page titles). */
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap(
  (section) => section.items,
);
