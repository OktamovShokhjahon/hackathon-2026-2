"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { AppShell, PATIENT_NAV } from "@/components/ui/app-shell";
import { EmptyState, MetaItem, PageHeader, Panel, Skeleton } from "@/components/ui/console";
import { inputClass } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { fieldLabel, formatDate, humanizeEnum } from "@/lib/format";

interface HistoryRecord {
  _id: string;
  type: string;
  eventDate: string;
  sourceType?: string;
  note?: string;
  data: { field?: string; description?: string; value?: number | string; unit?: string; note?: string };
}

const TYPE_TONE: Record<string, string> = {
  lab_result: "var(--signal)",
  symptom: "var(--state-amber)",
  diagnosis: "var(--electric)",
  medication: "var(--electric)",
  vital_sign: "var(--signal)",
};

function recordTitle(record: HistoryRecord): string {
  if (record.data.description) return record.data.description;
  if (record.data.field) return fieldLabel(record.data.field);
  return humanizeEnum(record.type);
}

export default function PatientHistoryPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["me-history"],
    queryFn: () => api.get<HistoryRecord[]>("/me/medical-history"),
  });

  const submitObservation = useMutation({
    mutationFn: () => api.post("/me/follow-up-observations", { note: note.trim(), symptomTags: [] }),
    onSuccess: () => {
      setNote("");
      setError(null);
      toast("Sent to your doctor — they will see it with your record");
      queryClient.invalidateQueries({ queryKey: ["me-history"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "That could not be sent"),
  });

  // Grouped by month so a long history stays readable as a timeline.
  const groups = useMemo(() => {
    const byMonth = new Map<string, HistoryRecord[]>();
    for (const record of data ?? []) {
      const key = new Date(record.eventDate).toLocaleString(undefined, { month: "long", year: "numeric" });
      byMonth.set(key, [...(byMonth.get(key) ?? []), record]);
    }
    return [...byMonth.entries()];
  }, [data]);

  return (
    <AppShell role="PATIENT" navItems={PATIENT_NAV}>
      <PageHeader
        eyebrow="Your record"
        title="Your medical history"
        description="Only entries your doctor has confirmed appear here. Anything still being reviewed stays with your doctor until they approve it."
        meta={data && <MetaItem label="Entries" value={String(data.length)} />}
      />

      <Panel title="Tell your doctor something" className="mb-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (note.trim().length > 2) submitObservation.mutate();
          }}
          className="flex flex-col gap-3"
        >
          <label className="flex flex-col gap-1.5">
            <span className="readout">Symptom or follow-up observation</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="For example: dizzy in the mornings since starting the new tablet."
              className={`${inputClass} resize-y`}
            />
          </label>
          <p className="max-w-readable text-[12px] leading-relaxed text-ink-faint">
            This is not monitored in real time. If something feels urgent, contact your doctor or
            emergency services rather than writing it here.
          </p>
          {error && (
            <p role="alert" className="rounded border border-state-red/40 bg-state-red/10 px-3 py-2 text-[13px] text-state-red">
              {error}
            </p>
          )}
          <button
            disabled={note.trim().length < 3 || submitObservation.isPending}
            className="self-start rounded-md bg-electric px-4 py-2 text-sm font-medium text-white transition hover:bg-electric/90 disabled:opacity-50"
          >
            {submitObservation.isPending ? "Sending…" : "Send to my doctor"}
          </button>
        </form>
      </Panel>

      <Panel title="Timeline">
        {isLoading ? (
          <Skeleton rows={5} />
        ) : groups.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            body="Approved results, diagnoses and observations appear here as your doctor records them."
          />
        ) : (
          <div className="flex flex-col gap-6">
            <AnimatePresence initial={false}>
              {groups.map(([month, records]) => (
                <motion.section key={month} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <h3 className="readout mb-3">{month}</h3>
                  <ul className="flex flex-col gap-0 border-l border-[color:var(--line)] pl-4">
                    {records.map((record) => (
                      <li key={record._id} className="relative py-2.5">
                        <span
                          aria-hidden
                          className="absolute -left-[21px] top-4 h-2 w-2 rounded-full"
                          style={{ background: TYPE_TONE[record.type] ?? "var(--ink-faint)" }}
                        />
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-[14px] text-ink">
                            {recordTitle(record)}
                            {record.data.value !== undefined && (
                              <span className="ml-2 font-mono tabular-nums text-ink-muted">
                                {record.data.value}
                                {record.data.unit ? ` ${record.data.unit}` : ""}
                              </span>
                            )}
                          </p>
                          <span className="font-mono text-[11px] text-ink-faint">
                            {formatDate(record.eventDate)}
                          </span>
                        </div>
                        <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint">
                          {humanizeEnum(record.type)}
                          {record.sourceType ? ` · ${humanizeEnum(record.sourceType)}` : ""}
                        </p>
                        {(record.note || record.data.note) && (
                          <p className="mt-1.5 max-w-readable text-[13px] leading-relaxed text-ink-muted">
                            {record.note ?? record.data.note}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </motion.section>
              ))}
            </AnimatePresence>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
