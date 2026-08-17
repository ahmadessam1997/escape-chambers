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

/* Derive the safe code from PUBLIC information only — the rule the player
   has read and the facts they have already dug out of the room. It never
   touches L.code; if it could, "all 20 completable" would be circular. */
async function solvePuzzle(page) {
  return page.evaluate(() => {
    const s = window.ECGame.state();
    const p = s.puzzle;
    if (!p || !p.rule) return null;
    if (p.facts.length < p.total && p.family !== 'logic') return null;
    return window.ECPuzzle.solveFromFacts(p.family, p.rule, p.facts, s.codeLen);
  });
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

  /* 1. DEDUCE where the key is, then tap ONLY that.
     This used to tap all seven spots, which meant the suite proved the
     lock chain worked and proved nothing whatever about the deduction --
     the entire redesign. Worse, the comments in puzzle.js and game.js
     both claimed it was already doing this.

     solveKeyHunt sees only `evidence`: the same clue texts and spot traits
     the player has. It never touches L.brassSpot or hunt.answer. So a pass
     here means a chamber is genuinely solvable BY REASONING, not merely
     completable by exhaustion. */
  const hunt = await page.evaluate(() => {
    const s = window.ECGame.state();
    if (!s.hunt) return null;
    return { evidence: s.hunt.evidence, degraded: s.hunt.degraded };
  });
  if (!hunt) return { ok: false, why: 'no key hunt on the chamber state' };
  if (hunt.degraded) return { ok: false, why: 'key hunt DEGRADED to naming the spot' };

  const deduced = await page.evaluate(
    ev => window.ECPuzzle.solveKeyHunt(ev), hunt.evidence);
  if (!deduced) return { ok: false, why: 'evidence did not isolate a single spot' };

  await clickId(page, deduced);
  let keyed = await state(page);
  if (!keyed.items.includes('brassKey') && !keyed.items.includes('ironKey')) {
    return { ok: false, why: 'deduced ' + deduced + ' but no key was there' };
  }

  /* Now search the rest, for the numbered facts the safe code needs. */
  for (const spot of ['rug','plant','clock','pA','pB','shelf','chest']) {
    if (spot !== deduced) await clickId(page, spot);
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
    // Read the RULE the way a player does: tap the note. Then WORK OUT the
    // code from the facts already dug out of the room. Never L.code.
    await selectItem(page, 'note');
    const code = await solvePuzzle(page);
    if (!code) return { ok: false, why: 'could not derive the code from the note rule + facts' };
    await clickId(page, 'safe');
    if (!await shown(page, 'padOv')) return { ok: false, why: 'safe pad did not open' };
    await typeCode(page, code);
    st = await state(page);
    if (!st.safe) return { ok: false, why: 'safe did not open with the derived code ' + code };
  }

  if (tier >= 4) {
    await selectItem(page, 'uv');                 // toggles UV on
    st = await state(page);
    if (!st.uvOn) return { ok: false, why: 'UV lamp would not switch on' };

    // The UV ink shows the RULE now, not the answer. Derive the code.
    const glow = await page.evaluate(() => {
      for (const id of ['uvA','uvB','uvC']) {
        const v = (document.getElementById(id).textContent || '').trim();
        if (v) return v;
      }
      return '';
    });
    if (!glow) return { ok: false, why: 'nothing glowed under UV' };
    const code = await solvePuzzle(page);
    if (!code) return { ok: false, why: 'could not derive the code from the UV rule + facts' };

    await clickId(page, 'safe');
    if (!await shown(page, 'padOv')) return { ok: false, why: 'safe pad did not open' };
    await typeCode(page, code);
    st = await state(page);
    if (!st.safe) return { ok: false, why: 'safe did not open with the derived code ' + code };
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
      /* The light source sits somewhere different in every setting, so its
         centre is measured rather than hardcoded. The old fixed (352,300)
         was the study's candle and means nothing in a prison cell. What
         the assertion is really protecting is unchanged: the glow must not
         swallow taps on its neighbours, and must still accept its own. */
      const lamp = document.getElementById('candleG').getBoundingClientRect();
      const lampEl = document.elementFromPoint(lamp.left + lamp.width / 2,
                                               lamp.top + lamp.height / 2);
      return { drawerRight: at(320, 370), shelfRight: at(450, 252),
               candle: lampEl ? (lampEl.closest('.hot') || {}).id || '(none)' : '(none)' };
    });
    eq('right half of the drawer is tappable', hits.drawerRight, 'drawer');
    eq('right half of the shelf is tappable', hits.shelfRight, 'shelf');
    eq('the light source itself is still tappable', hits.candle, 'candleG');

    /* ================= 3. hint wallet arithmetic ================= */
    console.log('\n-- hints --');
    await page.evaluate(() => window.ECGame.startLevel(0));
    await sleep(60);
    await clickId(page, 'hintBtn');
    eq('using a hint costs one', await page.evaluate(() => window.ECSave.data.hints), 4);

    /* A bought hint is KEPT, not rented. Each press of the hint button now
       buys the next rung of the key-hunt ladder, so "re-read the same step
       for free" is served by the observations panel holding every rung the
       player has paid for — not by the button repeating itself. Charging
       again to re-see a hint already bought would turn a rescue into a
       pump. */
    ok('a bought hint stays readable, free, in the observations panel',
       await page.evaluate(() => {
         const t = document.getElementById('obs').textContent;
         return t.indexOf('Hints you bought') >= 0 && t.indexOf('💡') >= 0;
       }));

    await clickId(page, 'hintBtn');
    eq('the NEXT rung of the ladder charges again',
       await page.evaluate(() => window.ECSave.data.hints), 3);

    /* The ladder must terminate: buying every rung ends at the spot named
       outright, and pressing on past the end costs nothing, because there
       is nothing left to sell. */
    for (let k = 0; k < 6; k++) await clickId(page, 'hintBtn');
    const spent = await page.evaluate(() => window.ECSave.data.hints);
    await clickId(page, 'hintBtn');
    eq('pressing past the last rung is free',
       await page.evaluate(() => window.ECSave.data.hints), spent);
    ok('the last rung names the hiding place',
       await page.evaluate(() => {
         const s = window.ECGame.state();
         const last = s.L.hunt.hints[s.L.hunt.hints.length - 1];
         return last.kind === 'answer' && last.spot === s.L.hunt.answer &&
                document.getElementById('obs').textContent.indexOf(last.text) >= 0;
       }));

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

    /* ---- the two money bugs reported from device, 2026-08-16 ----
       Both had the same shape: the player paid, and the game showed the
       purchase as not owned. */

    /* A: a purchase whose customerInfo comes back STALE (empty) must still
       register. This is what happens while the Play service account cannot
       validate — _applyCustomerInfo rebuilt entitlements from scratch and
       wiped the item that was just bought. */
    ok('a purchase survives an empty customerInfo response',
       await page.evaluate(async () => {
         const B = window.ECBilling;
         B.entitlements = {};
         window.ECSave.data.unlimitedHints = false;
         // Force the device-shaped path: resolve with an empty customerInfo.
         const realState = B.state, realP = B._p;
         B.state = 'ready';
         B._p = { purchaseStoreProduct: () => Promise.resolve({ customerInfo: {} }),
                  getProducts: () => Promise.resolve({ products: [{ identifier: 'hints_unlimited' }] }) };
         const res = await B.purchase('hints_unlimited');
         B.state = realState; B._p = realP;
         return res.ok === true && B.owns('hints_unlimited') === true;
       }));

    /* B: an unreachable store must NOT erase a paid unlock from the save.
       Boot used to mirror an empty entitlement set over the save file, so
       launching offline stripped the purchase. */
    ok('an unreachable store does not erase a paid unlock',
       await page.evaluate(() => {
         window.ECSave.data.removeAds = true;
         window.ECSave.data.unlimitedHints = true;
         // owns() says nothing is owned, and the read was NOT authoritative.
         window.ECSave.setEntitlements(() => false, false);
         return window.ECSave.data.removeAds === true &&
                window.ECSave.data.unlimitedHints === true;
       }));

    /* ...but a trustworthy read still revokes, or refunds would be free. */
    ok('an authoritative read still revokes a refunded unlock',
       await page.evaluate(() => {
         window.ECSave.data.removeAds = true;
         window.ECSave.setEntitlements(() => false, true);
         const revoked = window.ECSave.data.removeAds === false;
         window.ECSave.data.removeAds = true;
         window.ECSave.data.unlimitedHints = true;
         return revoked;
       }));

    /* ================= 7c. every chamber looks different =================
       The v1 build set body.className = 't' + (i % 5), so chambers I, VI,
       XI and XVI were pixel-identical and the game read as one room
       repainted. Twenty distinct palettes AND twenty distinct names. */
    console.log('\n-- room styling --');
    const looks = await page.evaluate(() => {
      const seen = [], names = [];
      for (let i = 0; i < 20; i++) {
        window.ECGame.startLevel(i);
        const cs = getComputedStyle(document.body);
        seen.push(['--wall', '--floor', '--accent']
          .map(v => cs.getPropertyValue(v).trim()).join('|'));
        names.push(document.getElementById('roomTitle').textContent.split('·')[0].trim());
      }
      return { palettes: seen, names: names };
    });
    eq('all 20 chambers have a distinct palette',
       new Set(looks.palettes).size, 20);
    eq('all 20 chambers have a distinct name',
       new Set(looks.names).size, 20);
    ok('no chamber leaves a palette variable empty',
       looks.palettes.every(p => p.split('|').every(v => v.length > 0)),
       JSON.stringify(looks.palettes.slice(0, 3)));

    /* ================= 7d. puzzles, not just search =================
       The old build wrote the answer straight into the room: the note
       toast read `"4821"` and the UV ink spelled the same digits on the
       wall. Finding it WAS the puzzle. These assertions are what stop
       that regressing. */
    console.log('\n-- puzzles --');
    const pz = await page.evaluate(() => {
      const out = [];
      for (let i = 0; i < 20; i++) {
        window.ECGame.startLevel(i);
        const s = window.ECGame.state();
        if (!s.L.puzzle) { out.push({ i, tier: s.tier, none: true }); continue; }
        out.push({
          i, tier: s.tier,
          family: s.L.puzzle.family,
          code: s.L.puzzle.code,
          rule: s.L.puzzle.ruleText,
          short: s.L.puzzle.shortRule,
          factSpots: s.L.puzzle.facts.map(f => f.spot),
          brass: s.L.brassSpot,
          codeLen: s.L.code.length
        });
      }
      return out;
    });
    const puzzled = pz.filter(p => !p.none);

    ok('every tier 3+ chamber has a puzzle',
       pz.every(p => p.none ? p.tier < 3 : p.tier >= 3));
    ok('the answer is never written in the rule text',
       puzzled.every(p => !p.rule.includes(p.code)),
       JSON.stringify(puzzled.filter(p => p.rule.includes(p.code)).slice(0, 2)));
    ok('the answer is never written in the UV ink',
       puzzled.every(p => !String(p.short).includes(p.code)),
       JSON.stringify(puzzled.filter(p => String(p.short).includes(p.code)).slice(0, 2)));
    ok('no fact is hidden on the brass key spot',
       puzzled.every(p => !p.factSpots.includes(p.brass)),
       JSON.stringify(puzzled.filter(p => p.factSpots.includes(p.brass)).slice(0, 2)));
    ok('facts never share a spot with each other',
       puzzled.every(p => new Set(p.factSpots).size === p.factSpots.length));
    ok('the code always matches the keypad length',
       puzzled.every(p => p.code.length === p.codeLen));
    ok('all three kinds of thinking appear across the 20',
       new Set(puzzled.map(p => p.family)).size >= 3,
       JSON.stringify([...new Set(puzzled.map(p => p.family))]));

    /* ================= 7e. the clue trail =================
       Real escape rooms chain: each solve points at the next thing. The
       trail must GUIDE without GATING — every fact stays findable by
       searching its own spot, so a player who ignores the trail is never
       stuck. The auto-solver proves that second half by taps alone. */
    console.log('\n-- clue trail --');
    const trail = await page.evaluate(() => {
      const out = [];
      for (let i = 0; i < 20; i++) {
        window.ECGame.startLevel(i);
        const s = window.ECGame.state();
        if (!s.L.puzzle) continue;
        /* `logic` carries a single placeholder fact with value:null -- its
           rule is self-contained and needs no scattered numbers -- so the
           trail assertions below only apply to families that HAVE numbers. */
        const all = s.L.puzzle.facts;
        const f = all.filter(x => typeof x.value === 'number');
        if (!f.length) continue;
        out.push({
          i,
          chain: f.map(x => x.pointsTo),
          spots: f.map(x => x.spot),
          start: all[0].spot,
          lore: s.L.puzzle.lore.unit,
          rule: s.L.puzzle.ruleText
        });
      }
      return out;
    });

    ok('every fact but the last points at the next one',
       trail.every(t => t.chain.slice(0, -1).every((p, k) => p === t.spots[k + 1])),
       JSON.stringify(trail[0]));
    ok('the last fact points nowhere',
       trail.every(t => t.chain[t.chain.length - 1] === null));
    ok('the trail starts at the first fact',
       trail.every(t => t.start === t.spots[0]));
    ok('a trail never points at a spot with no number',
       trail.every(t => t.chain.filter(Boolean).every(p => t.spots.includes(p))));
    ok('each chamber counts its own themed unit',
       new Set(trail.map(t => t.lore)).size === trail.length,
       JSON.stringify(trail.map(t => t.lore).slice(0, 3)));
    ok('numbered chambers really do chain (not a vacuous pass)',
       trail.length >= 6 && trail.every(t => t.spots.length >= 3),
       'chambers with numbered trails: ' + trail.length);
    ok('the rule is told in the room’s own voice',
       trail.every(t => /^On (a|an) /.test(t.rule)),
       JSON.stringify(trail.filter(t => !/^On (a|an) /.test(t.rule))[0]));

    /* ================= 7f. room-data integrity =================
       Every one of these guards a failure that is INVISIBLE in code and
       only shows up as strange prose in a room nobody re-read. All four
       shipped broken at least once. */
    console.log('\n-- room data --');
    const integrity = await page.evaluate(() => {
      const T = window.ECThemes, P = window.ECPuzzle;
      const vals = new Set();
      T.list.forEach(s => s.search.forEach(id => {
        const tr = s.byId[id].traits || {};
        ['made', 'kind'].forEach(k => { if (typeof tr[k] === 'string') vals.add(tr[k]); });
      }));
      const out = { validate: T.validate(), settings: T.list.length,
                    signs: P.SIGNS.length,
                    missingWords: [...vals].filter(v => !P.VALUE_WORDS[v]),
                    degraded: [], dupText: [], namesAnswer: [], wrongSign: [] };
      for (let i = 0; i < 20; i++) {
        const st = T.themeFor(i);
        const h = P.generateKeyHunt(i, 1 + (i % 5), st.search.map(id => st.byId[id]));
        if (h.degraded) out.degraded.push(i);
        const txt = h.evidence.clues.map(c => c.text);
        if (new Set(txt).size !== txt.length) out.dupText.push(i);
        if (txt.some(t => t.toLowerCase().indexOf(h.answerName.toLowerCase()) >= 0))
          out.namesAnswer.push(i);
        if (h.evidence.sign !== P.SIGNS[i]) out.wrongSign.push(i);
      }
      return out;
    });
    eq('every setting validates', integrity.validate.length, 0);
    eq('one sign per setting — the icehouse must not advertise pollen',
       integrity.signs, integrity.settings);
    eq('no chamber uses a sign written for another room',
       integrity.wrongSign.length, 0);
    eq('every trait value has readable phrasing',
       integrity.missingWords.length, 0);
    eq('no chamber degrades to naming the spot',
       integrity.degraded.length, 0);
    eq('no chamber prints the same observation twice',
       integrity.dupText.length, 0);
    eq('no clue names the answer outright',
       integrity.namesAnswer.length, 0);

    /* ================= 7b. ad-consent privacy button ================= */
    console.log('\n-- consent --');
    /* The failure this guards is a DEAD BUTTON: outside the EEA/UK and the
       opt-out US states Google has no privacy form to serve, so a visible
       "Privacy choices" that does nothing is worse than none at all. The
       browser build never runs UMP, so this is also the default state. */
    ok('privacy choices button is hidden when Google requires no form',
       await page.evaluate(() => {
         window.ECAds.privacyOptionsRequired = false;
         window.ECShop.render();
         return document.getElementById('shopPrivacy').style.display === 'none';
       }));
    ok('privacy choices button appears when Google requires the form',
       await page.evaluate(() => {
         window.ECAds.privacyOptionsRequired = true;
         window.ECShop.render();
         return document.getElementById('shopPrivacy').style.display !== 'none';
       }));
    /* Remove ads silences the interstitial but rewarded videos — and so the
       ad SDK and its consent — remain, so the choice must stay reachable
       for a paying customer too. */
    ok('privacy choices survives owning remove_ads',
       await page.evaluate(() => {
         window.ECAds.privacyOptionsRequired = true;
         window.ECSave.data.removeAds = true;
         window.ECShop.render();
         return document.getElementById('shopPrivacy').style.display !== 'none';
       }));
    await page.evaluate(() => {
      window.ECAds.privacyOptionsRequired = false;
      window.ECShop.render();
    });

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
