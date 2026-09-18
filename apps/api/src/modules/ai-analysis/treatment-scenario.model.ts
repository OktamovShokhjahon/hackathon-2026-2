import { Schema, model, Types } from "mongoose";
import type { AnalysisStatus, TreatmentDecisionState } from "../../shared/types";

export interface OrganSignal {
  type: "organ_risk";
  organ: string;
  severity: "low" | "moderate" | "high";
  color: "green" | "yellow" | "red";
  explanation: string;
  evidenceRecordIds: string[];
  missingData: string[];
  ruleCode?: string;
}

export interface TreatmentScenarioDoc {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  patientId: Types.ObjectId;
  diagnosisIds: Types.ObjectId[];
  medicationIds: Types.ObjectId[];
  baselineSnapshotHash: string;
  analysisStatus: AnalysisStatus;
  overallRisk: "green" | "yellow" | "red";
  signals: OrganSignal[];
  affectedOrgans: string[];
  missingData: string[];
  horizonDays: number;
  /** The window the doctor chose for this projection. */
  projectionFrom: Date;
  projectionTo: Date;
  projectionLabel: "scenario_projection";
  confidence: "limited" | "moderate" | "high";
  modelId: string;
  promptVersion: string;
  ruleSetVersion: string;
  disclaimer: string;
  status: TreatmentDecisionState;
  doctorReview?: {
    reviewedBy: Types.ObjectId;
    reviewedAt: Date;
    decision: TreatmentDecisionState;
    note?: string;
    visibleToPatient: boolean;
  };
  recalculationRequired: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const treatmentScenarioSchema = new Schema<TreatmentScenarioDoc>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: "PatientProfile", required: true, index: true },
    diagnosisIds: [{ type: Schema.Types.ObjectId, ref: "Diagnosis" }],
    medicationIds: [{ type: Schema.Types.ObjectId, ref: "Medication" }],
    baselineSnapshotHash: { type: String, required: true },
    analysisStatus: {
      type: String,
      enum: ["queued", "processing", "completed", "failed", "stale", "needs_doctor_review"],
      default: "queued",
    },
    overallRisk: { type: String, enum: ["green", "yellow", "red"], default: "yellow" },
    signals: [
      {
        type: { type: String, default: "organ_risk" },
        organ: String,
        severity: { type: String, enum: ["low", "moderate", "high"] },
        color: { type: String, enum: ["green", "yellow", "red"] },
        explanation: String,
        evidenceRecordIds: [String],
        missingData: [String],
        ruleCode: String,
      },
    ],
    affectedOrgans: [{ type: String }],
    missingData: [{ type: String }],
    horizonDays: { type: Number, default: 30 },
    projectionFrom: { type: Date, required: true },
    projectionTo: { type: Date, required: true },
    projectionLabel: { type: String, default: "scenario_projection" },
    confidence: { type: String, enum: ["limited", "moderate", "high"], default: "limited" },
    modelId: { type: String, required: true },
    promptVersion: { type: String, required: true },
    ruleSetVersion: { type: String, required: true },
    disclaimer: {
      type: String,
      default: "This is decision support and not a diagnosis or prescription.",
    },
    status: {
      type: String,
      enum: ["DRAFT", "UNDER_REVIEW", "APPROVED", "REJECTED", "DISCONTINUED"],
      default: "DRAFT",
    },
    doctorReview: {
      reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
      reviewedAt: Date,
      decision: { type: String, enum: ["DRAFT", "UNDER_REVIEW", "APPROVED", "REJECTED", "DISCONTINUED"] },
      note: String,
      visibleToPatient: { type: Boolean, default: false },
    },
    recalculationRequired: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

treatmentScenarioSchema.index({ tenantId: 1, patientId: 1, createdAt: -1 });

export const TreatmentScenario = model<TreatmentScenarioDoc>("TreatmentScenario", treatmentScenarioSchema);
