import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * A small in-page link out to a prescriptive setup guide (lib/help-guides).
 * Contextual help belongs on the screen where the question comes up, not
 * only inside Setup Hub or a general help center — this is the shared
 * building block for that. Deep-link with a guide's step anchor (e.g.
 * "/help/setup-financials#stripe") when pointing at one specific step.
 */
export function SetupGuideLink({
  href,
  label = "Need help with this? Follow the step-by-step guide",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );
}
