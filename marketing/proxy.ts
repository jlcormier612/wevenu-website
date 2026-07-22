import { NextResponse, type NextRequest } from "next/server";

/**
 * Marketing site has no session auth. Pass-through proxy so raising
 * turbopack.root to the monorepo parent does not pick up the product
 * app's Supabase session proxy.
 */
export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
