/* =====================================================================
   Escape: 20 Chambers — puzzles
   ---------------------------------------------------------------------
   TWO puzzles live in this file, and the newer one comes FIRST in play.

   ------------------------------------------------------------------
   1. THE KEY HUNT   generateKeyHunt() / solveKeyHunt()
   ------------------------------------------------------------------
   The brass key used to sit at a RANDOM one of seven spots with nothing
   in the room saying which. The only strategy was to tap all seven. That
   is not a puzzle, it is an inventory of taps, and it was the loudest
   complaint the game got:

       "there should be clues that I can use to find the key, not just
        search randomly, and hints used is a final thing if I fail to
        understand a clue."

   So the key's location is now a DEDUCTION. On entering, the room shows
   one to four OBSERVATIONS — dust unbroken along the picture rail, a
   hinge bright with use, a tally scratched on the wall, a shadow that
   reaches the far wall. Each observation is a predicate over the room's
   visible objects. Intersect them and exactly one spot survives.

   The contract, which is the same one the safe code has always had:

     A. EXACTLY ONE ANSWER. Every clue set is brute-forced over the whole
        candidate list at generation time and rejected unless precisely
        one spot survives. It is ALSO checked for MINIMALITY — removing
        any single clue must break uniqueness — so no clue is decoration
        and a player who ignores one cannot get there anyway.
     B. SOLVABLE FROM THE ROOM ALONE. Every predicate is over traits the
        player can see (where a thing sits, what it is made of, whether
        it opens). No trivia, no outside knowledge.
     C. THE ANSWER IS NEVER PUBLIC. `hunt.answer` is private; everything
        a player can see is under `hunt.evidence`. solveKeyHunt() takes
        ONLY `evidence`, so the e2e auto-solver deduces the key's spot
        exactly the way a player does. That is what keeps "all twenty
        chambers are completable" a real claim instead of a restatement
        of the generator.
     D. HINTS ARE A LADDER, NOT A SUBSTITUTE. `hunt.hints` restates a
        clue in plain words first, narrows the field second, and only
        names the spot last. A player who understood the clue never
        reaches the naming rung.

   Clue PREDICATES are published as structured data next to their prose,
   not re-parsed out of the prose with regexes the way solveFromFacts has
   to. That is deliberate: the old regex parser is one careless reword
   away from a chamber the solver cannot finish, and publishing the
   predicate leaks nothing — you still have to intersect every clue to
   get anywhere. The prose and the predicate are generated from the same
   object, so they cannot drift apart.

   ------------------------------------------------------------------
   2. THE SAFE CODE   generate() / solveFromFacts()
   ------------------------------------------------------------------
   A puzzle produces the code instead of revealing it. The room still has
   to be searched — that is where the FACTS come from — but the facts are
   useless until the rule on the note combines them. Same three-part
   contract as above; see the notes on each rule.

   Adding a fifth safe rule, or a new clue kind, means adding its solver
   here too, or the suite will correctly fail to escape the chamber.
   ===================================================================== */
(function (global) {
  'use strict';

  /* Same generator the level uses, kept local so a puzzle can be reseeded
     without disturbing the level's own RNG stream. Array.sort with a random
     comparator is NOT usable here — see the Fisher-Yates note in game.js. */
  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, R) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(R() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* =====================================================================
     SPOTS AND TRAITS
     ---------------------------------------------------------------------
     The seven searchable spots are NOT hardcoded any more. themes.js is
     making them per-theme, so every entry point takes the candidate list
     as a parameter and these are only the fallback.

     A spot descriptor is:

       { id:'chest', name:'wooden chest',
         traits:{ place:'floor', made:'wood', kind:'furniture',
                  hollow:true, living:false },
         x: 540 }                                    // optional, see below

     TRAITS ARE THE RAW MATERIAL OF EVERY CLUE, and they carry one hard
     obligation: each must be true of what the player actually SEES. A
     trait table that says the clock is wooden makes a truthful clue set
     into a lie, and no amount of uniqueness checking will catch it —
     brute force can only prove the clue set is consistent with the
     table, never that the table matches the art. Whoever writes a new
     theme owns that correspondence.

     Traits should be visually obvious and mutually independent. Two
     spots MAY share a trait value (that is what makes elimination
     interesting) but two spots that share EVERY value can never be told
     apart, and the generator will fall back to a direct clue for them.

     `x` is optional. Supplied, it unlocks the spatial clue kinds (the
     shadow that reaches the far wall, the thing nearest the clock).
     Omitted, those kinds are simply never generated — a spatial clue
     written against positions the room does not actually have would be
     unsolvable, and silently skipping is the only safe default. game.js
     can supply it from layoutFor()'s post-shuffle slot centres; until it
     does, the other kinds carry every tier on their own.
     ===================================================================== */
  var DEFAULT_SPOTS = [
    { id: 'rug',   name: 'rug',
      traits: { place: 'floor', made: 'cloth', kind: 'covering',  hollow: false, living: false } },
    { id: 'plant', name: 'plant pot',
      traits: { place: 'floor', made: 'clay',  kind: 'vessel',    hollow: true,  living: true  } },
    { id: 'clock', name: 'clock',
      traits: { place: 'wall',  made: 'metal', kind: 'mechanism', hollow: true,  living: false } },
    { id: 'pA',    name: 'old map',
      traits: { place: 'wall',  made: 'paper', kind: 'picture',   hollow: false, living: false } },
    { id: 'pB',    name: 'portrait',
      traits: { place: 'wall',  made: 'wood',  kind: 'picture',   hollow: false, living: false } },
    { id: 'shelf', name: 'bookshelf',
      traits: { place: 'wall',  made: 'wood',  kind: 'furniture', hollow: true,  living: false } },
    { id: 'chest', name: 'wooden chest',
      traits: { place: 'floor', made: 'wood',  kind: 'furniture', hollow: true,  living: false } }
  ];

  /* How a trait VALUE reads inside "…something that ___".
     Every entry must be a third-person verb phrase so it drops into both
     the positive and the negative template without rewording. themes.js
     may add to this table; anything missing falls through to a generic
     phrasing that is plainer but still unambiguous, so an unknown value
     costs prose quality and never correctness. */
  var VALUE_WORDS = {
    wall:      'hangs on the wall',
    floor:     'stands on the floor',
    wood:      'is made of wood',
    cloth:     'is made of cloth',
    clay:      'is fired clay',
    metal:     'is metal',
    paper:     'is paper',
    glass:     'is glass',
    stone:     'is stone',
    iron:      'is iron',
    covering:  'covers the floor',
    vessel:    'is a vessel',
    mechanism: 'has moving parts',
    picture:   'is a picture on the wall',
    furniture: 'is a piece of furniture',

    /* Added for themes.js. Ten settings share one vocabulary, so a word is
       only worth adding when several rooms can use it — and every one of
       these must be something a player can read off the drawing, because
       that is the only place they can learn it from.

       Missing entries are not a correctness bug: says() falls through to
       "is <value>", which is still unambiguous, just clumsy. These exist
       purely so the prose sounds written rather than generated. */
    straw:     'is woven straw',
    reed:      'is woven reed',
    rope:      'is coiled rope',
    brass:     'is brass',
    gold:      'is gilded',
    enamel:    'is smooth white enamel',
    rock:      'is bare rock',
    coal:      'is coal, black with dust',

    /* Added 2026-08-17. Without these, says() falls through to "is <value>"
       and six shipped chambers printed broken English on screen —
       "Nothing that is records has been shifted", "everything that is toy".
       themes.js validate() now fails a setting that introduces a value with
       no entry here, so this cannot silently recur. */
    treasure:  'is treasure',
    signal:    'carries a signal',
    bronze:    'is bronze',
    fur:       'is fur or hide',
    mount:     'is a mounted specimen',
    leather:   'is leather',
    ice:       'is ice',
    block:     'is a solid block',
    toy:       'is a toy',
    bone:      'is bone',
    rubber:    'is rubber',
    records:   'is a record or recording',

    bedding:   'is something slept on',
    window:    'is a window',
    marking:   'is written or scratched on',
    opening:   'is a gap you could reach into',
    carving:   'is carved stone',
    weight:    'hangs as a dead weight',
    wheel:     'is a great wheel',
    tools:     'is a set of tools',
    growth:    'is a growing thing',
    books:     'is a row of books',
    map:       'is a chart of somewhere',
    seam:      'is a vein in the rock',
    heap:      'is a loose heap'
  };

  /* Boolean traits need both polarities spelled out; "is not hollow" is
     technically clear and reads like a spreadsheet. */
  var BOOL_WORDS = {
    hollow: { yes: 'opens, or has room inside it', no: 'is flat, with nothing inside it' },
    living: { yes: 'is alive and growing',         no: 'is not alive' }
  };

  /* The noun a trait is called by when a clue talks ABOUT the trait
     rather than about one of its values ("the only object whose material
     nothing else shares"). */
  var TRAIT_NOUN = { made: 'material', kind: 'nature', place: 'position',
                     hollow: 'build', living: 'nature' };

  function says(trait, v) {
    if (v === true || v === false) {
      var b = BOOL_WORDS[trait];
      if (b) return v ? b.yes : b.no;
      return v ? 'is ' + trait : 'is not ' + trait;
    }
    if (VALUE_WORDS[v]) return VALUE_WORDS[v];
    return 'is ' + v;                       /* generic, still unambiguous */
  }
  function traitNoun(t) { return TRAIT_NOUN[t] || t; }

  /* One physical medium per chamber, in the same order as THEMES in
     game.js. Pure phrasing — it decides what the dust IS, never what the
     clue MEANS — so a bad entry can no more break a chamber than a bad
     LORE entry can. */
  var SIGNS = [
    /* ONE ENTRY PER SETTING, in themes.js SETTINGS order. The substance a
       clue talks about has to be something that is actually in the room.

       This has now been wrong twice. First it was aligned to game.js's old
       twenty THEME NAMES, so a prison generated "a hand has wiped the
       SPILLED FLOUR from the room". Then themes.js grew from ten settings
       to twenty, and this list -- ten entries written twice over -- stopped
       lining up again: the icehouse advertised POLLEN, the lamp room CELL
       DAMP, the operating theatre IRON GRIT. Ten of twenty chambers named
       a substance that was not there.

       ECPuzzle.SIGNS.length MUST equal ECThemes.list.length. The e2e suite
       asserts it, because nothing about the failure is visible in code —
       it only shows up as strange prose in a room nobody re-read.

       All singular mass nouns on purpose: the templates say "the <sign>
       proves it", so a plural like "brass filings" reads "the brass
       filings proves it". */
    'stone dust',    /*  1 cell block          */
    'salt crust',    /*  2 captain's cabin     */
    'tomb dust',     /*  3 sealed tomb         */
    'spilled reagent', /* 4 laboratory         */
    'machine oil',   /*  5 clockworks          */
    'potting soil',  /*  6 glasshouse          */
    'paper dust',    /*  7 locked library      */
    'rock dust',     /*  8 deep working        */
    'lens dust',     /*  9 observatory         */
    'coal soot',     /* 10 boiler room         */
    'lamp oil',      /* 11 lamp room           */
    'vault dust',    /* 12 vault               */
    'vellum dust',   /* 13 scriptorium         */
    'plaster dust',  /* 14 taxidermist's       */
    'engine grit',   /* 15 guard's van         */
    'frost',         /* 16 icehouse            */
    'sawdust',       /* 17 toy workshop        */
    'carbolic',      /* 18 operating theatre   */
    'valve dust',    /* 19 radio station       */
    'belfry grime'   /* 20 bell tower          */
  ];

  /* Normalise whatever the caller passed into full descriptors.
     Accepts: undefined (the defaults), an array of id strings, or an
     array of descriptors. Missing traits are back-filled from the
     defaults BY ID, so a theme that renames the portrait but keeps the
     id still gets a working clue set. */
  function normalizeSpots(spots) {
    var byId = {};
    DEFAULT_SPOTS.forEach(function (s) { byId[s.id] = s; });

    var list = (spots && spots.length) ? spots : DEFAULT_SPOTS;
    return list.map(function (s) {
      var id = (typeof s === 'string') ? s : s.id;
      var base = byId[id];
      var src = (typeof s === 'string') ? {} : s;
      var traits = {};
      if (src.traits) {
        Object.keys(src.traits).forEach(function (k) { traits[k] = src.traits[k]; });
      } else if (base) {
        Object.keys(base.traits).forEach(function (k) { traits[k] = base.traits[k]; });
      }
      var out = { id: id,
                  name: src.name || (base && base.name) || id,
                  traits: traits };
      var x = (src.x !== undefined) ? src.x : (base && base.x);
      if (typeof x === 'number') out.x = x;
      return out;
    });
  }

  function valuesOf(all, trait) {
    var vs = [];
    all.forEach(function (s) {
      var v = s.traits[trait];
      if (v === undefined || v === null) return;
      if (vs.indexOf(v) < 0) vs.push(v);
    });
    return vs;
  }
  function groupSize(all, trait, v) {
    var n = 0;
    all.forEach(function (s) { if (s.traits[trait] === v) n++; });
    return n;
  }
  function haveX(all) {
    for (var i = 0; i < all.length; i++) if (typeof all[i].x !== 'number') return false;
    return true;
  }
  /* Strict extreme only: a shadow that "reaches the far left" is a lie if
     two things are equally far left, and a 4px difference is a lie to the
     eye even when it is true to the data. */
  var X_MARGIN = 40;
  function extremeId(all, dir) {
    if (!haveX(all)) return null;
    var sorted = all.slice().sort(function (a, b) { return a.x - b.x; });
    var first = (dir === 'min') ? sorted[0] : sorted[sorted.length - 1];
    var second = (dir === 'min') ? sorted[1] : sorted[sorted.length - 2];
    if (!second) return first.id;
    return Math.abs(first.x - second.x) >= X_MARGIN ? first.id : null;
  }
  /* TRUE 2-D DISTANCE, not x alone.
     "Next to" is judged by the player's eye against a drawing, and an
     object 15px sideways but 108px below is not next to anything. Chamber 1
     shipped with exactly that: the clue pointed at a bunk 110px away in
     real distance while a tin cup sat 87px away, and the generator chose
     the bunk because it compared x only. The first chamber is where the
     player learns the room can be trusted, so it is the worst place to be
     wrong. The margin check uses the same metric, or it would pass clues
     the comparison rejects. */
  function dist2(a, b) {
    var dx = a.x - b.x, dy = (a.y || 0) - (b.y || 0);
    return Math.sqrt(dx * dx + dy * dy);
  }
  function nearestId(all, refId) {
    if (!haveX(all)) return null;
    var ref = null, i;
    for (i = 0; i < all.length; i++) if (all[i].id === refId) ref = all[i];
    if (!ref) return null;
    var rest = all.filter(function (s) { return s.id !== refId; })
                  .sort(function (a, b) { return dist2(a, ref) - dist2(b, ref); });
    if (!rest.length) return null;
    if (rest[1] && Math.abs(dist2(rest[1], ref) - dist2(rest[0], ref)) < X_MARGIN) {
      return null;                          /* two contenders — unfair */
    }
    return rest[0].id;
  }

  /* ---------------------------------------------------------------------
     THE PREDICATE EVALUATOR
     This one function is the whole honesty of the design: generation and
     solving both go through it, so a clue can never mean one thing when
     it is written and another when it is read.
     --------------------------------------------------------------------- */
  function evalPred(p, spot, all) {
    switch (p.k) {
      case 'is':      return spot.traits[p.trait] === p.value;
      case 'not':     return spot.traits[p.trait] !== p.value;
      case 'unique':  return groupSize(all, p.trait, spot.traits[p.trait]) === 1;
      case 'group':   return groupSize(all, p.trait, spot.traits[p.trait]) === p.n;
      case 'extreme': return spot.id === extremeId(all, p.dir);
      case 'nearest': return spot.id === nearestId(all, p.ref);
      case 'direct':  return spot.id === p.value;
      default:        return false;
    }
  }

  function survivorsOf(all, clues) {
    return all.filter(function (s) {
      for (var i = 0; i < clues.length; i++) {
        if (!evalPred(clues[i].pred, s, all)) return false;
      }
      return true;
    });
  }

  var ABSTRACT = { unique: 1, group: 1, extreme: 1, nearest: 1 };

  /* ---------------------------------------------------------------------
     CLUE PROSE
     Two strings per clue and they are not interchangeable:
       text  — what the room shows. A physical observation that requires a
               small leap. This is what the player reads on entering.
       plain — the same predicate stated flatly. This is HINT RUNG ONE and
               nothing else; showing it up front would delete the puzzle.
     --------------------------------------------------------------------- */
  function clueIs(trait, v, sign, R) {
    var w = says(trait, v);
    var t = [
      'A trail through the ' + sign + ' ends at something that ' + w + '.',
      'Fingermarks in the ' + sign + ' — someone reached for something that ' + w + '.',
      'The ' + sign + ' is scuffed away in one place, at something that ' + w + '.'
    ];
    return { pred: { k: 'is', trait: trait, value: v },
             text: t[Math.floor(R() * t.length)],
             plain: 'The key is behind something that ' + w + '.' };
  }
  function clueNot(trait, v, sign, R) {
    var w = says(trait, v);
    var t = [
      'The ' + sign + ' lies thick and unbroken on everything that ' + w + '.',
      'Nothing that ' + w + ' has been shifted in months; the ' + sign + ' proves it.',
      'A hand has wiped the ' + sign + ' from the room — but not from anything that ' + w + '.'
    ];
    return { pred: { k: 'not', trait: trait, value: v },
             text: t[Math.floor(R() * t.length)],
             plain: 'The key is not behind anything that ' + w + '.' };
  }
  /* THE AXIS MUST BE IN THE TEXT.
     These clues used to read "a single word: 'unmatched.'" and nothing
     more. Unmatched by WHAT — material, nature, position? Each answer
     gives a different candidate set, so the clue was unreadable and the
     chamber could not be closed from the screen. The predicate knew the
     axis; the prose dropped it. Naming the axis costs nothing: the player
     still has to work out which object is the odd one. */
  function clueUnique(trait, sign, R) {
    var n = traitNoun(trait);
    var t = [
      'Scratched into the plaster: "alone in its ' + n + '."',
      'A single word, cut deep and underlined twice: "unmatched" — and beneath it, "' + n + '".',
      'Written in the ' + sign + ' with one finger: "the odd one for its ' + n + '."'
    ];
    return { pred: { k: 'unique', trait: trait },
             text: t[Math.floor(R() * t.length)],
             /* Says "an object", not "the one object". The predicate is a
                fact about the KEY's spot -- its group on this axis has size
                one -- not a claim that only one such object exists in the
                room. Several can, and saying otherwise made the paid hint
                a lie that narrowed the player to the wrong thing. */
             plain: 'The key is behind an object whose ' + n +
                    ' nothing else in this room shares.' };
  }
  /* Same fix as clueUnique: the tally meant nothing without the axis. */
  function clueGroup(trait, n, sign, R) {
    var noun = traitNoun(trait);
    var t = [
      'A tally of ' + n + ' notches, cut beside a sketch of the room, and the word "' + noun + '".',
      n + ' marks in the ' + sign + ', side by side, under a single word: "' + noun + '".',
      'Someone counted ' + n + ' things of a ' + noun + ' here, and drew a ring round the count.'
    ];
    return { pred: { k: 'group', trait: trait, n: n },
             text: t[Math.floor(R() * t.length)],
             /* "a set of n", not "exactly n things here" -- two separate
                groups of the same size can exist on one axis, and the old
                wording sent the player confidently to the wrong pair. */
             plain: 'The key is behind one of a set of ' + n +
                    ' things that share the same ' + noun + '.' };
  }
  function clueExtreme(dir, sign, R) {
    var side = (dir === 'min') ? 'left' : 'right';
    var t = [
      'The candle throws one long shadow. It reaches the far ' + side +
        ' of the room and stops against whatever stands there.',
      'A draught bends the flame, and the shadow it casts points hard to the ' + side + '.'
    ];
    return { pred: { k: 'extreme', dir: dir },
             text: t[Math.floor(R() * t.length)],
             plain: 'The key is behind whatever stands furthest to the ' + side + '.' };
  }
  function clueNearest(ref, sign, R) {
    var t = [
      'The ' + sign + ' is disturbed in a small arc beside the ' + ref.name + '.',
      'Something was dragged aside next to the ' + ref.name + ' and pushed back crooked.'
    ];
    return { pred: { k: 'nearest', ref: ref.id },
             text: t[Math.floor(R() * t.length)],
             plain: 'The key is behind whatever stands closest to the ' + ref.name + '.' };
  }
  /* The guaranteed fallback. It names the spot outright, which is exactly
     what tier 1 should feel like — "the dust is disturbed HERE" — and is
     the only thing standing between a trait table too thin to isolate an
     answer and an ambiguous room. Counted and reported: seeing this above
     tier 1 means a theme's traits need work. */
  function clueDirect(spot, sign, R) {
    var t = [
      'The ' + sign + ' is disturbed in exactly one place: at the ' + spot.name + '.',
      'One clean patch in the ' + sign + ', the size of a hand, at the ' + spot.name + '.'
    ];
    return { pred: { k: 'direct', value: spot.id },
             text: t[Math.floor(R() * t.length)],
             plain: 'The key is behind the ' + spot.name + '.' };
  }

  /* Every clue in the pool is TRUE of the answer. Falsehood is not a
     difficulty mechanic here — a room that lies to you is not harder, it
     is broken, and there is no way for a player to tell the two apart. */
  function buildPool(all, answer, sign, R) {
    var pool = [];
    var traits = answer.traits || {};

    Object.keys(traits).forEach(function (t) {
      var av = traits[t];
      if (av === undefined || av === null) return;
      var vals = valuesOf(all, t);
      if (vals.length < 2) return;          /* everything shares it: no information */

      pool.push(clueIs(t, av, sign, R));

      if (vals.length === 2) {
        /* Binary trait: "not the other value" is the SAME predicate said
           backwards. Kept anyway, because a tier that demands a negative
           clue would otherwise be impossible in a room whose traits are
           all binary. The minimality check below throws out any set that
           happens to contain both wordings. */
        var other = (vals[0] === av) ? vals[1] : vals[0];
        pool.push(clueNot(t, other, sign, R));
      } else {
        vals.forEach(function (v) {
          if (v !== av) pool.push(clueNot(t, v, sign, R));
        });
        /* unique/group are only meaningful where a trait has three or
           more values in play. On a binary trait "N things share this"
           is just the trait restated with a number attached. */
        var n = groupSize(all, t, av);
        if (n === 1) pool.push(clueUnique(t, sign, R));
        else pool.push(clueGroup(t, n, sign, R));
      }
    });

    /* Spatial kinds, only when the caller supplied positions. */
    if (haveX(all)) {
      ['min', 'max'].forEach(function (dir) {
        if (extremeId(all, dir) === answer.id) pool.push(clueExtreme(dir, sign, R));
      });
      all.forEach(function (ref) {
        if (ref.id === answer.id) return;
        if (nearestId(all, ref.id) === answer.id) pool.push(clueNearest(ref, sign, R));
      });
    }
    return pool;
  }

  /* ---------------------------------------------------------------------
     TIER PROFILES
     Tiers 1-2 are gentle on purpose: the first chambers teach a player
     that the room is worth READING before they are asked to hold three
     constraints at once. `weakAlone` is what actually creates difficulty
     — it forbids any clue that gives the answer by itself, so from tier 2
     on you must combine. `requireAbstract` pulls in the clue kinds that
     talk about the room's structure ("the only one of its kind") rather
     than a plain property, which is the real step up at tier 4.
     --------------------------------------------------------------------- */
  var TIER_PROFILE = {
    1: { min: 1, max: 1, weakAlone: false, wantNeg: false, wantAbstract: false, allowDirect: true  },
    2: { min: 2, max: 2, weakAlone: true,  wantNeg: false, wantAbstract: false, allowDirect: false },
    3: { min: 2, max: 3, weakAlone: true,  wantNeg: true,  wantAbstract: false, allowDirect: false },
    4: { min: 3, max: 3, weakAlone: true,  wantNeg: true,  wantAbstract: true,  allowDirect: false },
    5: { min: 3, max: 4, weakAlone: true,  wantNeg: true,  wantAbstract: true,  allowDirect: false }
  };

  /* Enumerate combinations by index, capped. The pool is shuffled before
     this runs, so capping cannot bias the result toward one clue kind. */
  function combos(n, k, cap, visit) {
    var idx = [], count = { v: 0 };
    (function rec(start) {
      if (count.v >= cap) return;
      if (idx.length === k) { count.v++; visit(idx.slice()); return; }
      for (var i = start; i < n; i++) {
        if (count.v >= cap) return;
        idx.push(i); rec(i + 1); idx.pop();
      }
    })(0);
  }

  function validSet(all, answer, set, prof) {
    var surv = survivorsOf(all, set);
    if (surv.length !== 1 || surv[0].id !== answer.id) return false;

    /* DISTINCT ON SCREEN. Minimality below compares PREDICATES, so
       group/made/3 and group/kind/3 are two different clues to the
       generator -- and rendered identically to the player, who sees the
       same sentence printed twice and concludes the room is buggy.
       Chamber 5 shipped like that. What the player reads is what has to
       be distinct, not what the generator reasons about. */
    var seen = {};
    for (var d = 0; d < set.length; d++) {
      if (seen[set[d].text]) return false;
      seen[set[d].text] = true;
    }

    /* The dust cannot be both undisturbed and wiped away. clueNot's
       templates disagree about the room's physical state, and two of them
       landing together produced clues that contradict each other. */
    var wiped = 0, thick = 0;
    for (var w = 0; w < set.length; w++) {
      if (/has wiped|scuffed away|trail through/.test(set[w].text)) wiped++;
      if (/thick and unbroken|has been shifted in months/.test(set[w].text)) thick++;
    }
    if (wiped && thick) return false;

    /* MINIMALITY. Without this the generator happily emits "it is behind
       something wooden" plus "it is behind the chest" and calls it two
       clues. Every clue must be load-bearing or it is noise, and noise in
       an escape room reads as a lie. */
    for (var i = 0; i < set.length; i++) {
      var less = set.slice(0, i).concat(set.slice(i + 1));
      if (survivorsOf(all, less).length < 2) return false;
    }
    if (!prof.allowDirect) {
      for (i = 0; i < set.length; i++) if (set[i].pred.k === 'direct') return false;
    }
    if (prof.weakAlone) {
      for (i = 0; i < set.length; i++) {
        if (survivorsOf(all, [set[i]]).length < 2) return false;
      }
    }
    if (prof.wantNeg) {
      var neg = false;
      for (i = 0; i < set.length; i++) if (set[i].pred.k === 'not') neg = true;
      if (!neg) return false;
    }
    if (prof.wantAbstract) {
      var abs = false;
      for (i = 0; i < set.length; i++) if (ABSTRACT[set[i].pred.k]) abs = true;
      if (!abs) return false;
    }
    return true;
  }

  /* Search hardest-profile-first, then relax one demand at a time. Every
     relaxation costs flavour, never correctness — the uniqueness and
     minimality checks are in `validSet` and are never relaxed. */
  function chooseClues(all, answer, pool, prof, R) {
    var relax = [
      prof,
      { min: prof.min, max: prof.max, weakAlone: prof.weakAlone, wantNeg: prof.wantNeg,
        wantAbstract: false, allowDirect: prof.allowDirect },
      { min: prof.min, max: prof.max, weakAlone: prof.weakAlone, wantNeg: false,
        wantAbstract: false, allowDirect: prof.allowDirect },
      { min: prof.min, max: prof.max, weakAlone: false, wantNeg: false,
        wantAbstract: false, allowDirect: prof.allowDirect },
      { min: 1, max: Math.max(4, prof.max), weakAlone: false, wantNeg: false,
        wantAbstract: false, allowDirect: prof.allowDirect },
      { min: 1, max: Math.max(4, prof.max), weakAlone: false, wantNeg: false,
        wantAbstract: false, allowDirect: true }
    ];

    /* 16 is plenty: the whole point of the pool is variety, and beyond
       this the combination count grows faster than the interest does. */
    var p = shuffle(pool, R).slice(0, 16);

    for (var r = 0; r < relax.length; r++) {
      var prf = relax[r];
      var found = [];
      for (var k = prf.min; k <= prf.max; k++) {
        combos(p.length, k, 4000, function (ix) {
          var set = ix.map(function (i) { return p[i]; });
          if (validSet(all, answer, set, prf)) found.push(set);
        });
        /* Prefer the SMALLEST valid set at this profile. A three-clue set
           that a two-clue set already implies is padding. */
        if (found.length) break;
      }
      if (found.length) {
        return { clues: found[Math.floor(R() * found.length)], relaxed: r > 0, degraded: false };
      }
    }
    return null;
  }

  function joinNames(list) {
    var names = list.map(function (s) { return 'the ' + s.name; });
    if (names.length === 1) return names[0];
    return names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1];
  }

  /* ---------------------------------------------------------------------
     THE HINT LADDER
     The owner's words were "hints used is a final thing if I fail to
     understand a clue", so rung one assumes the player READ the clue and
     did not parse it, and says the same thing flatly. Rung two assumes
     they parsed it and cannot combine it, and hands them a short list.
     Only the last rung gives it away, and a player who understood the
     room never buys it.

     The last entry is ALWAYS the naming one, so the ladder cannot leave
     a player stuck no matter how many hints they buy. The suite asserts
     exactly that.
     --------------------------------------------------------------------- */
  function buildHints(all, answer, clues, tier, R) {
    var hints = [];
    var push = function (kind, text, spot) {
      var h = { level: hints.length + 1, kind: kind, text: text };
      if (spot) h.spot = spot;
      hints.push(h);
    };

    /* Restate at most two clues. Restating all four would BE the answer
       written out longhand, which is the thing this redesign exists to
       stop. */
    var lead = ['Read the marks again. ', 'And the other sign. '];
    clues.slice(0, 2).forEach(function (c, i) {
      push('restate', lead[i] + c.plain);
    });

    /* Narrow: the survivors of everything except the last clue. That is a
       genuine partial deduction — it is what the player would have if
       they had cracked all but one observation. */
    var partial = clues.slice(0, clues.length - 1);
    var surv = partial.length ? survivorsOf(all, partial) : [];
    if (surv.length < 2 || surv.length > 3) {
      var want = Math.min(all.length, (tier >= 4) ? 3 : 2);
      var others = shuffle(all.filter(function (s) { return s.id !== answer.id; }), R);
      surv = shuffle([answer].concat(others.slice(0, want - 1)), R);
    }
    push('narrow', 'It is one of these: ' + joinNames(surv) + '.');
    push('answer', 'The key is behind ' + ('the ' + answer.name) + '.', answer.id);
    return hints;
  }

  var Puzzle = {

    SPOTS: DEFAULT_SPOTS,
    SIGNS: SIGNS,
    /* Exported so themes.js can extend the vocabulary rather than fork
       the prose. A value with no entry still generates a correct clue. */
    VALUE_WORDS: VALUE_WORDS,
    BOOL_WORDS: BOOL_WORDS,
    TRAIT_NOUN: TRAIT_NOUN,
    CLUE_KINDS: ['is', 'not', 'unique', 'group', 'extreme', 'nearest', 'direct'],

    /* ==================================================================
       generateKeyHunt(seed, tier, spots)

         seed   chamber index — reproducible, same contract as generate()
         tier   1..5, see TIER_PROFILE
         spots  candidate list; ids, descriptors, or omitted for the
                built-in seven

       Returns:
         {
           answer:     'chest',            // PRIVATE. Never publish this.
           answerName: 'wooden chest',     // PRIVATE.
           tier, clueCount,
           degraded:   false,              // true == the trait table was
                                           //   too thin and the room fell
                                           //   back to a naming clue
           relaxed:    false,              // tier profile was loosened
           evidence: {                     // PUBLIC. All of it.
             sign:  'dust',
             spots: [{id,name,traits}],
             clues: [{id, text, plain, pred}]
           },
           hints: [{level, kind, text, spot?}]   // PRIVATE until paid for
         }

       `evidence` is everything a player can see standing in the doorway.
       `answer` and `hints` are not, and game.js must keep them off
       ECGame.state() — publishing either turns the e2e auto-solver from a
       proof into a tautology.
       ================================================================== */
    generateKeyHunt: function (seed, tier, spots) {
      var R = mulberry(seed * 26417 + 5381);
      var all = normalizeSpots(spots);
      if (all.length < 2) throw new Error('key hunt needs at least 2 candidate spots');

      var sign = SIGNS[((seed % SIGNS.length) + SIGNS.length) % SIGNS.length];
      var answer = all[Math.floor(R() * all.length)];
      var prof = TIER_PROFILE[tier] || TIER_PROFILE[5];

      var pool = buildPool(all, answer, sign, R);
      var got = chooseClues(all, answer, pool, prof, R);
      var degraded = false;

      if (!got) {
        /* Nothing in the trait table isolates this spot — two candidates
           are indistinguishable, or a theme shipped without traits. Ship
           a truthful naming clue rather than an ambiguous room. This is a
           bug in the DATA, so it is flagged, not hidden. */
        got = { clues: [clueDirect(answer, sign, R)], relaxed: true };
        degraded = true;
      }

      var clues = shuffle(got.clues, R).map(function (c, i) {
        return { id: 'c' + i, text: c.text, plain: c.plain, pred: c.pred };
      });

      /* Belt and braces: re-verify against the PUBLISHED clue objects,
         not the ones the search worked with. If a future refactor ever
         drops a field on the way out, the room degrades to a naming clue
         instead of becoming unsolvable. */
      var check = survivorsOf(all, clues);
      if (check.length !== 1 || check[0].id !== answer.id) {
        var d = clueDirect(answer, sign, R);
        clues = [{ id: 'c0', text: d.text, plain: d.plain, pred: d.pred }];
        degraded = true;
      }

      return {
        answer: answer.id,
        answerName: answer.name,
        tier: tier,
        clueCount: clues.length,
        degraded: degraded,
        relaxed: !!got.relaxed,
        evidence: {
          sign: sign,
          spots: all.map(function (s) {
            var o = { id: s.id, name: s.name, traits: s.traits };
            if (typeof s.x === 'number') o.x = s.x;
            return o;
          }),
          clues: clues
        },
        hints: buildHints(all, answer, clues, tier, R)
      };
    },

    /* Every spot still consistent with every clue. Exactly the working a
       player does on the way in, and the reason the e2e solver needs no
       privileged access. */
    keyHuntSurvivors: function (evidence) {
      if (!evidence || !evidence.spots || !evidence.clues) return [];
      return survivorsOf(evidence.spots, evidence.clues).map(function (s) { return s.id; });
    },

    /* PUBLIC INFORMATION ONLY. Returns the spot id, or null if the
       evidence does not pin one — which generation guarantees cannot
       happen, and which the suite asserts rather than assumes. */
    solveKeyHunt: function (evidence) {
      var s = this.keyHuntSurvivors(evidence);
      return s.length === 1 ? s[0] : null;
    },

    /* ---------------- theme lore (safe code) ----------------
       Escape-room design guidance is consistent on this: a clue buried in
       the narrative beats a disconnected instruction, and the theme should
       say WHY a number is there. "A number, scratched deep: 7" is the same
       puzzle in all twenty rooms. "Seven dead stars marked on the chart"
       is the Observatory.

       One entry per chamber, in the same order as THEMES in game.js.
         unit   what the numbers are counted in
         vessel where a written rule is found
         verb   how the number is recorded
       Nothing here changes a single answer — it is pure phrasing — so a
       bad entry can never make a chamber unsolvable. */
    LORE: [
      { unit: 'ink-stained page numbers', vessel: 'a bookplate',        verb: 'inked' },
      { unit: 'chalk marks on the casks',  vessel: 'a cellar ledger',    verb: 'chalked' },
      { unit: 'seed trays',                vessel: 'a planting card',    verb: 'pencilled' },
      { unit: 'dead stars on the chart',   vessel: 'a star-chart margin', verb: 'plotted' },
      { unit: 'nails in the rafter',       vessel: 'a luggage tag',      verb: 'scratched' },
      { unit: 'apothecary measures',       vessel: 'a prescription slip', verb: 'written' },
      { unit: 'leagues on the map scale',  vessel: 'a map cartouche',    verb: 'ruled' },
      { unit: 'panes of cracked glass',    vessel: 'a glazier’s docket', verb: 'cut' },
      { unit: 'catalogue volumes',         vessel: 'an index card',      verb: 'typed' },
      { unit: 'cogs on the gear train',    vessel: 'a maintenance plate', verb: 'stamped' },
      { unit: 'copper pans',               vessel: 'a kitchen slate',    verb: 'scrawled' },
      { unit: 'empty perches',             vessel: 'a keeper’s notebook', verb: 'noted' },
      { unit: 'hanging negatives',         vessel: 'a developing log',   verb: 'grease-pencilled' },
      { unit: 'orange trees in the row',   vessel: 'a gardener’s tally', verb: 'notched' },
      { unit: 'sealed deeds',              vessel: 'a wax seal',         verb: 'embossed' },
      { unit: 'pressure dials',            vessel: 'a boiler plate',     verb: 'riveted' },
      { unit: 'portraits in the run',      vessel: 'a gallery label',    verb: 'lettered' },
      { unit: 'ice blocks in the stack',   vessel: 'a delivery chit',    verb: 'frozen into' },
      { unit: 'bell ropes',                vessel: 'a ringer’s board',   verb: 'painted' },
      { unit: 'strongbox tumblers',        vessel: 'a bank docket',      verb: 'engraved' }
    ],

    FAMILIES: ['arith', 'logic', 'order'],

    /* len is 3 for tiers 1-3, 4 for tiers 4-5, matching the keypad.
       `avoid` is the spot already holding the brass key. It MUST be
       excluded here rather than filtered by the caller: dropping a fact
       after generation leaves a puzzle whose rule needs a number that
       exists nowhere in the room, which is an unwinnable chamber. That is
       exactly how chamber X shipped broken for one test run.
       `spots` is the candidate list — same descriptors generateKeyHunt
       takes, and omitted it falls back to the built-in seven. */
    generate: function (seed, len, family, avoid, spots) {
      var R = mulberry(seed * 6151 + 907);
      var lore = this.LORE[seed % this.LORE.length];
      family = family || this.FAMILIES[Math.floor(R() * this.FAMILIES.length)];
      var p = (family === 'arith') ? this._arith(R, len)
            : (family === 'logic') ? this._logic(R, len)
            : this._order(R, len);
      /* The generator, not the caller, decides the final family: _logic
         falls back to _arith when it cannot isolate a unique code, and
         stamping 'logic' over that produced a puzzle whose rule text the
         solver read with the wrong parser. Only default when unset. */
      p.family = p.family || family;

      /* Facts are scattered across distinct spots so no single search can
         hand over the whole puzzle. The door, safe, drawer and cabinet are
         never in this list on purpose: they are the LOCKS, and hiding a
         lock's own input inside it makes the chain circular. */
      var open = normalizeSpots(spots).filter(function (s) { return s.id !== avoid; });
      if (open.length < p.facts.length) {
        throw new Error('not enough free spots for ' + p.facts.length + ' facts');
      }
      var chosen = shuffle(open, R);
      p.facts.forEach(function (f, k) {
        f.spot = chosen[k].id;
        f.spotName = chosen[k].name;
      });

      /* Wrap the mechanical rule in the room's own language. The rule is
         unchanged -- only how it is told -- so themeing can never break a
         puzzle. */
      p.lore = lore;
      p.ruleText = 'On ' + lore.vessel + ', ' + lore.verb + ' plainly: ' + p.ruleText;

      /* ---------------- the trail ----------------
         Real escape rooms chain: one solve POINTS AT the next thing. A flat
         set of facts makes the room a tapping exercise, which is what this
         game was. Each fact now names where the next one is, so a player
         who finds one has a reason to go somewhere specific.

         The trail is a CONVENIENCE, never a gate. Every fact stays findable
         by searching its own spot directly, so a player who ignores the
         trail (or taps everything, as the auto-solver does) is never stuck.
         That keeps "all 20 completable" true without the trail having to be
         correct. */
      p.facts.forEach(function (f, k) {
        var next = p.facts[k + 1];
        f.pointsTo = next ? next.spot : null;
        f.pointsToName = next ? next.spotName : null;
      });
      p.startSpot = p.facts[0] ? p.facts[0].spot : null;
      p.startSpotName = p.facts[0] ? p.facts[0].spotName : null;
      return p;
    },

    /* ---------------- arithmetic ----------------
       Numbers are found, then combined. Deliberately uses × before + so
       the order of operations matters and reading the rule carelessly
       gives a wrong, checkable answer rather than a near-miss. */
    _arith: function (R, len) {
      var d = function () { return 1 + Math.floor(R() * 9); };
      var a = d(), b = d(), c = d();
      var total, rule;
      if (len === 3) {
        total = a * b + c;
        rule = 'Multiply the first two numbers, then add the third.';
      } else {
        var e = d();
        total = a * b + c * e;
        rule = 'Multiply the first two numbers. Multiply the last two. Add the results.';
        return {
          family: 'arith',
          code: String(total).padStart(4, '0').slice(-4),
          ruleText: rule + ' Four digits, padded with a leading zero if it is short.',
          shortRule: '(1st x 2nd) + (3rd x 4th)',
          hintText: 'Find all four numbers, multiply them in pairs, add the two results.',
          facts: [a, b, c, e].map(function (v, i) {
            return { order: i + 1, value: v };
          })
        };
      }
      return {
        family: 'arith',
        code: String(total).padStart(3, '0').slice(-3),
        ruleText: rule + ' Three digits, padded with a leading zero if it is short.',
        shortRule: '(1st x 2nd) + 3rd',
        hintText: 'Find all three numbers, multiply the first two, add the third.',
        facts: [a, b, c].map(function (v, i) { return { order: i + 1, value: v }; })
      };
    },

    /* ---------------- logic ----------------
       Constraints are emitted until exactly one code in the whole space
       satisfies them. Uniqueness is checked by brute force over 10^len,
       which is at most 10,000 candidates — cheap, and far safer than
       reasoning about whether a hand-written clue set happens to pin one
       answer. If the clue pool ever fails to isolate a code, generation
       falls back rather than shipping an unsolvable chamber. */
    _logic: function (R, len) {
      var space = Math.pow(10, len);
      var pad = function (n) { return String(n).padStart(len, '0'); };
      var digits = function (s) { return s.split('').map(Number); };

      for (var attempt = 0; attempt < 40; attempt++) {
        var target = pad(Math.floor(R() * space));
        var td = digits(target);
        var sum = td.reduce(function (x, y) { return x + y; }, 0);

        var pool = [
          { t: 'The digits add up to ' + sum + '.',
            f: function (d) { return d.reduce(function (x, y) { return x + y; }, 0) === sum; } },
          { t: 'The first digit is ' + (td[0] % 2 ? 'odd' : 'even') + '.',
            f: function (d) { return (d[0] % 2) === (td[0] % 2); } },
          { t: 'The last digit is ' + (td[len - 1] % 2 ? 'odd' : 'even') + '.',
            f: function (d) { return (d[len - 1] % 2) === (td[len - 1] % 2); } },
          { t: 'No digit is repeated.',
            f: function (d) { return new Set(d).size === d.length; } },
          { t: 'The first digit is ' + (td[0] > td[len - 1] ? 'larger' : 'smaller') +
               ' than the last.',
            f: function (d) {
              return td[0] > td[len - 1] ? d[0] > d[d.length - 1] : d[0] < d[d.length - 1];
            } },
          { t: 'The largest digit is ' + Math.max.apply(null, td) + '.',
            f: function (d) { return Math.max.apply(null, d) === Math.max.apply(null, td); } },
          { t: 'Exactly ' + td.filter(function (x) { return x % 2 === 0; }).length +
               ' of the digits are even.',
            f: function (d) {
              return d.filter(function (x) { return x % 2 === 0; }).length ===
                     td.filter(function (x) { return x % 2 === 0; }).length;
            } }
        ];

        /* "No digit is repeated" is only usable when it is actually true
           of the target, otherwise the clue would be a lie. */
        pool = pool.filter(function (c) { return c.f(td); });

        var chosen = [], survivors = null;
        var order = shuffle(pool, R);
        for (var k = 0; k < order.length; k++) {
          chosen.push(order[k]);
          survivors = [];
          for (var n = 0; n < space; n++) {
            var cand = digits(pad(n));
            var ok = true;
            for (var c = 0; c < chosen.length; c++) {
              if (!chosen[c].f(cand)) { ok = false; break; }
            }
            if (ok) {
              survivors.push(pad(n));
              if (survivors.length > 1 && k < order.length - 1) break;
            }
          }
          if (survivors.length === 1) {
            return {
              family: 'logic',
              code: target,
              ruleText: chosen.map(function (c) { return c.t; }).join(' '),
              shortRule: chosen.map(function (c) { return c.t; }).join(' '),
              hintText: 'The marks on the note describe one number and only one. ' +
                        'Work through the digits that fit all of them.',
              /* Logic needs no scattered numbers — the note carries it all.
                 One fact is still placed so the room search stays part of
                 the chain and the note is not simply lying in the open. */
              facts: [{ order: 1, value: null, note: true }]
            };
          }
        }
      }
      /* Could not isolate a single answer — fall back rather than ship an
         ambiguous safe. */
      return this._arith(R, len);
    },

    /* ---------------- ordering ----------------
       Numbers are found with a property attached, and the code is those
       numbers rearranged by that property. Tests reading, not arithmetic. */
    _order: function (R, len) {
      var vals = [], used = {};
      while (vals.length < len) {
        var v = 1 + Math.floor(R() * 9);
        if (!used[v]) { used[v] = true; vals.push(v); }
      }
      var asc = R() > 0.5;
      var sorted = vals.slice().sort(function (a, b) { return asc ? a - b : b - a; });
      return {
        family: 'order',
        code: sorted.join(''),
        ruleText: 'the numbers you find, ' +
                  (asc ? 'smallest first' : 'largest first') + '.',
        shortRule: asc ? 'smallest first' : 'largest first',
        hintText: 'Find every number in the room, then enter them ' +
                  (asc ? 'smallest to largest' : 'largest to smallest') + '.',
        facts: vals.map(function (x, i) { return { order: i + 1, value: x }; })
      };
    },

    /* ------------------------------------------------------------------
       Solve from PUBLIC information only — the same rule text and facts
       the player can see. Used by the e2e auto-solver, which is why it
       takes the rule text rather than the puzzle object.

       Note the contrast with solveKeyHunt: this one re-parses prose with
       regexes because the rule text is all the player is given. The key
       hunt publishes its predicates instead, which is strictly safer, and
       is the pattern to copy if a fifth safe rule is ever added.
       ------------------------------------------------------------------ */
    solveFromFacts: function (family, ruleText, facts, len) {
      var vals = facts.filter(function (f) { return typeof f.value === 'number'; })
                      .sort(function (a, b) { return a.order - b.order; })
                      .map(function (f) { return f.value; });

      if (family === 'arith') {
        var total = (len === 3) ? vals[0] * vals[1] + vals[2]
                                : vals[0] * vals[1] + vals[2] * vals[3];
        return String(total).padStart(len, '0').slice(-len);
      }
      if (family === 'order') {
        var asc = /smallest first/.test(ruleText);
        return vals.slice().sort(function (a, b) { return asc ? a - b : b - a; }).join('');
      }
      /* logic: brute force the stated constraints, exactly as a player
         would reason through them, parsed back out of the rule text. */
      var space = Math.pow(10, len);
      var pad = function (n) { return String(n).padStart(len, '0'); };
      var tests = [];
      var m;
      if ((m = /digits add up to (\d+)/.exec(ruleText))) {
        var s = +m[1];
        tests.push(function (d) { return d.reduce(function (x, y) { return x + y; }, 0) === s; });
      }
      if ((m = /first digit is (odd|even)/.exec(ruleText))) {
        var fo = m[1] === 'odd' ? 1 : 0;
        tests.push(function (d) { return d[0] % 2 === fo; });
      }
      if ((m = /last digit is (odd|even)/.exec(ruleText))) {
        var lo = m[1] === 'odd' ? 1 : 0;
        tests.push(function (d) { return d[d.length - 1] % 2 === lo; });
      }
      if (/No digit is repeated/.test(ruleText)) {
        tests.push(function (d) { return new Set(d).size === d.length; });
      }
      if ((m = /first digit is (larger|smaller) than the last/.exec(ruleText))) {
        var bigger = m[1] === 'larger';
        tests.push(function (d) {
          return bigger ? d[0] > d[d.length - 1] : d[0] < d[d.length - 1];
        });
      }
      if ((m = /largest digit is (\d)/.exec(ruleText))) {
        var mx = +m[1];
        tests.push(function (d) { return Math.max.apply(null, d) === mx; });
      }
      if ((m = /Exactly (\d+) of the digits are even/.exec(ruleText))) {
        var ec = +m[1];
        tests.push(function (d) {
          return d.filter(function (x) { return x % 2 === 0; }).length === ec;
        });
      }
      for (var n = 0; n < space; n++) {
        var cand = pad(n).split('').map(Number);
        var ok = true;
        for (var i = 0; i < tests.length; i++) { if (!tests[i](cand)) { ok = false; break; } }
        if (ok) return pad(n);
      }
      return null;
    }
  };

  /* Kept for callers that still want the bare id list. New code should
     take a spot descriptor list instead — the ids alone carry no traits,
     and traits are what the key hunt reasons over. */
  Puzzle.FACT_SPOTS = DEFAULT_SPOTS.map(function (s) { return s.id; });

  global.ECPuzzle = Puzzle;
})(window);
