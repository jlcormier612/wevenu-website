import Link from "next/link";

import { publicMonthCells } from "@/lib/availability/public-calendar-month";
import type { PublicAvailabilityMonth } from "@/lib/availability/public-calendar";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function PublicAvailabilityView({ data }: { data: PublicAvailabilityMonth }) {
  const primary = data.venue.primaryColor || "#5D6F5D";
  const cells = publicMonthCells(
    data.year,
    data.month,
    new Set(data.available),
    data.today,
    data.token,
  );
  const prev = shiftMonth(data.year, data.month, -1);
  const next = shiftMonth(data.year, data.month, 1);
  const href = (year: number, month: number) =>
    `/availability/${encodeURIComponent(data.token)}?year=${year}&month=${month}`;

  return (
    <div className="min-h-screen" style={{ backgroundColor: `${primary}08` }}>
      <div className="px-4 py-8 text-center" style={{ backgroundColor: primary }}>
        {data.venue.logoUrl ? (
          <img
            src={data.venue.logoUrl}
            alt=""
            className="mx-auto mb-3 h-12 w-12 rounded-lg object-contain"
            style={{ background: "rgba(255,255,255,0.15)" }}
          />
        ) : null}
        <h1 className="text-xl font-semibold text-white">{data.venue.name}</h1>
        <p className="mt-1 text-sm text-white/80">What dates are available?</p>
      </div>

      <div className="mx-auto max-w-xl px-4 py-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Link href={href(prev.year, prev.month)} className="text-sm text-gray-600 hover:text-gray-900">
              Previous
            </Link>
            <h2 className="text-base font-semibold text-gray-900">
              {MONTHS[data.month - 1]} {data.year}
            </h2>
            <Link href={href(next.year, next.month)} className="text-sm text-gray-600 hover:text-gray-900">
              Next
            </Link>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-gray-700">
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm border" style={{ borderColor: primary, backgroundColor: `${primary}22` }} />
              Available
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm border border-gray-200 bg-gray-100" />
              Not available
            </span>
          </div>
          <p className="mb-4 text-sm text-gray-600">
            Available dates can still be requested. Not available means this venue cannot take an event that day.
            Dates are shown in {data.venue.timezone}.
          </p>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500">
            {DAYS.map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const day = Number(cell.iso.slice(8, 10));
              if (!cell.inMonth) {
                return <div key={cell.iso} className="min-h-14 rounded-md bg-transparent" />;
              }
              const body = (
                <>
                  <span className="text-sm font-medium">{day}</span>
                  <span className="text-[10px] leading-tight">
                    {cell.available ? "Available" : "Not available"}
                  </span>
                </>
              );
              if (cell.inquireHref) {
                return (
                  <Link
                    key={cell.iso}
                    href={cell.inquireHref}
                    className="flex min-h-14 flex-col items-center justify-center rounded-md border px-0.5 text-center"
                    style={{ borderColor: primary, backgroundColor: `${primary}14`, color: "#1f2937" }}
                  >
                    {body}
                    <span className="mt-0.5 text-[10px] underline">Inquire</span>
                  </Link>
                );
              }
              return (
                <div
                  key={cell.iso}
                  className={`flex min-h-14 flex-col items-center justify-center rounded-md px-0.5 text-center ${
                    cell.available
                      ? "border border-gray-200 text-gray-700"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {body}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
