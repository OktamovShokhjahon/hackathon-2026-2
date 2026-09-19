import type { OrganSignal } from "./types";

/**
 * Synthetic demo patient (technical mission §23, patient 3): combined type 2
 * diabetes and hypertension, with a mixed green/yellow projection. Fictional —
 * it must never resemble an identifiable person. Also used as the explicit
 * fallback dataset when the AI service is unavailable (§9.5).
 */
export const DEMO_PATIENT = {
  code: "SYN-0031",
  summary: "Synthetic patient · type 2 diabetes + hypertension",
  horizonDays: 90,
};

export const DEMO_BEFORE: OrganSignal[] = [
  {
    organ: "kidney",
    severity: "moderate",
    color: "yellow",
    explanation: "Renal function record is incomplete; monitoring required before dose escalation.",
    missingData: ["latest eGFR", "latest creatinine"],
    evidence: "clinical_rule",
  },
  {
    organ: "heart",
    severity: "moderate",
    color: "yellow",
    explanation: "Blood pressure remains above target across the last three recorded visits.",
    missingData: [],
    evidence: "verified",
  },
  {
    organ: "pancreas",
    severity: "high",
    color: "red",
    explanation: "HbA1c above target with no adjustment recorded in the past two visits.",
    missingData: [],
    evidence: "verified",
  },
  {
    organ: "blood_vessels",
    severity: "moderate",
    color: "yellow",
    explanation: "Elevated pressure sustained over time raises vascular strain.",
    missingData: ["lipid panel"],
    evidence: "clinical_rule",
  },
  {
    organ: "eyes",
    severity: "low",
    color: "yellow",
    explanation: "No retinal screening on file within the recommended interval.",
    missingData: ["retinal screening date"],
    evidence: "clinical_rule",
  },
];

export const DEMO_AFTER: OrganSignal[] = [
  {
    organ: "kidney",
    severity: "moderate",
    color: "yellow",
    explanation:
      "Proposed regimen is renally cleared. Monitoring stays required until renal labs are complete.",
    missingData: ["latest eGFR", "latest creatinine"],
    evidence: "clinical_rule",
  },
  {
    organ: "heart",
    severity: "low",
    color: "green",
    explanation: "Projected blood-pressure control reaches target range over the selected horizon.",
    missingData: [],
    evidence: "projection",
  },
  {
    organ: "pancreas",
    severity: "moderate",
    color: "yellow",
    explanation: "Glycaemic control projected to improve but stay above target at 90 days.",
    missingData: [],
    evidence: "projection",
  },
  {
    organ: "blood_vessels",
    severity: "low",
    color: "green",
    explanation: "Vascular strain projected to ease as pressure returns towards target.",
    missingData: ["lipid panel"],
    evidence: "projection",
  },
  {
    organ: "eyes",
    severity: "low",
    color: "yellow",
    explanation: "Screening gap is unchanged by the treatment plan; schedule a retinal review.",
    missingData: ["retinal screening date"],
    evidence: "clinical_rule",
  },
];

export const DEMO_META = {
  analyzedAt: "2026-09-18T09:14:00.000Z",
  modelId: "openai/gpt-oss-20b",
  ruleSetVersion: "rules-2026.03",
  sourceRecordCount: 14,
  stale: false,
};

/**
 * Checkpoints the landing twin can be scrubbed to. `mix` is the blend between
 * DEMO_BEFORE and DEMO_AFTER, so the organs recolour gradually rather than
 * snapping between two states. Days are a real sequence, which is why they are
 * numbered — the order is the information.
 *
 * Synthetic, like the rest of this scenario. The notes are written from the
 * projection above so the caption can never contradict the organ colours.
 */
export interface TimelineStop {
  day: number;
  label: string;
  mix: number;
  note: string;
}

export const DEMO_TIMELINE: TimelineStop[] = [
  {
    day: 0,
    label: "Today",
    mix: 0,
    note: "Baseline from verified records. HbA1c and blood pressure both sit above target.",
  },
  {
    day: 30,
    label: "Day 30",
    mix: 1 / 3,
    note: "Blood pressure starts moving toward target. Glycaemic change is not measurable yet.",
  },
  {
    day: 60,
    label: "Day 60",
    mix: 2 / 3,
    note: "Pressure control holds and HbA1c begins to fall. Renal labs are still outstanding.",
  },
  {
    day: 90,
    label: "Day 90",
    mix: 1,
    note: "Pressure reaches target range. HbA1c improves but stays above target, so the plan continues.",
  },
];
