/**
 * Pre-recorded answers for a live demo when the model or its free-tier quota
 * is unavailable (spec §9.5). Used only when DEMO_AI_FALLBACK=true, and every
 * answer says so in its own text and carries the model id "demo-fallback" so a
 * viewer can never mistake it for live model output.
 *
 * Keyed by prompt name. Document extraction has no entry on purpose: a canned
 * list of facts would look like the contents of the uploaded file, so that
 * path keeps using the deterministic parser.
 */
export const DEMO_MODEL_ID = "demo-fallback (pre-recorded)";
const TAG = "[Demo · pre-recorded, not live AI] ";

const RESPONSES: Array<{ prefix: string; body: unknown }> = [
  {
    prefix: "treatment-scenario-narrative",
    body: {
      narrative:
        TAG +
        "The rule checks flag the organs shown in yellow or red for closer monitoring. Some recent laboratory values are missing, so this result is incomplete. Please review the listed evidence and the missing data before deciding.",
      confidence: "limited",
    },
  },
  {
    prefix: "patient-chatbot",
    body: {
      reply:
        TAG +
        "I can explain general health information and the medicines and results your doctor has approved for you. I can't diagnose or prescribe. Please ask your care team about anything specific to you, and contact emergency services if you feel very unwell.",
      isEducationalOnly: true,
    },
  },
  {
    prefix: "diagnosis-detail",
    body: {
      summary: TAG + "A long-term condition that needs regular monitoring by the care team.",
      monitoring: ["Regular laboratory follow-up", "Blood pressure and weight checks"],
      verifyBeforeTreating: ["Recent kidney function results", "Current medication list and allergies"],
      redFlags: ["Sudden worsening of symptoms", "New chest pain or breathlessness"],
    },
  },
  {
    prefix: "drug-reference-condense",
    body: {
      summary: TAG + "See the official label sections listed below for the full text.",
      keyCautions: [],
    },
  },
  {
    prefix: "patient-summary",
    body: {
      summary:
        TAG +
        "Your doctor has reviewed your treatment plan. Please keep taking your medicines as instructed and keep your follow-up appointments. The picture shown is an illustration of what could happen, not a promise. Ask your care team if you have questions.",
    },
  },
  {
    prefix: "prevention-wording",
    body: { intro: TAG + "These are the everyday habits your care team's rules suggest for you.", items: [] },
  },
];

export function demoResponseFor(promptVersion: string): unknown | undefined {
  return RESPONSES.find((entry) => promptVersion.startsWith(entry.prefix))?.body;
}
