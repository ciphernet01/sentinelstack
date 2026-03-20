# Security Checklist (Local + Production)

This repo is a full-stack SaaS app. Treat **all credentials as compromised** if they were ever committed or shared.

## 1) Immediate actions (do first)

- Rotate/replace any previously exposed secrets:
  - Firebase Admin service account private key
  - SMTP credentials
  - `PDF_RENDER_SECRET`
  - `GEMINI_API_KEY`
- Ensure these files are **not committed**:
  - `.env`, `.env.local`, `.env.host`
  - `.env.backend`
  - any `*-firebase-adminsdk-*.json`
  - any `client_secret_*.json`

## 2) Recommended environment strategy

- Keep only templates tracked in git:
  - `.env.example`
  - `.env.local.example`
  - `.env.host.example`
  - `.env.backend.example`
- Store real secrets in one of:
  - a secret manager (recommended)
  - deployment platform env vars
  - local untracked `.env*` files for dev

## 3) Firebase Admin credentials (backend)

Preferred approach:
- Put the service-account JSON **outside the repo** and set:
  - `FIREBASE_SERVICE_ACCOUNT_PATH=/absolute/path/to/service-account.json`

Alternatives:
- `FIREBASE_SERVICE_ACCOUNT_JSON` (raw JSON string)
- Or set the split env vars:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY` (use `\n` for newlines)

## 4) Firebase client config (frontend)

Firebase client config values (including `apiKey`) are not secrets, but should still be configurable per environment.
Use these env vars when needed:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

## 5) Prevent regressions

Run the local scanner before pushing:

- `npm run security:secrets`

If you add CI later, run it on PRs.
