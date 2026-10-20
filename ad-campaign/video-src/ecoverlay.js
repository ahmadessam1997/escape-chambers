/* ---------------------------------------------------------------
   Escape Chambers — ad overlay + timeline (v1.7.0: 30 chambers + Daily Chamber).
   Injected into the live game page; the chamber renders underneath.
   --------------------------------------------------------------- */
window.__EC_AD = (function () {
  'use strict';

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const inv = (t, a, b) => clamp((t - a) / (b - a || 1e-6), 0, 1);
  const easeOut = p => 1 - Math.pow(1 - p, 3);
  const easeInOut = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const easeOutBack = p => 1 + 2.2 * Math.pow(p - 1, 3) + 1.4 * Math.pow(p - 1, 2);
  const lerp = (a, b, p) => a + (b - a) * p;

  /* level, zoom from -> to, and the text over it */
  const S = [
    { t0: 0.0, t1: 3.2, lv: 0, z: [1.00, 1.05],
      cards: [{ t0: 0.8, t1: 3.2, kind: 'title', h: 'ESCAPE\nCHAMBERS', p: 'THE ROOM TELLS YOU WHERE TO LOOK' }] },

    { t0: 3.2, t1: 10.0, lv: 0, z: [1.03, 1.10], cut: true,
      cards: [
        { t0: 3.6, t1: 6.5, kind: 'big', h: 'MOST ESCAPE GAMES\nMAKE YOU TAP EVERYTHING', p: '' },
        { t0: 6.8, t1: 9.9, kind: 'big', h: 'THIS ONE TELLS YOU\nWHERE TO LOOK', p: 'If you can read it' }
      ] },

    { t0: 10.0, t1: 16.4, lv: 3, z: [1.00, 1.07], cut: true,
      cards: [{ t0: 10.4, t1: 16.2, kind: 'big', h: 'THREE FACTS.\nONE CONCLUSION.', p: 'Every chamber hands you real evidence the moment you walk in' }] },

    { t0: 16.4, t1: 21.6, lv: 13, uv: true, z: [1.00, 1.06], cut: true,
      cards: [{ t0: 16.8, t1: 21.4, kind: 'big', h: 'SWITCH ON\nTHE UV LAMP', p: 'and the rules blaze across the wall' }] },

    { t0: 21.6, t1: 24.0, lv: 5, z: [1.00, 1.06], cut: true, montage: true,
      cards: [{ t0: 21.9, t1: 23.9, kind: 'big', h: 'EVERY ROOM,\nITS OWN WORLD', p: '' }] },
    { t0: 24.0, t1: 26.4, lv: 8, z: [1.00, 1.06], cut: true, montage: true },
    { t0: 26.4, t1: 28.8, lv: 22, z: [1.00, 1.06], cut: true, montage: true },
    { t0: 28.8, t1: 31.2, lv: 17, z: [1.00, 1.06], cut: true, montage: true },
    { t0: 31.2, t1: 33.6, lv: 28, z: [1.00, 1.06], cut: true, montage: true },
    { t0: 33.6, t1: 36.0, daily: true, z: [1.00, 1.06], cut: true, montage: true,
      cards: [{ t0: 33.9, t1: 35.9, kind: 'big', h: 'A NEW ROOM\nEVERY DAY', p: 'The Daily Chamber' }] },
    { t0: 36.0, t1: 38.6, lv: 29, z: [1.00, 1.06], cut: true, montage: true },

    { t0: 38.6, t1: 44.2, lv: 13, win: true, z: [1.00, 1.04], cut: true,
      cards: [{ t0: 39.4, t1: 44.0, kind: 'low', h: 'FIVE STARS FOR\nA FLAWLESS ESCAPE', p: 'Escape in the fewest moves the room allows' }] },

    { t0: 44.2, t1: 48.6, end: true, cut: true }
  ];

  const TOTAL = 48.6;
  const sceneAt = t => S.find(s => t >= s.t0 && t < s.t1) || S[S.length - 1];

  function build() {
    const css = document.createElement('style');
    css.textContent = `
@font-face{font-family:AdInter;src:url(ad/fonts/Inter-700.ttf);font-weight:700}
@font-face{font-family:AdInter;src:url(ad/fonts/Inter-800.ttf);font-weight:800}
@font-face{font-family:AdInter;src:url(ad/fonts/Inter-900.ttf);font-weight:900}
#ecov{position:fixed;inset:0;z-index:9000;pointer-events:none;font-family:AdInter,sans-serif;
  -webkit-font-smoothing:antialiased}
#ecTop{position:absolute;left:0;right:0;top:0;height:210px;
  background:linear-gradient(180deg,rgba(6,8,18,.85),rgba(6,8,18,0))}
#ecBot{position:absolute;left:0;right:0;bottom:0;height:330px;
  background:linear-gradient(0deg,rgba(6,8,18,.93),rgba(6,8,18,0))}
#ecVig{position:absolute;inset:0;box-shadow:inset 0 0 220px 60px rgba(4,6,14,.75)}
#ecCard{position:absolute;left:0;right:0;bottom:118px;text-align:center;padding:0 36px}
#ecCard .h{font-weight:900;font-size:56px;line-height:1.06;color:#f6ecd8;letter-spacing:-.015em;
  white-space:pre-line;text-shadow:0 0 34px rgba(232,168,76,.5),0 4px 0 rgba(6,8,18,.6)}
#ecCard .p{font-weight:700;font-size:25px;line-height:1.32;color:#e8bd78;margin-top:16px;
  text-shadow:0 2px 12px rgba(6,8,18,.9)}
#ecCard .rule{width:76px;height:4px;border-radius:2px;background:#e8a84c;margin:0 auto 20px}
#ecName{position:absolute;left:0;right:0;bottom:118px;text-align:center;padding:0 36px;opacity:0}
#ecName .n{font-weight:900;font-size:46px;color:#f6ecd8;letter-spacing:.01em;
  text-shadow:0 0 30px rgba(232,168,76,.55),0 3px 0 rgba(6,8,18,.6)}
#ecName .c{font-weight:800;font-size:23px;color:#e8a84c;letter-spacing:.24em;margin-top:12px}
#ecTitle{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;text-align:center;padding:0 40px}
#ecTitle .h{font-weight:900;font-size:86px;line-height:1.02;color:#f6ecd8;letter-spacing:-.03em;
  white-space:pre-line;text-shadow:0 0 52px rgba(232,168,76,.75),0 6px 0 rgba(6,8,18,.5)}
#ecTitle .p{font-weight:800;font-size:25px;color:#e8a84c;letter-spacing:.2em;margin-top:24px}
#ecEnd{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;text-align:center;background:rgba(6,8,18,.93);opacity:0}
#ecEnd img{width:214px;height:214px;border-radius:50px;box-shadow:0 26px 70px rgba(0,0,0,.7)}
#ecEnd .h{font-weight:900;font-size:66px;line-height:1.05;color:#f6ecd8;margin-top:44px;
  letter-spacing:-.025em;text-shadow:0 0 44px rgba(232,168,76,.6)}
#ecEnd .p{font-weight:800;font-size:25px;color:#e8a84c;letter-spacing:.2em;margin-top:18px}
#ecEnd .cta{margin-top:44px;font-weight:900;font-size:31px;color:#241703;letter-spacing:.04em;
  background:linear-gradient(135deg,#ffdd9e,#e8a84c);border-radius:999px;padding:24px 56px;
  box-shadow:0 20px 50px rgba(232,168,76,.4)}
#ecEnd .fine{margin-top:26px;font-weight:700;font-size:23px;color:#9a8f7a}
#ecBar{position:absolute;left:0;bottom:0;height:6px;background:linear-gradient(90deg,#e8a84c,#ffdd9e)}
#ecFlash{position:absolute;inset:0;background:#0a0c18;opacity:0}
`;
    document.head.appendChild(css);
    const d = document.createElement('div');
    d.id = 'ecov';
    d.innerHTML =
      '<div id="ecVig"></div><div id="ecTop"></div><div id="ecBot"></div>' +
      '<div id="ecTitle"><div class="h"></div><div class="p"></div></div>' +
      '<div id="ecCard"><div class="rule"></div><div class="h"></div><div class="p"></div></div>' +
      '<div id="ecName"><div class="n"></div><div class="c"></div></div>' +
      '<div id="ecFlash"></div>' +
      '<div id="ecEnd"><img src="ad/icon.png"><div class="h">ESCAPE<br>CHAMBERS</div>' +
      '<div class="p">CAN YOU READ THEM?</div>' +
      '<div class="cta">PLAY FREE ON ANDROID</div>' +
      '<div class="fine">Free · plays offline · no account, no timers</div></div>' +
      '<div id="ecBar"></div>';
    document.body.appendChild(d);
  }

  const $ = id => document.getElementById(id);

  function paint(t, roomName) {
    const sc = sceneAt(t);

    $('ecFlash').style.opacity = sc.cut ? 0.85 * (1 - easeOut(inv(t, sc.t0, sc.t0 + 0.22))) : 0;
    $('ecBar').style.width = (100 * clamp(t / TOTAL, 0, 1)) + '%';

    /* end card */
    const end = $('ecEnd');
    if (sc.end) {
      end.style.opacity = easeOut(inv(t, sc.t0, sc.t0 + 0.45));
      [].slice.call(end.children).forEach((el, i) => {
        const p = easeOut(inv(t, sc.t0 + 0.3 + i * 0.13, sc.t0 + 1.15 + i * 0.13));
        el.style.opacity = p;
        el.style.transform = 'translateY(' + lerp(34, 0, p) + 'px)';
      });
    } else end.style.opacity = 0;

    /* chamber name during the montage — yields to a caption if one is up */
    const nm = $('ecName');
    const cardUp = (sc.cards || []).some(c => t >= c.t0 && t <= c.t1);
    if (sc.montage && roomName && !cardUp) {
      const a = easeOut(inv(t, sc.t0 + 0.25, sc.t0 + 0.7));
      const b = 1 - easeOut(inv(t, sc.t1 - 0.28, sc.t1));
      nm.style.opacity = Math.min(a, b);
      nm.style.transform = 'translateY(' + lerp(18, 0, a) + 'px)';
      const parts = roomName.split('·');
      nm.querySelector('.n').textContent = (parts[0] || roomName).trim();
      nm.querySelector('.c').textContent = (parts[1] || '').trim();
    } else nm.style.opacity = 0;

    /* cards */
    const card = $('ecCard'), title = $('ecTitle');
    let shownTitle = false, shownCard = false;
    for (const c of (sc.cards || [])) {
      if (t < c.t0 || t > c.t1) continue;
      const a = easeOut(inv(t, c.t0, c.t0 + 0.45));
      const b = 1 - easeOut(inv(t, c.t1 - 0.3, c.t1));
      const vis = Math.min(a, b);
      if (c.kind === 'title') {
        shownTitle = true;
        title.style.opacity = vis;
        title.querySelector('.h').textContent = c.h;
        title.querySelector('.p').textContent = c.p;
        title.querySelector('.h').style.transform =
          'scale(' + lerp(0.86, 1, easeOutBack(inv(t, c.t0, c.t0 + 0.6))) + ')';
        title.querySelector('.p').style.opacity = easeOut(inv(t, c.t0 + 0.3, c.t0 + 0.9));
      } else {
        shownCard = true;
        card.style.opacity = vis;
        card.style.bottom = (c.kind === 'low' ? 54 : 118) + 'px';
        card.querySelector('.h').style.fontSize = (c.kind === 'low' ? 50 : 56) + 'px';
        card.style.transform = 'translateY(' + lerp(24, 0, a) + 'px)';
        card.querySelector('.h').textContent = c.h;
        card.querySelector('.p').textContent = c.p || '';
        card.querySelector('.p').style.display = c.p ? 'block' : 'none';
      }
    }
    if (!shownTitle) title.style.opacity = 0;
    if (!shownCard) card.style.opacity = 0;

    $('ecBot').style.opacity = (shownCard || nm.style.opacity > 0) ? 1 : 0.4;
  }

  /* slow push-in on the chamber art */
  function camera(t) {
    const sc = sceneAt(t);
    if (!sc.z) return 1;
    return lerp(sc.z[0], sc.z[1], easeInOut(inv(t, sc.t0, sc.t1)));
  }

  return { build, paint, camera, scenes: S, total: TOTAL, sceneAt };
})();
