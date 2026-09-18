import { z } from "zod";
import { callGroqStructured } from "../ai-analysis/groq.client";
import { HttpError } from "../../middleware/errorHandler";
import { ChatConversation } from "./chat-conversation.model";
import { PatientProfile } from "../patients/patient.model";
import { Diagnosis } from "../diagnoses/diagnosis.model";
import { Medication } from "../medications/medication.model";

const EMERGENCY_PATTERNS =
  /(chest pain|difficulty breathing|can't breathe|cannot breathe|severe bleeding|suicidal|loss of consciousness|stroke|numbness on one side|blue lips)/i;

const CHAT_RESPONSE_SCHEMA = z.object({
  reply: z.string(),
  isEducationalOnly: z.literal(true),
});

const PROMPT_VERSION = "patient-chatbot@1";

export async function sendChatMessage(params: {
  tenantId: string;
  userId: string;
  role: "PATIENT" | "DOCTOR" | "ADMIN";
  conversationId?: string;
  message: string;
}) {
  if (EMERGENCY_PATTERNS.test(params.message)) {
    const reply =
      "This may describe a medical emergency. Please contact your local emergency services or go to the nearest emergency department immediately. This chatbot cannot handle emergencies.";
    const conversation = await appendMessage(params, reply, true);
    return { conversation, isEmergency: true };
  }

  let approvedContext = "";
  if (params.role === "PATIENT") {
    const profile = await PatientProfile.findOne({ userId: params.userId, tenantId: params.tenantId });
    if (profile) {
      const [diagnoses, medications] = await Promise.all([
        Diagnosis.find({ tenantId: params.tenantId, patientId: profile._id, state: "active" }).lean(),
        Medication.find({ tenantId: params.tenantId, patientId: profile._id, status: "active" }).lean(),
      ]);
      approvedContext = JSON.stringify({
        diagnoses: diagnoses.map((d) => d.label),
        medications: medications.map((m) => ({ name: m.genericName, dosage: m.dosage, unit: m.unit, frequency: m.frequency })),
      });
    }
  }

  const result = await callGroqStructured({
    systemPrompt:
      "You are TwinRx's educational health assistant. You must: " +
      "1) never diagnose or prescribe; 2) never change any medical record; " +
      "3) only use the approved patient context provided, never invent facts; " +
      "4) clearly state you are AI-generated and not a substitute for a clinician; " +
      "5) refuse to reveal information about any other patient. " +
      'Return strict JSON: {"reply": string, "isEducationalOnly": true}.',
    userPrompt: JSON.stringify({ question: params.message, approvedContext }),
    schema: CHAT_RESPONSE_SCHEMA,
    promptVersion: PROMPT_VERSION,
    temperature: 0.3,
  });

  const reply = result.ok
    ? result.data!.reply
    : "The AI assistant is currently unavailable. Please try again later, or contact your care team directly.";

  const conversation = await appendMessage(params, reply, false);
  return { conversation, isEmergency: false, aiAvailable: result.ok };
}

async function appendMessage(
  params: { tenantId: string; userId: string; conversationId?: string; message: string },
  reply: string,
  isEmergencyFlag: boolean
) {
  let conversation = params.conversationId
    ? await ChatConversation.findOne({ _id: params.conversationId, tenantId: params.tenantId, userId: params.userId })
    : null;

  if (!conversation) {
    conversation = await ChatConversation.create({ tenantId: params.tenantId, userId: params.userId, messages: [] });
  }
  if (!conversation) throw new HttpError(404, "Conversation not found");

  conversation.messages.push({ role: "user", content: params.message, createdAt: new Date() });
  conversation.messages.push({ role: "assistant", content: reply, isEmergencyFlag, createdAt: new Date() });
  await conversation.save();
  return conversation;
}

export async function createConversation(tenantId: string, userId: string) {
  return ChatConversation.create({ tenantId, userId, messages: [] });
}
