# Handoff: current state & next steps

_Last updated: 2026-11-23 (home visit image replaced again per client). Update this file whenever you commit (see `CLAUDE.md`, Rule 1)._

## Continuation prompt
Paste this into a new session (Claude Code, Antigravity, etc.) with the GitHub repo attached:

```text
Repository: harshavardhangowda525-spec/namma-physio-centre
Branch: claude/laughing-turing-saug5v (check out this branch; main is behind)

Before doing anything, read CLAUDE.md, docs/HANDOFF.md, docs/WEBSITE-SETUP.md and
docs/CLINIC-CONFIRMATION-CHECKLIST.md. They describe the two products (public
Next.js website in website/, private offline billing app in billing-desktop/), the
live deployment, the rules (no invented clinic facts, illustrative-image labelling,
no secrets in git), and the exact next steps.

Then continue with the "Next steps" section of docs/HANDOFF.md, starting at the
first unchecked item. Show me your plan before making changes. After each piece of
work: run the checks listed in CLAUDE.md, commit, update docs/HANDOFF.md, and push
to the same branch.
```

## Current state
- **Website (`website/`)**: live at https://namma-physio-centre-psi.vercel.app (Vercel project `namma-physio-centre`, functions in `sin1`, Node 22).
  - Env vars set in Vercel: `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`. `/admin` login works.
  - Neon DB `namma-physio-website` (Singapore), schema from `website/db/schema.sql` applied.
  - 10 published services (client-approved, Nov 2026): Consultation & Treatment, Back & Neck Pain, Shoulder Pain, Knee Injury, Meniscus Injury, Sports Injury, Post-Surgical, Knee Replacement, Joint Pain Management, Home Visit. Featured on home: Consultation, Back & Neck, Shoulder, Knee Injury, Post-Surgical, Home Visit.
  - "Ligament & MPFL Injury Rehabilitation" unpublished (content kept, `published: false`); MPFL removed from Dr. Sunil's areas of treatment, back/neck and shoulder added.
  - All service images are Figma-generated illustrations (`website/public/images/services/`); service cards and pop-ups show the full 3:2 image. Hero, booking cards and 4 gallery images in `website/public/images/site/`.
  - Dr. Sunil portrait and "Doctor and team" gallery photo intentionally remain placeholders until real photos are supplied.
  - Not configured yet: Resend email (`RESEND_API_KEY`, `NOTIFY_FROM_EMAIL`, `NOTIFY_TO_EMAIL`), Google Places reviews (`GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACE_ID`), Google Calendar OAuth, custom domain.
- **Billing app (`billing-desktop/`)**: complete; 35 tests pass. `better-sqlite3` pinned to 12.4.1 (prebuilt Windows binaries for Node 22/24 and Electron 37).
  - The owner is setting it up on Windows. Last blocker: `npm run build` said `'tsc' is not recognized`, meaning dev dependencies weren't installed. Advised: `set NODE_ENV=` then `npm install --include=dev`, then `npm run build`, then `npm start`. Not yet confirmed working.

## Next steps
- [x] Client-requested website changes: 4 services added, MPFL removed, 8 images regenerated/added, pop-up image uncropped. Deployed to production.
- [x] Home Visit image replaced again (client found it irrelevant): now `home-visit-physiotherapy-v3.jpg`, a physiotherapist supporting an elderly patient's sit-to-stand from his own armchair at home. New filename avoids stale image caches; an alternative (walking-frame in home hallway) is in the Figma file. Deployed.
- [ ] Ask the owner what "charts" change the client wanted (skipped for now at owner's request).
- [ ] Confirm the billing app runs on the owner's Windows PC.
- [ ] Owner to rotate the admin password (current one was shared in chat).
- [ ] Merge `claude/laughing-turing-saug5v` into `main` so pushes auto-deploy.

## Open questions for the owner
- What were the "charts" the client mentioned? (deferred)
