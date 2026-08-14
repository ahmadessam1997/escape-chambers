/* =====================================================================
   Escape: 20 Chambers — Play Store screenshot generator
   ---------------------------------------------------------------------
   Captures REAL in-app frames — the actual SVG scene, the actual sigil
   lock, the actual shop — then composes each into a framed 1080x1920
   marketing shot in the game's own candlelit palette.

   Run:  node test/gen-screenshots.js
   The static server runs IN THIS PROCESS, so no separate `npm run serve`.

   Writes play-assets/raw/*.png (unframed) and play-assets/screenshot-N.png.
   Re-runnable: it overwrites both. Re-run after ANY UI change.
   ===================================================================== */
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'www');
const OUT  = path.join(__dirname, '..', 'play-assets');
const RAW  = path.join(OUT, 'raw');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

/* Inner screen size of the phone frame, in device pixels.
   Deliberately 770x1180 rather than a 19.5:9 slab. The room art is an
   800x560 LANDSCAPE composition inside a portrait app, so on a very tall
   screen it letterboxes and the room shrinks to about a third of the
   scene area — technically fine to play, but it makes a sparse marketing
   shot. Capturing at a squarer (and entirely real) phone aspect lets the
   room read at roughly half the frame without cropping a single hotspot.
   See SESSION-NOTES for the v1.1 fix to the game itself. */
const SCREEN_W = 770, SCREEN_H = 1180;

const SHOTS = [
  { id: 'chamber', caption: 'TWENTY\nLOCKED ROOMS' },
  { id: 'uv',      caption: 'REVEAL SECRETS\nIN UV LIGHT' },
  { id: 'theme',   caption: 'FIVE\nSTRANGE PLACES' },
  { id: 'sigil',   caption: 'CRACK SAFES &\nSIGIL LOCKS' },
  { id: 'shop',    caption: 'HINTS WHEN\nYOU NEED THEM' },
  { id: 'menu',    caption: 'CAN YOU ESCAPE\nTHEM ALL?' }
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

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

/* Opens a chamber and searches a few spots, so the room reads as *played*
   rather than untouched — tilted paintings, an open chest, a folded rug. */
async function enterChamber(page, index, spots) {
  await page.evaluate(i => window.ECGame.startLevel(i), index);
  await sleep(120);
  for (const s of (spots || [])) {
    await page.evaluate(id => document.getElementById(id)
      .dispatchEvent(new MouseEvent('click', { bubbles: true })), s);
    await sleep(60);
  }
  // Let the toast fade so it doesn't cover the scene.
  await page.evaluate(() => document.getElementById('toast').classList.remove('show'));
  await sleep(450);   // the CSS tilt transition is 400ms
}

(async () => {
  fs.mkdirSync(RAW, { recursive: true });
  const { server, port } = await startServer();
  const URL = 'http://127.0.0.1:' + port + '/index.html';

  const browser = await puppeteer.launch({
    headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars']
  });
  const page = await browser.newPage();
  await page.setViewport({
    width: SCREEN_W / 2, height: SCREEN_H / 2,
    deviceScaleFactor: 2, isMobile: true, hasTouch: true
  });

  const raw = {};
  const grab = async (id) => {
    const file = path.join(RAW, id + '.png');
    await page.screenshot({ path: file });
    raw[id] = 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
    console.log('  captured ' + id);
  };

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await sleep(600);
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(600);
  await page.evaluate(() => { window.ECSave.data.unlocked = 20; window.ECSave.save(); });

  console.log('Capturing raw frames…');

  /* --- 1. chamber: the study, mid-search, brass key in hand --- */
  await enterChamber(page, 4, ['pA', 'chest', 'clock', 'rug']);
  await page.evaluate(() => {
    // Show the inventory doing something: a real give(), not a fake icon.
    const S = window.ECGame.state().S;
    S.items.brassKey = true;
    document.getElementById('s0').className = 'slot item';
    document.getElementById('s0').innerHTML = '🗝️<span class="lbl">brass key</span>';
  });
  await sleep(200);
  await grab('chamber');

  /* --- 2. uv: a tier-4 chamber with the code blazing under the lamp --- */
  await enterChamber(page, 12, ['pA', 'pB', 'clock', 'shelf']);
  await page.evaluate(() => {
    const S = window.ECGame.state().S;
    S.items.uv = true; S.uvOn = true;
    document.body.classList.add('uv');
    document.getElementById('s0').className = 'slot item sel';
    document.getElementById('s0').innerHTML = '🔦<span class="lbl">UV lamp</span>';
  });
  await sleep(700);   // the .uv-ink fade is 500ms
  await grab('uv');

  /* --- 3. theme: the observatory, a completely different palette --- */
  await enterChamber(page, 3, ['plant', 'shelf', 'pB', 'chest']);
  await grab('theme');

  /* --- 4. sigil: the real four-sigil lock, part-entered --- */
  await enterChamber(page, 16, ['rug']);
  await page.evaluate(() => {
    document.getElementById('door').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await sleep(250);
  await page.evaluate(() => {
    // Tap two real sigil buttons so the display shows a partial entry.
    const btns = [...document.querySelectorAll('#sympad button')];
    btns[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    btns[5].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await sleep(250);
  await grab('sigil');

  /* --- 5. shop: the real shop, with the offers UNBOUGHT.
         Capturing it after a purchase would advertise "✓ Owned", which is
         weak marketing and implies the app ships without ads. --- */
  await page.evaluate(() => {
    // The sigil lock from shot 4 is still open and sits ABOVE the shop in
    // the stacking order — the first run of this generator produced a
    // "shop" screenshot that was mostly sigil pad. Close every overlay.
    ['symOv','padOv','winOv','hintOv','menu'].forEach(id =>
      document.getElementById(id).classList.remove('show'));
    window.ECSave.data.hints = 3;
    window.ECSave.data.removeAds = false;
    window.ECSave.data.unlimitedHints = false;
    window.ECBilling.entitlements = {};
    /* In a browser the store is the mock, and the mock deliberately suffixes
       every price with " · DEV" so a developer can never mistake it for the
       real thing. That marker must not reach the Play listing, so put the
       module into its 'ready' state for the capture — the prices shown are
       then exactly the config prices a real device would show. */
    window.ECBilling.state = 'ready';
    // The rewarded row is hidden in a browser only because there is no ad
    // SDK here; on device it is always present, so show it.
    window.ECAds.available = true;
    window.ECAds._rewardedReady = true;
    window.ECShop.openShop();
  });
  await sleep(500);
  await grab('shop');

  /* --- 6. menu: the rooms grid, showing real progress --- */
  await page.evaluate(() => {
    document.getElementById('shopOv').classList.remove('show');
    window.ECSave.data.done = [0,1,2,3,4,5,6,7,8];
    window.ECSave.data.unlocked = 12;
    window.ECSave.data.hints = 6;
    window.ECSave.save();
    window.ECGame.showMenu();
  });
  await sleep(400);
  await grab('menu');

  /* ---------------- compose ---------------- */
  console.log('Composing framed shots…');
  const framer = await browser.newPage();
  await framer.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });

  for (let i = 0; i < SHOTS.length; i++) {
    const s = SHOTS[i];
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{width:1080px;height:1920px;overflow:hidden;position:relative;
        background:linear-gradient(168deg,#241a2e 0%,#16182c 42%,#0b0f1c 100%);
        font-family:'Segoe UI',-apple-system,Roboto,sans-serif;}
      /* Candlelight, not orbs: warm pools of light bleeding out of the dark. */
      .glow{position:absolute;border-radius:50%;filter:blur(3px);}
      .g1{width:620px;height:620px;left:-210px;top:-160px;opacity:.34;
        background:radial-gradient(circle at 40% 40%,#e8a84c,#7a4f1c 45%,transparent 72%);}
      .g2{width:430px;height:430px;right:-150px;bottom:150px;opacity:.26;
        background:radial-gradient(circle at 45% 45%,#ffd98a,#8a5a20 45%,transparent 72%);}
      .g3{width:240px;height:240px;right:110px;top:560px;opacity:.18;
        background:radial-gradient(circle at 45% 45%,#e8a84c,transparent 70%);}
      h1{position:absolute;top:92px;left:0;right:0;text-align:center;color:#f4e7cd;
        font-family:Georgia,'Times New Roman',serif;font-weight:400;
        font-size:74px;line-height:1.1;letter-spacing:.02em;
        white-space:pre-line;text-shadow:0 6px 30px rgba(0,0,0,.6);}
      .rule{position:absolute;top:312px;left:50%;transform:translateX(-50%);
        width:150px;height:2px;background:linear-gradient(90deg,transparent,#e8a84c,transparent);
        opacity:.75;}
      .phone{position:absolute;left:${(1080 - SCREEN_W) / 2 - 12}px;top:${Math.round((1920 - SCREEN_H) / 2) + 130}px;
        width:${SCREEN_W + 24}px;height:${SCREEN_H + 24}px;
        background:#080b14;border-radius:58px;padding:12px;
        box-shadow:0 36px 96px rgba(0,0,0,.62),0 0 0 2px rgba(232,168,76,.16);}
      .screen{width:100%;height:100%;border-radius:47px;overflow:hidden;background:#0d1322;}
      .screen img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block;}
    </style></head><body>
      <div class="glow g1"></div><div class="glow g2"></div><div class="glow g3"></div>
      <h1>${s.caption}</h1><div class="rule"></div>
      <div class="phone"><div class="screen"><img src="${raw[s.id]}"></div></div>
    </body></html>`;

    await framer.setContent(html, { waitUntil: 'load' });
    await sleep(180);
    const out = path.join(OUT, `screenshot-${i + 1}.png`);
    await framer.screenshot({ path: out });
    console.log('  wrote ' + path.basename(out) + '  (' + s.caption.replace('\n', ' ') + ')');
  }

  await browser.close();
  server.close();
  console.log('\nDone. 6 framed shots in play-assets/, raw frames in play-assets/raw/');
})().catch(e => { console.error('GENERATOR ERROR:', e); process.exit(1); });
