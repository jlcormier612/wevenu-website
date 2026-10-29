import { Wordmark } from "@/components/brand/wordmark";
import { cn } from "@/lib/utils";

/** Canonical HTC logo chrome for White Glove customer onboarding pages. */
export function WhiteGloveBrandChrome({ className }: { className?: string }) {
  return (
    <div className={cn("mb-4 flex justify-center sm:mb-5", className)}>
      <Wordmark />
    </div>
  );
}
