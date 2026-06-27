"use client";

import * as React from "react";

export function Greeting({
  venueName,
  ownerFirstName,
}: {
  venueName: string;
  ownerFirstName: string | null;
}) {
  const [salutation, setSalutation] = React.useState("Good morning");
  const [dateStr, setDateStr] = React.useState("");

  React.useEffect(() => {
    const h = new Date().getHours();
    const tod = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    // "Good afternoon, Jennifer." or "Good afternoon." as fallback
    setSalutation(ownerFirstName ? `${tod}, ${ownerFirstName}.` : `${tod}.`);
    setDateStr(
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    );
  }, [ownerFirstName]);

  return (
    <div>
      <h1 className="font-heading text-2xl font-medium tracking-tight text-heading">
        {salutation}
      </h1>
      <p className="text-sm text-muted-foreground">
        {dateStr
          ? `${dateStr} · Here's what's happening at ${venueName} today.`
          : `Here's what's happening at ${venueName} today.`}
      </p>
    </div>
  );
}
