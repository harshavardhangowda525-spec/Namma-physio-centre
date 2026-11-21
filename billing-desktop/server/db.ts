import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type DB = Database.Database;

/**
 * Schema migrations. Append new entries; never edit an applied migration.
 * Money columns are INTEGER paise. Dates are ISO strings (YYYY-MM-DD) and
 * timestamps are ISO 8601 UTC.
 */
const MIGRATIONS: string[] = [
  /* 1 — initial schema */ `
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','physiotherapist','reception')),
    active INTEGER NOT NULL DEFAULT 1,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE patients (
    id INTEGER PRIMARY KEY,
    patient_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    gender TEXT,
    date_of_birth TEXT,
    address TEXT,
    emergency_contact TEXT,
    admin_notes TEXT,
    consent_recorded_at TEXT,
    anonymised_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX patients_name_idx ON patients (name COLLATE NOCASE);
  CREATE INDEX patients_phone_idx ON patients (phone);

  -- Clinical notes are kept apart from billing data and restricted by role.
  CREATE TABLE clinical_notes (
    id INTEGER PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    author_id INTEGER REFERENCES users(id),
    note TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE services (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    default_price INTEGER NOT NULL DEFAULT 0,
    taxable INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE invoices (
    id INTEGER PRIMARY KEY,
    invoice_no TEXT NOT NULL UNIQUE,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    invoice_date TEXT NOT NULL,
    subtotal INTEGER NOT NULL,
    discount_total INTEGER NOT NULL,
    tax_total INTEGER NOT NULL,
    total INTEGER NOT NULL,
    paid INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('unpaid','partial','paid','void')),
    notes TEXT,
    void_reason TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX invoices_patient_idx ON invoices (patient_id);
  CREATE INDEX invoices_date_idx ON invoices (invoice_date);

  CREATE TABLE invoice_items (
    id INTEGER PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    service_id INTEGER REFERENCES services(id),
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price INTEGER NOT NULL,
    discount INTEGER NOT NULL,
    tax_rate_bp INTEGER NOT NULL,
    tax INTEGER NOT NULL,
    total INTEGER NOT NULL
  );

  CREATE TABLE payments (
    id INTEGER PRIMARY KEY,
    receipt_no TEXT NOT NULL UNIQUE,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id),
    amount INTEGER NOT NULL CHECK (amount > 0),
    method TEXT NOT NULL,
    reference TEXT,
    paid_on TEXT NOT NULL,
    received_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX payments_date_idx ON payments (paid_on);
  CREATE INDEX payments_invoice_idx ON payments (invoice_id);

  CREATE TABLE appointments (
    id INTEGER PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    visit_type TEXT NOT NULL CHECK (visit_type IN ('clinic','home')),
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    physiotherapist TEXT,
    status TEXT NOT NULL CHECK (status IN ('requested','confirmed','completed','cancelled','no_show')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX appointments_date_idx ON appointments (date, time);

  CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY,
    at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    user_id INTEGER,
    username TEXT,
    action TEXT NOT NULL,
    entity TEXT,
    entity_id TEXT,
    details TEXT
  );
  CREATE INDEX audit_at_idx ON audit_log (at);

  CREATE TABLE backup_log (
    id INTEGER PRIMARY KEY,
    at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    kind TEXT NOT NULL,
    destination TEXT,
    file TEXT,
    size INTEGER,
    sha256 TEXT,
    encrypted INTEGER NOT NULL DEFAULT 0,
    ok INTEGER NOT NULL,
    message TEXT
  );
  `,
];

export const EXPECTED_TABLES = ["settings", "users", "patients", "invoices", "invoice_items", "payments", "appointments", "audit_log"];

export function openDatabase(file: string): DB {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  return db;
}

export function migrate(db: DB) {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}

export const nowIso = () => new Date().toISOString();

/** Local calendar date (YYYY-MM-DD) in the clinic's timezone. */
export function today(tz = "Asia/Kolkata") {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}
