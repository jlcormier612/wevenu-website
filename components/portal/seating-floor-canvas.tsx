"use client";

/**
 * Guest Seating floor canvas — renders the actual shared floor-plan objects
 * with seating occupancy overlaid on genuine seating destinations.
 */
import * as React from "react";
import { FloorPlanShapeSvg } from "@/components/floor-plan/floor-plan-shapes";
import {
  SEATING_CANVAS,
  seatingArrangementCanvasSize,
  seatingObjectLabel,
  seatingObjectShape,
  seatingObjectStyle,
  seatingOccupancyText,
  shouldShowOccupancyOnObject,
  type SeatingCanvasObject,
} from "@/lib/seating/canvas-presentation";

type Props = {
  roomWidthFt: number;
  roomDepthFt: number;
  backgroundImageUrl?: string | null;
  backgroundImageOpacity?: number;
  objects: SeatingCanvasObject[];
  selectedId: string | null;
  dragOverId?: string | null;
  onSelect: (id: string | null) => void;
  onDragOver?: (id: string, e: React.DragEvent) => void;
  onDragLeave?: (id: string) => void;
  onDrop?: (id: string, e: React.DragEvent) => void;
  /** CSS min-height for the viewport. */
  minHeightPx?: number;
  className?: string;
};

export function SeatingFloorCanvas({
  roomWidthFt,
  roomDepthFt,
  backgroundImageUrl,
  backgroundImageOpacity = 0.25,
  objects,
  selectedId,
  dragOverId,
  onSelect,
  onDragOver,
  onDragLeave,
  onDrop,
  minHeightPx = 560,
  className,
}: Props) {
  const { roomW, roomH, canvasW, canvasH } = seatingArrangementCanvasSize({
    roomWidthFt,
    roomDepthFt,
    objects,
  });
  const [zoom, setZoom] = React.useState(1);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  function fitPlan() {
    const el = viewportRef.current;
    if (!el) return;
    const pad = 28;
    const availW = Math.max(120, el.clientWidth - pad * 2);
    const availH = Math.max(120, el.clientHeight - pad * 2);
    const next = Math.min(availW / canvasW, availH / canvasH, 1.5);
    setZoom(Math.max(0.25, next));
  }

  React.useEffect(() => {
    fitPlan();
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => fitPlan());
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fit on arrangement size change
  }, [canvasW, canvasH]);

  return (
    <div
      className={`relative flex flex-col overflow-hidden ${className ?? ""}`}
      style={{
        background: SEATING_CANVAS.background,
        border: `1px solid ${SEATING_CANVAS.border}`,
        borderRadius: SEATING_CANVAS.radiusPx,
        minHeight: minHeightPx,
      }}
      data-testid="seating-floor-canvas"
    >
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-lg border border-[#E6E3DC] bg-white/95 p-1 shadow-sm">
        <button
          type="button"
          className="min-h-9 min-w-9 rounded-md px-2 text-sm font-medium text-[#446B56]"
          onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
          aria-label="Zoom in"
          data-testid="seating-zoom-in"
        >
          +
        </button>
        <button
          type="button"
          className="min-h-9 min-w-9 rounded-md px-2 text-sm font-medium text-[#446B56]"
          onClick={() => setZoom((z) => Math.max(0.25, z - 0.15))}
          aria-label="Zoom out"
          data-testid="seating-zoom-out"
        >
          −
        </button>
        <button
          type="button"
          className="min-h-9 rounded-md px-2 text-xs font-semibold text-[#446B56]"
          onClick={() => fitPlan()}
          data-testid="seating-fit-plan"
        >
          Fit plan
        </button>
      </div>

      <div
        ref={viewportRef}
        className="flex-1 overflow-auto touch-pan-x touch-pan-y"
        style={{ minHeight: minHeightPx }}
        onClick={() => onSelect(null)}
      >
        <div
          className="mx-auto my-6"
          style={{
            width: canvasW * zoom,
            height: canvasH * zoom,
          }}
        >
          <svg
            width={canvasW * zoom}
            height={canvasH * zoom}
            viewBox={`0 0 ${canvasW} ${canvasH}`}
            className="block"
            data-testid="seating-floor-svg"
            data-canvas-w={canvasW}
            data-canvas-h={canvasH}
            data-room-w={roomW}
            data-room-h={roomH}
          >
            <rect x={0} y={0} width={canvasW} height={canvasH} fill="#FAFAF8" />
            <rect
              x={0}
              y={0}
              width={roomW}
              height={roomH}
              fill="none"
              stroke="#E6E3DC"
              strokeWidth={1}
              strokeDasharray="6 4"
              data-testid="seating-room-boundary"
            />
            {backgroundImageUrl ? (
              <image
                href={backgroundImageUrl}
                x={0}
                y={0}
                width={roomW}
                height={roomH}
                opacity={backgroundImageOpacity}
                preserveAspectRatio="none"
              />
            ) : null}
            {objects.map((obj) => {
              if (obj.objectType === "text_label") {
                return (
                  <text
                    key={obj.id}
                    data-object-id={obj.id}
                    x={obj.x}
                    y={obj.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={13}
                    fill="#688371"
                    fontFamily="sans-serif"
                    fontWeight={500}
                    transform={`rotate(${obj.rotation}, ${obj.x}, ${obj.y})`}
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {obj.label}
                  </text>
                );
              }

              const shape = seatingObjectShape(obj);
              const selected = selectedId === obj.id;
              const dragOver = dragOverId === obj.id;
              const guestCount = obj.guestCount ?? 0;
              const style = seatingObjectStyle({
                objectType: obj.objectType,
                shape,
                selected: selected || Boolean(dragOver),
                guestCount,
              });
              const label = seatingObjectLabel(obj);
              const showOcc = style.showOccupancy
                && shouldShowOccupancyOnObject(obj.width, obj.height, zoom);
              const interactive = style.showOccupancy;
              const fontSize = Math.max(9, Math.min(SEATING_CANVAS.labelPx, Math.min(obj.width, obj.height) / 5.5));
              const occSize = Math.max(8, Math.min(SEATING_CANVAS.occupancyPx, fontSize * 0.85));

              return (
                <g
                  key={obj.id}
                  data-object-id={obj.id}
                  transform={`rotate(${obj.rotation}, ${obj.x}, ${obj.y})`}
                  className={interactive ? "cursor-pointer" : undefined}
                  onClick={(e) => {
                    if (!interactive) return;
                    e.stopPropagation();
                    onSelect(obj.id === selectedId ? null : obj.id);
                  }}
                  onDragOver={interactive && onDragOver ? (e) => onDragOver(obj.id, e) : undefined}
                  onDragLeave={interactive && onDragLeave ? () => onDragLeave(obj.id) : undefined}
                  onDrop={interactive && onDrop ? (e) => onDrop(obj.id, e) : undefined}
                  data-testid={interactive ? `seating-table-${obj.id}` : `seating-furniture-${obj.id}`}
                >
                  <FloorPlanShapeSvg
                    shape={shape}
                    x={obj.x}
                    y={obj.y}
                    width={obj.width}
                    height={obj.height}
                    fill={style.fill}
                    stroke={style.stroke}
                    strokeWidth={style.strokeWidth}
                  />
                  <text
                    x={obj.x}
                    y={showOcc ? obj.y - fontSize * 0.35 : obj.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={fontSize}
                    fontWeight={500}
                    fill="#446B56"
                    fontFamily="sans-serif"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {label}
                  </text>
                  {showOcc ? (
                    <text
                      x={obj.x}
                      y={obj.y + occSize * 0.9}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={occSize}
                      fill="#688371"
                      fontFamily="sans-serif"
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {seatingOccupancyText(guestCount, obj.capacity)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
