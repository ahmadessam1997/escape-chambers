/* =====================================================================
   Escape Chambers — end-to-end suite
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
                '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
                '.png': 'image/png' };

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
           moves: s.S ? s.S.moves : 0,
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

/* Take the next hint step the way a player does since 1.7.1: 💡 opens the
   hint panel, the step button buys (or, for the first nudge, takes) the
   next step, and the panel is closed again. */
async function hint(page) {
  await clickId(page, 'hintBtn');
  await clickId(page, 'hpNext');
  await clickId(page, 'hpClose');
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
  /* A number is one of the numbered chambers. A string is a DAILY chamber, written
     'YYYY-MM-DD' or 'YYYY-MM-DD@tier' — the same solver, started through
     the daily entry point, so "the daily is solvable" is proved exactly
     the way "all 20 are" is. */
  await page.evaluate(n => {
    if (typeof n === 'string') {
      const parts = n.split('@');
      window.ECGame.startDaily(parts[0], Number(parts[1]) || 5);
    } else {
      window.ECGame.startLevel(n);
    }
  }, i);
  await sleep(60);

  const tier = (await state(page)).tier;

  /* 1. DEDUCE where the key is, then tap ONLY that.
     This used to tap all seven spots, which meant the suite proved the
     lock chain worked and proved nothing whatever about the deduction --
     the entire redesign. Worse, the comments in puzzle.js and game.js
     both claimed it was already doing this.

     solveKeyHunt sees only `evidence`: the same clue texts and spot traits
     the player has. It reads no secret field — enforced below by an
     assertion that greps this function, so the promise cannot rot into
     another false comment. A pass here means a chamber is genuinely
     solvable BY REASONING, not merely completable by exhaustion. */
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

  /* Now FOLLOW THE TRAIL for the numbers the safe rule needs, rather than
     searching all seven. That is what the trail is for, and it is what par
     assumes — a player who reads the note ("begin at the X") and follows
     each arrow finds every number without touching anything else. Brute
     force still works and still finishes the chamber; it just costs stars.

     The rule is only legible once the note is read or the UV lamp is on,
     so this runs after those below for tiers 4+; the fallback sweep covers
     any chamber where the trail is not yet visible. */
  const trailWalk = async () => {
    for (let step = 0; step < 8; step++) {
      const st2 = await page.evaluate(() => {
        const s = window.ECGame.state();
        if (!s.puzzle) return null;
        return { start: s.puzzle.startSpot, next: s.puzzle.nextSpot,
                 have: s.puzzle.facts.length, total: s.puzzle.total };
      });
      if (!st2 || st2.have >= st2.total) return true;
      const target = st2.next || st2.start;
      if (!target) return false;
      await clickId(page, target);
    }
    return false;
  };

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
    await trailWalk();
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
    await trailWalk();
    const code = await solvePuzzle(page);
    if (!code) return { ok: false, why: 'could not derive the code from the UV rule + facts' };

    await clickId(page, 'safe');
    if (!await shown(page, 'padOv')) return { ok: false, why: 'safe pad did not open' };
    await typeCode(page, code);
    st = await state(page);
    if (!st.safe) return { ok: false, why: 'safe did not open with the derived code ' + code };
  }

  if (tier >= 5) {
    if (!st.items.includes('crank')) return { ok: false, why: 'safe did not yield a crank' };
    await selectItem(page, 'crank');
    await clickId(page, 'cab');
    st = await state(page);
    if (!st.cab) return { ok: false, why: 'cabinet would not open with the crank' };

    /* Read off the floor exactly as a player does: the sigils in the order
       shown, and — from chamber 26 on — the ↶ mark that says the door wants
       them last to first. The solver is told nothing the ink does not say. */
    const shown5 = await page.evaluate(() =>
      (document.getElementById('uvRug').textContent || '').split(' ').filter(Boolean));
    const backwards = shown5.includes('↶');
    const seq = shown5.filter(x => x !== '↶');
    if (backwards) seq.reverse();
    if (seq.length < 4) return { ok: false, why: 'rug did not show the sigils under UV' };

    /* Every glyph of the rug ink must be ON SCREEN and not under anything
       drawn later. Five sigils at the four-sigil spacing ran under the
       crate in chamber XXII on the 1.7.0 device check, so a player saw
       four and the door wanted five. */
    const coveredGlyphs = await page.evaluate(() => {
      const st = document.createElement('style');
      st.textContent = '#scene *{pointer-events:all !important}';
      document.head.appendChild(st);
      const el = document.getElementById('uvRug'), txt = el.textContent, m = el.getScreenCTM();
      const sc = document.getElementById('scene').getBoundingClientRect();
      const bad = [];
      for (let k = 0; k < el.getNumberOfChars(); k++) {
        if (txt[k] === ' ') continue;
        const e = el.getExtentOfChar(k);
        const p = new DOMPoint(e.x + e.width / 2, e.y + e.height / 2).matrixTransform(m);
        const off = p.x < sc.left || p.x > sc.right || p.y < sc.top || p.y > sc.bottom;
        /* Only the room's own drawing can hide the ink; a dialog that
           happens to be open over the scene (the rate prompt) does not
           count. */
        const scene = document.getElementById('scene');
        const hit = off ? null : document.elementsFromPoint(p.x, p.y).find(h => scene.contains(h));
        if (off || hit !== el) {
          const g = hit && hit.closest('[id]');
          bad.push(txt[k] + '(' + (off ? 'off' : g ? g.id : '?') + ')');
        }
      }
      st.remove();
      return bad;
    });
    if (coveredGlyphs.length) return { ok: false, why: 'rug ink hidden or off the scene: ' + coveredGlyphs.join(' ') };

    await clickId(page, 'door');                  // opens the sigil lock
    if (!await shown(page, 'symOv')) return { ok: false, why: 'sigil lock did not open' };
    const lockLine = await text(page, 'symSub');
    const WORD = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'][seq.length];
    if (lockLine.indexOf(' ' + WORD + ' sigils') < 0) {
      return { ok: false, why: 'sigil lock says "' + lockLine + '" for a ' + seq.length + '-sigil door' };
    }
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
    const TOTAL = await page.evaluate(() => window.ECThemes.list.length);
    eq('there are thirty chambers', TOTAL, 30);
    eq('every chamber is listed on the menu', locks.length, TOTAL);
    /* THE NAME CARRIES NO COUNT, so chambers can be added without renaming
       anything; where a count IS shown it is read from the data. */
    ok('the game’s name has no chamber count in it',
       await page.evaluate(() => !/\d/.test(document.title) &&
         !/\d/.test(document.getElementById('menuTitle').textContent)),
       await page.evaluate(() => document.title + ' / ' + document.getElementById('menuTitle').textContent));
    ok('the menu states the real number of chambers',
       await page.evaluate(n => document.getElementById('menuBlurb').textContent.indexOf(String(n)) === 0 &&
         document.getElementById('menuProgress').textContent.indexOf('0 / ' + n) === 0, TOTAL),
       await page.evaluate(() => document.getElementById('menuProgress').textContent));
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
    /* RUNG 1 IS FREE. It restates a clue already printed on screen in
       plainer words, so charging for it is charging the player to
       understand the rules rather than to be rescued from them. At tier 1
       there is a second reason: the profile is a single clue that must
       isolate the answer, so the restatement always gives it away —
       selling it would be selling the solution as the opening move. */
    await hint(page);
    eq('the first rung costs nothing',
       await page.evaluate(() => window.ECSave.data.hints), 5);

    await hint(page);
    eq('the second rung costs one', await page.evaluate(() => window.ECSave.data.hints), 4);

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

    await hint(page);
    eq('each further rung charges again',
       await page.evaluate(() => window.ECSave.data.hints), 3);

    /* The ladder must terminate: buying every rung ends at the spot named
       outright, and pressing on past the end costs nothing, because there
       is nothing left to sell. */
    for (let k = 0; k < 6; k++) await hint(page);
    const spent = await page.evaluate(() => window.ECSave.data.hints);
    await hint(page);
    eq('pressing past the last rung is free',
       await page.evaluate(() => window.ECSave.data.hints), spent);
    ok('the last rung names the hiding place',
       await page.evaluate(() => {
         const s = window.ECGame.state();
         const last = s.__answers.hunt.hints[s.__answers.hunt.hints.length - 1];
         return last.kind === 'answer' && last.spot === s.__answers.hunt.answer &&
                document.getElementById('obs').textContent.indexOf(last.text) >= 0;
       }));

    /* ================= 5. out of hints ================= */
    await page.evaluate(() => { window.ECSave.data.hints = 0; window.ECSave.save(); });
    await page.evaluate(() => window.ECGame.startLevel(1));   // fresh paidHints
    await sleep(60);
    /* A broke player still gets the free rung — being out of hints must not
       lock you out of understanding the clue you can already see. The
       prompt appears on the FIRST rung that actually costs something. */
    await hint(page);
    ok('a broke player still gets the free first rung', !await shown(page, 'hintOv'));
    await hint(page);
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

    /* hints_unlimited is WITHDRAWN from sale but must still work for anyone
       who already owns it — removing the id from config would silently
       revoke a paid unlock. So it is bought here through the API (there is
       no longer a shop row) and everything downstream must still honour it. */
    ok('the withdrawn product has no shop row',
       await page.evaluate(() => !document.getElementById('buyUnlimited')));
    await page.evaluate(() => window.ECShop.buy('hints_unlimited'));
    await sleep(150);
    ok('an already-owned unlimited entitlement is still honoured',
       await page.evaluate(() => window.ECSave.data.unlimitedHints));
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
       repainted. Every chamber gets a distinct palette AND a distinct name. */
    console.log('\n-- room styling --');
    const looks = await page.evaluate(() => {
      const seen = [], names = [];
      for (let i = 0; i < window.ECThemes.list.length; i++) {
        window.ECGame.startLevel(i);
        const cs = getComputedStyle(document.body);
        seen.push(['--wall', '--floor', '--accent']
          .map(v => cs.getPropertyValue(v).trim()).join('|'));
        names.push(document.getElementById('roomTitle').textContent.split('·')[0].trim());
      }
      return { palettes: seen, names: names };
    });
    eq('every chamber has a distinct palette',
       new Set(looks.palettes).size, TOTAL);
    eq('every chamber has a distinct name',
       new Set(looks.names).size, TOTAL);
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
      for (let i = 0; i < window.ECThemes.list.length; i++) {
        window.ECGame.startLevel(i);
        const s = window.ECGame.state();
        if (!s.__answers.puzzle) { out.push({ i, tier: s.tier, none: true }); continue; }
        out.push({
          i, tier: s.tier,
          family: s.__answers.puzzle.family,
          code: s.__answers.puzzle.code,
          rule: s.__answers.puzzle.ruleText,
          short: s.__answers.puzzle.shortRule,
          factSpots: s.__answers.puzzle.facts.map(f => f.spot),
          brass: s.__answers.brassSpot,
          codeLen: s.__answers.code.length
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
    ok('all three kinds of thinking appear across the first twenty',
       new Set(puzzled.filter(p => p.i < 20).map(p => p.family)).size >= 3,
       JSON.stringify([...new Set(puzzled.map(p => p.family))]));

    /* ---- chambers 21-30: the curve keeps climbing ---- */
    const late = pz.filter(p => p.i >= 20);
    eq('chambers 21-25 are tier 6', late.filter(p => p.i < 25).map(p => p.tier).join(), '6,6,6,6,6');
    ok('every chamber from 26 on is tier 7', late.filter(p => p.i >= 25).every(p => p.tier === 7));
    ok('tier 6 keeps the four-digit safe', late.filter(p => p.tier === 6).every(p => p.codeLen === 4));
    ok('tier 7 has a FIVE-digit safe', late.filter(p => p.tier === 7).every(p => p.codeLen === 5));
    ok('the three new safe rules all appear after chamber 20',
       ['mirror', 'chain', 'weave'].every(fam => late.some(p => p.family === fam)),
       JSON.stringify(late.map(p => p.family)));
    ok('the new rules never appear in the first twenty (their codes are unchanged)',
       puzzled.filter(p => p.i < 20).every(p => ['arith', 'logic', 'order'].includes(p.family)));
    const lateLocks = await page.evaluate(() => {
      const out = [];
      for (let i = 16; i < window.ECThemes.list.length; i++) {
        window.ECGame.startLevel(i);
        const s = window.ECGame.state(), L = s.__answers;
        const abs = L.hunt.evidence.clues.filter(c => ['unique', 'group', 'extreme', 'nearest'].includes(c.pred.k)).length;
        out.push({ i, tier: s.tier, seq: L.seq.length, rev: !!L.seqReversed,
                   want: L.seqWant.join(''), shown: L.seq.join(''),
                   ink: document.getElementById('uvRug').textContent,
                   clues: L.hunt.clueCount, abstract: abs,
                   degraded: L.hunt.degraded, relaxed: L.hunt.relaxed });
      }
      return out;
    });
    ok('tier 5 still shows four sigils', lateLocks.filter(x => x.tier === 5).every(x => x.seq === 4 && !x.rev));
    ok('tiers 6-7 show five sigils', lateLocks.filter(x => x.tier >= 6).every(x => x.seq === 5));
    ok('tier 7 doors read the sigils last to first — and the ink says so',
       lateLocks.filter(x => x.tier === 7).every(x => x.rev && x.ink.indexOf('↶') >= 0 &&
         x.want === x.shown.split('').reverse().join('')) &&
       lateLocks.filter(x => x.tier < 7).every(x => !x.rev && x.ink.indexOf('↶') < 0 && x.want === x.shown));
    ok('no chamber after 20 degrades to naming the spot', lateLocks.every(x => !x.degraded));
    /* No room after XX may fall back to a tier-5 hunt: even where tier 7's
       fourth clue gives way, the two structural clues stay. */
    ok('every one of chambers 21-30 needs three or more clues, two of them structural',
       lateLocks.filter(x => x.tier >= 6).every(x => x.clues >= 3 && x.abstract >= 2),
       JSON.stringify(lateLocks.filter(x => x.tier >= 6)));
    ok('most of chambers 21-30 are at full strength (not relaxed)',
       lateLocks.filter(x => x.tier >= 6 && !x.relaxed).length >= 7,
       'relaxed: ' + lateLocks.filter(x => x.tier >= 6 && x.relaxed).map(x => x.i + 1).join(','));
    ok('tier 7 key hunts carry four clues unless relaxed',
       lateLocks.filter(x => x.tier === 7).every(x => x.relaxed || x.clues === 4));

    /* ================= 7e. the clue trail =================
       Real escape rooms chain: each solve points at the next thing. The
       trail must GUIDE without GATING — every fact stays findable by
       searching its own spot, so a player who ignores the trail is never
       stuck. The auto-solver proves that second half by taps alone. */
    console.log('\n-- clue trail --');
    const trail = await page.evaluate(() => {
      const out = [];
      for (let i = 0; i < window.ECThemes.list.length; i++) {
        window.ECGame.startLevel(i);
        const s = window.ECGame.state();
        if (!s.__answers.puzzle) continue;
        /* `logic` carries a single placeholder fact with value:null -- its
           rule is self-contained and needs no scattered numbers -- so the
           trail assertions below only apply to families that HAVE numbers. */
        const all = s.__answers.puzzle.facts;
        const f = all.filter(x => typeof x.value === 'number');
        if (!f.length) continue;
        out.push({
          i,
          chain: f.map(x => x.pointsTo),
          spots: f.map(x => x.spot),
          start: all[0].spot,
          lore: s.__answers.puzzle.lore.unit,
          rule: s.__answers.puzzle.ruleText
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
                    signs: P.SIGNS.length, lore: P.LORE.length,
                    missingWords: [...vals].filter(v => !P.VALUE_WORDS[v]),
                    degraded: [], dupText: [], namesAnswer: [], wrongSign: [] };
      for (let i = 0; i < window.ECThemes.list.length; i++) {
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
    /* SPATIAL CLUES MUST AGREE WITH THE PICTURE.
       The generator reasons over coordinates; the player reasons over a
       drawing that layoutFor() has permuted and, in half the chambers,
       MIRRORED. If those disagree, a clue saying 'furthest to the left'
       points at something drawn on the right. Comparing left-to-right
       ORDER catches that: it is exactly the property the clues depend on,
       and it fails loudly if the coordinates ever stop being post-layout. */
    const spatial = await page.evaluate(() => {
      const bad = [];
      for (let i = 0; i < window.ECThemes.list.length; i++) {
        window.ECGame.startLevel(i);
        const st = window.ECGame.state();
        const spots = st.hunt.evidence.spots;
        const byGen = spots.slice().sort((a, b) => a.x - b.x).map(s => s.id);
        const byEye = spots.slice().sort((a, b) => {
          const ra = document.getElementById(a.id).getBoundingClientRect();
          const rb = document.getElementById(b.id).getBoundingClientRect();
          return (ra.left + ra.width / 2) - (rb.left + rb.width / 2);
        }).map(s => s.id);
        if (byGen.join() !== byEye.join()) bad.push(i);
      }
      return bad;
    });
    eq('clue coordinates match what is drawn, mirror and all',
       spatial.length, 0);
    eq('every setting validates', integrity.validate.length, 0);
    eq('one sign per setting — the icehouse must not advertise pollen',
       integrity.signs, integrity.settings);
    eq('one lore line per setting — the tomb must not count seed trays',
       integrity.lore, integrity.settings);
    eq('no chamber uses a sign written for another room',
       integrity.wrongSign.length, 0);
    eq('every trait value has readable phrasing',
       integrity.missingWords.length, 0);
    eq('no chamber degrades to naming the spot',
       integrity.degraded.length, 0);
    eq('no chamber prints the same observation twice',
       integrity.dupText.length, 0);
    /* THE GUARANTEE, ENFORCED RATHER THAN TRUSTED.
       solveChamber() must never read an answer field. If it ever does,
       "every chamber completable" becomes a restatement of the generator and the
       suite proves nothing. A comment asking nicely was not enough: two
       comments in the shipping code already claimed this was true while
       the solver was in fact tapping all seven spots. */
    {
      /* Comments are stripped first: the guard is about what the code
         READS, and the explanatory comment above names the very fields it
         promises not to touch. */
      const src = solveChamber.toString()
        .split('\n')
        .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))   // drop comment lines
        .join('\n');
      const secrets = ['__answers', 'brassSpot', 'hunt.answer', 'hunt.hints'];
      const leaked = secrets.filter(k => src.indexOf(k) >= 0);
      ok('the auto-solver never reads an answer field',
         leaked.length === 0, 'solveChamber reads ' + leaked.join(', '));
      ok('the auto-solver does deduce the key',
         /solveKeyHunt/.test(src), 'solveChamber never calls solveKeyHunt');
    }
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
    /* Remove ads silences every format, but the ad SDK is still initialised
       and still holds a consent decision, so the choice must stay
       reachable for a paying customer too. */
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
    console.log('\n-- solving all ' + TOTAL + ' chambers --');
    await load();                                  // clean slate, real boot
    await page.evaluate(() => {
      // Unlock everything so the solver can jump straight to any chamber;
      // the SOLVING is still done entirely through real clicks.
      window.ECSave.data.unlocked = window.ECThemes.list.length;
      window.ECSave.save();
    });
    /* PAR MUST BE ACHIEVABLE, or five stars is a promise the game cannot
       keep. The auto-solver plays the optimal line — deduce the key, take
       only the numbers the rule needs, enter the code once — so if par is
       right it scores five every time. A par set one too low would show up
       here as four stars on a flawless run, which no amount of reading the
       formula would catch. */
    const stars = [];
    const cards = {};
    for (let i = 0; i < TOTAL; i++) {
      const r = await solveChamber(page, i);
      ok('chamber ' + (i + 1) + ' solved end to end', r.ok, r.why);
      if (!r.ok) break;
      cards[i] = await page.evaluate(() => ({
        title: document.getElementById('winTitle').textContent,
        next: document.getElementById('nextBtn').style.display !== 'none' }));
      stars.push(await page.evaluate(n => {
        const rec = window.ECSave.bestFor(n);
        return rec ? { stars: rec.stars, moves: rec.moves } : null;
      }, i));
      await clickId(page, 'backBtn');
      await sleep(60);
    }
    console.log('\n-- stars --');
    ok('a perfect run scores five stars in every chamber',
       stars.filter(s => s && s.stars === 5).length === TOTAL,
       'short of par: ' + JSON.stringify(
         stars.map((s, i) => (s && s.stars === 5) ? null
                : { ch: i + 1, stars: s && s.stars, moves: s && s.moves })
              .filter(Boolean)));
    ok('every chamber recorded its move count',
       stars.every(s => s && s.moves > 0), JSON.stringify(stars.slice(0, 3)));

    /* The final-chamber card follows the DATA: it belongs to whichever
       chamber is last, and chamber 20 — the old last one — is now just a
       chamber with a Next button. */
    ok('chamber 20 is no longer the end: it offers the next chamber',
       cards[19] && cards[19].next && cards[19].title.indexOf('ALL') < 0, JSON.stringify(cards[19]));
    ok('the last chamber shows the all-escaped card with the real count and no Next',
       cards[TOTAL - 1] && !cards[TOTAL - 1].next &&
       cards[TOTAL - 1].title.indexOf('ALL ' + TOTAL + ' CHAMBERS ESCAPED') >= 0,
       JSON.stringify(cards[TOTAL - 1]));
    ok('with everything escaped the menu says so, from the data',
       await page.evaluate(n => { window.ECGame.showMenu();
         return document.getElementById('menuProgress').textContent.indexOf(n + ' / ' + n + ' escaped') === 0 &&
                document.getElementById('menuProgress').textContent.indexOf((n * 5) + ' / ' + (n * 5)) > 0; }, TOTAL),
       await page.evaluate(() => document.getElementById('menuProgress').textContent));

    /* PER-CHAMBER BOARDS. One combined table was unfair: chamber I is a
       single search and the last is a safe plus a sigil lock, so their
       times are not comparable. Each chamber ranks on its own. */
    ok('the rankings index lists every chamber and totals the real number of stars',
       await page.evaluate(n => {
         window.ECGame.showRankings(null);
         return document.querySelectorAll("#rankTable tr.rankRow").length === n &&
                document.getElementById('rankSummary').textContent.indexOf('of ' + (n * 5) + ' stars') > 0;
       }, TOTAL));
    ok('a chamber has its own board, showing only its own runs',
       await page.evaluate(() => {
         window.ECGame.showRankings(0);
         const t = document.getElementById("rankTable").textContent;
         const head = document.getElementById("rankSummary").textContent;
         return head.indexOf("Chamber I") >= 0 &&
                document.querySelectorAll("#rankTable tr.rankRow").length === 0;
       }));
    ok('each chamber ranks separately',
       await page.evaluate(() => {
         const a = window.ECGame.rankRows(0), b = window.ECGame.rankRows(window.ECThemes.list.length - 1);
         return Array.isArray(a) && Array.isArray(b);
       }));
    /* The ordering rule, checked directly: stars dominate time. Getting
       this backwards would make the board reward rushing over reading,
       which is the opposite of what the stars are for. */
    ok('more stars beats a faster time',
       await page.evaluate(() => window.ECSave.compareRuns(
         { stars: 5, seconds: 240, moves: 9 },
         { stars: 4, seconds: 30,  moves: 9 }) < 0));
    ok('within equal stars, the faster run wins',
       await page.evaluate(() => window.ECSave.compareRuns(
         { stars: 4, seconds: 30,  moves: 12 },
         { stars: 4, seconds: 31,  moves: 9 }) < 0));
    ok('a worse run never overwrites a record',
       await page.evaluate(() => {
         const before = window.ECSave.bestFor(0);
         window.ECSave.recordRun(0, { stars: 1, seconds: 999, moves: 99 });
         const after = window.ECSave.bestFor(0);
         return after.stars === before.stars && after.seconds === before.seconds;
       }));

    /* ================= 10. first-clear reward, and no farming ========= */
    console.log('\n-- rewards --');
    /* A clean slate is the whole point here — the previous section
       finished every chamber, so without this the "first clear"
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

    /* A SAVE FROM THE TWENTY-CHAMBER GAME (1.5.x) MUST CARRY OVER UNTOUCHED.
       That build clamped `unlocked` at 20, so a player who had finished
       everything arrives with unlocked:20 and chamber 20 done. They must
       find chamber 21 open, and every star, hint, purchase and counter
       exactly where they left it. The rating prompt keeps its own key. */
    {
      const best = {};
      for (let k = 0; k < 20; k++) best[k] = { stars: 3 + (k % 3), moves: 4 + k, seconds: 60 + k };
      const old = { unlocked: 20, done: Array.from({ length: 20 }, (_, k) => k), hints: 42,
                    grantedTx: ['tx-old-1'], removeAds: true, unlimitedHints: false,
                    chambersSinceAd: 1, seamAdsShown: 3, seenShop: true,
                    dailyHintDay: '2026-09-30', daily: { last: '2026-09-30', streak: 4, best: 6 },
                    notify: 'on', best: best };
      const rate = { count: 1, rated: false, never: false, shown: 2, laters: 2 };
      await page.evaluate((o, r) => {
        localStorage.clear();
        localStorage.setItem('ec.save', JSON.stringify(o));
        localStorage.setItem('rate_prompt_v1', JSON.stringify(r));
        /* The store agrees with the save, as it would for a real owner:
           Remove ads owned, and the one hint pack already paid out. */
        localStorage.setItem('ec.mockPurchases', JSON.stringify({
          entitlements: { remove_ads: true },
          tx: [{ productIdentifier: 'hints_25', transactionIdentifier: 'tx-old-1' }] }));
      }, old, rate);
      await load();
      const now = await page.evaluate(() => ({
        d: JSON.parse(JSON.stringify(window.ECSave.data)),
        rate: window.RatePrompt._state(),
        grid: [...document.querySelectorAll('#grid .lv')].map(b => b.classList.contains('lock')),
        progress: document.getElementById('menuProgress').textContent }));
      eq('an old save finds chamber 21 unlocked', now.d.unlocked, 21);
      ok('…and chambers 22 on still locked', now.grid[20] === false && now.grid.slice(21).every(Boolean),
         JSON.stringify(now.grid.slice(18, 24)));
      ok('every finished chamber is still finished', now.d.done.length === 20 && now.d.done.every((x, k) => x === k));
      ok('every star record is carried over unchanged',
         JSON.stringify(now.d.best) === JSON.stringify(best));
      ok('hints, purchases and granted transactions are carried over',
         now.d.hints === 42 && now.d.removeAds === true && now.d.grantedTx.join() === 'tx-old-1');
      ok('the ad counters are carried over', now.d.chambersSinceAd === 1 && now.d.seamAdsShown === 3);
      ok('the daily hint day, streak and reminder choice are carried over',
         now.d.dailyHintDay === '2026-09-30' && now.d.daily.streak === 4 && now.d.daily.best === 6 &&
         now.d.notify === 'on');
      ok('the rating prompt state is carried over', JSON.stringify(now.rate) === JSON.stringify(rate),
         JSON.stringify(now.rate));
      ok('the menu counts the old progress against the new total',
         now.progress.indexOf('20 / 30 escaped') === 0, now.progress);
      await page.evaluate(() => { localStorage.clear(); });
      await load();
    }

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


    /* ================= 13. seam ad format (the counter fix) =============
       The plain interstitial (every 2 chambers) and the rewarded
       interstitial (every 4) used to count off ONE shared counter, and the
       plain one reset it before the rewarded one could ever be due. Now
       one cadence decides WHEN, and every Nth seam ad is the rewarded
       kind. Simulated here the way game.js drives it: count chambers,
       ask pickSeamAd, spend the counters only when something showed. */
    console.log('\n-- seam ad format --');
    const seam = await page.evaluate(() => {
      const A = window.ECAds, C = window.ECConfig;
      const keep = { a: A.available, i: A._interstitialReady, r: A._rewardedInterstitialReady,
                     rm: A.removeAdsOwned, last: A._lastInterstitialAt };
      A.available = true; A.removeAdsOwned = false;
      A._interstitialReady = true; A._rewardedInterstitialReady = true;
      const run = chambers => {
        let since = 0, shown = 0; const out = [];
        for (let c = 0; c < chambers; c++) {
          since++;
          A._lastInterstitialAt = 0;                 // cooldown long past
          const k = A.pickSeamAd(since, shown);
          if (k) { since = 0; shown++; }
          out.push(k);
        }
        return out;
      };
      const r = { seq: run(16), nth: C.ads.rewardedInterstitialEveryNthAd,
                  every: C.ads.interstitialEveryNChambers };

      A._rewardedInterstitialReady = false;
      r.noRI = run(8).filter(Boolean);
      A._rewardedInterstitialReady = true; A._interstitialReady = false;
      r.noPlain = run(8).filter(Boolean);
      A._interstitialReady = true;

      A._lastInterstitialAt = Date.now();
      r.cooldown = A.pickSeamAd(99, 1);
      A._lastInterstitialAt = 0;
      r.below = A.pickSeamAd(C.ads.interstitialEveryNChambers - 1, 1);
      A.removeAdsOwned = true;
      r.owner = [A.pickSeamAd(99, 0), A.pickSeamAd(99, 1)];
      Object.assign(A, { available: keep.a, _interstitialReady: keep.i,
                         _rewardedInterstitialReady: keep.r, removeAdsOwned: keep.rm,
                         _lastInterstitialAt: keep.last });
      return r;
    });
    const seamShown = seam.seq.filter(Boolean);
    eq('a seam ad is due every Nth chamber, no more', seamShown.length, 16 / seam.every);
    ok('the rewarded interstitial DOES come up (it never used to)',
       seamShown.filter(k => k === 'rewardedInterstitial').length ===
         Math.floor(seamShown.length / seam.nth),
       JSON.stringify(seamShown));
    ok('every Nth seam ad is the rewarded interstitial, the rest plain',
       seamShown.every((k, n) => k === ((n + 1) % seam.nth === 0 ? 'rewardedInterstitial' : 'interstitial')),
       JSON.stringify(seamShown));
    ok('two formats never share a seam',
       seam.seq.every(k => k === null || typeof k === 'string'));
    ok('no rewarded interstitial loaded -> the plain one fills its turn',
       seam.noRI.length === 4 && seam.noRI.every(k => k === 'interstitial'), JSON.stringify(seam.noRI));
    ok('no plain interstitial loaded -> the rewarded one fills the seam',
       seam.noPlain.length === 4 && seam.noPlain.every(k => k === 'rewardedInterstitial'),
       JSON.stringify(seam.noPlain));
    eq('the shared cooldown blocks both formats', seam.cooldown, null);
    eq('nothing below the chamber threshold', seam.below, null);
    ok('Remove ads silences both seam formats',
       seam.owner[0] === null && seam.owner[1] === null);

    /* ================= 14. free daily hint ================= */
    console.log('\n-- daily hint --');
    await page.evaluate(() => localStorage.clear());
    await load();
    const dh0 = await page.evaluate(() => window.ECSave.data.hints);
    ok('the daily hint is offered on a fresh save',
       await page.evaluate(() => window.ECSave.canClaimDailyHint()));
    ok('the menu says it can be claimed',
       /Free hint/.test(await text(page, 'dailyHintTitle')));
    await clickId(page, 'dailyHintBtn');
    eq('claiming pays the configured hint',
       await page.evaluate(() => window.ECSave.data.hints),
       dh0 + await page.evaluate(() => window.ECConfig.hints.dailyFree));
    ok('the menu shows it as claimed', /Claimed/.test(await text(page, 'dailyHintTitle')));
    await clickId(page, 'dailyHintBtn');
    eq('a second tap the same day pays nothing',
       await page.evaluate(() => window.ECSave.data.hints), dh0 + 1);
    await load();
    ok('the claim survives a reload',
       await page.evaluate(() => !window.ECSave.canClaimDailyHint()));
    const dhDays = await page.evaluate(() => {
      const S = window.ECSave, today = S.dayKey();
      const shift = n => { const d = new Date(); d.setDate(d.getDate() + n); return S.dayKey(d); };
      const r = { before: S.data.hints };
      r.yesterday = S.claimDailyHint(shift(-1));     // clock wound back
      r.tomorrow = S.claimDailyHint(shift(1));
      r.tomorrowAgain = S.claimDailyHint(shift(1));
      r.after = S.data.hints;
      r.keyOk = /^\d{4}-\d{2}-\d{2}$/.test(today);
      return r;
    });
    ok('day keys are YYYY-MM-DD', dhDays.keyOk);
    eq('winding the clock back does not pay again', dhDays.yesterday, 0);
    eq('the next calendar day pays once', dhDays.tomorrow, 1);
    eq('and only once', dhDays.tomorrowAgain, 0);
    eq('wallet moved by exactly the one hint', dhDays.after - dhDays.before, 1);
    await page.evaluate(() => localStorage.clear());
    await load();
    await clickId(page, 'dailyHintBtn');
    ok('daily_hint_claimed is logged',
       await page.evaluate(() => window.ECAnalytics.recent.some(e => e.name === 'daily_hint_claimed')));
    ok('the browser never asks for notification permission',
       await page.evaluate(() => window.ECSave.data.notify === 'unasked' &&
                                 !window.ECNotify.available()));
    ok('the reminder toggle is hidden where it cannot work',
       await page.evaluate(() => {
         window.ECShop.render();
         return document.getElementById('shopNotify').style.display === 'none';
       }));

    /* ================= 15. the daily chamber =================
       One generated room per calendar day. "Solvable" is proved three
       ways, cheapest first:
         a. 120 consecutive dates x all five tiers through the GENERATOR:
            never degraded, the clues isolate exactly the key's spot, and
            the safe code follows from the rule and the numbers;
         b. 60 consecutive dates played END TO END by the same auto-solver
            that proves the numbered chambers, through real clicks, at five stars;
         c. the picture agrees with the spatial clues on every one. */
    console.log('\n-- daily chamber: generator, 120 dates x 5 tiers --');
    const START = '2026-10-01';
    const dayList = (from, n) => {
      const out = [], d = new Date(from + 'T12:00:00');
      for (let k = 0; k < n; k++) {
        out.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
                 String(d.getDate()).padStart(2, '0'));
        d.setDate(d.getDate() + 1);
      }
      return out;
    };
    const gen = await page.evaluate(keys => {
      const G = window.ECGame, P = window.ECPuzzle;
      const bad = { degraded: [], hunt: [], code: [], threw: [] };
      const settings = [], tiers = [], seeds = [];
      keys.forEach(key => {
        const spec = G.dailySpec(key);
        tiers.push(spec.tier);
        for (let tier = 1; tier <= 5; tier++) {
          let L;
          try { L = G.genDaily(key, tier); } catch (e) { bad.threw.push(key + '@' + tier + ' ' + e.message); continue; }
          if (tier === 5) { settings.push(L.setting.id); seeds.push(L.seed); }
          if (L.hunt.degraded) bad.degraded.push(key + '@' + tier);
          if (P.solveKeyHunt(L.hunt.evidence) !== L.hunt.answer) bad.hunt.push(key + '@' + tier);
          if (L.puzzle) {
            const facts = L.puzzle.facts.filter(f => typeof f.value === 'number')
                                        .map(f => ({ order: f.order, value: f.value }));
            const code = P.solveFromFacts(L.puzzle.family, L.puzzle.ruleText, facts, L.code.length);
            if (code !== L.code) bad.code.push(key + '@' + tier + ' ' + code + '!=' + L.code);
          }
        }
      });
      return { bad, settings, tiers, seeds };
    }, dayList(START, 120));
    eq('no daily chamber throws in generation', gen.bad.threw.length, 0);
    ok('no daily chamber degrades to naming the spot', gen.bad.degraded.length === 0,
       gen.bad.degraded.slice(0, 5).join(' '));
    ok('the clues isolate the key on every date, every tier', gen.bad.hunt.length === 0,
       gen.bad.hunt.slice(0, 5).join(' '));
    ok('the safe code follows from the rule on every date', gen.bad.code.length === 0,
       gen.bad.code.slice(0, 5).join(' '));
    ok('consecutive days are different rooms',
       gen.settings.every((id, k) => k === 0 || id !== gen.settings[k - 1]));
    eq('the dailies walk every setting, the ten new rooms included', new Set(gen.settings).size, TOTAL);
    eq('no two dates share a seed', new Set(gen.seeds).size, gen.seeds.length);
    ok('a daily seed is never one of the numbered chambers', gen.seeds.every(x => x >= TOTAL));
    ok('the tier cycle uses the configured tiers',
       gen.tiers.every(t => t >= 1 && t <= 5) && new Set(gen.tiers).size >= 3,
       JSON.stringify([...new Set(gen.tiers)]));

    console.log('\n-- daily chamber: 60 dates solved end to end --');
    await page.evaluate(() => localStorage.clear());
    await load();
    await page.evaluate(() => { window.ECSave.data.unlocked = 20; window.ECSave.save(); });
    const dStars = [], dSpatial = [];
    let dSolved = 0, dSpaceClues = 0;
    for (const key of dayList(START, 60)) {
      const r = await solveChamber(page, key);
      if (!r.ok) { ok('daily ' + key + ' solved end to end', false, r.why); break; }
      dSolved++;
      const info = await page.evaluate(() => {
        const st = window.ECGame.state();
        /* Left-to-right order as generated vs as drawn. Two objects hung
           one above the other (a shelf under a portrait) sit within a few
           units of each other in x, and which is "left" of the other is
           not a fact a clue may use — the generator refuses any extreme
           inside a 40-unit margin — so pairs closer than 10 units are not
           compared. Everything a clue CAN say is: any pair further apart
           must be drawn the same way round, and the far-left and far-right
           objects must be the ones the generator thinks they are. */
        const spots = st.hunt.evidence.spots;
        const eyeX = id => { const r = document.getElementById(id).getBoundingClientRect();
                             return r.left + r.width / 2; };
        let spatialOk = true;
        for (const a of spots) for (const b of spots) {
          if (b.x - a.x >= 10 && !(eyeX(a.id) < eyeX(b.id))) spatialOk = false;
        }
        const usesSpace = st.hunt.evidence.clues.some(
          c => c.pred.k === 'extreme' || c.pred.k === 'nearest');
        return { daily: st.daily, spatialOk, usesSpace,
                 stars: (document.querySelector('#winText .starline') || {}).textContent || '',
                 next: document.getElementById('nextBtn').style.display };
      });
      dStars.push(info.stars);
      if (!info.spatialOk) dSpatial.push(key);
      if (info.usesSpace) dSpaceClues++;
      if (info.daily !== key || info.next !== 'none') {
        ok('daily ' + key + ' is in daily mode', false, JSON.stringify(info)); break;
      }
      await clickId(page, 'backBtn');
      await sleep(40);
    }
    eq('60 consecutive daily chambers solved end to end', dSolved, 60);
    eq('a perfect run scores five stars on every daily',
       dStars.filter(x => x === '★★★★★').length, 60);
    ok('clue coordinates match the drawing on every daily', dSpatial.length === 0,
       dSpatial.slice(0, 5).join(' '));
    /* With thirty settings in the walk, 60 dates no longer hold enough
       spatial clues to make the check above mean anything (it found two).
       So the same picture-vs-generator comparison runs over a further 240
       dates — rendered, not played, which is all a coordinate check needs —
       and the non-vacuous guard counts across all 300. */
    const wide = await page.evaluate(keys => {
      const out = { bad: [], space: 0 };
      keys.forEach(key => {
        window.ECGame.startDaily(key, 5);
        const st = window.ECGame.state();
        const spots = st.hunt.evidence.spots;
        const eyeX = id => { const r = document.getElementById(id).getBoundingClientRect();
                             return r.left + r.width / 2; };
        let good = true;
        for (const a of spots) for (const b of spots) {
          if (b.x - a.x >= 10 && !(eyeX(a.id) < eyeX(b.id))) good = false;
        }
        if (!good) out.bad.push(key);
        if (st.hunt.evidence.clues.some(c => c.pred.k === 'extreme' || c.pred.k === 'nearest')) out.space++;
      });
      window.ECGame.showMenu();
      return out;
    }, dayList(START, 300).slice(60));
    ok('clue coordinates match the drawing on 240 further dailies', wide.bad.length === 0,
       wide.bad.slice(0, 5).join(' '));
    ok('some of those dailies really do use a spatial clue (not a vacuous pass)',
       dSpaceClues + wide.space >= 6, 'dailies with a spatial clue: ' + (dSpaceClues + wide.space) + ' of 300');
    ok('daily chambers never enter the record book or the done list',
       await page.evaluate(() => Object.keys(window.ECSave.data.best).length === 0 &&
                                 window.ECSave.data.done.length === 0));

    console.log('\n-- daily chamber: done state, streak, reward --');
    await page.evaluate(() => localStorage.clear());
    await load();
    ok('the menu offers today’s chamber',
       /new room today/i.test(await text(page, 'dailyState')));
    eq('a new player’s daily is capped at the tier they have reached',
       await page.evaluate(() => { window.ECGame.startDaily(); return window.ECGame.state().tier; }), 1);
    await page.evaluate(() => window.ECGame.showMenu());
    const todayKey = await page.evaluate(() => window.ECSave.dayKey());
    const dHints0 = await page.evaluate(() => window.ECSave.data.hints);
    let dr = await solveChamber(page, todayKey + '@1');
    ok('today’s chamber solved', dr.ok, dr.why);
    ok('the win card names the daily and the streak',
       /DAILY CHAMBER/.test(await text(page, 'winTitle')) &&
       /Daily streak: 1 day/.test(await text(page, 'winText')));
    eq('today’s first escape pays the first-clear hint',
       await page.evaluate(() => window.ECSave.data.hints), dHints0 + 1);
    ok('daily_chamber_clear is logged once, with the streak',
       await page.evaluate(() => {
         const e = window.ECAnalytics.recent.filter(x => x.name === 'daily_chamber_clear');
         const c = window.ECAnalytics.recent.filter(x => x.name === 'chamber_clear');
         return e.length === 1 && e[0].params.streak === 1 &&
                c.some(x => x.params.mode === 'daily' && x.params.chamber === 0);
       }));
    await clickId(page, 'backBtn');
    ok('the menu shows today as done, with the streak',
       /Escaped today/.test(await text(page, 'dailyState')) && /🔥 1/.test(await text(page, 'dailyState')));
    dr = await solveChamber(page, todayKey + '@1');
    ok('today’s chamber replayed', dr.ok, dr.why);
    eq('replaying today’s chamber pays nothing',
       await page.evaluate(() => window.ECSave.data.hints), dHints0 + 1);
    await clickId(page, 'backBtn');
    await load();
    ok('done-today survives a reload',
       await page.evaluate(() => window.ECSave.dailyDone()));
    const streak = await page.evaluate(() => {
      const S = window.ECSave;
      S.data.daily = { last: '', streak: 0, best: 0 };
      const r = {};
      r.d1 = S.markDailyDone('2026-10-01').streak;
      r.d1again = S.markDailyDone('2026-10-01');
      r.d2 = S.markDailyDone('2026-10-02').streak;
      r.d3 = S.markDailyDone('2026-10-03').streak;
      r.live3 = S.dailyStreak('2026-10-03');
      r.live4 = S.dailyStreak('2026-10-04');      // not yet played today: still alive
      r.live5 = S.dailyStreak('2026-10-05');      // a day was missed: broken
      r.back = S.markDailyDone('2026-10-02');     // older day: ignored
      r.d6 = S.markDailyDone('2026-10-06').streak;
      r.best = S.data.daily.best;
      r.month = (function () { S.data.daily = { last: '2026-10-31', streak: 4, best: 4 };
                               return S.markDailyDone('2026-11-01').streak; })();
      S.data.daily = { last: '', streak: 0, best: 0 }; S.save();
      return r;
    });
    ok('the streak counts consecutive days', streak.d1 === 1 && streak.d2 === 2 && streak.d3 === 3,
       JSON.stringify(streak));
    ok('the same day twice does not extend it',
       streak.d1again.first === false && streak.d1again.streak === 1);
    ok('the streak is alive until a day is actually missed',
       streak.live3 === 3 && streak.live4 === 3 && streak.live5 === 0, JSON.stringify(streak));
    ok('an older day is ignored', streak.back.first === false && streak.back.streak === 3);
    ok('a missed day restarts the streak at 1, and the best is kept',
       streak.d6 === 1 && streak.best === 3, JSON.stringify(streak));
    eq('the streak carries across a month boundary', streak.month, 5);
    await page.evaluate(() => localStorage.setItem('ec.save', JSON.stringify(
      { hints: 4, daily: { last: 'yesterday', streak: -3, best: 'x' }, dailyHintDay: 42,
        notify: 'maybe', seamAdsShown: -1 })));
    await load();
    ok('junk daily fields are repaired on load',
       await page.evaluate(() => {
         const d = window.ECSave.data;
         return d.daily.last === '' && d.daily.streak === 0 && d.daily.best === 0 &&
                d.dailyHintDay === '' && d.notify === 'unasked' && d.seamAdsShown === 0;
       }));

    /* ================= 16. skip chamber ================= */
    console.log('\n-- skip chamber --');
    await page.evaluate(() => localStorage.clear());
    await load();
    await page.evaluate(() => { window.ECSave.data.unlocked = 3; window.ECSave.save();
                                window.ECGame.startLevel(2); });
    await sleep(60);
    const skipShown = () => page.evaluate(() =>
      document.getElementById('skipBtn').classList.contains('show'));
    ok('no skip offer at the start of a chamber', !await skipShown());
    await page.evaluate(() => window.ECGame._setClock(window.ECConfig.skip.afterSeconds - 1));
    ok('no skip offer just under the threshold', !await skipShown());
    await page.evaluate(() => window.ECGame._setClock(window.ECConfig.skip.afterSeconds));
    ok('the skip offer appears after a long time in one chamber', await skipShown());
    await clickId(page, 'skipBtn');
    ok('the skip dialog opens', await shown(page, 'skipOv'));
    ok('no video button when no video can be shown',
       await page.evaluate(() => document.getElementById('skipWatch').style.display === 'none'));
    await clickId(page, 'skipClose');
    ok('"Keep trying" leaves the chamber alone',
       !await shown(page, 'skipOv') && (await state(page)).cur === 2 && !(await state(page)).escaped);
    const sk0 = await page.evaluate(() => window.ECSave.data.hints);
    await clickId(page, 'skipBtn');
    await clickId(page, 'skipHints');
    const sk = await page.evaluate(() => ({
      hints: window.ECSave.data.hints, done: window.ECSave.isDone(2),
      rec: window.ECSave.bestFor(2), unlocked: window.ECSave.data.unlocked,
      cur: window.ECGame.state().cur, cost: window.ECConfig.skip.hintCost,
      logged: window.ECAnalytics.recent.some(e => e.name === 'skip_chamber' && e.params.method === 'hints'),
      menu: document.getElementById('menu').classList.contains('show') }));
    eq('skipping costs the configured hints and pays no first-clear hint', sk.hints, sk0 - sk.cost);
    ok('the skipped chamber is marked escaped with the minimum star',
       sk.done && sk.rec && sk.rec.stars === 1, JSON.stringify(sk.rec));
    ok('the next chamber is unlocked and opened', sk.unlocked >= 4 && sk.cur === 3 && !sk.menu);
    ok('skip_chamber is logged', sk.logged);
    ok('a skip never overwrites a real record',
       await page.evaluate(() => {
         window.ECSave.recordRun(3, { stars: 4, moves: 5, seconds: 50 });
         window.ECGame.startLevel(3);
         window.ECGame._setClock(999);
         window.ECSave.data.hints = 10;
         document.getElementById('skipBtn').click();
         document.getElementById('skipHints').click();
         return window.ECSave.bestFor(3).stars === 4;
       }));
    ok('a player who cannot afford the skip is offered hints, not skipped',
       await page.evaluate(() => {
         const G = window.ECGame, S = window.ECSave;
         S.data.hints = 1;
         const before = G.state().cur;
         G._setClock(999);
         document.getElementById('skipBtn').click();
         document.getElementById('skipHints').click();
         return G.state().cur === before && S.data.hints === 1 &&
                document.getElementById('hintOv').classList.contains('show') &&
                !document.getElementById('skipOv').classList.contains('show');
       }));
    await clickId(page, 'hintOvClose');
    ok('using every key-hunt hint also opens the skip offer',
       await page.evaluate(() => {
         const G = window.ECGame, S = window.ECSave;
         S.data.hints = 20;
         G.startLevel(0);
         const b = document.getElementById('skipBtn');
         if (b.classList.contains('show')) return false;
         for (let k = 0; k < 8; k++) {
           document.getElementById('hintBtn').click();
           document.getElementById('hpNext').click();
         }
         document.getElementById('hpClose').click();
         return b.classList.contains('show');
       }));
    ok('the daily chamber cannot be skipped',
       await page.evaluate(() => {
         window.ECGame.startDaily();
         window.ECGame._setClock(9999);
         return !window.ECGame.skipEligible() &&
                !document.getElementById('skipBtn').classList.contains('show');
       }));
    await page.evaluate(() => window.ECGame.showMenu());

    /* ================= 17. copy, build line, more games ================= */
    console.log('\n-- copy & menu extras --');
    await page.evaluate(() => localStorage.clear());
    await load();
    const copy = await page.evaluate(() => {
      window.ECShop.render();
      return { shop: document.getElementById('shopOv').textContent,
               note: document.getElementById('shopNote').textContent };
    });
    ok('the shop no longer promises that hint videos survive Remove ads',
       !/videos stay/i.test(copy.shop) && !/stay available/i.test(copy.shop), copy.note);
    ok('the shop says Remove ads takes the hint videos too',
       /hint videos/i.test(copy.note) && /every ad/i.test(copy.shop));
    ok('the build line is hidden from players',
       await page.evaluate(() => getComputedStyle(document.getElementById('buildLine')).display === 'none'));
    for (let k = 0; k < 5; k++) await clickId(page, 'menuTitle');
    ok('five taps on the title reveal the build line',
       await page.evaluate(() => {
         const el = document.getElementById('buildLine');
         return getComputedStyle(el).display !== 'none' &&
                el.textContent.indexOf('build ' + window.ECConfig.build) === 0;
       }));
    eq('the in-app build string matches build.gradle',
       await page.evaluate(() => window.ECConfig.build),
       (() => {
         const g = fs.readFileSync(path.join(__dirname, '..', 'android', 'app', 'build.gradle'), 'utf8');
         return /versionName "([^"]+)"/.exec(g)[1] + ' (' + /versionCode (\d+)/.exec(g)[1] + ')';
       })());

    await page.evaluate(() => { window.__opened = []; window.open = u => { window.__opened.push(u); return null; }; });
    await clickId(page, 'moreBtn');
    ok('the more-games panel opens', await shown(page, 'moreOv'));
    const more = await page.evaluate(() =>
      [...document.querySelectorAll('#moreList .mrow')].map(r => ({
        pkg: r.dataset.pkg, name: r.querySelector('.tt').textContent,
        img: !!(r.querySelector('img') && r.querySelector('img').naturalWidth > 0) })));
    eq('all three sibling games are listed (Trap Jam live since 2026-10-14)', more.map(m => m.pkg).join(),
       'com.ahmadessam.frosttower,com.ahmadessam.adaptivechess,com.ahmadessam.trapjam');
    ok('a game flagged live:false is hidden', await page.evaluate(() => {
      const saved = window.ECConfig.moreGames[2].live;
      window.ECConfig.moreGames[2].live = false;
      const n = (window.ECConfig.moreGames || []).filter(g => g && g.pkg && g.live !== false).length;
      window.ECConfig.moreGames[2].live = saved;
      return n === 2;
    }));
    ok('every listed game has its icon', more.every(m => m.img), JSON.stringify(more));
    await page.evaluate(() => document.querySelector('#moreList .mrow').click());
    eq('a row opens that game’s Play listing',
       await page.evaluate(() => window.__opened.join()),
       'https://play.google.com/store/apps/details?id=com.ahmadessam.frosttower');
    await clickId(page, 'moreClose');
    ok('the panel closes', !await shown(page, 'moreOv'));

    /* ================= 18. analytics events ================= */
    console.log('\n-- analytics --');
    await page.evaluate(() => localStorage.clear());
    await load();
    await page.evaluate(() => { window.ECAnalytics.recent.length = 0; });
    let ar = await solveChamber(page, 0);
    ok('chamber 1 solved for the analytics check', ar.ok, ar.why);
    await clickId(page, 'backBtn');
    await page.evaluate(() => {
      window.ECGame.startLevel(1);
      document.getElementById('hintBtn').click();
      document.getElementById('hpNext').click();
      window.ECSave.data.hints = 0;
      document.getElementById('hpNext').click();       // -> out of hints
      document.getElementById('hintOvClose').click();
      document.getElementById('hpClose').click();
      window.ECGame.showMenu();
      document.getElementById('shopBtn').click();
    });
    await page.evaluate(() => window.ECShop.buy('hints_25'));
    await sleep(150);
    const ev = await page.evaluate(() => window.ECAnalytics.recent);
    const evOf = n => ev.filter(e => e.name === n);
    ok('chamber_start carries the chamber number',
       evOf('chamber_start').some(e => e.params.chamber === 1 && e.params.mode === 'main'));
    ok('chamber_clear carries chamber, seconds, stars and hints_used',
       evOf('chamber_clear').some(e => e.params.chamber === 1 && e.params.stars === 5 &&
         typeof e.params.seconds === 'number' && e.params.hints_used === 0),
       JSON.stringify(evOf('chamber_clear')));
    ok('hint_used is logged', evOf('hint_used').length === 1 && evOf('hint_used')[0].params.free === 1,
       JSON.stringify(evOf('hint_used')));
    ok('out_of_hints_shown is logged', evOf('out_of_hints_shown').length === 1);
    ok('shop_open is logged', evOf('shop_open').length === 1);
    ok('purchase_start and purchase_done name the product',
       evOf('purchase_start').some(e => e.params.product === 'hints_25') &&
       evOf('purchase_done').some(e => e.params.product === 'hints_25'));
    ok('analytics sends nothing off-device and never throws',
       await page.evaluate(() => {
         window.ECAnalytics.log('x', { a: {}, b: NaN, c: true, d: 'y'.repeat(300) });
         const e = window.ECAnalytics.recent[window.ECAnalytics.recent.length - 1];
         return !('a' in e.params) && !('b' in e.params) && e.params.c === 1 && e.params.d.length === 100;
       }));
    ok('the shop works before the stores have answered',
       await page.evaluate(() => {
         document.getElementById('shopClose').click();
         return !document.getElementById('shopOv').classList.contains('show');
       }));

    /* ================= 19. the 1.7.1 review fixes =================
       A 1-star review on 1.5.2: messages flash too fast to read, UV words
       hide behind furniture, you cannot tell what objects are made of, there
       is no list of clues, and the hints are bad. Each is asserted here;
       the UV placement itself is audited room by room in uv-audit.js. */
    console.log('\n-- 1.7.1: messages, notebook, properties, hints --');
    await page.evaluate(() => localStorage.clear());
    await load();
    await page.evaluate(() => { window.ECSave.data.unlocked = 30; window.ECSave.data.hints = 10;
                                window.ECSave.save(); window.ECGame.startLevel(0); });
    await sleep(80);
    const msgShown = () => page.evaluate(() => document.getElementById('toast').classList.contains('show'));

    /* -- messages: a clue stays until tapped; a passing remark gets a real
          reading time and a tap keeps it -- */
    const huntPub = await page.evaluate(() => {
      const s = window.ECGame.state();
      return { spots: s.hunt.evidence.spots, key: window.ECPuzzle.solveKeyHunt(s.hunt.evidence),
               clues: s.hunt.evidence.clues.map(c => c.text) };
    });
    const decoy = huntPub.spots.find(sp => sp.id !== huntPub.key);
    const decoyPhrase = await page.evaluate(tr => window.ECPuzzle.describeTraits(tr)
      .find(p => p.axis === 'made').phrase, decoy.traits);
    const mv0 = (await state(page)).moves;
    await clickId(page, decoy.id);
    ok('searching an object says what it is made of, in the clues’ words',
       (await text(page, 'toast')).indexOf(decoyPhrase) >= 0, await text(page, 'toast'));
    await sleep(6600);
    ok('a clue is still on screen after 6.5 s', await msgShown());
    ok('…and it is marked as kept until tapped',
       await page.evaluate(() => document.getElementById('toast').classList.contains('sticky')));
    await clickId(page, 'toast');
    ok('tapping a clue closes it', !await msgShown());
    ok('message reading time is never under six seconds and grows with length',
       await page.evaluate(() => window.ECGame._readMs('ok') === 6000 &&
         window.ECGame._readMs('x'.repeat(200)) > window.ECGame._readMs('x'.repeat(60))));
    await page.evaluate(() => window.ECGame._toast('A short passing remark.'));
    await sleep(5500);
    ok('a passing message is still up after 5.5 s', await msgShown());
    await clickId(page, 'toast');
    await sleep(1200);
    ok('a tap keeps a passing message past its reading time', await msgShown());
    await clickId(page, 'toast');
    ok('a second tap closes it', !await msgShown());
    const placed = await page.evaluate(() => {
      window.ECGame._toast('Layout check');
      const sc = document.getElementById('scene'), m = sc.getScreenCTM();
      const top = new DOMPoint(0, 0).matrixTransform(m).y, bot = new DOMPoint(800, 560).matrixTransform(m).y;
      const room = { top: Math.min(top, bot), bottom: Math.max(top, bot) };
      const t = document.getElementById('toast').getBoundingClientRect();
      const o = document.getElementById('obs').getBoundingClientRect();
      return { msgClear: t.top >= room.bottom - 1, obsClear: o.bottom <= room.top + 1,
               t: t.top, o: o.bottom, room };
    });
    ok('the message box sits below the room, not over it', placed.msgClear, JSON.stringify(placed));
    ok('the observations panel never hangs over the room', placed.obsClear, JSON.stringify(placed));

    /* -- the notebook -- */
    ok('the notebook button flags something new after a search',
       await page.evaluate(() => document.getElementById('noteBtn').classList.contains('fresh')));
    const hintsBeforeNb = await page.evaluate(() => window.ECSave.data.hints);
    await clickId(page, 'noteBtn');
    ok('the notebook opens from the bag bar', await shown(page, 'noteOv'));
    const nb = await page.evaluate(() => document.getElementById('noteBody').textContent);
    ok('the notebook lists every observation', huntPub.clues.every(c => nb.indexOf(c) >= 0));
    const allProps = await page.evaluate(spots => spots.every(sp =>
      window.ECPuzzle.describeTraits(sp.traits).every(p =>
        document.getElementById('noteBody').textContent.indexOf(p.phrase) >= 0)), huntPub.spots);
    ok('the notebook lists every property of every object (material, build, …)', allProps);
    ok('the notebook marks what has been searched', /searched · nothing/.test(nb));
    ok('reading the notebook costs no move and no hint',
       (await state(page)).moves === mv0 + 1 &&
       await page.evaluate(() => window.ECSave.data.hints) === hintsBeforeNb);
    ok('opening the notebook clears the new-entry flag',
       await page.evaluate(() => !document.getElementById('noteBtn').classList.contains('fresh')));
    await clickId(page, 'noteClose');
    ok('the notebook closes', !await shown(page, 'noteOv'));

    /* A tier 5 room, played up to the lamp: the rule, the numbers and the
       sigils all land in the notebook the moment they can be seen. */
    await page.evaluate(() => window.ECGame.startLevel(16));
    await sleep(60);
    const t5 = await page.evaluate(() => window.ECPuzzle.solveKeyHunt(window.ECGame.state().hunt.evidence));
    await clickId(page, t5);
    await selectItem(page, 'brassKey');
    await clickId(page, 'drawer');
    await selectItem(page, 'uv');
    ok('switching the lamp on says what glows, and keeps it',
       await page.evaluate(() => /Ink glows on the/.test(document.getElementById('toast').textContent) &&
                                 document.getElementById('toast').classList.contains('sticky')));
    const start5 = await page.evaluate(() => window.ECGame.state().puzzle.startSpot);
    if (start5) await clickId(page, start5);
    await clickId(page, 'noteBtn');
    const nb5 = await page.evaluate(() => ({
      body: document.getElementById('noteBody').textContent,
      rule: window.ECGame.state().puzzle.rule,
      short: window.ECGame.state().__answers.puzzle.shortRule,
      seq: window.ECGame.state().__answers.seq.join(' ') }));
    ok('the UV rule is in the notebook, short and in full',
       nb5.body.indexOf(nb5.short) >= 0 && nb5.body.indexOf(nb5.rule) >= 0, nb5.body.slice(0, 200));
    ok('the sigils are in the notebook once seen', nb5.body.indexOf(nb5.seq) >= 0);
    ok('a number found is in the notebook, with its order',
       !start5 || /Numbers found — 1 of \d/.test(nb5.body), nb5.body);
    ok('what was found where is in the notebook', /UV lamp/.test(nb5.body) && /brass key/.test(nb5.body));
    await clickId(page, 'noteClose');

    /* -- the hint panel -- */
    await page.evaluate(() => window.ECGame.startLevel(20));
    await sleep(60);
    await clickId(page, 'hintBtn');
    const hp1 = await page.evaluate(() => ({
      open: document.getElementById('hintPanel').classList.contains('show'),
      where: document.getElementById('hpWhere').textContent,
      steps: document.getElementById('hpSteps').textContent,
      btn: document.getElementById('hpNext').textContent,
      goal: document.getElementById('hpGoal').textContent,
      hints: window.ECSave.data.hints }));
    ok('💡 opens the hint panel instead of spending', hp1.open && hp1.hints === 10, JSON.stringify(hp1));
    ok('the panel names the goal and which step comes next',
       /key/.test(hp1.goal) && /^Step 1 of \d · Nudge$/.test(hp1.where), JSON.stringify(hp1));
    ok('the ladder is shown as nudge → narrow → reveal',
       /Nudge/.test(hp1.steps) && /Narrow/.test(hp1.steps) && /Reveal/.test(hp1.steps), hp1.steps);
    ok('the button says the first nudge is free before it is pressed', /free/.test(hp1.btn), hp1.btn);
    await clickId(page, 'hpNext');
    const hp2 = await page.evaluate(() => ({
      list: document.getElementById('hpList').textContent,
      where: document.getElementById('hpWhere').textContent,
      btn: document.getElementById('hpNext').textContent,
      hints: window.ECSave.data.hints }));
    ok('the free nudge stays free', hp2.hints === 10);
    ok('the step bought stays readable in the panel and points at the notebook',
       /Nudge/.test(hp2.list) && /notebook/i.test(hp2.list), hp2.list);
    ok('the next step and its price are shown before buying',
       /^Step 2 of \d/.test(hp2.where) && /1 💡/.test(hp2.btn), JSON.stringify(hp2));
    await clickId(page, 'hpClose');
    await clickId(page, 'noteBtn');
    ok('hints taken are kept in the notebook too',
       /Hints you took/.test(await text(page, 'noteBody')));
    await clickId(page, 'noteClose');
    /* The safe gets a full ladder now, ending in a reveal. */
    await page.evaluate(() => window.ECGame.startLevel(16));
    await sleep(60);
    const k16 = await page.evaluate(() => window.ECPuzzle.solveKeyHunt(window.ECGame.state().hunt.evidence));
    await clickId(page, k16);
    await selectItem(page, 'brassKey');
    await clickId(page, 'drawer');
    await selectItem(page, 'uv');
    await clickId(page, 'hintBtn');
    const safeLadder = await page.evaluate(() => {
      const r = { goal: document.getElementById('hpGoal').textContent,
                  steps: document.getElementById('hpSteps').textContent };
      for (let k = 0; k < 3; k++) document.getElementById('hpNext').click();
      r.list = document.getElementById('hpList').textContent;
      r.code = window.ECGame.state().__answers.code.split('').join(' ');
      r.btn = document.getElementById('hpNext').textContent;
      r.disabled = document.getElementById('hpNext').disabled;
      return r;
    });
    ok('stuck at the safe, the ladder is nudge → narrow → reveal',
       /Open the/.test(safeLadder.goal) && /Nudge/.test(safeLadder.steps) && /Reveal/.test(safeLadder.steps),
       JSON.stringify(safeLadder));
    ok('the safe’s last step reveals the code', safeLadder.list.indexOf(safeLadder.code) >= 0, safeLadder.list);
    ok('with every step bought the button says so and sells nothing',
       safeLadder.disabled && /All steps shown/.test(safeLadder.btn));
    await clickId(page, 'hpClose');
    await page.evaluate(() => window.ECGame.showMenu());

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
