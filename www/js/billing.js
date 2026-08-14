/* =====================================================================
   Escape: 20 Chambers — billing (RevenueCat)
   ---------------------------------------------------------------------
   Three states, and which one we are in is never guessed:

     'mock'        browser/dev only. Purchases succeed instantly and are
                   labelled DEV. Gated on isNative()===false so it CANNOT
                   activate in a shipped build.
     'ready'       native + API key + RevenueCat configured.
     'unavailable' native but no key, or the SDK failed. Purchases are
                   refused and nothing is granted. This is the fail-closed
                   path.

   TWO KINDS OF PRODUCT, HANDLED DIFFERENTLY:

     non-consumable (remove_ads, hints_unlimited)
       Truth is RevenueCat's entitlement list, so a refund or a reinstall
       resolves correctly. Mirrored into the save file only so the game
       renders right offline.

     consumable (hints_25)
       An entitlement is useless here: it would read "active" forever
       after the first pack and every later pack would silently grant
       nothing. Instead every purchase is a row in
       customerInfo.nonSubscriptionTransactions, and hints are paid out
       once per transaction id (ECSave.grantedTx). That is what makes the
       grant survive the app being killed between Play taking the money
       and us writing the hints, without ever paying out twice.
   ===================================================================== */
(function (global) {
  'use strict';

  var Cfg = global.ECConfig;
  var MOCK_KEY = 'ec.mockPurchases';

  var Billing = {
    state: 'unavailable',
    entitlements: {},   // productId -> true   (non-consumables only)
    prices: {},         // productId -> localized price string
    lastError: null,

    isMock:  function () { return this.state === 'mock'; },
    isReady: function () { return this.state === 'mock' || this.state === 'ready'; },
    owns:    function (id) { return !!this.entitlements[id]; },
    priceOf: function (id) {
      return this.prices[id] || (Cfg.products[id] && Cfg.products[id].price) || '—';
    },

    /* ------------------------------------------------------------------
       onConsumable(productId, txId) is called for every consumable
       purchase not yet paid out. It must return true if it granted, so
       the transaction can be recorded as spent.
       ------------------------------------------------------------------ */
    init: function (onConsumable) {
      var self = this;
      self._onConsumable = onConsumable || function () { return false; };

      if (!Cfg.isNative()) {
        self.state = 'mock';
        Object.keys(Cfg.products).forEach(function (id) {
          self.prices[id] = Cfg.products[id].price;
        });
        try {
          var raw = localStorage.getItem(MOCK_KEY);
          if (raw) {
            var m = JSON.parse(raw) || {};
            self.entitlements = m.entitlements || {};
            self._mockTx = m.tx || [];
          }
        } catch (e) {}
        self._mockTx = self._mockTx || [];
        self._payOutConsumables(self._mockTx);
        return Promise.resolve(self.state);
      }

      var key = (Cfg.revenueCat.androidApiKey || '').trim();
      if (!key) {
        self.state = 'unavailable';
        self.lastError = 'Store not configured';
        console.warn('[billing] No RevenueCat API key — purchases disabled (fail-closed).');
        return Promise.resolve(self.state);
      }

      var Purchases = global.Capacitor.Plugins.Purchases;
      if (!Purchases) {
        self.state = 'unavailable';
        self.lastError = 'Store plugin missing';
        console.warn('[billing] Purchases plugin not registered. Capacitor.Plugins =',
          Object.keys((global.Capacitor && global.Capacitor.Plugins) || {}).join(','));
        return Promise.resolve(self.state);
      }
      self._p = Purchases;

      /* configure() is annotated RETURN_NONE in PurchasesPlugin.kt, so it
         returns undefined, NOT a promise. Chaining .then() off it throws
             TypeError: Purchases.configure(...).then is not a function
         *synchronously*, which on Frost Tower rejected the whole boot
         chain and killed billing AND ads in three shipped builds. Call it
         on its own line and probe readiness with getCustomerInfo. */
      try {
        Purchases.configure({ apiKey: key });
      } catch (err) {
        self.state = 'unavailable';
        self.lastError = (err && err.message) || 'Store configure failed';
        console.warn('[billing] configure threw:', err);
        return Promise.resolve(self.state);
      }

      /* getCustomerInfo IS a promise and is the first real round-trip, so
         it doubles as the readiness probe. Deliberately not refresh(),
         which swallows its own errors and would report 'ready' against an
         unreachable store — breaking the fail-closed guarantee. */
      return self._p.getCustomerInfo()
        .then(function (res) {
          self._applyCustomerInfo(res && res.customerInfo);
          self.state = 'ready';
          return self.loadPrices();
        })
        .then(function () {
          console.info('[billing] state=' + self.state +
            ' prices=' + JSON.stringify(self.prices) +
            ' owned=' + JSON.stringify(self.entitlements));
          return self.state;
        })
        .catch(function (err) {
          self.state = 'unavailable';
          self.lastError = (err && err.message) || 'Store unavailable';
          console.warn('[billing] init failed:', err && (err.message || err), 'code=', err && err.code);
          return self.state;
        });
    },

    loadPrices: function () {
      var self = this;
      if (!self._p) return Promise.resolve();
      var ids = Object.keys(Cfg.products);
      return self._p.getOfferings()
        .then(function (offerings) {
          var seen = {};
          var all = (offerings && offerings.all) || {};
          Object.keys(all).forEach(function (offId) {
            (all[offId].availablePackages || []).forEach(function (pkg) {
              if (pkg.product) {
                self.prices[pkg.product.identifier] = pkg.product.priceString;
                self._packages = self._packages || {};
                self._packages[pkg.product.identifier] = pkg;
                seen[pkg.product.identifier] = true;
              }
            });
          });
          var missing = ids.filter(function (id) { return !seen[id]; });
          if (!missing.length) return null;
          /* One at a time: a single inactive SKU poisons a whole batch
             query and the store comes back empty (adaptive-chess). */
          return Promise.all(missing.map(function (id) {
            return self._p.getProducts({ productIdentifiers: [id] })
              .then(function (res) {
                var p = (res.products || [])[0];
                if (!p) return;
                self.prices[id] = p.priceString;
                self._storeProducts = self._storeProducts || {};
                self._storeProducts[id] = p;
              })
              .catch(function (e) { console.warn('[billing] getProducts ' + id + ':', e); });
          }));
        })
        .catch(function (e) { console.warn('[billing] getOfferings:', e); });
    },

    refresh: function () {
      var self = this;
      if (self.state === 'mock') {
        self._payOutConsumables(self._mockTx || []);
        return Promise.resolve(self.entitlements);
      }
      if (!self._p) return Promise.resolve(self.entitlements);
      return self._p.getCustomerInfo()
        .then(function (res) { return self._applyCustomerInfo(res.customerInfo); })
        .catch(function (e) {
          console.warn('[billing] getCustomerInfo:', e);
          return self.entitlements;
        });
    },

    restore: function () {
      var self = this;
      if (self.state === 'mock') {
        self._payOutConsumables(self._mockTx || []);
        return Promise.resolve({ ok: true, entitlements: self.entitlements });
      }
      if (!self._p) return Promise.resolve({ ok: false, error: self.lastError || 'Store unavailable' });
      return self._p.restorePurchases()
        .then(function (res) {
          self._applyCustomerInfo(res.customerInfo);
          return { ok: true, entitlements: self.entitlements };
        })
        .catch(function (e) {
          return { ok: false, error: self._humanError(e) };
        });
    },

    _applyCustomerInfo: function (info) {
      var self = this;
      var next = {};
      if (info) {
        var active = (info.entitlements && info.entitlements.active) || {};
        Object.keys(active).forEach(function (k) {
          // Only mirror entitlements that name a NON-consumable product.
          // A consumable's entitlement would latch on after the first
          // pack and make every later pack look already-owned.
          if (Cfg.products[k] && !Cfg.products[k].consumable) next[k] = true;
        });
        /* A product imported without its entitlement attached would
           otherwise silently revoke a paid unlock, so trust the raw
           purchase list too. Safe for non-consumables, which never
           expire; consumables are excluded on purpose. */
        (info.allPurchasedProductIdentifiers || []).forEach(function (pid) {
          if (Cfg.products[pid] && !Cfg.products[pid].consumable) next[pid] = true;
        });
        self._payOutConsumables(info.nonSubscriptionTransactions || []);
      }
      self.entitlements = next;
      return next;
    },

    /* Normalises the several shapes RevenueCat has used for a
       non-subscription transaction across SDK versions, then pays out
       anything not already recorded. */
    _payOutConsumables: function (txs) {
      var self = this;
      (txs || []).forEach(function (t) {
        if (!t) return;
        var pid = t.productIdentifier || t.productId || t.product_identifier;
        var tid = t.transactionIdentifier || t.transactionId || t.revenueCatId ||
                  t.purchaseIdentifier || t.id;
        if (!pid || !tid) return;
        var prod = Cfg.products[pid];
        if (!prod || !prod.consumable) return;
        self._onConsumable(pid, String(tid));
      });
    },

    /* Raw SDK errors must never reach a player. RevenueCat says things
       like "There was a credentials issue" — a message to the DEVELOPER
       about a misconfigured dashboard, useless and alarming to a paying
       customer.

       Deliberately grants NOTHING on a validation failure: if Play took
       the money but RevenueCat could not verify it, the honest answer is
       "it will unlock once we can confirm it". Play has recorded the
       purchase, so Restore brings it back. */
    _humanError: function (e) {
      var s = (String((e && (e.code || e.errorCode)) || '') + ' ' +
               String((e && e.message) || '')).toLowerCase();
      if (/credential|configuration|invalid_credentials/.test(s)) {
        return 'The store isn’t fully set up yet. If you were charged, nothing is lost — ' +
               'tap Restore purchases in a little while and it will unlock.';
      }
      if (/network|connect|timeout|host/.test(s)) {
        return 'Couldn’t reach the store. Check your connection and try again.';
      }
      if (/not allowed|billing.?unavailable|purchasenotallowed/.test(s)) {
        return 'Purchases aren’t available on this device or account.';
      }
      if (/not available|productnotavailable|sku|item unavailable/.test(s)) {
        return 'That item isn’t available right now. Please try again later.';
      }
      return 'Purchase failed. Please try again.';
    },

    /* Returns {ok} | {cancelled:true} | {ok:false,error}. Never throws,
       and a user cancelling is NOT an error. */
    purchase: function (productId) {
      var self = this;
      var prod = Cfg.products[productId];

      if (self.state === 'mock') {
        if (prod && prod.consumable) {
          self._mockTx = self._mockTx || [];
          self._mockTx.push({
            productIdentifier: productId,
            transactionIdentifier: 'mock-' + productId + '-' + Date.now() + '-' +
                                   Math.floor(Math.random() * 1e6)
          });
        } else {
          self.entitlements[productId] = true;
        }
        try {
          localStorage.setItem(MOCK_KEY, JSON.stringify({
            entitlements: self.entitlements, tx: self._mockTx || []
          }));
        } catch (e) {}
        self._payOutConsumables(self._mockTx || []);
        return Promise.resolve({ ok: true, mock: true });
      }

      if (self.state !== 'ready' || !self._p) {
        return Promise.resolve({ ok: false, error: self.lastError || 'Store unavailable' });
      }

      var pkg = self._packages && self._packages[productId];
      var attempt;
      if (pkg) {
        attempt = self._p.purchasePackage({ aPackage: pkg });
      } else {
        var sp = self._storeProducts && self._storeProducts[productId];
        if (sp) {
          attempt = self._p.purchaseStoreProduct({ product: sp });
        } else {
          attempt = self._p.getProducts({ productIdentifiers: [productId] })
            .then(function (res) {
              var p = (res.products || [])[0];
              if (!p) throw new Error('Product not available: ' + productId);
              self._storeProducts = self._storeProducts || {};
              self._storeProducts[productId] = p;
              return self._p.purchaseStoreProduct({ product: p });
            });
        }
      }

      return attempt
        .then(function (res) {
          /* _applyCustomerInfo does the consumable payout, so a hint pack
             is credited from the same authoritative source that a restore
             would use — not from an optimistic local increment here. */
          if (res && res.customerInfo) self._applyCustomerInfo(res.customerInfo);
          else if (prod && !prod.consumable) self.entitlements[productId] = true;
          return { ok: true };
        })
        .catch(function (e) {
          if (e && (e.userCancelled === true || e.code === '1' || e.code === 1 ||
                    /cancel/i.test(e.message || ''))) {
            return { cancelled: true };
          }
          if (e && /already own|already purchased/i.test(e.message || '')) {
            return self.refresh().then(function () { return { ok: true, restored: true }; });
          }
          console.warn('[billing] purchase failed:', e && (e.message || e),
                       'code=', e && (e.code || e.errorCode));
          return { ok: false, error: self._humanError(e) };
        });
    }
  };

  global.ECBilling = Billing;
})(window);
