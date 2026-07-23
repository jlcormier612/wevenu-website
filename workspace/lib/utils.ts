import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type {
  OnboardingType,
  PlanId,
  RelationshipHealth,
  RelationshipStatus,
  TaskPriority,
  TaskStatus,
  WalkthroughStatus,
  WelcomeBackVerifiedStatus,
} from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...opts,
  }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Relative-ish labels for the snapshot ("Yesterday", "3 days ago", etc.). */
export function formatRelativeDay(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfThat = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfThat.getTime()) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  if (diffDays === -1) return "Tomorrow";
  if (diffDays < 0 && diffDays > -7) return `In ${Math.abs(diffDays)} days`;
  return formatDate(iso, { year: undefined });
}

export const STATUS_LABELS: Record<RelationshipStatus, string> = {
  inquiry: "Inquiry",
  walkthrough_requested: "Walkthrough Requested",
  walkthrough_scheduled: "Walkthrough Scheduled",
  walkthrough_completed: "Walkthrough Completed",
  trial: "Trial",
  subscribed: "Subscribed",
  onboarding: "Onboarding",
  white_glove_implementation: "White Glove Implementation",
  active: "Active",
  at_risk: "At Risk",
  suspended: "Suspended",
  reactivated: "Reactivated",
  live: "Active",
  active_customer: "Active",
  expansion: "Expansion",
  referral: "Referral",
  renewal: "Renewal",
  support: "Support",
  former_customer: "Former Customer",
};

export const HEALTH_LABELS: Record<RelationshipHealth, string> = {
  excellent: "Excellent",
  good: "Good",
  needs_attention: "Needs Attention",
  at_risk: "At Risk",
};

export const HEALTH_EMOJI: Record<RelationshipHealth, string> = {
  excellent: "💚",
  good: "🌿",
  needs_attention: "🟡",
  at_risk: "🔴",
};

export const PLAN_LABELS: Record<PlanId, string> = {
  gather: "Gather",
  celebrate: "Celebrate",
  flourish: "Flourish",
  none: "—",
};

export const ONBOARDING_LABELS: Record<OnboardingType, string> = {
  self_guided: "Self-Guided",
  white_glove: "White Glove",
  none: "—",
};

export const WELCOME_BACK_LABELS: Record<WelcomeBackVerifiedStatus, string> = {
  none: "—",
  pending: "Pending",
  verified: "Welcome Back verified",
  rejected: "Rejected",
  expired: "Expired",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const WALKTHROUGH_STATUS_LABELS: Record<WalkthroughStatus, string> = {
  upcoming: "Upcoming",
  completed: "Completed",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
};

export function yesNo(value: boolean): "Yes" | "No" {
  return value ? "Yes" : "No";
}
