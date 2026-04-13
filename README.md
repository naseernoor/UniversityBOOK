# MarksTracker

Full-stack university marks tracking system built with Next.js + Prisma.

## Core features

- Registration and profile with degree level (`Bachelor`, `Master`, `PhD`)
- Login with credentials, Google, and Apple
- Email verification activation for credential-based signups
- Forgot password and secure reset flow
- Live username availability check on registration
- Manual semester numbering constrained by profile total semesters (for example `01` to `09`)
- Semester status (`ONGOING` / `FINISHED`) where only finished semesters count in overall percentage
- Subject-level management with edit/delete and optional `subject code`, `teacher name`, and lecture uploads
- Excel export/import for marks with row-level validation issues on import
- Stylish transcript PDF export with field-visibility controls
- Feed-first dashboard with profile/add-semester views
- Social posts: text posts, share semesters, share overall percentage, likes, comments, and public/friends visibility
- Per-semester and overall percentage analytics
- Chance analytics (2nd/3rd chance counts)
- Minimum passing marks and retake queues
- Friend requests and per-semester visibility control
- Profile photo upload
- UTF-8 support for Persian/Pashto/English text inputs across profile and subjects

## Stack

- Next.js 14 (App Router + API routes)
- TypeScript
- Prisma ORM
- PostgreSQL (production)
- NextAuth
- Tailwind CSS
- Optional Vercel Blob storage for file uploads

## Environment variables

Create `.env` from `.env.example` and set:

- `DATABASE_URL` (PostgreSQL connection string)
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (optional)
- `APPLE_ID` / `APPLE_CLIENT_SECRET` (optional)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (required for sending verification/reset emails)
- `SMTP_FROM` (optional; falls back to `SMTP_USER` if omitted)
- `SMTP_SECURE` (`true` or `false`, optional; defaults to `true` for port `465`, otherwise `false`)
- `BLOB_READ_WRITE_TOKEN` (required on Vercel for persistent uploads)

If `BLOB_READ_WRITE_TOKEN` is not set, uploads fall back to local filesystem (`public/uploads`).

If SMTP variables are not set, verification/reset links are logged on the server instead of being emailed.

## Local setup

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

## Quality checks

```bash
npm run lint
npm run build
```

## GitHub + Vercel deployment

1. Push project to GitHub.
2. Import the repository in Vercel.
3. In Vercel project settings, configure all required environment variables.
4. Set `DATABASE_URL` to your production PostgreSQL instance.
5. Set `BLOB_READ_WRITE_TOKEN` to enable persistent lecture/profile uploads.
6. Deploy.

### Recommended production flow

- Use managed Postgres (Neon/Supabase/Vercel Postgres)
- Use Vercel Blob for uploads
- Keep `NEXTAUTH_URL` as your production domain (for example `https://your-app.vercel.app`)
