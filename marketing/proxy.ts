import { NextResponse, type NextRequest } from "next/server";

/**
 * Marketing site has no session auth. Pass-through proxy so raising
 * turbopack.root to the monorepo parent does not pick up the product
 * app's Supabase session proxy.
 *
 * Also canonicalizes www → apex (C1 AWS hosting consolidation).
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  if (host === "www.hellotocheers.com") {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = "hellotocheers.com";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
