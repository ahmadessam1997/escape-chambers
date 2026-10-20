/* =====================================================================
   Escape Chambers — UV ink audit (1.7.1)
   ---------------------------------------------------------------------
   A 1-star review: "when u have to use the flashlight, the words go behind
   the objects in the room and are cut off". Measured on 1.7.0 it was true:
   "(1st x 2nd) + (3rd x 4th)" ran behind the clock in chamber XXI and the
   six-sentence logic rules ran off both edges of the screen.

   This renders EVERY numbered chamber and 300 consecutive daily chambers
   at three phone sizes, switches the lamp on, and fails if any glyph of
   the UV writing — the safe rule on the wall, and the sigils on the floor
   covering — is:
     - off the screen, under the top bar or under the bag bar;
     - overlapping any piece of furniture other than the object it is
       written on (the wall rule is painted on top of everything, so the
       hit test alone would always pass; the furniture boxes are the real
       check there);
     - covered by anything drawn later (hit test at the glyph's centre —
       this is the one that matters for the sigils, which live in the rug);
     - under the observations panel or the message box;
     - rendered smaller than MIN_PX on screen.
       node test/uv-audit.js
   ===================================================================== */
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'www');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
                '.png': 'image/png' };
const VIEWPORTS = [
  { width: 385, height: 770, deviceScaleFactor: 2 },
  { width: 360, height: 640, deviceScaleFactor: 2 },
  { width: 412, height: 915, deviceScaleFactor: 2.62 }
];
const DAILIES = 300;
const START = '2026-10-01';
/* Smallest acceptable glyph size, CSS px, for the wall rule. The room is
   a landscape picture in a portrait phone, so everything in it is small;
   9px Georgia with a dark halo is the floor for comfortable reading at
   360 wide. */
const MIN_PX = 9;

let passed = 0, failed = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else {
    failed++; failures.push(name + (detail ? ' — ' + detail : ''));
    console.log('  FAIL  ' + name + (detail ? '  [' + detail + ']' : ''));
  }
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

function dayList(from, n) {
  const out = [], d = new Date(from + 'T12:00:00');
  for (let k = 0; k < n; k++) {
    out.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
             String(d.getDate()).padStart(2, '0'));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/* Runs IN THE PAGE. Opens one room, lights it, and returns every problem
   with the ink, plus the rule's on-screen size. */
function auditInPage(job, minPx) {
  const G = window.ECGame;
  if (typeof job === 'string') G.startDaily(job, 5); else G.startLevel(job);
  const st = G.state();
  /* The lamp, switched on the way the inventory does it. */
  st.S.uvOn = true;
  document.body.classList.add('uv');

  const $ = id => document.getElementById(id);
  const scene = $('scene');
  const topBar = $('topbar').getBoundingClientRect().bottom;
  const invTop = $('inv').getBoundingClientRect().top;
  const W = window.innerWidth;
  const out = { tier: st.tier, rule: null, rug: null, problems: [], px: null, setting: st.setting };

  /* Furniture boxes on screen, measured with the ink and the light's
     glow halo hidden (neither is furniture). */
  const FURN = ['rug', 'plant', 'clock', 'pA', 'pB', 'shelf', 'chest',
                'door', 'drawer', 'safe', 'cab', 'bench', 'candleG'];
  const hide = [...scene.querySelectorAll('.uv-ink, #glowE')];
  const prev = hide.map(e => { const d = e.style.display; e.style.display = 'none'; return d; });
  const boxes = {};
  FURN.forEach(id => { const el = $(id); if (el) boxes[id] = el.getBoundingClientRect(); });
  hide.forEach((e, k) => { e.style.display = prev[k]; });

  const panels = [];
  ['obs', 'toast'].forEach(id => {
    const el = $(id);
    if (el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' &&
        el.classList.contains('show')) panels.push({ id, r: el.getBoundingClientRect() });
  });

  const pe = document.createElement('style');
  pe.textContent = '#scene *{pointer-events:all !important}';
  document.head.appendChild(pe);

  const inter = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
                          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;

  const check = (el, label, owner, boxCheck) => {
    const txt = el.textContent;
    const m = el.getScreenCTM();
    const bad = new Set();
    for (let k = 0; k < el.getNumberOfChars(); k++) {
      if (/\s/.test(txt[k])) continue;
      const e = el.getExtentOfChar(k);
      const pts = [[e.x, e.y], [e.x + e.width, e.y], [e.x, e.y + e.height], [e.x + e.width, e.y + e.height]]
        .map(p => new DOMPoint(p[0], p[1]).matrixTransform(m));
      const r = { left: Math.min(...pts.map(p => p.x)), right: Math.max(...pts.map(p => p.x)),
                  top: Math.min(...pts.map(p => p.y)), bottom: Math.max(...pts.map(p => p.y)) };
      /* Glyph boxes include the font's full ascent/descent; shrink them a
         little so a descender's empty box touching a neighbour is not a
         false alarm. */
      const core = { left: r.left + 1, right: r.right - 1,
                     top: r.top + (r.bottom - r.top) * 0.2, bottom: r.bottom - (r.bottom - r.top) * 0.2 };
      if (core.left < 1 || core.right > W - 1 || core.top < topBar || core.bottom > invTop) {
        bad.add(label + ' off-screen'); continue;
      }
      if (boxCheck) {
        for (const id in boxes) {
          if (id === owner) continue;
          if (inter(core, boxes[id])) bad.add(label + ' overlaps #' + id);
        }
      }
      for (const p of panels) if (inter(core, p.r)) bad.add(label + ' under #' + p.id);
      const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
      const hit = document.elementsFromPoint(cx, cy).find(h => scene.contains(h));
      if (hit && hit !== el && !el.contains(hit)) {
        const g = hit.closest('[id]');
        bad.add(label + ' covered by #' + (g ? g.id : '?'));
      }
    }
    bad.forEach(b => out.problems.push(b));
  };

  /* The wall rule: whichever of uvA/uvB/uvC carries text. */
  const ruleEl = ['uvA', 'uvB', 'uvC'].map($).find(e => e && e.textContent.trim());
  if (st.tier >= 4) {
    if (!ruleEl) out.problems.push('tier ' + st.tier + ' room has no wall rule');
    else {
      out.rule = ruleEl.textContent;
      const owner = st.__answers.clueSpot;
      check(ruleEl, 'rule', owner, true);
      const m = ruleEl.getScreenCTM();
      out.px = Number(ruleEl.getAttribute('font-size')) * Math.hypot(m.a, m.b);
      if (out.px < minPx) out.problems.push('rule rendered at ' + out.px.toFixed(1) + 'px');
      /* A '·' that falls at a line break is dropped from the drawing on purpose. */
      const norm = s => s.replace(/·/g, ' ').replace(/\s+/g, ' ').trim();
      if (norm(ruleEl.textContent) !== norm(st.__answers.puzzle.shortRule)) {
        out.problems.push('rule text differs from the puzzle: "' + ruleEl.textContent + '"');
      }
    }
  }
  /* The sigils live INSIDE the floor covering and are drawn before the
     things beside it, so for them the hit test is the check that counts;
     their box is allowed to brush a neighbour's bounding box as long as
     nothing is actually painted over a glyph. */
  const rug = $('uvRug');
  if (st.tier >= 5) {
    out.rug = rug.textContent;
    check(rug, 'sigil', 'rug', false);
  }
  pe.remove();
  return out;
}

(async () => {
  const { server, port } = await startServer();
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  const days = dayList(START, DAILIES);
  try {
    for (const vp of VIEWPORTS) {
      const tag = vp.width + 'x' + vp.height;
      console.log('\n-- ' + tag + ' --');
      await page.setViewport(Object.assign({ isMobile: true, hasTouch: true }, vp));
      await page.goto('http://localhost:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
      await sleep(500);
      await page.evaluate(() => { window.ECSave.data.unlocked = window.ECThemes.list.length; });
      const total = await page.evaluate(() => window.ECThemes.list.length);

      const jobs = [];
      for (let i = 0; i < total; i++) jobs.push(i);
      days.forEach(d => jobs.push(d));

      const bad = [], px = [];
      let rules = 0, rugs = 0;
      for (const j of jobs) {
        const r = await page.evaluate(auditInPage, j, MIN_PX);
        if (r.rule) rules++;
        if (r.rug) rugs++;
        if (r.px) px.push({ px: r.px, j: j, rule: r.rule });
        if (r.problems.length) {
          bad.push((typeof j === 'number' ? 'chamber ' + (j + 1) : 'daily ' + j) + ' (' + r.setting +
                   ', tier ' + r.tier + '): ' + [...new Set(r.problems)].join('; '));
        }
      }
      const nCh = jobs.filter(j => typeof j === 'number').length;
      console.log('  rooms ' + jobs.length + ' (' + nCh + ' chambers, ' + (jobs.length - nCh) +
                  ' dailies) · wall rules ' + rules + ' · sigil rows ' + rugs +
                  ' · rule size ' + (px.length ? Math.min(...px.map(p => p.px)).toFixed(1) + '–' +
                  Math.max(...px.map(p => p.px)).toFixed(1) + 'px' : '-'));
      console.log('  smallest: ' + px.sort((a, b) => a.px - b.px).slice(0, 6)
        .map(p => (typeof p.j === 'number' ? 'ch' + (p.j + 1) : p.j) + ' ' + p.px.toFixed(1) +
                  'px (' + p.rule.length + ' chars)').join(', '));
      ok(tag + ': every wall rule and sigil is on screen, clear of furniture, uncovered and readable',
         bad.length === 0, bad.length + ' rooms: ' + bad.slice(0, 6).join(' | '));
      ok(tag + ': the audit really checked rules (not a vacuous pass)', rules >= 100 && rugs >= 40,
         'rules ' + rules + ', sigils ' + rugs);
    }
    ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } catch (e) {
    failed++;
    failures.push('HARNESS: ' + e.message);
    console.log('\n  HARNESS ERROR: ' + e.stack);
  } finally {
    await browser.close();
    server.close();
  }
  console.log('\n=========================================');
  console.log('uv-audit: ' + passed + ' passed, ' + failed + ' failed');
  if (failures.length) failures.forEach(f => console.log('  - ' + f));
  console.log('=========================================\n');
  process.exit(failed ? 1 : 0);
})();
