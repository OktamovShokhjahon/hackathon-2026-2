export type RiskColor = "green" | "yellow" | "red";

export interface OrganSignal {
  organ: string;
  severity: "low" | "moderate" | "high";
  color: RiskColor;
  explanation: string;
  missingData: string[];
  /** Values the rule actually read, so a finding can be checked against data. */
  observed?: Array<{ field: string; label?: string; value: number; unit?: string }>;
  /** Deterministic follow-up note from the rule catalog. */
  monitoring?: string;
  /** Catalog code of the rule that raised this signal. */
  ruleCode?: string;
  /**
   * Evidence grade behind the signal (technical mission §5). Defaults to
   * `projection` so an unlabelled signal is never shown as a verified fact.
   */
  evidence?: EvidenceGrade;
}

export type EvidenceGrade =
  | "verified"
  | "ai_unverified"
  | "clinical_rule"
  | "ai_interpretation"
  | "projection";
