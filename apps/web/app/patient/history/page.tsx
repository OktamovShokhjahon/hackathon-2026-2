"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

interface HistoryRecord {
  _id: string;
  type: string;
  eventDate: string;
  data: Record<string, unknown>;
}

export default function PatientHistoryPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["me-history"],
    queryFn: () => api.get<HistoryRecord[]>("/me/medical-history"),
  });
  const [note, setNote] = useState("");

  const submitObservation = useMutation({
    mutationFn: () => api.post("/me/follow-up-observations", { note, symptomTags: [] }),
    onSuccess: () => {
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["me-history"] });
    },
  });

  return (
    <AppShell role="PATIENT" navItems={NAV}>
      <h1 className="mb-6 text-2xl font-semibold text-ink">Verified medical history</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (note.trim()) submitObservation.mutate();
        }}
        className="panel mb-6 flex flex-col gap-3 p-5"
      >
        <label className="text-sm text-ink-muted">Report a symptom or follow-up observation</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="rounded-lg border border-[color:var(--line)] bg-ink/[0.04] px-3 py-2 text-ink"
        />
        <button className="self-start rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white">Submit</button>
      </form>

      <div className="panel divide-y divide-white/5">
        {data?.map((r) => (
          <div key={r._id} className="px-5 py-4">
            <p className="text-sm text-ink capitalize">{r.type.replace(/_/g, " ")}</p>
            <p className="text-xs text-ink-faint">{new Date(r.eventDate).toLocaleDateString()}</p>
          </div>
        ))}
        {data?.length === 0 && <p className="px-5 py-4 text-sm text-ink-faint">No approved history yet.</p>}
      </div>
    </AppShell>
  );
}
