"use client";

/**
 * VendorReviews — the first reader/writer of the existing vendor_reviews
 * model (rating, body, reviewer_type, RLS already in place, per
 * docs/vendor-relationship-lifecycle.md's Finding 2). Reusing the model
 * rather than building a new mechanism, per the approved "reuse before
 * creating" direction.
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Plus, Star } from "lucide-react";
import { toast } from "sonner";

import { addVendorReviewAction } from "@/app/(app)/vendors/[id]/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { VendorEventSummary, VendorReview } from "@/lib/vendors/types";

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={onChange ? "cursor-pointer" : "cursor-default"}
        >
          <Star className={`h-4 w-4 ${n <= value ? "fill-warning text-warning" : "text-muted-foreground"}`} />
        </button>
      ))}
    </div>
  );
}

function ReviewRow({ review }: { review: VendorReview }) {
  return (
    <div className="py-3 border-b border-border/50 last:border-0 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <StarRating value={review.rating} />
        <span className="text-xs text-muted-foreground">
          {new Date(review.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>
      {review.eventName && <p className="text-xs text-muted-foreground">{review.eventName}</p>}
      {review.body && <p className="text-sm text-foreground whitespace-pre-wrap">{review.body}</p>}
      {!review.isPublic && <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Private — not shown to clients</p>}
    </div>
  );
}

export function VendorReviews({
  vendorId, reviews, events,
}: { vendorId: string; reviews: VendorReview[]; events: VendorEventSummary[] }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = React.useState(false);
  const [eventId, setEventId] = React.useState(events[0]?.eventId ?? "");
  const [rating, setRating] = React.useState(5);
  const [body, setBody] = React.useState("");
  const [isPublic, setIsPublic] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const result = await addVendorReviewAction(vendorId, { eventId, rating, body, isPublic });
      if (result.ok) {
        toast.success("Review added.");
        setShowAdd(false); setBody(""); setRating(5); setIsPublic(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not add review.");
      }
    });
  }

  const average = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Reviews</CardTitle>
          {average !== null && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {average.toFixed(1)} average across {reviews.length} review{reviews.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        {!showAdd && (
          <Button type="button" size="sm" variant="outline" onClick={() => setShowAdd(true)} disabled={events.length === 0}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add Review
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {showAdd && (
          <div className="mb-4 space-y-3 rounded-xl border border-ring bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Event</Label>
                <Select value={eventId} onValueChange={setEventId} items={events.map((e) => ({ value: e.eventId, label: e.eventName }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{events.map((e) => <SelectItem key={e.eventId} value={e.eventId}>{e.eventName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rating</Label>
                <StarRating value={rating} onChange={setRating} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="How did this vendor perform?" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              <Label className="text-xs cursor-pointer">Share this review with clients in their vendor directory</Label>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)} disabled={pending}>Cancel</Button>
              <Button type="button" size="sm" disabled={!eventId || pending} onClick={handleSubmit}>
                {pending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Saving…</> : "Save Review"}
              </Button>
            </div>
          </div>
        )}
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {events.length === 0 ? "Reviews become available after this vendor is assigned to an event." : "No reviews yet."}
          </p>
        ) : (
          <div>{reviews.map((r) => <ReviewRow key={r.id} review={r} />)}</div>
        )}
      </CardContent>
    </Card>
  );
}
