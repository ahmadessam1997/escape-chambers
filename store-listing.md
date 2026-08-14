# Escape: 20 Chambers — Google Play listing

Everything the Play Console asks for, with the answer already decided.
Rewritten 2026-08-13, when the game gained AdMob and in-app purchases — the
v1 copy said *"No account, no ads, nothing collected"*, which is now false and
would contradict the data-safety form.

| Field | Value |
|---|---|
| App name (30 max) | `Escape: 20 Chambers` (19) |
| Package | `com.ahmadessam.escapechambers` |
| Type | Game · Free, with ads and in-app purchases |
| Category | **Game → Puzzle** |
| Default language | en-US |
| Contact email | ahmadessam1997@gmail.com |
| Website | https://ahmadessam1997.github.io/escape-chambers/ |
| Phone | deliberately blank |

## Short description (80 max)

`Cozy escape rooms: hidden keys, UV secrets, safes and sigils. 20 chambers await.` (79)

## Full description

> Play truncates after roughly three lines on the listing, so the hook has to
> earn the tap before the bullets start.

The door slams shut behind you. The lock clicks by itself. Wonderful. 🕯️

ESCAPE: 20 CHAMBERS is a cozy, candlelit escape-room puzzler — no timers
breathing down your neck, no twitch reflexes, just a quiet room and the growing
suspicion that the rug is hiding something.

Twenty locked chambers across five strange places: a study, a cellar, a
greenhouse, an observatory, and an attic that remembers too much. Search
everything, work out what goes where, and turn the iron key.

🗝️ SEARCH, DISCOVER, ESCAPE
• Tap everything — rugs, paintings, clocks, plants, shelves, chests
• Find brass keys, UV lamps, cranks and notes, then work out where they go
• Crack rolling-dial safes using codes hidden around the room
• Switch on the UV lamp and watch ghostly ink blaze across the walls ✨
• Decode four-sigil locks woven into glowing thread

🏮 FIVE PLACES, TWENTY CHAMBERS
Each place has its own light, its own colours, its own mood. Each chamber adds
a layer to the puzzle chain — from a single hidden key in the first room to
full multi-step mysteries with safes, cranks, sigils and secrets under the rug.

💡 HINTS WHEN YOU WANT THEM
Every chamber is solvable by logic alone, and each one has been verified
solvable end to end. But if you'd rather not stare at a wall for twenty
minutes, a gentle hint always knows your next step — no spoilers.
You start with five hints, earn one for every chamber you escape for the first
time, and can always watch a short video for more.

📱 QUIET, COZY, YOURS
• Plays completely offline — on a plane, in bed, anywhere
• No account, no sign-up, no timers
• Progress saves on your device
• One-time purchases available: remove ads, stock up on hints, or never run out

Twenty chambers. One rule: everything you need is already in the room.
Can you escape them all?

## Screenshot captions

1. TWENTY LOCKED ROOMS
2. REVEAL SECRETS IN UV LIGHT
3. FIVE STRANGE PLACES
4. CRACK SAFES & SIGIL LOCKS
5. HINTS WHEN YOU NEED THEM
6. CAN YOU ESCAPE THEM ALL?

> Caption 5 previously read *"STUCK? GENTLE HINTS, NO SPOILERS"*, which
> advertised hints as unconditional. They are now a limited wallet, so the
> caption was changed rather than leave a promise the app no longer keeps.

## App content — every answer

| Question | Answer |
|---|---|
| Privacy policy URL | https://ahmadessam1997.github.io/escape-chambers/privacy-policy.html |
| Data deletion URL | https://ahmadessam1997.github.io/escape-chambers/delete-data.html |
| **Does your app contain ads?** | **YES** |
| App access | All functionality available without special access. No login exists. |
| Content rating | IARC questionnaire — everything **No** except *purchase or sale of digital goods* = **Yes** (sub-checkbox: purchases of digital goods only; not cash-convertible, no NFTs). Loot boxes **No**. Player-to-player trading **No**. |
| Expected ratings | ESRB Everyone · PEGI 3 · USK All ages · ACB General · GRAC All ages · Google Play 3+ · **ClassInd (Brazil) 14+** |
| Target audience | **13+.** Do **NOT** join the Designed for Families programme — it forbids the advertising ID this AdMob setup uses. |
| Advertising ID | **YES** — advertising, analytics, fraud prevention |
| Sign-in details | **No.** The Yes branch requires ticking *"sign-in details provide full access to all features and content"*, which cannot be ticked truthfully with no credentials to hand a reviewer. Saving fails with a bare "Your changes couldn't be saved" and the real reason only shows in the DOM. |
| Government apps | No |
| Financial features | None |
| Health features | None |
| News app | No |
| Play Games on PC opt-in | On by default; harmless for a tap-only puzzle game. Left as-is. |

> ClassInd's 14+ is driven purely by the honest "can purchase digital goods"
> answer, not by content. Every other authority returns Everyone / 3 / 3+.
> Not worth trying to argue down.

## Data safety — the exact table

Collects **and** shares; nothing is processed ephemerally.

| Data type | Collected | Shared | Required? | Purposes |
|---|---|---|---|---|
| Purchase history | Yes | Yes | **Users can choose** | App functionality; Account management |
| Approximate location | Yes | Yes | Required | Advertising or marketing |
| App interactions | Yes | Yes | Required | Advertising or marketing; Analytics |
| Device or other IDs | Yes | Yes | Required | Advertising or marketing; Analytics; Fraud prevention, security and compliance |
| Crash logs | Yes | Yes | Required | Fraud prevention, security and compliance |
| Diagnostics | Yes | Yes | Required | Fraud prevention, security and compliance |

Other answers: data **is** encrypted in transit · **no** account creation ·
**no** external logins · deletion URL provided (above).

Purchase history is the only *optional* row — the player chooses whether to
buy. Everything else is ad-SDK driven and cannot be turned off, so it is
*required*.

> **The rule for this form:** after every individual row, click the form-level
> **Save draft**, then reload and re-read the row statuses. A dialog "Save" is
> not persistence — on a sibling app five rows looked Completed and only four
> had actually committed.

## In-app products

Play Console → Monetise → Products → **One-time products**.
Play refuses to create these until a build with the BILLING permission is on a
track, so upload the AAB first.

| Product ID | Name | Price | Type | Notes |
|---|---|---|---|---|
| `remove_ads` | Remove ads | $2.99 | One-time, **non-consumable** | Silences interstitials only |
| `hints_25` | 25 hints | $1.99 | One-time, **CONSUMABLE** | Must be consumable — it is bought repeatedly |
| `hints_unlimited` | Never run out | $4.99 | One-time, **non-consumable** | Unlimited hints forever |

> `hints_25` being consumable is load-bearing. A non-consumable would be
> permanently "owned" after the first purchase and every later pack would take
> the money and grant nothing. The app pays out per RevenueCat **transaction
> id** for exactly this reason — see `www/js/billing.js`.

Price in USD and let Play auto-convert. Expect ~173 pricing regions against
177 distribution countries — those are different lists, and that is normal.

## RevenueCat

| Thing | Value |
|---|---|
| Project | `Escape 20 Chambers` — `8fc1ec67` |
| App | `Escape 20 Chambers (Play Store)` — `app6d4c25efde`, Capacitor |
| Public SDK key | `goog_GdqWuAnFGZXdSJqvndlXrAeqtNP` (in `www/js/config.js`) |
| Entitlements | one per product, **same ids** as the products |
| Offering | `default`, one Custom package per product |

Still needed (owner's step — it produces a private key): a Google service
account JSON. Until it is attached, every RevenueCat product reads
**`Store Status: Could not check`** and real transactions are not
server-verified. The SDK still works, so it does not block the closed test.

## AdMob

| Thing | Value |
|---|---|
| App | `Escape 20 Chambers`, Android, ref `3223395835` |
| App ID | `ca-app-pub-7898882561225435~3223395835` |
| Interstitial | `ca-app-pub-7898882561225435/3031824142` |
| Rewarded | `ca-app-pub-7898882561225435/3079875276` — reward **2 / hints** |

Registered as **not listed on a store**: AdMob's store search reads the
*public* Play listing, which will not exist while the app is closed-testing
only. Link it to the listing once it reaches production.

## Asset inventory

- `play-assets/screenshot-1..6.png` — 1080×1920 framed marketing shots
- `play-assets/feature-graphic.png` — 1024×500
- `play-assets/play-icon-512.png` — Play Console icon
- `assets/icon.png` + `assets/splash.png` — baked in via `@capacitor/assets`
