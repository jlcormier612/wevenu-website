import { redirect } from "next/navigation";

import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Protected layout for the venue workspace. Confirms an authenticated session
 * (defense in depth alongside the proxy) before rendering the shell.
 */
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <WorkspaceShell email={user.email ?? ""}>{children}</WorkspaceShell>;
}
