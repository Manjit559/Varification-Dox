/*
# Identity Verification Platform Schema

## Overview
Creates the core tables for an enterprise AI Identity Verification & Document
Intelligence platform. Authenticated users can submit identity documents
(Aadhaar, PAN, Passport, Driving Licence) plus a live selfie for verification.
The system stores verification records, extracted document fields, confidence
scores, face-match and liveness results, and a full audit trail.

## New Tables

1. `verifications`
   - `id` (uuid, pk)
   - `user_id` (uuid, owner, defaults to auth.uid(), references auth.users)
   - `document_type` (text) - one of: aadhaar | pan | passport | driving_licence
   - `status` (text) - one of: pending | verified | rejected | review
   - `overall_score` (numeric 0-100) - aggregate verification confidence
   - `ocr_confidence` (numeric 0-100) - OCR extraction confidence
   - `face_match_score` (numeric 0-100) - selfie vs document photo match
   - `liveness_score` (numeric 0-100) - liveness detection confidence
   - `extracted_fields` (jsonb) - structured OCR-extracted document fields
   - `document_path` (text) - storage object path for the document image
   - `selfie_path` (text) - storage object path for the selfie image
   - `consent_given` (boolean) - user consent flag for processing
   - `report_summary` (text) - generated verification report summary
   - `risk_flags` (jsonb) - array of detected risk flags
   - `created_at`, `updated_at` (timestamptz)

2. `audit_logs`
   - `id` (uuid, pk)
   - `user_id` (uuid, defaults to auth.uid())
   - `verification_id` (uuid, nullable, references verifications)
   - `action` (text) - e.g. login, upload, ocr_complete, verification_complete
   - `entity` (text) - affected resource type
   - `details` (jsonb) - structured event details
   - `ip_address` (text, nullable)
   - `created_at` (timestamptz)

## Storage
- Creates a private storage bucket `documents` for encrypted-at-rest storage
  of uploaded document and selfie images.

## Security (RLS)
- `verifications`: owner-scoped CRUD for authenticated users (4 policies).
- `audit_logs`: authenticated users can insert their own logs and read their
  own logs (insert + select policies). Updates/deletes are admin-only (no
  policy = blocked for anon/authenticated).
- Storage bucket policies: owners can manage their own folder under
  `documents`.

## Notes
1. Owner columns default to auth.uid() so client inserts that omit user_id
   still satisfy WITH CHECK policies.
2. The app has a sign-in screen, so policies are scoped TO authenticated.
3. Audit logs are append-only by design for compliance.
*/

-- =========================================================
-- verifications
-- =========================================================
CREATE TABLE IF NOT EXISTS verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('aadhaar','pan','passport','driving_licence')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected','review')),
  overall_score numeric(5,2) DEFAULT 0,
  ocr_confidence numeric(5,2) DEFAULT 0,
  face_match_score numeric(5,2) DEFAULT 0,
  liveness_score numeric(5,2) DEFAULT 0,
  extracted_fields jsonb DEFAULT '{}'::jsonb,
  document_path text,
  selfie_path text,
  consent_given boolean NOT NULL DEFAULT false,
  report_summary text,
  risk_flags jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_verifications" ON verifications;
CREATE POLICY "select_own_verifications" ON verifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_verifications" ON verifications;
CREATE POLICY "insert_own_verifications" ON verifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_verifications" ON verifications;
CREATE POLICY "update_own_verifications" ON verifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_verifications" ON verifications;
CREATE POLICY "delete_own_verifications" ON verifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS verifications_user_id_idx ON verifications(user_id);
CREATE INDEX IF NOT EXISTS verifications_created_at_idx ON verifications(created_at DESC);
CREATE INDEX IF NOT EXISTS verifications_status_idx ON verifications(status);
CREATE INDEX IF NOT EXISTS verifications_document_type_idx ON verifications(document_type);

-- =========================================================
-- audit_logs
-- =========================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  verification_id uuid REFERENCES verifications(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL DEFAULT 'verification',
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_audit_logs" ON audit_logs;
CREATE POLICY "select_own_audit_logs" ON audit_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_audit_logs" ON audit_logs;
CREATE POLICY "insert_own_audit_logs" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_verification_id_idx ON audit_logs(verification_id);

-- =========================================================
-- Storage bucket
-- =========================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: owners manage their own folder
DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
CREATE POLICY "Users can upload own documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can read own documents" ON storage.objects;
CREATE POLICY "Users can read own documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;
CREATE POLICY "Users can delete own documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================
-- updated_at trigger
-- =========================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS verifications_updated_at ON verifications;
CREATE TRIGGER verifications_updated_at
  BEFORE UPDATE ON verifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
