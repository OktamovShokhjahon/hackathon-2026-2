import Link from "next/link";
import { HeroTwin } from "@/components/digital-twin/hero-twin";
import { Mark } from "@/components/ui/app-shell";
import { Reveal } from "@/components/ui/reveal";
import { OrganCoverage } from "@/components/marketing/organ-coverage";
import { EVIDENCE_GRADES, ProvenanceChip } from "@/components/ui/provenance-chip";
import type { EvidenceGrade } from "@/components/digital-twin/types";

const PIPELINE = [
  { stage: "Intake", detail: "Documents, labs, symptoms and prescriptions enter as dated records." },
  { stage: "Extraction", detail: "The model returns structured candidates with a source span for each fact." },
  { stage: "Verification", detail: "A doctor confirms, edits or rejects every candidate before it counts." },
  { stage: "Rules", detail: "Deterministic checks run first, from a versioned clinical rule catalog." },
  { stage: "Explanation", detail: "The model explains the rule result and names what is still missing." },
  { stage: "Scenario", detail: "A versioned projection drives the twin over the selected horizon." },
];

const GRADE_ORDER: EvidenceGrade[] = [
  "verified",
  "ai_unverified",
  "clinical_rule",
  "ai_interpretation",
  "projection",
];

const ROLES = [
  {
    role: "Clinic admin",
    sees: "The clinic, not the chart",
    points: [
      "Create and deactivate doctor accounts",
      "Clinic statistics, high-priority alerts, audit log",
      "Subscription, trial days and usage limits",
    ],
    limit: "Cannot edit a doctor's clinical note.",
  },
  {
    role: "Doctor",
    sees: "The full clinical picture",
    points: [
      "Build a patient timeline record by record",
      "Review and approve every AI-extracted fact",
      "Run treatment analyses and read the twin",
    ],
    limit: "Records the final decision; the system never prescribes.",
  },
  {
    role: "Patient",
    sees: "Only what the doctor approved",
    points: [
      "Approved diagnoses, medications and instructions",
      "The twin, with a time horizon they choose",
      "Report symptoms and follow-up observations",
    ],
    limit: "Never sees internal notes or unapproved AI extraction.",
  },
];

const PLANS = [
  {
    name: "Demo",
    price: "Free",
    period: "7 days",
    detail: "Activated the moment a clinic registers. Full workflow, usage limits applied.",
  },
  {
    name: "Monthly",
    price: "Per clinic",
    period: "billed monthly",
    detail: "Unlimited doctors and patients within your plan entitlements.",
  },
  {
    name: "Yearly",
    price: "Per clinic",
    period: "billed annually",
    detail: "Same entitlements, committed for a year.",
  },
];

export default function LandingPage() {
  return (
    <div>
      <header className="sticky top-0 z-30 border-b border-[color:var(--line)] bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Mark />
            <span className="display text-lg text-ink">TwinRx</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/login"
              className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted transition hover:text-ink"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded border border-signal/40 bg-signal/[0.08] px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-signal transition hover:bg-signal/15"
            >
              Start demo
            </Link>
          </nav>
        </div>
      </header>

      {/* ---------------------------------------------------------------- Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-24 pt-12 lg:grid-cols-[1fr_1.05fr]">
        <div className="rise">
          <span className="readout">Chronic care · medication safety</span>
          <h1 className="display mt-4 text-[40px] leading-[1.03] text-ink sm:text-[54px]">
            See what a treatment
            <br />
            <span className="text-signal">might do</span> before
            <br />
            you prescribe it.
          </h1>
          <p className="mt-6 max-w-readable text-[15px] leading-relaxed text-ink-muted">
            TwinRx assembles a diabetes or hypertension history into one verified timeline, runs the
            proposed medication through deterministic clinical rules, and shows the result on a
            patient-specific twin — organ by organ, current state against projected scenario.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/register"
              className="rounded bg-electric px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-electric/90 hover:shadow-md"
            >
              Start 7-day clinic demo
            </Link>
            <Link
              href="/login"
              className="rounded border px-5 py-2.5 text-sm text-ink transition hover:bg-ink/[0.04]"
              style={{ borderColor: "var(--line-strong)" }}
            >
              Sign in
            </Link>
          </div>

          <div className="rail mt-10" />

          <dl className="mt-6 grid grid-cols-3 gap-6">
            {[
              ["Scope", "T2DM · hypertension"],
              ["Roles", "Admin · doctor · patient"],
              ["Every result", "Versioned & sourced"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="readout">{label}</dt>
                <dd className="mt-1 font-mono text-[12px] text-ink-muted">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rise" style={{ animationDelay: "140ms" }}>
          <HeroTwin />
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            Synthetic patient · illustrative scenario projection · hover to pause, click an organ
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------------- Organs */}
      <section className="border-y border-[color:var(--line)] bg-paper-deep/50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <span className="readout">What the twin watches</span>
            <h2 className="display mt-3 max-w-2xl text-[28px] leading-tight text-ink sm:text-[34px]">
              Every structure with its own shape, and its own state.
            </h2>
            <p className="mt-4 max-w-readable text-[15px] leading-relaxed text-ink-muted">
              Risk lands on the organ it concerns, not on a chart beside it. Point at a system to
              find it on the body.
            </p>
          </Reveal>
          <Reveal delay={120} className="mt-10">
            <OrganCoverage />
          </Reveal>
        </div>
      </section>

      {/* -------------------------------------------------- Evidence taxonomy */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <span className="readout">What the twin keeps apart</span>
          <h2 className="display mt-3 max-w-2xl text-[28px] leading-tight text-ink sm:text-[34px]">
            A verified lab value and a model&rsquo;s guess should never look the same.
          </h2>
          <p className="mt-4 max-w-readable text-[15px] leading-relaxed text-ink-muted">
            Every fact in TwinRx carries its grade, everywhere it appears. Nothing enters the
            verified patient snapshot until a doctor has approved it.
          </p>
        </Reveal>

        <ul className="mt-10 grid gap-px overflow-hidden rounded-lg border border-[color:var(--line)] bg-[color:var(--line)] sm:grid-cols-2 lg:grid-cols-5">
          {GRADE_ORDER.map((grade, index) => (
            <Reveal as="li" key={grade} delay={index * 70} className="bg-surface p-5">
              <ProvenanceChip grade={grade} />
              <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
                {EVIDENCE_GRADES[grade].description}.
              </p>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------ Pipeline */}
      <section className="border-y border-[color:var(--line)] bg-paper-deep/50">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <span className="readout">How it works</span>
            <h2 className="display mt-3 text-[28px] leading-tight text-ink sm:text-[34px]">
              Rules run first. The model explains, it never decides.
            </h2>
            <p className="mt-4 max-w-readable text-[15px] leading-relaxed text-ink-muted">
              Deterministic checks from a medically reviewed catalog produce the clinical result.
              The model&rsquo;s job is to read documents, normalize entities and put the result into
              plain language — and to say <span className="font-mono text-ink">unknown</span> when
              the data is not there.
            </p>
          </Reveal>

          {/* The pipeline is genuinely ordered, so it renders as a rail. */}
          <ol className="relative border-l pl-8" style={{ borderColor: "var(--line-strong)" }}>
            {PIPELINE.map((step, index) => (
              <Reveal as="li" key={step.stage} delay={index * 80} className="relative pb-8 last:pb-0">
                <span
                  aria-hidden
                  className="absolute -left-[37px] top-1.5 h-2 w-2 rounded-full bg-signal ring-4 ring-paper-deep"
                />
                <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-signal">
                  {step.stage}
                </h3>
                <p className="mt-1.5 max-w-readable text-[14px] leading-relaxed text-ink-muted">
                  {step.detail}
                </p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* --------------------------------------------------------------- Roles */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <span className="readout">Who sees what</span>
          <h2 className="display mt-3 max-w-2xl text-[28px] leading-tight text-ink sm:text-[34px]">
            Three roles, and a hard line between them.
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {ROLES.map((item, index) => (
            <Reveal
              key={item.role}
              delay={index * 90}
              className="panel flex flex-col p-6 transition hover:-translate-y-1 hover:shadow-lg"
            >
              <span className="readout">{item.role}</span>
              <h3 className="display mt-2 text-[19px] leading-snug text-ink">{item.sees}</h3>
              <ul className="mt-4 flex flex-1 flex-col gap-2">
                {item.points.map((point) => (
                  <li key={point} className="flex gap-2 text-[14px] leading-relaxed text-ink-muted">
                    <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-signal" />
                    {point}
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-[color:var(--line)] pt-3 font-mono text-[10px] uppercase leading-relaxed tracking-[0.1em] text-ink-faint">
                {item.limit}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------------- Limits */}
      <section className="border-y border-[color:var(--line)] bg-paper-deep/50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <span className="readout">Clinical safety and limitations</span>
          </Reveal>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {[
              {
                title: "It does not prescribe",
                body: "TwinRx proposes nothing on its own. A doctor enters the plan, reviews the analysis and records the decision.",
              },
              {
                title: "It does not predict your future",
                body: "A projection is an illustrative estimate over a selected horizon, labelled as such wherever it appears.",
              },
              {
                title: "It shows what is missing",
                body: "When required data is absent the analysis is marked incomplete and lists the fields to verify first.",
              },
            ].map((item, index) => (
              <Reveal key={item.title} delay={index * 90}>
                <h3 className="display text-[17px] text-ink">{item.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{item.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- Pricing */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <span className="readout">Pricing</span>
          <h2 className="display mt-3 text-[28px] leading-tight text-ink sm:text-[34px]">
            Start on the demo. Decide after.
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan, index) => (
            <Reveal
              key={plan.name}
              delay={index * 90}
              className={`panel p-6 transition hover:-translate-y-1 hover:shadow-lg ${
                index === 0 ? "ring-1 ring-signal/40" : ""
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="readout">{plan.name}</span>
                {index === 0 && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-signal">
                    Included
                  </span>
                )}
              </div>
              <div className="mt-3 font-display text-[26px] text-ink">{plan.price}</div>
              <div className="font-mono text-[11px] text-ink-faint">{plan.period}</div>
              <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">{plan.detail}</p>
            </Reveal>
          ))}
        </div>

        <Reveal
          delay={120}
          className="panel mt-12 flex flex-wrap items-center justify-between gap-4 p-6"
        >
          <p className="max-w-readable text-[15px] text-ink">
            Register your clinic and the 7-day demo activates immediately.
          </p>
          <Link
            href="/register"
            className="rounded bg-electric px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-electric/90 hover:shadow-md"
          >
            Register clinic
          </Link>
        </Reveal>

        <p className="mt-10 max-w-readable text-xs leading-relaxed text-ink-faint">
          TwinRx is an AI-assisted decision-support system. It does not independently prescribe
          medication, replace a doctor, or present a prediction as a confirmed diagnosis. Demo data
          shown on this page is synthetic.
        </p>
      </section>
    </div>
  );
}
