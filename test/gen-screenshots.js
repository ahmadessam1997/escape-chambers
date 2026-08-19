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

/* Rewritten 2026-08-18. The old set sold a SEARCH game: "twenty locked
   rooms", "five strange places" (there are twenty now), "hints when you
   need them". The game is a DEDUCTION game, so shot 1 has to show the
   evidence panel — that is the thing no competitor screenshot has. */
const SHOTS = [
  { id: 'clues',   caption: 'THE ROOM TELLS YOU\nWHERE TO LOOK' },
  { id: 'rooms',   caption: 'TWENTY ROOMS,\nTWENTY WORLDS' },
  { id: 'uv',      caption: 'DEDUCE IT —\nDON’T HUNT IT' },
  { id: 'sigil',   caption: 'CRACK SAFES\nBY REASONING' },
  { id: 'stars',   caption: 'FIVE STARS FOR A\nFLAWLESS ESCAPE' },
  { id: 'menu',    caption: 'HOW MANY\nCAN YOU READ?' }
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

  /* --- 1. clues: the observations panel OPEN, which is the whole pitch.
         A screenshot of a room full of objects looks like every other
         escape game; a screenshot of the room telling you where to look
         does not. Chamber 1 is the cell block — bars read instantly. --- */
  await enterChamber(page, 0, []);
  await page.evaluate(() => {
    document.getElementById('obs').classList.add('show');
    const S = window.ECGame.state().S;
    S.items.brassKey = true;
    document.getElementById('s0').className = 'slot item';
    document.getElementById('s0').innerHTML = '🗝️<span class="lbl">brass key</span>';
  });
  await sleep(300);
  await grab('clues');

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

  /* --- 2. rooms: the sealed tomb. Sandstone and glyphs against shot 1's
         stone cell proves the twenty settings are real, not recolours. --- */
  await enterChamber(page, 2, ['plant', 'shelf', 'pB', 'chest']);
  await page.evaluate(() => document.getElementById('obs').classList.remove('show'));
  await sleep(200);
  await grab('rooms');

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

  /* --- 5. stars: a FLAWLESS win card. The shop used to hold this slot,
         which sold the monetisation rather than the game. Stars are the
         reason to replay, so they earn the shelf space. --- */
  await page.evaluate(() => {
    ['symOv','padOv','winOv','hintOv','menu','shopOv','rankOv'].forEach(id =>
      document.getElementById(id).classList.remove('show'));
  });
  await enterChamber(page, 0, []);
  await page.evaluate(() => {
    /* Play it properly rather than faking the card: deduce the spot, take
       the key, open the door. A staged screenshot of a five-star win that
       the game cannot actually produce would be a lie in the listing. */
    const s0 = window.ECGame.state();
    const spot = window.ECPuzzle.solveKeyHunt(s0.hunt.evidence);
    document.getElementById(spot).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await sleep(250);
  await page.evaluate(() => {
    for (let i = 0; i < 4; i++) {
      const sl = document.getElementById('s' + i);
      if (sl.dataset.item === 'ironKey') sl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
  await sleep(200);
  await page.evaluate(() =>
    document.getElementById('door').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await sleep(600);
  await grab('stars');

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
