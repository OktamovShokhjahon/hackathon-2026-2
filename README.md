# TwinRx Digital Twin

AI-assisted chronic-care and medication-safety decision-support platform for type 2 diabetes and arterial
hypertension, built per [techmission.md](./techmission.md). **Clinical decision support only — final decisions
remain with a qualified healthcare professional.**

## Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion, React Three Fiber — [apps/web](./apps/web)
- **Backend**: Node.js, Express, TypeScript, Mongoose — [apps/api](./apps/api)
- **Database**: MongoDB
- **AI**: Groq (`gpt-oss-20b`) for structured extraction/explanation, gated behind a deterministic clinical rule engine

## Local development

```bash
cp .env.example .env      # fill in MONGODB_URI / GROQ_API_KEY, or use docker-compose's defaults
npm install
docker compose up -d mongodb   # or point MONGODB_URI at your own instance
npm run dev:api            # http://localhost:4000
npm run dev:web            # http://localhost:3000
```

Seed three synthetic demo patients (type 2 diabetes, hypertension, and combined) into a fresh demo clinic:

```bash
npm run seed
```

This prints the admin/doctor/patient credentials for the demo clinic to the console. All seeded data is fictional.

## Full stack via Docker Compose

```bash
docker compose up --build
```

## Architecture notes

- Every tenant-owned Mongo collection is scoped by `tenantId`, which is always taken from the authenticated JWT —
  never from the request body (see [middleware/tenant.ts](./apps/api/src/middleware/tenant.ts)).
- Deterministic clinical rules ([modules/ai-analysis/rule-catalog.ts](./apps/api/src/modules/ai-analysis/rule-catalog.ts))
  run before any AI call. The Groq model only explains rule output — it never invents thresholds or contraindications.
- AI calls are the backend's responsibility only; the browser never talks to Groq directly.
- Audit events ([modules/audit](./apps/api/src/modules/audit)) are append-only from the application layer.
- The 3D digital twin ([components/digital-twin](./apps/web/components/digital-twin)) falls back to an accessible
  2D organ-card view on unsupported WebGL/mobile environments.

## Known gaps for a production deployment

- Object storage for uploaded documents currently writes to local disk (`apps/api/storage/`) as a stand-in for a
  private S3/MinIO-compatible bucket.
- Virus scanning is stubbed as always-clean; wire a real AV scanner before production use.
- The billing provider is a mock; the interface in `modules/subscriptions/billing.service.ts` is designed to be
  swapped for a real provider (Stripe, PayMe, Click, etc.) without touching calling code.
- Refresh tokens are currently returned to the client and stored in browser storage; production should move to
  httpOnly cookies per the spec.
# hackathon-2026-2
