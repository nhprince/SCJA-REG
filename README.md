# Sohrawardi College Journalist Association (SCJA) — Member Registration

সোহরাওয়ার্দী কলেজ সাংবাদিক সমিতি · Govt. Shaheed Suhrawardy College

A full-stack member registration system: a mobile-first registration form for
HSC and Honours students, and a password-protected admin panel to review, search, edit,
export, and manage submissions — all running on **Cloudflare Pages +
Functions + D1**, on a single origin, with no external backend.

## What's included

- **Public registration form** (`/`) — a 6-step mobile-friendly wizard
  collecting personal, academic, contact/guardian, and additional info, plus
  a profile photo and an ID card / birth certificate photo. Photos are
  resized and compressed in the browser before upload.
- **Admin panel** (`/admin.html`) — password-protected, with:
  - Dashboard stats (total members, new this week, department count, top
    interest)
  - A department breakdown chart
  - Search, department filter, and sorting
  - View, edit, and delete individual members
  - CSV export of all data
- **Backend** — Cloudflare Pages Functions under `/api/*`, same origin as the
  frontend, backed by a Cloudflare D1 (SQLite) database. No separate server,
  no third-party backend host.

## Tech stack

| Layer     | Choice                                             |
|-----------|-----------------------------------------------------|
| Frontend  | Vanilla HTML/CSS/JS (no framework, fast & simple)   |
| Backend   | Cloudflare Pages Functions (`/functions` directory) |
| Database  | Cloudflare D1 (SQLite)                              |
| Auth      | Signed HMAC session cookie (no external auth service) |
| Hosting   | Cloudflare Pages                                    |

## Project structure

```
├── public/                    Static frontend (served as-is)
│   ├── index.html              Registration form
│   ├── admin.html               Admin panel
│   ├── css/
│   │   ├── style.css            Shared design tokens & components
│   │   ├── form.css              Registration form styles
│   │   └── admin.css              Admin panel styles
│   └── js/
│       ├── form.js               Registration form logic
│       └── admin.js                Admin panel logic
├── functions/                 Cloudflare Pages Functions (the "backend")
│   ├── api/
│   │   ├── register.js          POST — public registration
│   │   └── admin/
│   │       ├── login.js           POST — admin login
│   │       ├── logout.js          POST — admin logout
│   │       ├── check.js           GET  — session check
│   │       ├── stats.js           GET  — dashboard stats
│   │       ├── export.js          GET  — CSV export
│   │       └── members/
│   │           ├── index.js       GET  — list/search/filter/sort
│   │           └── [id].js        GET/PUT/DELETE — single member
│   └── _utils/
│       └── auth.js               Shared session/auth helpers
├── schema.sql                 D1 database schema
├── wrangler.toml               Cloudflare configuration
└── package.json
```

## 1. Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is enough)
- [Node.js](https://nodejs.org/) 18+ installed
- The Wrangler CLI (installed automatically via `npx`, or `npm i -g wrangler`)

## 2. Install dependencies

```bash
cd scja-registration
npm install
npx wrangler login
```

This opens a browser window to authenticate Wrangler with your Cloudflare account.

## 3. Create the D1 database

```bash
npx wrangler d1 create scja_reg_db
```

This prints something like:

```
[[d1_databases]]
binding = "DB"
database_name = "scja_reg_db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Copy the `database_id` value into `wrangler.toml`, replacing
`REPLACE_WITH_YOUR_DATABASE_ID`.

## 4. Initialize the database schema

```bash
# Creates the table in your remote (production) database
npx wrangler d1 execute scja_reg_db --remote --file=./schema.sql

# Also set up a local copy for `wrangler pages dev`
npx wrangler d1 execute scja_reg_db --local --file=./schema.sql
```

## 5. Set your admin secrets

Two secrets protect the admin panel:

- `ADMIN_PASSWORD` — the password you'll use to log in to `/admin.html`
- `SESSION_SECRET` — a random string used to sign login sessions (not a
  password you type in; just needs to be long and random)

Generate a random secret:

```bash
openssl rand -hex 32
```

Then set both secrets:

```bash
npx wrangler pages secret put ADMIN_PASSWORD
npx wrangler pages secret put SESSION_SECRET
```

Wrangler will prompt you to paste the value for each. **Do not commit these
to git or hardcode them anywhere** — they only live in Cloudflare's
encrypted secret storage.

## 6. Run it locally

```bash
npm run dev
```

This starts `wrangler pages dev`, serving the site with the D1 binding and
your functions, at `http://localhost:8788` by default. Note: local secrets
aren't picked up automatically by `wrangler pages dev` — pass them with a
`.dev.vars` file for local testing:

```
# .dev.vars (do not commit this file)
ADMIN_PASSWORD=your-local-test-password
SESSION_SECRET=any-long-random-string-for-local-testing
```

## 7. Deploy

### Option A — Deploy directly with Wrangler (simplest)

```bash
npm run deploy
```

This uploads `public/` and `functions/` straight to Cloudflare Pages, using
the D1 binding and secrets you've already configured.

### Option B — Connect a GitHub repo (auto-deploy on push)

1. Push this project to a GitHub repository.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect
   to Git**, and select your repo.
3. Build settings:
   - Build command: *(leave empty)*
   - Build output directory: `public`
4. After the first deploy, go to your Pages project → **Settings →
   Functions → D1 database bindings**, and add a binding named `DB` pointing
   to `scja_reg_db`.
5. Go to **Settings → Environment variables**, and add `ADMIN_PASSWORD` and
   `SESSION_SECRET` as **encrypted** variables (for both Production and
   Preview environments, if you use previews).
6. Redeploy (push a commit, or hit "Retry deployment") so the new bindings
   and variables take effect.

Either way, your site will be live at `https://<project-name>.pages.dev`,
and you can attach a custom domain in the Pages dashboard.

## Using the admin panel

Go to `https://your-site.pages.dev/admin.html`, and log in with the
`ADMIN_PASSWORD` you set. From there you can:

- See live stats and a department breakdown chart
- Search by name, student ID, email, or phone
- Filter by department, and sort by name/date/department
- Click the eye icon to view full details (including both photos)
- Click the pencil icon to edit any field
- Click the trash icon to remove a registration
- Click **Export CSV** to download all data as a spreadsheet (photos are
  excluded from the CSV since they're large binary data — view them
  individually in the admin panel instead)

The admin session lasts 24 hours, then you'll need to log in again.

## Security notes

- The admin API routes all check a signed, expiring session cookie
  server-side — the password check happens in the Function, never in the
  browser, so it can't be bypassed by editing client-side JavaScript.
- The session cookie is `HttpOnly`, `Secure`, and `SameSite=Strict`.
- The registration form includes a hidden honeypot field to deter basic
  spam bots.
- Photos are stored as compressed base64 images directly in D1 — simple and
  needs no extra setup, but keep an eye on total registrations if you expect
  many thousands of members with photos (D1's free tier includes 5 GB of
  storage, which comfortably fits several thousand compressed photos).

## Customizing

- **Colors & fonts**: edit the CSS variables at the top of
  `public/css/style.css` (`--color-primary` is the logo green, `--color-accent` is the logo red) and the
  Google Fonts import at the top of the same file.
- **Form fields**: add/remove fields in `public/index.html`, mirror the
  change in `public/js/form.js` (`collectData()`), `functions/api/register.js`,
  and `schema.sql` (you'll need to re-run the schema against your database,
  or issue an `ALTER TABLE` migration if you already have data).
- **Groups & departments**: HSC groups and the Honours department list live at
  the top of `public/js/form.js` (`HSC_GROUPS` and `HONOURS_DEPARTMENTS`). The
  department dropdown automatically switches between them depending on the
  academic year the student picks.
- **Association name / branding**: search for "Sohrawardi College Journalist
  Association" in `public/index.html`, `public/admin.html`,
  `public/manifest.webmanifest` and `functions/_utils/email.js`.

## Troubleshooting

- **"Admin login isn't configured yet"** — you haven't set `ADMIN_PASSWORD`
  and `SESSION_SECRET` as secrets/environment variables yet (step 5, or the
  dashboard steps in Option B).
- **Registrations aren't saving** — check that the D1 binding name is
  exactly `DB` and that you ran `schema.sql` against the *remote* database
  (`--remote`, not just `--local`).
- **Changes to `wrangler.toml` D1 binding not applying on a Git-connected
  project** — Git-connected Pages projects manage bindings from the
  dashboard (Settings → Functions), not from `wrangler.toml`; set it there
  instead.

---

## New: photo editing, CSV photo links, and confirmation emails

Four additions to the admin panel:

1. **Change a member's photo** — in the edit modal, both the profile photo
   and the ID card / birth certificate photo now have a "Change Photo"
   button. Pick a new image and it's compressed client-side (same as the
   registration form) before saving — the old photo is only replaced if you
   actually pick a new one.
2. **Photo links in the CSV export** — `profile_photo_url` and
   `id_document_photo_url` columns are appended to the exported CSV. These
   link to `/api/admin/members/:id/photo?field=...`, which serves the
   actual image. **These links only work while logged into the admin
   panel** (they check the same session cookie as everything else) — opening
   one in a private/incognito tab or after logging out will show an
   "Unauthorized" error, which is expected.
3. **Confirmation email** — click the envelope icon next to a member (or
   "Send confirmation email" in the view modal) to email them your exact
   confirmation template. A toast reports whether it sent successfully.
   Sent members get a "Confirmed" badge; you can resend at any time.
4. **Bulk confirm** — tick the checkbox on any rows (or click "Select all
   pending" to grab every unconfirmed member in the current view), then
   "Confirm selected" to email all of them in one action. This is meant for
   confirming a backlog of applicants without clicking one at a time.

Emails are sent via **Resend** (`https://resend.com`), not a Cloudflare
binding — Cloudflare's own email-sending feature currently requires a
Workers Paid plan to send to arbitrary (unverified) recipient addresses,
which doesn't fit "send to whichever students applied." Resend's free tier
covers this comfortably: **3,000 emails/month, capped at 100/day.**

### 1. Apply the database migration

Your live database already has real registrations, so **do not re-run
`schema.sql`** — it starts with `DROP TABLE IF EXISTS members` and would
delete everyone who's already registered. Instead, run the new migration,
which only adds two columns:

```bash
npx wrangler d1 execute scja_reg_db --remote --file=./migrations/0001_add_confirmation_status.sql
npx wrangler d1 execute scja_reg_db --local  --file=./migrations/0001_add_confirmation_status.sql
```

### 2. Set up Resend (one-time, ~10 minutes)

**Step 1 — Create a Resend account.**
Go to [resend.com](https://resend.com) and sign up (free).

**Step 2 — Add and verify your sending domain.**
In the Resend dashboard → **Domains** → **Add Domain** → enter
`stuckstudio.com` (or a subdomain you're comfortable adding DNS records to,
e.g. `mail.stuckstudio.com`, if you'd rather not touch the root domain's
records). Resend gives you a few DNS records (SPF, DKIM, and a tracking
CNAME) to add wherever `stuckstudio.com`'s DNS is managed (Cloudflare, if
that's where it lives). This is the one-time setup — once verified, you can
send from any address `@that domain`, including `scja@stuckstudio.com`
as already configured in the code.

Verification usually completes within a few minutes to an hour after the
DNS records propagate.

**Step 3 — Create an API key.**
Resend dashboard → **API Keys** → **Create API Key**. Give it a name like
"SCJA" and "Sending access" permission. Copy the key — Resend only
shows it once.

**Step 4 — Add the key as a secret.**

```bash
npx wrangler pages secret put RESEND_API_KEY
```

Paste the key when prompted. If your project is Git-connected (Option B in
the main setup above), also add `RESEND_API_KEY` under **Settings →
Environment variables** in the Pages dashboard (encrypted), the same way
you did for `ADMIN_PASSWORD` and `SESSION_SECRET`. Redeploy after adding it.

**Step 5 — Test it.**
Log into the admin panel, open a test member (or register a test
application to yourself first), and click the confirm button. The toast
will tell you immediately if something's misconfigured — common messages:

| Toast message | What it means |
|---|---|
| "Email sending isn't configured yet." | `RESEND_API_KEY` isn't set — check Step 4. |
| "Resend rejected the API key." | The key is wrong, revoked, or wasn't saved — recheck Step 3–4. |
| "Resend rejected the request: ..." | Usually an unverified sending domain — finish Step 2, or the recipient address is invalid. |
| "Resend's daily or rate limit was hit." | You've hit the 100/day free cap. Wait until it resets (resets daily) or upgrade Resend's plan. |

### 3. Using bulk confirm

Since the free plan caps at **100 emails/day**, if you're confirming more
than ~100 applicants in one sitting, the bulk action will send as many as
it can and then report how many were skipped for hitting the daily limit
— those are safe to select again and send the next day; nothing gets
double-charged or duplicated for members already marked "Confirmed."

Local development (`wrangler pages dev`) still calls the real Resend API
if `RESEND_API_KEY` is set in a local `.dev.vars` file — so be careful
about testing with real applicant email addresses locally, since it will
actually send. Leave `RESEND_API_KEY` unset locally if you want the "not
configured" error instead of live sends while developing.

---

## Project-specific settings (SCJA)

| Item | Value |
|---|---|
| Production URL | `https://scja-reg.stuckstudio.com` |
| Admin panel | `https://scja-reg.stuckstudio.com/admin.html` |
| Cloudflare Pages project | `scja-registration` |
| D1 database | `scja_reg_db` (create it, then paste the new `database_id` into `wrangler.toml`) |
| Confirmation email sender | `Sohrawardi College Journalist Association <scja@stuckstudio.com>` |
| Facebook page | https://www.facebook.com/profile.php?id=100087885429833 |

**Custom domain:** in the Cloudflare dashboard open the Pages project →
**Custom domains → Set up a custom domain** and enter
`scja-reg.stuckstudio.com`. If `stuckstudio.com` is on Cloudflare DNS the
CNAME record is created for you.

**Email logo:** the confirmation email loads its logo from
`https://scja-reg.stuckstudio.com/assets/logo.png`, so the logo only appears in
inboxes once the custom domain is live.

**This is a separate project from the GSSC IT Club one.** It has its own D1
database, its own secrets (`ADMIN_PASSWORD`, `SESSION_SECRET`,
`RESEND_API_KEY`) and its own Pages project. Do not reuse the IT Club's
`database_id`, or both forms would write into the same table.

**Resend:** `stuckstudio.com` is already a verified domain if you set it up for
the IT Club, so `scja@stuckstudio.com` works without extra DNS records. The
free plan's 100 emails/day cap is per Resend account, so it is shared between
both projects when they use the same API key. Create a separate API key if you
want them tracked separately.

## Academic levels and departments

The form serves both HSC and Honours students.

- **HSC** (1st Year, 2nd Year, Examinee) — groups: Science, Business Studies,
  Humanities.
- **Honours** (1st – 4th Year) — departments offered by the college:
  - *Humanities:* Bangla, English, Arabic, History, Islamic History & Culture,
    Philosophy, Islamic Studies, Political Science, Economics
  - *Science:* Physics, Chemistry, Botany, Zoology, Geography & Environment,
    Mathematics
  - *Commerce:* Accounting, Management

Every dropdown also has an **Other (please specify)** option, so a department
that is missing from the list can still be entered. The value is stored in the
same `department` column, and the admin panel's filter, chart and CSV export
work with it unchanged.
