import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { stripClientTenantId } from "../../middleware/tenant";
import { HttpError } from "../../middleware/errorHandler";
import { archivePatient, createPatient, getPatientById, listPatients } from "./patient.service";
import { createPatientSchema, updatePatientSchema } from "./patient.validation";
import { PatientProfile } from "./patient.model";
import { recordAuditEvent } from "../audit/audit.service";
import { assertEntitlement } from "../subscriptions/entitlements.service";
import { recordsRouter } from "../medical-records/medical-record.routes";
import { diagnosisRouter } from "../diagnoses/diagnosis.routes";
import { medicationRouter, allergyRouter } from "../medications/medication.routes";
import { treatmentScenarioRouter } from "../ai-analysis/treatment-scenario.routes";
import { documentUploadRouter } from "../documents/document.routes";

export const patientRouter = Router();

patientRouter.use(requireAuth, stripClientTenantId);

patientRouter.get("/", requireRole("DOCTOR", "ADMIN"), async (req, res, next) => {
  try {
    const results = await listPatients({
      tenantId: req.auth!.tenantId,
      doctorId: req.auth!.role === "DOCTOR" ? req.auth!.userId : undefined,
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
    });
    res.json(results);
  } catch (err) {
    next(err);
  }
});

patientRouter.post("/", requireRole("DOCTOR", "ADMIN"), async (req, res, next) => {
  try {
    const input = createPatientSchema.parse(req.body);
    await assertEntitlement(req.auth!.tenantId, "patient");
    const { user, profile } = await createPatient({
      tenantId: req.auth!.tenantId,
      doctorId: req.auth!.userId,
      ...input,
    });

    await recordAuditEvent({
      tenantId: req.auth!.tenantId,
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: "patient.create",
      targetType: "PatientProfile",
      targetId: String(profile._id),
    });

    res.status(201).json({
      patient: { id: profile._id, patientCode: profile.patientCode, status: profile.status },
      user: { id: user._id, email: user.email, fullName: user.fullName, phone: user.phone },
    });
  } catch (err) {
    next(err);
  }
});

patientRouter.get("/:patientId", requireRole("DOCTOR", "ADMIN"), async (req, res, next) => {
  try {
    const result = await getPatientById(req.auth!.tenantId, req.params.patientId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

patientRouter.patch("/:patientId", requireRole("DOCTOR", "ADMIN"), async (req, res, next) => {
  try {
    const input = updatePatientSchema.parse(req.body);
    const profile = await PatientProfile.findOneAndUpdate(
      { _id: req.params.patientId, tenantId: req.auth!.tenantId },
      { $set: input },
      { new: true }
    );
    if (!profile) throw new HttpError(404, "Patient not found");
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

patientRouter.post("/:patientId/archive", requireRole("DOCTOR", "ADMIN"), async (req, res, next) => {
  try {
    await archivePatient(req.auth!.tenantId, req.params.patientId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

patientRouter.use("/:patientId/records", recordsRouter);
patientRouter.use("/:patientId/diagnoses", diagnosisRouter);
patientRouter.use("/:patientId/medications", medicationRouter);
patientRouter.use("/:patientId/allergies", allergyRouter);
patientRouter.use("/:patientId/treatment-scenarios", treatmentScenarioRouter);
patientRouter.use("/:patientId/documents", documentUploadRouter);
