import { MedicalRecord } from "../medical-records/medical-record.model";
import { Diagnosis } from "../diagnoses/diagnosis.model";
import { Medication } from "../medications/medication.model";
import { Allergy } from "../medications/allergy.model";
import { runClinicalRules, type PatientSnapshot } from "./rule-engine";
import type { OrganSignal } from "./treatment-scenario.model";
import type { RiskColor } from "../../shared/types";

/** One dated state of the twin, built from the chart as it stood that day. */
export interface TwinTimelinePoint {
  date: string;
  overallRisk: RiskColor;
  signals: OrganSignal[];
  missingData: string[];
  /** What changed on this date, for the scrubber's tick caption. */
  events: Array<{ kind: "lab" | "vital" | "diagnosis" | "medication_start" | "medication_stop"; label: string }>;
}

export interface TwinTimeline {
  ruleSetVersion: string;
  points: TwinTimelinePoint[];
}

/** Day granularity: two labs drawn the same morning are one point on the axis. */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The twin as it would have read on each date in the patient's chart.
 *
 * Every point is the deterministic rule engine run against the chart as it
 * stood that day — nothing is interpolated between ticks and no model is
 * called, so scrubbing backwards shows what was actually known then, not a
 * smoothed curve drawn through it. Only records a doctor has verified are
 * used, the same restriction the live analysis works under.
 */
export async function buildTwinTimeline(
  tenantId: string,
  patientId: string,
  options: { maxPoints?: number } = {}
): Promise<TwinTimeline> {
  const maxPoints = options.maxPoints ?? 40;

  const [records, diagnoses, medications, allergies] = await Promise.all([
    MedicalRecord.find({
      tenantId,
      patientId,
      type: { $in: ["lab_result", "vital_sign"] },
      verificationStatus: { $nin: ["ai_unverified", "rejected"] },
      archivedAt: { $exists: false },
    })
      .sort({ eventDate: 1 })
      .lean(),
    Diagnosis.find({ tenantId, patientId }).lean(),
    Medication.find({ tenantId, patientId }).lean(),
    Allergy.find({ tenantId, patientId }).lean(),
  ]);

  // Collect every date on which the chart changed, and what changed on it.
  const events = new Map<string, TwinTimelinePoint["events"]>();
  const note = (date: Date | undefined, event: TwinTimelinePoint["events"][number]) => {
    if (!date) return;
    const key = dayKey(date);
    const list = events.get(key);
    if (list) list.push(event);
    else events.set(key, [event]);
  };

  for (const record of records) {
    const data = record.data as Record<string, unknown>;
    const field = typeof data.field === "string" ? data.field : undefined;
    const description = typeof data.description === "string" ? data.description : undefined;
    note(record.eventDate, {
      kind: record.type === "vital_sign" ? "vital" : "lab",
      label: field ?? description ?? record.type,
    });
  }
  for (const diagnosis of diagnoses) {
    note(diagnosis.diagnosedAt, { kind: "diagnosis", label: diagnosis.label });
  }
  for (const medication of medications) {
    note(medication.startDate, { kind: "medication_start", label: medication.genericName });
    note(medication.endDate, { kind: "medication_stop", label: medication.genericName });
  }

  const dates = [...events.keys()].sort();
  if (dates.length === 0) return { ruleSetVersion: runClinicalRules(emptySnapshot()).ruleSetVersion, points: [] };

  // A long chart is thinned by dropping the middle rather than the ends: the
  // first point and today are the two a doctor always wants on the axis.
  const kept =
    dates.length <= maxPoints
      ? dates
      : dates.filter((_, index) => index === 0 || index === dates.length - 1 || index % Math.ceil(dates.length / maxPoints) === 0);

  const points: TwinTimelinePoint[] = [];
  let ruleSetVersion = "";

  for (const day of kept) {
    // End of that day, so a record dated that morning counts towards it.
    const cutoff = new Date(`${day}T23:59:59.999Z`);

    const labValues: Record<string, number | undefined> = {};
    const labUnits: Record<string, string | undefined> = {};
    const evidenceRecordIds: string[] = [];
    // Ascending, so a later reading for the same field overwrites an earlier
    // one and each point carries the most recent value known by then.
    for (const record of records) {
      if (record.eventDate.getTime() > cutoff.getTime()) break;
      const data = record.data as Record<string, unknown>;
      const field = typeof data.field === "string" ? data.field : undefined;
      const value = typeof data.value === "number" ? data.value : undefined;
      if (!field || value === undefined) continue;
      labValues[field] = value;
      labUnits[field] = typeof data.unit === "string" ? data.unit : undefined;
      if (!evidenceRecordIds.includes(String(record._id))) evidenceRecordIds.push(String(record._id));
    }

    const snapshot: PatientSnapshot = {
      diagnosisLabels: diagnoses
        .filter((diagnosis) => diagnosis.diagnosedAt.getTime() <= cutoff.getTime())
        .map((diagnosis) => diagnosis.label),
      // Everything on board that day is one list here: the timeline is the
      // chart as it stood, not a proposal being weighed against it.
      medicationNames: medications
        .filter(
          (medication) =>
            medication.startDate.getTime() <= cutoff.getTime() &&
            (!medication.endDate || medication.endDate.getTime() >= cutoff.getTime())
        )
        .map((medication) => medication.genericName),
      existingMedicationNames: [],
      allergySubstances: allergies.map((allergy) => allergy.substance),
      labValues,
      labUnits,
      evidenceRecordIds,
    };

    const result = runClinicalRules(snapshot);
    ruleSetVersion = result.ruleSetVersion;
    points.push({
      date: new Date(`${day}T00:00:00.000Z`).toISOString(),
      overallRisk: result.overallRisk,
      signals: result.signals,
      missingData: result.missingData,
      events: events.get(day) ?? [],
    });
  }

  return { ruleSetVersion, points };
}

function emptySnapshot(): PatientSnapshot {
  return { diagnosisLabels: [], medicationNames: [], labValues: {}, evidenceRecordIds: [] };
}
