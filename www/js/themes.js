/* =====================================================================
   Escape: 20 Chambers — SETTINGS
   ---------------------------------------------------------------------
   Twenty chambers used to be ONE room. Literally one: index.html carried a
   single hand-written SVG — desk, drawer, bookshelf, two paintings, clock,
   plant, rug, chest, safe, cabinet, candle — and every chamber rendered it
   with a different generated palette and a name from a list. Chamber II was
   called THE CELLAR and was a study painted brown. The owner was right to
   reject that, and renaming things does not fix it: a prison cell has to
   have BARS, a BUNK, a TIN CUP and a TALLY SCRATCHED ON THE WALL, or it is
   a study with a grey wall.

   So the room is now DATA. A setting declares a backdrop, a hand-picked
   palette, and which concrete object fills each abstract role. The art is a
   shared vocabulary of parts, so a sea chest and a sarcophagus and a
   dynamite crate are three parts filling one role rather than three copies
   of a room.

   --------------------------------------------------------------------
   THE ID CONTRACT — read this before adding a setting
   --------------------------------------------------------------------
   The rest of the game addresses the room BY ID. game.js hit-tests on
   them, puzzle.js places facts on them, the e2e auto-solver clicks them,
   and CSS animates two of them. So the ids are fixed and every setting
   emits the same twelve top-level ids, no matter what the objects are
   called on screen:

     search (7)  rug plant clock pA pB shelf chest
     locks  (4)  door drawer safe cab
     scenery     candleG   (the light source, whatever burns in it)

   plus these sub-ids, which existing game.js code shows and hides:

     sigilBadge  cabSocket cabOpenG  drawerOpenG drawerItem
     safeOpenG safeItem    chestLid chestOpenG   rugFold
     uvA uvB uvC uvRug     flame glowE

   A themed object therefore has TWO names: `id` — the stable hit-test id,
   never themed — and `part` + `name`, which are. `validate()` at the
   bottom fails loudly if a setting drops or duplicates any required id;
   run it in the harness, not in the shipped boot path.

   Roles exist so the code can talk about "the soft thing on the floor you
   look under" without caring whether it is a Persian rug or a straw
   mattress. The legacy ids are role-neutral only by accident (`rug`,
   `plant`), which is why the mapping is `role -> id` and NOT `id -> role`
   read out of the id's own spelling.

   --------------------------------------------------------------------
   GEOMETRY
   --------------------------------------------------------------------
   viewBox is 0 0 800 560 — LANDSCAPE, inside a portrait app. Do not make
   it taller; the letterboxing is already the top cosmetic complaint (see
   SESSION-NOTES) and a taller composition makes it worse, not better.

     wall   y 0..392      skirting 392..402     floor y 402..560

   Anchors below are the exact centres the old SVG used, because
   game.js:layoutFor() permutes furniture between them by name
   (FLOOR_SLOTS / WALL_SLOTS). Move an anchor and the permutation starts
   dropping the safe through the desk.

   Parts are authored in LOCAL coordinates around their anchor and wrapped
   in a translate by buildObject(). That is what makes a part reusable in
   more than one room — the alternative, absolute coordinates baked into
   every part, is how the old file ended up impossible to re-theme.
   ===================================================================== */
(function (global) {
  'use strict';

  /* ---------------- markup helpers ----------------
     SVG as string concatenation, not template literals: every other file
     in www/js is ES5-shaped and this one loads in the same Android
     WebView. These exist purely so a part reads as shapes rather than as
     punctuation. */
  function rect(x, y, w, h, a) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" ' + (a || '') + '/>';
  }
  function circ(cx, cy, r, a) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" ' + (a || '') + '/>';
  }
  function ell(cx, cy, rx, ry, a) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" ' + (a || '') + '/>';
  }
  function pth(d, a) { return '<path d="' + d + '" ' + (a || '') + '/>'; }
  function ln(x1, y1, x2, y2, a) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" ' + (a || '') + '/>';
  }
  function txt(x, y, s, a) {
    return '<text x="' + x + '" y="' + y + '" ' + (a || '') + '>' + s + '</text>';
  }
  function grp(a, inner) { return '<g ' + (a || '') + '>' + inner + '</g>'; }

  /* The original art outlines everything in black at low opacity rather
     than in a darker shade of its own colour. That is the whole reason a
     generated palette can swing 360 degrees of hue without any room
     falling apart, so new parts must do it too. */
  var K5 = 'stroke="black" stroke-opacity=".6" stroke-width="5"';
  var K4 = 'stroke="black" stroke-opacity=".6" stroke-width="4"';
  var K3 = 'stroke="black" stroke-opacity=".55" stroke-width="3"';
  var K2 = 'stroke="black" stroke-opacity=".4" stroke-width="2"';
  var NOHIT = 'pointer-events="none"';
  var MID = 'text-anchor="middle"';

  /* UV ink lives on three wall items and the floor covering. It is emitted
     by buildObject from the role, not by the part, so a new part cannot
     forget it and quietly break every tier-4 chamber. */
  function uvText(id, y, size, spacing) {
    return txt(0, y, '', 'id="' + id + '" class="uv-ink" ' + MID +
      ' font-family="Georgia" font-size="' + size + '" letter-spacing="' + spacing + '"');
  }

  /* ---------------- defs ----------------
     index.html carries `candleGlow` and `parchG`. This file deliberately
     ships its OWN ids and uses only those, so a room can be rendered into
     a bare <svg> (the screenshot harness does exactly that) without
     silently losing its light. Inject once; duplicate ids in one document
     make the second copy dead. */
  function defs() {
    return '<defs>' +
      '<radialGradient id="ecGlow" cx="50%" cy="50%" r="50%">' +
        '<stop offset="0%" stop-color="#ffd98a" stop-opacity=".5"/>' +
        '<stop offset="45%" stop-color="#e8a84c" stop-opacity=".16"/>' +
        '<stop offset="100%" stop-color="#e8a84c" stop-opacity="0"/>' +
      '</radialGradient>' +
      '<linearGradient id="ecParch" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#e9dcc0"/><stop offset="100%" stop-color="#cbb98f"/>' +
      '</linearGradient>' +
      '<linearGradient id="ecGlass" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0%" stop-color="#9fd8e8" stop-opacity=".22"/>' +
        '<stop offset="55%" stop-color="#9fd8e8" stop-opacity=".05"/>' +
        '<stop offset="100%" stop-color="#ffffff" stop-opacity=".12"/>' +
      '</linearGradient>' +
      '<linearGradient id="ecNight" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#101c34"/><stop offset="100%" stop-color="#050a14"/>' +
      '</linearGradient>' +
      '<radialGradient id="ecFire" cx="50%" cy="60%" r="50%">' +
        '<stop offset="0%" stop-color="#ffb04c" stop-opacity=".85"/>' +
        '<stop offset="100%" stop-color="#ff6a1e" stop-opacity="0"/>' +
      '</radialGradient>' +
      '</defs>';
  }

  /* ---------------- roles and anchors ----------------
     Seven searchable slots, kept conceptually intact from the original
     game — a chamber is still "one of seven places hides the key" — but
     the seven are now described by what they AFFORD, so a prison can fill
     them with a bunk and a drain grate rather than a rug and a pot plant.

     floorSoft   underfoot, you lift it            (rug)
     floorProp   a low thing standing on the floor (plant)
     wallSmall   a small round wall fixture        (clock)
     wallMid     a mid-size wall piece             (pB)
     wallLarge   the big wall panel                (pA)
     storage     open storage with contents        (shelf)
     container   a closed thing with a lid         (chest)

     Four locks and one light complete the room. */
  var ROLES = {
    floorSoft: 'rug', floorProp: 'plant', wallSmall: 'clock', wallMid: 'pB',
    wallLarge: 'pA', storage: 'shelf', container: 'chest',
    exit: 'door', lockSmall: 'drawer', lockCode: 'safe', lockCrank: 'cab',
    anchor: 'bench', light: 'candleG'
  };
  var SEARCH_ROLES = ['floorSoft', 'floorProp', 'wallSmall', 'wallMid',
                      'wallLarge', 'storage', 'container'];
  var SEARCH_IDS = ['rug', 'plant', 'clock', 'pA', 'pB', 'shelf', 'chest'];

  /* Anchor points, in viewBox coordinates. Taken from the original art's
     real geometry — see the header note about layoutFor(). */
  var ANCHORS = {
    rug:    { x: 330, y: 540 },   // bottom of the floor covering
    plant:  { x: 78,  y: 504 },   // bottom-centre
    safe:   { x: 175, y: 510 },
    chest:  { x: 540, y: 508 },
    pA:     { x: 234, y: 161 },   // centre
    pB:     { x: 414, y: 142 },
    clock:  { x: 500, y: 140 },
    shelf:  { x: 434, y: 234 },
    door:   { x: 696, y: 400 },   // bottom-centre
    cab:    { x: 566, y: 400 },
    bench:  { x: 268, y: 430 },
    drawer: { x: 268, y: 365 },   // centre
    candleG:{ x: 352, y: 320 }
  };

  /* =====================================================================
     THE VOCABULARY
     ---------------------------------------------------------------------
     Each part is a function of an options bag and returns SVG markup in
     local coordinates. Options are how one part serves several settings:
     `crate` is a dynamite box in the mine and a cog bin in the clockworks
     because the plank colour is data.

     Local bounding boxes, matched to the old art so nothing collides:
       floorSoft  x -126..126  y -76..0      floorProp  x -34..34  y -112..0
       wallLarge  x -106..106  y -73..73     wallMid    x -52..52  y -44..44
       wallSmall  r 36                       storage    x -76..76  y -24..24
       container  x -60..60    y -76..0      exit       x -70..70  y -282..0
       lockCode   x -49..49    y -78..0      lockCrank  x -38..38  y -198..0
       anchor     x -150..150  y -110..0     lockSmall  x -70..70  y -21..21
     ===================================================================== */
  var PARTS = {};

  /* ---- floorSoft: the thing you look under ---- */

  PARTS.persianRug = function (o) {
    return ell(0, -38, 126, 38, 'fill="' + (o.fill || '#5e2f3a') + '" stroke="' + (o.edge || '#3d1e26') + '" stroke-width="4"') +
      ell(0, -38, 90, 25, 'fill="none" stroke="' + (o.trim || '#8a4a58') + '" stroke-width="3" stroke-dasharray="10 8"') +
      ell(0, -38, 46, 13, 'fill="none" stroke="' + (o.trim || '#8a4a58') + '" stroke-width="2" stroke-opacity=".7"');
  };

  /* A straw pallet, not a rug: square corners, sagging ticking stripes and
     loose straw spilling out of the end. The silhouette has to be wrong
     for a drawing room or the prison reads as a drawing room. */
  PARTS.mattress = function (o) {
    var s = pth('M-104 -8 l14 -54 h180 l14 54 z',
      'fill="' + (o.fill || '#8d8261') + '" ' + K3);
    var i, str = '';
    for (i = -70; i <= 70; i += 28) {
      str += ln(i, -14, i + 6, -56, 'stroke="#6d6349" stroke-width="4" stroke-opacity=".8"');
    }
    /* Loose straw. Three strokes is enough to say "not a mattress you
       would want" without turning into texture noise at phone size. */
    str += pth('M92 -14 l22 -6 M94 -22 l24 -14 M90 -30 l18 -18',
      'stroke="#c8b063" stroke-width="3" stroke-linecap="round" fill="none"');
    return s + str + pth('M-104 -8 h208', 'stroke="black" stroke-opacity=".45" stroke-width="3"');
  };

  /* Coiled rope, seen from above. Reads instantly as shipboard. */
  PARTS.ropeCoil = function (o) {
    var c = o.fill || '#b39a6a', out = '';
    var i;
    for (i = 0; i < 5; i++) {
      out += ell(0, -34, 108 - i * 21, 33 - i * 6.4,
        'fill="none" stroke="' + c + '" stroke-width="9" stroke-opacity="' + (0.95 - i * 0.06) + '"');
    }
    return ell(0, -34, 118, 37, 'fill="black" fill-opacity=".28"') + out +
      pth('M-112 -30 q-24 6 -30 22', 'fill="none" stroke="' + c + '" stroke-width="8" stroke-linecap="round"');
  };

  /* A woven mat — reed, coir, oiled canvas or tarpaulin depending on the
     colours passed in. Rectangular with a frayed edge, so it never gets
     mistaken for the Persian rug. */
  PARTS.flatMat = function (o) {
    var out = pth('M-118 -4 l10 -60 h216 l10 60 z',
      'fill="' + (o.fill || '#7a6a44') + '" ' + K3);
    var i;
    for (i = -96; i <= 96; i += 24) {
      out += ln(i, -8, i + 4, -60, 'stroke="' + (o.weave || '#5d5133') + '" stroke-width="3" stroke-opacity=".85"');
    }
    for (i = -50; i >= -60; i -= 10) {
      out += ln(-112, i, 112, i, 'stroke="' + (o.weave || '#5d5133') + '" stroke-width="2" stroke-opacity=".6"');
    }
    return out;
  };

  /* Zodiac inlay set into the observatory floor — brass rings and glyph
     ticks rather than fabric. */
  PARTS.zodiacInlay = function (o) {
    var c = o.line || '#c8a24e', out = ell(0, -34, 116, 36, 'fill="#171a2c" stroke="' + c + '" stroke-width="3"');
    out += ell(0, -34, 86, 27, 'fill="none" stroke="' + c + '" stroke-width="2" stroke-opacity=".8"');
    out += ell(0, -34, 44, 14, 'fill="none" stroke="' + c + '" stroke-width="2" stroke-opacity=".6"');
    var i;
    for (i = 0; i < 12; i++) {
      var a = i * Math.PI / 6;
      out += ln((86 * Math.cos(a)).toFixed(1), (-34 + 27 * Math.sin(a)).toFixed(1),
                (110 * Math.cos(a)).toFixed(1), (-34 + 34 * Math.sin(a)).toFixed(1),
                'stroke="' + c + '" stroke-width="2" stroke-opacity=".75"');
    }
    return out;
  };

  /* A lift-out steel deck plate. Diamond tread, four corner bolts. */
  PARTS.treadPlate = function (o) {
    var out = pth('M-116 -4 l8 -62 h216 l8 62 z',
      'fill="' + (o.fill || '#4a4643') + '" ' + K3);
    var i, j;
    for (i = -100; i <= 100; i += 26) {
      for (j = -14; j >= -58; j -= 22) {
        out += pth('M' + i + ' ' + j + ' l7 -5 l7 5 l-7 5 z',
          'fill="#6b6560" fill-opacity=".8"');
      }
    }
    for (i = -96; i <= 96; i += 192) {
      out += circ(i, -12, 4, 'fill="#241f1c"') + circ(i * 0.92, -58, 4, 'fill="#241f1c"');
    }
    return out;
  };

  /* Lab spill tray: a shallow stainless bund with a grid grating. */
  PARTS.spillTray = function (o) {
    var out = pth('M-110 -6 l10 -52 h200 l10 52 z', 'fill="#3d4a4d" ' + K3);
    var i;
    for (i = -92; i <= 92; i += 18) out += ln(i, -10, i + 3, -54, 'stroke="#6e8286" stroke-width="3"');
    for (i = -14; i >= -52; i -= 13) out += ln(-104, i, 104, i, 'stroke="#6e8286" stroke-width="2.5"');
    return out + pth('M-110 -6 h220', 'stroke="black" stroke-opacity=".5" stroke-width="3"');
  };

  /* ---- floorProp: a low thing standing on the floor ---- */

  PARTS.pottedFern = function (o) {
    return pth('M0 0 q-34 -30 -22 -78 q26 22 26 62 M0 0 q4 -52 40 -66 q-6 44 -34 68 M0 0 q-2 -36 -2 -60',
      'fill="none" stroke="' + (o.leaf || '#4a7a4a') + '" stroke-width="7" stroke-linecap="round"') +
      pth('M-22 -2 h44 l-6 -36 h-32 z', 'fill="' + (o.pot || '#8a4a34') + '" ' + K3 +
        ' transform="scale(1,-1)"');
  };

  /* Tin slop pail, dented, with a wire handle. */
  PARTS.slopBucket = function (o) {
    return pth('M-26 0 l6 -46 h40 l6 46 z', 'fill="' + (o.fill || '#6c7370') + '" ' + K3) +
      ell(0, -46, 26, 7, 'fill="' + (o.rim || '#8d9490') + '" ' + K2) +
      ell(0, -46, 19, 4.6, 'fill="#101312"') +
      pth('M-26 -46 q26 -34 52 0', 'fill="none" stroke="#3c4240" stroke-width="4"') +
      pth('M-8 -30 l10 8 l-4 10', 'fill="none" stroke="black" stroke-opacity=".35" stroke-width="3"');
  };

  /* Oak cask on its side in a cradle. */
  PARTS.barrel = function (o) {
    var w = o.fill || '#7a5326';
    return rect(-30, -62, 60, 62, 'rx="12" fill="' + w + '" ' + K3) +
      rect(-33, -54, 66, 8, 'fill="#5a4a3a" fill-opacity=".9"') +
      rect(-33, -22, 66, 8, 'fill="#5a4a3a" fill-opacity=".9"') +
      ell(0, -62, 30, 9, 'fill="' + (o.top || '#96682f') + '" ' + K2) +
      circ(0, -62, 6, 'fill="#2a1d10"');
  };

  /* Canopic jar: a jackal-headed lid on a pale alabaster body. */
  PARTS.canopicJar = function (o) {
    return pth('M-24 0 q-6 -46 8 -60 h32 q14 14 8 60 z', 'fill="' + (o.body || '#d9c48d') + '" ' + K3) +
      pth('M-18 -60 q18 -16 36 0 z', 'fill="' + (o.lid || '#b08a3c') + '" ' + K2) +
      pth('M0 -60 q-14 -6 -12 -26 l6 -12 l6 10 l6 -10 l6 12 q2 20 -12 26 z',
        'fill="' + (o.lid || '#b08a3c') + '" ' + K2) +
      circ(-4, -84, 2.4, 'fill="#1a1208"') + circ(4, -84, 2.4, 'fill="#1a1208"') +
      pth('M-16 -30 h32 M-16 -18 h32', 'stroke="#8a7038" stroke-width="2.5" fill="none"');
  };

  /* Gas cylinder, chained to the wall. Reads laboratory at a glance. */
  PARTS.gasCylinder = function (o) {
    return rect(-19, -96, 38, 96, 'rx="6" fill="' + (o.fill || '#3f6f5e') + '" ' + K3) +
      rect(-19, -66, 38, 12, 'fill="' + (o.band || '#d8d2c4') + '" fill-opacity=".85"') +
      rect(-8, -112, 16, 18, 'fill="#8d9498" ' + K2) +
      circ(0, -116, 8, 'fill="none" stroke="#b6bec2" stroke-width="4"') +
      pth('M-22 -40 q22 10 44 0', 'fill="none" stroke="#6a7276" stroke-width="4"');
  };

  /* Clock weight on its chain — a lead drum hanging clear of the floor. */
  PARTS.weightDrum = function (o) {
    return ln(0, -112, 0, -62, 'stroke="#6b6154" stroke-width="4" stroke-dasharray="5 4"') +
      rect(-22, -62, 44, 58, 'rx="4" fill="' + (o.fill || '#57544e') + '" ' + K3) +
      rect(-22, -50, 44, 7, 'fill="#7d7970" fill-opacity=".7"') +
      rect(-22, -22, 44, 7, 'fill="#7d7970" fill-opacity=".7"') +
      ell(0, -4, 26, 6, 'fill="black" fill-opacity=".3"');
  };

  /* Library globe on a meridian ring. */
  PARTS.globeStand = function (o) {
    return pth('M-16 0 h32 l-8 -22 h-16 z', 'fill="' + (o.wood || '#5a3d22') + '" ' + K3) +
      ln(0, -22, 0, -34, 'stroke="' + (o.wood || '#5a3d22') + '" stroke-width="6"') +
      circ(0, -68, 34, 'fill="' + (o.globe || '#3a5f6e') + '" ' + K3) +
      pth('M-28 -78 q18 10 30 -2 q14 -12 26 -2 M-22 -56 q20 12 44 -4 M-8 -96 q10 8 4 18',
        'fill="none" stroke="' + (o.land || '#7d9a5c') + '" stroke-width="5" stroke-linecap="round"') +
      pth('M-38 -68 a38 38 0 0 0 76 0', 'fill="none" stroke="' + (o.ring || '#c9a24e') + '" stroke-width="4"');
  };

  /* Orrery: sun, three arms, three planets. */
  PARTS.orrery = function (o) {
    var c = o.brass || '#c9a24e';
    return pth('M-18 0 h36 l-9 -20 h-18 z', 'fill="#3a3550" ' + K3) +
      ln(0, -20, 0, -54, 'stroke="' + c + '" stroke-width="5"') +
      ell(0, -54, 46, 12, 'fill="none" stroke="' + c + '" stroke-width="2.5" stroke-opacity=".8"') +
      ell(0, -54, 28, 7.5, 'fill="none" stroke="' + c + '" stroke-width="2.5" stroke-opacity=".8"') +
      circ(0, -60, 9, 'fill="#ffd98a"') +
      circ(-46, -54, 5, 'fill="#7fb8ff"') + circ(28, -50, 4, 'fill="#c98a5e"') +
      circ(14, -62, 3.4, 'fill="#e6e0c8"');
  };

  /* Heaped coal with a shovel stuck in it. */
  PARTS.coalHeap = function (o) {
    var out = pth('M-38 0 q10 -40 38 -44 q30 4 38 44 z', 'fill="' + (o.fill || '#26211f') + '" ' + K3);
    var pts = [[-20, -14], [-4, -26], [12, -16], [22, -30], [-14, -34], [4, -40]];
    var i;
    for (i = 0; i < pts.length; i++) {
      out += pth('M' + pts[i][0] + ' ' + pts[i][1] + ' l7 -5 l6 6 l-6 6 z',
        'fill="#4a4340" fill-opacity=".9"');
    }
    return out + ln(26, -8, 40, -76, 'stroke="#7a6248" stroke-width="5"') +
      pth('M34 -76 l16 -6 l4 14 l-16 6 z', 'fill="#8d9498" ' + K2);
  };

  /* Ore bucket, wire bail, a heap of glinting rock. */
  PARTS.oreBucket = function (o) {
    return pth('M-28 0 l5 -44 h46 l5 44 z', 'fill="' + (o.fill || '#4e4a44') + '" ' + K3) +
      ell(0, -44, 28, 7, 'fill="#2a2622"') +
      pth('M-16 -46 q6 -10 16 -9 q12 -1 16 9 z', 'fill="' + (o.ore || '#8a6a34') + '"') +
      circ(-6, -50, 3.4, 'fill="#d8b45c"') + circ(8, -52, 2.8, 'fill="#d8b45c"') +
      pth('M-28 -44 q28 -32 56 0', 'fill="none" stroke="#2f2b27" stroke-width="4"');
  };

  /* ---- wallSmall: the small round fixture ---- */

  PARTS.clockFace = function (o) {
    return circ(0, 0, 36, 'class="fFloorB" ' + K5) +
      circ(0, 0, 27, 'fill="url(#ecParch)"') +
      ln(0, 0, 0, -18, 'stroke="#3a2a1a" stroke-width="3" stroke-linecap="round"') +
      ln(0, 0, 13, 6, 'stroke="#3a2a1a" stroke-width="3" stroke-linecap="round"') +
      circ(0, 0, 3, 'fill="#3a2a1a"');
  };

  /* A dented tin cup on an iron nail-ledge. Small, mean and specific —
     this is the object that tells a player which room they are in. */
  PARTS.tinCup = function (o) {
    return rect(-30, 14, 60, 7, 'rx="2" fill="#4d5451" ' + K2) +
      pth('M-14 14 l3 -30 h22 l3 30 z', 'fill="' + (o.fill || '#9aa29e') + '" ' + K3) +
      ell(0, -16, 14, 4, 'fill="#c3ccc7"') +
      pth('M14 -12 q14 4 0 18', 'fill="none" stroke="#7c8480" stroke-width="4"') +
      pth('M-6 4 l6 -6', 'stroke="black" stroke-opacity=".35" stroke-width="3"') +
      circ(-24, 10, 2.6, 'fill="#2b2f2d"') + circ(24, 10, 2.6, 'fill="#2b2f2d"');
  };

  /* Brass porthole with the sea behind it. */
  PARTS.porthole = function (o) {
    var b = o.brass || '#c99a3f', out = circ(0, 0, 36, 'fill="' + b + '" ' + K5);
    out += circ(0, 0, 26, 'fill="#12303a"');
    out += pth('M-26 6 q9 -7 17 0 q9 7 18 0 q9 -7 17 0 l0 12 a26 26 0 0 1 -52 0 z',
      'fill="#1d5566" fill-opacity=".9"');
    out += circ(-9, -10, 7, 'fill="#ffffff" fill-opacity=".12"');
    var i;
    for (i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      out += circ((31 * Math.cos(a)).toFixed(1), (31 * Math.sin(a)).toFixed(1), 3, 'fill="#8a6a26"');
    }
    return out;
  };

  /* Carved sun disc, tomb-style: rayed circle with a scarab in the middle. */
  PARTS.sunDisc = function (o) {
    var c = o.stone || '#c9ab6d', out = '';
    var i;
    for (i = 0; i < 16; i++) {
      var a = i * Math.PI / 8;
      out += ln((26 * Math.cos(a)).toFixed(1), (26 * Math.sin(a)).toFixed(1),
                (36 * Math.cos(a)).toFixed(1), (36 * Math.sin(a)).toFixed(1),
                'stroke="' + c + '" stroke-width="4"');
    }
    return circ(0, 0, 26, 'fill="' + c + '" ' + K4) + out +
      ell(0, 2, 11, 13, 'fill="#8a6a2c"') +
      pth('M-11 -2 q11 -10 22 0 M0 -11 v26', 'fill="none" stroke="#5d4718" stroke-width="2.5"');
  };

  /* Pressure gauge: white dial, red zone, needle. Serves lab, boiler and
     mine — three settings, one part, different bezels. */
  PARTS.gauge = function (o) {
    var b = o.bezel || '#8d9498';
    return circ(0, 0, 36, 'fill="' + b + '" ' + K5) +
      circ(0, 0, 27, 'fill="#e6e2d6"') +
      pth('M19 -19 a27 27 0 0 1 8 19 l-9 0 a18 18 0 0 0 -5 -13 z', 'fill="#b4342e"') +
      ln(0, 0, -14, -14, 'stroke="#1c1c1c" stroke-width="3.5" stroke-linecap="round"') +
      circ(0, 0, 3.4, 'fill="#1c1c1c"') +
      pth('M-19 8 h6 M19 8 h-6 M0 -22 v6', 'stroke="#1c1c1c" stroke-width="2.5"');
  };

  /* Greenhouse thermometer-hygrometer: two small dials on one plate. */
  PARTS.thermoDial = function (o) {
    return rect(-34, -30, 68, 60, 'rx="6" fill="' + (o.plate || '#cfd6c4') + '" ' + K4) +
      circ(-14, -8, 14, 'fill="#f2f0e2" ' + K2) + circ(14, 12, 14, 'fill="#f2f0e2" ' + K2) +
      ln(-14, -8, -6, -18, 'stroke="#b4342e" stroke-width="2.5"') +
      ln(14, 12, 22, 4, 'stroke="#2a5fa0" stroke-width="2.5"') +
      rect(-30, 16, 24, 6, 'fill="#8fa07c" fill-opacity=".8"');
  };

  /* Sidereal dial — a star-marked ring with a pointer. */
  PARTS.siderealDial = function (o) {
    var c = o.brass || '#c9a24e', out = circ(0, 0, 36, 'fill="#141c33" stroke="' + c + '" stroke-width="4"');
    out += circ(0, 0, 25, 'fill="none" stroke="' + c + '" stroke-width="2" stroke-opacity=".7"');
    var i;
    for (i = 0; i < 12; i++) {
      var a = i * Math.PI / 6;
      out += ln((25 * Math.cos(a)).toFixed(1), (25 * Math.sin(a)).toFixed(1),
                (33 * Math.cos(a)).toFixed(1), (33 * Math.sin(a)).toFixed(1),
                'stroke="' + c + '" stroke-width="2"');
    }
    return out + txt(0, 6, '✦', MID + ' font-size="20" fill="#b8dcff"') +
      ln(0, 0, 16, -14, 'stroke="' + c + '" stroke-width="3" stroke-linecap="round"');
  };

  /* ---- wallMid ---- */

  PARTS.portrait = function (o) {
    return rect(-52, -44, 104, 88, 'rx="4" class="fFloorB" ' + K5) +
      rect(-42, -34, 84, 68, 'fill="' + (o.ground || '#20293e') + '"') +
      circ(0, -10, 14, 'fill="#c9b490"') +
      pth('M-20 34 q20 -26 40 0 z', 'fill="' + (o.coat || '#3a3350') + '"');
  };

  /* Tally scratches. Not a picture at all — raw marks gouged into the
     wall, five-barred, uneven, with a stub of chalk on the ledge below.
     Deliberately the ugliest thing in the vocabulary. */
  PARTS.tallyMarks = function (o) {
    var c = o.chalk || '#d9d6c8', out = '';
    var groups = [[-46, 5], [-14, 5], [18, 4], [-40, 5], [-8, 3]];
    var i, j, gy;
    for (i = 0; i < groups.length; i++) {
      gy = i < 3 ? -26 : 8;
      var gx = groups[i][0], n = groups[i][1];
      for (j = 0; j < n; j++) {
        out += ln(gx + j * 5, gy - 14, gx + j * 5 + 2, gy + 14,
          'stroke="' + c + '" stroke-width="2.6" stroke-opacity="' + (0.7 + (j % 3) * 0.1) + '"');
      }
      if (n === 5) out += ln(gx - 3, gy + 8, gx + 22, gy - 10, 'stroke="' + c + '" stroke-width="2.6"');
    }
    return out + pth('M-52 32 h104', 'stroke="black" stroke-opacity=".3" stroke-width="2"') +
      rect(34, 24, 10, 6, 'rx="2" fill="' + c + '" fill-opacity=".8"');
  };

  /* Knot board — five hitches pinned to a plank, ship's-cabin standard. */
  PARTS.knotBoard = function (o) {
    var r = o.rope || '#c8b183';
    return rect(-52, -40, 104, 80, 'rx="3" fill="' + (o.wood || '#4a3520') + '" ' + K4) +
      pth('M-36 -20 q10 -14 20 0 q-10 14 -20 0 z', 'fill="none" stroke="' + r + '" stroke-width="4"') +
      pth('M0 -26 q14 6 0 16 q-14 -10 0 -16', 'fill="none" stroke="' + r + '" stroke-width="4"') +
      pth('M26 -26 a10 10 0 1 0 .1 0 M26 -16 l10 10', 'fill="none" stroke="' + r + '" stroke-width="4"') +
      pth('M-32 14 q16 -10 30 0 q-16 12 -30 0 M8 8 q14 12 26 0',
        'fill="none" stroke="' + r + '" stroke-width="4"');
  };

  /* Carved stela with a cartouche. */
  PARTS.stela = function (o) {
    var s = o.stone || '#c2a468';
    return pth('M-46 44 v-64 q46 -34 92 0 v64 z', 'fill="' + s + '" ' + K4) +
      pth('M-30 -6 q30 -14 60 0 q-6 26 -30 30 q-24 -4 -30 -30 z',
        'fill="none" stroke="#6a5324" stroke-width="3"') +
      pth('M-16 -14 h6 v10 h-6 z M-4 -16 l10 6 l-10 6 z M12 -14 q8 6 0 12',
        'fill="none" stroke="#6a5324" stroke-width="3"') +
      pth('M-24 20 h48', 'stroke="#6a5324" stroke-width="3"');
  };

  /* X-ray lightbox with two plates clipped to it. */
  PARTS.lightbox = function (o) {
    return rect(-52, -40, 104, 80, 'rx="4" fill="#2c3a3e" ' + K4) +
      rect(-44, -32, 88, 64, 'fill="#cfe8ef" fill-opacity=".78"') +
      pth('M-30 26 q8 -46 14 -54 M-2 26 q10 -40 4 -54 M20 26 q-6 -34 6 -52',
        'fill="none" stroke="#4a6a74" stroke-width="3" stroke-opacity=".7"') +
      ell(-8, -6, 16, 20, 'fill="#7fa8b4" fill-opacity=".5"') +
      rect(-44, -36, 88, 5, 'fill="#8d9498"');
  };

  /* The escapement: anchor, escape wheel, and a swinging pendulum rod. */
  PARTS.escapement = function (o) {
    var b = o.brass || '#c9973f', out = rect(-52, -44, 104, 88, 'rx="4" fill="#2a2014" ' + K4);
    out += circ(-14, -4, 24, 'fill="none" stroke="' + b + '" stroke-width="3"');
    var i;
    for (i = 0; i < 14; i++) {
      var a = i * Math.PI / 7;
      out += ln((-14 + 24 * Math.cos(a)).toFixed(1), (-4 + 24 * Math.sin(a)).toFixed(1),
                (-14 + 31 * Math.cos(a)).toFixed(1), (-4 + 31 * Math.sin(a)).toFixed(1),
                'stroke="' + b + '" stroke-width="3"');
    }
    return out + pth('M-14 -38 l24 24 l-8 10 M-14 -38 l-22 24 l8 10',
      'fill="none" stroke="#e0c07a" stroke-width="4"') +
      ln(28, -40, 28, 26, 'stroke="' + b + '" stroke-width="3"') +
      circ(28, 32, 9, 'fill="' + b + '" ' + K2);
  };

  /* A board of seed packets, hand-labelled. */
  PARTS.seedBoard = function (o) {
    var out = rect(-52, -40, 104, 80, 'rx="3" fill="' + (o.wood || '#4c3f26') + '" ' + K4);
    var cols = ['#d8cfa8', '#c8d8a8', '#e0c9a0', '#cfd8c0', '#dcc8b0', '#c9d0e0'];
    var i;
    for (i = 0; i < 6; i++) {
      var x = -44 + (i % 3) * 30, y = -32 + Math.floor(i / 3) * 38;
      out += rect(x, y, 26, 32, 'rx="2" fill="' + cols[i] + '" ' + K2);
      out += ln(x + 4, y + 8, x + 22, y + 8, 'stroke="#6a6048" stroke-width="2"');
      out += ln(x + 4, y + 14, x + 18, y + 14, 'stroke="#6a6048" stroke-width="2"');
      out += circ(x + 13, y + 23, 5, 'fill="#7d9a5c" fill-opacity=".8"');
    }
    return out;
  };

  /* A miners' notice board: claim papers, a nail, a curled corner. */
  PARTS.noticeBoard = function (o) {
    return rect(-52, -40, 104, 80, 'rx="3" fill="' + (o.wood || '#3d2f1e') + '" ' + K4) +
      rect(-40, -30, 44, 54, 'fill="#d9cba6" ' + K2 + ' transform="rotate(-4)"') +
      rect(4, -22, 38, 44, 'fill="#c8b894" ' + K2 + ' transform="rotate(5)"') +
      pth('M-34 -16 h32 M-34 -8 h28 M-34 0 h32 M-34 8 h20',
        'stroke="#7a6a48" stroke-width="2.5"') +
      pth('M10 -12 h26 M10 -4 h22 M10 4 h26', 'stroke="#8a7a58" stroke-width="2.5"') +
      circ(-18, -30, 3.4, 'fill="#8d9498"') + circ(22, -20, 3.4, 'fill="#8d9498"');
  };

  /* Astrolabe: rings, a rete, an alidade. */
  PARTS.astrolabe = function (o) {
    var c = o.brass || '#c9a24e';
    return circ(0, 0, 42, 'fill="#101a2e" stroke="' + c + '" stroke-width="4"') +
      circ(0, 0, 32, 'fill="none" stroke="' + c + '" stroke-width="2.5"') +
      circ(0, 0, 20, 'fill="none" stroke="' + c + '" stroke-width="2.5"') +
      pth('M-32 0 h64 M0 -32 v64', 'stroke="' + c + '" stroke-width="2" stroke-opacity=".8"') +
      pth('M-26 -18 q26 -16 52 4', 'fill="none" stroke="#e6cf92" stroke-width="3"') +
      ln(-28, 22, 28, -22, 'stroke="#e6cf92" stroke-width="3.5" stroke-linecap="round"') +
      circ(0, 0, 4, 'fill="' + c + '"');
  };

  /* A big cast valve wheel bolted to the wall, with its spindle. */
  PARTS.valveWheel = function (o) {
    var c = o.iron || '#7a4a32', out = circ(0, 0, 40, 'fill="none" stroke="' + c + '" stroke-width="9"');
    var i;
    for (i = 0; i < 6; i++) {
      var a = i * Math.PI / 3;
      out += ln(0, 0, (36 * Math.cos(a)).toFixed(1), (36 * Math.sin(a)).toFixed(1),
        'stroke="' + c + '" stroke-width="6"');
    }
    return rect(-10, -44, 20, 88, 'fill="#3a2f2a" fill-opacity=".55"') + out +
      circ(0, 0, 10, 'fill="' + c + '" ' + K2) +
      rect(-26, 34, 52, 10, 'rx="3" fill="#4a3a32" ' + K2);
  };

  /* ---- wallLarge: the big panel ---- */

  PARTS.oldMap = function (o) {
    return rect(-106, -73, 212, 146, 'rx="4" class="fFloorB" ' + K5) +
      rect(-93, -60, 186, 120, 'fill="url(#ecParch)"') +
      pth('M-76 29 q26 -46 60 -34 q30 10 47 -15 q21 -30 55 -17',
        'fill="none" stroke="#8a6b3f" stroke-width="3" stroke-linecap="round"') +
      pth('M-64 -16 q34 19 77 7 q42 -12 72 17',
        'fill="none" stroke="#a5854f" stroke-width="2" stroke-dasharray="5 6"') +
      circ(-52, 39, 4, 'fill="#9a2f2f"') + circ(58, -33, 4, 'fill="#9a2f2f"');
  };

  /* A barred window onto a night sky. The single most load-bearing object
     in the set: it is what makes the cell a cell. Bars are drawn OVER the
     sky and over the sill, and the sky is a real gradient so it does not
     read as another framed picture. */
  PARTS.barredWindow = function (o) {
    var out = rect(-106, -73, 212, 146, 'rx="3" fill="' + (o.frame || '#2f3a36') + '" ' + K5);
    out += rect(-92, -59, 184, 118, 'fill="url(#ecNight)"');
    out += circ(52, -30, 17, 'fill="#dfe6ef" fill-opacity=".8"');
    out += circ(45, -34, 15, 'fill="url(#ecNight)"');
    var stars = [[-60, -40], [-24, -50], [10, -22], [-70, -8], [-38, 6], [72, 8], [24, -46]];
    var i;
    for (i = 0; i < stars.length; i++) {
      out += circ(stars[i][0], stars[i][1], 1.8, 'fill="#dfe6ef" fill-opacity=".85"');
    }
    /* Five bars and two straps. Odd count on purpose — an even one centres
       a gap and the eye reads it as a window frame, not as bars. */
    for (i = -70; i <= 70; i += 35) {
      out += rect(i - 5, -62, 10, 124, 'rx="2" fill="' + (o.bar || '#1a1f1d') + '" stroke="#4a5450" stroke-width="1.5"');
    }
    out += rect(-92, -18, 184, 8, 'fill="' + (o.bar || '#1a1f1d') + '" fill-opacity=".95"');
    out += rect(-100, 56, 200, 14, 'rx="3" fill="' + (o.sill || '#3d4a45') + '" ' + K3);
    return out;
  };

  /* Pinned sea chart: parchment, coastline, rhumb lines, compass rose. */
  PARTS.seaChart = function (o) {
    var out = rect(-100, -68, 200, 136, 'rx="2" fill="url(#ecParch)" ' + K4);
    out += pth('M-88 34 q30 -22 44 -4 q18 24 44 4 q22 -18 48 6 l0 30 l-136 0 z',
      'fill="#b8a878" fill-opacity=".7" stroke="#7a6a44" stroke-width="2.5"');
    var i;
    for (i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      out += ln(30, -22, (30 + 96 * Math.cos(a)).toFixed(1), (-22 + 96 * Math.sin(a)).toFixed(1),
        'stroke="#a5854f" stroke-width="1.2" stroke-opacity=".6"');
    }
    out += pth('M30 -46 l7 20 l20 4 l-20 4 l-7 20 l-7 -20 l-20 -4 l20 -4 z',
      'fill="#8a6b3f"');
    out += pth('M-70 -50 q20 8 12 26 q-16 6 -22 -10 q-2 -14 10 -16 z',
      'fill="#b8a878" fill-opacity=".7" stroke="#7a6a44" stroke-width="2.5"');
    return out;
  };

  /* Hieroglyph slab: three registers of glyphs and a cartouche. */
  PARTS.glyphPanel = function (o) {
    var s = o.stone || '#bfa066';
    var out = rect(-106, -73, 212, 146, 'fill="' + s + '" ' + K5);
    out += rect(-96, -63, 192, 126, 'fill="none" stroke="#6a5324" stroke-width="3"');
    var g = ['M0 0 h10 v14 h-10 z', 'M0 12 l7 -12 l7 12 z', 'M0 6 q7 -12 14 0 q-7 12 -14 0 z',
             'M0 0 h14 M7 0 v14', 'M0 14 q7 -16 14 0', 'M2 0 v14 M2 7 h10 l-3 -5',
             'M0 2 h14 v10 h-14 z M4 6 h6'];
    var i, r, c;
    for (r = 0; r < 3; r++) {
      for (c = 0; c < 9; c++) {
        i = (r * 9 + c) % g.length;
        out += pth(g[i], 'fill="none" stroke="#7a5f28" stroke-width="3" transform="translate(' +
          (-86 + c * 20) + ',' + (-50 + r * 30) + ')"');
      }
    }
    out += pth('M-52 22 q52 -18 104 0 q-8 34 -52 40 q-44 -6 -52 -40 z',
      'fill="#a88a4e" stroke="#6a5324" stroke-width="3"');
    out += pth('M-24 32 h12 v12 h-12 z M-4 44 l8 -14 l8 14 z M20 32 q10 8 0 16',
      'fill="none" stroke="#5d4718" stroke-width="3"');
    return out;
  };

  /* A whiteboard covered in a half-erased derivation. */
  PARTS.whiteboard = function (o) {
    var out = rect(-106, -73, 212, 146, 'rx="4" fill="#8d9498" ' + K5);
    out += rect(-98, -65, 196, 122, 'fill="#e8eae6"');
    out += pth('M-84 -40 h60 M-84 -28 h84 M-84 -12 h44 M-84 0 h72 M-84 16 h36',
      'stroke="#2f6f8f" stroke-width="3" stroke-opacity=".8"');
    out += pth('M12 -12 q18 -20 36 0 q-18 20 -36 0 z M20 6 h44 M20 18 h30',
      'fill="none" stroke="#8a3a3a" stroke-width="3" stroke-opacity=".8"');
    out += rect(20, -60, 66, 30, 'fill="#cfd8dc" fill-opacity=".7"');
    out += rect(-98, 50, 196, 10, 'fill="#b6bec2"');
    out += rect(-30, 46, 22, 7, 'rx="2" fill="#b4342e"');
    return out;
  };

  /* The great gear. Teeth are generated, because 24 hand-written teeth is
     how you end up never touching the art again. */
  PARTS.giantGear = function (o) {
    var b = o.brass || '#a8763a', out = '';
    var i, n = 20;
    for (i = 0; i < n; i++) {
      var a = i * 2 * Math.PI / n;
      out += rect(-9, -80, 18, 20, 'rx="3" fill="' + b + '" ' + K2 +
        ' transform="rotate(' + (i * 360 / n) + ') translate(0,0)"');
    }
    out += circ(0, 0, 64, 'fill="' + b + '" ' + K4);
    out += circ(0, 0, 46, 'fill="' + (o.hub || '#7d5726') + '"');
    for (i = 0; i < 6; i++) {
      out += ell(0, -30, 9, 16, 'fill="#20160c" transform="rotate(' + (i * 60) + ')"');
    }
    out += circ(0, 0, 15, 'fill="' + b + '" ' + K2) + circ(0, 0, 7, 'fill="#20160c"');
    /* A second gear biting into the first, half off the panel — it turns a
       decoration into a mechanism. */
    out += circ(-92, 46, 30, 'fill="' + (o.hub || '#7d5726') + '" ' + K3);
    for (i = 0; i < 10; i++) {
      out += rect(-5, -38, 10, 12, 'rx="2" fill="' + b + '" ' +
        'transform="translate(-92,46) rotate(' + (i * 36) + ')"');
    }
    return out;
  };

  /* Trellis with a climbing vine. */
  PARTS.trellis = function (o) {
    var w = o.wood || '#8a7448', out = rect(-100, -68, 200, 136, 'fill="#1a2c22" fill-opacity=".5"');
    var i;
    for (i = -100; i <= 100; i += 25) {
      out += ln(i, -68, i - 40, 68, 'stroke="' + w + '" stroke-width="4" stroke-opacity=".9"');
      out += ln(i, -68, i + 40, 68, 'stroke="' + w + '" stroke-width="4" stroke-opacity=".9"');
    }
    out += pth('M-70 68 q18 -50 -4 -78 q26 12 30 -20 q10 26 34 4 q-6 40 22 46 q-24 20 -18 48',
      'fill="none" stroke="' + (o.vine || '#4a7a4a') + '" stroke-width="7" stroke-linecap="round"');
    var leaves = [[-52, 20], [-24, -22], [12, -40], [34, -4], [-4, 34], [46, 34]];
    for (i = 0; i < leaves.length; i++) {
      out += ell(leaves[i][0], leaves[i][1], 13, 8,
        'fill="' + (o.leaf || '#5f9a52') + '" transform="rotate(' + (i * 37 - 40) + ' ' +
        leaves[i][0] + ' ' + leaves[i][1] + ')"');
    }
    return out;
  };

  /* Glazed bookcase — book spines behind a mullioned pane. */
  PARTS.glazedCase = function (o) {
    var out = rect(-106, -73, 212, 146, 'rx="4" fill="' + (o.wood || '#3e2418') + '" ' + K5);
    out += rect(-94, -61, 188, 122, 'fill="#160e0a"');
    var cols = ['#7a4a3a', '#4a6a5a', '#8a7a3a', '#5a4a7a', '#9a4a4a', '#3a5a7a', '#7a6a4a'];
    var i, x = -88, r;
    for (r = 0; r < 2; r++) {
      x = -88;
      while (x < 84) {
        var w = 9 + (x % 4) * 2;
        out += rect(x, -56 + r * 62, w, 52 - (x % 3) * 4, 'fill="' + cols[(x + r * 3 + 100) % cols.length] + '"');
        x += w + 3;
      }
      out += rect(-94, -4 + r * 62, 188, 6, 'fill="' + (o.wood || '#3e2418') + '"');
    }
    out += rect(-94, -61, 188, 122, 'fill="url(#ecGlass)"');
    out += pth('M-24 -61 v122 M-94 -2 h188', 'stroke="' + (o.wood || '#3e2418') + '" stroke-width="6"');
    out += pth('M-80 58 l60 -110', 'stroke="#ffffff" stroke-opacity=".14" stroke-width="12"');
    return out;
  };

  /* Ore seam in the rock face, with pick marks around it. */
  PARTS.oreSeam = function (o) {
    var out = pth('M-106 -60 l40 -13 l52 8 l60 -12 l60 20 l-8 60 l-46 44 l-70 8 l-60 -30 z',
      'fill="' + (o.rock || '#3a2e20') + '" ' + K4);
    out += pth('M-84 -20 l38 -14 l30 18 l40 -10 l34 22 l-24 26 l-42 -8 l-40 14 l-36 -22 z',
      'fill="#2b2116" fill-opacity=".7"');
    out += pth('M-80 8 l30 -22 l26 12 l34 -20 l40 16',
      'fill="none" stroke="' + (o.vein || '#c8a049') + '" stroke-width="7" stroke-linecap="round"');
    out += pth('M-72 -2 l24 -18 l22 10 l30 -18 l34 14',
      'fill="none" stroke="#f0d78a" stroke-width="2.5" stroke-opacity=".8"');
    var marks = [[-60, -44], [-20, -50], [30, -44], [62, -18], [-40, 34], [24, 40]];
    var i;
    for (i = 0; i < marks.length; i++) {
      out += pth('M' + marks[i][0] + ' ' + marks[i][1] + ' l10 8 M' + (marks[i][0] + 10) +
        ' ' + marks[i][1] + ' l-10 8', 'stroke="black" stroke-opacity=".35" stroke-width="3"');
    }
    return out;
  };

  /* Star chart: constellation dots joined by faint lines. */
  PARTS.starChart = function (o) {
    var out = rect(-106, -73, 212, 146, 'rx="4" fill="#0c1striped"');
    out = rect(-106, -73, 212, 146, 'rx="4" fill="#101a2e" stroke="' + (o.frame || '#c9a24e') + '" stroke-width="5"');
    out += rect(-96, -63, 192, 126, 'fill="url(#ecNight)"');
    var pts = [[-72, -38], [-44, -50], [-18, -26], [6, -44], [34, -18], [62, -36],
               [-60, 10], [-28, 30], [4, 14], [40, 34], [70, 8], [-80, 40], [20, -6]];
    var i;
    out += pth('M-72 -38 L-44 -50 L-18 -26 L6 -44 L34 -18 L62 -36',
      'fill="none" stroke="#7fb8ff" stroke-width="1.6" stroke-opacity=".65"');
    out += pth('M-60 10 L-28 30 L4 14 L40 34 L70 8',
      'fill="none" stroke="#7fb8ff" stroke-width="1.6" stroke-opacity=".65"');
    for (i = 0; i < pts.length; i++) {
      out += circ(pts[i][0], pts[i][1], 2 + (i % 3), 'fill="#dfe9ff" fill-opacity=".9"');
    }
    out += ell(0, 0, 92, 60, 'fill="none" stroke="#c9a24e" stroke-width="2" stroke-opacity=".5"');
    return out;
  };

  /* The boiler front: riveted drum, a round firebox door with a latch, and
     a flue elbow leaving the top. */
  PARTS.boilerFront = function (o) {
    var out = rect(-106, -73, 212, 146, 'rx="14" fill="' + (o.iron || '#3f332e') + '" ' + K5);
    var i;
    for (i = -92; i <= 92; i += 23) {
      out += circ(i, -62, 3.6, 'fill="#6a5a50"') + circ(i, 62, 3.6, 'fill="#6a5a50"');
    }
    out += circ(-24, 4, 46, 'fill="' + (o.door || '#2d241f') + '" ' + K4);
    out += circ(-24, 4, 34, 'fill="#1a1310"');
    out += pth('M-58 4 a34 34 0 0 0 68 0 z', 'fill="url(#ecFire)"');
    out += ln(-24, 4, 30, -6, 'stroke="#8d7a68" stroke-width="7" stroke-linecap="round"');
    out += circ(-24, 4, 7, 'fill="#8d7a68"');
    out += rect(46, -60, 44, 52, 'rx="4" fill="#57493f" ' + K3);
    out += circ(68, -34, 13, 'fill="#e6e2d6"') +
      ln(68, -34, 60, -43, 'stroke="#1c1c1c" stroke-width="2.5"');
    out += rect(52, 22, 40, 34, 'rx="4" fill="#2a221e" ' + K3);
    out += pth('M56 30 h32 M56 40 h32 M56 50 h32', 'stroke="#6a5a50" stroke-width="3"');
    return out;
  };

  /* ---- storage: open storage with contents ---- */

  PARTS.bookShelf = function (o) {
    var out = rect(-76, 14, 152, 10, 'rx="3" class="fFloorB" ' + K3);
    var cols = o.books || ['#7a4a3a', '#4a6a5a', '#8a7a3a', '#5a4a7a', '#9a4a4a'];
    var xs = [-66, -46, -28, -8, 12, 34, 52];
    var i;
    for (i = 0; i < xs.length; i++) {
      var h = 30 + (i % 3) * 5;
      out += rect(xs[i], 14 - h, 15, h, 'fill="' + cols[i % cols.length] + '"' +
        (i === xs.length - 1 ? ' transform="rotate(8 ' + (xs[i] + 8) + ' 0)"' : ''));
    }
    return out;
  };

  /* A wall-hung iron bunk with a rolled blanket. Cantilevered off the wall
     on two chains, which is the detail that says "cell" rather than
     "shelf with a cushion on it".

     The first render of this part was a 10px pad on a 12px rail and it read
     as a plank with a cushion on it — a shelf, which is exactly the thing
     the whole file exists to stop. It needs real depth: a boxed side rail,
     a mattress thick enough to sag over the edge, and a shadow underneath
     so the eye reads it as hanging off the wall rather than lying on it. */
  PARTS.bunk = function (o) {
    var f = o.frame || '#4a534f';
    return pth('M-70 22 q70 14 140 0 l0 8 l-140 0 z', 'fill="black" fill-opacity=".35"') +
      ln(-62, -34, -62, 4, 'stroke="' + f + '" stroke-width="3" stroke-dasharray="4 3"') +
      ln(62, -34, 62, 4, 'stroke="' + f + '" stroke-width="3" stroke-dasharray="4 3"') +
      rect(-76, -22, 152, 44, 'rx="3" fill="' + (o.pad || '#8d8261') + '" ' + K3) +
      pth('M-76 -6 h152', 'stroke="black" stroke-opacity=".25" stroke-width="3"') +
      pth('M-46 -22 v44 M-16 -22 v44 M14 -22 v44 M44 -22 v44',
        'stroke="black" stroke-opacity=".22" stroke-width="3"') +
      rect(-78, 16, 156, 12, 'rx="2" fill="' + f + '" ' + K3) +
      rect(-78, -28, 156, 10, 'rx="2" fill="' + f + '" ' + K3) +
      rect(-64, -40, 50, 22, 'rx="11" fill="' + (o.blanket || '#5c5a4a') + '" ' + K2) +
      pth('M-54 -40 v22 M-42 -40 v22 M-30 -40 v22', 'stroke="black" stroke-opacity=".3" stroke-width="2"');
  };

  /* A slung hammock with rolled bedding, hooked at both ends. */
  PARTS.hammock = function (o) {
    var r = o.rope || '#c8b183', out = '';
    out += circ(-74, -18, 4, 'fill="#8d7a4a"') + circ(74, -18, 4, 'fill="#8d7a4a"');
    var i;
    for (i = -5; i <= 5; i++) {
      out += ln(i * 6, -14, -74 + (i + 5) * 0, -18, 'stroke="none"');
    }
    out += pth('M-74 -18 q20 12 40 14 M74 -18 q-20 12 -40 14',
      'fill="none" stroke="' + r + '" stroke-width="2.5"');
    out += pth('M-40 -4 q40 40 80 0 q-40 18 -80 0 z', 'fill="' + (o.cloth || '#b8a878') + '" ' + K3);
    for (i = -32; i <= 32; i += 11) {
      out += pth('M' + i + ' -2 q2 20 ' + (i > 0 ? -2 : 2) + ' 22',
        'fill="none" stroke="#8a7a54" stroke-width="2" stroke-opacity=".7"');
    }
    return out;
  };

  /* Shelf of offering urns and dishes. */
  PARTS.offeringShelf = function (o) {
    var s = o.stone || '#b39a63';
    var out = rect(-76, 12, 152, 12, 'fill="' + s + '" ' + K3);
    out += pth('M-62 12 q-8 -26 8 -30 h18 q16 4 8 30 z', 'fill="#a8763a" ' + K2);
    out += ell(-28, 6, 18, 6, 'fill="#8a6a2c" ' + K2);
    out += pth('M4 12 q-6 -20 6 -22 h12 q12 2 6 22 z', 'fill="#c9ab6d" ' + K2);
    out += pth('M40 12 v-24 h20 v24 z', 'fill="#8a6a2c" ' + K2);
    out += circ(50, -16, 7, 'fill="#d9c48d"');
    return out;
  };

  /* Rack of specimen jars, each with something unpleasant suspended. */
  PARTS.jarRack = function (o) {
    var out = rect(-76, 14, 152, 10, 'rx="2" fill="#4a5457" ' + K3);
    var tint = ['#6ec8b0', '#c8c86e', '#8ea8d8', '#c88e9e', '#9ed8c8'];
    var i;
    for (i = 0; i < 5; i++) {
      var x = -64 + i * 27, h = 30 + (i % 2) * 6;
      out += rect(x, 14 - h, 21, h, 'rx="3" fill="' + tint[i] + '" fill-opacity=".45" ' + K2);
      out += rect(x + 2, 12 - h, 17, 5, 'fill="#9aa4a8"');
      out += ell(x + 10.5, 14 - h * 0.45, 6, 8, 'fill="' + tint[i] + '" fill-opacity=".9"');
      out += ln(x + 3, 10, x + 18, 10, 'stroke="#e8eae6" stroke-width="4" stroke-opacity=".7"');
    }
    return out;
  };

  /* A rack of hanging tools — spanners, files, a pick or a saw. */
  PARTS.toolRack = function (o) {
    var m = o.metal || '#9aa2a6';
    var out = rect(-76, -22, 152, 9, 'rx="2" fill="' + (o.board || '#4a3a28') + '" ' + K3);
    out += pth('M-58 -13 v34 q-8 6 0 12 q8 -6 0 -12', 'fill="none" stroke="' + m + '" stroke-width="5"');
    out += pth('M-30 -13 v26 l-7 8 l14 0 l-7 -8', 'fill="none" stroke="' + m + '" stroke-width="5"');
    out += pth('M-2 -13 v30 M-10 17 h16', 'fill="none" stroke="' + m + '" stroke-width="5"');
    out += pth('M26 -13 v20 q-10 8 0 16 q10 -8 0 -16', 'fill="none" stroke="' + m + '" stroke-width="5"');
    out += pth('M56 -13 v14 q-16 6 -16 18 l32 0 q0 -12 -16 -18',
      'fill="none" stroke="' + m + '" stroke-width="5"');
    return out;
  };

  /* Potting shelf: seed trays with sprouting green. */
  PARTS.pottingShelf = function (o) {
    var out = rect(-76, 12, 152, 10, 'rx="2" fill="' + (o.wood || '#6a5a38') + '" ' + K3);
    var i, j;
    for (i = 0; i < 3; i++) {
      var x = -70 + i * 50;
      out += rect(x, -8, 44, 20, 'rx="2" fill="#4a3a26" ' + K2);
      for (j = 0; j < 4; j++) {
        out += pth('M' + (x + 7 + j * 10) + ' -8 q-4 -12 2 -16 q6 4 2 16',
          'fill="none" stroke="#6fae5c" stroke-width="3" stroke-linecap="round"');
      }
    }
    return out;
  };

  /* Instrument rack: a sextant, a telescope tube, two lens cells. */
  PARTS.instrumentRack = function (o) {
    var b = o.brass || '#c9a24e';
    var out = rect(-76, 14, 152, 9, 'rx="2" fill="#2a3048" ' + K3);
    out += pth('M-64 14 l22 -34 l22 34 z', 'fill="none" stroke="' + b + '" stroke-width="4"');
    out += pth('M-54 2 a26 26 0 0 1 24 0', 'fill="none" stroke="' + b + '" stroke-width="3"');
    out += rect(-8, -6, 54, 20, 'rx="9" fill="' + b + '" ' + K2);
    out += rect(38, -2, 12, 12, 'fill="#8a6a2c"');
    out += circ(60, 2, 11, 'fill="none" stroke="' + b + '" stroke-width="4"');
    out += circ(60, 2, 7, 'fill="#8fe4ff" fill-opacity=".35"');
    return out;
  };

  /* ---- container: the closed thing with a lid ----
     Every part in this role MUST emit #chestLid and #chestOpenG. */

  PARTS.woodChest = function (o) {
    var band = o.band || '';
    return rect(-60, -76, 120, 76, 'rx="8" class="fFloorB" ' + K4) +
      pth('M-60 -54 q60 -34 120 0', 'id="chestLid" class="fFloorA" ' + K4) +
      rect(-60, -54, 120, 8, 'fill="black" fill-opacity=".5"') +
      (band ? rect(-40, -76, 10, 30, 'fill="' + band + '"') + rect(30, -76, 10, 30, 'fill="' + band + '"') : '') +
      rect(-12, -58, 24, 26, 'rx="4" class="fAccent" stroke="black" stroke-opacity=".5" stroke-width="2.5"') +
      pth('M-60 -58 q60 -58 120 0 l0 6 l-120 0 z',
        'id="chestOpenG" style="display:none" class="fFloorA" ' + K4);
  };

  /* Prised-out brickwork at the foot of the wall. The "lid" is the loose
     brick itself, so opening it means the brick is OUT and a cavity shows.
     A container role does not have to be a box. */
  PARTS.looseBricks = function (o) {
    var b = o.brick || '#6b5f52', d = o.dark || '#514639';
    var out = '', i, j;
    for (j = 0; j < 4; j++) {
      for (i = 0; i < 4; i++) {
        var x = -60 + i * 31 + (j % 2 ? 15 : 0), y = -72 + j * 18;
        out += rect(x, y, 28, 15, 'rx="1" fill="' + (((i + j) % 3) ? b : d) + '" ' + K2);
      }
    }
    out += rect(-16, -40, 30, 17, 'id="chestLid" fill="' + (o.loose || '#8a7a66') + '" ' +
      'stroke="black" stroke-opacity=".6" stroke-width="3"');
    out += grp('id="chestOpenG" style="display:none"',
      rect(-16, -40, 30, 17, 'fill="#0a0908"') +
      rect(20, -22, 30, 17, 'rx="1" fill="' + (o.loose || '#8a7a66') + '" ' + K2 +
        ' transform="rotate(-8 35 -13)"'));
    return out;
  };

  /* Sarcophagus lying on the floor, lid carved with a mask. */
  PARTS.sarcophagus = function (o) {
    var s = o.stone || '#c2a468';
    return pth('M-62 0 q-6 -46 10 -60 q52 -16 104 0 q16 14 10 60 z', 'fill="#8a6a2c" ' + K4) +
      pth('M-54 -8 q-4 -40 8 -50 q46 -14 92 0 q12 10 8 50 z',
        'id="chestLid" fill="' + s + '" ' + K3) +
      grp('id="chestOpenG" style="display:none"',
        pth('M-54 -8 q-4 -40 8 -50 q46 -14 92 0 q12 10 8 50 z', 'fill="#0d0a06"') +
        pth('M-44 -6 q-4 -34 8 -42 q40 -12 78 0 q10 8 6 42 z',
          'fill="' + s + '" fill-opacity=".9" ' + K2 + ' transform="translate(24,-6) rotate(-7)"')) +
      ell(0, -42, 15, 18, 'fill="#a8763a" ' + K2) +
      pth('M-10 -46 h6 M4 -46 h6 M-6 -34 q6 6 12 0', 'stroke="#5d4718" stroke-width="2.5" fill="none"') +
      pth('M-15 -50 q15 -12 30 0', 'fill="#3a5f6e"');
  };

  /* Steel specimen case with two catches. */
  PARTS.steelCase = function (o) {
    var m = o.metal || '#5a6367';
    return rect(-60, -70, 120, 70, 'rx="6" fill="' + m + '" ' + K4) +
      rect(-60, -78, 120, 12, 'rx="4" id="chestLid" fill="#78838a" ' + K3) +
      grp('id="chestOpenG" style="display:none"',
        rect(-56, -66, 112, 20, 'fill="#0e1416"') +
        pth('M-60 -78 l0 -12 l120 0 l0 12 z', 'fill="#78838a" ' + K2 +
          ' transform="translate(0,-26)")')) +
      rect(-34, -76, 14, 12, 'rx="2" fill="#c8ced0"') + rect(20, -76, 14, 12, 'rx="2" fill="#c8ced0"') +
      rect(-22, -44, 44, 20, 'rx="3" fill="#e8eae6" fill-opacity=".85"') +
      pth('M-16 -36 h32 M-16 -30 h20', 'stroke="#4a5457" stroke-width="2.5"');
  };

  /* Slatted wooden crate. Stencil text is data so it can be DANGER in the
     mine and PARTS in the clockworks. */
  PARTS.crate = function (o) {
    var w = o.wood || '#7a5b32', out = rect(-60, -72, 120, 72, 'rx="3" fill="' + w + '" ' + K4);
    var i;
    for (i = -52; i <= 44; i += 24) out += ln(i, -70, i, -2, 'stroke="black" stroke-opacity=".3" stroke-width="3"');
    out += rect(-60, -46, 120, 8, 'fill="#5d431f" fill-opacity=".8"');
    out += pth('M-60 -72 l120 72 M60 -72 l-120 72', 'stroke="' + (o.strap || '#5d431f') + '" stroke-width="6" stroke-opacity=".55"');
    out += rect(-60, -84, 120, 14, 'rx="3" id="chestLid" fill="' + (o.lid || '#8f6c3c') + '" ' + K3);
    out += grp('id="chestOpenG" style="display:none"',
      rect(-56, -70, 112, 18, 'fill="#100c07"') +
      rect(-58, -96, 120, 14, 'rx="3" fill="' + (o.lid || '#8f6c3c') + '" ' + K2 +
        ' transform="rotate(-9 -58 -96)"'));
    if (o.stencil) {
      out += txt(0, -18, o.stencil, MID + ' font-family="Georgia" font-size="15" letter-spacing="3" fill="' +
        (o.stencilFill || '#e8d9a8') + '" fill-opacity=".8"');
    }
    return out;
  };

  /* Card catalogue: a bank of little labelled drawers. */
  PARTS.cardCatalogue = function (o) {
    var w = o.wood || '#5a3d22', out = rect(-60, -72, 120, 72, 'rx="4" fill="' + w + '" ' + K4);
    var i, j;
    for (j = 0; j < 3; j++) {
      for (i = 0; i < 4; i++) {
        var x = -55 + i * 28, y = -66 + j * 22;
        out += rect(x, y, 24, 18, 'rx="2" fill="#6d4c2c" ' + K2);
        out += rect(x + 6, y + 3, 12, 5, 'fill="#e0d3b0" fill-opacity=".8"');
        out += circ(x + 12, y + 13, 2.6, 'class="fAccent"');
      }
    }
    out += rect(-60, -84, 120, 12, 'rx="3" id="chestLid" fill="#6d4c2c" ' + K3);
    out += grp('id="chestOpenG" style="display:none"',
      rect(-40, -66, 24, 18, 'fill="#0d0906"') +
      rect(-40, -66, 30, 18, 'rx="2" fill="#6d4c2c" ' + K2 + ' transform="translate(-16,0)"'));
    return out;
  };

  /* Lens case: a fitted wooden box with round recesses. */
  PARTS.lensCase = function (o) {
    var w = o.wood || '#3a3550';
    return rect(-60, -64, 120, 64, 'rx="5" fill="' + w + '" ' + K4) +
      rect(-52, -56, 104, 48, 'fill="#1a1830"') +
      circ(-30, -32, 15, 'fill="#8fe4ff" fill-opacity=".3" stroke="#c9a24e" stroke-width="3"') +
      circ(4, -32, 12, 'fill="#8fe4ff" fill-opacity=".25" stroke="#c9a24e" stroke-width="3"') +
      circ(32, -32, 9, 'fill="#8fe4ff" fill-opacity=".2" stroke="#c9a24e" stroke-width="3"') +
      rect(-60, -76, 120, 13, 'rx="4" id="chestLid" fill="' + w + '" ' + K3) +
      grp('id="chestOpenG" style="display:none"',
        rect(-58, -74, 116, 12, 'rx="4" fill="' + w + '" ' + K2 +
          ' transform="translate(0,-16) rotate(-6 -58 -74)"'));
  };

  /* Coal bunker hatch set into the floor. */
  PARTS.coalHatch = function (o) {
    var m = o.metal || '#4a423e';
    return rect(-60, -30, 120, 30, 'rx="4" fill="' + m + '" ' + K4) +
      rect(-52, -56, 104, 26, 'rx="4" fill="#332b27" ' + K3) +
      pth('M-52 -56 h104 l-8 -16 h-88 z', 'id="chestLid" fill="' + m + '" ' + K3) +
      grp('id="chestOpenG" style="display:none"',
        rect(-48, -56, 96, 22, 'fill="#0a0806"') +
        pth('M-52 -56 h104 l-8 -16 h-88 z', 'fill="' + m + '" ' + K2 +
          ' transform="translate(0,-30) rotate(-14)"') +
        pth('M-36 -40 l10 -8 l10 8 z M0 -42 l9 -7 l9 7 z', 'fill="#5f5651"')) +
      circ(0, -16, 6, 'class="fAccent"');
  };

  /* ---- exit: the way out ----
     Every part in this role MUST emit #sigilBadge. */

  function sigilBadge() {
    return grp('id="sigilBadge" style="display:none"',
      circ(0, -200, 24, 'fill="#0b101d" stroke="#8fe4ff" stroke-width="2"') +
      txt(0, -192, '✦', MID + ' font-size="22" fill="#8fe4ff"'));
  }

  PARTS.panelDoor = function (o) {
    return rect(-70, -282, 140, 282, 'rx="6" class="fFloorA" ' + K4) +
      rect(-54, -262, 108, 112, 'rx="4" fill="none" stroke="black" stroke-opacity=".45" stroke-width="3"') +
      rect(-54, -134, 108, 118, 'rx="4" fill="none" stroke="black" stroke-opacity=".45" stroke-width="3"') +
      circ(-42, -138, 7, 'class="fAccent"') +
      rect(-46, -128, 8, 12, 'rx="2" fill="#000" fill-opacity=".7"') +
      sigilBadge();
  };

  /* A barred cell gate. You can see the corridor through it, which is
     exactly the point: the way out is visible and unreachable. */
  PARTS.barDoor = function (o) {
    var f = o.frame || '#2b3330', out = rect(-70, -282, 140, 282, 'rx="4" fill="#080b0a" ' + K4);
    var i;
    for (i = -70; i <= 70; i += 20) {
      out += rect(i - 5, -274, 10, 266, 'rx="2" fill="' + (o.bar || '#39423e') + '" stroke="#151a18" stroke-width="1.5"');
    }
    out += rect(-70, -250, 140, 11, 'fill="' + (o.bar || '#39423e') + '" ' + K2);
    out += rect(-70, -120, 140, 11, 'fill="' + (o.bar || '#39423e') + '" ' + K2);
    out += rect(-70, -282, 140, 282, 'rx="4" fill="none" stroke="' + f + '" stroke-width="10"');
    out += rect(-70, -282, 140, 282, 'rx="4" fill="none" ' + K4);
    out += rect(-4, -150, 46, 40, 'rx="3" fill="#2f3833" ' + K3);
    out += circ(12, -130, 8, 'class="fAccent"') + rect(8, -122, 8, 12, 'rx="2" fill="#000" fill-opacity=".7"');
    return out + sigilBadge();
  };

  /* Bulkhead hatch: rounded corners, dogging handles, a small port. */
  PARTS.hatchDoor = function (o) {
    var m = o.metal || '#3a4a52', out = rect(-70, -270, 140, 270, 'rx="34" fill="' + m + '" ' + K4);
    out += rect(-58, -258, 116, 246, 'rx="26" fill="none" stroke="black" stroke-opacity=".4" stroke-width="4"');
    var i;
    for (i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      out += rect(-6, -6, 12, 12, 'rx="2" fill="' + (o.dog || '#8d7a4a') + '" transform="translate(' +
        (46 * Math.cos(a)).toFixed(1) + ',' + (-134 + 108 * Math.sin(a)).toFixed(1) + ') rotate(' + (i * 45) + ')"');
    }
    out += circ(0, -196, 30, 'fill="' + (o.brass || '#c99a3f') + '" ' + K3);
    out += circ(0, -196, 21, 'fill="#12303a"');
    out += pth('M-21 -190 q7 -6 14 0 q7 6 14 0 q7 -6 14 0 l0 10 a21 21 0 0 1 -42 0 z', 'fill="#1d5566"');
    out += circ(0, -92, 22, 'fill="none" stroke="' + (o.brass || '#c99a3f') + '" stroke-width="7"');
    out += ln(-22, -92, 22, -92, 'stroke="' + (o.brass || '#c99a3f') + '" stroke-width="7"');
    out += ln(0, -114, 0, -70, 'stroke="' + (o.brass || '#c99a3f') + '" stroke-width="7"');
    return out + sigilBadge();
  };

  /* A stone slab, sealed, with a carved seam and a scarab boss. */
  PARTS.slabDoor = function (o) {
    var s = o.stone || '#a98a52';
    var out = rect(-70, -282, 140, 282, 'fill="' + s + '" ' + K5);
    out += rect(-58, -268, 116, 254, 'fill="none" stroke="#6a5324" stroke-width="4"');
    out += ln(0, -268, 0, -14, 'stroke="black" stroke-opacity=".5" stroke-width="5"');
    var i;
    for (i = 0; i < 5; i++) {
      out += pth('M-44 ' + (-244 + i * 46) + ' h34 M-40 ' + (-236 + i * 46) + ' v-16',
        'stroke="#7a5f28" stroke-width="3" fill="none"');
      out += pth('M12 ' + (-250 + i * 46) + ' q16 10 0 20 M20 ' + (-244 + i * 46) + ' h20',
        'stroke="#7a5f28" stroke-width="3" fill="none"');
    }
    out += ell(0, -140, 22, 26, 'fill="#8a6a2c" ' + K3);
    out += pth('M-22 -146 q22 -18 44 0 M0 -166 v52', 'fill="none" stroke="#5d4718" stroke-width="3"');
    return out + sigilBadge();
  };

  /* Airlock/blast door: warning chevrons, a round port, a big handle. */
  PARTS.airlockDoor = function (o) {
    var m = o.metal || '#46545a', out = rect(-70, -282, 140, 282, 'rx="8" fill="' + m + '" ' + K4);
    out += rect(-70, -282, 140, 22, 'fill="#141a1c"');
    var i;
    for (i = -70; i < 70; i += 20) {
      out += pth('M' + i + ' -260 l10 -22 l10 0 l-10 22 z', 'fill="' + (o.stripe || '#d8b032') + '"');
    }
    out += circ(0, -190, 34, 'fill="#1b2226" ' + K3);
    out += circ(0, -190, 25, 'fill="#8fe4ff" fill-opacity=".2"');
    out += pth('M-25 -190 a25 25 0 0 0 50 0', 'fill="#8fe4ff" fill-opacity=".12"');
    out += rect(-52, -120, 104, 46, 'rx="5" fill="#333f44" ' + K3);
    out += rect(-40, -108, 80, 22, 'rx="3" fill="#0d1214"');
    out += txt(0, -91, '████', MID + ' font-size="14" fill="#5fe3c8" fill-opacity=".7" letter-spacing="2"');
    out += rect(-14, -56, 28, 40, 'rx="6" fill="' + (o.stripe || '#d8b032') + '" ' + K2);
    return out + sigilBadge();
  };

  /* Riveted iron door — clockworks, mine and observatory share it. */
  PARTS.ironDoor = function (o) {
    var m = o.metal || '#3e352c', out = rect(-70, -282, 140, 282, 'rx="5" fill="' + m + '" ' + K4);
    var i, j;
    for (j = 0; j < 3; j++) {
      out += rect(-62, -272 + j * 90, 124, 82, 'rx="3" fill="none" stroke="black" stroke-opacity=".4" stroke-width="3"');
      for (i = -56; i <= 56; i += 28) {
        out += circ(i, -266 + j * 90, 3.4, 'fill="' + (o.rivet || '#6e6153') + '"');
        out += circ(i, -196 + j * 90, 3.4, 'fill="' + (o.rivet || '#6e6153') + '"');
      }
    }
    out += rect(-56, -150, 40, 26, 'rx="3" fill="#241f1a" ' + K2);
    out += circ(-36, -137, 9, 'class="fAccent"') + rect(-40, -128, 8, 12, 'rx="2" fill="#000" fill-opacity=".7"');
    return out + sigilBadge();
  };

  /* Glazed garden door: white frame, small panes, night behind. */
  PARTS.glazedDoor = function (o) {
    var f = o.frame || '#c8cdbc', out = rect(-70, -282, 140, 282, 'rx="4" fill="' + f + '" ' + K4);
    out += rect(-56, -268, 112, 210, 'fill="#0d1f18"');
    var i, j;
    for (j = 0; j < 5; j++) {
      for (i = 0; i < 2; i++) {
        out += rect(-54 + i * 56, -266 + j * 42, 52, 38, 'fill="url(#ecGlass)"');
      }
    }
    for (j = 1; j < 5; j++) out += ln(-56, -268 + j * 42, 56, -268 + j * 42, 'stroke="' + f + '" stroke-width="5"');
    out += ln(0, -268, 0, -58, 'stroke="' + f + '" stroke-width="5"');
    out += rect(-56, -50, 112, 36, 'rx="3" fill="' + f + '" ' + K2);
    /* The sheen must stay INSIDE the glazing. Authored at y 58 it ran 58px
       past the threshold and painted a pale diagonal streak across the
       floor — the door appeared to be leaking. */
    out += pth('M-40 -62 l14 -190', 'stroke="#ffffff" stroke-opacity=".12" stroke-width="14"');
    out += circ(-42, -142, 7, 'class="fAccent"');
    return out + sigilBadge();
  };

  /* ---- lockCrank: the tall thing with a hex socket ----
     MUST emit #cabSocket and #cabOpenG. */

  function cabInnards(o) {
    return circ(0, -100, 9, 'id="cabSocket" fill="none" class="sAccent" stroke-width="3"') +
      pth('M0 -107 l6 3.5 v7 l-6 3.5 l-6 -3.5 v-7 z', 'fill="black" fill-opacity=".55"') +
      grp('id="cabOpenG" style="display:none"',
        rect(-33, -193, 66, 188, 'fill="black" fill-opacity=".65"') +
        txt(0, -90, '🔑', MID + ' font-size="26"'));
  }

  /* A cabinet, and the render has to say so LOUDLY. Without the cornice
     and plinth this part was a 76x198 rectangle with a centre seam, which
     is also the description of a door — and in four settings it stands
     directly beside the real door, where it read as a second exit. The
     overhanging top and the foot are what separate furniture from a way
     out at a glance. */
  PARTS.tallCabinet = function (o) {
    var body = (o.body ? 'fill="' + o.body + '" ' : 'class="fFloorA" ');
    return rect(-38, -190, 76, 182, 'rx="3" ' + body + K4) +
      rect(-45, -204, 90, 16, 'rx="3" ' + body + K3) +
      rect(-43, -10, 86, 12, 'rx="2" ' + body + K3) +
      ln(0, -184, 0, -14, 'stroke="black" stroke-opacity=".45" stroke-width="3"') +
      rect(-32, -178, 28, 74, 'fill="none" stroke="black" stroke-opacity=".33" stroke-width="3"') +
      rect(4, -178, 28, 74, 'fill="none" stroke="black" stroke-opacity=".33" stroke-width="3"') +
      rect(-32, -60, 28, 40, 'fill="none" stroke="black" stroke-opacity=".33" stroke-width="3"') +
      rect(4, -60, 28, 40, 'fill="none" stroke="black" stroke-opacity=".33" stroke-width="3"') +
      circ(-6, -128, 4, 'class="fAccent"') + circ(6, -128, 4, 'class="fAccent"') +
      cabInnards(o);
  };

  /* A winch/hoist housing: drum, frame and a geared shaft. Fits any room
     where a crank plausibly drives something heavy. */
  PARTS.winchHousing = function (o) {
    var m = o.metal || '#4a423a', b = o.brass || '#c9973f';
    var out = rect(-38, -198, 76, 198, 'rx="4" fill="' + m + '" ' + K4);
    out += rect(-30, -190, 60, 60, 'rx="3" fill="#151210"');
    out += circ(0, -160, 22, 'fill="none" stroke="' + b + '" stroke-width="5"');
    var i;
    for (i = 0; i < 10; i++) {
      out += rect(-3, -26, 6, 9, 'rx="1" fill="' + b + '" transform="translate(0,-160) rotate(' + (i * 36) + ')"');
    }
    out += circ(0, -160, 7, 'fill="' + b + '"');
    out += rect(-30, -60, 60, 40, 'rx="3" fill="#151210"');
    out += pth('M-24 -50 h48 M-24 -40 h48 M-24 -30 h48', 'stroke="' + m + '" stroke-width="3"');
    return out + cabInnards(o);
  };

  /* Fume hood: a glass sash you can see the apparatus through. */
  PARTS.fumeHood = function (o) {
    var m = o.metal || '#4a565a';
    var out = rect(-38, -198, 76, 198, 'rx="4" fill="' + m + '" ' + K4);
    out += rect(-31, -190, 62, 96, 'fill="#101a1c"');
    out += rect(-24, -140, 12, 34, 'rx="2" fill="#5fe3c8" fill-opacity=".35" ' + K2);
    out += pth('M4 -106 l-10 -30 h30 l-10 30 z', 'fill="#c8c86e" fill-opacity=".45" ' + K2);
    out += rect(-31, -190, 62, 96, 'fill="url(#ecGlass)"');
    out += rect(-31, -100, 62, 8, 'fill="#8d9498"');
    out += rect(-31, -84, 62, 28, 'rx="2" fill="#2a3438"');
    out += circ(-16, -70, 5, 'fill="#5fe3c8"') + circ(0, -70, 5, 'fill="#d8b032"');
    return out + cabInnards(o);
  };

  /* An obelisk-shaped pillar with a socket set into its face. */
  PARTS.obelisk = function (o) {
    var s = o.stone || '#b39a63';
    var out = pth('M-34 0 l6 -170 l28 -28 l28 28 l6 170 z', 'fill="' + s + '" ' + K4);
    out += pth('M-28 -170 h56', 'stroke="black" stroke-opacity=".4" stroke-width="3"');
    var i;
    for (i = 0; i < 4; i++) {
      out += pth('M-14 ' + (-150 + i * 34) + ' h12 v14 h-12 z M6 ' + (-142 + i * 34) + ' q10 8 0 14',
        'fill="none" stroke="#7a5f28" stroke-width="3"');
    }
    return out + cabInnards(o);
  };

  /* ---- lockCode: the coded box ----
     MUST emit #safeOpenG and #safeItem. */

  function safeInnards(o) {
    return grp('id="safeOpenG" style="display:none"',
      rect(-43, -72, 86, 66, 'fill="black" fill-opacity=".6"') +
      txt(0, -32, '', 'id="safeItem" ' + MID + ' font-size="24"'));
  }

  PARTS.ironSafe = function (o) {
    return rect(-49, -78, 98, 78, 'rx="7" fill="' + (o.body || '#333a4a') + '" ' + K4) +
      circ(0, -42, 17, 'fill="' + (o.dial || '#20293e') + '" class="sAccent" stroke-width="3"') +
      ln(0, -42, 0, -55, 'class="sAccent" stroke-width="3" stroke-linecap="round"') +
      rect(30, -50, 8, 18, 'rx="3" class="fAccent"') +
      (o.rivets ? circ(-40, -70, 3, 'fill="#6e7583"') + circ(40, -70, 3, 'fill="#6e7583"') +
        circ(-40, -8, 3, 'fill="#6e7583"') + circ(40, -8, 3, 'fill="#6e7583"') : '') +
      safeInnards(o);
  };

  /* Iron-bound strongbox: wood body, heavy straps, a dial plate. */
  PARTS.strongBox = function (o) {
    var w = o.wood || '#5c3f22', m = o.metal || '#3d3a34';
    return rect(-49, -74, 98, 74, 'rx="4" fill="' + w + '" ' + K4) +
      rect(-49, -74, 12, 74, 'fill="' + m + '"') + rect(37, -74, 12, 74, 'fill="' + m + '"') +
      rect(-49, -46, 98, 10, 'fill="' + m + '"') +
      circ(0, -50, 15, 'fill="' + m + '" class="sAccent" stroke-width="3"') +
      ln(0, -50, 0, -62, 'class="sAccent" stroke-width="3" stroke-linecap="round"') +
      rect(-9, -26, 18, 16, 'rx="3" class="fAccent" ' + K2) +
      safeInnards(o);
  };

  /* A stone puzzle box with three rotating glyph rings. */
  PARTS.stoneDialBox = function (o) {
    var s = o.stone || '#b39a63';
    var out = rect(-49, -76, 98, 76, 'rx="3" fill="' + s + '" ' + K4);
    out += rect(-42, -68, 84, 60, 'fill="#8a6a2c" fill-opacity=".6"');
    var i;
    for (i = 0; i < 3; i++) {
      out += circ(-26 + i * 26, -38, 13, 'fill="' + s + '" class="sAccent" stroke-width="2.5"');
      out += txt(-26 + i * 26, -32, ['☥', '𓂀', '☉'][i], MID + ' font-size="14" fill="#5d4718"');
    }
    return out + safeInnards(o);
  };

  /* ---- anchor + lockSmall: the furniture and its locked drawer ----
     The drawer MUST emit #drawerOpenG and #drawerItem. It is a SEPARATE
     object from the furniture because the hint text names it by name and
     the hit target must be exactly the drawer front, not the whole desk. */

  function drawerInnards(o) {
    return grp('id="drawerOpenG" style="display:none"',
      rect(-74, 21, 148, 30, 'rx="4" fill="black" fill-opacity=".55" ' + K3) +
      txt(0, 44, '', 'id="drawerItem" ' + MID + ' font-size="20"'));
  }

  PARTS.drawerWood = function (o) {
    return rect(-70, -21, 140, 42, 'rx="4" ' + (o.body ? 'fill="' + o.body + '" ' : 'class="fFloorB" ') + K3) +
      circ(0, 0, 6, 'class="fAccent"') + circ(0, 0, 2.4, 'fill="black" fill-opacity=".7"') +
      drawerInnards(o);
  };

  PARTS.drawerSteel = function (o) {
    return rect(-70, -21, 140, 42, 'rx="3" fill="' + (o.body || '#454f52') + '" ' + K3) +
      rect(-30, -8, 60, 8, 'rx="3" fill="#7d888c"') +
      circ(44, 0, 6, 'class="fAccent"') + rect(41, 3, 6, 9, 'rx="2" fill="black" fill-opacity=".7"') +
      drawerInnards(o);
  };

  PARTS.drawerStone = function (o) {
    return rect(-70, -21, 140, 42, 'fill="' + (o.body || '#a88a4e') + '" ' + K3) +
      pth('M-56 -10 h20 M-56 2 h20 M20 -10 q12 8 0 16', 'stroke="#6a5324" stroke-width="3" fill="none"') +
      circ(0, 0, 7, 'class="fAccent"') +
      drawerInnards(o);
  };

  PARTS.writingDesk = function (o) {
    return rect(-150, -110, 300, 18, 'rx="4" ' + (o.top ? 'fill="' + o.top + '" ' : 'class="fFloorA" ') + K3) +
      rect(-132, -92, 22, 92, (o.leg ? 'fill="' + o.leg + '"' : 'class="fFloorB"')) +
      rect(110, -92, 22, 92, (o.leg ? 'fill="' + o.leg + '"' : 'class="fFloorB"'));
  };

  /* Bolted-down steel table: no legs to hide anything behind, which is the
     whole idea of prison furniture. */
  PARTS.steelTable = function (o) {
    var m = o.metal || '#4b5350';
    return rect(-150, -110, 300, 16, 'rx="2" fill="' + m + '" ' + K3) +
      rect(-138, -94, 16, 94, 'fill="' + m + '"') + rect(122, -94, 16, 94, 'fill="' + m + '"') +
      rect(-146, -6, 32, 8, 'rx="2" fill="#2e3432"') + rect(114, -6, 32, 8, 'rx="2" fill="#2e3432"') +
      pth('M-122 -94 l244 60', 'stroke="' + m + '" stroke-width="7" stroke-opacity=".8"');
  };

  /* Lab bench: epoxy top, glassware standing on it, a shelf underneath. */
  PARTS.labBench = function (o) {
    var out = rect(-150, -110, 300, 16, 'rx="2" fill="#2f3a3d" ' + K3);
    out += rect(-146, -94, 292, 12, 'fill="#4a5457" fill-opacity=".7"');
    out += rect(-138, -30, 276, 10, 'fill="#3a4447"');
    out += rect(-138, -82, 16, 82, 'fill="#3a4447"') + rect(122, -82, 16, 82, 'fill="#3a4447"');
    /* Glassware sits ABOVE the bench top, so it is drawn at negative y
       beyond the top edge; keep it clear of the drawer's hit box.

       Only the LEFT end carries glassware. A beaker at local +96 lands at
       x 364, which is four pixels off the burner at 352 — the first render
       had a flask growing out of the flame. The right end of this bench is
       the light's space in every laboratory chamber. */
    out += pth('M-116 -110 l-8 -30 h28 l-8 30 z', 'fill="#8fd8e4" fill-opacity=".45" ' + K2);
    out += pth('M-104 -140 v-14 h-8 v14', 'fill="none" stroke="#8fd8e4" stroke-width="3"');
    out += circ(-58, -124, 14, 'fill="#c8c86e" fill-opacity=".4" ' + K2);
    out += rect(-64, -152, 12, 30, 'fill="#8fd8e4" fill-opacity=".35" ' + K2);
    return out;
  };

  /* Potting bench: rough planks, a scatter of soil, small pots. */
  PARTS.pottingBench = function (o) {
    var w = o.wood || '#6a5a38';
    var out = rect(-150, -110, 300, 16, 'rx="2" fill="' + w + '" ' + K3);
    out += rect(-140, -30, 280, 9, 'fill="' + w + '" fill-opacity=".85"');
    out += rect(-134, -94, 18, 94, 'fill="' + w + '"') + rect(116, -94, 18, 94, 'fill="' + w + '"');
    out += pth('M-124 -110 l4 -26 h26 l4 26 z', 'fill="#a8613a" ' + K2);
    out += pth('M-98 -136 q-6 -18 4 -24 q8 8 2 24', 'fill="none" stroke="#6fae5c" stroke-width="4"');
    out += pth('M96 -110 l3 -18 h20 l3 18 z', 'fill="#a8613a" ' + K2);
    out += pth('M-30 -110 q20 -10 40 0 z', 'fill="#3d2f1e"');
    return out;
  };

  /* Chart table: raised fiddle rail so the charts do not slide in a swell.
     Small detail, but it is the difference between a table on a ship and a
     table in a study. */
  PARTS.chartTable = function (o) {
    var w = o.wood || '#5d4426';
    return rect(-150, -110, 300, 18, 'rx="3" fill="' + w + '" ' + K3) +
      rect(-152, -120, 304, 10, 'rx="3" fill="#7a5b32" ' + K2) +
      rect(-132, -92, 22, 92, 'fill="' + w + '" fill-opacity=".85"') +
      rect(110, -92, 22, 92, 'fill="' + w + '" fill-opacity=".85"') +
      pth('M-120 -92 l240 40 M120 -92 l-240 40', 'stroke="' + w + '" stroke-width="7" stroke-opacity=".7"') +
      rect(-92, -134, 70, 16, 'rx="8" fill="url(#ecParch)" ' + K2 + ' transform="rotate(-4 -57 -126)"');
  };

  /* Stone offering table on two block legs. */
  PARTS.offeringTable = function (o) {
    var s = o.stone || '#a88a4e';
    return rect(-150, -112, 300, 20, 'fill="' + s + '" ' + K3) +
      rect(-124, -92, 40, 92, 'fill="' + s + '" fill-opacity=".85" ' + K2) +
      rect(84, -92, 40, 92, 'fill="' + s + '" fill-opacity=".85" ' + K2) +
      pth('M-150 -92 h300', 'stroke="black" stroke-opacity=".4" stroke-width="3"') +
      pth('M-70 -112 q14 -18 28 0 M20 -112 l10 -16 l10 16', 'fill="none" stroke="#6a5324" stroke-width="3"');
  };

  /* Heavy workbench with a vice bolted to one end. */
  PARTS.workBench = function (o) {
    var w = o.wood || '#5a4530';
    return rect(-150, -110, 300, 20, 'rx="2" fill="' + w + '" ' + K3) +
      rect(-136, -90, 20, 90, 'fill="' + w + '" fill-opacity=".85"') +
      rect(116, -90, 20, 90, 'fill="' + w + '" fill-opacity=".85"') +
      rect(-136, -40, 272, 10, 'fill="' + w + '" fill-opacity=".6"') +
      rect(-146, -132, 34, 24, 'rx="3" fill="#5a6367" ' + K2) +
      rect(-140, -140, 10, 14, 'fill="#5a6367"') +
      ln(-129, -120, -101, -120, 'stroke="#5a6367" stroke-width="6"') +
      circ(-99, -120, 6, 'fill="#8d9498"');
  };

  /* The great refractor. It is the ANCHOR of the observatory, so it stands
     where the desk stands: the drawer lives in its pier. */
  PARTS.telescope = function (o) {
    var b = o.brass || '#c9a24e';
    var out = pth('M-52 0 l16 -76 h72 l16 76 z', 'fill="#2a3048" ' + K3);
    out += rect(-92, -186, 200, 34, 'rx="17" fill="' + b + '" ' + K3 +
      ' transform="rotate(-19 8 -169)"');
    out += rect(78, -216, 22, 30, 'rx="6" fill="#8a6a2c" transform="rotate(-19 89 -201)"');
    out += circ(-96, -140, 12, 'fill="#8fe4ff" fill-opacity=".35" stroke="' + b + '" stroke-width="3"');
    out += pth('M-30 -76 l38 -46 l40 30', 'fill="none" stroke="#6a708c" stroke-width="7"');
    out += rect(-46, -96, 92, 16, 'rx="4" fill="#3a4160" ' + K2);
    return out;
  };

  /* ---- light: whatever burns in this room ----
     MUST emit #flame and #glowE, and #glowE MUST carry
     pointer-events="none". That attribute is not cosmetic: the glow is a
     105px-radius circle painted after the drawer and the shelf, SVG
     hit-testing ignores gradient alpha, and without it the candle
     swallowed every tap on the right half of BOTH — a chamber whose brass
     key was behind the shelf could look unsolvable. validate() checks for
     it, because it is exactly the kind of thing a new part forgets. */

  function glow(cx, cy, r) {
    return circ(cx, cy, r || 105, 'id="glowE" fill="url(#ecGlow)" ' + NOHIT);
  }

  PARTS.candleLight = function (o) {
    return glow(0, -36) +
      rect(-8, -34, 16, 34, 'rx="3" fill="#e9dcc0"') +
      ell(0, 0, 16, 5, 'class="fAccent"') +
      pth('M0 -60 q9 12 0 24 q-9 -12 0 -24', 'id="flame" fill="#ffcf6e" stroke="#ff9d3c" stroke-width="2"');
  };

  /* Hanging oil lantern: glass body, wire bail, flame inside. */
  PARTS.lanternLight = function (o) {
    var m = o.metal || '#8a6a3a';
    return glow(0, -52) +
      ln(0, -128, 0, -96, 'stroke="' + m + '" stroke-width="3"') +
      pth('M-16 -96 q16 -12 32 0 z', 'fill="' + m + '" ' + K2) +
      rect(-17, -92, 34, 60, 'rx="4" fill="#ffe6b0" fill-opacity=".16" stroke="' + m + '" stroke-width="3"') +
      rect(-20, -34, 40, 10, 'rx="3" fill="' + m + '" ' + K2) +
      pth('M0 -84 q10 14 0 28 q-10 -14 0 -28', 'id="flame" fill="#ffcf6e" stroke="#ff9d3c" stroke-width="2"');
  };

  /* Bare bulb behind a wire cage — the flame is the filament. */
  PARTS.cagedBulb = function (o) {
    var m = o.metal || '#5b625f', out = glow(0, -74, 92);
    out += ln(0, -150, 0, -112, 'stroke="' + m + '" stroke-width="3"');
    out += pth('M-22 -112 q22 -14 44 0 z', 'fill="' + m + '" ' + K2);
    out += circ(0, -80, 22, 'fill="#fff3cf" fill-opacity=".14" stroke="' + m + '" stroke-width="2.5"');
    var i;
    for (i = 0; i < 5; i++) {
      out += pth('M-22 -104 q22 44 44 0', 'fill="none" stroke="' + m + '" stroke-width="2" ' +
        'transform="rotate(' + (i * 36) + ' 0 -84)"');
    }
    out += pth('M-7 -86 q7 -14 7 0 q0 14 7 0', 'id="flame" fill="none" stroke="#ffcf6e" stroke-width="4"');
    return out;
  };

  /* Bronze brazier on three legs. */
  PARTS.brazierLight = function (o) {
    var m = o.metal || '#8a6a2c';
    return glow(0, -56) +
      pth('M-10 0 l-14 -34 M10 0 l14 -34 M0 0 v-34', 'stroke="' + m + '" stroke-width="6"') +
      pth('M-32 -34 h64 l-10 -22 h-44 z', 'fill="' + m + '" ' + K3) +
      pth('M-24 -56 h48', 'stroke="#3a2a10" stroke-width="4"') +
      pth('M0 -96 q16 20 6 34 q-6 8 -6 8 q0 0 -6 -8 q-10 -14 6 -34',
        'id="flame" fill="#ffcf6e" stroke="#ff9d3c" stroke-width="2"');
  };

  /* Bunsen burner: tripod, gas tube, a cone of blue flame. */
  PARTS.bunsenLight = function (o) {
    return glow(0, -46, 92) +
      rect(-18, -8, 36, 8, 'rx="2" fill="#4a5457" ' + K2) +
      rect(-5, -46, 10, 38, 'fill="#8d9498" ' + K2) +
      pth('M18 -6 q22 -4 26 -30', 'fill="none" stroke="#5a6367" stroke-width="4"') +
      pth('M0 -86 q11 22 0 40 q-11 -18 0 -40', 'id="flame" fill="#8fd8ff" fill-opacity=".8" stroke="#5fe3c8" stroke-width="2"');
  };

  /* The open firebox: the light source is the fire itself. */
  PARTS.fireboxLight = function (o) {
    return glow(0, -40, 118) +
      rect(-34, -56, 68, 56, 'rx="4" fill="#2a221e" ' + K3) +
      rect(-26, -48, 52, 44, 'fill="#120c09"') +
      pth('M-26 -4 q10 -24 26 -26 q18 4 26 26 z', 'fill="url(#ecFire)"') +
      pth('M0 -60 q14 18 4 32 q-4 6 -4 6 q0 0 -6 -6 q-10 -14 6 -32',
        'id="flame" fill="#ffb04c" stroke="#ff6a1e" stroke-width="2"');
  };

  /* =====================================================================
     THE SECOND TEN — parts for settings XI-XX
     ---------------------------------------------------------------------
     Same rules as everything above: local coordinates around the anchor,
     black outlines at low opacity so any palette survives, and options for
     anything a second room wants to recolour. Role bounding boxes are
     unchanged, so a lamp-room stair head and a Persian rug occupy the same
     footprint and game.js:layoutFor() cannot tell them apart.

     Written role by role inside each room rather than grouped by role
     across rooms, because the thing a reader wants to check is "does this
     room read as a lighthouse", and that question is answered by seven
     parts sitting together.
     ===================================================================== */

  /* ---- THE LAMP ROOM ---- */

  /* The head of the iron spiral stair coming up through the floor. The
     thing you look under is a hole you look DOWN — same affordance,
     completely different silhouette from a rug. */
  PARTS.stairHead = function (o) {
    var m = o.metal || '#5c6670';
    var out = ell(0, -36, 112, 36, 'fill="' + m + '" ' + K3);
    out += ell(0, -34, 94, 29, 'fill="#070b0f"');
    var i;
    for (i = 0; i < 10; i++) {
      if (i === 5 || i === 6) continue;      /* the two treads you cannot see: the way down */
      var a0 = (i * 36 - 4) * Math.PI / 180, a1 = (i * 36 + 30) * Math.PI / 180;
      out += pth('M0 -34 L' + (92 * Math.cos(a0)).toFixed(1) + ' ' + (-34 + 28 * Math.sin(a0)).toFixed(1) +
        ' L' + (92 * Math.cos(a1)).toFixed(1) + ' ' + (-34 + 28 * Math.sin(a1)).toFixed(1) + ' z',
        'fill="' + (i % 2 ? '#6f7b85' : '#49535b') + '" stroke="black" stroke-opacity=".45" stroke-width="2"');
    }
    out += circ(0, -34, 12, 'fill="#8d9498" ' + K2);
    out += pth('M-100 -50 q10 -34 48 -42', 'fill="none" stroke="' + m + '" stroke-width="7" stroke-linecap="round"');
    return out;
  };

  /* Long-spouted oil can with a funnel beside it. */
  PARTS.oilCan = function (o) {
    var m = o.metal || '#7d868c';
    return pth('M-20 0 l4 -36 h32 l4 36 z', 'fill="' + m + '" ' + K3) +
      ell(0, -36, 20, 6, 'fill="#9aa3a8" ' + K2) +
      pth('M12 -38 q28 -8 30 -44', 'fill="none" stroke="' + m + '" stroke-width="5"') +
      circ(42, -82, 3.4, 'fill="' + m + '"') +
      pth('M-16 -38 q-16 -12 -2 -22', 'fill="none" stroke="#4c5459" stroke-width="4"') +
      pth('M-34 0 l-4 -22 h26 l-4 22 z', 'fill="#9aa3a8" fill-opacity=".75" ' + K2) +
      pth('M-8 -6 l6 -6', 'stroke="black" stroke-opacity=".3" stroke-width="3"');
  };

  /* Brass barometer: a set hand and a pressure hand, so it reads as an
     instrument that has been WATCHED rather than as another clock. */
  PARTS.barometer = function (o) {
    var b = o.brass || '#c99a3f';
    var out = circ(0, 0, 36, 'fill="' + b + '" ' + K5) + circ(0, 0, 27, 'fill="#efe6cc"');
    var i;
    for (i = 0; i < 16; i++) {
      var a = i * Math.PI / 8;
      out += ln((21 * Math.cos(a)).toFixed(1), (21 * Math.sin(a)).toFixed(1),
                (26 * Math.cos(a)).toFixed(1), (26 * Math.sin(a)).toFixed(1),
                'stroke="#3a2f1a" stroke-width="' + (i % 4 ? 1.6 : 3) + '"');
    }
    return out + pth('M-16 -14 a22 22 0 0 1 12 -6', 'fill="none" stroke="#8a3a2a" stroke-width="3"') +
      ln(0, 0, -15, -12, 'stroke="#8a3a2a" stroke-width="3" stroke-linecap="round"') +
      ln(0, 0, 16, -9, 'stroke="#1c1c1c" stroke-width="3" stroke-linecap="round"') +
      circ(0, 0, 3.4, 'fill="#1c1c1c"');
  };

  /* Four signal flags pinned to a board. Blocks of flat colour: at phone
     size that is more legible than any amount of drawn detail. */
  PARTS.flagBoard = function (o) {
    var out = rect(-52, -40, 104, 80, 'rx="3" fill="' + (o.wood || '#3f3226') + '" ' + K4);
    var i, x, y;
    for (i = 0; i < 4; i++) {
      x = -44 + (i % 2) * 46; y = -32 + Math.floor(i / 2) * 38;
      out += rect(x, y, 42, 30, 'fill="#e8e2d2" ' + K2);
      if (i === 0) out += pth('M' + x + ' ' + y + ' l42 30 l0 -30 z', 'fill="#b4342e"');
      if (i === 1) { out += rect(x, y, 21, 15, 'fill="#2a5fa0"'); out += rect(x + 21, y + 15, 21, 15, 'fill="#2a5fa0"'); }
      if (i === 2) { out += rect(x + 15, y, 12, 30, 'fill="#d8b032"'); out += rect(x, y + 9, 42, 12, 'fill="#d8b032"'); }
      if (i === 3) { out += rect(x, y, 42, 10, 'fill="#2f7a4a"'); out += rect(x, y + 20, 42, 10, 'fill="#2f7a4a"'); }
    }
    return out + ln(-46, -36, 46, -36, 'stroke="#8a7a54" stroke-width="2"');
  };

  /* The great lens. Concentric prism rings around a burner-bright core,
     with the panel's brass framing bars over the top. */
  PARTS.fresnelPanel = function (o) {
    var b = o.brass || '#c99a3f';
    var out = rect(-106, -73, 212, 146, 'rx="4" fill="#0e1a24" stroke="' + b + '" stroke-width="5"');
    var i;
    for (i = 7; i >= 1; i--) {
      out += ell(0, 0, i * 13.5, i * 9.2, 'fill="none" stroke="#bfe6f2" stroke-opacity="' +
        (0.16 + i * 0.045).toFixed(2) + '" stroke-width="5"');
    }
    out += ell(0, 0, 22, 15, 'fill="#ffe9a8" fill-opacity=".85"');
    out += ell(0, 0, 40, 27, 'fill="#ffe9a8" fill-opacity=".22"');
    for (i = -1; i <= 1; i += 2) {
      out += rect(i * 60 - 5, -73, 10, 146, 'fill="' + b + '" fill-opacity=".9" ' + K2);
    }
    out += rect(-106, -12, 212, 9, 'fill="' + b + '" fill-opacity=".85"');
    out += pth('M-96 60 l52 -120', 'stroke="#ffffff" stroke-opacity=".10" stroke-width="14"');
    return out;
  };

  /* Lettered pigeonholes with rolled paper in them. Charts in the lamp
     room, scrolls in the scriptorium, parcels in the guard's van. */
  PARTS.pigeonRack = function (o) {
    var w = o.wood || '#5a4630', c = o.roll || '#d9cba6';
    var out = rect(-76, -24, 152, 48, 'rx="2" fill="' + w + '" ' + K3);
    var i, x;
    for (i = 0; i < 6; i++) {
      x = -71 + i * 24;
      out += rect(x, -19, 21, 18, 'fill="#150f08"');
      out += rect(x, 2, 21, 18, 'fill="#150f08"');
      out += circ(x + 7, -10, 5, 'fill="' + c + '" ' + K2) + circ(x + 15, -10, 5, 'fill="' + c + '" ' + K2);
      if (i % 2) out += circ(x + 10, 11, 6, 'fill="' + c + '" ' + K2);
      else out += rect(x + 3, 4, 15, 14, 'fill="' + c + '" fill-opacity=".8" ' + K2);
    }
    return out + rect(-76, -24, 152, 48, 'rx="2" fill="none" ' + K3);
  };

  /* ---- THE VAULT ---- */

  /* A canvas cash sack, tied at the neck and stencilled. */
  PARTS.cashSack = function (o) {
    var c = o.cloth || '#a9a08a';
    return pth('M-26 0 q-10 -44 4 -56 q10 6 22 0 q16 12 6 56 z', 'fill="' + c + '" ' + K3) +
      pth('M-22 -56 q10 -14 6 -22 q10 8 18 0 q0 12 6 22 z', 'fill="' + c + '" fill-opacity=".8" ' + K2) +
      pth('M-21 -54 q22 10 42 0', 'fill="none" stroke="#5c5040" stroke-width="4"') +
      txt(0, -22, '£', MID + ' font-family="Georgia" font-size="22" fill="#3d372c" fill-opacity=".75"') +
      pth('M-16 -8 q16 -6 32 0', 'fill="none" stroke="black" stroke-opacity=".25" stroke-width="3"');
  };

  /* The time lock: a brass movement with two winding squares, the one
     mechanism in banking that stops the manager opening his own vault. */
  PARTS.timeLock = function (o) {
    var b = o.brass || '#c9a24e';
    var out = circ(0, 0, 36, 'fill="' + b + '" ' + K5) + circ(0, 0, 28, 'fill="#1d1c24"');
    var i;
    for (i = 0; i < 12; i++) {
      var a = i * Math.PI / 6;
      out += ln((22 * Math.cos(a)).toFixed(1), (22 * Math.sin(a)).toFixed(1),
                (27 * Math.cos(a)).toFixed(1), (27 * Math.sin(a)).toFixed(1),
                'stroke="' + b + '" stroke-width="2"');
    }
    out += pth('M0 0 L0 -22 A22 22 0 0 1 19 -11 z', 'fill="#b4342e" fill-opacity=".55"');
    out += circ(-11, 8, 5, 'fill="' + b + '" ' + K2) + circ(11, 8, 5, 'fill="' + b + '" ' + K2);
    out += rect(-3, -3, 6, 6, 'fill="' + b + '"');
    out += ln(0, 0, 13, -16, 'stroke="' + b + '" stroke-width="3" stroke-linecap="round"');
    return out;
  };

  /* A framed bearer bond: engine-turned border, ruled clauses, wax seal. */
  PARTS.bondCert = function (o) {
    var g = o.frame || '#8a6a2c';
    var out = rect(-52, -40, 104, 80, 'rx="2" fill="' + g + '" ' + K4);
    out += rect(-44, -32, 88, 64, 'fill="url(#ecParch)"');
    out += rect(-40, -28, 80, 56, 'fill="none" stroke="#8a6b3f" stroke-width="2" stroke-dasharray="3 3"');
    out += txt(0, -12, '£1000', MID + ' font-family="Georgia" font-size="14" fill="#5d4718"');
    out += pth('M-34 -2 h68 M-34 6 h68 M-34 14 h44', 'stroke="#8a7a58" stroke-width="2"');
    out += circ(26, 18, 8, 'fill="#8a2f2f" ' + K2) + pth('M22 18 h8 M26 14 v8', 'stroke="#5a1d1d" stroke-width="2"');
    return out;
  };

  /* The wall of safe-deposit boxes. Two keyholes on every door, one door
     standing open on a dark hole, which is what tells you it is a vault
     and not a filing room. */
  PARTS.depositBoxes = function (o) {
    var b = o.brass || '#b9913f';
    var out = rect(-106, -73, 212, 146, 'rx="3" fill="#23222c" ' + K5);
    var r, c, x, y;
    for (r = 0; r < 4; r++) {
      for (c = 0; c < 6; c++) {
        x = -98 + c * 33; y = -66 + r * 34;
        if (r === 1 && c === 4) continue;
        out += rect(x, y, 29, 30, 'rx="2" fill="' + b + '" fill-opacity=".9" ' + K2);
        out += ln(x + 3, y + 21, x + 26, y + 21, 'stroke="black" stroke-opacity=".3" stroke-width="2"');
        out += circ(x + 10, y + 12, 2.6, 'fill="#2a2118"') + circ(x + 19, y + 12, 2.6, 'fill="#2a2118"');
      }
    }
    out += rect(-98 + 4 * 33, -66 + 34, 29, 30, 'rx="2" fill="#08080a"');
    out += rect(-98 + 4 * 33 + 24, -66 + 34, 29, 30, 'rx="2" fill="' + b + '" ' + K2 +
      ' transform="rotate(-14 ' + (-98 + 4 * 33 + 24) + ' ' + (-66 + 34) + ')"');
    return out;
  };

  /* Stacked bullion. Trapezoids with a light top face — the only thing in
     the file drawn as a solid gold object, so the claim is visible. */
  PARTS.bullionShelf = function (o) {
    var g = o.gold || '#d8ad3e';
    var out = rect(-76, 14, 152, 10, 'rx="2" fill="#4a4756" ' + K3);
    var rows = [[-64, 5], [-52, 4], [-40, 3]];
    var i, j, x, y;
    for (i = 0; i < rows.length; i++) {
      y = 12 - i * 13;
      for (j = 0; j < rows[i][1]; j++) {
        x = rows[i][0] + j * 26;
        out += pth('M' + x + ' ' + y + ' l3 -11 h20 l3 11 z', 'fill="' + g + '" ' + K2);
        out += pth('M' + (x + 3) + ' ' + (y - 11) + ' h20', 'stroke="#f2d98a" stroke-width="2"');
      }
    }
    return out;
  };

  /* The round door. Radial boltwork, a spoked handwheel and a dial — and
     the badge slot above it stays clear of the wheel on purpose. */
  PARTS.vaultDoor = function (o) {
    var m = o.metal || '#4b5560';
    var out = rect(-70, -282, 140, 282, 'rx="4" fill="#1c2026" ' + K4);
    out += rect(-70, -282, 140, 282, 'rx="4" fill="none" stroke="' + m + '" stroke-width="12"');
    out += circ(0, -120, 64, 'fill="' + m + '" ' + K5);
    out += circ(0, -120, 54, 'fill="none" stroke="black" stroke-opacity=".35" stroke-width="4"');
    var i, a;
    for (i = 0; i < 16; i++) {
      a = i * Math.PI / 8;
      out += circ((0 + 58 * Math.cos(a)).toFixed(1), (-120 + 58 * Math.sin(a)).toFixed(1), 4,
        'fill="#8d9498"');
    }
    out += circ(0, -120, 30, 'fill="#39424b" ' + K3);
    for (i = 0; i < 5; i++) {
      out += rect(-4, -28, 8, 28, 'rx="3" fill="#c8ced2" transform="translate(0,-120) rotate(' +
        (i * 72) + ')"');
    }
    out += circ(0, -120, 10, 'fill="#c8ced2" ' + K2);
    out += circ(0, -196, 17, 'fill="#20262c" class="sAccent" stroke-width="3"');
    out += ln(0, -196, 0, -209, 'class="sAccent" stroke-width="3" stroke-linecap="round"');
    out += rect(-64, -44, 128, 14, 'rx="3" fill="' + m + '" ' + K3);
    return out + sigilBadge();
  };

  /* ---- THE SCRIPTORIUM ---- */

  /* A reed basket of rolled scrolls. */
  PARTS.scrollBin = function (o) {
    var c = o.reed || '#9a8248';
    var out = pth('M-27 0 l5 -48 h44 l5 48 z', 'fill="' + c + '" ' + K3);
    var i;
    for (i = -40; i <= -8; i += 10) out += ln(-25, i, 25, i, 'stroke="#6f5c2f" stroke-width="2.5"');
    for (i = -22; i <= 22; i += 11) out += ln(i, -6, i, -46, 'stroke="#6f5c2f" stroke-width="2" stroke-opacity=".7"');
    out += ell(0, -48, 26, 7, 'fill="#3a3020"');
    out += pth('M-16 -50 l6 -34 l10 2 l-4 34 z', 'fill="#ddd0ac" ' + K2);
    out += pth('M2 -50 l10 -26 l10 4 l-8 24 z', 'fill="#c9bb95" ' + K2);
    out += circ(-11, -84, 5, 'fill="#ede2c2" ' + K2) + circ(20, -74, 5, 'fill="#ede2c2" ' + K2);
    return out;
  };

  /* The sanctus bell on its bracket, with the cord that rings it. */
  PARTS.sanctusBell = function (o) {
    var b = o.bronze || '#9a7a3c';
    return rect(-28, -32, 56, 8, 'rx="2" fill="#4a4034" ' + K2) +
      pth('M-3 -24 v-4 h6 v4 z', 'fill="' + b + '"') +
      pth('M-19 14 q-2 -32 19 -38 q21 6 19 38 z', 'fill="' + b + '" ' + K3) +
      ell(0, 14, 19, 5.5, 'fill="' + b + '" ' + K2) +
      pth('M-14 2 q14 5 28 0', 'fill="none" stroke="#6a5324" stroke-width="2.5"') +
      circ(0, 21, 5, 'fill="#5d4718"') +
      pth('M19 -20 q16 24 6 46', 'fill="none" stroke="#b8a878" stroke-width="3"');
  };

  /* A gilded icon: gold ground, halo, a raised hand. Two centuries of
     visual shorthand doing the work in about ten shapes. */
  PARTS.iconPanel = function (o) {
    var g = o.gold || '#c9a24e';
    return rect(-52, -44, 104, 88, 'rx="3" fill="#4a3520" ' + K4) +
      pth('M-40 44 v-56 q40 -34 80 0 v56 z', 'fill="' + g + '"') +
      circ(0, -6, 17, 'fill="none" stroke="#f0dc9a" stroke-width="4"') +
      circ(0, -6, 12, 'fill="#c9a071"') +
      pth('M-18 44 q18 -32 36 0 z', 'fill="#6a2c34"') +
      pth('M-6 -14 q6 -6 12 0', 'fill="none" stroke="#5d4718" stroke-width="2"') +
      pth('M10 30 v-14 M6 22 h10', 'stroke="#e8d9a8" stroke-width="3"') +
      pth('M-40 -12 q40 -34 80 0', 'fill="none" stroke="#8a6a2c" stroke-width="3"');
  };

  /* The traceried arch: a lancet window with a quatrefoil head and lead
     cames, night behind it. */
  PARTS.traceryArch = function (o) {
    var s = o.stone || '#7c7a6a';
    var out = pth('M-80 73 v-72 q80 -104 160 0 v72 z', 'fill="' + s + '" ' + K5);
    out += pth('M-62 66 v-64 q62 -84 124 0 v64 z', 'fill="url(#ecNight)"');
    var i, j;
    for (i = -44; i <= 44; i += 22) {
      out += ln(i, 66, i, -34, 'stroke="' + s + '" stroke-opacity=".75" stroke-width="4"');
    }
    for (j = -14; j <= 58; j += 24) {
      out += ln(-62, j, 62, j, 'stroke="' + s + '" stroke-opacity=".6" stroke-width="3"');
    }
    out += ln(0, 66, 0, -70, 'stroke="' + s + '" stroke-width="8"');
    out += circ(0, -42, 20, 'fill="none" stroke="' + s + '" stroke-width="6"');
    for (i = 0; i < 4; i++) {
      out += circ(0, -55, 8, 'fill="none" stroke="' + s + '" stroke-width="4" transform="rotate(' +
        (i * 90) + ' 0 -42)"');
    }
    out += circ(28, -34, 13, 'fill="#dfe6ef" fill-opacity=".55"');
    for (i = 0; i < 6; i++) {
      out += circ(-52 + i * 21, -8 - (i % 3) * 16, 1.8, 'fill="#dfe6ef" fill-opacity=".8"');
    }
    out += rect(-92, 60, 184, 13, 'rx="3" fill="' + s + '" ' + K3);
    return out;
  };

  /* A ledged and braced plank door under a pointed arch, iron-studded.
     The scriptorium's way out, and the bell tower's. */
  PARTS.archDoor = function (o) {
    var w = o.wood || '#4a3826', m = o.iron || '#2f2a24';
    var out = pth('M-70 0 v-186 Q0 -292 70 -186 V0 z', 'fill="' + w + '" ' + K5);
    var i;
    for (i = -46; i <= 46; i += 23) {
      out += pth('M' + i + ' 0 V' + (-200 + Math.abs(i) * 0.62).toFixed(0),
        'stroke="black" stroke-opacity=".38" stroke-width="3"');
    }
    for (i = 0; i < 2; i++) {
      var y = -70 - i * 90;
      out += rect(-66, y, 132, 14, 'rx="2" fill="' + m + '" ' + K2);
      out += pth('M-66 ' + (y + 7) + ' h-10 M66 ' + (y + 7) + ' h10', 'stroke="' + m + '" stroke-width="6"');
    }
    out += pth('M-70 -186 Q0 -292 70 -186', 'fill="none" stroke="' + m + '" stroke-width="9"');
    out += circ(-40, -122, 11, 'fill="none" class="sAccent" stroke-width="5"');
    out += rect(-46, -140, 12, 16, 'rx="2" fill="' + m + '"');
    for (i = 0; i < 7; i++) {
      out += circ(-58 + i * 19, -232 + Math.abs(i - 3) * 13, 3.4, 'fill="' + m + '"');
    }
    return out + sigilBadge();
  };

  /* A scribe's slope: flat at the light's end, sloped where the work is,
     with an open book on it. Stands in the anchor slot, so the drawer
     lives under it exactly as it does under the writing desk. */
  PARTS.slopeDesk = function (o) {
    var w = o.wood || '#4e3b26';
    var out = rect(-150, -110, 300, 18, 'rx="3" fill="' + w + '" ' + K3);
    out += rect(-132, -92, 22, 92, 'fill="' + w + '" fill-opacity=".85"');
    out += rect(110, -92, 22, 92, 'fill="' + w + '" fill-opacity=".85"');
    out += pth('M-142 -110 l16 -50 h100 l0 50 z', 'fill="' + w + '" ' + K3);
    out += pth('M-124 -114 l12 -38 h44 l0 38 z', 'fill="#e9dcc0" ' + K2);
    out += pth('M-68 -114 v-38 h44 l0 38 z', 'fill="#dccfb0" ' + K2);
    out += pth('M-112 -142 h30 M-114 -134 h34 M-60 -142 h30 M-60 -134 h34',
      'stroke="#8a7a58" stroke-width="2"');
    out += rect(-70, -152, 5, 42, 'fill="#8a2f2f" fill-opacity=".8"');
    out += rect(-26, -122, 12, 12, 'rx="2" fill="#2e2a22" ' + K2);
    return out;
  };

  /* ---- THE TAXIDERMIST'S ---- */

  /* A pelt pegged out on the boards. Irregular outline, tufted edge, and
     four pegs — it must not resolve into a rectangle or it is a rug. */
  PARTS.pelt = function (o) {
    var f = o.fur || '#8a6a44';
    var out = pth('M-108 -10 q-14 -30 16 -40 q30 -10 40 -22 q16 -16 28 -2 q14 12 42 22 q30 10 14 42 z',
      'fill="' + f + '" ' + K3);
    var i;
    for (i = -96; i <= 96; i += 16) {
      out += ln(i, -12, i + 4, -3, 'stroke="' + f + '" stroke-width="4" stroke-linecap="round"');
    }
    out += pth('M-8 -74 q10 -14 18 -2', 'fill="none" stroke="' + f + '" stroke-width="7" stroke-linecap="round"');
    out += pth('M104 -22 q24 -6 30 6', 'fill="none" stroke="' + f + '" stroke-width="6" stroke-linecap="round"');
    var spots = [[-58, -34], [-20, -44], [24, -36], [58, -26], [-40, -20], [8, -20]];
    for (i = 0; i < spots.length; i++) {
      out += ell(spots[i][0], spots[i][1], 9, 6, 'fill="' + (o.spot || '#5f462a') + '" fill-opacity=".7"');
    }
    for (i = 0; i < 4; i++) {
      out += circ(-92 + i * 62, -14 - (i % 2) * 26, 3.4, 'fill="#2a2018"');
    }
    return out;
  };

  /* A bird under a glass dome on a turned plinth. */
  PARTS.domeBird = function (o) {
    var g = o.glass || '#cfe4ea';
    var out = ell(0, -6, 30, 8, 'fill="#3d2f22" ' + K2);
    out += rect(-26, -18, 52, 14, 'rx="3" fill="' + (o.wood || '#4a3520') + '" ' + K3);
    out += pth('M-8 -18 q-6 -14 4 -22 q8 -6 4 -18', 'fill="none" stroke="#6a5a3a" stroke-width="4"');
    out += ell(2, -44, 12, 17, 'fill="' + (o.bird || '#b8a476') + '" ' + K2);
    out += circ(-6, -62, 9, 'fill="' + (o.bird || '#b8a476') + '" ' + K2);
    out += pth('M-14 -62 l-14 4 l14 4 z', 'fill="#d8b032"');
    out += circ(-4, -64, 2.2, 'fill="#120e08"');
    out += pth('M4 -50 q14 8 8 22', 'fill="none" stroke="#8a7a54" stroke-width="3"');
    out += pth('M-24 -18 v-46 a24 46 0 0 1 48 0 v46 z', 'fill="url(#ecGlass)" stroke="' + g +
      '" stroke-opacity=".5" stroke-width="3"');
    out += pth('M-14 -22 l10 -50', 'stroke="#ffffff" stroke-opacity=".18" stroke-width="7"');
    return out;
  };

  /* A card of glass eyes, pinned in pairs. Small, glassy and unsettling —
     the object that tells you whose workshop this is. */
  PARTS.glassEyes = function (o) {
    var out = circ(0, 0, 34, 'fill="' + (o.card || '#b8a47e') + '" ' + K4);
    var pts = [[-16, -16], [0, -18], [16, -14], [-18, 2], [-2, 2], [16, 4], [-10, 18], [8, 18]];
    var i;
    for (i = 0; i < pts.length; i++) {
      out += circ(pts[i][0], pts[i][1], 6, 'fill="#f2f0e6" ' + K2);
      out += circ(pts[i][0], pts[i][1], 3.6, 'fill="' + (i % 3 ? '#8a5a24' : '#3a5f4a') + '"');
      out += circ(pts[i][0], pts[i][1], 1.6, 'fill="#0d0a06"');
      out += circ(pts[i][0] - 2, pts[i][1] - 2, 1.2, 'fill="#ffffff" fill-opacity=".9"');
    }
    return out + circ(0, 0, 34, 'fill="none" stroke="black" stroke-opacity=".3" stroke-width="2"');
  };

  /* A glazed case of pinned insects. */
  PARTS.insectCase = function (o) {
    var out = rect(-52, -40, 104, 80, 'rx="2" fill="' + (o.wood || '#3a2a1c') + '" ' + K4);
    out += rect(-44, -32, 88, 64, 'fill="#1d1710"');
    var cols = ['#c8894a', '#8a9ac8', '#c8b44a', '#a86a8a'];
    var i, x, y;
    for (i = 0; i < 4; i++) {
      x = -26 + (i % 2) * 44; y = -16 + Math.floor(i / 2) * 30;
      out += pth('M' + x + ' ' + y + ' q-18 -18 -14 -6 q-4 14 14 6 z', 'fill="' + cols[i] + '" fill-opacity=".9"');
      out += pth('M' + x + ' ' + y + ' q18 -18 14 -6 q4 14 -14 6 z', 'fill="' + cols[i] + '" fill-opacity=".9"');
      out += ln(x, y - 9, x, y + 8, 'stroke="#1a140c" stroke-width="3"');
      out += circ(x, y - 11, 2, 'fill="#c8ced0"');
    }
    out += rect(-44, -32, 88, 64, 'fill="url(#ecGlass)"');
    out += pth('M-36 30 l30 -60', 'stroke="#ffffff" stroke-opacity=".12" stroke-width="9"');
    return out;
  };

  /* The stag on his shield. Antlers break the panel's bounding box on
     purpose: it is the only object in the file with a silhouette that
     spreads, and that is what makes the room read at thumbnail size. */
  PARTS.stagMount = function (o) {
    var f = o.fur || '#7d5c38', w = o.wood || '#42301e';
    var out = pth('M-46 -46 h92 v34 q0 42 -46 62 q-46 -20 -46 -62 z', 'fill="' + w + '" ' + K4);
    var i;
    var antler = 'M-16 -30 q-16 -26 -40 -32 M-30 -46 q-16 -12 -34 -10 M-24 -56 q-8 -16 -22 -22 ' +
                 'M-40 -58 q-6 -12 -16 -16';
    out += pth(antler, 'fill="none" stroke="#c9b48a" stroke-width="6" stroke-linecap="round"');
    out += pth(antler, 'fill="none" stroke="#c9b48a" stroke-width="6" stroke-linecap="round" transform="scale(-1,1)"');
    out += ell(0, -18, 22, 20, 'fill="' + f + '" ' + K3);
    out += pth('M-13 -18 q13 46 26 0 q-4 30 -13 34 q-9 -4 -13 -34 z', 'fill="' + f + '" ' + K3);
    out += ell(0, 16, 11, 9, 'fill="' + (o.muzzle || '#59401f') + '" ' + K2);
    out += circ(-4, 20, 2.2, 'fill="#120d07"') + circ(4, 20, 2.2, 'fill="#120d07"');
    out += ell(-11, -26, 8, 5, 'fill="#0f0b07"') + ell(11, -26, 8, 5, 'fill="#0f0b07"');
    out += pth('M-26 -30 q-12 -6 -16 4 q10 8 18 2 z', 'fill="' + f + '" ' + K2);
    out += pth('M26 -30 q12 -6 16 4 q-10 8 -18 2 z', 'fill="' + f + '" ' + K2);
    for (i = -1; i <= 1; i += 2) out += circ(i * 34, 30, 3.4, 'fill="#8d8478"');
    return out;
  };

  /* ---- THE GUARD'S VAN ---- */

  /* Two tied mail sacks slumped on the floor, labelled. */
  PARTS.mailSacks = function (o) {
    var c = o.cloth || '#8a7f66';
    var out = pth('M-116 -6 q-12 -44 26 -54 q46 -12 76 2 q26 12 12 52 z', 'fill="' + c + '" ' + K3);
    out += pth('M-92 -58 q22 -12 20 -20 q14 10 24 2 q0 12 8 20 z', 'fill="' + c + '" fill-opacity=".85" ' + K2);
    out += pth('M-92 -56 q30 12 52 -2', 'fill="none" stroke="#4d4436" stroke-width="4"');
    out += rect(-56, -40, 30, 18, 'rx="2" fill="#d9cba6" ' + K2 + ' transform="rotate(-7 -41 -31)"');
    out += pth('M-50 -32 h18 M-50 -26 h12', 'stroke="#7a6a48" stroke-width="2" transform="rotate(-7 -41 -31)"');
    out += pth('M18 -6 q-6 -34 22 -42 q34 -10 56 0 q22 10 12 42 z', 'fill="' + c +
      '" fill-opacity=".9" ' + K3);
    out += pth('M40 -46 q18 -10 16 -16 q10 8 18 2 q0 10 6 16 z', 'fill="' + c + '" ' + K2);
    out += pth('M40 -44 q24 10 42 -2', 'fill="none" stroke="#4d4436" stroke-width="4"');
    out += pth('M-100 -20 q40 -10 70 -2 M30 -22 q34 -8 58 0', 'fill="none" stroke="black" stroke-opacity=".22" stroke-width="3"');
    return out;
  };

  /* Coal scuttle with a shovel and a few lumps. */
  PARTS.coalScuttle = function (o) {
    var m = o.metal || '#4a423e';
    var out = pth('M-26 0 q-8 -40 12 -50 q22 -10 30 4 l-4 46 z', 'fill="' + m + '" ' + K3);
    out += pth('M-14 -50 q18 -14 30 -4', 'fill="none" stroke="#6a625c" stroke-width="4"');
    out += pth('M-24 -30 q-16 -8 -8 -22', 'fill="none" stroke="#2f2a26" stroke-width="4"');
    var lumps = [[-4, -54], [8, -58], [0, -62], [14, -50]];
    var i;
    for (i = 0; i < lumps.length; i++) {
      out += pth('M' + lumps[i][0] + ' ' + lumps[i][1] + ' l7 -5 l7 6 l-7 6 z', 'fill="#241f1d"');
    }
    out += ln(20, -8, 32, -74, 'stroke="#7a6248" stroke-width="4"');
    out += pth('M28 -74 l14 -5 l3 12 l-14 5 z', 'fill="#8d9498" ' + K2);
    return out;
  };

  /* A board of tied luggage labels, written on and re-written. */
  PARTS.labelBoard = function (o) {
    var out = rect(-52, -40, 104, 80, 'rx="3" fill="' + (o.wood || '#3d2a1e') + '" ' + K4);
    out += ln(-46, -28, 46, -28, 'stroke="#8d8478" stroke-width="2"');
    var cols = ['#e0d3b0', '#d8c8a0', '#e8dcc0', '#cfc0a0', '#ded0ae'];
    var i, x, rot;
    for (i = 0; i < 5; i++) {
      x = -42 + i * 21; rot = (i % 2 ? 7 : -6);
      out += pth('M' + x + ' -26 v34 h16 v-28 l-8 -6 z', 'fill="' + cols[i] + '" ' + K2 +
        ' transform="rotate(' + rot + ' ' + (x + 8) + ' -26)"');
      out += pth('M' + (x + 3) + ' -14 h10 M' + (x + 3) + ' -8 h8 M' + (x + 3) + ' -2 h10',
        'stroke="#7a6a48" stroke-width="2" transform="rotate(' + rot + ' ' + (x + 8) + ' -26)"');
      out += circ(x + 8, -27, 2, 'fill="#8d8478"');
    }
    out += rect(-30, 22, 60, 12, 'rx="2" fill="#2a1f16" ' + K2);
    out += pth('M-24 28 h48', 'stroke="#8d8478" stroke-width="2"');
    return out;
  };

  /* The line diagram: a railway route, stations as beads on a string.
     Reads as a route in a way a coastline never does. */
  PARTS.routeChart = function (o) {
    var out = rect(-106, -73, 212, 146, 'rx="4" fill="' + (o.frame || '#3a2a1c') + '" ' + K5);
    out += rect(-94, -60, 188, 120, 'fill="url(#ecParch)"');
    out += pth('M-84 10 h60 l26 -30 h74', 'fill="none" stroke="#7a2f2f" stroke-width="5"');
    out += pth('M-24 10 l-22 34 h-52', 'fill="none" stroke="#3a5a7a" stroke-width="4" stroke-dasharray="8 6"');
    var stops = [[-84, 10], [-54, 10], [-24, 10], [12, -20], [48, -20], [78, -20], [-46, 44]];
    var i;
    for (i = 0; i < stops.length; i++) {
      out += circ(stops[i][0], stops[i][1], 5, 'fill="url(#ecParch)" stroke="#3a2a1a" stroke-width="3"');
      out += ln(stops[i][0], stops[i][1] - 9, stops[i][0] + 14, stops[i][1] - 22,
        'stroke="#8a7a58" stroke-width="2"');
      out += ln(stops[i][0] + 14, stops[i][1] - 22, stops[i][0] + 30, stops[i][1] - 22,
        'stroke="#8a7a58" stroke-width="2"');
    }
    out += circ(78, -20, 8, 'fill="#7a2f2f"');
    out += txt(-40, -44, 'THE LINE', MID + ' font-family="Georgia" font-size="15" letter-spacing="3" fill="#5d4718"');
    return out;
  };

  /* A domed steamer trunk, plastered with hotel labels. */
  PARTS.steamerTrunk = function (o) {
    var l = o.leather || '#6a4a32', b = o.band || '#3d2f22';
    var out = rect(-60, -58, 120, 58, 'rx="4" fill="' + l + '" ' + K4);
    var i;
    for (i = -40; i <= 40; i += 40) out += rect(i - 6, -58, 12, 58, 'fill="' + b + '"');
    out += rect(-60, -20, 120, 8, 'fill="' + b + '" fill-opacity=".8"');
    out += rect(-22, -34, 44, 20, 'rx="2" fill="#cfc0a0" ' + K2 + ' transform="rotate(-6 0 -24)"');
    out += pth('M-14 -26 h28 M-14 -20 h20', 'stroke="#8a7a58" stroke-width="2" transform="rotate(-6 0 -24)"');
    out += rect(20, -50, 26, 18, 'rx="2" fill="#b8c8c0" ' + K2 + ' transform="rotate(8 33 -41)"');
    out += pth('M-60 -58 q60 -30 120 0 z', 'id="chestLid" fill="' + l + '" ' + K3);
    out += pth('M-60 -58 q60 -30 120 0', 'fill="none" stroke="' + b + '" stroke-width="5"');
    out += rect(-12, -34, 24, 18, 'rx="3" class="fAccent" stroke="black" stroke-opacity=".5" stroke-width="2.5"');
    out += grp('id="chestOpenG" style="display:none"',
      pth('M-60 -58 q60 -30 120 0 z', 'fill="#0b0806"') +
      pth('M-60 -64 q60 -30 120 0 l0 8 q-60 -30 -120 0 z', 'fill="' + l + '" ' + K2 +
        ' transform="translate(0,-24) rotate(-7 -60 -64)"'));
    return out;
  };

  /* The sliding van door on its track. */
  PARTS.slideDoor = function (o) {
    var w = o.wood || '#4a3524', m = o.metal || '#39332c';
    var out = rect(-84, -294, 168, 12, 'rx="3" fill="' + m + '" ' + K3);
    out += rect(-70, -282, 140, 282, 'rx="2" fill="' + w + '" ' + K4);
    var i;
    for (i = -50; i <= 50; i += 25) out += ln(i, -278, i, -6, 'stroke="black" stroke-opacity=".34" stroke-width="3"');
    for (i = 0; i < 2; i++) {
      out += rect(-64, -30 - i * 108, 128, 12, 'rx="2" fill="' + m + '" fill-opacity=".9" ' + K2);
    }
    out += pth('M-60 -50 l120 -84', 'stroke="' + m + '" stroke-width="10" stroke-opacity=".85"');
    out += rect(-46, -262, 92, 46, 'rx="3" fill="#0a1018" ' + K3);
    for (i = -30; i <= 30; i += 20) out += rect(i - 4, -262, 8, 46, 'fill="' + m + '"');
    out += rect(-24, -158, 60, 22, 'rx="4" fill="' + m + '" ' + K2);
    out += circ(6, -147, 8, 'class="fAccent"');
    for (i = 0; i < 2; i++) out += circ(-44 + i * 88, -288, 6, 'fill="#8d8478"');
    return out + sigilBadge();
  };

  /* ---- THE ICEHOUSE ---- */

  /* A raked bed of sawdust. `stain` darkens one patch, which is all the
     operating theatre needs to make the same part mean something else. */
  PARTS.sawdustBed = function (o) {
    var c = o.fill || '#a8925e';
    var out = pth('M-118 -4 q34 -30 118 -30 q84 0 118 30 z', 'fill="' + c + '" ' + K3);
    var i;
    for (i = -100; i <= 100; i += 18) {
      out += pth('M' + i + ' -8 q4 -12 2 -20', 'fill="none" stroke="' + (o.rake || '#7d6a3e') +
        '" stroke-width="3" stroke-opacity=".8"');
    }
    if (o.stain) {
      out += ell(-24, -16, 40, 11, 'fill="' + o.stain + '" fill-opacity=".55"');
      out += ell(34, -12, 16, 6, 'fill="' + o.stain + '" fill-opacity=".4"');
    }
    for (i = 0; i < 14; i++) {
      out += circ(-108 + i * 16, -6 - (i % 4) * 7, 2.4, 'fill="#c9b078" fill-opacity=".7"');
    }
    return out;
  };

  /* A cut block, sweating, with the tongs still on it. */
  PARTS.iceBlock = function (o) {
    var c = o.ice || '#bfe0ea';
    var out = pth('M-28 0 v-52 l8 -10 h40 l8 10 v52 z', 'fill="' + c + '" fill-opacity=".55" ' + K3);
    out += pth('M-20 -62 h40 l8 10 h-56 z', 'fill="#e8f6fa" fill-opacity=".7" ' + K2);
    out += pth('M-14 -6 l10 -46 M6 -6 l8 -40 M-4 -30 l16 -12', 'fill="none" stroke="#ffffff" stroke-opacity=".35" stroke-width="3"');
    out += pth('M-24 -56 q10 -8 22 -2', 'fill="none" stroke="#ffffff" stroke-opacity=".5" stroke-width="3"');
    out += pth('M-22 -66 q10 -30 22 -14 M22 -66 q-10 -30 -22 -14', 'fill="none" stroke="#5b6a70" stroke-width="5"');
    out += circ(0, -80, 4, 'fill="#5b6a70"');
    out += pth('M0 -80 v-14', 'stroke="#5b6a70" stroke-width="5"');
    return out;
  };

  /* The delivery slate: houses down one side, pounds of ice down the
     other, chalked and half rubbed out. */
  PARTS.deliverySlate = function (o) {
    var out = rect(-52, -40, 104, 80, 'rx="3" fill="' + (o.frame || '#4a3d2c') + '" ' + K4);
    out += rect(-44, -32, 88, 64, 'fill="#252b2e"');
    var i, y;
    for (i = 0; i < 5; i++) {
      y = -22 + i * 13;
      out += ln(-38, y, -6 - (i % 3) * 6, y, 'stroke="#dcd8cc" stroke-width="2.4" stroke-opacity="' +
        (i === 3 ? 0.35 : 0.85) + '"');
      out += ln(10, y, 22 + (i % 2) * 8, y, 'stroke="#dcd8cc" stroke-width="2.4" stroke-opacity=".8"');
    }
    out += ln(2, -30, 2, 30, 'stroke="#dcd8cc" stroke-width="2" stroke-opacity=".6"');
    out += rect(30, 22, 10, 5, 'rx="2" fill="#e8e6dc"');
    return out;
  };

  /* The stack: blocks packed in straw, dark gaps between them, frost on
     every top edge. */
  PARTS.iceStack = function (o) {
    var c = o.ice || '#a8ccd8';
    var out = rect(-106, -73, 212, 146, 'rx="3" fill="#101c22" ' + K5);
    var r, k, x, y;
    for (r = 0; r < 3; r++) {
      for (k = 0; k < 4; k++) {
        x = -98 + k * 50 + (r % 2 ? 8 : 0); y = -64 + r * 46;
        out += rect(x, y, 44, 40, 'rx="2" fill="' + c + '" fill-opacity="' + (0.62 - r * 0.08).toFixed(2) +
          '" ' + K2);
        out += ln(x + 3, y + 3, x + 40, y + 3, 'stroke="#eaf6fa" stroke-opacity=".5" stroke-width="3"');
        out += ln(x + 9, y + 34, x + 16, y + 10, 'stroke="#ffffff" stroke-opacity=".25" stroke-width="4"');
      }
      for (k = 0; k < 22; k++) {
        out += ln(-100 + k * 9, y + 41, -94 + k * 9, y + 45,
          'stroke="#c9b078" stroke-width="2" stroke-opacity=".65"');
      }
    }
    return out;
  };

  /* A ledged and braced plank door with a big cold-store latch. */
  PARTS.braceDoor = function (o) {
    var w = o.wood || '#5a4530', m = o.iron || '#3a3630';
    var out = rect(-70, -282, 140, 282, 'rx="3" fill="' + w + '" ' + K4);
    var i;
    for (i = -46; i <= 46; i += 23) out += ln(i, -276, i, -6, 'stroke="black" stroke-opacity=".36" stroke-width="3"');
    out += rect(-66, -256, 132, 15, 'rx="2" fill="' + m + '" ' + K2);
    out += rect(-66, -40, 132, 15, 'rx="2" fill="' + m + '" ' + K2);
    out += pth('M-62 -46 l124 -196', 'stroke="' + m + '" stroke-width="13" stroke-opacity=".9"');
    out += rect(-58, -150, 116, 26, 'rx="3" fill="' + m + '" ' + K3);
    out += circ(-30, -137, 8, 'class="fAccent"');
    out += rect(10, -146, 40, 18, 'rx="3" fill="#8d9498" ' + K2);
    out += pth('M14 -137 h32', 'stroke="#2f2a26" stroke-width="3"');
    if (o.frost) {
      out += pth('M-70 -282 h140 M-70 -6 h140', 'stroke="' + o.frost + '" stroke-width="7" stroke-opacity=".55"');
      for (i = 0; i < 9; i++) {
        out += pth('M' + (-62 + i * 16) + ' -276 l3 14 l3 -14 z', 'fill="' + o.frost + '" fill-opacity=".5"');
      }
    }
    return out + sigilBadge();
  };

  /* ---- THE TOY WORKSHOP ---- */

  /* A rocking horse. Dapples, a red saddle and a rope tail: the one
     object in the file a three-year-old could name. */
  PARTS.rockingHorse = function (o) {
    var w = o.wood || '#c9b08a';
    var out = pth('M-34 -4 q34 -18 68 0', 'fill="none" stroke="' + (o.rocker || '#8a6a44') +
      '" stroke-width="8" stroke-linecap="round"');
    out += ln(-20, -10, -18, -34, 'stroke="' + (o.rocker || '#8a6a44') + '" stroke-width="5"');
    out += ln(20, -10, 18, -34, 'stroke="' + (o.rocker || '#8a6a44') + '" stroke-width="5"');
    out += ell(0, -52, 30, 15, 'fill="' + w + '" ' + K3);
    out += pth('M-28 -34 l4 -14 M24 -34 l-2 -14', 'stroke="' + w + '" stroke-width="7" stroke-linecap="round"');
    out += pth('M-20 -60 q-12 -18 -14 -30 q10 4 16 0 q6 10 12 12 z', 'fill="' + w + '" ' + K3);
    out += pth('M-32 -92 q-6 -8 2 -10 q4 6 8 6', 'fill="' + w + '" ' + K2);
    out += circ(-30, -86, 2.4, 'fill="#1a1208"');
    out += pth('M-22 -88 q-4 -14 6 -18 q-2 12 4 16 z', 'fill="' + (o.mane || '#8a3a3a') + '"');
    out += pth('M28 -60 q16 6 12 24', 'fill="none" stroke="' + (o.mane || '#8a3a3a') +
      '" stroke-width="5" stroke-linecap="round"');
    out += pth('M-12 -62 q12 -8 24 0 l-2 12 h-20 z', 'fill="' + (o.saddle || '#b4342e') + '" ' + K2);
    var i;
    for (i = 0; i < 4; i++) out += circ(-14 + i * 11, -48 + (i % 2) * 8, 3, 'fill="#8a6a44" fill-opacity=".5"');
    return out;
  };

  /* Three marionettes hanging from a rail by their strings. */
  PARTS.puppetRack = function (o) {
    var out = rect(-52, -40, 104, 80, 'rx="3" fill="' + (o.wood || '#4a3a2a') + '" fill-opacity=".9" ' + K4);
    out += rect(-48, -34, 96, 7, 'rx="2" fill="' + (o.rail || '#8a6a44') + '" ' + K2);
    var cols = ['#5a86b8', '#b4342e', '#4a8a5a'], i, x;
    for (i = 0; i < 3; i++) {
      x = -30 + i * 30;
      out += ln(x - 6, -27, x, -14, 'stroke="#d8cfb0" stroke-width="1.6"');
      out += ln(x + 6, -27, x, -14, 'stroke="#d8cfb0" stroke-width="1.6"');
      out += circ(x, -9, 6.5, 'fill="#e0c9a8" ' + K2);
      out += pth('M' + (x - 7) + ' -2 h14 l-2 18 h-10 z', 'fill="' + cols[i] + '" ' + K2);
      out += pth('M' + (x - 7) + ' 2 l-9 12 M' + (x + 7) + ' 2 l9 12',
        'stroke="' + cols[i] + '" stroke-width="4" stroke-linecap="round"');
      out += pth('M' + (x - 4) + ' 16 l-3 14 M' + (x + 4) + ' 16 l3 14',
        'stroke="#e0c9a8" stroke-width="4" stroke-linecap="round"');
      out += circ(x, -12, 2, 'fill="#3a2a1a"');
    }
    return out;
  };

  /* The alphabet chart: big letters and one duck. Legible at any size,
     which is the entire brief for a wall panel. */
  PARTS.alphabetChart = function (o) {
    var out = rect(-106, -73, 212, 146, 'rx="4" fill="' + (o.frame || '#4a3524') + '" ' + K5);
    out += rect(-94, -61, 188, 122, 'fill="url(#ecParch)"');
    var rows = ['A B C D E', 'F G H I J'];
    var i;
    for (i = 0; i < rows.length; i++) {
      out += txt(0, -24 + i * 34, rows[i], MID + ' font-family="Georgia" font-size="27" ' +
        'letter-spacing="4" fill="' + (o.ink || '#5d4718') + '"');
    }
    out += ell(-42, 36, 22, 13, 'fill="#e8c44a" ' + K2);
    out += circ(-58, 24, 9, 'fill="#e8c44a" ' + K2);
    out += pth('M-66 24 l-12 3 l12 4 z', 'fill="#d8853a"');
    out += circ(-60, 22, 1.8, 'fill="#2a1f10"');
    out += pth('M14 40 h56 M14 30 h40', 'stroke="#8a7a58" stroke-width="3"');
    out += pth('M28 -54 q14 -12 28 0 q-14 12 -28 0 z', 'fill="#b4342e" fill-opacity=".7"');
    return out;
  };

  /* Paint tins with the brushes standing in a jar. */
  PARTS.paintShelf = function (o) {
    var out = rect(-76, 14, 152, 10, 'rx="2" fill="' + (o.wood || '#6a5238') + '" ' + K3);
    var cols = ['#b4342e', '#2a5fa0', '#d8b032', '#4a8a5a'];
    var i, x;
    for (i = 0; i < 4; i++) {
      x = -68 + i * 26;
      out += rect(x, -8, 21, 22, 'rx="2" fill="#9aa2a6" ' + K2);
      out += rect(x - 2, -12, 25, 6, 'rx="2" fill="' + cols[i] + '" ' + K2);
      out += pth('M' + (x + 4) + ' -6 q3 12 0 18', 'fill="none" stroke="' + cols[i] + '" stroke-width="3"');
    }
    out += rect(44, -12, 26, 26, 'rx="3" fill="#cfd8dc" fill-opacity=".5" ' + K2);
    for (i = 0; i < 4; i++) {
      out += ln(48 + i * 6, -12, 46 + i * 7, -34, 'stroke="#8a6a44" stroke-width="3"');
      out += ln(46 + i * 7, -34, 45 + i * 7, -40, 'stroke="' + cols[i] + '" stroke-width="4"');
    }
    return out;
  };

  /* ---- THE OPERATING THEATRE ---- */

  /* An anatomical skull on a bracket. */
  PARTS.skullMount = function (o) {
    var b = o.bone || '#ddd2b4';
    var out = rect(-26, 24, 52, 8, 'rx="2" fill="#4a3d2c" ' + K2);
    out += pth('M-24 6 q-4 -32 24 -32 q28 0 24 32 q-2 12 -10 14 l-28 0 q-8 -2 -10 -14 z',
      'fill="' + b + '" ' + K3);
    out += pth('M-16 20 q16 8 32 0 l-2 6 q-14 5 -28 0 z', 'fill="' + b + '" ' + K2);
    out += ell(-11, 0, 8, 9, 'fill="#171208"') + ell(11, 0, 8, 9, 'fill="#171208"');
    out += pth('M0 6 l-6 12 h12 z', 'fill="#171208"');
    var i;
    for (i = -12; i <= 12; i += 6) out += ln(i, 20, i, 26, 'stroke="#6a5b3c" stroke-width="2"');
    out += pth('M-22 -12 q22 -14 44 0', 'fill="none" stroke="#a8987a" stroke-width="2" stroke-opacity=".7"');
    return out;
  };

  /* A wall chart of the muscles, with leader lines to a numbered key. */
  PARTS.anatomyChart = function (o) {
    var out = rect(-52, -40, 104, 80, 'rx="2" fill="' + (o.frame || '#3d3226') + '" ' + K4);
    out += rect(-46, -34, 92, 68, 'fill="url(#ecParch)"');
    out += circ(-16, -20, 8, 'fill="#a8565a" ' + K2);
    out += pth('M-16 -12 q-12 10 -10 26 M-16 -12 q12 10 10 26', 'fill="none" stroke="#a8565a" stroke-width="5"');
    out += pth('M-24 -8 l-10 16 M-8 -8 l10 16', 'fill="none" stroke="#a8565a" stroke-width="4"');
    var i;
    for (i = 0; i < 4; i++) {
      out += pth('M-26 ' + (-12 + i * 8) + ' q10 4 20 0', 'fill="none" stroke="#7a3a3e" stroke-width="2"');
    }
    for (i = 0; i < 3; i++) {
      out += ln(-6, -18 + i * 14, 16, -22 + i * 14, 'stroke="#7a6a48" stroke-width="1.6"');
      out += ln(16, -22 + i * 14, 40, -22 + i * 14, 'stroke="#7a6a48" stroke-width="1.6"');
      out += circ(16, -22 + i * 14, 2, 'fill="#5d4718"');
    }
    return out;
  };

  /* The articulated skeleton in its case. Hung from a rod through the
     skull, which is how they actually stood, and reads as a MOUNT rather
     than as a picture of a skeleton. */
  PARTS.skeletonCase = function (o) {
    var b = o.bone || '#ded2b2';
    var out = rect(-106, -73, 212, 146, 'rx="4" fill="' + (o.wood || '#3a3026') + '" ' + K5);
    out += rect(-94, -61, 188, 122, 'fill="#16120c"');
    out += ln(-40, -61, -40, -52, 'stroke="#8d9498" stroke-width="3"');
    out += circ(-40, -44, 11, 'fill="' + b + '" ' + K2);
    out += ell(-43, -42, 2.6, 3.4, 'fill="#16120c"') + ell(-37, -42, 2.6, 3.4, 'fill="#16120c"');
    out += ln(-40, -33, -40, 6, 'stroke="' + b + '" stroke-width="5"');
    var i;
    for (i = 0; i < 5; i++) {
      out += pth('M-40 ' + (-28 + i * 7) + ' q-16 4 -18 12 M-40 ' + (-28 + i * 7) + ' q16 4 18 12',
        'fill="none" stroke="' + b + '" stroke-width="2.6"');
    }
    out += pth('M-52 6 h24 l-4 12 h-16 z', 'fill="' + b + '" ' + K2);
    out += pth('M-56 -26 l-14 30 l6 26 M-24 -26 l14 30 l-6 26', 'fill="none" stroke="' + b + '" stroke-width="4"');
    out += pth('M-46 18 l-6 34 l2 8 M-34 18 l6 34 l-2 8', 'fill="none" stroke="' + b + '" stroke-width="5"');
    out += rect(-64, 56, 48, 6, 'rx="2" fill="#4a4032"');
    out += rect(-94, -61, 188, 122, 'fill="url(#ecGlass)"');
    out += ln(10, -61, 10, 61, 'stroke="' + (o.wood || '#3a3026') + '" stroke-width="7"');
    out += pth('M20 56 l54 -110', 'stroke="#ffffff" stroke-opacity=".12" stroke-width="12"');
    return out;
  };

  /* The instrument tray: a bone saw, two knives, forceps, a trepan. */
  PARTS.instrumentTray = function (o) {
    var m = o.metal || '#c2c8cc';
    var out = rect(-76, 8, 152, 16, 'rx="3" fill="#3f4a4e" ' + K3);
    out += rect(-72, 4, 144, 6, 'fill="#5d6a6e"');
    out += pth('M-66 4 v-30 h6 v26 h40 v-26 h6 v30 z', 'fill="' + m + '" ' + K2);
    out += rect(-62, -14, 44, 5, 'fill="' + m + '"');
    out += pth('M-6 4 l-4 -26 l10 4 l2 22 z', 'fill="' + m + '" ' + K2);
    out += pth('M10 4 l0 -24 l9 3 l1 21 z', 'fill="' + m + '" ' + K2);
    out += pth('M34 4 q-6 -18 4 -26 M44 4 q6 -18 -4 -26', 'fill="none" stroke="' + m + '" stroke-width="4"');
    out += circ(62, -12, 11, 'fill="none" stroke="' + m + '" stroke-width="4"');
    var i;
    for (i = 0; i < 8; i++) {
      out += ln(62, -12, (62 + 11 * Math.cos(i * Math.PI / 4)).toFixed(1),
        (-12 + 11 * Math.sin(i * Math.PI / 4)).toFixed(1), 'stroke="' + m + '" stroke-width="2"');
    }
    return out;
  };

  /* The table itself: a scrubbed board with a drainage groove, leather
     straps and a head block. It stands where the desk stands. */
  PARTS.operatingTable = function (o) {
    var w = o.wood || '#6a5236';
    var out = rect(-150, -110, 300, 20, 'rx="3" fill="' + w + '" ' + K3);
    out += pth('M-140 -104 h280', 'stroke="black" stroke-opacity=".35" stroke-width="4"');
    out += rect(-150, -122, 46, 14, 'rx="4" fill="' + w + '" ' + K2);
    out += rect(-126, -90, 26, 90, 'fill="' + w + '" fill-opacity=".85"');
    out += rect(100, -90, 26, 90, 'fill="' + w + '" fill-opacity=".85"');
    out += rect(-126, -44, 252, 10, 'fill="' + w + '" fill-opacity=".6"');
    var i;
    for (i = 0; i < 2; i++) {
      out += rect(-70 + i * 96, -114, 16, 26, 'rx="3" fill="' + (o.strap || '#4a3324') + '" ' + K2);
      out += circ(-62 + i * 96, -100, 3.4, 'fill="#8d9498"');
    }
    out += pth('M120 -90 q18 26 4 90', 'fill="none" stroke="#5a5450" stroke-width="5"');
    out += ell(126, -2, 14, 5, 'fill="#3a3a38"');
    return out;
  };

  /* Gas bracket with a mantle and an etched globe. */
  PARTS.gasMantle = function (o) {
    var b = o.brass || '#b8913f';
    return glow(0, -70, 100) +
      ln(0, -160, 0, -122, 'stroke="' + b + '" stroke-width="4"') +
      pth('M0 -122 q0 -14 -14 -16 l-30 0', 'fill="none" stroke="' + b + '" stroke-width="5"') +
      circ(0, -104, 9, 'fill="none" stroke="' + b + '" stroke-width="4"') +
      pth('M-24 -96 q24 -18 48 0 l-8 44 q-16 10 -32 0 z',
        'fill="#fff3d0" fill-opacity=".16" stroke="' + b + '" stroke-opacity=".7" stroke-width="3"') +
      pth('M-24 -96 q24 -10 48 0', 'fill="none" stroke="' + b + '" stroke-width="4"') +
      pth('M0 -92 q13 12 8 26 q-8 12 -8 12 q0 0 -8 -12 q-5 -14 8 -26',
        'id="flame" fill="#fff0c0" stroke="#ffd98a" stroke-width="2"');
  };

  /* ---- THE RADIO STATION ---- */

  /* A ribbon microphone on a floor stand. The one object on this list
     that a player will name before they finish looking at it. */
  PARTS.micStand = function (o) {
    var m = o.metal || '#9aa2a6';
    var out = ell(0, -3, 26, 8, 'fill="#2a2e30" ' + K2);
    out += rect(-22, -12, 44, 9, 'rx="4" fill="' + m + '" ' + K2);
    out += rect(-4, -84, 8, 74, 'rx="3" fill="' + m + '" ' + K2);
    out += rect(-9, -60, 18, 8, 'rx="3" fill="#4a5054"');
    out += pth('M-20 -96 a20 22 0 0 1 40 0', 'fill="none" stroke="' + m + '" stroke-width="4"');
    out += rect(-14, -112, 28, 32, 'rx="7" fill="#2f3336" ' + K3);
    var i;
    for (i = 0; i < 5; i++) out += ln(-10, -106 + i * 6, 10, -106 + i * 6, 'stroke="' + m + '" stroke-width="2.4"');
    out += rect(-7, -78, 14, 5, 'rx="2" fill="' + m + '"');
    out += ln(-20, -94, -22, -84, 'stroke="' + m + '" stroke-width="3"');
    out += ln(20, -94, 22, -84, 'stroke="' + m + '" stroke-width="3"');
    return out;
  };

  /* ON AIR. Lit, boxed and unambiguous. */
  PARTS.onAirSign = function (o) {
    var out = rect(-52, -26, 104, 52, 'rx="6" fill="#17171b" ' + K4);
    out += rect(-45, -19, 90, 38, 'rx="3" fill="' + (o.lamp || '#8a1a12') + '"');
    out += rect(-45, -19, 90, 38, 'rx="3" fill="url(#ecGlow)"');
    out += txt(0, 7, 'ON AIR', MID + ' font-family="Georgia" font-size="21" letter-spacing="2" fill="' +
      (o.ink || '#ffb49a') + '"');
    out += rect(-20, -32, 40, 7, 'rx="2" fill="#3a3a40" ' + K2);
    return out;
  };

  /* The transmitter bay: glowing valves over meters over a patch panel. */
  PARTS.valveRack = function (o) {
    var m = o.metal || '#3a4046';
    var out = rect(-106, -73, 212, 146, 'rx="3" fill="' + m + '" ' + K5);
    out += rect(-96, -64, 192, 44, 'rx="2" fill="#14181c"');
    var i, x;
    for (i = 0; i < 6; i++) {
      x = -84 + i * 32;
      out += rect(x, -56, 20, 30, 'rx="9" fill="#ffb04c" fill-opacity=".22" stroke="#c8ced0" stroke-width="2"');
      out += pth('M' + (x + 6) + ' -30 q4 -16 8 0', 'fill="none" stroke="#ffb04c" stroke-width="2.6"');
      out += rect(x + 2, -28, 16, 6, 'fill="#6a6055"');
    }
    out += rect(-96, -14, 192, 38, 'rx="2" fill="#1b2024"');
    for (i = 0; i < 2; i++) {
      out += circ(-70 + i * 40, 6, 14, 'fill="#e6e2d6" ' + K2);
      out += ln(-70 + i * 40, 6, -60 + i * 40, -3, 'stroke="#1c1c1c" stroke-width="2.5"');
    }
    for (i = 0; i < 5; i++) {
      out += circ(6 + i * 20, 6, 7, 'fill="#4a5054" ' + K2) + ln(6 + i * 20, 6, 6 + i * 20, -1,
        'stroke="#d8d2c4" stroke-width="2.5"');
    }
    out += rect(-96, 30, 192, 34, 'rx="2" fill="#14181c"');
    for (i = 0; i < 12; i++) {
      out += circ(-86 + i * 16, 40, 4, 'fill="#0a0c0e" stroke="#6a7276" stroke-width="2"');
      out += circ(-86 + i * 16, 56, 4, 'fill="#0a0c0e" stroke="#6a7276" stroke-width="2"');
    }
    out += pth('M-70 40 q26 26 42 0', 'fill="none" stroke="#c8483a" stroke-width="4"');
    out += pth('M10 56 q22 -20 44 -16', 'fill="none" stroke="#3a6a9a" stroke-width="4"');
    return out;
  };

  /* A shelf of transcription discs, sleeved, with one face out. */
  PARTS.discShelf = function (o) {
    var out = rect(-76, 14, 152, 10, 'rx="2" fill="' + (o.wood || '#4a4038') + '" ' + K3);
    var cols = ['#8a7a5a', '#6a6a70', '#7a5a4a', '#5a6a6a'];
    var i, x;
    for (i = 0; i < 12; i++) {
      x = -70 + i * 7;
      out += rect(x, -22, 6, 36, 'fill="' + cols[i % cols.length] + '" ' + K2 +
        (i > 8 ? ' transform="rotate(7 ' + (x + 3) + ' 14)"' : ''));
    }
    out += circ(34, -4, 19, 'fill="#17171a" ' + K2);
    for (i = 1; i < 4; i++) out += circ(34, -4, i * 4.4, 'fill="none" stroke="#4a4a50" stroke-width="1.4"');
    out += circ(34, -4, 7, 'fill="' + (o.label || '#c8a44a') + '"');
    out += circ(34, -4, 1.6, 'fill="#17171a"');
    return out;
  };

  /* The padded studio door: quilted leather, a port, and a lamp over it. */
  PARTS.studioDoor = function (o) {
    var l = o.pad || '#4a3730';
    var out = rect(-70, -282, 140, 282, 'rx="4" fill="' + l + '" ' + K4);
    var i, j;
    for (i = -3; i <= 3; i++) {
      out += ln(i * 40, -282, i * 40 + 140, -6, 'stroke="black" stroke-opacity=".22" stroke-width="2"');
      out += ln(i * 40, -282, i * 40 - 140, -6, 'stroke="black" stroke-opacity=".22" stroke-width="2"');
    }
    for (j = 0; j < 6; j++) {
      for (i = 0; i < 4; i++) {
        out += circ(-52 + i * 35 + (j % 2 ? 17 : 0), -252 + j * 44, 3.4, 'fill="#8a6a4a" fill-opacity=".8"');
      }
    }
    out += circ(0, -196, 32, 'fill="#2a2226" ' + K3);
    out += circ(0, -196, 23, 'fill="#0d1418"');
    out += pth('M-23 -196 a23 23 0 0 0 46 0', 'fill="#8fe4ff" fill-opacity=".10"');
    out += circ(-8, -204, 6, 'fill="#ffffff" fill-opacity=".12"');
    out += rect(-14, -122, 46, 20, 'rx="4" fill="#8d9498" ' + K2);
    out += circ(-24, -112, 8, 'class="fAccent"');
    out += rect(-70, -282, 140, 14, 'rx="3" fill="#26201e"');
    return out + sigilBadge();
  };

  /* The console: a sloped control panel of faders and knobs, standing in
     the anchor slot with the drawer under it. */
  PARTS.mixDesk = function (o) {
    var m = o.metal || '#33383c';
    var out = rect(-150, -110, 300, 16, 'rx="2" fill="' + m + '" ' + K3);
    out += rect(-134, -94, 20, 94, 'fill="#292d30"') + rect(114, -94, 20, 94, 'fill="#292d30"');
    out += rect(-134, -40, 268, 9, 'fill="#292d30"');
    out += pth('M-124 -110 l10 -46 h228 l10 46 z', 'fill="' + (o.panel || '#4a5054') + '" ' + K3);
    var i;
    for (i = 0; i < 8; i++) {
      out += circ(-100 + i * 18, -142, 6, 'fill="#22262a" ' + K2);
      out += ln(-100 + i * 18, -142, -100 + i * 18 + (i % 3) * 2 - 2, -148, 'stroke="#d8d2c4" stroke-width="2"');
    }
    for (i = 0; i < 5; i++) {
      out += rect(52 + i * 15, -152, 6, 30, 'rx="2" fill="#22262a"');
      out += rect(50 + i * 15, -142 + (i % 3) * 7, 10, 6, 'rx="2" fill="#c8ced0"');
    }
    out += rect(-120, -152, 34, 26, 'rx="3" fill="#e6e2d6" ' + K2);
    out += ln(-103, -132, -95, -145, 'stroke="#1c1c1c" stroke-width="2.5"');
    return out;
  };

  /* ---- THE BELL TOWER ---- */

  /* A hand bell standing mouth-down on the boards. */
  PARTS.handBell = function (o) {
    var b = o.bronze || '#a8843c';
    return pth('M-24 0 q-2 -42 24 -54 q26 12 24 54 z', 'fill="' + b + '" ' + K3) +
      ell(0, 0, 24, 6, 'fill="#5d4718" fill-opacity=".8"') +
      pth('M-17 -14 q17 6 34 0', 'fill="none" stroke="#6a5324" stroke-width="3"') +
      pth('M-10 -56 q10 -8 20 0 z', 'fill="' + b + '" ' + K2) +
      rect(-6, -84, 12, 30, 'rx="5" fill="' + (o.grip || '#5c3f22') + '" ' + K2) +
      pth('M-6 -76 h12 M-6 -66 h12', 'stroke="black" stroke-opacity=".3" stroke-width="2"') +
      pth('M-16 -34 q16 8 32 0', 'fill="none" stroke="#f0d78a" stroke-opacity=".5" stroke-width="2"');
  };

  /* The back of the tower clock dial: a translucent glass face seen from
     inside, numerals reversed, with the leading-off rod. */
  PARTS.dialBack = function (o) {
    var f = o.frame || '#5a5044';
    var out = circ(0, 0, 36, 'fill="' + f + '" ' + K5);
    out += circ(0, 0, 29, 'fill="#cfd8dc" fill-opacity=".30"');
    var i;
    for (i = 0; i < 12; i++) {
      var a = i * Math.PI / 6;
      out += ln((22 * Math.cos(a)).toFixed(1), (22 * Math.sin(a)).toFixed(1),
                (28 * Math.cos(a)).toFixed(1), (28 * Math.sin(a)).toFixed(1),
                'stroke="#2b2620" stroke-width="' + (i % 3 ? 2 : 3.6) + '" stroke-opacity=".7"');
    }
    out += ln(0, 0, -12, -16, 'stroke="#2b2620" stroke-width="3.5" stroke-linecap="round"');
    out += ln(0, 0, 15, 8, 'stroke="#2b2620" stroke-width="3.5" stroke-linecap="round"');
    out += circ(0, 0, 6, 'fill="#8d8478" ' + K2);
    out += ln(0, 6, 0, 40, 'stroke="#8d8478" stroke-width="5"');
    out += rect(-9, 38, 18, 8, 'rx="2" fill="#8d8478" ' + K2);
    return out;
  };

  /* Ivy pushing in through a broken louvre slat. */
  PARTS.ivyBreak = function (o) {
    var w = o.wood || '#6a6154';
    var out = rect(-52, -40, 104, 80, 'fill="#0b0f12"');
    var i;
    for (i = 0; i < 5; i++) {
      var y = -34 + i * 17;
      if (i === 2) {
        out += pth('M-52 ' + y + ' l34 -8 l6 12 l-40 8 z', 'fill="' + w + '" ' + K2);
        out += pth('M22 ' + (y - 12) + ' l30 -6 l0 12 l-26 6 z', 'fill="' + w + '" ' + K2);
      } else {
        out += pth('M-52 ' + y + ' l104 -20 l0 12 l-104 20 z', 'fill="' + w + '" ' + K2);
      }
    }
    out += pth('M-30 40 q10 -30 -2 -44 q22 8 26 -14 q4 22 22 14',
      'fill="none" stroke="' + (o.vine || '#4a7a4a') + '" stroke-width="5" stroke-linecap="round"');
    var leaves = [[-30, 22], [-24, -2], [-6, -22], [12, -6], [16, -28], [2, 26]];
    for (i = 0; i < leaves.length; i++) {
      out += pth('M0 0 q-11 -10 0 -18 q11 8 0 18 z', 'fill="' + (o.leaf || '#5f9a52') +
        '" transform="translate(' + leaves[i][0] + ',' + leaves[i][1] + ') rotate(' + (i * 47) + ')"');
    }
    out += rect(-52, -40, 104, 80, 'fill="none" ' + K3);
    return out;
  };

  /* The bell, hung dead in its headstock, with its wheel and rope. */
  PARTS.greatBell = function (o) {
    var b = o.bronze || '#9a7a3c';
    var out = rect(-58, -73, 116, 18, 'rx="3" fill="' + (o.wood || '#5a5246') + '" ' + K3);
    out += pth('M-10 -55 q10 -10 20 0 z', 'fill="' + b + '" ' + K2);
    out += pth('M-56 52 q-6 -74 56 -100 q62 26 56 100 z', 'fill="' + b + '" ' + K4);
    out += pth('M-56 52 q56 16 112 0 l0 12 q-56 16 -112 0 z', 'fill="' + b + '" ' + K3);
    out += pth('M-46 6 q46 14 92 0 M-50 26 q50 16 100 0', 'fill="none" stroke="#6a5324" stroke-width="3"');
    out += txt(0, 22, '✦ ✦ ✦', MID + ' font-size="13" fill="#6a5324" fill-opacity=".8"');
    out += ell(0, 62, 9, 11, 'fill="#5d4718" ' + K2);
    out += circ(66, -6, 40, 'fill="none" stroke="' + (o.wood || '#5a5246') + '" stroke-width="9"');
    var i;
    for (i = 0; i < 6; i++) {
      out += ln(66, -6, (66 + 36 * Math.cos(i * Math.PI / 3)).toFixed(1),
        (-6 + 36 * Math.sin(i * Math.PI / 3)).toFixed(1),
        'stroke="' + (o.wood || '#5a5246') + '" stroke-width="4"');
    }
    out += pth('M100 -14 q14 34 -4 66', 'fill="none" stroke="' + (o.rope || '#b8a878') + '" stroke-width="5"');
    out += pth('M-56 -55 q56 -22 112 0', 'fill="none" stroke="#f0d78a" stroke-opacity=".35" stroke-width="4"');
    return out;
  };

  /* =====================================================================
     BACKDROPS
     ---------------------------------------------------------------------
     The single biggest contributor to "which room am I in". Furniture can
     be swapped all day and a flat wall still reads as the same box, so
     each setting gets its own wall and floor treatment.

     The whole backdrop is pointer-events:none. Nothing listens on it, and
     an overlay that eats taps is precisely bug #1 from the July build.
     ===================================================================== */
  var BACKDROPS = {};

  function base(extraWall, extraFloor) {
    return grp(NOHIT,
      rect(0, 0, 800, 400, 'class="fWall"') +
      (extraWall || '') +
      rect(0, 0, 800, 400, 'fill="url(#ecGlow)" opacity=".22"') +
      rect(0, 392, 800, 10, 'class="fWall2"') +
      rect(0, 400, 800, 160, 'class="fFloorA"') +
      (extraFloor || ''));
  }

  /* Coursed stone blocks, a damp streak, a concrete floor with a channel
     running to a drain. */
  BACKDROPS.cellBlock = function () {
    var w = '', f = '', i, j;
    for (j = 0; j < 8; j++) {
      w += ln(0, j * 50, 800, j * 50, 'stroke="black" stroke-opacity=".32" stroke-width="3"');
      for (i = 0; i < 10; i++) {
        w += ln(i * 90 + (j % 2 ? 45 : 0), j * 50, i * 90 + (j % 2 ? 45 : 0), j * 50 + 50,
          'stroke="black" stroke-opacity=".26" stroke-width="3"');
      }
    }
    w += pth('M120 0 q14 90 -6 170 q-12 60 4 130', 'fill="none" stroke="black" stroke-opacity=".2" stroke-width="16"');
    w += pth('M612 0 q-10 70 6 140', 'fill="none" stroke="black" stroke-opacity=".16" stroke-width="12"');
    f += ln(0, 452, 800, 452, 'stroke="black" stroke-opacity=".3" stroke-width="3"');
    f += ln(0, 516, 800, 516, 'stroke="black" stroke-opacity=".3" stroke-width="3"');
    f += pth('M0 484 h800', 'stroke="black" stroke-opacity=".45" stroke-width="9"');
    return base(w, f);
  };

  /* Horizontal hull planking, two curved deck ribs, plank floor. */
  BACKDROPS.hull = function () {
    var w = '', f = '', i;
    for (i = 0; i < 10; i++) {
      w += ln(0, i * 44, 800, i * 44 - 6, 'stroke="black" stroke-opacity=".3" stroke-width="3"');
    }
    for (i = 0; i < 3; i++) {
      var x = 60 + i * 330;
      w += pth('M' + x + ' 0 q-22 200 6 392', 'fill="none" class="fFloorB" stroke-width="26" stroke-opacity=".85"');
      w += pth('M' + x + ' 0 q-22 200 6 392', 'fill="none" stroke="black" stroke-opacity=".35" stroke-width="3"');
    }
    for (i = 1; i < 12; i++) {
      f += ln(i * 70 - 20, 402, i * 70 - 60, 560, 'stroke="black" stroke-opacity=".3" stroke-width="3"');
    }
    f += ln(0, 470, 800, 470, 'stroke="black" stroke-opacity=".25" stroke-width="3"');
    return base(w, f);
  };

  /* Big sandstone blocks with a painted glyph frieze near the ceiling. */
  BACKDROPS.sandstone = function () {
    var w = '', f = '', i, j;
    for (j = 0; j < 6; j++) {
      w += ln(0, j * 66 + 96, 800, j * 66 + 96, 'stroke="black" stroke-opacity=".3" stroke-width="3"');
      for (i = 0; i < 7; i++) {
        w += ln(i * 120 + (j % 2 ? 60 : 0), j * 66 + 96, i * 120 + (j % 2 ? 60 : 0), j * 66 + 162,
          'stroke="black" stroke-opacity=".24" stroke-width="3"');
      }
    }
    w += rect(0, 0, 800, 92, 'class="fFloorB"');
    w += rect(0, 86, 800, 8, 'fill="black" fill-opacity=".4"');
    var g = ['M0 0 h12 v18 h-12 z', 'M0 16 l8 -16 l8 16 z', 'M0 8 q8 -14 16 0 q-8 14 -16 0 z',
             'M0 0 h16 M8 0 v18', 'M0 18 q8 -20 16 0', 'M0 2 h16 v12 h-16 z'];
    for (i = 0; i < 34; i++) {
      w += pth(g[i % g.length], 'fill="none" stroke="#000" stroke-opacity=".38" stroke-width="3" ' +
        'transform="translate(' + (14 + i * 23) + ',34)"');
    }
    for (i = 0; i < 60; i++) {
      f += circ((i * 137) % 790 + 5, 410 + ((i * 53) % 145), 1.8 + (i % 3), 'fill="black" fill-opacity=".22"');
    }
    return base(w, f);
  };

  /* Small square wall tiles, a splashback band, seamed vinyl floor. */
  BACKDROPS.tiled = function () {
    var w = '', f = '', i, j;
    for (i = 0; i <= 800; i += 40) w += ln(i, 0, i, 392, 'stroke="black" stroke-opacity=".2" stroke-width="2"');
    for (j = 0; j <= 392; j += 40) w += ln(0, j, 800, j, 'stroke="black" stroke-opacity=".2" stroke-width="2"');
    w += rect(0, 232, 800, 12, 'fill="#8fd8e4" fill-opacity=".12"');
    w += rect(0, 0, 800, 46, 'fill="black" fill-opacity=".22"');
    for (i = 0; i < 5; i++) {
      w += rect(i * 170 + 24, 12, 120, 20, 'rx="10" fill="#e8f4f2" fill-opacity=".10"');
    }
    for (i = 1; i < 8; i++) f += ln(i * 100, 402, i * 100 - 26, 560, 'stroke="black" stroke-opacity=".22" stroke-width="3"');
    f += ln(0, 466, 800, 466, 'stroke="black" stroke-opacity=".22" stroke-width="3"');
    f += ln(0, 524, 800, 524, 'stroke="black" stroke-opacity=".22" stroke-width="3"');
    return base(w, f);
  };

  /* Brass plates, rivets, and a gear train turning behind everything. */
  BACKDROPS.brassworks = function () {
    var w = '', f = '', i, j;
    for (j = 0; j < 4; j++) {
      w += ln(0, j * 100 + 46, 800, j * 100 + 46, 'stroke="black" stroke-opacity=".34" stroke-width="4"');
      for (i = 0; i < 20; i++) w += circ(i * 42 + 20, j * 100 + 56, 3.4, 'fill="black" fill-opacity=".3"');
    }
    var gears = [[70, 66, 54, 14], [176, 118, 34, 10], [720, 52, 46, 12], [640, 122, 26, 9]];
    for (i = 0; i < gears.length; i++) {
      var G = gears[i];
      w += circ(G[0], G[1], G[2], 'fill="black" fill-opacity=".22"');
      w += circ(G[0], G[1], G[2] * 0.55, 'fill="none" stroke="black" stroke-opacity=".25" stroke-width="6"');
      for (j = 0; j < G[3]; j++) {
        w += rect(-5, -G[2] - 11, 10, 13, 'fill="black" fill-opacity=".22" transform="translate(' +
          G[0] + ',' + G[1] + ') rotate(' + (j * 360 / G[3]) + ')"');
      }
    }
    for (i = 1; i < 10; i++) f += ln(i * 84, 402, i * 84 - 30, 560, 'stroke="black" stroke-opacity=".3" stroke-width="3"');
    return base(w, f);
  };

  /* Glazing bars, panes of night, and a brick knee-wall. */
  BACKDROPS.glasshouse = function () {
    var w = '', f = '', i, j;
    w += rect(0, 0, 800, 340, 'fill="#0a1c16"');
    for (i = 0; i < 800; i += 100) {
      for (j = 0; j < 340; j += 68) w += rect(i + 3, j + 3, 94, 62, 'fill="url(#ecGlass)"');
    }
    for (i = 0; i <= 800; i += 100) w += ln(i, 0, i, 340, 'stroke="#b8c4ae" stroke-opacity=".5" stroke-width="6"');
    for (j = 0; j <= 340; j += 68) w += ln(0, j, 800, j, 'stroke="#b8c4ae" stroke-opacity=".5" stroke-width="6"');
    /* The ridge belongs at the TOP of the glazing. Drawn at y 236-340 it
       sat at knee height and read as a stray line ruled across the room,
       not as a roof. */
    w += pth('M0 112 L400 8 L800 112', 'fill="none" stroke="#b8c4ae" stroke-opacity=".5" stroke-width="7"');
    for (j = 0; j < 3; j++) {
      for (i = 0; i < 14; i++) {
        w += rect(i * 58 + (j % 2 ? 29 : 0), 340 + j * 18, 54, 15, 'rx="1" fill="#6d4030" fill-opacity=".85" ' + K2);
      }
    }
    for (i = 0; i < 90; i++) {
      f += circ((i * 149) % 792 + 4, 406 + ((i * 71) % 150), 2 + (i % 3) * 0.9, 'fill="black" fill-opacity=".2"');
    }
    return base(w, f);
  };

  /* Oak panelling above a dado rail; parquet below. */
  BACKDROPS.panelled = function () {
    var w = '', f = '', i;
    for (i = 0; i < 8; i++) {
      w += rect(i * 100 + 8, 22, 84, 300, 'rx="3" fill="black" fill-opacity=".18"');
      w += rect(i * 100 + 20, 40, 60, 264, 'rx="2" fill="none" stroke="black" stroke-opacity=".28" stroke-width="3"');
    }
    w += rect(0, 330, 800, 14, 'class="fFloorB"');
    w += rect(0, 344, 800, 48, 'fill="black" fill-opacity=".2"');
    for (i = -4; i < 14; i++) {
      f += ln(i * 66, 402, i * 66 + 110, 560, 'stroke="black" stroke-opacity=".26" stroke-width="3"');
      f += ln(i * 66 + 110, 402, i * 66, 560, 'stroke="black" stroke-opacity=".26" stroke-width="3"');
    }
    return base(w, f);
  };

  /* Hewn rock between timber sets, with rails running out of frame. */
  BACKDROPS.rockCut = function () {
    var w = '', f = '', i;
    w += pth('M0 0 h800 v392 h-800 z', 'fill="black" fill-opacity=".18"');
    var seams = ['M0 60 l90 26 l70 -34 l120 40 l110 -30 l150 44 l120 -26 l140 30',
                 'M0 186 l120 34 l90 -28 l140 40 l130 -34 l180 42 l140 -22',
                 'M0 300 l110 22 l120 -30 l150 36 l150 -28 l160 34 l110 -18'];
    for (i = 0; i < seams.length; i++) {
      w += pth(seams[i], 'fill="none" stroke="black" stroke-opacity=".3" stroke-width="5"');
    }
    for (i = 0; i < 26; i++) {
      w += pth('M' + ((i * 173) % 780) + ' ' + (20 + (i * 97) % 350) + ' l14 10 l-6 12 l-16 -6 z',
        'fill="black" fill-opacity=".16"');
    }
    /* Timber sets: two posts and a cap beam. Placed at the extreme edges so
       they never fight the door or the plant slot.

       These were class="fFloorB" on the first render, and --floor2 in this
       palette is #201810 against a #2b2118 wall — the timbering was there
       and completely invisible, which is most of why the mine read as a
       brown storeroom rather than a mine. Sawn pine is LIGHTER than hewn
       rock, so the colour is literal now and not palette-driven. */
    var TIMBER = '#6a5232', posts = [10, 758];
    w += rect(0, 0, 800, 34, 'fill="' + TIMBER + '" ' + K3);
    for (i = 0; i < posts.length; i++) {
      w += rect(posts[i], 0, 32, 400, 'fill="' + TIMBER + '" ' + K3);
      w += ln(posts[i] + 16, 34, posts[i] + 16, 392, 'stroke="black" stroke-opacity=".3" stroke-width="3"');
      /* Bolt plates where post meets cap — the join is what makes it read
         as engineering holding a roof up, rather than as a stripe. */
      w += rect(posts[i] - 4, 30, 40, 12, 'fill="#8d8478" ' + K2);
      w += circ(posts[i] + 16, 60, 4, 'fill="#8d8478"') + circ(posts[i] + 16, 300, 4, 'fill="#8d8478"');
      w += pth('M' + (posts[i] + (i ? 0 : 32)) + ' 60 l' + (i ? -46 : 46) + ' -26',
        'stroke="' + TIMBER + '" stroke-width="16"');
    }
    for (i = 0; i < 16; i++) f += rect(i * 54 + 4, 444, 30, 84, 'fill="#3a2d1c" ' + K2);
    f += rect(0, 452, 800, 8, 'fill="#9a9186"');
    f += rect(0, 512, 800, 8, 'fill="#9a9186"');
    f += rect(0, 460, 800, 4, 'fill="black" fill-opacity=".4"');
    f += rect(0, 520, 800, 4, 'fill="black" fill-opacity=".4"');
    for (i = 0; i < 70; i++) {
      f += circ((i * 131) % 790 + 5, 404 + ((i * 61) % 150), 2 + (i % 4), 'fill="black" fill-opacity=".26"');
    }
    return base(w, f);
  };

  /* Dome ribs converging on an open shutter slit full of stars. */
  BACKDROPS.dome = function () {
    var w = '', f = '', i;
    w += pth('M0 400 Q400 -140 800 400 z', 'fill="black" fill-opacity=".28"');
    for (i = 0; i <= 10; i++) {
      w += pth('M' + (i * 80) + ' 400 Q400 ' + (-120 + i * 4) + ' 400 -30',
        'fill="none" stroke="black" stroke-opacity=".3" stroke-width="5"');
    }
    for (i = 1; i < 4; i++) {
      w += pth('M' + (60 * i) + ' 400 Q400 ' + (60 + i * 62) + ' ' + (800 - 60 * i) + ' 400',
        'fill="none" stroke="black" stroke-opacity=".22" stroke-width="4"');
    }
    w += pth('M356 0 L344 200 L456 200 L444 0 z', 'fill="url(#ecNight)"');
    w += pth('M356 0 L344 200 M444 0 L456 200', 'stroke="black" stroke-opacity=".5" stroke-width="7"');
    for (i = 0; i < 16; i++) {
      w += circ(360 + ((i * 47) % 80), 8 + ((i * 71) % 184), 1.6 + (i % 3) * 0.7, 'fill="#dfe9ff" fill-opacity=".8"');
    }
    for (i = 1; i < 7; i++) f += ln(i * 114, 402, i * 114 - 34, 560, 'stroke="black" stroke-opacity=".24" stroke-width="3"');
    return base(w, f);
  };

  /* Riveted plate, a run of pipes, and steel tread floor. */
  BACKDROPS.ironworks = function () {
    var w = '', f = '', i, j;
    for (j = 0; j < 5; j++) {
      w += ln(0, j * 82 + 30, 800, j * 82 + 30, 'stroke="black" stroke-opacity=".36" stroke-width="4"');
      for (i = 0; i < 25; i++) w += circ(i * 33 + 16, j * 82 + 40, 3, 'fill="black" fill-opacity=".32"');
    }
    for (i = 0; i < 4; i++) w += ln(i * 200 + 100, 30, i * 200 + 100, 392, 'stroke="black" stroke-opacity=".26" stroke-width="4"');
    w += rect(0, 60, 800, 26, 'rx="13" class="fFloorB" ' + K3);
    w += rect(0, 56, 800, 34, 'fill="none" stroke="black" stroke-opacity=".2" stroke-width="3"');
    for (i = 0; i < 6; i++) w += rect(i * 140 + 46, 52, 18, 42, 'rx="3" class="fFloorB" ' + K2);
    w += pth('M120 86 v70 q0 22 22 22 h60', 'fill="none" class="fFloorB" stroke-width="18" stroke-opacity=".9"');
    w += pth('M120 86 v70 q0 22 22 22 h60', 'fill="none" stroke="black" stroke-opacity=".3" stroke-width="3"');
    for (j = 0; j < 4; j++) {
      for (i = 0; i < 26; i++) {
        f += pth('M' + (i * 32 + (j % 2 ? 16 : 0)) + ' ' + (416 + j * 40) + ' l10 -7 l10 7 l-10 7 z',
          'fill="black" fill-opacity=".2"');
      }
    }
    return base(w, f);
  };

  /* ---- backdrops for the second ten ---- */

  /* Storm glazing over a black sea, an iron gallery rail, plated floor. */
  BACKDROPS.lampRoom = function () {
    var w = '', f = '', i;
    w += rect(0, 0, 800, 300, 'fill="url(#ecNight)"');
    w += rect(0, 214, 800, 86, 'fill="#0a1c26"');
    for (i = 0; i < 7; i++) {
      w += pth('M' + (i * 130 - 40) + ' ' + (232 + (i % 3) * 18) + ' q34 -12 68 0',
        'fill="none" stroke="#2c4c58" stroke-width="4"');
    }
    for (i = 0; i <= 800; i += 100) {
      w += pth('M' + i + ' 0 L' + (i + (i - 400) * 0.12).toFixed(0) + ' 300',
        'stroke="#6a7a84" stroke-opacity=".85" stroke-width="9"');
    }
    for (i = 60; i < 300; i += 76) w += ln(0, i, 800, i, 'stroke="#6a7a84" stroke-opacity=".7" stroke-width="7"');
    for (i = 0; i < 40; i++) {
      w += ln((i * 97) % 790, (i * 53) % 290, (i * 97) % 790 - 8, (i * 53) % 290 + 22,
        'stroke="#bcd8e4" stroke-opacity=".16" stroke-width="2"');
    }
    w += rect(0, 296, 800, 18, 'fill="#4a545c" ' + K3);
    w += rect(0, 314, 800, 78, 'class="fWall2"');
    for (i = 0; i < 24; i++) w += circ(i * 34 + 18, 330, 3.4, 'fill="black" fill-opacity=".35"');
    w += rect(0, 352, 800, 9, 'rx="4" fill="#6a7a84" fill-opacity=".55"');
    for (i = 0; i < 5; i++) f += ln(i * 160, 402, i * 160 - 40, 560, 'stroke="black" stroke-opacity=".3" stroke-width="4"');
    f += ln(0, 462, 800, 462, 'stroke="black" stroke-opacity=".3" stroke-width="4"');
    f += ln(0, 520, 800, 520, 'stroke="black" stroke-opacity=".3" stroke-width="4"');
    for (i = 0; i < 30; i++) f += circ((i * 113) % 780 + 10, 412 + ((i * 67) % 140), 3, 'fill="#8d9498" fill-opacity=".3"');
    return base(w, f);
  };

  /* Veined marble ashlar, a brass dado, a chequer floor and one grille. */
  BACKDROPS.vaultRoom = function () {
    var w = '', f = '', i, j;
    for (j = 0; j < 5; j++) {
      w += ln(0, j * 74 + 20, 800, j * 74 + 20, 'stroke="black" stroke-opacity=".3" stroke-width="4"');
      for (i = 0; i < 5; i++) {
        w += ln(i * 170 + (j % 2 ? 85 : 0), j * 74 + 20, i * 170 + (j % 2 ? 85 : 0), j * 74 + 94,
          'stroke="black" stroke-opacity=".24" stroke-width="4"');
      }
    }
    for (i = 0; i < 16; i++) {
      w += pth('M' + ((i * 173) % 780) + ' ' + (30 + (i * 91) % 330) + ' q30 -14 62 -4 q26 8 54 -8',
        'fill="none" stroke="#ffffff" stroke-opacity=".07" stroke-width="3"');
    }
    w += rect(0, 300, 800, 12, 'fill="#b9913f" fill-opacity=".55"');
    w += rect(0, 312, 800, 80, 'fill="black" fill-opacity=".2"');
    w += rect(340, 22, 120, 54, 'rx="3" fill="#0b0c10"');
    for (i = 0; i < 7; i++) w += rect(344 + i * 17, 22, 6, 54, 'fill="#8d8a9a"');
    w += rect(336, 18, 128, 62, 'rx="3" fill="none" stroke="#b9913f" stroke-opacity=".6" stroke-width="5"');
    for (j = 0; j < 4; j++) {
      for (i = 0; i < 9; i++) {
        f += pth('M' + (i * 100 + (j % 2 ? 50 : 0)) + ' ' + (404 + j * 40) + ' l50 0 l-14 40 l-50 0 z',
          'fill="black" fill-opacity=".22"');
      }
    }
    return base(w, f);
  };

  /* A vaulted bay: two blind arches, ribs to a boss, flagstones. */
  BACKDROPS.cloister = function () {
    var w = '', f = '', i, j;
    for (j = 0; j < 6; j++) {
      w += ln(0, j * 64 + 30, 800, j * 64 + 30, 'stroke="black" stroke-opacity=".26" stroke-width="3"');
      for (i = 0; i < 7; i++) {
        w += ln(i * 124 + (j % 2 ? 62 : 0), j * 64 + 30, i * 124 + (j % 2 ? 62 : 0), j * 64 + 94,
          'stroke="black" stroke-opacity=".2" stroke-width="3"');
      }
    }
    w += pth('M0 392 L0 150 Q400 -120 800 150 L800 392', 'fill="black" fill-opacity=".26"');
    for (i = 0; i < 5; i++) {
      w += pth('M' + (i * 200) + ' 392 Q400 ' + (30 + i * 10) + ' 400 -40',
        'fill="none" stroke="black" stroke-opacity=".3" stroke-width="7"');
    }
    w += circ(400, 46, 26, 'fill="black" fill-opacity=".3"');
    w += circ(400, 46, 14, 'fill="black" fill-opacity=".25"');
    for (i = 0; i < 2; i++) {
      var x = 130 + i * 420;
      w += pth('M' + x + ' 392 v-150 q60 -84 120 0 v150 z', 'fill="black" fill-opacity=".24"');
      w += pth('M' + x + ' 392 v-150 q60 -84 120 0 v150', 'fill="none" stroke="black" stroke-opacity=".3" stroke-width="6"');
    }
    for (j = 0; j < 4; j++) {
      for (i = 0; i < 7; i++) {
        f += rect(i * 118 + (j % 2 ? -50 : 0), 404 + j * 40, 112, 34,
          'rx="2" fill="black" fill-opacity="' + (0.1 + (i + j) % 3 * 0.05).toFixed(2) + '" ' + K2);
      }
    }
    return base(w, f);
  };

  /* Striped wallpaper over lath, a picture rail, and one torn patch. */
  BACKDROPS.parlour = function () {
    var w = '', f = '', i;
    for (i = 0; i < 800; i += 40) {
      w += rect(i, 0, 20, 392, 'fill="black" fill-opacity=".16"');
      w += ln(i + 30, 0, i + 30, 392, 'stroke="#c8a88a" stroke-opacity=".12" stroke-width="3"');
    }
    for (i = 0; i < 40; i++) {
      w += pth('M' + ((i * 79) % 790) + ' ' + (26 + (i * 97) % 330) + ' q6 -8 12 0 q-6 8 -12 0 z',
        'fill="#c8a88a" fill-opacity=".14"');
    }
    w += pth('M596 0 l58 0 l-10 74 l26 66 l-40 42 l-34 -58 l14 -60 z', 'fill="black" fill-opacity=".3"');
    for (i = 0; i < 7; i++) {
      w += ln(596, 14 + i * 26, 662, 8 + i * 26, 'stroke="#8a7256" stroke-opacity=".5" stroke-width="5"');
    }
    w += pth('M596 0 l58 0 l-10 74 l26 66 l-40 42 l-34 -58 l14 -60 z',
      'fill="none" stroke="black" stroke-opacity=".35" stroke-width="3"');
    w += rect(0, 44, 800, 10, 'class="fWall2"');
    w += rect(0, 356, 800, 36, 'fill="black" fill-opacity=".24"');
    for (i = 0; i < 9; i++) f += ln(i * 96, 402, i * 96 - 26, 560, 'stroke="black" stroke-opacity=".3" stroke-width="4"');
    f += ln(0, 474, 800, 474, 'stroke="black" stroke-opacity=".22" stroke-width="3"');
    return base(w, f);
  };

  /* Varnished beading, a night window band, a luggage rail. */
  BACKDROPS.carriage = function () {
    var w = '', f = '', i;
    for (i = 0; i < 400; i += 22) w += ln(0, i, 800, i, 'stroke="black" stroke-opacity=".28" stroke-width="3"');
    w += rect(0, 66, 800, 116, 'rx="10" fill="#060d18"');
    w += rect(0, 66, 800, 116, 'rx="10" fill="url(#ecNight)"');
    for (i = 0; i < 9; i++) {
      w += pth('M' + (i * 100 - 20) + ' 182 l40 -46 l34 24 l40 -54 l30 76 z', 'fill="#0b1524"');
    }
    for (i = 0; i < 26; i++) {
      w += ln((i * 61) % 790, 70 + (i * 37) % 100, (i * 61) % 790 - 16, 82 + (i * 37) % 100,
        'stroke="#8fb2cc" stroke-opacity=".22" stroke-width="2"');
    }
    for (i = 0; i < 12; i++) w += circ((i * 131) % 780, 74 + (i * 29) % 40, 1.6, 'fill="#dfe6ef" fill-opacity=".6"');
    w += rect(0, 58, 800, 12, 'class="fWall2"');
    w += rect(0, 178, 800, 12, 'class="fWall2"');
    for (i = 0; i < 5; i++) w += rect(i * 200 + 90, 58, 16, 132, 'fill="#3a2a1e" ' + K2);
    w += rect(0, 224, 800, 8, 'rx="4" fill="#8d7a4a" fill-opacity=".7"');
    for (i = 0; i < 6; i++) w += ln(i * 140 + 40, 224, i * 140 + 40, 206, 'stroke="#8d7a4a" stroke-opacity=".7" stroke-width="4"');
    for (i = -2; i < 12; i++) f += ln(i * 70, 402, i * 70 + 90, 560, 'stroke="black" stroke-opacity=".3" stroke-width="3"');
    f += rect(300, 402, 200, 158, 'fill="black" fill-opacity=".18"');
    return base(w, f);
  };

  /* A brick barrel vault, frosted, with icicles at the springing. */
  BACKDROPS.frostVault = function () {
    var w = '', f = '', i, j;
    for (j = 0; j < 9; j++) {
      w += ln(0, j * 44 + 8, 800, j * 44 + 8, 'stroke="black" stroke-opacity=".3" stroke-width="3"');
      for (i = 0; i < 12; i++) {
        w += ln(i * 74 + (j % 2 ? 37 : 0), j * 44 + 8, i * 74 + (j % 2 ? 37 : 0), j * 44 + 52,
          'stroke="black" stroke-opacity=".24" stroke-width="3"');
      }
    }
    w += pth('M0 392 L0 190 Q400 -60 800 190 L800 392', 'fill="black" fill-opacity=".3"');
    w += pth('M0 190 Q400 -60 800 190', 'fill="none" stroke="#cfe4ea" stroke-opacity=".35" stroke-width="7"');
    for (i = 0; i < 22; i++) {
      var x = i * 38 + 10, y = 190 - Math.round(240 * Math.sin(Math.PI * x / 800) * 0.72);
      w += pth('M' + x + ' ' + y + ' l7 0 l-3 ' + (16 + (i % 4) * 13) + ' z', 'fill="#cfe4ea" fill-opacity=".45"');
    }
    for (i = 0; i < 70; i++) {
      w += circ((i * 137) % 792, 12 + (i * 71) % 376, 1.6 + (i % 3), 'fill="#dff2f8" fill-opacity=".16"');
    }
    for (i = 0; i < 60; i++) {
      f += circ((i * 149) % 790 + 5, 406 + ((i * 53) % 150), 2 + (i % 4), 'fill="#c9b078" fill-opacity=".22"');
    }
    f += pth('M0 470 q200 -20 400 6 q200 26 400 -2', 'fill="none" stroke="black" stroke-opacity=".22" stroke-width="6"');
    return base(w, f);
  };

  /* An attic: rafters both sides, a collar beam, and bunting. */
  BACKDROPS.attic = function () {
    var w = '', f = '', i;
    for (i = 0; i < 400; i += 26) w += ln(0, i, 800, i - 6, 'stroke="black" stroke-opacity=".24" stroke-width="3"');
    w += pth('M0 0 L250 392 L0 392 z', 'fill="black" fill-opacity=".3"');
    w += pth('M800 0 L550 392 L800 392 z', 'fill="black" fill-opacity=".3"');
    for (i = 0; i < 3; i++) {
      w += pth('M' + (i * 60) + ' 0 L' + (i * 60 + 240) + ' 392', 'stroke="#6a5232" stroke-width="20" fill="none"');
      w += pth('M' + (800 - i * 60) + ' 0 L' + (800 - i * 60 - 240) + ' 392', 'stroke="#6a5232" stroke-width="20" fill="none"');
    }
    w += rect(0, 150, 800, 24, 'fill="#6a5232" ' + K3);
    for (i = 0; i < 12; i++) {
      var bx = i * 66 + 24, by = 174 + Math.round(18 * Math.sin(i * 0.9));
      w += pth('M' + bx + ' ' + by + ' l30 0 l-15 30 z',
        'fill="' + ['#b4342e', '#d8b032', '#2a5fa0', '#4a8a5a'][i % 4] + '" fill-opacity=".8" ' + K2);
    }
    w += pth('M0 176 q200 26 400 4 q200 -22 400 4', 'fill="none" stroke="#8a7a54" stroke-width="3"');
    for (i = -2; i < 12; i++) f += ln(i * 74, 402, i * 74 + 60, 560, 'stroke="black" stroke-opacity=".26" stroke-width="3"');
    for (i = 0; i < 22; i++) {
      f += ell((i * 149) % 780 + 8, 412 + ((i * 71) % 140), 7, 4,
        'fill="' + ['#b4342e', '#d8b032', '#2a5fa0'][i % 3] + '" fill-opacity=".3"');
    }
    return base(w, f);
  };

  /* Three banked tiers of an anatomy theatre, receding into the dark. */
  BACKDROPS.gallery = function () {
    var w = '', f = '', i, j;
    w += rect(0, 0, 800, 392, 'fill="black" fill-opacity=".28"');
    for (j = 0; j < 3; j++) {
      var y = 96 + j * 92, dip = 40 - j * 8;
      w += pth('M-20 ' + y + ' Q400 ' + (y + dip) + ' 820 ' + y + ' L820 ' + (y + 26) +
        ' Q400 ' + (y + dip + 26) + ' -20 ' + (y + 26) + ' z', 'class="fWall2" ' + K3);
      w += pth('M-20 ' + (y - 34) + ' Q400 ' + (y + dip - 34) + ' 820 ' + (y - 34),
        'fill="none" stroke="#6a5a44" stroke-opacity=".8" stroke-width="7"');
      for (i = 0; i < 13; i++) {
        var x = i * 64 + 12;
        w += ln(x, y - 34 + Math.round(dip * Math.sin(Math.PI * x / 800) * 0.9), x,
          y + 4 + Math.round(dip * Math.sin(Math.PI * x / 800) * 0.9),
          'stroke="#6a5a44" stroke-opacity=".7" stroke-width="4"');
      }
    }
    w += rect(0, 0, 800, 62, 'fill="black" fill-opacity=".35"');
    for (i = 0; i < 40; i++) {
      f += circ((i * 131) % 786 + 6, 406 + ((i * 61) % 148), 2.6 + (i % 3), 'fill="#c9b078" fill-opacity=".2"');
    }
    for (i = -2; i < 12; i++) f += ln(i * 76, 402, i * 76 + 64, 560, 'stroke="black" stroke-opacity=".28" stroke-width="3"');
    return base(w, f);
  };

  /* Acoustic wedges, and the control room watching through its glass. */
  BACKDROPS.studio = function () {
    var w = '', f = '', i, j;
    for (j = 0; j < 9; j++) {
      for (i = 0; i < 21; i++) {
        var x = i * 40, y = j * 46;
        w += pth('M' + x + ' ' + y + ' l20 -14 l20 14 l-20 14 z', 'fill="black" fill-opacity="' +
          ((i + j) % 2 ? '.26' : '.16') + '"');
        w += pth('M' + x + ' ' + y + ' l20 -14 l20 14', 'fill="none" stroke="black" stroke-opacity=".2" stroke-width="2"');
      }
    }
    w += rect(470, 60, 300, 150, 'rx="4" fill="#0c1014"');
    w += rect(470, 60, 300, 150, 'rx="4" fill="url(#ecGlass)"');
    w += rect(462, 52, 316, 166, 'rx="5" fill="none" fill-opacity="0" stroke="#4a5054" stroke-width="9"');
    w += rect(500, 130, 240, 12, 'rx="3" fill="#2a3034" fill-opacity=".9"');
    w += circ(560, 112, 12, 'fill="#5a6266" fill-opacity=".7"');
    w += rect(600, 100, 90, 26, 'rx="3" fill="#3a4246" fill-opacity=".7"');
    w += pth('M480 200 l70 -140', 'stroke="#ffffff" stroke-opacity=".08" stroke-width="16"');
    w += rect(0, 340, 800, 52, 'fill="black" fill-opacity=".2"');
    f += ln(0, 470, 800, 470, 'stroke="black" stroke-opacity=".2" stroke-width="4"');
    f += ln(0, 528, 800, 528, 'stroke="black" stroke-opacity=".2" stroke-width="4"');
    for (i = 0; i < 5; i++) f += ln(i * 200, 402, i * 200 - 50, 560, 'stroke="black" stroke-opacity=".18" stroke-width="3"');
    return base(w, f);
  };

  /* Tower framing: posts, braces, and louvres full of night. */
  BACKDROPS.louvre = function () {
    var w = '', f = '', i, j;
    w += rect(0, 0, 800, 392, 'fill="black" fill-opacity=".2"');
    for (j = 0; j < 2; j++) {
      var x0 = j ? 520 : 40;
      w += rect(x0, 30, 240, 300, 'fill="#070a10"');
      for (i = 0; i < 9; i++) {
        w += pth('M' + x0 + ' ' + (44 + i * 34) + ' l240 -16 l0 17 l-240 16 z',
          'fill="#5c5548" ' + K2);
      }
      w += rect(x0 - 10, 20, 260, 12, 'fill="#6a6154" ' + K2);
      w += rect(x0 - 10, 328, 260, 12, 'fill="#6a6154" ' + K2);
    }
    var TIMBER = '#6a6154';
    w += rect(0, 0, 800, 30, 'fill="' + TIMBER + '" ' + K3);
    for (i = 0; i < 3; i++) {
      w += rect(i * 380 + 10, 0, 32, 392, 'fill="' + TIMBER + '" ' + K3);
      w += ln(i * 380 + 26, 30, i * 380 + 26, 392, 'stroke="black" stroke-opacity=".3" stroke-width="3"');
    }
    w += pth('M42 30 L390 392 M390 30 L42 392', 'stroke="' + TIMBER + '" stroke-width="22" fill="none"');
    w += pth('M42 30 L390 392 M390 30 L42 392', 'stroke="black" stroke-opacity=".28" stroke-width="3" fill="none"');
    w += pth('M422 30 L770 392 M770 30 L422 392', 'stroke="' + TIMBER + '" stroke-width="22" fill="none"');
    w += pth('M422 30 L770 392 M770 30 L422 392', 'stroke="black" stroke-opacity=".28" stroke-width="3" fill="none"');
    for (i = 0; i < 6; i++) w += circ(i * 152 + 60, 200, 5, 'fill="#8d8478"');
    for (i = -2; i < 12; i++) f += ln(i * 72, 402, i * 72 + 70, 560, 'stroke="black" stroke-opacity=".3" stroke-width="3"');
    f += circ(120, 500, 34, 'fill="black" fill-opacity=".55"');
    f += circ(120, 500, 34, 'fill="none" stroke="#6a6154" stroke-width="7"');
    for (i = 0; i < 26; i++) {
      f += ell((i * 149) % 780 + 8, 410 + ((i * 83) % 140), 5, 3, 'fill="#d8d4c8" fill-opacity=".18"');
    }
    return base(w, f);
  };

  /* =====================================================================
     THE SETTINGS
     ---------------------------------------------------------------------
     Palettes are HAND-PICKED, not generated. game.js:paletteFor() spreads
     twenty hues around the wheel, which guarantees difference and
     guarantees nothing about meaning: a prison came out mauve. A cell is
     cold grey-green, a tomb is warm sandstone, a boiler room is soot and
     firelight, and no amount of seeding gets there.

     The one rule inherited from the generated palettes still applies:
     --ink is a warm near-white laid over --wall and --panel, so a wall
     above roughly 22% lightness makes the whole room unreadable. Every
     --wall below is under it. Check any new one against a real screenshot,
     not against the hex.
     ===================================================================== */

  /* ---------------- traits ----------------
     puzzle.js:generateKeyHunt() deduces WHERE THE BRASS KEY IS from clues
     about the physical properties of the seven searchable objects — "not
     behind anything wooden", "the dust lies undisturbed on everything made
     of iron". Without a trait table it sets degraded:true and falls back
     to a clue that simply names the spot, which is the "search all seven
     at random" game this whole file exists to kill.

     THE ONE RULE: every trait must be true of the ART. Brute force proves
     a clue set is self-consistent; nothing can prove the table matches the
     picture. Tag the tin cup 'wood' when the drawing is plainly metal and
     every clue about it becomes a lie that no test can catch. So the
     traits live HERE, next to the parts they describe, and not in the
     puzzle module — whoever changes a drawing is looking straight at them.

     Only properties a player can SEE from the drawing. "The bunk is iron"
     is on screen; "the mattress is hollow" is an argument.

     MORE VARIETY IS NOT BETTER, and this is the counter-intuitive part.
     Giving all seven objects a different `kind` makes every one of them
     identifiable by a single clue, so a three-clue set would have a
     redundant clue in it, so the generator drops to one clue and reports
     relaxed:true — a tier-5 room with a tier-1 deduction. Values want to
     come in GROUPS: the cell's cup and bucket are both metal vessels and
     only `place` separates them, which is what forces two clues instead of
     one. Aim for three to five values per axis with real pairs in them,
     not seven singletons.

     Written as [made, kind, hollow, living] because a seven-row table of
     objects reads as a table, and a seven-row table of nested objects
     reads as punctuation. `place` is NOT in the list: it is a fact about
     the role, so deriving it removes the one trait that could silently
     contradict where the object is actually drawn. */
  var FLOOR_ROLES = ['floorSoft', 'floorProp', 'container'];

  function obj(role, part, name, opt, traits) {
    var id = ROLES[role];
    var o = { id: id, role: role, part: part, name: name, opt: opt || {} };
    o.x = ANCHORS[id].x; o.y = ANCHORS[id].y;
    if (traits) {
      o.traits = {
        place:  FLOOR_ROLES.indexOf(role) >= 0 ? 'floor' : 'wall',
        made:   traits[0],
        kind:   traits[1],
        hollow: !!traits[2],
        living: !!traits[3]
      };
    }
    return o;
  }
  /* The drawer is the one object whose id is not its role's id, because
     the role `anchor` (the furniture) and the lock share a slot in the
     player's mind but not in the DOM. */
  function drawerObj(part, name, opt) {
    return { id: 'drawer', role: 'lockSmall', part: part, name: name, opt: opt || {},
             x: ANCHORS.drawer.x, y: ANCHORS.drawer.y, kind: 'lock' };
  }

  var SETTINGS = [
    {
      id: 'cell',
      name: 'THE CELL BLOCK',
      backdrop: 'cellBlock',
      intro: ['The door slams, and the bolt goes over from the other side.',
              'Somewhere down the corridor, a key turns. Not yours.',
              'Cold stone, colder air. Someone counted days on this wall.'],
      taunts: ['Damp straw and nothing else.', 'A cockroach, indignant.',
               'Cold stone. Colder than the rest, somehow.', 'Someone got here first.',
               'Empty. Scrupulously empty.', 'A smell you will not forget.',
               'Grit under your fingernails. That is all.', 'Rust flakes off in your hand.'],
      palette: {
        '--bg': '#080c0b', '--wall': '#2a3330', '--wall2': '#1c2321', '--floor': '#33332d',
        '--floor2': '#20201c', '--panel': '#1b2220', '--line': '#3c4a45',
        '--accent': '#b9cfbe', '--soft': '#8c9c95', '--glow': '#d6e8dc'
      },
      objects: [
        /* The cup and the bucket are the same object twice over — both
           dented metal vessels you could reach into — and that is
           deliberate: `place` is the only thing telling them apart, so the
           room can ask a question that needs two clues to answer. */
        obj('floorSoft',  'mattress',     'prison pallet',   {}, ['straw', 'bedding',   0, 0]),
        obj('floorProp',  'slopBucket',   'slop bucket',     {}, ['metal', 'vessel',    1, 0]),
        obj('wallSmall',  'tinCup',       'tin cup',         {}, ['metal', 'vessel',    1, 0]),
        obj('wallMid',    'tallyMarks',   'scratched tally', {}, ['stone', 'marking',   0, 0]),
        obj('wallLarge',  'barredWindow', 'barred window',   {}, ['iron',  'opening',   0, 0]),
        obj('storage',    'bunk',         'hanging bunk',    {}, ['iron',  'bedding',   0, 0]),
        obj('container',  'looseBricks',  'loose brick',     {}, ['stone', 'opening',   1, 0]),
        obj('exit',       'barDoor',      'cell gate',       {}),
        obj('anchor',     'steelTable',   'bolted table',    {}),
        drawerObj('drawerSteel', 'steel drawer', {}),
        obj('lockCode',   'ironSafe',     'warder’s lockbox', { body: '#3b4442', rivets: 1 }),
        obj('lockCrank',  'winchHousing', 'bolt mechanism',  { metal: '#3b4442', brass: '#9fb8a8' }),
        obj('light',      'cagedBulb',    'caged bulb',      {})
      ]
    },
    {
      id: 'ship',
      name: 'THE CAPTAIN’S CABIN',
      backdrop: 'hull',
      intro: ['The hatch dogs down behind you with six wet clunks.',
              'The deck rolls. Something in here rolls with it.',
              'Salt, tar and old rum. The cabin is not empty of secrets.'],
      taunts: ['Bilge water and splinters.', 'A weevil. Just the one.',
               'Rope ends, frayed and useless.', 'Wet canvas. Delightful.',
               'Nothing but the ship breathing.', 'Someone bailed here once.',
               'Salt crust, an inch thick.', 'A dead barnacle. Poor thing.'],
      palette: {
        '--bg': '#05101a', '--wall': '#1d3340', '--wall2': '#13242e', '--floor': '#43301e',
        '--floor2': '#291d12', '--panel': '#16262f', '--line': '#2d4c5c',
        '--accent': '#e0b464', '--soft': '#8fb2bd', '--glow': '#ffe0a0'
      },
      objects: [
        obj('floorSoft',  'ropeCoil',     'coiled hawser',   {}, ['rope',  'covering',  0, 0]),
        obj('floorProp',  'barrel',       'water cask',      {}, ['wood',  'vessel',    1, 0]),
        obj('wallSmall',  'porthole',     'porthole',        {}, ['brass', 'window',    0, 0]),
        obj('wallMid',    'knotBoard',    'knot board',      {}, ['rope',  'picture',   0, 0]),
        obj('wallLarge',  'seaChart',     'sea chart',       {}, ['paper', 'picture',   0, 0]),
        obj('storage',    'hammock',      'hammock',         {}, ['cloth', 'bedding',   0, 0]),
        obj('container',  'woodChest',    'sea chest',       { band: '#6a5a3a' },
                                                                 ['wood',  'furniture', 1, 0]),
        obj('exit',       'hatchDoor',    'cabin hatch',     {}),
        obj('anchor',     'chartTable',   'chart table',     {}),
        drawerObj('drawerWood', 'chart drawer', { body: '#4a3520' }),
        obj('lockCode',   'strongBox',    'captain’s strongbox', {}),
        obj('lockCrank',  'tallCabinet',  'ship’s locker',   { body: '#4a3520', panel: 1 }),
        obj('light',      'lanternLight', 'oil lantern',     {})
      ]
    },
    {
      id: 'tomb',
      name: 'THE SEALED TOMB',
      backdrop: 'sandstone',
      intro: ['The slab grinds shut. Four thousand years of patience, and no hurry now.',
              'Dust rises in the torchlight, and settles on you.',
              'The air is dry enough to hurt. Someone was buried here with instructions.'],
      taunts: ['Dust older than your language.', 'A scorpion, unbothered.',
               'Sand runs out of the crack. Nothing else.', 'Beetle shells, brittle as paper.',
               'Empty. The robbers were thorough.', 'Painted onions. Just painted onions.',
               'Grave dust. You would rather not have touched it.', 'A shard of a jar, long emptied.'],
      palette: {
        '--bg': '#150e05', '--wall': '#4a3a1f', '--wall2': '#332811', '--floor': '#3d3018',
        '--floor2': '#2a2010', '--panel': '#2e2413', '--line': '#6a5430',
        '--accent': '#e8c46a', '--soft': '#c4ab7e', '--glow': '#ffe9a8'
      },
      objects: [
        /* Almost everything in a tomb is the same rock, so `kind` carries
           this room: a carving, a picture and a piece of furniture can all
           be sandstone and still be told apart by eye. The gilded sun disc
           is the one object with its own material, and it is drawn as the
           brightest thing on the wall so the claim is visible. */
        obj('floorSoft',  'flatMat',       'woven mat',       { fill: '#8a7442', weave: '#6a5730' },
                                                                  ['reed',  'covering',  0, 0]),
        obj('floorProp',  'canopicJar',    'canopic jar',     {}, ['clay',  'vessel',    1, 0]),
        obj('wallSmall',  'sunDisc',       'sun disc',        {}, ['gold',  'carving',   0, 0]),
        obj('wallMid',    'stela',         'carved stela',    {}, ['stone', 'picture',   0, 0]),
        obj('wallLarge',  'glyphPanel',    'glyph slab',      {}, ['stone', 'carving',   0, 0]),
        obj('storage',    'offeringShelf', 'offering shelf',  {}, ['stone', 'furniture', 0, 0]),
        obj('container',  'sarcophagus',   'sarcophagus',     {}, ['stone', 'furniture', 1, 0]),
        obj('exit',       'slabDoor',      'sealed slab',     {}),
        obj('anchor',     'offeringTable', 'offering table',  {}),
        drawerObj('drawerStone', 'stone drawer', {}),
        obj('lockCode',   'stoneDialBox',  'glyph box',       {}),
        obj('lockCrank',  'obelisk',       'obelisk',         {}),
        obj('light',      'brazierLight',  'brazier',         {})
      ]
    },
    {
      id: 'lab',
      name: 'THE LABORATORY',
      backdrop: 'tiled',
      intro: ['The airlock cycles, and the indicator goes red. Contained — with you inside.',
              'Something is still bubbling. It was not left running by accident.',
              'The extract fan dies. In the silence you can hear the jars ticking as they cool.'],
      taunts: ['Sterile. Depressingly sterile.', 'A culture dish. Do not open it.',
               'Nothing but the smell of solvent.', 'Someone autoclaved the evidence.',
               'Empty, and labelled EMPTY.', 'A pipette tip. Used.',
               'Chalk dust and disappointment.', 'A logbook page, torn out at the root.'],
      palette: {
        '--bg': '#040b0e', '--wall': '#1b2b30', '--wall2': '#132024', '--floor': '#23292b',
        '--floor2': '#171d1f', '--panel': '#16242a', '--line': '#2f4a52',
        '--accent': '#5fe3c8', '--soft': '#8fb6b8', '--glow': '#b5fff0'
      },
      objects: [
        obj('floorSoft',  'spillTray',    'spill tray',       {}, ['metal',  'covering',  0, 0]),
        obj('floorProp',  'gasCylinder',  'gas cylinder',     {}, ['metal',  'vessel',    1, 0]),
        obj('wallSmall',  'gauge',        'vacuum gauge',     { bezel: '#7d888c' },
                                                                  ['glass',  'mechanism', 0, 0]),
        obj('wallMid',    'lightbox',     'lightbox',         {}, ['glass',  'picture',   0, 0]),
        /* enamel, not metal: the board is the one big glossy white thing
           in the room, and that is what a player would call it. */
        obj('wallLarge',  'whiteboard',   'whiteboard',       {}, ['enamel', 'picture',   0, 0]),
        obj('storage',    'jarRack',      'specimen rack',    {}, ['glass',  'vessel',    1, 0]),
        obj('container',  'steelCase',    'specimen case',    {}, ['metal',  'furniture', 1, 0]),
        obj('exit',       'airlockDoor',  'airlock',          {}),
        obj('anchor',     'labBench',     'lab bench',        {}),
        drawerObj('drawerSteel', 'bench drawer', {}),
        obj('lockCode',   'ironSafe',     'reagent safe',     { body: '#3a474b', rivets: 1 }),
        obj('lockCrank',  'fumeHood',     'fume hood',        {}),
        obj('light',      'bunsenLight',  'burner',           {})
      ]
    },
    {
      id: 'clockworks',
      name: 'THE CLOCKWORKS',
      backdrop: 'brassworks',
      intro: ['Every gear in the room stops at once. That cannot be good.',
              'The great wheel turns one tooth, and the door locks itself.',
              'Tick. Tick. Tick. Something in here is counting down, not up.'],
      taunts: ['Oil, and more oil.', 'A spring, sprung.',
               'Brass filings. Sharp ones.', 'A cog with no wheel to belong to.',
               'Empty, and ticking anyway.', 'Someone stripped this thread years ago.',
               'Sawdust and old grease.', 'A broken mainspring, coiled like a snake.'],
      palette: {
        '--bg': '#120c05', '--wall': '#3a2a16', '--wall2': '#291d0f', '--floor': '#46331c',
        '--floor2': '#2e2112', '--panel': '#2a1f12', '--line': '#5c4526',
        '--accent': '#f0b64a', '--soft': '#c9a674', '--glow': '#ffd98a'
      },
      objects: [
        obj('floorSoft',  'flatMat',      'oiled sheet',      { fill: '#4f4636', weave: '#3a3326' },
                                                                  ['cloth', 'covering',  0, 0]),
        obj('floorProp',  'weightDrum',   'chain drum',       {}, ['iron',  'weight',    0, 0]),
        obj('wallSmall',  'clockFace',    'clock face',       {}, ['wood',  'mechanism', 0, 0]),
        obj('wallMid',    'escapement',   'escapement',       {}, ['brass', 'mechanism', 0, 0]),
        obj('wallLarge',  'giantGear',    'great wheel',      { brass: '#6e6155', hub: '#4f463c' },
                                                                  ['iron',  'mechanism', 0, 0]),
        obj('storage',    'toolRack',     'tool rack',        { board: '#4a3a24', metal: '#c9973f' },
                                                                  ['iron',  'tools',     0, 0]),
        obj('container',  'crate',        'parts crate',      { stencil: 'PARTS' },
                                                                  ['wood',  'furniture', 1, 0]),
        obj('exit',       'ironDoor',     'iron door',        { metal: '#4a3520', rivet: '#c9973f' }),
        obj('anchor',     'workBench',    'workbench',        {}),
        drawerObj('drawerWood', 'bench drawer', { body: '#4a3520' }),
        obj('lockCode',   'ironSafe',     'regulator case',   { body: '#4a3d28', dial: '#2a2014' }),
        obj('lockCrank',  'winchHousing', 'winding gear',     { metal: '#4a3a24' }),
        obj('light',      'lanternLight', 'oil lamp',         {})
      ]
    },
    {
      id: 'greenhouse',
      name: 'THE GLASSHOUSE',
      backdrop: 'glasshouse',
      intro: ['The glass door swings shut, and the latch drops on its own.',
              'Wet heat, and the smell of green things growing too fast.',
              'Condensation runs down every pane. Someone wrote on one of them.'],
      taunts: ['Leaf mould. Rich, and useless.', 'A woodlouse convention.',
               'Wet compost. Very wet compost.', 'Nothing but roots.',
               'Empty, apart from the aphids.', 'A snail, considering its options.',
               'Peat under your nails, and nothing in your hand.', 'A label, faded blank.'],
      palette: {
        '--bg': '#04120c', '--wall': '#17342a', '--wall2': '#0f2620', '--floor': '#2e2a1c',
        '--floor2': '#1e1b12', '--panel': '#123027', '--line': '#275644',
        '--accent': '#8fe06a', '--soft': '#93bfa2', '--glow': '#d6ffbe'
      },
      objects: [
        /* The only room where `living` does real work: three of the seven
           are visibly growing, so "the key is not behind anything alive"
           cuts the field almost in half on its own. */
        obj('floorSoft',  'flatMat',      'coir mat',         { fill: '#6a5a36', weave: '#4d4128' },
                                                                  ['straw', 'covering',  0, 0]),
        obj('floorProp',  'pottedFern',   'potted fern',      {}, ['clay',  'vessel',    1, 1]),
        obj('wallSmall',  'thermoDial',   'hygrometer',       {}, ['metal', 'mechanism', 0, 0]),
        obj('wallMid',    'seedBoard',    'seed board',       {}, ['paper', 'picture',   0, 0]),
        obj('wallLarge',  'trellis',      'trellis',          {}, ['wood',  'growth',    0, 1]),
        obj('storage',    'pottingShelf', 'seed trays',       {}, ['wood',  'furniture', 0, 1]),
        obj('container',  'crate',        'seed bin',         { wood: '#6a5a36', lid: '#7d6b42', stencil: 'SEED' },
                                                                  ['wood',  'furniture', 1, 0]),
        obj('exit',       'glazedDoor',   'glass door',       {}),
        obj('anchor',     'pottingBench', 'potting bench',    {}),
        drawerObj('drawerWood', 'seed drawer', { body: '#5c4c2e' }),
        obj('lockCode',   'strongBox',    'gardener’s tin',   { wood: '#4a5a3a', metal: '#3d4a34' }),
        obj('lockCrank',  'tallCabinet',  'vent gear',        { body: '#3a4a3a', panel: 1 }),
        obj('light',      'lanternLight', 'hurricane lamp',   {})
      ]
    },
    {
      id: 'library',
      name: 'THE LOCKED LIBRARY',
      backdrop: 'panelled',
      intro: ['The reading-room door closes with a librarian’s discretion, and locks.',
              'Ten thousand books, and not one of them is going to help. Probably.',
              'Somewhere in this room, something is filed under ESCAPE.'],
      taunts: ['Dust. Endless dust.', 'A spider glares back at you.',
               'Nothing but cobwebs.', 'Silverfish. They were here first.',
               'Empty. Suspiciously empty.', 'Just old memories.',
               'A bookmark from a book long gone.', 'A faded receipt from long ago.'],
      palette: {
        '--bg': '#100809', '--wall': '#2e1c1e', '--wall2': '#201315', '--floor': '#3a2818',
        '--floor2': '#261a0f', '--panel': '#251618', '--line': '#4a2c2f',
        '--accent': '#d9a441', '--soft': '#bb9a86', '--glow': '#ffdca6'
      },
      objects: [
        obj('floorSoft',  'persianRug',   'Persian rug',      {}, ['cloth', 'covering',  0, 0]),
        obj('floorProp',  'globeStand',   'globe',            {}, ['paper', 'map',       0, 0]),
        obj('wallSmall',  'clockFace',    'library clock',    {}, ['wood',  'mechanism', 0, 0]),
        obj('wallMid',    'portrait',     'portrait',         {}, ['paper', 'picture',   0, 0]),
        obj('wallLarge',  'glazedCase',   'glazed bookcase',  {}, ['glass', 'furniture', 1, 0]),
        obj('storage',    'bookShelf',    'bookshelf',        {}, ['paper', 'furniture', 0, 0]),
        obj('container',  'cardCatalogue', 'card catalogue',  {}, ['wood',  'furniture', 1, 0]),
        obj('exit',       'panelDoor',    'panelled door',    {}),
        obj('anchor',     'writingDesk',  'writing desk',     {}),
        drawerObj('drawerWood', 'desk drawer', {}),
        /* The default safe body is a cold slate blue, which was the only
           cold object in an entirely warm room and pulled the eye straight
           to it. Warmed to the panelling. */
        obj('lockCode',   'ironSafe',     'wall safe',        { body: '#3a2a2c', dial: '#251a1c' }),
        obj('lockCrank',  'tallCabinet',  'book press',       { panel: 1 }),
        obj('light',      'candleLight',  'candle',           {})
      ]
    },
    {
      id: 'mine',
      name: 'THE DEEP WORKING',
      backdrop: 'rockCut',
      intro: ['The cage rattles away up the shaft without you.',
              'A timber groans overhead. Then another. Then nothing.',
              'Four hundred feet of rock, and one way out of this stope.'],
      taunts: ['Rubble, and the promise of more rubble.', 'A rat, going somewhere better.',
               'Rock dust. Your lungs thank you.', 'Spoil. Just spoil.',
               'Empty. Worked out decades ago.', 'A boot. Only the one.',
               'Water seeping through. Cold as the grave.', 'A snapped pick handle.'],
      palette: {
        '--bg': '#0b0805', '--wall': '#2b2118', '--wall2': '#1d1710', '--floor': '#322619',
        '--floor2': '#201810', '--panel': '#221a12', '--line': '#443426',
        '--accent': '#ffb84d', '--soft': '#a8917a', '--glow': '#ffd9a0'
      },
      objects: [
        obj('floorSoft',  'flatMat',      'tarpaulin',        { fill: '#4a4436', weave: '#332f24' },
                                                                  ['cloth', 'covering',  0, 0]),
        obj('floorProp',  'oreBucket',    'ore bucket',       {}, ['iron',  'treasure',  1, 0]),
        obj('wallSmall',  'gauge',        'blast gauge',      { bezel: '#6e5f4e' },
                                                                  ['iron',  'mechanism', 0, 0]),
        obj('wallMid',    'noticeBoard',  'claim notice',     {}, ['paper', 'picture',   0, 0]),
        obj('wallLarge',  'oreSeam',      'ore seam',         {}, ['rock',  'treasure',  0, 0]),
        obj('storage',    'toolRack',     'tool rack',        { board: '#3d2f1e', metal: '#9aa2a6' },
                                                                  ['iron',  'tools',     0, 0]),
        obj('container',  'crate',        'powder crate',     { wood: '#6a5230', stencil: 'DANGER', stencilFill: '#e8b45c' },
                                                                  ['wood',  'furniture', 1, 0]),
        obj('exit',       'ironDoor',     'shaft gate',       { metal: '#3a2e20' }),
        obj('anchor',     'workBench',    'powder bench',     { wood: '#4a3a26' }),
        drawerObj('drawerWood', 'bench drawer', { body: '#4a3a26' }),
        obj('lockCode',   'strongBox',    'pay strongbox',    {}),
        obj('lockCrank',  'winchHousing', 'hoist housing',    { metal: '#3a3028', brass: '#ffb84d' }),
        obj('light',      'lanternLight', 'miner’s lamp',     { metal: '#9aa2a6' })
      ]
    },
    {
      id: 'observatory',
      name: 'THE OBSERVATORY',
      backdrop: 'dome',
      intro: ['The dome shutter closes on the only sky you could see.',
              'The drive motor stops. In the dark, the great tube keeps tracking.',
              'Someone was here last night, and they wrote down what they saw.'],
      taunts: ['Dust, catching the starlight.', 'A moth, drawn to nothing.',
               'Cold brass and colder air.', 'Someone rebalanced this and left.',
               'Empty. The plates are all elsewhere.', 'A lens cap. No lens.',
               'A pencil stub, sharpened with a knife.', 'An eyepiece box, long empty.'],
      palette: {
        '--bg': '#04060f', '--wall': '#141c33', '--wall2': '#0e1425', '--floor': '#232338',
        '--floor2': '#171727', '--panel': '#131a30', '--line': '#2a3560',
        '--accent': '#7fb8ff', '--soft': '#96a4cc', '--glow': '#cfe4ff'
      },
      objects: [
        /* Nearly everything here is brass, so `kind` is the axis that
           separates them. The astrolabe is filed as a map rather than as a
           mechanism on purpose — its rete IS a turning star chart, and it
           is what stops it and the sidereal dial being the same object. */
        obj('floorSoft',  'zodiacInlay',    'zodiac inlay',   {}, ['brass', 'covering',  0, 0]),
        obj('floorProp',  'orrery',         'orrery',         {}, ['brass', 'mechanism', 0, 0]),
        obj('wallSmall',  'siderealDial',   'sidereal dial',  {}, ['brass', 'mechanism', 0, 0]),
        obj('wallMid',    'astrolabe',      'astrolabe',      {}, ['brass', 'map',       0, 0]),
        obj('wallLarge',  'starChart',      'star chart',     {}, ['paper', 'map',       0, 0]),
        obj('storage',    'instrumentRack', 'instrument rack', {}, ['brass', 'tools',    0, 0]),
        obj('container',  'lensCase',       'lens case',      { wood: '#4a3524' },
                                                                  ['wood',  'furniture', 1, 0]),
        obj('exit',       'ironDoor',       'iron door',      { metal: '#2a3048', rivet: '#7f8bb8' }),
        obj('anchor',     'telescope',      'great refractor', {}),
        drawerObj('drawerWood', 'eyepiece drawer', { body: '#2f3550' }),
        obj('lockCode',   'ironSafe',       'plate vault',    { body: '#2a3048' }),
        obj('lockCrank',  'winchHousing',   'dome drive',     { metal: '#2a3048', brass: '#c9a24e' }),
        obj('light',      'candleLight',    'candle',         {})
      ]
    },
    {
      id: 'boiler',
      name: 'THE BOILER ROOM',
      backdrop: 'ironworks',
      intro: ['The bulkhead swings to, and the wheel spins shut from outside.',
              'Steam screams somewhere behind the plate, then stops. Worse.',
              'The pressure needle is climbing. You would rather it were not.'],
      taunts: ['Soot, and a great deal of it.', 'Something scuttles behind the pipe.',
               'Cinders. Still warm.', 'Scale, flaking off in sheets.',
               'Empty. Shovelled out yesterday.', 'A rag, oil-black.',
               'Coal dust, worked into everything.', 'A gauge glass, cracked across.'],
      palette: {
        '--bg': '#0d0705', '--wall': '#2b211d', '--wall2': '#1c1613', '--floor': '#2a2422',
        '--floor2': '#1a1614', '--panel': '#241b18', '--line': '#4a352c',
        '--accent': '#ff8a3c', '--soft': '#b59283', '--glow': '#ffb877'
      },
      objects: [
        /* Six of the seven are iron, which is the point of the room — so
           the boiler front is separated from the valve wheel by the one
           thing you can see about it: its firebox door OPENS. */
        obj('floorSoft',  'treadPlate',   'deck plate',       {}, ['iron',  'covering',  0, 0]),
        obj('floorProp',  'coalHeap',     'fuel pile',        {}, ['coal',  'heap',      0, 0]),
        obj('wallSmall',  'gauge',        'pressure gauge',   {}, ['glass', 'mechanism', 0, 0]),
        obj('wallMid',    'valveWheel',   'valve wheel',      {}, ['iron',  'mechanism', 0, 0]),
        obj('wallLarge',  'boilerFront',  'boiler front',     {}, ['iron',  'mechanism', 1, 0]),
        obj('storage',    'toolRack',     'spanner rack',     { board: '#3a2f28', metal: '#9aa2a6' },
                                                                  ['iron',  'tools',     0, 0]),
        obj('container',  'coalHatch',    'bunker hatch',     {}, ['iron',  'opening',   1, 0]),
        obj('exit',       'airlockDoor',  'bulkhead door',    { metal: '#3e332e', stripe: '#c9772e' }),
        obj('anchor',     'workBench',    'fitter’s bench',   { wood: '#4a3a32' }),
        drawerObj('drawerSteel', 'tool drawer', { body: '#3e352f' }),
        obj('lockCode',   'ironSafe',     'engineer’s box',   { body: '#3a302a', rivets: 1 }),
        obj('lockCrank',  'tallCabinet',  'valve cabinet',    { body: '#3a302a', panel: 1 }),
        obj('light',      'fireboxLight', 'firebox',          {})
      ]
    },

    /* =====================================================================
       XI-XX. The second ten. Chosen the same way as the first: not for
       being popular themes but for being SEPARABLE — desaturate a
       screenshot of each, shrink it to a thumbnail, and the wall geometry,
       the floor material and the big object's outline still tell you which
       room you are in.

       Two candidates were dropped rather than shipped weak. A submarine
       compartment is a boiler room with the palette turned green — same
       riveted plate, same valve wheels, same pipes — and an apothecary is
       the laboratory in wood. Neither would have survived the thumbnail
       test, and a room that reads as one you have already seen is exactly
       the complaint this file exists to answer.
       ===================================================================== */
    {
      id: 'lighthouse',
      name: 'THE LAMP ROOM',
      backdrop: 'lampRoom',
      intro: ['The gallery door bangs once in the gale and does not open again.',
              'The lens turns. The sea, four times a minute, turns white.',
              'The keeper is not here. His oil can is still warm.'],
      taunts: ['Salt spray, dried to a crust.', 'A gull feather, and nothing under it.',
               'Lamp oil, and a rag that has seen better weeks.', 'Wet rope. Very wet rope.',
               'Empty. The keeper was tidy.', 'A spent match. Someone lit something here.',
               'Grit blown in under the door.', 'A cracked lens prism, long replaced.'],
      palette: {
        '--bg': '#030910', '--wall': '#17253c', '--wall2': '#101a2b', '--floor': '#2f3338',
        '--floor2': '#1e2226', '--panel': '#142136', '--line': '#2f4c6e',
        '--accent': '#ffd27a', '--soft': '#93a8c2', '--glow': '#ffefc4'
      },
      objects: [
        /* The two iron vessels-with-a-hole are the stair head and the oil
           can, and only `place` separates them: the same two-clue trick the
           cell block plays with its cup and its bucket. */
        obj('floorSoft',  'stairHead',     'stair head',       {}, ['iron',  'opening',   1, 0]),
        obj('floorProp',  'oilCan',        'oil can',          {}, ['iron',  'vessel',    1, 0]),
        obj('wallSmall',  'barometer',     'barometer',        {}, ['brass', 'mechanism', 0, 0]),
        obj('wallMid',    'flagBoard',     'flag board',       {}, ['cloth', 'signal',    0, 0]),
        obj('wallLarge',  'fresnelPanel',  'lens panel',       {}, ['glass', 'mechanism', 0, 0]),
        obj('storage',    'pigeonRack',    'chart pigeonholes', { wood: '#4a3f30' },
                                                                  ['wood',  'furniture', 1, 0]),
        obj('container',  'woodChest',     'lamp-oil chest',   { band: '#6a5a3a' },
                                                                  ['wood',  'furniture', 1, 0]),
        obj('exit',       'braceDoor',     'gallery door',     { wood: '#4a4438', iron: '#39424a' }),
        obj('anchor',     'writingDesk',   'keeper’s desk',    { top: '#4a3f30', leg: '#3a3128' }),
        drawerObj('drawerWood', 'log drawer', { body: '#4a3f30' }),
        obj('lockCode',   'strongBox',     'instrument case',  { wood: '#3d3a44', metal: '#8a7a4a' }),
        obj('lockCrank',  'winchHousing',  'lens drive',       { metal: '#3a444c', brass: '#c99a3f' }),
        obj('light',      'lanternLight',  'lamp burner',      { metal: '#c99a3f' })
      ]
    },
    {
      id: 'vault',
      name: 'THE VAULT',
      backdrop: 'vaultRoom',
      intro: ['The round door swings to. Eleven tons, and it makes almost no sound at all.',
              'The time lock is wound. It will open on Monday, with or without you.',
              'Somebody counted this room out and left one thing in it.'],
      taunts: ['Dust, on a great deal of money.', 'A paper band, cut and empty.',
               'Nothing. Audited nothing.', 'A dropped coin, and a shallow disappointment.',
               'Empty, and initialled twice.', 'A rubber stamp, inkless.',
               'Someone has been here with a ledger.', 'A torn corner of a banknote.'],
      palette: {
        '--bg': '#07070a', '--wall': '#2b2a34', '--wall2': '#1e1d26', '--floor': '#33313a',
        '--floor2': '#232128', '--panel': '#232230', '--line': '#4a4760',
        '--accent': '#e8c46a', '--soft': '#b0acc0', '--glow': '#ffe8b8'
      },
      objects: [
        obj('floorSoft',  'flatMat',       'canvas runner',    { fill: '#5a5448', weave: '#413c33' },
                                                                  ['cloth', 'covering',  0, 0]),
        obj('floorProp',  'cashSack',      'money sack',       {}, ['cloth', 'vessel',    1, 0]),
        obj('wallSmall',  'timeLock',      'time lock',        {}, ['brass', 'mechanism', 0, 0]),
        obj('wallMid',    'bondCert',      'framed bond',      {}, ['paper', 'picture',   0, 0]),
        obj('wallLarge',  'depositBoxes',  'deposit boxes',    {}, ['brass', 'furniture', 1, 0]),
        obj('storage',    'bullionShelf',  'bullion shelf',    {}, ['gold',  'treasure',  0, 0]),
        obj('container',  'steelCase',     'cash case',        { metal: '#57606a' },
                                                                  ['metal', 'furniture', 1, 0]),
        obj('exit',       'vaultDoor',     'vault door',       {}),
        obj('anchor',     'steelTable',    'counting table',   { metal: '#4a4a54' }),
        drawerObj('drawerSteel', 'cash drawer', { body: '#454550' }),
        obj('lockCode',   'ironSafe',      'night safe',       { body: '#2f2e3a', rivets: 1 }),
        obj('lockCrank',  'winchHousing',  'boltwork gearing', { metal: '#3a3946', brass: '#c9a24e' }),
        obj('light',      'cagedBulb',     'caged lamp',       { metal: '#8a7a4a' })
      ]
    },
    {
      id: 'scriptorium',
      name: 'THE SCRIPTORIUM',
      backdrop: 'cloister',
      intro: ['The door closes on its own weight, and the latch drops in the dark.',
              'Compline was an hour ago. Nobody is coming back for the candle.',
              'Someone here spent forty years copying, and hid one page of it.'],
      taunts: ['Wax, and a great deal of dust.', 'A quill, split and useless.',
               'Vellum scraps. Nothing written on them.', 'Cold stone, and colder devotion.',
               'Empty. Poverty is the rule here.', 'A dried inkwell, black to the bottom.',
               'Grit from the floor, and no more.', 'A pressed flower, four centuries old.'],
      palette: {
        '--bg': '#0d0d09', '--wall': '#303029', '--wall2': '#22221c', '--floor': '#3a352a',
        '--floor2': '#26221b', '--panel': '#2a2a24', '--line': '#4e4c3e',
        '--accent': '#e8c46a', '--soft': '#b6b09a', '--glow': '#ffe9b8'
      },
      objects: [
        obj('floorSoft',  'flatMat',       'rush matting',     { fill: '#8a7a4a', weave: '#6a5c34' },
                                                                  ['reed',   'covering',  0, 0]),
        obj('floorProp',  'scrollBin',     'scroll basket',    {}, ['reed',   'vessel',    1, 0]),
        obj('wallSmall',  'sanctusBell',   'sanctus bell',     {}, ['bronze', 'signal',    1, 0]),
        obj('wallMid',    'iconPanel',     'gilded icon',      {}, ['gold',   'picture',   0, 0]),
        obj('wallLarge',  'traceryArch',   'traceried arch',   {}, ['glass',  'window',    0, 0]),
        obj('storage',    'pigeonRack',    'scroll rack',      { wood: '#4a3a28', roll: '#e0d3b0' },
                                                                  ['wood',   'furniture', 1, 0]),
        obj('container',  'woodChest',     'book chest',       { band: '#3a3128' },
                                                                  ['wood',   'furniture', 1, 0]),
        obj('exit',       'archDoor',      'cloister door',    {}),
        obj('anchor',     'slopeDesk',     'writing slope',    {}),
        drawerObj('drawerWood', 'ink drawer', { body: '#4e3b26' }),
        obj('lockCode',   'strongBox',     'reliquary',        { wood: '#4a3a28', metal: '#8a7a4a' }),
        obj('lockCrank',  'tallCabinet',   'vestment press',   { body: '#3f3226', panel: 1 }),
        obj('light',      'candleLight',   'tallow candle',    {})
      ]
    },
    {
      id: 'taxidermy',
      name: 'THE TAXIDERMIST’S',
      backdrop: 'parlour',
      intro: ['The shop bell rings once as the door shuts, and the key turns outside.',
              'Forty glass eyes follow you across the room. None of them blink.',
              'Something on this wall was alive last week, and something else is still counting.'],
      taunts: ['Sawdust, and a smell of alum.', 'A moth, which is ironic.',
               'Wood wool, and a stray feather.', 'Nothing but wire and stuffing.',
               'Empty. Mounted, and empty.', 'A jar of arsenical soap. Do not.',
               'Dust, on something that used to fly.', 'A label: SPECIMEN, and no specimen.'],
      palette: {
        '--bg': '#0f0b09', '--wall': '#37302f', '--wall2': '#262120', '--floor': '#3a3128',
        '--floor2': '#26201a', '--panel': '#2e2726', '--line': '#55443c',
        '--accent': '#c8825a', '--soft': '#b3a08e', '--glow': '#ffd0a8'
      },
      objects: [
        /* Three glass objects and two furred ones, crossed against three
           mounted specimens: the room's whole deduction is "which glass
           thing" or "which mounted thing", never one clue and done. */
        obj('floorSoft',  'pelt',          'stretched pelt',   {}, ['fur',   'covering',  0, 0]),
        obj('floorProp',  'domeBird',      'bird under a dome', {}, ['glass', 'mount',    0, 0]),
        obj('wallSmall',  'glassEyes',     'tray of eyes',     {}, ['glass', 'tools',     0, 0]),
        obj('wallMid',    'insectCase',    'pinned insects',   {}, ['glass', 'mount',     0, 0]),
        obj('wallLarge',  'stagMount',     'mounted stag',     {}, ['fur',   'mount',     0, 0]),
        obj('storage',    'toolRack',      'skinner’s rack',   { board: '#3a2a1c', metal: '#b8bec0' },
                                                                  ['iron',  'tools',     0, 0]),
        obj('container',  'woodChest',     'skin trunk',       { band: '#4a3a2a' },
                                                                  ['wood',  'furniture', 1, 0]),
        obj('exit',       'panelDoor',     'shop door',        {}),
        obj('anchor',     'workBench',     'mounting bench',   { wood: '#4a3a28' }),
        drawerObj('drawerWood', 'wire drawer', { body: '#4a3a28' }),
        obj('lockCode',   'strongBox',     'arsenic box',      { wood: '#4a3a28', metal: '#5a4a3a' }),
        obj('lockCrank',  'tallCabinet',   'specimen press',   { body: '#3a2c22', panel: 1 }),
        obj('light',      'lanternLight',  'work lamp',        { metal: '#8a7a54' })
      ]
    },
    {
      id: 'train',
      name: 'THE GUARD’S VAN',
      backdrop: 'carriage',
      intro: ['The van door slams on its track, and the night goes past at fifty.',
              'Nobody rides in here but the guard, and the guard got off at the last stop.',
              'Something in this van is going somewhere. It is not you, yet.'],
      taunts: ['Soot, and the smell of hot oil.', 'A dead moth on the sill.',
               'String. Just string.', 'Coal dust worked into the boards.',
               'Empty. Signed for and empty.', 'A punched ticket, dated yesterday.',
               'Straw packing, and nothing packed in it.', 'A luggage label, torn at the eyelet.'],
      palette: {
        '--bg': '#0d0705', '--wall': '#33231f', '--wall2': '#241715', '--floor': '#3c2c1c',
        '--floor2': '#281d12', '--panel': '#2a1c18', '--line': '#56382c',
        '--accent': '#e8a24a', '--soft': '#bb9a80', '--glow': '#ffd9a0'
      },
      objects: [
        obj('floorSoft',  'mailSacks',     'mail sacks',       {}, ['cloth',   'vessel',    1, 0]),
        obj('floorProp',  'coalScuttle',   'coal scuttle',     {}, ['iron',    'vessel',    1, 0]),
        obj('wallSmall',  'clockFace',     'station clock',    {}, ['wood',    'mechanism', 0, 0]),
        obj('wallMid',    'labelBoard',    'label board',      {}, ['paper',   'marking',   0, 0]),
        obj('wallLarge',  'routeChart',    'route chart',      {}, ['paper',   'map',       0, 0]),
        obj('storage',    'pigeonRack',    'parcel shelf',     { wood: '#4a3624', roll: '#c8b48a' },
                                                                  ['wood',    'furniture', 1, 0]),
        obj('container',  'steamerTrunk',  'steamer trunk',    {}, ['leather', 'furniture', 1, 0]),
        obj('exit',       'slideDoor',     'van door',         {}),
        obj('anchor',     'writingDesk',   'guard’s desk',     { top: '#4a3524', leg: '#3a291c' }),
        drawerObj('drawerWood', 'ticket drawer', { body: '#4a3524' }),
        obj('lockCode',   'strongBox',     'mail strongbox',   {}),
        obj('lockCrank',  'tallCabinet',   'brake locker',     { body: '#3d2b1e', panel: 1 }),
        obj('light',      'lanternLight',  'guard’s lamp',     {})
      ]
    },
    {
      id: 'icehouse',
      name: 'THE ICEHOUSE',
      backdrop: 'frostVault',
      intro: ['The insulated door thumps shut, and the cold starts on your hands first.',
              'Nothing rots in here. Nothing hurries, either.',
              'Somebody cut this ice last winter and wrote down where they put it.'],
      taunts: ['Wet sawdust. Cold, wet sawdust.', 'A frozen spider, mid-thought.',
               'Meltwater, running somewhere useful.', 'Straw, packed hard as board.',
               'Empty, and colder for it.', 'A hook with nothing on it.',
               'Frost, and the shape of somebody’s hand in it.', 'A broken pick tip.'],
      palette: {
        '--bg': '#04090c', '--wall': '#1e2c33', '--wall2': '#142027', '--floor': '#2a3238',
        '--floor2': '#1b2126', '--panel': '#17252c', '--line': '#3d5f6b',
        '--accent': '#b8ecff', '--soft': '#9fbccc', '--glow': '#dff4ff'
      },
      objects: [
        obj('floorSoft',  'sawdustBed',    'sawdust bed',      {}, ['wood',  'covering',  0, 0]),
        obj('floorProp',  'iceBlock',      'frozen slab',      {}, ['ice',   'block',     0, 0]),
        obj('wallSmall',  'gauge',         'cold-room dial',   { bezel: '#8fa8b0' },
                                                                  ['glass', 'mechanism', 0, 0]),
        obj('wallMid',    'deliverySlate', 'delivery slate',   {}, ['stone', 'marking',   0, 0]),
        obj('wallLarge',  'iceStack',      'packed stack',     {}, ['ice',   'block',     0, 0]),
        obj('storage',    'toolRack',      'ice saws',         { board: '#4a4238', metal: '#c2ccd0' },
                                                                  ['iron',  'tools',     0, 0]),
        obj('container',  'crate',         'straw crate',      { wood: '#6a5a3e', lid: '#7d6b48', stencil: 'ICE' },
                                                                  ['wood',  'furniture', 1, 0]),
        obj('exit',       'braceDoor',     'cold-store door',  { wood: '#4a4a46', iron: '#39423e', frost: '#cfe4ea' }),
        obj('anchor',     'workBench',     'packing bench',    { wood: '#4a4438' }),
        drawerObj('drawerWood', 'tally drawer', { body: '#4a4438' }),
        obj('lockCode',   'strongBox',     'tally box',        { wood: '#4a4438', metal: '#3d4448' }),
        obj('lockCrank',  'winchHousing',  'block hoist',      { metal: '#3a4248', brass: '#a8bcc4' }),
        obj('light',      'lanternLight',  'storm lantern',    { metal: '#8fa8b0' })
      ]
    },
    {
      id: 'toyshop',
      name: 'THE TOY WORKSHOP',
      backdrop: 'attic',
      intro: ['The workshop door shuts, and every toy in the room stops at once.',
              'Somebody was painting in here five minutes ago. The brush is still wet.',
              'Twenty dolls, and not one of them is facing the wall.'],
      taunts: ['Wood shavings, curled like ribbon.', 'A single glass marble. It rolls away.',
               'Paint, mostly dried.', 'Sawdust, and a lost wheel.',
               'Empty. Someone tidied, badly.', 'A doll’s arm. Only the arm.',
               'Glue, gone hard in the pot.', 'A skittle, and no set to belong to.'],
      palette: {
        '--bg': '#0e070f', '--wall': '#33223a', '--wall2': '#241829', '--floor': '#3d3020',
        '--floor2': '#281f14', '--panel': '#2a1c30', '--line': '#59396a',
        '--accent': '#ffca3a', '--soft': '#c0a8c8', '--glow': '#ffe8a0'
      },
      objects: [
        obj('floorSoft',  'persianRug',    'rag rug',          { fill: '#8a3a4a', edge: '#5d2530', trim: '#e8c44a' },
                                                                  ['cloth', 'covering',  0, 0]),
        obj('floorProp',  'rockingHorse',  'rocking horse',    {}, ['wood',  'toy',       0, 0]),
        obj('wallSmall',  'clockFace',     'nursery clock',    {}, ['wood',  'mechanism', 0, 0]),
        obj('wallMid',    'puppetRack',    'hanging puppets',  {}, ['wood',  'toy',       0, 0]),
        obj('wallLarge',  'alphabetChart', 'alphabet chart',   {}, ['paper', 'picture',   0, 0]),
        obj('storage',    'paintShelf',    'paint shelf',      {}, ['metal', 'tools',     0, 0]),
        obj('container',  'woodChest',     'toy chest',        { band: '#b4342e' },
                                                                  ['wood',  'furniture', 1, 0]),
        obj('exit',       'braceDoor',     'workshop door',    { wood: '#5a4a5a', iron: '#3a2f42' }),
        obj('anchor',     'workBench',     'toymaker’s bench', { wood: '#6a5238' }),
        drawerObj('drawerWood', 'nail drawer', { body: '#6a5238' }),
        obj('lockCode',   'strongBox',     'money tin',        { wood: '#4a3a5a', metal: '#3a2f48' }),
        obj('lockCrank',  'tallCabinet',   'parts cupboard',   { body: '#43335a', panel: 1 }),
        obj('light',      'candleLight',   'stub of candle',   {})
      ]
    },
    {
      id: 'theatre',
      name: 'THE OPERATING THEATRE',
      backdrop: 'gallery',
      intro: ['The doors swing to, and the gallery above you is entirely empty. Entirely.',
              'The lecture ended an hour ago. The sawdust has not been changed.',
              'Somebody wrote the outcome in a book, and then hid the book.'],
      taunts: ['Sawdust, and something the sawdust was for.', 'A fly, doing its rounds.',
               'Carbolic. Your eyes water.', 'Lint, and a bloodied thread.',
               'Empty. Scrubbed, and empty.', 'A tooth. Not yours, thankfully.',
               'Chalk from the demonstration board.', 'A ligature, tied and cut.'],
      palette: {
        '--bg': '#0a0906', '--wall': '#2b2c24', '--wall2': '#1d1e18', '--floor': '#3a332a',
        '--floor2': '#26211a', '--panel': '#26271f', '--line': '#4a4a38',
        '--accent': '#d8cbb0', '--soft': '#ada08a', '--glow': '#ffe9c4'
      },
      objects: [
        obj('floorSoft',  'sawdustBed',    'sawdust box',      { fill: '#9a8a5a', stain: '#5a2020' },
                                                                  ['wood',  'covering',  0, 0]),
        obj('floorProp',  'slopBucket',    'enamel pail',      { fill: '#8a9490', rim: '#b6bec2' },
                                                                  ['metal', 'vessel',    1, 0]),
        obj('wallSmall',  'skullMount',    'anatomy skull',    {}, ['bone',  'mount',     0, 0]),
        obj('wallMid',    'anatomyChart',  'muscle chart',     {}, ['paper', 'picture',   0, 0]),
        obj('wallLarge',  'skeletonCase',  'skeleton case',    {}, ['glass', 'mount',     1, 0]),
        obj('storage',    'instrumentTray', 'instrument tray', {}, ['metal', 'tools',     0, 0]),
        obj('container',  'woodChest',     'amputation case',  { band: '#8a7a4a' },
                                                                  ['wood',  'furniture', 1, 0]),
        obj('exit',       'panelDoor',     'theatre door',     {}),
        obj('anchor',     'operatingTable', 'operating table', {}),
        drawerObj('drawerWood', 'dressings drawer', { body: '#5a4530' }),
        obj('lockCode',   'strongBox',     'poison box',       { wood: '#4a3a2a', metal: '#3a352c' }),
        obj('lockCrank',  'tallCabinet',   'surgeon’s cabinet', { body: '#3a352c', panel: 1 }),
        obj('light',      'gasMantle',     'gas lamp',         {})
      ]
    },
    {
      id: 'radio',
      name: 'THE RADIO STATION',
      backdrop: 'studio',
      intro: ['The padded door seals, and the room goes as quiet as a room can go.',
              'The sign says ON AIR. You are, apparently, on air.',
              'Somebody read something out in here last night that they should not have.'],
      taunts: ['Dust, on a dead microphone.', 'A moth in the valve heat. Warm, at least.',
               'Cable. Yards of cable.', 'Nothing but the hum.',
               'Empty, and unbroadcastable.', 'A grease pencil, worn to a stub.',
               'A splice of tape, going nowhere.', 'A cue card, blank side up.'],
      palette: {
        '--bg': '#06080b', '--wall': '#232830', '--wall2': '#181c22', '--floor': '#2c2c30',
        '--floor2': '#1c1c20', '--panel': '#1e232b', '--line': '#3b4452',
        '--accent': '#ff5a3c', '--soft': '#a0a6b0', '--glow': '#ffb08a'
      },
      objects: [
        obj('floorSoft',  'ropeCoil',      'coil of cable',    { fill: '#2b2b30' },
                                                                  ['rubber', 'covering',  0, 0]),
        obj('floorProp',  'micStand',      'microphone',       {}, ['metal',  'mechanism', 0, 0]),
        obj('wallSmall',  'gauge',         'level meter',      { bezel: '#2f3438' },
                                                                  ['glass',  'mechanism', 0, 0]),
        obj('wallMid',    'onAirSign',     'studio sign',      {}, ['glass',  'signal',    0, 0]),
        obj('wallLarge',  'valveRack',     'transmitter bay',  {}, ['metal',  'mechanism', 0, 0]),
        obj('storage',    'discShelf',     'disc shelf',       {}, ['paper',  'records',   0, 0]),
        obj('container',  'steelCase',     'equipment case',   { metal: '#4a5054' },
                                                                  ['metal',  'furniture', 1, 0]),
        obj('exit',       'studioDoor',    'padded door',      {}),
        obj('anchor',     'mixDesk',       'control desk',     {}),
        drawerObj('drawerSteel', 'console drawer', { body: '#3a4044' }),
        obj('lockCode',   'ironSafe',      'log safe',         { body: '#2e3438', rivets: 1 }),
        obj('lockCrank',  'tallCabinet',   'amplifier bay',    { body: '#2f3438', panel: 1 }),
        obj('light',      'cagedBulb',     'work light',       { metal: '#5a6266' })
      ]
    },
    {
      id: 'belfry',
      name: 'THE BELL TOWER',
      backdrop: 'louvre',
      intro: ['The tower door shuts below you, and the stair goes dark all the way down.',
              'The tenor is up. If it comes over now, nobody will hear you at all.',
              'A ringer left something here, and left instructions with it.'],
      taunts: ['Jackdaw sticks and grit.', 'A pigeon, deeply unimpressed.',
               'Rope fibre, and years of dust.', 'Bird lime. You wish you had not.',
               'Empty. Swept, once, in 1890.', 'A sally end, frayed to nothing.',
               'Cold bronze, and colder air.', 'A peal card, curled and faded.'],
      palette: {
        '--bg': '#08090b', '--wall': '#2a2b2e', '--wall2': '#1c1d20', '--floor': '#35322a',
        '--floor2': '#232019', '--panel': '#232427', '--line': '#46474e',
        '--accent': '#cdb078', '--soft': '#a6a6a2', '--glow': '#ecdfba'
      },
      objects: [
        /* Two bronze bells, one on the floor and one on the wall, identical
           in every trait but `place`. Same device as the cell block's cup
           and bucket, and it is what stops one clue ending the room. */
        obj('floorSoft',  'ropeCoil',      'bell pull',        { fill: '#b8a878' },
                                                                  ['rope',   'covering',  0, 0]),
        obj('floorProp',  'handBell',      'hand bell',        {}, ['bronze', 'signal',    1, 0]),
        obj('wallSmall',  'dialBack',      'clock dial',       {}, ['glass',  'mechanism', 0, 0]),
        obj('wallMid',    'ivyBreak',      'broken louvre',    {}, ['wood',   'growth',    0, 1]),
        obj('wallLarge',  'greatBell',     'tenor bell',       {}, ['bronze', 'signal',    1, 0]),
        obj('storage',    'toolRack',      'ringer’s kit',     { board: '#5a5246', metal: '#a8a49a' },
                                                                  ['iron',   'tools',     0, 0]),
        obj('container',  'woodChest',     'ringers’ chest',   { band: '#5a5246' },
                                                                  ['wood',   'furniture', 1, 0]),
        obj('exit',       'archDoor',      'tower door',       { wood: '#4a4438', iron: '#33302a' }),
        obj('anchor',     'workBench',     'ringers’ bench',   { wood: '#5a5246' }),
        drawerObj('drawerWood', 'peal drawer', { body: '#5a5246' }),
        obj('lockCode',   'strongBox',     'vestry box',       { wood: '#4a4438', metal: '#3a3830' }),
        obj('lockCrank',  'winchHousing',  'winding gear',     { metal: '#42403a', brass: '#a8843c' }),
        obj('light',      'lanternLight',  'hurricane lamp',   { metal: '#8d8478' })
      ]
    }
  ];

  /* =====================================================================
     BUILD
     ===================================================================== */

  /* Which objects can HIDE something, which are LOCKS, which are scenery.
     Derived from the role rather than declared per object, because the
     seven searchable roles ARE the seven hiding places by definition —
     letting a setting opt out would silently make a chamber unwinnable
     when the generator put the brass key there. */
  function kindOf(o) {
    if (o.kind) return o.kind;
    if (SEARCH_ROLES.indexOf(o.role) >= 0) return 'search';
    if (o.role === 'exit' || o.role === 'lockSmall' ||
        o.role === 'lockCode' || o.role === 'lockCrank') return 'lock';
    return 'scenery';
  }

  /* Role-mandated extras. Emitted here rather than inside the parts so a
     new part physically cannot forget the UV ink or the rug fold. */
  function roleExtras(role) {
    if (role === 'wallLarge') return uvText('uvA', 12, 38, 8);
    if (role === 'wallMid')   return uvText('uvB', 8, 26, 5);
    if (role === 'wallSmall') return uvText('uvC', 56, 26, 5);
    if (role === 'floorSoft') {
      return pth('M82 -18 q40 -8 46 -27 l-52 -8 z', 'id="rugFold" style="display:none" fill="#8a4a58"') +
        uvText('uvRug', -30, 26, 10);
    }
    return '';
  }

  function objectSVG(o) {
    var part = PARTS[o.part];
    if (!part) throw new Error('ECThemes: unknown part "' + o.part + '" for #' + o.id);
    var kind = kindOf(o);
    var inner = '<g transform="translate(' + o.x + ',' + o.y + ')">' +
                part(o.opt || {}) + roleExtras(o.role) + '</g>';
    /* Search targets get the .tiltable wrapper the CSS animates on
       .searched. It must carry NO transform attribute of its own — a CSS
       transform overrides the attribute outright, so the placement
       translate has to live on the layer inside it. */
    if (kind === 'search') inner = '<g class="tiltable">' + inner + '</g>';
    /* The outer group is where game.js:applyRoomStyle() writes its own
       translate for the per-chamber furniture permutation. Nothing else
       may set a transform on it. */
    return '<g id="' + o.id + '"' + (kind === 'scenery' && o.id !== 'candleG' ? '' : ' class="hot"') +
           ' data-part="' + o.part + '" data-role="' + o.role + '">' + inner + '</g>';
  }

  /* Draw order matters and is NOT the declaration order: the light is
     painted last so its glow lies over the room, exactly as the original
     did — which is also why it needs pointer-events="none". */
  var DRAW_ORDER = ['exit', 'lockCrank', 'wallLarge', 'wallMid', 'wallSmall', 'storage',
                    'anchor', 'lockSmall', 'floorProp', 'lockCode', 'floorSoft',
                    'container', 'light'];

  function roomSVG(setting) {
    var out = BACKDROPS[setting.backdrop]();
    var i, j;
    for (i = 0; i < DRAW_ORDER.length; i++) {
      for (j = 0; j < setting.objects.length; j++) {
        if (setting.objects[j].role === DRAW_ORDER[i]) out += objectSVG(setting.objects[j]);
      }
    }
    return out;
  }

  /* Decorate each setting with the lookups the game actually asks for. */
  function index(s) {
    s.byRole = {}; s.byId = {}; s.names = {}; s.search = []; s.locks = []; s.scenery = [];
    var i, o;
    for (i = 0; i < s.objects.length; i++) {
      o = s.objects[i];
      o.kind = kindOf(o);
      o.hides = (o.kind === 'search');
      s.byRole[o.role] = o; s.byId[o.id] = o; s.names[o.id] = o.name;
      (o.kind === 'search' ? s.search : o.kind === 'lock' ? s.locks : s.scenery).push(o.id);
    }
    return s;
  }
  for (var si = 0; si < SETTINGS.length; si++) index(SETTINGS[si]);

  var BY_ID = {};
  for (si = 0; si < SETTINGS.length; si++) BY_ID[SETTINGS[si].id] = SETTINGS[si];

  /* Twenty chambers over ten settings. `i % 10` and NOT `floor(i/2)`:
     modulo means the first ten chambers a new player sees are ten
     different places, which is the entire point of this file. The repeat
     on 11-20 lands at a higher difficulty tier, so the room is familiar
     while the puzzle is not. */
  function themeFor(i) { return SETTINGS[((i % SETTINGS.length) + SETTINGS.length) % SETTINGS.length]; }

  /* =====================================================================
     VALIDATE
     ---------------------------------------------------------------------
     Not called on boot — it costs a full render of every setting. It is
     for the harness and the test suite. Everything it checks is something
     that fails SILENTLY at runtime: a missing #safeItem means the safe
     opens and shows nothing, a missing #uvA means tier 4 has no clue, and
     a #glowE without pointer-events="none" re-breaks the July tap bug.
     ===================================================================== */
  var REQUIRED_IDS = ['rug', 'plant', 'clock', 'pA', 'pB', 'shelf', 'chest',
                      'door', 'drawer', 'safe', 'cab', 'candleG',
                      'sigilBadge', 'cabSocket', 'cabOpenG', 'drawerOpenG', 'drawerItem',
                      'safeOpenG', 'safeItem', 'chestLid', 'chestOpenG', 'rugFold',
                      'uvA', 'uvB', 'uvC', 'uvRug', 'flame', 'glowE'];

  function validate() {
    var problems = [], i, j, k;
    for (i = 0; i < SETTINGS.length; i++) {
      var s = SETTINGS[i], svg;
      try { svg = roomSVG(s); }
      catch (e) { problems.push(s.id + ': ' + e.message); continue; }
      for (j = 0; j < REQUIRED_IDS.length; j++) {
        var id = REQUIRED_IDS[j];
        var n = svg.split('id="' + id + '"').length - 1;
        if (n !== 1) problems.push(s.id + ': id "' + id + '" appears ' + n + ' times, expected 1');
      }
      if (svg.indexOf('id="glowE" fill="url(#ecGlow)" pointer-events="none"') < 0) {
        problems.push(s.id + ': #glowE is missing pointer-events="none" — this is the ' +
                      'bug where the candle glow swallowed taps on the drawer and shelf');
      }
      for (k = 0; k < SEARCH_IDS.length; k++) {
        if (!s.byId[SEARCH_IDS[k]]) problems.push(s.id + ': no object fills search slot ' + SEARCH_IDS[k]);
      }
      if (s.search.length !== 7) problems.push(s.id + ': ' + s.search.length + ' searchable objects, expected 7');
      if (!s.palette['--wall']) problems.push(s.id + ': palette has no --wall');
      if (s.intro.length < 3) problems.push(s.id + ': needs 3 intro lines (game.js indexes i % 3)');
      problems = problems.concat(traitProblems(s));
    }
    return problems;
  }

  /* The three ways a trait table degrades the key hunt without erroring.
     All of them fail SILENTLY at runtime — puzzle.js just sets
     degraded:true and hands out a clue that names the spot — so they are
     only ever caught here. What this CANNOT check is whether a trait is
     true of the drawing; that stays a human obligation. */
  var TRAIT_AXES = ['place', 'made', 'kind', 'hollow', 'living'];

  function traitProblems(s) {
    var out = [], i, j, a, spots = [];
    for (i = 0; i < s.search.length; i++) {
      var o = s.byId[s.search[i]];
      if (!o.traits) { out.push(s.id + ': ' + o.id + ' (' + o.name + ') has no traits'); continue; }
      for (j = 0; j < TRAIT_AXES.length; j++) {
        if (o.traits[TRAIT_AXES[j]] === undefined) {
          out.push(s.id + ': ' + o.id + ' is missing trait "' + TRAIT_AXES[j] + '"');
        }
      }
      spots.push(o);
    }
    if (spots.length !== 7) return out;

    /* Two axes must each carry three or more values. One rich axis is not
       enough: the tier 4-5 clue kinds draw from two independent axes, and
       with only one they quietly relax to tier-3 difficulty. */
    var rich = 0;
    for (j = 0; j < TRAIT_AXES.length; j++) {
      a = TRAIT_AXES[j];
      var vals = [];
      for (i = 0; i < spots.length; i++) {
        if (vals.indexOf(spots[i].traits[a]) < 0) vals.push(spots[i].traits[a]);
      }
      if (vals.length >= 3) rich++;
    }
    if (rich < 2) out.push(s.id + ': only ' + rich + ' trait axis with 3+ distinct values, need 2');

    /* Two objects identical on every axis can never be told apart. */
    for (i = 0; i < spots.length; i++) {
      for (j = i + 1; j < spots.length; j++) {
        var same = true, k;
        for (k = 0; k < TRAIT_AXES.length; k++) {
          if (spots[i].traits[TRAIT_AXES[k]] !== spots[j].traits[TRAIT_AXES[k]]) { same = false; break; }
        }
        if (same) out.push(s.id + ': ' + spots[i].id + ' and ' + spots[j].id +
                           ' share every trait — no clue can separate them');
      }
    }
    return out;
  }

  global.ECThemes = {
    list: SETTINGS,
    byId: BY_ID,
    themeFor: themeFor,
    roomSVG: roomSVG,
    objectSVG: objectSVG,
    defs: defs,
    validate: validate,
    ROLES: ROLES,
    SEARCH_ROLES: SEARCH_ROLES,
    SEARCH_IDS: SEARCH_IDS,
    ANCHORS: ANCHORS,
    PARTS: PARTS,
    BACKDROPS: BACKDROPS
  };
})(window);
