"use client";

import * as React from "react";

export function Greeting({ venueName }: { venueName: string }) {
  const [greeting, setGreeting] = React.useState("Good morning");
  const [dateStr, setDateStr] = React.useState("");

  React.useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
    setDateStr(
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    );
  }, []);

  return (
    <div>
      <h1 className="font-heading text-2xl font-medium tracking-tight text-heading">
        {greeting}, {venueName}
      </h1>
      {dateStr ? (
        <p className="text-sm text-muted-foreground">{dateStr}</p>
      ) : null}
    </div>
  );
}
