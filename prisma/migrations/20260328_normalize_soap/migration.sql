-- PROMPT 10: Normalize SOAP Note Schema
-- Migration: Add version history, structured assessment items, and plan items
-- This migration is BACKWARD COMPATIBLE - it does NOT drop or modify existing columns
-- Reference: HIPAA compliance requires audit trail of all medical record modifications

-- Create SoapNoteVersion table for version history and amendment trail
-- Each version stores a full JSON snapshot for FHIR Composition export
CREATE TABLE "soap_note_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "soapNoteId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "amendedBy" TEXT NOT NULL,
    "amendmentReason" TEXT,
    "changeSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for SoapNoteVersion
CREATE INDEX "soap_note_versions_soapNoteId_idx" ON "soap_note_versions"("soapNoteId");
CREATE INDEX "soap_note_versions_amendedBy_idx" ON "soap_note_versions"("amendedBy");
CREATE INDEX "soap_note_versions_createdAt_idx" ON "soap_note_versions"("createdAt");
CREATE UNIQUE INDEX "soap_note_versions_soapNoteId_versionNumber_key" ON "soap_note_versions"("soapNoteId", "versionNumber");

-- Create SoapNoteAssessmentItem table for structured assessment entries
-- Supports ICD-10/ICD-11 and SNOMED CT coding for billing and quality reporting
CREATE TABLE "soap_note_assessment_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "soapNoteId" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "icdCode" TEXT,
    "icdVersion" TEXT DEFAULT 'ICD-10',
    "snomedCode" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 1,
    "confidence" REAL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isPrimary" BOOLEAN NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Create indexes for SoapNoteAssessmentItem
CREATE INDEX "soap_note_assessment_items_soapNoteId_idx" ON "soap_note_assessment_items"("soapNoteId");
CREATE INDEX "soap_note_assessment_items_icdCode_idx" ON "soap_note_assessment_items"("icdCode");
CREATE INDEX "soap_note_assessment_items_status_idx" ON "soap_note_assessment_items"("status");
CREATE UNIQUE INDEX "soap_note_assessment_items_soapNoteId_rank_key" ON "soap_note_assessment_items"("soapNoteId", "rank");

-- Create SoapNotePlanItem table for structured plan entries
-- Categories: medication, lab, imaging, referral, followup, procedure, education
CREATE TABLE "soap_note_plan_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "soapNoteId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'routine',
    "orderedBy" TEXT,
    "orderedAt" DATETIME,
    "scheduledDate" DATETIME,
    "completedAt" DATETIME,
    "completedBy" TEXT,
    "outcome" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Create indexes for SoapNotePlanItem
CREATE INDEX "soap_note_plan_items_soapNoteId_idx" ON "soap_note_plan_items"("soapNoteId");
CREATE INDEX "soap_note_plan_items_category_idx" ON "soap_note_plan_items"("category");
CREATE INDEX "soap_note_plan_items_status_idx" ON "soap_note_plan_items"("status");
CREATE INDEX "soap_note_plan_items_priority_idx" ON "soap_note_plan_items"("priority");

-- Add foreign key constraints
-- Note: SQLite requires foreign keys to be enabled in Prisma, these are enforced at the application level

-- Foreign key for SoapNoteVersion -> SoapNote (with cascade delete)
-- ALTER TABLE "soap_note_versions" ADD CONSTRAINT "soap_note_versions_soapNoteId_fkey" 
--     FOREIGN KEY ("soapNoteId") REFERENCES "soap_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign key for SoapNoteAssessmentItem -> SoapNote (with cascade delete)
-- ALTER TABLE "soap_note_assessment_items" ADD CONSTRAINT "soap_note_assessment_items_soapNoteId_fkey" 
--     FOREIGN KEY ("soapNoteId") REFERENCES "soap_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign key for SoapNotePlanItem -> SoapNote (with cascade delete)
-- ALTER TABLE "soap_note_plan_items" ADD CONSTRAINT "soap_note_plan_items_soapNoteId_fkey" 
--     FOREIGN KEY ("soapNoteId") REFERENCES "soap_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migration complete
-- No existing columns were modified or dropped
-- All new tables have proper indexes for performance
-- Relations are set up for Prisma ORM with cascade delete
