import { buildVenueExportArchive } from "@/lib/export/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await buildVenueExportArchive();
  if (!result.ok) {
    return Response.json({ message: result.message }, { status: result.status });
  }
  return new Response(Buffer.from(result.bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
