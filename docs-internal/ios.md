# Shipping ConcordiaTracker to the App Store

## The one hard constraint

**Apple's toolchain only runs on macOS.** Not "runs best on" — Xcode, CocoaPods,
`xcodebuild`, the Simulator, and the upload tooling are macOS-only, and no
amount of Capacitor changes that. This project is developed on Windows 11.

So the Mac is **rented by the minute**: `.github/workflows/ios.yml` runs the
build on a GitHub-hosted macOS runner. Free-tier minutes on macOS burn about ten
times as fast as Linux, so the workflow is scoped to paths that actually reach
the app and is otherwise manual.

What you can do from Windows: everything except compiling, running the
Simulator, and hand-editing the Xcode project.

## What's already in place

| Piece | Where | State |
| --- | --- | --- |
| Native config | `capacitor.config.ts` | Written, unverified on device |
| Runtime native bits | `src/lib/native.ts` | Splash, status bar, back, external links |
| Build pipeline | `.github/workflows/ios.yml` | Unsigned build works with no credentials |
| Safe areas | all three layouts | Already handled — predates this |
| Icons | `public/icon-512.png` | Reusable as the app icon source |

`ios/` is gitignored: `cap add ios` regenerates it each CI run. That's fine
while the native layer is stock. **The moment you need to hand-edit
`Info.plist`** — a permission string, an associated domain, a URL scheme —
generate the folder once on a Mac and commit it, or those edits are wiped every
run.

## Step 1 — prove it compiles (no Apple credentials needed)

Push to `master`, or run the **iOS** workflow manually from the Actions tab with
`upload` unchecked. It builds unsigned. If it goes green, the web build, the
Capacitor sync and the Xcode project are all healthy.

Do this **before** creating any certificates. It's the step that catches the
failure that actually happens — a plugin whose native half won't compile — and
it costs nothing but runner minutes.

## Step 2 — register the app

In [App Store Connect](https://appstoreconnect.apple.com):

1. **Apps → +** → New App.
2. Bundle ID: **`com.concordiatracker.app`** — must match `appId` in
   `capacitor.config.ts`. You register it first under Certificates, Identifiers
   & Profiles → Identifiers.
3. This is effectively permanent. It's the primary key for the listing, for
   provisioning profiles, and for every push certificate. Changing it later
   means a new app listing with zero reviews.

## Step 3 — signing, once

Four secrets, created once, added under **Settings → Secrets and variables →
Actions** in the GitHub repo:

| Secret | What it is |
| --- | --- |
| `IOS_CERT_P12` | Apple Distribution certificate, exported as `.p12`, base64-encoded |
| `IOS_CERT_PASSWORD` | The password you set when exporting it |
| `IOS_PROVISIONING_PROFILE` | App Store provisioning profile for the bundle ID, base64-encoded |
| `APPLE_TEAM_ID` | Ten characters, top-right of the developer portal |
| `APPSTORE_KEY_ID` / `APPSTORE_ISSUER_ID` / `APPSTORE_PRIVATE_KEY` | App Store Connect API key, for uploading |

Base64 on Windows:

```bash
certutil -encode cert.p12 cert.b64
```

then strip the `-----BEGIN/END-----` lines.

Generating the `.p12` needs Keychain Access, which is macOS. This is the one
step that genuinely requires borrowing a Mac for twenty minutes — a friend's, a
library's, or a cloud Mac by the hour. You do it **once**; after that CI handles
every build.

## Step 4 — screenshots

Do these **after** step 1 goes green, not before, and take them from the
Simulator on the real build. App Review compares screenshots to the app, and a
mock-up assembled from marketing components is both less accurate and more work
than `Cmd+S` in the Simulator.

What converts, for a product like this: a real screen with one short line of
text above it. Today with a due list on it, a course detail with a grade, the
Planner. Not an illustrated collage.

Apple's required set changes; App Store Connect tells you exactly which sizes it
wants when you upload. As of writing that's one iPhone size and, if you list for
iPad, one iPad size — it fans the rest out automatically.

## The update model — read this before promising anything

`webDir: 'dist'` **bundles** the web assets into the binary. That's deliberate:
an app that only loads a URL is what App Review guideline 4.2 exists to reject,
and an app that shows a blank screen on the metro is worse than one that works.

The consequence is real: **a web change needs a new binary**, which means a
review, which is usually a day. It is still one codebase and one set of
features — but it is not "push to Vercel and the app updates".

Two ways out, when submissions become routine:

- **Capacitor Live Updates** (paid, Ionic) — over-the-air web-layer updates.
- **A self-hosted OTA channel** — more work, no vendor.

Both are permitted: Apple's guideline 3.3.2 allows updating interpreted code as
long as it doesn't change the app's primary purpose. Don't build either until
the app is actually shipping.

## Android

Not set up, deliberately. Google Play's review is faster and its tooling runs on
Windows, so it's genuinely easier — but it's a second store listing, a second
set of screenshots, and a second review queue. Ship iOS first, then
`npm i @capacitor/android && npx cap add android`, which you *can* do from this
machine.

## Cost

- Apple Developer Program: $99/year — **already paid**.
- GitHub Actions macOS minutes: free tier covers occasional builds; watch it if
  the workflow starts running on every push.
- Everything else: nothing.
