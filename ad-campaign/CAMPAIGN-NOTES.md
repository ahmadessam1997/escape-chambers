# Ad campaigns — Google Ads App campaigns for all six live titles

Created 2026-09-05. Creative production for paid user acquisition across the
six apps that are live in Production on Play.

```
apps.json         per-title config: copy, sampled brand colours, source shots
check-copy.js     validates headlines/descriptions against Google's limits
render.js         puppeteer renderer -> out/<slug>/*.png
out/<slug>/        9 image creatives per title (54 total)
copy/<slug>.md     paste-ready headline + description sheets
```

Regenerate everything with:

```
node ad-campaigns/check-copy.js     # must pass before you paste anything
node ad-campaigns/render.js         # or: node ad-campaigns/render.js frost-tower
```

---

## Read this first: AdMob is not where campaigns are created

This matters because it is the single most common wrong turn here, and the
AdMob UI does nothing to correct it.

**AdMob → Campaigns** is *house ads and direct-sold inventory* — free
cross-promotion that serves into **your own apps'** unsold ad slots. Google's
own description on the Linked services page:

> Create house ad campaigns to cross-promote your app. Also, set up direct
> sold campaigns to sell ad inventory directly to an advertiser.

The combined install base across all six titles is **18** (7 / 3 / 3 / 2 / 2 / 1
as of 2026-09-05). House ads would serve into approximately nothing. They cost
nothing too, so they are worth switching on *later*, once one of these titles
has real traffic — but they are not user acquisition and will not get you
installs now.

**Google Ads App campaigns** are the paid path, and they serve *onto* the AdMob
network among others (Play, Search, YouTube, Discover, AdMob/AdSense display).
That is where these creatives go. Everything below assumes that path.

---

## What you have to do yourself

Neither of these can be automated on your behalf, and both are prerequisites:

1. **Create a Google Ads account** at `ads.google.com` with
   `ahmadessam1997@gmail.com`. As of 2026-09-05 there is none — the sign-in
   redirects to a full account creation flow rather than the console.
   Skip the guided "Smart campaign" setup it pushes you into; choose **Switch
   to Expert Mode** before creating anything, or you cannot pick App campaign.
2. **Add a billing method and set a budget.** App campaigns will not serve
   without one.

Then three links, all of which are worth doing before the first campaign:

| Link | Where | Why |
|---|---|---|
| Play Console ↔ Google Ads | Play Console → Download reports / Settings → linked accounts | Install conversions get tracked automatically. Without it the campaign is optimising blind. |
| AdMob ↔ Google Ads | AdMob → Settings → Linked services | Unlocks AdMob's Campaigns tab (house ads) and joins up reporting. |
| Firebase ↔ AdMob | optional | Only needed if you want in-app event optimisation later. |

---

## Campaign settings

One campaign per title. Do not put six apps in one campaign — App campaigns
optimise per app, and the reporting becomes unreadable.

- **Campaign type:** App → **App installs** → Android → pick the app by package
- **Bidding:** start on **Maximize installs** with no target CPI. Set a target
  only once you have ~30 conversions and know what an install actually costs
  you. A target set on day one just starves the campaign.
- **Budget:** Google's own guidance is a daily budget of at least **10× your
  expected CPI**. For a free game in cheap geos that is roughly $5–15/day per
  campaign. Six campaigns at once is therefore a real monthly commitment —
  consider starting with two titles.
- **Locations/languages:** English-language countries first. These listings are
  en-US only, and serving an English ad into a non-English geo wastes spend.
- **Learning period:** leave it alone for 7–14 days. Editing assets or bids
  mid-learning resets it. This is the hardest rule to follow and the one that
  most often wrecks a first campaign.

### Assets per campaign

Google allows up to 20 images, 20 videos, 5 headlines and 5 descriptions.
Upload from `out/<slug>/`:

| File | Size | Slot it fills |
|---|---|---|
| `landscape-1200x628-a/b` | 1200×628 | landscape 1.91:1 |
| `square-1200x1200-a/b` | 1200×1200 | square 1:1 |
| `portrait-1200x1500-a/b` | 1200×1500 | portrait 4:5 |
| `mrec-300x250` | 300×250 | the dominant in-app display slot |
| `interstitial-320x480` | 320×480 | full-screen mobile interstitial |
| `leaderboard-728x90` | 728×90 | banner |

The A/B pair of each core ratio differ in composition and hook, not just
wording, so Google's asset-level reporting ("Best"/"Good"/"Low") can actually
tell you which direction won.

Text comes from `copy/<slug>.md` — all 30 headlines and 30 descriptions are
verified within the 30/90 character limits.

---

## Honest expectations

Worth knowing before you spend anything:

- **Ratings are the problem, not the creatives.** App campaign ads render the
  Play rating and review count next to your icon. Five of these six titles have
  almost no reviews, and a blank rating measurably suppresses install rate —
  you will pay a higher CPI than the same ad would cost a rated app. Getting
  the first ~20 genuine ratings is probably worth more than the first $200 of
  ad spend.
- **You cannot choose placements.** App campaigns are fully automated: no
  placement targeting, no keyword control, no manual bidding. The creatives and
  the budget are the only real levers.
- **Investment Tracker may trip a policy review.** Google Ads applies its
  financial products and services policy by *topic*, not by whether you handle
  money. A portfolio tracker is permitted, but expect a possible review and be
  ready to point at the listing showing it is a read-only tracker with no
  brokerage, advice, or transactions.
- **Adaptive Chess advertises a subscription.** The $10/year plan and the
  30-day free trial must be represented honestly — the "Free coach for a month"
  badge is accurate and the trial genuinely needs no card, so this is fine as
  written. Do not shorten it to "Free" anywhere.

---

## Video — one clip captured, and why the rest wants a human

App campaigns strongly favour video, and a campaign with **no** video asset is
locked out of YouTube inventory entirely. Videos must be hosted on **YouTube**
(unlisted is fine) and referenced by URL; you cannot upload a file to Google Ads
directly. YouTube accepts WebM, so no transcode is needed.

### What exists (captured 2026-09-05)

| Title | File | How |
|---|---|---|
| Frost Tower | `frost-tower-gameplay.webm` · 28s · 1080×1920 | browser MediaRecorder (`record-web.js`) |
| Adaptive Chess | `adaptive-chess-demo.mp4` · 26s · 720×1600 | emulator — plays 1.e4, coach replies, skin swap |
| Escape: 20 Chambers | `escape-chambers-demo.mp4` · 24s · 720×1600 | emulator — searching the cell, finds the iron key |
| CameraVault | `camera-vault-demo.mp4` · 22s · 720×1600 | emulator — scrolls the shelf, opens the Leica |
| Investment Tracker | `investment-tracker-demo.mp4` · 1080x2400 | emulator — seeded portfolio, dashboard to holdings |
| HomeKept | `homekept-demo.mp4` · 30s · 720×1600 | emulator — task detail, mark done, log cost, spending |

All six titles now have a video. 720×1600 is deliberate. At full 1080×2400 `screenrecord` starves the emulator's
frame rate badly enough to change the gameplay (see the Frost Tower note below);
dropping the capture resolution is what made the recordings usable.

### Two capture routes were built and tested

**Browser (`record-web.js`)** — `canvas.captureStream()` into `MediaRecorder`,
encoding WebM in-process. No emulator, no ffmpeg (there is none on PATH), full
frame rate. Works only for canvas-rendered games: Frost Tower has
`<canvas id="c">`; **Escape: 20 Chambers is DOM-rendered and cannot use this**.

**Emulator (`adb shell screenrecord`)** — writes MP4 on-device, also no ffmpeg
needed. Works for anything installable, but see the caveat below.

| Title | Route | Installable artifact |
|---|---|---|
| Frost Tower | browser ✔ *(captured)* | also `android/…/apk/debug/app-debug.apk` |
| Escape: 20 Chambers | emulator only (DOM-rendered) | none on disk — needs a build |
| Adaptive Chess | emulator | `app/…/apk/release/app-release.apk` (220MB) |
| CameraVault | emulator | `build/app/outputs/flutter-apk/app-release.apk` (52MB) |
| HomeKept | emulator | `homekept/8.apk` (69MB) |
| Investment Tracker | emulator ✔ *(captured)* | `tools/bundletool.jar` → `universal.apk` from the `.aab` |

CameraVault and HomeKept are **already installed** on the `Pixel_Play` AVD.

### The honest caveat: scripted play is mediocre play

Frost Tower's physics are frame-rate coupled, and `screenrecord` roughly halves
the emulator's frame rate. Identical input reached **floor 33 unrecorded** and
**floors 5–8 while recording**; dropping capture to 720×1600 recovered it to 13.
That is what motivated the browser route.

But the browser route did not fix it either, because the real limit is the input
pattern, not the frame rate. Sweeping hold durations over 22-second runs:

| hold | 600ms | 1000ms | 1600ms | 2400ms | 3200ms |
|---|---|---|---|---|---|
| floor reached | 12 | **16** | 14 | 11 | 15 |

Cadence barely matters. A fixed left/right alternation cannot sprint into walls
to rebound, which is the actual skill the game is built around, so it plateaus
around floor 15 with high run-to-run variance (the captured take ends on floor 7
with a new best score of 330 — it climbed and fell repeatedly).

**The clip is usable and shows the mechanic, combos and rising frost.** But an
ad for a skill game showing unskilled play undersells it. For the final creative
set, the better move by a wide margin is to **screen-record yourself playing
well** — Android's built-in screen recorder on a real device, one good 20–30s
run per title. That also solves Escape: 20 Chambers, CameraVault, HomeKept and
Investment Tracker in one pass, none of which are games where a script can
produce a convincing session at all.

Treat `record-web.js` as what it is: a way to get *a* usable clip into the
campaign on day one so the YouTube inventory is not locked off, to be replaced
by hand-captured footage.

---

## Source captures — fixed, and what is still weak

**Fixed 2026-09-05 on the Pixel_Play AVD.** The creatives now render from these:

- **CameraVault** — the shelf was seeded through the UI with six real bodies
  (Nikon F3 HP, Canon AE-1, Pentax K1000, Olympus OM-1, Minolta X-700, Leica M6).
  `raw/home-collection.png` now reads **6/15 · $2,210 invested · $3,850 value**
  instead of one camera at $250, and `raw/detail-leica.png` shows a real
  **+$1,150.00** gain. This was the single weakest creative in the set.
- **Adaptive Chess** — `raw/coach-mid-game.png` is a genuine position after
  1.e4 Nc6, with the move list and eval bar populated, rather than an untouched
  opening board.
- **Escape: 20 Chambers** — `raw/chamber1-2026.png` is The Cell Block with its
  deduction clue on screen; `raw/chamber1-explored.png` is the moment the mat is
  moved and the iron key appears.
- **Investment Tracker** — was the last weak one. `store-screenshots/01-dashboard.png`
  showed **+$0.00 all-time gain** next to copy promising "see your real gains".
  `tools/bundletool.jar` turned the `.aab` into an installable universal APK, and
  the portfolio was then seeded through the UI. `play-assets/raw/dashboard-live.png`
  now reads **$21,530.00 invested · $34,443.92 value · +$12,913.92 live G/L ·
  6 active**. One tile still reads `ALL-TIME G/L +$0.00` — that is honest, it
  means realised gains, and nothing has been sold. The sector pie reads
  "100% Technology" because the Energy/Medecine chips did not register on the
  seeded XOM and JNJ rows; cosmetic, and not chased.

Fixed since, and what is still blocked:

- **HomeKept** — unblocked 2026-09-06 once the owner signed in. The app opens on
  a mandatory account-creation screen, and creating accounts is not something
  Claude does, so this waited on them. After sign-in the five-question setup was
  answered (house, 10–30 years, forced-air furnace, freezing winters, yard +
  garage + basement) and six tasks were completed with real costs logged.
  `raw/dashboard-2026.png` shows a generated seasonal schedule with a
  **Pro recommended** badge and tasks dated Oct/Nov/Dec; `raw/spending-2026.png`
  shows **$147 across last-12-months / this-year / all-time** with the itemised
  cost list; `raw/task-expanded-2026.png` is the "why it matters" detail the copy
  promises. Nothing in the creative set is blocked any more.

---

## Verified 2026-09-06: the two income questions

### 1. Does Investment Tracker actually charge real users?

**Yes. Real users are billed through Google Play.** The "test cards always
successful" wording is Google Play's own license-tester payment sheet, shown
only to accounts on the Play Console tester list — not something in the app.

The confusion is understandable, because the app *does* contain a fake card
form. `src/components/CardForm.tsx:71` reads *"Test mode — no real charge. Use
4242 4242 4242 4242…"* and only Luhn-validates locally. But it is **dead code**:

```
src/config/payments.ts      PAYMENTS_LIVE = true, key 'goog_…' -> paymentsLive() === true
src/screens/PaywallScreen.tsx:17        paymentsLive() ? <LivePaywall/> : <MockPaywall/>
src/screens/SubscriptionScreen.tsx:21   paymentsLive() ? <LiveSubscription/> : <MockSubscription/>
```

`CardForm` is referenced only inside the two Mock branches, so it cannot render
while `paymentsLive()` is true. Every shipped `.aab` postdates commit `64af908`
("Wire real RevenueCat payments"), so no published build can reach it.

Confirmed on the device, not just in source: the installed universal APK built
from the shipped bundle renders **LiveSubscription** — a real RevenueCat
offering with real Play prices (Monthly $5.99 / 3 Months $16.99 / Yearly
$64.99), *"Cancel or manage in Google Play"* and *"Restore purchases"*. No card
fields anywhere. Purchases run `Purchases.purchasePackage()` → Google's native
sheet (`utils/purchases.ts`, `AuthContext.purchaseSubscription`).

**Worth doing anyway:** delete `CardForm.tsx` and the two Mock branches. They
are unreachable, but they are also the reason this question had to be asked, and
a future edit to `PAYMENTS_LIVE` would silently ship a fake payment screen.

### 2. Do ads actually serve and earn on Escape Chambers and Frost Tower?

**Yes — the integration works end to end. The problem is traffic, not plumbing.**

AdMob → Apps, both titles:

| App | Approval | Status | Ad units |
|---|---|---|---|
| Escape: 20 Chambers | Ready | Ad serving enabled | 2 active |
| Frost Tower | Ready | Ad serving enabled | 2 active |

The earlier **"Limited ad serving"** state is gone — fixed by linking the Play
listings and publishing `app-ads.txt` at the developer domain root. AdMob Home
now says *"Your account is approved… your ad serving is enabled."*

Real measured serving:

| Metric | Last 7 days | Previous 7 days |
|---|---|---|
| Requests | 153 | 467 |
| Impressions | 1 | 7 |
| Match rate | 100.00% | 100.00% |
| eCPM | US$3.07 | US$4.79 |
| Estimated earnings | US$0.00 | US$0.03 |

Per app, last 7 days: Escape 1 impression, Frost Tower 0 (7 in the prior week).
**Last month total: US$0.29.** So both apps have genuinely served paid
impressions; a 100% match rate means every eligible request was filled.

Requests (153) far exceed impressions (1) because interstitial and rewarded ads
are *pre-loaded* on a request and only count an impression when actually shown.
That gap is normal for those formats, not a bug.

**The real blocker on this income is not the ads — it is volume and payout
setup.** 18 installs across six titles cannot produce meaningful revenue, and
AdMob does not pay out until US$100. Three payment prerequisites are still
incomplete under AdMob → Home → *Steps to get paid*: identity verification, the
mailed address PIN, and bank details. At the current rate these are not urgent,
but nothing can ever be paid until all three are done.
