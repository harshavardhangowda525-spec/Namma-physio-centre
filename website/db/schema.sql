-- Namma Physio Centre — public website booking database (Neon Postgres)
-- This database holds ONLY website appointment requests and imported reviews.
-- It is completely separate from the clinic's local billing software.

CREATE TABLE IF NOT EXISTS appointment_requests (
  id            BIGSERIAL PRIMARY KEY,
  reference     TEXT NOT NULL UNIQUE,
  visit_type    TEXT NOT NULL CHECK (visit_type IN ('clinic', 'home')),
  status        TEXT NOT NULL DEFAULT 'requested'
                CHECK (status IN ('requested', 'confirmed', 'rescheduled', 'rejected', 'cancelled')),
  patient_name  TEXT NOT NULL,
  mobile        TEXT NOT NULL,
  email         TEXT,
  address       TEXT,
  locality      TEXT,
  pin_code      TEXT,
  preferred_date DATE NOT NULL,
  preferred_time TEXT NOT NULL,
  reason        TEXT,
  notes         TEXT,
  consent_at    TIMESTAMPTZ NOT NULL,
  confirmed_date DATE,
  confirmed_time TEXT,
  clinic_message TEXT,
  calendar_event_id TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS appointment_requests_status_idx ON appointment_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS imported_reviews (
  id          TEXT PRIMARY KEY,
  author      TEXT NOT NULL,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_date DATE,
  text        TEXT NOT NULL,
  source_note TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_tokens (
  provider    TEXT PRIMARY KEY,
  ciphertext  TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
