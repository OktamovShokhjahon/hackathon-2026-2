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

interface PatientRow {
  _id: string;
  patientCode: string;
  status: string;
  createdAt: string;
}

export default function AdminPatientsPage() {
  const { data } = useQuery({ queryKey: ["admin-patients"], queryFn: () => api.get<PatientRow[]>("/admin/patients") });

  return (
    <AppShell role="ADMIN" navItems={NAV}>
      <h1 className="mb-6 text-2xl font-semibold text-ink">Patients</h1>
      <div className="panel divide-y divide-white/5">
        {data?.map((p) => (
          <div key={p._id} className="flex items-center justify-between px-5 py-4">
            <span className="text-ink">{p.patientCode}</span>
            <span className="text-xs uppercase text-ink-faint">{p.status}</span>
            <span className="text-sm text-ink-muted">{new Date(p.createdAt).toLocaleDateString()}</span>
          </div>
        ))}
        {data?.length === 0 && <p className="px-5 py-4 text-sm text-ink-faint">No patients yet.</p>}
      </div>
    </AppShell>
  );
}
