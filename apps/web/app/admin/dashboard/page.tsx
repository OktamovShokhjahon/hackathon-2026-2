"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, ADMIN_NAV } from "@/components/ui/app-shell";
import { RiskBadge } from "@/components/ui/risk-badge";
import {
  DistributionBars,
  EmptyState,
  MetaItem,
  PageHeader,
  Panel,
  QueueCard,
  RiskRibbon,
  Row,
} from "@/components/ui/console";
import { AnalysisTrend, type TrendPoint } from "@/components/charts/analysis-trend";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { RiskColor } from "@/components/digital-twin/types";

interface DashboardData {
  activeDoctors: number;
  activePatients: number;
  patientsByStatus: Array<{ _id: string; count: number }>;
  recentAnalyses: Array<{
    _id: string;
    overallRisk: RiskColor;
    createdAt: string;
    patientId: string;
    patientName?: string;
    patientCode?: string;
  }>;
  highRiskAlerts: number;
}

export default function AdminDashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => api.get<DashboardData>("/admin/dashboard"),
  });

  const { data: trends } = useQuery({
    queryKey: ["analytics-trends"],
    queryFn: () => api.get<TrendPoint[]>("/analytics/trends"),
  });

  const counts = useMemo(() => {
    const tally: Record<RiskColor, number> = { green: 0, yellow: 0, red: 0 };
    for (const analysis of data?.recentAnalyses ?? []) tally[analysis.overallRisk] += 1;
    return tally;
  }, [data]);

  const statuses = useMemo(
    () =>
      [...(data?.patientsByStatus ?? [])]
        .sort((a, b) => b.count - a.count)
        .map((item) => ({ label: item._id, count: item.count })),
    [data],
  );

  return (
    <AppShell role="ADMIN" navItems={ADMIN_NAV}>
      <PageHeader
        eyebrow="Clinic console"
        title="How the clinic is running"
        description="Clinic-level activity only. Patient records stay with the treating doctor."
        action={
          <Link
            href="/admin/doctors"
            className="rounded bg-electric px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-electric/90 hover:shadow-md"
          >
            Manage doctors
          </Link>
        }
        meta={
          data && (
            <>
              <MetaItem label="Active doctors" value={String(data.activeDoctors)} />
              <MetaItem label="Active patients" value={String(data.activePatients)} />
              <MetaItem label="Updated" value={new Date().toLocaleTimeString()} />
            </>
          )
        }
      />

      {isError && (
        <div className="panel p-6">
          <EmptyState
            title="The console could not load"
            body="Check your connection and reload. No clinic data has changed."
          />
        </div>
      )}

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="panel h-[136px] animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <QueueCard
              label="High-priority alerts"
              count={data.highRiskAlerts}
              hint="Analyses awaiting a doctor's decision"
              href="/admin/patients"
              tone="red"
              index={0}
            />
            <QueueCard
              label="Active doctors"
              count={data.activeDoctors}
              hint="Accounts able to sign in"
              href="/admin/doctors"
              kind="stat"
              index={1}
            />
            <QueueCard
              label="Active patients"
              count={data.activePatients}
              hint="Across the clinic"
              href="/admin/patients"
              kind="stat"
              index={2}
            />
          </div>

          <div className="mt-6 grid items-start gap-4 lg:grid-cols-[1fr_1fr]">
            <Panel title="Patients by status">
              <DistributionBars items={statuses} />
              <p className="mt-5 border-t border-[color:var(--line)] pt-3 text-[12px] leading-relaxed text-ink-faint">
                Incomplete patients are missing required fields; needs-review patients have AI
                extraction a doctor has not confirmed.
              </p>
            </Panel>

            <Panel title="Risk across recent analyses">
              <RiskRibbon counts={counts} />
              <p className="mt-5 border-t border-[color:var(--line)] pt-3 text-[12px] leading-relaxed text-ink-faint">
                Counts only. Clinic admins see that an analysis happened, never its clinical
                content.
              </p>
            </Panel>
          </div>

          <div className="mt-4">
            <Panel title="Analysis volume">
              <AnalysisTrend data={trends ?? []} />
              <p className="mt-4 border-t border-[color:var(--line)] pt-3 text-[12px] leading-relaxed text-ink-faint">
                Analyses run per day across the clinic, with the high-priority share drawn on top.
                Volume only — no clinical content reaches this page.
              </p>
            </Panel>
          </div>

          <div className="mt-4">
            <Panel
              title="Recent analyses"
              action={
                <Link
                  href="/admin/audit"
                  className="font-mono text-[11px] uppercase tracking-[0.12em] text-signal hover:underline"
                >
                  Audit log
                </Link>
              }
            >
              {data.recentAnalyses.length === 0 ? (
                <EmptyState
                  title="No analyses yet"
                  body="Once a doctor runs a treatment analysis, it is recorded here and in the audit log."
                />
              ) : (
                <div className="-mx-2 flex flex-col divide-y divide-[color:var(--line)]">
                  {data.recentAnalyses.map((analysis) => (
                    <Row
                      key={analysis._id}
                      primary={analysis.patientName ?? analysis.patientCode ?? "Unnamed patient"}
                      secondary={formatDateTime(analysis.createdAt)}
                      trailing={<RiskBadge color={analysis.overallRisk} quiet />}
                    />
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </AppShell>
  );
}
