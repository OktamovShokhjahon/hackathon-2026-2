"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/ui/app-shell";
import { EmptyState, PageHeader, Panel, Skeleton } from "@/components/ui/console";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { api, ApiError } from "@/lib/api-client";

const NAV = [
  { href: "/doctor/dashboard", label: "Dashboard" },
  { href: "/doctor/patients", label: "Patients" },
  { href: "/doctor/alerts", label: "Alerts" },
];

interface PatientRow {
  _id: string;
  patientCode: string;
  status: string;
  user?: { fullName: string; email: string; phone?: string };
}

const EMPTY = { fullName: "", email: "", phone: "", password: "" };

export default function DoctorPatientsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["doctor-patients", search],
    queryFn: () =>
      api.get<PatientRow[]>(`/patients${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const createPatient = useMutation({
    mutationFn: () => api.post<{ patient: { id: string } }>("/patients", form),
    onSuccess: (res) => {
      setForm(EMPTY);
      setError(null);
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["doctor-patients"] });
      // Straight into the chart: creating a patient is always the first step
      // of recording something about them.
      router.push(`/doctor/patients/${res.patient.id}`);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Could not create the patient"),
  });

  function close() {
    setOpen(false);
    setError(null);
  }

  return (
    <AppShell role="DOCTOR" navItems={NAV}>
      <PageHeader
        eyebrow="Doctor console"
        title="Patients"
        description="Everyone on your panel. Open a chart to add history, run an analysis, or read the twin."
        action={
          <button
            onClick={() => setOpen(true)}
            className="rounded bg-electric px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-electric/90 hover:shadow-md"
          >
            New patient
          </button>
        }
      />

      <div className="mb-4">
        <input
          placeholder="Search by name, code or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search patients"
          className={`${inputClass} max-w-sm`}
        />
      </div>

      <Panel title={`Panel${data ? ` · ${data.length}` : ""}`}>
        {isLoading ? (
          <Skeleton rows={5} />
        ) : data && data.length > 0 ? (
          <ul className="-mx-2 flex flex-col divide-y divide-[color:var(--line)]">
            {data.map((patient) => (
              <li key={patient._id}>
                <Link
                  href={`/doctor/patients/${patient._id}`}
                  className="flex items-center justify-between gap-4 rounded px-3 py-3 transition hover:bg-ink/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] text-ink">
                      {patient.user?.fullName ?? "Unnamed patient"}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                      {patient.patientCode}
                      {patient.user?.phone ? ` · ${patient.user.phone}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                    {patient.status.replace(/_/g, " ").toLowerCase()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title={search ? "No patients match that search" : "No patients yet"}
            body={
              search
                ? "Try a different name, patient code or phone number."
                : "Create the first patient to start building a chart."
            }
          />
        )}
      </Panel>

      <Modal
        open={open}
        onClose={close}
        title="New patient"
        description="Name, contact details and a password are enough to start. Everything clinical is added afterwards."
        footer={
          <>
            <button
              type="button"
              onClick={close}
              className="rounded border border-[color:var(--line)] px-4 py-2 text-sm text-ink transition hover:bg-ink/[0.04]"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-patient"
              disabled={createPatient.isPending}
              className="rounded bg-electric px-4 py-2 text-sm font-medium text-white transition hover:bg-electric/90 disabled:opacity-60"
            >
              {createPatient.isPending ? "Creating…" : "Create patient"}
            </button>
          </>
        }
      >
        <form
          id="create-patient"
          onSubmit={(event) => {
            event.preventDefault();
            createPatient.mutate();
          }}
          className="flex flex-col gap-4"
        >
          <Field label="Full name">
            <input
              required
              minLength={2}
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              className={inputClass}
            />
          </Field>

          <Field label="Phone number">
            <input
              type="tel"
              required
              minLength={5}
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className={inputClass}
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className={inputClass}
            />
          </Field>

          <Field
            label="Password"
            hint="At least 10 characters. Give it to the patient securely — it is stored hashed and never shown again."
          >
            <input
              type="text"
              required
              minLength={10}
              autoComplete="off"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className={inputClass}
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
    </AppShell>
  );
}
