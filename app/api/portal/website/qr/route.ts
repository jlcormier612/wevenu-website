import { NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url") ?? "";
  if (!url) return NextResponse.json({ error: "Missing url." }, { status: 400 });

  try {
    // Generate as SVG (no canvas dependency, works in Edge runtime)
    const svg = await QRCode.toString(url, {
      type: "svg",
      margin: 2,
      color: { dark: "#1A1A1A", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    });

    return new NextResponse(svg, {
      headers: {
        "content-type": "image/svg+xml",
        "cache-control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "QR generation failed." }, { status: 500 });
  }
}
