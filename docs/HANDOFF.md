# Handoff: current state & next steps

_Last updated: 2026-11-25 (Website → Billing Appointment Inquiries automatic sync + main branch production sync). Update this file whenever you commit (see `CLAUDE.md`, Rule 1)._

## Continuation prompt
Paste this into a new session (Claude Code, Antigravity, etc.) with the GitHub repo attached:

```text
Repository: harshavardhangowda525-spec/namma-physio-centre
Branch: claude/laughing-turing-saug5v (kept in sync with main for Vercel production deploys)

Before doing anything, read CLAUDE.md, docs/HANDOFF.md, docs/WEBSITE-SETUP.md and
docs/CLINIC-CONFIRMATION-CHECKLIST.md. They describe the two products (public
Next.js website in website/, private offline billing app in billing-desktop/), the
live deployment, the rules (no invented clinic facts, illustrative-image labelling,
no secrets in git), and the exact next steps.

Then continue with the "Next steps" section of docs/HANDOFF.md, starting at the
first unchecked item. Show me your plan before making changes. After each piece of
work: run the checks listed in CLAUDE.md, commit, update docs/HANDOFF.md, and push
to the same branch (and fast-forward main when deploying to production).
```

## Current state
- **Website (`website/`)**: live at https://namma-physio-centre-psi.vercel.app (Vercel project `namma-physio-centre`, functions in `sin1`, Node 22).
  - Env vars set in Vercel: `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`. `/admin` login works.
  - Neon DB `namma-physio-website` (Singapore), schema from `website/db/schema.sql` applied.
  - Exposes authenticated inquiry sync endpoints (`POST /api/inquiries/pair` and `GET /api/inquiries/sync`) backed by `appointment_requests` and `integration_tokens` (SHA-256 hashed Bearer tokens + rate limiting + duplicate-submission protection), without altering the `/book` inquiry form.
  - 10 published services (client-approved, Nov 2026): Consultation & Treatment, Back & Neck Pain, Shoulder Pain, Knee Injury, Meniscus Injury, Sports Injury, Post-Surgical, Knee Replacement, Joint Pain Management, Home Visit. Featured on home: Consultation, Back & Neck, Shoulder, Knee Injury, Post-Surgical, Home Visit.
  - "Ligament & MPFL Injury Rehabilitation" unpublished (content kept, `published: false`); MPFL removed from Dr. Sunil's areas of treatment, back/neck and shoulder added.
  - All service images are Figma-generated illustrations (`website/public/images/services/`); service cards and pop-ups show the full 3:2 image. Hero, booking cards and 4 gallery images in `website/public/images/site/`.
  - Dr. Sunil portrait and "Doctor and team" gallery photo intentionally remain placeholders until real photos are supplied.
  - Not configured yet: Resend email (`RESEND_API_KEY`, `NOTIFY_FROM_EMAIL`, `NOTIFY_TO_EMAIL`), Google Places reviews (`GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACE_ID`), Google Calendar OAuth, custom domain.
- **Billing demo (client preview)**: https://harshavardhangowda525-spec.github.io/Namma-physio-centre/ served from the `gh-pages` branch (built with `npm run build:demo` in `billing-desktop/`, output `dist-demo/`, not committed). Browser-only sandbox (`src/demo-backend.ts`, sessionStorage), 10 fictional patients, role switcher, reset, jsPDF invoice/receipt/report downloads.
- **Billing app (`billing-desktop/`)**: complete; 41 tests pass (4 test files, including `tests/inquiry-sync.test.ts`). Includes **Appointment Inquiries** in the sidebar (`src/pages/inquiries.tsx`), SQLite `appointment_inquiries` table (schema v2), encrypted sync token storage (`secretStore`), background cursor-based sync (`server/inquiry-sync.ts`) with offline tolerance, automatic catch-up on internet reconnect, duplicate prevention (`UNIQUE(reference)`), and latest-first display. `better-sqlite3` pinned to 12.4.1.
  - The owner is setting it up on Windows. Once running, open **Appointment Inquiries → Connect website** and enter the website admin password once to enable automatic synchronization.

## Next steps
- [x] Client-requested website changes: 4 services added, MPFL removed, 8 images regenerated/added, pop-up image uncropped. Deployed to production.
- [x] Home Visit image replaced again (`home-visit-physiotherapy-v3.jpg`). Deployed.
- [x] Post-Surgical Rehabilitation expanded (TJR/TKR/THR, fracture, fracture fixation, trauma, stiffness) and Knee Injury expanded with 6 arthritis conditions. Proposed items flagged via `proposedConditions` and tracked in the confirmation checklist.
- [x] Billing demo published on GitHub Pages, plus Detailed Physiotherapy Bill (insurance reimbursement PDF) added.
- [x] Merged `claude/laughing-turing-saug5v` into `main` so Vercel production auto-deploys.
- [x] Integrated Website Appointment Inquiries with Local Billing Software (`Appointment Inquiries` sidebar section, offline-safe Neon-to-SQLite cursor sync, automatic reconnect catch-up, duplicate prevention).
- [ ] Get clinic confirmation for proposed Post-Surgical (orthopaedic, ACL, ligament, arthroscopic) and knee arthritis conditions.
- [ ] Website insurance section: needs clinic-confirmed copy first (no cashless or insurer claims).
- [ ] **Logo:** 5 concepts being presented to the owner (Nov 28); owner picks one, then refine and apply to website (navbar, footer, favicon) and billing app.
- [ ] Ask the owner what "charts" change the client wanted (skipped for now at owner's request).
- [ ] Confirm the billing app runs on the owner's Windows PC and pair **Appointment Inquiries** with the live website.
- [ ] Owner to rotate the admin password (current one was shared in chat).

## Open questions for the owner
- What were the "charts" the client mentioned? (deferred)
