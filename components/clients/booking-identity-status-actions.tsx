"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Printer } from "lucide-react";
import { toast } from "sonner";

import {
  returnClientToBookedAction,
  updateEventStatusAction,
} from "@/app/(app)/events/[id]/actions";
import { getBookingConfirmationDraftForClientAction } from "@/app/(app)/leads/[id]/actions";
import { PipelineBookedConfirmDialog } from "@/components/leads/pipeline-booked-confirm-dialog";
import { EventStatusBadge } from "@/components/events/event-status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BookingConfirmationDraft } from "@/lib/booking-journey/confirmation-draft";
import type { ConfirmedBookingOccupancy } from "@/lib/booking-journey/confirmed-occupancy";
import { daysUntil } from "@/lib/events/constants";
import type { EventStatus } from "@/lib/events/types";

/**
 * Wave 7A identity-shell primary actions.
 *
 * Visibility matches EventDetail header rules exactly:
 * - Cancel: status !== "cancelled"
 * - Return: status === "cancelled" && bookedAt && clientId
 * Mutations reuse the same server actions + confirm/dialog paths.
 */
export function BookingIdentityStatusActions({
  eventId,
  eventStatus,
  bookedAt,
  clientId,
  eventDate,
}: {
  eventId: string;
  eventStatus: EventStatus;
  bookedAt: string | null;
  clientId: string | null;
  eventDate: string;
}) {
  const router = useRouter();
  const [statusPending, startStatus] = React.useTransition();
  const [returnBookedOpen, setReturnBookedOpen] = React.useState(false);
  const [returnDraft, setReturnDraft] = React.useState<BookingConfirmationDraft | null>(null);
  const [returnDraftError, setReturnDraftError] = React.useState<string | null>(null);

  const canCancel = eventStatus !== "cancelled";
  const canReturn = eventStatus === "cancelled" && !!bookedAt && !!clientId;
  const isToday = daysUntil(eventDate) === 0;

  function handleCancel() {
    if (
      !confirm(
        "Cancel this event? It leaves the active client list. History, contracts, and payments stay.",
      )
    ) {
      return;
    }
    startStatus(async () => {
      const result = await updateEventStatusAction(eventId, "cancelled");
      if (result.ok) {
        toast.success("Status updated.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not update status.");
      }
    });
  }

  function openReturnDialog() {
    if (!clientId) return;
    setReturnDraft(null);
    setReturnDraftError(null);
    setReturnBookedOpen(true);
    void getBookingConfirmationDraftForClientAction(clientId).then((loaded) => {
      if (!loaded.ok) {
        setReturnDraftError(loaded.message);
        return;
      }
      setReturnDraft(loaded.draft);
    });
  }

  return (
    <>
      <PipelineBookedConfirmDialog
        open={returnBookedOpen}
        confirming={statusPending}
        draft={returnDraft}
        loadError={returnDraftError}
        onCancel={() => {
          setReturnBookedOpen(false);
          setReturnDraft(null);
          setReturnDraftError(null);
        }}
        onConfirm={(occupancy: ConfirmedBookingOccupancy) => {
          if (!clientId) return;
          startStatus(async () => {
            const result = await returnClientToBookedAction(clientId, occupancy);
            if (result.ok) {
              setReturnBookedOpen(false);
              toast.success("Returned to Booked.");
              router.refresh();
            } else {
              toast.error(result.message ?? "Could not return to Booked.");
            }
          });
        }}
      />
      <div
        className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:items-center sm:gap-2"
        data-testid="event-header-actions"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <EventStatusBadge status={eventStatus} bookedAt={bookedAt} />
          <Button
            variant="outline"
            size="sm"
            className="h-11 min-h-11 sm:h-8 sm:min-h-0"
            render={<Link href={`/events/${eventId}/edit`} />}
            data-testid="event-action-edit"
          >
            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit event
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-11 min-h-11 sm:h-8 sm:min-h-0"
            render={<Link href={`/events/${eventId}/day-sheet`} />}
            data-testid="event-action-day-sheet"
          >
            <Printer className="mr-1 h-3.5 w-3.5" /> Day-of Sheet
          </Button>
          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              className="hidden h-8 sm:inline-flex"
              disabled={statusPending}
              data-testid="event-action-cancel"
              onClick={handleCancel}
            >
              Cancel event
            </Button>
          )}
          {canReturn && (
            <Button
              size="sm"
              className="hidden h-8 sm:inline-flex"
              disabled={statusPending}
              data-testid="event-action-return-booked"
              onClick={openReturnDialog}
            >
              Return to Booked
            </Button>
          )}
          {isToday && (
            <Button
              size="sm"
              className="hidden h-8 sm:inline-flex"
              render={<Link href={`/events/${eventId}/today`} />}
              style={{ background: "#5D6F5D", color: "white" }}
              data-testid="event-action-today-dashboard"
            >
              ✦ Today&apos;s Dashboard
            </Button>
          )}
        </div>
        {(canCancel || canReturn || isToday) && (
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 min-h-11 w-full justify-center"
                    data-testid="event-action-more"
                  />
                }
              >
                <MoreHorizontal className="mr-1 h-4 w-4" aria-hidden />
                More actions
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                {canCancel ? (
                  <DropdownMenuItem
                    disabled={statusPending}
                    data-testid="event-action-cancel-menu"
                    onClick={handleCancel}
                  >
                    Cancel event
                  </DropdownMenuItem>
                ) : null}
                {canReturn ? (
                  <DropdownMenuItem
                    disabled={statusPending}
                    data-testid="event-action-return-booked-menu"
                    onClick={openReturnDialog}
                  >
                    Return to Booked
                  </DropdownMenuItem>
                ) : null}
                {isToday ? (
                  <DropdownMenuItem
                    data-testid="event-action-today-dashboard-menu"
                    onClick={() => {
                      router.push(`/events/${eventId}/today`);
                    }}
                  >
                    Today&apos;s Dashboard
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </>
  );
}
