/**
 * QR campaign image generation. Same qrcode-package/SVG approach as
 * app/api/portal/website/qr/route.ts (already installed, already proven)
 * — kept as its own route rather than reusing that one, since this one is
 * an authenticated-Settings-only concern, not a public portal endpoint.
 */
import { NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url") ?? "";
  if (!url) return NextResponse.json({ error: "Missing url." }, { status: 400 });

  try {
    const svg = await QRCode.toString(url, {
      type: "svg",
      margin: 2,
      color: { dark: "#1A1A1A", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    });
    return new NextResponse(svg, {
      headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" },
    });
  } catch {
    return NextResponse.json({ error: "QR generation failed." }, { status: 500 });
  }
}
