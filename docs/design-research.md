# Design Research: Settings and Clue Design for *Escape: 20 Chambers*

Research-only document. No code was changed to produce it.

**How to read this.** Statements sourced from published designers and post-mortems are
written as *"Source X states…"* with a link. Everything expressed as a recommendation,
a worked example, or a judgement about this game specifically is **my own inference**
and is flagged **[inference]**. The two are kept apart deliberately: the sourced half is
what the industry agrees on, the inferred half is where I am being opinionated and where
you should argue with me.

---

## 0. What the current build actually does, and why the owner's two complaints are the same bug

Read before the research, because it changes what the research is *for*.

From `www/js/game.js` and `www/js/puzzle.js`:

- There are **seven searchable spots**, fixed in every chamber:
  `rug, plant, clock, pA (old map), pB (portrait), shelf (bookshelf), chest`.
- There are **four locks**: the desk drawer, the safe, the cabinet, the door
  (numeric keypad + a four-sigil symbol lock at tier 5).
- All 20 "themes" are `THEMES[i]` — a **name string**, a seeded HSL palette
  (`paletteFor`) and a seeded position jitter (`layoutFor`). The SVG furniture is one
  set of shapes for all twenty rooms. `game.js` says so in its own comment. The owner is
  right, and the code agrees with him.
- The brass key's position is `spots[0]` from a shuffle of all seven spots — i.e.
  **uniform random, with nothing anywhere in the room referring to it.**
- The puzzle's *facts* are scattered across the other spots and form a `pointsTo` trail,
  but the trail is explicitly documented as "a CONVENIENCE, never a gate", and — this is
  the crux — **the trail chains facts to facts. Its last link points at nothing.** The key
  is outside the chain by construction (`avoid` excludes the key's spot from `FACT_SPOTS`).

**[inference] The two complaints are one complaint.** The game has a *deduction layer*
(the code) and a *search layer* (the key), and only the deduction layer was ever designed.
Twenty recoloured rooms are the visible symptom; unmotivated tapping is the mechanical
symptom; the shared cause is that the room's contents carry no meaning — an object is a
container with a random payload, not a thing in a place with a history.

**[inference] One free win is already sitting in the code.** Because facts are placed in
spots that exclude the key's spot, the key is *always* in a spot that holds no fact. With
a 4-fact puzzle that is already a 3-way narrowing, and the player is never told. Surfacing
that relationship — "the key is where nothing was written" — converts an accidental
invariant into a deduction, at close to zero implementation cost. It is not tight enough
on its own (§B.1 sharpens it).

---

## Part A — Ten settings that are legible in under two seconds

### A.0 What the sources say about theme choice

[Mission Escape Games](https://missionescapegames.com/blog/what-are-the-most-popular-escape-room-themes-offered-by-the-escape-game-nyc/)
and [Escape Room Geeks](https://escaperoomgeeks.com/escape-room-themes/) both report that
the commercially durable clusters are **mystery/detective, horror/thriller,
adventure/exploration, heist, prison break, sci-fi, and ancient tomb**. Escape Room Geeks
notes for its Prison Escape entry specifically that it "emphasises minimal props where
*everything in the room is intentional*" — a sparse set is a feature, not a budget
compromise. The commercial prison build documented by
[Creative Works](https://wearecreativeworks.com/cell-block-e-behind-the-scenes/) is a
whole-room single-set design for 6–8 players, which tells you the setting carries an
hour of play on its own vocabulary.

**[inference] The selection criterion for this game is not "popular", it is
"silhouette-separable at 5 inches".** Two rooms are different if a screenshot of each,
shrunk to thumbnail and desaturated, is still tellable apart. Study / Cellar / Archive /
Muniment / Long Gallery all fail that test — they are the same brown room with different
shelves. The ten below were chosen to differ in **wall geometry, floor material, light
source, and object outline**, not just in palette.

Each spec maps to the existing seven search slots plus the four locks, so the SVG slot
system survives. Slot names are the current IDs.

---

### A.1 CELL BLOCK D — prison

The one the owner named. It is the strongest test of the whole idea, because a prison cell
genuinely has no wall safe.

| Slot | Object |
|---|---|
| `rug` (floor-large) | Straw mattress on a steel bunk frame |
| `plant` (floor-small) | Tin slop bucket |
| `clock` (wall-small) | Barred window, four bars, one filed |
| `pA` (wall-wide) | Chalked tally wall — five-bar gates, hundreds of them |
| `pB` (wall-medium) | Taped-up photograph, curling at the corners |
| `shelf` (wall-tall) | Bolted steel shelf: mess tin, enamel mug, prison bible |
| `chest` (floor-box) | Wooden footlocker, stencilled with an inmate number |

- **In-world locks.** Drawer → the **loose floor brick** with a cavity behind it.
  Safe → the **guard's steel locker** in the corridor alcove, three-wheel combination dial.
  Cabinet → the **fuse cage** on the wall. Door → the **cell gate**, a barrel-key gate lock
  plus, at tier 5, the **key-tag board** where coloured tags must be hung in order.
- **Clue surface.** Scratched tally marks; graffiti gouged into the bunk underside; a
  smuggled note in the bible's spine; the previous occupant's calendar scratched into
  plaster. **[inference] The tally wall is the single best clue surface in the whole
  document** — a number scratched in a wall is *diegetically motivated* (a man counting
  days), silent, and readable at thumbnail size.
- **Palette in words.** Institutional grey-green concrete, cold blue-white overhead light
  through a wire cage, one warm sodium wash from the corridor, rust-orange oxidation on
  every steel edge. Almost no saturation except the rust.

### A.2 THE SUBMARINE CONTROL ROOM — sunken boat, rising water

| Slot | Object |
|---|---|
| `rug` | Deck plate grating, one section lifted |
| `plant` | Diving-suit helmet on the deck |
| `clock` | Depth gauge / barometer cluster |
| `pA` | Chart table with a pinned coastal chart |
| `pB` | Ship's telegraph (Ahead Full / Stop / Astern) |
| `shelf` | Pipe run with brass valve wheels and labelled taps |
| `chest` | Torpedo crate, roped down |

- **Locks.** Drawer → chart-table drawer. Safe → the **captain's strongbox** bolted to the
  bulkhead. Cabinet → the **breaker panel**. Door → the **watertight hatch**, a wheel that
  needs a set number of turns, plus a valve-sequence lock (the symbol lock re-skinned as
  four valves).
- **Clue surface.** The **ship's log** (handwriting, dated entries, one page torn out); a
  grease-pencil scrawl on the bulkhead; depth readings; a manifest.
- **Palette.** Wet steel blue-grey, brass and verdigris green, a single red emergency lamp,
  black shadow under everything. Highlights are hard specular dots, not soft glows.

### A.3 THE ANTECHAMBER — Egyptian tomb

| Slot | Object |
|---|---|
| `rug` | Sand drift across the flagstones |
| `plant` | Canopic jar (one of four; three are on the shelf) |
| `clock` | Sun-disc relief carved into the wall |
| `pA` | Painted wall register — a procession of figures |
| `pB` | Stone stela, hieroglyph columns |
| `shelf` | Offering ledge: three canopic jars, oil lamps |
| `chest` | Sarcophagus lid, shifted a hand's width |

- **Locks.** Drawer → a **sliding stone block** in the plinth. Safe → the **reliquary niche**
  behind a rotating disc of glyphs. Cabinet → the **false door** (a real Egyptian motif).
  Door → the **portcullis stone**, raised by a counterweight; symbol lock = four cartouches.
- **Clue surface.** Carved glyphs, painted registers, a scribe's ostracon (a pot-sherd with
  ink on it), tally notches on a measuring rod.
- **Palette.** Ochre, sand, dried-blood red, lapis blue as the *only* cool colour, torchlight
  from below so shadows fall upward. No white anywhere.

### A.4 THE BACK ROOM — 1929 speakeasy behind a laundry

| Slot | Object |
|---|---|
| `rug` | Card table, hand of cards face down |
| `plant` | Brass spittoon |
| `clock` | Neon-ish bar clock, stopped |
| `pA` | Back-bar mirror with liquor bottles ranked in front |
| `pB` | Framed boxing photograph, signed |
| `shelf` | Cash register and a shelf of ledgers |
| `chest` | Crate of bootleg stamped with a distillery mark |

- **Locks.** Drawer → the **cash register till**. Safe → the **floor safe** under the rug
  (correct for this world). Cabinet → the **icebox**. Door → the **speakeasy peephole door**,
  a knock rhythm or a password wheel; symbol lock = four card suits/ranks.
- **Clue surface.** The **bookmaker's ledger**; matchbook covers; a lipstick note on the
  mirror; chalk odds on a slate board.
- **Palette.** Deep green baize, oxblood leather, brass, amber bottle glass lit from behind,
  cigarette haze. Warm and dim, one hard pool of light on the table.

### A.5 THE LAMP ROOM — lighthouse, storm outside

| Slot | Object |
|---|---|
| `rug` | Iron spiral stair head coming up through the floor |
| `plant` | Oil can and funnel |
| `clock` | Barometer beside a brass ship's clock |
| `pA` | Chart of the coast with rock hazards marked |
| `pB` | Fresnel lens panel assembly |
| `shelf` | Signal-flag locker, pigeonholes lettered |
| `chest` | Rope and lamp-oil chest |

- **Locks.** Drawer → the **keeper's desk drawer** (fine, it exists here). Safe → the
  **brass instrument case** with a combination barrel. Cabinet → the **clockwork drive
  housing** for the rotating lens. Door → the **gallery door**, storm-barred; symbol lock =
  four signal flags.
- **Clue surface.** The **keeper's logbook** — hours, weather, oil consumed. Flag semaphore.
  Notches on the oil dipstick.
- **Palette.** Storm blue-black outside, brass and glass inside, the lamp's own hot white
  sweeping across everything on a cycle. **[inference] the sweeping light is a free
  attention-director** — see §B.6.

### A.6 STATION 9 — orbital habitat, airlock antechamber

| Slot | Object |
|---|---|
| `rug` | Floor cargo net with strapped-down containers |
| `plant` | Hydroponic tray, three plants, one dead |
| `clock` | Life-support readout panel |
| `pA` | Station schematic decal on the bulkhead |
| `pB` | Crew photo board / duty roster |
| `shelf` | EVA suit rack, one suit missing |
| `chest` | Supply pod, seal cracked |

- **Locks.** Drawer → the **tool caddy**. Safe → the **sample vault**, keypad on a cold-store
  door. Cabinet → the **avionics bay**. Door → the **airlock**, needing a pressure code;
  symbol lock = four system glyphs (O₂, power, thermal, comms).
- **Clue surface.** A **maintenance log on a screen**, a handwritten sticky note stuck to a
  screen (the oldest joke in spacecraft design and instantly legible), stencilled panel
  numbers, a barcode.
- **Palette.** White panels going grey, cyan status glow, amber warning strip, hard black
  through the porthole with one blue planet-limb. Clean geometry, few curves.

### A.7 THE BAGGAGE CAR — night express, moving

| Slot | Object |
|---|---|
| `rug` | Luggage stack, straps and labels |
| `plant` | Coal scuttle beside the stove |
| `clock` | Timetable board with a station clock |
| `pA` | Route map of the line, stations named |
| `pB` | Mail sorting frame, pigeonholed by town |
| `shelf` | Parcel shelf with tied bundles |
| `chest` | Steamer trunk, hotel labels layered on it |

- **Locks.** Drawer → the **guard's ticket desk**. Safe → the **registered-mail strongbox**
  chained to the floor. Cabinet → the **brake locker**. Door → the **carriage door**, moving
  scenery beyond it; symbol lock = four destination plates.
- **Clue surface.** Luggage **tags**; the guard's waybill; punched tickets; chalked wagon
  numbers.
- **Palette.** Varnished wood, oil-lamp yellow, night-blue rushing past the window,
  soot black. **[inference] the passing window gives every chamber in this theme an
  animated element for free, which is worth a lot on a static SVG.**

### A.8 MADAME ZOLA'S WAGON — travelling fair, fortune teller

| Slot | Object |
|---|---|
| `rug` | Layered kilims on the wagon floor |
| `plant` | Beaded curtain over the rear hatch |
| `clock` | Cuckoo clock, hands wrong |
| `pA` | Astrological wall chart, houses and signs |
| `pB` | Framed carnival poster, "One Night Only" |
| `shelf` | Shelf of jars, a stuffed raven, a crystal ball |
| `chest` | Tarot cabinet / card chest |

- **Locks.** Drawer → the **card-table drawer**. Safe → the **money box** with a dial.
  Cabinet → the **automaton cabinet** (the fortune machine). Door → the **wagon door**,
  padlocked from outside; symbol lock = four tarot arcana.
- **Clue surface.** A **spread of tarot cards left on the table**; a palmistry chart; the
  ledger of who paid what; a wax-sealed prophecy.
- **Palette.** Saturated purple and crimson, candle gold, tarnished silver, everything
  patterned. **[inference] the only high-chroma room in the set — use it as a
  difficulty-spike landmark around chamber 12–14 so the player remembers where they are.**

### A.9 THE CASE ROOM — 1947 precinct, one unsolved file

| Slot | Object |
|---|---|
| `rug` | Evidence boxes stacked on the floor |
| `plant` | Hat stand with a fedora and a wet coat |
| `clock` | Institutional wall clock |
| `pA` | Cork board: photos, pins, red string |
| `pB` | City map with pins in it |
| `shelf` | Filing cabinets, one drawer half open |
| `chest` | Sealed evidence chest with a red tag |

- **Locks.** Drawer → the **filing drawer**. Safe → the **evidence lock-up cage**.
  Cabinet → the **records cabinet**. Door → the **frosted-glass office door**; symbol lock =
  four case-file stamps.
- **Clue surface.** **Typed case reports with redactions**; a witness statement; a
  photograph with something in the background; the sign-out sheet on a clipboard.
- **Palette.** Nicotine cream walls, olive green metal, one desk lamp, venetian-blind
  stripes across everything. Grey rain in the window.

### A.10 WARD SEVEN — abandoned quarantine hospital

| Slot | Object |
|---|---|
| `rug` | Iron bed, sheets thrown back |
| `plant` | Wheelchair, one wheel bent |
| `clock` | Ward clock with a cracked face |
| `pA` | Anatomical chart, peeling |
| `pB` | X-ray light box, one plate still clipped in |
| `shelf` | Medicine cabinet: bottles, a kidney dish, syringes |
| `chest` | Linen hamper |

- **Locks.** Drawer → the **nurses' station drawer**. Safe → the **narcotics cabinet**,
  the only locked thing in a real ward, with a key AND a register. Cabinet → the
  **specimen cupboard**. Door → the **ward door with a wire-glass panel** and a keypad on
  the outside — the wrong side, which is the horror; symbol lock = four ward symbols.
- **Clue surface.** The **patient chart clipped to the bed end** — temperature curve, bed
  number, dates. The drug register. A name band. **[inference] a temperature chart is a
  free line graph, which means numbers the player *reads off a picture* rather than a
  sentence — the most valuable clue surface in the whole list for a phone.**
- **Palette.** Bleached mint green tile, rust bleeding from every fixture, grey daylight
  through frosted glass, one flickering fluorescent. Desaturated to the point of grey,
  which makes any coloured element scream.

### A.11 Mapping ten settings onto twenty chambers

**[inference]** Do not build twenty settings. Build **ten settings × two variants**
(day/night, intact/flooded, occupied/abandoned) and let the tier drive the variant. Ten
distinct object vocabularies is already twenty times the variation the game has now, and
the marginal room-25 setting costs the same as room-11 while adding nothing the player
notices. Order them so the setting changes every chamber — never two prisons in a row —
because perceived variety is a function of *adjacent* difference, not of total count.

---

## Part B — Clue mechanisms that replace blind search

This is the important half. Everything below answers one question: **how does the room tell
the player where the key is, without saying "the key is in the footlocker"?**

### B.0 The vocabulary, first

[Strange Bird Immersive](https://strangebirdimmersive.com/immersology/hints-are-not-clues/)
draws the distinction the whole design rests on, and states it bluntly: **"Hints are
surrender; clues are the game."** A clue is *in-world*, discovered, free, and — their
words — **"a clue is something 100% of winning teams find."** A hint is *out-of-world*,
granted, and "feels like a defeat for the players… gifted, not discovered."

They name the failure mode this game currently has: **band-aid design** — adding puzzles
without proper clue trails, then compensating with hints. Their operational rule is that
they tracked hint statistics and **increased the in-room clue trail whenever a hint was
used by 25% or more of teams**, and that **"at the bare minimum, you need to have had a
real-life team win your game with zero hints, or your game is broken."**

[Room Escape Artist](https://roomescapeartist.com/2019/10/24/escape-room-hint-systems/)
puts the same number differently: *"If a puzzle almost always requires a hint, it's not
broken — it's broken. Fix it."* Puzzles needing hints in 50%+ of attempts need redesign.

**[inference] For a game that *sells* hints this is the single most important finding in
the document, and it is counter-intuitive: the better your clues, the more your hint packs
are worth.** A hint that rescues you from an under-clued room feels like a toll. A hint
that rescues you from a fair room you personally misread feels like a service. The
willingness to pay comes from the player believing the answer was gettable — and that
belief only exists if it usually *was*.

### B.1 Elimination — the negative-space clue

**Sourced basis.** Logic-grid construction practice: [Logic Puzzles CA](https://logicpuzzles.ca/games/logic-grid-puzzles/)
and [The Puzzle Labs](https://www.thepuzzlelabs.com/grid-puzzles/rules) state that a
well-made grid puzzle "has exactly one solution reachable through pure deduction",
"every clue is necessary", and it is "solvable from the given clues alone — no guessing".
Clue types are enumerated as *direct matches*, *direct eliminations*, and *conditional
cross-references*.

**Worked example (7 spots, 1 key).** Cell Block D. The player finds four scratched notes
during the search. Each note is a **negative statement about the key**, not a number:

> *"Not where I sleep."* (mattress)
> *"Not where the water is."* (bucket)
> *"Not behind her face."* (photograph)
> *"Not with the Book."* (shelf/bible)

Four eliminated of seven leaves three. The tally wall then carries the closer: a count of
days that, taken modulo the three survivors in the room's stated left-to-right order,
lands on one. **One solution, arrived at without a single lucky tap.**

**Why this is the right primary mechanism here [inference].** It is *already structurally
true* in the current code — facts never share a spot with the key — so the engine change
is small: re-express each fact's placement as an explicit exclusion the player can read,
and add enough exclusions that the survivor set is 1. Uniqueness can be brute-force
verified over 7 candidates, which is trivially cheap next to the existing 10,000-candidate
check in `_logic`. And it *scales with tier*: tier 1 eliminates 6 of 7 (nearly told),
tier 5 eliminates 3 and requires a second constraint to resolve the rest.

**Cost:** low. Reuses `FACT_SPOTS`, `SPOTNAME`, the existing fact-scattering, and the
existing uniqueness-by-brute-force discipline.

### B.2 The positive locator — describe the object, don't name it

**Sourced basis.** [The Codex, Rule 5](https://thecodex.ca/13-rules-for-escape-room-puzzle-design/):
*"Clues and Puzzles Should Be Clearly Linked"* — connect them "through commonality like
theme, colour, space, context, lighting, or sound", and "outright labelling works but is
less elegant". Rule 6: *"Aha! correlations should make sense"* — connections must relate to
"real life or common sense", or the puzzle becomes "do-random-action-on-object".

**Worked example.** Ward Seven. The clue surface is a patient chart. Scrawled on it:

> *"I hid it with the one that never healed."*

Six of seven objects in Ward Seven are intact. The wheelchair has a bent wheel. That is the
one that never healed. **The player solves it by looking at the picture**, not by reading
more text.

**The design rule this implies [inference].** *Every settingexports exactly one adjective
per object, and the locator clue is an adjective.* Cell Block D: the filed bar, the curling
photo, the stencilled number. Submarine: the verdigris valve, the torn-out log page. Write
the adjective list before you write the clue, not after — if two objects in a room can
both answer "the broken one", the clue has two solutions and violates Codex Rule 3.

**Anti-pattern to avoid [inference]:** locators that depend on wordplay or on the object's
*name* rather than its *appearance*. "Where the sole rests" → the mattress? the floor? the
boot? On a phone the player cannot re-scan a physical room; if the adjective is not visible
in the SVG at thumbnail size, it does not exist.

### B.3 Counting-to-index — the number you compute *is* the place

**Sourced basis.** The escape-room literature calls the general shape *chaining*:
[The Escape Revolution](https://theescaperevolution.com/linear-vs-non-linear-escape-rooms/)
describes linear flow as "you find a clue (Puzzle 1), which leads to unlocking a briefcase
(Puzzle 2), inside the briefcase is a map…" — each solve producing the next target.
Signposting is described there as "subtle visual, auditory, or thematic cues to guide
players toward related puzzle elements without explicit instructions."

**Worked example.** The Antechamber. The wall register shows a procession of figures; the
stela says *"Count the offering-bearers who carry nothing."* Answer: 4. The room's seven
objects are numbered by an in-world ordering the player can see — the four canopic jars,
the lamps, the sand — and position 4 in the offering sequence is the sarcophagus lid.
The key is under it.

**[inference] This is the mechanism that converts the existing arithmetic puzzle family
into a *locator* at almost no cost.** `_arith` and `_order` already produce a number from
scattered facts. Today that number opens the safe. Make a *second*, smaller number — or
the last digit of the same one — index the search spots in a stated in-world order. The
same found facts now answer both "where" and "what code", which is elegant, and it means
searching and deducing stop being separate activities.

**Caveat [inference]:** the ordering must be *drawn*, not asserted. "Left to right" is fine
because the player can see left to right. "In order of age" is not, because the SVG cannot
show age. Test: could a player who cannot read the language still get the ordering right?

### B.4 The trace — one thing out of place

**Sourced basis.** [Hour To Midnight](https://www.hourtomidnight.com/blog/mastering-the-art-of-hidden-clues-in-escape-room-puzzles/)
states that "a good hidden clue fits naturally into the environment, provides a subtle but
distinct signal, and advances the storyline", and that designers "leverage Gestalt
principles — such as proximity and similarity — to guide attention without overtly
pointing out solutions. For example, slight irregularities in wallpaper patterns can prompt
players to investigate further." Their placement guidance: clues perform best in
"transitional spaces — door frames, prop edges, or between decor elements" and "at eye
level or in frequently inspected zones".

[The Room](https://uxmag.com/articles/player-centric-design-the-ux-of-the-room)'s
designers describe the same idea as a perception threshold: the game uses "minimal
affordances that, ideally, just barely pass the minimum threshold needed to perceive and
understand them" — "subtle seams in an ornate panel denote a hidden door", "tiny scratch
marks in the metal show where a cover slides over a keyhole". Their framing is the line
worth pinning above the monitor: **"the design challenge is not in how the secrets should
be hidden, but in how they should be revealed."**

**Worked example.** The Baggage Car. Six trunks are covered in an even film of soot. One
has a **clean handprint** on the lid. Nothing says anything. The player taps it.

**[inference] This is the mechanism that most directly answers the owner's complaint, and
it is nearly free on an SVG:** a dust ring, a scuff arc where something was dragged, a
fresh nail among rusted ones, one straightened picture in a row of crooked ones, a
disturbed sand drift, a broken cobweb. It requires **no text at all**, which on a 5-inch
screen is worth more than any sentence.

**The hard constraint [inference]:** the trace must be visible without zooming. See §E.1 —
if the player must pinch in to see the handprint, you have built a pixel hunt with extra
steps, which is the thing you were trying to delete.

### B.5 Testimony — someone was here before you

**Sourced basis.** The escape-room glossary sources describe the **clue trail**: "a series
of clues that lead to a solution… they act like a map"
([Next-Gen Escape](https://nextgenescape.com/blogs/escape-room-tips-tricks/escape-room-clues-vs-hints)).
Escape Room Geeks' Prison Escape entry is built entirely on this device: *"break out using
messages hidden by previous inmates."*

**Worked example.** Cell Block D. The bible's spine holds a folded note in a different hand:

> *"Ruiz — they toss the locker every Thursday. Keep it where they've already looked.
> The bucket's been dry since March."*

Two facts, both diegetic: the guard's locker is *not* safe (elimination), and the bucket is
dry, hence usable as a cache (positive locator). One paragraph, in character, doing the
work of a UI tooltip.

**Why testimony beats a bare instruction [inference].** `puzzle.js` already has the LORE
table doing exactly this at the phrasing level ("*Seven dead stars marked on the chart*"
rather than "*a number, scratched deep: 7*") and its own comment says why. Testimony
generalises that from *flavour on a number* to *the delivery vehicle for the deduction*.
The prior occupant is also the cheapest source of difficulty tuning you have: a chatty
occupant is tier 1, a terse or half-burnt note is tier 5. **Same code, same generator,
different verbosity constant.**

### B.6 The sightline — the room points

**Sourced basis.** Level-design practice, catalogued by
[Jacob Ryan Wheeler](https://jacobryanwheeler.medium.com/game-level-design-35-ways-to-guide-the-player-4bbc324204f4)
among 35 guidance techniques: **leading lines** ("visual elements guide the eye toward
important gameplay areas"), **contrasting lighting** ("bright areas draw attention"),
**contrasting colours** ("defining the player's critical path"), **framing**,
**animations** ("moving elements capture attention and highlight interactive objects"),
**breadcrumbs**, **bait**, **affordances** and **anti-affordances** (boarded windows
indicate blocked paths). [GameAnalytics](https://www.gameanalytics.com/blog/five-simple-ways-use-level-design-improve-player-experience)
gives the canonical example: in *Journey*, "huge inorganic towers stand out from their
desert surroundings and lure the player towards a given point without muddying the feel of
agency." [The Level Design Book](https://book.leveldesignbook.com/process/blockout/massing/composition)
treats this as composition rather than instruction.

**Worked example.** The Lamp Room. The lighthouse beam sweeps on a cycle. Once per rotation
it rakes across the interior and, for a beat, throws the signal-flag locker into hard light
while everything else goes dark. Nothing is written. The eye goes there.

Second example, static: The Case Room. Red string on the cork board runs from three photos
and converges on one pin — and that pin is stuck through the **city map**, which is a
searchable object. The composition points.

**[inference] This is the highest-value technique the current build uses zero of, and it
is pure SVG:** an animated `<animateTransform>` sweep, a `filter` brightness pulse, a line
of shadow, an off-axis object among aligned ones. It also degrades gracefully — a player
who does not consciously notice the beam still looks where it landed. Use it as the
*silent* layer under every explicit clue: **sightline says "here", the written clue says
"and here is why".**

**Danger [inference]:** do not use a persistent glow/outline on the target. That is not a
clue, it is the answer with extra steps, and it teaches the player that clues are
decoration. Reserve outline-glow for hint rung 3 (§C).

### B.7 Cross-reference — two facts, one place

**Sourced basis.** [The Case of the Golden Idol](https://www.gamedeveloper.com/design/case-of-the-golden-idol)'s
developers state they deliberately built redundancy: **"Often players can arrive at the
same conclusion by observing different clues, which makes the game very enjoyable to
watch."** They also describe the discipline of *removing* over-powered clues: during
testing, if players "would bypass many steps with a single clue, the developers removed
that clue because it was making parts of the game superfluous." And their support layer is
structural rather than granted — the fill-in-the-blank interface "is not completely blank —
it offers a lot of grammatical and semantic context."

**Worked example.** Station 9. The duty roster says Voss had the night watch. The EVA suit
rack has seven suits, six named, one gap. The gap's nameplate reads VOSS. The supply pod's
seal log records one unlogged opening at 0300. The key is in the supply pod: the person who
was awake opened the thing that was opened while everyone slept.

**[inference] This is the mechanism that makes a room feel *intelligent* rather than
*obedient*, and it is also the one most likely to be mis-tuned.** Two facts that each halve
the field is a good puzzle; three facts where any two suffice (Golden Idol's redundancy) is
a *forgiving* good puzzle and is what you want for a mobile audience playing in four-minute
sessions. Deliberately over-clue by one, then cut only if testing shows the room solves
instantly.

### B.8 Anti-mechanisms — things that look like clue design and are not

**The red herring.** [Room Escape Artist's dedicated piece](https://roomescapeartist.com/2019/02/10/red-herrings/)
catalogues the types — *fake puzzles* ("demoralising… why didn't you just integrate this
into the game?"), *ghost puzzles* (leftover props from removed puzzles), *puzzle
lookalikes* (which "punish player exploration"), and *irrelevant cool objects*. It quotes
designer Eric Harshbarger: **"I never design with red herrings. The players will create
their own."** Its principle: difficulty should come from "challenging, interesting, and
clean puzzles", not from obscurity. Other sources are softer — some suggest capping a red
herring's lifetime to "30 seconds to a minute" and pairing each decoy with a direct hint —
but the strong claim from the same corpus is that red herrings "make the entire mechanic of
escape rooms ambiguous — players can no longer trust that the puzzles designers give them
are important." The Codex lists "avoid red herrings" under Rule 13.

> **[inference] Verdict for this game: zero red herrings, no exceptions.** In a physical
> room with 200 objects a decoy costs 0.5% of the player's attention. In a chamber with
> **seven** searchable spots, one decoy is **14% of the entire room** and, worse, it
> directly attacks the one thing you are trying to build: the player's belief that objects
> mean something. You cannot simultaneously teach "the room tells you where to look" and
> "sometimes the room lies to you."

**The UV-lamp reveal, used as a locator.** Tiers 4–5 currently gate the code behind a UV
lamp that makes it glow on a wall item (`UVEL: pA→uvA, pB→uvB, clock→uvC`).
**[inference] This is a *filter*, not a clue.** It answers "can you see it yet?" rather
than "can you work out where it is?" — the player still sweeps all three CLUE spots. Keep
UV as a *reveal* for content whose location has already been deduced (atmospheric, feels
great), and never as the mechanism that decides which of three places to look.

**Time-release reveals.** [Room Escape Artist](https://roomescapeartist.com/2019/10/24/escape-room-hint-systems/)
notes time-triggered help suffers "imprecision, redundant information delivery, and
dragging slower teams through experiences". **[inference] On mobile it is worse, because
sessions are interrupted** — the player who put the phone down for a bus is not the player
who is stuck.

### B.9 The catalogue, condensed

| # | Mechanism | Answers | Text needed | Fits this game |
|---|---|---|---|---|
| B.1 | Elimination set | narrows to 1 of 7 | short lines | **Primary.** Already structurally present |
| B.2 | Positive locator (adjective) | names 1 of 7 | one phrase | **Primary.** Needs per-theme adjective list |
| B.3 | Count-to-index | computes 1 of 7 | one rule | **Strong.** Reuses `_arith`/`_order` |
| B.4 | Trace / out-of-place | shows 1 of 7 | **none** | **Strong.** Best value per byte |
| B.5 | Testimony | carries B.1/B.2 | a paragraph | **Strong.** Extends existing LORE |
| B.6 | Sightline / composition | biases toward 1 | none | **Strong.** Silent under-layer |
| B.7 | Cross-reference | 2 facts → 1 | medium | **Tier 4–5 only** |
| — | Red herring | nothing | — | **Never** |
| — | UV as locator | nothing | — | **Demote to flavour** |

---

## Part C — The hint ladder

### C.0 What the sources establish

- **Progressive disclosure is the norm, not a nicety.** *The Room*'s hints
  ([UX Magazine](https://uxmag.com/articles/player-centric-design-the-ux-of-the-room))
  "are structured to progressively become more direct, growing from gentle nudging to
  explicitly spelling out the solution", across three to four steps, which lets players
  "still claim partial credit for solving the puzzle". The designers' framing: hints are
  "a safety net so that you can get past the odd mental block".
- **The three-rung shape is well established outside games too.** A documented
  Connections-style ladder runs **tier 1 nudge** ("vague thematic clues… a gentle compass
  heading"), **tier 2 light spoiler** ("name the category logic and flag one trap word…
  so you can course-correct"), **tier 3 full reveal**
  ([Connections Hintz](https://www.connectionshintz.com/blog/connections-hint-today)).
  The same source reports **~60% of users stop at tier 1 or 2 and finish on their own**,
  and treats that ratio as the calibration target.
- **Hard caps backfire.** Room Escape Artist's hint-systems survey notes the traditional
  3-hint cap and that hard-limiting hints creates "hopeless deadlocks where absolutely no
  one is having fun".
- **Delivery tone matters as much as content.** Same source, on the PA-delivered hint:
  "any hint of sarcasm or disdain will make things uncomfortable."
- **Feedback is separate from hinting.** Codex Rule 10: puzzles should indicate success or
  failure, and "feedback cuts down hint requests and increases satisfaction with
  self-solving." Golden Idol's "*two or fewer slots are incorrect*" indicator is the same
  idea — reward for being close, without revealing.

### C.1 What the current build does

`nextHint()` returns `puzzle.hintText` plus `nextStepHint()`, which resolves to
` You are still missing one: look at the <spotName>.` — i.e. **one rung, and that rung
names the place.** There is a small mercy (re-reading a paid hint in the same chamber is
free, via `S.paidHints`). **[inference] This is a one-rung ladder whose only rung is the
bottom one: the player pays, and in exchange stops playing.** It is exactly the shape the
owner objects to and exactly the shape that makes hint packs feel extortionate — because
the purchase does not *help you solve it*, it *solves it*.

### C.2 The recommended ladder

Three rungs, escalating within a single chamber. Rung 1 is **always free** — my strong
recommendation, argued in C.3.

---

**RUNG 1 — RE-READ. Free. Restates the clue you already have, in different words.**

Gives away nothing the room did not already say. Its job is to break a
*misreading*, which is the most common reason a fair puzzle stalls.

> *"You've read the tally wall. Ruiz wasn't counting days — he was counting something
> he could see from where he slept."*

> *"The chart's rule is about the order you found the numbers in, not the order they're
> written on the page."*

Implementation shape **[inference]:** every clue gets a `restate` string authored beside
its `ruleText`. If you write the clue and cannot write a restatement that helps without
telling, the clue is under-specified — the restatement is a **design test**, not just a
feature.

---

**RUNG 2 — NARROW. Costs 1 hint. Removes candidates; never names the answer.**

This is the rung the ladder exists for. It must halve the field and leave a real decision.

> *"Three places in this cell have never been touched by water. It's in one of those."*
> (7 → 3)

> *"You have three of the four numbers. The last one was written by someone who was
> counting, not writing."* (points at the tally surface without naming the spot)

> *"Your code is close — two of your three digits are right."* (the Golden Idol move; see
> C.4 on why this needs care with a keypad)

Implementation shape **[inference]:** rung 2 is generated, not authored — it is a
*projection of the solver*. You already have `solveFromFacts`; a narrowing hint is that
solver run one step and truncated. For the locator, it is literally "print the surviving
candidate set minus one".

---

**RUNG 3 — TELL. Costs 2 hints. Names the place or gives the code, plus the reason.**

> *"The key is inside the tin bucket. Ruiz wrote that it had been dry since March —
> the only place in the cell the guards never emptied."*

Always append the **because**. **[inference] The "because" is not politeness, it is
retention engineering:** a player who is told *why* has learned the room's grammar and will
solve chamber 12 unaided. A player who is told only *where* has learned that hints are the
solution mechanism and will buy the pack and then churn, which is the worst possible
outcome for a hint-pack business.

---

### C.3 The hint economy, and why rung 1 must be free

Academic and trade sources on monetisation converge on the same warning.
[Springer, *Journal of Business Ethics*](https://link.springer.com/article/10.1007/s10551-021-04970-6)
categorises 35 predatory techniques across eight domains, including **"monetisation of
basic quality of life"** — charging for things that should be part of the base experience.
Trade commentary ([Gamesforum](https://www.globalgamesforum.com/news-media/the-paywall-how-much-is-it-a-marketing-problem))
frames it as perception: "the problem isn't price. It's perception… perceived value matters
more", and warns that "if you see patterns of complaints about hitting paywalls or feeling
forced to spend, you've pushed too hard."

**[inference] Rung 1 is quality of life, not content.** It restates information the player
already owns. Charging for it is precisely "monetisation of basic quality of life", it will
show up in one-star reviews as *"you have to pay to understand the puzzle"*, and it is
worth very little revenue because it is the cheapest rung. Give it away and the paid rungs
become a genuine choice rather than a toll gate.

Five further rules **[inference]**, all consistent with the sources above:

1. **Never charge twice for the same information.** Already done — `S.paidHints` keys make
   re-reads free. Keep it, and extend it across app restarts.
2. **Show the ladder before purchase.** "Rung 2 of 3 — this will narrow it down, not
   solve it." A player who knows what they are buying does not feel tricked. This is the
   single cheapest anti-extortion change available.
3. **Escalating price, not flat.** 0 / 1 / 2 hints. It encodes the message "thinking is
   cheaper than being told" directly in the economy.
4. **Earn rung 2 by playing.** The build already grants
   `Cfg.hints.perChamberFirstClear` on a first escape. Keep the free trickle generous
   enough that a *good* player never buys and a *stuck* player is tempted. Hint packs
   should sell to the frustrated, never to the diligent.
5. **Instrument it.** Log rung usage per chamber. Apply the Strange Bird rule: **any
   chamber where >25% of players reach rung 3 has a broken clue, not a hard puzzle.**
   Aim, per the Connections calibration, for the majority of hint-users to stop at rungs
   1–2.

### C.4 One structural warning about the keypad

**[inference] A 3-digit keypad has 1,000 combinations and no cost per attempt.** A player
who has decided the room is unfair will brute-force it, and once they do, every clue in
every subsequent chamber is optional. *Obra Dinn*'s answer to exactly this problem was to
withhold confirmation until three entries are correct at once, specifically because
"waiting until the player has three correct answers prevents the player from brute-forcing"
([Wireframe](https://wireframe.raspberrypi.com/articles/obra-dinn-the-rule-of-three),
[Film Stories](https://filmstories.co.uk/features/exploring-return-of-the-obra-dinns-rule-of-three/)) —
though critics note that once two entries are pinned, the system becomes gameable again.

A direct copy is wrong here **[inference]** — one lock per chamber gives nothing to batch.
The mobile-appropriate version is a **soft cost**: a short escalating cooldown on
consecutive wrong entries (0s, 0s, 3s, 8s, 20s…), reset by finding any new clue. It never
blocks a legitimate player — nobody fair-solves and then types five wrong codes — and it
makes brute force cost more than the hint pack, which is also the commercially correct
outcome. Pair it with Codex Rule 4 (**self-validating answers**): the player should feel
sure *before* typing. If they don't, the lock is doing the deduction for them.

---

## Part D — The fairness checklist

Written to be **testable**, several of them automatically, given the repo already has an
e2e auto-solver (`test/e2e.js`) that solves all twenty chambers from public information.
That harness is the most valuable asset in this project for this purpose and should be
extended, not just kept.

### D.1 Solvability (automatable)

| # | Rule | Source | How to test |
|---|---|---|---|
| D1 | **Every lock has exactly one answer.** | Codex Rule 3: "Ensure clues point to only one correct answer." | Already enforced for the keypad in `_logic` by brute force over 10^len. **Extend to the key's location:** brute-force all 7 spots against the locator clue set; regenerate unless exactly one survives. |
| D2 | **Solvable from the room alone.** | Codex Rule 13: no outside knowledge/research. `puzzle.js` already states this as its rule 1. | The auto-solver must consume **only** `facts` + clue text, never `code` or `brassSpot`. This discipline exists — do not let a locator implementation quietly leak the spot into state. |
| D3 | **No hint required.** | Strange Bird: "you need to have had a real-life team win your game with zero hints, or your game is broken." | Auto-solver runs all 20 chambers with the hint button disabled. Non-negotiable gate. |
| D4 | **Every clue is necessary and sufficient.** | Logic-grid construction: "every clue is necessary to reach the unique solution." | Ablation test: remove each clue in turn; the puzzle must become ambiguous (proves necessity). Remove none; it must be unique (proves sufficiency). |
| D5 | **Redundant paths where affordable.** | Golden Idol: "players can arrive at the same conclusion by observing different clues." | Over-clue by one at tiers 1–3; verify solvable with any one clue withheld. |
| D6 | **No unwinnable state.** | Ron Gilbert's sins, via [The Digital Antiquarian](https://www.filfre.net/2015/07/the-14-deadly-sins-of-graphic-adventure-design/): "hidden dead ends"; Codex Rule 9: "no destroyable states." | Assert no action removes a needed fact. The `avoid` bug the code comments already document — a fact placed where it could be filtered out, producing an unwinnable chamber — is exactly this class. Keep the regression test. |

### D.2 Perceptibility (needs a human or a screenshot test)

| # | Rule | Source | How to test |
|---|---|---|---|
| D7 | **No pixel hunting.** | [TV Tropes / Pixel Hunt](https://tvtropes.org/pmwiki/pmwiki.php/Main/PixelHunt) — "fake difficulty… a hotspot only a few pixels in size hidden in the scenery"; Gilbert's sin #5. | Every tap target ≥ **48dp**, per [Android accessibility guidance](https://support.google.com/accessibility/android/answer/7101858). Automate: assert every hit-rect's rendered size at the smallest supported viewport. |
| D8 | **Every clue is readable without zooming.** | The Room: affordances "just barely pass the minimum threshold needed to perceive" — the threshold is the *device's*, not the artist's. | Screenshot each chamber at 360×640 and read it yourself. If you squint, the player fails. |
| D9 | **No audio-only or colour-only clue.** | General accessibility; RCA notes players often can't rely on delivery channel. | Every clue must survive muted audio **and** greyscale. Test greyscale by CSS filter over the chamber SVG. |
| D10 | **One adjective, one object.** | Codex Rule 3 (single answer), applied to locators. | Per theme, list the seven objects' distinguishing adjectives; assert no duplicates. Cheap to write as a data-level unit test. |

### D.3 Trust

| # | Rule | Source | Note |
|---|---|---|---|
| D11 | **No red herrings.** | Harshbarger via RCA: "I never design with red herrings. The players will create their own." Codex Rule 13. | With 7 spots, one decoy is 14% of the room. **[inference] Absolute rule here.** |
| D12 | **Feedback on every action.** | Codex Rule 10: "feedback cuts down hint requests and increases satisfaction with self-solving." | Searching an empty spot must say something in character ("*nothing but straw dust*"), never nothing. Silence reads as a bug. |
| D13 | **Consistency across chambers.** | Codex Rule 11: "Establish rules for how the world works and follow them… Inconsistency causes players to mistrust every puzzle and demand hints." | If a scratched tally means "count this" in chamber 3, it means it in chamber 17. Keep a documented clue grammar. |
| D14 | **Answers are self-validating.** | Codex Rule 4: "Players should feel confident in their answer before entering it." | The rule text must let the player *know* they're right. Pair with §C.4. |
| D15 | **No mocking on failure.** | Gilbert's sin #12: insulting failure messages. | Check the existing "taunts" strings in `game.js` against this. Wry is fine; contemptuous is not. |
| D16 | **No timers, no deaths, no chance.** | Gilbert's sins #3, #6, #8, #9. | Applies doubly to mobile, where sessions get interrupted. |

### D.4 Progression across twenty chambers

The Witness is the cleanest published model: 500+ puzzles, **zero text instructions**, where
"simple puzzles are placed next to slightly more difficult ones, each of which wordlessly
teaches the player new rules"
([Wikipedia](https://en.wikipedia.org/wiki/The_Witness_(2016_video_game))). Hour To Midnight
states the same as a rule: "gradually increase task complexity so early puzzles boost
confidence while later challenges demand critical thinking." Codex Rule 12 is the warning
that makes it necessary: **"Your puzzles will be too hard"** — new designers almost always
overshoot.

**[inference] A concrete curve for 20 chambers, on the mechanisms of Part B:**

| Chambers | Locator mechanism | Clue count | Field after clues | Teaches |
|---|---|---|---|---|
| 1–3 | B.4 trace only, no text | 1 | 1 of 7 | "objects have states, states mean something" |
| 4–7 | B.2 positive locator | 1–2 | 1 of 7 | "read the adjective, look at the picture" |
| 8–11 | B.1 elimination | 3–4 | 1 of 7 | "negative information is information" |
| 12–15 | B.3 count-to-index, B.5 testimony | 2–3 | 2 of 7, then 1 | "the number you computed is also a place" |
| 16–20 | B.7 cross-reference + B.1 | 3–4, redundant | 1 of 7 | "two weak facts beat one strong one" |

Each band introduces exactly one new idea and reuses the previous band's. **Chamber 1 should
be solvable with no text at all** — a clean handprint on one sooty trunk — because that is
where you teach the player that the room speaks.

---

## Part E — Opinionated: what is wrong for this screen

All **[inference]**, argued from the sources above.

### E.1 Wrong: anything requiring zoom or precision

Gilbert's fifth sin and the 48dp guidance point the same way. A phone escape room has no
magnifying glass and no second player pointing at the corner. **Any clue that requires a
pinch-zoom to perceive is a pixel hunt**, however pretty. The *entire clue* must land in a
thumbnail. This kills: microtext, "look closely at the painting", tiny serial numbers,
subtle hue differences.

### E.2 Wrong: red herrings, at any dose

Covered in B.8/D11. Seven spots. A decoy is 14% of the room and 100% of the trust.

### E.3 Wrong: non-linear multi-chain flow and metapuzzles

The escape-room literature ([Mystery Soup Games](https://mysterysoupgames.com/linear-vs-non-linear-game-flow-in-escape-rooms/),
[The Escape Revolution](https://theescaperevolution.com/linear-vs-non-linear-escape-rooms/))
recommends non-linear flow **to let a group of six work in parallel**. That is the entire
rationale, and this game has one player with one thumb. Parallel chains on mobile produce a
player holding three unrelated half-facts across a bus journey and a train. **Keep the
chain linear**; make it *deeper*, not wider.

### E.4 Wrong: ciphers, transcription, and anything needing paper

Substitution ciphers, cipher wheels, Morse, semaphore-as-alphabet, long book-code lookups.
These are staples of physical rooms because six people can split the labour at a table with
a pen. On a phone the player must hold ten characters in working memory while switching
views, and switching views on mobile *destroys* working memory. If you want the flavour of
a cipher, use a **4-symbol** mapping (the existing symbol lock is exactly right) and never
more.

### E.5 Wrong: outside knowledge

Codex Rule 13 and Gilbert's sins both flag it. On mobile it is worse: the player has a web
browser one swipe away, so an outside-knowledge puzzle is not a puzzle, it is a search
query, and the player who does it feels like they cheated *at your invitation*.

### E.6 Wrong: the UV lamp as the thing that finds the code

B.8. It is a *reveal*, not a *deduction*, and it teaches the player that progress comes
from acquiring tools rather than from thinking. Keep it for spectacle at tier 4–5, once the
place is already known.

### E.7 Wrong: cosmetic-only theming, restated in mechanical terms

The real cost of the current approach is not visual monotony. It is that **a room with no
specific objects cannot carry a specific clue.** "Look behind the portrait" is the same
sentence in all twenty chambers. "It's with the one that never healed" only exists if the
wheelchair exists. Themes are not paint — **themes are the vocabulary the clue system
is written in.** That is why Part A is a prerequisite for Part B and not a parallel task,
and it is the strongest single argument for doing the settings work first.

### E.8 Right, and cheap: silence

The best clues in Part B use **no words**: the clean handprint (B.4), the lighthouse sweep
(B.6), the missing suit on the rack (B.7), the one straightened picture. They localise
instantly, need no translation, cost nothing in file size, and — per The Room's designers —
are the entire craft: *"the design challenge is not in how the secrets should be hidden,
but in how they should be revealed."*

---

## Sources

**Escape-room design theory**
- [13 Rules for Escape Room Puzzle Design — The Codex](https://thecodex.ca/13-rules-for-escape-room-puzzle-design/)
- [Red Herrings — Room Escape Artist](https://roomescapeartist.com/2019/02/10/red-herrings/)
- [An Exploration of Escape Room Hint Systems — Room Escape Artist](https://roomescapeartist.com/2019/10/24/escape-room-hint-systems/)
- [Hints and Hinting Systems — Room Escape Artist](https://roomescapeartist.com/2016/10/02/hints-and-hinting-systems-room-design/)
- [What Escape Rooms Can Learn from Puzzle Hunts — Room Escape Artist](https://roomescapeartist.com/2025/08/28/what-escape-rooms-can-learn-from-puzzle-hunts/)
- [Hints are not Clues — Strange Bird Immersive](https://strangebirdimmersive.com/immersology/hints-are-not-clues/)
- [Escape Rooms: Clues vs Hints — Next-Gen Escape](https://nextgenescape.com/blogs/escape-room-tips-tricks/escape-room-clues-vs-hints)
- [Mastering the Art of Hidden Clues — Hour To Midnight](https://www.hourtomidnight.com/blog/mastering-the-art-of-hidden-clues-in-escape-room-puzzles/)
- [The Art of Hidden Clues — Hour To Midnight](https://www.hourtomidnight.com/blog/the-art-of-hidden-clues-in-escape-room-puzzles/)
- [Linear vs. Multi-Linear Escape Rooms — The Escape Revolution](https://theescaperevolution.com/linear-vs-non-linear-escape-rooms/)
- [Linear vs Non-Linear Game Flow — Mystery Soup Games](https://mysterysoupgames.com/linear-vs-non-linear-game-flow-in-escape-rooms/)

**Themes and set design**
- [25 Escape Room Themes — Escape Room Geeks](https://escaperoomgeeks.com/escape-room-themes/)
- [Most Popular Escape Room Themes — Mission Escape Games](https://missionescapegames.com/blog/what-are-the-most-popular-escape-room-themes-offered-by-the-escape-game-nyc/)
- [Top Escape Room Themes & Objectives — Questroom](https://questroom.com/blog/popular-escape-room-themes)
- [How We Created a Realistic Prison Cell Escape Room — Creative Works](https://wearecreativeworks.com/cell-block-e-behind-the-scenes/)

**Video-game puzzle and attention design**
- [Player-Centric Design: The UX of The Room — UX Magazine](https://uxmag.com/articles/player-centric-design-the-ux-of-the-room)
- [Pursuing the "Aha!" moment with The Case of the Golden Idol — Game Developer](https://www.gamedeveloper.com/design/case-of-the-golden-idol)
- [The Case of the Golden Idol used frequent testing — Game Developer](https://www.gamedeveloper.com/business/-the-case-of-the-golden-idol-i-used-frequent-testing-to-improve-its-mystery-solving)
- [Exploring Return of the Obra Dinn's rule of three — Wireframe](https://wireframe.raspberrypi.com/articles/obra-dinn-the-rule-of-three)
- [Exploring Return of the Obra Dinn's rule of three — Film Stories](https://filmstories.co.uk/features/exploring-return-of-the-obra-dinns-rule-of-three/)
- [Confirmation in Return of the Obra Dinn — Intermittent Mechanism](https://intermittentmechanism.blog/2024/05/21/confirmation-in-the-return-of-obra-dinn/)
- [The Witness (2016 video game) — Wikipedia](https://en.wikipedia.org/wiki/The_Witness_(2016_video_game))
- [The 14 Deadly Sins of Graphic-Adventure Design — The Digital Antiquarian](https://www.filfre.net/2015/07/the-14-deadly-sins-of-graphic-adventure-design/)
- [Pixel Hunt — TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/Main/PixelHunt)

**Guiding attention / level design**
- [35 Ways to Guide the Player — Jacob Ryan Wheeler](https://jacobryanwheeler.medium.com/game-level-design-35-ways-to-guide-the-player-4bbc324204f4)
- [5 Simple Ways to Use Level Design to Improve Player Experience — GameAnalytics](https://www.gameanalytics.com/blog/five-simple-ways-use-level-design-improve-player-experience)
- [Composition — The Level Design Book](https://book.leveldesignbook.com/process/blockout/massing/composition)
- [Mastering the Invisible: Affordances & Signifiers in Level Design](https://medium.com/@Genesis_Design/mastering-the-invisible-how-affordances-signifiers-shape-player-experience-in-level-design-64082c602fa0)

**Deduction-puzzle construction**
- [Logic Grid Puzzles: rules — The Puzzle Labs](https://www.thepuzzlelabs.com/grid-puzzles/rules)
- [Logic Grid Puzzles — Logic Puzzles CA](https://logicpuzzles.ca/games/logic-grid-puzzles/)
- [Elimination Grids — Brilliant](https://brilliant.org/wiki/elimination-grids/)

**Hints, monetisation, and platform constraints**
- [How Our Connections Hints Work: three-tier spoiler system](https://www.connectionshintz.com/blog/connections-hint-today)
- [Hint System — TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/Main/HintSystem)
- [A Data-Driven, Multidimensional Approach to Hint Design in Video Games (PDF)](https://www.sift.net/sites/default/files/publications/wauck_iui2017hints.pdf)
- [Predatory Monetisation: A Categorisation of Unfair, Misleading and Aggressive Techniques — Journal of Business Ethics](https://link.springer.com/article/10.1007/s10551-021-04970-6)
- [Why Paywalls Are Now a Marketing Problem for Mobile Games — Gamesforum](https://www.globalgamesforum.com/news-media/the-paywall-how-much-is-it-a-marketing-problem)
- [Touch target size — Android Accessibility Help](https://support.google.com/accessibility/android/answer/7101858)
- [Accessible touch target sizes — Smart Interface Design Patterns](https://smart-interface-design-patterns.com/articles/accessible-tap-target-sizes/)
