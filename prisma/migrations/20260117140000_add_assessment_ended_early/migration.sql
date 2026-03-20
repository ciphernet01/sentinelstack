-- Add assessment-level scan trustworthiness fields
ALTER TABLE "Assessment"
ADD COLUMN "endedEarly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "endedEarlyReason" TEXT;
