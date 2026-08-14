/* =====================================================================
   Escape: 20 Chambers — shop + the out-of-hints prompt
   ---------------------------------------------------------------------
   Two surfaces:

     promptOutOfHints()  the small dialog the player meets the moment the
                         wallet hits zero. It leads with the FREE option
                         (watch a video) and only then offers to sell —
                         a paywall that hides the free path reads as a
                         trick and earns 1-star reviews.
     openShop()          the full shop, reachable from the rooms menu.

   Every premium button is disabled unless billing.isReady(). A store that
   silently does nothing is indistinguishable from a broken game, so the
   disabled state carries the reason.
   ===================================================================== */
(function (global) {
  'use strict';

  var Cfg = global.ECConfig;
  var Save = global.ECSave;
  var Billing = global.ECBilling;
  var Ads = global.ECAds;

  var $ = function (id) { return document.getElementById(id); };

  var Shop = {
    _toast: function () {},
    _onChange: function () {},
    _busy: false,

    init: function (opts) {
      var self = this;
      opts = opts || {};
      self._toast = opts.toast || function () {};
      self._onChange = opts.onChange || function () {};

      $('shopClose').addEventListener('click', function () { self.close(); });
      $('shopRestore').addEventListener('click', function () { self.restore(); });
      $('hintOvClose').addEventListener('click', function () { $('hintOv').classList.remove('show'); });
      $('hintOvShop').addEventListener('click', function () {
        $('hintOv').classList.remove('show');
        self.openShop();
      });
      $('hintOvWatch').addEventListener('click', function () { self.watchForHints(); });
      $('shopWatch').addEventListener('click', function () { self.watchForHints(); });
    },

    /* ---------------- out-of-hints prompt ---------------- */
    promptOutOfHints: function () {
      var canWatch = Ads.rewardedAvailable();
      $('hintOvWatch').style.display = canWatch ? '' : 'none';
      $('hintOvWhy').textContent = canWatch
        ? 'Watch a short video for ' + Cfg.hints.rewardedAdHints + ' more, or stock up in the shop.'
        : 'No video is ready just now. You can stock up in the shop, or escape a chamber to earn one.';
      $('hintOv').classList.add('show');
    },

    /* ---------------- rewarded video ---------------- */
    watchForHints: function () {
      var self = this;
      if (self._busy) return;
      self._busy = true;
      var finish = function () { self._busy = false; };

      Ads.showRewarded().then(function (res) {
        if (res.earned) {
          Save.addHints(Cfg.hints.rewardedAdHints);
          self._toast('🎬 +' + Cfg.hints.rewardedAdHints + ' hints. Thank you!');
          $('hintOv').classList.remove('show');
        } else if (res.unavailable) {
          self._toast('No video is ready right now — try again in a moment.');
        } else {
          self._toast('No hints awarded — the video needs to finish.');
        }
        self._onChange();
        self.render();
        finish();
      }).catch(function () {
        self._toast('Something went wrong with the video.');
        finish();
      });
    },

    /* ---------------- shop ---------------- */
    openShop: function () {
      Save.data.seenShop = true;
      Save.save();
      this.render();
      $('shopOv').classList.add('show');
    },
    close: function () { $('shopOv').classList.remove('show'); },

    render: function () {
      var ready = Billing.isReady();
      var mock = Billing.isMock();
      var unlimited = Save.data.unlimitedHints;

      $('shopWallet').textContent = unlimited
        ? '♾ Unlimited hints'
        : Save.data.hints + (Save.data.hints === 1 ? ' hint' : ' hints');

      $('shopWatch').style.display = Ads.rewardedAvailable() ? '' : 'none';
      $('shopWatchLbl').textContent = '+' + Cfg.hints.rewardedAdHints + ' hints · free';

      var rows = [
        { id: 'hints_25',        el: 'buyHints',     owned: unlimited,
          ownedText: 'Included in Unlimited' },
        { id: 'hints_unlimited', el: 'buyUnlimited', owned: unlimited,
          ownedText: '✓ Owned' },
        { id: 'remove_ads',      el: 'buyRemoveAds', owned: Save.data.removeAds,
          ownedText: '✓ Owned' }
      ];

      rows.forEach(function (r) {
        var btn = $(r.el);
        if (r.owned) {
          btn.disabled = true;
          btn.textContent = r.ownedText;
          btn.classList.add('ownedb');
          return;
        }
        btn.classList.remove('ownedb');
        btn.disabled = !ready;
        btn.textContent = ready
          ? Billing.priceOf(r.id) + (mock ? ' · DEV' : '')
          : 'Store unavailable';
      });

      $('shopNote').textContent = ready
        ? 'Remove ads stops the between-chamber ads. Hint videos stay available — they’re the free way to top up.'
        : (Billing.lastError || 'The store isn’t reachable on this device right now.');
    },

    buy: function (productId) {
      var self = this;
      if (self._busy) return;
      if (!Billing.isReady()) { self._toast('The store isn’t available right now.'); return; }
      self._busy = true;

      Billing.purchase(productId).then(function (res) {
        self._busy = false;
        if (res.cancelled) return;                 // never an error
        if (!res.ok) { self._toast(res.error || 'Purchase failed.'); return; }

        Save.setEntitlements(function (id) { return Billing.owns(id); });
        Ads.setRemoveAds(Save.data.removeAds);

        if (productId === 'remove_ads') self._toast('Ads removed. Enjoy the quiet. 🕯️');
        else if (productId === 'hints_unlimited') self._toast('Unlimited hints unlocked. Never stranded again.');
        else self._toast('Hints added to your wallet.');

        self._onChange();
        self.render();
      }).catch(function () {
        self._busy = false;
        self._toast('Purchase failed. Please try again.');
      });
    },

    restore: function () {
      var self = this;
      if (self._busy) return;
      self._busy = true;
      self._toast('Checking your purchases…');
      Billing.restore().then(function (res) {
        self._busy = false;
        if (!res.ok) { self._toast(res.error || 'Could not reach the store.'); return; }
        Save.setEntitlements(function (id) { return Billing.owns(id); });
        Ads.setRemoveAds(Save.data.removeAds);
        var any = Save.data.removeAds || Save.data.unlimitedHints;
        self._toast(any ? 'Purchases restored.' : 'Nothing to restore on this account.');
        self._onChange();
        self.render();
      }).catch(function () {
        self._busy = false;
        self._toast('Could not reach the store.');
      });
    }
  };

  global.ECShop = Shop;
})(window);
