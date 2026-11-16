import { redirect } from "next/navigation";

import { createClient } from "@/integrations/supabase/server";
import { resolveAuthenticatedHomePath } from "@/lib/auth/resolve-home";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Root entry point. Unauthenticated visitors are sent to login by the proxy.
 * Authenticated venue staff land on Setup Hub until onboarding is complete;
 * established venues land on Dashboard. This is the post-login home only —
 * sidebar Dashboard navigation is not redirected back to the Hub.
 */
export default async function RootPage() {
  if (!isSupabaseConfigured) redirect("/login");
  const supabase = await createClient("venue");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  redirect(await resolveAuthenticatedHomePath(supabase, user.id, { prefer: "venue" }));
}
