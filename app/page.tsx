import { redirect } from "next/navigation";

/**
 * Root entry point. Routing to the workspace is delegated to the proxy, which
 * sends unauthenticated visitors to the login screen.
 */
export default function RootPage() {
  redirect("/dashboard");
}
