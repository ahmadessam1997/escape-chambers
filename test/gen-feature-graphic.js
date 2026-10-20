/* =====================================================================
   Escape Chambers — Play Store feature graphic generator (1024x500)
   ---------------------------------------------------------------------
   Run:  node test/gen-feature-graphic.js
   Writes play-assets/feature-graphic.png. Recreated 2026-10-03 for the
   1.7.0 rename ("Escape: 20 Chambers" -> "Escape Chambers"); the
   original 1.6.0 graphic is kept as play-assets/feature-graphic-1.6.0.png.
   Same layout: app icon tile on the left, serif title, gold tagline.
   ===================================================================== */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'play-assets');
const icon = 'data:image/png;base64,' +
  fs.readFileSync(path.join(OUT, 'play-icon-512.png')).toString('base64');

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1024px;height:500px;overflow:hidden;position:relative;
    background:linear-gradient(160deg,#0d1220 0%,#121a2c 55%,#0f1626 100%);}
  .glow{position:absolute;width:840px;height:840px;left:585px;top:-190px;border-radius:50%;filter:blur(18px);
    background:radial-gradient(circle,rgba(66,62,62,.95) 0%,rgba(60,58,60,.9) 50%,rgba(52,52,58,.75) 62%,transparent 71%);}
  .tile{position:absolute;left:70px;top:100px;width:260px;height:260px;border-radius:62px;
    box-shadow:0 18px 50px rgba(0,0,0,.55);overflow:hidden;}
  .tile img{width:264px;height:264px;margin:-2px;display:block}
  h1{position:absolute;left:390px;top:112px;width:610px;color:#efe3c8;
    font-family:Georgia,'Times New Roman',serif;font-weight:400;
    font-size:84px;line-height:1.02;letter-spacing:.07em;
    text-shadow:0 6px 26px rgba(0,0,0,.55);}
  p{position:absolute;left:390px;top:310px;width:600px;color:#e8a84c;
    font-family:Georgia,'Times New Roman',serif;font-weight:700;
    font-size:33px;line-height:1.15;}
</style></head><body>
  <div class="glow"></div>
  <div class="tile"><img src="${icon}"></div>
  <h1>ESCAPE<br>CHAMBERS</h1>
  <p>Hidden keys. Glowing ink.<br>Locked doors.</p>
</body></html>`;

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 500, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 200));
  const out = path.join(OUT, 'feature-graphic.png');
  await page.screenshot({ path: out });
  await browser.close();
  console.log('wrote ' + out);
})().catch(e => { console.error(e); process.exit(1); });
