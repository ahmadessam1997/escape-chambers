/* =====================================================================
   Escape: 20 Chambers — persistence
   ---------------------------------------------------------------------
   Capacitor Preferences on device, localStorage in the browser. One JSON
   blob under ec.save, plus a migration from the v1 'esc' key so anyone
   who played the pre-monetization build keeps their unlocked chambers.

   Every field is repaired on load. A corrupt or hand-edited blob must
   degrade to "you lost some progress", never to a game that cannot boot
   or a player locked out of chambers they already finished.
   ===================================================================== */
(function (global) {
  'use strict';

  var KEY = 'ec.save';
  var LEGACY = 'esc';           // v1: {u:unlocked, d:[doneIndexes]}

  function plugin() {
    try {
      return global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.Preferences;
    } catch (e) { return null; }
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function rawGet(k) {
    var P = plugin();
    if (P) {
      return P.get({ key: k }).then(function (r) { return r.value; })
              .catch(function () { return lsGet(k); });
    }
    return Promise.resolve(lsGet(k));
  }
  function rawSet(k, v) {
    var P = plugin();
    if (P) return P.set({ key: k, value: v }).catch(function () { lsSet(k, v); });
    lsSet(k, v);
    return Promise.resolve();
  }

  var TOTAL = 20;

  var defaults = {
    unlocked: 1,          // how many chambers are selectable
    done: [],             // chamber indexes escaped at least once
    hints: null,          // null => "never initialised", set to starting on first load
    grantedTx: [],        // RevenueCat transaction ids already converted to hints
    removeAds: false,     // mirror of the entitlement, for offline rendering
    unlimitedHints: false,// mirror of the entitlement
    chambersSinceAd: 0,
    seenShop: false,
    /* Best run per chamber: { "<index>": { stars, moves, seconds } }.
       Only ever improved, never overwritten by a worse run — a player who
       replays a chamber casually must not lose the record they earned. */
    best: {}
  };

  var Save = {
    data: JSON.parse(JSON.stringify(defaults)),
    loaded: false,

    load: function () {
      var self = this;
      var Cfg = global.ECConfig;
      return rawGet(KEY).then(function (raw) {
        if (raw) {
          try {
            var parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              Object.keys(defaults).forEach(function (k) {
                if (parsed[k] !== undefined && parsed[k] !== null) self.data[k] = parsed[k];
              });
            }
          } catch (e) { /* corrupt blob -> defaults, rather than a dead game */ }
        }
        return rawGet(LEGACY);
      }).then(function (legacyRaw) {
        if (legacyRaw) {
          try {
            var v1 = JSON.parse(legacyRaw);
            if (v1 && typeof v1 === 'object') {
              if (Number(v1.u) > self.data.unlocked) self.data.unlocked = Number(v1.u);
              if (Array.isArray(v1.d)) {
                v1.d.forEach(function (i) {
                  if (self.data.done.indexOf(i) < 0) self.data.done.push(i);
                });
              }
            }
          } catch (e) {}
        }

        /* ---- repair every field ---- */
        if (!Array.isArray(self.data.done)) self.data.done = [];
        self.data.done = self.data.done
          .map(Number)
          .filter(function (n) { return isFinite(n) && n >= 0 && n < TOTAL; })
          .filter(function (n, i, a) { return a.indexOf(n) === i; });

        if (!Array.isArray(self.data.grantedTx)) self.data.grantedTx = [];
        self.data.grantedTx = self.data.grantedTx
          .filter(function (t) { return typeof t === 'string' && t; })
          .slice(-200);   // unbounded growth would eventually bloat the blob

        var u = Number(self.data.unlocked);
        self.data.unlocked = (isFinite(u) && u >= 1) ? Math.min(TOTAL, Math.floor(u)) : 1;
        // A finished chamber must always leave the next one reachable, even
        // if `unlocked` itself was corrupted.
        self.data.done.forEach(function (i) {
          if (i + 2 > self.data.unlocked) self.data.unlocked = Math.min(TOTAL, i + 2);
        });

        if (self.data.hints === null || self.data.hints === undefined) {
          self.data.hints = Cfg.hints.starting;
        }
        var h = Number(self.data.hints);
        self.data.hints = (isFinite(h) && h >= 0) ? Math.floor(h) : 0;

        var c = Number(self.data.chambersSinceAd);
        self.data.chambersSinceAd = (isFinite(c) && c >= 0) ? Math.floor(c) : 0;

        self.data.removeAds = !!self.data.removeAds;
        self.data.unlimitedHints = !!self.data.unlimitedHints;
        self.data.seenShop = !!self.data.seenShop;

        /* Repair the record book the same way every other field is
           repaired: a hand-edited or truncated blob must cost the player
           some records, never the ability to boot. */
        if (!self.data.best || typeof self.data.best !== 'object') self.data.best = {};
        Object.keys(self.data.best).forEach(function (k) {
          var r = self.data.best[k], n = Number(k);
          var ok = r && typeof r === 'object' &&
                   isFinite(n) && n >= 0 && n < TOTAL &&
                   isFinite(r.stars) && isFinite(r.moves) && isFinite(r.seconds);
          if (!ok) { delete self.data.best[k]; return; }
          r.stars   = Math.max(0, Math.min(5, Math.floor(r.stars)));
          r.moves   = Math.max(0, Math.floor(r.moves));
          r.seconds = Math.max(0, Math.floor(r.seconds));
        });

        self.loaded = true;
        return self.data;
      });
    },

    save: function () { return rawSet(KEY, JSON.stringify(this.data)); },

    /* ---- progress ---- */
    isDone: function (i) { return this.data.done.indexOf(i) >= 0; },

    /* Returns true when this was the FIRST clear of the chamber, which is
       what the caller uses to decide whether to award a hint. Replaying a
       finished chamber must never pay out again. */
    markDone: function (i) {
      var first = !this.isDone(i);
      if (first) this.data.done.push(i);
      if (i + 2 > this.data.unlocked) this.data.unlocked = Math.min(TOTAL, i + 2);
      this.save();
      return first;
    },

    /* ---- hint wallet ---- */
    addHints: function (n) {
      this.data.hints = Math.max(0, this.data.hints + n);
      this.save();
      return this.data.hints;
    },
    spendHint: function () {
      if (this.data.unlimitedHints) return true;
      if (this.data.hints <= 0) return false;
      this.data.hints -= 1;
      this.save();
      return true;
    },

    /* Consumable hint packs are granted per transaction id. RevenueCat
       reports every consumable purchase in
       customerInfo.nonSubscriptionTransactions, so recording which ones
       have already been paid out is what makes the grant survive the app
       being killed mid-purchase without ever double-granting. */
    hasGranted: function (txId) { return this.data.grantedTx.indexOf(txId) >= 0; },
    noteGranted: function (txId) {
      if (!txId || this.hasGranted(txId)) return false;
      this.data.grantedTx.push(txId);
      if (this.data.grantedTx.length > 200) {
        this.data.grantedTx = this.data.grantedTx.slice(-200);
      }
      this.save();
      return true;
    },

    /* ---- the record book ----
       THE RANKING RULE, in one place so the local table and any future
       server agree: more stars always beats fewer, and only within the
       same star count does time decide. A 5-star run at 4:00 outranks a
       4-star run at 0:30 — stars measure how well the room was READ, time
       only separates players who read it equally well. Moves break a time
       tie, because two runs at the same second are otherwise arbitrary. */
    compareRuns: function (a, b) {
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      if (a.stars !== b.stars) return b.stars - a.stars;
      if (a.seconds !== b.seconds) return a.seconds - b.seconds;
      return a.moves - b.moves;
    },

    bestFor: function (i) { return this.data.best[String(i)] || null; },

    /* Returns {improved, previous, record}. Improvement is judged by
       compareRuns, so a faster run that used MORE moves and dropped a star
       does not overwrite a better one. */
    recordRun: function (i, run) {
      var key = String(i);
      var prev = this.data.best[key] || null;
      var better = this.compareRuns(run, prev) < 0;
      if (better) { this.data.best[key] = run; this.save(); }
      return { improved: better, previous: prev, record: better ? run : prev };
    },

    totalStars: function () {
      var self = this, n = 0;
      Object.keys(self.data.best).forEach(function (k) { n += self.data.best[k].stars || 0; });
      return n;
    },

    /* ---- entitlement mirrors ----
       `authoritative` says whether the store actually answered. When it
       did, this is a full sync and a refund CAN revoke an unlock. When it
       did not, only upgrades are applied: an empty entitlement set from an
       unreachable store is not evidence the player owns nothing, and
       writing it through would strip a paid unlock from someone who is
       merely offline. Losing a paying customer's purchase is the far more
       expensive failure. */
    setEntitlements: function (owns, authoritative) {
      var self = this;
      [['removeAds', 'remove_ads'], ['unlimitedHints', 'hints_unlimited']]
        .forEach(function (pair) {
          var owned = !!owns(pair[1]);
          if (owned || authoritative) self.data[pair[0]] = owned;
        });
      return self.save();
    }
  };

  Save.TOTAL = TOTAL;
  global.ECSave = Save;
})(window);
