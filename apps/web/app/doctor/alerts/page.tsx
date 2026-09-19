"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, DOCTOR_NAV } from "@/components/ui/app-shell";
import { RiskBadge } from "@/components/ui/risk-badge";
import { EmptyState, MetaItem, PageHeader, Panel, Row, Skeleton } from "@/components/ui/console";
import { api } from "@/lib/api-client";
import type { RiskColor } from "@/components/digital-twin/types";

interface Scenario {
  _id: string;
  overallRisk: RiskColor;
  patientId: string;
  patientName?: string;
  patientCode?: string;
  createdAt: string;
  status: string;
}

export default function DoctorAlertsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["doctor-dashboard-analyses"],
    queryFn: () => api.get<{ recentAnalyses: Scenario[] }>("/doctor/dashboard"),
  });

  // Red before amber, then newest first within each band.
  const alerts = useMemo(() => {
    const rank: Record<RiskColor, number> = { red: 0, yellow: 1, green: 2 };
    return (data?.recentAnalyses ?? [])
      .filter((item) => item.overallRisk !== "green")
      .sort(
        (a, b) =>
          rank[a.overallRisk] - rank[b.overallRisk] ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [data]);

  const high = alerts.filter((item) => item.overallRisk === "red").length;

  return (
    <AppShell role="DOCTOR" navItems={DOCTOR_NAV}>
      <PageHeader
        eyebrow="Alerts"
        title="Analyses waiting on a decision"
        description="Every alert here needs a doctor to review it and record what they decided. Nothing resolves on its own."
        meta={
          data && (
            <>
              <MetaItem label="High priority" value={String(high)} />
              <MetaItem label="Total open" value={String(alerts.length)} />
            </>
          )
        }
      />

      <Panel title="Open alerts">
        {isError ? (
          <EmptyState
            title="Alerts could not load"
            body="Check your connection and reload. No patient data has changed."
          />
        ) : isLoading ? (
          <Skeleton rows={4} />
        ) : alerts.length === 0 ? (
          <EmptyState
            title="Nothing open"
            body="No analysis is currently flagged for review. New alerts appear here as soon as an analysis returns an amber or red signal."
          />
        ) : (
          <div className="-mx-2 flex flex-col divide-y divide-[color:var(--line)]">
            {alerts.map((alert) => (
              <Row
                key={alert._id}
                href={`/doctor/patients/${alert.patientId}`}
                primary={alert.patientName ?? alert.patientCode ?? "Unnamed patient"}
                secondary={`${new Date(alert.createdAt).toLocaleString()} · ${alert.status}`}
                trailing={<RiskBadge color={alert.overallRisk} quiet />}
              />
            ))}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
