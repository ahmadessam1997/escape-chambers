/* =====================================================================
   Rate prompt — asks for a Google Play rating, backing off after "Later"
   ---------------------------------------------------------------------
   Shared by Escape Chambers, Frost Tower and Trap Jam; the three
   copies are identical and each game passes its own options to init().

   Rules (requirement from Ahmad, 2026-09-28):
     - count every finished level / run with tick();
     - once `everyN` have been counted and the player has not rated, the
       next seam offers the prompt instead of an ad;
     - "Rate now" opens the Play listing and the prompt NEVER returns;
     - "Later" starts the count again from zero AND raises the bar (see
       below);
     - "Don't ask again" stops it for good.

   Back-off (2026-10-01). "Later" used to re-arm the same `everyN`, so a
   player who was not going to rate was asked every 2 levels for ever —
   which is how a prompt earns the 1-star review it was built to avoid.
   Now the gap escalates with each "Later": the first ask comes after
   `everyN` (2), the second `backoff[0]` (5) levels after the first
   "Later", and every one after that `backoff[1]` (10) levels apart.

   Why the Play listing and not the In-App Review API: that API never says
   whether a card was shown or whether the player rated, and Play silently
   drops it once the quota is spent. Behind a button it looks broken, and
   "if rated, don't ask again" is impossible with it. The listing always
   opens, and a tap on "Rate now" is the best signal there is.

   The copy never asks whether the player LIKES the game. Asking first and
   only sending happy players to the store is review gating, which Play's
   guidelines rule out.

   State is kept in Capacitor Preferences (the same store save.js uses)
   and mirrored to localStorage, so a Preferences failure costs at most a
   repeat prompt, never a crash.
   ===================================================================== */
(function (global) {
  'use strict';

  var KEY = 'rate_prompt_v1';
  var st = { count: 0, rated: false, never: false, shown: 0, laters: 0 };
  var opts = { everyN: 2, backoff: [5, 10] };
  var built = false;

  function prefs() {
    var C = global.Capacitor;
    return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.Preferences;
  }

  function persist() {
    var s = JSON.stringify(st);
    try { global.localStorage.setItem(KEY, s); } catch (e) {}
    var P = prefs();
    if (P) P.set({ key: KEY, value: s }).catch(function () {});
  }

  function merge(raw) {
    if (!raw) return;
    try {
      var d = JSON.parse(raw);
      st.count = d.count | 0;
      st.rated = !!d.rated;
      st.never = !!d.never;
      st.shown = d.shown | 0;
      st.laters = d.laters | 0;
    } catch (e) {}
  }

  /* Finished levels needed before the next ask: everyN until the first
     "Later", then backoff[0], backoff[1], ... holding at the last entry. */
  function threshold() {
    var b = opts.backoff || [];
    if (!st.laters || !b.length) return opts.everyN || 2;
    return b[Math.min(st.laters, b.length) - 1];
  }

  /* Store page for this game. On iOS (via the game's config, when it
     provides storeUrl) this is the App Store "write a review" link, and ''
     until the App Store id is known — due() is false then, so the prompt
     never offers a button that cannot go anywhere. */
  function cfg() { return opts.config || null; }
  function isIOS() { var C = cfg(); return !!(C && C.isIOS && C.isIOS()); }
  function nativeReview() {
    var P = global.Capacitor && global.Capacitor.Plugins;
    return (P && P.StoreReview) || null;
  }
  function storeUrl() {
    var C = cfg();
    if (C && C.storeUrl) return C.storeUrl(opts.packageId, true);
    return 'https://play.google.com/store/apps/details?id=' + opts.packageId;
  }
  function storeName() {
    var C = cfg();
    return (C && C.storeName) ? C.storeName() : 'Google Play';
  }

  function build() {
    if (built) return;
    built = true;
    var c = opts.colors || {};
    var css = document.createElement('style');
    css.textContent =
      '#ratePrompt{position:fixed;inset:0;z-index:99999;display:none;align-items:center;' +
        'justify-content:center;padding:24px;background:rgba(0,0,0,.72);' +
        'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;}' +
      '#ratePrompt.show{display:flex;}' +
      '#ratePrompt .rpCard{background:' + (c.card || '#fff') + ';color:' + (c.text || '#222') + ';' +
        'border-radius:22px;padding:26px 22px 16px;max-width:340px;width:100%;text-align:center;' +
        'box-shadow:0 20px 60px rgba(0,0,0,.45);}' +
      '#ratePrompt .rpStars{font-size:34px;letter-spacing:4px;color:#ffc93c;margin-bottom:8px;}' +
      '#ratePrompt h2{font-size:21px;font-weight:800;margin:0 0 8px;color:' + (c.title || c.text || '#222') + ';}' +
      '#ratePrompt p{font-size:14px;line-height:1.5;margin:0 0 18px;color:' + (c.muted || '#666') + ';}' +
      '#ratePrompt button{display:block;width:100%;border:none;border-radius:14px;cursor:pointer;' +
        'font:inherit;font-weight:800;}' +
      '#rpRate{background:' + (c.accent || '#2e9be6') + ';color:' + (c.accentText || '#fff') + ';' +
        'padding:14px;font-size:17px;margin-bottom:8px;}' +
      '#rpLater{background:none;color:' + (c.muted || '#666') + ';padding:11px;font-size:15px;}' +
      '#rpNever{background:none;color:' + (c.muted || '#666') + ';opacity:.7;padding:6px;' +
        'font-size:12px;font-weight:600;}' +
      '#ratePrompt button:active{transform:scale(.97);}';
    document.head.appendChild(css);

    var ov = document.createElement('div');
    ov.id = 'ratePrompt';
    ov.innerHTML =
      '<div class="rpCard" role="dialog" aria-modal="true" aria-labelledby="rpTitle">' +
        '<div class="rpStars">★★★★★</div>' +
        '<h2 id="rpTitle"></h2>' +
        '<p id="rpText"></p>' +
        '<button id="rpRate"></button>' +
        '<button id="rpLater">Later</button>' +
        '<button id="rpNever">Don’t ask again</button>' +
      '</div>';
    document.body.appendChild(ov);
    var store = storeName();
    ov.querySelector('#rpTitle').textContent = 'Rate ' + opts.appName;
    ov.querySelector('#rpRate').textContent = 'Rate on ' + store;
    ov.querySelector('#rpText').textContent = opts.text ||
      'A quick rating on ' + store + ' helps other players find the game. It only takes a few seconds.';
  }

  var pending = null;

  function close(choice) {
    var ov = document.getElementById('ratePrompt');
    if (!ov || !ov.classList.contains('show')) return;
    ov.classList.remove('show');
    if (choice === 'rate') st.rated = true;
    else if (choice === 'never') st.never = true;
    else st.laters++;
    st.count = 0;
    persist();
    if (choice === 'rate') Rate.openStore();
    var cb = pending;
    pending = null;
    if (cb) cb(choice);
  }

  var Rate = {
    /* opts: appName, packageId, everyN (default 2), backoff (default
       [5, 10]), colors {card, text, title, muted, accent, accentText},
       text, onHandoff(). Resolves once
       the saved state is loaded; tick() before that is still counted. */
    init: function (o) {
      for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) opts[k] = o[k];
      try { merge(global.localStorage.getItem(KEY)); } catch (e) {}
      var P = prefs();
      if (!P) return Promise.resolve();
      var before = st.count;
      return P.get({ key: KEY }).then(function (r) {
        if (r && r.value) {
          var extra = Math.max(0, st.count - before);   // ticks while loading
          merge(r.value);
          st.count += extra;
        }
      }).catch(function () {});
    },

    /* One finished level (or run). */
    tick: function () {
      if (st.rated || st.never) return;
      st.count++;
      persist();
    },

    due: function () {
      /* iOS: App Store guideline 5.6.1 allows only Apple's own review
         request, never a custom dialog. So at the same moment Android
         shows the dialog, iOS asks the native StoreReview plugin instead
         (ios/App/App/StoreReviewPlugin.swift). It needs no App Store id. */
      if (isIOS()) {
        return !!nativeReview() && !st.rated && !st.never && st.count >= threshold();
      }
      return !!opts.packageId && !!storeUrl() &&
             !st.rated && !st.never && st.count >= threshold();
    },

    /* Shows the prompt if it is due. Returns true when it did; `done` is
       then called with 'rate' | 'later' | 'never' once it closes ('native'
       on iOS, where Apple's sheet reports nothing back). Returns false (and
       never calls `done`) when nothing was shown. */
    maybeShow: function (done) {
      if (!this.due() || pending) return false;
      if (isIOS()) {
        /* Apple never says whether the sheet appeared or the player
           rated (it shows it at most 3 times a year on its own terms), so
           this counts as a "Later": the next ask backs off exactly like
           Android's. */
        st.shown++;
        st.laters++;
        st.count = 0;
        persist();
        if (opts.onHandoff) { try { opts.onHandoff(); } catch (e) {} }
        nativeReview().requestReview().catch(function () {});
        setTimeout(function () { if (done) done('native'); }, 600);
        return true;
      }
      build();
      pending = done || null;
      st.shown++;
      document.getElementById('ratePrompt').classList.add('show');
      return true;
    },

    isOpen: function () {
      var ov = document.getElementById('ratePrompt');
      return !!(ov && ov.classList.contains('show'));
    },

    /* Back button while open counts as "Later". */
    dismiss: function () { close('later'); },

    openStore: function () {
      if (opts.onHandoff) { try { opts.onHandoff(); } catch (e) {} }
      var url = storeUrl();
      if (!url) return;
      /* Capacitor hands any off-app URL to Android as an ACTION_VIEW
         intent, and the Play Store app claims play.google.com links. On
         iOS the WebView hands itms-apps:// to the App Store app. */
      if (prefs()) global.location.href = url;
      else global.open(url, '_blank');
    },

    _state: function () { return JSON.parse(JSON.stringify(st)); },
    _reset: function () { st = { count: 0, rated: false, never: false, shown: 0, laters: 0 }; persist(); }
  };

  document.addEventListener('click', function (e) {
    var id = e.target && e.target.id;
    if (id === 'rpRate') close('rate');
    else if (id === 'rpLater') close('later');
    else if (id === 'rpNever') close('never');
  });

  global.RatePrompt = Rate;
})(window);
