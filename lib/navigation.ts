import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileSignature,
  FileText,
  GraduationCap,
  Inbox as InboxIcon,
  Info,
  LayoutDashboard,
  Library,
  ListChecks,
  type LucideIcon,
  MessageSquareDot,
  Repeat,
  Settings,
  SquareCheckBig,
  Store,
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
 * Workspace navigation model — venue-wide operational destinations.
 *
 * Global nav groups live work and venue operations. Reusable definitions
 * live under Library (internal organization only). Relationship/event-
 * specific work lives in Client/Event workspaces.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Reports", href: "/reporting", icon: BarChart3 },
      { title: "Calendar", href: "/calendar", icon: CalendarDays },
      { title: "Help & Guides", href: "/help", icon: GraduationCap },
    ],
  },
  {
    label: "Sales",
    items: [
      { title: "Leads", href: "/leads", icon: Workflow },
      { title: "Tours", href: "/tours", icon: CalendarCheck },
    ],
  },
  {
    label: "Clients",
    items: [
      { title: "Clients", href: "/clients", icon: Users },
      { title: "Vendors", href: "/vendors", icon: Store },
    ],
  },
  {
    label: "Communication",
    items: [
      { title: "Messages", href: "/messaging", icon: InboxIcon },
      { title: "Automations", href: "/communication/series", icon: Repeat },
    ],
  },
  {
    label: "Tasks",
    items: [
      { title: "Task Center", href: "/tasks", icon: ClipboardList },
      { title: "Requests", href: "/requests", icon: ListChecks },
    ],
  },
  {
    label: "Financials",
    items: [
      { title: "Contracts", href: "/contracts", icon: FileSignature },
      { title: "Invoices", href: "/invoices", icon: FileText },
      { title: "Payments", href: "/payments", icon: CreditCard },
    ],
  },
  {
    label: "Library",
    items: [
      { title: "Library", href: "/library", icon: Library },
    ],
  },
  {
    label: "Your Venue",
    items: [
      { title: "Setup", href: "/setup-hub", icon: SquareCheckBig },
      { title: "Settings", href: "/settings", icon: Settings },
      { title: "Venue Guide", href: "/guide", icon: Info },
    ],
  },
  {
    label: "Help",
    adminOnly: true,
    items: [
      { title: "Feedback/Requests", href: "/admin/feedback", icon: MessageSquareDot },
    ],
  },
];

/** Flat list of all navigable items, useful for lookups (e.g. page titles). */
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap(
  (section) => section.items,
);
