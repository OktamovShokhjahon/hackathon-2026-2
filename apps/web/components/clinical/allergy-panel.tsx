"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState, Panel, Skeleton } from "@/components/ui/console";
import { inputClass } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { humanizeEnum } from "@/lib/format";

interface Allergy {
  _id: string;
  substance: string;
  reaction?: string;
  severity: "mild" | "moderate" | "severe" | "unknown";
}

const SEVERITY_COLOR: Record<Allergy["severity"], string> = {
  severe: "var(--state-red)",
  moderate: "var(--state-amber)",
  mild: "var(--ink-muted)",
  unknown: "var(--ink-faint)",
};

const EMPTY = { substance: "", reaction: "", severity: "unknown" as Allergy["severity"] };

/**
 * Allergies are read by the rule engine, not just displayed: a plan containing
 * a substance recorded here, or one that shares its structure, is flagged as a
 * high-priority conflict. That only works if the list is actually kept, which
 * is why it sits on the chart rather than behind a history modal.
 */
export function AllergyPanel({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["allergies", patientId],
    queryFn: () => api.get<Allergy[]>(`/patients/${patientId}/allergies`),
  });

  const addAllergy = useMutation({
    mutationFn: () =>
      api.post(`/patients/${patientId}/allergies`, {
        substance: form.substance.trim(),
        reaction: form.reaction.trim() || undefined,
        severity: form.severity,
      }),
    onSuccess: () => {
      setForm(EMPTY);
      setError(null);
      toast("Allergy recorded — future analyses will check against it");
      queryClient.invalidateQueries({ queryKey: ["allergies", patientId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "The allergy could not be saved"),
  });

  return (
    <Panel title={`Allergies${data && data.length > 0 ? ` · ${data.length}` : ""}`}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          addAllergy.mutate();
        }}
        className="mb-4 flex flex-wrap gap-2"
      >
        <input
          required
          placeholder="Substance, e.g. Penicillin"
          value={form.substance}
          onChange={(event) => setForm((f) => ({ ...f, substance: event.target.value }))}
          className={`${inputClass} flex-1`}
        />
        <input
          placeholder="Reaction"
          value={form.reaction}
          onChange={(event) => setForm((f) => ({ ...f, reaction: event.target.value }))}
          className={`${inputClass} w-36`}
        />
        <select
          value={form.severity}
          aria-label="Severity"
          onChange={(event) => setForm((f) => ({ ...f, severity: event.target.value as Allergy["severity"] }))}
          className={`${inputClass} w-32`}
        >
          <option value="unknown">Unknown</option>
          <option value="mild">Mild</option>
          <option value="moderate">Moderate</option>
          <option value="severe">Severe</option>
        </select>
        <button
          disabled={addAllergy.isPending || form.substance.trim().length === 0}
          className="rounded bg-electric px-4 py-2 text-sm font-medium text-white transition hover:bg-electric/90 disabled:opacity-60"
        >
          {addAllergy.isPending ? "Adding…" : "Add"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mb-3 rounded border border-state-red/40 bg-state-red/10 px-3 py-2 text-[13px] text-state-red">
          {error}
        </p>
      )}

      {isLoading ? (
        <Skeleton rows={2} />
      ) : data && data.length > 0 ? (
        <ul className="flex flex-col divide-y divide-[color:var(--line)]">
          {data.map((allergy) => (
            <li key={allergy._id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
              <div className="min-w-0">
                <p className="truncate text-[14px] text-ink">{allergy.substance}</p>
                {allergy.reaction && <p className="mt-0.5 text-[12px] text-ink-muted">{allergy.reaction}</p>}
              </div>
              <span
                className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em]"
                style={{ color: SEVERITY_COLOR[allergy.severity] }}
              >
                {humanizeEnum(allergy.severity)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No allergies recorded"
          body="An empty list is not the same as none known — record what the patient reports, so analyses can check against it."
        />
      )}
    </Panel>
  );
}
