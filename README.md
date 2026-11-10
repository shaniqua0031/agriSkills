# AgriSkills Passport

AgriSkills Passport is a learner-controlled digital record for agricultural skills and qualifications.

## Accounts
There are no built-in accounts. Open the app, tap **Create an account**, choose **Learner** or **Issuer**, and accept the privacy notice. An issuer gives a credential to a learner by entering the learner's registered email address.

- **No email check:** sign-up logs you straight in and no confirmation email is sent (owner's decision). The email address is not proven to belong to the person, so anyone could sign up with an address they don't own.
- **Issuer approval (for safety):** a new Issuer can log in but can't issue or revoke credentials until an **admin** approves it in the app.
  - **Admins** can't sign up in the app. Sign up normally, then on the server run `cd Server && npm run admin:grant -- you@example.com`. Run `npm run admin:grant` with no email to list the admins. The account must not already hold or have issued credentials.
  - After logging in, an admin sees **Issuer approvals**. On the **Pending** tab, an admin approves or declines new issuers (declining deletes an account that has issued nothing). On the **Approved** tab, an admin can withdraw approval. Credentials they already issued stay valid. Each approval records which admin gave it.
  - The command `npm run issuer:approve -- name@org.com` still works as a backup.
- **Forgot password:** tap **Forgot password?** and enter your email. The app emails a one-time reset link; opening it takes you directly to **New password** and **Confirm new password**. Links expire after 15 minutes and work once. The request response does not reveal whether an email has an account.
- **Remember me** (ticked by default) keeps you logged in after a refresh or restart. The login is saved in the phone's secure storage, or in the browser on the web, and expires after 7 days. Untick it on shared computers.
- **Employers** don't need an account. They can use **Verify a credential** on the login page and paste a share link.
- **Rate limits:** login is blocked for 15 minutes after 10 failed attempts. Sign-up, codes and password resets are also limited.

**Emails (password-reset links)** can be sent two ways, set in `Server/.env`:
- **Gmail:** set `SMTP_USER` to your Gmail address and `SMTP_PASS` to a Gmail **App Password** from https://myaccount.google.com/apppasswords. App Passwords need 2-Step Verification turned on.
  - The dev server restarts when `.env` is saved, and prints `Email: sending via SMTP as …` if the login works.
  - Gmail limits how many emails you can send per day, which is fine for testing and small pilots.
- **Resend:** set `RESEND_API_KEY` and `EMAIL_FROM`. You need a verified domain to send to any address.

Set `PASSWORD_RESET_URL` to the mobile app's `/forgot-password` URL. For local web testing use `http://localhost:8081/forgot-password`; for phone testing on Wi-Fi use `http://<your-laptop-ip>:8081/forgot-password`; in production use the deployed app URL. With neither email provider set, reset links are printed in the server terminal during development, and password reset is switched off in production. Sign-up does not need email.

## Local QR / share testing
In development you don't need to type in your laptop's IP address. It is detected automatically, so things keep working when the Wi-Fi address changes:
- The server builds share links and QR codes from the laptop's current Wi-Fi address, so a phone on the same Wi-Fi can open them.
- The app connects to the API on the same computer it was loaded from: the browser's address on the web, or the computer running Expo on a phone.

To force a specific address, set `PUBLIC_BASE_URL` in `Server/.env` or `EXPO_PUBLIC_API_URL` in `mobile/.env`, then restart the server or Expo.

In the app, open **Share**, pick an active credential and an expiry (7, 30 or 90 days, or 1 year), then tap **Create verification link**. The QR code and link look like:

http://<your-laptop-ip>:3000/verify/<random-token>

The link is shown only once (the server stores just a SHA-256 hash of the token). Learners can turn a link off from the same screen; turned-off and expired links return `410` and reveal no credential details.

When deployed to Render, `PUBLIC_BASE_URL` must be set to the deployed URL; the server refuses to start in production without it. Set the mobile app's `EXPO_PUBLIC_API_URL` to the Render API URL as well, then rebuild or restart the app.

## Verification note
Each credential is signed when issued with HMAC-SHA256 over a canonical JSON form of its fixed fields (see `Server/src/integrity.ts`), using `CREDENTIAL_SIGNING_SECRET` from the server environment. Public verification checks, in order: the share token exists, the link is not turned off or expired, the signature matches (fails closed if missing or wrong), then the credential's revoked/expired status. This is a simplified project scheme, not W3C Verifiable Credentials or Open Badges 3.0.

New credentials are signed automatically. `cd Server && npm run credentials:sign` is only needed for older, unsigned rows.

## Skills evidence (RPL)
Learners use the **Evidence** tab to record proof of skills they already have: the skill, a note, an optional photo, an optional location stamp and optional supervisor details. New evidence starts as "submitted". A learner cannot approve their own evidence.

**Who reviews it:** only an **approved training provider (Issuer)**. The learner chooses one under **Who should review it?** when adding evidence, or later with **Choose a reviewer**. Only that provider can see the evidence. In the issuer **Review** tab they tap **Approve** or **Not approved**, and a note is required when it is not approved. The decision is final. Until then, the learner can change the reviewer. The supervisor is only a contact the provider may phone or email to check the work. There is no separate supervisor confirmation step.

- The location is only requested when the learner switches **Add a location stamp** on.
- Photos are private. The app only shows them through links that expire after 10 minutes, and only to the learner who owns them.
- Deleting evidence also deletes its photo.

Where photos are stored depends on `Server/.env`:
- **Cloudinary** (recommended, and needed on Render): set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`, then restart the server. Photos are uploaded straight from the app as private ("authenticated") Cloudinary assets.
- **Local folder** (development only, used automatically when the Cloudinary keys are empty): photos are saved in `Server/uploads/`, which git ignores.
- **Switched off**: when `NODE_ENV=production` and no Cloudinary keys are set. Evidence without a photo still works.

## Run locally
- Server: `cd Server && npm run dev`
- Mobile app: `cd mobile && $env:EXPO_ROUTER_APP_ROOT='src/app'; npm run web -- --non-interactive`

On Windows PowerShell, if you get "running scripts is disabled on this system", use `npm.cmd` instead of `npm` (for example `npm.cmd run dev`), or use Command Prompt or Git Bash. You don't need to change the execution policy.

## Data storage
The server requires `DATABASE_URL` in `Server/.env` (PostgreSQL on Neon) and refuses to start without it. All accounts, credentials and share links are stored there. The in-memory store in `Server/src/app.ts`, with its fictional accounts, is used only by the automated tests (`npm test`).

To set up a new, empty database, run `cd Server && npm run prisma:push`. `prisma:push` synchronizes the schema without creating a migration history; review its output and do not accept any proposed data-loss operation.

## Deploy to Render (Blueprint)
`render.yaml` creates two services: **agriskills-api** (the Express API in `Server/`, in the `ohio` region next to the Neon database) and **agriskills-app** (the Expo web app in `mobile/`, built as a static site).

1. Push the repo to GitHub, including `render.yaml`.
2. In the Render Dashboard, go to **New → Blueprint**, connect the GitHub repo and select it.
3. Render asks for the secret values:
   - `DATABASE_URL`: the Neon connection string from `Server/.env`.
   - `CREDENTIAL_SIGNING_SECRET`: **must be the same value as in `Server/.env`**, or existing credentials fail verification.
   - Cloudinary and SMTP keys are optional. Without them, evidence photos and password-reset emails are switched off.
4. Click **Apply** and wait for both services to go live.
5. Check that the URLs are `https://agriskills-api.onrender.com` and `https://agriskills-app.onrender.com`. If Render added a suffix to either name, update the URLs in `render.yaml` and push again.

On the free plan the API sleeps after 15 minutes without traffic, so the first request after that takes about a minute.
