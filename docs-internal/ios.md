# Shipping ConcordiaTracker to the App Store

**This file is the handoff.** It is written to be followed on a Mac by someone —
or some agent — with no access to the conversation it came out of. Everything
needed is either here or in the repo.

If you are Claude Code reading this on the Mac: `CLAUDE.md` is gitignored and
did **not** travel with the clone, so you do not have this project's memory.
That is fine for this job. This file is self-contained. Do not go looking for
context you do not have, and do not change anything outside `ios/` and
`capacitor.config.ts` without being asked.

---

## What this is

ConcordiaTracker is a Vite + React + TypeScript web app, live at
`concordiatracker.com`, deployed on Vercel. The iOS app is a **Capacitor**
shell around the same web build — one codebase, no second implementation.

Already done, on Windows, and committed:

| Piece | Where |
| --- | --- |
| Native config | `capacitor.config.ts` |
| Runtime native behaviour | `src/lib/native.ts` |
| CI build (second opinion) | `.github/workflows/ios.yml` |
| Safe areas | all three layouts, pre-existing |
| Icon source | `public/icon-512.png` |

`ios/` is **gitignored** — `npx cap add ios` regenerates it. That is correct
while the native layer is stock. See "When to commit ios/" at the bottom.

Nothing in the native layer has ever been compiled. **The first build is the
first time any of it is tested.** Expect to fix something.

---

## Before you start: check the Mac can do this

```bash
sw_vers          # macOS version
df -h /          # free disk
```

- **macOS 15 (Sequoia) or newer** is what a current Xcode wants. On macOS 14
  you can still build, but you may be capped at an older Xcode, and App Store
  Connect rejects builds made with an SDK that has aged out. If `sw_vers` says
  13 or lower, the Mac needs updating before anything else.
- **~60 GB free.** Xcode is about 40 GB installed plus a simulator runtime, and
  the installer needs room to unpack on top of that.
- **8 GB RAM** works; 16 GB is comfortable. The app itself is tiny — Xcode is
  what is heavy.

---

## Step 1 — install the toolchain

Xcode is the long pole and it is nearly all download. Start it first and do the
rest while it runs.

```bash
# Xcode — from the App Store, or developer.apple.com/download for a specific
# version. ~10 GB down, ~40 GB installed. 30-90 minutes on a normal connection.

# Then, once it is installed and has been opened once to accept its licence:
xcode-select --install                    # command line tools, if not present
sudo xcodebuild -license accept
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer

# CocoaPods — Capacitor uses it to wire the plugins' native halves.
brew install cocoapods                    # or: sudo gem install cocoapods

# Node 24 (matches CI and the engines field)
brew install node@24

# Verify
xcodebuild -version && pod --version && node -v
```

---

## Step 2 — first build, in the Simulator

```bash
git clone https://github.com/gmazaratti/concordiatracker-seed.git
cd concordiatracker-seed
npm ci

npm run build            # the web build IS the app. Must pass first.
npx cap add ios          # scaffolds ios/ — seconds
npx cap sync ios         # copies dist/ in, installs pods — 1-3 min first time
npx cap open ios         # opens the Xcode workspace
```

In Xcode: pick an iPhone simulator in the scheme selector at the top, press
**▶︎**. First compile of a Capacitor shell is 1–3 minutes; after that it is
seconds.

**Success looks like:** the ConcordiaTracker landing page, then the app,
running in a simulated iPhone. The status bar should have light glyphs on the
dark theme. Tapping an external link should open in-app Safari with a Done
button rather than navigating the app away.

After any web change, the loop is:

```bash
npm run cap:sync         # = npm run build && cap sync ios
```

then hit ▶︎ again. No need to re-run `cap add`.

---

## Step 3 — on your own phone

Free, no certificates, and worth doing before anything to do with the App Store.

1. Plug the iPhone in, trust the Mac.
2. Xcode → **Signing & Capabilities** → tick *Automatically manage signing*,
   and pick your personal team (your Apple ID, added under Xcode → Settings →
   Accounts).
3. Select the phone in the scheme selector, press ▶︎.
4. On the phone: Settings → General → VPN & Device Management → trust the
   developer certificate.

A free personal-team build expires after 7 days. That is fine for testing; the
paid account (already bought) is what makes it permanent.

**Stop here and use the app for a day before continuing.** Everything below is
paperwork, and paperwork done against an app you have not actually held is
paperwork you will redo.

---

## Step 4 — register the app

At [App Store Connect](https://appstoreconnect.apple.com):

1. First, Certificates, Identifiers & Profiles → **Identifiers** → register
   **`com.concordiatracker.app`**. It must match `appId` in
   `capacitor.config.ts` exactly.
2. Then Apps → **+** → New App, using that bundle ID.

The bundle ID is effectively permanent — it is the primary key for the listing,
for provisioning profiles, and for every push certificate. Changing it later
means a new listing with zero reviews.

---

## Step 5 — TestFlight, then submission

With the Mac, the easy path is Xcode's own: **Product → Archive**, then
*Distribute App → App Store Connect*. Xcode handles signing through your
account. This is simpler than the CI path and is the right way to do the first
few builds.

The CI workflow (`.github/workflows/ios.yml`) exists as a second opinion — it
catches something that only compiles because of a tool already sitting on your
Mac. Run it manually from the Actions tab. It is **manual-only** deliberately;
minutes are free on this repo because it is public, but a scheduled macOS build
is noise either way.

If you later want CI to upload to TestFlight, it needs four secrets under
Settings → Secrets and variables → Actions: `IOS_CERT_P12`,
`IOS_CERT_PASSWORD`, `IOS_PROVISIONING_PROFILE`, `APPLE_TEAM_ID`, plus
`APPSTORE_KEY_ID` / `APPSTORE_ISSUER_ID` / `APPSTORE_PRIVATE_KEY` for the
upload. Don't bother until manual submissions are routine.

---

## Step 6 — screenshots

Take them from the Simulator, on the real build, **after** step 2 works.

```bash
# In the Simulator: Cmd+S saves a screenshot at the exact device resolution.
```

Run the simulator for whichever device size App Store Connect asks for — it
tells you when you upload, and it fans the rest out automatically. What
converts for a product like this is a real screen with one short line above it:
Today with a due list on it, a course detail with a grade, the Planner. Not an
illustrated collage.

App Review compares screenshots to the app, so anything assembled from mock-ups
is both less accurate and more work than `Cmd+S`.

---

## The update model — know this before promising anyone anything

`webDir: 'dist'` **bundles** the web assets into the binary. Deliberate: an app
that only loads a URL is what App Review guideline 4.2 exists to reject, and one
that shows a blank screen on the metro is worse than one that works.

The consequence is real. **A web change needs a new binary**, which means a
review, which is usually a day. It is still one codebase and one set of
features — it is not "push to Vercel and the app updates".

Two ways out, once submissions are routine and not before:

- **Capacitor Live Updates** (paid, Ionic) — over-the-air web-layer updates.
- **A self-hosted OTA channel** — more work, no vendor.

Both are permitted: guideline 3.3.2 allows updating interpreted code as long as
it does not change the app's primary purpose.

---

## When to commit `ios/`

Right now it is gitignored and regenerated. That stops being correct the moment
you hand-edit anything inside it — an `Info.plist` permission string, an
associated domain, a URL scheme, a push entitlement. Those edits live in the
generated project and will be wiped by the next `cap add`.

When that day comes: remove `ios/` from `.gitignore`, commit the folder, and
delete the `npx cap add ios` line from the CI workflow (leave `cap sync`).

---

## Troubleshooting the failures that actually happen

| Symptom | Cause |
| --- | --- |
| `pod install` fails on a plugin | Pod repo is stale — `pod repo update`, then `npx cap sync ios` |
| White screen on launch | `dist/` was not rebuilt. `npm run cap:sync`, not just `cap open` |
| Content under the notch | A layout missing `env(safe-area-inset-*)`. All three have it; a new one might not |
| Status bar glyphs invisible | `setNativeStatusBar` in `src/lib/native.ts` — it derives from the theme's scheme |
| External link navigates the app away | `interceptExternalLinks` did not run; check `initNative()` is still called in `src/main.tsx` |
| Signing errors on a personal team | Bundle ID collision — a free team cannot reuse an ID someone else registered |

---

## Android

Not set up, deliberately. Play's tooling runs on Windows and its review is
faster, so it is genuinely the easier one — but it is a second listing, a second
screenshot set, and a second review queue. Ship iOS first, then
`npm i @capacitor/android && npx cap add android`, which works from the Windows
machine.

---

## Cost

- Apple Developer Program: $99/year — already paid.
- GitHub Actions: free, this repo is public.
- Everything else: nothing.
