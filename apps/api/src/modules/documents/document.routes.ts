import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { HttpError } from "../../middleware/errorHandler";
import { analyzeDocument, uploadDocument } from "./document.service";
import { recordAuditEvent } from "../audit/audit.service";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

export const documentUploadRouter = Router({ mergeParams: true });
documentUploadRouter.use(requireAuth, requireRole("DOCTOR", "ADMIN"));

documentUploadRouter.post("/", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "No file uploaded");
    const document = await uploadDocument({
      tenantId: req.auth!.tenantId,
      patientId: (req.params as { patientId: string }).patientId,
      uploadedBy: req.auth!.userId,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      buffer: req.file.buffer,
    });

    await recordAuditEvent({
      tenantId: req.auth!.tenantId,
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: "document.upload",
      targetType: "Document",
      targetId: String(document._id),
    });

    res.status(201).json(document);
  } catch (err) {
    next(err);
  }
});

export const documentAnalyzeRouter = Router();
documentAnalyzeRouter.use(requireAuth, requireRole("DOCTOR", "ADMIN"));

const analyzeSchema = z.object({ extractedText: z.string().min(1) });

documentAnalyzeRouter.post("/:documentId/analyze", async (req, res, next) => {
  try {
    const input = analyzeSchema.parse(req.body);
    const result = await analyzeDocument({
      tenantId: req.auth!.tenantId,
      documentId: req.params.documentId,
      extractedText: input.extractedText,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});
