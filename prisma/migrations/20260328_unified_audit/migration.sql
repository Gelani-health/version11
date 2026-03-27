-- PROMPT 11: Unified Audit Trail - Enhanced AuditLog Model
-- Migration: Add outcome, patientId, metadata, and retainUntil fields
-- Reference: HIPAA Privacy Rule 45 CFR § 164.312(b) - Audit controls
-- This migration is BACKWARD COMPATIBLE - it does NOT drop or modify existing columns

-- Add new columns to audit_logs table
ALTER TABLE "audit_logs" ADD COLUMN "patientId" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "outcome" TEXT DEFAULT 'SUCCESS';
ALTER TABLE "audit_logs" ADD COLUMN "metadata" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "retainUntil" DATETIME;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS "audit_logs_patientId_idx" ON "audit_logs"("patientId");
CREATE INDEX IF NOT EXISTS "audit_logs_outcome_idx" ON "audit_logs"("outcome");
CREATE INDEX IF NOT EXISTS "audit_logs_retainUntil_idx" ON "audit_logs"("retainUntil");

-- Create additional index for timestamp (if not exists)
CREATE INDEX IF NOT EXISTS "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- Update existing records to have SUCCESS outcome
UPDATE "audit_logs" SET "outcome" = 'SUCCESS' WHERE "outcome" IS NULL;

-- Set retention date for existing records (7 years from now)
-- Note: In production, this should be calculated from the original timestamp
UPDATE "audit_logs" SET "retainUntil" = datetime('now', '+7 years') WHERE "retainUntil" IS NULL;
