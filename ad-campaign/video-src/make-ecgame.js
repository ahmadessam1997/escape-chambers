/* Builds the capture copy of Escape Chambers used by ecrender.js / ecsettings.js.
   Copies ../../www (never modified) to ./ecgame, appends a small window.__EC
   harness to js/game.js, and stages the ad fonts + app icon under ecgame/ad/.

     node make-ecgame.js [targetDir]

   The ecgame copy is disposable; delete it after rendering. */
const fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');                // escape-chambers/
const WWW = path.join(ROOT, 'www');
const DST = path.resolve(process.argv[2] || path.join(__dirname, 'ecgame'));
const ICON = path.join(ROOT, 'play-assets', 'play-icon-512.png');
/* Inter 700/800/900 — the same files every ad in this workspace uses. */
const FONTS = path.resolve(ROOT, '..', 'trap-jam', 'ad-campaign', 'video-src', 'assets', 'ad', 'fonts');

fs.rmSync(DST, { recursive: true, force: true });
fs.cpSync(WWW, DST, { recursive: true });

const gp = path.join(DST, 'js', 'game.js');
let s = fs.readFileSync(gp, 'utf8');
const HOOK = `

  /* ===== capture harness (not in the shipping build) ===== */
  global.__EC = {
    get S() { return S; },
    get L() { return L; },
    get cur() { return cur; },
    give: function (n) { give(n); },
    setUV: function (on) {
      S.uvOn = !!on;
      document.body.classList.toggle('uv', S.uvOn);
      renderInv();
    },
    /* film a flawless escape: par moves, then the game's own win card */
    flawless: function () {
      S.moves = parFor(L);
      escape();
    },
    parFor: function () { return parFor(L); },
    setTime: function (sec) { t = sec; }
  };
`;
const idx = s.trimEnd().lastIndexOf('})(window);');
if (idx < 0) throw new Error('game.js: closing "})(window);" not found');
s = s.slice(0, idx) + HOOK + '\n' + s.slice(idx);
fs.writeFileSync(gp, s, 'utf8');

fs.mkdirSync(path.join(DST, 'ad', 'fonts'), { recursive: true });
for (const w of ['700', '800', '900']) {
  fs.copyFileSync(path.join(FONTS, 'Inter-' + w + '.ttf'), path.join(DST, 'ad', 'fonts', 'Inter-' + w + '.ttf'));
}
fs.copyFileSync(ICON, path.join(DST, 'ad', 'icon.png'));
console.log('ecgame ready at ' + DST);
