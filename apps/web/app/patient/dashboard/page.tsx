"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PATIENT_NAV } from "@/components/ui/app-shell";
import { RiskBadge } from "@/components/ui/risk-badge";
import { EmptyState, MetaItem, PageHeader, Panel, Row, Skeleton } from "@/components/ui/console";
import { LabTrend, type LabRecord } from "@/components/charts/lab-trend";
import { PreventionPlanPanel } from "@/components/clinical/prevention-plan";
import { api } from "@/lib/api-client";
import type { RiskColor } from "@/components/digital-twin/types";

interface Diagnosis {
  _id: string;
  label: string;
  status?: string;
}
interface Medication {
  _id: string;
  genericName: string;
  dosage: number;
  unit: string;
  frequency: string;
  purpose?: string;
}
interface Scenario {
  _id: string;
  overallRisk: RiskColor;
  horizonDays: number;
  createdAt: string;
}

export default function PatientDashboardPage() {
  const diagnoses = useQuery({
    queryKey: ["me-diagnoses"],
    queryFn: () => api.get<Diagnosis[]>("/me/diagnoses"),
  });
  const medications = useQuery({
    queryKey: ["me-medications"],
    queryFn: () => api.get<Medication[]>("/me/medications"),
  });
  const scenarios = useQuery({
    queryKey: ["approved-scenarios"],
    queryFn: () => api.get<Scenario[]>("/me/approved-scenarios"),
  });
  const history = useQuery({
    queryKey: ["me-history"],
    queryFn: () => api.get<LabRecord[]>("/me/medical-history"),
  });

  const latest = scenarios.data?.[0];

  return (
    <AppShell role="PATIENT" navItems={PATIENT_NAV}>
      <PageHeader
        eyebrow="Your health"
        title="What your doctor has recorded"
        description="Everything here has been reviewed and approved by your doctor. It is not medical advice, and it does not change on its own."
        meta={
          <>
            <MetaItem label="Diagnoses" value={String(diagnoses.data?.length ?? 0)} />
            <MetaItem label="Medications" value={String(medications.data?.length ?? 0)} />
            {latest && <MetaItem label="Latest review" value={new Date(latest.createdAt).toLocaleDateString()} />}
          </>
        }
      />

      {/* The twin is the thing worth opening, so it leads. */}
      <section className="panel relative overflow-hidden p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="readout">Your digital twin</span>
            <h2 className="display mt-2 text-[22px] leading-tight text-ink">
              {latest ? "A scenario is ready to look at" : "No scenario published yet"}
            </h2>
            <p className="mt-2 max-w-readable text-[14px] leading-relaxed text-ink-muted">
              {latest
                ? "See which organs your doctor is watching, and how the plan could change them over a time period you choose."
                : "Your doctor publishes a scenario here after reviewing it. Ask about it at your next visit."}
            </p>
          </div>
          {latest && <RiskBadge color={latest.overallRisk} />}
        </div>

        {latest && (
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Link
              href="/patient/digital-twin"
              className="rounded bg-electric px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-electric/90 hover:shadow-md"
            >
              Open your twin
            </Link>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
              {latest.horizonDays}-day horizon · scenario projection
            </span>
          </div>
        )}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Current diagnoses"
          action={
            <Link
              href="/patient/diagnoses"
              className="font-mono text-[11px] uppercase tracking-[0.12em] text-signal hover:underline"
            >
              All
            </Link>
          }
        >
          {diagnoses.isLoading ? (
            <Skeleton rows={3} />
          ) : diagnoses.data?.length ? (
            <div className="-mx-2 flex flex-col divide-y divide-[color:var(--line)]">
              {diagnoses.data.map((item) => (
                <Row key={item._id} primary={item.label} secondary={item.status} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nothing recorded yet"
              body="Diagnoses appear here once your doctor adds them to your record."
            />
          )}
        </Panel>

        <Panel
          title="Current medications"
          action={
            <Link
              href="/patient/medications"
              className="font-mono text-[11px] uppercase tracking-[0.12em] text-signal hover:underline"
            >
              All
            </Link>
          }
        >
          {medications.isLoading ? (
            <Skeleton rows={3} />
          ) : medications.data?.length ? (
            <div className="-mx-2 flex flex-col divide-y divide-[color:var(--line)]">
              {medications.data.map((item) => (
                <Row
                  key={item._id}
                  primary={item.genericName}
                  secondary={`${item.dosage}${item.unit} · ${item.frequency}`}
                  trailing={
                    item.purpose ? (
                      <span className="shrink-0 text-[12px] text-ink-faint">{item.purpose}</span>
                    ) : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No medications listed"
              body="Medications your doctor prescribes will appear here with their instructions."
            />
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Your measurements over time">
          {history.isLoading ? <Skeleton rows={3} /> : <LabTrend records={history.data ?? []} />}
        </Panel>
      </div>

      <PreventionPlanPanel endpoint="/me/prevention-plan" />

      <div className="mt-4">
        <Panel title="Questions about any of this">
          <p className="max-w-readable text-[14px] leading-relaxed text-ink-muted">
            The assistant can explain your approved results and medication instructions in plain
            language. It cannot diagnose you or change your treatment — for that, contact your
            doctor. If you have emergency symptoms, contact emergency services.
          </p>
          <Link
            href="/patient/chat"
            className="mt-4 inline-block rounded border px-4 py-2 text-sm text-ink transition hover:bg-ink/[0.04]"
            style={{ borderColor: "var(--line-strong)" }}
          >
            Ask a question
          </Link>
        </Panel>
      </div>
    </AppShell>
  );
}
