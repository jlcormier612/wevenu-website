"use client";

import * as React from "react";

import Link from "next/link";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { removeScheduleAction, setScheduleAction } from "@/app/(app)/reporting/saved-reports-actions";
import { BusinessAssetHeader } from "@/components/business-assets/asset-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DATE_RANGE_PRESETS } from "@/lib/reporting/date-range";
import { SAVED_REPORT_PATH_LABEL, type SavedReport, type SavedReportSchedule } from "@/lib/saved-reports/types";

const DAYS = [
  { value: "0", label: "Sunday" }, { value: "1", label: "Monday" }, { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" }, { value: "4", label: "Thursday" }, { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

function presetLabel(preset: string): string {
  return DATE_RANGE_PRESETS.find((p) => p.value === preset)?.label ?? preset;
}

export function SavedReportDetail({
  report, schedule, canSchedule, defaultRecipientEmail,
}: { report: SavedReport; schedule: SavedReportSchedule | null; canSchedule: boolean; defaultRecipientEmail: string }) {
  const [scheduleOn, setScheduleOn] = React.useState(!!schedule?.isActive);
  const [dayOfWeek, setDayOfWeek] = React.useState(String(schedule?.dayOfWeek ?? 1));
  const [email, setEmail] = React.useState(schedule?.recipientEmail || defaultRecipientEmail);
  const [saving, startSave] = React.useTransition();

  const qs = new URLSearchParams({ range: report.datePreset, ...(report.customFrom ? { from: report.customFrom } : {}), ...(report.customTo ? { to: report.customTo } : {}) }).toString();

  function handleToggle(next: boolean) {
    setScheduleOn(next);
    startSave(async () => {
      const result = next
        ? await setScheduleAction(report.id, Number(dayOfWeek), email)
        : await removeScheduleAction(report.id);
      if (!result.ok) { toast.error(result.message ?? "Could not update schedule."); setScheduleOn(!next); }
      else toast.success(next ? "Scheduled." : "Schedule removed.");
    });
  }

  function handleSaveSchedule() {
    startSave(async () => {
      const result = await setScheduleAction(report.id, Number(dayOfWeek), email);
      if (result.ok) toast.success("Schedule updated.");
      else toast.error(result.message ?? "Could not update schedule.");
    });
  }

  return (
    <div className="space-y-6">
      <BusinessAssetHeader
        backHref="/reporting/saved"
        backLabel="Saved Reports"
        whatIsThis="Saved Report"
        title={report.name}
        status={<span className="text-xs text-muted-foreground">{SAVED_REPORT_PATH_LABEL[report.reportPath]} · {presetLabel(report.datePreset)}</span>}
        lastUpdated={new Date(report.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        primaryAction={
          <div className="flex items-center gap-2">
            <Link href={`${report.reportPath}?${qs}`}><Button type="button" variant="outline" size="sm">Open Report</Button></Link>
            <a href={`/api/saved-reports/${report.id}/export.csv`}>
              <Button type="button" variant="ghost" size="sm"><Download className="mr-1.5 h-3.5 w-3.5" />Export CSV</Button>
            </a>
          </div>
        }
      />

      <Card>
        <CardHeader><p className="text-sm font-medium text-heading">Schedule</p></CardHeader>
        <CardContent className="space-y-4">
          {!canSchedule ? (
            <p className="text-sm text-muted-foreground">Only an Owner or Manager can schedule a report for recurring delivery.</p>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <Switch checked={scheduleOn} onCheckedChange={handleToggle} disabled={saving} />
                <Label className="cursor-pointer">
                  Email me this report weekly
                  <span className="block text-xs font-normal text-muted-foreground mt-0.5">Sent with the same relative period each time — "This Month" stays current, it's never frozen.</span>
                </Label>
              </div>
              {scheduleOn && (
                <div className="grid gap-3 sm:grid-cols-[160px_1fr] items-end">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-heading">Day</Label>
                    <Select value={dayOfWeek} onValueChange={setDayOfWeek} items={DAYS}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{DAYS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-heading">Send to</Label>
                    <div className="flex gap-2">
                      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourvenue.com" />
                      <Button type="button" size="sm" disabled={saving || !email.trim()} onClick={handleSaveSchedule}>
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
