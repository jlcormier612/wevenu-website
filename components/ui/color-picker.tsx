"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ── Color math ────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

// Hex → HSB (hue 0-360, sat 0-100, bri 0-100)
function hexToHsb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return [0, 0, 100];
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [
    Math.round(h * 360),
    max === 0 ? 0 : Math.round((d / max) * 100),
    Math.round(max * 100),
  ];
}

// HSB → Hex
function hsbToHex(h: number, s: number, b: number): string {
  const sv = s / 100;
  const bv = b / 100;
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return bv * (1 - sv * Math.max(0, Math.min(k, 4 - k, 1)));
  };
  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(f(5))}${toHex(f(3))}${toHex(f(1))}`.toUpperCase();
}

function isHex(v: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(v);
}

// ── Canvas drawing ────────────────────────────────────────────────────────────

function drawGradient(canvas: HTMLCanvasElement, hue: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;

  // Pure hue at full saturation/brightness
  ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
  ctx.fillRect(0, 0, width, height);

  // White → transparent (left to right = saturation)
  const wg = ctx.createLinearGradient(0, 0, width, 0);
  wg.addColorStop(0, "rgba(255,255,255,1)");
  wg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = wg;
  ctx.fillRect(0, 0, width, height);

  // Black → transparent (top to bottom = brightness inverse)
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "rgba(0,0,0,0)");
  bg.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
}

// ── ColorPicker ───────────────────────────────────────────────────────────────

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);

  // Derive HSB state from the incoming hex value
  const [hue, setHue] = useState<number>(() => hexToHsb(value)[0]);
  const [sat, setSat] = useState<number>(() => hexToHsb(value)[1]);
  const [bri, setBri] = useState<number>(() => hexToHsb(value)[2]);
  const [hexInput, setHexInput] = useState<string>(value.toUpperCase());

  // Sync from parent value (when the popover opens with a pre-existing color)
  useEffect(() => {
    if (isHex(value)) {
      const [h, s, b] = hexToHsb(value);
      setHue(h);
      setSat(s);
      setBri(b);
      setHexInput(value.toUpperCase());
    }
  }, [value]);

  // Redraw canvas whenever hue changes
  useEffect(() => {
    if (canvasRef.current) drawGradient(canvasRef.current, hue);
  }, [hue]);

  // Position of the selector circle in the canvas (0–1 normalized)
  const posX = sat / 100;
  const posY = 1 - bri / 100;

  const applyCanvasPoint = useCallback(
    (clientX: number, clientY: number, canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect();
      const x = clamp((clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((clientY - rect.top) / rect.height, 0, 1);
      const newSat = Math.round(x * 100);
      const newBri = Math.round((1 - y) * 100);
      setSat(newSat);
      setBri(newBri);
      const hex = hsbToHex(hue, newSat, newBri);
      setHexInput(hex);
      onChange(hex);
    },
    [hue, onChange],
  );

  // Global mouse tracking while dragging
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !canvasRef.current) return;
      applyCanvasPoint(e.clientX, e.clientY, canvasRef.current);
    };
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [applyCanvasPoint]);

  // Touch support
  useEffect(() => {
    const onMove = (e: TouchEvent) => {
      if (!dragging.current || !canvasRef.current) return;
      e.preventDefault();
      applyCanvasPoint(e.touches[0].clientX, e.touches[0].clientY, canvasRef.current);
    };
    const onEnd = () => { dragging.current = false; };
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [applyCanvasPoint]);

  const handleHueChange = (h: number) => {
    setHue(h);
    const hex = hsbToHex(h, sat, bri);
    setHexInput(hex);
    onChange(hex);
  };

  const handleHexInput = (raw: string) => {
    const cleaned = raw.replace(/[^0-9A-Fa-f]/g, "").slice(0, 6).toUpperCase();
    setHexInput("#" + cleaned);
    const full = "#" + cleaned;
    if (isHex(full)) {
      const [h, s, b] = hexToHsb(full);
      setHue(h);
      setSat(s);
      setBri(b);
      onChange(full);
    }
  };

  const currentHex = hsbToHex(hue, sat, bri);
  // Determine if selector circle needs a dark or light border based on brightness
  const selectorBorder = bri < 30 || sat < 20 ? "rgba(255,255,255,0.8)" : "white";

  return (
    <div className="w-60 select-none" onMouseDown={e => e.stopPropagation()}>
      {/* ── Gradient canvas ──────────────────────────────────────────── */}
      <div
        className="relative rounded-lg overflow-hidden mb-3"
        style={{ height: 160, cursor: "crosshair" }}
      >
        <canvas
          ref={canvasRef}
          width={240}
          height={160}
          className="w-full h-full block"
          onMouseDown={e => {
            dragging.current = true;
            applyCanvasPoint(e.clientX, e.clientY, e.currentTarget);
          }}
          onTouchStart={e => {
            dragging.current = true;
            applyCanvasPoint(e.touches[0].clientX, e.touches[0].clientY, canvasRef.current!);
          }}
        />
        {/* Selector circle */}
        <div
          className="pointer-events-none absolute"
          style={{
            left: `${posX * 100}%`,
            top: `${posY * 100}%`,
            transform: "translate(-50%, -50%)",
            width: 16,
            height: 16,
            borderRadius: "50%",
            border: `2px solid ${selectorBorder}`,
            boxShadow: "0 0 0 1.5px rgba(0,0,0,0.35)",
            background: currentHex,
            transition: "box-shadow 0.1s",
          }}
        />
      </div>

      {/* ── Hue slider ─────────────────────────────────────────────── */}
      <div className="mb-3 px-0.5">
        <div className="relative h-3 rounded-full overflow-hidden"
          style={{
            background:
              "linear-gradient(to right,hsl(0,100%,50%),hsl(30,100%,50%),hsl(60,100%,50%),hsl(90,100%,50%),hsl(120,100%,50%),hsl(150,100%,50%),hsl(180,100%,50%),hsl(210,100%,50%),hsl(240,100%,50%),hsl(270,100%,50%),hsl(300,100%,50%),hsl(330,100%,50%),hsl(360,100%,50%))",
          }}
        >
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={hue}
            onChange={e => handleHueChange(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          {/* Thumb indicator */}
          <div
            className="pointer-events-none absolute top-1/2 -translate-y-1/2"
            style={{
              left: `${(hue / 360) * 100}%`,
              transform: "translate(-50%, -50%)",
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: "2px solid white",
              boxShadow: "0 0 0 1.5px rgba(0,0,0,0.3)",
              background: `hsl(${hue},100%,50%)`,
            }}
          />
        </div>
      </div>

      {/* ── Hex input + swatch ─────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-md border border-gray-200 shrink-0"
          style={{ background: currentHex }}
        />
        <div className="flex-1 flex items-center border border-input rounded-md px-2 h-8 bg-background">
          <span className="text-xs text-muted-foreground font-mono mr-0.5">#</span>
          <input
            type="text"
            value={hexInput.replace("#", "")}
            onChange={e => handleHexInput(e.target.value)}
            maxLength={6}
            spellCheck={false}
            className="flex-1 text-xs font-mono uppercase outline-none bg-transparent tracking-wider min-w-0"
            placeholder="5D6F5D"
          />
        </div>
      </div>
    </div>
  );
}

// ── ColorPickerTrigger ────────────────────────────────────────────────────────
// A swatch button that opens a popover containing the ColorPicker.

interface ColorPickerTriggerProps {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
}

export function ColorPickerTrigger({ value, onChange }: ColorPickerTriggerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isValid = isHex(value);
  const display = isValid ? value.toUpperCase() : "#------";

  return (
    <div className="relative inline-block" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 h-9 px-2.5 rounded-md border border-input hover:border-ring transition-colors bg-background"
        aria-label={`Color: ${display}`}
      >
        <span
          className="w-5 h-5 rounded border border-gray-300 shrink-0 transition-colors"
          style={{ background: isValid ? value : "#eee" }}
        />
        <span className="text-xs font-mono text-foreground tracking-wider">
          {display}
        </span>
        <svg className="w-3 h-3 text-muted-foreground ml-0.5" fill="none" viewBox="0 0 16 16">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full mt-2 left-0 z-50 rounded-xl border border-gray-200 bg-white shadow-xl p-3"
          style={{ minWidth: 264 }}
        >
          <ColorPicker value={isValid ? value : "#5D6F5D"} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
