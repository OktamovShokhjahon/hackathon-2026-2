import type { RiskColor } from "../../shared/types";

/**
 * Versioned, hand-authored deterministic rule catalog. This is intentionally
 * NOT AI-generated: the AI layer explains these results, it never invents them.
 */
export const RULE_SET_VERSION = "2026.09.1";

export interface RuleDefinition {
  code: string;
  description: string;
  diagnosisMatch: RegExp;
  medicationMatch: RegExp;
  requiredFields: string[];
  organsAffected: string[];
  severity: RiskColor;
  explanationTemplate: string;
}

export const RULE_CATALOG: RuleDefinition[] = [
  {
    code: "T2DM_METFORMIN_RENAL",
    description: "Metformin requires current renal function data in patients with type 2 diabetes.",
    diagnosisMatch: /diabetes/i,
    medicationMatch: /metformin/i,
    requiredFields: ["latestEgfr", "latestCreatinine"],
    organsAffected: ["kidney"],
    severity: "yellow",
    explanationTemplate:
      "Metformin is renally cleared. The available history is missing recent kidney-function values, so renal risk cannot be fully assessed.",
  },
  {
    code: "HTN_ACEI_RENAL_POTASSIUM",
    description: "ACE inhibitors require renal function and potassium monitoring in hypertension.",
    diagnosisMatch: /hypertension/i,
    medicationMatch: /(lisinopril|enalapril|ramipril|ace inhibitor)/i,
    requiredFields: ["latestPotassium", "latestCreatinine"],
    organsAffected: ["kidney", "cardiovascular_system"],
    severity: "yellow",
    explanationTemplate:
      "ACE inhibitors can raise potassium and affect renal perfusion. Baseline potassium and creatinine are required before initiation.",
  },
  {
    code: "NSAID_HYPERTENSION_INTERACTION",
    description: "NSAIDs may counteract blood pressure control and stress the kidneys.",
    diagnosisMatch: /hypertension/i,
    medicationMatch: /(ibuprofen|naproxen|nsaid|diclofenac)/i,
    requiredFields: [],
    organsAffected: ["kidney", "cardiovascular_system"],
    severity: "red",
    explanationTemplate:
      "NSAIDs can raise blood pressure and reduce the effectiveness of antihypertensive therapy, and add renal load.",
  },
  {
    code: "SULFONYLUREA_HYPOGLYCEMIA",
    description: "Sulfonylureas carry hypoglycemia risk, especially with irregular eating or renal impairment.",
    diagnosisMatch: /diabetes/i,
    medicationMatch: /(glipizide|glyburide|glimepiride|sulfonylurea)/i,
    requiredFields: ["latestHba1c"],
    organsAffected: ["pancreas", "nervous_system"],
    severity: "yellow",
    explanationTemplate:
      "Sulfonylureas increase insulin secretion and carry hypoglycemia risk; recent HbA1c helps calibrate dosing safety.",
  },
  {
    code: "STATIN_LIVER_MONITORING",
    description: "Statins require baseline and periodic liver function monitoring.",
    diagnosisMatch: /(diabetes|hypertension)/i,
    medicationMatch: /(atorvastatin|simvastatin|rosuvastatin|statin)/i,
    requiredFields: ["latestAlt", "latestAst"],
    organsAffected: ["liver"],
    severity: "green",
    explanationTemplate:
      "Statins are generally well tolerated but warrant baseline liver enzyme monitoring per standard practice.",
  },
];
