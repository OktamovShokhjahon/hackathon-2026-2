"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/ui/app-shell";
import { api } from "@/lib/api-client";

const NAV = [
  { href: "/patient/dashboard", label: "Dashboard" },
  { href: "/patient/history", label: "History" },
  { href: "/patient/diagnoses", label: "Diagnoses" },
  { href: "/patient/medications", label: "Medications" },
  { href: "/patient/digital-twin", label: "Digital twin" },
  { href: "/patient/chat", label: "Chat" },
];

interface Diagnosis {
  _id: string;
  label: string;
  diagnosedAt: string;
  state: string;
}

export default function PatientDiagnosesPage() {
  const { data } = useQuery({ queryKey: ["me-diagnoses"], queryFn: () => api.get<Diagnosis[]>("/me/diagnoses") });

  return (
    <AppShell role="PATIENT" navItems={NAV}>
      <h1 className="mb-6 text-2xl font-semibold text-ink">Diagnoses</h1>
      <div className="panel divide-y divide-white/5">
        {data?.map((d) => (
          <div key={d._id} className="flex items-center justify-between px-5 py-4">
            <span className="text-ink">{d.label}</span>
            <span className="text-sm text-ink-muted">{new Date(d.diagnosedAt).toLocaleDateString()}</span>
          </div>
        ))}
        {data?.length === 0 && <p className="px-5 py-4 text-sm text-ink-faint">No diagnoses on record.</p>}
      </div>
    </AppShell>
  );
}
