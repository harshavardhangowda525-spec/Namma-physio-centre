-- Reversible forward migration 002: Website appointment Gmail workflow, approval tokens, audit logs, and Google Reviews sync metadata.
ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS requested_service TEXT;
ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS proposed_date DATE;
ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS proposed_time TEXT;
ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS decline_reason TEXT;
ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 45;
ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS approved_by TEXT;

ALTER TABLE appointment_requests DROP CONSTRAINT IF EXISTS appointment_requests_status_check;
ALTER TABLE appointment_requests ADD CONSTRAINT appointment_requests_status_check
  CHECK (status IN ('requested', 'pending_approval', 'confirmed', 'reschedule_proposed', 'rescheduled', 'declined', 'rejected', 'cancelled', 'completed'));

CREATE TABLE IF NOT EXISTS appointment_action_tokens (
  token_hash     TEXT PRIMARY KEY,
  appointment_id BIGINT NOT NULL REFERENCES appointment_requests(id) ON DELETE CASCADE,
  purpose        TEXT NOT NULL CHECK (purpose IN ('doctor_manage', 'patient_reschedule')),
  expires_at     TIMESTAMPTZ NOT NULL,
  used_at        TIMESTAMPTZ,
  revoked_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS appointment_action_tokens_appt_idx ON appointment_action_tokens (appointment_id, purpose);

CREATE TABLE IF NOT EXISTS appointment_audit_log (
  id              BIGSERIAL PRIMARY KEY,
  appointment_id  BIGINT NOT NULL REFERENCES appointment_requests(id) ON DELETE CASCADE,
  reference       TEXT NOT NULL,
  actor           TEXT NOT NULL,
  action          TEXT NOT NULL,
  previous_status TEXT,
  new_status      TEXT NOT NULL,
  details         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS appointment_audit_log_appt_idx ON appointment_audit_log (appointment_id, created_at DESC);

CREATE TABLE IF NOT EXISTS email_delivery_logs (
  id                BIGSERIAL PRIMARY KEY,
  dedupe_key        TEXT NOT NULL UNIQUE,
  appointment_id    BIGINT REFERENCES appointment_requests(id) ON DELETE SET NULL,
  reference         TEXT,
  template          TEXT NOT NULL,
  recipient_masked  TEXT NOT NULL,
  provider          TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('pending', 'submitted_to_gmail', 'sent_fallback', 'failed', 'skipped')),
  gmail_message_id  TEXT,
  attempts          INTEGER NOT NULL DEFAULT 0,
  last_error        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_delivery_logs_appt_idx ON email_delivery_logs (appointment_id, created_at DESC);

ALTER TABLE imported_reviews ADD COLUMN IF NOT EXISTS author_photo TEXT;
ALTER TABLE imported_reviews ADD COLUMN IF NOT EXISTS author_url TEXT;
ALTER TABLE imported_reviews ADD COLUMN IF NOT EXISTS sync_source TEXT NOT NULL DEFAULT 'authorised-import';
ALTER TABLE imported_reviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS google_reviews_sync_meta (
  id              SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  provider        TEXT NOT NULL DEFAULT 'none',
  location_name   TEXT,
  rating          NUMERIC(3,2),
  total_reviews   INTEGER,
  synced_reviews  INTEGER NOT NULL DEFAULT 0,
  last_synced_at  TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  last_status     TEXT NOT NULL DEFAULT 'never',
  last_error      TEXT
);
