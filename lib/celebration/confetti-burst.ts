"use client";

/**
 * Canonical Hello to Cheers celebration confetti burst.
 *
 * Shared by lifecycle milestones (`celebrateLuv`) and couple-portal task
 * completes (`celebrateTaskComplete`). Center viewport triple-burst —
 * not a top-of-page trickle. Appends to document.body so layout overflow
 * cannot clip it. No modal, no new library.
 *
 * Contract (approved in commit 81ac275 / portal task celebration):
 * - fixed full-viewport overlay, pointer-events none
 * - ~120 pieces across three staggered waves
 * - visible ~2s, then layer removed
 */

/** Warm peach / rose / sage / gold / cream — saturated enough to read as celebration. */
export const CELEBRATION_CONFETTI_COLORS = [
  "#F4A896", // warm peach
  "#E8899A", // rose
  "#D8A7AA", // dusty rose
  "#7FA87A", // sage
  "#B9D1C2", // soft sage
  "#D4A84B", // gold
  "#E8C96A", // light gold
  "#FFF1E0", // cream
  "#F0C4A8", // apricot
] as const;

export const CELEBRATION_CONFETTI_LAYER_MS = 2200;
export const CELEBRATION_CONFETTI_TOTAL_PIECES = 48 + 36 + 36; // 120

type BurstOrigin = { x: number; y: number };

function ensureKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById("htc-celebration-confetti-keyframes")) return;
  const style = document.createElement("style");
  style.id = "htc-celebration-confetti-keyframes";
  style.textContent = `
    @keyframes htc-celebration-confetti-burst {
      0% {
        transform: translate(-50%, -50%) rotate(var(--r0)) scale(1);
        opacity: 1;
      }
      70% {
        opacity: 1;
      }
      100% {
        transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(var(--r1)) scale(0.55);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

function spawnBurst(layer: HTMLElement, origin: BurstOrigin, count: number, spread: number) {
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.55 - 0.275);
    const distance = spread * (0.45 + Math.random() * 0.55);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance + distance * 0.35;
    const size = 7 + Math.random() * 7;
    const round = Math.random() > 0.45;
    const r0 = Math.random() * 360;
    const r1 = r0 + 280 + Math.random() * 480;
    const duration = 1100 + Math.random() * 500;
    const delay = Math.random() * 80;
    const color = CELEBRATION_CONFETTI_COLORS[i % CELEBRATION_CONFETTI_COLORS.length];

    piece.style.cssText = `
      position:absolute;
      left:${origin.x}px; top:${origin.y}px;
      width:${size}px; height:${round ? size : size * 0.65}px;
      background:${color};
      border-radius:${round ? "50%" : "2px"};
      box-shadow:0 0 0 1px rgba(255,255,255,0.25);
      pointer-events:none;
      --dx:${dx}px; --dy:${dy}px;
      --r0:${r0}deg; --r1:${r1}deg;
      animation: htc-celebration-confetti-burst ${duration}ms cubic-bezier(0.12, 0.72, 0.28, 1) ${delay}ms forwards;
    `;
    layer.appendChild(piece);
  }
}

/**
 * Fire the canonical full-viewport celebration burst.
 * Call only after a verified success — never on draft/navigate/reload.
 */
export function fireCelebrationConfetti(): void {
  if (typeof document === "undefined") return;

  ensureKeyframes();

  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.setAttribute("data-htc-celebration-confetti", "1");
  // High z-index so portal shells / dialogs cannot cover the burst.
  layer.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:2147483000;overflow:hidden;";
  document.body.appendChild(layer);

  const cx = window.innerWidth / 2;
  const cy = window.innerHeight * 0.42;

  spawnBurst(layer, { x: cx, y: cy }, 48, Math.min(window.innerWidth, 520) * 0.42);
  window.setTimeout(() => {
    spawnBurst(layer, { x: cx - 48, y: cy - 20 }, 36, Math.min(window.innerWidth, 560) * 0.5);
  }, 160);
  window.setTimeout(() => {
    spawnBurst(layer, { x: cx + 48, y: cy + 12 }, 36, Math.min(window.innerWidth, 560) * 0.52);
  }, 320);

  window.setTimeout(() => layer.remove(), CELEBRATION_CONFETTI_LAYER_MS);
}
