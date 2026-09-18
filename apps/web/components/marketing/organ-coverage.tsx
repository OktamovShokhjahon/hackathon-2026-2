"use client";

import { useState } from "react";
import { ORGANS } from "@/components/digital-twin/anatomy";
import { BodyDiagram } from "@/components/digital-twin/body-diagram";
import type { OrganSignal } from "@/components/digital-twin/types";

/**
 * Organ coverage. Hovering a system lights it on the body plate, which is the
 * fastest way to answer "what does this actually watch?" — and it reuses the
 * same registry and diagram the product runs on, so the list cannot drift out
 * of step with what the twin renders.
 */
export function OrganCoverage() {
  const [active, setActive] = useState<string | null>(null);

  // The plate is an atlas here, not a risk readout: everything reads neutral
  // until you point at it.
  const signals: OrganSignal[] = active
    ? [
        {
          organ: active,
          severity: "low",
          color: "green",
          explanation: "",
          missingData: [],
        },
      ]
    : [];

  const bySystem = new Map<string, typeof ORGANS>();
  for (const organ of ORGANS) {
    const list = bySystem.get(organ.system) ?? [];
    list.push(organ);
    bySystem.set(organ.system, list);
  }

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1fr_300px]">
      <div>
        <ul className="grid gap-px overflow-hidden rounded-lg border bg-[color:var(--line)] sm:grid-cols-2">
          {[...bySystem.entries()].map(([system, organs]) => (
            <li key={system} className="bg-surface">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-4">
                <span className="readout w-full">{system}</span>
                {organs.map((organ) => (
                  <button
                    key={organ.key}
                    onMouseEnter={() => setActive(organ.key)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(organ.key)}
                    onBlur={() => setActive(null)}
                    className={`rounded px-1.5 py-0.5 font-display text-[15px] transition ${
                      active === organ.key ? "bg-signal/10 text-signal" : "text-ink hover:text-signal"
                    }`}
                  >
                    {organ.label}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-readable text-[13px] leading-relaxed text-ink-faint">
          Coverage follows the reviewed clinical rule catalog. An organ appears on the twin only
          when a rule or a verified record has something to say about it.
        </p>
      </div>

      <div
        className="panel-sunken mx-auto h-[380px] w-full max-w-[280px] p-4"
        aria-hidden={active === null}
      >
        <BodyDiagram signals={signals} selectedOrgan={active} onSelectOrgan={setActive} />
      </div>
    </div>
  );
}
