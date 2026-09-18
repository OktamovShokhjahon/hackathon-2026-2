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

interface Medication {
  _id: string;
  genericName: string;
  dosage: number;
  unit: string;
  route: string;
  frequency: string;
  purpose?: string;
}

export default function PatientMedicationsPage() {
  const { data } = useQuery({ queryKey: ["me-medications"], queryFn: () => api.get<Medication[]>("/me/medications") });

  return (
    <AppShell role="PATIENT" navItems={NAV}>
      <h1 className="mb-6 text-2xl font-semibold text-ink">Current medications</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {data?.map((m) => (
          <div key={m._id} className="panel p-5">
            <p className="font-medium text-ink">{m.genericName}</p>
            <p className="text-sm text-ink-muted">
              {m.dosage}
              {m.unit} · {m.route} · {m.frequency}
            </p>
            {m.purpose && <p className="mt-1 text-xs text-ink-faint">Purpose: {m.purpose}</p>}
          </div>
        ))}
        {data?.length === 0 && <p className="text-sm text-ink-faint">No active medications.</p>}
      </div>
    </AppShell>
  );
}
