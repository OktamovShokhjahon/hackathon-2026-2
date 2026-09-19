"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell, PATIENT_NAV } from "@/components/ui/app-shell";
import { EmptyState, MetaItem, PageHeader, Panel, Skeleton } from "@/components/ui/console";
import { api } from "@/lib/api-client";
import { formatDate, humanizeEnum } from "@/lib/format";

interface Diagnosis {
  _id: string;
  label: string;
  diagnosedAt: string;
  state: string;
  code?: string;
}

export default function PatientDiagnosesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["me-diagnoses"],
    queryFn: () => api.get<Diagnosis[]>("/me/diagnoses"),
  });

  const active = (data ?? []).filter((item) => item.state === "active");
  const past = (data ?? []).filter((item) => item.state !== "active");

  return (
    <AppShell role="PATIENT" navItems={PATIENT_NAV}>
      <PageHeader
        eyebrow="Your record"
        title="Diagnoses"
        description="What your doctor has recorded and confirmed. If something here looks wrong, tell your doctor — this page cannot be edited from your side."
        meta={
          data && (
            <>
              <MetaItem label="Active" value={String(active.length)} />
              <MetaItem label="Past" value={String(past.length)} />
            </>
          )
        }
      />

      {isLoading ? (
        <Panel title="Diagnoses">
          <Skeleton rows={3} />
        </Panel>
      ) : (data?.length ?? 0) === 0 ? (
        <Panel title="Diagnoses">
          <EmptyState
            title="No diagnoses on record"
            body="Anything your doctor confirms will appear here with the date it was recorded."
          />
        </Panel>
      ) : (
        <div className="flex flex-col gap-4">
          {[
            { title: "Active", rows: active },
            { title: "Past and resolved", rows: past },
          ]
            .filter((group) => group.rows.length > 0)
            .map((group) => (
              <Panel key={group.title} title={group.title}>
                <ul className="-mx-2 flex flex-col divide-y divide-[color:var(--line)]">
                  {group.rows.map((diagnosis) => (
                    <li key={diagnosis._id} className="flex flex-wrap items-baseline justify-between gap-3 px-2 py-3">
                      <div className="min-w-0">
                        <p className="text-[15px] text-ink">{diagnosis.label}</p>
                        <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint">
                          {humanizeEnum(diagnosis.state)}
                          {diagnosis.code ? ` · ${diagnosis.code}` : ""}
                        </p>
                      </div>
                      <span className="font-mono text-[12px] tabular-nums text-ink-muted">
                        Recorded {formatDate(diagnosis.diagnosedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
            ))}
        </div>
      )}
    </AppShell>
  );
}
