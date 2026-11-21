# Namma Physio Centre

Two independent products for **Namma Physio Centre**, JP Nagar, Bengaluru. Commissioned by Infinity Web & Apps.

| Folder | Product | Runs on | Data |
|---|---|---|---|
| [`website/`](website) | Public website with services, reviews and appointment requests | Any Node.js host (e.g. Vercel) | Neon Postgres: website booking requests only |
| [`billing-desktop/`](billing-desktop) | Private billing and clinic-management app | The clinic owner's Windows laptop, offline | Local SQLite file on that laptop |

The two projects share **no code, no database and no network connection**. The billing app listens on `127.0.0.1` only and must never be deployed to a public host.

## Documentation

- [Website setup & deployment](docs/WEBSITE-SETUP.md)
- [Billing app: Windows installation & operation](docs/BILLING-WINDOWS-INSTALL.md)
- [Clinic information still requiring confirmation](docs/CLINIC-CONFIRMATION-CHECKLIST.md)

## Quick start (developers)

```bash
cd website && npm install && npm run dev            # http://localhost:3000
cd billing-desktop && npm install && npm run dev    # http://127.0.0.1:5173
cd billing-desktop && npm test                      # billing maths, API, security, backup tests
```
