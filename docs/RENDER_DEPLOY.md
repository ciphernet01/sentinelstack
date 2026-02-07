# Render deploy (recommended)

This repo deploys cleanly on Render (free-tier friendly) using two services:

- `sentinelstack-api` (Docker): Express + Prisma + Puppeteer/scanners (also runs the scan queue worker)
- `sentinelstack-web` (Node): Next.js frontend

## 1) Create from Blueprint

1. In Render: **New** → **Blueprint**
2. Select your GitHub repo: `ciphernet01/sentinelstack`
3. Render will detect [render.yaml](../render.yaml) and propose two services.
4. Create the services.

## 2) Set environment variables

### API service: `sentinelstack-api`

Required:
- `DATABASE_URL` = Neon pooled connection string (recommended for runtime)
- `DIRECT_URL` = Neon direct connection string (recommended for migrations)
- `CLIENT_URL` = the full URL of the web service (e.g. `https://sentinelstack-web.onrender.com`)

Backend-to-backend auth (required if you use internal routes):
- `INTERNAL_API_TOKEN` = long random string

Billing provider (choose one):
- Stripe (default): set `BILLING_PROVIDER=stripe` and the Stripe env vars below.
- Razorpay: set `BILLING_PROVIDER=razorpay` and the Razorpay env vars below.

Firebase Admin (required for auth/user management):
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Notes for `FIREBASE_PRIVATE_KEY`:
- In Render, paste it as a single line with `\n` for newlines.

Email (optional; only if you want password reset/invite emails):
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`

Queue/worker role:
- `SCAN_QUEUE_WORKER_ENABLED=true` (default: run scan jobs in the API on free tier)
- `PROCESS_TYPE=api`
- `RUN_MIGRATIONS_ON_START=true`

### Razorpay env vars (if `BILLING_PROVIDER=razorpay`)

Required:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

Plan IDs (create Razorpay plans per tier/period/currency and set the matching env vars):
- `RAZORPAY_PRO_INR_MONTHLY_PLAN_ID`
- `RAZORPAY_PRO_INR_YEARLY_PLAN_ID`
- `RAZORPAY_ENTERPRISE_INR_MONTHLY_PLAN_ID`
- `RAZORPAY_ENTERPRISE_INR_YEARLY_PLAN_ID`

Optional (if you also create USD plans in Razorpay):
- `RAZORPAY_PRO_USD_MONTHLY_PLAN_ID`
- `RAZORPAY_PRO_USD_YEARLY_PLAN_ID`
- `RAZORPAY_ENTERPRISE_USD_MONTHLY_PLAN_ID`
- `RAZORPAY_ENTERPRISE_USD_YEARLY_PLAN_ID`

Optional default currency:
- `BILLING_DEFAULT_CURRENCY=INR` (default) or `USD`

### Web service: `sentinelstack-web`

Required:
- `BACKEND_URL` = full URL of the API service (e.g. `https://sentinelstack-api.onrender.com`)

Firebase client (public values):
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (optional)

## 3) Deploy order

1. Deploy `sentinelstack-api` first.
   - It runs `prisma migrate deploy` automatically on startup.
2. After API is live, set `BACKEND_URL` on `sentinelstack-web` and deploy web.
3. Set `CLIENT_URL` on API to the web URL and redeploy API (CORS).

## Adding a dedicated worker later

When you’re ready to pay for an extra service, create a separate Docker worker service from the same repo/image and set:
- `PROCESS_TYPE=worker`
- `SCAN_QUEUE_WORKER_ENABLED=true`
- `RUN_MIGRATIONS_ON_START=false`

Then flip the API to `SCAN_QUEUE_WORKER_ENABLED=false` so jobs only run in the worker.

## 4) Quick verification

- API healthcheck: `GET /health` should return `OK`
- Web: open the Render web URL and sign in

## Troubleshooting

- 502/port issues: confirm the service listens on `process.env.PORT`.
- CORS errors: make sure API `CLIENT_URL` matches the deployed web URL exactly.
- Prisma connection errors: verify `DATABASE_URL` (pooled) and `DIRECT_URL` (direct).
