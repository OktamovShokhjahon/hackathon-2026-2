"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, ADMIN_NAV } from "@/components/ui/app-shell";
import { MetaItem, PageHeader, Panel, Skeleton } from "@/components/ui/console";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { formatDate, humanizeEnum } from "@/lib/format";

interface SubscriptionData {
  plan: "DEMO" | "MONTHLY" | "YEARLY";
  state: string;
  provider: string;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  trialDaysRemaining?: number;
  writable: boolean;
  lockReason?: string;
  usage: { aiAnalysesThisPeriod: number; doctorsCount: number; patientsCount: number };
  limits: { maxDoctors: number; maxPatients: number; maxAiAnalysesPerMonth: number };
}

const STATE_COLOR: Record<string, string> = {
  trialing: "var(--signal)",
  active: "var(--state-green)",
  past_due: "var(--state-amber)",
  canceled: "var(--state-red)",
  expired: "var(--state-red)",
};

/** A usage meter that says what happens at the limit, not just where you are. */
function UsageMeter({ label, used, limit, hint }: { label: string; used: number; limit: number; hint: string }) {
  const ratio = limit === 0 ? 0 : Math.min(1, used / limit);
  const tone = ratio >= 1 ? "var(--state-red)" : ratio >= 0.8 ? "var(--state-amber)" : "var(--signal)";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="readout">{label}</span>
        <span className="font-mono text-[13px] tabular-nums text-ink">
          {used}
          <span className="text-ink-faint">/{limit}</span>
        </span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/[0.07]"
        role="meter"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`${label}: ${used} of ${limit}`}
      >
        <span
          className="block h-full rounded-full transition-[width] duration-700"
          style={{ width: `${ratio * 100}%`, background: tone }}
        />
      </div>
      <p className="mt-2 text-[12px] leading-snug text-ink-faint">
        {ratio >= 1 ? "At the plan limit — upgrade to add more." : hint}
      </p>
    </div>
  );
}

export default function AdminSubscriptionPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: () => api.get<SubscriptionData>("/admin/subscription"),
  });

  const checkout = useMutation({
    mutationFn: (plan: "MONTHLY" | "YEARLY") =>
      api.post<{ checkoutUrl: string; sessionId: string }>("/billing/checkout-session", { plan }),
    onSuccess: (session) => {
      setError(null);
      // The provider is a mock for the hackathon, so there is no hosted page to
      // send anyone to. Say so plainly rather than pretending a payment ran.
      toast(`Mock checkout session created (${session.sessionId.slice(0, 22)}…)`, "info");
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "The checkout session could not be created"),
  });

  return (
    <AppShell role="ADMIN" navItems={ADMIN_NAV}>
      <PageHeader
        eyebrow="Billing"
        title="Subscription"
        description="What this clinic is entitled to, and how much of it is in use. Reaching a limit stops new work — it never removes or hides anything already recorded."
        meta={
          data && (
            <>
              <MetaItem label="Plan" value={data.plan} />
              <MetaItem label="State" value={humanizeEnum(data.state)} />
              <MetaItem label="Provider" value={data.provider} />
            </>
          )
        }
      />

      {isLoading && (
        <div className="panel p-6">
          <Skeleton rows={4} />
        </div>
      )}

      {data && (
        <div className="grid items-start gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Panel title="Usage this period">
            <div className="flex flex-col gap-5">
              <UsageMeter
                label="Doctor accounts"
                used={data.usage.doctorsCount}
                limit={data.limits.maxDoctors}
                hint="Counts accounts that can sign in."
              />
              <UsageMeter
                label="Patients"
                used={data.usage.patientsCount}
                limit={data.limits.maxPatients}
                hint="Archived patients do not count."
              />
              <UsageMeter
                label="AI analyses"
                used={data.usage.aiAnalysesThisPeriod}
                limit={data.limits.maxAiAnalysesPerMonth}
                hint="Treatment analyses run in the current billing period."
              />
            </div>
          </Panel>

          <div className="flex flex-col gap-4">
            <Panel title="Status">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ background: STATE_COLOR[data.state] ?? "var(--ink-faint)" }}
                />
                <span className="text-[15px] text-ink">
                  {data.plan} — {humanizeEnum(data.state)}
                </span>
              </div>

              {data.trialDaysRemaining !== undefined && data.state === "trialing" && (
                <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
                  {data.trialDaysRemaining === 0
                    ? "The demo period has ended."
                    : `${data.trialDaysRemaining} day${data.trialDaysRemaining === 1 ? "" : "s"} of the demo remain`}
                  {data.trialEndsAt ? ` · ends ${formatDate(data.trialEndsAt)}` : ""}
                </p>
              )}

              {data.currentPeriodEnd && (
                <p className="mt-2 font-mono text-[11px] text-ink-faint">
                  Current period ends {formatDate(data.currentPeriodEnd)}
                </p>
              )}

              {!data.writable && data.lockReason && (
                <p
                  role="alert"
                  className="mt-4 rounded border border-state-amber/40 bg-state-amber/10 px-3 py-2 text-[13px] leading-relaxed text-state-amber"
                >
                  <span aria-hidden>△ </span>
                  {data.lockReason}
                </p>
              )}
            </Panel>

            <Panel title="Change plan">
              <p className="max-w-readable text-[13px] leading-relaxed text-ink-muted">
                Billing runs through a mock provider in this build. The checkout call and the signed
                webhook that activates a plan are the real interfaces — only the payment page is
                absent.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(["MONTHLY", "YEARLY"] as const).map((plan) => (
                  <button
                    key={plan}
                    onClick={() => checkout.mutate(plan)}
                    disabled={checkout.isPending || data.plan === plan}
                    className="rounded border border-[color:var(--line-strong)] px-4 py-2 text-sm text-ink transition hover:bg-ink/[0.04] disabled:opacity-50"
                  >
                    {data.plan === plan ? `Current: ${humanizeEnum(plan)}` : `Switch to ${humanizeEnum(plan)}`}
                  </button>
                ))}
              </div>
              {error && (
                <p role="alert" className="mt-3 rounded border border-state-red/40 bg-state-red/10 px-3 py-2 text-[13px] text-state-red">
                  {error}
                </p>
              )}
            </Panel>
          </div>
        </div>
      )}
    </AppShell>
  );
}
