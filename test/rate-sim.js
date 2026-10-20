/* =====================================================================
   Rate prompt — browser suite (identical copy in all three games)
   ---------------------------------------------------------------------
   Drives the REAL seam button of the game (win card / game-over card /
   clear card) and checks: not due after 1 finished level, due after 2,
   the prompt replaces the seam ad, Later backs off (5 more levels, then
   10 between every ask after that), Rate opens the Play listing and stops
   it for good (also across a reload), and "Don't ask again" stops it too.
       node test/rate-sim.js
   ===================================================================== */
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'www');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
                '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

/* Which button is the seam, per game, and what "proceeded" looks like. */
const GAMES = {
  'escape-chambers': { pkg: 'com.ahmadessam.escapechambers', seam: 'backBtn' },
  'frost-tower':     { pkg: 'com.ahmadessam.frosttower',     seam: 'againBtn' },
  'trap-jam':        { pkg: 'com.ahmadessam.trapjam',        seam: 'mapBtn' }
};
const GAME = GAMES[path.basename(path.join(__dirname, '..'))];

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

(async () => {
  const { server, port } = await startServer();
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  const load = async () => {
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);
    await page.evaluate(() => {
      window.__opened = [];
      window.open = u => { window.__opened.push(u); return null; };
    });
  };
  const st = () => page.evaluate(() => RatePrompt._state());
  const open = () => page.evaluate(() => RatePrompt.isOpen());
  const seam = () => page.evaluate(id => document.getElementById(id).click(), GAME.seam);
  const tap = id => page.evaluate(i => document.getElementById(i).click(), id);

  try {
    await load();
    ok('RatePrompt loaded', await page.evaluate(() => !!window.RatePrompt));
    await page.evaluate(() => RatePrompt._reset());

    await page.evaluate(() => RatePrompt.tick());
    ok('not due after 1 level', !(await page.evaluate(() => RatePrompt.due())));
    await seam(); await sleep(300);
    ok('seam after 1 level shows no prompt', !(await open()));

    await load();   // leave whatever the seam started
    await page.evaluate(() => { RatePrompt._reset(); RatePrompt.tick(); RatePrompt.tick(); });
    ok('due after 2 levels', await page.evaluate(() => RatePrompt.due()));
    await seam(); await sleep(300);
    ok('seam shows the prompt', await open());
    const title = await page.evaluate(() => document.getElementById('rpTitle').textContent);
    ok('prompt names the game', /^Rate .+/.test(title), title);
    const txt = await page.evaluate(() => document.getElementById('ratePrompt').innerText.toLowerCase());
    ok('copy does not ask if they like it', !/enjoy|like|love/.test(txt), txt);

    await tap('rpLater'); await sleep(300);
    ok('Later closes it', !(await open()));
    let s = await st();
    ok('Later resets the count, not rated', s.count === 0 && !s.rated && !s.never, JSON.stringify(s));

    /* Back-off: after the first Later the next ask is 5 levels away, not
       2; after a second Later it is 10, and it stays 10. */
    ok('first Later is counted', s.laters === 1, JSON.stringify(s));
    await load();
    await page.evaluate(() => { for (let i = 0; i < 4; i++) RatePrompt.tick(); });
    ok('not due 4 levels after the first Later', !(await page.evaluate(() => RatePrompt.due())));
    await seam(); await sleep(300);
    ok('seam 4 levels after Later shows no prompt', !(await open()));
    await load();
    await page.evaluate(() => RatePrompt.tick());
    ok('due 5 levels after the first Later', await page.evaluate(() => RatePrompt.due()));
    await seam(); await sleep(300);
    ok('asks again 5 levels after Later', await open());
    await tap('rpLater'); await sleep(300);

    await load();
    s = await st();
    ok('back-off survives a reload', s.laters === 2 && s.count === 0, JSON.stringify(s));
    await page.evaluate(() => { for (let i = 0; i < 9; i++) RatePrompt.tick(); });
    ok('not due 9 levels after the second Later', !(await page.evaluate(() => RatePrompt.due())));
    await page.evaluate(() => RatePrompt.tick());
    await seam(); await sleep(300);
    ok('asks again 10 levels after the second Later', await open());
    await tap('rpLater'); await sleep(300);

    await load();
    await page.evaluate(() => { for (let i = 0; i < 9; i++) RatePrompt.tick(); });
    ok('the gap holds at 10 after a third Later', !(await page.evaluate(() => RatePrompt.due())));
    await page.evaluate(() => RatePrompt.tick());
    await seam(); await sleep(300);
    ok('asks again 10 levels after the third Later', await open());
    await tap('rpRate'); await sleep(300);
    s = await st();
    ok('Rate marks rated', s.rated === true, JSON.stringify(s));
    const opened = await page.evaluate(() => window.__opened);
    ok('Rate opens the Play listing',
       opened.length === 1 && opened[0] === 'https://play.google.com/store/apps/details?id=' + GAME.pkg,
       JSON.stringify(opened));

    await load();
    s = await st();
    ok('rated survives a reload', s.rated === true, JSON.stringify(s));
    await page.evaluate(() => { for (let i = 0; i < 6; i++) RatePrompt.tick(); });
    await seam(); await sleep(300);
    ok('never asks again once rated', !(await open()));

    await load();
    await page.evaluate(() => { RatePrompt._reset(); RatePrompt.tick(); RatePrompt.tick(); });
    await seam(); await sleep(300);
    await tap('rpNever'); await sleep(300);
    await load();
    await page.evaluate(() => { for (let i = 0; i < 6; i++) RatePrompt.tick(); });
    await seam(); await sleep(300);
    s = await st();
    ok("Don't ask again sticks", !(await open()) && s.never && !s.rated, JSON.stringify(s));

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
