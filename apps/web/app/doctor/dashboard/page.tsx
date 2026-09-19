"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, DOCTOR_NAV } from "@/components/ui/app-shell";
import { RiskBadge } from "@/components/ui/risk-badge";
import {
  EmptyState,
  MetaItem,
  PageHeader,
  Panel,
  QueueCard,
  RiskRibbon,
  Row,
  Skeleton,
} from "@/components/ui/console";
import { api } from "@/lib/api-client";
import type { RiskColor } from "@/components/digital-twin/types";

interface DoctorDashboard {
  assignedPatients: number;
  needsReview: number;
  newAlerts: number;
  missingDataTasks: number;
  recentAnalyses: Array<{
    _id: string;
    overallRisk: RiskColor;
    createdAt: string;
    patientId?: string;
    patientName?: string;
    patientCode?: string;
    status?: string;
  }>;
}

export default function DoctorDashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["doctor-dashboard"],
    queryFn: () => api.get<DoctorDashboard>("/doctor/dashboard"),
  });

  const counts = useMemo(() => {
    const tally: Record<RiskColor, number> = { green: 0, yellow: 0, red: 0 };
    for (const analysis of data?.recentAnalyses ?? []) tally[analysis.overallRisk] += 1;
    return tally;
  }, [data]);

  // Worst first: a dashboard that lists newest-first buries the red result.
  const ranked = useMemo(() => {
    const rank: Record<RiskColor, number> = { red: 0, yellow: 1, green: 2 };
    return [...(data?.recentAnalyses ?? [])].sort(
      (a, b) =>
        rank[a.overallRisk] - rank[b.overallRisk] ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [data]);

  return (
    <AppShell role="DOCTOR" navItems={DOCTOR_NAV}>
      <PageHeader
        eyebrow="Doctor console"
        title="What needs you today"
        description="Queues first, then the analyses you have run most recently — highest risk at the top."
        action={
          <Link
            href="/doctor/patients"
            className="rounded bg-electric px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-electric/90 hover:shadow-md"
          >
            New patient
          </Link>
        }
        meta={
          data && (
            <>
              <MetaItem label="Assigned patients" value={String(data.assignedPatients)} />
              <MetaItem
                label="Analyses shown"
                value={String(data.recentAnalyses.length)}
              />
              <MetaItem label="Updated" value={new Date().toLocaleTimeString()} />
            </>
          )
        }
      />

      {isError && (
        <div className="panel p-6">
          <EmptyState
            title="The console could not load"
            body="Check your connection and reload. No patient data has changed."
          />
        </div>
      )}

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="panel h-[136px] animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* Triage strip: the reason to open this page at all. */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <QueueCard
              label="Needs review"
              count={data.needsReview}
              hint="Patients with unverified facts"
              href="/doctor/patients"
              tone="amber"
              index={0}
            />
            <QueueCard
              label="New alerts"
              count={data.newAlerts}
              hint="Analyses flagged for a decision"
              href="/doctor/alerts"
              tone="red"
              index={1}
            />
            <QueueCard
              label="Missing data"
              count={data.missingDataTasks}
              hint="Fields to verify before deciding"
              href="/doctor/patients"
              tone="amber"
              index={2}
            />
            <QueueCard
              label="Assigned patients"
              count={data.assignedPatients}
              hint="On your panel"
              href="/doctor/patients"
              kind="stat"
              index={3}
            />
          </div>

          <div className="mt-6 grid items-start gap-4 lg:grid-cols-[1.6fr_1fr]">
            <Panel
              title="Recent treatment analyses"
              action={
                <Link
                  href="/doctor/alerts"
                  className="font-mono text-[11px] uppercase tracking-[0.12em] text-signal hover:underline"
                >
                  All alerts
                </Link>
              }
            >
              {ranked.length === 0 ? (
                <EmptyState
                  title="No analyses yet"
                  body="Open a patient, add the proposed medication, and run a treatment analysis to see it here."
                  action={
                    <Link
                      href="/doctor/patients"
                      className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-signal hover:underline"
                    >
                      Go to patients
                    </Link>
                  }
                />
              ) : (
                <div className="-mx-2 flex flex-col divide-y divide-[color:var(--line)]">
                  {ranked.map((analysis) => (
                    <Row
                      key={analysis._id}
                      href={analysis.patientId ? `/doctor/patients/${analysis.patientId}` : undefined}
                      primary={
                        analysis.patientName ??
                        analysis.patientCode ??
                        "Unnamed patient"
                      }
                      secondary={`${new Date(analysis.createdAt).toLocaleString()}${
                        analysis.status ? ` · ${analysis.status}` : ""
                      }`}
                      trailing={<RiskBadge color={analysis.overallRisk} quiet />}
                    />
                  ))}
                </div>
              )}
            </Panel>

            <div className="flex flex-col gap-4">
              <Panel title="Risk across recent analyses">
                <RiskRibbon counts={counts} />
              </Panel>

              <Panel title="Before you decide">
                <ul className="flex flex-col gap-3">
                  {[
                    "Deterministic rules run before any model explanation.",
                    "Unverified AI facts stay out of the patient snapshot.",
                    "An analysis goes stale when its source records change.",
                  ].map((line) => (
                    <li key={line} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-muted">
                      <span
                        aria-hidden
                        className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-signal"
                      />
                      {line}
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
