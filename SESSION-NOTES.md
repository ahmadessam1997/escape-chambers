# Session notes

> ## ▶ RESUME HERE (as of 2026-08-13)
>
> The game is **monetized, bug-fixed, tested and signed**, and the Play app
> exists with **9 of 10 App content declarations done** and the IARC content
> rating **submitted**.
>
> **The one thing blocking everything else is the AAB upload, and it has to
> be yours:** the browser bridge caps uploads at 10 MB and the AAB is
> 10.6 MB. Product creation — and therefore the RevenueCat product wiring —
> is gated behind having a BILLING build on a track.
>
> Ordered next steps and every gotcha are in **`GO-LIVE.md`**.
>
> `npm test` → **67 passed, 0 failed**, including an auto-solver that
> completes all 20 chambers.

---

## 2026-08-13 — monetization, five real bugs, and the publishing pipeline

The game shipped in July as free, offline, ad-free, with unlimited hints.
This session gave it a revenue model and put it on Play.

### Monetization design, and why

Owner chose **pool + rewarded + packs**: 5 hints to start, +1 for each
first-time chamber escape, +2 per rewarded video, and three one-time
products (`remove_ads` $2.99, `hints_25` $1.99, `hints_unlimited` $4.99).

- **The free faucet leads.** The out-of-hints dialog offers the video
  *first* and only then sells. A paywall that hides the free path reads as
  a trick and earns 1-star reviews.
- **+1 is awarded on FIRST clear only.** Otherwise replaying chamber I —
  which takes about ten seconds once you know where the key is — becomes a
  hint farm. `ECSave.markDone()` returns whether the clear was a first, and
  the e2e suite asserts a replay pays nothing.
- **Re-reading a hint you already paid for is free.** Hints are charged per
  puzzle *step*, not per tap, so dismissing the toast by accident does not
  cost a second hint.
- **Remove ads silences the interstitial only.** Rewarded videos stay
  reachable because they are opt-in and are the only free hint faucet;
  taking them away would punish the purchase. The shop says so, and so does
  the privacy policy.
- **Ads never appear inside a chamber** — only on the seam after the win
  card is dismissed, every 2nd chamber that took ≥20s, 90s cooldown. This is
  a concentration puzzle; an interrupt mid-search would be indefensible, and
  Play's ad policy penalises interruptive density.

### The consumable problem, which is where the money bugs live

`hints_25` is bought repeatedly, so it is a **consumable**. An entitlement
is useless for it: it would read "active" forever after the first pack and
every later pack would take the money and grant nothing.

So hints are paid out **once per RevenueCat transaction id**
(`ECSave.grantedTx`), read from `customerInfo.nonSubscriptionTransactions`.
That is what makes the grant survive the app being killed between Play
taking the money and us writing the hints, without ever paying out twice.
`_applyCustomerInfo` deliberately excludes consumables from the entitlement
mirror for the same reason.

The suite pins all of it: buying twice credits 50, and replaying the
transaction list (which every restore, every `getCustomerInfo` and every
cold start does) credits **nothing more**.

> **A deliberate trade, not an oversight.** A wiped save re-grants a paid
> hint pack from the store, because RevenueCat keeps consumable
> transactions forever. That is technically farmable by clearing app data,
> but doing so destroys all chamber progress to recover a soft currency a
> free video also hands out. Taking a paying customer's purchase away on
> reinstall is the far more expensive mistake. Asserted explicitly in the
> suite so nobody "fixes" it by accident.

**Billing fails closed.** Three states, and which one we are in is never
guessed: `mock` (gated on `isNativePlatform()===false`, so it cannot
activate in a shipped AAB), `ready`, `unavailable`. Nothing is ever granted
on a validation failure — if Play took the money but RevenueCat could not
verify it, the honest answer is "it will unlock once we can confirm it", and
Restore brings it back.

### Five real bugs, all fixed

1. **The candle swallowed taps on the drawer and the shelf.** `#glowE` is a
   105px-radius circle painted *after* both, and SVG hit-testing ignores
   gradient alpha — a fully transparent gradient stop still takes the click.
   So the right half of the drawer and the right half of the shelf were
   dead, and both are search targets: a chamber whose brass key was behind
   the shelf could look unsolvable. One `pointer-events="none"`.
   The regression test was verified to have teeth by reverting the fix and
   watching it fail.
2. **The Android hardware back button did nothing**, fell through to
   Capacitor's default and **closed the app** — including from inside an
   open safe keypad. On a puzzle game that reads as a crash. Now closes the
   topmost overlay, then returns to the menu, then exits.
3. **The hint button dereferenced a null level** before any chamber was
   opened. It is reachable the moment the app boots.
4. **Level generation was not actually seeded.** `sort(() => R() - .5)` is
   not merely a biased shuffle: `Array.prototype.sort` calls the comparator
   a number of times that depends on the engine's sort implementation, so it
   consumed an unpredictable slice of the RNG stream. Every value drawn
   afterwards — taunts, safe code, sigils — therefore differed between V8
   and the Android WebView. The "reproducible" chambers were nothing of the
   sort, and a hint written against one layout could describe another. Now
   Fisher-Yates.
5. **The safe keypad accepted a 5th digit** during the 200ms check window,
   turning a *correct* entry into a failure on fast taps. Exactly the bug
   already fixed on the sigil pad in July; the keypad was missed.

Also hardened: save data is validated and repaired on load (junk chamber
indexes dropped, negative hint counts zeroed, `unlocked` recomputed from the
`done` list so a mangled value cannot lock a player out of chambers they
finished), and v1 `esc` progress migrates.

### Testing

`test/e2e.js` — **67 assertions, 0 failures**, Puppeteer at 412×915 @2.62dpr
against the shipped `www/`, driven through real DOM click events.

The load-bearing one is an **auto-solver that completes all twenty chambers**
using only information the game shows the player: it reads the safe code out
of the note toast or the UV ink in the DOM, and the sigil order off the rug.
It never consults the generator. That is what makes "every chamber is
completable" a real claim rather than a restatement of the generator.

The server runs **in-process on an ephemeral port** — Frost Tower lost time
to a stray `node test/serve.js` holding a fixed port while the suite silently
passed against the old instance.

Two harness traps hit again, both already in the sibling notes:
`waitUntil:'networkidle0'` does not fire on this machine (`domcontentloaded`
+ a fixed settle instead), and a favicon 404 counts as a console error unless
you filter on `message.location().url` — the message *text* carries no URL.

### Screenshots — two things caught that would have shipped

1. The "shop" screenshot was **mostly sigil pad**. The sigil lock captured
   for shot 4 was still open and stacks above the shop.
2. The prices read **"$1.99 · DEV"** — the browser mock's deliberate marker,
   about to be advertised on the Play listing.

Both fixed in the generator, so a re-run cannot reintroduce them.

Captured at 770×1180 rather than a 19.5:9 slab, because of a real cosmetic
issue: **the room art is an 800×560 landscape composition inside a portrait
app**, so on a very tall screen it letterboxes and the room shrinks to about
a third of the scene area. Playable, every hotspot reachable — but sparse.
Deliberately **not** fixed this session: it is a redesign, not a bug, and
doing it after the AAB was built and verified would have invalidated all the
testing. **Top candidate for v1.1.**

### Legal — this mattered

The v1 policy said *"collects no data. None… no advertising SDKs, no
tracking of any kind"* and the listing said *"No account, no ads, nothing
collected"*. Both became false the moment AdMob shipped, and a privacy
policy that contradicts the data-safety form is one of the most reliable
ways to get a release rejected. `docs/privacy-policy.html` and
`docs/delete-data.html` are new and hosted; `privacy-policy.md` carries a
loud SUPERSEDED banner and must not be hosted.

### Gotchas from this session

- **The Play Console rescales between screenshot and click.** Two clicks
  landed on the wrong control this way — one selected iOS in AdMob when
  Android was intended. Use `find` → element refs, not screenshot
  coordinates, for anything that matters.
- **RevenueCat's project-name field is an app-store autocomplete.** Typing
  "Escape 20 Chambers" matched an unrelated App Store game and silently
  auto-filled Category *and* Platform (to Native Apple). Clear it, set the
  platform first, then type the name and press Escape to dismiss the
  dropdown.
- **The IARC questionnaire reveals questions progressively**, and a script
  that answers "the next unanswered group" will happily answer groups that
  are in the DOM but have no visible text. Every answer was re-verified
  *visually* by scrolling the whole form before submitting. Two real
  questions (loot boxes, player trading) only appeared after ticking
  "Purchases of digital goods".
- **On the IARC form, `Next` stays disabled until you click `Save`.** Every
  section read Completed and Next was still greyed out.
- **Data safety: a collapsed section's inputs are not in the DOM at all.** A
  checkbox query reported "Device or other IDs" unselected when the section
  counter said `1/1`. Trust the `n/m data types selected` counters.
- **`Runtime.evaluate` times out at 45s on the data-safety page but the work
  usually completes anyway** — the timeout is the CDP round-trip, not the
  page. Re-query state in a fresh short call before redoing anything.
- **`type="email"` inputs are missed by `input[type=text]` selectors.** Cost
  a moment of thinking the IARC email had not landed when it had.
- **The Chrome extension disconnected mid-session** (twice). The page and
  all state survived; `tabs_context_mcp` reconnected it.
- **The AAB is 10.6 MB and the browser bridge caps uploads at 10 MB.** The
  dex is 22.5 MB uncompressed — AdMob, Play Services, Play Billing,
  RevenueCat — and `minifyEnabled false` is deliberate. This is a permanent
  constraint for this project, not a one-off.

### Deliberately not done

- **`minifyEnabled` stays false.** Matches the sibling games and avoids
  ProGuard surprises with the ads and billing SDKs. Play's "no deobfuscation
  file" warning on upload is expected and fine.
- **No coin economy.** The owner asked for hints, ads and remove-ads; adding
  a soft currency changes the store's character.
- `escape-20-chambers.html` at the project root — a byte-identical stale
  copy of the pre-monetization game — was **deleted**. This is a git repo
  now, so history covers it.
