# Ping Board

A private web app of big buttons that each open WhatsApp with a contact and a
message already filled in. You still tap **Send** in WhatsApp yourself; nothing
is ever sent automatically.

- Sign in with a magic link sent by email (no passwords).
- Only emails on your allowlist can sign in. The Supabase server enforces this,
  not just the web page.
- Everyone sees only their own buttons, enforced by Row Level Security in the database.
- It works on phones, has a light and dark mode, and can be added to your home screen.

It's a plain static site (HTML, CSS and JavaScript, with no build step), hosted
for free on GitHub Pages, with Supabase's free plan for login and storage.

---

## How it fits together

```
Your phone ──► GitHub Pages (public: just the app's code, no data)
                    │
                    ▼
               Supabase (login + database)
                 • the allowlist decides who can create an account
                 • RLS rules decide which rows each person can touch
```

The website itself is public, as GitHub Pages always is, but it contains no
data. Your buttons live in Supabase, and Supabase only returns them to someone
signed in as you.

---

## Setup, step by step

You need:

- a **GitHub** account (free): <https://github.com/signup>
- a **Supabase** account (free): <https://supabase.com/dashboard> (you can sign in with GitHub)
- **GitHub Desktop** (free): <https://desktop.github.com>

It takes about 20 minutes.

### Step 1: Create the Supabase project

1. Go to <https://supabase.com/dashboard> and click **New project**.
2. Pick your organisation and choose the **Free** plan.
3. **Name:** `ping-board`.
4. **Database password:** click *Generate a password* and save it in your
   password manager. Ping Board doesn't use it, but you need it for admin work.
   Don't put it in this project.
5. **Region:** pick the one closest to you.
6. Click **Create new project** and wait a minute or two while it starts.

### Step 2: Run the SQL

1. In the left sidebar, open **SQL Editor**, then **New query**.
2. Open the file [`supabase/setup.sql`](supabase/setup.sql) from this project,
   copy all of it, and paste it into the editor.
3. Click **Run**. You should see *Success. No rows returned*.

This creates:

| What | Purpose |
|---|---|
| `allowed_emails` table | Your allowlist. The browser can't read or change it. |
| `buttons` table | Everyone's buttons, with Row Level Security turned on. |
| RLS policies | Each person can only select, insert, update or delete rows where `user_id` is their own, and only while their email is on the allowlist. |
| `hook_before_user_created` | Refuses to create an account for any email that isn't on the allowlist. |

### Step 3: Turn on the allowlist hook

1. Go to **Authentication**, then **Hooks** (it may be under *Configuration*).
2. Click **Add hook** (or **Add a new hook**) and choose **Before User Created**.
3. **Hook type:** *Postgres*. **Schema:** `public`. **Function:** `hook_before_user_created`.
4. Save, and make sure the hook is **enabled**.

From now on, Supabase refuses to create an account for anyone whose email
isn't on your list.

### Step 4: Add the allowed emails

**Option A: Table Editor (easiest)**

1. Open **Table Editor**, then `allowed_emails`, then **Insert**, then **Insert row**.
2. Type the email in `email`, plus a `note` if you like (e.g. "me"). Click **Save**.
3. Repeat for each person, including yourself.

**Option B: SQL Editor**

```sql
insert into public.allowed_emails (email, note) values
  ('you@example.com', 'me'),
  ('friend@example.com', 'friend')
on conflict (email) do nothing;
```

Capital letters and extra spaces are cleaned up automatically.

### Step 5: Check the email login settings

1. **Authentication → Sign In / Providers → Email:** make sure **Email** is
   enabled. Leave *Confirm email* on.
2. In the same place, leave **Phone** and **Anonymous sign-ins** turned off.
3. **Authentication → Emails (Email Templates):** add the login code to two templates so
   people can type a code instead of tapping the link. You'll need this when
   Ping Board is opened from the home screen on an iPhone (see
   [Troubleshooting](#troubleshooting)).
   - Open **Magic Link** and add this line under the existing link:
     ```html
     <p>Or type this code in Ping Board: <strong>{{ .Token }}</strong></p>
     ```
   - Open **Confirm signup** (the first email a new person gets) and add the same line.
   - Save both.

> **Email limits:** the free plan sends login emails through Supabase's own
> mail server, which only allows a few emails per hour for the whole project.
> That's fine for a small group. If you need more, Supabase lets you connect
> your own email provider under **Authentication → Emails → SMTP Settings**.
> Some providers are free up to a limit and some cost money.

### Step 6: Put your Supabase URL and key in the app

1. In Supabase, open **Project Settings** (the gear icon), then **API Keys**
   (in some versions, **Data API** / **API**).
2. Copy:
   - the **Project URL**, which looks like `https://abcdefghijkl.supabase.co`
     (shown under *Data API*, or on the project's home page under *Connect*).
   - the **public** key: either the **publishable** key (starts with
     `sb_publishable_`) or the legacy **anon public** key (a long text
     starting with `eyJ`). Either one works.
3. Open [`js/config.js`](js/config.js) in a text editor (Notepad works) and replace the two placeholders:

   ```js
   export const SUPABASE_URL = 'https://abcdefghijkl.supabase.co';
   export const SUPABASE_ANON_KEY = 'sb_publishable_xxxxxxxxxxxx';
   ```

4. Save the file.

> ⚠️ **Never use the `service_role` / `secret` key** (starts with `sb_secret_`,
> or labelled *service_role*). That key ignores all security rules. The app
> refuses to start with it, and the deploy stops if it's ever committed. If you
> paste it by mistake and push, **rotate it** in Supabase straight away.
>
> The public key is *meant* to be public. Anyone can see it in the website's
> code, and that's fine, because the database rules from step 2 are what
> protect your data.

### Step 7: Put the project on GitHub (GitHub Desktop)

1. Install and open **GitHub Desktop**, and sign in with your GitHub account.
2. **File → Add local repository…**, then choose this folder (`Web Button`).
3. It says *"This directory does not appear to be a Git repository"*. Click
   **create a repository**.
   - **Name:** `ping-board`
   - Leave the other fields as they are and click **Create repository**.
4. Click **Publish repository** (top bar).
   - **Name:** `ping-board`
   - **"Keep this code private":** see the note below, then decide.
   - Click **Publish repository**.

> **Public or private repo?** GitHub Pages is **free for public repositories**.
> Using Pages on a *private* repository needs a paid GitHub plan (GitHub Pro or
> higher). This project contains no secrets (only the public key), so a public
> repo is safe, but the choice is yours. Untick *Keep this code private* to stay
> on the free plan.

Later, after you change files: open GitHub Desktop, type a short summary
bottom-left, click **Commit to main**, then **Push origin**.

### Step 8: Turn on GitHub Pages

1. On github.com, open your `ping-board` repository, then **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Go to the **Actions** tab. Click **Deploy to GitHub Pages**, then **Run
   workflow**, then **Run workflow**. (The first automatic run may have failed
   because Pages wasn't on yet. That's normal.)
4. Wait for the green tick (about a minute). Your site is now at:

   ```
   https://YOUR-GITHUB-USERNAME.github.io/ping-board/
   ```

If the run fails at *Check config*, read the red message. It usually means
`js/config.js` still has the placeholders from step 6.

### Step 9: Tell Supabase your site's address (magic-link redirect)

The login link in the email must lead back to your site.

1. In Supabase: **Authentication → URL Configuration**.
2. **Site URL:** `https://YOUR-GITHUB-USERNAME.github.io/ping-board/`
3. **Redirect URLs → Add URL:** `https://YOUR-GITHUB-USERNAME.github.io/ping-board/`
   (the same address, with the slash at the end).
4. Save.

### Step 10: Try it

1. Open your site on your phone and enter your email.
2. Open the email and tap the link (or type the code).
3. Tap **+ New button** and fill in:
   - **Label:** On my way
   - **Contact name:** Sam (optional)
   - **WhatsApp number:** with the country code, e.g. `+31 6 12345678`.
     `0031…` also works, but `06…` doesn't.
   - **Message:** On my way, see you in 10 minutes!
4. Tap your new button. WhatsApp opens with the message ready, and you tap send.

To check the allowlist, try signing in with an email that's *not* on it. The
page looks the same (so it doesn't reveal who is on the list), but no email
arrives and no account is created. You can confirm under
**Authentication → Users**.

### Step 11: Add it to your home screen

- **iPhone (Safari):** tap Share, then **Add to Home Screen**.
- **Android (Chrome):** tap ⋮, then **Add to Home screen** or **Install app**.

---

## Managing access

- **Let someone in:** add their email to `allowed_emails` (step 4).
- **Take access away:** delete their row from `allowed_emails`. They
  immediately can't see or change any buttons, because RLS checks the
  allowlist on every request. To remove them completely, also delete them under
  **Authentication → Users**, which deletes their buttons too.

## Troubleshooting

| Problem | Fix |
|---|---|
| Page says *"Almost there"* | `js/config.js` still has the placeholders (step 6). |
| No email arrives | Check spam. Is the email on the allowlist? Is the hook set up right (step 3)? The free email sender also only allows a few emails per hour, so wait and try again. |
| Link opens the site but you're not signed in | The Site URL / Redirect URL in step 9 must match your Pages address exactly, including the trailing `/`. |
| *"Open the link in the same browser…"* | Login links only work in the browser you requested them from. Type the code from the email instead. |
| On iPhone, the home-screen app never gets signed in | iOS opens email links in Safari, not in the home-screen app. Use the **code** from the email inside the home-screen app (step 5.3). |
| *"That login link has expired"* | Links work once and expire after an hour. Ask for a new one. |
| Saving a button fails with a policy error | Your email was removed from `allowed_emails`, or the SQL from step 2 wasn't run fully. |
| You use a custom Supabase domain | Add it to `connect-src` in the `Content-Security-Policy` line in `index.html`. |

## Project layout

```
index.html               the app (single page)
css/style.css            mobile-first styles, light + dark
js/config.js             ← your Supabase URL + public key
js/app.js                login, list/add/edit/delete buttons
js/phone.js              phone-number normalisation + validation
manifest.webmanifest     "Add to Home Screen" settings
icons/                   app icons
vendor/                  pinned copy of supabase-js (see vendor/README.md)
supabase/setup.sql       paste into the Supabase SQL editor
scripts/check-config.mjs deploy check: blocks secret keys / placeholders
tests/                   phone validation tests (run by the workflow)
.github/workflows/       deploys to GitHub Pages on every push to main
```

## Security notes

- **Who can sign in:** the Supabase *Before User Created* hook rejects any
  email not in `allowed_emails`, on the server.
- **Who can see what:** RLS on `buttons` allows each operation only when
  `user_id = auth.uid()` *and* the signed-in email is still allowlisted.
  Logged-out visitors have no access at all.
- **Allowlist privacy:** `allowed_emails` can't be read from the browser, and
  the sign-in page shows the same message whether or not an email is allowed.
- **Data checks:** the database also checks phone format, required fields and
  lengths, so bad data is rejected even if someone bypasses the page.
- **Browser hardening:** a Content-Security-Policy only allows scripts from the
  site itself and network calls to Supabase. supabase-js is a pinned, vendored
  copy checked with a Subresource Integrity hash, and no CDN is used. User text
  is always shown as text, never as HTML.
- **What is *not* private:** the app's source code and your public Supabase key
  (both are designed to be public). Your Supabase project's owner (you) can
  see all buttons in the dashboard.
- Login sessions are stored in the browser's local storage, so use **Sign
  out** on shared devices.
