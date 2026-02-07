# Sentinel Stack - Backend

This is the backend system for the Sentinel Stack Enterprise Application Security Intelligence Platform.

## 🔹 System Overview

- **Framework**: Node.js + Express
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: Firebase Admin SDK
- **PDF Generation**: Puppeteer (Server-side HTML to PDF)

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or later)
- Docker and Docker Compose
- A Firebase project with the Admin SDK configured.

### 1. Environment Setup (recommended)

This repo runs in three different contexts during local development:

- **Frontend (Next.js on host):** `.env.local`
- **Backend (Express in Docker):** `.env.backend`
- **Host tools (Prisma/ts-node scripts on host):** `.env.host`

Copy the templates:

- `cp .env.local.example .env.local`
- `cp .env.host.example .env.host`
- `cp .env.backend.example .env.backend`

Important:
- Do not commit `.env`, `.env.local`, `.env.host` (they contain secrets).
- Only `.env.example` (and other `*.example` files) should be tracked.

Now, fill out the env files with your specific configuration:

- `.env.backend`: backend container env (includes Firebase Admin + email credentials)
- `.env.host`: host DB connection for Prisma/scripts (typically uses `localhost:5432`)
- `.env.local`: Next.js local-only overrides

### Firebase Admin scripts (maintenance)

Some scripts under `scripts/` require Firebase Admin credentials. Prefer setting one of:
- `FIREBASE_SERVICE_ACCOUNT_PATH` (path to a service account JSON file stored outside the repo)
- `FIREBASE_SERVICE_ACCOUNT_JSON` (raw JSON string)

Or fall back to the standard `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` env vars.

### 2. Install Dependencies

`npm install`

### 3. Start the Database

A Docker Compose file is provided for convenience to run a PostgreSQL database.

`docker compose up -d`

### 4. Run Database Migrations

Prisma needs to synchronize the schema with the database.

Local Docker database:

- `npm run prisma:migrate:host`

Hosted database (Neon/Supabase):

- Set `DATABASE_URL` and `DIRECT_URL` in `.env.host`
- Run `npm run prisma:deploy:host`

This will create the necessary tables based on `prisma/schema.prisma`.

### 5. Start the Development Server

The server uses `ts-node` and `nodemon` for live-reloading during development.

`npm run dev`

The API will be available at `http://localhost:3001`.

## ⚙️ Prisma Commands

- **Generate Prisma Client**: Automatically run after `npm install`, but can be run manually.
  `npx prisma generate`
- **Open Prisma Studio**: A GUI for your database.
  `npx prisma studio`

## 🔒 Security

See [docs/SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md) for key rotation and safe env setup.

## 🚢 Deployment (Render)

See [docs/RENDER_DEPLOY.md](docs/RENDER_DEPLOY.md).

### Scan Worker (recommended)

Scans are processed by a DB-backed queue. In production, run scans in a dedicated worker service so API restarts/traffic don’t interrupt scan execution.

Render services:
- `sentinelstack-api` (Docker): HTTP API + scan worker loop (free-tier default)
- `sentinelstack-worker` (optional): scan execution only (paid tier)
- `sentinelstack-web` (Node): Next.js frontend

Key env vars:
- Free tier (API runs scans): `PROCESS_TYPE=api`, `SCAN_QUEUE_WORKER_ENABLED=true`, `RUN_MIGRATIONS_ON_START=true`
- Paid tier split: API `SCAN_QUEUE_WORKER_ENABLED=false`, worker `PROCESS_TYPE=worker`, `SCAN_QUEUE_WORKER_ENABLED=true`, `RUN_MIGRATIONS_ON_START=false`

Optional worker tuning:
- `SCAN_QUEUE_CONCURRENCY` (default 1)
- `SCAN_QUEUE_POLL_MS` (default 2000)

## 📖 API Endpoints

A Postman collection or further API documentation would typically be provided here, detailing all routes, required headers, and request/response bodies.

- `POST /api/auth/init`: Initializes a user in the DB upon first sign-in.
- `POST /api/assessments`: Creates a new assessment (Client role).
- `GET /api/assessments`: Lists assessments (Role-dependent).
- `GET /api/assessments/:id`: Gets a single assessment.
- `PATCH /api/assessments/:id/status`: Updates assessment status (Admin role).
- `POST /api/assessments/:id/findings`: Uploads findings for an assessment (Admin role).
- `GET /api/dashboard/summary`: Fetches data for the main dashboard.
- `POST /api/reports/assessments/:id/generate`: Generates and stores a PDF report (Admin role).
- `GET /api/reports/:id/download`: Gets a secure link to download a report.

## 📁 Folder Structure

- `prisma/`: Contains database schema and migration files.
- `src/`: Main application source code.
  - `config/`: Configuration files (e.g., Firebase Admin setup).
  - `controllers/`: Express route handlers.
  - `middleware/`: Custom middleware (e.g., authentication, error handling).
  - `routes/`: API route definitions.
  - `services/`: Business logic (e.g., risk scoring, PDF generation).
  - `utils/`: Shared utility functions.
  - `server.ts`: The main entry point of the application.
- `.env.example`: Example environment variables.
- `docker-compose.yml`: To run a local PostgreSQL instance.
- `Dockerfile`: For building a production-ready container image.
