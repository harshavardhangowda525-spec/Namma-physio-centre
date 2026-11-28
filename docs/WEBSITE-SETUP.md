# Website: setup & deployment

Next.js 15 · TypeScript · Tailwind CSS 4 · Motion · Radix Dialog · Neon Postgres · Gmail OAuth 2.0 / Resend

## 0. Current deployment & branches
| | |
|---|---|
| Live production (`main`) | https://namma-physio-centre-psi.vercel.app |
| Preview branch | `feat/client-enhancements-v2` (deploy to Vercel Preview first; merge to `main` only after client approval) |
| Clean backup branch | `backup/pre-enhancements-20261127` |
| Vercel project | `namma-physio-centre` (root directory `website/`, Singapore `sin1`, Node 22) |
| Database | Neon project `namma-physio-website` (`aws-ap-southeast-1`) |

## 1. Local development
```bash
cd website
npm install
cp .env.example .env.local     # values are optional for local work
npm run dev                    # http://localhost:3000
```
Without `DATABASE_URL`, booking requests and action tokens run safely **in memory** during local development so the full booking + doctor approval flow can be tested offline. Production requires `DATABASE_URL`.

## 2. Environment variables (`website/.env.example`)
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical public URL, e.g. `https://namma-physio-centre-psi.vercel.app` |
| `DATABASE_URL` | Neon **pooled** Postgres connection string |
| `ADMIN_PASSWORD_HASH` | Generate via `npm run admin:hash -- "your-strong-password"` |
| `ADMIN_SESSION_SECRET` | 32+ random hex chars (`openssl rand -hex 32`) |
| `APPOINTMENT_ACTION_TOKEN_SECRET` | Secret for signing expiring doctor/patient action links (falls back to `ADMIN_SESSION_SECRET` if unset) |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | Shared Google Cloud Web OAuth 2.0 client for Gmail notifications, Google Calendar, and Google Business Profile reviews |
| `CALENDAR_TOKEN_ENCRYPTION_KEY` | 64 hex chars (`openssl rand -hex 32`) used to AES-256-GCM encrypt Gmail, Calendar, and GBP refresh tokens at rest in Neon |
| `GMAIL_NOTIFICATION_EMAIL` | Target doctor Gmail inbox (`Smilewithsidhu2008@gmail.com`) |
| `GOOGLE_CALENDAR_ID` | Calendar ID (`primary` by default) |
| `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACE_ID` | Places API (New) fallback for live rating, total review count, and latest 5 reviews |
| `GOOGLE_GBP_ACCOUNT_ID`, `GOOGLE_GBP_LOCATION_ID` | Optional explicit Google Business Profile IDs for full dynamic review sync |
| `CRON_SECRET` | Bearer secret authenticating Vercel Cron (`/api/cron/reviews-sync`, scheduled `0 */8 * * *` in `vercel.json`) |
| `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL`, `NOTIFY_TO_EMAIL` | Optional transactional email fallback when Gmail OAuth is not yet connected |
| `NEXT_PUBLIC_SHOW_EXPANDED_DEV_CTA` | Keep `false` unless the clinic owner approves the expanded Infinity Web & Apps footer CTA |

## 3. Database schema & reversible migrations (Neon)
- Full fresh schema: `website/db/schema.sql` (`DATABASE_URL=… npm run db:migrate`).
- Incremental upgrade for existing production/staging databases:
  - Apply: `psql "$DATABASE_URL" -f db/migrations/002_enhancements_v2.sql`
  - Rollback (if ever needed): `psql "$DATABASE_URL" -f db/migrations/002_enhancements_v2_down.sql`
- Preserves existing `appointment_requests`, `imported_reviews`, and `integration_tokens` records and keeps `POST /api/inquiries/pair` + `GET /api/inquiries/sync` 100% compatible with `billing-desktop/`.

## 4. Gmail OAuth 2.0 & Doctor Appointment Approval Workflow
1. **Patient submits `/book` (or homepage enquiry)**:
   - Validated on client and server (Indian phone validation, optional patient email for confirmation, honeypot, origin check, rate limiting, duplicate submission guard).
   - Stored as `pending_approval` (never auto-confirmed).
2. **Instant Doctor Notification (`Smilewithsidhu2008@gmail.com`)**:
   - Sent via Gmail API OAuth 2.0 (`src/lib/gmail.ts`, fallback to Resend if configured) with deduplication and retry logging in `email_delivery_logs`.
   - Contains structured patient & slot details, one-tap **Call Patient** / **WhatsApp** links, and secure signed links to `/appointments/manage/[token]` (72-hour expiry, SHA-256 hashed in `appointment_action_tokens`).
3. **Mobile-Friendly Doctor Action Page (`/appointments/manage/[token]`)**:
   - Doctor can **Approve & Confirm**, **Propose New Date/Time**, or **Decline** directly from a smartphone without opening `billing-desktop/` or logging into `/admin` (also manageable from `/admin`).
   - Checks for overlapping confirmed appointments and Google Calendar free/busy conflicts.
4. **Patient Confirmation / Reschedule Loop**:
   - On approval: creates/updates Google Calendar event (if connected) and emails patient confirmation (if patient email was provided) + provides 1-tap WhatsApp confirmation link.
   - On reschedule proposal: emails patient a signed `/appointments/respond/[token]` link where the patient can accept the new slot, request another time, or cancel.

### Connecting Gmail OAuth 2.0 in Google Cloud
1. In Google Cloud Console → **APIs & Services**, enable **Gmail API**, **Google Calendar API**, and (if approved) **My Business Account Management API** / **Google My Business API**.
2. Under **Credentials → OAuth 2.0 Client IDs (Web application)**, add authorized redirect URIs:
   - `https://<your-domain>/api/admin/gmail/callback`
   - `https://<your-domain>/api/admin/calendar/callback`
   - `https://<your-domain>/api/admin/google-reviews/callback`
3. Sign in to `/admin` and click **Connect Gmail (`Smilewithsidhu2008@gmail.com`)**. Refresh tokens are stored AES-256-GCM encrypted in `integration_tokens`.

## 5. Dynamic Google Reviews Synchronization
- **Tier 1 — Google Business Profile OAuth (`/api/admin/google-reviews/connect`)**: Syncs all authorized clinic reviews into `imported_reviews` (`is_verified_quote = TRUE`) and refreshes automatically every 8 hours via `/api/cron/reviews-sync` (`vercel.json`).
- **Tier 2 — Google Places API (New)**: Fetches live rating, total review count, and up to 5 Google-selected reviews (`revalidate: 3600`, cached in `google_reviews_sync_meta`). Note: Google's Places API enforces a platform hard cap of 5 review texts per Place.
- **Tier 3 — Offline Fallback**: Displays last synced database reviews or honest labelled summaries of clinic-supplied excerpts without fabricating quotes or counts.
