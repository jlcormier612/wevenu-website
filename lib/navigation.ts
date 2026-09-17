import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileSignature,
  FileText,
  GraduationCap,
  FolderOpen,
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

/**
 * Stable identity for a destination. Labels are editorial and have already
 * changed once (Help & Guides → Guidance, Your People → Your Relationships);
 * ids are what code should match on so a future rewording cannot silently
 * break permission filtering or React keys.
 */
export type NavItemId =
  | "dashboard" | "reports" | "guidance"
  | "leads" | "clients" | "vendors"
  | "calendar" | "tours"
  | "inbox" | "automations"
  | "templates" | "documents"
  | "contracts" | "invoices" | "payments"
  | "task-center" | "requests"
  | "setup" | "settings" | "venue-guide" | "feedback";

export type NavSectionId =
  | "overview"
  | "relationships"
  | "scheduling"
  | "communication"
  | "library"
  | "financials"
  | "to-dos"
  | "your-venue";

export type NavItem = {
  id: NavItemId;
  title: string;
  href: string;
  icon: LucideIcon;
};

export type NavSection = {
  id: NavSectionId;
  label: string;
  items: NavItem[];
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
    id: "overview",
    label: "Overview",
    items: [
      { id: "dashboard", title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { id: "reports", title: "Reports", href: "/reporting", icon: BarChart3 },
      // "Guidance" is how to use Hello to Cheers. Distinct from Venue Guide
      // under Your Venue, which is the venue's own operational content.
      { id: "guidance", title: "Guidance", href: "/help", icon: GraduationCap },
    ],
  },
  {
    id: "relationships",
    label: "Your Relationships",
    items: [
      { id: "leads", title: "Leads", href: "/leads", icon: Workflow },
      { id: "clients", title: "Clients", href: "/clients", icon: Users },
      { id: "vendors", title: "Vendors", href: "/vendors", icon: Store },
    ],
  },
  {
    id: "scheduling",
    label: "Scheduling",
    items: [
      { id: "calendar", title: "Calendar", href: "/calendar", icon: CalendarDays },
      { id: "tours", title: "Tours", href: "/tours", icon: CalendarCheck },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    items: [
      { id: "inbox", title: "Inbox", href: "/messaging", icon: InboxIcon },
      { id: "automations", title: "Automations", href: "/communication/series", icon: Repeat },
    ],
  },
  {
    id: "library",
    label: "Library",
    items: [
      { id: "templates", title: "Templates", href: "/library", icon: Library },
      { id: "documents", title: "Documents", href: "/library/documents", icon: FolderOpen },
    ],
  },
  {
    id: "financials",
    label: "Financials",
    items: [
      { id: "contracts", title: "Contracts", href: "/contracts", icon: FileSignature },
      { id: "invoices", title: "Invoices", href: "/invoices", icon: FileText },
      { id: "payments", title: "Payments", href: "/payments", icon: CreditCard },
    ],
  },
  {
    id: "to-dos",
    label: "To Do’s",
    items: [
      { id: "task-center", title: "Task Center", href: "/tasks", icon: ClipboardList },
      { id: "requests", title: "Requests", href: "/requests", icon: ListChecks },
    ],
  },
  {
    id: "your-venue",
    label: "Your Venue",
    items: [
      { id: "setup", title: "Setup", href: "/setup-hub", icon: SquareCheckBig },
      { id: "settings", title: "Settings", href: "/settings", icon: Settings },
      { id: "venue-guide", title: "Venue Guide", href: "/guide", icon: Info },
      // "Give feedback", not "Feedback": the venue is giving it to us, and this
      // is the only entry point for that — the sidebar footer used to carry a
      // second one that skipped this page and opened the form directly.
      { id: "feedback", title: "Give feedback", href: "/feedback", icon: MessageSquareDot },
    ],
  },
];

/** Flat list of all navigable items, useful for lookups (e.g. page titles). */
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap(
  (section) => section.items,
);
