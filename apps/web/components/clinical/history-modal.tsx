"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { api, ApiError } from "@/lib/api-client";

const RECORD_TYPES = [
  { value: "symptom", label: "Symptom" },
  { value: "lab_result", label: "Lab result" },
  { value: "vital_sign", label: "Vital sign" },
  { value: "procedure", label: "Procedure" },
  { value: "allergy", label: "Allergy" },
  { value: "lifestyle_observation", label: "Lifestyle observation" },
  { value: "diagnosis", label: "Past diagnosis" },
  { value: "medication", label: "Past medication" },
] as const;

const SOURCES = [
  { value: "doctor_entry", label: "You entered it" },
  { value: "patient_report", label: "The patient reported it" },
  { value: "laboratory", label: "A laboratory" },
  { value: "external_document", label: "An outside document" },
  { value: "other", label: "Other" },
] as const;

const EMPTY = {
  type: "symptom" as (typeof RECORD_TYPES)[number]["value"],
  eventDate: new Date().toISOString().slice(0, 10),
  description: "",
  field: "",
  value: "",
  unit: "",
  sourceType: "doctor_entry" as (typeof SOURCES)[number]["value"],
  note: "",
};

/**
 * Past history entry. Everything here is optional — a chart is useful without
 * it, and a doctor should be able to add one record now and the rest later
 * rather than face a form that demands a complete history up front.
 *
 * A measured value is captured as a named field so the rule engine can read it;
 * free text alone cannot drive a deterministic check.
 */
export function HistoryModal({
  patientId,
  open,
  onClose,
}: {
  patientId: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  const measurable = form.type === "lab_result" || form.type === "vital_sign";

  const addRecord = useMutation({
    mutationFn: () =>
      api.post(`/patients/${patientId}/records`, {
        type: form.type,
        eventDate: new Date(form.eventDate).toISOString(),
        sourceType: form.sourceType,
        status: "verified",
        note: form.note || undefined,
        data: {
          description: form.description || undefined,
          ...(measurable && form.field
            ? { field: form.field, value: Number(form.value), unit: form.unit || undefined }
            : {}),
        },
      }),
    onSuccess: () => {
      setSavedCount((count) => count + 1);
      setError(null);
      // Keep the type and date: history is usually entered in runs.
      setForm((f) => ({ ...f, description: "", field: "", value: "", unit: "", note: "" }));
      queryClient.invalidateQueries({ queryKey: ["records", patientId] });
      queryClient.invalidateQueries({ queryKey: ["scenarios", patientId] });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Could not save this record"),
  });

  function close() {
    setError(null);
    setSavedCount(0);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title="Add past history"
      description="Optional. Add what you have — one record at a time, and come back to the rest whenever."
      footer={
        <>
          {savedCount > 0 && (
            <span className="mr-auto font-mono text-[11px] uppercase tracking-[0.1em] text-state-green">
              {savedCount} record{savedCount > 1 ? "s" : ""} saved
            </span>
          )}
          <button
            type="button"
            onClick={close}
            className="rounded border border-[color:var(--line)] px-4 py-2 text-sm text-ink transition hover:bg-ink/[0.04]"
          >
            Done
          </button>
          <button
            type="submit"
            form="add-history"
            disabled={addRecord.isPending}
            className="rounded bg-electric px-4 py-2 text-sm font-medium text-white transition hover:bg-electric/90 disabled:opacity-60"
          >
            {addRecord.isPending ? "Saving…" : "Save and add another"}
          </button>
        </>
      }
    >
      <form
        id="add-history"
        onSubmit={(event) => {
          event.preventDefault();
          addRecord.mutate();
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Record type">
            <select
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({ ...f, type: e.target.value as typeof f.type }))
              }
              className={inputClass}
            >
              {RECORD_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="When">
            <input
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
              value={form.eventDate}
              onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Description">
          <input
            required
            placeholder="e.g. Reported morning dizziness"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className={inputClass}
          />
        </Field>

        {measurable && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Measurement" hint="Named so the rules can read it.">
              <input
                placeholder="e.g. egfr"
                value={form.field}
                onChange={(e) => setForm((f) => ({ ...f, field: e.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label="Value">
              <input
                type="number"
                step="any"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label="Unit">
              <input
                placeholder="e.g. mL/min"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                className={inputClass}
              />
            </Field>
          </div>
        )}

        <Field label="Where it came from">
          <select
            value={form.sourceType}
            onChange={(e) =>
              setForm((f) => ({ ...f, sourceType: e.target.value as typeof f.sourceType }))
            }
            className={inputClass}
          >
            {SOURCES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Note" hint="Optional.">
          <textarea
            rows={2}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className={`${inputClass} resize-y`}
          />
        </Field>

        {error && (
          <p
            role="alert"
            className="rounded border border-state-red/40 bg-state-red/10 px-3 py-2 text-sm text-state-red"
          >
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
