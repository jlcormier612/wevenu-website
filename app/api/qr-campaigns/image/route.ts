/**
 * QR campaign image generation. Same qrcode package as portal website QR.
 * Supports SVG (default) and PNG for print/download.
 */
import { NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const url = params.get("url") ?? "";
  const format = (params.get("format") ?? "svg").toLowerCase();
  if (!url) return NextResponse.json({ error: "Missing url." }, { status: 400 });

  try {
    if (format === "png") {
      const png = await QRCode.toBuffer(url, {
        type: "png",
        margin: 2,
        width: 1024,
        color: { dark: "#1A1A1A", light: "#FFFFFF" },
        errorCorrectionLevel: "M",
      });
      return new NextResponse(new Uint8Array(png), {
        headers: {
          "content-type": "image/png",
          "cache-control": "public, max-age=86400",
          "content-disposition": 'attachment; filename="qr-code.png"',
        },
      });
    }

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
