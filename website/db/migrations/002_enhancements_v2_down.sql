-- Reversible rollback migration 002_down
DROP TABLE IF EXISTS google_reviews_sync_meta;
ALTER TABLE imported_reviews DROP COLUMN IF EXISTS updated_at;
ALTER TABLE imported_reviews DROP COLUMN IF EXISTS sync_source;
ALTER TABLE imported_reviews DROP COLUMN IF EXISTS author_url;
ALTER TABLE imported_reviews DROP COLUMN IF EXISTS author_photo;

DROP TABLE IF EXISTS email_delivery_logs;
DROP TABLE IF EXISTS appointment_audit_log;
DROP TABLE IF EXISTS appointment_action_tokens;

UPDATE appointment_requests SET status = 'requested' WHERE status = 'pending_approval';
UPDATE appointment_requests SET status = 'rescheduled' WHERE status = 'reschedule_proposed';
UPDATE appointment_requests SET status = 'rejected' WHERE status = 'declined';
UPDATE appointment_requests SET status = 'confirmed' WHERE status = 'completed';

ALTER TABLE appointment_requests DROP CONSTRAINT IF EXISTS appointment_requests_status_check;
ALTER TABLE appointment_requests ADD CONSTRAINT appointment_requests_status_check
  CHECK (status IN ('requested', 'confirmed', 'rescheduled', 'rejected', 'cancelled'));

ALTER TABLE appointment_requests DROP COLUMN IF EXISTS approved_by;
ALTER TABLE appointment_requests DROP COLUMN IF EXISTS approved_at;
ALTER TABLE appointment_requests DROP COLUMN IF EXISTS duration_minutes;
ALTER TABLE appointment_requests DROP COLUMN IF EXISTS decline_reason;
ALTER TABLE appointment_requests DROP COLUMN IF EXISTS proposed_time;
ALTER TABLE appointment_requests DROP COLUMN IF EXISTS proposed_date;
ALTER TABLE appointment_requests DROP COLUMN IF EXISTS requested_service;
