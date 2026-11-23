# Namma Physio Centre: working rules for AI coding sessions

Two separate products, no shared code:
- `website/`: public Next.js site, deployed to Vercel (project `namma-physio-centre`, team "infinity web and apps"), live at https://namma-physio-centre-psi.vercel.app. Booking data in Neon project `namma-physio-website`.
- `billing-desktop/`: private offline Electron + SQLite billing app for the clinic laptop. Never deploy it anywhere.

Active branch: `claude/laughing-turing-saug5v` (Vercel's production branch is `main`; production deploys so far were made from this branch).

## Rule 1: keep the handoff file current (session limits)
Sessions can stop without warning (usage limits, restarts). Make sure work can always be resumed in another tool (e.g. Antigravity) from GitHub alone:
- Whenever you commit, also update `docs/HANDOFF.md`: current state, what was just done, what's in progress, the exact next steps, and any open questions. Commit it together with the work, then push.
- Never leave important progress only in the chat or uncommitted on disk.
- At the end of any substantial piece of work, and whenever the user asks, give the user the **continuation prompt** from `docs/HANDOFF.md` (section "Continuation prompt"), filled in with the latest next steps.

## Rule 2: content honesty (healthcare site)
- Never invent doctor qualifications, experience, clinic history, statistics, reviews or quotes.
- Only services marked `verified: true, published: true` in `website/src/content/services.ts` appear publicly.
- Generated images are labelled illustrative. Never use a generated person as Dr. Sunil or as clinic staff.
- Unconfirmed facts are tracked in `docs/CLINIC-CONFIRMATION-CHECKLIST.md`.

## Rule 3: secrets
Never commit or echo secrets (DB URLs, admin hash/secret, API keys). They live in Vercel environment variables.

## Commands
- Website: `cd website && npm install && npm run dev` · checks: `npx tsc --noEmit && npx next lint && npx next build`
- Billing: `cd billing-desktop && npm install --include=dev && npm test && npm run build && npm start` → http://127.0.0.1:5180
