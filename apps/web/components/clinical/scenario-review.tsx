"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { inputClass } from "@/components/ui/modal";
import { formatDateTime, humanizeEnum } from "@/lib/format";

export type Decision = "APPROVED" | "REJECTED" | "DISCONTINUED";

export interface ReviewableScenario {
  _id: string;
  status: string;
  recalculationRequired?: boolean;
  overallRisk: "green" | "yellow" | "red";
  doctorReview?: {
    decision: Decision;
    note?: string;
    visibleToPatient: boolean;
    reviewedAt: string;
  };
}

const DECISIONS: Array<{ value: Decision; label: string; hint: string; tone: string }> = [
  { value: "APPROVED", label: "Approve", hint: "This plan goes ahead as analyzed.", tone: "var(--state-green)" },
  { value: "REJECTED", label: "Reject", hint: "This plan is not going ahead.", tone: "var(--state-red)" },
  {
    value: "DISCONTINUED",
    label: "Discontinue",
    hint: "A plan already in use is being stopped.",
    tone: "var(--state-amber)",
  },
];

/**
 * The step the analysis exists for. Nothing in TwinRx decides anything: the
 * rules produce a finding, the model puts it into words, and then a named
 * clinician records what they are doing about it. Until that happens the
 * patient sees nothing at all — publishing is a separate, deliberate tick, so
 * an approval for the chart is never silently an approval for the patient.
 */
export function ScenarioReview({
  patientId,
  scenario,
}: {
  patientId: string;
  scenario: ReviewableScenario;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [visibleToPatient, setVisibleToPatient] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const review = useMutation({
    mutationFn: () =>
      api.post(`/treatment-scenarios/${scenario._id}/review`, {
        decision,
        note: note.trim() || undefined,
        visibleToPatient: decision === "APPROVED" ? visibleToPatient : false,
      }),
    onSuccess: () => {
      toast(
        decision === "APPROVED" && visibleToPatient
          ? "Decision recorded and published to the patient"
          : "Decision recorded"
      );
      setDecision(null);
      setNote("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["scenarios", patientId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "The decision could not be saved"),
  });

  const recalculate = useMutation({
    mutationFn: () => api.post(`/treatment-scenarios/${scenario._id}/recalculate`),
    onSuccess: () => {
      toast("Re-ran the analysis against the current records");
      queryClient.invalidateQueries({ queryKey: ["scenarios", patientId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "The analysis could not be re-run"),
  });

  // Mongoose materialises the nested `doctorReview` object because one of its
  // fields has a default, so an unreviewed scenario still arrives with an empty
  // one. A review counts only once a decision was actually recorded.
  const reviewed = scenario.doctorReview?.decision ? scenario.doctorReview : undefined;

  return (
    <section
      className="mt-4 rounded-lg border p-5"
      style={{ borderColor: "var(--line)", background: "var(--sunken)" }}
      aria-labelledby="decision-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="decision-heading" className="readout">
            Clinical decision
          </h3>
          <p className="mt-1.5 max-w-readable text-[13px] leading-relaxed text-ink-muted">
            The analysis is decision support. Record what you decided, and choose separately whether
            the patient should see this scenario.
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          {humanizeEnum(scenario.status)}
        </span>
      </div>

      {scenario.recalculationRequired && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded border border-state-amber/40 bg-state-amber/10 px-3 py-2.5">
          <p className="text-[13px] text-state-amber">
            <span aria-hidden>△ </span>
            The patient&rsquo;s records changed after this analysis ran, so it is out of date.
          </p>
          <button
            onClick={() => recalculate.mutate()}
            disabled={recalculate.isPending}
            className="rounded border border-state-amber/50 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-state-amber transition hover:bg-state-amber/10 disabled:opacity-60"
          >
            {recalculate.isPending ? "Re-running…" : "Re-run analysis"}
          </button>
        </div>
      )}

      {reviewed ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded border bg-surface p-4"
          style={{ borderColor: "var(--line)" }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em]"
              style={{
                color: DECISIONS.find((d) => d.value === reviewed.decision)?.tone,
                borderColor: "var(--line-strong)",
              }}
            >
              {humanizeEnum(reviewed.decision)}
            </span>
            <span className="font-mono text-[11px] text-ink-faint">
              {formatDateTime(reviewed.reviewedAt)}
            </span>
            <span
              className="font-mono text-[10px] uppercase tracking-[0.1em]"
              style={{ color: reviewed.visibleToPatient ? "var(--signal)" : "var(--ink-faint)" }}
            >
              {reviewed.visibleToPatient ? "· Visible to patient" : "· Not shared with patient"}
            </span>
          </div>
          {reviewed.note && <p className="mt-2.5 text-[13px] leading-relaxed text-ink">{reviewed.note}</p>}
          <button
            onClick={() => {
              setDecision(reviewed.decision);
              setNote(reviewed.note ?? "");
              setVisibleToPatient(reviewed.visibleToPatient);
            }}
            className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-signal hover:underline"
          >
            Revise this decision
          </button>
        </motion.div>
      ) : null}

      {(!reviewed || decision) && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (decision) review.mutate();
          }}
          className="mt-4 flex flex-col gap-4"
        >
          <fieldset>
            <legend className="readout mb-2">Decision</legend>
            <div className="flex flex-wrap gap-2">
              {DECISIONS.map((option) => {
                const active = decision === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setDecision(option.value)}
                    className="rounded border px-3.5 py-2 text-left text-[13px] transition"
                    style={{
                      borderColor: active ? option.tone : "var(--line)",
                      background: active ? "color-mix(in srgb, var(--surface) 92%, transparent)" : "var(--surface)",
                      color: active ? option.tone : "var(--ink)",
                      boxShadow: active ? `inset 0 0 0 1px ${option.tone}` : undefined,
                    }}
                  >
                    <span className="block font-medium">{option.label}</span>
                    <span className="mt-0.5 block text-[11px] text-ink-faint">{option.hint}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1.5">
            <span className="readout">Clinical note</span>
            <textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What you decided and why, and the follow-up plan."
              className={`${inputClass} resize-y`}
            />
          </label>

          {decision === "APPROVED" && (
            <label className="flex items-start gap-2.5 rounded border border-[color:var(--line)] bg-surface px-3 py-2.5">
              <input
                type="checkbox"
                className="mt-1"
                checked={visibleToPatient}
                onChange={(event) => setVisibleToPatient(event.target.checked)}
              />
              <span className="text-[13px] leading-relaxed text-ink">
                Publish this scenario to the patient
                <span className="mt-0.5 block text-[12px] text-ink-faint">
                  They will see the organ states and the time horizons, labelled as an illustrative
                  projection. Your clinical note stays private.
                </span>
              </span>
            </label>
          )}

          {error && (
            <p role="alert" className="rounded border border-state-red/40 bg-state-red/10 px-3 py-2 text-[13px] text-state-red">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!decision || review.isPending}
              className="rounded bg-electric px-4 py-2 text-sm font-medium text-white transition hover:bg-electric/90 disabled:opacity-50"
            >
              {review.isPending ? "Saving…" : "Record decision"}
            </button>
            {reviewed && (
              <button
                type="button"
                onClick={() => setDecision(null)}
                className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint hover:text-ink"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
