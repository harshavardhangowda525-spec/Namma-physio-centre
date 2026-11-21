# Website: setup & deployment

Next.js 15 · TypeScript · Tailwind CSS 4 · Motion · Radix Dialog · Neon Postgres · Resend

## 1. Local development
```bash
cd website
npm install
cp .env.example .env.local     # values are optional for local work
npm run dev                    # http://localhost:3000
```
Without `DATABASE_URL`, booking requests are kept **in memory** in development so the form works. Production refuses to run bookings without a database, so requests are never silently lost.

## 2. Environment variables
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical URL, e.g. `https://www.nammaphysiocentre.in` |
| `DATABASE_URL` | Neon **pooled** connection string |
| `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL`, `NOTIFY_TO_EMAIL` | New-booking email to the clinic. The sender domain must be verified in Resend. |
| `ADMIN_PASSWORD_HASH` | Run `npm run admin:hash -- "a-strong-password"` |
| `ADMIN_SESSION_SECRET` | 32+ random characters (`openssl rand -hex 32`) |
| `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACE_ID` | Live Google rating, count and reviews |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `CALENDAR_TOKEN_ENCRYPTION_KEY`, `GOOGLE_CALENDAR_ID` | Optional Google Calendar integration |

## 3. Database (Neon)
1. Create a Neon project in the Mumbai (`aws-ap-south-1`) region and copy the pooled connection string.
2. `DATABASE_URL=… npm run db:migrate` creates the `appointment_requests`, `imported_reviews` and `integration_tokens` tables (`db/schema.sql`).

This database holds **website requests only**. It is never connected to the billing app.

## 4. Booking workflow
1. The patient picks a Clinic Visit or a Home Visit and submits preferred times. The form is validated on both client and server, with a honeypot field, an origin check and rate limiting.
2. The request is stored as **Requested**, the clinic gets an email (no free-text notes are emailed), and the patient sees a reference such as `NPC-261121-AB3CD`.
3. The clinic signs in at `/admin` and confirms, reschedules, rejects or cancels. Confirming checks for overlaps with other confirmed bookings and, when connected, Google Calendar free/busy. A "Message patient" button opens WhatsApp with a pre-filled note.
4. The site never shows an appointment as confirmed. The clinic confirms by phone or WhatsApp.

## 5. Google Calendar (optional)
1. In Google Cloud, create an OAuth client (Web application) and add the redirect URI `https://<your-domain>/api/admin/calendar/callback`.
2. Enable the Google Calendar API. Scopes used: `calendar.events` and `calendar.freebusy`.
3. Set the env vars, then click **Connect Google Calendar** on `/admin`.

The refresh token is stored AES-256-GCM-encrypted on the server, and no credentials ever reach the browser. Event titles contain only "Clinic visit · reference" or "Home visit · reference". Reasons and notes are never added to the calendar.

## 6. Google reviews: what is and isn't possible
- The **Places API (New)** returns the rating, the total count and **at most 5 reviews**. The site shows those, the accurate total (e.g. 469), and a "Read all reviews on Google" link.
- The **Business Profile API** can list all reviews, but only for the verified owner's account, after Google grants API access, and its display terms must be followed. If the owner gets this access, export the reviews to JSON and run:
  `npm run reviews:import -- reviews.json --source "Business Profile export, <date>"`
  The importer rejects duplicates and empty or invalid records. It never pads the count.
- Until then, the site shows three **summaries** of the supplied review excerpts, clearly marked as not direct quotes.

## 7. Deploy (Vercel recommended)
1. Import the repository and set **Root Directory** to `website`.
2. Add the environment variables above (Production).
3. Deploy, then add the custom domain.
4. Check: `/`, `/services`, `/book`, `/reviews`, `/contact`, `/admin/login`, `/sitemap.xml`, `/robots.txt`.

## 8. Replacing placeholder content
- Photos go in `website/public/images/…`. Set the `image` path on a service, `doctor.photo`, or the `src` values in `components/gallery.tsx`.
- Clinic facts: `src/content/clinic.ts`. Services: `src/content/services.ts`. Booking options: `src/content/booking.ts`.
