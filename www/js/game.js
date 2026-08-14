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

  var THEMES = ['THE STUDY', 'THE CELLAR', 'THE GREENHOUSE', 'THE OBSERVATORY', 'THE ATTIC'];
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

  function genLevel(i) {
    var R = mulberry(i * 7919 + 31);
    var pick = function (a) { return a[Math.floor(R() * a.length)]; };
    var tier = i < 4 ? 1 : i < 8 ? 2 : i < 12 ? 3 : i < 16 ? 4 : 5;
    var spots = shuffle(SEARCH, R);
    var L = { tier: tier, brassSpot: spots[0], clueSpot: pick(CLUES),
              hides: {}, taunts: {}, code: '', seq: [] };
    var T = ['Dust. Endless dust.', 'A spider glares back at you.',
             'Nothing but cobwebs.', 'Something skitters away. Nope.',
             'Empty. Suspiciously empty.', 'Just old memories.',
             'You find lint. Congratulations.', 'A faded receipt from long ago.'];
    SEARCH.forEach(function (s) { L.taunts[s] = pick(T); });
    L.code = Array.from({ length: tier >= 4 ? 4 : 3 },
                        function () { return Math.floor(R() * 10); }).join('');
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
    if (L.tier === 1 && !has('ironKey'))
      return { key: 'search1', text: 'Something is hidden in this room. Search the rug, plant, clock, paintings, shelf and chest.' };
    if (L.tier > 1 && !has('brassKey') && !S.drawer)
      return { key: 'findBrass', text: 'A brass key hides somewhere. Search every corner.' };
    if (L.tier > 1 && !S.drawer && has('brassKey'))
      return { key: 'useBrass', text: 'Select the brass key, then tap the desk drawer.' };
    if (L.tier === 3 && S.drawer && !S.safe)
      return { key: 'note', text: 'The note in your bag knows the safe code. Tap the note to read it, then tap the safe.' };
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
    return { key: 'searchMore', text: 'Search the room — something is still hidden.' };
  }

  function useHint() {
    if (!inChamber()) { toast('Open a chamber first.'); return; }
    var h = nextHint();

    // Already paid for this step in this chamber -> free re-read.
    if (S.paidHints[h.key]) { toast('💡 ' + h.text); return; }

    if (!Save.spendHint()) { Shop.promptOutOfHints(); return; }

    S.paidHints[h.key] = true;
    S.hintsUsed++;
    refreshHintUI();
    toast('💡 ' + h.text);
  }

  /* ---------------- level ---------------- */
  function closeAllOverlays() {
    ['padOv','symOv','winOv','shopOv','hintOv','menu'].forEach(function (id) {
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
          paidHints: {}, hintsUsed: 0 };

    document.body.className = 't' + (i % 5);
    $('roomTitle').textContent = THEMES[i % 5] + ' · CHAMBER ' + ROMAN[i];

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
    if (L.tier >= 4) $(UVEL[L.clueSpot]).textContent = L.code.split('').join(' ');
    $('uvRug').textContent = L.tier >= 5 ? L.seq.join(' ') : '';

    renderInv();
    refreshHintUI();
    startTimer();
    $('timer').textContent = '0:00';
    closeAllOverlays();

    toast(['The door slams shut behind you.',
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
      $(id).classList.add('searched');
      if (id === 'rug') $('rugFold').style.display = '';
      if (id === 'chest') { $('chestLid').style.display = 'none'; $('chestOpenG').style.display = ''; }
      if (hid) {
        give(hid);
        toast((id === 'rug' ? 'Under the rug' : 'Behind the ' + SPOTNAME[id]) + ' — a ' + LBL[hid] + '!');
        return;
      }
      toast(L.taunts[id]);
      return;
    }
    /* already searched: contextual re-read */
    if (id === L.clueSpot && L.tier >= 4) {
      toast(S.uvOn ? '✨ Ghostly ink blazes: "' + L.code + '"'
                   : 'The surface shimmers oddly in the low light…');
      return;
    }
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

    $('winTitle').textContent = cur === 19 ? 'ALL 20 CHAMBERS ESCAPED'
                                           : 'CHAMBER ' + ROMAN[cur] + ' ESCAPED';
    $('winText').innerHTML =
      'The iron key turns with a deep <em>clunk</em>.<br><br>' +
      'Time: <b>' + fmt(t) + '</b> · Hints used: <b>' + S.hintsUsed + '</b>' +
      (earned ? '<br><br>🕯️ <b>+' + earned + ' hint</b> for a first escape.' : '');
    $('nextBtn').style.display = cur === 19 ? 'none' : '';
    $('winOv').classList.add('show');
    buzz([40, 60, 120]);
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
    var g = $('grid');
    g.innerHTML = '';
    for (var i = 0; i < 20; i++) {
      (function (i) {
        var b = document.createElement('button');
        b.className = 'lv';
        b.textContent = i + 1;
        if (Save.isDone(i)) b.classList.add('done');
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
          toast('The note reads: "' + L.code + '". Someone circled it twice.');
          return;
        }
        S.sel = (S.sel === n) ? null : n;
        renderInv();
        if (S.sel) toast(LBL[n] + ' selected. Tap where to use it.');
      });
    }

    SEARCH.forEach(function (id) {
      $(id).addEventListener('click', function () { searchSpot(id); });
    });

    $('drawer').addEventListener('click', function (e) {
      e.stopPropagation();
      if (!inChamber()) return;
      if (L.tier === 1) { toast('Unlocked, and utterly empty. Rude.'); return; }
      if (S.drawer) { toast('The drawer hangs open, empty.'); return; }
      if (S.sel === 'brassKey') {
        S.drawer = true; take('brassKey');
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
        S.cab = true; take('crank');
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
        if (entry.length === L.code.length) setTimeout(function () {
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
        }, 200);
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
            Save.setEntitlements(function (id) { return Billing.owns(id); });
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
      ['buyHints','buyUnlimited','buyRemoveAds'].forEach(function (id) {
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
      return { cur: cur, tier: L && L.tier, t: t,
               L: L, S: S,
               hints: Save.data.hints,
               unlimited: Save.data.unlimitedHints,
               removeAds: Save.data.removeAds };
    },
    SEARCH: SEARCH, SYMS: SYMS
  };

  if (!global.__EC_NO_AUTOBOOT) {
    document.addEventListener('DOMContentLoaded', function () { boot(); });
  }
})(window);
