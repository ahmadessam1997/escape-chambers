/* =====================================================================
   Escape: 20 Chambers — end-to-end suite
   ---------------------------------------------------------------------
   Puppeteer at 412x915 @2.62dpr (~1080x2400, a real phone). Everything is
   driven through real DOM click events against the shipped www/, so a
   pass cannot be an artefact of a test-only code path.

   The server is started IN THIS PROCESS on an ephemeral port. Frost Tower
   lost time to a stray `node test/serve.js` holding a fixed port while
   the suite silently passed against the old instance.

   Notes that cost time before:
     - waitUntil:'networkidle0' and 'load' both stopped firing on this
       machine. index.html pulls only local scripts and no external
       subresources, so 'domcontentloaded' + a fixed settle is both
       sufficient and deterministic.
     - Read the TAIL of the output. Filtering for /FAIL/ once hid that the
       suite was progressing further after each fix.
   ===================================================================== */
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'www');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
                '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

let passed = 0, failed = 0;
const failures = [];

function ok(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else {
    failed++; failures.push(name + (detail ? ' — ' + detail : ''));
    console.log('  FAIL  ' + name + (detail ? '  [' + detail + ']' : ''));
  }
}
const eq = (name, actual, expected) =>
  ok(name, actual === expected, 'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));

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

/* --------------------------------------------------------------------
   Page helpers — every interaction is a real click on a real element.
   -------------------------------------------------------------------- */
async function clickId(page, id) {
  await page.evaluate(i => {
    const el = document.getElementById(i);
    if (!el) throw new Error('no element #' + i);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }, id);
  await sleep(30);
}
const shown  = (page, id) => page.evaluate(i => document.getElementById(i).classList.contains('show'), id);
const text   = (page, id) => page.evaluate(i => document.getElementById(i).textContent, id);
const state  = page => page.evaluate(() => {
  const s = window.ECGame.state();
  return { cur: s.cur, tier: s.tier, hints: s.hints, unlimited: s.unlimited,
           removeAds: s.removeAds, escaped: !!(s.S && s.S.escaped),
           items: s.S ? Object.keys(s.S.items) : [], uvOn: !!(s.S && s.S.uvOn),
           safe: !!(s.S && s.S.safe), drawer: !!(s.S && s.S.drawer), cab: !!(s.S && s.S.cab) };
});

/* Click an inventory slot by the item it holds. */
async function selectItem(page, item) {
  const found = await page.evaluate(it => {
    for (let i = 0; i < 4; i++) {
      const sl = document.getElementById('s' + i);
      if (sl.dataset.item === it) {
        sl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return true;
      }
    }
    return false;
  }, item);
  await sleep(40);
  return found;
}

async function typeCode(page, code) {
  for (const d of String(code)) {
    await page.evaluate(digit => {
      const b = [...document.querySelectorAll('#pad button')].find(x => x.textContent === digit);
      b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }, d);
    await sleep(25);
  }
  await sleep(320);           // the pad checks after 200ms
}

async function tapSigils(page, seq) {
  for (const s of seq) {
    await page.evaluate(sym => {
      const b = [...document.querySelectorAll('#sympad button')].find(x => x.textContent === sym);
      b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }, s);
    await sleep(25);
  }
  await sleep(320);
}

/* --------------------------------------------------------------------
   The auto-solver. It only ever uses information the GAME shows the
   player: the safe code is read out of the note toast or the UV ink in
   the DOM, and the sigil order off the rug — never out of the generator.
   That is what makes "all 20 completable" a real claim.
   -------------------------------------------------------------------- */
async function solveChamber(page, i) {
  await page.evaluate(n => window.ECGame.startLevel(n), i);
  await sleep(60);

  const tier = (await state(page)).tier;

  // 1. Search everything.
  for (const spot of ['rug','plant','clock','pA','pB','shelf','chest']) {
    await clickId(page, spot);
  }

  let st = await state(page);

  if (tier === 1) {
    if (!st.items.includes('ironKey')) return { ok: false, why: 'no iron key after searching' };
  } else {
    if (!st.items.includes('brassKey')) return { ok: false, why: 'no brass key after searching' };
    await selectItem(page, 'brassKey');
    await clickId(page, 'drawer');
    st = await state(page);
    if (!st.drawer) return { ok: false, why: 'drawer would not open with the brass key' };
  }

  if (tier === 3) {
    // Read the code the way a player does: tap the note, read the toast.
    await selectItem(page, 'note');
    const t = await text(page, 'toast');
    const m = t.match(/"(\d+)"/);
    if (!m) return { ok: false, why: 'note did not reveal a code (toast: ' + t + ')' };
    await clickId(page, 'safe');
    if (!await shown(page, 'padOv')) return { ok: false, why: 'safe pad did not open' };
    await typeCode(page, m[1]);
    st = await state(page);
    if (!st.safe) return { ok: false, why: 'safe did not open with the note code' };
  }

  if (tier >= 4) {
    await selectItem(page, 'uv');                 // toggles UV on
    st = await state(page);
    if (!st.uvOn) return { ok: false, why: 'UV lamp would not switch on' };

    const code = await page.evaluate(() => {
      for (const id of ['uvA','uvB','uvC']) {
        const v = (document.getElementById(id).textContent || '').replace(/\s+/g, '');
        if (v) return v;
      }
      return '';
    });
    if (!/^\d{4}$/.test(code)) return { ok: false, why: 'no 4-digit code glowed under UV (got "' + code + '")' };

    await clickId(page, 'safe');
    if (!await shown(page, 'padOv')) return { ok: false, why: 'safe pad did not open' };
    await typeCode(page, code);
    st = await state(page);
    if (!st.safe) return { ok: false, why: 'safe did not open with the UV code' };
  }

  if (tier === 5) {
    if (!st.items.includes('crank')) return { ok: false, why: 'safe did not yield a crank' };
    await selectItem(page, 'crank');
    await clickId(page, 'cab');
    st = await state(page);
    if (!st.cab) return { ok: false, why: 'cabinet would not open with the crank' };

    const seq = await page.evaluate(() =>
      (document.getElementById('uvRug').textContent || '').split(' ').filter(Boolean));
    if (seq.length !== 4) return { ok: false, why: 'rug did not show 4 sigils under UV' };

    await clickId(page, 'door');                  // opens the sigil lock
    if (!await shown(page, 'symOv')) return { ok: false, why: 'sigil lock did not open' };
    await tapSigils(page, seq);
    if (await shown(page, 'symOv')) return { ok: false, why: 'sigil sequence read off the rug was rejected' };
  }

  st = await state(page);
  if (!st.items.includes('ironKey')) return { ok: false, why: 'no iron key at the end of the chain' };
  await selectItem(page, 'ironKey');
  await clickId(page, 'door');

  if (!await shown(page, 'winOv')) return { ok: false, why: 'door did not open with the iron key' };
  return { ok: true };
}

/* -------------------------------------------------------------------- */
(async () => {
  const { server, port } = await startServer();
  const base = 'http://localhost:' + port + '/index.html';
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2.62, isMobile: true, hasTouch: true });

  const consoleErrors = [];
  page.on('console', m => {
    if (m.type() !== 'error') return;
    /* The message TEXT of a failed subresource load carries no URL — it is
       only on location(). Filtering on the text alone silently let a
       favicon 404 count as a real error (same trap as Frost Tower). */
    const url = (m.location() && m.location().url) || '';
    if (/favicon/i.test(url) || /favicon/i.test(m.text())) return;
    consoleErrors.push(m.text() + (url ? ' @ ' + url : ''));
  });
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

  const load = async () => {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await sleep(500);
  };

  try {
    /* ================= 1. boot ================= */
    console.log('\n-- boot --');
    await load();
    ok('page boots', await page.evaluate(() => !!window.ECGame));
    eq('billing is the browser mock', await page.evaluate(() => window.ECBilling.state), 'mock');
    ok('rooms menu is open on launch', await shown(page, 'menu'));
    eq('wallet starts at the configured 5 hints',
       await page.evaluate(() => window.ECSave.data.hints), 5);
    eq('hint button shows the count', (await text(page, 'hintBtn')).trim(), '💡 5');

    const locks = await page.evaluate(() =>
      [...document.querySelectorAll('#grid .lv')].map(b => b.classList.contains('lock')));
    eq('20 chambers listed', locks.length, 20);
    eq('only chamber 1 is unlocked at first launch', locks.filter(x => !x).length, 1);

    /* Must be asserted BEFORE any chamber has ever been opened: the
       button is reachable the moment the app boots, and before the guard
       existed it dereferenced a null level and threw. */
    await clickId(page, 'hintBtn');
    eq('hint outside a chamber does not throw or charge',
       await page.evaluate(() => window.ECSave.data.hints), 5);

    /* ================= 2. regression: the candle glow ================= */
    console.log('\n-- regression: candle glow hit-testing --');
    /* The glow is a 105px circle painted after the drawer and the shelf.
       SVG hit-testing ignores gradient alpha, so before pointer-events
       was set it swallowed taps on the right half of both — and the
       shelf is a place the brass key can hide.

       The rooms menu is a full-screen overlay, so it has to be out of the
       way before elementFromPoint means anything. */
    await page.evaluate(() => window.ECGame.startLevel(0));
    await sleep(60);
    const hits = await page.evaluate(() => {
      const svg = document.getElementById('scene');
      const pt = svg.createSVGPoint();
      const at = (x, y) => {
        pt.x = x; pt.y = y;
        const p = pt.matrixTransform(svg.getScreenCTM());
        const el = document.elementFromPoint(p.x, p.y);
        return el ? (el.closest('.hot') || {}).id || '(none)' : '(none)';
      };
      return { drawerRight: at(320, 370), shelfRight: at(450, 252), candle: at(352, 300) };
    });
    eq('right half of the drawer is tappable', hits.drawerRight, 'drawer');
    eq('right half of the shelf is tappable', hits.shelfRight, 'shelf');
    eq('the candle itself is still tappable', hits.candle, 'candleG');

    /* ================= 3. hint wallet arithmetic ================= */
    console.log('\n-- hints --');
    await page.evaluate(() => window.ECGame.startLevel(0));
    await sleep(60);
    await clickId(page, 'hintBtn');
    eq('using a hint costs one', await page.evaluate(() => window.ECSave.data.hints), 4);

    await clickId(page, 'hintBtn');
    eq('re-reading the SAME step is free',
       await page.evaluate(() => window.ECSave.data.hints), 4);

    /* Advance the puzzle so the hint step changes, then confirm the new
       step does charge. */
    for (const spot of ['rug','plant','clock','pA','pB','shelf','chest']) await clickId(page, spot);
    await selectItem(page, 'ironKey');
    await clickId(page, 'hintBtn');
    eq('a NEW hint step charges again',
       await page.evaluate(() => window.ECSave.data.hints), 3);

    /* ================= 5. out of hints ================= */
    await page.evaluate(() => { window.ECSave.data.hints = 0; window.ECSave.save(); });
    await page.evaluate(() => window.ECGame.startLevel(1));   // fresh paidHints
    await sleep(60);
    await clickId(page, 'hintBtn');
    ok('empty wallet opens the out-of-hints prompt', await shown(page, 'hintOv'));
    eq('hints never go negative', await page.evaluate(() => window.ECSave.data.hints), 0);
    await clickId(page, 'hintOvClose');

    /* ================= 6. consumable hint packs ================= */
    console.log('\n-- purchases --');
    await page.evaluate(() => window.ECShop.buy('hints_25'));
    await sleep(150);
    eq('buying a hint pack credits 25', await page.evaluate(() => window.ECSave.data.hints), 25);

    await page.evaluate(() => window.ECShop.buy('hints_25'));
    await sleep(150);
    eq('a consumable can be bought AGAIN and credits again',
       await page.evaluate(() => window.ECSave.data.hints), 50);

    /* The load-bearing one. Every restore, every getCustomerInfo and
       every cold start replays the full transaction list; paying out per
       transaction id is the only thing stopping 25 hints becoming 250. */
    await page.evaluate(() => window.ECBilling.refresh());
    await sleep(150);
    eq('replaying the transaction list does NOT re-grant',
       await page.evaluate(() => window.ECSave.data.hints), 50);

    eq('two transactions were recorded',
       await page.evaluate(() => window.ECSave.data.grantedTx.length), 2);

    /* ================= 7. non-consumables ================= */
    await page.evaluate(() => window.ECShop.buy('remove_ads'));
    await sleep(150);
    ok('remove_ads is owned', await page.evaluate(() => window.ECSave.data.removeAds));
    ok('ads module was told about remove_ads', await page.evaluate(() => window.ECAds.removeAdsOwned));
    ok('remove_ads suppresses the interstitial',
       await page.evaluate(() => window.ECAds.shouldShowInterstitial(99) === false));

    await page.evaluate(() => window.ECShop.buy('hints_unlimited'));
    await sleep(150);
    ok('unlimited hints is owned', await page.evaluate(() => window.ECSave.data.unlimitedHints));
    const before = await page.evaluate(() => window.ECSave.data.hints);
    await page.evaluate(() => window.ECSave.spendHint());
    eq('unlimited hints does not decrement the wallet',
       await page.evaluate(() => window.ECSave.data.hints), before);
    eq('hint button shows the infinity marker', (await text(page, 'hintBtn')).trim(), '💡 ♾');

    /* ================= 8. ad cadence (pure logic) ================= */
    console.log('\n-- ad pacing --');
    const cadence = await page.evaluate(() => {
      const A = window.ECAds, C = window.ECConfig;
      const saved = { avail: A.available, ready: A._interstitialReady,
                      rm: A.removeAdsOwned, last: A._lastInterstitialAt };
      A.available = true; A._interstitialReady = true; A.removeAdsOwned = false; A._lastInterstitialAt = 0;
      const r = {
        below: A.shouldShowInterstitial(C.ads.interstitialEveryNChambers - 1),
        at:    A.shouldShowInterstitial(C.ads.interstitialEveryNChambers)
      };
      A._lastInterstitialAt = Date.now();
      r.cooldown = A.shouldShowInterstitial(99);
      Object.assign(A, { available: saved.avail, _interstitialReady: saved.ready,
                         removeAdsOwned: saved.rm, _lastInterstitialAt: saved.last });
      return r;
    });
    ok('no interstitial below the chamber threshold', cadence.below === false);
    ok('interstitial at the chamber threshold', cadence.at === true);
    ok('cooldown blocks a second interstitial', cadence.cooldown === false);
    ok('browser build never has ads available',
       await page.evaluate(() => window.ECAds.available === false));

    /* ================= 9. every chamber is completable ================= */
    console.log('\n-- solving all 20 chambers --');
    await load();                                  // clean slate, real boot
    await page.evaluate(() => {
      // Unlock everything so the solver can jump straight to any chamber;
      // the SOLVING is still done entirely through real clicks.
      window.ECSave.data.unlocked = 20;
      window.ECSave.save();
    });
    for (let i = 0; i < 20; i++) {
      const r = await solveChamber(page, i);
      ok('chamber ' + (i + 1) + ' solved end to end', r.ok, r.why);
      if (!r.ok) break;
      await clickId(page, 'backBtn');
      await sleep(60);
    }

    /* ================= 10. first-clear reward, and no farming ========= */
    console.log('\n-- rewards --');
    /* A clean slate is the whole point here — the previous section
       finished all twenty chambers, so without this the "first clear"
       would not be one. */
    await page.evaluate(() => localStorage.clear());
    await load();
    const h0 = await page.evaluate(() => window.ECSave.data.hints);
    let r = await solveChamber(page, 0);
    ok('chamber 1 solved for the reward check', r.ok, r.why);
    const h1 = await page.evaluate(() => window.ECSave.data.hints);
    eq('first clear awards a hint', h1 - h0, 1);

    await clickId(page, 'backBtn');
    r = await solveChamber(page, 0);
    ok('chamber 1 replayed', r.ok, r.why);
    eq('replaying a cleared chamber awards nothing',
       await page.evaluate(() => window.ECSave.data.hints), h1);
    await clickId(page, 'backBtn');

    /* ================= 11. persistence ================= */
    console.log('\n-- persistence --');
    await page.evaluate(() => {
      window.ECSave.data.hints = 7;
      window.ECSave.save();
    });
    await load();
    eq('hints survive a reload', await page.evaluate(() => window.ECSave.data.hints), 7);
    ok('finished chamber survives a reload', await page.evaluate(() => window.ECSave.isDone(0)));
    ok('chamber 2 is unlocked after finishing chamber 1',
       await page.evaluate(() => window.ECSave.data.unlocked >= 2));

    /* A wiped save must recover a paid hint pack from the store rather
       than swallowing it. RevenueCat keeps consumable transactions in
       customerInfo.nonSubscriptionTransactions forever, so a reinstalled
       player gets their hints back on the first sync.

       This is a DELIBERATE trade, not an oversight: it is technically
       farmable by clearing app data repeatedly, but doing so destroys all
       chamber progress to recover a soft currency that a free rewarded
       video also hands out. Taking a paying customer's purchase away on
       reinstall is the far more expensive mistake. */
    await page.evaluate(() => {
      localStorage.setItem('ec.mockPurchases', JSON.stringify({
        entitlements: {},
        tx: [{ productIdentifier: 'hints_25', transactionIdentifier: 'tx-reinstall-1' }]
      }));
      localStorage.removeItem('ec.save');
    });
    await load();
    eq('a paid hint pack is recovered after a wiped save',
       await page.evaluate(() => window.ECSave.data.hints), 5 + 25);

    /* corrupt blob must degrade, never lock the player out */
    await page.evaluate(() => {
      localStorage.removeItem('ec.mockPurchases');
      localStorage.setItem('ec.save', '{not json at all');
    });
    await load();
    ok('corrupt save still boots', await page.evaluate(() => !!window.ECGame));
    eq('corrupt save falls back to the starting wallet',
       await page.evaluate(() => window.ECSave.data.hints), 5);

    /* a save claiming chamber 5 is done must leave chamber 6 reachable
       even if `unlocked` itself was mangled */
    await page.evaluate(() => localStorage.setItem('ec.save',
      JSON.stringify({ unlocked: 1, done: [0, 1, 2, 3, 4], hints: 3 })));
    await load();
    eq('unlocked is repaired from the done list',
       await page.evaluate(() => window.ECSave.data.unlocked), 6);

    /* out-of-range and duplicate chamber indexes must not survive */
    await page.evaluate(() => localStorage.setItem('ec.save',
      JSON.stringify({ unlocked: 3, done: [0, 0, 1, 99, -4, 'x'], hints: -5 })));
    await load();
    eq('junk chamber indexes are dropped',
       await page.evaluate(() => JSON.stringify(window.ECSave.data.done)), '[0,1]');
    eq('a negative hint count is repaired to zero',
       await page.evaluate(() => window.ECSave.data.hints), 0);

    /* v1 migration: the pre-monetization build wrote {u,d} under 'esc' */
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('esc', JSON.stringify({ u: 9, d: [0, 1, 2, 3, 4, 5, 6, 7] }));
    });
    await load();
    eq('v1 progress migrates', await page.evaluate(() => window.ECSave.data.unlocked), 9);
    eq('v1 finished chambers migrate', await page.evaluate(() => window.ECSave.data.done.length), 8);
    eq('a migrated player still gets the starting hints',
       await page.evaluate(() => window.ECSave.data.hints), 5);

    /* ================= 12. no console errors ================= */
    console.log('\n-- console --');
    const real = consoleErrors.filter(t => !/favicon/i.test(t));
    ok('no console errors during the whole run', real.length === 0, real.slice(0, 3).join(' | '));

  } catch (e) {
    failed++;
    failures.push('HARNESS: ' + e.message);
    console.log('\n  HARNESS ERROR: ' + e.stack);
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n=========================================');
  console.log(passed + ' passed, ' + failed + ' failed');
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach(f => console.log('  - ' + f));
  }
  console.log('=========================================\n');
  process.exit(failed ? 1 : 0);
})();
