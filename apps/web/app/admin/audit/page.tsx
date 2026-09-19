"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell, ADMIN_NAV } from "@/components/ui/app-shell";
import { EmptyState, MetaItem, PageHeader, Panel, Skeleton } from "@/components/ui/console";
import { inputClass } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { formatDateTime, humanizeAuditAction, humanizeEnum } from "@/lib/format";

interface AuditRow {
  _id: string;
  action: string;
  actorRole: string;
  actorName?: string;
  actorEmail?: string;
  targetType: string;
  targetId?: string;
  modelId?: string;
  ruleSetVersion?: string;
  afterSummary?: Record<string, unknown>;
  createdAt: string;
}

const ROLE_FILTERS = ["ALL", "ADMIN", "DOCTOR", "PATIENT"] as const;

function toCsv(rows: AuditRow[]): string {
  const header = ["timestamp", "actor", "role", "action", "target_type", "target_id", "model", "rule_set"];
  const body = rows.map((row) =>
    [
      new Date(row.createdAt).toISOString(),
      row.actorName ?? row.actorEmail ?? "",
      row.actorRole,
      row.action,
      row.targetType,
      row.targetId ?? "",
      row.modelId ?? "",
      row.ruleSetVersion ?? "",
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...body].join("\n");
}

export default function AdminAuditPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<(typeof ROLE_FILTERS)[number]>("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["audit-events"],
    queryFn: () => api.get<AuditRow[]>("/admin/audit-events"),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? []).filter((row) => {
      if (role !== "ALL" && row.actorRole !== role) return false;
      if (!term) return true;
      return [row.action, row.actorName, row.actorEmail, row.targetType, row.targetId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [data, search, role]);

  function exportCsv() {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `twinrx-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${rows.length} audit events`);
  }

  return (
    <AppShell role="ADMIN" navItems={ADMIN_NAV}>
      <PageHeader
        eyebrow="Compliance"
        title="Audit log"
        description="Append-only. Events cannot be edited or deleted from this interface — they can only be read and exported."
        action={
          <button
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="rounded border border-[color:var(--line-strong)] px-4 py-2 text-sm text-ink transition hover:bg-ink/[0.04] disabled:opacity-50"
          >
            Export CSV
          </button>
        }
        meta={
          data && (
            <>
              <MetaItem label="Events held" value={String(data.length)} />
              <MetaItem label="Shown" value={String(rows.length)} />
              <MetaItem label="Retention" value="Append-only" />
            </>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search action, actor or target"
          aria-label="Search audit events"
          className={`${inputClass} max-w-sm`}
        />
        <div className="flex gap-1" role="group" aria-label="Filter by role">
          {ROLE_FILTERS.map((option) => (
            <button
              key={option}
              onClick={() => setRole(option)}
              aria-pressed={role === option}
              className={`rounded border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] transition ${
                role === option
                  ? "border-[color:var(--signal)] text-signal"
                  : "border-[color:var(--line)] text-ink-faint hover:text-ink"
              }`}
            >
              {option === "ALL" ? "All roles" : humanizeEnum(option)}
            </button>
          ))}
        </div>
      </div>

      <Panel title={`Events · ${rows.length}`}>
        {isLoading ? (
          <Skeleton rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={data && data.length > 0 ? "Nothing matches that filter" : "No audit events yet"}
            body={
              data && data.length > 0
                ? "Clear the search or pick a different role."
                : "Sign-ins, record changes and analyses are written here as they happen."
            }
          />
        ) : (
          <ul className="-mx-2 flex flex-col divide-y divide-[color:var(--line)]">
            {rows.map((row) => (
              <li key={row._id} className="flex flex-wrap items-start justify-between gap-3 px-2 py-3">
                <div className="min-w-0">
                  <p className="text-[14px] text-ink">{humanizeAuditAction(row.action)}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                    {row.actorName ?? row.actorEmail ?? "Unknown actor"} · {humanizeEnum(row.actorRole)} ·{" "}
                    {humanizeEnum(row.targetType)}
                    {row.ruleSetVersion ? ` · rule set ${row.ruleSetVersion}` : ""}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-faint">
                  {formatDateTime(row.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AppShell>
  );
}
