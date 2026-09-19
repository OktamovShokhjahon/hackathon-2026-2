"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, DOCTOR_NAV } from "@/components/ui/app-shell";
import { RiskBadge } from "@/components/ui/risk-badge";
import { EmptyState, MetaItem, PageHeader, Panel, Tabs } from "@/components/ui/console";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { DigitalTwinViewer } from "@/components/digital-twin/digital-twin-viewer";
import { twinSex } from "@/components/digital-twin/anatomy";
import type { TwinTimelineData } from "@/components/digital-twin/twin-timeline";
import { DiagnosisDetail, type DiagnosisAiDetail } from "@/components/clinical/diagnosis-detail";
import { DrugReferenceModal } from "@/components/clinical/drug-reference-modal";
import { HistoryModal } from "@/components/clinical/history-modal";
import { AllergyPanel } from "@/components/clinical/allergy-panel";
import { DocumentIntake } from "@/components/clinical/document-intake";
import { AnalysisFindings } from "@/components/clinical/analysis-findings";
import { ScenarioReview } from "@/components/clinical/scenario-review";
import { PreventionPlanPanel } from "@/components/clinical/prevention-plan";
import { fieldList, humanizeEnum } from "@/lib/format";
import { api, ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import type { OrganSignal } from "@/components/digital-twin/types";

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
  aiNarrative?: string;
  narrativeSource?: "model" | "rule_summary";
  aiAvailable?: boolean;
  aiError?: string;
  doctorReview?: {
    decision: "APPROVED" | "REJECTED" | "DISCONTINUED";
    note?: string;
    visibleToPatient: boolean;
    reviewedAt: string;
  };
}

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type TabId = "chart" | "analysis" | "prevention" | "documents";

/** Toggle used to pick what an analysis runs over. Selection sits next to the
 *  button that consumes it, so the two are never screens apart. */
function SelectChip({
  selected,
  onToggle,
  title,
  sub,
}: {
  selected: boolean;
  onToggle: () => void;
  title: string;
  sub?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className="flex items-start gap-2.5 rounded-md border px-3 py-2 text-left transition"
      style={{
        borderColor: selected ? "var(--lamp)" : "var(--line)",
        background: selected ? "rgb(var(--rgb-lamp) / 0.08)" : "transparent",
      }}
    >
      <span
        aria-hidden
        className="mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border"
        style={{
          borderColor: selected ? "var(--lamp)" : "var(--line-strong)",
          background: selected ? "var(--lamp)" : "transparent",
        }}
      >
        {selected && (
          <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="none">
            <path d="M1.5 5.2 3.9 7.5 8.5 2.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] leading-snug text-ink">{title}</span>
        {sub && <span className="mt-0.5 block font-mono text-[11px] text-ink-faint">{sub}</span>}
      </span>
    </button>
  );
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const [tab, setTab] = useState<TabId>("chart");

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
  // Deterministic rule output per recorded date; drives the time scrubber.
  const { data: twinTimeline, isLoading: twinTimelineLoading } = useQuery({
    queryKey: ["twin-timeline", id],
    queryFn: () => api.get<TwinTimelineData>(`/patients/${id}/twin-timeline`),
  });

  // Entry lives behind a button rather than in a permanently open form: a
  // doctor opens a chart to read it far more often than to add to it.
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);
  const [medicationOpen, setMedicationOpen] = useState(false);

  const [diagnosisForm, setDiagnosisForm] = useState({ label: "", diagnosedAt: today() });
  const [medicationForm, setMedicationForm] = useState({
    genericName: "",
    dosage: "",
    unit: "mg",
    route: "oral",
    frequency: "once daily",
    startDate: today(),
  });

  const [selectedDiagnosisIds, setSelectedDiagnosisIds] = useState<string[]>([]);
  const [selectedMedicationIds, setSelectedMedicationIds] = useState<string[]>([]);
  const [projectionFrom, setProjectionFrom] = useState(today());
  const [projectionTo, setProjectionTo] = useState(isoDaysFromNow(90));
  const [customRange, setCustomRange] = useState(false);

  const [detailPendingFor, setDetailPendingFor] = useState<string | null>(null);
  const [referenceFor, setReferenceFor] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
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
      setDiagnosisForm({ label: "", diagnosedAt: today() });
      setDiagnosisOpen(false);
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
      setMedicationOpen(false);
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
      queryClient.invalidateQueries({ queryKey: ["scenarios", id] });
    },
    onError: (err) =>
      setAnalysisError(err instanceof ApiError ? err.message : t("analysis.failed")),
  });

  const latestScenario = scenarios?.[0];
  const canRun =
    selectedDiagnosisIds.length > 0 && selectedMedicationIds.length > 0 && !runAnalysis.isPending;

  const horizonDays = Math.max(
    1,
    Math.round(
      (new Date(projectionTo).getTime() - new Date(projectionFrom).getTime()) / 86400000
    )
  );

  return (
    <AppShell role="DOCTOR" navItems={DOCTOR_NAV} crumbOverride={patient?.user.fullName}>
      <PageHeader
        eyebrow={t("chart.eyebrow")}
        title={patient?.user.fullName ?? "Patient"}
        meta={
          patient && (
            <>
              <MetaItem label={t("chart.patientCode")} value={patient.profile.patientCode} />
              <MetaItem
                label={t("chart.status")}
                value={patient.profile.status.replace(/_/g, " ").toLowerCase()}
              />
              {patient.user.phone && <MetaItem label={t("chart.phone")} value={patient.user.phone} />}
            </>
          )
        }
      />

      <Tabs
        className="mb-4"
        active={tab}
        onChange={(next) => setTab(next as TabId)}
        tabs={[
          { id: "chart", label: t("chart.tabChart") },
          { id: "analysis", label: t("chart.tabAnalysis") },
          { id: "prevention", label: t("chart.tabPrevention") },
          { id: "documents", label: t("chart.tabDocuments") },
        ]}
      />

      {/* ----------------------------------------------------------- chart */}
      {tab === "chart" && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Panel
            title={t("chart.diagnoses")}
            action={
              <button
                type="button"
                onClick={() => setDiagnosisOpen(true)}
                className="rounded border border-[color:var(--line-strong)] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted transition hover:text-ink"
              >
                {t("action.add")}
              </button>
            }
          >
            {diagnoses && diagnoses.length > 0 ? (
              <ul className="flex flex-col divide-y divide-[color:var(--line)]">
                {diagnoses.map((diagnosis) => (
                  <li key={diagnosis._id} className="py-3 first:pt-0">
                    <span className="block text-[14px] text-ink">{diagnosis.label}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-ink-faint">
                      {new Date(diagnosis.diagnosedAt).toLocaleDateString()}
                    </span>
                    <DiagnosisDetail
                      patientId={id}
                      diagnosisId={diagnosis._id}
                      detail={diagnosis.aiDetail}
                      pending={detailPendingFor === diagnosis._id}
                      onGenerate={() => requestDetail(diagnosis._id)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title={t("chart.noDiagnoses")}
                body={t("chart.noDiagnosesBody")}
              />
            )}
          </Panel>

          <Panel
            title={t("chart.medications")}
            action={
              <button
                type="button"
                onClick={() => setMedicationOpen(true)}
                className="rounded border border-[color:var(--line-strong)] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted transition hover:text-ink"
              >
                {t("action.add")}
              </button>
            }
          >
            {medications && medications.length > 0 ? (
              <ul className="flex flex-col divide-y divide-[color:var(--line)]">
                {medications.map((medication) => (
                  <li key={medication._id} className="flex items-start gap-2.5 py-3 first:pt-0">
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
                      {t("chart.reference")}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title={t("chart.noMedications")}
                body={t("chart.noMedicationsBody")}
              />
            )}
          </Panel>

          <AllergyPanel patientId={id} />

          <Panel
            title={t("chart.pastHistory")}
            action={
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="rounded border border-[color:var(--line-strong)] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted transition hover:text-ink"
              >
                {t("action.add")}
              </button>
            }
          >
            <p className="max-w-readable text-[13px] leading-relaxed text-ink-muted">
              {t("chart.pastHistoryBody")}
            </p>
          </Panel>
        </div>
      )}

      {/* -------------------------------------------------------- analysis */}
      {tab === "analysis" && (
        <div className="flex flex-col gap-4">
          <Panel title={t("analysis.whatToAnalyse")}>
            {(diagnoses?.length ?? 0) === 0 || (medications?.length ?? 0) === 0 ? (
              <EmptyState
                title={t("analysis.nothingYet")}
                body={t("analysis.nothingYetBody")}
                action={
                  <button
                    type="button"
                    onClick={() => setTab("chart")}
                    className="mt-1 rounded border border-[color:var(--line-strong)] px-3 py-1.5 text-[13px] text-ink transition hover:bg-ink/[0.04]"
                  >
                    {t("analysis.goToChart")}
                  </button>
                }
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <span className="readout">{t("chart.diagnoses")}</span>
                  <div className="mt-2.5 flex flex-col gap-2">
                    {diagnoses!.map((diagnosis) => (
                      <SelectChip
                        key={diagnosis._id}
                        selected={selectedDiagnosisIds.includes(diagnosis._id)}
                        onToggle={() =>
                          setSelectedDiagnosisIds((ids) =>
                            ids.includes(diagnosis._id)
                              ? ids.filter((x) => x !== diagnosis._id)
                              : [...ids, diagnosis._id]
                          )
                        }
                        title={diagnosis.label}
                        sub={new Date(diagnosis.diagnosedAt).toLocaleDateString()}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <span className="readout">{t("chart.medications")}</span>
                  <div className="mt-2.5 flex flex-col gap-2">
                    {medications!.map((medication) => (
                      <SelectChip
                        key={medication._id}
                        selected={selectedMedicationIds.includes(medication._id)}
                        onToggle={() =>
                          setSelectedMedicationIds((ids) =>
                            ids.includes(medication._id)
                              ? ids.filter((x) => x !== medication._id)
                              : [...ids, medication._id]
                          )
                        }
                        title={medication.genericName}
                        sub={`${medication.dosage}${medication.unit}${
                          medication.frequency ? ` · ${medication.frequency}` : ""
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Panel>

          <Panel title={t("analysis.overWhatPeriod")}>
            <div className="flex flex-wrap items-center gap-2">
              {[30, 90, 180, 365].map((days) => {
                const selected = !customRange && horizonDays === days;
                return (
                  <button
                    key={days}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setCustomRange(false);
                      setProjectionFrom(today());
                      setProjectionTo(isoDaysFromNow(days));
                    }}
                    className="rounded-md border px-3 py-1.5 font-mono text-[11px] tabular-nums transition"
                    style={{
                      borderColor: selected ? "var(--lamp)" : "var(--line)",
                      color: selected ? "var(--ink)" : "var(--ink-faint)",
                      background: selected ? "rgb(var(--rgb-lamp) / 0.08)" : "transparent",
                    }}
                  >
                    {days >= 365 ? t("analysis.oneYear") : t("analysis.days", { n: days })}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCustomRange((open) => !open)}
                className="font-mono text-[11px] uppercase tracking-[0.12em] text-signal hover:underline"
              >
                {customRange ? t("analysis.usePreset") : t("analysis.customDates")}
              </button>
            </div>

            {customRange && (
              <div className="mt-4 flex flex-wrap items-end gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="readout">{t("analysis.from")}</span>
                  <input
                    type="date"
                    value={projectionFrom}
                    onChange={(e) => setProjectionFrom(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="readout">{t("analysis.to")}</span>
                  <input
                    type="date"
                    min={projectionFrom}
                    value={projectionTo}
                    onChange={(e) => setProjectionTo(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-[color:var(--line)] pt-4">
              <button
                onClick={() => runAnalysis.mutate()}
                disabled={!canRun}
                className="rounded bg-electric px-4 py-2 text-sm font-medium text-white transition hover:bg-electric/90 disabled:opacity-50"
              >
                {runAnalysis.isPending ? t("analysis.running") : t("analysis.run", { n: horizonDays })}
              </button>
              <p className="max-w-readable text-[12px] leading-relaxed text-ink-faint">
                {canRun || runAnalysis.isPending
                  ? t("analysis.rulesFirst")
                  : t("analysis.selectPrompt")}
              </p>
            </div>

            {analysisError && (
              <p
                role="alert"
                className="mt-3 rounded border border-state-red/40 bg-state-red/10 px-3 py-2 text-sm text-state-red"
              >
                {analysisError}
              </p>
            )}
          </Panel>

          {/* The twin appears here because opening this tab is itself the
              request for a projection — it never surfaces unasked on the chart. */}
          {latestScenario && (
            <div className="panel p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="readout">{t("analysis.latestProjection")}</span>
                  <p className="mt-1 font-mono text-[12px] tabular-nums text-ink-muted">
                    {latestScenario.projectionFrom
                      ? new Date(latestScenario.projectionFrom).toLocaleDateString()
                      : "—"}
                    {" → "}
                    {latestScenario.projectionTo
                      ? new Date(latestScenario.projectionTo).toLocaleDateString()
                      : "—"}
                    {` · ${latestScenario.horizonDays} days · ${humanizeEnum(latestScenario.status)}`}
                  </p>
                  {latestScenario.missingData.length > 0 && (
                    <p className="mt-1 font-mono text-[11px] text-state-amber">
                      Incomplete — {fieldList(latestScenario.missingData)} not on file
                    </p>
                  )}
                </div>
                <RiskBadge color={latestScenario.overallRisk} />
              </div>

              <div className="mb-5">
                <AnalysisFindings
                  analysis={{
                    aiNarrative: latestScenario.aiNarrative,
                    narrativeSource: latestScenario.narrativeSource,
                    aiAvailable: latestScenario.aiAvailable,
                    aiError: latestScenario.aiError,
                    missingData: latestScenario.missingData,
                    signals: latestScenario.signals,
                    ruleSetVersion: latestScenario.ruleSetVersion,
                    modelId: latestScenario.modelId,
                  }}
                />
              </div>

              <DigitalTwinViewer
                beforeSignals={latestScenario.baselineSignals ?? []}
                afterSignals={latestScenario.signals}
                horizonDays={latestScenario.horizonDays}
                sex={twinSex(patient?.profile?.sex)}
                timeline={twinTimeline}
                timelineLoading={twinTimelineLoading}
                analysisMeta={{
                  analyzedAt: latestScenario.createdAt,
                  modelId: latestScenario.modelId,
                  ruleSetVersion: latestScenario.ruleSetVersion,
                  sourceRecordCount: latestScenario.sourceRecordCount,
                  stale: latestScenario.recalculationRequired,
                }}
              />

              <ScenarioReview patientId={id} scenario={latestScenario} />
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------ prevention */}
      {tab === "prevention" && <PreventionPlanPanel endpoint={`/patients/${id}/prevention-plan`} />}

      {/* ------------------------------------------------------- documents */}
      {tab === "documents" && <DocumentIntake patientId={id} />}

      {/* ----------------------------------------------------------- entry */}
      <Modal
        open={diagnosisOpen}
        onClose={() => setDiagnosisOpen(false)}
        title="Add a diagnosis"
        description="It is expanded into clinical context you review before anything counts."
        footer={
          <>
            <button
              type="button"
              onClick={() => setDiagnosisOpen(false)}
              className="rounded border border-[color:var(--line-strong)] px-4 py-2 text-sm text-ink transition hover:bg-ink/[0.04]"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-diagnosis"
              disabled={addDiagnosis.isPending}
              className="rounded bg-electric px-4 py-2 text-sm font-medium text-white transition hover:bg-electric/90 disabled:opacity-60"
            >
              {addDiagnosis.isPending ? "Adding…" : "Add diagnosis"}
            </button>
          </>
        }
      >
        <form
          id="add-diagnosis"
          onSubmit={(e) => {
            e.preventDefault();
            addDiagnosis.mutate();
          }}
          className="flex flex-col gap-4"
        >
          <Field label="Diagnosis">
            <input
              placeholder="e.g. Type 2 diabetes mellitus"
              required
              value={diagnosisForm.label}
              onChange={(e) => setDiagnosisForm((f) => ({ ...f, label: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="Diagnosed on">
            <input
              type="date"
              value={diagnosisForm.diagnosedAt}
              onChange={(e) => setDiagnosisForm((f) => ({ ...f, diagnosedAt: e.target.value }))}
              className={inputClass}
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={medicationOpen}
        onClose={() => setMedicationOpen(false)}
        title="Add a medication"
        description="Look up the label before you prescribe — the reference opens from the chart."
        footer={
          <>
            <button
              type="button"
              onClick={() => setMedicationOpen(false)}
              className="rounded border border-[color:var(--line-strong)] px-4 py-2 text-sm text-ink transition hover:bg-ink/[0.04]"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-medication"
              disabled={addMedication.isPending}
              className="rounded bg-electric px-4 py-2 text-sm font-medium text-white transition hover:bg-electric/90 disabled:opacity-60"
            >
              {addMedication.isPending ? "Adding…" : "Add medication"}
            </button>
          </>
        }
      >
        <form
          id="add-medication"
          onSubmit={(e) => {
            e.preventDefault();
            addMedication.mutate();
          }}
          className="flex flex-col gap-4"
        >
          <Field label="Medicine">
            <input
              placeholder="e.g. Metformin"
              required
              value={medicationForm.genericName}
              onChange={(e) => setMedicationForm((f) => ({ ...f, genericName: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Dose">
              <input
                type="number"
                required
                value={medicationForm.dosage}
                onChange={(e) => setMedicationForm((f) => ({ ...f, dosage: e.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label="Unit">
              <input
                value={medicationForm.unit}
                onChange={(e) => setMedicationForm((f) => ({ ...f, unit: e.target.value }))}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Frequency">
            <input
              value={medicationForm.frequency}
              onChange={(e) => setMedicationForm((f) => ({ ...f, frequency: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <button
            type="button"
            disabled={medicationForm.genericName.trim().length < 2}
            onClick={() => setReferenceFor(medicationForm.genericName.trim())}
            className="self-start font-mono text-[11px] uppercase tracking-[0.12em] text-signal hover:underline disabled:text-ink-faint disabled:no-underline"
          >
            Look up this medicine first
          </button>
        </form>
      </Modal>

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
