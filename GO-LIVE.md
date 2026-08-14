# Escape: 20 Chambers — go-live runbook

Written 2026-08-13, the session that took the game from a free, offline,
unmonetized single-file prototype to a signed, monetized, Play-registered
build.

## Fixed values

| Thing | Value |
|---|---|
| Play developer account | `ahmadessam1997` — account ID `7599532919585116115` |
| **Play app ID** | **`4974911443003501563`** |
| Play dashboard | https://play.google.com/console/u/0/developers/7599532919585116115/app/4974911443003501563/app-dashboard |
| Android package | `com.ahmadessam.escapechambers` |
| Version | `1.0.0`, versionCode **1** (bump versionCode on EVERY upload) |
| Store listing name | `Escape: 20 Chambers` · Game → Puzzle · Free · **en-US** |
| AdMob app | `Escape 20 Chambers`, ref `3223395835` |
| AdMob app ID | `ca-app-pub-7898882561225435~3223395835` |
| AdMob interstitial | `ca-app-pub-7898882561225435/3031824142` |
| AdMob rewarded | `ca-app-pub-7898882561225435/3079875276` — reward **2 / hints** |
| RevenueCat project | `Escape 20 Chambers` — `8fc1ec67` |
| RevenueCat app | `Escape 20 Chambers (Play Store)` — `app6d4c25efde`, Capacitor |
| RevenueCat public key | `goog_GdqWuAnFGZXdSJqvndlXrAeqtNP` |
| GitHub repo | https://github.com/ahmadessam1997/escape-chambers (public) |
| Privacy policy | https://ahmadessam1997.github.io/escape-chambers/privacy-policy.html |
| Data deletion | https://ahmadessam1997.github.io/escape-chambers/delete-data.html |
| Upload keystore | `android/escapechambers-upload.jks`, alias `upload` |
| Upload key SHA-1 | `3F:43:40:5B:1B:7A:53:8E:E0:8A:A4:D2:ED:36:6C:E4:0C:44:A0:38` |
| Java for builds | **21** — `C:\Program Files\Android\Android Studio\jbr` |

> ## 🔑 BACK THIS UP OFF-MACHINE, TODAY
>
> `android/escapechambers-upload.jks` and its password (in the gitignored
> `android/keystore.properties`). This project signs **locally**. The `.jks`
> exists on this disk and nowhere else. If the disk dies before the first
> upload, the app can never be published under this package name.
>
> After the first upload, opt in to **Play App Signing** — Google then holds
> the real signing key and this `.jks` becomes only the *upload* key, which
> can be reset. That is the actual safety net.
>
> The certificate DN is real (`CN=Ahmad Essam, O=Ahmad Essam, C=US`), so
> unlike adaptive-chess there is no ambiguity about where the key lives.

---

## ▶ WHAT IS DONE

**Code — all verified, `npm test` → 67 passed, 0 failed.**

- Capacitor 7 → **8.5**. `@revenuecat/purchases-capacitor@13.4` pulls Play
  Billing **8.3**, which is required for anything published after
  31 Aug 2026. Staying on Capacitor 7 would have shipped BL7 and been
  blocked.
- Game split into `www/js/{config,save,billing,ads,shop,game}.js`.
- Hint wallet, AdMob interstitial + rewarded, three one-time products.
- Five real bugs fixed (see SESSION-NOTES).
- Signed AAB built: **10,618,523 bytes**, SHA-256 starts `FA9FABB4B9F49F07`,
  `META-INF/UPLOAD.{SF,RSA}` present, real ad IDs + RevenueCat key verified
  *inside* the bundle, merged manifest carries `BILLING` and `AD_ID`.

**Consoles**

| Where | State |
|---|---|
| AdMob | App + both ad units created and verified. Registered as **not listed on a store** — AdMob's store search reads the *public* Play listing, which will not exist while the app is closed-testing only. Link it once the app reaches production. |
| RevenueCat | Project + Play Store app config + public SDK key. **No service account JSON yet** (see step 3). |
| GitHub | Repo public, Pages serving `/docs`. All three URLs verified **HTTP 200**. |
| Play Console | App created. **9 of 10 App content declarations done.** Content rating **Submitted**. |

**App content — completed and verified**

| Declaration | Answer |
|---|---|
| Privacy policy | the URL above |
| Ads | **YES, contains ads** |
| Sign-in details | **No** — no sign-in exists, and no chamber or feature is locked behind payment |
| Target audience | **13-15, 16-17, 18+** — no under-13 group, so the Families programme is avoided |
| Content rating (IARC) | **Submitted.** ESRB Everyone · PEGI 3 · USK All ages · ACB · GRAC · IARC 3+ · **ClassInd (Brazil) 14+** |
| Advertising ID | **YES** — Analytics, Advertising or marketing, Fraud prevention |
| Government apps | No |
| Financial features | None |
| Health apps | None |
| Data safety | **Steps 1–3 done and saved as a draft.** Step 4 remains. |

---

## ⬜ WHAT IS LEFT

### 1. Upload the AAB — **YOURS, and it blocks the most**

```
android/app/build/outputs/bundle/release/app-release.aab
```

The browser bridge caps file uploads at **10 MB** and this AAB is
**10.6 MB**, so an agent cannot upload it. The bulk is dex — AdMob, Play
Services, Play Billing and RevenueCat — which is irreducible without
ProGuard, and this project sets `minifyEnabled false` deliberately to avoid
ProGuard surprises with exactly those SDKs.

Play Console → **Test and release → Testing → Closed testing** →
`Closed testing - Alpha` → **Create new release** → upload → opt in to Play
App Signing when offered.

> Do **not** use Internal testing. It does not count toward the 12-tester
> rule, which is the only thing setting the launch date.

**This unblocks:** in-app product creation (Play refuses to create products
until a BILLING-permission build is on a track), which in turn unblocks the
RevenueCat product wiring.

### 2. Finish Data safety — step 4, "Data usage and handling"

The draft holds steps 1–3. Step 4 needs all six rows answered. Every row is
**Collected AND Shared**, and **none is ephemeral**:

| Data type | Required? | Purposes (collected = shared) |
|---|---|---|
| Purchase history | **Users can choose** | App functionality; Account management |
| Approximate location | Required | Advertising or marketing |
| App interactions | Required | Advertising or marketing; Analytics |
| Device or other IDs | Required | Advertising or marketing; Analytics; Fraud prevention, security and compliance |
| Crash logs | Required | Fraud prevention, security and compliance |
| Diagnostics | Required | Fraud prevention, security and compliance |

Purchase history is the only *optional* row — the player chooses whether to
buy. Everything else is ad-SDK driven and cannot be turned off.

> **The rule for this form, learned expensively on Frost Tower:** after
> **every individual row**, click the form-level **Save draft**, then
> **reload** and re-read the row statuses. A dialog's own "Save" is not
> persistence — five rows once read `Completed` and only four had committed,
> because step 5 offered *two* enabled Save buttons and one belonged to a
> stale detached dialog.
>
> Also: a collapsed section's inputs are **not in the DOM at all**, so a
> checkbox query can report a tick missing when it is actually fine. Trust
> the `n/m data types selected` counters over a checkbox query.

### 3. Store listing

Nothing is filled in yet. All the copy is in `store-listing.md`, already
written for a game that has ads and purchases. Assets are ready:

- `play-assets/screenshot-1..6.png` — 1080×1920, regenerated this session
- `play-assets/feature-graphic.png` — 1024×500
- `play-assets/play-icon-512.png`

> **Play Console's asset picker needs three steps, not one.** Uploading into
> the hidden `input[type=file]` only puts the file in the asset *library*.
> You then have to click the asset row, click the `arrow_right_alt` (open
> detail), and click **Add**. Closing the panel instead discards the
> selection and the slot stays empty. The Add button's `innerText` is
> `"add_photo_alternate Add"`, so an exact `=== 'Add'` match silently fails.

### 4. Track setup

- **Countries/regions** — target all available (177 on the sibling apps).
- **Testers** — an email list, plus the feedback address
  `ahmadessam1997@gmail.com`.

### 5. Create the three in-app products (after step 1)

Play Console → Monetise → Products → **One-time products**:

| Product ID | Name | Price | Type |
|---|---|---|---|
| `remove_ads` | Remove ads | $2.99 | one-time, **non-consumable** |
| `hints_25` | 25 hints | $1.99 | one-time, **CONSUMABLE** |
| `hints_unlimited` | Never run out | $4.99 | one-time, **non-consumable** |

> `hints_25` **must be consumable.** A non-consumable would be permanently
> "owned" after the first purchase and every later pack would take the money
> and grant nothing. `www/js/billing.js` pays out per RevenueCat
> **transaction id** precisely because of this.

Then **Settings → Licence testing** → add the tester list, response
`RESPOND_NORMALLY`, so test purchases are not charged.

> That account-level Save opens a *"these changes will affect all of your
> apps"* confirmation dialog. It **must** be confirmed or the change silently
> reverts — and `element.click()` from JS does not open that dialog at all.
> Use a real mouse click.

### 6. Wire RevenueCat products (after step 5)

Create the three products by hand as the matching type, three entitlements
with the **same ids**, and a `default` offering with one Custom package per
product. `Import Products` needs Play API credentials that do not exist yet.

**Also still needed — this one produces a private key, so it is yours:**
a Google service account JSON with Play access, uploaded to RevenueCat →
Project settings → Apps → Escape 20 Chambers (Play Store).

Until it exists, every RevenueCat product reads
**`Store Status: Could not check`** and real transactions are not
server-verified. The SDK still works, so it does not block the closed test.

> **Do not download that JSON into the project folder.** Google Cloud
> defaults to the browser download directory; on a sibling project the key
> landed in the repo root, untracked but not gitignored, one `git add -A`
> away from being pushed to a public repo with access to Play financial
> data. `.gitignore` here now blocks the pattern, but do not rely on it.

### 7. Register your device as an AdMob test device — **before installing**

The build ships **real** ad unit IDs. Tapping your own live ads is invalid
traffic and the most common way to get an AdMob account suspended.

**Route A — AdMob console, no rebuild, protects the build already uploaded:**
On the phone, Settings → Google → All services → **Ads** → *Your advertising
ID*. Then AdMob → Settings → Test devices → Add → Android → paste it.

**Route B — baked in.** `www/js/config.js` → `admob.testDeviceIds`. The value
is **NOT** the advertising ID; install the build, then
`adb logcat | grep -i setTestDeviceIds` and take the **hash** the SDK logs.
Mixing the two values up silently does nothing.

### 8. The 12-tester, 14-day clock

Personal Play accounts need **12 testers opted in for 14 continuous days**
before production access.

> **Adding an address to the email list does not count.** A tester counts
> only once they open the join link on the device, accept, and install from
> Play. The 14 days start from the *twelfth install*, not from any console
> edit. On Frost Tower two lists were attached and Google still read **1**.

Opt-in link: Closed testing → Testers → *How testers join your test* → Copy
link (`play.google.com/apps/testing/com.ahmadessam.escapechambers`).

> Tester-exchange sites satisfy the count mechanically, but the production
> application asks how testers were recruited and what feedback they gave,
> and reciprocal sign-ups who never played is a known rejection reason.

---

## Build commands

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
npx cap sync android          # after ANY www/ change, or the AAB ships stale JS
.\android\gradlew.bat -p .\android bundleRelease
```

The default JDK on this machine is 17 and fails with
`invalid source release: 21`.

> **Gotcha that costs a build:** write `android/keystore.properties`
> **without a UTF-8 BOM**. PowerShell's `Set-Content -Encoding utf8` adds
> one, Java's `Properties.load` reads it as part of the first key, and
> Gradle dies with `Cannot convert 'null' to File`. Use
> `[System.IO.File]::WriteAllText($p,$s,(New-Object System.Text.UTF8Encoding $false))`.

## Verify what the browser could not

Everything below is unproven — the suite runs in Chromium, where the ad SDK
is absent and billing is the mock:

- An interstitial actually appearing after the 2nd chamber, and **not** after
  buying Remove ads.
- A rewarded video paying out +2 hints.
- A real purchase of each of the three products with a licence-tester
  account, **including buying `hints_25` twice** — that is the consumable
  path and the one with money at stake.
- **Restore purchases** after uninstall/reinstall.
- Purchases only work on a build installed **from Play**, never sideloaded.

## If a form asks how the app was built

**Not PWABuilder, not Bubblewrap.** This is **Capacitor 8** —
`MainActivity` extends `BridgeActivity`, there is no TWA anywhere, and the
web assets ship *inside* the AAB rather than being fetched from a server.
The question exists to apply Play's minimum-functionality policy to website
shells; it does not apply here. Answer **No**.

## Play Console URL corrections

| Wrong | Right |
|---|---|
| `/tracks/closed-testing` | `/closed-testing` |
| `/publishing-overview` | `/publishing` |

Deep links also **bounce to the app list** if loaded cold — load
`app-dashboard` first, then click through the left nav. `Page.captureScreenshot`
times out every few calls on this console; retrying once works.
