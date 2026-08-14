/* =====================================================================
   Escape: 20 Chambers — ads (AdMob)
   ---------------------------------------------------------------------
   Two formats, deliberately:

     interstitial  only on the seam between chambers, after the win card
                   is dismissed, every Nth chamber that actually took a
                   while, with a cooldown. NEVER inside a chamber — this
                   is a concentration puzzle and an interrupt mid-search
                   would be indefensible (and Play's ad policy penalises
                   interruptive density).
     rewarded      always opt-in: +2 hints, offered when the wallet is
                   empty and from the shop.

   Every entry point RESOLVES rather than rejecting. A failed ad load must
   never block the player from moving to the next chamber. In the browser
   everything no-ops and honestly reports "not shown".
   ===================================================================== */
(function (global) {
  'use strict';

  var Cfg = global.ECConfig;

  var Ads = {
    available: false,
    removeAdsOwned: false,
    _interstitialReady: false,
    _rewardedReady: false,
    _lastInterstitialAt: 0,

    init: function () {
      var self = this;
      if (!Cfg.isNative()) {
        console.info('[ads] Browser preview — ads disabled.');
        return Promise.resolve(false);
      }
      var AdMob = global.Capacitor.Plugins.AdMob;
      if (!AdMob) {
        console.warn('[ads] AdMob plugin missing.');
        return Promise.resolve(false);
      }
      self._m = AdMob;

      var testDevices = (Cfg.admob.testDeviceIds || []).filter(Boolean);

      return AdMob.initialize({
        /* The plugin IGNORES testingDevices unless this flag is true
           (AdMob.java: initializeForTesting ? getArray(...) : EMPTY), so
           it has to be on whenever there is a device list — even with
           real ad unit IDs. It is not a global test switch: all it does
           is feed RequestConfiguration.setTestDeviceIds(). */
        initializeForTesting: !!Cfg.admob.isTest || testDevices.length > 0,
        testingDevices: testDevices,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
        /* MUST be one of the plugin's exact enum strings — General,
           ParentalGuidance, Teen, MatureAudience. Frost Tower passed 'G',
           which matches no case in the Android switch, so the rating
           silently stayed UNSPECIFIED and every ad request from an
           Everyone-rated game carried no content cap at all. Invisible
           under test units, real the moment live units ship. */
        maxAdContentRating: 'General'
      }).then(function () {
        self.available = true;
        self._wireListeners();
        self.preloadInterstitial();
        self.preloadRewarded();
        return true;
      }).catch(function (e) {
        console.warn('[ads] initialize failed:', e);
        return false;
      });
    },

    _wireListeners: function () {
      var self = this, m = self._m;
      var closed = function () {
        self._interstitialReady = false;
        if (self._onInterstitialClosed) {
          var f = self._onInterstitialClosed;
          self._onInterstitialClosed = null;
          f();
        }
      };
      try {
        m.addListener('onInterstitialAdLoaded', function () { self._interstitialReady = true; });
        m.addListener('onInterstitialAdFailedToLoad', function () { self._interstitialReady = false; });
        m.addListener('onInterstitialAdDismissed', function () { closed(); self.preloadInterstitial(); });
        m.addListener('onInterstitialAdFailedToShow', closed);

        m.addListener('onRewardedVideoAdLoaded', function () { self._rewardedReady = true; });
        m.addListener('onRewardedVideoAdFailedToLoad', function () { self._rewardedReady = false; });
        m.addListener('onRewardedVideoAdReward', function () { self._earnedReward = true; });
        m.addListener('onRewardedVideoAdDismissed', function () {
          self._rewardedReady = false;
          self.preloadRewarded();
        });
      } catch (e) { console.warn('[ads] listeners:', e); }
    },

    /* Remove ads silences the INTERSTITIAL only. Rewarded videos stay
       reachable because they are opt-in and are the only free hint
       faucet — taking them away would punish the purchase. The shop says
       so in as many words, and so does the privacy policy. */
    setRemoveAds: function (owned) { this.removeAdsOwned = !!owned; },

    preloadInterstitial: function () {
      var self = this;
      if (!self.available || self.removeAdsOwned) return Promise.resolve();
      return self._m.prepareInterstitial({ adId: Cfg.admob.interstitialId })
        .then(function () { self._interstitialReady = true; })
        .catch(function (e) { self._interstitialReady = false; console.warn('[ads] preload interstitial:', e); });
    },

    preloadRewarded: function () {
      var self = this;
      if (!self.available) return Promise.resolve();
      return self._m.prepareRewardVideoAd({ adId: Cfg.admob.rewardedId })
        .then(function () { self._rewardedReady = true; })
        .catch(function (e) { self._rewardedReady = false; console.warn('[ads] preload rewarded:', e); });
    },

    /* chambersSinceAd lives in the save file so the cadence survives the
       app being closed between chambers — otherwise every cold start
       would reset the counter and the player would see far fewer ads
       than intended (or, with a different bug, far more). */
    shouldShowInterstitial: function (chambersSinceAd) {
      if (!this.available || this.removeAdsOwned || !this._interstitialReady) return false;
      if (chambersSinceAd < Cfg.ads.interstitialEveryNChambers) return false;
      return (Date.now() - this._lastInterstitialAt) >= Cfg.ads.interstitialCooldownMs;
    },

    /* Resolves when the ad closes, or immediately if it is not shown. */
    showInterstitial: function () {
      var self = this;
      return new Promise(function (resolve) {
        var settled = false;
        var done = function (shown) { if (!settled) { settled = true; resolve(shown); } };
        self._onInterstitialClosed = function () { done(true); };
        // A wedged ad SDK must not strand the player on a dead screen.
        setTimeout(function () { done(false); }, 8000);
        self._lastInterstitialAt = Date.now();
        self._m.showInterstitial().catch(function (e) {
          console.warn('[ads] showInterstitial:', e);
          self._onInterstitialClosed = null;
          done(false);
        });
      });
    },

    rewardedAvailable: function () { return this.available && this._rewardedReady; },

    /* Resolves {earned:bool}. Never rejects. */
    showRewarded: function () {
      var self = this;
      if (!self.rewardedAvailable()) {
        self.preloadRewarded();   // warm one for next time
        return Promise.resolve({ earned: false, unavailable: true });
      }
      self._earnedReward = false;
      return self._m.showRewardVideoAd()
        .then(function (reward) {
          var earned = self._earnedReward || !!(reward && (reward.amount > 0 || reward.type));
          self._rewardedReady = false;
          self.preloadRewarded();
          return { earned: earned };
        })
        .catch(function (e) {
          console.warn('[ads] showRewarded:', e);
          self._rewardedReady = false;
          self.preloadRewarded();
          return { earned: false };
        });
    }
  };

  global.ECAds = Ads;
})(window);
