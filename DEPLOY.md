# Veterans Resource Directory — Deployment Guide

## What you have
A complete Next.js app connected to your Supabase database.
All 1,323 resources + hotlines live in Supabase already.

---

## Step 1: Get the code onto your computer

Create a GitHub account at github.com if you don't have one.
Then open terminal and run:

```bash
cd veterans-directory    # the folder you created earlier
```

Copy the entire `vrd-app` folder from Claude into this directory.
(Claude will provide it as a zip download)

---

## Step 2: Set up your environment variables

In the `vrd-app` folder, copy the example file:

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your Supabase anon key
- `RESEND_API_KEY` — get this free at resend.com (for email sharing)
- `NEXT_PUBLIC_APP_URL` — leave as http://localhost:3000 for now

---

## Step 3: Run the import script (if not done yet)

```bash
node import.mjs
```

Should say "Done!" with 1,323 resources.
Verify in Supabase → Table Editor → resources.

---

## Step 4: Test locally

```bash
cd vrd-app
npm install
npm run dev
```

Open http://localhost:3000 on your phone's browser (same wifi)
by visiting http://YOUR_COMPUTER_IP:3000

To find your computer's IP:
- Mac: System Settings → Wi-Fi → Details
- Windows: ipconfig in terminal, look for IPv4

---

## Step 5: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
```

Go to github.com → New repository → name it `veterans-directory`
Then run what GitHub shows you (3 lines starting with git remote add...)

---

## Step 6: Deploy to Vercel

```bash
vercel login    # opens browser, sign in with GitHub
vercel          # follow the prompts, say yes to everything
```

When it asks for environment variables, paste each one from your .env.local.

You'll get a live URL like: https://veterans-directory-abc123.vercel.app

---

## Step 7: Add staff accounts

Go to Supabase → Authentication → Users → Invite user
Enter each staff member's email. They'll get a link to set their password.

They log in at your app URL → tap "Staff" → enter email + password.

---

## Step 8: Add your domain (optional, free)

In Vercel → Settings → Domains → add your custom domain.

---

## Ongoing use

**To update resources:** Staff logs in on any phone/computer and edits directly.
No more exporting HTML files.

**To deploy code updates:** Push to GitHub. Vercel auto-deploys in 2 minutes.

**To review suggested resources:** Log in as admin → the suggestions tab
shows pending items to approve or reject.

**Backups:** Supabase keeps automatic daily backups.

---

## Support

If anything goes wrong, the error message will tell you exactly what to fix.
Common issues:
- "Invalid API key" → check .env.local values, no extra spaces
- "relation does not exist" → re-run the SQL from Step 2
- Build fails → run `npm run build` locally first to see the error

