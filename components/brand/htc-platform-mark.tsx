import { cn } from "@/lib/utils";
import { HTC_LOGO_ALT, HTC_LOGO_PUBLIC_PATH } from "@/shared/brand/logo";

/** Modest Hello to Cheers mark for public/customer-facing form chrome. */
export function HtcPlatformMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex justify-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={HTC_LOGO_PUBLIC_PATH}
        alt={HTC_LOGO_ALT}
        className="h-8 w-auto max-w-[160px] object-contain opacity-80"
      />
    </div>
  );
}
