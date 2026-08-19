# Session notes

> ## ▶ RESUME HERE (as of 2026-08-17)
>
> **The game was rebuilt this session, not just published.** The owner's
> verdict on the shipped build was blunt and correct: all twenty chambers
> were one room recoloured, and finding the key was blind tapping. Both are
> now genuinely fixed — see the 2026-08-17 entry.
>
> **Current build: versionCode 7 / 1.2.0**, built, signed and verified,
> `npm test` **104 passed, 0 failed**.
>
> **What is left, and who owns it:**
>
> 1. **Upload versionCode 7.** 10,708,956 bytes — over the 10 MB agent cap,
>    so always the owner's step. versionCode 3 is what is live on the track
>    right now; 4, 5 and 6 were superseded before upload.
> 2. **The purchase bug is UNDIAGNOSED.** Report: "purchase completes,
>    nothing happens, no message". RevenueCat still reads *Credentials need
>    attention* and all three products `Store Status: Could not check`, so
>    validation fails server-side regardless of app code. The rooms menu now
>    prints `build <version> · store <state>` for exactly this — **get that
>    line off the device before touching billing code.** `store ready` means
>    the SDK reached RevenueCat and the fault is the credentials; `store
>    unavailable` means it never did, which is a different bug entirely.
> 3. **Eleven more testers.** 12 opted in for 14 continuous days, and the
>    clock starts at the *twelfth install*.
> 4. **Everything the browser cannot prove** — a real interstitial, a
>    rewarded video paying +2, buying `hints_25` twice, Restore after
>    reinstall.
>
> **Not outstanding, despite looking like it:** the AdMob test device (it is
> account-level and Frost Tower already registered it) and both consent
> messages (Published). See `GO-LIVE.md` steps 6, 7 and 7b.

---

## 2026-08-18 — the purchase bug: one unticked checkbox

Two days of "purchase completes, nothing happens" came down to a single
missing Play permission: **View app information and download bulk reports
(read only)**. Without it the service account can see no app in the
developer account, so EVERY Play API call RevenueCat makes is rejected —
validation included. Full write-up and the reusable diagnostic in
GO-LIVE.md step 10.

**RevenueCat needs three account permissions; the runbook recorded two.**
That is the whole bug. Check the sibling apps.

### What actually found it

GCP → APIs & Services → Google Play Android Developer API → **Metrics**.
Thirty days of traffic with **only 401 and 403 series and no 200 at all**
proves the key is valid and the token mints — the failure is AUTHORIZATION,
not authentication. Diffing the permission checkboxes against a WORKING
sibling account then isolated the one differing box. Neither RevenueCat nor
Play ever named the missing permission.

### Two wrong turns, recorded on purpose

- **My linked-GCP-project theory was wrong** and cost a day. Disproved by
  two different GCP projects both getting 200s from the same developer
  account. I had been confident enough to tell the owner to go and check it.
- **There is no "API access" page in this Play Console build.** The route
  redirects to the app list, no nav entry exists, and the string is absent
  from the console bundle. I burned several attempts navigating to a page
  that no longer exists.

The lesson is the same one as the redesign review: **when a system reports a
generic error, go find a source of ground truth** — here, request metrics —
rather than reasoning forward from plausible causes.

---
## 2026-08-17 — the redesign, and a review that found nine real bugs in it

The owner's two complaints about the shipped build were both correct:

> *"still the same chamber I told you change everything"*
> *"there should be clues that I can use to find the key not just search
> randomly and hints used is a final thing if I fail to understand a clue"*

**What the code actually was.** `THEMES[i]` was a NAME, a seeded palette and
a position jitter. One set of SVG furniture for all twenty rooms. The brass
key was `spots[0]` of a shuffle with nothing in the room referring to it, so
the only strategy was tapping all seven. The research agent's diagnosis was
sharper than mine: **the two complaints are one complaint** — the room's
contents carried no meaning, so themes were cosmetic *and* search was blind.

### Built by four agents, integrated by hand

- `docs/design-research.md` — sourced research on real escape-room settings
  and on clue design that replaces blind search.
- `www/js/themes.js` — **20 real settings** (cell block, sealed tomb,
  operating theatre, icehouse...), each with its own artwork, palette,
  in-world object names, three intro lines, eight taunts, and `traits` per
  searchable object. Themes map onto the EXISTING object ids as roles, which
  is why integration did not disturb hit-testing.
- `www/js/puzzle.js` — `generateKeyHunt` makes the key's location a
  **deduction** over those traits, uniqueness proved by brute force at
  generation time, plus a graduated hint ladder.
- `www/js/game.js` — `paintRoom`, the always-free observations panel, and the
  ladder replacing the two blind-search hints.

**Agents must be scoped to separate files.** Three ran in parallel on
separate files and none collided. All three then died on a session limit
*after* writing their deliverables — the work survived because it was on
disk, not in a transcript. Resuming by id worked once; a later resume failed
with "no transcript found", so a fresh agent had to be spawned with full
context. **Do not rely on being able to resume an agent.**

### Gotchas from the build

- **Parallel agents do not agree on an interface.** themes.js emitted no
  `traits`, so the key hunt silently set `degraded:true` and fell back to a
  clue that NAMES the spot — reinstating the exact bug being removed. The
  gap was invisible: both files were correct alone, and the suite passed.
- **The trait table is the one thing no test can check.** Brute force proves
  a clue set is self-consistent; nothing proves the table matches the
  drawing. A tin cup tagged `wood` makes every clue about it a lie. That is
  why the traits were written by the agent that drew the art.
- **A trait value must GROUP, never IDENTIFY.** `kind: 'great wheel'` in the
  clockworks produced *"something that is a great wheel"* — the answer,
  handed over. The rule is that a value must cover 2+ objects.
- I then reported a second instance of that bug in the taxidermist's and
  **was wrong** — `kind: 'mount'` groups three objects. My detection query
  tested "value appears in the object's name" instead of "value identifies
  one object". A fix applied on my say-so would have made the data worse.
- **`Set-Content -Encoding utf8` put a BOM on build.gradle** and Gradle died
  with `Unexpected character` at line 1, column 1. Same trap the notes
  already record for keystore.properties. Use
  `[System.IO.File]::WriteAllText($p,$s,(New-Object System.Text.UTF8Encoding $false))`.
- **Screenshots caught two things no test could:** `applyRoomStyle` was still
  using the seeded palette, so the stone cell was painted navy — art and
  colour disagreeing about what room you are in; and the footer still read
  *"Tap everything."*, the exact opposite of the new design.

### The review agent, and why it was worth running

A fifth agent reviewed the integrated result adversarially. It found **nine
real defects in work already called finished.** Worst first:

1. **The clues could not be read.** `unique`/`group` predicates carry a trait
   axis; the prose dropped it. *"A single word: 'unmatched.'"* — unmatched by
   material, nature or position? Each gives a different candidate set, and
   minimality makes those clues load-bearing, so **8 of 20 chambers could not
   be closed from the screen at all.**
2. **The paid hint stated falsehoods.** *"the ONE object whose material
   nothing else shares"* where four existed; *"exactly 2 things share a
   material"* where two separate pairs did. The predicate is a fact about the
   key's own spot; the prose asserted a fact about the room. The player paid
   and was sent to the wrong thing.
3. **Ten of twenty chambers named a substance that was not in the room.**
   `SIGNS` was ten entries written twice over; themes.js had grown to twenty
   settings. The icehouse advertised **pollen**.
4. **Six chambers shipped broken English** — *"Nothing that is records has
   been shifted"* — from twelve trait values with no phrasing entry.
5. **The suite never tested the deduction.** The auto-solver tapped all seven
   spots, so it proved the lock chain worked and proved nothing about the key
   hunt — while comments in *two* files claimed it was already deducing.
6. **`state()` returned `L` whole**, handing out `hunt.answer`, `hints`,
   `brassSpot` and the safe code, right next to a carefully sanitised view
   that was therefore decorative.
7. **Spatial clues used pre-layout anchors.** `layoutFor` permutes slots and
   MIRRORS the room in half the chambers, so *"furthest to the left"* could
   point at something drawn on the right. **56.8% of spatial clues were wrong
   once layout was applied** — it merely happened not to fire on the shipped
   twenty, which is luck, not correctness.
8. **`nearest` compared x only**, so chamber 1 — the chamber that teaches the
   player the room can be trusted — pointed at a bunk 110px away while a tin
   cup sat 87px away.
9. **220 lines of written flavour were dead.** Each setting authors intros
   and taunts; game.js used hardcoded arrays, so a player searching a
   sarcophagus in the sealed tomb read *"You find lint. Congratulations."*

All nine fixed. Two economy changes came out of it: **the first hint rung is
now free** (it restates a clue already on screen, so charging for it charges
the player to understand the rules rather than to be rescued from them — and
at tier 1 the single clue must isolate the answer, so the restatement always
gave it away), and a player with an empty wallet still gets that rung.

**The lesson worth carrying:** the suite passed **92/0** while eight chambers
were unsolvable, ten named the wrong substance, six had broken grammar, and
the solver was not testing the feature at all. **Green is not evidence when
the assertions were written by the same person who wrote the bug.** The suite
now greps the auto-solver to prove it reads no answer field, because a
comment asking nicely had already failed twice.

## 2026-08-16 — the service account, and three errors that look like one

Built the whole Google side: GCP project `escape-20-chambers`, service
account `revenuecat-play@`, both APIs, the IAM role, Play access. Full
values in `GO-LIVE.md` step 6.

### The three-step trap

RevenueCat's "service account credentials" is not one setting, it is three,
and each failure reports as if it were the previous one:

1. **Enable `androidpublisher.googleapis.com`** → without it, nothing.
2. **Enable `pubsub.googleapis.com`** → without it, upload fails with
   *"Google Cloud Pub/Sub API must first be enabled"*.
3. **Grant the service account the `Pub/Sub Admin` IAM role** → without it,
   upload fails with *"credentials do not have permissions to access the
   Google Cloud Pub/Sub API"*. **Enabling an API is not granting access to
   it.** This is the step that is easy to miss, because the error names the
   API and reads like step 2 again.

I enabled only `androidpublisher` at first, because the GCP notification
history showed Frost Tower enabling both and I acted on one. The history
was the clue and I half-used it.

### Prior art beats invention, twice

- **The AdMob test device was already registered** account-wide by Frost
  Tower, so nothing needed creating (see below).
- **A working Play service-account key already existed** —
  frost-tower's has *account-level* financial permissions, so it covers
  every app on the developer account including this one. A dedicated one
  was created anyway, by choice, for independent revocability.

**Play permissions must be ACCOUNT permissions.** All the sibling service
accounts have an empty App-permissions list; access comes from the Account
tab, which Play states grants "access to all apps in your developer
account". Granting per-app would have worked too but diverges from the
known-good shape.

**Frost Tower has no GCP IAM role for its own service account** — its
project IAM lists only the owner. It is therefore almost certainly showing
the same *Credentials need attention* banner and receiving no real-time
refund/cancellation events. Worth fixing there.

### Still open

`Store Status: Could not check` on all three products *after* everything
above was verified correct. Google documents up to **24 hours** for new
Play API access to propagate. The temptation is to re-do the setup; don't,
until a day has passed.

## 2026-08-15 (later) — RevenueCat wired, and one entitlement deliberately not created

The catalogue was built by hand: three products, a `default` offering with
three Custom packages, and **two** entitlements. Details in `GO-LIVE.md`
step 6.

### The entitlement that should not exist

The runbook said "three entitlements with the same ids". Checking
`billing.js` first showed that was wrong for `hints_25`:
`_applyCustomerInfo` mirrors only `!consumable` products, so a `hints_25`
entitlement is unreachable by construction — it would sit in the dashboard
reading permanently active and tell the next reader the opposite of how the
payout works. Two entitlements, and `hints_25 → Attach` in the products list
is the finished state.

Worth reading the code before following your own runbook: the runbook was
written before the consumable design settled, and the code is the newer
document.

### AdMob, same sitting

- **The test device was already registered and nobody needed to do anything.**
  AdMob test devices are **publisher-account-level**, so Frost Tower's entry
  already covered this game. Trying to add a second entry for the same phone
  failed with **"Test device already exists"** — it dedupes on advertising
  ID, not name. The entry was renamed to
  `Ahmad phone (all apps: Frost Tower, Escape 20 Chambers)` so the label
  stops implying it is Frost-Tower-only and nobody re-litigates this.
- **The consent gap is real and was deliberately not half-fixed.** No GDPR
  or US-state message exists, and `ads.js` never calls the UMP SDK, so
  creating one in the console would leave the dashboard reading compliant
  while no user is ever prompted. Written up as `GO-LIVE.md` step 7b.
- **AdMob deep links render an empty pane**, same as the Play Console. Load
  a settings page, then click the tab. And its **table rows paint blank**
  while the data is present — `get_page_text` returned nothing but
  `querySelectorAll('a[href*="edit"]')` had the row. Believe the DOM here;
  this is the opposite of the Play Console's data-safety form, where pixels
  beat the DOM.
- **The page reflows between screenshot and click here too** — the Platform
  radio moved ~180px left between the screenshot and the click, so the first
  attempt missed and Android stayed unselected.
- **`form_input` silently does NOT stick on the consent message-name field.**
  It set the DOM value, the screenshot showed the new name, and the message
  published as *"Untitled European regulations message"* anyway — the
  framework never registered the change. `triple_click` + `type` worked.
  Every other field on the page (RevenueCat's whole catalogue included) was
  fine with `form_input`, so this is a per-widget trap: **after publishing,
  re-read the list row, not the editor.**
- The consent editor's right-hand settings panel is **clipped off-screen** at
  1156px wide and its Publish button is simply not in the DOM. `resize_window`
  to 1600 brought it back.

### Gotchas

- **This console swallows the first click after a page load.** The product-
  type radio stayed on *Subscription* and `New Entitlement` opened nothing,
  twice each; the identical second click always worked. Screenshot after
  every selection rather than trusting the click.
- **New packages are prepended to the offering, not appended.** After
  clicking *New Package*, the empty block is at the *top*, above the one you
  just finished — easy to fill the wrong one.
- **The package identifier dropdown hides `Custom` at the bottom** under the
  subscription durations (Monthly … Lifetime), and it is not a native
  `<select>`, so a `document.querySelectorAll('select')` probe returns `[]`.
  Reading back `input.value` across the form is the reliable verification.
- `Page.captureScreenshot` timed out on roughly every third call here too.
  Retrying once always worked, exactly as on the Play Console.

## 2026-08-15 — the build went up, and the rest fell out

The owner uploaded the AAB. The closed test went live, which unblocked
products; those and licence testing were finished the same sitting.

### Gotchas

- **"This release does not add or remove any app bundles" + "can't roll out …
  doesn't allow any existing users to upgrade" are the same error.** They
  mean the release being edited has **zero** bundles. Here the AAB had gone
  to *Internal testing* while the closed-testing draft stayed empty. Nothing
  to do with signing, version codes or upgrade paths — read the second error
  as noise and go find the bundle.
- **The console's zoom level flipped by itself mid-form, three times**, and
  once it wiped a field I had just typed. Coordinate clicks are unusable
  across that; `find` → ref + `form_input` survived every flip. A stale ref
  clicked after a re-render triggered a *"Leave page?"* dialog — answer
  **Stay**, and the whole form is still intact behind it.
- **There is no consumable checkbox for one-time products.** Hunting for one
  wastes time. Consumability is an app-side decision; see `GO-LIVE.md` step 5.
- **Purchase option IDs reject underscores.** Product IDs keep `snake_case`
  to match `config.js`; the purchase options are hyphenated. Only the product
  ID is what the app and RevenueCat resolve.
- The **AI asset declaration** answer (*Don't label assets*) survived into the
  published listing.

## 2026-08-14 — finished every console step the build does not gate

Data safety step 4 (all six rows), the whole default store listing, store
settings, and the closed-test track's countries and testers. The track went
from 1 of 5 to **3 of 4**; what remains needs the AAB.

### Gotchas from this session

- **The console scrolls between the screenshot and the click.** Four clicks
  in the data-safety purpose lists landed one row *below* the intended
  checkbox — Fraud prevention instead of Advertising, Personalisation instead
  of Fraud prevention, Developer communications instead of Analytics. The
  drift is about one row (~98px) and it happens on the *first* click after a
  scroll, when the dialog is still settling. Every checkbox was therefore
  screenshotted back before saving the row, and four wrong ticks were caught
  and undone. **Never fire two positional clicks in a row without looking.**
- **A JS checkbox query lied in the opposite direction.** Querying
  `aria-checked` on the data-types step reported *Approximate location*
  unselected when the screenshot showed it plainly ticked. This is the
  sibling-notes rule restated: on this form, believe pixels over the DOM.
- **The store listing now asks for an "AI asset declaration"** before it will
  save. It is a regulatory labelling answer about who made the art, not
  something to guess — the owner confirmed *no AI*.
- **Six screenshots uploaded in one call arrive in completion order**, not
  filename order, and are added to the slot in that order. Drag-reorder works
  along a row and fails across rows; delete-and-re-add appends predictably.
  **The reliable procedure (verified 2026-08-18):** click *Add assets* to open
  the asset panel — the `input[type=file]` does not exist in the DOM until
  then, so `find` for it beforehand only ever returns the button — then call
  `file_upload` once per file, in order. Each upload auto-selects its asset,
  and it is that *selection* order that binds to the slots, not the panel's
  display order. The panel sorts "Most recent" first, so it showed 6,5,4,3,2,1
  while the slots came out 1,2,3,4,5,6. Do not read the panel and conclude the
  order is reversed.
- **Play deep links still bounce to the app list when loaded cold** — even
  `/app-content` did. Load `app-dashboard` first, then click through.
  `Page.captureScreenshot` still times out every few calls; retrying once
  always worked.

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

## 2026-08-18 (later) — store listing submitted

The new copy and the regenerated screenshots are live in review.

### What was submitted

Three changes, sent as one batch from Publishing overview:

| Item | Value |
|---|---|
| Short description | `The room tells you where to look. 20 escape rooms. Can you read them?` (69/80) |
| Full description | Rewritten around deduction (2077/4000) |
| Phone screenshots | All six replaced |

The six old assets (14 Aug) were **removed from the slots first**, then the
six new ones (18 Aug) uploaded and added. Slot order came out right on the
first try — see the corrected upload procedure above.

### Send changes, not Restart review

The submit dialog offered *Restart review* (bundle everything, adds to the
wait) or *Send changes* (queue behind the review already running since
18 August). Chose **Send changes**: versionCode 9 was already in review and
it is the build testers need for the purchase fix. Restarting would have
delayed the AAB to get the listing out marginally sooner, which is backwards.

Both now sit under *Changes in review* together — `9 (1.4.0) Start full
rollout` plus the three listing rows.

### Markdown does not render on Play

`store-listing.md` is the source of truth and is written in markdown, but the
Play fields are plain text. Pasting it verbatim renders the `**` literally and
keeps the hard wraps as real line breaks mid-sentence. The text has to be
reflowed into single-line paragraphs and stripped of emphasis before it goes
in. Watch the emoji headers specifically: splitting header from body with a
regex that keys on capitals cut `READ THE ROOM, DON'T RANSACK IT` after
`RANSACK`, leaving `IT` alone on the next line.

### Tablet slots are empty and that is fine

7-inch, 10-inch and Chromebook screenshots have never been set, so there were
no stale tablet assets to replace. Only phone shows a count (`6/8`).

### Submission confirmed

Re-read the Publishing overview after submitting. All four rows sit under
*Changes in review* together:

```
Closed testing - Alpha   9 (1.4.0)   Start full rollout
Store listings           en-US       Change short description to '...'
Store listings           en-US       Change full description
Store listings           en-US       Change Phone screenshots
```

`GO-LIVE.md` was stale in four places and has been corrected: the version row
still said "built 1.2.0 / versionCode 7, live is 3", section 9 was titled
"awaiting your upload", 7b said the consent work was awaiting upload, and
section 3 described the pre-redesign listing. A runbook that describes a state
three versions old is worse than no runbook — it reads as authoritative. It
now opens *WHAT IS LEFT* with a dated status block naming the three things
that need the owner rather than the console.

### Git has no identity configured in this repo

`git commit` fails with *Author identity unknown*; earlier commits were
authored as `Ahmad Essam <ahmadessam1997@gmail.com>` presumably via env vars.
Commits this session used `git -c user.name=... -c user.email=...` rather than
writing to the owner's config. If it should be permanent, set it repo-locally.
