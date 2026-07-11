/**
 * Floor Plan shape library (Floor Plan Completion — Phase 2).
 *
 * One reusable place that knows how to draw each display shape an
 * Inventory item can declare. Neither the editor (components/floor-plan/
 * floor-plan-editor.tsx) nor the print page (app/(app)/events/[id]/
 * floor-plan-print/[planId]/page.tsx) hardcodes per-object-type rendering —
 * both just call <FloorPlanShapeSvg shape=... /> and let this file decide
 * what a "Stage" or a "Sofa" looks like. Simple SVG shapes, not artwork —
 * the goal is visual recognition, not illustration.
 *
 * No "use client" — this is a plain, hook-free presentational component,
 * so the print page (a server component) can render it directly too.
 */
import type { DisplayShape } from "@/lib/floor-plans/types";

export const DISPLAY_SHAPES: DisplayShape[] = [
  "round", "square", "rectangular", "oval", "cocktail",
  "dance_floor", "stage", "dj_booth", "bar", "buffet",
  "arbor", "arch", "aisle",
  "sofa", "lounge",
  "custom",
];

export const DISPLAY_SHAPE_LABELS: Record<DisplayShape, string> = {
  round: "Round", square: "Square", rectangular: "Rectangle", oval: "Oval", cocktail: "Cocktail",
  dance_floor: "Dance Floor", stage: "Stage", dj_booth: "DJ Booth", bar: "Bar", buffet: "Buffet",
  arbor: "Arbor", arch: "Arch", aisle: "Aisle",
  sofa: "Sofa", lounge: "Lounge",
  custom: "Custom",
};

export const DISPLAY_SHAPE_STYLE: Record<DisplayShape, { fill: string; stroke: string; textFill: string }> = {
  round:        { fill: "#ffffff", stroke: "#4F5F4F", textFill: "#4F5F4F" },
  square:       { fill: "#ffffff", stroke: "#4F5F4F", textFill: "#4F5F4F" },
  rectangular:  { fill: "#ffffff", stroke: "#4F5F4F", textFill: "#4F5F4F" },
  oval:         { fill: "#ffffff", stroke: "#4F5F4F", textFill: "#4F5F4F" },
  cocktail:     { fill: "#ffffff", stroke: "#4F5F4F", textFill: "#4F5F4F" },
  dance_floor:  { fill: "#B9D1C2", stroke: "#5D6F5D", textFill: "#4F5F4F" },
  stage:        { fill: "#F5F4F2", stroke: "#5D6F5D", textFill: "#4F5F4F" },
  dj_booth:     { fill: "#DED6CA", stroke: "#5D6F5D", textFill: "#4F5F4F" },
  bar:          { fill: "#DED6CA", stroke: "#B8AEA1", textFill: "#4F5F4F" },
  buffet:       { fill: "#F5F4F2", stroke: "#B8AEA1", textFill: "#4F5F4F" },
  arbor:        { fill: "transparent", stroke: "#C17F84", textFill: "#4F5F4F" },
  arch:         { fill: "transparent", stroke: "#C17F84", textFill: "#4F5F4F" },
  aisle:        { fill: "#ffffff", stroke: "#C17F84", textFill: "#4F5F4F" },
  sofa:         { fill: "#DED6CA", stroke: "#B8AEA1", textFill: "#4F5F4F" },
  lounge:       { fill: "#DED6CA", stroke: "#B8AEA1", textFill: "#4F5F4F" },
  custom:       { fill: "#F7F5F1", stroke: "#B8AEA1", textFill: "#4F5F4F" },
};

type ShapeProps = {
  shape: DisplayShape;
  x: number; y: number; width: number; height: number;
  fill: string; stroke: string; strokeWidth: number;
};

/**
 * Just the shape itself — center at (x,y). The caller supplies the
 * surrounding <g transform="rotate(...)">, label text, and selection
 * overlay (unchanged responsibilities from before this shape library
 * existed) so this stays a pure "how does this shape look" lookup.
 */
export function FloorPlanShapeSvg({ shape, x, y, width, height, fill, stroke, strokeWidth }: ShapeProps) {
  const hw = width / 2;
  const hh = height / 2;
  const common = { fill, stroke, strokeWidth };

  switch (shape) {
    case "round":
      return <circle cx={x} cy={y} r={hw} {...common} />;

    case "oval":
      return <ellipse cx={x} cy={y} rx={hw} ry={hh} {...common} />;

    case "cocktail":
      return (
        <>
          <circle cx={x} cy={y} r={hw} {...common} />
          <circle cx={x} cy={y} r={hw * 0.45} fill="none" stroke={stroke} strokeWidth={strokeWidth * 0.7} />
        </>
      );

    case "dance_floor": {
      const lines = [-0.5, 0, 0.5].map((t) => (
        <line key={t} x1={x - hw} y1={y + t * hh} x2={x + hw} y2={y - t * hh} stroke={stroke} strokeWidth={0.75} opacity={0.5} />
      ));
      return (
        <>
          <rect x={x - hw} y={y - hh} width={width} height={height} rx={2} {...common} />
          {lines}
        </>
      );
    }

    case "stage":
      return (
        <>
          <rect x={x - hw} y={y - hh} width={width} height={height} rx={2} {...common} />
          <rect x={x - hw * 0.75} y={y - hh * 0.6} width={width * 0.75} height={height * 0.5} rx={2}
            fill="none" stroke={stroke} strokeWidth={strokeWidth * 0.7} opacity={0.6} />
        </>
      );

    case "dj_booth":
      return (
        <>
          <rect x={x - hw} y={y - hh} width={width} height={height} rx={3} {...common} />
          <circle cx={x - hw * 0.35} cy={y} r={Math.min(hw, hh) * 0.3} fill="none" stroke={stroke} strokeWidth={strokeWidth * 0.7} />
          <circle cx={x + hw * 0.35} cy={y} r={Math.min(hw, hh) * 0.3} fill="none" stroke={stroke} strokeWidth={strokeWidth * 0.7} />
        </>
      );

    case "bar": {
      const dotCount = 4;
      const dots = Array.from({ length: dotCount }, (_, i) => {
        const t = (i + 0.5) / dotCount;
        return <circle key={i} cx={x - hw + t * width} cy={y - hh * 0.5} r={Math.min(hw, hh) * 0.12} fill={stroke} opacity={0.6} />;
      });
      return (
        <>
          <rect x={x - hw} y={y - hh} width={width} height={height} rx={3} {...common} />
          {dots}
        </>
      );
    }

    case "buffet": {
      const boxCount = 3;
      const boxes = Array.from({ length: boxCount }, (_, i) => {
        const boxW = width / (boxCount * 1.6);
        const gap = (width - boxW * boxCount) / (boxCount + 1);
        const bx = x - hw + gap * (i + 1) + boxW * i;
        return <rect key={i} x={bx} y={y - hh * 0.35} width={boxW} height={hh * 0.7} rx={1}
          fill="none" stroke={stroke} strokeWidth={strokeWidth * 0.7} />;
      });
      return (
        <>
          <rect x={x - hw} y={y - hh} width={width} height={height} rx={3} {...common} />
          {boxes}
        </>
      );
    }

    case "arbor":
      return (
        <>
          <line x1={x - hw} y1={y - hh} x2={x - hw} y2={y + hh} stroke={stroke} strokeWidth={strokeWidth * 1.5} />
          <line x1={x + hw} y1={y - hh} x2={x + hw} y2={y + hh} stroke={stroke} strokeWidth={strokeWidth * 1.5} />
          <line x1={x - hw} y1={y - hh} x2={x + hw} y2={y - hh} stroke={stroke} strokeWidth={strokeWidth * 1.5} />
        </>
      );

    case "arch": {
      const r = hw;
      return (
        <path d={`M ${x - r} ${y + hh} L ${x - r} ${y} A ${r} ${r} 0 0 1 ${x + r} ${y} L ${x + r} ${y + hh}`}
          fill="none" stroke={stroke} strokeWidth={strokeWidth * 1.5} />
      );
    }

    case "aisle":
      return (
        <>
          <rect x={x - hw} y={y - hh} width={width} height={height} {...common} />
          <line x1={x} y1={y - hh} x2={x} y2={y + hh} stroke={stroke} strokeWidth={1} strokeDasharray="4,3" />
        </>
      );

    case "sofa":
      return (
        <>
          <rect x={x - hw} y={y - hh} width={width} height={height} rx={Math.min(hw, hh) * 0.3} {...common} />
          <rect x={x - hw * 0.85} y={y - hh} width={width * 0.85} height={height * 0.35} rx={Math.min(hw, hh) * 0.25}
            fill="none" stroke={stroke} strokeWidth={strokeWidth * 0.7} opacity={0.6} />
        </>
      );

    case "lounge":
      return (
        <>
          <rect x={x - hw} y={y - hh} width={width} height={height} rx={Math.min(hw, hh) * 0.4} {...common} />
          <line x1={x - hw / 3} y1={y - hh} x2={x - hw / 3} y2={y + hh} stroke={stroke} strokeWidth={0.75} opacity={0.5} />
          <line x1={x + hw / 3} y1={y - hh} x2={x + hw / 3} y2={y + hh} stroke={stroke} strokeWidth={0.75} opacity={0.5} />
        </>
      );

    case "square":
    case "rectangular":
    case "custom":
    default:
      return <rect x={x - hw} y={y - hh} width={width} height={height} rx={4} {...common} />;
  }
}
