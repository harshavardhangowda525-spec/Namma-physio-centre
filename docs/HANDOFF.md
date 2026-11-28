# Handoff: current state & next steps

_Last updated: 2026-11-28 (approved "Caring Circle" logo applied; self-sliding reviews carousel with full-review pop-up). Update this file whenever you commit (see `CLAUDE.md`, Rule 1)._

## Continuation prompt
Paste this into a new session (Claude Code, Antigravity, etc.) with the GitHub repo attached:

```text
Repository: harshavardhangowda525-spec/Namma-physio-centre
Active production branch: main (kept in sync with feat/client-enhancements-v2 and claude/laughing-turing-saug5v)
Clean pre-upgrade backup branch: backup/pre-enhancements-20261127

Before doing anything, read CLAUDE.md, docs/HANDOFF.md, docs/WEBSITE-SETUP.md and
docs/CLINIC-CONFIRMATION-CHECKLIST.md. They describe the two strictly separated products
(public Next.js website in website/, private offline billing app in billing-desktop/),
the live deployments, the non-negotiable rules (no invented clinic facts,
no Gmail/approval controls inside billing-desktop, no secrets in git), and the exact
remaining client sign-off items.

Then continue with the "Next steps" section of docs/HANDOFF.md, starting at the
first unchecked item. Show me your plan before making changes. After each piece of
work: run the checks listed in CLAUDE.md, commit, update docs/HANDOFF.md, and push
to main (and keep feat/client-enhancements-v2 in sync).
```

## Current state
- **Branches**:
  - `main` (`origin/main`): live production branch (`https://namma-physio-centre-psi.vercel.app`), synced with `feat/client-enhancements-v2` and `claude/laughing-turing-saug5v`. Neon additive schema changes also auto-apply idempotently via `ensureSchema()` in `website/src/lib/db.ts`.
  - `gh-pages` (`origin/gh-pages`): live client billing demo (`https://harshavardhangowda525-spec.github.io/Namma-physio-centre/`) updated with the 5-minute Detailed Physiotherapy Bill module & smartphone handwritten signatures.
  - `backup/pre-enhancements-20261127`: untouched snapshot prior to the v2 client enhancement suite (`7ba331f`).
- **Website (`website/`)**:
  - **Medical & Service Updates**:
    - Homepage statistics 2nd column updated from `"2 — Clinic & Home"` to **`18+ Years` · `Clinical Experience`** (corrected from 8+ on Nov 28; value lives in `doctor.experienceYears`).
    - Homepage **Our Services** expanded from 6 to **7 featured cards** (added **Sports Injury Rehabilitation**) with symmetrical 4-col/6-col responsive centering.
    - **11 published services**: added and published **Neurological Rehabilitation** (`neurological-rehabilitation`, legacy slug `neurological-physiotherapy` supported) with 6 condition items flagged in `proposedConditions` and zero specialist certification claims.
    - Added prominent **Evidence-Based Physiotherapy Practice** spotlight & 6 clinical highlights in *Why Choose Namma Physiotherapy Centre?*.
    - Added **Intervertebral Disc Prolapse (IVDP)**, **Lumbar spondylosis**, and **Cervical spondylosis** to *Back and Neck Pain Physiotherapy*.
    - Global public replacement of `"ligament strains"` / `"ligament sprains"` with **`"Ligament problems"`** (0 remaining public occurrences).
    - Reordered **Knee Injury Rehabilitation** (removed final two items *Knee Joint Stiffness* and *Arthritis-related Mobility Limitations*; placed *Meniscus injuries* 1st, *Ligament problems* 2nd, *Kneecap (patellofemoral) problems* 3rd).
    - Reordered **Post-Surgical Rehabilitation** (combined fracture + trauma into *Post-fracture and trauma rehabilitation*; placed *Post Total Knee Replacement (TKR) and Partial Knee Replacement (PKR) Rehabilitation* 1st in `proposedConditions`, *Post Total Hip Replacement (THR) Rehabilitation* 2nd, *Post-fracture and trauma rehabilitation* 3rd, *Rehabilitation following fracture fixation surgery* 4th).
    - Replaced defective 3-hand `shoulder-pain-rehabilitation.jpg` with anatomically verified physiotherapy artwork and added *Post-arthroscopic shoulder rehabilitation*; generated anatomically verified `neurological-rehabilitation.jpg`; expanded *Home Visit Physiotherapy* for geriatric, neurological, and post-surgical care.
    - Expanded **Sunil Kumar** profile (`18+ Years of Clinical Physiotherapy Experience`, 3-paragraph clinical bio, 10 Areas of Clinical Care, 4 Customized Treatment Protocol pillars, honest `"Pending clinic certificate verification"` badge for unverified degrees/registrations).
  - **Branding, Contact & Reviews**:
    - Two-row desktop header (`28–30px` prominent clinic name) + responsive mobile header; preserved current live logo until client approves one of the **3 original logo concept suites** previewed at `/brand-concepts` (`public/brand-concepts/`).
    - Floating **WhatsApp** (with exact pre-filled message) & **Call Now** (`tel:+919916453616`) buttons across all public pages.
    - Footer attribution linked to `https://infinity-web-apps.vercel.app` (`NEXT_PUBLIC_SHOW_EXPANDED_DEV_CTA=false` until client approves expanded promo).
    - **Dynamic Google Reviews** (`src/lib/reviews.ts`, `/api/admin/google-reviews/{connect,callback}`, `/api/cron/reviews-sync` daily at `02:30 UTC` in `vercel.json` for Vercel Hobby compatibility, plus on-visit refresh when cache > 8h) + 6-second auto-sliding accessible carousel (`src/components/reviews.tsx`).
  - **Gmail OAuth 2.0 Appointment Notification & Doctor Approval Workflow**:
    - Reversible Neon migration `website/db/migrations/002_enhancements_v2.sql` (and `002_enhancements_v2_down.sql`) adding `appointment_action_tokens`, `appointment_audit_log`, `email_delivery_logs`, `google_reviews_sync_meta`, and expanded statuses (`pending_approval`, `confirmed`, `reschedule_proposed`, `declined`, `cancelled`, `completed`) while preserving 100% compatibility with `/api/inquiries/pair` & `/api/inquiries/sync`.
    - Gmail API OAuth 2.0 (`src/lib/gmail.ts`, `/api/admin/gmail/{connect,callback}`) targeting `Smilewithsidhu2008@gmail.com` with Resend fallback, deduplication, and retry logging.
    - Mobile-friendly signed-token doctor review page (`/appointments/manage/[token]`) & patient reschedule response page (`/appointments/respond/[token]`) + Google Calendar event sync + automated patient confirmation emails.
- **Billing Software (`billing-desktop/`)**:
  - Strictly offline-first on `127.0.0.1` with **zero** Gmail authentication or website appointment approval controls; existing Neon-to-SQLite inquiry sync preserved intact.
  - **SQLite Migration v3**: `saved_signatures` (OS-encrypted via `secretStore`), `document_signatures` (SHA-256 payload digest + version lock), `detailed_bills`, and `detailed_bill_sessions`.
  - **Smartphone-Compatible Electronic Handwritten Signatures** (`src/signature-pad.tsx`): HTML5 Pointer Events (`touch-action: none`) for smartphone finger, tablet stylus, or mouse; Undo/Clear/Preview; encrypted reusable clinician signature; mandatory per-document authorization checkbox; RBAC blocking `reception` accounts; automatic edit-lock on signed bills and invoices.
  - **5-Minute Detailed Physiotherapy Bill Module** (`src/pages/detailed-bills.tsx`, `server/routes/detailed-bills.ts`, `src/pdf.ts`):
    - Reproduces the exact layout, column proportions (`[18.47%, 15.02%, 13.89%, 35.41%, 17.21%]`), `Times` typography, date formats (`16-Mar-2026` / `16-Mar-26`), repeating multi-page grey table headers, and Indian currency wording (`"Rupees Forty Four Thousand Four Hundred Only"` for 37 sessions @ ₹1,200 = ₹44,400) of the client's Word reference.
    - Persistent multi-date tap calendar, one-click completed-session import (strictly `completed` sessions for that patient), quick inline new patient modal, auto-saved drafts, superseding revision (`-R2`) workflow, and zero duplicate accounting entries in `invoices`.
  - **Demo Sandbox (`src/demo-backend.ts`)**: updated with seeded Detailed Bill, signature endpoints, RBAC, and revision workflow (`npm run build:demo`).

## Latest changes (Nov 28, evening)
- **Logo approved by client: "Caring Circle"** (two hands circling a person in motion). Applied everywhere:
  - Website: `Logo` component in `website/src/components/ui.tsx` (header, footer white version, appointment pages), `website/public/brand/logo-mark.png` + `logo-mark-white.png`, browser-tab icon `website/src/app/icon.png`, iPhone icon `apple-icon.png` (old `icon.svg` removed).
  - Billing app: `billing-desktop/src/brand.ts` (inline PNG data URLs) used by the sidebar/login `Logo`, on-screen invoices/receipts, generated PDFs (fallback when no clinic logo uploaded in Settings), Settings preview; browser-tab icon `src/assets/favicon.png`; installer icon `billing-desktop/build/icon.png` (`electron-builder.yml`).
  - Source artwork: Figma file "Namma Physio Centre – Service Images" (key `LSijHcTjGKvIthcUZAIp54`). Raster for now; redraw as vector before print/signage. Run a reverse-image + IP India Class 44 check before registering (hands-in-circle is a common motif).
- **Branches in sync (Nov 28):** `main` fast-forwarded to `claude/laughing-turing-saug5v` (Vercel production builds from `main`). `gh-pages` billing demo republished from `npm run build:demo` with the new logo (copy `dist-demo/` + `404.html` = `index.html` + `.nojekyll`).
- **Experience corrected to 18+ years** (owner-confirmed; Antigravity had 8+). Single source: `doctor.experienceYears` / `experienceHighlight` / `experience` in `website/src/content/clinic.ts`; one literal kept in `services.ts` ("Over 18 years…", keep in sync).
- **Reviews carousel** (`website/src/components/reviews.tsx`): continuous self-sliding marquee, pauses on hover/touch/focus/Pause button, tapping a review opens a full-review pop-up (`ReviewDialog`, also used on the /reviews list). Reduced-motion users get a swipeable row.
- **All 469 Google reviews:** only via the official Business Profile API (already built: `/api/admin/google-reviews/connect`). Needs: Google Cloud project with Business Profile APIs access approved, `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `OAUTH_TOKEN_ENCRYPTION_KEY`, `CRON_SECRET` in Vercel, then the clinic owner clicks Connect in /admin. Never scrape or copy reviews from Google Maps.

## Next steps
- [x] Create clean backup branch `backup/pre-enhancements-20261127` and preview branch `feat/client-enhancements-v2`.
- [x] Implement all Part B–E website medical content, practitioner profile, header, 3 logo concept suites, floating WhatsApp/Call CTAs, and footer attribution.
- [x] Implement Part F dynamic Google Reviews architecture + 6-second auto-sliding carousel.
- [x] Implement Part G Gmail OAuth 2.0 appointment notifications, mobile doctor approval/reschedule/decline token pages, Google Calendar sync, and patient confirmation emails.
- [x] Implement Part H–J electronic handwritten signatures + 5-minute Detailed Physiotherapy Bill module + automated tests across `billing-desktop/`.
- [x] Push & synchronize `main` (Vercel production), `claude/laughing-turing-saug5v`, `feat/client-enhancements-v2`, and `gh-pages` (GitHub Pages live billing demo).
- [ ] **Environment Variables for OAuth & Cron (Vercel)**: Configure `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `CALENDAR_TOKEN_ENCRYPTION_KEY`, `GMAIL_NOTIFICATION_EMAIL=Smilewithsidhu2008@gmail.com`, `APPOINTMENT_ACTION_TOKEN_SECRET`, and `CRON_SECRET` in Vercel (note: additive Neon v2 tables/columns are created automatically via `ensureSchema()` or `website/db/migrations/002_enhancements_v2.sql`).
- [ ] **One-Time Clinic Owner OAuth Authorizations** on `/admin`:
  1. Click **Connect Gmail (`Smilewithsidhu2008@gmail.com`)** to authorize automated doctor notifications & patient confirmation emails.
  2. Click **Connect Google Calendar** (optional) to enable automatic slot clash checks & calendar events.
  3. Click **Connect Google Business Profile** (or configure `GOOGLE_PLACES_API_KEY` + `GOOGLE_PLACE_ID`) to activate live dynamic Google Reviews synchronization.
- [ ] **Client Design & Clinical Sign-Offs**:
  1. Choose one of the 3 logo concepts on `/brand-concepts` (or keep current logo).
  2. Confirm whether to enable expanded Infinity Web & Apps footer CTA (`NEXT_PUBLIC_SHOW_EXPANDED_DEV_CTA=true`).
  3. Confirm Sunil Kumar's formal degree & registration number from official certificates (do **not** use unverified KiviHealth directory listing showing `20+ years`).
  4. Confirm proposed conditions in Neurological Rehabilitation, Post-Surgical Rehabilitation (combined TKR/PKR wording), and Knee Injury Rehabilitation.
