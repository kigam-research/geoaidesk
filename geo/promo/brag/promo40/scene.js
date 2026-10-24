/* GAID promo40 — a 40-second promotional film made fresh in code with brag-slim (plan: brag-plan.md in this folder).
 * Same messages as v4; free kinetic direction. Real GAID screens appear only as window elements inside the motion
 * graphics (crops of the v3 Pocheon PGI and v2 Yilgarn takes, both real app captures). 120 BPM: beat 0.5 s = 15 frames,
 * bar 2 s; 20 bars. Deterministic: window.motion.frame(t) draws film second t.
 */
(() => {
  'use strict';
  const FPS = 30, BEAT = 0.5, BAR = 2, DURATION = 40;
  const stage = document.getElementById('stage');
  const NS = 'http://www.w3.org/2000/svg';
  const C = {
    ink: '#171b23', ink2: '#525a68', ink3: '#646c7a', face: '#ffffff', chrome: '#f1f3f6', edge: '#dce0e6',
    signal: '#1f5eff', signalInk: '#1d4fd8', tint: '#e8eeff', onDark: '#4d7fff', onDarkInk: '#e7ebf2', grey: '#9aa3b0',
  };

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lin = x => clamp(x);
  const out = x => 1 - Math.pow(1 - clamp(x), 4);
  const back = x => { x = clamp(x); const c = 1.6; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const inOut = x => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const easeIn = x => Math.pow(clamp(x), 3);
  const ramp = (t, a, b, e = out) => e((t - a) / (b - a));
  const lerp = (a, b, v) => a + (b - a) * v;

  // ---------- dom ----------
  function h(tag, cls, parent, html) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html !== undefined) el.innerHTML = html;
    (parent || stage).appendChild(el);
    return el;
  }
  function sv(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    if (parent) parent.appendChild(el);
    return el;
  }
  function put(el, { o = 1, x = 0, y = 0, s = 1, r = 0 } = {}) {
    el.style.opacity = o;
    el.style.visibility = o <= 0.002 ? 'hidden' : 'visible';
    el.style.transform = `translate(${x}px,${y}px) scale(${s}) rotate(${r}deg)`;
  }
  const place = (el, x, y) => { el.style.left = `${x}px`; el.style.top = `${y}px`; return el; };
  const ICON = {};
  const icon = (name, size, color) => `<span class="icon" style="width:${size}px;height:${size}px;color:${color}">${ICON[name] || ''}</span>`;
  let LOGO = null, LOGO_DARK = null;
  const pending = [];
  const CUES = [];
  const cue = (t, kind, extra = {}) => CUES.push({ t: +t.toFixed(4), kind, ...extra });

  // Horizontal lockup: ring sweep, G, lettering wipe; colour = the brand file (color on light, on-dark on ink).
  function lockup(parent, height, dark) {
    const L0 = dark ? LOGO_DARK : LOGO;
    const scale = height / 64;
    const svg = sv('svg', { width: 175 * scale, height, viewBox: '0 0 175 64' });
    Object.assign(svg.style, { position: 'absolute', overflow: 'visible' });
    parent.appendChild(svg);
    const defs = sv('defs', {}, svg);
    const id = `m${Math.random().toString(36).slice(2)}`;
    const mask = sv('mask', { id, maskUnits: 'userSpaceOnUse', x: -20, y: -20, width: 120, height: 104 }, defs);
    const sweep = sv('circle', { cx: 32, cy: 32, r: 22, fill: 'none', stroke: '#fff', 'stroke-width': 44, transform: 'rotate(-150 32 32)', pathLength: 1, 'stroke-dasharray': '0 1' }, mask);
    const ring = sv('g', { fill: L0.fill, mask: `url(#${id})` }, svg);
    sv('path', { d: L0.ring, 'fill-rule': 'evenodd' }, ring);
    const g = sv('g', { fill: L0.fill }, svg);
    sv('path', { d: L0.g, 'fill-rule': 'evenodd' }, g);
    const clipId = `c${Math.random().toString(36).slice(2)}`;
    const clip = sv('clipPath', { id: clipId }, defs);
    const clipRect = sv('rect', { x: 70, y: -10, width: 0, height: 84 }, clip);
    const letters = sv('g', { fill: L0.fill, 'clip-path': `url(#${clipId})` }, svg);
    for (const l of L0.letters) sv('path', { d: l.d, transform: l.transform }, letters);
    return {
      svg, scale, width: 175 * scale,
      set({ ringF = 1, gO = 1, gS = 1, lettersF = 1 }) {
        sweep.setAttribute('stroke-dasharray', `${ringF} 1`);
        g.setAttribute('opacity', gO);
        g.setAttribute('transform', `translate(32 32) scale(${gS}) translate(-32 -32)`);
        clipRect.setAttribute('width', 110 * lettersF);
      },
    };
  }

  // Kinetic line: the text rises out of a mask; `em` words take the accent colour.
  function kline(parent, str, { x, y, size, color, em, emColor, align = 'left', width, weight = 800 }) {
    const el = h('div', 'line kin', parent);
    const html = em ? str.split(em).join(`<b style="color:${emColor};font-weight:${weight}">${em}</b>`) : str;
    el.innerHTML = `<span>${html}</span>`;
    Object.assign(el.style, { left: `${x}px`, top: `${y}px`, fontSize: `${size}px`, color, fontWeight: weight, textAlign: align });
    if (width) el.style.width = `${width}px`;
    const inner = el.firstChild;
    return (t, a, b, { rise = 0.32, fall = 0.22, exitUp = true } = {}) => {
      const i = ramp(t, a, a + rise, out), o = b == null ? 0 : ramp(t, b - fall, b, easeIn);
      el.style.visibility = t < a || (b != null && t >= b) ? 'hidden' : 'visible';
      inner.style.transform = `translateY(${(1 - i) * 112 - o * (exitUp ? 112 : -112)}%)`;
    };
  }

  // A real GAID screen as a window element: a crop of one capture frame (CSS px of the 1280×720 app) or a still image.
  function windowEl(parent, spec, width) {
    const el = h('div', 'win', parent);
    const bar = h('div', 'bar', el, `<i></i><span>${spec.label}</span>`);
    const body = h('div', 'body', el);
    const img = h('img', '', body);
    const [cx, cy, cw, ch] = spec.crop;
    const k = width / cw;
    el.style.width = `${width}px`;
    body.style.height = `${ch * k}px`;
    const natW = spec.natural ? spec.natural[0] : 1280, natH = spec.natural ? spec.natural[1] : 720;
    Object.assign(img.style, { width: `${natW * k}px`, height: `${natH * k}px`, left: `${-cx * k}px`, top: `${-cy * k}px` });
    const src = spec.still || `${spec.cap}/shots/${spec.shot}/frame-${String(spec.frame).padStart(5, '0')}.png`;
    img.src = src;
    pending.push(img.decode().catch(() => {}));
    let ring = null;
    if (spec.focus) {
      const [fx, fy, fw, fh] = spec.focus;
      ring = h('div', 'abs', body);
      Object.assign(ring.style, { left: `${(fx - cx) * k - 6}px`, top: `${(fy - cy) * k - 6}px`, width: `${fw * k + 12}px`, height: `${fh * k + 12}px`, border: `4px solid ${C.signal}`, borderRadius: '10px', cornerShape: 'bevel' });
    }
    return { el, ring, height: 41 + ch * k, width, bar };
  }

  // Full-height brand-blue band that sweeps across a cut at time `at`.
  function wipe(layer, at) {
    const band = h('div', 'abs', layer);
    Object.assign(band.style, { left: '0px', top: '0px', width: '760px', height: '1080px', background: C.signal });
    return t => {
      const f = ramp(t, at - 0.26, at + 0.22, inOut);
      band.style.visibility = f > 0 && f < 1 ? 'visible' : 'hidden';
      band.style.transform = `translateX(${lerp(-780, 1940, f)}px) skewX(-12deg)`;
    };
  }

  const scenes = [];
  const scene = (a, b, ground, build) => scenes.push({ a, b, ground, build });

  // ============ S1 hook 0–4 s: the researcher's three kinds of work, one per two beats ============
  scene(0, 4, C.ink, layer => {
    const LINES = [['자료를 찾고', '자료'], ['논문을 읽고', '논문'], ['코드를 짭니다', '코드']];
    const Y = [190, 400, 610];
    const lines = LINES.map(([s, em], i) => kline(layer, s, { x: 170, y: Y[i], size: 156, color: '#ffffff', em, emColor: C.onDark }));
    const svg = sv('svg', { width: 1920, height: 1080 }, layer);
    svg.style.position = 'absolute';
    // vignettes to the right of each line, drawn in the brand blue on ink
    const vg = [0, 1, 2].map(i => sv('g', { transform: `translate(1180 ${Y[i] + 26})` }, svg));
    // 0 map: contours + survey points
    for (let k = 0; k < 3; k++) {
      const pts = [];
      for (let a = 0; a <= 360; a += 12) { const r = 28 + k * 22 + 6 * Math.sin(a / 25 + k); pts.push(`${(120 + r * 1.6 * Math.cos(a * Math.PI / 180)).toFixed(1)} ${(80 + r * 0.8 * Math.sin(a * Math.PI / 180)).toFixed(1)}`); }
      sv('path', { d: `M ${pts.join(' L ')} Z`, fill: 'none', stroke: '#39404d', 'stroke-width': 3 }, vg[0]);
    }
    const dots = [[40, 40], [210, 60], [90, 130], [170, 120], [250, 30], [130, 70], [300, 110], [20, 100]].map(([x, y], k) => sv('rect', { x: x - 8, y: y - 8, width: 16, height: 16, fill: k % 3 ? '#8f98a8' : C.onDark, transform: `rotate(45 ${x} ${y})` }, vg[0]));
    const logPts = []; for (let y = 0; y <= 160; y += 4) logPts.push(`${(470 + 30 * Math.sin(y * 0.09) + 14 * Math.sin(y * 0.27)).toFixed(1)} ${y}`);
    const log = sv('path', { d: `M ${logPts.join(' L ')}`, fill: 'none', stroke: C.onDark, 'stroke-width': 4, pathLength: 1, 'stroke-dasharray': '0 1' }, vg[0]);
    // 1 paper: lines + highlight sweep
    const hl = [];
    for (let k = 0; k < 6; k++) {
      const w = [380, 320, 400, 260, 350, 300][k];
      const m = sv('rect', { x: -6, y: k * 28 - 6, width: 0, height: 22, fill: '#22356e' }, vg[1]);
      sv('rect', { x: 0, y: k * 28, width: w, height: 10, rx: 4, fill: k === 0 ? '#c9d0db' : '#4a5260' }, vg[1]);
      hl.push({ m, w });
    }
    // 2 code: tokens typed, then a run bar
    const toks = [];
    [[60, 120, 70], [40, 160, 90], [40, 80, 140, 60], [60, 110, 100], [40, 90, 70, 120]].forEach((row, k) => {
      let x = 0; row.forEach((w, j) => { toks.push({ el: sv('rect', { x, y: k * 28, width: w, height: 11, rx: 4, fill: j === 0 ? C.onDark : (j % 2 ? '#8f98a8' : '#4a5260'), opacity: 0 }, vg[2]), k, j }); x += w + 14; });
    });
    const run = sv('rect', { x: 0, y: 150, width: 0, height: 10, rx: 5, fill: C.onDark }, vg[2]);
    const hop = h('div', 'abs', layer);
    Object.assign(hop.style, { width: '30px', height: '30px', background: C.onDark, transform: 'rotate(45deg)' });
    [0, 1, 2].forEach(i => cue(i * 1.0, 'slam', { step: i }));
    const HOPS = [2.5, 2.75, 3.0, 3.25, 3.5];
    HOPS.forEach((t, i) => cue(t, 'hop', { step: i }));
    return t => {
      lines.forEach((ln, i) => ln(t, i * 1.0, 3.98));
      vg.forEach((g, i) => { const f = ramp(t, i * 1.0 + 0.05, i * 1.0 + 0.45); g.setAttribute('opacity', f * (1 - ramp(t, 3.7, 3.95, lin))); g.setAttribute('transform', `translate(${1120 + 60 * (1 - f)} ${Y[i] + 6}) scale(1.3)`); });
      dots.forEach((d, k) => d.setAttribute('opacity', ramp(t, 0.15 + k * 0.1, 0.3 + k * 0.1, lin)));
      log.setAttribute('stroke-dasharray', `${ramp(t, 0.2, 1.8, lin)} 1`);
      hl.forEach((l, k) => l.m.setAttribute('width', (l.w + 12) * ramp(t, 1.15 + k * 0.12, 1.35 + k * 0.12, inOut)));
      toks.forEach(tk => tk.el.setAttribute('opacity', ramp(t, 2.05 + tk.k * 0.14 + tk.j * 0.04, 2.12 + tk.k * 0.14 + tk.j * 0.04, lin)));
      run.setAttribute('width', 520 * ramp(t, 2.8, 3.5, lin));
      // the researcher's attention hops between the three kinds of work on eighth notes
      const seq = [0, 1, 2, 1, 0, 2];
      let k = HOPS.findIndex((h0, i) => t >= h0 && (i === HOPS.length - 1 || t < HOPS[i + 1]));
      const row = t < 2.5 ? Math.min(2, Math.floor(t)) : seq[k + 1];
      const prevRow = t < 2.5 ? row : seq[k];
      const f = t < 2.5 ? 1 : inOut((t - HOPS[k]) / 0.18);
      place(hop, 96, lerp(Y[prevRow], Y[row], f) + 72);
      put(hop, { o: ramp(t, 0.1, 0.3, lin) * (1 - ramp(t, 3.75, 3.95, lin)), r: 45 });
    };
  });

  // ============ S2 scattered 4–8 s: real skill and tool names burst out of reach ============
  const TOOLS = [
    ['code-xml', 'K-Dense AI 과학 스킬', 'geopandas', 150, 120, -4],
    ['map-gis', 'KIGAM 지구과학 스킬', 'geo-map-and-crs', 1380, 110, 3],
    ['git-branch', 'GitHub 저장소', '저장소마다 따로 설치', 70, 800, 3],
    ['file-code', '논문 부록 코드', 'MOESM1_ESM.py', 1440, 830, -3],
    ['database', '기관 자료', '지질도 · 시추 자료', 640, 70, 2],
    ['folder-open', '개인 폴더', '분석 노트', 1560, 470, -5],
    ['plug', 'agent 도구', 'MCP 서버', 60, 470, 4],
    ['well-log', 'KIGAM 지구과학 스킬', 'well-log-qc-quicklook', 760, 880, -2],
    ['book-open', '문헌 관리', 'Zotero', 1060, 60, -3],
    ['map', '지도 자료', 'GeoTIFF · Shapefile', 1080, 900, 4],
  ];
  function toolChip(parent, [ic, src, name]) {
    const el = h('div', 'chip', parent);
    el.innerHTML = `<div class="src">${icon(ic, 28, C.ink2)}<span>${src}</span></div><div class="name">${name}</div>`;
    return el;
  }
  scene(4, 8, C.ink, layer => {
    const l1 = kline(layer, '쓸 만한 스킬과 도구는', { x: 0, y: 400, size: 104, color: '#ffffff', align: 'center', width: 1920 });
    const l2 = kline(layer, '곳곳에 흩어져 있습니다', { x: 0, y: 530, size: 104, color: '#ffffff', align: 'center', width: 1920, em: '흩어져', emColor: C.onDark });
    const chips = TOOLS.map((tl, i) => ({ el: toolChip(layer, tl), tl, i, at: 4.0 + i * 0.25 }));
    chips.forEach(c => cue(c.at, 'pop', { step: c.i }));
    return t => {
      l1(t, 4.05, 7.5);
      l2(t, 4.5, 7.5);
      for (const c of chips) {
        const [, , , x, y, rot] = c.tl;
        const w = c.el.offsetWidth, hh = c.el.offsetHeight;
        const f = ramp(t, c.at, c.at + 0.5, back);
        const pull = ramp(t, 7.45 + c.i * 0.02, 7.98, easeIn);
        const bob = 8 * Math.sin(t * 2.2 + c.i * 1.3);
        const sx = 960 - w / 2, sy = 540 - hh / 2;
        const px = lerp(lerp(sx, x, f), sx, pull), py = lerp(lerp(sy, y, f), sy, pull) + bob * (1 - pull);
        put(c.el, { o: ramp(t, c.at, c.at + 0.12, lin) * (1 - ramp(pull, 0.85, 1, lin)), x: px, y: py, s: lerp(lerp(0.3, 1, f), 0.25, pull), r: rot * f * (1 - pull) + 40 * pull * (c.i % 2 ? 1 : -1) });
      }
    };
  });

  // ============ S3 reveal 8–12 s: GAID gathers them ============
  scene(8, 12, C.ink, layer => {
    const svg = sv('svg', { width: 1920, height: 1080 }, layer);
    svg.style.position = 'absolute';
    const burst = sv('circle', { cx: 960, cy: 430, r: 10, fill: 'none', stroke: C.onDark, 'stroke-width': 6 }, svg);
    const orbit = sv('ellipse', { cx: 960, cy: 430, rx: 780, ry: 262, fill: 'none', stroke: '#2c3341', 'stroke-width': 2 }, svg);
    const chips = TOOLS.map((tl, i) => ({ el: toolChip(layer, tl), i }));
    const L = lockup(layer, 230, true);
    const l1 = kline(layer, '흩어진 스킬과 도구를 한곳에', { x: 0, y: 760, size: 66, color: '#ffffff', align: 'center', width: 1920, weight: 700 });
    const l2 = kline(layer, '지구과학 연구자를 위한 AI agent 연구 지원 플랫폼', { x: 0, y: 760, size: 62, color: C.onDarkInk, align: 'center', width: 1920, weight: 700, em: 'AI agent', emColor: C.onDark });
    cue(8.0, 'hit');
    cue(8.0, 'logo');
    cue(10.0, 'soft');
    return t => {
      const b = ramp(t, 8.0, 8.7, out);
      burst.setAttribute('r', 20 + 1000 * b);
      burst.setAttribute('opacity', 1 - b);
      orbit.setAttribute('opacity', ramp(t, 8.2, 8.7, lin));
      const gi = ramp(t, 8.08, 8.45, back);
      const move = ramp(t, 8.45, 8.95, inOut);
      L.set({ ringF: ramp(t, 8.0, 8.5, inOut), gO: ramp(t, 8.08, 8.3, lin), gS: lerp(0.6, 1, gi), lettersF: ramp(t, 8.5, 9.0, inOut) });
      const top = 430 - 32 * L.scale;
      place(L.svg, lerp(960 - 32 * L.scale, 960 - L.width / 2, move), top);
      for (const c of chips) {
        const w = c.el.offsetWidth, hh = c.el.offsetHeight;
        const a = (c.i / TOOLS.length) * Math.PI * 2 + (t - 8) * 0.22 - 0.4;
        const f = ramp(t, 8.0 + c.i * 0.03, 8.65 + c.i * 0.03, back);
        const x = 960 + 780 * Math.cos(a) * f, y = 430 + 262 * Math.sin(a) * f;
        put(c.el, { o: ramp(t, 8.0, 8.2, lin) * 0.92, x: x - w / 2, y: y - hh / 2, s: lerp(0.2, 0.62, f) });
      }
      l1(t, 8.75, 9.95);
      l2(t, 10.0, null);
    };
  });

  // ============ S4 the research cycle 12–16 s ============
  const STATIONS = [['library', '내 서재'], ['file-text', 'Workflow 만들기'], ['share-2', 'GAID 허브 공유'], ['workflow', '연구 분석'], ['notebook-pen', '연구노트']];
  scene(12, 16, C.chrome, layer => {
    const R = { cx: 960, cy: 660, rx: 600, ry: 250 };
    const head = kline(layer, '논문이 Workflow가 되고, 쓰일수록 나아집니다', { x: 120, y: 80, size: 74, color: C.ink, em: 'Workflow', emColor: C.signal });
    const svg = sv('svg', { width: 1920, height: 1080 }, layer);
    svg.style.position = 'absolute';
    const ell = sv('ellipse', { cx: R.cx, cy: R.cy, rx: R.rx, ry: R.ry, fill: 'none', stroke: C.grey, 'stroke-width': 3, pathLength: 1, 'stroke-dasharray': '0 1' }, svg);
    const at = deg => [R.cx + R.rx * Math.cos(deg * Math.PI / 180), R.cy + R.ry * Math.sin(deg * Math.PI / 180)];
    const START = -150;
    const arc = (from, to, color) => {
      const pts = [];
      for (let d = from; d <= to; d += 2) { const a = d * Math.PI / 180; pts.push(`${(R.cx + (R.rx - 38) * Math.cos(a)).toFixed(1)} ${(R.cy + (R.ry - 38) * Math.sin(a)).toFixed(1)}`); }
      return sv('path', { d: `M ${pts.join(' L ')}`, fill: 'none', stroke: color, 'stroke-width': 14, 'stroke-linecap': 'round', opacity: 0.3, pathLength: 1, 'stroke-dasharray': '0 1' }, svg);
    };
    const hubArc = arc(-104, 22, C.signal), sysArc = arc(38, 240, C.ink2);
    const zoneLab = (title, sub, color, x, y) => {
      const el = h('div', 'abs', layer, `<div style="font-size:38px;font-weight:800;color:${color};letter-spacing:-0.02em">${title}</div><div style="font-size:25px;font-weight:600;color:${C.ink3};margin-top:2px">${sub}</div>`);
      Object.assign(el.style, { textAlign: 'center', whiteSpace: 'nowrap' });
      return { el, x, y };
    };
    const zl = [zoneLab('GAID 허브', '함께 쓰고 고쳐 가는 Workflow', C.signalInk, 1290, 540), zoneLab('GAID 시스템', '내 서재에서 분석하고 기록하는 연구', C.ink, 590, 660)];
    const trail = sv('path', { d: '', fill: 'none', stroke: C.signal, 'stroke-width': 6, 'stroke-linecap': 'round' }, svg);
    const point = sv('circle', { r: 15, fill: C.signal }, svg);
    const L = lockup(layer, 104, false);
    place(L.svg, R.cx - 32 * L.scale, R.cy - 64 - 32 * L.scale);
    const who = h('div', 'abs', layer, '연구자 + AI agent');
    Object.assign(who.style, { fontSize: '34px', fontWeight: 700, width: '1920px', left: '0px', top: `${R.cy + 6}px`, textAlign: 'center' });
    const st = STATIONS.map(([ic, label], i) => {
      const el = h('div', 'station', layer, `${icon(ic, 38, C.ink2)}<span>${label}</span>`);
      const [px, py] = at(START + i * 72);
      const dot = sv('circle', { cx: px, cy: py, r: 11, fill: '#fff', stroke: C.ink2, 'stroke-width': 3 }, svg);
      return { el, px, py, i, dot, ico: el.querySelector('.icon') };
    });
    const ver = h('div', 'abs', layer);
    Object.assign(ver.style, { fontSize: '30px', fontWeight: 800, color: C.signalInk, background: C.tint, padding: '6px 16px', borderRadius: '8px', cornerShape: 'bevel', whiteSpace: 'nowrap', border: `2px solid ${C.signal}` });
    // the point reaches a station on every beat: lap 12.5 → 15.0, then on to Workflow (15.5) where the version steps up
    const pos = t => (t < 12.5 ? 0 : t < 15.5 ? (t - 12.5) / 2.5 : 1.2);
    for (let i = 0; i <= 5; i++) cue(12.5 + i * 0.5, 'station', { step: i });
    cue(15.5, 'bump');
    return t => {
      head(t, 12.15, 15.95);
      ell.setAttribute('stroke-dasharray', `${ramp(t, 12.0, 12.5, inOut)} 1`);
      hubArc.setAttribute('stroke-dasharray', `${ramp(t, 13.0, 13.6, inOut)} 1`);
      sysArc.setAttribute('stroke-dasharray', `${ramp(t, 13.5, 14.1, inOut)} 1`);
      zl.forEach((z, k) => { place(z.el, z.x - z.el.offsetWidth / 2, z.y - 40); put(z.el, { o: ramp(t, 13.2 + k * 0.5, 13.5 + k * 0.5, lin) }); });
      const gi = ramp(t, 12.1, 12.5, back);
      L.set({ ringF: ramp(t, 12.0, 12.5, inOut), gO: ramp(t, 12.1, 12.3, lin), gS: lerp(0.7, 1, gi), lettersF: 0 });
      put(who, { o: ramp(t, 12.4, 12.7, lin) });
      const p = Math.min(pos(t), 1.2);
      const deg = START + p * 360;
      const [qx, qy] = at(deg);
      point.setAttribute('cx', qx); point.setAttribute('cy', qy);
      point.setAttribute('opacity', ramp(t, 12.35, 12.5, lin));
      const pts = [];
      for (let k = 0; k <= 150 * Math.min(p, 1); k++) pts.push(at(START + (k / 150) * 360).map(v => v.toFixed(1)).join(' '));
      pts.push(`${qx.toFixed(1)} ${qy.toFixed(1)}`);
      trail.setAttribute('d', p > 0 ? `M ${pts.join(' L ')}` : '');
      for (const s of st) {
        const lit = t >= 12.5 + s.i * 0.5 - 0.01;
        const cw = s.el.offsetWidth, ch = 84;
        const ux = (s.px - R.cx) / R.rx, uy = (s.py - R.cy) / R.ry;
        const f = ramp(t, 12.1 + s.i * 0.1, 12.45 + s.i * 0.1, back);
        place(s.el, s.px + ux * (cw / 2 + 24) - cw / 2, s.py + uy * (ch / 2 + 28) - ch / 2);
        put(s.el, { o: ramp(t, 12.1 + s.i * 0.1, 12.25 + s.i * 0.1, lin), s: lerp(0.7, 1, f) * (lit && t < 12.5 + s.i * 0.5 + 0.25 ? 1.06 : 1) });
        s.el.style.borderColor = lit ? C.signal : C.edge;
        s.ico.style.color = lit ? C.signal : C.ink2;
        s.dot.setAttribute('fill', lit ? C.signal : '#fff');
        s.dot.setAttribute('stroke', lit ? C.signal : C.ink2);
      }
      ver.textContent = t >= 15.5 ? 'version 0.1.1' : 'version 0.1.0';
      const W = st[1];
      place(ver, W.px - ver.offsetWidth / 2, W.py - 150);
      put(ver, { o: ramp(t, 13.0, 13.2, lin), s: t >= 15.5 ? 1 + 0.18 * (1 - ramp(t, 15.5, 15.85)) : 1 });
    };
  });

  // ============ S5 highlights 16–32 s: GAID 허브 and GAID 시스템, real screens as windows ============
  const CAP3 = 'cap3', CAP2 = 'cap2';
  const ITEMS = [
    { a: 16.0, b: 18.0, part: 'sys', head: ['연구는 내 서재의', '논문에서'], tags: [[16.6, '논문을 곁에 두고 읽기']],
      wins: [
        { at: 16.05, x: 860, y: 170, w: 680, spec: { label: '서재 · 포천 자철석 PGI', cap: CAP3, shot: 'L1', frame: 140, crop: [180, 40, 480, 440] } },
        { at: 16.4, x: 1240, y: 300, w: 620, spec: { label: 'PDF 함께 보기', cap: CAP3, shot: 'L2', frame: 100, crop: [488, 85, 452, 440] } },
      ] },
    { a: 18.0, b: 21.0, part: 'hub', head: ['논문 속 방법을', 'AI agent가 따르는', 'Workflow로'], tags: [[18.6, '원문 근거를 바로 곁에'], [19.75, '단계로 정리된 분석 절차']],
      wins: [
        { at: 18.05, x: 840, y: 150, w: 990, spec: { label: 'Workflow 만들기 · 질문과 근거', cap: CAP3, shot: 'A2', frame: 120, crop: [190, 110, 760, 420], focus: [548, 160, 395, 300] } },
        { at: 19.5, x: 1320, y: 540, w: 530, spec: { label: '분석 단계', still: `${CAP3}/stills/workflow-stages.png`, natural: [612, 527], crop: [0, 0, 612, 527] } },
      ] },
    { a: 21.0, b: 24.0, part: 'hub', head: ['허브에서 함께 쓰고', '고쳐 갑니다'], tags: [[21.6, '다음 version으로 등록'], [22.75, '허브에서 가져다 쓰기']],
      wins: [
        { at: 21.05, x: 860, y: 230, w: 960, cap: '포천 자철석 PGI', spec: { label: 'GAID 허브 · Workflow', cap: CAP3, shot: 'H2', frame: 100, crop: [285, 145, 660, 110] } },
        { at: 21.5, x: 900, y: 590, w: 960, cap: 'Yilgarn 니켈 탐사', spec: { label: 'GAID 허브 · Workflow', cap: CAP2, shot: 'H2', frame: 110, crop: [285, 185, 660, 70] } },
      ] },
    { a: 24.0, b: 27.0, part: 'sys', head: ['공유된 Workflow로', '내 자료를 분석'], tags: [[24.6, 'AI agent가 Workflow대로'], [25.75, '원본 좌표 그대로 지도에']],
      wins: [
        { at: 24.05, x: 840, y: 110, w: 660, spec: { label: 'AI agent 작업', cap: CAP3, shot: 'R3', frame: 90, crop: [641, 92, 639, 440] } },
        { at: 24.5, x: 1150, y: 290, w: 720, cap: 'Yilgarn 니켈 탐사 우선순위', spec: { label: '지도', cap: CAP2, shot: 'M1', frame: 140, crop: [0, 115, 690, 300] } },
        { at: 25.0, x: 880, y: 610, w: 640, cap: '포천 자력 이상', spec: { label: '지도', cap: CAP3, shot: 'M1', frame: 90, crop: [0, 190, 700, 345] } },
      ] },
    { a: 27.0, b: 29.5, part: 'sys', head: ['결과와 판단은', '연구노트에'], tags: [[27.6, '두 논문의 쪽수까지 인용']],
      wins: [
        { at: 27.05, x: 840, y: 150, w: 760, spec: { label: '연구노트', cap: CAP3, shot: 'N1', frame: 120, crop: [0, 120, 480, 340] } },
        { at: 27.5, x: 1460, y: 380, w: 400, cap: 'Yilgarn 노트의 그림', spec: { label: '결과 그림', still: `${CAP2}/stills/result-priority-zones.png`, natural: [2244, 2338], crop: [0, 0, 2244, 2338] } },
      ] },
    { a: 29.5, b: 32.0, part: 'sys', head: ['서재로 돌아와', '다음 연구로'], tags: [[30.1, '논문·Workflow·노트의 연결']],
      wins: [
        { at: 29.55, x: 840, y: 260, w: 1000, cap: '포천 자철석 PGI', spec: { label: '서재 · 연결 지도', cap: CAP3, shot: 'L5', frame: 100, crop: [140, 300, 820, 300] } },
        { at: 30.0, x: 1160, y: 690, w: 680, cap: 'Yilgarn 니켈 탐사', spec: { label: '서재 · 연결 지도', still: `${CAP2}/stills/connection-map.png`, natural: [2880, 1620], crop: [380, 700, 2000, 700] } },
      ] },
  ];
  scene(16, 32, C.chrome, layer => {
    const ground = h('div', 'abs', layer);
    Object.assign(ground.style, { left: '0px', top: '0px', width: '1920px', height: '1080px' });
    // a large orbit ring behind the windows, the logo's motif
    const deco = sv('svg', { width: 1920, height: 1080 }, layer);
    deco.style.position = 'absolute';
    const ringE = sv('ellipse', { cx: 1340, cy: 560, rx: 640, ry: 330, fill: 'none', stroke: C.signal, 'stroke-width': 2, opacity: 0.18 }, deco);
    const sat = sv('circle', { r: 10, fill: C.signal, opacity: 0.6 }, deco);
    const items = ITEMS.map((it, n) => {
      const g = h('div', 'abs', layer);
      Object.assign(g.style, { left: '0px', top: '0px', width: '1920px', height: '1080px' });
      const hub = it.part === 'hub';
      const plate = h('div', 'abs', g, `<span class="plate" style="background:${hub ? C.signal : C.ink};color:#fff">${hub ? 'GAID 허브' : 'GAID 시스템'}</span><span style="margin-left:18px;font-size:28px;font-weight:700;color:${C.ink3}">0${n + 1} / 06</span>`);
      place(plate, 120, 250);
      const heads = it.head.map((s, i) => kline(g, s, { x: 112, y: 320 + i * 96, size: 84, color: C.ink, em: s.includes('Workflow') ? 'Workflow' : (s.includes('AI agent') ? 'AI agent' : null), emColor: C.signal }));
      const tags = it.tags.map(([t0, label]) => ({ t0, el: h('div', 'tag', g, label) }));
      tags.forEach(tg => place(tg.el, 120, 340 + it.head.length * 96 + 30));
      const wins = it.wins.map(w => {
        const W = windowEl(g, w.spec, w.w);
        let capEl = null;
        if (w.cap) {
          capEl = h('div', 'abs', g, `<span style="display:inline-block;width:12px;height:12px;background:${C.signal};transform:rotate(45deg);margin-right:12px"></span>${w.cap}`);
          Object.assign(capEl.style, { fontSize: '26px', fontWeight: 700, color: C.ink, whiteSpace: 'nowrap' });
        }
        return { ...w, W, capEl };
      });
      cue(it.a, 'item', { hub, index: n });
      wins.forEach((w, i) => { if (i) cue(w.at, 'window'); });
      tags.forEach(tg => cue(tg.t0, 'tag'));
      return { it, g, plate, heads, tags, wins, hub };
    });
    return t => {
      const cur = items.find(x => t >= x.it.a && t < x.it.b) || items[items.length - 1];
      ground.style.background = cur.hub ? C.tint : C.chrome;
      const sa = (t - 16) * 0.5;
      sat.setAttribute('cx', 1340 + 640 * Math.cos(sa)); sat.setAttribute('cy', 560 + 330 * Math.sin(sa));
      ringE.setAttribute('stroke', cur.hub ? C.signal : C.ink2);
      for (const x of items) {
        const on = x === cur;
        x.g.style.display = on ? '' : 'none';
        if (!on) continue;
        const { a, b } = x.it;
        const exit = ramp(t, b - 0.2, b, easeIn);
        put(x.plate, { o: ramp(t, a, a + 0.2, lin) * (1 - exit), x: -30 * (1 - ramp(t, a, a + 0.35)) });
        x.heads.forEach((hd, i) => hd(t, a + 0.06 + i * 0.12, b - 0.02, { rise: 0.32, fall: 0.18 }));
        x.tags.forEach((tg, i) => {
          const next = x.tags[i + 1];
          const end = next ? next.t0 : b;
          const f = ramp(t, tg.t0, tg.t0 + 0.3, back);
          put(tg.el, { o: (t >= tg.t0 && t < end ? 1 : 0) * ramp(t, tg.t0, tg.t0 + 0.12, lin) * (1 - exit), s: lerp(0.7, 1, f), x: -20 * (1 - f) });
        });
        x.wins.forEach((w, i) => {
          const f = ramp(t, w.at, w.at + 0.45, out);
          const drift = (t - w.at) * (i % 2 ? -6 : 6);
          put(w.W.el, { o: ramp(t, w.at, w.at + 0.15, lin) * (1 - exit), x: w.x + 160 * (1 - f) + drift + 80 * exit, y: w.y + 40 * (1 - f), s: lerp(0.94, 1, f) });
          if (w.W.ring) w.W.ring.style.opacity = ramp(t, w.at + 0.5, w.at + 0.8, lin) * (0.6 + 0.4 * Math.sin((t - w.at) * Math.PI * 4) ** 2);
          if (w.capEl) { place(w.capEl, 0, 0); put(w.capEl, { o: ramp(t, w.at + 0.2, w.at + 0.4, lin) * (1 - exit), x: w.x + 4 + 160 * (1 - f) + drift, y: w.y - 44 + 40 * (1 - f) }); }
        });
      }
    };
  });

  // ============ S6 KIGAM Second brain 32–36 s ============
  scene(32, 36, C.ink, layer => {
    const l1 = kline(layer, '연구자마다 고리가 돌면 생태계가 자랍니다', { x: 120, y: 70, size: 70, color: '#ffffff', em: '생태계', emColor: C.onDark });
    const l2 = kline(layer, '논문·Workflow·연구노트가 이어져 KIGAM의 Second brain이 됩니다', { x: 120, y: 70, size: 62, color: '#ffffff', em: 'Second brain', emColor: C.onDark });
    const svg = sv('svg', { width: 1920, height: 1080 }, layer);
    svg.style.position = 'absolute';
    const CC = { x: 960, y: 640 };
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const nodes = [];
    for (let i = 0; i < 70; i++) { const r = 70 + Math.sqrt(rnd()) * 250, a = rnd() * Math.PI * 2; nodes.push({ x: CC.x + r * Math.cos(a) * 1.55, y: CC.y + r * Math.sin(a) * 0.72, k: i % 3, d: i / 70 }); }
    const edges = [];
    nodes.forEach((n, i) => nodes.map((m, j) => ({ j, dd: (m.x - n.x) ** 2 + (m.y - n.y) ** 2 })).filter(o => o.j !== i).sort((p, q) => p.dd - q.dd).slice(0, 2).forEach(o => { if (o.j > i) edges.push({ a: n, b: nodes[o.j], d: Math.max(n.d, nodes[o.j].d) }); }));
    const links = [], rings = [];
    const N = 9;
    for (let i = 0; i < N; i++) {
      const a = (-90 + i * 360 / N) * Math.PI / 180 + 0.17;
      const x = CC.x + 800 * Math.cos(a), y = CC.y + 300 * Math.sin(a);
      links.push(sv('line', { x1: x, y1: y, x2: x, y2: y, stroke: C.onDark, 'stroke-width': 2.5, opacity: 0.6 }, svg));
      const g = sv('g', {}, svg);
      sv('ellipse', { cx: x, cy: y, rx: 84, ry: 46, fill: C.ink, stroke: '#3a4352', 'stroke-width': 3 }, g);
      const p = sv('circle', { r: 8, fill: C.onDark }, g);
      const u = h('div', 'abs', layer, icon('user', 34, C.onDarkInk));
      place(u, x - 17, y - 17);
      rings.push({ g, p, u, x, y, i });
    }
    const eEls = edges.map(e => sv('line', { x1: e.a.x, y1: e.a.y, x2: e.b.x, y2: e.b.y, stroke: '#4a5568', 'stroke-width': 2 }, svg));
    const nEls = nodes.map(n => (n.k === 0 ? sv('circle', { cx: n.x, cy: n.y, r: 9, fill: C.ink, stroke: C.onDarkInk, 'stroke-width': 3 }, svg)
      : n.k === 1 ? sv('rect', { x: n.x - 9, y: n.y - 9, width: 18, height: 18, fill: C.onDark, transform: `rotate(45 ${n.x} ${n.y})` }, svg)
        : sv('rect', { x: n.x - 7, y: n.y - 7, width: 14, height: 14, fill: '#8f98a8' }, svg)));
    const L = lockup(layer, 120, true);
    place(L.svg, CC.x - 32 * L.scale, CC.y - 32 * L.scale);
    rings.forEach(r => cue(32.0 + r.i * 0.25, 'tick', { step: r.i }));
    cue(34.0, 'join');
    return t => {
      l1(t, 32.15, 33.95);
      l2(t, 34.0, null);
      for (const r of rings) {
        const f = ramp(t, 32.0 + r.i * 0.25, 32.3 + r.i * 0.25, back);
        r.g.setAttribute('opacity', clamp(f));
        r.g.setAttribute('transform', `translate(${r.x * (1 - f)} ${r.y * (1 - f)}) scale(${f})`);
        put(r.u, { o: clamp(f) });
        const a = (t - 32) * 3 + r.i;
        r.p.setAttribute('cx', r.x + 84 * Math.cos(a)); r.p.setAttribute('cy', r.y + 46 * Math.sin(a));
        const lf = ramp(t, 33.0 + r.i * 0.08, 33.6 + r.i * 0.08, inOut);
        links[r.i].setAttribute('x2', lerp(r.x, CC.x, lf)); links[r.i].setAttribute('y2', lerp(r.y, CC.y, lf));
      }
      const gi = ramp(t, 33.0, 33.4, back);
      L.set({ ringF: ramp(t, 32.9, 33.5, inOut), gO: ramp(t, 33.0, 33.2, lin), gS: lerp(0.6, 1, gi), lettersF: 0 });
      const grow = ramp(t, 33.4, 35.6, lin);
      nEls.forEach((el, i) => el.setAttribute('opacity', clamp((grow - nodes[i].d) * 8)));
      eEls.forEach((el, i) => el.setAttribute('opacity', clamp((grow - edges[i].d) * 8 - 0.4)));
    };
  });

  // ============ S7 outro 36–40 s ============
  scene(36, 40, C.face, layer => {
    const L = lockup(layer, 250, false);
    place(L.svg, 960 - L.width / 2, 300);
    const sub = kline(layer, '지구과학 연구자를 위한 AI agent 연구 지원 플랫폼', { x: 0, y: 650, size: 54, color: C.ink2, align: 'center', width: 1920, weight: 700 });
    const tag = h('div', 'abs', layer, '내부 검토용 영상');
    Object.assign(tag.style, { left: '0px', top: '1000px', width: '1840px', textAlign: 'right', fontSize: '24px', fontWeight: 600, color: C.ink3 });
    cue(36.0, 'logo');
    cue(37.0, 'soft');
    return t => {
      const gi = ramp(t, 36.1, 36.5, back);
      L.set({ ringF: ramp(t, 36.0, 36.6, inOut), gO: ramp(t, 36.1, 36.3, lin), gS: lerp(0.7, 1, gi), lettersF: ramp(t, 36.45, 37.0, inOut) });
      sub(t, 37.0, null);
      put(tag, { o: ramp(t, 37.5, 37.9, lin) });
    };
  });

  // ---------- init ----------
  async function loadLogo(path) {
    const doc = new DOMParser().parseFromString(await (await fetch(path)).text(), 'image/svg+xml');
    const paths = [...doc.querySelectorAll('path')];
    const g = doc.querySelector('g[fill]');
    return {
      fill: (g && g.getAttribute('fill')) || paths[0].getAttribute('fill'),
      ring: paths[0].getAttribute('d'), g: paths[1].getAttribute('d'),
      letters: paths.slice(2).map(p => ({ d: p.getAttribute('d'), transform: p.getAttribute('transform') })),
    };
  }
  async function init() {
    const names = ['code-xml', 'map-gis', 'git-branch', 'file-code', 'database', 'folder-open', 'plug', 'well-log', 'book-open', 'map',
      'library', 'file-text', 'share-2', 'workflow', 'notebook-pen', 'user'];
    await Promise.all(names.map(async n => {
      const txt = await (await fetch(`icons/${n}.svg`)).text();
      ICON[n] = txt.replace(/width="24"/, 'width="100%"').replace(/height="24"/, 'height="100%"');
    }));
    LOGO = await loadLogo('brand/horizontal-color.svg');
    LOGO_DARK = await loadLogo('brand/horizontal-on-dark.svg');
    await document.fonts.load('800 80px Pretendard');
    await document.fonts.load('600 24px Pretendard');
    const layers = scenes.map(sc => {
      const layer = h('div', 'layer');
      return { ...sc, layer, draw: sc.build(layer) };
    });
    const wl = h('div', 'layer');
    const wipes = [12, 16, 32, 36].map(at => wipe(wl, at));
    [12, 16, 32, 36].forEach(at => cue(at - 0.26, 'swoosh', { end: at + 0.22 }));
    await Promise.all(pending);
    CUES.sort((p, q) => p.t - q.t);
    window.motion = {
      ready: true,
      duration: DURATION,
      cues: CUES,
      grid: { bpm: 120, beat: BEAT, bar: BAR, bars: DURATION / BAR },
      poster: 11.0,
      stills: {
        '01-hook': 1.6, '02-hook-full': 3.2, '03-scattered': 6.6, '04-reveal': 9.4, '05-reveal-sub': 11.0, '06-cycle': 15.7,
        '07-library': 17.6, '08-workflow': 20.6, '09-hub': 23.5, '10-analysis': 26.6, '11-note': 29.2, '12-return': 31.6,
        '13-brain': 33.6, '14-brain-2': 35.6, '15-outro': 39.5,
      },
      transitions: Object.fromEntries([4, 8, 12, 16, 18, 21, 24, 27, 29.5, 32, 36]
        .flatMap(b => [[`x${b.toFixed(1)}-a`, +(b - 0.12).toFixed(2)], [`x${b.toFixed(1)}-b`, +(b + 0.12).toFixed(2)]])),
      async frame(t) {
        pending.length = 0;
        const cur = layers.find(l => t >= l.a && t < l.b) || layers[layers.length - 1];
        stage.style.background = cur.ground;
        for (const l of layers) {
          const on = l === cur;
          l.layer.style.display = on ? '' : 'none'; // a hidden parent does not hide children set visible
          if (on) l.draw(t);
        }
        wipes.forEach(w => w(t));
        await Promise.all(pending);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      },
    };
  }
  init().catch(e => { window.motionError = String((e && e.stack) || e); });
})();
