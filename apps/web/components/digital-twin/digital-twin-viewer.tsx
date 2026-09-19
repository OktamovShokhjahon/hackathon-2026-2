"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { OrganMap } from "./organ-map";
import { BodyDiagram } from "./body-diagram";
import { STATE_GLYPH, STATE_HEX, STATE_LABEL, type Sex } from "./anatomy";
import { OrganLabels, type Projection } from "./organ-labels";
import type { OrganSignal, RiskColor } from "./types";
import type { TwinView, ZoomApi } from "./body-scene";
import { ZoomControls } from "./zoom-controls";
import { TwinTimeline, type TwinTimelineData } from "./twin-timeline";
import { ProvenanceChip } from "@/components/ui/provenance-chip";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

const BodyScene = dynamic(() => import("./body-scene").then((m) => m.BodyScene), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-ink/[0.035]" />,
});

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

const VIEWS: Array<{ id: TwinView; label: string }> = [
  { id: "front", label: "Front" },
  { id: "back", label: "Back" },
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
];

/** Worst state wins, so the summary never reads calmer than the anatomy. */
function overallOf(signals: OrganSignal[]): RiskColor {
  if (signals.some((signal) => signal.color === "red")) return "red";
  if (signals.some((signal) => signal.color === "yellow")) return "yellow";
  return "green";
}

export function DigitalTwinViewer({
  beforeSignals,
  afterSignals,
  horizonDays,
  sex = "male",
  horizons,
  onHorizonChange,
  timeline,
  timelineLoading,
  analysisMeta,
}: {
  beforeSignals: OrganSignal[];
  afterSignals: OrganSignal[];
  horizonDays: number;
  /** From the patient profile (§12.3); drives body shape and organ set. */
  sex?: Sex;
  horizons?: number[];
  onHorizonChange?: (days: number) => void;
  /** Dated rule output from the chart, for the scrubber under the model. */
  timeline?: TwinTimelineData;
  timelineLoading?: boolean;
  analysisMeta?: {
    analyzedAt?: string;
    modelId?: string;
    ruleSetVersion?: string;
    sourceRecordCount?: number;
    stale?: boolean;
  };
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);
  const [prefer2d, setPrefer2d] = useState(false);
  const zoomApi = useRef<ZoomApi | null>(null);
  const [zoom, setZoom] = useState(1);
  const [model, setModel] = useState<Sex>(sex);
  const [mix, setMix] = useState(1);
  const [view, setView] = useState<TwinView>("front");
  const [autoRotate, setAutoRotate] = useState(true);
  const [selectedOrgan, setSelectedOrgan] = useState<string | null>(null);
  // null means the twin is showing the scenario rather than a day in the past.
  const [timeIndex, setTimeIndex] = useState<number | null>(null);
  const animation = useRef<number | null>(null);
  const projection = useRef<Projection>({});

  // Follow the record when it arrives or the patient changes.
  useEffect(() => {
    setModel(sex);
  }, [sex]);

  useEffect(() => {
    // Phones get the 2D diagram by default (§8.7): it is faster, and the twin
    // is easier to read at that width. The toggle below opts back into 3D.
    setWebglSupported(detectWebGL());
    setPrefer2d(window.innerWidth < 640);
  }, []);

  // Before/After buttons animate the morph; the slider drives it directly.
  const animateTo = useCallback(
    (target: number) => {
      if (animation.current) cancelAnimationFrame(animation.current);
      if (reducedMotion) {
        setMix(target);
        return;
      }
      const step = () => {
        setMix((current) => {
          const next = current + (target - current) * 0.16;
          if (Math.abs(target - next) < 0.005) return target;
          animation.current = requestAnimationFrame(step);
          return next;
        });
      };
      animation.current = requestAnimationFrame(step);
    },
    [reducedMotion],
  );

  useEffect(() => () => {
    if (animation.current) cancelAnimationFrame(animation.current);
  }, []);

  // A day picked on the scrubber replaces both ends of the morph: there is no
  // before and after in the past, only what the chart said on that date.
  const historyPoint =
    timeIndex !== null ? timeline?.points[timeIndex] ?? null : null;
  const sceneBefore = historyPoint ? historyPoint.signals : beforeSignals;
  const sceneAfter = historyPoint ? historyPoint.signals : afterSignals;
  const sceneMix = historyPoint ? 1 : mix;

  const activeSignals = historyPoint
    ? historyPoint.signals
    : mix > 0.5
      ? afterSignals
      : beforeSignals;
  const hasBaseline = beforeSignals.length > 0;

  const delta = useMemo(() => {
    const before = overallOf(beforeSignals);
    const after = overallOf(afterSignals);
    const rank: Record<RiskColor, number> = { green: 0, yellow: 1, red: 2 };
    if (!hasBaseline) return null;
    if (rank[after] < rank[before]) return "improves";
    if (rank[after] > rank[before]) return "deteriorates";
    return "unchanged";
  }, [beforeSignals, afterSignals, hasBaseline]);

  return (
    <div className="flex flex-col gap-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="readout">State</span>
          <div className="flex overflow-hidden rounded border" style={{ borderColor: "var(--line)" }}>
            <button
              onClick={() => animateTo(0)}
              disabled={!hasBaseline}
              aria-pressed={mix <= 0.5}
              className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition disabled:opacity-40 ${
                mix <= 0.5 ? "bg-signal/15 text-signal" : "text-ink-faint hover:text-ink"
              }`}
            >
              Before
            </button>
            <button
              onClick={() => animateTo(1)}
              aria-pressed={mix > 0.5}
              className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition ${
                mix > 0.5 ? "bg-signal/15 text-signal" : "text-ink-faint hover:text-ink"
              }`}
            >
              After
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="readout">Model</span>
          <div
            className="flex overflow-hidden rounded border"
            style={{ borderColor: "var(--line)" }}
          >
            {(["male", "female"] as const).map((option) => (
              <button
                key={option}
                onClick={() => setModel(option)}
                aria-pressed={model === option}
                className={`px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition ${
                  model === option ? "bg-signal/15 text-signal" : "text-ink-faint hover:text-ink"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          {model !== sex && (
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-state-amber">
              Not the recorded sex
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!prefer2d && webglSupported && <span className="readout">View</span>}
          {!prefer2d && webglSupported && VIEWS.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              aria-pressed={view === item.id}
              className={`rounded border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] transition ${
                view === item.id
                  ? "border-signal/50 bg-signal/10 text-signal"
                  : "border-transparent text-ink-faint hover:text-ink"
              }`}
              style={view === item.id ? undefined : { borderColor: "var(--line)" }}
            >
              {item.label}
            </button>
          ))}
          {webglSupported && (
            <button
              onClick={() => setPrefer2d((value) => !value)}
              aria-pressed={prefer2d}
              className="rounded border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint transition hover:text-ink"
              style={{ borderColor: "var(--line)" }}
            >
              {prefer2d ? "3D" : "2D"}
            </button>
          )}
          {!prefer2d && webglSupported && (
          <button
            onClick={() => setAutoRotate((value) => !value)}
            aria-pressed={autoRotate}
            className="rounded border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint transition hover:text-ink"
            style={{ borderColor: "var(--line)" }}
          >
            {autoRotate ? "Pause spin" : "Auto-spin"}
          </button>
          )}
        </div>
      </div>

      {/* Stage and organ readout */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div
        className="relative overflow-hidden rounded-lg border bg-[color:var(--console)]"
        style={{ borderColor: "var(--line)" }}
      >
        {webglSupported && !prefer2d && (
          <div className="absolute right-4 top-4 z-10">
            <ZoomControls api={zoomApi} zoom={zoom} onNavy />
          </div>
        )}
        <div className="h-[520px] w-full sm:h-[640px] lg:h-[720px]">
          {webglSupported === null ? (
            <div className="h-full w-full animate-pulse bg-ink/[0.035]" />
          ) : webglSupported && !prefer2d ? (
            <BodyScene
              beforeSignals={sceneBefore}
              afterSignals={sceneAfter}
              mix={sceneMix}
              view={view}
              sex={model}
              projection={projection}
              autoRotate={autoRotate}
              reducedMotion={reducedMotion}
              selectedOrgan={selectedOrgan}
              onSelectOrgan={setSelectedOrgan}
              zoomApi={zoomApi}
              onZoomChange={setZoom}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <BodyDiagram
                signals={activeSignals}
                selectedOrgan={selectedOrgan}
                onSelectOrgan={setSelectedOrgan}
              />
            </div>
          )}
        </div>

        {webglSupported && !prefer2d && (
          <OrganLabels
            signals={activeSignals}
            projection={projection}
            selectedOrgan={selectedOrgan}
            onSelectOrgan={setSelectedOrgan}
          />
        )}

        {/* Corner readout */}
        <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
          <span className="readout">Digital twin</span>
          <span className="font-mono text-[11px] tabular-nums text-signal">
            {historyPoint
              ? `HISTORY · ${new Date(historyPoint.date).toLocaleDateString()}`
              : `${mix > 0.5 ? "AFTER" : "BEFORE"} · ${horizonDays}D HORIZON`}
          </span>
          {(webglSupported === false || prefer2d) && (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
              {webglSupported === false ? "2D diagram · WebGL unavailable" : "2D diagram"}
            </span>
          )}
          </div>
          <span className="hidden sm:inline-flex">
            <ProvenanceChip grade="projection" />
          </span>
        </div>

      </div>

      {/* Time scrubber, directly under the model it drives */}
      <div className="lg:col-start-1 lg:row-start-2">
        <TwinTimeline
          timeline={timeline}
          index={timeIndex}
          onIndexChange={setTimeIndex}
          loading={timelineLoading}
        />
      </div>

      {/* Organ readout rail */}
      <aside
        className="flex max-h-[720px] flex-col self-start overflow-hidden rounded-lg border lg:col-start-2 lg:row-start-1"
        style={{ borderColor: "var(--line)" }}
      >
        <div
          className="flex items-center justify-between border-b px-3 py-2.5"
          style={{ borderColor: "var(--line)" }}
        >
          <span className="readout">Organ readout</span>
          <span className="font-mono text-[10px] tabular-nums text-ink-faint">
            {activeSignals.length}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <OrganMap
            signals={activeSignals}
            selectedOrgan={selectedOrgan}
            onSelectOrgan={setSelectedOrgan}
          />
        </div>
      </aside>
      </div>

      {/* Morph slider */}
      {hasBaseline && !historyPoint && (
        <div className="flex items-center gap-4">
          <span className="readout shrink-0">Before</span>
          <input
            type="range"
            className="morph w-full"
            min={0}
            max={100}
            value={Math.round(mix * 100)}
            onChange={(event) => setMix(Number(event.target.value) / 100)}
            aria-label="Blend between the current state and the projected scenario"
            aria-valuetext={`${Math.round(mix * 100)} percent towards the projected scenario`}
          />
          <span className="readout shrink-0">After</span>
          <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-signal">
            {Math.round(mix * 100)}%
          </span>
        </div>
      )}

      {/* Horizon */}
      {horizons && onHorizonChange && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="readout">Time horizon</span>
          {horizons.map((days) => (
            <button
              key={days}
              onClick={() => onHorizonChange(days)}
              aria-pressed={horizonDays === days}
              className={`rounded border px-3 py-1 font-mono text-[11px] tabular-nums transition ${
                horizonDays === days
                  ? "border-electric/50 bg-electric/10 text-electric"
                  : "text-ink-faint hover:text-ink"
              }`}
              style={horizonDays === days ? undefined : { borderColor: "var(--line)" }}
            >
              {days >= 365 ? "1 year" : `${days} days`}
            </button>
          ))}
        </div>
      )}

      {/* Direction of change */}
      {delta && (
        <div className="panel flex items-center gap-3 p-3">
          <span className="readout">Projected change</span>
          <span
            className="font-mono text-[11px] uppercase tracking-[0.12em]"
            style={{
              color:
                delta === "improves"
                  ? "var(--state-green)"
                  : delta === "deteriorates"
                    ? "var(--state-red)"
                    : "var(--ink-muted)",
            }}
          >
            {delta === "improves"
              ? "↓ Overall risk lower than baseline"
              : delta === "deteriorates"
                ? "↑ Overall risk higher than baseline"
                : "→ Overall risk unchanged"}
          </span>
        </div>
      )}

      <div className="rail" />

      {/* Legend: measured vs inferred vs projected */}
      <div className="panel flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
        <span className="readout">Legend</span>
        {(["green", "yellow", "red"] as RiskColor[]).map((color) => (
          <span key={color} className="flex items-center gap-2 text-xs text-ink-muted">
            <span
              aria-hidden
              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ background: STATE_HEX[color] }}
            >
              {STATE_GLYPH[color]}
            </span>
            {STATE_LABEL[color]}
          </span>
        ))}
        <span className="flex items-center gap-2 text-xs text-ink-muted">
          <span aria-hidden className="inline-block h-4 w-4 rounded-full bg-[#224a63]" />
          Not assessed in this scenario
        </span>
      </div>

      {/* Analysis metadata — required on every clinical analysis (§5). */}
      {analysisMeta && (
        <div
          className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border p-4"
          style={{ borderColor: "var(--line)" }}
        >
          {analysisMeta.stale && (
            <span className="pulse-amber rounded border border-state-amber/40 bg-state-amber/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-state-amber">
              △ Stale · patient data changed, recalculation required
            </span>
          )}
          {analysisMeta.analyzedAt && (
            <Meta label="Analyzed" value={new Date(analysisMeta.analyzedAt).toLocaleString()} />
          )}
          {analysisMeta.modelId && <Meta label="Model" value={analysisMeta.modelId} />}
          {analysisMeta.ruleSetVersion && (
            <Meta label="Rule set" value={analysisMeta.ruleSetVersion} />
          )}
          {typeof analysisMeta.sourceRecordCount === "number" && (
            <Meta label="Source records" value={String(analysisMeta.sourceRecordCount)} />
          )}
        </div>
      )}

      <p className="max-w-readable text-xs leading-relaxed text-ink-faint">
        Measured values come from verified records. Projected values are an illustrative scenario
        estimate over the selected horizon — a potential impact, not a confirmed outcome.
      </p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col">
      <span className="readout">{label}</span>
      <span className="font-mono text-[11px] tabular-nums text-ink-muted">{value}</span>
    </span>
  );
}
