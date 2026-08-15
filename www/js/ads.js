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

      /* Consent BEFORE initialize. Google's UMP flow has to resolve first
         so the SDK knows whether it may request personalised ads at all;
         running it afterwards means the first ad request goes out under
         an unknown consent state. Never rejects — a consent failure must
         not cost the player their ads *or* their game. */
      return self._requestConsent(testDevices).then(function () {
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
        });
      }).then(function () {
        self.available = true;
        self._wireListeners();
        /* Only warm the cache if the SDK says we may actually request
           ads. Preloading under a REQUIRED-but-unanswered consent state
           burns a request that comes back empty and leaves _ready false
           anyway. */
        if (self.canRequestAds) {
          self.preloadInterstitial();
          self.preloadRewarded();
        } else {
          console.info('[ads] canRequestAds=false — not preloading.');
        }
        return true;
      }).catch(function (e) {
        console.warn('[ads] initialize failed:', e);
        return false;
      });
    },

    /* ------------------------------------------------------------------
       UMP consent. Resolves ALWAYS — the caller continues to initialize()
       whatever happens here.

       `canRequestAds` is the only field worth branching on. It is true
       when consent was obtained, when consent was never required (most of
       the world), and when the user accepted a limited-ads path; false
       only when a form is genuinely outstanding. Defaults to true so a
       consent *failure* degrades to today's behaviour rather than
       silently switching ads off everywhere.
       ------------------------------------------------------------------ */
    canRequestAds: true,
    consentStatus: 'UNKNOWN',
    privacyOptionsRequired: false,

    _requestConsent: function (testDevices) {
      var self = this, m = self._m;
      var cc = (Cfg.admob && Cfg.admob.consent) || {};

      if (cc.enabled === false) {
        console.info('[ads] consent flow disabled by config.');
        return Promise.resolve();
      }
      if (!m.requestConsentInfo) {
        console.warn('[ads] plugin has no consent API — update the plugin.');
        return Promise.resolve();
      }

      return m.requestConsentInfo({
        /* NUMBER, not a string — AdConsentExecutor reads it with
           call.getInt(). 0 = DISABLED. */
        debugGeography: cc.debugGeography || 0,
        /* Hashed SDK ids, the same ones setTestDeviceIds wants. */
        testDeviceIdentifiers: testDevices || [],
        tagForUnderAgeOfConsent: false
      })
        .then(function (info) {
          self._applyConsent(info);
          /* A form is only shown when one is actually available AND the
             user still owes an answer. Showing it unconditionally would
             re-prompt on every cold start. */
          if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') {
            return m.showConsentForm().then(function (after) {
              self._applyConsent(after);
            });
          }
          return null;
        })
        .catch(function (e) {
          /* The commonest cause here is NO MESSAGE CONFIGURED in the
             AdMob console — the SDK reports no form available, or errors
             outright. That is a dashboard problem, not a code one, and it
             must not take the game's ads down with it. */
          console.warn('[ads] consent failed (is a message configured in ' +
            'AdMob → Privacy & messaging?):', e && (e.message || e));
        });
    },

    _applyConsent: function (info) {
      if (!info) return;
      if (typeof info.canRequestAds === 'boolean') {
        this.canRequestAds = info.canRequestAds;
      }
      if (info.status) this.consentStatus = info.status;
      this.privacyOptionsRequired =
        info.privacyOptionsRequirementStatus === 'REQUIRED';
      console.info('[ads] consent status=' + this.consentStatus +
        ' canRequestAds=' + this.canRequestAds +
        ' privacyOptions=' + this.privacyOptionsRequired);
    },

    /* Regulators require a persistent way to CHANGE a consent choice, not
       just make it once. Surface this from the shop/settings only when
       privacyOptionsRequired is true — Google hides the entry point
       otherwise, and a dead button is worse than no button. */
    showPrivacyOptions: function () {
      var self = this, m = self._m;
      if (!m || !m.showPrivacyOptionsForm) {
        return Promise.resolve({ ok: false });
      }
      return m.showPrivacyOptionsForm()
        .then(function () { return { ok: true }; })
        .catch(function (e) {
          console.warn('[ads] privacy options form:', e && (e.message || e));
          return { ok: false };
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
