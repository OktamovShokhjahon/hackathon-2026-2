"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { BodyDiagram } from "./body-diagram";
import { DEMO_AFTER, DEMO_BEFORE, DEMO_PATIENT } from "./demo-scenario";
import { ORGAN_BY_KEY } from "./anatomy";
import { OrganLabels, type Projection } from "./organ-labels";
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

/**
 * Landing hero. The twin cycles slowly between the patient's current state and
 * the projected scenario, which is the one thing about this product that cannot
 * be explained faster in words than it can be shown.
 */
export function HeroTwin() {
  const reducedMotion = usePrefersReducedMotion();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [mix, setMix] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const paused = useRef(false);
  const projection = useRef<Projection>({});

  useEffect(() => {
    setSupported(detectWebGL() && window.innerWidth >= 640);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setMix(1);
      return;
    }
    let frame = 0;
    let raf = 0;
    const tick = () => {
      if (!paused.current) {
        frame += 1;
        // 5s hold at each end, 2s transition between them.
        const cycle = frame % 780;
        const next =
          cycle < 300 ? 0 : cycle < 420 ? (cycle - 300) / 120 : cycle < 720 ? 1 : 1 - (cycle - 720) / 60;
        setMix(Math.min(1, Math.max(0, next)));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  const signals = mix > 0.5 ? DEMO_AFTER : DEMO_BEFORE;
  const active = selected ? signals.find((signal) => signal.organ === selected) : null;

  return (
    <div
      className="relative overflow-hidden rounded-lg border bg-[#070d16]"
      style={{ borderColor: "var(--line)" }}
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      <div className="h-[520px] w-full sm:h-[660px]">
        {supported === null ? (
          <div className="h-full w-full animate-pulse bg-ink/[0.035]" />
        ) : supported ? (
          <BodyScene
            beforeSignals={DEMO_BEFORE}
            afterSignals={DEMO_AFTER}
            mix={mix}
            view="front"
            sex="male"
            projection={projection}
            autoRotate
            reducedMotion={reducedMotion}
            selectedOrgan={selected}
            onSelectOrgan={setSelected}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8">
            <BodyDiagram signals={signals} selectedOrgan={selected} onSelectOrgan={setSelected} />
          </div>
        )}
      </div>

      {supported && (
        <OrganLabels
          signals={signals}
          projection={projection}
          selectedOrgan={selected}
          onSelectOrgan={setSelected}
        />
      )}

      {/* Instrument chrome */}
      <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-1">
        <span className="readout">{DEMO_PATIENT.code} · synthetic</span>
        <span className="font-mono text-[11px] tracking-[0.1em] text-signal">
          {mix > 0.5 ? "PROJECTED" : "CURRENT"} · {DEMO_PATIENT.horizonDays}D
        </span>
      </div>

      {/* Morph progress rail */}
      <div className="absolute inset-x-0 bottom-0">
        <div className="flex items-center justify-between px-4 pb-2">
          <span className="readout">Current</span>
          <span className="readout">Projected · 90 days</span>
        </div>
        <div className="h-[2px] w-full bg-ink/10">
          <div
            className="h-full bg-signal transition-[width] duration-100"
            style={{ width: `${mix * 100}%` }}
          />
        </div>
      </div>

      {active && (
        <div
          className="absolute bottom-10 left-4 max-w-xs rounded border bg-surface/95 p-3 backdrop-blur"
          style={{ borderColor: "var(--line-strong)" }}
        >
          <div className="font-display text-sm text-ink">
            {ORGAN_BY_KEY[active.organ]?.label ?? active.organ}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">{active.explanation}</p>
        </div>
      )}
    </div>
  );
}
