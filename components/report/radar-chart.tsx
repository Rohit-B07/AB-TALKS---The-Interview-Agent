"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface RadarDatum {
  label: string;
  value: number;
}

const VIEW_W = 440;
const VIEW_H = 320;
const CENTER_X = 220;
const CENTER_Y = 160;
const MAX_RADIUS = 100;
const LABEL_RADIUS = 140;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function polar(
  angle: number,
  radius: number
): { x: number; y: number } {
  return {
    x: CENTER_X + radius * Math.cos(angle),
    y: CENTER_Y + radius * Math.sin(angle),
  };
}

/**
 * Truncates a label to the horizontal space available inside the viewBox so
 * labels can never clip at the chart edge, no matter how long the topic name.
 */
function fitLabel(label: string, point: { x: number }, anchor: "start" | "end" | "middle"): string {
  const avgCharWidth = 5.5;
  const available =
    anchor === "middle"
      ? Math.min(point.x, VIEW_W - point.x) * 2
      : anchor === "start"
        ? VIEW_W - point.x
        : point.x;
  const maxChars = Math.max(4, Math.floor(available / avgCharWidth) - 1);
  if (label.length <= maxChars) return label;
  return `${label.slice(0, Math.max(1, maxChars - 1))}…`;
}

/** SVG spider/radar chart built from real topic scores (0-100 scale). */
export function RadarChart({
  data,
  className,
}: {
  data: RadarDatum[];
  className?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  // Use only topics that carry a valid score; never invent domains.
  const valid = data.filter((d) => Number.isFinite(d.value));
  const count = valid.length;

  if (count === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No domain scores are available for this report.
      </p>
    );
  }

  const rings = [0.25, 0.5, 0.75, 1];
  const ringPoints = rings.map((frac) =>
    valid
      .map((_, index) => {
        const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
        const { x, y } = polar(angle, frac * MAX_RADIUS);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ")
  );

  const axes = valid.map((_, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
    const outer = polar(angle, MAX_RADIUS);
    return { x1: CENTER_X, y1: CENTER_Y, x2: outer.x, y2: outer.y };
  });

  const vertices = valid.map((d, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
    const frac = clamp(d.value / 100, 0, 1);
    return { ...polar(angle, frac * MAX_RADIUS), angle, frac };
  });

  const dataPolygon = vertices.map((v) => `${v.x.toFixed(2)},${v.y.toFixed(2)}`).join(" ");

  const labels: {
    x: number;
    y: number;
    anchor: "start" | "end" | "middle";
    dy: string;
    label: string;
  }[] = valid.map((d, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
    const point = polar(angle, LABEL_RADIUS);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const anchor = cos < -0.3 ? "end" : cos > 0.3 ? "start" : "middle";
    const dy = sin > 0.3 ? "0.9em" : sin < -0.3 ? "-0.1em" : "0.35em";
    return { ...point, anchor, dy, label: fitLabel(d.label, point, anchor) };
  });

  const tooltip = hovered !== null ? vertices[hovered] : null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative mx-auto w-full max-w-[340px]">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="block h-auto w-full text-foreground"
          style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
          role="img"
          aria-label={`Domain proficiency radar chart across ${count} domains on a 0 to 100 scale`}
        >
          {ringPoints.map((points, ringIndex) => (
            <polygon
              key={ringIndex}
              points={points}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.15"
              strokeWidth="1"
            />
          ))}
          {axes.map((line, index) => (
            <line
              key={index}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="currentColor"
              strokeOpacity="0.15"
              strokeWidth="1"
            />
          ))}

          {rings.map((frac, index) => {
            const { x, y } = polar(-Math.PI / 2, frac * MAX_RADIUS);
            return (
              <text
                key={index}
                x={x}
                y={y}
                dy="-0.25em"
                textAnchor="middle"
                className="fill-muted-foreground text-[9px] tabular-nums"
              >
                {Math.round(frac * 100)}
              </text>
            );
          })}

          <polygon
            points={dataPolygon}
            fill="currentColor"
            fillOpacity="0.12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {vertices.map((v, index) => (
            <circle
              key={index}
              cx={v.x}
              cy={v.y}
              r="3.5"
              fill="currentColor"
              className="cursor-pointer transition-opacity"
              opacity={hovered === null || hovered === index ? 1 : 0.35}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              tabIndex={0}
              role="img"
              aria-label={`${valid[index].label}: ${Math.round(clamp(valid[index].value, 0, 100))} out of 100`}
            >
              <title>
                {`${valid[index].label}: ${Math.round(clamp(valid[index].value, 0, 100))}/100`}
              </title>
            </circle>
          ))}

          {labels.map((label, index) => (
            <text
              key={index}
              x={label.x}
              y={label.y}
              dy={label.dy}
              textAnchor={label.anchor}
              className="fill-muted-foreground text-[11px] font-medium"
            >
              {label.label}
            </text>
          ))}
        </svg>

        {tooltip && hovered !== null ? (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-sm ring-1 ring-foreground/10"
            style={{
              left: `${(tooltip.x / VIEW_W) * 100}%`,
              top: `${(tooltip.y / VIEW_H) * 100}%`,
            }}
          >
            <span className="font-medium">{valid[hovered].label}</span>
            <span className="ml-1 text-muted-foreground tabular-nums">
              {Math.round(clamp(valid[hovered].value, 0, 100))}
            </span>
          </div>
        ) : null}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Domain scores on a 0–100 scale · hover a point for the exact score
      </p>
    </div>
  );
}
