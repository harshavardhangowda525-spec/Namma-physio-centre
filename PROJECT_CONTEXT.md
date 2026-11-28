# Project context: Namma Physio Centre

_Updated 2026-11-28. No secrets in this file. For the full current state and next steps, read `docs/HANDOFF.md`._

## Architecture & Strict Separation
- `website/`: public Next.js 15 + Tailwind CSS 4 + Neon Postgres clinic website. Handles clinic services, Sunil Kumar's practitioner profile, dynamic Google Reviews + auto-carousel, floating WhatsApp & phone CTAs, Gmail OAuth 2.0 appointment notifications (`Smilewithsidhu2008@gmail.com`), mobile doctor approval/reschedule/decline token pages, Google Calendar sync, and patient confirmation emails.
  - Production (`main`, synced with `feat/client-enhancements-v2` & `claude/laughing-turing-saug5v`): https://namma-physio-centre-psi.vercel.app
  - Pre-upgrade backup branch: `backup/pre-enhancements-20261127`.
- `billing-desktop/`: private offline Electron + Express + SQLite billing software bound strictly to `127.0.0.1`. Handles patient records, invoices/receipts, treatment sessions, **smartphone-compatible electronic handwritten signatures**, and the **5-minute Detailed Physiotherapy Bill** module for insurance reimbursement. Contains **zero** Gmail auth or website appointment approval controls; preserves outbound HTTPS inquiry sync (`GET /api/inquiries/sync`).
- `gh-pages` branch: isolated browser-only client demo (`VITE_DEMO_MODE=true` using fictional sample records) → https://harshavardhangowda525-spec.github.io/Namma-physio-centre/

## Completed in v2 Enhancement Suite (`feat/client-enhancements-v2`)
- **Website Medical & Brand Upgrades**: `8+ Years Clinical Experience` homepage stat; 7th homepage card (*Sports Injury Rehabilitation*) with centered grid; published *Neurological Rehabilitation*; *Evidence-Based Physiotherapy Practice* spotlight; *Intervertebral Disc Prolapse (IVDP)* under spinal rehab; global `"Ligament problems"` terminology; reordered *Knee Injury* and *Post-Surgical* condition lists; anatomically verified shoulder & neuro illustrations; expanded Sunil Kumar profile; prominent header; 3 original logo concept suites at `/brand-concepts`; floating WhatsApp & call buttons; Infinity Web & Apps attribution.
- **Dynamic Google Reviews & Carousel**: 3-tier sync (GBP OAuth + Vercel Cron every 8h → Places API New → verified DB/fallback) + accessible 6-second auto-carousel.
- **Gmail OAuth & Doctor Approval Automation**: Encrypted Gmail OAuth (`Smilewithsidhu2008@gmail.com`), SHA-256 expiring action tokens (`/appointments/manage/[token]` & `/appointments/respond/[token]`), deduplicated `email_delivery_logs`, audit trail, Calendar conflict check, and patient confirmation emails.
- **Billing Electronic Signatures & 5-Minute Detailed Bill**: SQLite v3 migration; touch/stylus/mouse `SignatureCanvasPad` with encrypted reusable storage, explicit per-document authorization checkbox, RBAC (`reception` blocked), and tamper-lock; single-screen Detailed Physiotherapy Bill builder reproducing the exact Word reference (`37 sessions @ ₹1,200 = ₹44,400`, `"Rupees Forty Four Thousand Four Hundred Only"`, multi-page repeating headers, tap calendar, completed-session import, `-R2` superseding revisions, zero duplicate ledger revenue).

## Pending External / Owner Actions
- One-time `/admin` OAuth authorizations by clinic owner for Gmail (`Smilewithsidhu2008@gmail.com`), Google Calendar, and Google Business Profile reviews.
- Client selection of logo concept, verification of Sunil Kumar's degree/registration certificates, confirmation of `proposedConditions`, and preview approval before merging `feat/client-enhancements-v2` into `main`.
