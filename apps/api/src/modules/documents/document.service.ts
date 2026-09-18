import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { z } from "zod";
import { HttpError } from "../../middleware/errorHandler";
import { DocumentModel } from "./document.model";
import { AIJob } from "../ai-analysis/ai-job.model";
import { callGroqStructured } from "../ai-analysis/groq.client";
import { env } from "../../config/env";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

const MAX_SIZE_BYTES = 15 * 1024 * 1024;

// Local disk storage stands in for the private object-storage bucket described
// in the spec (S3/MinIO-compatible). Swap this for a real client in production.
const STORAGE_ROOT = path.resolve(process.cwd(), "storage", "documents");

export const EXTRACTED_FACTS_SCHEMA = z.object({
  documentType: z.string(),
  candidateFacts: z.array(
    z.object({
      type: z.enum(["diagnosis", "medication", "allergy", "lab_result", "vital_sign", "procedure"]),
      description: z.string(),
      value: z.union([z.string(), z.number()]).optional(),
      unit: z.string().optional(),
      date: z.string().optional(),
      sourceSpan: z.string(),
      confidence: z.enum(["low", "medium", "high"]),
    })
  ),
  missingOrUnclear: z.array(z.string()),
});

export async function uploadDocument(params: {
  tenantId: string;
  patientId: string;
  uploadedBy: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  if (!ALLOWED_MIME_TYPES.has(params.mimeType)) {
    throw new HttpError(415, "Unsupported file type. Allowed: PDF, DOCX, JPG, PNG.");
  }
  if (params.buffer.byteLength > MAX_SIZE_BYTES) {
    throw new HttpError(413, "File exceeds the 15MB upload limit.");
  }

  await fs.mkdir(STORAGE_ROOT, { recursive: true });
  const storageKey = `${params.tenantId}/${crypto.randomUUID()}-${params.fileName}`;
  const fullPath = path.join(STORAGE_ROOT, storageKey.replace(/\//g, "_"));
  await fs.writeFile(fullPath, params.buffer);

  const document = await DocumentModel.create({
    tenantId: params.tenantId,
    patientId: params.patientId,
    fileName: params.fileName,
    mimeType: params.mimeType,
    sizeBytes: params.buffer.byteLength,
    storageKey,
    virusScanStatus: "clean", // Placeholder: wire to a real AV scanner before production.
    uploadedBy: params.uploadedBy,
  });

  return document;
}

const PROMPT_VERSION = "document-understanding@1";

export async function analyzeDocument(params: { tenantId: string; documentId: string; extractedText: string }) {
  const document = await DocumentModel.findOne({ _id: params.documentId, tenantId: params.tenantId });
  if (!document) throw new HttpError(404, "Document not found");

  document.extractedText = params.extractedText.slice(0, 20000);
  await document.save();

  const aiJob = await AIJob.create({
    tenantId: params.tenantId,
    patientId: document.patientId,
    documentId: document._id,
    task: "document_understanding",
    status: "processing",
    promptVersion: PROMPT_VERSION,
    modelId: env.groqModel,
  });

  const result = await callGroqStructured({
    systemPrompt:
      "You extract candidate clinical facts from a medical document. Return ONLY facts explicitly present in the text. " +
      'Use "unknown" rather than guessing. Every fact needs a sourceSpan quoting the originating text. ' +
      "Return strict JSON matching the schema you were given.",
    userPrompt: document.extractedText,
    schema: EXTRACTED_FACTS_SCHEMA,
    promptVersion: PROMPT_VERSION,
  });

  aiJob.status = result.ok ? "completed" : "failed";
  aiJob.latencyMs = result.latencyMs;
  aiJob.responseId = result.responseId;
  aiJob.tokenUsage = result.tokenUsage;
  aiJob.error = result.error;
  aiJob.output = result.data as Record<string, unknown> | undefined;
  await aiJob.save();

  document.aiJobId = aiJob._id;
  await document.save();

  return { document, aiJob, extraction: result.ok ? result.data : null, aiAvailable: result.ok };
}
