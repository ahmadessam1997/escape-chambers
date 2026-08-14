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
    seenShop: false
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

    /* ---- entitlement mirrors ---- */
    setEntitlements: function (owns) {
      this.data.removeAds = !!owns('remove_ads');
      this.data.unlimitedHints = !!owns('hints_unlimited');
      return this.save();
    }
  };

  Save.TOTAL = TOTAL;
  global.ECSave = Save;
})(window);
