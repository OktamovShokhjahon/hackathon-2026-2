import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/auth.routes";
import { adminRouter } from "./modules/users/admin.routes";
import { doctorRouter } from "./modules/patients/doctor.routes";
import { patientRouter } from "./modules/patients/patient.routes";
import { meRouter } from "./modules/patients/me.routes";
import { recordVerifyRouter } from "./modules/medical-records/medical-record.routes";
import { scenarioReviewRouter } from "./modules/ai-analysis/treatment-scenario.routes";
import { documentAnalyzeRouter } from "./modules/documents/document.routes";
import { chatbotRouter } from "./modules/chatbot/chatbot.routes";
import { analyticsRouter } from "./modules/analytics/analytics.routes";
import { billingRouter } from "./modules/subscriptions/billing.routes";
import { drugReferenceRouter } from "./modules/drug-reference/drug-reference.routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.webUrl,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(pinoHttp({ logger }));

  const globalRateLimit = rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
  app.use("/api", globalRateLimit);

  app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

  const v1 = express.Router();
  v1.use("/auth", authRouter);
  v1.use("/admin", adminRouter);
  v1.use("/doctor", doctorRouter);
  v1.use("/patients", patientRouter);
  v1.use("/records", recordVerifyRouter);
  v1.use("/treatment-scenarios", scenarioReviewRouter);
  v1.use("/documents", documentAnalyzeRouter);
  v1.use("/me", meRouter);
  v1.use("/chat", chatbotRouter);
  v1.use("/analytics", analyticsRouter);
  v1.use("/billing", billingRouter);
  v1.use("/drug-reference", drugReferenceRouter);

  app.use("/api/v1", v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
