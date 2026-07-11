import {
  Boxes,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileSignature,
  FileText,
  GitBranch,
  Inbox as InboxIcon,
  Info,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  type LucideIcon,
  MessageSquareDot,
  MessageSquareText,
  Package,
  Repeat,
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
      { title: "Calendar",  href: "/calendar",   icon: CalendarDays },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { title: "Prospects", href: "/leads", icon: Workflow },
    ],
  },
  {
    label: "Bookings",
    items: [
      { title: "Clients", href: "/clients", icon: Users },
    ],
  },
  {
    label: "Communication",
    items: [
      { title: "Inbox",             href: "/messaging",               icon: InboxIcon },
      { title: "Message Templates", href: "/communication/templates", icon: MessageSquareText },
      { title: "Automations",       href: "/communication/series",    icon: Repeat },
    ],
  },
  {
    label: "To Do's",
    items: [
      { title: "Tours",       href: "/tours", icon: CalendarCheck },
      { title: "Task Center", href: "/tasks", icon: ClipboardList },
    ],
  },
  {
    label: "Resources/Templates",
    items: [
      { title: "Vendors",     href: "/vendors",                    icon: Store },
      { title: "Planning",    href: "/library/playbooks",          icon: BookOpen },
      { title: "Timelines",   href: "/library/timeline-templates", icon: CalendarClock },
      { title: "Pipelines",   href: "/library/pipeline-templates", icon: GitBranch },
      { title: "Contracts",   href: "/library/contracts",          icon: FileSignature },
      { title: "Packages",    href: "/library/packages",           icon: Boxes },
      { title: "Floor Plans", href: "/library/floor-plan-templates", icon: LayoutGrid },
      { title: "Inventory", href: "/library/inventory", icon: Package },
    ],
  },
  {
    label: "Financials",
    items: [
      { title: "Event Contracts", href: "/contracts", icon: FileSignature },
      { title: "Invoices",        href: "/invoices",  icon: FileText },
      { title: "Payments",        href: "/payments",  icon: CreditCard },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Settings",    href: "/settings",    icon: Settings },
      { title: "Venue Guide", href: "/guide",       icon: Info },
      { title: "Analytics",   href: "/analytics",   icon: TrendingUp },
      { title: "Insights",    href: "/operations",  icon: ShieldCheck },
      { title: "Requests (Internal)", href: "/requests", icon: ListChecks },
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
