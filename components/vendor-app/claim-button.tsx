"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { claimVendorProfileAction } from "@/app/vendor/actions";

export function ClaimButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function handleClaim() {
    startTransition(async () => {
      const result = await claimVendorProfileAction(token);
      if (result.ok) {
        toast.success("Profile claimed! Welcome to Wevenu.");
        router.push("/vendor/dashboard");
      } else {
        toast.error(result.message ?? "Could not claim profile. Please try again.");
      }
    });
  }

  return (
    <Button onClick={handleClaim} disabled={pending} size="lg">
      {pending ? (
        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Claiming…</>
      ) : (
        "Claim My Profile"
      )}
    </Button>
  );
}
