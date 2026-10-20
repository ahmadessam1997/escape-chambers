/* Renders the Escape Chambers ad (v1.7.0) from the live game.
   Build the capture copy first:  node make-ecgame.js
   Then:  node ecrender.js            -> all frames into ec_frames/ (or $EC_FRAMES)
          node ecrender.js t=34.5     -> one preview.png at that time
   Encode: ffmpeg -framerate 30 -i f_%05d.png -c:v libx264 -preset slow -crf 18|22
           -pix_fmt yuv420p -profile:v high -level 4.0 -r 30 -an, then mux silent AAC
           (anullsrc 48k stereo, -shortest, -c:a aac -b:a 96k -movflags +faststart). */
const puppeteer = require('puppeteer-core');
const path = require('path'), fs = require('fs');

const GAME = path.join(__dirname, 'ecgame', 'index.html');
const OUT = process.env.EC_FRAMES || path.join(__dirname, 'ec_frames');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FPS = 30;

(async () => {
  const only = process.argv[2];
  if (!only) { fs.rmSync(OUT, { recursive: true, force: true }); }
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--allow-file-access-from-files', '--hide-scrollbars',
      '--font-render-hinting=none', '--force-color-profile=srgb']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 540, height: 960, deviceScaleFactor: 2 });
  page.on('pageerror', e => console.error('PAGE ERROR:', e.message));

  await page.goto('file:///' + GAME.replace(/\\/g, '/'), { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 1400));
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'ecoverlay.js'), 'utf8') });

  const total = await page.evaluate(async () => {
    window.ECSave.data.unlocked = 30;
    window.ECSave.data.hints = 9;
    window.__EC_AD.build();
    await document.fonts.ready;
    const sc = document.getElementById('scene');
    if (sc) { sc.style.transformOrigin = '50% 46%'; sc.style.willChange = 'transform'; }
    window.__ad = { scene: null, roomName: '' };
    return window.__EC_AD.total;
  });

  async function frame(t) {
    return page.evaluate(async (t) => {
      const AD = window.__EC_AD, A = window.__ad;
      const sc = AD.sceneAt(t);
      const idx = AD.scenes.indexOf(sc);

      if (A.scene !== idx) {
        A.scene = idx;
        document.body.classList.remove('uv');
        if (!sc.end) {
          if (sc.daily) window.ECGame.startDaily();
          else window.ECGame.startLevel(sc.lv);
          await new Promise(r => setTimeout(r, 260));
          if (sc.uv) { window.__EC.give('uv'); window.__EC.setUV(true); }
          if (sc.win) { window.__EC.setTime(96); window.__EC.flawless(); await new Promise(r => setTimeout(r, 500)); }
          A.roomName = document.getElementById('roomTitle').textContent || '';
        }
      }

      const z = AD.camera(t);
      const el = document.getElementById('scene');
      if (el) el.style.transform = 'scale(' + z + ')';

      AD.paint(t, A.roomName);
    }, t);
  }

  if (only) {
    const t = parseFloat(only.split('=')[1]);
    const sc = await page.evaluate(t => ({ t0: window.__EC_AD.sceneAt(t).t0 }), t);
    for (let tt = sc.t0; tt < t; tt += 1 / FPS) await frame(tt);
    await frame(t);
    await page.screenshot({ path: path.join(OUT, 'preview.png') });
    console.log('preview at t=' + t);
    await browser.close();
    return;
  }

  const n = Math.round(total * FPS);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await frame(i / FPS);
    await page.screenshot({
      path: path.join(OUT, 'f_' + String(i).padStart(5, '0') + '.png'),
      optimizeForSpeed: true
    });
    if (i % 90 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log(`${i}/${n}  ${el.toFixed(0)}s  eta ${(el / (i + 1) * (n - i)).toFixed(0)}s`);
    }
  }
  console.log('done ' + n + ' frames in ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
  await browser.close();
})();
