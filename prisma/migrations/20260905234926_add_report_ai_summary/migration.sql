-- AI-generated executive summary for reports
-- Idempotent: only adds the column if it doesn't already exist
-- (safe to re-run if a previous deploy partially applied)
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "aiSummary" JSONB;