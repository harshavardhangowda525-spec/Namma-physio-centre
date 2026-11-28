# Project context: Namma Physio Centre

_Updated 2026-11-25. No secrets in this file. For the full current state and next steps, read `docs/HANDOFF.md`._

## Architecture
- `website/`: public Next.js 15 + Tailwind CSS 4 + Neon Postgres site. Deployed on Vercel (`main` production branch, synced with `claude/laughing-turing-saug5v`) → https://namma-physio-centre-psi.vercel.app
- `billing-desktop/`: private offline Electron + Express + SQLite billing app, bound to 127.0.0.1. Pulls website appointment inquiries over HTTPS (`GET /api/inquiries/sync`) using an OS-encrypted Bearer token paired via `POST /api/inquiries/pair`.
- `gh-pages` branch: static client demo of the billing UI (`VITE_DEMO_MODE=true`, browser-only fake backend) → https://harshavardhangowda525-spec.github.io/Namma-physio-centre/

## Done
- Post-Surgical Rehabilitation: new description and 11 conditions; 4 of them are flagged as proposed (`proposedConditions` in `website/src/content/services.ts`). Live on Vercel production.
- Knee Injury Rehabilitation: kept the 4 approved conditions and added 6 arthritis conditions (proposed, pending confirmation). Live on Vercel production.
- Service modal shows long condition lists in 2 columns, with a footnote when proposed items exist.
- Billing: jsPDF invoice/receipt/report downloads, payment history report, session tracker, mobile layout, demo mode with role switcher and reset, plus demo tests.
- Insurance-reimbursement "Detailed Physiotherapy Bill" PDF (session-wise), matching the client's sample document; generated from the patient profile.
- Website → Billing Appointment Inquiries integration: unmodified `/book` inquiry form stores inquiries in Neon Postgres; `billing-desktop` adds **Appointment Inquiries** in the sidebar (`src/pages/inquiries.tsx`), SQLite v2 migration (`appointment_inquiries`), automatic cursor-based sync (`server/inquiry-sync.ts`), offline resilience with instant catch-up on reconnect, duplicate prevention (`UNIQUE(reference)`), and latest-first ordering. Verified with 41 automated tests + live Playwright E2E sync test.

## Decisions
- Proposed medical content is shown but flagged and tracked in `docs/CLINIC-CONFIRMATION-CHECKLIST.md` until the clinic confirms it.
- Sync uses outbound HTTPS cursor-based polling + reconnect triggers from `127.0.0.1` (plus optional signed local webhook), requiring zero paid subscriptions and working cleanly behind clinic NAT/firewalls and across offline periods.
- Sync tokens are stored SHA-256 hashed in `integration_tokens` on the website and encrypted via `secretStore` on the billing PC.

## Pending
- Website insurance section: needs clinic-confirmed copy. The client's document was only a bill format, which is now implemented in billing as the "Detailed bill (insurance)" PDF.
- Clinic confirmation of the proposed conditions.
- Owner's Windows install of the billing app and one-time pairing of Appointment Inquiries; the "charts" change request.

## Platform note
Antigravity's model routing and context summarization are platform-controlled and cannot be changed from inside the agent.
