import {
  BarChart3,
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
  GraduationCap,
  Inbox as InboxIcon,
  Info,
  LayoutDashboard,
  LayoutGrid,
  Library,
  ListChecks,
  type LucideIcon,
  MessageSquareDot,
  MessageSquareText,
  Package,
  QrCode,
  Repeat,
  Settings,
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
 * Workspace navigation model.
 *
 * Each entry maps to an EMPTY placeholder page for a future module (Sprint 1
 * builds navigation + shells only — no business functionality). The structure
 * mirrors the modules defined in the Hello to Cheers Product Blueprint (Book 3).
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Reports",   href: "/reporting",  icon: BarChart3 },
      { title: "Calendar",  href: "/calendar",   icon: CalendarDays },
      { title: "Help & Guides", href: "/help", icon: GraduationCap },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { title: "Leads", href: "/leads", icon: Workflow },
    ],
  },
  {
    label: "Clients",
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
      { title: "Library",     href: "/library",                    icon: Library },
      { title: "Vendors",     href: "/vendors",                    icon: Store },
      { title: "Planning",    href: "/library/playbooks",          icon: BookOpen },
      { title: "Timelines",   href: "/library/timeline-templates", icon: CalendarClock },
      { title: "Pipelines",   href: "/library/pipeline-templates", icon: GitBranch },
      { title: "Contract Templates", href: "/library/contracts",   icon: FileSignature },
      { title: "Packages",    href: "/library/packages",           icon: Boxes },
      { title: "Floor Plans", href: "/library/floor-plan-templates", icon: LayoutGrid },
      { title: "Inventory", href: "/library/inventory", icon: Package },
      { title: "QR Campaigns", href: "/library/qr-campaigns", icon: QrCode },
    ],
  },
  {
    label: "Financials",
    items: [
      { title: "Contracts",       href: "/contracts", icon: FileSignature },
      { title: "Invoices",        href: "/invoices",  icon: FileText },
      { title: "Payments",        href: "/payments",  icon: CreditCard },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Settings",    href: "/settings",    icon: Settings },
      { title: "Venue Guide", href: "/guide",       icon: Info },
      { title: "Requests", href: "/requests", icon: ListChecks },
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
