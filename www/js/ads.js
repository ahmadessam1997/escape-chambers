/* =====================================================================
   Escape Chambers — ads (AdMob)
   ---------------------------------------------------------------------
   Six formats, each deliberately placed:

     interstitial  only on the seam between chambers, after the win card
                   is dismissed, every Nth chamber that actually took a
                   while, with a cooldown. NEVER inside a chamber — this
                   is a concentration puzzle and an interrupt mid-search
                   would be indefensible (and Play's ad policy penalises
                   interruptive density).
     rewarded      always opt-in: +2 hints, offered when the wallet is
                   empty and from the shop; also the "skip this chamber"
                   offer once a player has been stuck a long time.
     rewarded      the SAME seam as the plain interstitial, never an extra
      interstitial break: every Nth seam ad is served as this instead. Pays
                   more and grants a hint, so the interruption is worth
                   more to both sides. Falls back to the plain interstitial
                   when not loaded.
     banner        menu only, taken down before a chamber renders. A strip
                   over a room being searched can cover a clue.
     native        a compact card in the win card's #nativeSlot, drawn
                   natively by NativeAdPlugin.java (the AdMob Capacitor
                   plugin has no native-ad support). When none is loaded
                   the slot stays collapsed and the card looks as before.
     app open      only when the player comes BACK to the app after
                   ads.appOpen.minBackgroundMs away, and only on the rooms
                   menu — a return into a chamber waits for the menu, and
                   is dropped if the menu does not come soon. Never on a
                   cold start. Shares _lastInterstitialAt, so it cannot
                   follow a seam ad, nor a seam ad follow it.

   Remove ads silences ALL SIX, the opt-in rewarded video included, and
   nothing is even PRELOADED for an owner — a cached impression that can
   never be shown is fill burned for nothing.

   Every entry point RESOLVES rather than rejecting. A failed ad load must
   never block the player from moving to the next chamber. In the browser
   everything no-ops and honestly reports "not shown".
   ===================================================================== */
(function (global) {
  'use strict';

  var Cfg = global.ECConfig;

  /* How long to wait for a full-screen ad to APPEAR before giving up on
     it. A wedged ad SDK must not strand the player on a dead seam. */
  var SHOW_TIMEOUT_MS = 8000;

  /* A pause that arrives within this long of us opening something (an
     ad, the Play Store, a purchase sheet, a permission dialog) is that
     thing covering the app, not the player leaving. */
  var HANDOFF_MS = 8000;

  function track(format) {
    var A = global.ECAnalytics;
    if (A) A.log('ad_shown', { format: format });
  }

  var Ads = {
    available: false,
    removeAdsOwned: false,
    _interstitialReady: false,
    _rewardedReady: false,
    _lastInterstitialAt: 0,
    _rewardedInterstitialReady: false,
    _earnedRIReward: false,
    /* _bannerShown tracks whether an ad VIEW exists, _bannerWanted whether
       the current screen wants one. They diverge whenever the SDK tears a
       banner down on its own (failed refresh, ad view reaped under memory
       pressure), which is exactly when calling resumeBanner() would throw
       instead of re-showing. */
    _bannerShown: false,
    _bannerWanted: false,

    _appOpenReady: false,
    _appOpenShowing: false,
    _backgroundAt: 0,               // when the app last went to background
    _handoffAt: 0,                  // noteHandoff(): we sent the player out
    _fsShowing: false,              // one of OUR full-screen ads is up
    _appOpenPending: false,         // came back after long enough away,
    _appOpenPendingAt: 0,           //   waiting for the rooms menu

    _n: null,                       // ECNativeAd plugin handle
    _nativeReady: false,
    _nativeShown: false,

    init: function () {
      var self = this;

      /* Mirror the entitlement out of the save file BEFORE anything can
         preload. game.js awaits ECSave.load() first, so this is the real
         value, and it is the only thing that protects a paying player on
         a cold OFFLINE launch: billing cannot confirm the purchase for
         several seconds, or at all on a plane. Seeding it late is how an
         owner gets ads warmed (and a banner) on every launch. */
      try {
        var S = global.ECSave;
        if (S && S.data && S.data.removeAds) self.removeAdsOwned = true;
      } catch (e) {}

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
        return self._requestTracking();
      }).then(function () {
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
        self._n = (global.Capacitor.Plugins && global.Capacitor.Plugins.ECNativeAd) || null;
        self._wireListeners();
        self._wireAppState();

        /* An owner gets NOTHING warmed. Every preload is a real ad request
           against a real unit; caching an impression this install can
           never show wastes fill and drags the unit's show rate down. */
        if (self.removeAdsOwned) {
          console.info('[ads] Remove ads owned — no format preloaded.');
          return true;
        }
        /* Only warm the cache if the SDK says we may actually request
           ads. Preloading under a REQUIRED-but-unanswered consent state
           burns a request that comes back empty and leaves _ready false
           anyway. */
        if (self.canRequestAds) {
          self._preloadAll();
        } else {
          console.info('[ads] canRequestAds=false — not preloading.');
        }
        return true;
      }).catch(function (e) {
        console.warn('[ads] initialize failed:', e);
        return false;
      });
    },

    /* A blank unit id in config.js means THAT FORMAT IS OFF, and it is
       checked before every load and every show. A blank id handed to the
       SDK is not a no-op: it is a malformed request that comes back as a
       load failure, indistinguishable in the logs from a real no-fill.
       Trimmed, because an id pasted out of the AdMob console arrives with
       whitespace often enough to matter. */
    _unit: function (key) {
      if (Cfg.adUnit) return Cfg.adUnit(key);   // per-platform (config.js)
      var id = (Cfg.admob && Cfg.admob[key]) || '';
      return (typeof id === 'string') ? id.trim() : '';
    },

    /* iOS only: App Tracking Transparency. Asked AFTER the UMP consent
       flow (Google's recommended order) and BEFORE initialize, so the
       first ad request already knows whether the IDFA may be used. A
       refusal or an error never stops ads: they run non-personalised. */
    _requestTracking: function () {
      var m = this._m;
      if (!Cfg.isIOS || !Cfg.isIOS() || !m || !m.requestTrackingAuthorization) {
        return Promise.resolve();
      }
      return Promise.resolve()
        .then(function () { return m.trackingAuthorizationStatus ? m.trackingAuthorizationStatus() : null; })
        .then(function (s) {
          if (s && s.status && s.status !== 'notDetermined') return null;
          return m.requestTrackingAuthorization();
        })
        .catch(function (e) { console.warn('[ads] ATT request failed:', e); });
    },

    _preloadAll: function () {
      this.preloadInterstitial();
      this.preloadRewarded();
      this.preloadRewardedInterstitial();
      this._preloadAppOpen();
      this._preloadNative();
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
      self.noteHandoff();
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
        self._fsShowing = false;
        if (self._onInterstitialClosed) {
          var f = self._onInterstitialClosed;
          self._onInterstitialClosed = null;
          f();
        }
      };
      try {
        m.addListener('interstitialAdLoaded', function () { self._interstitialReady = true; });
        m.addListener('interstitialAdFailedToLoad', function () { self._interstitialReady = false; });
        /* The ad is on screen: from here the show timeout must NOT fire.
           It exists for an ad that never appears; an interstitial video
           routinely runs longer than the timeout, and timing out under it
           started the next chamber's clock behind the ad. */
        m.addListener('interstitialAdShowed', function () {
          if (self._onInterstitialShowed) self._onInterstitialShowed();
        });
        m.addListener('interstitialAdDismissed', function () { closed(); self.preloadInterstitial(); });
        /* Seen on the emulator (1.7.0 check): a slow device trips the SDK's
           own "Timeout for show call succeed", which reports FailedToShow
           AFTER interstitialAdShowed — and the ad then stays on screen.
           Treating that as closed started the next chamber's clock behind
           the ad. Once the ad has shown, only its dismissal ends it. */
        m.addListener('interstitialAdFailedToShow', function () {
          if (self._onInterstitialFailedLate && self._onInterstitialFailedLate()) return;
          closed();
        });

        m.addListener('onRewardedVideoAdLoaded', function () { self._rewardedReady = true; });
        m.addListener('onRewardedVideoAdFailedToLoad', function () { self._rewardedReady = false; });
        m.addListener('onRewardedVideoAdReward', function () { self._earnedReward = true; });
        m.addListener('onRewardedVideoAdShowed', function () { if (self._rvHook) self._rvHook.showed(); });
        m.addListener('onRewardedVideoAdFailedToShow', function () { if (self._rvHook) self._rvHook.failed(); });
        m.addListener('onRewardedVideoAdDismissed', function () {
          self._rewardedReady = false;
          if (self._rvHook) self._rvHook.dismissed();
          else self.preloadRewarded();
        });

        m.addListener('onRewardedInterstitialAdLoaded', function () { self._rewardedInterstitialReady = true; });
        m.addListener('onRewardedInterstitialAdFailedToLoad', function () { self._rewardedInterstitialReady = false; });
        m.addListener('onRewardedInterstitialAdReward', function () { self._earnedRIReward = true; });
        m.addListener('onRewardedInterstitialAdShowed', function () { if (self._riHook) self._riHook.showed(); });
        m.addListener('onRewardedInterstitialAdFailedToShow', function () { if (self._riHook) self._riHook.failed(); });
        m.addListener('onRewardedInterstitialAdDismissed', function () {
          self._rewardedInterstitialReady = false;
          if (self._riHook) self._riHook.dismissed();
          else self.preloadRewardedInterstitial();
        });

        m.addListener('bannerAdLoaded', function () { self._bannerShown = true; self._bannerRoom(); });
        m.addListener('bannerAdFailedToLoad', function () { self._bannerShown = false; self._bannerRoom(); });
        /* The adaptive banner's real height, in CSS px. The banner is a
           native view laid OVER the bottom of the WebView, so the page has
           to keep its own content out from under it (see _bannerRoom). */
        m.addListener('bannerAdSizeChanged', function (sz) {
          if (sz && sz.height > 0) self._bannerH = Math.ceil(sz.height);
          self._bannerRoom();
        });

        /* App open: bare names, no 'on' — see
           app-open/app-open-ad-plugin-events.enum.js (plugin 8.1.0). */
        m.addListener('appOpenAdLoaded', function () { self._appOpenReady = true; });
        m.addListener('appOpenAdFailedToLoad', function () { self._appOpenReady = false; });
        var aoDone = function () {
          self._appOpenShowing = false;
          self._appOpenReady = false;
          self._preloadAppOpen();
        };
        m.addListener('appOpenAdClosed', aoDone);
        m.addListener('appOpenAdFailedToShow', aoDone);
      } catch (e) { console.warn('[ads] listeners:', e); }
    },

    /* Remove Ads means EXACTLY that: every format goes silent for that
       player — banner, interstitial, rewarded interstitial, native, app
       open AND the opt-in rewarded video. Changed 2026-09-20 at the
       owner's instruction; the earlier design deliberately kept rewarded
       videos alive as the only free hint faucet, so anything that OFFERS
       one now has to hide rather than fail. Every caller already gates on
       rewardedAvailable(), which is why suppressing it there is enough. */
    setRemoveAds: function (owned) {
      var was = this.removeAdsOwned;
      this.removeAdsOwned = !!owned;

      if (!this.removeAdsOwned) {
        /* Owned -> not owned is a REFUND (or a store that finally answered
           "no" after the saved flag said yes). init() skipped every
           warm-up for this launch, so re-warm now or the player has no
           hint videos for the rest of the session. */
        if (was && this.available && this.canRequestAds) this._preloadAll();
        return;
      }

      /* Native card off the screen and released; no app-open pending. */
      this.hideWinCardAd();
      if (this._n) this._n.destroy().catch(function () {});
      this._nativeReady = false;
      this._appOpenReady = false;
      this._appOpenPending = false;

      /* Take the banner down NOW, not at the next screen change. The
         purchase happens in the shop with the banner on screen directly
         beneath it; leaving it up until the player navigates away reads
         as the purchase having failed. */
      this.removeBanner();

      /* Drop the warm inventory too: nothing here will ever show it. */
      this._interstitialReady = false;
      this._rewardedReady = false;
      this._rewardedInterstitialReady = false;
    },

    preloadInterstitial: function () {
      var self = this, id = self._unit('interstitialId');
      if (!self.available || !self._m || self.removeAdsOwned || !id) return Promise.resolve();
      return self._m.prepareInterstitial({ adId: id })
        .then(function () { self._interstitialReady = true; })
        .catch(function (e) { self._interstitialReady = false; console.warn('[ads] preload interstitial:', e); });
    },

    preloadRewarded: function () {
      var self = this, id = self._unit('rewardedId');
      if (!self.available || !self._m || self.removeAdsOwned || !id) return Promise.resolve();
      return self._m.prepareRewardVideoAd({ adId: id })
        .then(function () { self._rewardedReady = true; })
        .catch(function (e) { self._rewardedReady = false; console.warn('[ads] preload rewarded:', e); });
    },

    /* ==================================================================
       The seam between chambers

       chambersSinceAd and seamAdsShown both live in the save file so the
       cadence survives the app being closed between chambers — otherwise
       every cold start would reset them and the player would see far
       fewer ads than intended (or, with a different bug, far more).
       ================================================================== */

    /* True when a plain interstitial may run on this seam. Kept as its
       own check because the cadence tests pin it directly. */
    shouldShowInterstitial: function (chambersSinceAd) {
      if (!this.available || this.removeAdsOwned || !this._interstitialReady) return false;
      if (chambersSinceAd < Cfg.ads.interstitialEveryNChambers) return false;
      return (Date.now() - this._lastInterstitialAt) >= Cfg.ads.interstitialCooldownMs;
    },

    /* Which format, if any, this seam gets:
         'rewardedInterstitial' | 'interstitial' | null

       ONE cadence decides WHEN a seam ad is due; the format is chosen
       only after that. Every Nth seam ad is the rewarded interstitial
       (same interruption, but the player walks away with a hint).

       The old design gave each format its own chamber cadence off one
       shared counter, so the plain interstitial (every 2) always reset
       the counter before the rewarded one (every 4) could ever be due —
       it fired only on the rare seam where the plain one happened not to
       be loaded. When the preferred format is not loaded the other one
       fills the seam rather than skipping it.

       removeAdsOwned silences the rewarded interstitial exactly like the
       plain one. It is NOT opt-in the way a rewarded video is — it
       appears whether or not the player asked for it — so keeping it
       after the purchase on the grounds that it carries a reward would be
       a cheat. */
    pickSeamAd: function (chambersSinceAd, seamAdsShown) {
      if (!this.available || this.removeAdsOwned) return null;
      var every = Cfg.ads.interstitialEveryNChambers;
      if (!every || chambersSinceAd < every) return null;
      /* One cooldown for every full-screen format, checked before the
         format is chosen. */
      if ((Date.now() - this._lastInterstitialAt) < Cfg.ads.interstitialCooldownMs) return null;

      var riReady = !!this._unit('rewardedInterstitialId') && this._rewardedInterstitialReady;
      var iReady = !!this._unit('interstitialId') && this._interstitialReady;
      var nth = Cfg.ads.rewardedInterstitialEveryNthAd;
      var riTurn = !!nth && (((seamAdsShown | 0) + 1) % nth === 0);

      if (riReady && (riTurn || !iReady)) return 'rewardedInterstitial';
      if (iReady) return 'interstitial';

      /* Due but empty. The caller leaves its counter alone, so the next
         seam is still due; try to have something warm for it. */
      this.preloadInterstitial();
      return null;
    },

    /* Resolves true when the ad was shown and has closed, false when it
       never appeared. Never rejects. */
    showInterstitial: function () {
      var self = this;
      var prevAt = self._lastInterstitialAt;
      return new Promise(function (resolve) {
        var settled = false, killer = null, showed = false, grace = null;
        var done = function (shown) {
          clearTimeout(killer);
          clearTimeout(grace);
          self._onInterstitialShowed = null;
          self._onInterstitialFailedLate = null;
          if (settled) return;
          settled = true;
          self._fsShowing = false;
          if (shown) track('interstitial');
          /* Never shown means the player was never interrupted, so their
             quiet period has not been spent. */
          else self._lastInterstitialAt = prevAt;
          resolve(shown);
        };
        self._onInterstitialClosed = function () { done(true); };
        self._onInterstitialShowed = function () { showed = true; clearTimeout(killer); };
        /* FailedToShow after Showed: the ad is (or may be) on screen, so
           wait for its dismissal; the grace timer only covers an SDK that
           never reports one, as in _awaitFullscreen. */
        self._onInterstitialFailedLate = function () {
          if (!showed) return false;
          console.warn('[ads] interstitial: failed-to-show after it showed; waiting for dismissal');
          clearTimeout(grace);
          grace = setTimeout(function () {
            self._onInterstitialClosed = null;
            done(true);
          }, 90000);
          return true;
        };
        // A wedged ad SDK must not strand the player on a dead screen.
        killer = setTimeout(function () {
          self._onInterstitialClosed = null;
          done(false);
        }, SHOW_TIMEOUT_MS);
        self._lastInterstitialAt = Date.now();
        self._fsShowing = true;
        self._m.showInterstitial().catch(function (e) {
          console.warn('[ads] showInterstitial:', e);
          if (self._onInterstitialFailedLate && self._onInterstitialFailedLate()) return;
          self._onInterstitialClosed = null;
          self._interstitialReady = false;
          self.preloadInterstitial();
          done(false);
        });
      });
    },

    /* Runs one rewarded-style full-screen ad and resolves true once it has
       been shown AND CLOSED, false if it never appeared. Never rejects.

       The plugin's own promise cannot be used for this. On Android
       showRewardVideoAd() / showRewardInterstitialAd() resolve inside
       onUserEarnedReward and NOWHERE ELSE (AdRewardExecutor.java): a
       player who closes the video early leaves the promise pending for
       ever. Awaiting it froze the shop behind its busy flag, and on the
       seam it meant `then()` never ran — the win card was gone and the
       next chamber never started. So the DISMISSED event settles this,
       and the plugin promise is only a second source for "it paid".

       `hook` is '_rvHook' or '_riHook'; _wireListeners feeds it. */
    _awaitFullscreen: function (hook, onReward, call) {
      var self = this;
      return new Promise(function (resolve) {
        var settled = false, showed = false, killer = null, grace = null;
        var done = function (shown) {
          clearTimeout(killer);
          clearTimeout(grace);
          if (settled) return;
          settled = true;
          self[hook] = null;
          self._fsShowing = false;
          resolve(shown);
        };
        /* A failure reported AFTER the ad showed (the SDK's own show
           timeout on a slow device) leaves the ad on screen: wait for the
           dismissal, as showInterstitial does. */
        var lateFail = function () {
          if (!showed) return false;
          clearTimeout(grace);
          grace = setTimeout(function () { done(true); }, 90000);
          return true;
        };
        self[hook] = {
          showed: function () { showed = true; clearTimeout(killer); },
          dismissed: function () { done(true); },
          failed: function () { if (!lateFail()) done(false); }
        };
        // A wedged ad SDK must not strand the player on a dead screen.
        killer = setTimeout(function () { if (!showed) done(false); }, SHOW_TIMEOUT_MS);
        self._fsShowing = true;
        var p;
        try { p = call(); } catch (e) { done(false); return; }
        if (!p || !p.then) return;
        p.then(function (reward) {
          if (reward && (reward.amount > 0 || reward.type)) onReward();
          /* Reward earned, ad still on screen: the dismissal follows. The
             grace timer only covers a plugin that never reports it. */
          showed = true;
          clearTimeout(killer);
          grace = setTimeout(function () { done(true); }, 90000);
        }, function (e) {
          console.warn('[ads] full-screen show:', e && (e.message || e));
          if (!lateFail()) done(false);
        });
      });
    },

    rewardedAvailable: function () {
      return this.available && !this.removeAdsOwned &&
             !!this._unit('rewardedId') && this._rewardedReady;
    },

    /* Resolves {earned:bool}. Never rejects. `placement` is only a label
       for analytics: 'hints' (shop / out-of-hints) or 'skip'. */
    showRewarded: function (placement) {
      var self = this;
      /* Defence in depth: rewardedAvailable() already hides every button
         that leads here, so reaching this line with the purchase owned
         means a caller went around the UI. Refuse without preloading. */
      if (self.removeAdsOwned) {
        return Promise.resolve({ earned: false, unavailable: true, removed: true });
      }
      if (!self.rewardedAvailable()) {
        self.preloadRewarded();   // warm one for next time
        return Promise.resolve({ earned: false, unavailable: true });
      }
      self._earnedReward = false;
      return self._awaitFullscreen('_rvHook',
        function () { self._earnedReward = true; },
        function () { return self._m.showRewardVideoAd(); }
      ).then(function (shown) {
        /* A player who closed the video early earns nothing — that is the
           deal the offer states. */
        var earned = shown && self._earnedReward;
        self._rewardedReady = false;
        self.preloadRewarded();
        if (shown) track('rewarded');
        if (earned) {
          var A = global.ECAnalytics;
          if (A) A.log('rewarded_done', { placement: placement || 'hints' });
        }
        return { earned: earned };
      });
    },

    /* ==================================================================
       Banner
       showBanner() is idempotent and records intent, so a caller can fire
       it on every screen change without tracking state itself.
       hideBanner() keeps the view alive for a cheap resume; removeBanner()
       tears it down for good.
       ================================================================== */
    /* Reserve room for the banner. It floats above the WebView, so a menu
       card centred in the full viewport runs UNDER it: on the emulator
       (1.6.0 check) the card with "Resume chamber" showing ended exactly at
       the banner's top edge, and on any shorter phone the banner covered
       "More games". body.bannerUp + --banner-h make every overlay centre
       in, and scroll within, the space above the banner instead. */
    _bannerH: 60,
    _bannerRoom: function () {
      try {
        var b = global.document.body;
        var up = this._bannerWanted && this._bannerShown;
        b.classList.toggle('bannerUp', !!up);
        b.style.setProperty('--banner-h', (up ? this._bannerH : 0) + 'px');
      } catch (e) {}
    },

    bannerEnabled: function () {
      return this.available &&
             !this.removeAdsOwned &&
             !!this._unit('bannerId') &&
             !!(Cfg.ads.banner && Cfg.ads.banner.enabled !== false);
    },

    showBanner: function () {
      var self = this;
      /* game.js calls this exactly when the rooms menu comes up, which is
         the one screen an app-open ad is allowed on. */
      self._flushAppOpen();
      if (!self.bannerEnabled()) return Promise.resolve(false);
      self._bannerWanted = true;
      self._bannerRoom();
      if (self._bannerShown) {
        return self._m.resumeBanner()
          .then(function () { return true; })
          .catch(function (e) {
            console.warn('[ads] resumeBanner:', e);
            self._bannerShown = false;
            self._bannerRoom();
            return false;
          });
      }
      var b = Cfg.ads.banner || {};
      return self._m.showBanner({
        adId: self._unit('bannerId'),
        adSize: b.size || 'ADAPTIVE_BANNER',
        position: b.position || 'BOTTOM_CENTER',
        margin: b.margin || 0,
        /* The banner is the one format that can sit on screen for minutes
           under a REQUIRED-but-unanswered consent state. npa keeps it
           serving non-personalised rather than coming back empty, which
           is the difference between a cheap impression and none. */
        npa: !self.canRequestAds
      })
        .then(function () {
          self._bannerShown = true;
          self._bannerRoom();
          track('banner');
          /* The menu can be left (or Remove ads bought) while the request
             is in flight; a banner that lands after that must not stay. */
          if (!self._bannerWanted) self._m.hideBanner().catch(function () {});
          return true;
        })
        .catch(function (e) {
          console.warn('[ads] showBanner:', e);
          self._bannerShown = false;
          self._bannerRoom();
          return false;
        });
    },

    hideBanner: function () {
      var self = this;
      self._bannerWanted = false;
      self._bannerRoom();
      if (!self.available || !self._bannerShown) return Promise.resolve();
      return self._m.hideBanner().catch(function (e) {
        console.warn('[ads] hideBanner:', e);
      });
    },

    removeBanner: function () {
      var self = this;
      self._bannerWanted = false;
      self._bannerRoom();
      if (!self.available || !self._bannerShown) return Promise.resolve();
      self._bannerShown = false;
      return self._m.removeBanner().catch(function (e) {
        console.warn('[ads] removeBanner:', e);
      });
    },

    /* ==================================================================
       Rewarded interstitial
       ================================================================== */
    preloadRewardedInterstitial: function () {
      var self = this, id = self._unit('rewardedInterstitialId');
      if (!self.available || !self._m || self.removeAdsOwned || !id) return Promise.resolve();
      return self._m.prepareRewardInterstitialAd({ adId: id })
        .then(function () { self._rewardedInterstitialReady = true; })
        .catch(function (e) {
          self._rewardedInterstitialReady = false;
          console.warn('[ads] preload rewarded interstitial:', e);
        });
    },

    /* Resolves {shown, earned}. Never rejects. */
    showRewardedInterstitial: function () {
      var self = this;
      if (!self.available || self.removeAdsOwned || !self._rewardedInterstitialReady) {
        self.preloadRewardedInterstitial();
        return Promise.resolve({ shown: false, earned: false });
      }
      self._earnedRIReward = false;
      /* Shares _lastInterstitialAt with the plain interstitial so the
         cooldown covers BOTH formats. Separate clocks would let the two
         line up and fire back to back on one seam. */
      var prevAt = self._lastInterstitialAt;
      self._lastInterstitialAt = Date.now();
      return self._awaitFullscreen('_riHook',
        function () { self._earnedRIReward = true; },
        function () { return self._m.showRewardInterstitialAd(); }
      ).then(function (shown) {
        self._rewardedInterstitialReady = false;
        self.preloadRewardedInterstitial();
        if (!shown) {
          /* Nothing was shown, so nothing was spent. Deliberately NOT
             falling through to the plain interstitial on the same seam: a
             show that just failed usually means the SDK is unhappy right
             now, and the next seam is still due. */
          self._lastInterstitialAt = prevAt;
          return { shown: false, earned: false };
        }
        var earned = !!self._earnedRIReward;
        track('rewarded_interstitial');
        if (earned) {
          var A = global.ECAnalytics;
          if (A) A.log('rewarded_done', { placement: 'seam' });
        }
        return { shown: true, earned: earned };
      });
    },

    /* ==================================================================
       App open
       @capacitor/app's appStateChange is the foreground/background
       signal. Going to background stamps the time; coming back after
       minBackgroundMs marks an app-open ad as PENDING. It shows at once
       if the rooms menu is up, otherwise the next time the menu comes up
       (game.js calls showBanner() there, which runs _flushAppOpen) — but
       only within pendingMaxMs, so a return into a chamber that then runs
       ten minutes does not end in an "app open" ad out of nowhere. A cold
       start never shows one: _backgroundAt is 0 until the app has
       actually been away.
       ================================================================== */
    _wireAppState: function () {
      var self = this;
      var App = global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.App;
      if (!App || !App.addListener) return;
      try {
        App.addListener('appStateChange', function (st) {
          if (!st) return;
          if (!st.isActive) {
            /* Being covered by something WE opened does not count as the
               player leaving: one of our own full-screen ads, the Play
               Store from the rating prompt or the more-games panel, a
               purchase sheet, a permission dialog. */
            var handoff = (Date.now() - self._handoffAt) < HANDOFF_MS;
            if (!self._appOpenShowing && !self._fsShowing && !handoff) {
              self._backgroundAt = Date.now();
            }
            return;
          }
          var away = self._backgroundAt ? Date.now() - self._backgroundAt : 0;
          self._backgroundAt = 0;
          var cfg = Cfg.ads.appOpen || {};
          if (away >= (cfg.minBackgroundMs || 30000)) {
            self._appOpenPending = true;
            self._appOpenPendingAt = Date.now();
            self._flushAppOpen();
          }
        });
      } catch (e) { console.warn('[ads] appStateChange:', e); }
    },

    /* We are about to send the player out of the app, or put something of
       the system's on top of it. The return from that is not a return
       from time away. */
    noteHandoff: function () { this._handoffAt = Date.now(); },

    _appOpenEnabled: function () {
      return this.available && !this.removeAdsOwned &&
             !!this._unit('appOpenId') &&
             !!(Cfg.ads.appOpen && Cfg.ads.appOpen.enabled !== false);
    },

    _preloadAppOpen: function () {
      var self = this, id = self._unit('appOpenId');
      if (!self._appOpenEnabled() || !self._m || !self._m.loadAppOpen) return Promise.resolve();
      return self._m.loadAppOpen({ adId: id })
        .then(function () { self._appOpenReady = true; })
        .catch(function (e) {
          self._appOpenReady = false;
          console.warn('[ads] preload app open:', e);
        });
    },

    /* Shows the pending app-open ad if, and only if, everything lines up.
       Called on return to foreground and whenever the menu comes up.
       Never throws. */
    _flushAppOpen: function () {
      var self = this;
      if (!self._appOpenPending) return;
      if (!self._appOpenEnabled()) { self._appOpenPending = false; return; }
      var cfg = Cfg.ads.appOpen || {};
      if ((Date.now() - self._appOpenPendingAt) > (cfg.pendingMaxMs || 120000)) {
        self._appOpenPending = false;                // the moment has passed
        return;
      }
      /* Only the rooms menu. game.js answers; with no game to ask (a
         harness) the screen is treated as safe. */
      var G = global.ECGame;
      if (G && G.adSafeScreen && !G.adSafeScreen()) return;   // wait for the menu
      if (self._fsShowing || self._appOpenShowing) return;
      if ((Date.now() - self._lastInterstitialAt) < Cfg.ads.interstitialCooldownMs) {
        self._appOpenPending = false;                // too soon after a seam ad
        return;
      }
      if (!self._appOpenReady) {
        self._appOpenPending = false;
        self._preloadAppOpen();
        return;
      }
      self._appOpenPending = false;
      self._appOpenShowing = true;
      self._lastInterstitialAt = Date.now();
      track('app_open');
      self._m.showAppOpen().catch(function (e) {
        console.warn('[ads] showAppOpen:', e);
        self._appOpenShowing = false;
        self._appOpenReady = false;
        self._preloadAppOpen();
      });
    },

    /* ==================================================================
       Native (win card)
       showWinCardAd(slotEl) -> Promise<'native' | 'none'>
       game.js calls this when the win card opens. With a native ad
       loaded, the slot is revealed, measured and handed to the plugin;
       otherwise the slot stays collapsed and the card is as it was before
       native existed. hideWinCardAd() is called when the card closes
       (every path), BEFORE anything else can draw where the card was —
       the native view floats above the WebView and would cover it.
       ================================================================== */
    _nativeEnabled: function () {
      return this.available && !this.removeAdsOwned && !!this._n &&
             !!this._unit('nativeId') &&
             !!(Cfg.ads.native && Cfg.ads.native.enabled !== false);
    },

    _preloadNative: function () {
      var self = this;
      if (!self._nativeEnabled() || self._nativeReady) return Promise.resolve();
      return self._n.load({ adId: self._unit('nativeId') })
        .then(function (r) {
          self._nativeReady = !!(r && r.loaded);
          if (!self._nativeReady) console.info('[ads] native not loaded:', r && r.error);
        })
        .catch(function (e) {
          self._nativeReady = false;
          console.warn('[ads] preload native:', e);
        });
    },

    showWinCardAd: function (slot) {
      var self = this;
      if (!slot || !self._nativeEnabled() || !self._nativeReady) {
        if (slot) slot.classList.add('hidden');
        if (self._nativeEnabled()) self._preloadNative();   // for the next card
        return Promise.resolve('none');
      }
      slot.classList.remove('hidden');
      return new Promise(function (resolve) {
        /* Measure after the card's layout has settled; a rect taken in
           the same frame the slot was revealed can be stale. */
        setTimeout(function () {
          var ov = global.document.getElementById('winOv');
          if (!ov || !ov.classList.contains('show') || self.removeAdsOwned) {
            slot.classList.add('hidden');
            resolve('none');
            return;
          }
          var r = slot.getBoundingClientRect();
          self._n.show({ x: r.left, y: r.top, width: r.width, height: r.height })
            .then(function (res) {
              /* The card may have been dismissed while the plugin call
                 was in flight; a native view must not outlive it. */
              if (!ov.classList.contains('show')) {
                self._n.hide().catch(function () {});
                resolve('none');
                return;
              }
              if (res && res.shown) {
                self._nativeShown = true;
                track('native');
                resolve('native');
                return;
              }
              console.info('[ads] native show failed:', res && res.error);
              slot.classList.add('hidden');
              self._nativeReady = false;
              resolve('none');
            })
            .catch(function () {
              slot.classList.add('hidden');
              resolve('none');
            });
        }, 250);
      });
    },

    /* Native ads are single-use: once one has been on screen it is
       destroyed and the next is loaded for the next win card. */
    hideWinCardAd: function () {
      var self = this;
      var slot = global.document.getElementById('nativeSlot');
      if (slot) slot.classList.add('hidden');
      if (!self._n) return Promise.resolve();
      if (!self._nativeShown) return self._n.hide().catch(function () {});
      self._nativeShown = false;
      self._nativeReady = false;
      return self._n.destroy()
        .catch(function () {})
        .then(function () { self._preloadNative(); });
    }
  };

  global.ECAds = Ads;
})(window);
