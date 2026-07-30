# Configuration

## 1. Firebase web application

Use the existing OpenOrgan Firebase project. In Firebase Console, open **Project settings → General → Your apps → Web app**, then copy the web configuration into `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Enable:

- Authentication → Email/Password
- Cloud Firestore
- Firebase Storage
- Firebase App Hosting

Deploy rules before testing protected writes:

```powershell
npx firebase-tools login
npx firebase-tools use --add
npx firebase-tools deploy --only firestore:rules,storage
```

## 2. Firebase administrator UID

Do not change any Firebase UID.

Open **Firebase Console → Authentication → Users**, find the account that should administer organization verifications and listing claims, and copy its existing UID:

```env
OPENORGAN_ADMIN_UIDS=existing_firebase_uid
```

Multiple administrators are comma-separated:

```env
OPENORGAN_ADMIN_UIDS=uid_one,uid_two
```

Never replace `ownerId`, `userId`, `organizationOwnerId`, or `askerId` values in Firestore merely to grant administrator access.

## 3. Local Firebase Admin credentials

Ordinary public and signed-in client pages use the Firebase web configuration. Server-only administration, verification email routes, data migration, and import scripts require Firebase Admin credentials locally.

Create a service-account key from **Firebase Console → Project settings → Service accounts**, then place the complete JSON on one line:

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

Never commit `.env.local` or the service-account file. Firebase App Hosting uses its runtime service account instead of this local JSON.

## 4. Google Maps

Create two Google Cloud API keys.

### Public browser key

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=
```

Enable only:

- Maps JavaScript API
- Places API (New)
- Maps Embed API

Apply HTTP referrer restrictions:

```text
http://localhost:3000/*
https://openorgan.org/*
https://www.openorgan.org/*
```

### Private server key

```env
GOOGLE_MAPS_SERVER_API_KEY=
```

Enable only:

- Places API (New)
- Routes API

Do not prefix this value with `NEXT_PUBLIC_`. Store it as an App Hosting secret in production.

## 5. OpenOrgan email

The application uses Resend to send organization-domain verification codes from:

```env
VERIFICATION_FROM_EMAIL="The OpenOrgan Project <verify@openorgan.org>"
RESEND_API_KEY=re_...
```

### Send from `@openorgan.org`

1. Create a Resend account.
2. Add `openorgan.org` under **Domains**.
3. Copy every DNS record Resend provides into Cloudflare DNS exactly.
4. Keep verification CNAME records **DNS only**, not proxied.
5. Wait until Resend marks the domain verified.
6. Create a production API key and place it in `RESEND_API_KEY`.

A separate mailbox is not required merely to send automated verification email.

### Receive replies at `verify@openorgan.org`

Cloudflare Email Routing is optional and handles incoming email only.

1. Open Cloudflare → **Email → Email Routing**.
2. Confirm that another provider such as Google Workspace or Microsoft 365 is not already controlling the root-domain MX records.
3. Enable Email Routing for `openorgan.org`.
4. Verify your personal destination inbox.
5. Create a custom route from `verify@openorgan.org` to that inbox.

Cloudflare Email Routing does not provide a normal outgoing mailbox. Automated outgoing messages still use Resend. For a full inbox with manual sending, use Google Workspace, Microsoft 365, Zoho, or another mailbox provider instead of Cloudflare routing.

## 6. Firebase App Hosting

Use App Hosting for the Next.js application. Do not deploy the application with the old static Hosting command.

1. Push this repository to GitHub.
2. Firebase Console → App Hosting → Create backend.
3. Connect the repository root.
4. Add public Firebase and Google browser values in App Hosting environment configuration.
5. Create secrets:

```powershell
npx firebase-tools apphosting:secrets:set GOOGLE_MAPS_SERVER_API_KEY
npx firebase-tools apphosting:secrets:set RESEND_API_KEY
npx firebase-tools apphosting:secrets:set OPENORGAN_ADMIN_UIDS
```

6. Test the generated `hosted.app` domain.
7. Only after testing, migrate `openorgan.org` and `www.openorgan.org` to the App Hosting backend.

## 7. Production environment values

```env
NEXT_PUBLIC_SITE_URL=https://openorgan.org
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=...
GOOGLE_MAPS_SERVER_API_KEY=...
RESEND_API_KEY=...
VERIFICATION_FROM_EMAIL="The OpenOrgan Project <verify@openorgan.org>"
OPENORGAN_ADMIN_UIDS=...
```
