/**
 * Formatting helpers shared by every console page. The rule is simple: a field
 * name, enum or identifier from the API is never rendered raw — a doctor reads
 * "latest eGFR", not `latestEgfr`, and never an object id.
 */

const FIELD_LABELS: Record<string, string> = {
  latestHba1c: "latest HbA1c",
  latestEgfr: "latest eGFR",
  latestCreatinine: "latest creatinine",
  latestPotassium: "latest potassium",
  latestAlt: "latest ALT",
  latestAst: "latest AST",
  latestSystolicBp: "latest systolic blood pressure",
};

/** `latestEgfr` → `latest eGFR`. Unknown fields degrade to spaced words. */
export function fieldLabel(field: string): string {
  return (
    FIELD_LABELS[field] ??
    field
      .replace(/([A-Z])/g, " $1")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  );
}

export function fieldList(fields: string[]): string {
  return fields.map(fieldLabel).join(", ");
}

/** `NEEDS_REVIEW` → `Needs review`. */
export function humanizeEnum(value?: string | null): string {
  // A missing enum is a dash, never a thrown error: a label is not worth
  // taking a clinical page down for.
  if (!value) return "—";
  const spaced = value.replace(/_/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** `treatment_scenario.review` → `Treatment scenario reviewed`. */
export function humanizeAuditAction(action?: string | null): string {
  if (!action) return "—";
  const [subject, verb] = action.split(".");
  const subjectLabel = humanizeEnum(subject ?? action);
  const verbLabel = (verb ?? "").replace(/_/g, " ");
  return verbLabel ? `${subjectLabel} · ${verbLabel}` : subjectLabel;
}

export function formatDate(value?: string | Date): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

export function formatDateTime(value?: string | Date): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

/** "3 days ago" — used where the exact timestamp is noise. */
export function formatRelative(value?: string | Date): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 7],
    ["week", 4.35],
    ["month", 12],
  ];

  let amount = seconds;
  let unit: Intl.RelativeTimeFormatUnit = "second";
  for (const [nextUnit, size] of units) {
    unit = nextUnit;
    if (Math.abs(amount) < size) break;
    amount = Math.round(amount / size);
    unit = nextUnit === "month" ? "year" : unit;
  }

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  return rtf.format(-amount, unit);
}

/** A person's initials, for avatars and dense rows. */
export function initials(fullName?: string): string {
  if (!fullName) return "—";
  return fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}
