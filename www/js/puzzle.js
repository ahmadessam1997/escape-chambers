/* =====================================================================
   Escape: 20 Chambers — puzzles
   ---------------------------------------------------------------------
   Before this existed, every chamber was the same verb: SEARCH. The note
   in the drawer literally read out the safe code, and under UV the code
   simply glowed on a wall. Finding it was the whole puzzle, so the game
   rewarded patience rather than thought.

   A puzzle now produces the code instead of revealing it. The room still
   has to be searched — that is where the FACTS come from — but the facts
   are useless until they are combined by the rule written on the note.

   FOUR RULES, and the contract every one of them must satisfy:

     1. SOLVABLE FROM THE ROOM ALONE. Everything needed is either a fact
        placed in a searchable spot or the rule text itself. No outside
        knowledge, no guessing.
     2. EXACTLY ONE ANSWER. `logic` narrows a real candidate set and is
        rejected and regenerated until only one code survives; the others
        are computed forward, so uniqueness is structural.
     3. FACTS ARE PUBLIC, THE ANSWER IS NOT. `facts` is exposed on the
        game state because the player can see every one of them. `code` is
        never exposed. That is what keeps the e2e auto-solver honest: it
        solves the way a player does, so "every chamber is completable"
        stays a real claim rather than a restatement of the generator.

   Adding a fifth rule means adding its solver here too, or the suite will
   correctly fail to escape the chamber.
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

  /* Spots that may carry a numbered fact. The door, safe, drawer and
     cabinet are excluded on purpose: they are the LOCKS, and hiding a
     lock's own input inside it makes the chain circular. */
  var FACT_SPOTS = ['rug', 'plant', 'clock', 'pA', 'pB', 'shelf', 'chest'];
  var SPOTNAME = { rug: 'rug', plant: 'plant pot', clock: 'clock', pA: 'old map',
                   pB: 'portrait', shelf: 'bookshelf', chest: 'wooden chest' };

  function shuffle(arr, R) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(R() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------------- theme lore ----------------
     Escape-room design guidance is consistent on this: a clue buried in the
     narrative beats a disconnected instruction, and the theme should say
     WHY a number is there. "A number, scratched deep: 7" is the same puzzle
     in all twenty rooms. "Seven dead stars marked on the chart" is the
     Observatory.

     One entry per chamber, in the same order as THEMES in game.js.
       unit   what the numbers are counted in
       vessel where a written rule is found
       verb   how the number is recorded
     Nothing here changes a single answer — it is pure phrasing — so a bad
     entry can never make a chamber unsolvable. */
  var LORE = [
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
  ];

  var Puzzle = {
    LORE: LORE,
    FAMILIES: ['arith', 'logic', 'order'],

    /* len is 3 for tiers 1-3, 4 for tiers 4-5, matching the keypad.
       `avoid` is the spot already holding the brass key. It MUST be
       excluded here rather than filtered by the caller: dropping a fact
       after generation leaves a puzzle whose rule needs a number that
       exists nowhere in the room, which is an unwinnable chamber. That is
       exactly how chamber X shipped broken for one test run. */
    generate: function (seed, len, family, avoid) {
      var R = mulberry(seed * 6151 + 907);
      var lore = LORE[seed % LORE.length];
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
         hand over the whole puzzle. */
      var open = FACT_SPOTS.filter(function (s) { return s !== avoid; });
      if (open.length < p.facts.length) {
        throw new Error('not enough free spots for ' + p.facts.length + ' facts');
      }
      var spots = shuffle(open, R);
      p.facts.forEach(function (f, k) {
        f.spot = spots[k];
        f.spotName = SPOTNAME[spots[k]];
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

  Puzzle.FACT_SPOTS = FACT_SPOTS;
  global.ECPuzzle = Puzzle;
})(window);
