import { type NextRequest } from "next/server";

import { updateSession } from "@/integrations/supabase/proxy";

/**
 * Next.js 16 Proxy (formerly Middleware). Runs before routes are rendered to
 * refresh the Supabase session and enforce authentication on protected routes.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, robots.txt, sitemap.xml (metadata files)
     * - public asset files (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
