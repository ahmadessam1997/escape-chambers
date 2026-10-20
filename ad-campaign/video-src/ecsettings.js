/* Lists every chamber (and today's Daily Chamber) with its tier, setting and
   room title, from the ecgame capture copy (build it with make-ecgame.js). */
const puppeteer = require('puppeteer-core');
const path = require('path');
const GAME = path.join(__dirname, 'ecgame', 'index.html');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--allow-file-access-from-files', '--hide-scrollbars']
  });
  const p = await b.newPage();
  await p.setViewport({ width: 540, height: 960, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.error('PAGE ERROR:', e.message));
  await p.goto('file:///' + GAME.replace(/\\/g, '/'), { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 1200));
  const n = await p.evaluate(() => {
    const n = window.ECGame.TOTAL || (window.ECGame.state && window.ECGame.state().total) || 30;
    window.ECSave.data.unlocked = n;
    return n;
  });
  const out = [];
  for (let i = 0; i <= n; i++) {
    const daily = i === n;
    await p.evaluate((j, d) => d ? window.ECGame.startDaily() : window.ECGame.startLevel(j), i, daily);
    await new Promise(r => setTimeout(r, 260));
    const s = await p.evaluate(() => {
      const st = window.ECGame.state();
      return {
        setting: st.setting, tier: st.tier,
        uv: window.__EC ? window.__EC.L.tier >= 4 : null,
        title: document.getElementById('roomTitle').textContent
      };
    });
    out.push((daily ? 'daily' : i) + '\t' + s.tier + '\t' + s.setting + '\t' + s.title);
  }
  console.log(out.join('\n'));
  await b.close();
})();
