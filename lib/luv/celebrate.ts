"use client";

/**
 * Luv Experience Completion, Work Stream 3 — the celebration presentation
 * layer. Deliberately tiny, per the explicit brief: "a celebration should
 * last about two seconds — confetti, a nice message, continue working."
 * Not a modal, not a reward screen, no new buttons. Reuses the toast
 * system (sonner) already used everywhere else in this app for the
 * message; confetti is a dependency-free CSS burst, not a new library.
 *
 * Every call site only ever calls this when its own server action returned
 * a real `celebrated: true` from the one-time-fire check in
 * luv_celebrations (5 real Commitment Lifecycle transitions only — see
 * docs/luv-experience-completion-implementation-plan.md Work Stream 3).
 * This function has no opinion about when to fire; it only renders.
 */
import { toast } from "sonner";

const COLORS = ["#D8A7AA", "#E8C4C7", "#8A9B6E", "#C9A961", "#5D6F5D"];

export function celebrateLuv(message: string) {
  if (typeof document === "undefined") return;

  toast.success(message, { icon: "🎉", duration: 2200 });

  const layer = document.createElement("div");
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;";
  document.body.appendChild(layer);

  const pieceCount = 24;
  for (let i = 0; i < pieceCount; i++) {
    const piece = document.createElement("span");
    const left = 50 + (Math.random() * 40 - 20); // cluster near center-top
    const delay = Math.random() * 150;
    const drift = Math.random() * 120 - 60;
    const rotate = Math.random() * 360;
    const color = COLORS[i % COLORS.length];
    piece.style.cssText = `
      position:absolute; top:-10px; left:${left}%; width:7px; height:10px;
      background:${color}; opacity:0.9; border-radius:1px;
      transform:translateY(0) rotate(${rotate}deg);
      animation: luv-confetti-fall 1100ms ease-in ${delay}ms forwards;
      --drift:${drift}px;
    `;
    layer.appendChild(piece);
  }

  if (!document.getElementById("luv-confetti-keyframes")) {
    const style = document.createElement("style");
    style.id = "luv-confetti-keyframes";
    style.textContent = `
      @keyframes luv-confetti-fall {
        to { transform: translateY(70vh) translateX(var(--drift)) rotate(540deg); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  setTimeout(() => layer.remove(), 1500);
}
