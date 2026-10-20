# Escape Chambers — App Store Connect listing (iOS)

Everything App Store Connect asks for, with the answer decided. Adapted from
`store-listing.md`, `play-listing-1.7.0-ready.txt` and `docs/privacy-policy.html`
(the Google Play sources) on 2026-10-14. Character counts are the PowerShell
`.Length` of the exact text in each block (line breaks count as 1).

Prices appear in this internal document only — never in customer-facing copy.

---

## 1. Identity

| Field | Value |
|---|---|
| Bundle ID | `com.ahmadessam.escapechambers` |
| Version | `1.7.2` |
| Build | `1` |
| SKU | `com.ahmadessam.escapechambers` |
| Primary language | English (U.S.) — `en-US` |
| Primary category | Games → **Puzzle** |
| Secondary category | Games → **Adventure** |
| Price | Free (tier 0), with in-app purchases |
| Devices | **iPhone only** (untick iPad in Xcode: `TARGETED_DEVICE_FAMILY = 1`) |
| Availability | All territories |
| Contact email | ahmadessam1997@gmail.com |
| Copyright | `2026 Ahmad Essam` |

---

## 2. App name (≤30) — 15 chars

```text
Escape Chambers
```

Same as the Play title. No chamber count in the name, by design.

## 3. Subtitle (≤30) — 30 chars

```text
Read the room. Deduce the key.
```

## 4. Promotional text (≤170) — 139 chars

```text
Thirty escape rooms where the evidence is already in front of you. No pixel hunting: read the room, deduce the hiding place, open the door.
```

Promotional text can be changed at any time without a new build.

## 5. Description (≤4000) — 2683 chars

```text
The bolt goes over from the other side. You have one look around, and everything you need is already here. 🕯️

Most escape games make you tap everything. This one tells you where to look — if you can read it.

The dust is disturbed in one place. Someone scratched a tally beside a sketch of the room. The pollen lies thick and unbroken on everything made of iron. Three facts, one conclusion, one hiding place. Work it out and open the door in a single move.

READ THE ROOM, DON'T RANSACK IT
• Every chamber gives you real evidence the moment you walk in
• Narrow seven hiding places down to one by pure deduction
• Crack safes by working the code out, not by finding it written down
• Follow a trail of clues from one discovery to the next
• Switch on the UV lamp and watch the rules blaze across the wall

THIRTY ROOMS, THIRTY WORLDS
A prison cell. A sealed tomb. An operating theatre. A lighthouse lamp room, a bank vault, a photographer's darkroom, a submarine control room, a telephone exchange, an organ loft. Every chamber is its own place, with its own objects, its own light, and its own secrets — counted in cogs, or dead stars, or levers in a locksmith's great lock.

THE HARDEST ROOMS SAVED FOR LAST
The final chambers raise the stakes: more evidence to weigh, five-digit safes with new rules to work out, and a sigil lock that does not read the way you expect.

FIVE STARS FOR A FLAWLESS ESCAPE
Every wasted move costs you a star. Escape in the fewest moves possible and the room gives up all five — then chase your own best time. Every chamber keeps its own board, so a quick win in an easy room never outranks a hard one.

HINTS ARE A RESCUE, NOT A SHORTCUT
Stuck on a clue? The first nudge is always free — it just says the same thing more plainly. Only if you are truly stuck will a hint narrow the field, and only at the very end will it name the spot. Every chamber is provably solvable by reasoning alone; the hints are there for the moment it will not click.

THE CLUE NOTEBOOK
Every clue, number, rule and sigil you find — plus what each object is made of — is kept in one notebook, free to read whenever you need it.

A NEW ROOM EVERY DAY
• The Daily Chamber: one fresh room each day, the same for every player
• Keep your streak alive — and collect a free hint every day
• Truly stuck? Skip a chamber and come back to it later

QUIET, OFFLINE, YOURS
• Plays completely offline — on a plane, in bed, anywhere
• No account, no sign-up, no timers, no pressure
• Progress and records are saved on your iPhone
• Optional in-app purchases: remove ads, or stock up on hints

Thirty rooms. One rule: everything you need is already in the room. How many can you read?
```

iOS edits vs. Play: section emoji removed (one kept); "Finished them all before? Your
progress carries over" removed (true only for updating Android players); clue
notebook (1.7.1) added; "one-time purchases" → "in-app purchases". No price, no
store name.

## 6. Keywords (≤100) — 99 chars

```text
puzzle,room,logic,deduction,mystery,clue,riddle,brain,detective,safe,code,hidden,offline,daily,mind
```

Comma-separated, no spaces, no words from the app name (`escape`, `chambers`),
no competitor names.

## 7. URLs

| Field | URL | Status |
|---|---|---|
| Support URL | https://ahmadessam1997.github.io/escape-chambers/ | live (Play listing website) |
| Marketing URL | https://ahmadessam1997.github.io/escape-chambers/ | live |
| Privacy Policy URL | https://ahmadessam1997.github.io/escape-chambers/privacy-policy.html | live — **text needs an iOS pass** (see checklist step 2) |
| Data deletion (for reference) | https://ahmadessam1997.github.io/escape-chambers/delete-data.html | live |

## 8. What's New in This Version (≤4000) — 173 chars

```text
Escape Chambers arrives on iPhone: thirty hand-built chambers, the Daily Chamber with a free daily hint, the clue notebook, and five stars waiting for every flawless escape.
```

App Store Connect hides this field for an app's very first version; keep the text
for the first update.

---

## 9. Age rating questionnaire

| Section | Question | Answer |
|---|---|---|
| In-app controls | Parental controls | No |
| In-app controls | Age assurance | No |
| Capabilities | Unrestricted web access | No |
| Capabilities | User-generated content | No |
| Capabilities | Messaging and chat | No |
| Capabilities | Advertising | **Yes** (AdMob; ad requests capped to the "General" content rating) |
| Mature themes | Profanity or crude humor | None |
| Mature themes | Horror/fear themes | None |
| Mature themes | Alcohol, tobacco, or drug use or references | None — see note |
| Medical or wellness | Medical or treatment information | No |
| Medical or wellness | Health or wellness topics | No |
| Sexuality or nudity | Mature or suggestive themes | None |
| Sexuality or nudity | Sexual content or nudity | None |
| Sexuality or nudity | Graphic sexual content and nudity | None |
| Violence | Cartoon or fantasy violence | None |
| Violence | Realistic violence | None |
| Violence | Prolonged graphic or sadistic realistic violence | None |
| Violence | Guns or other weapons | None (the armoury chamber shows racked weapons as scenery; nothing is used) |
| Chance-based activities | Simulated gambling | None |
| Chance-based activities | Contests | None |
| Chance-based activities | Gambling | No |
| Chance-based activities | Loot boxes | No |
| Made for Kids | Made for Kids | **No** (uses the IDFA; not directed at children) |

**Expected rating: 4+.** Nothing in the game is violent, frightening, sexual or
chance-based; ads are filtered to General. Note: one of thirty chambers is a wine
cellar (racks and a tasting table as scenery; nobody drinks) and another an
apothecary. That is set dressing, consistent with the Play IARC answer of "No".
If App Review disagrees, answer Alcohol… *Infrequent/Mild*, which raises the
rating to 13+; nothing else changes.

---

## 10. App Privacy (nutrition label)

Answer **"Yes, we collect data from this app"**. The data below is collected by
the SDKs (Google AdMob, Google Analytics for Firebase, RevenueCat). Gameplay
progress stays on the device and is not collected.

| Apple data type | Collected | Linked to user | Used for tracking | Purposes |
|---|---|---|---|---|
| Purchases (Purchase history) | Yes | Yes (RevenueCat anonymous app user ID) | No | App Functionality |
| Coarse Location (IP-derived, AdMob) | Yes | No | No | Third-Party Advertising |
| Email Address | No | — | — | — |
| Name | No | — | — | — |
| User ID | No | — | — | — (no account; RevenueCat's ID is anonymous and device-scoped) |
| Device ID (IDFA, IDFV, Firebase app-instance ID) | Yes | Yes | **Yes** | Third-Party Advertising; Analytics; App Functionality (fraud prevention) |
| Product Interaction | Yes | Yes | No | Analytics; Third-Party Advertising |
| Advertising Data | Yes | Yes | **Yes** | Third-Party Advertising |
| Crash Data | Yes | No | No | App Functionality |
| Performance Data | Yes | No | No | App Functionality |
| Other Diagnostic Data | Yes | No | No | App Functionality |
| Photos or Videos | No | — | — | — |

All other Apple data types (Contacts, Health, Financial Info, Precise Location,
Sensitive Info, Search/Browsing History, User Content, Audio, etc.): **Not collected**.

- **Tracking:** Yes — this app tracks (Device ID + Advertising Data, for
  Third-Party Advertising). Therefore App Tracking Transparency is required.
- **IDFA question** (in the version's App Store Connect / export pages where it is
  asked): *Yes, this app uses the Advertising Identifier* — to serve
  advertisements within the app and to attribute ad actions. It is requested
  only after the ATT prompt is granted.
- **`NSUserTrackingUsageDescription`** (Info.plist):

```text
This lets us show ads that are more relevant to you and keep the game free.
```

- `SKAdNetworkItems`: include Google's SKAdNetwork identifier list in Info.plist (AdMob requirement).

---

## 11. In-App Purchases for App Store Connect

App Store Connect → this app → Monetization → In-App Purchases. Product IDs are
the same as Play **except Remove Ads**: App Store product ids are unique across
the whole developer account and Trap Jam already owns `remove_ads`, so here it
is `escapechambers_remove_ads` (already created). The app maps it to
`remove_ads` in `www/js/config.js` (`iosProductIds`). RevenueCat entitlements
keep the Play ids: attach `escapechambers_remove_ads` to entitlement
`remove_ads`.

| Reference name | Product ID | Type | USD price (Play match) | Display name (≤30) | Description (≤45) |
|---|---|---|---|---|---|
| Remove Ads | `escapechambers_remove_ads` | Non-Consumable | $2.99 | Remove Ads (10) | Silences every ad, hint videos included. (40) |
| 25 Hints | `hints_25` | **Consumable** | $1.99 | 25 Hints (8) | A pack of 25 hints to use in any chamber. (41) |

- **Do not create `hints_unlimited`.** It was withdrawn from sale on Play on
  2026-08-18 and has no owners on iOS. The code must not show it on iOS.
- `hints_25` must be **Consumable** (bought repeatedly; the app pays out per
  transaction id). `escapechambers_remove_ads` must be **Non-Consumable** and restorable — the
  shop has a **Restore Purchases** button (Hints & extras).
- **Review screenshot** (required per product, 1290×2796 or any accepted iPhone
  size): a capture of the *Hints & extras* shop with the product row visible.
  The same screenshot can be used for both products. Review notes per product:
  "Purchased from Hints & extras on the rooms menu."
- First IAPs must be submitted **with** the app version (select them on the
  version page under "In-App Purchases and Subscriptions").
- Paid Apps Agreement, banking and tax must be active, or products stay
  "Missing Metadata"/unavailable in review.

---

## 12. App Review notes (≤4000) — 1796 chars

```text
Escape Chambers is a single-player, offline deduction puzzle game. There is no account and no login; every feature is available from the first launch. No demo account is needed.

FIRST LAUNCH
• The App Tracking Transparency prompt is shown before any ad is requested (EEA/UK users also see Google's consent form). Either answer works; declining only makes ads non-personalised.

HOW TO REACH EACH FEATURE
• Play: tap Chamber I on the rooms menu. Each escape unlocks the next chamber.
• Hints: the hint button inside a chamber. The first nudge is always free.
• Notebook: the Notebook button in a chamber's bag bar lists every clue found.
• Daily Chamber and free daily hint: the Daily chamber button on the rooms menu. The first time the daily hint is claimed, the app asks for notification permission for one local reminder (no push server is used).
• Skip: a "Stuck? Skip" button appears only after a long time in one chamber; skipping is offered via a rewarded video.
• Shop: Hints & extras on the rooms menu — Remove Ads (non-consumable), 25 Hints (consumable), and a Restore Purchases button. Purchases can be tested with any Sandbox Apple ID.
• Privacy choices (ad consent) and the daily reminder switch are also under Hints & extras.

ADS (Google AdMob)
• Banner on the rooms menu only; interstitial or rewarded interstitial between chambers; optional rewarded videos for hints or skipping; a native ad card on the escape screen; an app-open ad when returning after 30+ seconds away (menu only). Ad requests are capped to the General content rating. Remove Ads silences every format.

DATA
Gameplay progress is stored only on the device. Firebase Analytics receives gameplay events; RevenueCat handles purchase restoration. All traffic is standard HTTPS.

Contact: ahmadessam1997@gmail.com
```

Sign-in details in App Store Connect: **untick "Sign-in required"**.

---

## 13. Export compliance

Standard HTTPS only (AdMob, Firebase, RevenueCat). No custom or proprietary
encryption. Set in Info.plist:

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

App Store Connect answer: "None of the algorithms mentioned above" / exempt.
No export compliance documents needed.

## 14. Content rights

"Does your app contain, show, or access third-party content?" → **No.** All
art, chamber designs, text and audio are original work by Ahmad Essam. (Ads are
served by AdMob and are not app content.)

---

## 15. Ordered checklist — App Store Connect

1. Apple Developer → Identifiers: register App ID `com.ahmadessam.escapechambers` (capability: In-App Purchase; Push not needed — the reminder is local).
2. Update `docs/privacy-policy.html` for iOS **before** submitting: add App Store billing (Apple handles payment), the IDFA and the ATT prompt, "Settings → Privacy & Security → Tracking" for opting out, and iOS notification settings. Same URL. Push to GitHub Pages.
3. AdMob: add an **iOS** app "Escape Chambers" and create iOS ad units for the six formats (banner, interstitial, rewarded, rewarded interstitial, app open, native). Put the iOS app ID in Info.plist `GADApplicationIdentifier`. Add the iOS app to the UMP/Privacy & messaging consent form and an IDFA explainer message if wanted.
4. Firebase: add an iOS app with the bundle id; download `GoogleService-Info.plist` into the Xcode project.
5. RevenueCat: add an App Store app to the project, upload the In-App Purchase key (.p8) and App Store Connect API key, put the `appl_…` public key in `config.js` for iOS, attach the two products to the same entitlements/offering packages (`escapechambers_remove_ads` → entitlement `remove_ads`, `hints_25` → `hints_25`).
6. App Store Connect → My Apps → **+ New App**: platform iOS, name `Escape Chambers`, language English (U.S.), bundle id, SKU `com.ahmadessam.escapechambers`, full access.
7. App Information: subtitle, categories (Games → Puzzle; Adventure), content rights (No), age rating questionnaire (section 9), privacy policy URL.
8. Pricing and Availability: Free, all territories.
9. App Privacy: enter the label (section 10) and publish it.
10. Agreements, Tax and Banking: Paid Apps agreement active.
11. In-App Purchases: create `escapechambers_remove_ads` and `hints_25` (section 11) with display name, description, price, review screenshot.
12. Build: set version 1.7.2 / build 1, Info.plist keys (`NSUserTrackingUsageDescription`, `GADApplicationIdentifier`, `SKAdNetworkItems`, `ITSAppUsesNonExemptEncryption = NO`), archive in Xcode and upload; answer export compliance.
13. TestFlight: internal test on a real iPhone — ATT prompt appears before ads, Sandbox purchase + Restore Purchases work, notification permission only on first daily-hint claim.
14. Version page: screenshots (6.9" iPhone, 1320×2868 or 1290×2796; plus 6.5" if required), promotional text, description, keywords, support + marketing URLs, copyright, select the build, attach both IAPs, App Review contact + notes (section 12), sign-in not required.
15. Submit for review; release manually after approval.
