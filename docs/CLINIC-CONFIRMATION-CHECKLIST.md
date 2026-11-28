# Clinic information still requiring confirmation

Nothing below is published as verified fact until the clinic confirms it. Each item documents its current honest state and exact update location.

## 1. Practitioner & Clinic Credentials
| Item | Current state on site | Notes / Update location |
|---|---|---|
| Years of clinical experience | **Published: `18+ Years`** (confirmed by the clinic owner, Nov 2026; earlier `8+` was a transcription error) | `website/src/content/clinic.ts` → `doctor.experienceYears` / homepage stats |
| Sunil Kumar's formal degree(s) (e.g. BPT / MPT) | Shown as **"Pending clinic certificate verification"** | `website/src/content/clinic.ts` → `doctor.qualifications`. **Important discrepancy**: a third-party KiviHealth listing claims *"BPT, 20+ years experience, Reg: BLU02726ALCOC"*, which differs from the owner-confirmed `18+ years` (Nov 2026) and was therefore **not** used. Verify directly from certificates. |
| Professional council registration number (e.g. KSCPT / IAP) | Not shown (`null`) | `website/src/content/clinic.ts` → `doctor.registration` & `billing-desktop` Settings → *Verified qualification* |
| Practitioner portrait & real clinic photographs | Honest placeholder / labelled rehabilitation illustrations | `website/public/images/site/` & `website/src/content/clinic.ts` → `doctor.photo` |
| Full weekly operating hours & closed days | Partial (Saturday break + 3 PM reopen noted; `hoursConfirmed: false`) | `website/src/content/clinic.ts` → `clinic.hours` & `website/src/content/booking.ts` |

## 2. Clinical Services & Proposed Conditions Sign-Off
The website publishes **11 services** (`website/src/content/services.ts`), with **7 featured cards** on the homepage (including *Sports Injury Rehabilitation*). Unconfirmed condition items are transparently flagged in `proposedConditions`:

- [ ] **Neurological Rehabilitation (`neurological-rehabilitation`)**: Confirm clinical scope for the 6 listed conditions (*Stroke-related mobility limitations*, *Parkinson's disease-related movement difficulties*, *Neurological weakness*, *Balance and coordination difficulties*, *Gait disturbances*, *Reduced functional mobility*). No formal neurological specialist certification is claimed.
- [ ] **Post-Surgical Rehabilitation (`post-surgical-rehabilitation`)**: Confirm wording of item #1 (*"Post Total Knee Replacement (TKR) and Partial Knee Replacement (PKR) Rehabilitation"*) and retention of *Post-Orthopaedic Surgery Rehabilitation* and *Post-Ligament Repair Rehabilitation*.
- [ ] **Knee Injury Rehabilitation (`knee-injury-rehabilitation`)**: Confirm the 4 retained arthritis conditions (*Knee Osteoarthritis*, *Rheumatoid Arthritis affecting the knee*, *Degenerative Knee Joint Conditions*, *Arthritis-related Knee Pain*). Note: the previous final two items (*Knee Joint Stiffness* and *Arthritis-related Mobility Limitations*) were removed per client instructions.
- [ ] **Sports Injury Rehabilitation (`sports-injury-rehabilitation`)**: Confirm full condition list (*Sports-related ligament problems*, *Meniscus injuries*, *Muscle and tendon injuries*, *Overuse injuries*, *Sports-related joint injuries*, *Movement and mobility limitations following sports injuries*).
- [ ] **Website Insurance Information Section** (if desired on public website): Confirm reimbursement wording and documents provided before publishing any public insurance copy (never claim cashless tie-ups unless verified).

## 3. Branding & Developer Attribution Decisions
- [ ] **Clinic Logo Concept Approval**: Review the 3 original vector/PNG logo suites on `/brand-concepts` (`concept-1-kinetic-spine`, `concept-2-guided-motion`, `concept-3-vital-balance`). Live website keeps the existing mark until one concept is approved.
- [ ] **Expanded Developer Promotional Line**: Footer currently displays the discreet attribution *"Designed & Developed by Infinity Web & Apps — Websites. Mobile Apps. Digital Growth."* (`https://infinity-web-apps.vercel.app`). Set `NEXT_PUBLIC_SHOW_EXPANDED_DEV_CTA=true` only if the clinic owner approves the expanded promotional CTA.

## 4. Live Google & Gmail OAuth Authorizations
- [ ] **Gmail Appointment Notifications (`Smilewithsidhu2008@gmail.com`)**: Complete one-time Google OAuth consent on `/admin` → **Connect Gmail** so doctor approval emails and patient confirmation emails send directly from `Smilewithsidhu2008@gmail.com`.
- [ ] **Google Calendar Sync (Optional)**: Complete one-time OAuth consent on `/admin` → **Connect Google Calendar**.
- [ ] **Dynamic Google Reviews**: Complete Google Business Profile OAuth on `/admin` → **Connect Google Reviews** (full dynamic review sync) or supply `GOOGLE_PLACES_API_KEY` + `GOOGLE_PLACE_ID` (live rating, total count, and Google's 5-review Places cap).

## 5. Billing Software (`billing-desktop/`)
- [x] **Detailed Physiotherapy Bill format & ₹1,200 default session charge**: Implemented matching `Namma Physio Invoice CN - Mar 16 to May 14_Updated.docx` (37 sessions @ ₹1,200 = ₹44,400). Adjustable anytime in **Settings → Invoices & tax**.
- [ ] **Optional Clinic Stamp**: Upload transparent PNG/JPEG clinic seal in **Settings → Clinic → Clinic Stamp (Optional)** if desired on signed PDFs.
- [ ] **GST & Retention Settings**: Tax remains **off** by default; confirm with clinic accountant if GSTIN or retention period (default 7 years) needs adjustment.
- [ ] **Windows PC Pairing & External USB Backup**: Pair **Appointment Inquiries** once on the clinic PC and add an external USB backup folder + passphrase.
