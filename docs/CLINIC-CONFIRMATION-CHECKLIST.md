# Clinic information still requiring confirmation

Nothing below is published as fact until the clinic confirms it. Each item says where to update it once confirmed.

## Doctor & clinic facts
| Item | Current state on site | Update in |
|---|---|---|
| Dr. Sunil Kumar's qualifications | Shown as "To be confirmed" | `website/src/content/clinic.ts` → `doctor.qualifications` |
| Years of experience | Shown as "To be confirmed" | `doctor.experience` |
| Professional registration number (if it should be shown) | Not shown | `doctor.registration` |
| Areas of treatment beyond knee / meniscus / MPFL / post-surgical / knee replacement | Only these are listed (from reviews and supplied info) | `doctor.areasOfTreatment` |
| Clinic history, founding year, team members | Not stated anywhere | About page copy |
| Mission & care philosophy copy | **Draft**, needs client approval | `website/src/app/about/page.tsx` |
| Privacy Policy and Terms of Use | **Draft**, needs legal review | `website/src/app/privacy`, `website/src/app/terms` |

## Operating hours
- [ ] Full weekly opening hours. The only thing known is a Saturday afternoon break with reopening at 3 PM. Set `clinic.hours` and `clinic.hoursConfirmed = true`.
- [ ] Closed days. Set `closedWeekdays` in `website/src/content/booking.ts`.
- [ ] Preferred-time options for the booking form, to match real hours (`preferredTimes`).

## Contact
- [ ] Is **+91 99164 53616** on WhatsApp? The WhatsApp button is shown but `whatsappConfirmed` is `false`.
- [ ] Clinic email address (optional).
- [ ] Official social media profiles. None are shown until verified (`clinic.social`).
- [ ] Exact map pin / Google Place ID (needed for live reviews).

## Services
The website shows only the **7 services supported by supplied information**. The other 11 in the proposed catalogue are written but hidden (`verified: false, published: false` in `website/src/content/services.ts`):

Orthopaedic Physiotherapy · Sports Injury Rehabilitation · Back & Neck Pain · Shoulder Pain · Joint Pain Management · Neurological Physiotherapy · Geriatric Physiotherapy · Mobility & Balance Training · Posture & Ergonomic Guidance · Strengthening & Conditioning · Chronic Pain Rehabilitation

- [ ] Confirm which of these the clinic offers, approve the copy, then set both flags to `true`.
- [ ] Home-visit coverage area (localities / PIN codes) and charges.

## Photography (all currently labelled placeholders)
- [ ] Hero treatment photograph
- [ ] Portrait of Dr. Sunil Kumar (must be the real doctor; never a stock model)
- [ ] Reception, treatment rooms, equipment, a rehabilitation session, doctor & team
- [ ] One photo per published service (optional; icons are used until then)
- [ ] Clinic logo (the current mark is a proposal)
- [ ] Written consent from any patient who appears in a photo

## Reviews
- [ ] Google Places API key and Place ID, so the live rating, count and up to 5 review texts can load.
- [ ] If the owner wants more reviews on the site: an **authorised** export (e.g. from Google Business Profile), imported with `npm run reviews:import`.
- [ ] Permission to show the three supplied review summaries (Shalini Kumari, Sagar S. Acharya, Rino Davis). They are labelled "summary, not a direct quote".

## Billing app
- [ ] Is the clinic GST-registered? Which services, if any, are taxable? (Tax is **off** by default.)
- [ ] Invoice prefix and starting number (default `NPC/2026-27/0001`).
- [ ] Service price list for the catalogue.
- [ ] Record-retention period agreed with the clinic's accountant (default 7 years).
- [ ] An external USB drive for backups, and who keeps the backup passphrase.
