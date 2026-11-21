# Namma Physio Billing (local desktop app)

**Namma Physio Billing** is a private desktop application for the clinic owner's laptop. It works fully offline, stores everything in a local SQLite database, and serves its interface only on `127.0.0.1`, so nothing else on the network or internet can reach it.

> Never deploy this app to a web host, and never open a firewall port for it.

---

## A. Building the installer (done once by the developer)

The installer must be built **on Windows**, because the SQLite driver is a native module that has to be compiled for Electron on Windows.

1. Install **Node.js 22 LTS** (https://nodejs.org) and **Git**.
2. Open *PowerShell* and run:
   ```powershell
   git clone <repository-url>
   cd Namma-physio-centre\billing-desktop
   npm install
   npm test
   npm run dist:win
   ```
3. The installer is created at `billing-desktop\release\Namma Physio Billing Setup 1.0.0.exe`.
4. Optional: add `build\icon.ico` (256×256) and uncomment `icon:` in `electron-builder.yml`, then rebuild.
5. Optional but recommended: code-sign the installer so Windows SmartScreen doesn't warn.

## B. Installing on the clinic laptop

1. Copy the `.exe` to the laptop (USB drive) and double-click it.
2. If SmartScreen appears, click **More info → Run anyway** (only for an unsigned build you produced yourself).
3. Choose the install folder and finish. A **Namma Physio Billing** shortcut appears on the desktop and in the Start menu.
4. Open the app. On first launch you'll see **Set up your clinic**: create the administrator account. There is no default password and no online recovery, so store the password safely.

Data location: `%APPDATA%\Namma Physio Billing\data\` (database `namma-physio.db` plus a `backups` folder). Uninstalling the app does **not** delete this data.

## C. First-day setup checklist (Settings)
1. **Clinic**: confirm the name, address and phone; upload the logo; add the GSTIN only if registered.
2. **Invoices & tax**: set the prefix and starting number. Tax stays **off** unless your accountant confirms services are taxable.
3. **Services & payments**: add your services and default prices. Payment methods default to Cash, UPI, Bank transfer and Card.
4. **Staff accounts**: add reception or physiotherapist users. Each signs in with a temporary password and must choose their own.
5. **Backups**:
   - Set a **backup passphrase** (12+ characters). Write it down and keep it away from the laptop. Encrypted backups cannot be recovered without it.
   - Plug in a USB/external drive and click **Add external drive / folder**. The app warns while backups exist only on the laptop's own drive.
   - Click **Back up now** and confirm it reports success for every location.

## D. Day-to-day
- **New patient** → **New invoice** → pick services, sessions and discount → tick **Record payment now** → **Create invoice**.
- On the invoice: **Print** (A4 or 80 mm receipt), **PDF** (saves a file you can share manually), **Record payment** for balances.
- Invoices can be edited until a payment is recorded. After that, an admin must **Void** it (with a reason) and issue a new one.
- **Appointments** is a local register (Requested, Confirmed, Completed, Cancelled, No-show). It does **not** sync with the website; website requests are handled on the website's `/admin` page.
- **Reports** (admin): revenue by day, week or month, outstanding with ageing, service-wise, payment methods and patient billing. Export as CSV or PDF.

## E. Roles
| Role | Can do |
|---|---|
| Admin | Everything, including reports, settings, staff, backups, voids, data export and erasure, and the audit log |
| Physiotherapist | Patients, clinical notes, appointments, create invoices |
| Reception | Patients, appointments, invoices and payments. No clinical notes, reports or settings. |

Accounts lock for 15 minutes after 5 wrong passwords. Sessions sign out after 30 minutes of inactivity.

## F. Backups & restore
- Scheduled backups run while the app is open (default daily at 20:00), to the laptop **and** every configured external folder.
- Each `.npcbak` file is compressed, AES-256-GCM encrypted (when enabled) and carries a SHA-256 checksum. Every backup is read back and verified as it's written.
- **Restore** (Settings → Backups): choose a file, enter the passphrase, click **Verify backup** (checksum plus SQLite integrity check), then confirm with your account password. The current data is backed up automatically first (`pre-restore` file).
- Test a restore occasionally, ideally on a spare computer.

## G. Privacy & data protection (DPDP Act 2023 alignment)
- Record patient consent on the patient form.
- Clinical notes are stored separately from billing and visible only to admins and physiotherapists. Every view is audit-logged.
- **Access requests**: on the patient's page, *Export patient data* produces a JSON file of everything held.
- **Erasure requests**: *Delete / anonymise* deletes patients with no invoices. Patients with invoices are anonymised: identity and clinical notes are erased, while financial records are kept for statutory accounts. A reason is required and logged.
- Settings → Privacy shows how many records are past the retention period for review.
- Use Windows BitLocker on the laptop and a Windows account password. The app adds its own login and encrypted backups.

## H. Troubleshooting
| Problem | Fix |
|---|---|
| "No passphrase set — backups cannot run" | Settings → Backups → Set passphrase |
| External drive shows "Not reachable" | Plug the drive in and keep the same drive letter |
| Forgot a staff password | An admin resets it under Staff accounts |
| Forgot the only admin password | Restore is impossible without an admin. Keep a second admin account or the password in a safe place. |
| Run without Electron (support) | `npm install`, `npm run build`, `npm start`, then open http://127.0.0.1:5180 |
