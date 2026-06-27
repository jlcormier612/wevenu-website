"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        padding: "6px 16px",
        background: "#5D6F5D",
        color: "#fff",
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
        fontSize: 14,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <Printer size={14} />
      Print / Save as PDF
    </button>
  );
}
