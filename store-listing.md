# Escape Chambers — Google Play listing

Everything the Play Console asks for, with the answer already decided.
Rewritten 2026-08-13 for ads and IAP; rewritten again 2026-08-18, when the
game stopped being a search game and became a deduction game — the old copy
said "Tap everything" and "five strange places", both now false.
Updated 2026-10-02 for 1.6.0 (daily chamber, daily hint, reminder
notification, two more ad formats, analytics events) — see
**What 1.6.0 changes on the console** at the end.
Updated 2026-10-02 for **1.7.0**: ten new chambers (thirty in all) and the
rename from *Escape: 20 Chambers* to **Escape Chambers** — see
**Release notes 1.7.0** and **What 1.7.0 changes on the console** at the end.

| Field | Value |
|---|---|
| App name (30 max) | `Escape Chambers` (15) — **no chamber count in the name**, so chambers can be added without a rename. Was `Escape: 20 Chambers` up to 1.6.0. |
| Package | `com.ahmadessam.escapechambers` |
| Type | Game · Free, with ads and in-app purchases |
| Category | **Game → Puzzle** |
| Default language | en-US |
| Contact email | ahmadessam1997@gmail.com |
| Website | https://ahmadessam1997.github.io/escape-chambers/ |
| Phone | deliberately blank |

## Short description (80 max)

`The room tells you where to look. 30 escape rooms. Can you read them?` (69)

> 1.7.0: 20 -> 30. A count is fine HERE (it is information, and the
> description is edited with every content update anyway); it is only the
> app NAME that must never carry one.

> Rewritten 2026-08-18. The old line — *"Cozy escape rooms: hidden keys, UV
> secrets, safes and sigils. 20 chambers await."* — listed FEATURES. This one
> states the HOOK, which is the thing that actually changed: you are not
> hunting pixels, you are reading a room. It also poses a question, which
> converts better than an inventory.

## Full description

> Play truncates after roughly three lines, so the hook has to earn the tap
> before the bullets start.

The bolt goes over from the other side. You have one look around, and
everything you need is already here. 🕯️

**Most escape games make you tap everything. This one tells you where to look
— if you can read it.**

The dust is disturbed in one place. Someone scratched a tally beside a sketch
of the room. The pollen lies thick and unbroken on everything made of iron.
Three facts, one conclusion, one hiding place. Work it out and open the door
in a single move.

🔍 **READ THE ROOM, DON'T RANSACK IT**
• Every chamber gives you real evidence the moment you walk in
• Narrow seven hiding places down to one by pure deduction
• Crack safes by working the code out, not by finding it written down
• Follow a trail of clues from one discovery to the next
• Switch on the UV lamp and watch the rules blaze across the wall ✨

🏚️ **THIRTY ROOMS, THIRTY WORLDS**
A prison cell. A sealed tomb. An operating theatre. A lighthouse lamp room, a
bank vault, a photographer's darkroom, a submarine control room, a telephone
exchange, an organ loft. Every chamber is its own place, with its own objects,
its own light, and its own secrets — counted in cogs, or dead stars, or levers
in a locksmith's great lock.

🔐 **THE HARDEST ROOMS YET**
The last ten chambers raise the stakes: more evidence to weigh, five-digit
safes with new rules to work out, and a sigil lock that does not read the way
you expect. Finished them all before? Your progress carries over and the next
door is already open.

⭐ **FIVE STARS FOR A FLAWLESS ESCAPE**
Every wasted move costs you a star. Escape in the fewest moves possible and
the room gives up all five — then chase your own best time. Every chamber
keeps its own board, so a quick win in an easy room never outranks a hard one.

💡 **HINTS ARE A RESCUE, NOT A SHORTCUT**
Stuck on a clue? The first nudge is always free — it just says the same thing
more plainly. Only if you are truly stuck will a hint narrow the field, and
only at the very end will it name the spot. Every chamber is provably solvable
by reasoning alone; the hints are there for the moment it will not click.

📅 **A NEW ROOM EVERY DAY**
• The Daily Chamber: one fresh room each day, the same for every player
• Keep your streak alive — and collect a free hint every day
• Truly stuck? Skip a chamber and come back to it later

📱 **QUIET, OFFLINE, YOURS**
• Plays completely offline — on a plane, in bed, anywhere
• No account, no sign-up, no timers, no pressure
• Progress and records save on your device
• Optional one-time purchases: remove ads, or stock up on hints

Thirty rooms. One rule: **everything you need is already in the room.**
How many can you read?

Plain-text, paste-ready copy of the two descriptions: `play-listing-1.7.0-ready.txt`
(short 69/80, full 2616/4000).

## Screenshot captions

1. THE ROOM TELLS YOU WHERE TO LOOK
2. EVERY ROOM, ITS OWN WORLD *(was "TWENTY ROOMS, TWENTY WORLDS" — changed in 1.7.0 so no caption carries a count; `test/gen-screenshots.js` matches)*
3. DEDUCE IT — DON'T HUNT IT
4. CRACK SAFES BY REASONING
5. FIVE STARS FOR A FLAWLESS ESCAPE
6. HOW MANY CAN YOU READ?

> Captions rewritten 2026-08-18 alongside the copy. The old set advertised
> "FIVE STRANGE PLACES" (there are now twenty) and "HINTS WHEN YOU NEED THEM"
> (they are now a graduated ladder with a free first rung, and selling them as
> the headline undercuts the deduction the game is actually about).


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

> **1.6.0 check (2026-10-02): no row changes.** The custom Firebase
> Analytics events are *App interactions → Analytics*, and Firebase's
> app-instance id is *Device or other IDs → Analytics* — both rows and both
> purposes are already declared above. The reminder is a LOCAL notification
> (no push token, nothing sent off the device), so it adds no data type. The
> two new ad formats use the same AdMob SDK and collect nothing new.

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
| `remove_ads` | Remove ads | $2.99 | One-time, **non-consumable** | Silences EVERY ad format, rewarded hint videos included (since 2026-09-20) |
| `hints_25` | 25 hints | $1.99 | One-time, **CONSUMABLE** | Must be consumable — it is bought repeatedly |
| `hints_unlimited` | Never run out | $4.99 | One-time, **non-consumable** | Unlimited hints forever. **Withdrawn from sale 2026-08-18**; still honoured for owners |

> If the Play product description for `remove_ads` still says hint videos
> stay, change it: the in-app copy was corrected in 1.6.0 and the two must
> agree. **Read back 2026-10-02 — it still says "Silences the between-chamber
> ads for good. Rewarded videos stay available if you ever want extra
> hints."** Replace with e.g. "Silences every ad for good, rewarded hint
> videos included. One-time purchase."

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
| Rewarded | `ca-app-pub-7898882561225435/3079875276` — reward **2 / hints** (also the skip-chamber video) |
| Banner | `ca-app-pub-7898882561225435/5735494595` — rooms menu only |
| Rewarded interstitial | `ca-app-pub-7898882561225435/9062522207` — reward **1 / hint**, every 2nd seam ad |
| App open | `ca-app-pub-7898882561225435/1176655686` — on return after 30 s away, menu only (1.6.0) |
| Native advanced | `ca-app-pub-7898882561225435/6237410672` — card on the win screen (1.6.0) |

Registered as **not listed on a store**: AdMob's store search reads the
*public* Play listing, which will not exist while the app is closed-testing
only. Link it to the listing once it reaches production.

## What 1.6.0 changes on the console

| Where | Change |
|---|---|
| Store listing → Full description | Add the **A NEW ROOM EVERY DAY** block above (plain text, no markdown). Exact text: `play-listing-1.6.0-ready.txt`. **Not live yet (2026-10-02):** the API commit was refused (403) — the `trapjam-publisher` service account can read this app but lacks the store-listing permission. Either paste the full description in Play Console, or grant the account "Edit store listing, pricing & distribution" for this app and run `node listing.js --pkg com.ahmadessam.escapechambers --lang en-US --text "../../escape-chambers/play-listing-1.6.0-ready.txt" --commit` from `trap-jam/play-api`. |
| Privacy policy (hosted) | Push the updated `docs/privacy-policy.html` to the GitHub Pages site **before** rollout. URL unchanged. |
| Data safety | **No change** — see the 1.6.0 check under the table. |
| Ads declaration | No change (already **Yes**). |
| Permissions | The bundle now also requests `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK` (local-notifications plugin). None has a Play declaration form. `SCHEDULE_EXACT_ALARM` is deliberately stripped in the manifest, so the exact-alarm declaration does **not** apply. |
| Content rating / target audience | No change. |
| In-app products | No new products. Check the `remove_ads` description wording (note above). |
| AdMob | Two new units (app open, native advanced) — created 2026-10-02, ids in `config.js`. New units can take up to an hour to fill. |
| Firebase | Custom events appear under Analytics → Events within ~24 h; nothing to configure. Optional: mark `purchase_done` as a key event. |

## Release notes 1.7.0

Play's "What's new" box (en-US, 500 max) — paste as-is:

```
Ten new chambers — thirty in all. A darkroom, a wine cellar, a submarine control room, an apothecary, a projection booth, a printing house, an armoury, a telephone exchange, an organ loft and a locksmith's last workshop, the hardest rooms yet: more evidence to weigh, five-digit safes with new rules, and a sigil lock that reads backwards. Your progress carries over — finished chamber XX? Chamber XXI is waiting. The game is now called Escape Chambers.
```

(453 characters.)

## What 1.7.0 changes on the console

| Where | Change |
|---|---|
| Store listing → App name | `Escape: 20 Chambers` -> **`Escape Chambers`**. A title change goes through review with the release. |
| Store listing → Short + full description | Paste `play-listing-1.7.0-ready.txt` (plain text). |
| Store listing → Screenshots | Optional: shot 2's caption is now "EVERY ROOM, ITS OWN WORLD" and shot 6 (rooms menu) now shows a 6-across grid of 30 — re-run `npm run screenshots` to regenerate. |
| Release → What's new | The release notes above. |
| Privacy policy / data deletion (hosted) | Push `docs/privacy-policy.html`, `docs/delete-data.html` and `docs/index.html` (renamed, URLs unchanged) to the GitHub Pages site. |
| Data safety, content rating, ads declaration, permissions, products | **No change** — 1.7.0 adds content only, no SDKs, permissions or data flows. |
| Outside this project | Several consoles and sibling games still carry the old name; they are listed in `SESSION-NOTES.md` (1.7.0 entry). None of them affects the build — they are labels. |

## Asset inventory

- `play-assets/screenshot-1..6.png` — 1080×1920 framed marketing shots
- `play-assets/feature-graphic.png` — 1024×500
- `play-assets/play-icon-512.png` — Play Console icon
- `assets/icon.png` + `assets/splash.png` — baked in via `@capacitor/assets`
