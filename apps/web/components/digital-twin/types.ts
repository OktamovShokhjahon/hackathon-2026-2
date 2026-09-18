export type RiskColor = "green" | "yellow" | "red";

export interface OrganSignal {
  organ: string;
  severity: "low" | "moderate" | "high";
  color: RiskColor;
  explanation: string;
  missingData: string[];
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
