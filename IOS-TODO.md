# Escape Chambers — iOS release: what is ready and what is left

Prepared 2026-10-14 on Windows (no Mac). The iOS project has never been opened
in Xcode and the three Swift files below have never been compiled; the first
Codemagic build (or the GitHub Actions simulator run) is the real compile check.

**Goal: the iOS game is the same game as Android, feature for feature.**

## Ready in this folder

| What | Where |
|---|---|
| Xcode project (Capacitor 8, Swift Package Manager, no CocoaPods) | `ios/` (`npx cap add ios`, `@capacitor/ios` added to package.json) |
| Bundle id `com.ahmadessam.escapechambers`, version 1.7.2, iPhone only, portrait | `ios/App/App.xcodeproj/project.pbxproj`, `ios/App/App/Info.plist` |
| App icon 1024 (no alpha, square) and splash | `ios/App/App/Assets.xcassets` (source: `ios-assets/`, regenerate with `npx capacitor-assets generate --ios --assetPath ios-assets`) |
| Info.plist: AdMob app id, ATT prompt text, 45 SKAdNetwork ids, `ITSAppUsesNonExemptEncryption = NO`, `itms-apps` query scheme | `ios/App/App/Info.plist` |
| Optional Firebase: a build phase bundles `ios/App/App/GoogleService-Info.plist` only if it exists | pbxproj phase "Copy GoogleService-Info.plist if present" |
| Per-platform config: iOS ad units, iOS RevenueCat key, App Store ids, store links/names | `www/js/config.js` (`admob.ios`, `revenueCat.iosApiKey`, `appStoreIds`, `adUnit()`, `revenueCatKey()`, `storeUrl()`) |
| ATT request after UMP consent and before AdMob init (iOS only) | `www/js/ads.js` `_requestTracking` |
| Native win-card ad: Swift twin of `NativeAdPlugin.java` (same `ECNativeAd` name, layout and colours) | `ios/App/App/NativeAdPlugin.swift`; the app target links GoogleMobileAds 13.6.0 directly (must stay equal to the AdMob plugin's pinned version) |
| Rating: at the same moment Android shows its dialog, iOS asks Apple's native review sheet (guideline 5.6.1 forbids custom dialogs); counted as "Later" so the back-off is identical | `www/js/rate.js`, `ios/App/App/StoreReviewPlugin.swift` |
| In-app plugins registered by `MainViewController` (`SceneDelegate` and `Main.storyboard` point at it) | `ios/App/App/MainViewController.swift` |
| "More games" uses App Store links and hides games whose App Store id is unknown (a link that cannot be built is not shown) | `www/js/game.js` |
| iOS-path test: iPhone 15 viewport, `getPlatform()='ios'`, fake plugins (16 checks) | `test/ios-sim.js` |
| Real iOS Simulator run on a GitHub Mac: build, boot iPhone, launch, crash check, screenshots | `.github/workflows/ios-simulator.yml` |
| Cloud build + TestFlight upload | `codemagic.yaml` |
| Store icon, 6.9" and 6.5" screenshots, listing text | `app-store/` |

Android is unchanged: e2e 275, rate 25, native-sim 96, uv-audit 7 all pass. iOS path: ios-sim 16 pass.

## Placeholders to fill (search for `IOS_TODO`)

| Placeholder | Where | Get it from |
|---|---|---|
| `admob.ios.*` (Google TEST ids now) + `GADApplicationIdentifier` | `www/js/config.js`, `ios/App/App/Info.plist` | AdMob → Apps → Add app → iOS → "Escape Chambers"; create banner, interstitial, rewarded, rewarded interstitial, app open, native advanced. **Do not release to the App Store with the test ids: they earn nothing.** The plist app id and `admob.ios.appId` must match. |
| `IOS_TODO_RC_IOS_KEY` | `www/js/config.js` `revenueCat.iosApiKey` | RevenueCat → project "Escape 20 Chambers" → Apps → + App Store app (bundle id above, App Store Connect in-app purchase key) → public key `appl_…`. Until set, the iOS shop says "Store unavailable" (fails closed). |
| `IOS_TODO_APP_STORE_ID_*` | `www/js/config.js` `appStoreIds` | App Store Connect → each app → App Information → Apple ID (digits). Sibling games appear in "More games" once their ids are filled. |
| `IOS_TODO_CODEMAGIC_ASC_INTEGRATION_NAME` | `codemagic.yaml` | Codemagic → Team settings → Integrations → App Store Connect → the key's name |
| GoogleService-Info.plist (optional) | Codemagic env group `firebase_ios`, var `GOOGLE_SERVICE_INFO_PLIST` (base64) | Firebase → project → Add app → iOS → bundle id above |

## Console steps, in order

1. Apple Developer Program membership (US$99/yr) and the Paid Apps agreement + tax/banking in App Store Connect (needed for in-app purchases).
2. App Store Connect → Apps → + New App: iOS, name "Escape Chambers", bundle id `com.ahmadessam.escapechambers` (register it under Certificates, Identifiers & Profiles first), SKU = bundle id.
3. In-app purchases: `escapechambers_remove_ads` Non-Consumable, `hints_25` Consumable. Do not create `hints_unlimited` (retired). Details in `app-store/LISTING.md`. Remove Ads cannot be `remove_ads` on iOS: App Store product ids are unique across the developer account and Trap Jam owns it. The app still calls it `remove_ads` everywhere (save, shop, analytics); `config.js` `iosProductIds` + `storeProductId()` / `productIdFromStore()` translate at the billing boundary on iOS only (Android sends `remove_ads` as before).
4. RevenueCat: add the App Store app, import both products, add them to the `default` offering; put the `appl_` key in config.js. Entitlements keep the Play ids: **attach `escapechambers_remove_ads` to entitlement `remove_ads`** (the same entitlement the Play product uses), `hints_25` to `hints_25`.
5. AdMob iOS app and units; update config.js and Info.plist. Create the UMP consent message for iOS too (Privacy & messaging), plus an IDFA explainer message.
6. App Store Connect API key (Users and Access → Integrations → Team key, App Manager role) → add to Codemagic.
7. Commit and push this repo (it is the one Codemagic builds; `ios/` and `codemagic.yaml` must be in it). Note the repo is public: only public ids are in these files.
8. Codemagic → add the repo → run workflow `ios-app-store` → the build lands in TestFlight.
9. Fill the listing from `app-store/LISTING.md`, upload `app-store/screenshots/iphone-6.9` (and 6.5), App Privacy answers, age rating, submit for review.

## Test in TestFlight before submitting

- First launch: UMP consent (in EEA/UK), then the iOS tracking prompt, then ads load (test ads until real ids).
- Shop: products load with local prices (Remove Ads priced from `escapechambers_remove_ads`), buy Remove Ads and `hints_25` with a Sandbox tester, Restore works on a reinstall.
- Daily hint → notification permission prompt → reminder arrives.
- "More games" button hidden until sibling App Store ids exist.
- Win card shows the native ad card (test ad until real ids), and it disappears when the card closes.
- Rating: TestFlight never displays Apple's review sheet; check it in a Debug build on the simulator.
- Safe areas: notch / Dynamic Island and home indicator do not cover buttons.
- Leaving and returning after 30 s shows an app-open ad only on the rooms menu.

## Differences from Android that Apple requires

- Rating uses Apple's own review sheet instead of the custom dialog (same timing).
- The tracking (ATT) prompt appears once, after the consent form, before ads start.
- Store links open the App Store instead of Google Play.
