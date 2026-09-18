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

interface SubscriptionData {
  plan: string;
  state: string;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  usage: { aiAnalysesThisPeriod: number; doctorsCount: number; patientsCount: number };
  limits: { maxDoctors: number; maxPatients: number; maxAiAnalysesPerMonth: number };
}

export default function AdminSubscriptionPage() {
  const { data } = useQuery({
    queryKey: ["subscription"],
    queryFn: () => api.get<SubscriptionData>("/admin/subscription"),
  });

  return (
    <AppShell role="ADMIN" navItems={NAV}>
      <h1 className="mb-6 text-2xl font-semibold text-ink">Subscription</h1>
      {data && (
        <div className="panel max-w-lg p-6">
          <p className="text-lg text-ink">
            {data.plan} — <span className="capitalize">{data.state}</span>
          </p>
          {data.trialEndsAt && (
            <p className="mt-1 text-sm text-ink-muted">Trial ends {new Date(data.trialEndsAt).toLocaleDateString()}</p>
          )}
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-ink-faint">Doctors</p>
              <p className="text-ink">
                {data.usage.doctorsCount}/{data.limits.maxDoctors}
              </p>
            </div>
            <div>
              <p className="text-ink-faint">Patients</p>
              <p className="text-ink">
                {data.usage.patientsCount}/{data.limits.maxPatients}
              </p>
            </div>
            <div>
              <p className="text-ink-faint">AI analyses</p>
              <p className="text-ink">
                {data.usage.aiAnalysesThisPeriod}/{data.limits.maxAiAnalysesPerMonth}
              </p>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
