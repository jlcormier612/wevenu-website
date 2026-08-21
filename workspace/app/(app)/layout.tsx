import { AppShell } from "@/components/layout/app-shell";
import { warmLiveStore } from "@shared/relationships";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await warmLiveStore();
  } catch (error) {
    console.error("[crm] warmLiveStore failed", error);
  }
  return <AppShell>{children}</AppShell>;
}
