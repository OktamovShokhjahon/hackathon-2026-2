"use client";

import { ORGAN_BY_KEY, STATE_GLYPH, STATE_HEX, STATE_LABEL } from "./anatomy";
import { ProvenanceChip } from "@/components/ui/provenance-chip";
import type { OrganSignal } from "./types";

/**
 * Organ readout. Sits beside the twin as a rail: one row per organ, expanding
 * in place when selected. Rows and the 3D scene share a selection, so clicking
 * either one moves the other.
 *
 * This is also the accessible version of the twin — the full clinical state is
 * available as text, without colour and without 3D.
 */
export function OrganMap({
  signals,
  selectedOrgan,
  onSelectOrgan,
}: {
  signals: OrganSignal[];
  selectedOrgan?: string | null;
  onSelectOrgan?: (key: string | null) => void;
}) {
  if (signals.length === 0) {
    return (
      <p className="text-sm text-ink-faint">
        No organ-level signals for this scenario. Nothing here means &ldquo;not assessed&rdquo;, not
        &ldquo;no risk&rdquo;.
      </p>
    );
  }

  // Problems first: a doctor should not have to hunt for the red row.
  const order = { red: 0, yellow: 1, green: 2 } as const;
  const sorted = [...signals].sort((a, b) => order[a.color] - order[b.color]);

  return (
    <ul className="flex flex-col">
      {sorted.map((signal, index) => {
        const organ = ORGAN_BY_KEY[signal.organ];
        const active = selectedOrgan === signal.organ;
        return (
          <li key={`${signal.organ}-${index}`}>
            <button
              type="button"
              onClick={() => onSelectOrgan?.(active ? null : signal.organ)}
              aria-expanded={active}
              className={`w-full border-b px-3 py-3 text-left transition ${
                active ? "bg-ink/[0.035]" : "hover:bg-ink/[0.05]"
              }`}
              style={{
                borderColor: "var(--line)",
                boxShadow: active ? `inset 2px 0 0 ${STATE_HEX[signal.color]}` : undefined,
              }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ background: STATE_HEX[signal.color] }}
                >
                  {STATE_GLYPH[signal.color]}
                </span>
                <span className="min-w-0 flex-1 truncate font-display text-[14px] text-ink">
                  {organ?.label ?? signal.organ}
                </span>
                <span
                  className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em]"
                  style={{ color: STATE_HEX[signal.color] }}
                >
                  {signal.severity}
                </span>
              </div>

              {!active && signal.missingData.length > 0 && (
                <p className="mt-1 pl-[26px] font-mono text-[9px] uppercase tracking-[0.1em] text-state-amber">
                  {signal.missingData.length} field
                  {signal.missingData.length > 1 ? "s" : ""} missing
                </p>
              )}

              {active && (
                <div className="mt-2 pl-[26px]">
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
                    {organ?.system} · {STATE_LABEL[signal.color]}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
                    {signal.explanation}
                  </p>
                  <div className="mt-2.5">
                    <ProvenanceChip grade={signal.evidence ?? "projection"} />
                  </div>
                  {signal.missingData.length > 0 && (
                    <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-state-amber">
                      Missing: {signal.missingData.join(" · ")}
                    </p>
                  )}
                </div>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
