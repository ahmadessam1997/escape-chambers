/* =====================================================================
   Escape Chambers — puzzles
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

   Adding another safe rule, or a new clue kind, means adding its solver
   here too, or the suite will correctly fail to escape the chamber.

   Chambers 21-30 (tiers 6 and 7, added in 1.7.0) bring three more safe
   rules — `mirror`, `chain` and `weave` — a five-digit code at tier 7,
   and two key-hunt profiles that demand TWO structural clues. Same
   contract throughout: one answer, solvable from the room, solver below.
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
    heap:      'is a loose heap',

    /* Added with chambers 21-30 (1.7.0). */
    film:      'is photographic film',
    herb:      'is dried leaf and stalk',
    remedy:    'is a remedy, or the makings of one',
    armour:    'is worn or carried as armour',
    weapon:    'is a weapon',
    sound:     'is made to give a note',
    keys:      'is a set of keys',
    case:      'is a case made to carry something',
    shield:    'is a shield'
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

  /* AN OBJECT'S PROPERTIES, IN THE CLUES' OWN WORDS (1.7.1).
     A 1-star review: "u can't tell what the items are so u don't know if
     they're flat or made of metal". The clues reason over these traits, and
     until now the only place a player could learn them was the drawing —
     and tapping an object to look at it costs a move. So the notebook and
     the search message print every axis a clue can talk about, using
     exactly the phrase a clue uses ("is metal", "opens, or has room inside
     it"), so a clue and an object can be matched word for word.
     Order is fixed: position, material, nature, build, alive. */
  var DESCRIBE_AXES = [
    { axis: 'place',  label: 'Position' },
    { axis: 'made',   label: 'Material' },
    { axis: 'kind',   label: 'Nature' },
    { axis: 'hollow', label: 'Build' },
    { axis: 'living', label: 'Alive' }
  ];
  function describeTraits(traits) {
    var out = [];
    traits = traits || {};
    DESCRIBE_AXES.forEach(function (d) {
      var v = traits[d.axis];
      if (v === undefined || v === null) return;
      out.push({ axis: d.axis, label: d.label, phrase: says(d.axis, v), value: v });
    });
    return out;
  }

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
    'belfry grime',   /* 20 bell tower          */
    'dried fixer',     /* 21 darkroom */
    'cellar mould',    /* 22 wine cellar */
    'condensation',    /* 23 control room */
    'liquorice powder', /* 24 apothecary */
    'carbon dust',     /* 25 projection booth */
    'lampblack',       /* 26 printing house */
    'grinding dust',   /* 27 armoury */
    'switchboard dust', /* 28 telephone exchange */
    'candle grease',   /* 29 organ loft */
    'brass dust'       /* 30 locksmith’s workshop */
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
    5: { min: 3, max: 4, weakAlone: true,  wantNeg: true,  wantAbstract: true,  allowDirect: false },
    /* Chambers 21-30. `minAbstract: 2` is the step up: two of the clues
       must be about the room's STRUCTURE ("alone in its material", "a set
       of three", the long shadow), so the player has to count and compare
       across all seven objects twice over, not once. Tier 7 also insists
       on four clues, every one of them load-bearing. */
    6: { min: 3, max: 4, weakAlone: true,  wantNeg: true,  wantAbstract: true,  minAbstract: 2, allowDirect: false },
    7: { min: 4, max: 4, weakAlone: true,  wantNeg: true,  wantAbstract: true,  minAbstract: 2, allowDirect: false }
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
      var abs = 0;
      for (i = 0; i < set.length; i++) if (ABSTRACT[set[i].pred.k]) abs++;
      if (abs < (prof.minAbstract || 1)) return false;
    }
    return true;
  }

  /* Search hardest-profile-first, then relax one demand at a time. Every
     relaxation costs flavour, never correctness — the uniqueness and
     minimality checks are in `validSet` and are never relaxed. */
  function chooseClues(all, answer, pool, prof, R) {
    var relax = [prof];
    /* The tier 6-7 demands give way one at a time before anything a tier-5
       room would keep: first the fourth clue, then the second structural
       clue. A room that lands here is still at least a full tier-5 room. */
    var step = function (min, minAbs) {
      relax.push({ min: min, max: prof.max, weakAlone: prof.weakAlone, wantNeg: prof.wantNeg,
                   wantAbstract: prof.wantAbstract, minAbstract: minAbs,
                   allowDirect: prof.allowDirect });
    };
    if (prof.min > 3) step(3, prof.minAbstract);
    if ((prof.minAbstract || 1) > 1) {
      step(prof.min, 1);
      if (prof.min > 3) step(3, 1);
    }
    relax = relax.concat([
      { min: Math.min(prof.min, 3), max: prof.max, weakAlone: prof.weakAlone, wantNeg: prof.wantNeg,
        wantAbstract: false, allowDirect: prof.allowDirect },
      { min: Math.min(prof.min, 3), max: prof.max, weakAlone: prof.weakAlone, wantNeg: false,
        wantAbstract: false, allowDirect: prof.allowDirect },
      { min: Math.min(prof.min, 3), max: prof.max, weakAlone: false, wantNeg: false,
        wantAbstract: false, allowDirect: prof.allowDirect },
      { min: 1, max: Math.max(4, prof.max), weakAlone: false, wantNeg: false,
        wantAbstract: false, allowDirect: prof.allowDirect },
      { min: 1, max: Math.max(4, prof.max), weakAlone: false, wantNeg: false,
        wantAbstract: false, allowDirect: true }
    ]);

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
        return { clues: found[Math.floor(R() * found.length)], relaxed: r > 0, level: r, degraded: false };
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
    describeTraits: describeTraits,
    says: says,
    CLUE_KINDS: ['is', 'not', 'unique', 'group', 'extreme', 'nearest', 'direct'],

    /* ==================================================================
       generateKeyHunt(seed, tier, spots)

         seed   chamber index — reproducible, same contract as generate()
         tier   1..7, see TIER_PROFILE
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
      var first = Math.floor(R() * all.length);
      var answer = all[first];
      var prof = TIER_PROFILE[tier] || TIER_PROFILE[7];

      var pool = buildPool(all, answer, sign, R);
      var got = chooseClues(all, answer, pool, prof, R);
      var degraded = false;

      /* TIERS 6-7 CHOOSE THE HIDING PLACE TO SUIT THE PUZZLE.
         Not every spot can carry four load-bearing clues with two
         structural ones among them — an object that is the only glass
         thing in the room is given away by a single sentence — and for
         tiers 1-5 that is accepted: the profile relaxes and the room is a
         little easier than its tier. The last ten chambers are the top of
         the curve, so there the generator walks on round the room from the
         spot it first drew until it finds one that supports the full
         profile, and keeps the least-relaxed it saw if none does.
         Tiers 1-5 never enter this loop, so the twenty shipped chambers
         (and every daily) generate exactly as before. */
      if (tier >= 6 && (!got || got.relaxed)) {
        for (var t = 1; t < all.length; t++) {
          var alt = all[(first + t) % all.length];
          var altGot = chooseClues(all, alt, buildPool(all, alt, sign, R), prof, R);
          if (altGot && (!got || altGot.level < got.level)) { got = altGot; answer = alt; }
          if (got && !got.relaxed) break;
        }
      }

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

       One entry per SETTING, in themes.js SETTINGS order.
         unit   what the numbers are counted in
         vessel where a written rule is found
         verb   how the number is recorded
       Nothing here changes a single answer — it is pure phrasing — so a
       bad entry can never make a chamber unsolvable. */
    LORE: [
      /* ONE ENTRY PER SETTING, in themes.js SETTINGS order — the same rule
         as SIGNS above, and until 1.7.0 broken in the same way: this table
         was still in the order of game.js's long-dead THEME NAMES, so the
         sealed tomb counted "seed trays" on "a planting card" and the cell
         block read its rule off "a bookplate". ECPuzzle.LORE.length MUST
         equal ECThemes.list.length; the suite asserts it. */
      { unit: 'tally strokes on the wall',  vessel: 'a warder’s charge sheet', verb: 'scratched' },      /*  1 cell block        */
      { unit: 'knots on the log-line',      vessel: 'a page of the ship’s log', verb: 'inked' },         /*  2 captain's cabin   */
      { unit: 'offering jars',              vessel: 'a priest’s ostracon',   verb: 'incised' },          /*  3 sealed tomb       */
      { unit: 'graduated measures',         vessel: 'a specimen label',      verb: 'pencilled' },        /*  4 laboratory        */
      { unit: 'cogs on the gear train',     vessel: 'a maintenance plate',   verb: 'stamped' },          /*  5 clockworks        */
      { unit: 'seed trays',                 vessel: 'a planting card',       verb: 'pencilled' },        /*  6 glasshouse        */
      { unit: 'catalogue volumes',          vessel: 'an index card',         verb: 'typed' },            /*  7 locked library    */
      { unit: 'ore tubs on the tally',      vessel: 'a shift ticket',        verb: 'chalked' },          /*  8 deep working      */
      { unit: 'dead stars on the chart',    vessel: 'a star-chart margin',   verb: 'plotted' },          /*  9 observatory       */
      { unit: 'pressure dials',             vessel: 'a boiler plate',        verb: 'riveted' },          /* 10 boiler room       */
      { unit: 'flashes of the lamp',        vessel: 'a keeper’s log',        verb: 'noted' },            /* 11 lamp room         */
      { unit: 'strongbox tumblers',         vessel: 'a bank docket',         verb: 'engraved' },         /* 12 vault             */
      { unit: 'ruled lines on the vellum',  vessel: 'a copyist’s margin',    verb: 'lettered' },         /* 13 scriptorium       */
      { unit: 'glass eyes in the tray',     vessel: 'a specimen tag',        verb: 'written' },          /* 14 taxidermist's     */
      { unit: 'sacks on the waybill',       vessel: 'a guard’s docket',      verb: 'punched' },          /* 15 guard's van       */
      { unit: 'ice blocks in the stack',    vessel: 'a delivery chit',       verb: 'frozen into' },      /* 16 icehouse          */
      { unit: 'painted soldiers in the box', vessel: 'a price ticket',       verb: 'pencilled' },        /* 17 toy workshop      */
      { unit: 'ligatures on the tray',      vessel: 'a case note',           verb: 'written' },          /* 18 operating theatre */
      { unit: 'valves in the rack',         vessel: 'a cue card',            verb: 'grease-pencilled' }, /* 19 radio station     */
      { unit: 'bell ropes',                 vessel: 'a ringer’s board',      verb: 'painted' },          /* 20 bell tower        */
      { unit: 'frames on the test roll', vessel: 'an exposure card', verb: 'pencilled' }, /* 21 darkroom */
      { unit: 'bottles left in the last bin', vessel: 'a bin label', verb: 'inked' }, /* 22 wine cellar */
      { unit: 'soundings on the chart', vessel: 'a page of the trim log', verb: 'logged' }, /* 23 control room */
      { unit: 'leeches in the jar', vessel: 'a page of the poison register', verb: 'entered' }, /* 24 apothecary */
      { unit: 'frames in the leader', vessel: 'a cue sheet', verb: 'pencilled' }, /* 25 projection booth */
      { unit: 'sorts in the type case', vessel: 'a galley proof', verb: 'set' }, /* 26 printing house */
      { unit: 'rivets on the breastplate', vessel: 'an armourer’s tally stick', verb: 'notched' }, /* 27 armoury */
      { unit: 'plugs left in the board', vessel: 'a trunk-call docket', verb: 'pencilled' }, /* 28 telephone exchange */
      { unit: 'pipes in the front rank', vessel: 'a tuner’s slip', verb: 'pencilled' }, /* 29 organ loft */
      { unit: 'levers in the great lock', vessel: 'a pattern card', verb: 'scribed' } /* 30 locksmith’s workshop */
    ],

    FAMILIES: ['arith', 'logic', 'order'],
    /* The rules chambers 21-30 draw from (game.js picks by chamber, so
       the ten rooms rotate through them rather than leaving it to chance).
       They are never chosen at random for tiers 3-5: FAMILIES above is the
       random pool, and changing it would re-roll every shipped chamber. */
    HARD_FAMILIES: ['mirror', 'chain', 'weave'],

    /* len is 3 for tiers 1-3, 4 for tiers 4-6, 5 for tier 7, matching the keypad.
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
            : (family === 'mirror') ? this._mirror(R, len)
            : (family === 'chain') ? this._chain(R, len)
            : (family === 'weave') ? this._weave(R, len)
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

        /* `s` is the WALL form (1.7.1). The full sentences ran to 170
           characters and were drawn as one line across the wall — off both
           edges of the screen and behind the furniture. The wall now carries
           this compact form; the full sentences (`t`, which the solver
           parses) are in the notebook. Neither form ever contains the code. */
        var evens = td.filter(function (x) { return x % 2 === 0; }).length;
        var pool = [
          { t: 'The digits add up to ' + sum + '.', s: 'digit sum ' + sum,
            f: function (d) { return d.reduce(function (x, y) { return x + y; }, 0) === sum; } },
          { t: 'The first digit is ' + (td[0] % 2 ? 'odd' : 'even') + '.',
            s: '1st digit ' + (td[0] % 2 ? 'odd' : 'even'),
            f: function (d) { return (d[0] % 2) === (td[0] % 2); } },
          { t: 'The last digit is ' + (td[len - 1] % 2 ? 'odd' : 'even') + '.',
            s: 'last digit ' + (td[len - 1] % 2 ? 'odd' : 'even'),
            f: function (d) { return (d[len - 1] % 2) === (td[len - 1] % 2); } },
          { t: 'No digit is repeated.', s: 'no digit repeats',
            f: function (d) { return new Set(d).size === d.length; } },
          { t: 'The first digit is ' + (td[0] > td[len - 1] ? 'larger' : 'smaller') +
               ' than the last.',
            s: '1st digit ' + (td[0] > td[len - 1] ? '>' : '<') + ' last',
            f: function (d) {
              return td[0] > td[len - 1] ? d[0] > d[d.length - 1] : d[0] < d[d.length - 1];
            } },
          { t: 'The largest digit is ' + Math.max.apply(null, td) + '.',
            s: 'max digit ' + Math.max.apply(null, td),
            f: function (d) { return Math.max.apply(null, d) === Math.max.apply(null, td); } },
          { t: 'Exactly ' + evens + ' of the digits are even.',
            s: evens + (evens === 1 ? ' even digit' : ' even digits'),
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
              shortRule: chosen.map(function (c) { return c.s; }).join(' · '),
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

    /* ---------------- mirror (chambers 21-30) ----------------
       Every number is found, then turned into what it LACKS: nine minus
       the number, set down in the order found. One step per digit, but a
       step — the numbers in the room are never the digits on the dials,
       which is the first time in the game that is true of every digit. */
    _mirror: function (R, len) {
      var vals = [];
      while (vals.length < len) vals.push(1 + Math.floor(R() * 9));
      return {
        family: 'mirror',
        code: vals.map(function (v) { return 9 - v; }).join(''),
        ruleText: 'Take each number you find away from nine, and set the answers down ' +
                  'in the order the numbers are numbered.',
        shortRule: '9 − each, in order',
        hintText: 'Find every number. Subtract each one from nine, and enter the results ' +
                  'first to last.',
        facts: vals.map(function (v, i) { return { order: i + 1, value: v }; })
      };
    },

    /* ---------------- chain (chambers 21-30) ----------------
       A running total. The first digit is the first number; each digit
       after it is the digit before plus the next number, keeping only the
       last figure. A slip anywhere corrupts everything after it, so this
       one rewards writing the working down. */
    _chain: function (R, len) {
      var vals = [], digits = [], run = 0;
      while (vals.length < len) vals.push(1 + Math.floor(R() * 9));
      vals.forEach(function (v, i) {
        run = (i === 0) ? v : (run + v) % 10;
        digits.push(run);
      });
      return {
        family: 'chain',
        code: digits.join(''),
        ruleText: 'Begin with the first number. For each number after it, add it to the ' +
                  'figure you last wrote down and keep only the final digit.',
        shortRule: 'running total, last digit only',
        hintText: 'Find every number. Write the first. Add the second to it and keep the ' +
                  'last digit; add the third to THAT, and so on to the end.',
        facts: vals.map(function (v, i) { return { order: i + 1, value: v }; })
      };
    },

    /* ---------------- weave (chambers 21-30) ----------------
       Ordering with a twist in the tail: sort the numbers, then exchange
       the two ends. Reads like the tier-3 ordering rule, which is the
       trap — a player who stops reading at the dash enters a code that is
       wrong in exactly two places. */
    _weave: function (R, len) {
      var vals = [], used = {};
      while (vals.length < len) {
        var v = 1 + Math.floor(R() * 9);
        if (!used[v]) { used[v] = true; vals.push(v); }
      }
      var asc = R() > 0.5;
      var s = vals.slice().sort(function (a, b) { return asc ? a - b : b - a; });
      var t = s[0]; s[0] = s[s.length - 1]; s[s.length - 1] = t;
      return {
        family: 'weave',
        code: s.join(''),
        ruleText: 'the numbers you find, ' + (asc ? 'smallest first' : 'largest first') +
                  ' — then exchange the first and the last.',
        shortRule: (asc ? 'smallest first' : 'largest first') + ', then swap the ends',
        hintText: 'Find every number. Put them ' +
                  (asc ? 'smallest to largest' : 'largest to smallest') +
                  ', then swap the first digit with the last one.',
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
      if (family === 'mirror') {
        return vals.map(function (v) { return 9 - v; }).join('');
      }
      if (family === 'chain') {
        var run = 0;
        return vals.map(function (v, i) {
          run = (i === 0) ? v : (run + v) % 10;
          return run;
        }).join('');
      }
      if (family === 'weave') {
        var up = /smallest first/.test(ruleText);
        var w = vals.slice().sort(function (a, b) { return up ? a - b : b - a; });
        var e = w[0]; w[0] = w[w.length - 1]; w[w.length - 1] = e;
        return w.join('');
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
