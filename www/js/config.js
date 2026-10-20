/* =====================================================================
   Escape Chambers — monetization configuration
   ---------------------------------------------------------------------
   THE ONLY FILE YOU EDIT WHEN THE REAL ACCOUNTS EXIST.

   It ships with Google's official *test* ad units and an empty RevenueCat
   key, and both of those defaults are deliberate:

     - Test ad units always fill, so the ad paths are verifiable before
       AdMob approves the account. Serving *real* ads to yourself is
       invalid traffic and the most common way to get an AdMob account
       suspended, so do not swap the real IDs in until the devices you
       test on are registered under admob.testDeviceIds (or in the AdMob
       console — the two routes take DIFFERENT values, see below).

     - An empty RevenueCat key makes billing FAIL CLOSED on device: the
       shop says "Store unavailable" and grants nothing. It never falls
       back to the mock. HomeKept shipped the opposite once and its dev
       mock handed out free lifetime access.

   The browser mock is gated on isNative()===false alone, so it cannot
   activate in a shipped AAB no matter how this file is edited.
   ===================================================================== */
(function (global) {
  'use strict';

  var Config = {
    /* MUST be bumped alongside android/app/build.gradle. It is what the
       hidden build line on the rooms menu prints (tap the menu title five
       times), so a tester can say which build they are on — without it,
       "purchases don't work" is indistinguishable from "you are still
       running last week's APK", which cost a full debugging round. */
    build: '1.7.2 (18)',

    /* ---------------- AdMob ----------------
       The app ID ALSO has to be written into
       android/app/src/main/AndroidManifest.xml as the
       com.google.android.gms.ads.APPLICATION_ID meta-data. If the two
       disagree, or the manifest one is missing, the SDK throws during
       startup and THE APP CRASHES ON LAUNCH. Verify with a scripted
       compare, never by eye. */
    admob: {
      // Real IDs from AdMob -> Apps -> Escape 20 Chambers, 2026-08-13.
      // App ref 3223395835.
      appId: 'ca-app-pub-7898882561225435~3223395835',
      interstitialId: 'ca-app-pub-7898882561225435/3031824142', // escape-chambers-interstitial
      rewardedId: 'ca-app-pub-7898882561225435/3079875276',     // escape-chambers-rewarded (2 hints)

      /* Added 2026-09-20 to widen format coverage. Both are LIVE units
         created that day. ads.js still checks each id before use and
         no-ops on null, so blanking one here is a safe kill switch for
         that format. Created under
         AdMob -> Apps -> Escape 20 Chambers -> Ad units and paste them
         here. A WRONG id is worse than a null one: the SDK reports a load
         failure and the slot silently never fills. */
      bannerId: 'ca-app-pub-7898882561225435/5735494595',              // escape-chambers-banner
      rewardedInterstitialId: 'ca-app-pub-7898882561225435/9062522207', // escape-chambers-rewarded-interstitial

      /* Added 2026-10-01 (1.6.0). LIVE units created 2026-10-02 under
         AdMob -> Apps -> Escape 20 Chambers -> Ad units. Blanking either
         one ('') is the kill switch for that format, same as the two
         above; ads.appOpen.enabled / ads.native.enabled do the same. */
      appOpenId: 'ca-app-pub-7898882561225435/1176655686', // escape-chambers-app-open
      nativeId: 'ca-app-pub-7898882561225435/6237410672',  // escape-chambers-native (win card)

      // All six are live units, not Google's test ones.
      isTest: false,

      /* iOS (App Store build). AdMob ids are per PLATFORM: these are the
         live units of the AdMob iOS app "Escape Chambers" (created
         2026-10-15), the twins of the Android units above. appId must equal
         GADApplicationIdentifier in ios/App/App/Info.plist. The native
         win-card ad is drawn on iOS by ios/App/App/NativeAdPlugin.swift,
         the twin of NativeAdPlugin.java, under the same ECNativeAd name. */
      ios: {
        appId: 'ca-app-pub-7898882561225435~7724768652',
        interstitialId: 'ca-app-pub-7898882561225435/1358670853',         // escape-chambers-interstitial
        rewardedId: 'ca-app-pub-7898882561225435/3176903578',             // escape-chambers-rewarded (2 hints)
        bannerId: 'ca-app-pub-7898882561225435/4992548127',               // escape-chambers-banner
        rewardedInterstitialId: 'ca-app-pub-7898882561225435/2480180837', // escape-chambers-rewarded-interstitial
        appOpenId: 'ca-app-pub-7898882561225435/5335418190',              // escape-chambers-app-open
        nativeId: 'ca-app-pub-7898882561225435/1720351672'                // escape-chambers-native (win card)
      },

      /* Devices that get TEST ads even though the IDs above are real.
         This is NOT a global test switch — it only feeds
         RequestConfiguration.setTestDeviceIds(), so listed devices get
         test ads and every other device still gets real ones.

         THE VALUE IS NOT THE ADVERTISING ID. Install the build, then:
             adb logcat | grep -i setTestDeviceIds
         The SDK logs Arrays.asList("33BE2250B43518CCDA7DE426D04EE231")
         and that *hash* is what goes here. The AdMob console's Test
         devices page wants the raw advertising ID instead. Mixing the two
         up silently does nothing at all. */
      testDeviceIds: [],

      /* ---------------- UMP consent (GDPR / US states) ----------------
         The app serves personalised ads and ships AD_ID, and the closed
         test targets 177 countries including the EEA and UK, so a consent
         form has to be REQUESTED here and CREATED in the AdMob console
         (Privacy & messaging). Neither half works alone: without the
         console message the SDK reports no form available, and without
         this call the console message is never shown to anyone.

         debugGeography is read natively with call.getInt(), so it is a
         NUMBER, not a string. Passing 'EEA' silently does nothing — the
         same failure mode as the maxAdContentRating enum below.
             0 DISABLED   1 EEA   2 NOT_EEA (deprecated)
             3 US         4 OTHER
         Set it to 1 on a test device to force the EEA form outside the
         EEA; ship it as 0.

         testDeviceIdentifiers takes the SDK's *hashed* device id — the
         same value as testDeviceIds above, and NOT the advertising ID
         from the AdMob console. It reuses that list on purpose so there
         is only one place to get it wrong. */
      consent: {
        debugGeography: 0,
        /* Set false to skip the whole flow (e.g. if the console message
           is ever withdrawn). Ads then still run, but only with whatever
           consent state the SDK already has. */
        enabled: true
      }
    },

    /* ---------------- RevenueCat ----------------
       Public Google SDK key (starts "goog_") from
       RevenueCat -> Project -> API keys. Safe to ship in the bundle.
       The SECRET key is not here and must never be. */
    revenueCat: {
      // Project "Escape 20 Chambers" (8fc1ec67) -> app "Escape 20 Chambers
      // (Play Store)" (app6d4c25efde), 2026-08-13.
      // PUBLIC SDK key: safe to ship inside the bundle. The SECRET key is
      // not here and must never be.
      androidApiKey: 'goog_GdqWuAnFGZXdSJqvndlXrAeqtNP',
      /* iOS public SDK key (starts "appl_") from RevenueCat -> Project ->
         Apps -> + App Store app -> API keys. While it is the IOS_TODO
         placeholder, revenueCatKey() returns '' and billing FAILS CLOSED on
         iOS ("Store unavailable"), exactly like a blank Android key. */
      iosApiKey: 'IOS_TODO_RC_IOS_KEY'
    },

    /* ---------------- Products ----------------
       IDs must match Play Console exactly and be created in RevenueCat
       with an entitlement of the SAME id attached.

       consumable:true is load-bearing. Play lets a consumable be bought
       repeatedly, and RevenueCat reports each purchase as a separate
       entry in customerInfo.nonSubscriptionTransactions. Hints are
       therefore granted per *transaction id* (see save.js grantedTx), not
       per entitlement — an entitlement would be permanently "active"
       after the first pack and every later pack would grant nothing. */
    products: {
      remove_ads:       { price: '$2.99', label: 'Remove ads',    consumable: false },
      hints_25:         { price: '$1.99', label: '25 hints',      consumable: true, hints: 25 },
      /* WITHDRAWN FROM SALE 2026-08-18, but deliberately NOT deleted.
         Removing the id would make billing.js stop recognising the
         entitlement, silently revoking it from anyone who already owns it.
         `retired: true` keeps every ownership path working while keeping it
         out of the shop and out of price lookups. */
      hints_unlimited:  { price: '$4.99', label: 'Never run out',
                          consumable: false, retired: true }
    },

    /* App Store product ids that differ from the ids above. Apple makes a
       product id unique across the whole developer account and Trap Jam
       already owns `remove_ads`, so the iOS twin had to be prefixed. Only
       the store boundary in billing.js sees these (storeProductId /
       productIdFromStore below); save data, the shop, analytics and the
       RevenueCat entitlement all keep `remove_ads`. Android ignores it. */
    iosProductIds: {
      remove_ads: 'escapechambers_remove_ads'
    },

    /* ---------------- Ad pacing ----------------
       An escape room is a slow, concentrated puzzle. An interstitial
       mid-chamber would be indefensible, so ads only ever appear on the
       seam between chambers, after the win card is dismissed. */
    ads: {
      /* Every 2nd chamber. (It was every chamber from 2026-08-16 to
         2026-09-07, then halved back: at 1 a full run could fire twenty
         ads, throttled only by the cooldown.) The two guards below are
         what keep the cadence honest, and they are NOT optional: together
         they mean a player who is genuinely progressing sees an ad on
         every second seam, while someone replaying short solved chambers
         to farm hints does not walk into one every ten seconds. */
      interstitialEveryNChambers: 2,
      interstitialCooldownMs: 45 * 1000,
      /* A chamber must have taken at least this long to count toward the
         cadence. Without it, replaying an already-solved tier-1 chamber
         (which takes ~10 seconds once you know where the key is) would
         speed-run the player straight into an ad every time. */
      minChamberSecondsForAd: 12,

      /* ---- Banner ----
         The banner NEVER shows inside a chamber. It lives on the menu,
         where the player is browsing rather than concentrating, and
         game.js takes it down the moment a chamber starts. That gives up
         impressions against an always-on banner and is still the right
         call twice over: a strip across a room being searched can cover a
         clue, and Play's ad policy treats a banner over interactive
         puzzle content as interruptive. */
      banner: {
        enabled: true,
        size: 'ADAPTIVE_BANNER',
        position: 'BOTTOM_CENTER',
        margin: 0
      },

      /* ---- Rewarded interstitial ----
         Shares the seam with the plain interstitial, it does not add a
         second one. ONE cadence (interstitialEveryNChambers) decides WHEN
         a seam ad is due; every Nth seam ad is then served as a rewarded
         interstitial instead of a plain one: it pays more and it hands
         the player a hint, so the same interruption gets better for both
         sides. Not loaded, and the plain interstitial fills the seam.

         This replaced `rewardedInterstitialEveryNChambers: 4`, which
         could almost never fire: both formats counted off the one shared
         chambersSinceAd, and the plain interstitial (every 2) reset it
         before it could reach 4. 2 here keeps the intended pacing — every
         2nd seam ad is every 4th chamber. 0 switches the format off. */
      rewardedInterstitialEveryNthAd: 2,
      rewardedInterstitialHints: 1,

      /* ---- App open ----
         Only when the player RETURNS to the app after being away at least
         minBackgroundMs — never on a cold start, and never over a chamber
         in progress: a return into a chamber waits for the rooms menu,
         and is dropped altogether if the menu does not come up within
         pendingMaxMs (an "app open" ad ten minutes after the app opened
         is just an unannounced interstitial). Shares the interstitial
         cooldown clock, so it can never land right after a seam ad, nor a
         seam ad right after it. */
      appOpen: {
        enabled: true,
        minBackgroundMs: 30 * 1000,
        pendingMaxMs: 2 * 60 * 1000
      },

      /* ---- Native ----
         A compact native card (NativeAdPlugin.java) in the win card's
         reserved slot, under the buttons. enabled:false (or a blank
         nativeId) is the kill switch — the slot simply stays collapsed. */
      native: {
        enabled: true
      }
    },

    /* ---------------- Hint economy ---------------- */
    hints: {
      starting: 5,
      /* Awarded the FIRST time each chamber is escaped, never on a
         replay — otherwise chamber I becomes a hint farm. */
      perChamberFirstClear: 1,
      rewardedAdHints: 2,
      /* Claimable from the rooms menu once per CALENDAR day (the device's
         local date), which is also what the reminder notification is
         about. Small on purpose: it is a reason to open the game, not a
         replacement for the hint pack. */
      dailyFree: 1
    },

    /* ---------------- Daily chamber ----------------
       One extra chamber per calendar day, built by the same generator as
       the numbered chambers from a seed derived from the date — so everyone gets the
       same room on the same day, and tomorrow's is a different one. It
       pays the same first-clear hint (once per day) and uses the same ad
       seam.

       tiers[] is indexed by day-number % 7 and is the HARDEST the day's
       chamber may be; it is capped at the highest tier the player has
       reached in the numbered chambers, so a new player's first daily never
       drops a sigil lock on someone who has not yet met a drawer. */
    daily: {
      enabled: true,
      tiers: [3, 4, 2, 5, 3, 4, 5]
    },

    /* ---------------- Skip chamber ----------------
       A stuck player is a player about to uninstall. Once a chamber has
       run afterSeconds on its clock — or every rung of the key-hunt hint
       ladder has been used — a "skip" offer appears: a rewarded video, or
       hintCost hints (the only route for a Remove Ads owner, who has no
       videos). A skipped chamber is marked escaped with ONE star, pays no
       first-clear hint, and unlocks the next. The daily chamber cannot be
       skipped: there is nothing behind it to unlock. */
    skip: {
      enabled: true,
      afterSeconds: 240,
      hintCost: 3
    },

    /* ---------------- Reminder notification ----------------
       ONE local notification, re-armed every time the game is used, for
       afterHours after the last play. Permission is requested only when
       the player first claims a daily hint — never at launch — and a "no"
       is final unless they switch it on themselves in Hints & extras. */
    notify: {
      enabled: true,
      afterHours: 24,
      id: 1001,
      title: 'Your free hint is ready',
      body: 'Claim it on the rooms menu — today’s daily chamber is waiting too.'
    },

    /* ---------------- More games ----------------
       Cross-promotion panel on the rooms menu. `live:false` hides an
       entry completely (a store link to an unpublished app is a 404).
       Icons are 144px copies of each game's Play icon in www/img/. */
    moreGames: [
      { name: 'Frost Tower', pkg: 'com.ahmadessam.frosttower',
        tagline: 'Climb the ice. One slip and it is a long way down.',
        icon: 'img/more-frosttower.png', live: true },
      { name: 'Adaptive Chess', pkg: 'com.ahmadessam.adaptivechess',
        tagline: 'A chess opponent that plays at exactly your level.',
        icon: 'img/more-adaptivechess.png', live: true },
      /* Shown since 2026-10-14 (Trap Jam production release prepared the
         same day). */
      { name: 'Trap Jam', pkg: 'com.ahmadessam.trapjam',
        tagline: 'Every level lies to you. Jump anyway.',
        icon: 'img/more-trapjam.png', live: true }
    ]
  };

  /* ---------------- App Store ids (iOS) ----------------
     The numeric "Apple ID" App Store Connect shows under App Information
     for each app. A store link on iOS can only be built from it, so while
     an entry is still an IOS_TODO placeholder, that game is hidden from
     the iOS "More games" panel and (for this game's own entry) the rating
     prompt never shows on iOS. Android ignores this table. */
  Config.appStoreIds = {
    'com.ahmadessam.escapechambers': '6824664816',
    'com.ahmadessam.frosttower': '6824664822',
    'com.ahmadessam.adaptivechess': '6824666389',
    'com.ahmadessam.trapjam': '6824664950'
  };

  Config.isNative = function () {
    return !!(global.Capacitor &&
              global.Capacitor.isNativePlatform &&
              global.Capacitor.isNativePlatform());
  };

  /* 'android' | 'ios' | 'web'. The browser preview and the e2e suite are
     'web' and keep the Android (Google Play) behaviour. */
  Config.platform = function () {
    var C = global.Capacitor;
    return (C && C.getPlatform) ? C.getPlatform() : 'web';
  };
  Config.isIOS = function () { return Config.platform() === 'ios'; };

  /* The ad unit to use for `key` on this platform. */
  Config.adUnit = function (key) {
    var src = Config.isIOS() ? (Config.admob.ios || {}) : Config.admob;
    var id = src[key] || '';
    return (typeof id === 'string') ? id.trim() : '';
  };

  /* RevenueCat public key for this platform; '' (fail closed) while a
     key is missing or still a placeholder. */
  Config.revenueCatKey = function () {
    var k = Config.isIOS() ? Config.revenueCat.iosApiKey : Config.revenueCat.androidApiKey;
    k = (k || '').trim();
    return /^IOS_TODO/.test(k) ? '' : k;
  };

  /* The id the store knows product `id` by on this platform. Identity
     everywhere but iOS, so Play is sent exactly what it always was. */
  Config.storeProductId = function (id) {
    var map = Config.isIOS() ? (Config.iosProductIds || {}) : {};
    return map[id] || id;
  };

  /* The reverse: a store product identifier back to the id the game uses. */
  Config.productIdFromStore = function (sid) {
    var map = Config.isIOS() ? (Config.iosProductIds || {}) : {};
    for (var id in map) {
      if (map.hasOwnProperty(id) && map[id] === sid) return id;
    }
    return sid;
  };

  function appStoreId(pkg) {
    var id = Config.appStoreIds[pkg] || '';
    return /^\d+$/.test(id) ? id : '';
  }

  /* Can this platform link to pkg's store page? Always true off iOS. */
  Config.hasStorePage = function (pkg) {
    return !Config.isIOS() || !!appStoreId(pkg);
  };

  /* Store page for pkg on this platform, or '' when there is none yet.
     review=true opens the App Store's "write a review" sheet on iOS. */
  Config.storeUrl = function (pkg, review) {
    if (Config.isIOS()) {
      var id = appStoreId(pkg);
      return id ? 'itms-apps://apps.apple.com/app/id' + id + (review ? '?action=write-review' : '') : '';
    }
    return 'https://play.google.com/store/apps/details?id=' + pkg;
  };

  /* "Google Play" / "the App Store", for UI copy. */
  Config.storeName = function () {
    return Config.isIOS() ? 'the App Store' : 'Google Play';
  };

  global.ECConfig = Config;
})(window);
