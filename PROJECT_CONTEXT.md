# Project context: Namma Physio Centre

_Recovery snapshot, 2026-11-24. No secrets in this file. For the full current state and next steps, read `docs/HANDOFF.md`._

## Architecture
- `website/`: public Next.js 15 + Tailwind CSS 4 + Neon Postgres site. Deployed on Vercel from branch `claude/laughing-turing-saug5v` → https://namma-physio-centre-psi.vercel.app
- `billing-desktop/`: private offline Electron + Express + SQLite billing app, bound to 127.0.0.1. Shares no code or database with the website.
- `gh-pages` branch: static client demo of the billing UI (`VITE_DEMO_MODE=true`, browser-only fake backend) → https://harshavardhangowda525-spec.github.io/Namma-physio-centre/

## Done
- Post-Surgical Rehabilitation: new description and 11 conditions; 4 of them are flagged as proposed (`proposedConditions` in `website/src/content/services.ts`).
- Knee Injury Rehabilitation: kept the 4 approved conditions and added 6 arthritis conditions (proposed, pending confirmation).
- Service modal shows long condition lists in 2 columns, with a footnote when proposed items exist.
- Billing: jsPDF invoice/receipt/report downloads, payment history report, session tracker, mobile layout, demo mode with role switcher and reset, plus demo tests.
- Insurance-reimbursement "Detailed Physiotherapy Bill" PDF (session-wise), matching the client's sample document; generated from the patient profile.

## Decisions
- Proposed medical content is shown but flagged and tracked in `docs/CLINIC-CONFIRMATION-CHECKLIST.md` until the clinic confirms it.
- The demo build uses HashRouter and `base: "./"`, so it works under the GitHub Pages subpath. It is marked `noindex`.

## Pending
- Website insurance section: needs clinic-confirmed copy. The client's document was only a bill format, which is now implemented in billing as the "Detailed bill (insurance)" PDF.
- Clinic confirmation of the proposed conditions.
- Owner's Windows install of the billing app; the "charts" change request.

## Platform note
Antigravity's model routing and context summarization are platform-controlled and cannot be changed from inside the agent.
