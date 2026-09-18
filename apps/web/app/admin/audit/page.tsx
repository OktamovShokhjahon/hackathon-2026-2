"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/ui/app-shell";
import { api } from "@/lib/api-client";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/doctors", label: "Doctors" },
  { href: "/admin/patients", label: "Patients" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/subscription", label: "Subscription" },
];

interface AuditRow {
  _id: string;
  action: string;
  actorRole: string;
  targetType: string;
  targetId?: string;
  createdAt: string;
}

export default function AdminAuditPage() {
  const { data } = useQuery({ queryKey: ["audit-events"], queryFn: () => api.get<AuditRow[]>("/admin/audit-events") });

  return (
    <AppShell role="ADMIN" navItems={NAV}>
      <h1 className="mb-6 text-2xl font-semibold text-ink">Audit log</h1>
      <p className="mb-4 text-sm text-ink-faint">Append-only. Cannot be edited from this UI.</p>
      <div className="panel divide-y divide-white/5">
        {data?.map((e) => (
          <div key={e._id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-ink">{e.action}</span>
            <span className="text-xs text-ink-faint">
              {e.actorRole} · {e.targetType} {e.targetId?.slice(-6)} · {new Date(e.createdAt).toLocaleString()}
            </span>
          </div>
        ))}
        {data?.length === 0 && <p className="px-5 py-4 text-sm text-ink-faint">No audit events yet.</p>}
      </div>
    </AppShell>
  );
}
