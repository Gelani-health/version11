-- PROMPT 1 FIX: Add apiKey field to Employee model for secure API key authentication
-- API keys are stored as SHA-256 hashes (64 hex characters)
-- This fixes the security hole where employeeId was accepted as API key

-- Add apiKey column (nullable, unique)
ALTER TABLE employees ADD COLUMN apiKey TEXT;

-- Create unique index on apiKey
CREATE UNIQUE INDEX IF NOT EXISTS employees_apiKey_idx ON employees(apiKey) WHERE apiKey IS NOT NULL;
