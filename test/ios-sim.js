/* =====================================================================
   Escape Chambers — iOS-path suite (iPhone 15 viewport, getPlatform() = 'ios')
   ---------------------------------------------------------------------
   The e2e suite runs the browser build, where every ad, notification and
   analytics entry point no-ops by design. This one loads the SAME www/
   with a fake `window.Capacitor` injected before any script runs, so the
   game believes it is on a device and takes its native paths against
   fake AdMob / ECNativeAd / App / LocalNotifications / FirebaseAnalytics /
   Preferences / Purchases plugins that record every call.

   It proves the things only a device could otherwise show:
     - the banner appears once Ads.init resolves, if the menu is still up;
     - Remove ads silences every format, the two new ones included, and
       nothing is even preloaded for an owner;
     - the seam alternates plain / rewarded interstitial through the real
       win card, and a rewarded ad CLOSED EARLY no longer strands the seam
       or freezes the shop;
     - app open: never cold, only after 30 s away, never over a chamber,
       shares the full-screen cooldown;
     - the native card is placed on the win card and released after it;
     - skip-by-video; the notification permission is asked only on the
       first daily-hint claim and a refusal is final;
     - the shop works while billing hangs; analytics reaches the plugin;
     - the App Store id of Remove Ads (escapechambers_remove_ads) is used
       at the store boundary only, and Android still sends remove_ads.

   The fakes follow the real plugin's contract where it matters — most of
   all that showRewardVideoAd()/showRewardInterstitialAd() resolve ONLY
   when a reward is earned and stay pending for ever otherwise.

       node test/native-sim.js
   ===================================================================== */
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'www');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
                '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
                '.png': 'image/png' };

let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  [' + detail + ']' : '')); }
}

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel === '/') rel = '/index.html';
      const file = path.join(ROOT, path.normalize(rel).replace(/^([/\\])+/, ''));
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404).end(); return; }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
                             'Cache-Control': 'no-store' });
        res.end(buf);
      });
    });
    server.listen(0, () => resolve({ server, port: server.address().port }));
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* Runs in the page BEFORE any of the game's scripts. Options come from
   localStorage['sim.opts'] so each scenario can set them before a reload. */
function installFakes() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem('sim.opts') || '{}'); } catch (e) {}
  const calls = [];
  const L = {};                       // AdMob listeners by event name
  const appL = {};                    // App listeners: name -> [fn]
  const emit = (n, d) => { if (L[n]) L[n](d || {}); };
  const later = (ms, f) => setTimeout(f, ms);
  const sim = window.__sim = {
    calls, L, appL, emit,
    rewardMode: 'earn',               // 'earn' | 'close'
    perm: o.perm || 'prompt',         // what checkPermissions reports
    permAfter: o.permAfter || 'granted',  // what the dialog answers
    fireApp: (n, d) => (appL[n] || []).forEach(f => f(d)),
    count: p => calls.filter(c => c === p || c.indexOf(p + ':') === 0).length
  };

  const rewarded = (prefix, showName) => () => new Promise(resolve => {
    calls.push(showName);
    later(10, () => {
      emit(prefix + 'Showed');
      later(o.adMs || 30, () => {
        if (sim.rewardMode === 'earn') {
          emit(prefix + 'Reward', { type: 'hint', amount: 1 });
          resolve({ type: 'hint', amount: 1 });
        }
        /* closed early: the real plugin never settles this promise */
        later(5, () => emit(prefix + 'Dismissed'));
      });
    });
  });

  const AdMob = {
    requestConsentInfo: async () => ({ status: 'NOT_REQUIRED', canRequestAds: true }),
    initialize: () => new Promise(r => later(o.initDelay || 0, () => { calls.push('initialize'); r(); })),
    addListener: (n, f) => { L[n] = f; },
    prepareInterstitial: async a => { calls.push('prepareInterstitial:' + a.adId); },
    prepareRewardVideoAd: async a => { calls.push('prepareRewardVideoAd:' + a.adId); },
    prepareRewardInterstitialAd: async a => { calls.push('prepareRewardInterstitialAd:' + a.adId); },
    showInterstitial: async () => {
      calls.push('showInterstitial');
      later(10, () => { emit('interstitialAdShowed');
                        /* sim.lateFail: the SDK's own show timeout (seen on a
                           slow emulator) reports FailedToShow AFTER Showed
                           while the ad stays on screen. */
                        if (sim.lateFail) later(10, () => emit('interstitialAdFailedToShow',
                          { code: 0, message: 'Timeout for show call succeed.' }));
                        later(sim.lateFail ? 400 : (o.adMs || 30), () => emit('interstitialAdDismissed')); });
    },
    showRewardVideoAd: rewarded('onRewardedVideoAd', 'showRewardVideoAd'),
    showRewardInterstitialAd: rewarded('onRewardedInterstitialAd', 'showRewardInterstitialAd'),
    loadAppOpen: async a => { calls.push('loadAppOpen:' + a.adId); },
    showAppOpen: () => new Promise(r => {
      calls.push('showAppOpen');
      later(20, () => { emit('appOpenAdClosed'); r(); });
    }),
    showBanner: async a => { calls.push('showBanner:' + a.adId); },
    hideBanner: async () => { calls.push('hideBanner'); },
    resumeBanner: async () => { calls.push('resumeBanner'); },
    removeBanner: async () => { calls.push('removeBanner'); },
    trackingAuthorizationStatus: async () => { calls.push('att.status'); return { status: 'notDetermined' }; },
    requestTrackingAuthorization: async () => { calls.push('att.request'); }
  };
  const ECNativeAd = {
    load: async a => { calls.push('native.load:' + a.adId); return { loaded: true }; },
    show: async r => { calls.push('native.show:' + [r.x, r.y, r.width, r.height].map(Math.round).join(','));
                       return { shown: true }; },
    hide: async () => { calls.push('native.hide'); return { hidden: true }; },
    destroy: async () => { calls.push('native.destroy'); return {}; }
  };
  const App = {
    addListener: (n, f) => { (appL[n] = appL[n] || []).push(f); },
    exitApp: () => { calls.push('exitApp'); }
  };
  const Preferences = {
    get: async a => ({ value: localStorage.getItem('pref:' + a.key) }),
    set: async a => { localStorage.setItem('pref:' + a.key, a.value); }
  };
  const LocalNotifications = {
    checkPermissions: async () => { calls.push('notif.check'); return { display: sim.perm }; },
    requestPermissions: async () => { calls.push('notif.request'); sim.perm = sim.permAfter;
                                      return { display: sim.perm }; },
    schedule: async a => { calls.push('notif.schedule:' + JSON.stringify(a.notifications[0])); return {}; },
    cancel: async a => { calls.push('notif.cancel:' + a.notifications[0].id); }
  };
  const FirebaseAnalytics = {
    logEvent: async a => { calls.push('fa:' + a.name + ':' + JSON.stringify(a.params)); }
  };
  const StoreReview = { requestReview: async () => { calls.push('storeReview'); return { requested: true }; } };
  const Plugins = { AdMob, ECNativeAd, App, Preferences, LocalNotifications, FirebaseAnalytics, StoreReview };
  if (o.billingHang) {
    Plugins.Purchases = {
      configure: () => { calls.push('purchases.configure'); },
      getCustomerInfo: () => new Promise(() => {}),       // offline: never answers
      getOfferings: () => new Promise(() => {}),
      restorePurchases: () => new Promise(() => {})
    };
  }
  /* The rating prompt would take the seam instead of the ad. */
  if (!o.rateLive && !localStorage.getItem('pref:rate_prompt_v1')) {
    const never = JSON.stringify({ count: 0, rated: false, never: true, shown: 0, laters: 0 });
    localStorage.setItem('pref:rate_prompt_v1', never);
    localStorage.setItem('rate_prompt_v1', never);
  }
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins };
}

(async () => {
  const { server, port } = await startServer();
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148');
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.evaluateOnNewDocument(installFakes);
  const url = `http://127.0.0.1:${port}/index.html`;
  const fresh = async (opts) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.evaluate(o => { localStorage.clear(); localStorage.setItem('sim.opts', JSON.stringify(o || {})); }, opts || {});
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await sleep(700);
  };
  const calls = () => page.evaluate(() => window.__sim.calls.slice());
  const shown = id => page.evaluate(i => document.getElementById(i).classList.contains('show'), id);
  const shot = n => page.screenshot({ path: path.join(process.env.SHOT_DIR || '.', n) });
  try {
    console.log('\n-- boot on iOS --');
    await fresh();
    const cfg = await page.evaluate(() => ({ ios: window.ECConfig.isIOS(), ad: window.ECConfig.admob.ios, android: window.ECConfig.admob }));
    ok('the game sees iOS', cfg.ios);
    let c = await calls();
    ok('tracking (ATT) asked before the ad SDK starts',
       c.indexOf('att.request') >= 0 && c.indexOf('att.request') < c.indexOf('initialize'), JSON.stringify(c));
    ok('banner uses the iOS ad unit', c.includes('showBanner:' + cfg.ad.bannerId), JSON.stringify(c));
    // Same publisher on both platforms, so compare against the Android UNIT ids, not the prefix.
    const androidUnits = Object.keys(cfg.android).filter(k => /Id$/.test(k) && k !== 'appId').map(k => cfg.android[k]);
    ok('no Android ad unit is ever requested', androidUnits.length >= 6 && !c.some(x => androidUnits.some(u => x.includes(u))), JSON.stringify(c));
    ok('no Google test unit is requested on iOS', !c.some(x => /3940256099942544/.test(x)));
    ok('native ad preloaded with the iOS unit', c.includes('native.load:' + cfg.ad.nativeId));
    ok('menu is up', await shown('menu'));
    ok('"More games" shown now that the App Store ids exist',
       await page.evaluate(() => document.getElementById('moreBtn').style.display !== 'none'));
    const links = await page.evaluate(() => window.ECConfig.moreGames.map(g =>
      [g.pkg, window.ECConfig.hasStorePage(g.pkg), window.ECConfig.storeUrl(g.pkg)]));
    const wantIds = { 'com.ahmadessam.frosttower': '6824664822', 'com.ahmadessam.adaptivechess': '6824666389',
                      'com.ahmadessam.trapjam': '6824664950' };
    ok('every sibling links to its App Store page',
       links.length === 3 && links.every(([pkg, has, u]) => has && u === 'itms-apps://apps.apple.com/app/id' + wantIds[pkg]),
       JSON.stringify(links));
    ok('own review link uses the App Store id',
       await page.evaluate(() => window.ECConfig.storeUrl('com.ahmadessam.escapechambers', true)) ===
         'itms-apps://apps.apple.com/app/id6824664816?action=write-review');
    await shot('escape-ios-menu.png');

    console.log('\n-- win card with native ad --');
    const won = await page.evaluate(() => {
      window.ECGame.startLevel(0);
      const spot = window.ECPuzzle.solveKeyHunt(window.ECGame.state().hunt.evidence);
      document.getElementById(spot).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      for (let i = 0; i < 4; i++) { const sl = document.getElementById('s' + i); if (sl.dataset.item === 'ironKey') sl.click(); }
      document.getElementById('door').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    });
    await sleep(600);
    ok('chamber I escaped, win card up', won && await shown('winOv'));
    c = await calls();
    ok('native card placed on the win card', c.some(x => x.indexOf('native.show:') === 0), JSON.stringify(c));
    await shot('escape-ios-win.png');

    console.log('\n-- rating: native review instead of the custom dialog --');
    await fresh({ rateLive: true });
    const r = await page.evaluate(async () => {
      const R = window.RatePrompt; R._reset(); R.tick(); R.tick();
      let choice = null;
      const shownNow = R.maybeShow(ch => { choice = ch; });
      await new Promise(res => setTimeout(res, 800));
      return { shownNow, choice, dialog: !!document.querySelector('#ratePrompt.show'), st: R._state() };
    });
    c = await calls();
    ok('due at the same count as Android', r.shownNow === true);
    ok('Apple review sheet requested', c.includes('storeReview'));
    ok('custom dialog NOT drawn', !r.dialog);
    ok('caller continues (choice native)', r.choice === 'native');
    ok('counts as Later, so back-off matches Android', r.st.laters === 1 && r.st.count === 0);
    const again = await page.evaluate(() => { const R = window.RatePrompt; R.tick(); R.tick(); return R.due(); });
    ok('not due again after 2 more (back-off to 5)', again === false);

    console.log('\n-- store product ids: Remove Ads is escapechambers_remove_ads on the App Store --');
    await fresh();
    const ids = await page.evaluate(() => {
      const C = window.ECConfig, out = {};
      for (const os of ['android', 'ios']) {
        window.Capacitor.getPlatform = () => os;
        out[os] = { to: C.storeProductId('remove_ads'), back: C.productIdFromStore('escapechambers_remove_ads'),
                    hints: C.storeProductId('hints_25'), hintsBack: C.productIdFromStore('hints_25') };
      }
      window.Capacitor.getPlatform = () => 'ios';
      return out;
    });
    ok('Android: remove_ads is sent to Play unchanged', ids.android.to === 'remove_ads' &&
       ids.android.back === 'escapechambers_remove_ads' && ids.android.hints === 'hints_25', JSON.stringify(ids.android));
    ok('iOS: remove_ads <-> escapechambers_remove_ads, hints_25 untouched',
       ids.ios.to === 'escapechambers_remove_ads' && ids.ios.back === 'remove_ads' &&
       ids.ios.hints === 'hints_25' && ids.ios.hintsBack === 'hints_25', JSON.stringify(ids.ios));
    /* Re-runs ECBilling.init() against a fake RevenueCat on `os` (the real
       iOS key is not in config.js yet) and records every id the store sees. */
    const storeFlow = os => page.evaluate(async os => {
      const C = window.ECConfig, B = window.ECBilling;
      window.Capacitor.getPlatform = () => os;
      const asked = [], bought = [], paid = [];
      const RA = C.storeProductId('remove_ads');
      window.Capacitor.Plugins.Purchases = {
        configure: () => {},
        getCustomerInfo: async () => ({ customerInfo: { entitlements: { active: {} },
          allPurchasedProductIdentifiers: [RA],
          nonSubscriptionTransactions: [{ productIdentifier: 'hints_25', transactionIdentifier: 'tx-' + os }] } }),
        getOfferings: async () => ({ all: { default: { availablePackages: [
          { product: { identifier: 'hints_25', priceString: 'L$1.99' } }] } } }),
        getProducts: async o => { asked.push(...o.productIdentifiers);
          return { products: o.productIdentifiers.map(i => ({ identifier: i, priceString: 'P:' + i })) }; },
        purchaseStoreProduct: async o => { bought.push(o.product.identifier);
          return { customerInfo: { entitlements: { active: { remove_ads: {} } },
                                   allPurchasedProductIdentifiers: [o.product.identifier] } }; },
        purchasePackage: async o => { bought.push('pkg:' + o.aPackage.product.identifier); return {}; }
      };
      const key = C.revenueCatKey; C.revenueCatKey = () => 'test_key';
      B.entitlements = {}; B.prices = {}; B._packages = {}; B._storeProducts = {};
      const state = await B.init((pid, tid) => { paid.push(pid + ':' + tid); return true; });
      const ownedAtBoot = B.owns('remove_ads'), price = B.prices.remove_ads;
      B._storeProducts = {};            // take the on-demand getProducts path
      const res = await B.purchase('remove_ads');
      C.revenueCatKey = key;
      return { state, asked, bought, paid, ownedAtBoot, price, ok: res.ok,
               owned: Object.keys(B.entitlements) };
    }, os);
    const fa = await storeFlow('android');
    ok('Android flow: Play asked for remove_ads, bought remove_ads, owned as remove_ads',
       fa.state === 'ready' && fa.ok && fa.ownedAtBoot && fa.price === 'P:remove_ads' &&
       JSON.stringify(fa.asked) === JSON.stringify(['remove_ads', 'hints_unlimited', 'remove_ads']) &&
       JSON.stringify(fa.bought) === JSON.stringify(['remove_ads']) &&
       JSON.stringify(fa.owned) === JSON.stringify(['remove_ads']), JSON.stringify(fa));
    const fi = await storeFlow('ios');
    ok('iOS flow: App Store asked for escapechambers_remove_ads (price lookup and purchase)',
       fi.state === 'ready' && fi.ok &&
       JSON.stringify(fi.asked) === JSON.stringify(['escapechambers_remove_ads', 'hints_unlimited', 'escapechambers_remove_ads']) &&
       JSON.stringify(fi.bought) === JSON.stringify(['escapechambers_remove_ads']), JSON.stringify(fi));
    ok('iOS flow: price, restore-at-boot and the purchase all land on remove_ads',
       fi.price === 'P:escapechambers_remove_ads' && fi.ownedAtBoot &&
       JSON.stringify(fi.owned) === JSON.stringify(['remove_ads']), JSON.stringify(fi));
    ok('iOS flow: hint pack transaction still paid out once as hints_25',
       JSON.stringify(fi.paid) === JSON.stringify(['hints_25:tx-ios']), JSON.stringify(fi.paid));

    console.log('\n-- shop on iOS (no RevenueCat iOS key yet) --');
    await fresh();
    await page.evaluate(() => document.getElementById('shopBtn') && document.getElementById('shopBtn').click());
    await sleep(300);
    await shot('escape-ios-shop.png');
    ok('no page errors', errors.length === 0, errors.join(' | '));
  } catch (e) { failed++; console.log('  FAIL  exception: ' + e.stack); }
  await browser.close(); server.close();
  console.log(`\n  ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();