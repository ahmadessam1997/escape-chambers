/* =====================================================================
   Escape Chambers — native-path suite
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
     - the shop works while billing hangs; analytics reaches the plugin.

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
    removeBanner: async () => { calls.push('removeBanner'); }
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
  const Plugins = { AdMob, ECNativeAd, App, Preferences, LocalNotifications, FirebaseAnalytics };
  if (o.billingHang) {
    Plugins.Purchases = {
      configure: () => { calls.push('purchases.configure'); },
      getCustomerInfo: () => new Promise(() => {}),       // offline: never answers
      getOfferings: () => new Promise(() => {}),
      restorePurchases: () => new Promise(() => {})
    };
  }
  /* The rating prompt would take the seam instead of the ad. */
  if (!localStorage.getItem('pref:rate_prompt_v1')) {
    const never = JSON.stringify({ count: 0, rated: false, never: true, shown: 0, laters: 0 });
    localStorage.setItem('pref:rate_prompt_v1', never);
    localStorage.setItem('rate_prompt_v1', never);
  }
  window.Capacitor = { isNativePlatform: () => true, Plugins };
}

(async () => {
  const { server, port } = await startServer();
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.evaluateOnNewDocument(installFakes);

  const url = `http://127.0.0.1:${port}/index.html`;
  /* fresh(opts, save): wipe everything, optionally seed a save file, boot. */
  const fresh = async (opts, save, settle) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.evaluate((o, s) => {
      localStorage.clear();
      localStorage.setItem('sim.opts', JSON.stringify(o || {}));
      if (s) localStorage.setItem('pref:ec.save', JSON.stringify(s));
    }, opts || {}, save || null);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await sleep(settle === undefined ? 500 : settle);
  };
  const reload = async () => { await page.goto(url, { waitUntil: 'domcontentloaded' }); await sleep(500); };
  const calls = () => page.evaluate(() => window.__sim.calls.slice());
  const count = p => page.evaluate(x => window.__sim.count(x), p);
  const clear = () => page.evaluate(() => { window.__sim.calls.length = 0; });
  const click = id => page.evaluate(i => document.getElementById(i).click(), id);
  const shown = id => page.evaluate(i => document.getElementById(i).classList.contains('show'), id);
  const cfg = await (async () => { await fresh(); return page.evaluate(() => window.ECConfig); })();

  /* Win chamber I (tier 1) the way a player does: deduce the spot from
     the published evidence, take the key, open the door. */
  const winChamber1 = async () => {
    await page.evaluate(() => {
      window.ECGame.startLevel(0);
      const spot = window.ECPuzzle.solveKeyHunt(window.ECGame.state().hunt.evidence);
      document.getElementById(spot).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      for (let i = 0; i < 4; i++) {
        const sl = document.getElementById('s' + i);
        if (sl.dataset.item === 'ironKey') sl.click();
      }
      document.getElementById('door').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await sleep(50);
    return shown('winOv');
  };
  /* Background the app for `ms` (by back-dating the stamp), then return. */
  const awayFor = async ms => {
    await page.evaluate(m => {
      window.__sim.fireApp('appStateChange', { isActive: false });
      if (window.ECAds._backgroundAt) window.ECAds._backgroundAt -= m;
      window.__sim.fireApp('appStateChange', { isActive: true });
    }, ms);
    await sleep(60);
  };

  try {
    /* ============ E2: the banner on the first menu ============ */
    console.log('\n-- banner once Ads.init resolves --');
    await fresh({ initDelay: 500 }, null, 200);
    ok('the game sees a native platform', await page.evaluate(() => window.ECConfig.isNative()));
    ok('the menu is up before the ad SDK is', await shown('menu') &&
       !(await page.evaluate(() => window.ECAds.available)));
    ok('no banner while the SDK is still initialising', (await count('showBanner')) === 0);
    await sleep(800);
    ok('the banner is shown once init completes, with the menu still up',
       (await count('showBanner')) === 1 &&
       (await calls()).includes('showBanner:' + cfg.admob.bannerId), JSON.stringify(await calls()));

    await fresh({ initDelay: 500 }, null, 150);
    await page.evaluate(() => window.ECGame.startLevel(0));
    await sleep(900);
    ok('no banner lands on a chamber opened while the SDK was starting',
       (await count('showBanner')) === 0, JSON.stringify(await calls()));
    await page.evaluate(() => window.ECGame.showMenu());
    await sleep(60);
    ok('the banner comes with the next menu', (await count('showBanner')) === 1);
    /* The banner floats over the bottom of the page; the dialogs must keep
       out from under it (seen on the emulator: it reached "More games"). */
    ok('while the banner is up the page reserves room for it',
       await page.evaluate(() => document.body.classList.contains('bannerUp') &&
         parseFloat(getComputedStyle(document.getElementById('menu')).paddingBottom) >= 60));
    await page.evaluate(() => window.ECGame.startLevel(0));
    await sleep(60);
    ok('and is hidden again when a chamber starts', (await count('hideBanner')) >= 1);
    ok('…and the reserved room is given back',
       await page.evaluate(() => !document.body.classList.contains('bannerUp')));

    /* ============ preloads, and the new formats' unit ids ============ */
    console.log('\n-- preloads --');
    await fresh();
    let c = await calls();
    ok('app open is preloaded with its configured unit',
       c.includes('loadAppOpen:' + cfg.admob.appOpenId), JSON.stringify(c));
    ok('native is preloaded with its configured unit',
       c.includes('native.load:' + cfg.admob.nativeId));
    ok('interstitial, rewarded and rewarded interstitial are preloaded',
       c.includes('prepareInterstitial:' + cfg.admob.interstitialId) &&
       c.includes('prepareRewardVideoAd:' + cfg.admob.rewardedId) &&
       c.includes('prepareRewardInterstitialAd:' + cfg.admob.rewardedInterstitialId));
    ok('no Google test unit id is configured',
       !Object.values(cfg.admob).some(v => typeof v === 'string' && v.indexOf('3940256099942544') >= 0));

    /* ============ app open ============ */
    console.log('\n-- app open --');
    ok('never on a cold start', (await count('showAppOpen')) === 0);
    await awayFor(10 * 1000);
    ok('not after a short absence', (await count('showAppOpen')) === 0);
    await awayFor(31 * 1000);
    ok('shown on return to the menu after 30 s away', (await count('showAppOpen')) === 1);
    ok('ad_shown app_open reaches analytics',
       (await calls()).some(x => x.indexOf('fa:ad_shown:') === 0 && x.indexOf('app_open') > 0));
    await sleep(80);
    ok('the next one is preloaded after it closes', (await count('loadAppOpen')) === 2);
    await awayFor(31 * 1000);
    ok('a second return inside the shared cooldown shows nothing',
       (await count('showAppOpen')) === 1);

    await page.evaluate(() => { window.ECAds._lastInterstitialAt = 0; window.ECGame.startLevel(0); });
    await awayFor(31 * 1000);
    ok('never over a chamber in progress', (await count('showAppOpen')) === 1);
    await page.evaluate(() => window.ECGame.showMenu());
    await sleep(60);
    ok('it waits for the rooms menu instead', (await count('showAppOpen')) === 2);

    await page.evaluate(() => { window.ECAds._lastInterstitialAt = 0; window.ECGame.startLevel(0); });
    await sleep(80);
    await awayFor(31 * 1000);
    await page.evaluate(() => { window.ECAds._appOpenPendingAt -= window.ECConfig.ads.appOpen.pendingMaxMs + 1000;
                                window.ECGame.showMenu(); });
    await sleep(60);
    ok('a return into a long chamber does not end in a stale app-open ad',
       (await count('showAppOpen')) === 2);

    await page.evaluate(() => { window.ECAds._lastInterstitialAt = 0; window.ECAds.noteHandoff(); });
    await awayFor(31 * 1000);
    ok('a trip we started (store, purchase, permission) is not time away',
       (await count('showAppOpen')) === 2);

    await page.evaluate(() => { window.ECAds._lastInterstitialAt = 0;
                                document.getElementById('shopBtn').click(); });
    await awayFor(31 * 1000);
    ok('not over a dialog stacked on the menu', (await count('showAppOpen')) === 2);
    await click('shopClose');

    /* ============ native card on the win card ============ */
    console.log('\n-- native card --');
    await fresh();
    await clear();
    ok('chamber I won', await winChamber1());
    await sleep(400);
    c = await calls();
    const rect = await page.evaluate(() => {
      const r = document.getElementById('nativeSlot').getBoundingClientRect();
      return [r.left, r.top, r.width, r.height].map(Math.round).join(',');
    });
    ok('the native card is placed exactly over the win card’s slot',
       c.includes('native.show:' + rect) && /,84$/.test(rect), rect + ' ' + JSON.stringify(c));
    ok('the slot sits below both buttons',
       await page.evaluate(() => document.getElementById('nativeSlot').getBoundingClientRect().top >
                                 document.getElementById('backBtn').getBoundingClientRect().bottom + 10));
    ok('no banner on the win card', !c.some(x => x.indexOf('showBanner') === 0));
    ok('ad_shown native reaches analytics', c.some(x => x.indexOf('fa:ad_shown:') === 0 && x.indexOf('native') > 0));
    await clear();
    await click('backBtn');
    await sleep(120);
    c = await calls();
    ok('leaving the card destroys the native ad and loads the next',
       c.includes('native.destroy') && c.some(x => x.indexOf('native.load:') === 0), JSON.stringify(c));
    ok('the slot is collapsed again',
       await page.evaluate(() => document.getElementById('nativeSlot').classList.contains('hidden')));

    /* ============ the seam, through the real win card ============ */
    console.log('\n-- seam ads --');
    const seamRun = async (since, shownSoFar, mode) => {
      await winChamber1();
      await page.evaluate((s, n, m) => {
        window.ECSave.data.chambersSinceAd = s;
        window.ECSave.data.seamAdsShown = n;
        window.ECAds._lastInterstitialAt = 0;
        window.__sim.rewardMode = m || 'earn';
        window.__sim.calls.length = 0;
      }, since, shownSoFar, mode);
      const h0 = await page.evaluate(() => window.ECSave.data.hints);
      await click('backBtn');
      await sleep(250);
      return page.evaluate(h => ({
        calls: window.__sim.calls.slice(), menu: document.getElementById('menu').classList.contains('show'),
        since: window.ECSave.data.chambersSinceAd, n: window.ECSave.data.seamAdsShown,
        dHints: window.ECSave.data.hints - h }), h0);
    };
    let r = await seamRun(1, 0);
    ok('no seam ad below the chamber cadence',
       !r.calls.includes('showInterstitial') && !r.calls.includes('showRewardInterstitialAd') &&
       r.menu && r.since === 1);
    r = await seamRun(2, 0);
    ok('1st seam ad is the plain interstitial',
       r.calls.includes('showInterstitial') && !r.calls.includes('showRewardInterstitialAd'));
    ok('the game carries on after it closes and the counters are spent',
       r.menu && r.since === 0 && r.n === 1, JSON.stringify(r));
    r = await seamRun(2, 1);
    ok('2nd seam ad is the REWARDED interstitial (it never used to fire)',
       r.calls.includes('showRewardInterstitialAd') && !r.calls.includes('showInterstitial'),
       JSON.stringify(r.calls));
    ok('watching it pays the hint and the game carries on',
       r.menu && r.dHints === cfg.ads.rewardedInterstitialHints && r.since === 0 && r.n === 2,
       JSON.stringify(r));
    ok('rewarded_done seam reaches analytics',
       r.calls.some(x => x.indexOf('fa:rewarded_done:') === 0 && x.indexOf('seam') > 0));
    r = await seamRun(2, 1, 'close');
    ok('a rewarded interstitial CLOSED EARLY still releases the seam',
       r.calls.includes('showRewardInterstitialAd') && r.menu, JSON.stringify(r));
    ok('closed early pays nothing but still counts as the seam ad',
       r.dHints === 0 && r.since === 0 && r.n === 2);
    r = await seamRun(2, 2);
    ok('3rd seam ad is plain again', r.calls.includes('showInterstitial'));
    /* 1.7.0 emulator check: FailedToShow arrived after Showed with the ad
       still up, and the next chamber's clock started behind it. */
    await winChamber1();
    await page.evaluate(() => {
      window.ECSave.data.chambersSinceAd = 2; window.ECSave.data.seamAdsShown = 0;
      window.ECAds._lastInterstitialAt = 0; window.__sim.lateFail = true; window.__sim.calls.length = 0;
    });
    await click('backBtn');
    await sleep(150);
    const midAd = await page.evaluate(() => ({ shown: window.__sim.calls.includes('showInterstitial'),
      menu: document.getElementById('menu').classList.contains('show') }));
    ok('a "failed to show" AFTER the ad showed does not end the seam behind the ad',
       midAd.shown && !midAd.menu, JSON.stringify(midAd));
    await sleep(500);
    ok('…the game carries on once that ad is dismissed', await shown('menu'));
    await page.evaluate(() => { window.__sim.lateFail = false; });
    await winChamber1();
    await page.evaluate(() => { window.ECSave.data.chambersSinceAd = 5; window.__sim.calls.length = 0; });
    await click('backBtn');
    await sleep(150);
    ok('no second full-screen ad inside the cooldown',
       !(await calls()).some(x => /^show(Interstitial|RewardInterstitialAd)/.test(x)));

    /* ============ rewarded video closed early ============ */
    console.log('\n-- rewarded video --');
    await fresh();
    await page.evaluate(() => { window.__sim.rewardMode = 'close'; window.ECShop.openShop(); });
    const hv0 = await page.evaluate(() => window.ECSave.data.hints);
    ok('the shop offers the video', await page.evaluate(() =>
       document.getElementById('shopWatch').style.display !== 'none'));
    await click('shopWatch');
    await sleep(250);
    ok('a video closed early pays nothing',
       (await page.evaluate(() => window.ECSave.data.hints)) === hv0);
    ok('…and does NOT freeze the shop behind its busy flag',
       await page.evaluate(() => window.ECShop._busy === false));
    await page.evaluate(() => { window.__sim.rewardMode = 'earn'; window.ECAds._rewardedReady = true; });
    await click('shopWatch');
    await sleep(250);
    ok('a video watched to the end pays the hints',
       (await page.evaluate(() => window.ECSave.data.hints)) === hv0 + cfg.hints.rewardedAdHints);
    ok('rewarded_done hints reaches analytics',
       (await calls()).some(x => x.indexOf('fa:rewarded_done:') === 0 && x.indexOf('hints') > 0));
    await click('shopClose');

    /* ============ skip by video ============ */
    console.log('\n-- skip chamber by video --');
    await fresh(null, { unlocked: 3, done: [0, 1], hints: 5 });
    await page.evaluate(() => { window.ECGame.startLevel(2); window.ECGame._setClock(240); });
    await click('skipBtn');
    ok('the skip dialog leads with the video', await page.evaluate(() =>
       document.getElementById('skipWatch').style.display !== 'none' &&
       document.getElementById('skipHints').className.indexOf('ghostb') >= 0));
    await page.evaluate(() => { window.__sim.rewardMode = 'close'; });
    await click('skipWatch');
    await sleep(250);
    ok('a skip video closed early does not skip',
       await page.evaluate(() => window.ECGame.state().cur === 2 && !window.ECSave.isDone(2)));
    await page.evaluate(() => { window.__sim.rewardMode = 'earn'; window.ECAds._rewardedReady = true;
                                document.getElementById('skipOv').classList.remove('show'); });
    await click('skipBtn');
    await click('skipWatch');
    await sleep(250);
    const sv = await page.evaluate(() => ({
      done: window.ECSave.isDone(2), stars: (window.ECSave.bestFor(2) || {}).stars,
      cur: window.ECGame.state().cur, hints: window.ECSave.data.hints,
      unlocked: window.ECSave.data.unlocked }));
    ok('the video skips the chamber: escaped, one star, next one open, no hints spent',
       sv.done && sv.stars === 1 && sv.cur === 3 && sv.unlocked >= 4 && sv.hints === 5,
       JSON.stringify(sv));
    c = await calls();
    ok('skip_chamber and rewarded_done skip reach analytics',
       c.some(x => x.indexOf('fa:skip_chamber:') === 0 && x.indexOf('video') > 0) &&
       c.some(x => x.indexOf('fa:rewarded_done:') === 0 && x.indexOf('skip') > 0));

    /* ============ Remove ads silences everything ============ */
    console.log('\n-- Remove ads --');
    await fresh(null, { removeAds: true, unlocked: 3, done: [0, 1], hints: 5 });
    c = await calls();
    ok('an owner is recognised from the save before the store answers',
       await page.evaluate(() => window.ECAds.removeAdsOwned === true));
    ok('nothing is preloaded for an owner — not app open, not native, nothing',
       !c.some(x => /^(prepare|loadAppOpen|native\.load)/.test(x)), JSON.stringify(c));
    ok('no banner for an owner, even after init', !c.some(x => x.indexOf('showBanner') === 0));
    await awayFor(31 * 1000);
    ok('no app-open ad for an owner', (await count('showAppOpen')) === 0);
    await page.evaluate(() => { window.ECAds._nativeReady = true; window.ECAds._appOpenReady = true;
                                window.ECAds._interstitialReady = true;
                                window.ECAds._rewardedInterstitialReady = true;
                                window.ECAds._rewardedReady = true; });
    await awayFor(31 * 1000);
    ok('…not even with one somehow loaded', (await count('showAppOpen')) === 0);
    ok('chamber I won as an owner', await winChamber1());
    await sleep(400);
    ok('no native card for an owner', (await count('native.show')) === 0 &&
       await page.evaluate(() => document.getElementById('nativeSlot').classList.contains('hidden')));
    await page.evaluate(() => { window.ECSave.data.chambersSinceAd = 9; window.ECAds._lastInterstitialAt = 0; });
    await click('backBtn');
    await sleep(150);
    c = await calls();
    ok('no seam ad of either kind for an owner',
       !c.some(x => /^show(Interstitial|RewardInterstitialAd|RewardVideoAd)/.test(x)) && await shown('menu'));
    await page.evaluate(() => { window.ECGame.startLevel(2); window.ECGame._setClock(240); });
    await click('skipBtn');
    ok('an owner is offered the skip for hints, not a video', await page.evaluate(() =>
       document.getElementById('skipWatch').style.display === 'none' &&
       document.getElementById('skipHints').style.display !== 'none' &&
       document.getElementById('skipHints').className === 'btn'));
    ok('the dialog does not blame a missing video on an owner', await page.evaluate(() =>
       !/No video/.test(document.getElementById('skipWhy').textContent)));
    await click('skipClose');

    await fresh();
    await page.evaluate(() => { window.__sim.calls.length = 0; window.ECAds.setRemoveAds(true); });
    await sleep(60);
    c = await calls();
    ok('buying Remove ads takes the banner down at once', c.includes('removeBanner'));
    ok('…and releases the native ad', c.includes('native.destroy'));
    await awayFor(31 * 1000);
    ok('…and no app-open ad follows the purchase', (await count('showAppOpen')) === 0);
    await page.evaluate(() => { window.__sim.calls.length = 0; window.ECAds.setRemoveAds(false); });
    await sleep(60);
    c = await calls();
    ok('a refund re-warms every format',
       c.some(x => x.indexOf('loadAppOpen') === 0) && c.some(x => x.indexOf('native.load') === 0) &&
       c.some(x => x.indexOf('prepareRewardVideoAd') === 0));

    /* ============ notifications ============ */
    console.log('\n-- reminder notification --');
    await fresh({ perm: 'prompt', permAfter: 'granted' });
    c = await calls();
    ok('no permission request at launch', !c.includes('notif.request') && !c.includes('notif.check'));
    ok('nothing is scheduled before the player has been asked',
       !c.some(x => x.indexOf('notif.schedule') === 0));
    await winChamber1();
    await click('backBtn');
    await sleep(100);
    ok('playing does not trigger the request either', (await count('notif.request')) === 0);
    await click('dailyHintBtn');
    await sleep(150);
    c = await calls();
    ok('the first daily-hint claim asks, once', (await count('notif.request')) === 1);
    const sched = c.filter(x => x.indexOf('notif.schedule:') === 0).map(x => JSON.parse(x.slice(15)));
    ok('granted: one reminder is scheduled, with the configured id and text',
       sched.length >= 1 && sched[sched.length - 1].id === cfg.notify.id &&
       sched[sched.length - 1].title === cfg.notify.title, JSON.stringify(sched));
    /* Without this the plugin opens Android's "Alarms & reminders" settings
       screen on every schedule() (seen on the emulator, 1.6.0). */
    ok('every reminder is scheduled as an INEXACT alarm (no settings detour)',
       sched.length >= 1 && sched.every(s => s.isExactNotification === false), JSON.stringify(sched));
    const dueIn = sched.length ? (new Date(sched[sched.length - 1].schedule.at).getTime() - Date.now()) / 3600000 : 0;
    ok('it is due about 24 hours after the last play', dueIn > 23.9 && dueIn < 24.1, String(dueIn));
    ok('daily_hint_claimed reaches analytics', c.some(x => x.indexOf('fa:daily_hint_claimed:') === 0));
    ok('the state is saved as on', await page.evaluate(() => window.ECSave.data.notify === 'on'));
    await page.evaluate(() => { window.__sim.calls.length = 0;
                                window.__sim.fireApp('appStateChange', { isActive: false }); });
    await sleep(60);
    c = await calls();
    ok('leaving the app re-arms the single reminder (cancel, then schedule)',
       c.includes('notif.cancel:' + cfg.notify.id) && c.filter(x => x.indexOf('notif.schedule') === 0).length === 1,
       JSON.stringify(c));
    await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('sim.opts')); o.perm = 'granted';
                                localStorage.setItem('sim.opts', JSON.stringify(o)); });
    await reload();
    c = await calls();
    ok('the next launch re-arms without asking again',
       !c.includes('notif.request') && c.some(x => x.indexOf('notif.schedule') === 0));
    await page.evaluate(() => window.ECShop.openShop());
    ok('the reminder toggle is in Hints & extras, reading on', await page.evaluate(() => {
      const b = document.getElementById('shopNotify');
      return b.style.display !== 'none' && /: on$/.test(b.textContent);
    }));
    await clear();
    await click('shopNotify');
    await sleep(80);
    ok('switching it off cancels the reminder and sticks', await page.evaluate(() =>
       window.ECSave.data.notify === 'off' && /: off$/.test(document.getElementById('shopNotify').textContent)) &&
       (await calls()).includes('notif.cancel:' + cfg.notify.id));
    await page.evaluate(() => { window.__sim.calls.length = 0;
                                window.__sim.fireApp('appStateChange', { isActive: false }); });
    await sleep(60);
    ok('off means nothing is scheduled', !(await calls()).some(x => x.indexOf('notif.schedule') === 0));

    await fresh({ perm: 'prompt', permAfter: 'denied' });
    await click('dailyHintBtn');
    await sleep(150);
    ok('refused: asked once, saved as off, nothing scheduled',
       (await count('notif.request')) === 1 &&
       await page.evaluate(() => window.ECSave.data.notify === 'off') &&
       !(await calls()).some(x => x.indexOf('notif.schedule') === 0));
    ok('the hint is paid whatever the answer', await page.evaluate(() => window.ECSave.data.hints === 6));
    await page.evaluate(() => { window.ECSave.data.dailyHintDay = ''; window.ECSave.save(); });
    await reload();
    await click('dailyHintBtn');
    await sleep(150);
    ok('a refusal is final: the next claim, and the next launch, never ask again',
       (await count('notif.request')) === 0 && (await count('notif.check')) === 0 &&
       await page.evaluate(() => window.ECSave.data.hints === 7), JSON.stringify(await calls()));
    await page.evaluate(() => window.ECShop.openShop());
    await click('shopNotify');
    await sleep(100);
    ok('only the player’s own toggle re-asks; still refused, it stays off and says why',
       (await count('notif.request')) === 1 &&
       await page.evaluate(() => window.ECSave.data.notify === 'off' &&
         /blocked/i.test(document.getElementById('toast').textContent)));

    /* ============ the shop while billing hangs ============ */
    console.log('\n-- shop with a hung store --');
    await fresh({ billingHang: true });
    ok('billing really is hung', (await count('purchases.configure')) === 1 &&
       await page.evaluate(() => window.ECBilling.state === 'unavailable'));
    ok('ads still came up beside it', await page.evaluate(() => window.ECAds.available) &&
       (await count('showBanner')) === 1);
    await click('shopBtn');
    ok('the shop opens', await shown('shopOv'));
    ok('Buy says why it is disabled', await page.evaluate(() =>
       document.getElementById('buyHints').disabled &&
       document.getElementById('buyHints').textContent === 'Store unavailable'));
    await click('shopClose');
    ok('Back works while the store is still silent', !(await shown('shopOv')));
    await click('shopBtn');
    await page.evaluate(() => { window.__sim.rewardMode = 'earn'; });
    const hb = await page.evaluate(() => window.ECSave.data.hints);
    await click('shopWatch');
    await sleep(250);
    ok('the hint video works while the store is still silent',
       (await page.evaluate(() => window.ECSave.data.hints)) === hb + cfg.hints.rewardedAdHints);
    await page.evaluate(() => { window.ECShop._restoreTimeoutMs = 150; });
    await click('shopRestore');
    await sleep(40);
    ok('Restore says it is checking', await page.evaluate(() =>
       /Checking/.test(document.getElementById('toast').textContent) && window.ECShop._busy === true));
    await sleep(250);
    ok('a Restore that never answers gives the shop back and says so', await page.evaluate(() =>
       window.ECShop._busy === false &&
       /Could not reach the store/.test(document.getElementById('toast').textContent)));

    /* ============ analytics reaches the plugin ============ */
    console.log('\n-- analytics --');
    await fresh();
    await winChamber1();
    c = (await calls()).filter(x => x.indexOf('fa:') === 0);
    ok('chamber_start is sent to Firebase', c.some(x => x.indexOf('fa:chamber_start:{"chamber":1,"mode":"main"}') === 0),
       JSON.stringify(c));
    const clearEv = c.filter(x => x.indexOf('fa:chamber_clear:') === 0).map(x => JSON.parse(x.slice(17)))[0];
    ok('chamber_clear is sent with chamber, seconds, stars, hints_used',
       clearEv && clearEv.chamber === 1 && clearEv.stars === 5 && clearEv.seconds >= 0 && clearEv.hints_used === 0,
       JSON.stringify(clearEv));
    ok('ad_shown banner is sent', c.some(x => x.indexOf('fa:ad_shown:{"format":"banner"}') === 0));

    ok('no page errors', errors.length === 0, errors.join(' | '));
  } catch (e) {
    failed++; console.log('HARNESS ERROR:', e);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`\n  ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
