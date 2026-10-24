/* GAID 40 s promo, lemo-opuscar Dark Tech Keynote. TREATMENT.md is the plan; this page draws film second t.
 * Page contract (lemo TECHNIQUE.md §2): window.DUR, async window.render(t), window.READY, window.EV, window.CUES,
 * window.TEXTS(t) (boxes of the message texts drawn by the last render), window.textSpans(step), window.STILLS.
 * Deterministic: no clock, seeded randomness only, no state carried between frames (the take-frame cache only holds
 * decoded images). Real GAID takes appear only inside windows, whole and at one scale (window.TAKES from render.py).
 */
(() => {
  'use strict';
  const W = 1920, H = 1080, FPS = 30, DUR = 42;
  const C = {
    stage: '#0a0c10', face: '#16191f', face2: '#1b1f26', chrome: '#20242c', edge: '#2e333c',
    ink: '#e7e9ee', ink2: '#b3b9c4', ink3: '#98a0ad', sig: '#3366e8', sigInk: '#7fa2ff', logo: '#4d7fff', danger: '#ff7a6e',
  };
  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d');

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const out3 = u => 1 - Math.pow(1 - clamp(u), 3);
  const inC = u => { u = clamp(u); return u * u * u; };
  const inOut = u => { u = clamp(u); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const back = (u, s = 1.3) => { u = clamp(u); const c = s + 1; return 1 + c * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2); };
  const backIn = (u, s = 1.3) => { u = clamp(u); return (s + 1) * u * u * u - s * u * u; };
  const q16 = x => Math.round(x * 8) / 8;
  const rad = d => d * Math.PI / 180;
  function mulberry(a) {
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function monotone(keys) { // Fritsch-Carlson over [[x, y], ...]
    const n = keys.length, xs = keys.map(k => k[0]), ys = keys.map(k => k[1]), d = [], m = [];
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    m.push(d[0]); for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2); m.push(d[n - 2]);
    for (let i = 0; i < n - 1; i++) { if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; } const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b; if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; } }
    return x => {
      if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
      let i = 0; while (x > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i], u = (x - xs[i]) / h, u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1];
    };
  }

  // ---------- timeline (one source; the mixer reads EV/CUES from events.json) ----------
  const BPM = 120, BEAT = 0.5;
  const T = {
    hook: 0, scatter: 6.0, freeze: 10.0, press: 10.5, land0: 11.5, sweepA: 12.0, putaway: 14.4, crt: 14.9,
    ring: 15.0, ringDraw: 15.5, cycle: 17.0, lap: 29.25, pull: 30.0, collapse: 35.0, end: 35.6,
  };
  const CUES = [
    { id: 'hook', t: 0, bpm: BPM }, { id: 'scatter', t: T.scatter }, { id: 'freeze', t: T.freeze }, { id: 'gather', t: T.press },
    { id: 'ring', t: T.ring }, { id: 'cycle', t: T.cycle }, { id: 'lap', t: 29.0 }, { id: 'brain', t: T.pull },
    { id: 'collapse', t: T.collapse }, { id: 'end', t: T.end }, { id: 'out', t: DUR },
  ];
  const EV = [];
  const ev = (t, type, o = {}) => EV.push({ t: Math.round(t * 1000) / 1000, type, ...o });
  const ft = t => (t >= T.freeze && t < T.press ? T.freeze : t); // the freeze: picture time stops

  // ---------- assets ----------
  const ICON_NAMES = ['library', 'workflow', 'share-2', 'message-square-text', 'notebook-pen', 'map', 'file-text', 'code-xml',
    'git-branch', 'database', 'folder-open', 'server', 'well-log', 'map-gis', 'plug', 'file-code'];
  const ICON_COLORS = { ink: C.ink, ink2: C.ink2, ink3: C.ink3, sigInk: C.sigInk };
  const icons = {};
  const img = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('image ' + src)); i.src = src; });
  let LOGO = null, LOGO_MARK = null;

  const TAKES = window.TAKES || {};
  const takeCache = new Map();
  function takeFrame(id, k) {
    const tk = TAKES[id]; if (!tk) return null;
    const key = id + ':' + k;
    if (takeCache.has(key)) { const v = takeCache.get(key); takeCache.delete(key); takeCache.set(key, v); return v; }
    return null;
  }
  async function needTake(id, k) {
    const tk = TAKES[id]; if (!tk) return;
    const key = id + ':' + k;
    if (takeCache.has(key)) return;
    const im = await img(tk.pattern.replace('%03d', String(k).padStart(3, '0')));
    takeCache.set(key, im);
    while (takeCache.size > 24) takeCache.delete(takeCache.keys().next().value);
  }

  // ---------- drawing helpers ----------
  let TXT = [];
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); }
  function screenBox(x0, y0, x1, y1) {
    const m = ctx.getTransform();
    const ps = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
    return { x0: Math.min(...ps.map(p => p[0])), y0: Math.min(...ps.map(p => p[1])), x1: Math.max(...ps.map(p => p[0])), y1: Math.max(...ps.map(p => p[1])) };
  }
  function text(id, s, x, y, o = {}) {
    const size = o.size || 28, alpha = o.alpha ?? 1;
    if (alpha <= 0.001) return 0;
    ctx.save();
    ctx.font = `${o.weight || 600} ${size}px Pretendard`;
    ctx.letterSpacing = (o.ls || 0) + 'px';
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = o.color || C.ink;
    const w = ctx.measureText(s).width;
    ctx.fillText(s, x, y);
    if (id && alpha >= 0.6 && ctx.globalAlpha >= 0.6) {
      const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
      TXT.push({ id, text: s, ...screenBox(x0, y - size * 0.86, x0 + w, y + size * 0.24) });
    }
    ctx.restore();
    return w;
  }
  function measure(s, size, weight = 600) { ctx.save(); ctx.font = `${weight} ${size}px Pretendard`; const w = ctx.measureText(s).width; ctx.restore(); return w; }
  function panel(x, y, w, h, r, level = 1, o = {}) {
    const lw = o.lw || 1;
    ctx.save();
    if (o.shadow !== false) { ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = o.blur ?? 30; ctx.shadowOffsetY = o.sy ?? 12; }
    ctx.fillStyle = [C.face, C.face2, C.chrome][level];
    rr(x, y, w, h, r); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.lineWidth = lw; ctx.strokeStyle = o.border || 'rgba(255,255,255,0.085)';
    rr(x + lw / 2, y + lw / 2, w - lw, h - lw, r); ctx.stroke();
    if (w > 2 * r + 4) { ctx.beginPath(); ctx.moveTo(x + r, y + 1.5 * lw); ctx.lineTo(x + w - r, y + 1.5 * lw); ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.stroke(); }
    ctx.restore();
  }
  function icon(name, x, y, size, color = 'ink2', alpha = 1) {
    const im = icons[name] && icons[name][color]; if (!im || alpha <= 0) return;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.drawImage(im, x, y, size, size); ctx.restore();
  }
  let GLOW = null;
  function glow(x, y, r, alpha = 1) { if (alpha <= 0) return; ctx.save(); ctx.globalAlpha *= alpha; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(GLOW, x - r, y - r, 2 * r, 2 * r); ctx.restore(); }
  function dot(x, y, r, alpha = 1) {
    glow(x, y, r * 5, 0.55 * alpha);
    ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = C.sig; ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.3, r * 0.4, 0, 2 * Math.PI); ctx.fill();
    ctx.restore();
  }

  // ---------- stage, grid, camera ----------
  let BG = null, VIG = null;
  function buildStage() {
    BG = document.createElement('canvas'); BG.width = W; BG.height = H;
    const g = BG.getContext('2d');
    g.fillStyle = C.stage; g.fillRect(0, 0, W, H);
    let rg = g.createRadialGradient(960, -80, 0, 960, -80, 1150); rg.addColorStop(0, 'rgba(46,54,72,0.42)'); rg.addColorStop(1, 'rgba(46,54,72,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    rg = g.createRadialGradient(1460, 300, 0, 1460, 300, 760); rg.addColorStop(0, 'rgba(51,102,232,0.07)'); rg.addColorStop(1, 'rgba(51,102,232,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    VIG = document.createElement('canvas'); VIG.width = W; VIG.height = H;
    const v = VIG.getContext('2d');
    rg = v.createRadialGradient(960, 540, 520, 960, 540, 1180); rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,0.55)');
    v.fillStyle = rg; v.fillRect(0, 0, W, H);
    GLOW = document.createElement('canvas'); GLOW.width = GLOW.height = 128;
    const q = GLOW.getContext('2d'); rg = q.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(77,127,255,0.9)'); rg.addColorStop(0.25, 'rgba(51,102,232,0.35)'); rg.addColorStop(1, 'rgba(51,102,232,0)');
    q.fillStyle = rg; q.fillRect(0, 0, 128, 128);
  }

  const RC = { x: 960, y: 527 }, R = 190;
  const zPull = monotone([[30, 0], [31, Math.log(0.68)], [32, Math.log(0.47)], [33, Math.log(0.34)], [34, Math.log(0.26)], [35, Math.log(0.22)]]);
  const lateral = () => [0, 0]; // the dial turns instead of the camera leaning
  function camAt(t) {
    t = ft(t);
    let cx = 960, cy = 540, z = 1, rot = 0;
    if (t < T.scatter) z = 1 + 0.07 * inOut(t / T.scatter);
    else if (t < T.press) { const u = seg(t, T.scatter, T.freeze); z = 1.07 - 0.07 * out3(u); rot = rad(1.5) * inOut(seg(t, T.scatter, 9.5)); }
    else if (t < 12.5) { const a = out3(seg(t, T.press, 11.0)); z = lerp(1, 0.88, a); z = lerp(z, 1, inOut(seg(t, 11.0, 12.5))); rot = rad(1.5) * (1 - out3(seg(t, T.press, 11.0))); }
    else if (t < T.pull) { const [lx, ly] = lateral(t); cx += lx; cy += ly; z = 1 + 0.03 * inOut(seg(t, 29.0, 30.0)); }
    else if (t < T.collapse) {
      const u = inOut(seg(t, 30.0, 32.0)); const [lx, ly] = lateral(t);
      cx = lerp(960 + lx, RC.x, u); cy = lerp(540 + ly, RC.y, u);
      z = Math.exp(zPull(t)) * lerp(1.03, 1, seg(t, 30.0, 31.0));
    } else { cx = RC.x; cy = RC.y; z = lerp(0.22, 0.36, inOut(seg(t, T.collapse, T.end))); }
    return { cx, cy, z, rot };
  }
  function applyCam(c) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(960, 540); ctx.rotate(c.rot); ctx.scale(c.z, c.z); ctx.translate(-c.cx, -c.cy); }
  function toScreen(c, x, y) {
    const dx = (x - c.cx) * c.z, dy = (y - c.cy) * c.z, cs = Math.cos(c.rot), sn = Math.sin(c.rot);
    return { x: 960 + dx * cs - dy * sn, y: 540 + dx * sn + dy * cs };
  }
  function grid(c) {
    const half = Math.hypot(960, 540) / c.z + 60;
    const x0 = Math.floor((c.cx - half) / 48) * 48, x1 = c.cx + half, y0 = Math.floor((c.cy - half) / 48) * 48, y1 = c.cy + half;
    const minor = clamp((48 * c.z - 9) / 10), lw = 1 / c.z;
    ctx.save(); ctx.lineWidth = lw;
    for (const major of [false, true]) {
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 48) { const isM = Math.round(x / 48) % 4 === 0; if (isM !== major) continue; ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
      for (let y = y0; y <= y1; y += 48) { const isM = Math.round(y / 48) % 4 === 0; if (isM !== major) continue; ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
      ctx.strokeStyle = major ? `rgba(255,255,255,${0.06 * clamp((192 * c.z - 8) / 12)})` : `rgba(255,255,255,${0.03 * minor})`;
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- section A: the hook (work spawning by rule) ----------
  const CARET = { x: 960, y: 540 };
  const WTYPES = [
    { title: '자료 조사', icon: 'map', motion: 'drop' },
    { title: '문헌 분석', icon: 'file-text', motion: 'slide' },
    { title: '코드 작성', icon: 'code-xml', motion: 'pop' },
  ];
  const HOOK = [];
  (function buildHook() {
    const rnd = mulberry(1907);
    const times = [];
    for (let t = 0; t < 2.0 - 1e-9; t += 0.25) times.push(t);
    for (let t = 2.0; t < 4.0 - 1e-9; t += 0.125) times.push(t);
    for (let t = 4.0; t < 5.75 - 1e-9; t += 0.0625) times.push(t);
    const fixed = [[288, 168, 432, 0], [1248, 144, 384, 1], [1200, 600, 432, 2]];
    const bad = (x, y, w, h) => (x < 1120 && y + h > 880) || (x < 1220 && x + w > 700 && y < 700 && y + h > 380);
    times.forEach((t0_, i) => {
      let t0 = t0_;
      let x, y, w, h, ty;
      if (i < 3) { [x, y, w, ty] = fixed[i]; h = Math.round(w * 0.62 / 24) * 24; }
      else {
        ty = Math.floor(rnd() * 3);
        for (let k = 0; k < 40; k++) {
          w = 48 * (5 + Math.floor(rnd() * 5)); h = Math.round(w * 0.62 / 24) * 24;
          x = 48 * Math.floor(rnd() * ((W + 96 - w) / 48)) - 48; y = 48 * Math.floor(rnd() * ((H + 48 - h) / 48)) - 24;
          if (!bad(x, y, w, h)) break;
        }
      }
      const seed = Math.floor(rnd() * 1e9);
      if (i === 0) t0 = -0.15; // frame 0 already shows the first window landing
      HOOK.push({ i, t0, x, y, w, h, ty, seed, r0: 6.0 + ((times.length - 1 - i) / (times.length - 1)) * 0.6 });
      ev(Math.max(0, t0), 'spawn', { kind: ty, pan: clamp((x + w / 2 - 960) / 960, -1, 1), i });
    });
  })();
  function windowContent(wd, x, y, w, h) {
    const rnd = mulberry(wd.seed);
    ctx.save(); rr(x, y, w, h, 0); ctx.clip();
    if (wd.ty === 0) { // map: contour blobs
      ctx.strokeStyle = 'rgba(152,160,173,0.32)'; ctx.lineWidth = 1.2;
      const cx = x + w * (0.3 + rnd() * 0.4), cy = y + h * (0.3 + rnd() * 0.4);
      for (let k = 1; k <= 5; k++) {
        ctx.beginPath();
        for (let a = 0; a <= 24; a++) { const th = a / 24 * Math.PI * 2, rr2 = k * w * 0.07 * (1 + 0.18 * Math.sin(th * 3 + wd.seed % 7) + 0.1 * Math.cos(th * 5)); const px = cx + Math.cos(th) * rr2, py = cy + Math.sin(th) * rr2 * 0.7; a ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(152,160,173,0.18)';
      for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.arc(x + rnd() * w, y + rnd() * h, 3, 0, 7); ctx.fill(); }
    } else if (wd.ty === 1) { // paper page: two columns of lines
      const cw = (w - 48) / 2;
      ctx.fillStyle = 'rgba(179,185,196,0.5)'; ctx.fillRect(x + 16, y + 14, w * 0.6, 7);
      ctx.fillStyle = 'rgba(152,160,173,0.22)';
      for (let col = 0; col < 2; col++) for (let k = 0; k < 12; k++) { const ly = y + 34 + k * 11; if (ly > y + h - 10) break; ctx.fillRect(x + 16 + col * (cw + 16), ly, cw * (0.7 + rnd() * 0.3), 4); }
    } else { // code lines
      for (let k = 0; k < 14; k++) {
        const ly = y + 14 + k * 13; if (ly > y + h - 10) break;
        const ind = [0, 0, 1, 1, 2, 1, 0][Math.floor(rnd() * 7)];
        ctx.fillStyle = k % 4 === 0 ? 'rgba(179,185,196,0.42)' : 'rgba(152,160,173,0.24)';
        ctx.fillRect(x + 16 + ind * 18, ly, (w - 60) * (0.25 + rnd() * 0.55), 5);
      }
    }
    ctx.restore();
  }
  function drawHook(t) {
    const tf = ft(t);
    if (tf > 7.0) return;
    for (const wd of HOOK) {
      const age = tf - wd.t0; if (age < 0) continue;
      const rt = tf - wd.r0; if (rt > 0.22) continue;
      const ty = WTYPES[wd.ty]; let x = wd.x, y = wd.y, s = 1, a = clamp(age / 0.1);
      const u = clamp(age / 0.22);
      if (ty.motion === 'drop') { y += -34 * (1 - back(u, 2.2)); }
      else if (ty.motion === 'slide') { x += 90 * (1 - out3(u)); }
      else { s = lerp(0.94, 1, back(u, 2)); }
      if (tf > 5.4) { const k = (tf - 5.4) / 0.6; x += 2.4 * k * Math.sin(tf * 71 + wd.i * 1.7); y += 2.4 * k * Math.cos(tf * 67 + wd.i * 2.3); }
      let sx = s, sy = s;
      if (rt > 0) { sy = s * lerp(1, 0.03, inC(clamp(rt / 0.13))); sx = s * (1 - inC(seg(rt, 0.13, 0.22))); }
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(x + wd.w / 2, y + wd.h / 2); ctx.scale(sx, sy); ctx.translate(-wd.w / 2, -wd.h / 2);
      panel(0, 0, wd.w, wd.h, 12, 1, { blur: 24, sy: 8 });
      ctx.fillStyle = C.chrome; ctx.save(); rr(0, 0, wd.w, 34, 12); ctx.clip(); ctx.fillRect(0, 0, wd.w, 34); ctx.restore();
      icon(ty.icon, 12, 8, 18, 'ink3');
      text(wd.i < 3 ? 'win-' + wd.i : null, ty.title, 38, 23, { size: 17, weight: 600, color: C.ink2 });
      windowContent(wd, 0, 34, wd.w, wd.h - 34);
      ctx.restore();
    }
  }

  // ---------- section B: tools scattered out of reach ----------
  const TOOLS = [
    ['code-xml', 'K-Dense AI 과학 스킬', 'geopandas', 144, 144, -2],
    ['map-gis', 'KIGAM 지구과학 스킬', 'geo-map-and-crs', 1440, 144, 2],
    ['database', '기관 자료', '지질도 · 시추 자료', 792, 96, -1],
    ['git-branch', 'GitHub 저장소', '저장소마다 따로 설치', 96, 456, 1.5],
    ['file-code', '논문 부록 코드', 'MOESM1_ESM.py', 1488, 432, -1.5],
    ['well-log', 'KIGAM 지구과학 스킬', 'well-log-qc-quicklook', 336, 696, -1.2],
    ['plug', 'agent 도구', 'MCP 서버', 1104, 816, 1],
    ['folder-open', '개인 폴더', '분석 노트', 1488, 696, 1.8],
  ].map(([ic, title, sub, x, y, rot], k) => ({ k, ic, title, sub, x, y, rot, w: 340, h: 100 }));
  const GW = { x: 432, y: 240, w: 1056, h: 600 };
  const STATUS = { x: 1452, y: 266 };
  (function buildTools() {
    const rnd = mulberry(77);
    const order = [...TOOLS].sort((a, b) => a.y - b.y || a.x - b.x);
    order.forEach((tl, slot) => { tl.slot = slot; });
    for (const tl of TOOLS) {
      tl.t0 = T.scatter + 0.25 * tl.k;
      tl.dashT = 8.0 + 0.2 * tl.k; tl.reach = 0.6 + 0.16 * rnd();
      const cx = tl.x + tl.w / 2, cy = tl.y + tl.h / 2;
      tl.launch = T.press + Math.hypot(cx - CARET.x, cy - CARET.y) / 2600;
      tl.land = T.land0 + 0.0625 * tl.slot;
      const col = tl.slot % 4, row = Math.floor(tl.slot / 4);
      tl.sx = GW.x + 24 + col * 256; tl.sy = GW.y + 76 + row * 244; tl.sw = 240; tl.sh = 228;
      const pan = clamp((cx - 960) / 960, -1, 1);
      ev(tl.t0, 'fling', { pan, k: tl.k }); ev(tl.dashT, 'dash', { pan, k: tl.k });
      ev(tl.launch, 'whoosh', { pan, k: tl.k }); ev(tl.land, 'land', { slot: tl.slot, pan: clamp((tl.sx + 120 - 960) / 600, -1, 1) });
      ev(T.putaway + 0.0625 * tl.slot, 'tick', { slot: tl.slot });
    }
  })();
  function bez(p0, p1, p2, u) { const a = 1 - u; return { x: a * a * p0.x + 2 * a * u * p1.x + u * u * p2.x, y: a * a * p0.y + 2 * a * u * p1.y + u * u * p2.y }; }
  function cardLayout(tl, t) { // where the card is and how it is shaped (0 = card, 1 = tile)
    const tf = ft(t);
    const home = { x: tl.x + tl.w / 2, y: tl.y + tl.h / 2 };
    if (tf < tl.launch) {
      const u = seg(tf, tl.t0, tl.t0 + 0.3), e = back(u, 1.4);
      const p0 = { x: CARET.x, y: CARET.y }, dx = home.x - p0.x, dy = home.y - p0.y;
      const p1 = { x: (p0.x + home.x) / 2 - dy * 0.22, y: (p0.y + home.y) / 2 + dx * 0.22 };
      let p = e <= 1 ? bez(p0, p1, home, e) : { x: home.x + (e - 1) * 2 * (home.x - p1.x), y: home.y + (e - 1) * 2 * (home.y - p1.y) };
      let jx = 0, jy = 0;
      if (tf > 9.5) { const k = (tf - 9.5) / 0.5; jx = 2.4 * k * Math.sin(tf * 73 + tl.k * 2); jy = 2.4 * k * Math.cos(tf * 61 + tl.k); }
      return { x: p.x + jx, y: p.y + jy, m: 0, s: lerp(0.55, 1, out3(u)), rot: rad(tl.rot) * out3(u), a: clamp(u / 0.3), u: -1 };
    }
    const slotC = { x: tl.sx + tl.sw / 2, y: tl.sy + tl.sh / 2 };
    const u = seg(tf, tl.launch, tl.land), e = back(u, 1.25);
    const dx = slotC.x - home.x, dy = slotC.y - home.y;
    const p1 = { x: (home.x + slotC.x) / 2 + dy * 0.28, y: (home.y + slotC.y) / 2 - dx * 0.28 };
    const p = e <= 1 ? bez(home, p1, slotC, e) : { x: slotC.x + (e - 1) * 2 * (slotC.x - p1.x), y: slotC.y + (e - 1) * 2 * (slotC.y - p1.y) };
    return { x: p.x, y: p.y, m: out3(seg(u, 0, 0.34)), s: 1, rot: rad(tl.rot) * (1 - out3(seg(u, 0, 0.5))), a: 1, u, p1, home, slotC };
  }
  function drawCard(tl, L, alpha = 1, idOn = true) {
    const w = lerp(tl.w, tl.sw, L.m), h = lerp(tl.h, tl.sh, L.m);
    ctx.save();
    ctx.globalAlpha *= L.a * alpha;
    ctx.translate(L.x, L.y); ctx.rotate(L.rot); ctx.scale(L.s, L.s); ctx.translate(-w / 2, -h / 2);
    panel(0, 0, w, h, 14, 2, { blur: 26, sy: 10 });
    const isz = lerp(28, 40, L.m);
    icon(tl.ic, lerp(20, 24, L.m), lerp(36, 28, L.m), isz, 'ink2');
    let ts = lerp(23, 24, L.m); const tw = measure(tl.title, ts, 650); const maxW = lerp(250, 200, L.m); if (tw > maxW) ts *= maxW / tw;
    text(idOn ? 'tool-' + tl.k + '-t' : null, tl.title, lerp(64, 24, L.m), lerp(46, 126, L.m), { size: ts, weight: 650, color: C.ink });
    let ss = 18; const sw = measure(tl.sub, ss, 500); if (sw > maxW) ss *= maxW / sw;
    text(idOn ? 'tool-' + tl.k + '-s' : null, tl.sub, lerp(64, 24, L.m), lerp(74, 160, L.m), { size: ss, weight: 500, color: C.ink3, ls: 0.3 });
    ctx.restore();
  }
  function drawScatter(t) {
    const tf = ft(t);
    if (tf < T.scatter || t > T.crt + 0.3) return;
    // dashed reach lines (problem colour only here)
    if (t < T.press + 0.2) {
      const back_ = 1 - out3(seg(t, T.press, T.press + 0.15));
      for (const tl of TOOLS) {
        const g = out3(seg(tf, tl.dashT, tl.dashT + 0.35)) * back_; if (g <= 0) continue;
        const cx = tl.x + tl.w / 2, cy = tl.y + tl.h / 2, dx = cx - CARET.x, dy = cy - CARET.y, L = Math.hypot(dx, dy);
        const s0 = 44 / L, s1 = s0 + (tl.reach - s0) * g;
        ctx.save(); ctx.setLineDash([6, 7]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(179,185,196,0.55)';
        ctx.beginPath(); ctx.moveTo(CARET.x + dx * s0, CARET.y + dy * s0); ctx.lineTo(CARET.x + dx * s1, CARET.y + dy * s1); ctx.stroke();
        ctx.restore();
        if (g > 0.95) { ctx.save(); ctx.fillStyle = C.danger; ctx.globalAlpha = back_; ctx.beginPath(); ctx.arc(CARET.x + dx * s1, CARET.y + dy * s1, 4.5, 0, 7); ctx.fill(); ctx.restore(); }
      }
    }
    // cards: scattered, then flying into GAID (trails first)
    for (const tl of TOOLS) {
      if (tf < tl.t0) continue;
      const L = cardLayout(tl, t);
      if (L.u >= 0 && L.u < 1.0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 1; i <= 9; i++) {
          const uu = L.u - i * 0.035; if (uu <= 0) break;
          const e = back(uu, 1.25), p = e <= 1 ? bez(L.home, L.p1, L.slotC, e) : L.slotC;
          ctx.globalAlpha = 0.22 * (1 - i / 10); ctx.fillStyle = C.sig; ctx.beginPath(); ctx.arc(p.x, p.y, 10 - i * 0.7, 0, 7); ctx.fill();
        }
        ctx.restore();
      }
      let a = 1, s = 1;
      const pt = t - (T.putaway + 0.0625 * tl.slot);
      if (pt > 0) { s = 1 - backIn(clamp(pt / 0.18), 1.6); if (s <= 0.01) continue; }
      if (s !== 1) { ctx.save(); ctx.translate(L.x, L.y); ctx.scale(s, s); ctx.translate(-L.x, -L.y); }
      drawCard(tl, L, a, pt < 0);
      if (L.u >= 0) { // landing flash in the accent
        const fl = 1 - seg(t, tl.land, tl.land + 0.4);
        if (t >= tl.land - 0.02 && fl > 0) { ctx.save(); ctx.globalAlpha = fl; ctx.lineWidth = 2; ctx.strokeStyle = C.sigInk; rr(tl.sx, tl.sy, tl.sw, tl.sh, 14); ctx.stroke(); ctx.restore(); }
      }
      if (s !== 1) ctx.restore();
    }
  }
  function drawCaret(t) {
    if (t >= T.press + 0.45) return;
    const tf = ft(t);
    let w = 4, h = 46, col = C.ink, a = 1;
    if (tf < T.scatter) a = (tf % 0.5) < 0.32 ? 1 : 0.12;
    if (t >= 10.2 && t < T.press) { const u = inC(seg(t, 10.2, T.press)); h *= lerp(1, 1.35, u); w *= lerp(1, 0.8, u); }
    if (t >= T.press) {
      col = C.sig;
      if (t < T.press + 2 / FPS) { h *= 0.3; w *= 2.4; }
      else { const u = back(seg(t, T.press + 2 / FPS, T.press + 0.3), 1.8); w = lerp(9.6, 24, u); h = lerp(13.8, 24, u); }
    }
    if (col === C.sig) glow(CARET.x, CARET.y, 70, 0.6);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col; rr(CARET.x - w / 2, CARET.y - h / 2, w, h, Math.min(w, h) / 2); ctx.fill(); ctx.restore();
    // label under the researcher's caret
    if (tf >= 6.4) {
      const r = 1 - out3(seg(t, T.press, T.press + 0.15));
      text(r > 0.9 ? 'researcher' : null, '연구자', CARET.x, CARET.y + 78 + 14 * (1 - out3(seg(tf, 6.4, 6.6))), { size: 26, weight: 600, color: C.ink2, align: 'center', alpha: out3(seg(tf, 6.4, 6.6)) * r });
    }
  }
  function agentDot(t) { // the AI agent's dot after the press: where it is
    if (t < T.press + 0.45) return { x: CARET.x, y: CARET.y, r: 12 };
    if (t < 11.2) { const u = inOut(seg(t, 10.9, 11.2)); return { x: lerp(CARET.x, STATUS.x, u), y: lerp(CARET.y, STATUS.y, u) - 60 * Math.sin(u * Math.PI), r: lerp(12, 8, u) }; }
    if (t < T.ring) return { x: STATUS.x, y: STATUS.y, r: 8 };
    return null;
  }
  function drawGaidWindow(t) {
    if (t < 10.6 || t > T.crt + 0.25) return;
    let sx = back(seg(t, 10.6, 10.82), 1.2), sy = back(seg(t, 10.68, 10.95), 1.2);
    const ct = t - T.crt;
    if (ct > 0) { sy = lerp(1, 0.02, inC(clamp(ct / 0.13))); sx = 1 - inC(seg(ct, 0.13, 0.22)); }
    if (sx <= 0.01 || sy <= 0.005) return;
    const cx = GW.x + GW.w / 2, cy = GW.y + GW.h / 2;
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(sx, sy); ctx.translate(-cx, -cy);
    panel(GW.x, GW.y, GW.w, GW.h, 18, 0, { blur: 60, sy: 24 });
    ctx.save(); rr(GW.x, GW.y, GW.w, 52, 18); ctx.clip(); ctx.fillStyle = C.chrome; ctx.fillRect(GW.x, GW.y, GW.w, 52); ctx.restore();
    if (LOGO_MARK) ctx.drawImage(LOGO_MARK, GW.x + 20, GW.y + 11, 30, 30);
    text(null, 'GAID', GW.x + 60, GW.y + 35, { size: 22, weight: 700, color: C.ink });
    // slot outlines light up just before each landing
    for (const tl of TOOLS) {
      const a = seg(t, tl.land - 0.5, tl.land - 0.05) * (1 - seg(t, tl.land, tl.land + 0.05));
      ctx.save(); ctx.lineWidth = 1; ctx.strokeStyle = `rgba(127,162,255,${0.08 + 0.35 * a})`; ctx.setLineDash([4, 6]);
      rr(tl.sx + 0.5, tl.sy + 0.5, tl.sw - 1, tl.sh - 1, 14); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }
  function drawSweepA(t) { // light passes over the gathered window once
    const u = seg(t, T.sweepA, T.sweepA + 1.1); if (u <= 0 || u >= 1) return;
    const fx = lerp(GW.x - 200, GW.x + GW.w + 200, inOut(u));
    ctx.save(); rr(GW.x, GW.y, GW.w, GW.h, 18); ctx.clip();
    const g = ctx.createLinearGradient(fx - 180, 0, fx + 180, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(200,215,255,0.11)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(fx - 180, GW.y, 360, GW.h); ctx.restore();
  }

  // ---------- section E: the ring and its stations ----------
  // One platform: GAID 허브 (make and share Workflows) + GAID 시스템 (install them and analyse with an AI agent), with
  // 내 서재 as the researcher's own literature space. The ring stays centred; each station opens its window on its own
  // side (left stations left, right stations right), so the short hairline to the window never crosses the ring.
  const PART = {
    hub: { name: 'GAID 허브', color: C.sig, desc: '논문·문헌·연구노트로 Workflow를 만들고 공유하는 공간' },
    sys: { name: 'GAID 시스템', color: C.sigInk, desc: 'Workflow를 설치하고 AI agent와 분석하는 연구 프레임워크' },
    me: { name: '내 서재', color: C.ink, desc: '연구자 개인의 문헌 관리 공간' },
  };
  const ST = [
    { name: '내 서재', icon: 'library', part: 'me' },
    { name: 'Workflow', icon: 'workflow', part: 'hub' },
    { name: 'GAID 허브', icon: 'share-2', part: 'hub' },
    { name: '연구 분석', icon: 'message-square-text', part: 'sys' },
    { name: '연구노트', icon: 'notebook-pen', part: 'sys' },
  ];
  const ST_ANG = [180, 240, 300, 360, 450];
  const ST_SIDE = ['L', 'L', 'R', 'R', 'R'];
  const LEGS = [
    { st: 0, cap: '내 문헌에서 시작합니다', take: 'lib' },
    { st: 1, cap: '논문 속 방법을 Workflow로', take: 'wf' },
    { st: 2, cap: '공유하고 고쳐 다음 version으로', take: 'hub' },
    { st: 3, cap: '설치한 Workflow로 AI agent와 분석', take: 'run' },
    { st: 4, cap: '결과와 판단은 연구노트에', take: 'note' },
    { st: 0, cap: '연구노트도 내 서재로', take: 'back' },
  ].map((l, k) => ({ ...l, k, t: T.cycle + 2 * k, ang: k === 5 ? 540 : ST_ANG[l.st], side: ST_SIDE[l.st] }));
  const WRS = { L: { x: 64, y: 330, w: 660, h: 409 }, R: { x: 1196, y: 330, w: 660, h: 409 } };
  { const col = { L: 0, R: 0 }; for (const lg of LEGS) lg.row = col[lg.side]++; }
  for (const lg of LEGS) {
    lg.o0 = lg.t - 0.05; lg.c0 = lg.k === 5 ? 29.0 : lg.t + 1.85;
    if (lg.k > 0) ev(lg.t - 0.5, 'move', { k: lg.k });
    ev(lg.o0, 'open', { k: lg.k }); ev(lg.c0, 'close', { k: lg.k });
  }
  ev(T.freeze, 'freeze'); ev(10.2, 'windup'); ev(T.press, 'press'); ev(T.sweepA, 'sweep', { dur: 1.1 }); ev(T.crt, 'crtoff');
  ev(T.ring, 'fly'); ev(T.ringDraw, 'ringdraw', { dur: 1.25 });
  for (let k = 0; k < 5; k++) ev(T.ringDraw + 0.25 * k, 'node', { k });
  ev(15.8, 'label'); ev(16.05, 'label'); ev(16.3, 'label');
  for (let k = 0; k < 5; k++) ev(T.lap + 0.125 * k, 'lapTick', { k });
  ev(T.lap + 0.625, 'lapDone');
  for (let k = 0; k < 6; k++) ev(30.45 + 0.0625 * k, 'retract', { k });

  function stationPos(angDeg) { const a = rad(angDeg); return { x: RC.x + R * Math.cos(a), y: RC.y + R * Math.sin(a) }; }
  function dotAngle(t) { // ring-local angle of the AI agent's dot
    if (t < T.ringDraw) return ST_ANG[0];
    if (t < T.ringDraw + 1.25) return 180 + 360 * (t - T.ringDraw) / 1.25;
    if (t < T.cycle + 0.5) return 540;
    if (t < 29.0) {
      let a = 180;
      for (let k = 1; k < LEGS.length; k++) {
        const u = inOut(seg(t, LEGS[k].t - 0.5, LEGS[k].t));
        a = lerp(a, LEGS[k].ang, u);
        if (t < LEGS[k].t) return a;
      }
      return a;
    }
    if (t < T.lap) return 540;
    if (t < T.lap + 0.625) return 540 + 360 * (t - T.lap) / 0.625;
    return 900 + 180 * (t - (T.lap + 0.625));
  }
  const ringRot = () => 0; // the ring stays put; windows open on each station's side
  const worldPos = (ang, t) => stationPos(ang + ringRot(t));
  function visitedAng(t) { // how far the cycle has gone, degrees from 180 (ring-local)
    if (t < T.cycle) return 0;
    if (t < 29.0) return dotAngle(t) - 180;
    return 360;
  }
  function arcStroke(cx, cy, r, a0, a1, style, lw) { if (a1 <= a0) return; ctx.save(); ctx.lineWidth = lw; ctx.strokeStyle = style; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, r, rad(a0), rad(a1)); ctx.stroke(); ctx.restore(); }
  function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; }
  function drawGhostPlan(t) { // the cycle's plan shows faintly before the dot draws it
    const a = seg(t, T.crt, T.crt + 0.25) * (1 - seg(t, T.ringDraw + 0.9, T.ringDraw + 1.25));
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.setLineDash([5, 8]); ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(127,162,255,0.5)';
    ctx.beginPath(); ctx.arc(RC.x, RC.y, R, 0, 2 * Math.PI); ctx.stroke();
    for (const ang of ST_ANG) { const p = worldPos(ang, t); ctx.beginPath(); ctx.arc(p.x, p.y, 30, 0, 2 * Math.PI); ctx.stroke(); }
    ctx.restore();
  }
  // ring-local arcs: 내 서재 around 180, GAID 허브 over Workflow and 허브, GAID 시스템 over 분석 and 연구노트
  const ARCS = [[180, 210, 'me'], [210, 330, 'hub'], [330, 510, 'sys'], [510, 540, 'me']];
  function drawRing(t, c, layer) {
    if (layer === 'arcs') drawGhostPlan(t);
    if (t < T.ring || t > T.end + 0.05) return;
    if (layer === 'nodes') return drawNodes(t, c);
    const lw = 1.6 / Math.max(c.z, 0.2) * Math.max(c.z, 0.45);
    const drawn = t < T.ringDraw ? 0 : Math.min(360, 360 * (t - T.ringDraw) / 1.25);
    if (drawn <= 0) return;
    const rot = ringRot(t), va = visitedAng(t), head = 180 + drawn;
    for (const [a0, a1, part] of ARCS) {
      const s = a0 + (a0 === 180 ? 0 : 2.5), e = Math.min(a1 - (a1 === 540 ? 0 : 2.5), head);
      if (e <= s) continue;
      const col = PART[part].color, w = (part === 'me' ? 2.0 : 2.8) * lw;
      arcStroke(RC.x, RC.y, R, s + rot, e + rot, rgba(col, t > 29 ? 0.85 : 0.38), w);
      const ve = Math.min(e, 180 + va);
      if (ve > s) arcStroke(RC.x, RC.y, R, s + rot, ve + rot, rgba(col, 0.95), w * 1.25);
    }
    if (drawn < 360) arcStroke(RC.x, RC.y, R, head - 40 + rot, head + rot, 'rgba(127,162,255,0.9)', 3 * lw);
    if (t > 29.0 && t < T.lap + 0.9) { const g = 1 - seg(t, T.lap + 0.625, T.lap + 0.9); glow(RC.x, RC.y, R * 1.25, 0.12 * g * seg(t, T.lap, T.lap + 0.3)); }
  }
  function drawNodes(t, c) {
    const nodeRetract = k => t > 35.3 ? 1 - backIn(seg(t, 35.3 + 0.0625 * k, 35.3 + 0.0625 * k + 0.15), 1.5) : 1;
    // GAID's mark at the ring's centre: both parts are one platform
    const ma = out3(seg(t, 15.9, 16.2)) * nodeRetract(5);
    if (LOGO_MARK && ma > 0.01) { ctx.save(); ctx.globalAlpha = ma; const s = 84 * (0.85 + 0.15 * ma); ctx.drawImage(LOGO_MARK, RC.x - s / 2, RC.y - s / 2, s, s); ctx.restore(); }
    for (let k = 0; k < 5; k++) {
      const pop = back(seg(t, T.ringDraw + 0.25 * k, T.ringDraw + 0.25 * k + 0.22), 1.8) * nodeRetract(k);
      if (pop <= 0.01) continue;
      const p = worldPos(ST_ANG[k], t), col = PART[ST[k].part].color;
      const activeLeg = LEGS.find(l => t >= l.t - 0.05 && t < l.t + 2 - 0.05 && l.st === k && t < 29.0);
      const visited = LEGS.some(l => l.st === k && t >= l.t);
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(pop, pop);
      const r = 30;
      ctx.fillStyle = activeLeg ? '#1e2b4d' : C.face2; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
      ctx.lineWidth = activeLeg ? 2.4 : 1.4; ctx.strokeStyle = rgba(col, activeLeg ? 1 : visited ? 0.7 : 0.4);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
      if (c.z * 30 > 9) icon(ST[k].icon, -13, -13, 26, activeLeg ? 'sigInk' : visited ? 'ink' : 'ink2');
      ctx.restore();
    }
  }
  function drawLegend(t) { // HUD: what the three colours mean, held through the cycle
    if (t < 15.8 || t > 29.8) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    [['hub', 96, 15.8], ['sys', 716, 16.05], ['me', 1336, 16.3]].forEach(([key, x, ta], i) => {
      const a = out3(seg(t, ta, ta + 0.25)) * (1 - seg(t, 29.3 + 0.06 * i, 29.5 + 0.06 * i));
      if (a <= 0) return;
      const p = PART[key], y = 900 + 12 * (1 - out3(seg(t, ta, ta + 0.25))) + 14 * seg(t, 29.3 + 0.06 * i, 29.5 + 0.06 * i), keep = t < 29.3;
      ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = key === 'me' ? 3 : 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x + 14, y - 10, 13, rad(200), rad(340)); ctx.stroke(); ctx.restore();
      text(keep ? `legend-${key}` : null, p.name, x + 40, y, { size: 28, weight: 700, color: C.ink, alpha: a });
      text(keep ? `legend-${key}-d` : null, p.desc, x, y + 36, { size: 21, weight: 500, color: C.ink2, alpha: a });
    });
  }
  function drawCycleDot(t) {
    let p, r = 11;
    if (t < T.ring) return;
    if (t < T.ringDraw) {
      const u = inOut(seg(t, T.ring, T.ringDraw)), a = STATUS, b = worldPos(ST_ANG[0], t);
      p = { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) - 140 * Math.sin(u * Math.PI) }; r = lerp(8, 11, u);
    } else p = worldPos(dotAngle(t), t);
    if (t > T.end) return;
    if (t >= T.ringDraw) { // trail where the dot moves on screen (ring draw, and orbiting after the lap)
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 1; i <= 8; i++) { const ti = t - i * 0.025, q = worldPos(dotAngle(ti), ti); ctx.globalAlpha = 0.18 * (1 - i / 9); ctx.fillStyle = C.sig; ctx.beginPath(); ctx.arc(q.x, q.y, r * (1 - i / 12), 0, 7); ctx.fill(); }
      ctx.restore();
    }
    dot(p.x, p.y, r);
  }
  function drawRows(t) { // HUD: each side lists its stations above its window, as the cycle reaches them
    if (t < T.cycle || t > 31.1) return;
    LEGS.forEach((lg, k) => {
      const a0 = lg.t + 0.15, ra = 30.45 + 0.0625 * k;
      const a = out3(seg(t, a0, a0 + 0.2)) * (1 - out3(seg(t, ra, ra + 0.15)));
      if (a <= 0) return;
      const dy = 14 * (1 - out3(seg(t, a0, a0 + 0.2))) + 14 * out3(seg(t, ra, ra + 0.15));
      const W0 = WRS[lg.side], x = W0.x + 18, y = 132 + 64 * lg.row + dy, col = PART[ST[lg.st].part].color;
      const active = t >= lg.t - 0.05 && t < (k === 5 ? 29.0 : lg.t + 1.95);
      const keep = t < ra;
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x - 18, y - 9, 5, 0, 7); ctx.fill();
      if (active) glow(x - 18, y - 9, 26, 0.7);
      ctx.restore();
      const nw = text(keep ? `row-${k}-t` : null, ST[lg.st].name, x, y, { size: 26, weight: 700, color: active ? C.ink : C.ink2, alpha: a });
      text(keep ? `row-${k}-c` : null, lg.cap, x + nw + 16, y, { size: 22, weight: 500, color: active ? C.ink2 : C.ink3, alpha: a });
    });
  }
  function takeIndex(lg, t) { const tk = TAKES[lg.take]; if (!tk) return -1; return clamp(Math.floor((t - lg.o0) * FPS), 0, tk.n - 1); }
  function windowRect(lg, t, c) {
    const w = worldPos(lg.ang, t), p = toScreen(c, w.x, w.y);
    const WR0 = WRS[lg.side], inner = lg.side === 'L' ? WR0.x + WR0.w : WR0.x, ay = clamp(p.y, WR0.y + 52, WR0.y + WR0.h - 18);
    const node = { x: inner, y: ay - 30, w: 0, h: 60 }; // the window unfolds from its edge nearest the station, outside the ring
    let e;
    if (t < lg.c0) e = back(seg(t, lg.o0, lg.o0 + 0.25), 1.15);
    else e = 1 - inC(seg(t, lg.c0, lg.c0 + 0.2));
    if (t < lg.o0 || e <= 0.002) return null;
    const WR = WR0;
    return { x: lerp(node.x, WR.x, e), y: lerp(node.y, WR.y, e), w: lerp(node.w, WR.w, e), h: lerp(node.h, WR.h, e), e, p, WR };
  }
  function drawWindows(t, c) {
    if (t < T.cycle - 0.1 || t > 29.3) return;
    const live = LEGS.filter(lg => t >= lg.o0 && t < lg.c0 + 0.2);
    live.sort((a, b) => (t >= a.c0 ? -1 : 0) - (t >= b.c0 ? -1 : 0));
    for (const lg of live) {
      const r = windowRect(lg, t, c); if (!r) continue;
      const la = t < lg.c0 ? seg(t, lg.o0 + 0.1, lg.o0 + 0.3) : 1 - seg(t, lg.c0, lg.c0 + 0.08);
      const col = PART[ST[lg.st].part].color;
      if (la > 0) { // short horizontal hairline from the station outward to the near edge of its window
        const p = r.p, left = lg.side === 'L', ex = left ? r.x + r.w : r.x, ey = clamp(p.y, r.y + 52, r.y + r.h - 18);
        ctx.save(); ctx.globalAlpha = la; ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(col, 0.6);
        ctx.beginPath(); ctx.moveTo(p.x + (left ? -34 : 34), p.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ex, ey, 3.5, 0, 7); ctx.fill(); ctx.restore();
      }
      ctx.save();
      panel(r.x, r.y, r.w, r.h, 14 * clamp(r.e), 1, { blur: 50, sy: 20 });
      const tb = 38 * clamp(r.h / r.WR.h);
      ctx.save(); rr(r.x, r.y, r.w, r.h, 14); ctx.clip();
      ctx.fillStyle = C.chrome; ctx.fillRect(r.x, r.y, r.w, tb);
      const im = takeFrame(lg.take, takeIndex(lg, t));
      if (im) ctx.drawImage(im, r.x, r.y + tb, r.w, r.h - tb);
      ctx.restore();
      if (r.e > 0.85) {
        const st = ST[lg.st];
        icon(st.icon, r.x + 16, r.y + 11, 18, 'ink2');
        text(null, st.name, r.x + 42, r.y + 26, { size: 17, weight: 650, color: C.ink });
        if (st.part !== 'me') {
          const pw = measure(PART[st.part].name, 15, 650);
          ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(r.x + r.w - 26 - pw, r.y + 21, 4, 0, 7); ctx.fill(); ctx.restore();
          text(null, PART[st.part].name, r.x + r.w - 16, r.y + 26, { size: 15, weight: 650, color: C.ink2, align: 'right' });
        }
      }
      ctx.restore();
    }
  }

  // ---------- section F: many rings, the second brain ----------
  const S = 620;
  const RINGS = [];
  const LINKS = [];
  (function buildBrain() {
    const rnd = mulberry(4242);
    const pts = [];
    for (let j = -8; j <= 8; j++) for (let i = -10; i <= 10; i++) {
      const x = RC.x + i * S + j * S / 2, y = RC.y + j * S * 0.866, d = Math.hypot(x - RC.x, y - RC.y);
      if (d <= 3700) pts.push({ x, y, d });
    }
    pts.sort((a, b) => a.d - b.d);
    const maxD = pts[pts.length - 1].d;
    for (const p of pts) {
      let spawn = 30.25;
      if (p.d > 1) {
        for (let tt = 30.0; tt <= 34.6; tt += 1 / FPS) { if ((p.d - R - 60) * Math.exp(zPull(tt)) < 960) { spawn = tt; break; } spawn = 34.6; }
        spawn = Math.max(30.25, q16(spawn - 0.12));
      }
      RINGS.push({ ...p, spawn, phase: rnd() * 360, ret: T.collapse + 0.05 + (1 - p.d / maxD) * 0.3 });
    }
    RINGS[0].main = true;
    for (let a = 0; a < RINGS.length; a++) for (let b = a + 1; b < RINGS.length; b++) {
      const A = RINGS[a], B = RINGS[b];
      if (Math.abs(Math.hypot(A.x - B.x, A.y - B.y) - S) > 1) continue;
      if (rnd() > 0.6) continue;
      const sa = Math.floor(rnd() * 5), sb = Math.floor(rnd() * 5);
      const t0 = q16(Math.max(A.spawn, B.spawn) + 0.25 + rnd() * 0.5);
      if (t0 > 34.6) continue;
      LINKS.push({ a, b, sa, sb, t0, ph: rnd() });
    }
    for (const rg of RINGS) if (!rg.main) ev(rg.spawn, 'ring', { pan: clamp((rg.x - RC.x) / 2400, -1, 1), d: Math.round(rg.d) });
    for (const ln of LINKS) ev(ln.t0, 'link');
    ev(T.collapse, 'collapse');
    ev(35.9, 'endSweep', { dur: 1.1 }); ev(36.0, 'endChord'); ev(36.85, 'merge');
  })();
  function ringNode(rg, k) { const a = rad(ST_ANG[k]); return { x: rg.x + R * Math.cos(a), y: rg.y + R * Math.sin(a) }; }
  function drawBrain(t, c) {
    if (t < 30.2 || t > T.end) return;
    const lw = 1.6 / c.z;
    // links between researchers' rings
    const lr = 1 - out3(seg(t, T.collapse, T.collapse + 0.15));
    for (const ln of LINKS) {
      const g = out3(seg(t, ln.t0, ln.t0 + 0.25)) * lr; if (g <= 0) continue;
      const A = ringNode(RINGS[ln.a], ln.sa), B = ringNode(RINGS[ln.b], ln.sb);
      ctx.save(); ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(127,162,255,0.32)';
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(lerp(A.x, B.x, g), lerp(A.y, B.y, g)); ctx.stroke();
      if (g >= 1) { const u = ((t - ln.t0) * 0.6 + ln.ph) % 1; ctx.fillStyle = 'rgba(127,162,255,0.85)'; ctx.beginPath(); ctx.arc(lerp(A.x, B.x, u), lerp(A.y, B.y, u), 3.2 / c.z, 0, 7); ctx.fill(); }
      ctx.restore();
    }
    for (const rg of RINGS) {
      if (rg.main) continue;
      const g = seg(t, rg.spawn, rg.spawn + 0.35); if (g <= 0) continue;
      const sr = t > rg.ret ? 1 - backIn(seg(t, rg.ret, rg.ret + 0.15), 1.4) : 1; if (sr <= 0.01) continue;
      ctx.save(); ctx.translate(rg.x, rg.y); ctx.scale(sr, sr); ctx.translate(-rg.x, -rg.y);
      arcStroke(rg.x, rg.y, R, 162, 162 + 360 * out3(g), 'rgba(231,233,238,0.22)', lw);
      const da = rg.phase + 180 * (t - rg.spawn);
      arcStroke(rg.x, rg.y, R, da - 120, da, 'rgba(51,102,232,0.5)', 2.4 * lw);
      for (let k = 0; k < 5; k++) {
        const pop = back(seg(t, rg.spawn + 0.05 * k, rg.spawn + 0.05 * k + 0.2), 1.6); if (pop <= 0) continue;
        const p = ringNode(rg, k);
        ctx.fillStyle = C.face2; ctx.beginPath(); ctx.arc(p.x, p.y, 30 * pop, 0, 7); ctx.fill();
        ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.stroke();
      }
      const dp = { x: rg.x + R * Math.cos(rad(da)), y: rg.y + R * Math.sin(rad(da)) };
      dot(dp.x, dp.y, 11 * out3(g));
      ctx.restore();
    }
  }

  // ---------- section H: the ring becomes the orbit of the GAID mark ----------
  const LOCK = { x: 741, y: 370, s: 2.5 };
  const ORBIT = { cx: 32.06, cy: 32.25, a: 30.48, b: 12.83, rot: -27.16 }; // ellipse fitted to the mark's orbit path
  function drawEnd(t, c) {
    if (t < T.end) return;
    const sc = toScreen(c, RC.x, RC.y), r0 = R * c.z;
    const m = inOut(seg(t, T.end, 36.3));
    const tg = { x: LOCK.x + ORBIT.cx * LOCK.s, y: LOCK.y + ORBIT.cy * LOCK.s, a: ORBIT.a * LOCK.s, b: ORBIT.b * LOCK.s };
    const E = { x: lerp(sc.x, tg.x, m), y: lerp(sc.y, tg.y, m), a: lerp(r0, tg.a, m), b: lerp(r0, tg.b, m), rot: rad(ORBIT.rot) * m };
    const front = lerp(560, 1520, inOut(seg(t, 35.9, 37.0)));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    glow(tg.x + 90, tg.y + 10, 520, 0.10 * out3(seg(t, 35.8, 36.8)));
    // drawn orbit, only where the light has not yet passed
    if (front < 1480) {
      ctx.save(); ctx.beginPath(); ctx.rect(front - 40, 0, W, H); ctx.clip();
      ctx.lineWidth = lerp(2.4, 7, m); ctx.strokeStyle = m < 0.5 ? 'rgba(231,233,238,0.5)' : C.logo;
      ctx.beginPath(); ctx.ellipse(E.x, E.y, E.a, E.b, E.rot, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    // the dot keeps orbiting, then merges into the mark
    const ph = rad(dotAngle(t) + ringRot(t));
    const dr = 11 * (1 - inC(seg(t, 36.6, 36.9)));
    if (dr > 0.3) { const ca = Math.cos(E.rot), sa = Math.sin(E.rot), ex = E.a * Math.cos(ph), ey = E.b * Math.sin(ph); dot(E.x + ex * ca - ey * sa, E.y + ex * sa + ey * ca, dr); }
    // lockup revealed by light: unlit pixels at a few percent
    if (LOGO) {
      const lw = 175 * LOCK.s, lh = 64 * LOCK.s;
      ctx.save(); ctx.globalAlpha = 0.07 * seg(t, 35.7, 35.9); ctx.drawImage(LOGO, LOCK.x, LOCK.y, lw, lh); ctx.restore();
      if (front > LOCK.x - 140) {
        ctx.save();
            const off = OFF; const o = off.getContext('2d');
        o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, off.width, off.height); o.globalCompositeOperation = 'source-over';
        o.drawImage(LOGO, 0, 0, lw * 2, lh * 2);
        o.globalCompositeOperation = 'destination-in';
        const g2 = o.createLinearGradient((front - 140 - LOCK.x) * 2, 0, (front - LOCK.x) * 2, 0); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
        o.fillStyle = g2; o.fillRect(0, 0, off.width, off.height);
        if (front < 1500) { // soft glint riding the front (<= 20 %), on the mark's own pixels only
          o.globalCompositeOperation = 'source-atop';
          const fx = (front - LOCK.x) * 2, gl = o.createLinearGradient(fx - 240, 0, fx, 0);
          gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(0.75, 'rgba(255,255,255,0.2)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
          o.fillStyle = gl; o.fillRect(0, 0, off.width, off.height);
        }
        ctx.drawImage(off, 0, 0, lw * 2, lh * 2, LOCK.x, LOCK.y, lw, lh);
        ctx.restore();
      }
    }
    // merge glint
    const mg = seg(t, 36.85, 37.15); if (mg > 0 && mg < 1) glow(tg.x + tg.a * 0.6, tg.y - tg.b * 0.9, 60, 0.6 * Math.sin(mg * Math.PI));
    const la = out3(seg(t, 36.0, 36.16));
    text(la > 0.99 ? 'platform' : null, '지구과학 연구자를 위한 AI agent 연구 지원 플랫폼', 960, 648 + 14 * (1 - la), { size: 46, weight: 600, color: C.ink, align: 'center', alpha: la });
    const ta = out3(seg(t, 37.0, 37.2));
    text(ta > 0.99 ? 'review-tag' : null, '내부 검토용 영상', 1824, 1016, { size: 22, weight: 500, color: C.ink3, align: 'right', alpha: ta });
  }
  let OFF = null;

  // ---------- headlines (HUD, bottom left) ----------
  const HEAD_Y = 984;
  function headline(id, s, x, t, a0, r0, o = {}) {
    const ain = out3(seg(t, a0, a0 + 0.16)), aout = r0 == null ? 0 : out3(seg(t, r0, r0 + 0.2));
    const a = ain * (1 - aout); if (a <= 0) return measure(s, 58, 650);
    const y = HEAD_Y + 22 * (1 - ain) + 26 * aout;
    return text(t >= a0 + 0.16 && (r0 == null || t < r0) ? id : null, s, x, y, { size: 58, weight: 650, color: o.color || C.ink, alpha: a });
  }
  function drawHeadlines(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const tf = ft(t);
    if (t < 6.1) {
      const parts = [['h1a', '자료를 찾고,', 0.3], ['h1b', '논문을 읽고,', 1.3], ['h1c', '코드를 짭니다', 2.3]];
      let x = 96;
      for (const [id, s, a0] of parts) { const w = headline(id, s, x, t, a0, 5.8); x += w + 22; }
    }
    if (t >= 5.95 && t < 11.0) headline('h2', '스킬과 도구는 흩어져 있습니다', 96, tf, 6.0, 10.7);
    if (t >= 11.0 && t < 15.2) headline('h3', 'GAID가 한곳에 모읍니다', 96, t, 11.0, 14.9);
    if (t >= 29.6 && t < 35.3) {
      const a = out3(seg(t, 29.65, 29.9)) * (1 - seg(t, T.collapse, T.collapse + 0.2));
      const g = ctx.createLinearGradient(0, 820, 0, H); g.addColorStop(0, 'rgba(10,12,16,0)'); g.addColorStop(1, `rgba(10,12,16,${0.8 * a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 820, W, H - 820);
      headline('h4', '연구 고리가 모여 KIGAM Second brain이 됩니다', 96, t, 29.65, T.collapse);
    }
  }

  // ---------- frame ----------
  function frame(t) {
    TXT = [];
    const c = camAt(t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(BG, 0, 0);
    applyCam(c);
    grid(c);
    drawHook(t);
    drawGaidWindow(t);
    drawScatter(t);
    drawSweepA(t);
    drawCaret(t);
    const ad = agentDot(t); if (ad && t >= T.press + 0.45) dot(ad.x, ad.y, ad.r);
    drawBrain(t, c);
    drawRing(t, c, 'arcs');
    drawCycleDot(t);
    drawRing(t, c, 'nodes');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawWindows(t, c);
    drawRows(t);
    drawLegend(t);
    drawEnd(t, c);
    drawHeadlines(t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(VIG, 0, 0);
  }
  function takesFor(t) {
    const need = [];
    for (const lg of LEGS) if (t >= lg.o0 && t < lg.c0 + 0.2) { const k = takeIndex(lg, t); if (k >= 0) need.push([lg.take, k]); }
    return need;
  }

  // ---------- page contract ----------
  window.DUR = DUR;
  window.FPS = FPS;
  window.EV = EV.sort((a, b) => a.t - b.t);
  window.CUES = CUES;
  window.STILLS = {
    hook: 3.2, scatter: 9.4, freeze: 10.3, gather: 11.9, grid: 13.0, ring: 16.4, library: 17.9, workflow: 19.9, hub: 21.9,
    analysis: 23.9, note: 25.9, back: 27.9, lap: 29.6, brain1: 31.5, brain2: 34.2, collapse: 35.4, morph: 36.1, end: 39.0, last: 41.96,
  };
  window.render = async t => {
    for (const [id, k] of takesFor(t)) await needTake(id, k);
    frame(t);
    return true;
  };
  window.TEXTS = () => TXT.slice();
  window.textSpans = async (step = 0.04) => { // lemo readcheck semantics: first continuous fully-visible stretch per id+text
    const seen = {};
    for (let t = 0; t <= DUR + 1e-9; t += step) {
      await window.render(t);
      const vis = new Set();
      for (const b of TXT) {
        const key = b.id + '\u0000' + b.text;
        if (!(b.x0 >= 0 && b.y0 >= 0 && b.x1 <= W && b.y1 <= H)) continue;
        vis.add(key);
        const s = seen[key] ??= { id: b.id, text: b.text, a: t, b: t, done: false };
        if (!s.done) s.b = Math.min(t + step, DUR);
      }
      for (const k in seen) if (!vis.has(k)) seen[k].done = true;
    }
    return Object.values(seen).map(s => ({ id: s.id, text: s.text, a: +s.a.toFixed(3), b: +s.b.toFixed(3) }));
  };

  (async () => {
    try {
      buildStage();
      OFF = document.createElement('canvas'); OFF.width = 175 * LOCK.s * 2; OFF.height = 64 * LOCK.s * 2;
      await Promise.all(['500', '600', '650', '700'].map(w => document.fonts.load(`${w} 40px Pretendard`, '가GAID')));
      for (const n of ICON_NAMES) {
        const src = await (await fetch(`icons/${n}.svg`)).text();
        icons[n] = {};
        for (const [k, col] of Object.entries(ICON_COLORS)) icons[n][k] = await img('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src.replace(/currentColor/g, col)));
      }
      LOGO = await img('brand/horizontal-on-dark.svg');
      LOGO_MARK = await img('brand/mark-on-dark.svg');
      if (!document.fonts.check('600 40px Pretendard', '가')) throw new Error('Pretendard did not load');
      await window.render(0);
      window.READY = true;
    } catch (err) { window.RENDER_ERROR = String(err && err.stack || err); }
  })();
})();
