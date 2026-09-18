import type { OrganSignal } from "./treatment-scenario.model";
import { RULE_CATALOG, RULE_SET_VERSION } from "./rule-catalog";
import type { RiskColor } from "../../shared/types";

export interface PatientSnapshot {
  diagnosisLabels: string[];
  medicationNames: string[];
  labValues: Record<string, number | undefined>;
  evidenceRecordIds: string[];
}

const SEVERITY_TO_LEVEL: Record<RiskColor, "low" | "moderate" | "high"> = {
  green: "low",
  yellow: "moderate",
  red: "high",
};

const COLOR_RANK: Record<RiskColor, number> = { green: 0, yellow: 1, red: 2 };

export interface RuleEngineResult {
  overallRisk: RiskColor;
  signals: OrganSignal[];
  affectedOrgans: string[];
  missingData: string[];
  ruleSetVersion: string;
}

export function runClinicalRules(snapshot: PatientSnapshot): RuleEngineResult {
  const signals: OrganSignal[] = [];
  const affectedOrgans = new Set<string>();
  const missingData = new Set<string>();
  let overallRisk: RiskColor = "green";

  for (const rule of RULE_CATALOG) {
    const diagnosisHit = snapshot.diagnosisLabels.some((label) => rule.diagnosisMatch.test(label));
    const medicationHit = snapshot.medicationNames.some((name) => rule.medicationMatch.test(name));
    if (!diagnosisHit || !medicationHit) continue;

    const missingForRule = rule.requiredFields.filter((field) => snapshot.labValues[field] === undefined);
    missingForRule.forEach((field) => missingData.add(field));

    const effectiveSeverity: RiskColor = missingForRule.length > 0 && rule.severity === "green" ? "yellow" : rule.severity;

    rule.organsAffected.forEach((organ) => affectedOrgans.add(organ));

    for (const organ of rule.organsAffected) {
      signals.push({
        type: "organ_risk",
        organ,
        severity: SEVERITY_TO_LEVEL[effectiveSeverity],
        color: effectiveSeverity,
        explanation: rule.explanationTemplate,
        evidenceRecordIds: snapshot.evidenceRecordIds,
        missingData: missingForRule,
        ruleCode: rule.code,
      });
    }

    if (COLOR_RANK[effectiveSeverity] > COLOR_RANK[overallRisk]) {
      overallRisk = effectiveSeverity;
    }
  }

  return {
    overallRisk,
    signals,
    affectedOrgans: [...affectedOrgans],
    missingData: [...missingData],
    ruleSetVersion: RULE_SET_VERSION,
  };
}
