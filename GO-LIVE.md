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
| RevenueCat offering | `default` — `ofrngcfc44f8e05` (Default Offering) |
| RevenueCat entitlements | `remove_ads` `entl11e1dd91f1` · `hints_unlimited` `entlad13f5e24e` |
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
| Play Console | App created. **All 10 App content declarations done** (Data safety finished 2026-08-14). Content rating **Submitted**. Store listing complete, category + contact details set, closed-test track at **3 of 4** — only the AAB is missing. |

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
| Data safety | **Done.** All 5 steps saved 2026-08-14; six data types declared collected+shared, none ephemeral. |

---

## ⬜ WHAT IS LEFT

### 1. ~~Upload the AAB~~ — **DONE 2026-08-14, by the owner**

versionCode 1 / 1.0.0 is uploaded and **live on `Closed testing - Alpha`**
(*Available to selected testers*, released 14 Aug 19:25, 177 countries).
The track is **Active**; Publishing overview reads *Last published on
14 August 2026* with no pending changes.

> **It landed on Internal testing first**, which produced two confusing
> errors on the closed-testing draft: *"This release does not add or remove
> any app bundles"* and *"You can't roll out this release because it doesn't
> allow any existing users to upgrade…"*. Both mean one thing: **the release
> you are editing contains zero bundles.** The second is only a knock-on of
> the first — it is not a signing, versionCode or upgrade-path problem.
> Fix is either *Promote release* from Internal, or *Edit release → Add from
> library*. Internal testing still holds its own copy; harmless, but it does
> **not** count toward the 12-tester rule.

Original instructions, kept for the next upload:

```
android/app/build/outputs/bundle/release/app-release.aab
```

The browser bridge caps file uploads at **10 MB** and this AAB is
**10.6 MB**, so an agent cannot upload it. The bulk is dex — AdMob, Play
Services, Play Billing and RevenueCat — which is irreducible without
ProGuard, and this project sets `minifyEnabled false` deliberately to avoid
ProGuard surprises with exactly those SDKs.

Play Console → **Test and release → Testing → Closed testing** →
`Closed testing - Alpha` → Releases tab → **Untitled release (Draft) → Edit
release** → upload → opt in to Play App Signing when offered.

> The draft release, the 177 countries and the tester list are already in
> place, so the only thing that release is missing is the bundle. The track
> reads **3 of 4 complete**; dropping the AAB in finishes it.

> Do **not** use Internal testing. It does not count toward the 12-tester
> rule, which is the only thing setting the launch date.

**This unblocks:** in-app product creation (Play refuses to create products
until a BILLING-permission build is on a track), which in turn unblocks the
RevenueCat product wiring.

### 2. ~~Finish Data safety~~ — **DONE 2026-08-14**

Saved and verified after a reload; the store-listing preview shows all six
types under both *Data shared* and *Data collected*. Recorded here because a
resubmission would need the same answers. Every row is **Collected AND
Shared**, and **none is ephemeral**:

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

### 3. ~~Store listing~~ — **DONE 2026-08-14**

App name, short description (80/80), full description (1800/4000), icon,
feature graphic and all six screenshots are live in the default en-US
listing, plus **Store settings**: category *Game → Puzzle*, contact email
`ahmadessam1997@gmail.com`, website the GitHub Pages URL, phone left blank.

> **New question this time: an "AI asset declaration" on the Review step.**
> Answered **Don't label assets** — the screenshots are Puppeteer captures of
> the real game and the owner confirmed the icon and feature graphic are not
> AI-generated. If either is ever regenerated with AI, this must change.

The copy lives in `store-listing.md`. Assets used:

- `play-assets/screenshot-1..6.png` — 1080×1920, regenerated this session
- `play-assets/feature-graphic.png` — 1024×500
- `play-assets/play-icon-512.png`

> **The asset picker is two steps, not one.** Uploading into the hidden
> `input[type=file]` only puts the file in the asset *library* — it lands
> already selected, and you then click **Add** in the panel footer to bind it
> to the slot. Closing the panel instead discards the selection and the slot
> stays empty.
>
> **Multi-file upload scrambles the order.** Six screenshots pushed in one
> `file_upload` call came back as 3,1,5,4,6,2 (upload-completion order, not
> filename order) and were added in that order. Drag-to-reorder *within a
> row* works; dragging into the second row silently no-ops. The reliable fix
> is to delete the stragglers and re-add them one at a time — each `Add`
> appends to the end.

### 4. ~~Track setup~~ — **DONE 2026-08-14**

- **Countries/regions** — all **177** targeted on `Closed testing - Alpha`.
  Tick the header checkbox, then **Save**; the rows still read *Not targeted*
  until the save lands, which is not a failure.
- **Testers** — email list `Escape 20 Chambers Closed Testers` created at
  account level and attached, feedback address `ahmadessam1997@gmail.com`.
  Creating the list opens a *"available across all apps"* confirm dialog that
  must be clicked.

> ⚠️ **The list currently holds one address — yours.** It exists to unblock
> the track, not to satisfy the 12-tester rule. See step 8.

### 5. ~~Create the three in-app products~~ — **DONE 2026-08-15**

All three exist and are **Active**, each with one purchase option:

| Product ID | Name | Price | Purchase option ID |
|---|---|---|---|
| `remove_ads` | Remove ads | $2.99 | `remove-ads` |
| `hints_25` | 25 hints | $1.99 | `hints-25` |
| `hints_unlimited` | Never run out | $4.99 | `hints-unlimited` |

Each is *Purchase type* **Buy**, *Digital content*, tax category **Digital
app sales**, multi-quantity **off**, priced in USD with Play's automatic
local conversion (tax-inclusive where applicable).

> **There is no consumable toggle in the console — do not go looking for
> one.** Play's one-time-product UI has no such field; consumability is
> decided entirely by the app. `www/js/config.js` carries
> `consumable: true` for `hints_25` and `false` for the other two, and
> `billing.js` pays out per RevenueCat **transaction id** so a repeat
> purchase credits again without ever double-paying. The old note that
> `hints_25` "must be created as CONSUMABLE" was describing app behaviour,
> not a console setting.
>
> **Purchase option IDs cannot contain underscores** (numbers, lowercase
> letters and hyphens only), so they are hyphenated while the product IDs —
> the ones the app and RevenueCat actually resolve — stay `snake_case` and
> match `config.js` exactly.

**Settings → Licence testing** — done: `Escape 20 Chambers Closed Testers`
added alongside the sibling apps' lists, response `RESPOND_NORMALLY`.
Verified by reloading the page.

> That account-level Save does open the *"These changes will affect all of
> your apps"* dialog, exactly as the sibling notes warned. Confirm it with a
> real mouse click.

### 6. ~~Wire RevenueCat products~~ — **DONE 2026-08-15**

Built by hand; `Import Products` still needs Play API credentials that do not
exist yet (see the service-account note below).

**Products** — all three under `Escape 20 Chambers (Play Store)`, the
*Google product identifier* typed to match `config.js` exactly, which makes
RevenueCat mirror it into the *RevenueCat product identifier* the SDK
resolves:

| Product | RevenueCat type |
|---|---|
| `remove_ads` | Non-consumable |
| `hints_25` | **Consumable** |
| `hints_unlimited` | Non-consumable |

**Entitlements — two, not three.** `remove_ads` and `hints_unlimited` exist
with their product attached. **`hints_25` deliberately has none.**

> The runbook used to say "three entitlements with the same ids". That was
> wrong for the consumable, and the code already knew it:
> `billing.js._applyCustomerInfo` filters the entitlement mirror on
> `!Cfg.products[k].consumable`, so a `hints_25` entitlement could never be
> read — it would only sit in the dashboard reading permanently active and
> mislead the next person. Hints are paid per transaction id instead. The
> products list is *meant* to read `hints_25 → Attach`; that empty cell is
> the design, not an unfinished step.

**Offering `default`** ("Escape 20 Chambers shop"), already flagged Default
Offering, with one **Custom** package per product — identifier, description
and product all matching:

| Package | Product |
|---|---|
| `remove_ads` | Remove ads |
| `hints_25` | 25 hints |
| `hints_unlimited` | Never run out |

> Two console quirks here. **New packages are prepended**, not appended, so
> the block you just added is at the *top* of the list. And this console
> **swallows the first click after a page load** — the product-type radio
> and `New Entitlement` both needed a second click. Screenshot after every
> selection; the second click always took.

All three products read **`Store Status: Could not check`**, which is
expected until the service account below exists.

**Service account — built 2026-08-16, waiting on Google propagation.**

There was **no** GCP project for this game; the pattern is one per app. All
of the following now exists:

| Piece | Value |
|---|---|
| GCP project | `escape-20-chambers` ("Escape 20 Chambers") |
| Service account | `revenuecat-play@escape-20-chambers.iam.gserviceaccount.com` |
| GCP IAM role | **Pub/Sub Admin** on that project |
| APIs enabled | `androidpublisher.googleapis.com` **and** `pubsub.googleapis.com` |
| Play Console | Invited as a user, **Active**, *account* permissions: View financial data + Manage orders and subscriptions |
| RevenueCat | JSON uploaded — reads *File saved* |

> **BOTH APIs are required, and this is the trap.** Enabling only
> `androidpublisher` gets you as far as *"Google Cloud Pub/Sub API must
> first be enabled"* on upload. Enabling Pub/Sub then gets you
> *"Your Google service account credentials do not have permissions to
> access the Google Cloud Pub/Sub API"* — because enabling the API is not
> the same as granting the **Pub/Sub Admin** IAM role to the service
> account. Three separate steps, three separate error messages.
>
> **Play permissions must be ACCOUNT permissions, not app permissions.**
> The sibling accounts have an *empty* App-permissions list; their access
> comes entirely from the Account-permissions tab, which Play's own help
> text says "grant access to all apps in your developer account".
>
> **Frost Tower's service account has NO GCP IAM role at all** — only the
> owner appears in its project IAM. So Frost Tower almost certainly shows
> the same *Credentials need attention* banner and has never had developer
> notifications connected. Worth fixing there too; it means no real-time
> refund or cancellation events.

**As of 2026-08-16 all three products still read `Store Status: Could not
check`.** Everything above is verified correct, so this is Google
propagation, which is documented as taking **up to 24 hours**. Do not
re-do the setup on the strength of that message alone — re-check the next
day first. Real transactions are not server-verified until it clears, but
the SDK works regardless, so it does not block the closed test.

> **Do not download that JSON into the project folder.** Google Cloud
> defaults to the browser download directory; on a sibling project the key
> landed in the repo root — it turned out to be gitignored
> (`frost-tower/.gitignore:17: frost-tower-*.json`) and was never pushed,
> but the margin was one line of config. Google also auto-disables service
> account keys it detects in public repositories.

### 7. ~~Register your device as an AdMob test device~~ — **ALREADY COVERED**

The build ships **real** ad unit IDs. Tapping your own live ads is invalid
traffic and the most common way to get an AdMob account suspended.

**This was already done — by Frost Tower, and it carries over.** AdMob test
devices are **publisher-account-level, not per-app**, so the one registered
device already gets test ads from every app under
`ca-app-pub-7898882561225435`, this game included. Nothing to add.

| Field | Value |
|---|---|
| Device | `Ahmad phone (all apps: Frost Tower, Escape 20 Chambers)` |
| Platform | Android |
| Advertising ID | `9da360bf-4ad0-41a1-b114-588f4f48e2e6` |
| Ad inspector gesture | None |

> **You cannot create a second entry for the same phone.** Attempting one
> for this game was rejected with **"Test device already exists"** — AdMob
> dedupes on the *advertising ID*, and the name is only a label. The entry
> was therefore **renamed** from `Ahmad phone (Frost Tower testing)`, which
> read as if it only covered that game, to the name above. If you ever test
> on a *different* phone, that one does need its own entry.

**Route B — baked in.** `www/js/config.js` → `admob.testDeviceIds` (still
empty, and it does not need to be filled given the above). The value is
**NOT** the advertising ID; install the build, then
`adb logcat | grep -i setTestDeviceIds` and take the **hash** the SDK logs.
Mixing the two values up silently does nothing.

### 7b. ~~GDPR / US-state consent~~ — **BUILT 2026-08-15, awaiting your upload**

Both halves are done. Neither works without the other, which is why they
were done together.

**Console — both messages Published**, each bound to **Escape 20 Chambers
only** (Frost Tower deliberately untouched):

| Message | Name | Notes |
|---|---|---|
| European regulations | `Escape 20 Chambers - EEA/UK consent` | Consent On, Manage options On, **Do not consent On for every country** |
| US state regulations | `Escape 20 Chambers - US states opt-out` | Opt out On |

Privacy policy URL required before publishing:
`https://ahmadessam1997.github.io/escape-chambers/privacy-policy.html`.

> **"Do not consent" was switched On deliberately**, via the master toggle
> at the top of the per-country list. Google warns it "may lead to lower
> consent rates", and that is the real trade — but a reject button no less
> prominent than accept is the defensible reading of GDPR, and it matches
> this game's existing refusal to use dark patterns (the out-of-hints
> dialog offers the free video *before* it sells). **Reversible** if you
> disagree: Privacy & messaging → European regulations → the message →
> *Do not consent* → Off → Publish changes.

**Code — `ads.js` now runs the UMP flow before `initialize()`.**
`_requestConsent()` calls `requestConsentInfo`, shows the form only when
`isConsentFormAvailable && status === 'REQUIRED'` (unconditional would
re-prompt every cold start), and gates preloading on `canRequestAds`. It
**always resolves** — a consent failure must not take the game's ads down,
and the commonest cause of failure is a withdrawn console message.

> **`debugGeography` is a NUMBER.** `AdConsentExecutor` reads it with
> `call.getInt()`, so `'EEA'` would silently do nothing — the identical
> failure mode to the `maxAdContentRating: 'G'` bug on Frost Tower. Ships
> as `0`; set `config.js → admob.consent.debugGeography = 1` on a test
> device to force the EEA form from outside the EEA.
>
> **`testDeviceIdentifiers` takes the SDK's *hashed* id**, the same value as
> `admob.testDeviceIds` — not the advertising ID from the AdMob console. It
> reuses that same array on purpose, so there is only one place to get it
> wrong.
>
> Unlike RevenueCat's `configure`, none of the four consent methods are
> `RETURN_NONE` — plain `@PluginMethod` in `AdMob.java`, so they return real
> promises and chaining is safe.

**`ECAds.showPrivacyOptions()` is wired** — a **Privacy choices** button in
the shop, between *Restore purchases* and *Back*, shown only when
`ECAds.privacyOptionsRequired` is true. Google serves that form only in the
EEA/UK and the opt-out US states; everywhere else the button would be dead,
which is worse than absent.

> **Not gated on `removeAds`.** Buying Remove ads silences the interstitial,
> but rewarded videos stay — so the ad SDK and its consent remain, and the
> choice must stay reachable for a paying customer too.

Three e2e assertions cover it (hidden / shown / survives `remove_ads`), and
the hidden case was **verified to have teeth** by removing the gate and
watching it fail.

**⬜ YOUR STEP — upload versionCode 2.** Built and verified already:

```
android/app/build/outputs/bundle/release/app-release.aab
10,620,569 bytes · versionCode 2 / 1.0.1 · META-INF/UPLOAD.{SF,RSA} present
```

Consent code confirmed *inside* the bundle, not merely in the source tree.
Still 10.6 MB against the 10 MB agent cap, so the upload is yours. Until it
lands, the published messages reach nobody — the shipped versionCode 1 has
no UMP call in it.

### 8. The 12-tester, 14-day clock

Personal Play accounts need **12 testers opted in for 14 continuous days**
before production access.

> **Adding an address to the email list does not count.** A tester counts
> only once they open the join link on the device, accept, and install from
> Play. The 14 days start from the *twelfth install*, not from any console
> edit. On Frost Tower two lists were attached and Google still read **1**.

Opt-in link: Closed testing → Testers → *How testers join your test* → Copy
link (`play.google.com/apps/testing/com.ahmadessam.escapechambers`).
**This section is now live** — both *Join on Android* and *Join on the web*
are present, so the link can be handed out immediately.

> As of 2026-08-15 the tester list holds **1** address (the owner's). Eleven
> more real testers must opt in, install from Play, and stay for 14
> continuous days before production access can be requested.

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
