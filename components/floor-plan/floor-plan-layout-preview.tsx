/**
 * Shared Floor Plan layout SVG preview — uses the real shape renderer
 * (not a screenshot placeholder). Suitable for Library and portal views.
 */
import type { ReactNode } from "react";

import { FloorPlanShapeSvg, DISPLAY_SHAPE_STYLE } from "@/components/floor-plan/floor-plan-shapes";
import { OBJECT_STYLE } from "@/lib/floor-plans/constants";
import type { DisplayShape, ObjectType } from "@/lib/floor-plans/types";

export type FloorPlanPreviewObject = {
  id?: string;
  objectType: string;
  label: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color?: string | null;
  displayShape?: string | null;
};

function renderObject(obj: FloorPlanPreviewObject, key: string): ReactNode {
  const legacyStyle = OBJECT_STYLE[obj.objectType as ObjectType] ?? OBJECT_STYLE.other;
  const shape = (obj.displayShape as DisplayShape | null) ?? null;
  const style = shape ? DISPLAY_SHAPE_STYLE[shape] : legacyStyle;
  const fill = obj.color ?? style.fill;
  const hw = obj.width / 2;
  const hh = obj.height / 2;
  const fontSize = Math.max(9, Math.min(13, obj.width / 6));
  const transform = `rotate(${obj.rotation}, ${obj.x}, ${obj.y})`;

  return (
    <g key={key} transform={transform}>
      {obj.objectType === "text_label" ? null : shape ? (
        <FloorPlanShapeSvg
          shape={shape} x={obj.x} y={obj.y} width={obj.width} height={obj.height}
          fill={fill} stroke={style.stroke} strokeWidth={1.5}
        />
      ) : obj.objectType === "table_round" ? (
        <circle cx={obj.x} cy={obj.y} r={hw} fill={fill} stroke={style.stroke} strokeWidth={1.5} />
      ) : obj.objectType === "table_oval" ? (
        <ellipse cx={obj.x} cy={obj.y} rx={hw} ry={hh} fill={fill} stroke={style.stroke} strokeWidth={1.5} />
      ) : (
        <rect x={obj.x - hw} y={obj.y - hh} width={obj.width} height={obj.height} rx={3}
          fill={fill} stroke={style.stroke} strokeWidth={1.5} />
      )}
      {obj.objectType !== "text_label" && obj.label ? (
        <text x={obj.x} y={obj.y} textAnchor="middle" dominantBaseline="middle"
          fontSize={fontSize} fill={style.textFill} fontFamily="sans-serif">
          {obj.label}
        </text>
      ) : null}
      {obj.objectType === "text_label" && (
        <text x={obj.x} y={obj.y} textAnchor="middle" dominantBaseline="middle"
          fontSize={13} fill={style.textFill} fontFamily="sans-serif" fontWeight="500">
          {obj.label ?? "Label"}
        </text>
      )}
    </g>
  );
}

export function FloorPlanLayoutPreview({
  planName,
  roomWidthFt,
  roomDepthFt,
  backgroundImageUrl,
  backgroundImageOpacity,
  objects,
  className,
  maxHeightClassName = "max-h-[50vh]",
}: {
  planName: string;
  roomWidthFt: number;
  roomDepthFt: number;
  backgroundImageUrl?: string | null;
  backgroundImageOpacity?: number;
  objects: FloorPlanPreviewObject[];
  className?: string;
  maxHeightClassName?: string;
}) {
  const canvasW = Number(roomWidthFt) * 12 || 800;
  const canvasH = Number(roomDepthFt) * 12 || 600;
  return (
    <div className={className ?? "overflow-auto bg-[#F7F5F1] p-3"}>
      <svg
        viewBox={`0 0 ${canvasW} ${canvasH}`}
        className={`w-full h-auto ${maxHeightClassName} mx-auto block`}
        role="img"
        aria-label={`Floor plan preview: ${planName}`}
      >
        <rect x={0} y={0} width={canvasW} height={canvasH} fill="#F7F5F1" />
        {backgroundImageUrl && (
          <image
            href={backgroundImageUrl}
            x={0} y={0} width={canvasW} height={canvasH}
            opacity={Number(backgroundImageOpacity ?? 0.25)}
            preserveAspectRatio="xMidYMid slice"
          />
        )}
        {objects.map((o, i) => renderObject(o, o.id ?? `${o.objectType}-${i}`))}
      </svg>
    </div>
  );
}
