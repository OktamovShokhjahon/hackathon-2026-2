"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/ui/app-shell";
import { RiskBadge } from "@/components/ui/risk-badge";
import { EmptyState, MetaItem, PageHeader, Panel } from "@/components/ui/console";
import { inputClass } from "@/components/ui/modal";
import { DigitalTwinViewer } from "@/components/digital-twin/digital-twin-viewer";
import { twinSex } from "@/components/digital-twin/anatomy";
import { DiagnosisDetail, type DiagnosisAiDetail } from "@/components/clinical/diagnosis-detail";
import { DrugReferenceModal } from "@/components/clinical/drug-reference-modal";
import { HistoryModal } from "@/components/clinical/history-modal";
import { api, ApiError } from "@/lib/api-client";
import type { OrganSignal } from "@/components/digital-twin/types";

const NAV = [
  { href: "/doctor/dashboard", label: "Dashboard" },
  { href: "/doctor/patients", label: "Patients" },
  { href: "/doctor/alerts", label: "Alerts" },
];

interface Diagnosis {
  _id: string;
  label: string;
  diagnosedAt: string;
  aiDetail?: DiagnosisAiDetail;
}
interface Medication {
  _id: string;
  genericName: string;
  dosage: number;
  unit: string;
  frequency?: string;
}
interface Scenario {
  _id: string;
  overallRisk: "green" | "yellow" | "red";
  signals: OrganSignal[];
  baselineSignals?: OrganSignal[];
  missingData: string[];
  sourceRecordCount?: number;
  recalculationRequired?: boolean;
  horizonDays: number;
  projectionFrom?: string;
  projectionTo?: string;
  confidence: string;
  status: string;
  createdAt: string;
  modelId: string;
  ruleSetVersion: string;
}

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: patient } = useQuery({
    queryKey: ["patient", id],
    queryFn: () =>
      api.get<{
        profile: { patientCode: string; status: string; sex?: string };
        user: { fullName: string; email: string; phone?: string };
      }>(`/patients/${id}`),
  });
  const { data: diagnoses } = useQuery({
    queryKey: ["diagnoses", id],
    queryFn: () => api.get<Diagnosis[]>(`/patients/${id}/diagnoses`),
  });
  const { data: medications } = useQuery({
    queryKey: ["medications", id],
    queryFn: () => api.get<Medication[]>(`/patients/${id}/medications`),
  });
  const { data: scenarios } = useQuery({
    queryKey: ["scenarios", id],
    queryFn: () => api.get<Scenario[]>(`/patients/${id}/treatment-scenarios`),
  });

  const [diagnosisForm, setDiagnosisForm] = useState({
    label: "",
    diagnosedAt: new Date().toISOString().slice(0, 10),
  });
  const [medicationForm, setMedicationForm] = useState({
    genericName: "",
    dosage: "",
    unit: "mg",
    route: "oral",
    frequency: "once daily",
    startDate: new Date().toISOString().slice(0, 10),
  });

  const [selectedDiagnosisIds, setSelectedDiagnosisIds] = useState<string[]>([]);
  const [selectedMedicationIds, setSelectedMedicationIds] = useState<string[]>([]);
  const [projectionFrom, setProjectionFrom] = useState(new Date().toISOString().slice(0, 10));
  const [projectionTo, setProjectionTo] = useState(isoDaysFromNow(90));

  const [detailPendingFor, setDetailPendingFor] = useState<string | null>(null);
  const [referenceFor, setReferenceFor] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  // The projection stays hidden until it is asked for: a twin on screen reads
  // as a finding, and it should only appear when a doctor requested one.
  const [showPrediction, setShowPrediction] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const generateDetail = useMutation({
    mutationFn: (diagnosisId: string) =>
      api.post(`/patients/${id}/diagnoses/${diagnosisId}/detail`),
    onSettled: () => {
      setDetailPendingFor(null);
      queryClient.invalidateQueries({ queryKey: ["diagnoses", id] });
    },
  });

  function requestDetail(diagnosisId: string) {
    setDetailPendingFor(diagnosisId);
    generateDetail.mutate(diagnosisId);
  }

  const addDiagnosis = useMutation({
    mutationFn: () =>
      api.post<Diagnosis>(`/patients/${id}/diagnoses`, {
        label: diagnosisForm.label,
        diagnosedAt: new Date(diagnosisForm.diagnosedAt).toISOString(),
      }),
    onSuccess: async (created) => {
      setDiagnosisForm({ label: "", diagnosedAt: new Date().toISOString().slice(0, 10) });
      await queryClient.invalidateQueries({ queryKey: ["diagnoses", id] });
      // Expand it straight away — that is the point of entering it here.
      requestDetail(created._id);
    },
  });

  const addMedication = useMutation({
    mutationFn: () =>
      api.post(`/patients/${id}/medications`, {
        ...medicationForm,
        dosage: Number(medicationForm.dosage),
        startDate: new Date(medicationForm.startDate).toISOString(),
      }),
    onSuccess: () => {
      setMedicationForm((f) => ({ ...f, genericName: "", dosage: "" }));
      queryClient.invalidateQueries({ queryKey: ["medications", id] });
    },
  });

  const runAnalysis = useMutation({
    mutationFn: () =>
      api.post(`/patients/${id}/treatment-scenarios`, {
        diagnosisIds: selectedDiagnosisIds,
        medicationIds: selectedMedicationIds,
        projectionFrom: new Date(projectionFrom).toISOString(),
        projectionTo: new Date(projectionTo).toISOString(),
      }),
    onSuccess: () => {
      setAnalysisError(null);
      setShowPrediction(true);
      queryClient.invalidateQueries({ queryKey: ["scenarios", id] });
    },
    onError: (err) =>
      setAnalysisError(err instanceof ApiError ? err.message : "The analysis could not run"),
  });

  const latestScenario = scenarios?.[0];
  const canRun =
    selectedDiagnosisIds.length > 0 && selectedMedicationIds.length > 0 && !runAnalysis.isPending;

  return (
    <AppShell role="DOCTOR" navItems={NAV}>
      <PageHeader
        eyebrow="Patient chart"
        title={patient?.user.fullName ?? "Patient"}
        action={
          <button
            onClick={() => setHistoryOpen(true)}
            className="rounded border border-[color:var(--line-strong)] px-4 py-2 text-sm text-ink transition hover:bg-ink/[0.04]"
          >
            Add past history
          </button>
        }
        meta={
          patient && (
            <>
              <MetaItem label="Patient code" value={patient.profile.patientCode} />
              <MetaItem
                label="Status"
                value={patient.profile.status.replace(/_/g, " ").toLowerCase()}
              />
              {patient.user.phone && <MetaItem label="Phone" value={patient.user.phone} />}
            </>
          )
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel title="Diagnoses">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addDiagnosis.mutate();
            }}
            className="mb-4 flex flex-wrap gap-2"
          >
            <input
              placeholder="e.g. Type 2 diabetes mellitus"
              required
              value={diagnosisForm.label}
              onChange={(e) => setDiagnosisForm((f) => ({ ...f, label: e.target.value }))}
              className={`${inputClass} flex-1`}
            />
            <input
              type="date"
              value={diagnosisForm.diagnosedAt}
              onChange={(e) => setDiagnosisForm((f) => ({ ...f, diagnosedAt: e.target.value }))}
              className={`${inputClass} w-auto`}
            />
            <button
              disabled={addDiagnosis.isPending}
              className="rounded bg-electric px-4 py-2 text-sm font-medium text-white transition hover:bg-electric/90 disabled:opacity-60"
            >
              {addDiagnosis.isPending ? "Adding…" : "Add"}
            </button>
          </form>

          {diagnoses && diagnoses.length > 0 ? (
            <ul className="flex flex-col divide-y divide-[color:var(--line)]">
              {diagnoses.map((diagnosis) => (
                <li key={diagnosis._id} className="py-3 first:pt-0">
                  <label className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedDiagnosisIds.includes(diagnosis._id)}
                      onChange={(e) =>
                        setSelectedDiagnosisIds((ids) =>
                          e.target.checked
                            ? [...ids, diagnosis._id]
                            : ids.filter((x) => x !== diagnosis._id),
                        )
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] text-ink">{diagnosis.label}</span>
                      <span className="mt-0.5 block font-mono text-[11px] text-ink-faint">
                        {new Date(diagnosis.diagnosedAt).toLocaleDateString()}
                      </span>
                    </span>
                  </label>
                  <div className="pl-[26px]">
                    <DiagnosisDetail
                      patientId={id}
                      diagnosisId={diagnosis._id}
                      detail={diagnosis.aiDetail}
                      pending={detailPendingFor === diagnosis._id}
                      onGenerate={() => requestDetail(diagnosis._id)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No diagnoses yet"
              body="Add one above. It is expanded into clinical context you can review and approve."
            />
          )}
        </Panel>

        <Panel title="Medications">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addMedication.mutate();
            }}
            className="mb-2 flex flex-wrap gap-2"
          >
            <input
              placeholder="e.g. Metformin"
              required
              value={medicationForm.genericName}
              onChange={(e) => setMedicationForm((f) => ({ ...f, genericName: e.target.value }))}
              className={`${inputClass} flex-1`}
            />
            <input
              placeholder="Dose"
              type="number"
              required
              value={medicationForm.dosage}
              onChange={(e) => setMedicationForm((f) => ({ ...f, dosage: e.target.value }))}
              className={`${inputClass} w-24`}
            />
            <button
              disabled={addMedication.isPending}
              className="rounded bg-electric px-4 py-2 text-sm font-medium text-white transition hover:bg-electric/90 disabled:opacity-60"
            >
              {addMedication.isPending ? "Adding…" : "Add"}
            </button>
          </form>

          <button
            type="button"
            disabled={medicationForm.genericName.trim().length < 2}
            onClick={() => setReferenceFor(medicationForm.genericName.trim())}
            className="mb-4 font-mono text-[11px] uppercase tracking-[0.12em] text-signal hover:underline disabled:text-ink-faint disabled:no-underline"
          >
            Look up reference for this medicine
          </button>

          {medications && medications.length > 0 ? (
            <ul className="flex flex-col divide-y divide-[color:var(--line)]">
              {medications.map((medication) => (
                <li key={medication._id} className="flex items-start gap-2.5 py-3 first:pt-0">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selectedMedicationIds.includes(medication._id)}
                    onChange={(e) =>
                      setSelectedMedicationIds((ids) =>
                        e.target.checked
                          ? [...ids, medication._id]
                          : ids.filter((x) => x !== medication._id),
                      )
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-ink">{medication.genericName}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                      {medication.dosage}
                      {medication.unit}
                      {medication.frequency ? ` · ${medication.frequency}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReferenceFor(medication.genericName)}
                    className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-signal hover:underline"
                  >
                    Reference
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No medications yet"
              body="Add the proposed medicine above, then look up its label before you prescribe."
            />
          )}
        </Panel>
      </div>

      {/* ------------------------------------------------------- prediction */}
      <Panel title="Projection" className="mt-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="readout">From</span>
            <input
              type="date"
              value={projectionFrom}
              onChange={(e) => setProjectionFrom(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="readout">To</span>
            <input
              type="date"
              min={projectionFrom}
              value={projectionTo}
              onChange={(e) => setProjectionTo(e.target.value)}
              className={inputClass}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {[30, 90, 180, 365].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => {
                  setProjectionFrom(new Date().toISOString().slice(0, 10));
                  setProjectionTo(isoDaysFromNow(days));
                }}
                className="rounded border border-[color:var(--line)] px-2.5 py-1 font-mono text-[11px] tabular-nums text-ink-faint transition hover:text-ink"
              >
                {days >= 365 ? "1 year" : `${days}d`}
              </button>
            ))}
          </div>

          <button
            onClick={() => runAnalysis.mutate()}
            disabled={!canRun}
            className="rounded bg-ai px-4 py-2 text-sm font-medium text-white transition hover:bg-ai/90 disabled:opacity-50"
          >
            {runAnalysis.isPending ? "Running…" : "See predictions"}
          </button>
        </div>

        <p className="mt-3 max-w-readable text-[12px] leading-relaxed text-ink-faint">
          {canRun || runAnalysis.isPending
            ? "Deterministic rules run first; the model only explains the result."
            : "Tick at least one diagnosis and one medication above to run a projection."}
        </p>

        {analysisError && (
          <p
            role="alert"
            className="mt-3 rounded border border-state-red/40 bg-state-red/10 px-3 py-2 text-sm text-state-red"
          >
            {analysisError}
          </p>
        )}
      </Panel>

      {latestScenario && !showPrediction && (
        <div className="panel mt-4 flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <span className="readout">Last projection</span>
            <p className="mt-1 text-[14px] text-ink">
              {new Date(latestScenario.createdAt).toLocaleString()} ·{" "}
              {latestScenario.horizonDays}-day window
            </p>
          </div>
          <button
            onClick={() => setShowPrediction(true)}
            className="rounded border border-[color:var(--line-strong)] px-4 py-2 text-sm text-ink transition hover:bg-ink/[0.04]"
          >
            See predictions
          </button>
        </div>
      )}

      {latestScenario && showPrediction && (
        <div className="panel mt-4 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="readout">Projection</span>
              <p className="mt-1 font-mono text-[12px] tabular-nums text-ink-muted">
                {latestScenario.projectionFrom
                  ? new Date(latestScenario.projectionFrom).toLocaleDateString()
                  : "—"}
                {" → "}
                {latestScenario.projectionTo
                  ? new Date(latestScenario.projectionTo).toLocaleDateString()
                  : "—"}
                {` · ${latestScenario.horizonDays} days · confidence ${latestScenario.confidence}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <RiskBadge color={latestScenario.overallRisk} />
              <button
                onClick={() => setShowPrediction(false)}
                className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint hover:text-ink"
              >
                Hide
              </button>
            </div>
          </div>

          {latestScenario.missingData.length > 0 && (
            <p className="mb-4 rounded border border-state-amber/40 bg-state-amber/10 px-3 py-2 text-xs text-state-amber">
              Analysis incomplete — missing: {latestScenario.missingData.join(", ")}
            </p>
          )}

          <DigitalTwinViewer
            beforeSignals={latestScenario.baselineSignals ?? []}
            afterSignals={latestScenario.signals}
            horizonDays={latestScenario.horizonDays}
            sex={twinSex(patient?.profile?.sex)}
            analysisMeta={{
              analyzedAt: latestScenario.createdAt,
              modelId: latestScenario.modelId,
              ruleSetVersion: latestScenario.ruleSetVersion,
              sourceRecordCount: latestScenario.sourceRecordCount,
              stale: latestScenario.recalculationRequired,
            }}
          />
        </div>
      )}

      <HistoryModal patientId={id} open={historyOpen} onClose={() => setHistoryOpen(false)} />

      {referenceFor && (
        <DrugReferenceModal
          name={referenceFor}
          open={Boolean(referenceFor)}
          onClose={() => setReferenceFor(null)}
        />
      )}
    </AppShell>
  );
}
