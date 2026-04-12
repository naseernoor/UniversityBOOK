# MarksTracker

Full-stack university marks tracking system built with Next.js + Prisma.

## Core features

- Registration and profile with degree level (`Bachelor`, `Master`, `PhD`)
- Login with credentials, Google, and Apple
- Semester templates (2 semesters/year) + custom semester option
- Subject-level management with edit/delete, teacher name, and lecture uploads
- Per-semester and overall percentage analytics
- Chance analytics (2nd/3rd chance counts)
- Minimum passing marks and retake queues
- Friend requests and per-semester visibility control
- Profile photo upload

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
- `BLOB_READ_WRITE_TOKEN` (required on Vercel for persistent uploads)

If `BLOB_READ_WRITE_TOKEN` is not set, uploads fall back to local filesystem (`public/uploads`).

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

