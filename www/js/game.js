/* =====================================================================
   Escape: 20 Chambers — the game
   ---------------------------------------------------------------------
   Twenty procedurally-seeded escape rooms in five themes, five difficulty
   tiers. The puzzle chain per tier:

     1  iron key hidden in one of seven searchable spots
     2  brass key hidden -> desk drawer -> iron key
     3  brass key -> drawer -> note (safe code) -> safe -> iron key
     4  brass key -> drawer -> UV lamp -> code glows on a wall item ->
        safe -> iron key
     5  as 4, but the safe holds a crank -> cabinet -> iron key, and the
        door also demands a four-sigil sequence read off the rug under UV

   Every chamber is provably completable — test/e2e.js solves all twenty
   end to end with an auto-solver rather than trusting the generator.
   ===================================================================== */
(function (global) {
  'use strict';

  var Cfg = global.ECConfig;
  var Save = global.ECSave;
  var Billing = global.ECBilling;
  var Ads = global.ECAds;
  var Shop = global.ECShop;
  var Themes = global.ECThemes;

  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- little helpers ---------------- */
  var toastEl, toastT;
  function toast(m) {
    toastEl.textContent = m;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2800);
  }
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  /* Fisher-Yates against the seeded RNG.

     This replaced `arr.sort(() => R() - .5)`, which was not merely a
     biased shuffle: Array.prototype.sort calls the comparator a number
     of times that depends on the engine's sort implementation, so it
     consumed an unpredictable slice of the RNG stream. Every value drawn
     afterwards — taunts, safe code, sigils — therefore differed between
     V8 and the Android WebView, meaning the "seeded, reproducible"
     chambers were nothing of the sort and a hint written against one
     layout could describe another. */
  function shuffle(arr, R) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(R() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Twenty names, not five cycled. The old build set
     `body.className = 't' + (i % 5)`, so chambers I, VI, XI and XVI were
     pixel-identical and the game read as one room repainted — which is
     exactly what it was. Each chamber now gets its own name, its own
     seeded palette (paletteFor) and its own seeded layout (layoutFor). */
  var THEMES = [
    'THE STUDY',      'THE CELLAR',      'THE GREENHOUSE',  'THE OBSERVATORY',
    'THE ATTIC',      'THE APOTHECARY',  'THE MAP ROOM',    'THE CONSERVATORY',
    'THE ARCHIVE',    'THE CLOCKWORKS',  'THE SCULLERY',    'THE AVIARY',
    'THE DARKROOM',   'THE ORANGERY',    'THE MUNIMENT',    'THE BOILER ROOM',
    'THE LONG GALLERY','THE ICEHOUSE',   'THE BELFRY',      'THE VAULT'
  ];
  var ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X',
               'XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];
  var SEARCH = ['rug','plant','clock','pA','pB','shelf','chest'];
  var SPOTNAME = { rug:'rug', plant:'plant pot', clock:'clock', pA:'old map',
                   pB:'portrait', shelf:'bookshelf', chest:'wooden chest' };
  var CLUES = ['pA','pB','clock'];
  var UVEL = { pA:'uvA', pB:'uvB', clock:'uvC' };
  var SYMS = ['☀','☾','★','♜','⚘','⚓','☘','⚡'];
  var ICON = { brassKey:'🗝️', ironKey:'🔑', uv:'🔦', note:'📜', crank:'⚙️' };
  var LBL  = { brassKey:'brass key', ironKey:'iron key', uv:'UV lamp',
               note:'note', crank:'crank' };

  /* ---------------- per-chamber look ----------------
     Palettes are generated rather than hand-written, so twenty chambers
     cost twenty seeds instead of twenty stylesheets. Everything derives
     from one base hue, which keeps a room internally harmonious while
     making neighbouring chambers unmistakably different.

     The lightness figures are deliberately low and narrow. --ink is a warm
     near-white applied over --wall and --panel, so a wall that drifts
     bright enough to fight it makes the whole room unreadable. Keep walls
     under ~22% lightness if you retune these. */
  function hsl(h, s, l) { return 'hsl(' + ((h % 360) + 360) % 360 + ',' + s + '%,' + l + '%)'; }

  function paletteFor(i) {
    var R = mulberry(i * 2654435761 + 12345);
    /* Spread hues around the wheel by index first, then jitter, so no two
       consecutive chambers land in the same family even by chance. */
    var base = (i * 360 / 20 + R() * 24 - 12 + 200) % 360;
    /* Floors lean warm and walls lean cool in most rooms; flipping that on
       some chambers is what stops the set feeling like one tinted image. */
    var warmFloor = R() > 0.35;
    var fh = warmFloor ? (base + 150) % 360 : (base + 20) % 360;
    var ah = (base + (R() > 0.5 ? 40 : -40) + 180) % 360;   // accent opposes
    var sat = 16 + Math.floor(R() * 14);
    return {
      '--bg':     hsl(base, sat + 8, 5),
      '--wall':   hsl(base, sat, 17),
      '--wall2':  hsl(base, sat, 12),
      '--floor':  hsl(fh, sat + 6, 20),
      '--floor2': hsl(fh, sat + 6, 12),
      '--panel':  hsl(base, sat + 2, 13),
      '--line':   hsl(base, sat + 6, 26),
      '--accent': hsl(ah, 62, 62),
      '--soft':   hsl(base, 18, 66),
      '--glow':   hsl(ah, 82, 80)
    };
  }

  /* Geometry variation. Mirroring alone was NOT enough — the furniture
     stayed in identical places in all twenty rooms, so they still read as
     one chamber recoloured. This actually MOVES things.

     Slot centres come from the real SVG geometry:
       floor  plant≈78  safe≈175  rug≈330  chest≈540
       wall   map≈234   portrait≈414  clock≈500  shelf≈434

     Only objects of comparable width are permuted with each other. The map
     is 212 wide and would collide with the cabinet and door if it were
     dropped into the clock's slot, so it only ever jitters. The desk stays
     put: it anchors the room, and the drawer is a lock whose position the
     hints describe by name, not place. */
  var FLOOR_SLOTS = { plant: 78, safe: 175, chest: 540 };
  var WALL_SLOTS  = { pB: 414, clock: 500 };

  function layoutFor(i) {
    var R = mulberry(i * 40503 + 7);
    var lay = { mirror: R() > 0.5, tilt: (R() * 2 - 1) * 1.4,
                scale: 0.965 + R() * 0.07, move: {} };

    /* Floor: a genuine permutation, so the safe really is somewhere else. */
    var fIds = Object.keys(FLOOR_SLOTS);
    var fTargets = shuffle(fIds, R);
    fIds.forEach(function (id, k) {
      lay.move[id] = { dx: FLOOR_SLOTS[fTargets[k]] - FLOOR_SLOTS[id], dy: 0 };
    });

    /* Wall: portrait and clock are close enough in size to swap cleanly. */
    if (R() > 0.5) {
      lay.move.pB    = { dx: WALL_SLOTS.clock - WALL_SLOTS.pB, dy: 0 };
      lay.move.clock = { dx: WALL_SLOTS.pB - WALL_SLOTS.clock, dy: 0 };
    } else {
      lay.move.pB = { dx: 0, dy: 0 };
      lay.move.clock = { dx: 0, dy: 0 };
    }

    /* Hanging height and small shuffles — cheap, and it stops the two
       permutations from being the only thing that differs. */
    lay.move.pA    = { dx: (R() * 2 - 1) * 26, dy: (R() * 2 - 1) * 16 };
    lay.move.shelf = { dx: (R() * 2 - 1) * 30, dy: (R() * 2 - 1) * 12 };
    lay.move.rug   = { dx: (R() * 2 - 1) * 22, dy: 0 };
    ['pB', 'clock'].forEach(function (id) {
      lay.move[id].dy = (R() * 2 - 1) * 14;
    });
    return lay;
  }

  /* Every listener on a node that paintRoom() replaces. MUST be re-run
     after each repaint: innerHTML throws the old nodes away and their
     handlers with them, leaving a room that draws correctly and responds
     to nothing. */
  function bindRoomTaps() {
    SEARCH.forEach(function (id) {
      $(id).addEventListener('click', function () { searchSpot(id); });
    });

    $('drawer').addEventListener('click', function (e) {
      e.stopPropagation();
      if (!inChamber()) return;
      if (L.tier === 1) { toast('Unlocked, and utterly empty. Rude.'); return; }
      if (S.drawer) { toast('The drawer hangs open, empty.'); return; }
      if (S.sel === 'brassKey') {
        S.drawer = true; S.moves++; take('brassKey');
        $('drawerOpenG').style.display = '';
        $('drawerItem').textContent = ICON[L.drawerHas];
        give(L.drawerHas); buzz([20, 40, 20]);
        toast('Click! Inside the drawer: a ' + LBL[L.drawerHas] + '.');
      } else toast('Locked. A small brass keyhole winks at you.');
    });

    $('safe').addEventListener('click', function () {
      if (!inChamber()) return;
      if (L.tier < 3) { toast('An old safe, welded shut for good. Decorative, apparently.'); return; }
      if (S.safe) { toast('The safe gapes open, empty.'); return; }
      openPad();
    });

    $('cab').addEventListener('click', function () {
      if (!inChamber()) return;
      if (L.tier < 5) { toast('The cabinet is painted shut. Decades ago, by the look of it.'); return; }
      if (S.cab) { toast('Nothing left inside.'); return; }
      if (S.sel === 'crank') {
        S.cab = true; S.moves++; take('crank');
        $('cabOpenG').style.display = '';
        give(L.cabHas); buzz([20, 40, 20]);
        toast('You crank the mechanism — the cabinet groans open. The iron key!');
      } else toast('A hexagonal socket. It wants a crank.');
    });

    $('door').addEventListener('click', function () {
      if (!inChamber()) return;
      if (L.tier >= 5 && !S.seqDone) { openSym(); return; }
      if (S.sel === 'ironKey') escape();
      else if (S.items.ironKey) toast('Select the iron key first, then tap the door.');
      else toast(L.tier >= 5 && S.seqDone
        ? 'The sigils hum, satisfied. Now it wants the iron key.'
        : 'Locked tight. This needs a heavy iron key.');
    });

    $('candleG').addEventListener('click', function () {
      toast('The flame gutters, as if breathing.');
    });
  }

  /* Replace the scene's contents with this chamber's setting. The <svg>
     element and its viewBox stay; everything inside is swapped.

     Listeners are (re)bound after every paint because innerHTML discards the
     old nodes along with their handlers — a paint without a rebind leaves a
     room that renders perfectly and ignores every tap. */
  function paintRoom(i) {
    var sc = $('scene');
    sc.innerHTML = Themes.defs() + Themes.roomSVG(L.setting);
    bindRoomTaps();
  }

  function applyRoomStyle(i) {
    /* The SETTING's hand-picked palette wins. paletteFor() is the seeded
       fallback from before themes existed, and letting it run here painted
       a stone cell in navy — the art and the colour disagreeing about what
       room you are in. */
    var pal = (L && L.setting && L.setting.palette) || paletteFor(i);
    Object.keys(pal).forEach(function (k) {
      document.body.style.setProperty(k, pal[k]);
    });
    var lay = layoutFor(i);
    var sc = $('scene');
    /* transform-box/origin keep the mirror centred on the viewBox rather
       than the element's padded bounds, which otherwise slides the room
       sideways and clips the door. */
    sc.style.transformBox = 'fill-box';
    sc.style.transformOrigin = 'center';
    sc.style.transform =
      (lay.mirror ? 'scaleX(-1) ' : '') +
      'rotate(' + lay.tilt.toFixed(2) + 'deg) scale(' + lay.scale.toFixed(3) + ')';

    /* Set every movable group EXPLICITLY each time, including back to zero.
       Leaving a stale transform behind would carry one chamber's layout
       into the next, which is worse than no variation at all. */
    Object.keys(lay.move).forEach(function (id) {
      var el = $(id);
      if (!el) return;
      var m = lay.move[id];
      el.setAttribute('transform',
        'translate(' + m.dx.toFixed(1) + ',' + (m.dy || 0).toFixed(1) + ')');
    });
    return lay;
  }

  function genLevel(i) {
    var R = mulberry(i * 7919 + 31);
    var pick = function (a) { return a[Math.floor(R() * a.length)]; };
    var tier = i < 4 ? 1 : i < 8 ? 2 : i < 12 ? 3 : i < 16 ? 4 : 5;

    /* The setting supplies both the artwork AND the candidate spots, with
       the physical traits the key hunt reasons over. The same descriptor
       array MUST go to generateKeyHunt and generate: passing it to only one
       gives a room whose numbers hide at "rug" and "plant" while the art
       draws a slop bucket and a barred window. */
    var setting = Themes.themeFor(i);

    /* SPATIAL CLUES MUST USE THE COORDINATES THE PLAYER SEES.
       themes.js gives every object its static anchor, but layoutFor() then
       permutes the floor slots, swaps two wall slots, and MIRRORS the whole
       room in half the chambers. A clue reasoning over anchors therefore
       says "furthest to the left" about an object drawn on the right.
       Measured before this fix: of rooms containing a spatial clue, 56.8%
       pointed at the wrong object once the layout was applied. It happened
       not to fire on the shipped twenty, which is luck, not correctness.

       So the descriptors handed to the generator carry POST-LAYOUT screen
       coordinates: slot offset applied, then mirrored about the 800-wide
       viewBox if this chamber is mirrored. */
    var lay = layoutFor(i);
    var spotDescs = setting.search.map(function (id) {
      var o = setting.byId[id];
      var mv = lay.move[id] || { dx: 0, dy: 0 };
      var x = (o.x || 0) + (mv.dx || 0);
      var d = { x: lay.mirror ? (800 - x) : x, y: (o.y || 0) + (mv.dy || 0) };
      for (var k in o) { if (!(k in d)) d[k] = o[k]; }
      return d;
    });

    /* THE KEY IS NOW DEDUCED, NOT STUMBLED ON. It used to be spots[0] of a
       shuffle with nothing in the room referring to it, so the only strategy
       was to tap all seven. generateKeyHunt picks a spot AND the evidence
       that proves it, verifying by brute force that exactly one spot
       survives. `degraded` means it fell back to naming the spot outright —
       the old blind-search behaviour — so the suite asserts it never fires. */
    var hunt = global.ECPuzzle.generateKeyHunt(i, tier, spotDescs);

    var L = { tier: tier, setting: setting, spotDescs: spotDescs,
              hunt: hunt, brassSpot: hunt.answer, clueSpot: pick(CLUES),
              hides: {}, taunts: {}, code: '', seq: [] };
    /* The SETTING's own taunts. themes.js writes eight per setting and they
       were being discarded for a hardcoded list, so a player searching a
       sarcophagus in the sealed tomb read "You find lint. Congratulations."
       — study text, in a tomb, which is the exact complaint this redesign
       exists to answer. */
    var T = (setting.taunts && setting.taunts.length) ? setting.taunts
          : ['Dust. Endless dust.', 'A spider glares back at you.',
             'Nothing but cobwebs.', 'Something skitters away. Nope.',
             'Empty. Suspiciously empty.', 'Just old memories.',
             'You find lint. Congratulations.', 'A faded receipt from long ago.'];
    SEARCH.forEach(function (s) { L.taunts[s] = pick(T); });
    /* The code is now the ANSWER to a puzzle rather than a number lying
       around to be found. Tiers 1-2 have no safe, so they carry no puzzle
       and stay a pure search — that progression is deliberate: the first
       chambers teach the room before they ask you to think about it. */
    var codeLen = tier >= 4 ? 4 : 3;
    if (tier >= 3 && global.ECPuzzle) {
      /* brassSpot is passed in so the generator never places a fact on the
         key's spot. Filtering here instead would silently delete a needed
         number and leave the chamber unwinnable. */
      L.puzzle = global.ECPuzzle.generate(i, codeLen, null, L.brassSpot, L.spotDescs);
      L.code = L.puzzle.code;
      L.factAt = {};
      L.puzzle.facts.forEach(function (f) {
        if (f.spot && typeof f.value === 'number') L.factAt[f.spot] = f;
      });
    } else {
      L.code = Array.from({ length: codeLen },
                          function () { return Math.floor(R() * 10); }).join('');
    }
    L.hides[L.brassSpot] = (tier === 1) ? 'ironKey' : 'brassKey';
    if (tier === 2) L.drawerHas = 'ironKey';
    if (tier === 3) { L.drawerHas = 'note';  L.safeHas = 'ironKey'; }
    if (tier === 4) { L.drawerHas = 'uv';    L.safeHas = 'ironKey'; }
    if (tier === 5) {
      L.drawerHas = 'uv'; L.safeHas = 'crank'; L.cabHas = 'ironKey';
      L.seq = shuffle(SYMS, R).slice(0, 4);
    }
    return L;
  }

  /* ---------------- state ---------------- */
  var cur = 0, L = null, S = null, timerInt = null, t = 0;
  var entry = '', symEntry = [];
  var fmt = function (s) { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  function inChamber() { return !!(L && S && !S.escaped); }

  var ORD = ['', 'first', 'second', 'third', 'fourth'];
  function numeral(n) { return ORD[n] || ('#' + n); }

  /* ---------------- observations ----------------
     What the player can see from the doorway. This is the fix for "just
     search randomly": the evidence that identifies the key's hiding place
     is on screen from the moment the chamber opens, and stays there.

     Deliberately shows `text` (the flavoured observation) and never
     `plain` — `plain` is the first rung of the hint ladder, so printing it
     here would delete the puzzle it is meant to rescue. */
  function renderObs() {
    var box = $('obs');
    if (!L || !L.hunt || !L.hunt.evidence.clues.length) {
      box.classList.remove('show');
      $('obsToggle').style.display = 'none';
      return;
    }
    $('obsToggle').style.display = '';
    var html = '<b>What you notice</b><ul>';
    L.hunt.evidence.clues.forEach(function (c) {
      html += '<li>' + c.text + '</li>';
    });
    html += '</ul>';

    /* Hints the player has ALREADY PAID FOR stay here permanently and free.
       A hint that lives only in a 2.8s toast is bought and then lost, and
       the player has to buy the next rung just to see anything again —
       which turns a rescue into a pump. Keeping them visible is also what
       makes "re-reading is free" still true now that each press of the
       hint button buys the NEXT rung rather than repeating the last. */
    if (S && S.keyRung > 0 && L.hunt.hints.length) {
      html += '<b>Hints you bought</b><ul>';
      for (var k = 0; k < S.keyRung && k < L.hunt.hints.length; k++) {
        html += '<li>💡 ' + L.hunt.hints[k].text + '</li>';
      }
      html += '</ul>';
    }
    box.innerHTML = html;
  }

  /* The object's name IN THIS SETTING. SPOTNAME survives only as the
     fallback for a room built before themes existed. */
  function spotName(id) {
    var o = L && L.setting && L.setting.byId[id];
    return (o && o.name) || SPOTNAME[id] || id;
  }

  /* ---------------- stars ----------------
     PAR is the fewest productive actions a chamber can be finished in, and
     it is DERIVED from the chamber, never hand-tuned — so it is exactly
     achievable and the e2e solver proves it by scoring five stars on all
     twenty. Get par, get five stars.

     A star is lost per extra action, which is what makes stars a measure of
     READING the room: tapping a second spot means you had not worked out
     where the key was, and a wrong code means you guessed. Time is
     deliberately NOT part of the star — thinking should be free, and a
     scoring rule that punishes thinking would push players straight back to
     tapping everything. Time only breaks ties between equal stars. */
  function parFor(L) {
    var par = 1;                                  // the key's hiding place
    if (L.tier >= 2) par += 1;                    // the drawer
    if (L.tier >= 3) {
      /* Each number the safe rule needs, plus one correct code entry. */
      par += Object.keys(L.factAt || {}).length + 1;
    }
    if (L.tier >= 5) par += 1;                    // the cabinet
    return par;
  }

  function starsFor(moves, par) {
    var over = Math.max(0, moves - par);
    return Math.max(1, 5 - over);                 // never below one for finishing
  }

  function starString(n) {
    return new Array(n + 1).join('★') + new Array(6 - n).join('☆');
  }

  /* ---------------- rankings ----------------
     One table, one ordering rule, and a shape a server can fill.

     `ECGame.rankRows(i)` returns the ranked entries for a chamber as
     `{ who, stars, seconds, moves, me }`. Right now the only entry is the
     player's own best, so this is a personal record book — an honest one.
     A WORLD ranking needs a backend to hold other people's runs; nothing
     here fakes one, because a leaderboard of invented names is worse than
     none. When a server exists, it returns rows in this shape and only
     `rankRows` changes. */
  function rankRows(i) {
    var rows = [];
    var mine = Save.bestFor(i);
    if (mine) {
      rows.push({ who: 'You', stars: mine.stars, seconds: mine.seconds,
                  moves: mine.moves, me: true });
    }
    return rows.sort(Save.compareRuns);
  }

  /* EVERY CHAMBER HAS ITS OWN BOARD.
     One combined table was unfair: chamber I is a single search and chamber
     XX is a four-digit safe plus a sigil lock, so their times are not
     comparable and a player who only finished the easy rooms would outrank
     one who cleared the hard ones. Ranking within a chamber compares like
     with like. `rankLevel` is which board is on screen; null = the index. */
  var rankLevel = null;

  function showRankings(level) {
    rankLevel = (typeof level === 'number') ? level : null;
    if (rankLevel === null) return showRankIndex();

    var i = rankLevel;
    var rows = rankRows(i);
    var rec = Save.bestFor(i);

    $('rankSummary').innerHTML =
      '<b>' + Themes.themeFor(i).name + '</b> · Chamber ' + ROMAN[i] +
      (rec ? '' : '<br>Not yet escaped — no time on this board.');

    var html = '<tr><th>#</th><th>Player</th><th>Stars</th><th>Time</th><th>Moves</th></tr>';
    if (rows.length) {
      rows.forEach(function (r, k) {
        html += '<tr class="' + (r.me ? 'me' : '') + '">' +
                '<td>' + (k + 1) + '</td>' +
                '<td>' + r.who + '</td>' +
                '<td class="s">' + starString(r.stars) + '</td>' +
                '<td>' + fmt(r.seconds) + '</td>' +
                '<td>' + r.moves + '</td></tr>';
      });
    } else {
      html += '<tr><td colspan="5">Escape this chamber to take a place.</td></tr>';
    }
    $('rankTable').innerHTML = html;

    $('rankNote').innerHTML =
      'Ranked by <b>stars first, then time</b> — a five-star run always beats ' +
      'a faster four-star one. Stars measure how well you read the room; time ' +
      'only separates players who read it equally well.' +
      '<br><br>Each chamber is ranked <b>on its own</b>: chamber I is one search, ' +
      'chamber XX is a safe and a sigil lock, so their times are not comparable.' +
      '<br><br><b>World rankings are not live yet.</b> They need a server to hold ' +
      'other players’ runs, so this board is your own record for now.';
    $('rankBack').style.display = '';
    $('rankOv').classList.add('show');
  }

  /* The index: one row per chamber, tapping through to that chamber's board. */
  function showRankIndex() {
    var done = Object.keys(Save.data.best).length;
    $('rankSummary').innerHTML = done
      ? '<b>' + Save.totalStars() + '</b> of 100 stars · <b>' + done +
        '</b> of 20 chambers ranked<br><span class="par">Tap a chamber for its own board</span>'
      : 'No runs yet. Escape a chamber to take a place on its board.';

    var html = '<tr><th>#</th><th>Chamber</th><th>Your best</th><th>Time</th></tr>';
    for (var i = 0; i < 20; i++) {
      var rec = Save.bestFor(i);
      html += '<tr class="rankRow" data-level="' + i + '">' +
              '<td>' + (i + 1) + '</td>' +
              '<td>' + Themes.themeFor(i).name + '</td>' +
              '<td class="s">' + (rec ? starString(rec.stars) : '—') + '</td>' +
              '<td>' + (rec ? fmt(rec.seconds) : '—') + '</td></tr>';
    }
    $('rankTable').innerHTML = html;

    Array.prototype.forEach.call($('rankTable').querySelectorAll('.rankRow'), function (tr) {
      tr.addEventListener('click', function () {
        showRankings(Number(tr.dataset.level));
      });
    });

    $('rankNote').innerHTML =
      'Every chamber keeps its <b>own</b> ranking, so a fast run in an easy room ' +
      'never outranks a hard one. Within a chamber: <b>stars first, then time</b>.';
    $('rankBack').style.display = 'none';
    $('rankOv').classList.add('show');
  }

  /* A paid hint should advance the player one step, not hand over the
     answer. Names the first number still missing — which is exactly what a
     good escape-room host does when a team stalls. */
  function nextStepHint() {
    if (!L.puzzle) return '';
    var missing = L.puzzle.facts.filter(function (f) {
      return typeof f.value === 'number' && !S.factsFound[f.spot];
    });
    if (!missing.length) return ' You have every number — now apply the rule.';
    return ' You are still missing one: look at the ' + missing[0].spotName + '.';
  }

  /* A found number, told in the room's own language. The ordinal is NOT
     decoration: every rule refers to "the first two numbers", so without it
     the player has facts they cannot order and the puzzle is unfair. */
  function factLine(f, again) {
    var lore = L.puzzle && L.puzzle.lore;
    var what = lore ? lore.unit : 'marks';
    var line = (again ? 'Again — ' : '') +
               f.value + ' ' + what +
               '  ·  the ' + numeral(f.order) + ' of ' + L.puzzle.facts.length;
    /* The trail: point at the next find, but only while it is still
       unfound, so a player re-reading an old clue is not sent back to a
       spot they have already emptied. */
    if (f.pointsTo && !S.factsFound[f.pointsTo]) {
      line += '.  Beneath it, an arrow toward the ' + f.pointsToName + '.';
    }
    return line;
  }

  /* ---------------- hint wallet ---------------- */
  function hintLabel() {
    if (Save.data.unlimitedHints) return '💡 ♾';
    return '💡 ' + Save.data.hints;
  }
  function refreshHintUI() {
    $('hintBtn').textContent = hintLabel();
    $('menuHints').textContent = Save.data.unlimitedHints
      ? 'Unlimited hints'
      : Save.data.hints + (Save.data.hints === 1 ? ' hint left' : ' hints left');
  }

  /* Returns {key,text}. The key identifies the puzzle STEP, not the
     wording, so re-reading a hint you already paid for in this chamber is
     free — a player who dismisses the toast by accident should not be
     charged twice for the same sentence. */
  function nextHint() {
    var has = function (n) { return !!S.items[n]; };
    /* The key hunt's own graduated ladder REPLACES the two hints that used
       to live here ("Search the rug, plant, clock…" and "Search every
       corner"). Both told the player to do the exact thing this redesign
       removes, and the first also hardcoded the study's furniture, so it
       named objects that no longer exist in a prison cell.

       Rungs: restate a clue in plainer words -> narrow to 2-3 candidates ->
       only then name the spot. A player who understood the clue never
       reaches the last rung, which is the point: hints rescue, they do not
       substitute. */
    var needKey = (L.tier === 1 && !has('ironKey')) ||
                  (L.tier > 1 && !has('brassKey') && !S.drawer);
    if (needKey && L.hunt && L.hunt.hints.length) {
      var idx = Math.min(S.keyRung || 0, L.hunt.hints.length - 1);
      var rung = L.hunt.hints[idx];
      return { key: 'keyhunt:' + rung.level, text: rung.text, keyRung: idx };
    }
    if (L.tier > 1 && !S.drawer && has('brassKey'))
      return { key: 'useBrass', text: 'Select the brass key, then tap the desk drawer.' };
    if (L.tier === 3 && S.drawer && !S.safe)
      return { key: 'note',
               text: L.puzzle
                 ? 'Read the note in your bag — it gives the RULE, not the number. ' +
                   L.puzzle.hintText + nextStepHint()
                 : 'The note in your bag knows the safe code. Tap the note to read it, then tap the safe.' };
    if (L.tier >= 4 && has('uv') && !S.uvOn && !S.safe)
      return { key: 'uvOn', text: 'Switch the UV lamp on (tap it in your bag), then look around.' };
    if (L.tier >= 4 && S.uvOn && !S.safe)
      return { key: 'uvRead', text: 'One wall item glows with a number. Read it, then try the safe.' };
    if (L.tier >= 5 && S.safe && !S.cab)
      return { key: 'crank', text: 'The crank fits the tall cabinet’s socket. Select it and tap the cabinet.' };
    if (L.tier >= 5 && !S.seqDone)
      return { key: 'sigil', text: 'With the UV lamp on, the rug reveals the sigil order. Then tap the door.' };
    if (has('ironKey'))
      return { key: 'door', text: 'Select the iron key and tap the door. Freedom awaits.' };
    /* Reachable in states the ladder above does not match (e.g. tier 5
       after the safe is open, before the crank is used). It used to say
       "Search the room — something is still hidden", which is the blind
       tapping this redesign removes; point at the evidence instead. */
    return { key: 'searchMore',
             text: 'Read what you notice again (🔍) — the room has already told you where to look.' };
  }

  function useHint() {
    if (!inChamber()) { toast('Open a chamber first.'); return; }
    var h = nextHint();

    // Already paid for this step in this chamber -> free re-read.
    if (S.paidHints[h.key]) { toast('💡 ' + h.text); return; }

    /* THE FIRST RUNG IS FREE.
       It only restates a clue already printed on screen in plainer words —
       charging for it is charging the player to understand the rules, not
       to be rescued from them, and reads as "pay to play" in reviews.
       At tier 1 there is a second reason: the profile is exactly one clue,
       and that clue must isolate the answer, so the restatement always
       gives the answer away. Selling it would be selling the solution as
       the opening move.
       The narrowing and naming rungs below still cost, which is where a
       hint pack earns its money. */
    var free = (h.keyRung === 0);
    if (!free && !Save.spendHint()) { Shop.promptOutOfHints(); return; }

    S.paidHints[h.key] = true;
    if (!free) S.hintsUsed++;
    /* Advance the key-hunt ladder when a rung is SERVED, whether or not it
       cost anything — a free re-read is caught by paidHints above and
       returns before reaching here, so this cannot skip a rung. Once the
       last rung is reached the clamp in nextHint() re-serves it, and
       paidHints makes that free: there is nothing further to sell. */
    if (typeof h.keyRung === 'number') {
      S.keyRung = h.keyRung + 1;
      renderObs();                 // the rung the player just bought, kept
    }
    refreshHintUI();
    toast('💡 ' + h.text);
  }

  /* ---------------- level ---------------- */
  function closeAllOverlays() {
    ['padOv','symOv','winOv','shopOv','hintOv','menu','rankOv'].forEach(function (id) {
      $(id).classList.remove('show');
    });
  }

  function startLevel(i) {
    cur = i;
    L = genLevel(i);
    t = 0;
    entry = ''; symEntry = [];
    S = { found: {}, items: {}, sel: null, drawer: false, safe: false, cab: false,
          uvOn: false, seqDone: L.tier < 5, escaped: false,
          paidHints: {}, hintsUsed: 0, factsFound: {}, keyRung: 0,
          /* Every PRODUCTIVE action. Re-tapping a searched spot, opening a
             lock you already opened, and selecting an item are all free:
             the score measures whether you READ the room, not whether you
             avoided touching it. Fumbling a code costs, because a guessed
             keypad is exactly what the deduction exists to replace. */
          moves: 0 };

    /* className is still reset (not left stale) because body.uv is toggled
       on it during UV mode; the palette now comes from inline custom
       properties instead of a t0..t4 class. */
    document.body.className = '';
    /* Rebuild the room's ARTWORK before applyRoomStyle, because that function
       addresses elements by id and they only exist once the setting has been
       painted. This is the line that stops all twenty chambers being one room
       recoloured: each setting draws its own furniture, not a tinted study. */
    paintRoom(i);
    applyRoomStyle(i);
    $('roomTitle').textContent = L.setting.name + ' · CHAMBER ' + ROMAN[i];
    /* Open on entry. The clues are the room's opening move — hiding them
       behind a button would leave the player exactly where they were,
       staring at seven objects with no reason to prefer any of them. */
    renderObs();
    $('obs').classList.add('show');

    /* reset scene visuals */
    SEARCH.forEach(function (id) { $(id).classList.remove('searched'); });
    $('rugFold').style.display = 'none';
    $('chestLid').style.display = '';
    $('chestOpenG').style.display = 'none';
    $('drawerOpenG').style.display = 'none';
    $('drawerItem').textContent = '';
    $('safeOpenG').style.display = 'none';
    $('safeItem').textContent = '';
    $('cabOpenG').style.display = 'none';
    $('sigilBadge').style.display = L.tier >= 5 ? '' : 'none';
    ['uvA','uvB','uvC'].forEach(function (u) { $(u).textContent = ''; });
    /* The wall glows the RULE, never the answer. Printing L.code here was
       the tier 4-5 half of "the game is just search": the code was simply
       written on the wall in invisible ink. */
    if (L.tier >= 4) {
      $(UVEL[L.clueSpot]).textContent = L.puzzle
        ? L.puzzle.shortRule
        : L.code.split('').join(' ');
    }
    $('uvRug').textContent = L.tier >= 5 ? L.seq.join(' ') : '';

    renderInv();
    refreshHintUI();
    startTimer();
    $('timer').textContent = '0:00';
    closeAllOverlays();

    /* The setting's own opening line. "The slab grinds shut. Four thousand
       years of patience, and no hurry now." establishes a tomb in one
       sentence; the generic line established nothing. */
    toast((L.setting.intro && L.setting.intro[i % L.setting.intro.length]) ||
          ['The door slams shut behind you.',
           'The lock clicks by itself. Wonderful.',
           'Chamber ' + ROMAN[i] + '. The air smells of secrets.'][i % 3]);
  }

  function startTimer() {
    clearInterval(timerInt);
    timerInt = setInterval(function () { t++; $('timer').textContent = fmt(t); }, 1000);
  }

  /* ---------------- inventory ---------------- */
  function give(n) { S.items[n] = true; renderInv(); buzz(30); }
  function take(n) { delete S.items[n]; if (S.sel === n) S.sel = null; renderInv(); }
  function renderInv() {
    var keys = S ? Object.keys(S.items) : [];
    for (var i = 0; i < 4; i++) {
      var sl = $('s' + i), n = keys[i];
      sl.className = 'slot';
      sl.dataset.item = '';
      sl.innerHTML = '';
      if (n) {
        sl.classList.add('item');
        sl.dataset.item = n;
        sl.innerHTML = ICON[n] + '<span class="lbl">' + LBL[n] + '</span>';
        if (S.sel === n || (n === 'uv' && S.uvOn)) sl.classList.add('sel');
      }
    }
  }

  /* ---------------- searchable spots ---------------- */
  function searchSpot(id) {
    if (!inChamber()) return;
    var hid = L.hides[id];
    if (!S.found[id]) {
      S.found[id] = true;
      S.moves++;                    // a first look anywhere costs one
      $(id).classList.add('searched');
      if (id === 'rug') $('rugFold').style.display = '';
      if (id === 'chest') { $('chestLid').style.display = 'none'; $('chestOpenG').style.display = ''; }
      if (hid) {
        give(hid);
        /* Themed name, not "rug": in the cell block this reads "Behind the
           straw mattress". A hardcoded name here would undo the settings. */
        toast('Behind the ' + spotName(id) + ' — a ' + LBL[hid] + '!');
        return;
      }
      /* A numbered fact reads as a find, not a taunt. It is worthless on
         its own — the note's rule is what turns it into a code — which is
         the whole point of the redesign. */
      var f = L.factAt && L.factAt[id];
      if (f) {
        S.factsFound[id] = true;
        toast(factLine(f));
        return;
      }
      toast(L.taunts[id]);
      return;
    }
    /* already searched: contextual re-read */
    /* Under UV the wall no longer spells out the answer — it spells out
       the RULE. Reading it is now the start of the puzzle, not the end. */
    if (id === L.clueSpot && L.tier >= 4) {
      toast(S.uvOn
        ? '✨ Ghostly ink blazes: ' +
          (L.puzzle
            ? L.puzzle.ruleText +
              (L.puzzle.startSpotName && !S.factsFound[L.puzzle.startSpot]
                ? '  Begin at the ' + L.puzzle.startSpotName + '.' : '')
            : '"' + L.code + '"')
        : 'The surface shimmers oddly in the low light…');
      return;
    }
    var rf = L.factAt && L.factAt[id];
    if (rf) { toast(factLine(rf, true)); return; }
    if (id === 'rug' && L.tier >= 5) {
      toast(S.uvOn ? '✨ Sigils woven in glowing thread: ' + L.seq.join('  ')
                   : 'The weave hides a pattern you can’t quite see…');
      return;
    }
    if (id === L.clueSpot && L.tier === 3) {
      toast('Scratched into it: "the drawer knows the number."');
      return;
    }
    toast('Already searched.');
  }

  /* ---------------- safe keypad ---------------- */
  function renderCode() {
    $('code').textContent = entry.padEnd(L.code.length, '—').split('').join(' ');
  }
  function openPad() {
    entry = '';
    renderCode();
    $('padSub').textContent = L.code.length + ' rolling dials guard the lock.';
    $('padOv').classList.add('show');
  }

  /* ---------------- sigil lock ---------------- */
  function renderSeq() { $('seqShow').textContent = symEntry.join(' ') || '· · · ·'; }
  function openSym() { symEntry = []; renderSeq(); $('symOv').classList.add('show'); }

  /* ---------------- win ---------------- */
  function escape() {
    S.escaped = true;
    clearInterval(timerInt);

    var firstClear = Save.markDone(cur);
    var earned = 0;
    if (firstClear) {
      earned = Cfg.hints.perChamberFirstClear;
      Save.addHints(earned);
    }
    if (t >= Cfg.ads.minChamberSecondsForAd) {
      Save.data.chambersSinceAd++;
      Save.save();
    }
    refreshHintUI();

    var par   = parFor(L);
    var stars = starsFor(S.moves, par);
    var run   = { stars: stars, moves: S.moves, seconds: t };
    var res   = Save.recordRun(cur, run);

    /* The card should sound like it is pleased with you. A perfect run in
       particular has to LAND — it is the whole reward for reasoning instead
       of tapping, and a flat "Chamber escaped" made it feel like nothing
       happened. */
    var perfect = stars === 5;
    $('winTitle').textContent = cur === 19 ? '🏆 ALL 20 CHAMBERS ESCAPED'
                  : perfect ? '⭐ FLAWLESS — CHAMBER ' + ROMAN[cur]
                            : 'CHAMBER ' + ROMAN[cur] + ' ESCAPED';

    var praise = perfect
      ? 'Not one wasted move. You read the room exactly.'
      : stars === 4 ? 'Sharp work — one move from perfect.'
      : stars === 3 ? 'Solid. The room gave up more slowly than it had to.'
      : 'Out is out. The clues were there — try reading before touching.';

    var line = '<div class="starline">' + starString(stars) + '</div>' +
      '<p class="praise">' + praise + '</p>' +
      'Moves: <b>' + S.moves + '</b> <span class="par">(best possible ' + par + ')</span>' +
      ' · Time: <b>' + fmt(t) + '</b>' +
      (S.hintsUsed ? ' · Hints: <b>' + S.hintsUsed + '</b>' : '');

    if (res.improved && res.previous) {
      line += '<p class="rec">🎉 New personal best — beat ' +
              starString(res.previous.stars) + ' ' + fmt(res.previous.seconds) + '</p>';
    } else if (res.improved) {
      line += '<p class="rec">🎉 Record set.</p>';
    } else if (res.record) {
      line += '<p class="rec dim">Your best here: ' + starString(res.record.stars) +
              ' ' + fmt(res.record.seconds) + '</p>';
    }
    if (earned) line += '<p class="rec">🕯️ <b>+' + earned + ' hint</b> for a first escape.</p>';

    $('winText').innerHTML = line;
    $('nextBtn').style.display = cur === 19 ? 'none' : '';
    $('winOv').classList.add('show');
    buzz(perfect ? [30, 40, 30, 40, 120] : [40, 60, 120]);
  }

  /* The interstitial goes HERE — after the player dismisses the win card,
     on the seam between chambers. Never during a chamber, and never on
     top of the win card itself, which would bury the reward. */
  function leaveWin(then) {
    $('winOv').classList.remove('show');
    if (!Ads.shouldShowInterstitial(Save.data.chambersSinceAd)) { then(); return; }
    Save.data.chambersSinceAd = 0;
    Save.save();
    Ads.showInterstitial().then(then, then);
  }

  /* ---------------- menu ---------------- */
  function showMenu() {
    if (inChamber()) clearInterval(timerInt);
    $('resumeBtn').style.display = inChamber() ? '' : 'none';
    refreshHintUI();
    /* Build + store state, always visible. `store=ready` means the SDK
       reached RevenueCat; `unavailable` means it never did, and the two
       produce completely different purchase bugs. */
    $('buildLine').textContent =
      'build ' + Cfg.build + ' · store ' + Billing.state +
      (Billing.lastError ? ' · ' + Billing.lastError : '');
    var g = $('grid');
    g.innerHTML = '';
    for (var i = 0; i < 20; i++) {
      (function (i) {
        var b = document.createElement('button');
        b.className = 'lv';
        b.textContent = i + 1;
        if (Save.isDone(i)) b.classList.add('done');
        /* The grid is where a player decides what to replay, so it has to
           show what is still on the table — a chamber cleared at 3 stars is
           an invitation, not a finished job. */
        var rec = Save.bestFor(i);
        if (rec && i < Save.data.unlocked) {
          var st = document.createElement('span');
          st.className = 'st';
          st.textContent = starString(rec.stars);
          b.appendChild(st);
        }
        if (i >= Save.data.unlocked) { b.classList.add('lock'); b.textContent = '🔒'; }
        b.addEventListener('click', function () { startLevel(i); });
        g.appendChild(b);
      })(i);
    }
    $('menu').classList.add('show');
  }

  /* ---------------- wiring ---------------- */
  function wire() {
    toastEl = $('toast');

    for (var i = 0; i < 4; i++) {
      $('s' + i).addEventListener('click', function () {
        if (!inChamber()) return;
        var n = this.dataset.item;
        if (!n) return;
        if (n === 'uv') {
          S.uvOn = !S.uvOn;
          document.body.classList.toggle('uv', S.uvOn);
          toast(S.uvOn ? 'Violet light floods the chamber. Something glows…'
                       : 'You click the lamp off.');
          renderInv(); buzz(20);
          return;
        }
        if (n === 'note') {
          /* The note gives the rule AND the head of the trail. Without the
             starting point the player has a rule and no idea where the
             numbers are, which is the "guess what the designer meant"
             failure real escape rooms are warned against. */
          toast(L.puzzle
            ? L.puzzle.ruleText +
              (L.puzzle.startSpotName && !S.factsFound[L.puzzle.startSpot]
                ? '  Begin at the ' + L.puzzle.startSpotName + '.' : '')
            : 'The note reads: "' + L.code + '". Someone circled it twice.');
          return;
        }
        S.sel = (S.sel === n) ? null : n;
        renderInv();
        if (S.sel) toast(LBL[n] + ' selected. Tap where to use it.');
      });
    }

    /* Scene taps are bound by bindRoomTaps(), called from paintRoom() on
       every level start, because the room's nodes are replaced each time. */

    /* keypad */
    ['1','2','3','4','5','6','7','8','9','⌫','0','✕'].forEach(function (k) {
      var b = document.createElement('button');
      b.textContent = k;
      b.addEventListener('click', function () {
        if (k === '✕') { $('padOv').classList.remove('show'); return; }
        if (k === '⌫') { entry = entry.slice(0, -1); renderCode(); return; }
        /* Input is locked once the code is full, so a fast tap during the
           200ms check window cannot append a 5th digit and turn a CORRECT
           entry into a failure. Same class of bug as the sigil pad. */
        if (entry.length >= L.code.length) return;
        entry += k; renderCode(); buzz(10);
        if (entry.length === L.code.length) { S.moves++; setTimeout(function () {
          if (entry === L.code) {
            $('padOv').classList.remove('show');
            S.safe = true;
            $('safeOpenG').style.display = '';
            $('safeItem').textContent = ICON[L.safeHas];
            give(L.safeHas); buzz([30, 50, 30]);
            toast('The dials align — inside, a ' + LBL[L.safeHas] + '!');
          } else {
            $('padCard').classList.add('shake');
            setTimeout(function () { $('padCard').classList.remove('shake'); }, 450);
            buzz(80); entry = ''; renderCode();
          }
        }, 200); }
      });
      $('pad').appendChild(b);
    });

    /* sigil pad */
    SYMS.forEach(function (s) {
      var b = document.createElement('button');
      b.textContent = s;
      b.addEventListener('click', function () {
        if (symEntry.length >= 4) return;   // locked pending the check
        symEntry.push(s); renderSeq(); buzz(10);
        if (symEntry.length === 4) setTimeout(function () {
          if (symEntry.join('') === L.seq.join('')) {
            S.seqDone = true;
            $('symOv').classList.remove('show');
            $('sigilBadge').style.display = 'none';
            toast('The sigils flare and fade. One lock down.');
            buzz([30, 50, 30]);
          } else {
            $('symCard').classList.add('shake');
            setTimeout(function () { $('symCard').classList.remove('shake'); }, 450);
            buzz(80); symEntry = []; renderSeq();
          }
        }, 200);
      });
      $('sympad').appendChild(b);
    });
    var x = document.createElement('button');
    x.textContent = '✕';
    x.style.gridColumn = 'span 4';
    x.addEventListener('click', function () { $('symOv').classList.remove('show'); });
    $('sympad').appendChild(x);

    /* win card */
    $('nextBtn').addEventListener('click', function () {
      leaveWin(function () { startLevel(cur + 1); });
    });
    $('backBtn').addEventListener('click', function () {
      leaveWin(showMenu);
    });

    /* topbar + menu */
    /* No argument -> the index. The click event would otherwise be passed
       as `level` and read as chamber NaN. */
    $('rankBtn').addEventListener('click', function () { showRankings(null); });
    $('rankBack').addEventListener('click', function () { showRankings(null); });
    $('rankClose').addEventListener('click', function () {
      $('rankOv').classList.remove('show');
    });
    $('obsToggle').addEventListener('click', function () {
      $('obs').classList.toggle('show');
    });
    $('hintBtn').addEventListener('click', useHint);
    $('menuBtn').addEventListener('click', showMenu);
    $('shopBtn').addEventListener('click', function () { Shop.openShop(); });
    $('resumeBtn').addEventListener('click', function () {
      $('menu').classList.remove('show');
      if (inChamber()) startTimer();
    });

    wireBackButton();
  }

  /* The Android hardware back button did nothing at all before, so it fell
     through to Capacitor's default and CLOSED THE APP — including from
     inside an open safe keypad. On a puzzle game that reads as a crash. */
  function wireBackButton() {
    var App = global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.App;
    if (!App || !App.addListener) return;
    App.addListener('backButton', function () {
      var overlays = ['hintOv','shopOv','padOv','symOv'];
      for (var i = 0; i < overlays.length; i++) {
        if ($(overlays[i]).classList.contains('show')) {
          $(overlays[i]).classList.remove('show');
          return;
        }
      }
      if ($('winOv').classList.contains('show')) { leaveWin(showMenu); return; }
      if (!$('menu').classList.contains('show')) { showMenu(); return; }
      try { App.exitApp(); } catch (e) {}
    });
  }

  /* ---------------- boot ----------------
     Billing and ads start with Promise.all and never wait on each other.
     Isolation alone is not enough: on an offline device getOfferings()
     can hang, and a serial chain would leave ads dead behind a merely
     SLOW billing call even with every error caught. They have to be
     decoupled in time, not just in error handling. */
  function boot() {
    wire();

    return Save.load().then(function () {
      refreshHintUI();
      showMenu();

      var bootStep = function (label, fn) {
        return Promise.resolve().then(fn).catch(function (e) {
          console.warn('[boot] ' + label + ' failed:', e);
        });
      };

      return Promise.all([
        bootStep('billing', function () {
          return Billing.init(function (productId, txId) {
            // Pay out a consumable hint pack exactly once per transaction.
            if (Save.hasGranted(txId)) return false;
            var n = (Cfg.products[productId] && Cfg.products[productId].hints) || 0;
            if (!n) return false;
            Save.noteGranted(txId);
            Save.addHints(n);
            refreshHintUI();
            return true;
          }).then(function () {
            /* Only mirror when the store actually answered. If billing is
               unavailable — no network, no key, plugin missing — then
               `entitlements` is an empty guess, and writing it over the
               save file would silently strip a paid unlock from a player
               who is merely offline. Trust the last known-good mirror
               instead; a real refund still revokes on the next good read. */
            Save.setEntitlements(function (id) { return Billing.owns(id); },
                                 Billing.hasAuthoritativeInfo);
            Ads.setRemoveAds(Save.data.removeAds);
            refreshHintUI();
          });
        }),
        bootStep('ads', function () {
          return Ads.init().then(function () {
            Ads.setRemoveAds(Save.data.removeAds);
          });
        })
      ]);
    }).then(function () {
      Shop.init({
        toast: toast,
        onChange: function () { refreshHintUI(); showMenuIfOpen(); }
      });
      ['buyHints','buyRemoveAds'].forEach(function (id) {
        $(id).addEventListener('click', function () {
          Shop.buy(this.dataset.product);
        });
      });
      console.info('[boot] ready. billing=' + Billing.state + ' ads=' + Ads.available);
    });
  }

  function showMenuIfOpen() {
    if ($('menu').classList.contains('show')) showMenu();
  }

  /* ---------------- test seam ----------------
     The e2e suite drives the real DOM through real click events; this
     only exposes the state it needs to ASSERT on, so a passing test can
     never be an artefact of a test-only code path. */
  global.ECGame = {
    boot: boot,
    startLevel: startLevel,
    showMenu: showMenu,
    genLevel: genLevel,
    state: function () {
      /* Puzzle state is exposed at exactly the fidelity the PLAYER has:
         the rule only once it has been read, and only the facts already
         dug out of the room. The answer is never exposed. The e2e solver
         uses these fields, so "all 20 completable" keeps meaning "a
         player could do this", not "the generator says so".
         (L is still handed out whole for the older assertions — anything
         reading L.code would be cheating and must not be added.) */
      var pz = null;
      if (L && L.puzzle && S) {
        var revealed = (L.tier === 3) ? !!S.items.note : !!S.uvOn;
        pz = {
          family: L.puzzle.family,
          rule: revealed ? L.puzzle.ruleText : null,
          /* Count only the NUMBERS the player must go and find. The `logic`
             family carries a single value:null placeholder — its rule is
             self-contained — and counting that as a fact sent the solver
             (and any player following the trail) to search a spot that
             holds nothing, costing a move for no information. */
          total: (L.puzzle.facts || []).filter(function (f) {
            return typeof f.value === 'number';
          }).length,
          /* THE TRAIL, at exactly the fidelity the player has it. The rule
             text says "Begin at the X", and each number found shows an
             arrow to the next — so both are already on screen, and a solver
             that follows them is playing the way the game intends rather
             than brute-forcing all seven spots. This is also what makes par
             reachable: par assumes the trail was followed. */
          startSpot: revealed ? L.puzzle.startSpot : null,
          nextSpot: (function () {
            var last = null;
            (L.puzzle.facts || []).forEach(function (f) {
              if (f.spot && S.factsFound[f.spot] && f.pointsTo) last = f.pointsTo;
            });
            return last;
          })(),
          facts: Object.keys(S.factsFound || {}).map(function (spot) {
            return { order: L.factAt[spot].order, value: L.factAt[spot].value };
          })
        };
      }
      /* PUBLIC key-hunt view: exactly what a player standing in the doorway
         can see, and nothing else. `answer` and `hints` are withheld — the
         last hint rung names the spot, so exposing either would let the e2e
         solver read the answer instead of deducing it, and "all 20
         completable" would become a restatement of the generator. */
      var huntPub = null;
      if (L && L.hunt) {
        huntPub = { evidence: L.hunt.evidence, tier: L.hunt.tier,
                    clueCount: L.hunt.clueCount, degraded: L.hunt.degraded,
                    relaxed: L.hunt.relaxed };
      }
      return { cur: cur, tier: L && L.tier, t: t,
               puzzle: pz, codeLen: L ? L.code.length : 0,
               hunt: huntPub,
               setting: L ? L.setting.id : null,
               /* THE ANSWER LIVES HERE, AND ONLY HERE.
                  `L` used to be returned under its own name, which handed
                  out hunt.answer, hunt.hints, brassSpot and the safe code
                  to anything that asked — making the sanitised `hunt` above
                  decorative, and leaving "solvable by reasoning" resting on
                  nobody happening to read the wrong field.

                  The integrity assertions genuinely need these (they check
                  the answer is NOT leaked into clue text), so the data
                  cannot simply go away. Renaming it is the guard: the
                  auto-solver is forbidden to touch __answers, and a grep
                  for that name shows every place the rule could be broken. */
               __answers: L, S: S,
               hints: Save.data.hints,
               unlimited: Save.data.unlimitedHints,
               removeAds: Save.data.removeAds };
    },
    /* Exposed so the suite can prove par is REACHABLE rather than trust the
       formula: the auto-solver plays optimally, so it must score five. */
    parFor: parFor, starsFor: starsFor, rankRows: rankRows,
    showRankings: showRankings,
    SEARCH: SEARCH, SYMS: SYMS
  };

  if (!global.__EC_NO_AUTOBOOT) {
    document.addEventListener('DOMContentLoaded', function () { boot(); });
  }
})(window);
