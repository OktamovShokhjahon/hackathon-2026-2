import type { Types } from "mongoose";
import { connectDb, disconnectDb } from "../config/db";
import { logger } from "../config/logger";
import { registerClinic, hashPassword } from "../modules/auth/auth.service";
import { User } from "../modules/users/user.model";
import { PatientProfile } from "../modules/patients/patient.model";
import { Diagnosis } from "../modules/diagnoses/diagnosis.model";
import { Medication } from "../modules/medications/medication.model";
import { MedicalRecord } from "../modules/medical-records/medical-record.model";
import { createTreatmentScenario, reviewScenario } from "../modules/ai-analysis/treatment-analysis.service";
import { TreatmentScenario } from "../modules/ai-analysis/treatment-scenario.model";
import { Allergy } from "../modules/medications/allergy.model";
import { Tenant } from "../modules/tenants/tenant.model";
import { Subscription } from "../modules/subscriptions/subscription.model";
import { AuditEvent } from "../modules/audit/audit-event.model";
import { DocumentModel } from "../modules/documents/document.model";
import { AIJob } from "../modules/ai-analysis/ai-job.model";

/** Projection windows are absolute dates, so seeded scenarios read like real ones. */
function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Analyses all created in the same second make the clinic's activity chart a
 * single dot. Backdating spreads the demo history over the past fortnight so
 * the trend reads like a clinic that has been running.
 */
async function backdateScenario(scenarioId: Types.ObjectId, days: number): Promise<void> {
  // Mongoose marks a timestamps-managed `createdAt` immutable and silently
  // drops it from an update, so this goes through the driver directly.
  await TreatmentScenario.collection.updateOne(
    { _id: scenarioId },
    { $set: { createdAt: daysAgo(days), updatedAt: daysAgo(days) } }
  );
}

/**
 * Seeds one demo clinic with three clearly fictional synthetic patients, per
 * spec section 23. Never run against a production database.
 */
async function seed() {
  await connectDb();

  // Re-seeding would otherwise fail halfway through on the duplicate clinic
  // slug, leaving a half-built demo. Removing data is never implicit.
  const existing = await Tenant.findOne({ slug: "twinrx-demo-clinic" });
  if (existing) {
    if (!process.argv.includes("--reset")) {
      logger.error(
        "The demo clinic already exists. Re-run with --reset to delete it and seed a fresh one."
      );
      await disconnectDb();
      process.exit(1);
    }
    await resetDemoTenant(String(existing._id));
    logger.info({ tenantId: String(existing._id) }, "Removed the previous demo clinic");
  }

  const { tenant, admin } = await registerClinic({
    clinicName: "TwinRx Demo Clinic",
    contactEmail: "demo@twinrx.example",
    adminFullName: "Demo Admin",
    adminEmail: "admin@twinrx.example",
    password: "DemoAdminPass123!",
  });

  const doctorPasswordHash = await hashPassword("DemoDoctorPass123!");
  const doctor = await User.create({
    tenantId: tenant._id,
    role: "DOCTOR",
    fullName: "Dr. Aziza Karimova",
    email: "doctor@twinrx.example",
    passwordHash: doctorPasswordHash,
    status: "active",
    createdBy: admin._id,
  });

  const patientPasswordHash = await hashPassword("DemoPatientPass123!");

  async function createSyntheticPatient(fullName: string, email: string, code: string) {
    const user = await User.create({
      tenantId: tenant._id,
      role: "PATIENT",
      fullName,
      email,
      passwordHash: patientPasswordHash,
      status: "active",
      createdBy: doctor._id,
    });
    const profile = await PatientProfile.create({
      tenantId: tenant._id,
      userId: user._id,
      patientCode: code,
      dateOfBirth: new Date("1975-04-12"),
      sex: "unknown",
      status: "ACTIVE",
      consentStatus: "granted",
      assignedDoctorIds: [doctor._id],
    });
    return { user, profile };
  }

  // Patient 1: T2DM with incomplete renal labs -> yellow kidney signal
  const p1 = await createSyntheticPatient("Synthetic Patient Alpha", "patient1@twinrx.example", "PT-DEMO-A1");
  const p1Diagnosis = await Diagnosis.create({
    tenantId: tenant._id,
    patientId: p1.profile._id,
    label: "Type 2 diabetes mellitus",
    state: "active",
    diagnosedAt: new Date("2023-01-15"),
    createdBy: doctor._id,
  });
  const p1Medication = await Medication.create({
    tenantId: tenant._id,
    patientId: p1.profile._id,
    genericName: "Metformin",
    dosage: 500,
    unit: "mg",
    route: "oral",
    frequency: "twice daily",
    startDate: new Date(),
    status: "active",
    purpose: "Glycemic control",
    createdBy: doctor._id,
  });
  await MedicalRecord.create({
    tenantId: tenant._id,
    patientId: p1.profile._id,
    type: "lab_result",
    eventDate: new Date("2025-11-01"),
    data: { field: "latestHba1c", value: 7.8, unit: "%" },
    sourceType: "laboratory",
    verificationStatus: "verified",
    verifiedBy: doctor._id,
    verifiedAt: new Date(),
    createdBy: doctor._id,
  });
  // Renal labs intentionally omitted to trigger the yellow kidney-monitoring signal.
  const p1Scenario = await createTreatmentScenario({
    tenantId: String(tenant._id),
    patientId: String(p1.profile._id),
    diagnosisIds: [String(p1Diagnosis._id)],
    medicationIds: [String(p1Medication._id)],
    projectionTo: daysFromNow(30),
    createdBy: String(doctor._id),
  });
  await backdateScenario(p1Scenario.scenario._id, 11);

  // Patient 2: Hypertension with cardiovascular medication-monitoring signal
  const p2 = await createSyntheticPatient("Synthetic Patient Beta", "patient2@twinrx.example", "PT-DEMO-B2");
  const p2Diagnosis = await Diagnosis.create({
    tenantId: tenant._id,
    patientId: p2.profile._id,
    label: "Arterial hypertension",
    state: "active",
    diagnosedAt: new Date("2022-06-01"),
    createdBy: doctor._id,
  });
  const p2Medication = await Medication.create({
    tenantId: tenant._id,
    patientId: p2.profile._id,
    genericName: "Lisinopril",
    dosage: 10,
    unit: "mg",
    route: "oral",
    frequency: "once daily",
    startDate: new Date(),
    status: "active",
    purpose: "Blood pressure control",
    createdBy: doctor._id,
  });
  await Allergy.create({
    tenantId: tenant._id,
    patientId: p2.profile._id,
    substance: "Sulfonamide antibiotics",
    reaction: "Rash",
    severity: "moderate",
    verificationStatus: "verified",
    createdBy: doctor._id,
  });
  await MedicalRecord.insertMany([
    {
      tenantId: tenant._id,
      patientId: p2.profile._id,
      type: "lab_result",
      eventDate: daysAgo(40),
      // At the top of the usual range: enough to raise the ACE-inhibitor
      // potassium signal without making it a contraindication.
      data: { field: "latestPotassium", value: 5.2, unit: "mmol/L" },
      sourceType: "laboratory",
      verificationStatus: "verified",
      verifiedBy: doctor._id,
      verifiedAt: daysAgo(40),
      createdBy: doctor._id,
    },
    {
      tenantId: tenant._id,
      patientId: p2.profile._id,
      type: "lab_result",
      eventDate: daysAgo(40),
      data: { field: "latestCreatinine", value: 1.1, unit: "mg/dL" },
      sourceType: "laboratory",
      verificationStatus: "verified",
      verifiedBy: doctor._id,
      verifiedAt: daysAgo(40),
      createdBy: doctor._id,
    },
  ]);
  const p2Scenario = await createTreatmentScenario({
    tenantId: String(tenant._id),
    patientId: String(p2.profile._id),
    diagnosisIds: [String(p2Diagnosis._id)],
    medicationIds: [String(p2Medication._id)],
    projectionTo: daysFromNow(30),
    createdBy: String(doctor._id),
  });
  await backdateScenario(p2Scenario.scenario._id, 6);
  // One scenario arrives already reviewed and published, so the patient-facing
  // twin has something to show the moment the demo starts.
  await reviewScenario({
    tenantId: String(tenant._id),
    scenarioId: String(p2Scenario.scenario._id),
    reviewedBy: String(doctor._id),
    decision: "APPROVED",
    note: "Potassium at the upper end; continue lisinopril and recheck in two weeks.",
    visibleToPatient: true,
  });

  // Patient 3: Combined diabetes + hypertension, mixed green/yellow scenario
  const p3 = await createSyntheticPatient("Synthetic Patient Gamma", "patient3@twinrx.example", "PT-DEMO-C3");
  const p3Diagnoses = await Diagnosis.insertMany([
    {
      tenantId: tenant._id,
      patientId: p3.profile._id,
      label: "Type 2 diabetes mellitus",
      state: "active",
      diagnosedAt: new Date("2021-03-01"),
      createdBy: doctor._id,
    },
    {
      tenantId: tenant._id,
      patientId: p3.profile._id,
      label: "Arterial hypertension",
      state: "active",
      diagnosedAt: new Date("2021-03-01"),
      createdBy: doctor._id,
    },
  ]);
  const p3Medications = await Medication.insertMany([
    {
      tenantId: tenant._id,
      patientId: p3.profile._id,
      genericName: "Atorvastatin",
      dosage: 20,
      unit: "mg",
      route: "oral",
      frequency: "once daily",
      startDate: new Date(),
      status: "active",
      purpose: "Lipid management",
      createdBy: doctor._id,
    },
  ]);
  await MedicalRecord.insertMany([
    {
      tenantId: tenant._id,
      patientId: p3.profile._id,
      type: "lab_result",
      eventDate: new Date("2025-12-01"),
      data: { field: "latestAlt", value: 22, unit: "U/L" },
      sourceType: "laboratory",
      verificationStatus: "verified",
      verifiedBy: doctor._id,
      verifiedAt: new Date(),
      createdBy: doctor._id,
    },
    {
      tenantId: tenant._id,
      patientId: p3.profile._id,
      type: "lab_result",
      eventDate: new Date("2025-12-01"),
      data: { field: "latestAst", value: 19, unit: "U/L" },
      sourceType: "laboratory",
      verificationStatus: "verified",
      verifiedBy: doctor._id,
      verifiedAt: new Date(),
      createdBy: doctor._id,
    },
  ]);
  const p3Scenario = await createTreatmentScenario({
    tenantId: String(tenant._id),
    patientId: String(p3.profile._id),
    diagnosisIds: p3Diagnoses.map((d) => String(d._id)),
    medicationIds: p3Medications.map((m) => String(m._id)),
    projectionTo: daysFromNow(90),
    createdBy: String(doctor._id),
  });
  await backdateScenario(p3Scenario.scenario._id, 3);

  // A proposed NSAID on top of hypertension: the catalog's high-priority case,
  // so the demo has one red result to open with.
  const p3Nsaid = await Medication.create({
    tenantId: tenant._id,
    patientId: p3.profile._id,
    genericName: "Ibuprofen",
    dosage: 400,
    unit: "mg",
    route: "oral",
    frequency: "three times daily",
    startDate: new Date(),
    status: "active",
    purpose: "Knee pain",
    createdBy: doctor._id,
  });
  const p3RedScenario = await createTreatmentScenario({
    tenantId: String(tenant._id),
    patientId: String(p3.profile._id),
    diagnosisIds: p3Diagnoses.map((d) => String(d._id)),
    medicationIds: [String(p3Nsaid._id)],
    projectionTo: daysFromNow(90),
    createdBy: String(doctor._id),
  });
  await backdateScenario(p3RedScenario.scenario._id, 1);

  logger.info(
    {
      tenantSlug: tenant.slug,
      adminEmail: admin.email,
      doctorEmail: doctor.email,
      patients: [p1.user.email, p2.user.email, p3.user.email],
    },
    "Seed complete. All data is synthetic and fictional."
  );

  await disconnectDb();
}

/** Deletes every record belonging to the demo clinic. Demo tenant only. */
async function resetDemoTenant(tenantId: string): Promise<void> {
  await Promise.all([
    User.deleteMany({ tenantId }),
    PatientProfile.deleteMany({ tenantId }),
    Diagnosis.deleteMany({ tenantId }),
    Medication.deleteMany({ tenantId }),
    Allergy.deleteMany({ tenantId }),
    MedicalRecord.deleteMany({ tenantId }),
    TreatmentScenario.deleteMany({ tenantId }),
    Subscription.deleteMany({ tenantId }),
    AuditEvent.deleteMany({ tenantId }),
    DocumentModel.deleteMany({ tenantId }),
    AIJob.deleteMany({ tenantId }),
    Tenant.deleteOne({ _id: tenantId }),
  ]);
}

seed().catch((err) => {
  logger.error({ err }, "Seed failed");
  process.exit(1);
});
