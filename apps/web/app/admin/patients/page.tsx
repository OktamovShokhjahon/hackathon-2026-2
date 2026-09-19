"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, ADMIN_NAV } from "@/components/ui/app-shell";
import { EmptyState, MetaItem, PageHeader, Panel, Skeleton } from "@/components/ui/console";
import { inputClass } from "@/components/ui/modal";
import { api } from "@/lib/api-client";
import { formatDate, humanizeEnum, initials } from "@/lib/format";

interface PatientRow {
  _id: string;
  patientCode: string;
  status: string;
  createdAt: string;
  user?: { fullName: string; email: string };
}

const STATUSES = ["ALL", "ACTIVE", "INCOMPLETE", "NEEDS_REVIEW", "FOLLOW_UP", "ARCHIVED"] as const;

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "var(--state-green)",
  NEEDS_REVIEW: "var(--state-amber)",
  INCOMPLETE: "var(--state-amber)",
  FOLLOW_UP: "var(--signal)",
  ARCHIVED: "var(--ink-faint)",
};

export default function AdminPatientsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-patients"],
    queryFn: () => api.get<PatientRow[]>("/admin/patients"),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? []).filter((row) => {
      if (status !== "ALL" && row.status !== status) return false;
      if (!term) return true;
      return [row.patientCode, row.user?.fullName, row.user?.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [data, search, status]);

  return (
    <AppShell role="ADMIN" navItems={ADMIN_NAV}>
      <PageHeader
        eyebrow="Clinic console"
        title="Patients"
        description="Who is registered at this clinic, and in what state. Clinical records stay with the treating doctor — nothing on this page opens a chart."
        meta={
          data && (
            <>
              <MetaItem label="Registered" value={String(data.length)} />
              <MetaItem label="Shown" value={String(rows.length)} />
            </>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, code or email"
          aria-label="Search patients"
          className={`${inputClass} max-w-sm`}
        />
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
          {STATUSES.map((option) => (
            <button
              key={option}
              onClick={() => setStatus(option)}
              aria-pressed={status === option}
              className={`rounded border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] transition ${
                status === option
                  ? "border-[color:var(--signal)] text-signal"
                  : "border-[color:var(--line)] text-ink-faint hover:text-ink"
              }`}
            >
              {option === "ALL" ? "All" : humanizeEnum(option)}
            </button>
          ))}
        </div>
      </div>

      <Panel title={`Patients · ${rows.length}`}>
        {isLoading ? (
          <Skeleton rows={5} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={data && data.length > 0 ? "Nothing matches that filter" : "No patients yet"}
            body={
              data && data.length > 0
                ? "Clear the search or choose a different status."
                : "Doctors create patients from their own console."
            }
          />
        ) : (
          <ul className="-mx-2 flex flex-col divide-y divide-[color:var(--line)]">
            {rows.map((patient) => (
              <li key={patient._id} className="flex items-center justify-between gap-4 px-2 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-[11px] text-ink-muted"
                    style={{ background: "var(--sunken)" }}
                  >
                    {initials(patient.user?.fullName)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] text-ink">
                      {patient.user?.fullName ?? "Unnamed patient"}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                      {patient.patientCode} · registered {formatDate(patient.createdAt)}
                    </p>
                  </div>
                </div>
                <span
                  className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em]"
                  style={{ color: STATUS_COLOR[patient.status] ?? "var(--ink-faint)" }}
                >
                  {humanizeEnum(patient.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AppShell>
  );
}
