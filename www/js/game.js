/* =====================================================================
   Escape Chambers — the game
   ---------------------------------------------------------------------
   Hand-made escape rooms, one per setting in themes.js (thirty as of
   1.7.0 — the count is read from the data, never written down), and seven
   difficulty tiers. The puzzle chain per tier:

     1  iron key hidden in one of seven searchable spots
     2  brass key hidden -> desk drawer -> iron key
     3  brass key -> drawer -> note (safe code) -> safe -> iron key
     4  brass key -> drawer -> UV lamp -> code glows on a wall item ->
        safe -> iron key
     5  as 4, but the safe holds a crank -> cabinet -> iron key, and the
        door also demands a four-sigil sequence read off the rug under UV
     6  as 5, with two structural key-hunt clues, five sigils and one of
        the harder safe rules (mirror / chain / logic)
     7  as 6, with up to four clues, a five-digit safe, and sigils the
        door reads last to first (the ink is marked with a ↶)

   Every chamber is provably completable — test/e2e.js solves every one
   end to end with an auto-solver rather than trusting the generator.

   Plus the DAILY CHAMBER: one more room per calendar day, built by the
   same generator from a seed derived from the date (see genDaily). The
   suite solves a run of consecutive dates the same way.
   ===================================================================== */
(function (global) {
  'use strict';

  var Cfg = global.ECConfig;
  var Save = global.ECSave;
  var Billing = global.ECBilling;
  var Ads = global.ECAds;
  var Shop = global.ECShop;
  var Themes = global.ECThemes;
  var Notify = global.ECNotify;

  var $ = function (id) { return document.getElementById(id); };

  /* Analytics is a no-op off device and can never throw (analytics.js),
     so calls are sprinkled inline without guards. */
  function track(name, params) {
    if (global.ECAnalytics) global.ECAnalytics.log(name, params);
  }

  /* ---------------- little helpers ---------------- */
  /* ---------------- messages (1.7.1) ----------------
     A 1-star review on 1.5.2: "everything flashes so quickly, u don't have
     time to read even half of it … u have to click on things over and over
     just to read clues". Every message used to vanish after 2.8 s whatever
     its length — a 170-character rule included.

     Now there are two kinds, and NEITHER disappears quickly:
       toast(m)  passing remarks ("Already searched", a purchase). Stays for
                 a reading time scaled to its length, never under 6 s; a tap
                 PINS it (it then stays until tapped again).
       clue(m)   anything the puzzle depends on — a number found, a rule, an
                 item discovered, an object's properties. Stays until the
                 player taps it away (or the next message replaces it), and
                 is also written into the notebook, so nothing has to be
                 re-tapped to be read again.
     The box sits below the room, in the letterbox space, so it never hides
     the furniture (layoutHud). */
  var toastEl, toastT, toastSticky = false;
  function readMs(m) {
    return Math.min(20000, Math.max(6000, 2500 + 60 * String(m).length));
  }
  function showMsg(m, sticky) {
    toastEl.textContent = m;
    toastSticky = !!sticky;
    toastEl.classList.toggle('sticky', toastSticky);
    toastEl.setAttribute('data-foot', toastSticky ? 'tap to close' : 'tap to keep');
    toastEl.classList.add('show');
    clearTimeout(toastT);
    if (!toastSticky) toastT = setTimeout(hideMsg, readMs(m));
    layoutHud();
  }
  function toast(m) { showMsg(m, false); }
  function clue(m) { showMsg(m, true); }
  function hideMsg() {
    clearTimeout(toastT);
    toastSticky = false;
    if (toastEl) toastEl.classList.remove('show', 'sticky');
  }
  /* First tap keeps a passing message; a tap on a kept one closes it. */
  function tapMsg(e) {
    if (e) e.stopPropagation();
    if (toastSticky) { hideMsg(); return; }
    clearTimeout(toastT);
    toastSticky = true;
    toastEl.classList.add('sticky');
    toastEl.setAttribute('data-foot', 'kept — tap to close');
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

  /* One name per chamber, not five cycled. The old build set
     `body.className = 't' + (i % 5)`, so chambers I, VI, XI and XVI were
     pixel-identical and the game read as one room repainted — which is
     exactly what it was. Each chamber now gets its own name, its own
     seeded palette (paletteFor) and its own seeded layout (layoutFor). */
  /* HOW MANY CHAMBERS THERE ARE is a fact about the DATA, not about this
     file: one chamber per setting in themes.js. Nothing below may assume a
     number — the grid, the final-chamber card, the star total, the unlock
     clamp and the rankings all read TOTAL — so adding a setting to
     themes.js (plus its sign and lore line in puzzle.js) adds a chamber
     and needs no other edit. The game's NAME carries no count for the
     same reason. */
  var TOTAL = Themes.list.length;
  var LAST = TOTAL - 1;

  var THEMES = [
    'THE STUDY',      'THE CELLAR',      'THE GREENHOUSE',  'THE OBSERVATORY',
    'THE ATTIC',      'THE APOTHECARY',  'THE MAP ROOM',    'THE CONSERVATORY',
    'THE ARCHIVE',    'THE CLOCKWORKS',  'THE SCULLERY',    'THE AVIARY',
    'THE DARKROOM',   'THE ORANGERY',    'THE MUNIMENT',    'THE BOILER ROOM',
    'THE LONG GALLERY','THE ICEHOUSE',   'THE BELFRY',      'THE VAULT'
  ];
  function roman(n) {
    var map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
               [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    var out = '';
    for (var k = 0; k < map.length; k++) {
      while (n >= map[k][0]) { out += map[k][1]; n -= map[k][0]; }
    }
    return out;
  }
  var ROMAN = [];
  for (var rk = 0; rk < TOTAL; rk++) ROMAN.push(roman(rk + 1));
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
    var base = (i * 360 / TOTAL + R() * 24 - 12 + 200) % 360;
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
        noteFind('The ' + drawerName() + ' held a ' + LBL[L.drawerHas] + '.');
        clue('Click! Inside the ' + drawerName() + ': a ' + LBL[L.drawerHas] + '.' +
             (L.drawerHas === 'uv' ? ' Tap it in your bag to switch it on.'
              : L.drawerHas === 'note' ? ' Tap it in your bag to read it.' : ''));
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
        noteFind('The crank opened the ' + lockName('cab') + ': the iron key.');
        clue('You crank the mechanism — the ' + lockName('cab') + ' groans open. The iron key!');
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
    /* #roomArt holds the drawing (UV mode dims it); #uvLayer is painted
       LAST and undimmed, so the wall rule moved into it by placeUvRule()
       can never be hidden behind a piece of furniture. */
    sc.innerHTML = Themes.defs() + '<g id="roomArt">' + Themes.roomSVG(L.setting) + '</g>' +
                   '<g id="uvLayer" pointer-events="none"></g>';
    bindRoomTaps();
  }

  function drawerName() { return spotName('drawer'); }
  function lockName(id) { return spotName(id); }

  /* =================================================================
     UV WALL RULE PLACEMENT (1.7.1)
     -----------------------------------------------------------------
     The rule used to be written at a fixed offset on the clue object, at
     a fixed size, on one line. Measured across the thirty rooms that put
     "(1st x 2nd) + (3rd x 4th)" behind the clock in chamber XXI and ran
     the six-sentence logic rules off both edges of the screen.

     Now the furniture is MEASURED (each object's drawn box, mapped back
     into viewBox units, so the per-chamber permutation, mirror, tilt and
     scale are all accounted for), the free wall rectangles between the
     boxes are enumerated, and the rule is wrapped and sized into the
     free rectangle nearest the glowing object at the largest size that
     fits. The text then lives in #uvLayer, on top of everything. The clue
     object itself does not block — ink on the map may sit on the map —
     but nothing else may be under it. test/uv-audit.js checks every
     numbered chamber and 300 dailies at three phone sizes.
     ================================================================= */
  var FURNITURE = ['rug', 'plant', 'clock', 'pA', 'pB', 'shelf', 'chest',
                   'door', 'drawer', 'safe', 'cab', 'bench', 'candleG'];
  /* Viewbox margins: the scene is scaled up to 3.5% and tilted up to
     1.4 deg about its centre, which pushes up to ~20 units of the edges
     off a portrait screen. Nothing is written in that strip. */
  var WALL = { x1: 30, x2: 770, y1: 16, y2: 390 };
  var UV_FONTS = [30, 28, 26, 24, 23, 22, 21, 20, 19, 18];
  var UV_MIN_FONT = 18;

  function toUserRect(r, inv) {
    var xs = [], ys = [];
    [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]].forEach(function (c) {
      var p = new DOMPoint(c[0], c[1]).matrixTransform(inv);
      xs.push(p.x); ys.push(p.y);
    });
    return { x1: Math.min.apply(null, xs), x2: Math.max.apply(null, xs),
             y1: Math.min.apply(null, ys), y2: Math.max.apply(null, ys) };
  }

  /* Every piece of furniture's box in viewBox units. Ink and the light's
     glow halo are not furniture and are hidden while measuring. */
  function furnitureBoxes() {
    var sc = $('scene');
    var ctm = sc.getScreenCTM();
    if (!ctm) return null;
    var inv = ctm.inverse();
    var hide = Array.prototype.slice.call(sc.querySelectorAll('.uv-ink, #glowE'));
    var prev = hide.map(function (e) { var d = e.style.display; e.style.display = 'none'; return d; });
    var out = {};
    FURNITURE.forEach(function (id) {
      var el = $(id);
      if (!el) return;
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      out[id] = toUserRect(r, inv);
    });
    hide.forEach(function (e, k) { e.style.display = prev[k]; });
    return out;
  }

  /* Maximal empty rectangles inside `area` that miss every box. For each
     pair of horizontal edges the blocked x-ranges are merged and the gaps
     between them are the candidates; with a dozen boxes this is a few
     hundred rectangles, which is nothing. */
  function freeRects(area, blocks) {
    var ys = [area.y1, area.y2];
    blocks.forEach(function (b) {
      if (b.y1 > area.y1 && b.y1 < area.y2) ys.push(b.y1);
      if (b.y2 > area.y1 && b.y2 < area.y2) ys.push(b.y2);
    });
    ys = ys.sort(function (a, b) { return a - b; })
           .filter(function (v, k, a) { return k === 0 || v - a[k - 1] > 0.5; });
    var rects = [];
    for (var i = 0; i < ys.length; i++) {
      for (var j = i + 1; j < ys.length; j++) {
        var top = ys[i], bot = ys[j];
        if (bot - top < 22) continue;
        var cuts = blocks.filter(function (b) { return b.y1 < bot && b.y2 > top; })
                         .map(function (b) { return [Math.max(area.x1, b.x1), Math.min(area.x2, b.x2)]; })
                         .filter(function (c) { return c[1] > c[0]; })
                         .sort(function (a, b) { return a[0] - b[0]; });
        var x = area.x1;
        cuts.forEach(function (c) {
          if (c[0] - x >= 60) rects.push({ x1: x, x2: c[0], y1: top, y2: bot });
          x = Math.max(x, c[1]);
        });
        if (area.x2 - x >= 60) rects.push({ x1: x, x2: area.x2, y1: top, y2: bot });
      }
    }
    return rects;
  }

  /* Greedy wrap against widths measured once at the reference size (width
     scales linearly with font size because letter-spacing is a fixed
     fraction of it), then BALANCED: the width is squeezed while the line
     count holds, so a rule never ends on a one-word orphan line.
     A logic rule is wrapped at its " · " separators first, so one fact is
     never split across two lines; word wrap is only the fallback. */
  function wrapTokens(tok, tokW, gapW, joiner, maxW) {
    var lines = [], cur = [], curW = 0;
    for (var k = 0; k < tok.length; k++) {
      var w = tokW[k];
      if (w > maxW) return null;
      var add = cur.length ? gapW + w : w;
      if (cur.length && curW + add > maxW) {
        lines.push({ ix: cur, w: curW }); cur = [k]; curW = w;
      } else { cur.push(k); curW += add; }
    }
    if (cur.length) lines.push({ ix: cur, w: curW });
    return lines.map(function (l) {
      return { text: l.ix.map(function (n) { return tok[n]; }).join(joiner), w: l.w };
    });
  }
  function wrapBalanced(tok, tokW, gapW, joiner, maxW) {
    var lines = wrapTokens(tok, tokW, gapW, joiner, maxW);
    if (!lines || lines.length < 2) return lines;
    for (var w = maxW * 0.94, i = 0; i < 14; i++, w *= 0.94) {
      var t = wrapTokens(tok, tokW, gapW, joiner, w);
      if (!t || t.length !== lines.length) break;
      lines = t;
    }
    return lines;
  }

  var UV_REF = 20, UV_LS = 0.05, UV_LH = 1.12;

  function placeUvRule(el, str, clueId) {
    var layer = $('uvLayer');
    layer.appendChild(el);                  // out of the object, on top of everything
    el.removeAttribute('transform');
    el.textContent = '';
    if (!str) return null;

    var boxes = furnitureBoxes();
    var words = String(str).split(/\s+/).filter(Boolean);

    /* Measure each word once, at the reference size. */
    var meas = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    meas.setAttribute('font-family', 'Georgia');
    meas.setAttribute('font-size', UV_REF);
    meas.setAttribute('letter-spacing', (UV_REF * UV_LS).toFixed(2));
    meas.setAttribute('x', '-9999'); meas.setAttribute('y', '-9999');
    layer.appendChild(meas);
    var len = function (s) { meas.textContent = s; return meas.getComputedTextLength(); };
    var wordW = words.map(len);
    var spaceW = Math.max(1, len('x x') - len('xx'));
    var chunks = String(str).indexOf(' · ') >= 0 ? String(str).split(' · ') : null;
    var chunkW = chunks ? chunks.map(len) : null;
    var sepW = chunks ? Math.max(1, len('x · x') - len('xx')) : 0;
    var wrapAt = function (k, maxW) {
      var sc = function (a) { return a.map(function (w) { return w * k; }); };
      return (chunks && wrapBalanced(chunks, sc(chunkW), sepW * k, ' · ', maxW)) ||
             wrapBalanced(words, sc(wordW), spaceW * k, ' ', maxW);
    };
    layer.removeChild(meas);

    var clueBox = boxes && boxes[clueId];
    var cc = clueBox ? { x: (clueBox.x1 + clueBox.x2) / 2, y: (clueBox.y1 + clueBox.y2) / 2 }
                     : { x: 400, y: 150 };
    var PAD = 4;
    var blocks = [];
    if (boxes) Object.keys(boxes).forEach(function (id) {
      if (id === clueId) return;
      var b = boxes[id];
      blocks.push({ x1: b.x1 - 3, x2: b.x2 + 3, y1: b.y1 - 3, y2: b.y2 + 3 });
    });

    var best = null;
    var tryArea = function (area, penalty) {
      var rects = freeRects(area, blocks);
      UV_FONTS.forEach(function (f) {
        var k = f / UV_REF, lh = f * UV_LH;
        rects.forEach(function (r) {
          var availW = (r.x2 - r.x1) - 2 * PAD, availH = (r.y2 - r.y1) - 2 * PAD;
          if (availH < f) return;
          var lines = wrapAt(k, availW);
          if (!lines || !lines.length) return;
          var h = (lines.length - 1) * lh + f * 1.08;
          if (h > availH) return;
          var w = Math.max.apply(null, lines.map(function (l) { return l.w; }));
          var cx = Math.max(r.x1 + PAD + w / 2, Math.min(r.x2 - PAD - w / 2, cc.x));
          var top = Math.max(r.y1 + PAD, Math.min(r.y2 - PAD - h, cc.y - h / 2));
          var bx = { x1: cx - w / 2, x2: cx + w / 2, y1: top, y2: top + h };
          /* Distance from the block to the glowing object: 0 when they
             touch. Nearer wins unless it costs real legibility. */
          var dx = Math.max(0, (clueBox ? clueBox.x1 : cc.x) - bx.x2, bx.x1 - (clueBox ? clueBox.x2 : cc.x));
          var dy = Math.max(0, (clueBox ? clueBox.y1 : cc.y) - bx.y2, bx.y1 - (clueBox ? clueBox.y2 : cc.y));
          var score = f * 10 - Math.sqrt(dx * dx + dy * dy) * 0.05 - (lines.length - 1) * 4 - penalty;
          if (!best || score > best.score) {
            best = { score: score, f: f, lh: lh, lines: lines, cx: cx, top: top, box: bx };
          }
        });
      });
    };
    tryArea(WALL, 0);
    /* Only a cramped wall left for a long rule: also consider free space
       running down onto the floor, but it has to buy at least two sizes of
       legibility to win — ink belongs on the wall. */
    if (!best || best.f < 24) tryArea({ x1: WALL.x1, x2: WALL.x2, y1: WALL.y1, y2: 548 }, 20);

    if (!best) {
      best = { f: UV_MIN_FONT, lh: UV_MIN_FONT * UV_LH, cx: 400, top: WALL.y1,
               lines: wrapAt(UV_MIN_FONT / UV_REF, WALL.x2 - WALL.x1) || [{ text: str, w: 0 }] };
    }

    el.setAttribute('font-size', best.f);
    el.setAttribute('letter-spacing', (best.f * UV_LS).toFixed(2));
    el.setAttribute('x', best.cx.toFixed(1));
    el.setAttribute('y', (best.top + best.f * 0.86).toFixed(1));
    best.lines.forEach(function (l, n) {
      var ts = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      ts.setAttribute('x', best.cx.toFixed(1));
      ts.setAttribute('y', (best.top + best.f * 0.86 + n * best.lh).toFixed(1));
      /* A trailing space keeps textContent identical to the rule, so
         anything reading the DOM reads the words, not "lastfirst". */
      ts.textContent = l.text + (n < best.lines.length - 1 ? ' ' : '');
      el.appendChild(ts);
    });
    el.setAttribute('data-font', best.f);
    return best;
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
    /* A mirrored room mirrors its UV INK too: the rule on the wall came out
       as mirror-writing and — worse — the sigils on the floor read right to
       left, so a player copying them left to right entered them backwards
       (the solver never noticed; it reads the DOM text). .mirrored flips
       each line of ink back about its own centre (see index.html). */
    sc.classList.toggle('mirrored', !!lay.mirror);

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

  /* Four chambers to a tier for the first five tiers, five to tier 6, and
     everything from chamber 26 on is tier 7 — so a chamber added later
     lands at the top of the curve without this needing to change.

       1  the key is all there is          5  + the crank cabinet and sigils
       2  + the locked drawer              6  + two structural clues, a new
       3  + the safe and its rule             safe rule, five sigils
       4  + the UV lamp, four digits       7  + four clues, a five-digit
                                              safe, the sigils read backwards */
  function tierOf(i) {
    return i < 4 ? 1 : i < 8 ? 2 : i < 12 ? 3 : i < 16 ? 4 : i < 20 ? 5 : i < 25 ? 6 : 7;
  }

  /* Which safe rule a tier 6-7 chamber gets. Rotated by chamber rather
     than rolled, so the ten rooms after XX are guaranteed to walk through
     every rule instead of repeating one by chance. */
  var HARD_RULES = { 6: ['mirror', 'chain', 'logic'], 7: ['chain', 'weave', 'mirror'] };

  /* `i` is the SEED. For the twenty it is the chamber index, and the tier
     follows from it. The daily chamber passes a seed derived from the date
     plus the tier it wants (genDaily); every per-chamber table downstream
     — setting, sign, lore, layout — indexes with `seed % TOTAL`, so a large
     seed lands on a real setting with ITS OWN sign and lore, exactly as
     the twenty do. */
  function genLevel(i, forceTier) {
    var R = mulberry(i * 7919 + 31);
    var pick = function (a) { return a[Math.floor(R() * a.length)]; };
    var tier = forceTier || tierOf(i);

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

    var L = { seed: i, daily: null,
              tier: tier, setting: setting, spotDescs: spotDescs,
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
    var codeLen = tier >= 7 ? 5 : tier >= 4 ? 4 : 3;
    if (tier >= 3 && global.ECPuzzle) {
      var rules = HARD_RULES[tier];
      var family = rules ? rules[((i % rules.length) + rules.length) % rules.length] : null;
      /* brassSpot is passed in so the generator never places a fact on the
         key's spot. Filtering here instead would silently delete a needed
         number and leave the chamber unwinnable. */
      L.puzzle = global.ECPuzzle.generate(i, codeLen, family, L.brassSpot, L.spotDescs);
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
    if (tier >= 5) {
      L.drawerHas = 'uv'; L.safeHas = 'crank'; L.cabHas = 'ironKey';
      /* `seq` is what the floor covering SHOWS under UV. `seqWant` is what
         the door accepts — the same thing, except at tier 7, where the
         weave is marked ↶ and the door reads it last to first. */
      L.seq = shuffle(SYMS, R).slice(0, tier >= 6 ? 5 : 4);
      L.seqReversed = tier >= 7;
      L.seqWant = L.seqReversed ? L.seq.slice().reverse() : L.seq.slice();
    }
    return L;
  }

  /* ---------------- the daily chamber ----------------
     One room per calendar day, the same for every player on that day.

     seed = dayNumber * 7. Multiplying by 7 (coprime with the thirty
     settings; keep it coprime if the count ever changes) walks them in a
     scrambled order instead of I, II, III…, and keeps the seed far above
     the chamber indexes so a daily can never BE one of the numbered rooms.
     The tier comes from config.js -> daily.tiers by weekday-like cycle,
     capped at `tierCap`: the hardest tier the player has reached in the
     main game, so the daily never springs a mechanic on someone who has
     not met it yet.

     A date whose room would DEGRADE (the key hunt falling back to naming
     the spot — see generateKeyHunt) steps the seed by TOTAL, which keeps the
     setting and re-rolls everything else. The suite proves a run of
     consecutive dates solvable at every tier rather than trusting this. */
  var DAILY = -1;                      // `cur` while a daily chamber is open

  function dailySpec(key) {
    var n = Save.dayNumber(key);
    var tiers = (Cfg.daily && Cfg.daily.tiers) || [3];
    return { seed: n * 7,
             tier: tiers[((n % tiers.length) + tiers.length) % tiers.length] };
  }

  function genDaily(key, tierCap) {
    var spec = dailySpec(key);
    var tier = Math.max(1, Math.min(spec.tier, tierCap || 5));
    var lv = null;
    for (var k = 0; k < 8; k++) {
      lv = genLevel(spec.seed + TOTAL * k, tier);
      if (!lv.hunt.degraded) break;
    }
    lv.daily = key;
    return lv;
  }

  /* The hardest tier the player has unlocked in the numbered chambers.
     (The daily itself stops at tier 5 — config.js daily.tiers — so it stays
     a ten-minute room however far the player has got.) */
  function reachedTier() {
    return tierOf(Math.max(0, Math.min(LAST, Save.data.unlocked - 1)));
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
    html += '<div class="obsFoot">📓 Your notebook keeps every clue, and what each object is made of.</div>';
    box.innerHTML = html;
  }

  /* The object's name IN THIS SETTING. SPOTNAME survives only as the
     fallback for a room built before themes existed. */
  function spotName(id) {
    var o = L && L.setting && L.setting.byId[id];
    return (o && o.name) || SPOTNAME[id] || id;
  }

  /* ---------------- the notebook (1.7.1) ----------------
     "there's no list of clues u've uncovered to refer to." Now there is:
     📓 in the bag bar opens a page listing everything this run has turned
     up — the observations, every object's properties in the clues' own
     words, each number found (in order, with where it was), the safe rule
     once read or seen under UV, the sigils once seen, what was found
     where, and the hints bought. Reading it is free: no move, no star, no
     hint. It belongs to the run, so a new chamber starts a clean page. */
  function noteFind(text) {
    if (S) S.finds.push(text);
  }
  /* The rule becomes readable the moment the player can SEE it: the note
     is tapped (tier 3) or the lamp lights the wall (tier 4+). */
  function seeRule(source) {
    if (!S || !L.puzzle || S.ruleSeen) return;
    S.ruleSeen = source;
  }
  function seeSigils() {
    if (S && L.tier >= 5) S.sigilsSeen = true;
  }

  /* How many things the page holds — the badge counts the ones the player
     has not opened the notebook to see yet. */
  function noteCount() {
    if (!S) return 0;
    return S.finds.length + Object.keys(S.factsFound).length + (S.ruleSeen ? 1 : 0) +
           (S.sigilsSeen ? 1 : 0) + S.hintLog.length + Object.keys(S.found).length;
  }
  function refreshNoteBtn() {
    var b = $('noteBtn');
    if (!b) return;
    var fresh = S ? noteCount() - S.noteSeen : 0;
    b.classList.toggle('fresh', fresh > 0);
    $('noteBadge').textContent = fresh > 0 ? String(fresh) : '';
    if ($('noteOv').classList.contains('show')) renderNotebook();
  }

  function openNotebook() {
    if (!inChamber()) return;
    hideMsg();                      // it is in the notebook; it must not sit over it
    renderNotebook();
    $('noteOv').classList.add('show');
    $('noteBody').scrollTop = 0;
  }

  function renderNotebook() {
    if (!L || !S) return;
    var h = '';
    var sec = function (title, body) {
      if (body) h += '<h3>' + title + '</h3>' + body;
    };
    var li = function (items) {
      return items.length ? '<ul>' + items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' : '';
    };

    /* 1. The observations — the evidence for where the key is. */
    if (L.hunt && L.hunt.evidence.clues.length) {
      sec('What you noticed', li(L.hunt.evidence.clues.map(function (c) { return esc(c.text); })));
    }

    /* 2. The rule, word for word, once it has been read or seen. */
    if (S.ruleSeen && L.puzzle) {
      var P = L.puzzle, items = [];
      if (S.ruleSeen === 'uv' || L.tier >= 4) {
        items.push('<b>Glowing on the wall, by the ' + esc(spotName(L.clueSpot)) + ':</b> “' +
                   esc(P.shortRule) + '”');
        items.push('<b>In full:</b> ' + esc(P.ruleText));
      } else {
        items.push('<b>The note:</b> ' + esc(P.ruleText));
      }
      if (P.startSpotName && P.facts.some(function (f) { return typeof f.value === 'number'; })) {
        items.push('The trail begins at the <b>' + esc(P.startSpotName) + '</b>.');
      }
      sec('The safe’s rule', li(items));
    }

    /* 3. Numbers, in the order the rule counts them. */
    if (L.puzzle) {
      var nums = L.puzzle.facts.filter(function (f) { return typeof f.value === 'number'; })
                               .sort(function (a, b) { return a.order - b.order; });
      var found = nums.filter(function (f) { return S.factsFound[f.spot]; });
      if (found.length) {
        var unit = L.puzzle.lore ? L.puzzle.lore.unit : 'marks';
        var rows = found.map(function (f) {
          var s = '<b>' + capFirst(numeral(f.order)) + ': ' + f.value + '</b> ' + esc(unit) +
                  ' — at the ' + esc(f.spotName);
          if (f.pointsTo && !S.factsFound[f.pointsTo]) s += '; an arrow points to the ' + esc(f.pointsToName);
          return s + '.';
        });
        if (found.length < nums.length) {
          rows.push('<i>' + (nums.length - found.length) + ' more to find (' + nums.length + ' in all).</i>');
        }
        sec('Numbers found — ' + found.length + ' of ' + nums.length, li(rows));
      }
    }

    /* 4. The sigils, once seen under the lamp. */
    if (S.sigilsSeen && L.seq && L.seq.length) {
      sec('Sigils on the ' + esc(spotName('rug')),
          li(['<span class="nbSig">' + L.seq.join(' ') + (L.seqReversed ? ' ↶' : '') + '</span>' +
              (L.seqReversed ? '<br>↶ — the door reads them last to first.' : '')]));
    }

    /* 5. What was found where. */
    if (S.finds.length) sec('Found', li(S.finds.map(esc)));

    /* 6. The room: every object a clue can talk about, left to right as
       drawn, with every property in the clues' own words. Free to read —
       this is what the review asked for ("u can't tell … if they're flat
       or made of metal"). */
    var spots = (L.spotDescs || []).slice().sort(function (a, b) { return (a.x || 0) - (b.x || 0); });
    if (spots.length) {
      var rows2 = spots.map(function (d) {
        var ps = propsOf(d.id).map(function (p) {
          return '<span class="k">' + p.label + '</span><span>' + esc(p.phrase) + '</span>';
        }).join('');
        var status = '';
        if (S.found[d.id]) {
          status = L.hides[d.id] ? ' <span class="nbTag">searched · ' + LBL[L.hides[d.id]] + '</span>'
                 : (L.factAt && L.factAt[d.id]) ? ' <span class="nbTag">searched · a number</span>'
                 : ' <span class="nbTag dim">searched · nothing</span>';
        }
        return '<b>' + esc(capFirst(spotName(d.id))) + '</b>' + status + '<div class="nbProps">' + ps + '</div>';
      });
      sec('The room — left to right as you see it', li(rows2));
    }

    /* 7. Hints bought, kept. */
    if (S.hintLog.length) {
      sec('Hints you took', li(S.hintLog.map(function (x) {
        return '<b>' + esc(x.goal) + ' ' + esc(x.label) + '</b> ' + esc(x.text);
      })));
    }

    $('noteBody').innerHTML = h;
    S.noteSeen = noteCount();
    var b = $('noteBtn');
    if (b) { b.classList.remove('fresh'); $('noteBadge').textContent = ''; }
  }

  /* ---------------- HUD layout around the room (1.7.1) ----------------
     The room is a landscape picture letterboxed in a portrait screen. The
     observations panel at the top and the message box at the bottom now
     live in those letterbox bands and are sized never to cover the room —
     the panel used to hang 30-50px over the top of the wall, which is
     exactly where the UV rule is written. */
  function roomScreenRect() {
    var sc = $('scene');
    var m = sc && sc.getScreenCTM && sc.getScreenCTM();
    if (!m) return null;
    var ys = [], xs = [];
    [[0, 0], [800, 0], [0, 560], [800, 560]].forEach(function (c) {
      var p = new DOMPoint(c[0], c[1]).matrixTransform(m);
      xs.push(p.x); ys.push(p.y);
    });
    return { top: Math.min.apply(null, ys), bottom: Math.max.apply(null, ys),
             left: Math.min.apply(null, xs), right: Math.max.apply(null, xs) };
  }

  function layoutHud() {
    var room = roomScreenRect();
    var wrap = $('sceneWrap').getBoundingClientRect();
    if (!room || !wrap.height) return;
    var obsTop = 44;                                   // matches #obs top in index.html
    var spaceTop = room.top - wrap.top - obsTop - 6;
    $('obs').style.maxHeight = Math.max(64, Math.floor(spaceTop)) + 'px';

    /* The message box: anchored just above the bag bar, growing upwards
       into the band under the room and never past it. A banner (menu
       only) covers the bottom of the page, so the box clears that too. */
    var invTop = $('inv').getBoundingClientRect().top;
    var banner = document.body.classList.contains('bannerUp')
      ? parseFloat(getComputedStyle(document.body).getPropertyValue('--banner-h')) || 60 : 0;
    var bottomGap = Math.max(window.innerHeight - invTop + 6, banner + 8);
    var space = (window.innerHeight - bottomGap) - room.bottom - 6;
    toastEl.style.bottom = Math.round(bottomGap) + 'px';
    toastEl.style.maxHeight = Math.max(72, Math.floor(space)) + 'px';
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
     One combined table was unfair: chamber I is a single search and the
     last is a five-digit safe plus a sigil lock, so their times are not
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
      'chamber ' + ROMAN[LAST] + ' is a safe and a sigil lock, so their times are not comparable.' +
      '<br><br><b>World rankings are not live yet.</b> They need a server to hold ' +
      'other players’ runs, so this board is your own record for now.';
    $('rankBack').style.display = '';
    $('rankOv').classList.add('show');
  }

  /* The index: one row per chamber, tapping through to that chamber's board. */
  function showRankIndex() {
    var done = Object.keys(Save.data.best).length;
    $('rankSummary').innerHTML = done
      ? '<b>' + Save.totalStars() + '</b> of ' + (TOTAL * 5) + ' stars · <b>' + done +
        '</b> of ' + TOTAL + ' chambers ranked<br><span class="par">Tap a chamber for its own board</span>'
      : 'No runs yet. Escape a chamber to take a place on its board.';

    var html = '<tr><th>#</th><th>Chamber</th><th>Your best</th><th>Time</th></tr>';
    for (var i = 0; i < TOTAL; i++) {
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
    /* A video watched from the out-of-hints prompt lands while the hint
       panel is still open underneath: its wallet line and button follow. */
    if ($('hintPanel') && $('hintPanel').classList.contains('show')) renderHintPanel();
  }

  /* ---------------- the hint ladder (1.7.1) ----------------
     The review said it plainly: "the hint system sucks as well". Each press
     of 💡 used to buy and flash the next sentence for 2.8 s, with no way to
     see where you were on the ladder or what the next press would cost.

     Now 💡 opens a panel. It names the GOAL you are stuck on, shows the
     ladder for that goal as steps — Nudge → Narrow → Reveal — with the
     ones already bought ticked and readable, and a single button that says
     exactly what the next step is and what it costs before you press it.
     The hints point at the notebook, where the facts they talk about are.

     The economy is untouched: the first key-hunt nudge is free, every
     other step costs one hint (nothing for an unlimited owner), a step
     bought once is free to re-read, an empty wallet gets the same
     out-of-hints prompt (video / shop), and the skip offer still opens
     once the key-hunt ladder is used up.

     A stage is { id, goal, rungs: [{ key, kind, text }] }. `key` names the
     puzzle STEP, not its wording, so a re-read is never charged twice. */
  var KIND_LABEL = { restate: 'Nudge', narrow: 'Narrow', answer: 'Reveal', step: 'Next step' };

  function hintStage() {
    var has = function (n) { return !!S.items[n]; };
    /* The key hunt's own graduated ladder REPLACES the two hints that used
       to live here ("Search the rug, plant, clock…" and "Search every
       corner"). Both told the player to do the exact thing this redesign
       removes. Rungs: restate a clue in plainer words -> narrow to 2-3
       candidates -> only then name the spot. */
    var needKey = (L.tier === 1 && !has('ironKey')) ||
                  (L.tier > 1 && !has('brassKey') && !S.drawer);
    if (needKey && L.hunt && L.hunt.hints.length) {
      return { id: 'key', goal: 'Find the hidden ' + (L.tier === 1 ? 'iron key' : 'brass key') + '.',
               keyHunt: true,
               rungs: L.hunt.hints.map(function (h) {
                 return { key: 'keyhunt:' + h.level, kind: h.kind,
                          text: h.text + (h.kind === 'restate'
                            ? ' Check it against “The room” in your 📓 notebook — it lists what every object is.'
                            : h.kind === 'narrow'
                              ? ' The notebook lists each one’s material and build.' : '') };
               }) };
    }
    if (L.tier > 1 && !S.drawer && has('brassKey'))
      return { id: 'drawer', goal: 'Use the brass key.',
               rungs: [{ key: 'useBrass', kind: 'step',
                         text: 'Select the brass key in your bag, then tap the ' + drawerName() + '.' }] };
    if (L.tier >= 4 && has('uv') && !S.ruleSeen && !S.safe)
      return { id: 'uvOn', goal: 'Use the UV lamp.',
               rungs: [{ key: 'uvOn', kind: 'step',
                         text: 'Switch the UV lamp on (tap it in your bag), then look at the walls. ' +
                               'Whatever glows is copied into your notebook.' }] };
    if (L.tier >= 3 && S.drawer && !S.safe && L.puzzle)
      return { id: 'safe', goal: 'Open the ' + lockName('safe') + '.', rungs: safeRungs() };
    if (L.tier >= 5 && S.safe && !S.cab)
      return { id: 'crank', goal: 'Use the crank.',
               rungs: [{ key: 'crank', kind: 'step',
                         text: 'The crank fits the ' + lockName('cab') + '’s socket. Select it and tap the ' +
                               lockName('cab') + '.' }] };
    if (L.tier >= 5 && !S.seqDone)
      return { id: 'sigil', goal: 'Work the sigil lock on the door.',
               rungs: [
                 { key: 'sigil', kind: 'restate',
                   text: 'With the UV lamp on, the ' + spotName('rug') +
                         ' shows the sigils in order (they are in your notebook once seen). Then tap the door.' +
                         (L.seqReversed ? ' The ↶ beside them means the door reads them LAST to FIRST.' : '') },
                 { key: 'sigil:reveal', kind: 'answer',
                   text: 'Tap the door and enter: ' + L.seqWant.join('  ') + '.' }
               ] };
    if (has('ironKey'))
      return { id: 'door', goal: 'Get out.',
               rungs: [{ key: 'door', kind: 'step', text: 'Select the iron key and tap the door. Freedom awaits.' }] };
    /* Reachable in states the ladder above does not match. It used to say
       "Search the room — something is still hidden", which is the blind
       tapping this redesign removes; point at the evidence instead. */
    return { id: 'more', goal: 'Keep reading the room.',
             rungs: [{ key: 'searchMore', kind: 'step',
                       text: 'Read your notebook again (📓) — the room has already told you where to look.' }] };
  }

  /* The safe: nudge (where the rule is and which number is missing),
     narrow (how to apply it, with the player's own numbers laid out), and
     — new in 1.7.1 — a reveal. Before, a player who could not do the sum
     had nowhere to go but the skip offer. */
  function safeRungs() {
    var P = L.puzzle;
    var where = L.tier === 3 ? 'the note in your bag' : 'the ink on the ' + spotName(L.clueSpot);
    var nums = P.facts.filter(function (f) { return typeof f.value === 'number'; })
                      .sort(function (a, b) { return a.order - b.order; });
    var have = nums.map(function (f) {
      return numeral(f.order) + ': ' + (S.factsFound[f.spot] ? f.value : '?');
    }).join(', ');
    return [
      { key: 'safe:nudge', kind: 'restate',
        text: 'The rule is ' + where + ' — it gives the RULE, not the number. Your notebook keeps it: “' +
              P.shortRule + '”.' + (nums.length ? nextStepHint()
                : ' This rule needs no numbers from the room; it describes one code only.') },
      { key: 'safe:narrow', kind: 'narrow',
        text: P.hintText + (nums.length ? ' Your numbers, in order — ' + have + '.' : '') },
      { key: 'safe:reveal', kind: 'answer',
        text: 'The code is ' + L.code.split('').join(' ') + '.' }
    ];
  }

  /* Which rung is next: the first not yet bought. -1 = all bought. */
  function nextRungIndex(stage) {
    for (var k = 0; k < stage.rungs.length; k++) {
      if (!S.paidHints[stage.rungs[k].key]) return k;
    }
    return -1;
  }
  function rungFree(stage, k) { return !!stage.keyHunt && k === 0; }

  function openHints() {
    if (!inChamber()) { toast('Open a chamber first.'); return; }
    hideMsg();
    renderHintPanel();
    $('hintPanel').classList.add('show');
  }

  function renderHintPanel() {
    if (!inChamber()) return;
    var st = hintStage();
    var n = nextRungIndex(st);
    $('hpGoal').textContent = 'Right now: ' + st.goal;

    /* The ladder as steps: ✓ bought, ● next, ○ later. */
    var steps = '';
    st.rungs.forEach(function (r, k) {
      var cls = S.paidHints[r.key] ? 'done' : k === n ? 'next' : '';
      steps += '<span class="hstep ' + cls + '">' + (S.paidHints[r.key] ? '✓ ' : k === n ? '● ' : '○ ') +
               (k + 1) + ' ' + KIND_LABEL[r.kind] + '</span>';
    });
    $('hpSteps').innerHTML = steps;
    $('hpWhere').textContent = n < 0
      ? 'All ' + st.rungs.length + ' steps for this goal are shown below.'
      : 'Step ' + (n + 1) + ' of ' + st.rungs.length + ' · ' + KIND_LABEL[st.rungs[n].kind];

    var list = '';
    st.rungs.forEach(function (r, k) {
      if (!S.paidHints[r.key]) return;
      list += '<li><b>' + (k + 1) + ' · ' + KIND_LABEL[r.kind] + '</b> ' + esc(r.text) + '</li>';
    });
    $('hpList').innerHTML = list ? '<ul>' + list + '</ul>' : '';

    var btn = $('hpNext');
    if (n < 0) {
      btn.disabled = true;
      btn.textContent = 'All steps shown';
    } else {
      btn.disabled = false;
      var free = rungFree(st, n) || Save.data.unlimitedHints;
      btn.textContent = 'Show step ' + (n + 1) + ': ' + KIND_LABEL[st.rungs[n].kind] +
                        (free ? ' — free' : ' — 1 💡');
    }
    $('hpWallet').textContent = Save.data.unlimitedHints ? 'Unlimited hints'
      : 'You have ' + Save.data.hints + (Save.data.hints === 1 ? ' hint.' : ' hints.') +
        ' Re-reading a step you bought is always free.';
  }

  /* Buy (or, for the free nudge, take) the next step of the current goal. */
  function useHint() {
    if (!inChamber()) { toast('Open a chamber first.'); return; }
    var st = hintStage();
    var n = nextRungIndex(st);
    if (n < 0) { renderHintPanel(); return; }        // nothing left to sell
    var r = st.rungs[n];

    /* THE FIRST KEY-HUNT RUNG IS FREE.
       It only restates a clue already printed on screen in plainer words —
       charging for it is charging the player to understand the rules, not
       to be rescued from them, and reads as "pay to play" in reviews.
       At tier 1 there is a second reason: the profile is exactly one clue,
       and that clue must isolate the answer, so the restatement always
       gives the answer away. Every other step costs one. */
    var free = rungFree(st, n);
    if (!free && !Save.spendHint()) { Shop.promptOutOfHints(); return; }

    S.paidHints[r.key] = true;
    if (!free) S.hintsUsed++;
    S.hintLog.push({ goal: st.goal, label: (n + 1) + ' · ' + KIND_LABEL[r.kind], text: r.text });
    track('hint_used', { chamber: cur + 1, mode: L.daily ? 'daily' : 'main',
                         step: r.key, free: free });
    if (st.keyHunt) {
      S.keyRung = n + 1;
      renderObs();                 // the rung the player just bought, kept
    }
    refreshHintUI();
    refreshSkip();                 // the last key-hunt rung also opens the skip offer
    refreshNoteBtn();
    renderHintPanel();
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---------------- skip chamber ----------------
     A player who has been in one room for minutes, or has bought every
     hint the key hunt has, is not enjoying a puzzle any more — they are
     about to close the game. The skip offer is the way out that keeps
     them playing: a rewarded video, or hints for a Remove ads owner (who
     has no videos) and anyone else who would rather pay that way.

     A skip marks the chamber escaped with ONE star and opens the next. It
     pays no first-clear hint (a skip that EARNED hints would be a farm)
     and does not count as a finished chamber for the ad cadence or the
     rating prompt. The daily chamber cannot be skipped. */
  function skipEligible() {
    var c = Cfg.skip || {};
    if (c.enabled === false || !inChamber() || L.daily) return false;
    if (t >= (c.afterSeconds || 240)) return true;
    return !!(L.hunt && L.hunt.hints.length && S.keyRung >= L.hunt.hints.length);
  }

  function refreshSkip() {
    $('skipBtn').classList.toggle('show', skipEligible());
  }

  function openSkip() {
    if (!skipEligible()) return;
    var cost = (Cfg.skip && Cfg.skip.hintCost) || 0;
    var canWatch = Ads.rewardedAvailable();
    $('skipWatch').style.display = canWatch ? '' : 'none';
    $('skipHints').style.display = cost > 0 ? '' : 'none';
    $('skipHints').textContent = 'Skip for ' + cost + (cost === 1 ? ' hint' : ' hints');
    /* With a video on offer the hint route is the quieter second choice;
       without one it is the only way through, so it takes the lead. */
    $('skipHints').className = canWatch ? 'btn ghostb' : 'btn';
    $('skipWhy').textContent =
      'It counts as escaped with one star and opens the next chamber. ' +
      'You can come back and solve it properly any time.' +
      (canWatch || Save.data.removeAds ? '' : ' No video is ready just now.');
    hideMsg();
    $('skipOv').classList.add('show');
  }

  var skipBusy = false;

  function doSkip(method) {
    if (!inChamber() || L.daily) return;
    var i = cur;
    S.escaped = true;
    clearInterval(timerInt);
    Save.markDone(i);
    /* compareRuns keeps a real record over this one, so skipping a room
       you once solved well costs nothing. */
    Save.recordRun(i, { stars: 1, moves: S.moves, seconds: t, skipped: true });
    track('skip_chamber', { chamber: i + 1, method: method, seconds: t });
    $('skipOv').classList.remove('show');
    refreshSkip();
    if (i < LAST) startLevel(i + 1); else showMenu();
    toast('Chamber ' + ROMAN[i] + ' skipped — one star. It is still there if you want it.');
  }

  function skipByVideo() {
    if (skipBusy || !skipEligible()) return;
    skipBusy = true;
    Ads.showRewarded('skip').then(function (res) {
      skipBusy = false;
      if (res.earned) { doSkip('video'); return; }
      toast(res.unavailable
        ? 'No video is ready right now — try again in a moment.'
        : 'Not skipped — the video needs to finish.');
    }, function () { skipBusy = false; });
  }

  function skipByHints() {
    if (skipBusy || !skipEligible()) return;
    var cost = (Cfg.skip && Cfg.skip.hintCost) || 0;
    if (!Save.data.unlimitedHints && Save.data.hints < cost) {
      $('skipOv').classList.remove('show');
      Shop.promptOutOfHints();
      return;
    }
    for (var k = 0; k < cost; k++) Save.spendHint();
    refreshHintUI();
    doSkip('hints');
  }

  /* ---------------- level ---------------- */
  function closeAllOverlays() {
    ['padOv','symOv','winOv','shopOv','hintOv','hintPanel','noteOv','menu','rankOv','skipOv','moreOv'].forEach(function (id) {
      $(id).classList.remove('show');
    });
  }

  function startLevel(i) { begin(i, genLevel(i)); }

  /* Today's chamber. `key` and `tierCap` exist for the test suite, which
     walks a run of dates at every tier; the menu button passes neither. */
  function startDaily(key, tierCap) {
    begin(DAILY, genDaily(key || Save.dayKey(), tierCap || reachedTier()));
  }

  function begin(i, level) {
    /* Down before the room is built, not after: the banner overlays the
       WebView, so a late hide leaves it sitting on the first frame of a
       chamber - over the very room the player is about to search. */
    Ads.hideBanner();
    Ads.hideWinCardAd();
    cur = i;
    L = level;
    t = 0;
    entry = ''; symEntry = [];
    S = { found: {}, items: {}, sel: null, drawer: false, safe: false, cab: false,
          uvOn: false, seqDone: L.tier < 5, escaped: false,
          paidHints: {}, hintsUsed: 0, factsFound: {}, keyRung: 0,
          /* The notebook's own record of this run (1.7.1): things found,
             the rule once read, the sigils once seen, hints bought. Lives
             exactly as long as the run, like everything else in S. */
          finds: [], ruleSeen: null, sigilsSeen: false, hintLog: [], noteSeen: 0,
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
    paintRoom(L.seed);
    applyRoomStyle(L.seed);
    $('roomTitle').textContent = L.setting.name +
      (L.daily ? ' · DAILY CHAMBER' : ' · CHAMBER ' + ROMAN[i]);
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
    hideMsg();
    /* The wall glows the RULE, never the answer. Printing L.code here was
       the tier 4-5 half of "the game is just search": the code was simply
       written on the wall in invisible ink. Where it is written is now
       measured, not fixed — see placeUvRule. */
    if (L.tier >= 4) {
      L.uvPlace = placeUvRule($(UVEL[L.clueSpot]),
        L.puzzle ? L.puzzle.shortRule : L.code.split('').join(' '), L.clueSpot);
      if ($(L.clueSpot)) $(L.clueSpot).classList.add('uvClue');
    }
    $('uvRug').textContent = L.tier >= 5
      ? L.seq.join(' ') + (L.seqReversed ? ' ↶' : '') : '';
    /* Five sigils (tier 6+), plus the ↶ from chamber 26, at the four-sigil
       spacing ran past the rug and under whatever stands beside it — on the
       device the crate in chamber 22 hid the fifth sigil outright. Close the
       spacing up so five or six glyphs take no more room than four did.
       Four (tier 5) get a lighter squeeze: even they lost a sigil under the
       chest in about one tier-5 daily in twenty (a 1.6.0-era miss). The
       room is repainted on every start, so nothing carries over. */
    if (L.tier >= 5) {
      var glyphs = L.seq.length + (L.seqReversed ? 1 : 0);
      $('uvRug').setAttribute('font-size', glyphs > 4 ? '22' : '24');
      $('uvRug').setAttribute('letter-spacing', glyphs > 4 ? '2' : '4');
    }

    renderInv();
    refreshHintUI();
    refreshNoteBtn();
    startTimer();
    $('timer').textContent = '0:00';
    closeAllOverlays();
    refreshSkip();
    layoutHud();
    track('chamber_start', { chamber: i + 1, mode: L.daily ? 'daily' : 'main' });

    /* The setting's own opening line. "The slab grinds shut. Four thousand
       years of patience, and no hurry now." establishes a tomb in one
       sentence; the generic line established nothing. */
    toast((L.setting.intro && L.setting.intro[L.seed % L.setting.intro.length]) ||
          ['The door slams shut behind you.',
           'The lock clicks by itself. Wonderful.',
           'The air smells of secrets.'][L.seed % 3]);
  }

  function startTimer() {
    clearInterval(timerInt);
    timerInt = setInterval(function () {
      t++;
      $('timer').textContent = fmt(t);
      refreshSkip();
    }, 1000);
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
      /* Every first look now also says what the object IS, in the clues'
         own words (1.7.1) — and the same lines are in the notebook. */
      var props = '\n' + propsLine(id);
      if (hid) {
        give(hid);
        /* Themed name, not "rug": in the cell block this reads "Behind the
           straw mattress". A hardcoded name here would undo the settings. */
        noteFind('A ' + LBL[hid] + ', behind the ' + spotName(id) + '.');
        clue('Behind the ' + spotName(id) + ' — a ' + LBL[hid] + '!' + props);
        refreshNoteBtn();
        return;
      }
      /* A numbered fact reads as a find, not a taunt. It is worthless on
         its own — the note's rule is what turns it into a code — which is
         the whole point of the redesign. */
      var f = L.factAt && L.factAt[id];
      if (f) {
        S.factsFound[id] = true;
        clue(factLine(f) + props);
        refreshNoteBtn();
        return;
      }
      clue(L.taunts[id] + props);
      refreshNoteBtn();
      return;
    }
    /* already searched: contextual re-read */
    /* Under UV the wall no longer spells out the answer — it spells out
       the RULE. Reading it is now the start of the puzzle, not the end. */
    if (id === L.clueSpot && L.tier >= 4) {
      if (S.uvOn) {
        seeRule('uv');
        clue('✨ Ghostly ink blazes: ' +
          (L.puzzle
            ? L.puzzle.ruleText +
              (L.puzzle.startSpotName && !S.factsFound[L.puzzle.startSpot]
                ? '  Begin at the ' + L.puzzle.startSpotName + '.' : '')
            : '"' + L.code + '"'));
      } else {
        toast('The surface shimmers oddly in the low light…');
      }
      return;
    }
    var rf = L.factAt && L.factAt[id];
    if (rf) { clue(factLine(rf, true)); return; }
    if (id === 'rug' && L.tier >= 5) {
      if (S.uvOn) {
        seeSigils();
        clue('✨ Sigils in glowing thread: ' + L.seq.join('  ') +
             (L.seqReversed ? '  ↶ — and stitched small beneath them: ' +
                              '“the door reads them last to first.”' : ''));
      } else {
        toast('The weave hides a pattern you can’t quite see…');
      }
      return;
    }
    if (id === L.clueSpot && L.tier === 3) {
      clue('Scratched into it: "the drawer knows the number."');
      return;
    }
    toast(propsLine(id) + '\nAlready searched' +
          (L.hides[id] ? ' — this is where the ' + LBL[L.hides[id]] + ' was.' : ' — nothing else here.'));
  }

  /* "Tin cup — hangs on the wall · is metal · is a vessel · opens, or has
     room inside it". "Is not alive" is left off the message (it is true
     of nearly everything) but kept in the notebook, where every axis is
     listed. */
  function spotDescOf(id) {
    var d = null;
    (L.spotDescs || []).forEach(function (s) { if (s.id === id) d = s; });
    return d;
  }
  function propsOf(id) {
    var d = spotDescOf(id);
    return (d && global.ECPuzzle && global.ECPuzzle.describeTraits)
      ? global.ECPuzzle.describeTraits(d.traits) : [];
  }
  function capFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function propsLine(id) {
    var ps = propsOf(id).filter(function (p) { return !(p.axis === 'living' && !p.value); })
                        .map(function (p) { return p.phrase; });
    return capFirst(spotName(id)) + (ps.length ? ' — ' + ps.join(' · ') : '') + '.';
  }

  /* ---------------- safe keypad ---------------- */
  function renderCode() {
    $('code').textContent = entry.padEnd(L.code.length, '—').split('').join(' ');
  }
  function openPad() {
    hideMsg();
    entry = '';
    renderCode();
    $('padSub').textContent = L.code.length + ' rolling dials guard the lock.';
    $('padOv').classList.add('show');
  }

  /* ---------------- sigil lock ---------------- */
  function renderSeq() {
    var n = (L && L.seq && L.seq.length) || 4;
    $('seqShow').textContent = symEntry.join(' ') || new Array(n + 1).join('· ').trim();
  }
  function openSym() {
    hideMsg();
    symEntry = []; renderSeq();
    /* The line was fixed at "four" in index.html; from chamber 21 the door
       takes five (seen on the device in chamber XXVI: "four sigils" over
       five empty slots). */
    var n = (L && L.seq && L.seq.length) || 4;
    $('symSub').textContent = 'The door demands ' +
      (['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'][n] || n) + ' sigils, in order.';
    $('symOv').classList.add('show');
  }

  /* ---------------- win ---------------- */
  function escape() {
    S.escaped = true;
    clearInterval(timerInt);
    hideMsg();                      // a kept message must not sit on the win card

    /* The daily chamber keeps its own book: done-today and a streak,
       instead of a place in the twenty. Its "first clear" is the first
       escape of THAT DAY, so replaying today's room pays nothing — the
       same anti-farm rule as the main game. */
    var daily = L.daily, streak = 0, firstClear;
    if (daily) {
      var dres = Save.markDailyDone(daily);
      firstClear = dres.first;
      streak = dres.streak;
    } else {
      firstClear = Save.markDone(cur);
    }
    var earned = 0;
    if (firstClear) {
      earned = Cfg.hints.perChamberFirstClear;
      Save.addHints(earned);
    }
    if (global.RatePrompt) RatePrompt.tick();
    if (t >= Cfg.ads.minChamberSecondsForAd) {
      Save.data.chambersSinceAd++;
      Save.save();
    }
    refreshHintUI();

    var par   = parFor(L);
    var stars = starsFor(S.moves, par);
    var run   = { stars: stars, moves: S.moves, seconds: t };
    /* No record book for the daily: it is a different room every day, so
       there is nothing to beat tomorrow. */
    var res   = daily ? { improved: false, previous: null, record: null }
                      : Save.recordRun(cur, run);

    track('chamber_clear', { chamber: cur + 1, mode: daily ? 'daily' : 'main',
                             seconds: t, stars: stars, hints_used: S.hintsUsed });
    if (daily && firstClear) {
      track('daily_chamber_clear', { streak: streak, stars: stars, seconds: t });
    }
    /* Playing is what pushes the reminder back; see notify.js. */
    if (Notify) Notify.arm();
    refreshSkip();

    /* The card should sound like it is pleased with you. A perfect run in
       particular has to LAND — it is the whole reward for reasoning instead
       of tapping, and a flat "Chamber escaped" made it feel like nothing
       happened. */
    var perfect = stars === 5;
    /* No-break spaces tie the dash to "FLAWLESS" and the numeral to
       "CHAMBER": on a 360-400px phone the flawless title wraps, and it used
       to strand a lone "I" on the second line. With the ties (plus
       text-wrap:balance on .card h2) the only break left is after the
       dash: "⭐ FLAWLESS —" / "CHAMBER I". */
    var NB = ' ';
    $('winTitle').textContent =
        daily ? (perfect ? '⭐ FLAWLESS' + NB + '— DAILY CHAMBER' : 'DAILY CHAMBER ESCAPED')
      : cur === LAST ? '🏆 ALL ' + TOTAL + ' CHAMBERS ESCAPED'
      : perfect ? '⭐ FLAWLESS' + NB + '— CHAMBER' + NB + ROMAN[cur]
                : 'CHAMBER' + NB + ROMAN[cur] + ' ESCAPED';

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
    if (daily) {
      line += '<p class="rec">🔥 Daily streak: <b>' + streak +
              (streak === 1 ? ' day' : ' days') + '</b>. A new room arrives tomorrow.</p>';
    }
    if (earned) {
      line += '<p class="rec">🕯️ <b>+' + earned + ' hint</b> for ' +
              (daily ? 'today’s chamber.' : 'a first escape.') + '</p>';
    }

    $('winText').innerHTML = line;
    $('nextBtn').style.display = (daily || cur === LAST) ? 'none' : '';
    $('winOv').classList.add('show');
    /* Native card under the buttons when one is loaded; otherwise the
       slot stays collapsed and the card is exactly as it was. */
    Ads.showWinCardAd($('nativeSlot'));
    buzz(perfect ? [30, 40, 30, 40, 120] : [40, 60, 120]);
  }

  /* The interstitial goes HERE — after the player dismisses the win card,
     on the seam between chambers. Never during a chamber, and never on
     top of the win card itself, which would bury the reward. */
  function leaveWin(then) {
    $('winOv').classList.remove('show');
    /* The native card floats ABOVE the WebView, so it has to go before
       anything else is drawn where the win card was. */
    Ads.hideWinCardAd();

    /* A due rating prompt takes this seam INSTEAD of the ad, so the two
       never land back to back; chambersSinceAd is left alone and the ad
       comes on the next seam. "Rate now" sends the player to the store, so
       they come back to the menu, not into a running chamber clock. */
    if (global.RatePrompt && RatePrompt.maybeShow(function (choice) {
      track('rate_prompt', { action: choice });
      if (choice === 'rate') showMenu(); else then();
    })) {
      track('rate_prompt', { action: 'shown' });
      return;
    }

    /* Two formats compete for this ONE slot; they never stack. ads.js
       decides WHETHER a seam ad is due (one cadence, one cooldown) and
       then WHICH format it is — every Nth seam ad is the rewarded
       interstitial. The counters are only spent when an ad was actually
       shown: a seam that came up empty is still owed one. */
    var kind = Ads.pickSeamAd(Save.data.chambersSinceAd, Save.data.seamAdsShown);
    if (!kind) { then(); return; }

    var spent = function () {
      Save.data.chambersSinceAd = 0;
      Save.data.seamAdsShown++;
      Save.save();
    };

    if (kind === 'rewardedInterstitial') {
      Ads.showRewardedInterstitial().then(function (res) {
        if (res.shown) spent();
        var n = Cfg.ads.rewardedInterstitialHints || 0;
        if (res.earned && n > 0) {
          Save.addHints(n);
          refreshHintUI();
          then();
          /* After then(): a chamber start or the menu would otherwise
             replace this toast before it was read. */
          toast('\ud83c\udfac +' + n + (n === 1 ? ' hint' : ' hints') + ' for watching.');
          return;
        }
        then();
      }, then);
      return;
    }

    Ads.showInterstitial().then(function (shown) {
      if (shown) spent();
      then();
    }, then);
  }

  /* ---------------- menu ---------------- */
  function showMenu() {
    if (inChamber()) clearInterval(timerInt);
    /* Leaving the room clears its kept message; a re-render of a menu that
       is already open (a purchase landing) must not eat the shop's toast. */
    if (!$('menu').classList.contains('show')) hideMsg();
    $('resumeBtn').style.display = inChamber() ? '' : 'none';
    refreshHintUI();
    renderDaily();
    /* Build + store state. `store=ready` means the SDK reached RevenueCat;
       `unavailable` means it never did, and the two produce completely
       different purchase bugs. Always written, but only VISIBLE after five
       taps on the menu title — see wire(). */
    $('buildLine').textContent =
      'build ' + Cfg.build + ' · store ' + Billing.state +
      (Billing.lastError ? ' · ' + Billing.lastError : '');
    /* Counts are information, so they are DERIVED: add a chamber to
       themes.js and this line, the grid and the final card all follow. */
    $('menuBlurb').textContent = TOTAL + ' locked rooms';
    var escaped = Save.data.done.length;
    $('menuProgress').textContent = escaped + ' / ' + TOTAL + ' escaped  ·  ' +
      Save.totalStars() + ' / ' + (TOTAL * 5) + ' ★';
    var g = $('grid');
    g.innerHTML = '';
    for (var i = 0; i < TOTAL; i++) {
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
    /* The menu is the one screen where the player is reading rather than
       searching, so it is the only place the banner is allowed. */
    Ads.showBanner();
  }

  /* ---------------- daily row ----------------
     Today's chamber and the free hint, with their state. Both key on the
     device's local calendar date. */
  function renderDaily() {
    var today = Save.dayKey();

    var on = !(Cfg.daily && Cfg.daily.enabled === false);
    $('dailyBtn').style.display = on ? '' : 'none';
    if (on) {
      var done = Save.dailyDone(today);
      var streak = Save.dailyStreak(today);
      $('dailyBtn').classList.toggle('done', done);
      $('dailyState').textContent =
        (done ? 'Escaped today ✓' : 'A new room today') +
        (streak ? ' · 🔥 ' + streak : '');
    }

    var can = Save.canClaimDailyHint(today);
    var n = Cfg.hints.dailyFree || 1;
    $('dailyHintBtn').classList.toggle('spent', !can);
    $('dailyHintTitle').textContent = can ? '🎁 Free hint' : '🎁 Claimed';
    $('dailyHintState').textContent = can ? 'Tap for +' + n + ' today' : 'Next one tomorrow';
  }

  function claimDailyHint() {
    var n = Save.claimDailyHint();
    if (!n) { toast('Already claimed today — the next one is ready tomorrow.'); return; }
    track('daily_hint_claimed', { hints: n });
    refreshHintUI();
    renderDaily();
    toast('🎁 +' + n + (n === 1 ? ' hint' : ' hints') + '. Come back tomorrow for another.');
    /* THE one place the notification permission is ever requested: the
       player has just taken a daily hint, so "remind me when the next one
       is ready" is a question with an obvious point. askOnce() does
       nothing after the first time, whatever the answer was. */
    if (Notify) {
      Notify.askOnce().then(function () { Notify.arm(); Shop.render(); });
    }
  }

  /* ---------------- more games ---------------- */
  function liveGames() {
    /* On iOS a game is listed only once its App Store id is known
       (Cfg.hasStorePage); a link that cannot be built is not shown. */
    return (Cfg.moreGames || []).filter(function (g) {
      return g && g.pkg && g.live !== false && (!Cfg.hasStorePage || Cfg.hasStorePage(g.pkg));
    });
  }

  function openStorePage(pkg) {
    var url = Cfg.storeUrl ? Cfg.storeUrl(pkg)
                           : 'https://play.google.com/store/apps/details?id=' + pkg;
    if (!url) return;
    track('more_games_click', { pkg: pkg });
    /* Leaving for the store on our own link is not time away. */
    if (Ads.noteHandoff) Ads.noteHandoff();
    /* Same route rate.js uses: Capacitor hands an off-app URL to Android
       as an ACTION_VIEW intent, the Play Store app claims play.google.com
       links, and a device without it falls back to the browser. */
    if (Cfg.isNative()) global.location.href = url;
    else global.open(url, '_blank');
  }

  function renderMoreGames() {
    var list = $('moreList');
    list.innerHTML = '';
    var line = $('moreStoreLine');
    if (line && Cfg.storeName) {
      line.textContent = 'From the same developer. Free on ' + Cfg.storeName() + '.';
    }
    liveGames().forEach(function (g) {
      var row = document.createElement('div');
      row.className = 'srow mrow';
      row.dataset.pkg = g.pkg;
      if (g.icon) {
        var im = document.createElement('img');
        im.src = g.icon;
        im.alt = '';
        row.appendChild(im);
      }
      var tx = document.createElement('div');
      tx.className = 'tx';
      var tt = document.createElement('div');
      tt.className = 'tt';
      tt.textContent = g.name;
      var ds = document.createElement('div');
      ds.className = 'ds';
      ds.textContent = g.tagline || '';
      tx.appendChild(tt);
      tx.appendChild(ds);
      row.appendChild(tx);
      var go = document.createElement('div');
      go.className = 'go';
      go.textContent = 'GET ›';
      row.appendChild(go);
      row.addEventListener('click', function () { openStorePage(g.pkg); });
      list.appendChild(row);
    });
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
          if (S.uvOn) {
            /* Say WHAT glows, and keep it: the wall writing is also copied
               into the notebook the moment it can be seen, so it never has
               to be squinted at or re-tapped. */
            var glowMsg = 'Violet light floods the chamber.';
            if (L.tier >= 4) {
              seeRule('uv');
              glowMsg += ' Ink glows on the ' + spotName(L.clueSpot) + ': “' +
                (L.puzzle ? L.puzzle.shortRule : L.code) + '”.';
            }
            if (L.tier >= 5) {
              seeSigils();
              glowMsg += ' Sigils glow on the ' + spotName('rug') + '.';
            }
            clue(glowMsg + (L.tier >= 4 ? ' 📓 Copied into your notebook.' : ''));
          } else {
            toast('You click the lamp off. Anything it showed is in your notebook.');
          }
          refreshNoteBtn();
          renderInv(); buzz(20);
          return;
        }
        if (n === 'note') {
          /* The note gives the rule AND the head of the trail. Without the
             starting point the player has a rule and no idea where the
             numbers are, which is the "guess what the designer meant"
             failure real escape rooms are warned against. */
          seeRule('note');
          clue(L.puzzle
            ? L.puzzle.ruleText +
              (L.puzzle.startSpotName && !S.factsFound[L.puzzle.startSpot]
                ? '  Begin at the ' + L.puzzle.startSpotName + '.' : '')
            : 'The note reads: "' + L.code + '". Someone circled it twice.');
          refreshNoteBtn();
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
            noteFind('The code ' + entry + ' opened the ' + lockName('safe') + ': a ' + LBL[L.safeHas] + '.');
            clue('The dials align — inside, a ' + LBL[L.safeHas] + '!');
            refreshNoteBtn();
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
        if (symEntry.length >= L.seq.length) return;   // locked pending the check
        symEntry.push(s); renderSeq(); buzz(10);
        if (symEntry.length === L.seq.length) setTimeout(function () {
          if (symEntry.join('') === L.seqWant.join('')) {
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
    $('hintBtn').addEventListener('click', openHints);
    $('hpNext').addEventListener('click', useHint);
    $('hpClose').addEventListener('click', function () { $('hintPanel').classList.remove('show'); });
    $('hpNotebook').addEventListener('click', function () {
      $('hintPanel').classList.remove('show');
      openNotebook();
    });
    $('noteBtn').addEventListener('click', openNotebook);
    $('noteClose').addEventListener('click', function () { $('noteOv').classList.remove('show'); });
    toastEl.addEventListener('click', tapMsg);
    global.addEventListener('resize', function () { if (L) layoutHud(); });
    $('menuBtn').addEventListener('click', showMenu);
    $('shopBtn').addEventListener('click', function () { Shop.openShop(); });

    /* daily row */
    $('dailyBtn').addEventListener('click', function () { startDaily(); });
    $('dailyHintBtn').addEventListener('click', claimDailyHint);

    /* skip offer */
    $('skipBtn').addEventListener('click', openSkip);
    $('skipWatch').addEventListener('click', skipByVideo);
    $('skipHints').addEventListener('click', skipByHints);
    $('skipClose').addEventListener('click', function () {
      $('skipOv').classList.remove('show');
    });

    /* more games: the button hides when nothing in the list is live */
    $('moreBtn').style.display = liveGames().length ? '' : 'none';
    $('moreBtn').addEventListener('click', function () {
      renderMoreGames();
      $('moreOv').classList.add('show');
    });
    $('moreClose').addEventListener('click', function () {
      $('moreOv').classList.remove('show');
    });

    /* The build line is for testers, not players: five taps on the menu
       title within a few seconds toggles it. */
    var titleTaps = 0, titleT = null;
    $('menuTitle').addEventListener('click', function () {
      titleTaps++;
      clearTimeout(titleT);
      titleT = setTimeout(function () { titleTaps = 0; }, 2500);
      if (titleTaps >= 5) {
        titleTaps = 0;
        $('buildLine').classList.toggle('show');
      }
    });
    $('resumeBtn').addEventListener('click', function () {
      $('menu').classList.remove('show');
      Ads.hideBanner();
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
      if (global.RatePrompt && RatePrompt.isOpen()) { RatePrompt.dismiss(); return; }
      var overlays = ['skipOv','moreOv','hintOv','hintPanel','noteOv','shopOv','padOv','symOv','rankOv'];
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
    /* Leaving the app is "the last time the game was used": push the
       reminder out from here, so it lands a day after the player actually
       stopped rather than a day after their last escape. */
    App.addListener('appStateChange', function (st) {
      if (st && !st.isActive && Notify) Notify.arm();
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
    if (global.RatePrompt) RatePrompt.init({
      appName: 'Escape Chambers',
      packageId: 'com.ahmadessam.escapechambers',
      config: Cfg,          // per-platform store link + name (config.js)
      everyN: 2,
      /* The trip to the Play listing is ours, not time away: without this
         the player comes back from rating the game to an app-open ad. */
      onHandoff: function () { if (Ads.noteHandoff) Ads.noteHandoff(); },
      colors: { card: '#1a2236', text: '#aab8d6', title: '#e8a84c', muted: '#8fa3c8',
                accent: '#e8a84c', accentText: '#241708' }
    });

    return Save.load().then(function () {
      refreshHintUI();

      /* The shop is wired HERE, before billing and ads are even started.
         It used to be wired after both had settled, and neither is
         guaranteed to: getCustomerInfo() can hang on an offline device and
         the consent form waits on the player. Until then the shop opened
         (its button is wired in wire()) with a dead Back button, dead
         Restore and dead Buy buttons — a trap with no way out but the
         hardware back key. Nothing in Shop.init needs the stores; render()
         reads their state each time it runs. */
      Shop.init({
        toast: toast,
        onChange: function () { refreshHintUI(); showMenuIfOpen(); }
      });
      ['buyHints','buyRemoveAds'].forEach(function (id) {
        $(id).addEventListener('click', function () {
          Shop.buy(this.dataset.product);
        });
      });

      showMenu();
      if (Notify) Notify.arm();

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
            /* The shop may already be open, showing "Store unavailable"
               from before the store answered. */
            Shop.render();
            showMenuIfOpen();
          });
        }),
        bootStep('ads', function () {
          return Ads.init().then(function () {
            Ads.setRemoveAds(Save.data.removeAds);
            Shop.render();
            /* The menu was drawn before the SDK was up, so its
               showBanner() call was a no-op and the first menu of every
               session had no banner. Ask again now — but only if the
               player is still on the menu: a chamber may have been opened
               while consent and initialize() were running, and a banner
               must never land on one. (showBanner itself refuses for a
               Remove ads owner.) */
            if ($('menu').classList.contains('show')) Ads.showBanner();
          });
        })
      ]);
    }).then(function () {
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
    startDaily: startDaily,
    genDaily: genDaily,
    dailySpec: dailySpec,
    showMenu: showMenu,
    genLevel: genLevel,
    /* ads.js asks this before an app-open ad: only the bare rooms menu
       qualifies. Not a chamber, not the win card (it would bury the
       reward), and not a dialog stacked on the menu. */
    adSafeScreen: function () {
      if (!$('menu').classList.contains('show')) return false;
      if (global.RatePrompt && RatePrompt.isOpen()) return false;
      return ['shopOv','hintOv','hintPanel','noteOv','rankOv','moreOv','skipOv','padOv','symOv','winOv']
        .every(function (id) { return !$(id).classList.contains('show'); });
    },
    state: function () {
      /* Puzzle state is exposed at exactly the fidelity the PLAYER has:
         the rule only once it has been read, and only the facts already
         dug out of the room. The answer is never exposed. The e2e solver
         uses these fields, so "every chamber completable" keeps meaning "a
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
         solver read the answer instead of deducing it, and "every chamber
         completable" would become a restatement of the generator. */
      var huntPub = null;
      if (L && L.hunt) {
        huntPub = { evidence: L.hunt.evidence, tier: L.hunt.tier,
                    clueCount: L.hunt.clueCount, degraded: L.hunt.degraded,
                    relaxed: L.hunt.relaxed };
      }
      return { cur: cur, tier: L && L.tier, t: t,
               daily: L ? L.daily : null,
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
    skipEligible: skipEligible,
    /* How many chambers there are (one per setting) and how hard each is. */
    total: TOTAL, tierOf: tierOf,
    /* Test seam ONLY: lets the suite run the chamber clock forward
       instead of sleeping four real minutes to reach the skip offer. */
    _setClock: function (seconds) { t = seconds; refreshSkip(); },
    /* Test seams for the 1.7.1 message box: show a passing message, and the
       reading time a message of a given text gets. */
    _toast: function (m) { toast(m); },
    _readMs: readMs,
    SEARCH: SEARCH, SYMS: SYMS
  };

  if (!global.__EC_NO_AUTOBOOT) {
    document.addEventListener('DOMContentLoaded', function () { boot(); });
  }
})(window);
