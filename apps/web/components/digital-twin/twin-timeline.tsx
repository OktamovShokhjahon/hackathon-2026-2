"use client";

import { useMemo } from "react";
import { STATE_HEX, STATE_LABEL } from "./anatomy";
import type { OrganSignal, RiskColor } from "./types";

export interface TwinTimelinePoint {
  date: string;
  overallRisk: RiskColor;
  signals: OrganSignal[];
  missingData: string[];
  events: Array<{
    kind: "lab" | "vital" | "diagnosis" | "medication_start" | "medication_stop";
    label: string;
  }>;
}

export interface TwinTimelineData {
  ruleSetVersion: string;
  points: TwinTimelinePoint[];
}

const EVENT_LABEL: Record<TwinTimelinePoint["events"][number]["kind"], string> = {
  lab: "Lab",
  vital: "Vital",
  diagnosis: "Diagnosis",
  medication_start: "Started",
  medication_stop: "Stopped",
};

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * The chart's own dates as a scrubber. Each stop is a day on which something
 * was actually recorded, and the twin above shows the rule output for the
 * chart as it stood that day — so dragging left is reading history, not
 * watching an animation. Releasing the scrubber at the end returns the twin to
 * the scenario view it had before.
 */
export function TwinTimeline({
  timeline,
  index,
  onIndexChange,
  loading,
}: {
  timeline?: TwinTimelineData;
  /** null means "live": the scenario, not a past day. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
  loading?: boolean;
}) {
  const points = timeline?.points ?? [];
  const last = points.length - 1;
  const active = index === null ? last : index;
  const point = points[active];

  const span = useMemo(() => {
    if (points.length < 2) return null;
    return {
      from: formatDay(points[0].date),
      to: formatDay(points[last].date),
    };
  }, [points, last]);

  if (loading) {
    return (
      <div className="h-[86px] animate-pulse rounded-lg bg-ink/[0.035]" aria-hidden />
    );
  }

  if (points.length === 0) {
    return (
      <div
        className="rounded-lg border px-4 py-3"
        style={{ borderColor: "var(--line)" }}
      >
        <span className="readout">Timeline</span>
        <p className="mt-1 text-xs leading-relaxed text-ink-faint">
          No dated records yet. Once a lab result, vital sign, diagnosis or medication is on the
          chart, the twin can be wound back to any day it changed.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border px-4 py-3" style={{ borderColor: "var(--line)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="readout">Timeline · chart history</span>
        <div className="flex items-center gap-3">
          {point && (
            <span className="font-mono text-[11px] tabular-nums text-signal">
              {formatDay(point.date)}
            </span>
          )}
          <button
            onClick={() => onIndexChange(null)}
            disabled={index === null}
            className="rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint transition hover:text-ink disabled:opacity-40"
            style={{ borderColor: "var(--line)" }}
          >
            Live
          </button>
        </div>
      </div>

      {/* Ticks sit on the same axis as the slider thumb, so the coloured marks
          line up with the days you can actually stop on. */}
      <div className="relative mt-3 h-4">
        {points.map((item, itemIndex) => (
          <button
            key={item.date}
            onClick={() => onIndexChange(itemIndex)}
            aria-label={`${formatDay(item.date)} — ${STATE_LABEL[item.overallRisk]}`}
            className="absolute top-1/2 h-3 w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-sm transition hover:scale-y-150"
            style={{
              left: `${points.length === 1 ? 50 : (itemIndex / last) * 100}%`,
              background: STATE_HEX[item.overallRisk],
              opacity: itemIndex === active ? 1 : 0.42,
            }}
          />
        ))}
      </div>

      <input
        type="range"
        className="morph w-full"
        min={0}
        max={Math.max(last, 0)}
        step={1}
        value={active}
        onChange={(event) => {
          const next = Number(event.target.value);
          onIndexChange(next === last ? null : next);
        }}
        aria-label="Scrub the twin through the patient's recorded history"
        aria-valuetext={point ? `${formatDay(point.date)}, ${STATE_LABEL[point.overallRisk]}` : undefined}
      />

      {span && (
        <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-ink-faint">
          <span>{span.from}</span>
          <span>{span.to}</span>
        </div>
      )}

      {point && point.events.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {point.events.slice(0, 6).map((event, eventIndex) => (
            <span
              key={`${event.kind}-${event.label}-${eventIndex}`}
              className="rounded border px-1.5 py-0.5 font-mono text-[10px] text-ink-muted"
              style={{ borderColor: "var(--line)" }}
            >
              <span className="text-ink-faint">{EVENT_LABEL[event.kind]}</span> {event.label}
            </span>
          ))}
          {point.events.length > 6 && (
            <span className="font-mono text-[10px] text-ink-faint">
              +{point.events.length - 6} more
            </span>
          )}
        </div>
      )}

      {index !== null && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-state-amber">
          △ Historical state · rule output for the chart as it stood, not a projection
        </p>
      )}
    </div>
  );
}
