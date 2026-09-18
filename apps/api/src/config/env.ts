import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  webUrl: process.env.WEB_URL ?? "http://localhost:3000",
  port: Number(process.env.PORT ?? 4000),
  mongodbUri: required("MONGODB_URI", "mongodb://localhost:27017/twinrx"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET", "dev_access_secret_change_me"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", "dev_refresh_secret_change_me"),
  accessTokenTtl: process.env.JWT_ACCESS_TTL ?? "15m",
  refreshTokenTtl: process.env.JWT_REFRESH_TTL ?? "7d",
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  groqModel: process.env.GROQ_MODEL ?? "openai/gpt-oss-20b",
  billingProvider: process.env.BILLING_PROVIDER ?? "mock",
  billingWebhookSecret: process.env.BILLING_WEBHOOK_SECRET ?? "dev_webhook_secret",
  demoTrialDays: Number(process.env.DEMO_TRIAL_DAYS ?? 7),
};
