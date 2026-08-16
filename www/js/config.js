/* =====================================================================
   Escape: 20 Chambers — monetization configuration
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
    /* MUST be bumped alongside android/app/build.gradle. It is shown on the
       rooms menu so a tester can say which build they are on — without it,
       "purchases don't work" is indistinguishable from "you are still
       running last week's APK", which cost a full debugging round. */
    build: '1.1.2 (5)',

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
      // These are live units, not Google's test ones.
      isTest: false,

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
      androidApiKey: 'goog_GdqWuAnFGZXdSJqvndlXrAeqtNP'
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
      hints_unlimited:  { price: '$4.99', label: 'Never run out', consumable: false }
    },

    /* ---------------- Ad pacing ----------------
       An escape room is a slow, concentrated puzzle. An interstitial
       mid-chamber would be indefensible, so ads only ever appear on the
       seam between chambers, after the win card is dismissed. */
    ads: {
      /* Raised from every 2nd chamber to every chamber on 2026-08-16, at
         the owner's request, to lift ad revenue. The two guards below are
         what keep that from becoming abusive, and they are NOT optional:
         together they mean a player who is genuinely progressing sees an
         ad on the seam after each chamber, while someone replaying short
         solved chambers to farm hints does not get one every ten seconds. */
      interstitialEveryNChambers: 1,
      interstitialCooldownMs: 45 * 1000,
      /* A chamber must have taken at least this long to count toward the
         cadence. Without it, replaying an already-solved tier-1 chamber
         (which takes ~10 seconds once you know where the key is) would
         speed-run the player straight into an ad every time. */
      minChamberSecondsForAd: 12
    },

    /* ---------------- Hint economy ---------------- */
    hints: {
      starting: 5,
      /* Awarded the FIRST time each chamber is escaped, never on a
         replay — otherwise chamber I becomes a hint farm. */
      perChamberFirstClear: 1,
      rewardedAdHints: 2
    }
  };

  Config.isNative = function () {
    return !!(global.Capacitor &&
              global.Capacitor.isNativePlatform &&
              global.Capacitor.isNativePlatform());
  };

  global.ECConfig = Config;
})(window);
