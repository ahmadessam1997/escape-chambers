/* =====================================================================
   Escape Chambers — shop + the out-of-hints prompt
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
  var Notify = global.ECNotify;
  var track = function (name, params) {
    if (global.ECAnalytics) global.ECAnalytics.log(name, params);
  };

  var $ = function (id) { return document.getElementById(id); };

  var Shop = {
    _toast: function () {},
    _onChange: function () {},
    _busy: false,
    /* How long Restore waits on the store before giving the shop back.
       restorePurchases() can hang outright on an offline device, and the
       busy flag it holds also gates Buy and the hint video. */
    _restoreTimeoutMs: 15000,

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
      $('shopPrivacy').addEventListener('click', function () { self.openPrivacyOptions(); });
      $('shopNotify').addEventListener('click', function () { self.toggleReminder(); });
    },

    /* ---------------- daily reminder toggle ----------------
       The one settings switch the game has. Turning it ON is the only
       thing that can re-open Android's permission dialog after a refusal
       — and only because the player asked. If Android still says no (it
       stops showing the dialog after two refusals), say where the real
       switch lives rather than leaving a toggle that will not move. */
    toggleReminder: function () {
      var self = this;
      if (self._busy || !Notify) return;
      self._busy = true;
      var want = !Notify.enabled();
      Notify.setEnabled(want).then(function (state) {
        self._busy = false;
        if (want && state !== 'on') {
          self._toast('Notifications are blocked for this game in Android settings.');
        } else {
          self._toast(state === 'on' ? 'Daily reminder on.' : 'Daily reminder off.');
        }
        self.render();
      }).catch(function () { self._busy = false; });
    },

    /* ---------------- ad-consent choices ----------------
       Regulators require a persistent way to CHANGE a consent decision,
       not just make it once. Google only serves that form where it is
       required (EEA/UK, and US states with an opt-out), and reports that
       via privacyOptionsRequirementStatus — so the button is hidden
       elsewhere rather than shown and broken.

       Deliberately does NOT re-render the shop afterwards: the form
       changes ad personalisation, not anything the shop displays, and a
       flicker after dismissing it would look like a purchase state
       changed. */
    openPrivacyOptions: function () {
      var self = this;
      if (self._busy) return;
      self._busy = true;
      Ads.showPrivacyOptions().then(function (res) {
        self._busy = false;
        if (!res.ok) self._toast('Couldn’t open privacy choices just now.');
      }).catch(function () {
        self._busy = false;
        self._toast('Couldn’t open privacy choices just now.');
      });
    },

    /* ---------------- out-of-hints prompt ---------------- */
    promptOutOfHints: function () {
      var canWatch = Ads.rewardedAvailable();
      track('out_of_hints_shown', { can_watch: canWatch });
      $('hintOvWatch').style.display = canWatch ? '' : 'none';
      /* Three different states, three different sentences. An owner of
         Remove ads must NOT be told "no video is ready just now" - the
         videos are gone for good and that reads as a bug. */
      $('hintOvWhy').textContent = canWatch
        ? 'Watch a short video for ' + Cfg.hints.rewardedAdHints + ' more, or stock up in the shop.'
        : Save.data.removeAds
          ? 'You own Remove ads, so there are no videos. Stock up in the shop, or escape a chamber to earn one.'
          : 'No video is ready just now. You can stock up in the shop, or escape a chamber to earn one.';
      $('hintOv').classList.add('show');
    },

    /* ---------------- rewarded video ---------------- */
    watchForHints: function () {
      var self = this;
      if (self._busy) return;
      self._busy = true;
      var finish = function () { self._busy = false; };

      Ads.showRewarded('hints').then(function (res) {
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
      track('shop_open');
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

      /* Only where Google actually has a form to show. Still NOT gated on
         removeAds even though that purchase now silences every format:
         the SDK is initialised and holds a consent decision either way,
         and regulators require a persistent way to change it, so the
         entry point has to stay reachable. */
      $('shopPrivacy').style.display = Ads.privacyOptionsRequired ? '' : 'none';

      var canNotify = !!(Notify && Notify.available());
      $('shopNotify').style.display = canNotify ? '' : 'none';
      if (canNotify) {
        $('shopNotify').textContent =
          '🔔 Daily reminder: ' + (Notify.enabled() ? 'on' : 'off');
      }

      /* "Never run out" is withdrawn, so its row is gone from the markup.
         hints_25 still reports "Included in Unlimited" for the few players
         who own the retired product — they must not be sold hints they
         already have. */
      var rows = [
        { id: 'hints_25',        el: 'buyHints',     owned: unlimited,
          ownedText: 'Included in Unlimited' },
        { id: 'remove_ads',      el: 'buyRemoveAds', owned: Save.data.removeAds,
          ownedText: '✓ Owned' }
      ];

      rows.forEach(function (r) {
        var btn = $(r.el);
        if (!btn) return;                 // a withdrawn product has no row
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

      /* Say what Remove ads REALLY does. It has silenced every format,
         hint videos included, since 2026-09-20; the old line promised the
         videos stayed, which a buyer would rightly call a broken promise. */
      $('shopNote').textContent = ready
        ? 'Remove ads turns off every ad, hint videos included. Free hints still come from ' +
          'escaping chambers, the daily hint and the daily chamber.'
        : (Billing.lastError || 'The store isn’t reachable on this device right now.');
    },

    buy: function (productId) {
      var self = this;
      if (self._busy) return;
      if (!Billing.isReady()) { self._toast('The store isn’t available right now.'); return; }
      self._busy = true;
      track('purchase_start', { product: productId });
      /* The Play purchase sheet covers the app; coming back from it is
         not "returning to the game" as far as the app-open ad goes. */
      if (Ads.noteHandoff) Ads.noteHandoff();

      Billing.purchase(productId).then(function (res) {
        self._busy = false;
        /* Cancelling is not an error, but it must not be SILENT either.
           "The purchase went through and nothing happened, with no
           message" was a real report, and this branch is the only path
           that shows nothing at all — so a mis-classified error here is
           indistinguishable from the app ignoring a completed purchase.
           Say something, always. */
        if (res.cancelled) { self._toast('Purchase cancelled — nothing was charged.'); return; }
        if (!res.ok) { self._toast(res.error || 'Purchase failed.'); return; }

        /* Not authoritative: a resolved purchase proves the player owns
           THIS item, not that they own nothing else. Upgrade only. */
        Save.setEntitlements(function (id) { return Billing.owns(id); }, false);
        Ads.setRemoveAds(Save.data.removeAds);
        track('purchase_done', { product: productId });

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
      var timedOut = false;
      var timer = setTimeout(function () {
        timedOut = true;
        self._busy = false;
        self._toast('Could not reach the store. Check your connection and try again.');
      }, self._restoreTimeoutMs);
      Billing.restore().then(function (res) {
        clearTimeout(timer);
        /* A late answer after the timeout is still applied below when it
           is a success — the player asked for it — but must not touch the
           busy flag, which may belong to something else by now. */
        if (!timedOut) self._busy = false;
        if (!res.ok) { if (!timedOut) self._toast(res.error || 'Could not reach the store.'); return; }
        /* Restore succeeded, so this IS a full picture of the account and
           may legitimately revoke something that was refunded. */
        Save.setEntitlements(function (id) { return Billing.owns(id); }, true);
        Ads.setRemoveAds(Save.data.removeAds);
        var any = Save.data.removeAds || Save.data.unlimitedHints;
        self._toast(any ? 'Purchases restored.' : 'Nothing to restore on this account.');
        self._onChange();
        self.render();
      }).catch(function () {
        clearTimeout(timer);
        if (timedOut) return;
        self._busy = false;
        self._toast('Could not reach the store.');
      });
    }
  };

  global.ECShop = Shop;
})(window);
