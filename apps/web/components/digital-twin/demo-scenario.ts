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
