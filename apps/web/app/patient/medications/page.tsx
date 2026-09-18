"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/ui/app-shell";
import { EmptyState, MetaItem, PageHeader, Panel, Skeleton } from "@/components/ui/console";
import { api } from "@/lib/api-client";
import { formatDate, humanizeEnum } from "@/lib/format";

const NAV = [
  { href: "/patient/dashboard", label: "Dashboard" },
  { href: "/patient/history", label: "History" },
  { href: "/patient/diagnoses", label: "Diagnoses" },
  { href: "/patient/medications", label: "Medications" },
  { href: "/patient/digital-twin", label: "Digital twin" },
  { href: "/patient/chat", label: "Chat" },
];

interface Medication {
  _id: string;
  genericName: string;
  brandName?: string;
  dosage: number;
  unit: string;
  route: string;
  frequency: string;
  purpose?: string;
  status: string;
  startDate?: string;
  endDate?: string;
}

export default function PatientMedicationsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["me-medications"],
    queryFn: () => api.get<Medication[]>("/me/medications"),
  });

  const active = (data ?? []).filter((item) => item.status === "active");
  const stopped = (data ?? []).filter((item) => item.status !== "active");

  return (
    <AppShell role="PATIENT" navItems={NAV}>
      <PageHeader
        eyebrow="Your record"
        title="Medications"
        description="Exactly as your doctor entered them. Do not change a dose based on this page — ask your doctor first."
        meta={
          data && (
            <>
              <MetaItem label="Current" value={String(active.length)} />
              <MetaItem label="Stopped" value={String(stopped.length)} />
            </>
          )
        }
      />

      {isLoading ? (
        <Panel title="Medications">
          <Skeleton rows={3} />
        </Panel>
      ) : (data?.length ?? 0) === 0 ? (
        <Panel title="Medications">
          <EmptyState
            title="No medications listed"
            body="Anything your doctor prescribes appears here with its dose and instructions."
          />
        </Panel>
      ) : (
        <div className="flex flex-col gap-4">
          {[
            { title: "Taking now", rows: active },
            { title: "No longer taking", rows: stopped },
          ]
            .filter((group) => group.rows.length > 0)
            .map((group) => (
              <div key={group.title}>
                <h2 className="readout mb-2">{group.title}</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.rows.map((medication) => (
                    <article
                      key={medication._id}
                      className="panel p-5"
                      style={{ opacity: medication.status === "active" ? 1 : 0.7 }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-[16px] font-medium text-ink">{medication.genericName}</h3>
                          {medication.brandName && (
                            <p className="text-[12px] text-ink-faint">{medication.brandName}</p>
                          )}
                        </div>
                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                          {humanizeEnum(medication.status)}
                        </span>
                      </div>

                      <p className="mt-3 font-mono text-[14px] tabular-nums text-ink">
                        {medication.dosage}
                        {medication.unit}
                        <span className="text-ink-muted"> · {medication.frequency}</span>
                      </p>
                      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint">
                        {humanizeEnum(medication.route)}
                        {medication.startDate ? ` · since ${formatDate(medication.startDate)}` : ""}
                      </p>

                      {medication.purpose && (
                        <p className="mt-3 border-t border-[color:var(--line)] pt-3 text-[13px] leading-relaxed text-ink-muted">
                          What it is for: {medication.purpose}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </AppShell>
  );
}
