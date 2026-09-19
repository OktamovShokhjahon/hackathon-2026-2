"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PATIENT_NAV } from "@/components/ui/app-shell";
import { RiskBadge } from "@/components/ui/risk-badge";
import { DigitalTwinViewer } from "@/components/digital-twin/digital-twin-viewer";
import { api } from "@/lib/api-client";
import type { OrganSignal } from "@/components/digital-twin/types";
import { twinSex } from "@/components/digital-twin/anatomy";

interface Scenario {
  _id: string;
  overallRisk: "green" | "yellow" | "red";
  signals: OrganSignal[];
  /** Organ states from the approved baseline snapshot, before the plan. */
  baselineSignals?: OrganSignal[];
  horizonDays: number;
  createdAt: string;
  modelId?: string;
  ruleSetVersion?: string;
  sourceRecordCount?: number;
  recalculationRequired?: boolean;
}

const HORIZONS = [7, 30, 90, 365];

export default function PatientDigitalTwinPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["approved-scenarios"],
    queryFn: () => api.get<Scenario[]>("/me/approved-scenarios"),
  });
  const { data: profile } = useQuery({
    queryKey: ["me-profile"],
    queryFn: () => api.get<{ sex?: string }>("/me/profile"),
  });
  const [horizon, setHorizon] = useState(30);

  // Only horizons the doctor actually approved are offered.
  const available = useMemo(() => {
    const days = Array.from(new Set((data ?? []).map((item) => item.horizonDays)));
    return days.length > 0 ? days.sort((a, b) => a - b) : HORIZONS;
  }, [data]);

  const scenario =
    data?.find((item) => item.horizonDays === horizon) ?? data?.[0] ?? null;

  return (
    <AppShell role="PATIENT" navItems={PATIENT_NAV}>
      <div className="max-w-5xl">
        <span className="readout">Your digital twin</span>
        <h1 className="display mt-2 text-[30px] leading-tight text-ink">
          What your doctor&rsquo;s plan could change
        </h1>
        <p className="mt-3 max-w-readable text-[15px] leading-relaxed text-ink-muted">
          This is an educational scenario your doctor approved. It shows a possible direction over
          the time you choose — it is not a prediction of your health and it is not medical advice.
        </p>

        <div className="rail my-8" />

        {isLoading && (
          <div className="h-[480px] animate-pulse rounded-lg bg-ink/[0.035]" role="status" aria-label="Loading your twin" />
        )}

        {isError && (
          <div
            className="rounded-lg border p-6"
            style={{ borderColor: "var(--line-strong)" }}
          >
            <h2 className="display text-[17px] text-ink">Your twin could not load</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Check your connection and reload the page. Your records are unchanged.
            </p>
          </div>
        )}

        {!isLoading && !isError && scenario && (
          <div className="panel p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <span className="readout">
                Approved {new Date(scenario.createdAt).toLocaleDateString()}
              </span>
              <RiskBadge color={scenario.overallRisk} />
            </div>

            <DigitalTwinViewer
              beforeSignals={scenario.baselineSignals ?? []}
              afterSignals={scenario.signals}
              horizonDays={scenario.horizonDays}
              sex={twinSex(profile?.sex)}
              horizons={available}
              onHorizonChange={setHorizon}
              analysisMeta={{
                analyzedAt: scenario.createdAt,
                modelId: scenario.modelId,
                ruleSetVersion: scenario.ruleSetVersion,
                sourceRecordCount: scenario.sourceRecordCount,
                stale: scenario.recalculationRequired,
              }}
            />
          </div>
        )}

        {!isLoading && !isError && !scenario && (
          <div className="rounded-lg border p-8" style={{ borderColor: "var(--line)" }}>
            <h2 className="display text-[17px] text-ink">No approved scenario yet</h2>
            <p className="mt-2 max-w-readable text-sm leading-relaxed text-ink-muted">
              Your doctor publishes a scenario here after reviewing it. Ask about it at your next
              visit.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
