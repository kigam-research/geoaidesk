/* GAID 90-second promo film (storyboard v2). Deterministic: window.motion.frame(t) draws film second t.
 * Numbers come from PROMO_DATA (geo/promo/prepare_data.py); footage from PROMO_CAPTURE (capture-v1).
 * The only illustrative scene (researchers' scattered files) carries an on-screen "개념도" tag.
 * Legibility rule (user, 2026-10-23): film text >= 22 px, primary labels >= 30 px, no large empty areas.
 */
(() => {
  'use strict';
  const D = window.PROMO_DATA;
  const CAP = window.PROMO_CAPTURE;
  const FPS = 30;
  const VW = (CAP && CAP.css && CAP.css.width) || 1280;
  const VH = (CAP && CAP.css && CAP.css.height) || 720;
  const stage = document.getElementById('stage');
  const NS = 'http://www.w3.org/2000/svg';
  const BLUE = '#1f5eff';

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lin = x => clamp(x);
  const out = x => 1 - Math.pow(1 - clamp(x), 4); // ≈ cubic-bezier(0.22,0.25,0,1)
  const inOut = x => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const ramp = (t, a, b, e = out) => e((t - a) / (b - a));
  const lerp = (a, b, v) => a + (b - a) * v;
  const win = (t, a, b, fi = 0.45, fo = 0.4) => Math.min(ramp(t, a, a + fi, lin), 1 - ramp(t, b - fo, b, lin));
  const fmt = (n, d = 0) => Number(n).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });

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
  function box(el, x, y, w, hgt) {
    Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: w == null ? '' : `${w}px`, height: hgt == null ? '' : `${hgt}px` });
    return el;
  }
  function text(parent, cls, x, y, str, extra = {}) {
    const el = h('div', `abs ${cls}`, parent, str);
    Object.assign(el.style, { left: `${x}px`, top: `${y}px`, whiteSpace: 'nowrap', ...extra });
    return el;
  }
  const ICON = {};
  const icon = (name, size = 28, color = 'var(--ink-2)') =>
    `<span class="icon" style="width:${size}px;height:${size}px;color:${color}">${ICON[name] || ''}</span>`;
  const ORBIT_ICON = size => `<svg width="${size * 1.5}" height="${size}" viewBox="0 0 30 20"><ellipse cx="15" cy="10" rx="13" ry="7" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="26" cy="12" r="3" fill="${BLUE}"/></svg>`;
  let LOGO = null;

  function lockup(parent, height) {
    // Horizontal lockup (175×64): ring, G and lettering enter in turn; the end state is the unchanged logo.
    const scale = height / 64;
    const svg = sv('svg', { width: 175 * scale, height, viewBox: '0 0 175 64' });
    svg.style.position = 'absolute';
    svg.style.overflow = 'visible';
    parent.appendChild(svg);
    const defs = sv('defs', {}, svg);
    const id = `m${Math.random().toString(36).slice(2)}`;
    const mask = sv('mask', { id, maskUnits: 'userSpaceOnUse', x: -20, y: -20, width: 120, height: 104 }, defs);
    const sweep = sv('circle', {
      cx: 32, cy: 32, r: 22, fill: 'none', stroke: '#fff', 'stroke-width': 44,
      transform: 'rotate(-150 32 32)', pathLength: 1, 'stroke-dasharray': '0 1',
    }, mask);
    const ring = sv('g', { fill: BLUE, mask: `url(#${id})` }, svg);
    sv('path', { d: LOGO.ring, 'fill-rule': 'evenodd' }, ring);
    const g = sv('g', { fill: BLUE }, svg);
    sv('path', { d: LOGO.g, 'fill-rule': 'evenodd' }, g);
    const clipId = `c${Math.random().toString(36).slice(2)}`;
    const clip = sv('clipPath', { id: clipId }, defs);
    const clipRect = sv('rect', { x: 70, y: -10, width: 0, height: 84 }, clip);
    const letters = sv('g', { fill: BLUE, 'clip-path': `url(#${clipId})` }, svg);
    for (const l of LOGO.letters) sv('path', { d: l.d, transform: l.transform }, letters);
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
  function markAt(layer, cx, cy, height) {
    const L = lockup(layer, height);
    L.svg.style.left = `${cx - 32 * L.scale}px`;
    L.svg.style.top = `${cy - 32 * L.scale}px`;
    L.set({ lettersF: 0 });
    return L;
  }

  // ---------- film position bar (no text; chapter ticks only) ----------
  const CHAPTERS = [5, 14, 24, 41, 55, 64, 78, 85];
  function buildScale() {
    const layer = h('div', 'layer');
    const svg = sv('svg', { width: 1920, height: 1080 }, layer);
    const x0 = 0, x1 = 1920, y = 1077, a = 5, b = 85;
    const sx = t => lerp(x0, x1, (t - a) / (b - a));
    sv('line', { x1: x0, x2: x1, y1: y, y2: y, stroke: '#d5dae1', 'stroke-width': 6 }, svg);
    for (const t of CHAPTERS) sv('line', { x1: sx(t), x2: sx(t), y1: y - 12, y2: y + 3, stroke: '#878f9d', 'stroke-width': 2 }, svg);
    const fill = sv('line', { x1: x0, x2: x0, y1: y, y2: y, stroke: BLUE, 'stroke-width': 6 }, svg);
    return t => {
      put(layer, { o: win(t, 5.0, 85.2, 0.6, 0.6) });
      fill.setAttribute('x2', sx(clamp(t, a, b)));
    };
  }

  // ---------- headline helper (M4: old text fades out before new text fades in) ----------
  function headline(layer, x, y, lines, cls = 'h2') {
    const els = lines.map(([a, b, str]) => {
      const el = h('div', `abs ${cls}`, layer, str);
      Object.assign(el.style, { left: `${x}px`, top: `${y}px`, whiteSpace: 'nowrap' });
      return { el, a, b };
    });
    return t => {
      for (const { el, a, b } of els) put(el, { o: win(t, a, b, 0.5, 0.35), y: 18 * (1 - ramp(t, a, a + 0.7)) });
    };
  }

  // ---------- footage ----------
  const shotInfo = id => (CAP && CAP.shots ? CAP.shots.find(s => s.id === id) : null);
  const pending = [];
  function footageWindow(layer) {
    const el = h('div', 'window', layer);
    const img = h('img', '', el);
    const ph = h('div', 'ph', el);
    let current = '';
    return {
      draw({ x = 0, y = 0, w = 10, o = 0, shot, local = 0, view }) {
        const hgt = (w * 9) / 16;
        box(el, x, y, w, hgt);
        put(el, { o });
        if (o <= 0.002) return;
        const info = shotInfo(shot);
        const v = view || [0, 0, VW, VH];
        const k = w / v[2];
        if (!info) {
          img.style.display = 'none';
          ph.style.display = 'flex';
          box(ph, 0, 0, w, hgt);
          ph.innerHTML = `<div>실제 화면 ${shot}</div><div style="font-size:26px;font-weight:500">촬영본 연결 전 자리</div>`;
          return;
        }
        ph.style.display = 'none';
        img.style.display = 'block';
        const idx = clamp(Math.floor(local * FPS) + (info.offset || 0), 0, info.frames - 1);
        const src = `capture/${info.pattern.replace('%05d', String(idx).padStart(5, '0'))}`;
        if (src !== current) {
          current = src;
          img.src = src;
          pending.push(img.decode().catch(() => {}));
        }
        Object.assign(img.style, { width: `${VW * k}px`, height: `${VH * k}px`, left: `${-v[0] * k}px`, top: `${-v[1] * k}px` });
      },
    };
  }
  // Zoom path: keys [{t, rect}] in shot-local seconds; each move eases over up to 0.9 s ending at k.t.
  function viewAt(keys, local, dur) {
    const full = [0, 0, VW, VH];
    if (!keys || !keys.length) {
      const z = lerp(1.0, 1.06, clamp(local / dur));
      const w = VW / z, hh = VH / z;
      return [(VW - w) / 2, (VH - hh) / 2, w, hh];
    }
    let prev = { t: 0, rect: full };
    for (const k of keys) {
      if (local < k.t) {
        const span = Math.min(0.9, k.t - prev.t);
        const f = local < k.t - span ? 0 : inOut((local - (k.t - span)) / span);
        return prev.rect.map((p, i) => lerp(p, k.rect[i], f));
      }
      prev = k;
    }
    return prev.rect;
  }
  const fit169 = (r, pad = 24) => {
    if (!r) return null;
    let [x, y, w, hh] = [r[0] - pad, r[1] - pad, r[2] + 2 * pad, r[3] + 2 * pad];
    if (w / hh > 16 / 9) { const nh = (w * 9) / 16; y -= (nh - hh) / 2; hh = nh; } else { const nw = (hh * 16) / 9; x -= (nw - w) / 2; w = nw; }
    // never zoom beyond 1.8× (frames are 2.25× the CSS size) and never show outside the frame
    w = clamp(w, VW / 1.8, VW); hh = (w * 9) / 16;
    x = clamp(x, 0, VW - w); y = clamp(y, 0, VH - hh);
    return [x, y, w, hh];
  };
  // Default zoom for a shot: its focus rects from capture.json, in order, held until the next one.
  function shotKeys(id) {
    const info = shotInfo(id);
    if (!info || !info.focus || !info.focus.length) return null;
    return info.focus.map(f => ({ t: Math.max(0.6, f.t), rect: fit169([f.rect.x, f.rect.y, f.rect.width, f.rect.height]) }));
  }

  // ================= scenes =================
  const scenes = [];

  // S1 opening 0–5.2
  scenes.push(() => {
    const layer = h('div', 'layer');
    const dial = sv('svg', { width: 1920, height: 1080 }, layer);
    dial.style.position = 'absolute';
    const ticks = [];
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2 - Math.PI / 2;
      const major = i % 10 === 0;
      const r0 = 250, r1 = major ? 224 : 238;
      ticks.push(sv('line', {
        x1: 960 + r0 * Math.cos(a), y1: 480 + r0 * Math.sin(a), x2: 960 + r1 * Math.cos(a), y2: 480 + r1 * Math.sin(a),
        stroke: major ? '#525a68' : '#b9c0ca', 'stroke-width': major ? 3 : 1.5,
      }, dial));
    }
    const L = lockup(layer, 300);
    const sub = text(layer, 'h2', 0, 700, '지구과학 연구자를 위한 AI agent 작업 공간', { width: '1920px', textAlign: 'center', fontSize: '50px', fontWeight: 600, color: 'var(--ink-2)' });
    return t => {
      const o = 1 - ramp(t, 4.6, 5.2, lin);
      put(layer, { o });
      if (o <= 0) return;
      ticks.forEach((tk, i) => tk.setAttribute('opacity', clamp((t - 0.1 - i * 0.007) / 0.25) * (1 - ramp(t, 2.0, 2.6, lin))));
      const gIn = ramp(t, 0.8, 1.6);
      const move = ramp(t, 2.0, 2.9, inOut);
      L.set({ ringF: ramp(t, 0.35, 1.6, inOut), gO: gIn, gS: lerp(0.82, 1, gIn), lettersF: ramp(t, 2.4, 3.2, inOut) });
      const top = 480 - 32 * L.scale;
      L.svg.style.left = `${lerp(960 - 32 * L.scale, 960 - L.width / 2, move)}px`;
      L.svg.style.top = `${lerp(top, top - 50, move)}px`;
      put(sub, { o: ramp(t, 3.1, 3.7, lin), y: 16 * (1 - ramp(t, 3.1, 3.9)) });
    };
  });

  // S2 background 4.9–14.2 (illustrative files per researcher + one real count)
  const ORBIT = { cx: 605, cy: 610, rx: 295, ry: 225 };
  scenes.push(() => {
    const layer = h('div', 'layer');
    const head = headline(layer, 110, 96, [
      [5.2, 8.7, '연구 방법은 논문과 개인 폴더에 흩어져 있습니다'],
      [8.9, 11.7, '다시 쓰려면 남의 코드부터 읽어야 합니다'],
      [11.9, 14.2, 'GAID는 그 방법을 Workflow로 만들어 함께 씁니다'],
    ]);
    const kinds = [['file-text', '논문'], ['code-xml', '코드'], ['map-gis', '자료'], ['notebook-pen', '노트']];
    const cols = 5, x0 = 130, y0 = 270, dx = 345, dy = 178;
    const tiles = [];
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < 4; r++) {
        const el = h('div', 'face small', layer);
        box(el, 0, 0, 290, 124);
        Object.assign(el.style, { display: 'flex', alignItems: 'center', gap: '18px', padding: '0 28px' });
        el.innerHTML = `${icon(kinds[r][0], 46)}<span class="h3" style="font-size:38px">${kinds[r][1]}</span>`;
        tiles.push({ el, c, r, hx: x0 + c * dx + (rnd() - 0.5) * 60, hy: y0 + r * dy + (rnd() - 0.5) * 40, rot: (rnd() - 0.5) * 6, d: rnd() * 0.8 });
      }
    }
    const tag = h('div', 'note-tag', layer, '개념도');
    box(tag, 1700, 104);
    // real count: original code files behind one registered hub Workflow
    const codeN = D.hubEntry.codeFiles;
    const waffle = h('div', 'face', layer);
    box(waffle, 820, 236, 1000, 760);
    const wsvg = sv('svg', { width: 1000, height: 760 }, waffle);
    const cells = [];
    for (let i = 0; i < codeN; i++) {
      const cx = 64 + (i % 11) * 80, cy = 258 + Math.floor(i / 11) * 92;
      const g = sv('g', { transform: `translate(${cx} ${cy})` }, wsvg);
      sv('path', { d: 'M0 0 H40 L54 14 V68 H0 Z', fill: '#e8eeff', stroke: BLUE, 'stroke-width': 2 }, g);
      cells.push(g);
    }
    const wt = sv('text', { x: 64, y: 150, 'font-size': 128, 'font-weight': 700, fill: '#171b23' }, wsvg);
    const unit = sv('text', { x: 0, y: 150, 'font-size': 48, 'font-weight': 650, fill: '#525a68' }, wsvg);
    unit.textContent = '개 파일';
    const wl = sv('text', { x: 64, y: 210, 'font-size': 32, 'font-weight': 600, fill: '#525a68' }, wsvg);
    wl.textContent = '허브 Workflow 1건이 담은 원본 코드';
    return t => {
      const o = win(t, 4.9, 14.3, 0.4, 0.4);
      put(layer, { o });
      if (o <= 0) return;
      head(t);
      const focus = ramp(t, 8.7, 9.6, inOut) * (1 - ramp(t, 11.6, 12.3, inOut));
      const gather = ramp(t, 11.9, 14.0, inOut);
      for (const tl of tiles) {
        const appear = ramp(t, 5.2 + tl.d, 5.9 + tl.d);
        // focus: the first two columns stay (the code row stays lit); gather: tiles fall onto the orbit of S3
        const ang = ((tl.c * 4 + tl.r) / 20) * Math.PI * 2;
        const tx = ORBIT.cx + ORBIT.rx * Math.cos(ang) - 145, ty = ORBIT.cy + ORBIT.ry * Math.sin(ang) - 62;
        const x = lerp(tl.hx - focus * 30, tx, gather), y = lerp(tl.hy, ty, gather);
        const dim = tl.r === 1 ? 1 : 1 - 0.6 * focus;
        const keep = tl.c < 2 ? 1 : 1 - focus;
        put(tl.el, { o: appear * dim * keep * (1 - ramp(t, 13.4, 14.1, lin)), x, y, s: lerp(1, 0.3, gather), r: tl.rot * (1 - gather) });
      }
      put(tag, { o: ramp(t, 5.6, 6.2, lin) * (1 - ramp(t, 11.7, 12.2, lin)) });
      put(waffle, { o: win(t, 9.0, 11.8, 0.5, 0.4), x: 40 * (1 - ramp(t, 9.0, 9.8)) });
      const shown = Math.round(codeN * ramp(t, 9.3, 10.8, lin));
      cells.forEach((c, i) => c.setAttribute('opacity', i < shown ? 1 : 0));
      wt.textContent = fmt(shown);
      unit.setAttribute('x', 64 + wt.getComputedTextLength() + 14);
    };
  });

  // S3 purpose loop 13.9–24.3
  scenes.push(() => {
    const layer = h('div', 'layer');
    const head = headline(layer, 110, 96, [[14.3, 24.2, '한 연구자가 만든 Workflow를 다음 연구자가 이어 씁니다']]);
    const svg = sv('svg', { width: 1920, height: 1080 }, layer);
    svg.style.position = 'absolute';
    const ell = sv('ellipse', { cx: ORBIT.cx, cy: ORBIT.cy, rx: ORBIT.rx, ry: ORBIT.ry, fill: 'none', stroke: '#9aa3b0', 'stroke-width': 2.5, pathLength: 1, 'stroke-dasharray': '0 1' }, svg);
    const ticks = [];
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const len = i % 6 === 0 ? 14 : 6;
      const nx = Math.cos(a) / ORBIT.rx, ny = Math.sin(a) / ORBIT.ry, nn = Math.hypot(nx, ny);
      const px = ORBIT.cx + ORBIT.rx * Math.cos(a), py = ORBIT.cy + ORBIT.ry * Math.sin(a);
      ticks.push(sv('line', { x1: px, y1: py, x2: px - (nx / nn) * len, y2: py - (ny / nn) * len, stroke: '#9aa3b0', 'stroke-width': 1.5 }, svg));
    }
    const point = sv('circle', { r: 13, fill: BLUE }, svg);
    const L = markAt(layer, ORBIT.cx, ORBIT.cy, 170);
    const stations = [
      ['book-open', '서재·자료', -150],
      ['git-branch', 'Workflow', -82],
      ['orbit', 'AI agent 실행', 32],
      ['notebook-pen', '연구노트', 100],
      ['users', 'GAID 허브', 150],
    ].map(([ic, label, deg], i) => {
      const a = (deg * Math.PI) / 180;
      const px = ORBIT.cx + ORBIT.rx * Math.cos(a), py = ORBIT.cy + ORBIT.ry * Math.sin(a);
      const el = h('div', 'face small', layer);
      Object.assign(el.style, { display: 'flex', alignItems: 'center', gap: '14px', padding: '0 24px', height: '80px', left: '0px', top: '0px' });
      el.innerHTML = `<span class="icon" style="width:${ic === 'orbit' ? 54 : 38}px;height:38px">${ic === 'orbit' ? ORBIT_ICON(36) : ICON[ic]}</span><span class="h3" style="font-size:34px">${label}</span>`;
      const nx = Math.cos(a) / ORBIT.rx, ny = Math.sin(a) / ORBIT.ry, nn = Math.hypot(nx, ny);
      const ux = nx / nn, uy = ny / nn;
      const lead = sv('line', { x1: px + ux * 10, y1: py + uy * 10, x2: px + ux * 44, y2: py + uy * 44, stroke: '#9aa3b0', 'stroke-width': 2 }, svg);
      const dot = sv('circle', { cx: px, cy: py, r: 9, fill: '#ffffff', stroke: '#525a68', 'stroke-width': 3 }, svg);
      return { el, px, py, a, ux, uy, lead, dot, i, ico: el.querySelector('.icon') };
    });
    const C = D.catalogue;
    const panel = h('div', 'face', layer);
    box(panel, 1220, 214, 640, 800);
    text(panel, 'h3', 44, 36, 'GAID에 기본으로 들어 있는 것');
    const reads = [[C.workflows.length, '기본 Workflow'], [C.skills, '스킬'], [C.dataSources, '공개 자료 출처']].map(([n, l], i) => {
      const el = h('div', 'abs', panel);
      Object.assign(el.style, { left: `${44 + i * 196}px`, top: '104px' });
      el.innerHTML = `<div class="num" style="font-size:88px;line-height:1"><span>0</span></div><div class="label" style="margin-top:10px">${l}</div>`;
      return { n, span: el.querySelector('span') };
    });
    text(panel, 'h3', 44, 290, '공개 자료 출처의 분야', { fontSize: '30px' });
    const groups = C.dataSourcesByGroup;
    const maxN = Math.max(...groups.map(g => g.count));
    const bars = groups.map((g, i) => {
      const y = 350 + i * 58;
      const lab = text(panel, 'label', 44, y, g.label, { color: 'var(--ink)' });
      const bar = h('div', 'abs', panel);
      Object.assign(bar.style, { left: '330px', top: `${y + 6}px`, height: '26px', background: BLUE, borderRadius: '3px' });
      const val = text(panel, 'label', 0, y, String(g.count), { color: 'var(--ink)', fontWeight: 700 });
      return { lab, bar, val, w: (250 * g.count) / maxN, i };
    });
    text(panel, 'small', 44, 758, `카탈로그 ${C.version} · KIGAM 스킬 ${C.skillsBySource.kigam} · K-Dense에서 가져온 스킬 ${C.skillsBySource['k-dense']}`);
    return t => {
      const o = win(t, 13.9, 24.3, 0.5, 0.5);
      put(layer, { o });
      if (o <= 0) return;
      head(t);
      ell.setAttribute('stroke-dasharray', `${ramp(t, 13.9, 15.3, inOut)} 1`);
      ticks.forEach((tk, i) => tk.setAttribute('opacity', ramp(t, 14.2 + i * 0.01, 14.6 + i * 0.01, lin)));
      const gi = ramp(t, 14.2, 15.0);
      L.set({ ringF: ramp(t, 14.0, 15.1, inOut), gO: gi, gS: lerp(0.8, 1, gi), lettersF: 0 });
      // the travelling point is the AI agent working; one loop starting at the first station
      const start = (-150 * Math.PI) / 180;
      const loop = ramp(t, 15.6, 23.0, lin);
      const a = start + loop * Math.PI * 2;
      point.setAttribute('cx', ORBIT.cx + ORBIT.rx * Math.cos(a));
      point.setAttribute('cy', ORBIT.cy + ORBIT.ry * Math.sin(a));
      point.setAttribute('opacity', ramp(t, 15.3, 15.7, lin));
      for (const st of stations) {
        const appear = ramp(t, 14.8 + st.i * 0.15, 15.5 + st.i * 0.15);
        const rel = ((st.a - start) / (Math.PI * 2) + 1) % 1;
        const lit = loop > 0 && loop >= rel - 0.004;
        const cw = st.el.offsetWidth, ch = 80;
        const ax = st.px + st.ux * 50, ay = st.py + st.uy * 50;
        put(st.el, { o: appear, x: ax - cw / 2 + st.ux * (cw / 2), y: ay - ch / 2 + st.uy * (ch / 2) });
        st.el.style.borderColor = lit ? BLUE : '#dce0e6';
        st.ico.style.color = lit ? BLUE : '#525a68';
        st.lead.setAttribute('opacity', appear);
        st.lead.setAttribute('stroke', lit ? BLUE : '#9aa3b0');
        st.dot.setAttribute('fill', lit ? BLUE : '#ffffff');
        st.dot.setAttribute('stroke', lit ? BLUE : '#525a68');
        st.dot.setAttribute('opacity', appear);
      }
      const po = ramp(t, 16.2, 16.9);
      put(panel, { o: po, x: 40 * (1 - po) });
      reads.forEach((r, i) => { r.span.textContent = fmt(r.n * ramp(t, 16.6 + i * 0.3, 18.0 + i * 0.3)); });
      bars.forEach(b => {
        const f = ramp(t, 18.2 + b.i * 0.16, 19.2 + b.i * 0.16);
        b.bar.style.width = `${b.w * f}px`;
        b.val.style.left = `${330 + b.w * f + 14}px`;
        put(b.val, { o: f });
        put(b.lab, { o: ramp(t, 18.0 + b.i * 0.16, 18.5 + b.i * 0.16, lin) });
      });
    };
  });

  // S4a authoring motion 24.0–30.3 (real hub entry: sources, start choices, steps)
  scenes.push(() => {
    const E = D.hubEntry;
    const layer = h('div', 'layer');
    const head = headline(layer, 110, 90, [[24.3, 30.2, '논문과 코드를 주면 AI agent가 묻고 Workflow 초안을 만듭니다']]);
    const srcs = [['file-text', '논문 PDF', ''], ['code-xml', '코드', `${E.codeFiles}개 파일`], ['book-open', '참고문헌', `${E.references}편`]].map(([ic, l, n], i) => {
      const el = h('div', 'face small', layer);
      box(el, 90, 222 + i * 140, 470, 116);
      Object.assign(el.style, { display: 'flex', alignItems: 'center', gap: '20px', padding: '0 30px' });
      el.innerHTML = `${icon(ic, 44)}<span class="h3" style="font-size:36px">${l}</span><span class="h3" style="margin-left:auto;font-size:32px;color:var(--ink-2)">${n}</span>`;
      return el;
    });
    const reading = h('div', 'face small', layer);
    box(reading, 90, 662, 470, 104);
    Object.assign(reading.style, { display: 'flex', alignItems: 'center', gap: '18px', padding: '0 30px' });
    reading.innerHTML = `<svg width="62" height="36" viewBox="0 0 40 24"><ellipse cx="20" cy="12" rx="17" ry="9" fill="none" stroke="#9aa3b0" stroke-width="2"/><circle id="rpt" cx="37" cy="12" r="4" fill="${BLUE}"/></svg><span class="h3" style="font-size:32px">AI agent가 읽는 중</span>`;
    const rpt = reading.querySelector('#rpt');
    const q = h('div', 'face', layer);
    box(q, 590, 222, 640, 790);
    const qHead = text(q, 'label', 40, 34, '', { color: 'var(--ink-2)', fontSize: '28px' });
    const asks = [0, 2, 5].map(i => E.choices[i]).filter(Boolean);
    const qs = asks.map((c, k) => {
      const g = h('div', 'abs', q);
      Object.assign(g.style, { left: '40px', top: '96px', width: '560px' });
      g.innerHTML = `<div class="h3" style="font-size:40px;white-space:normal;line-height:1.2">${c.label}</div>` + c.options.slice(0, 4).map(o =>
        `<div class="opt" style="margin-top:16px;display:flex;align-items:center;gap:16px;padding:18px 22px;border:2px solid #dce0e6;border-radius:8px;corner-shape:bevel;font-size:29px;font-weight:550;color:#171b23"><span class="rad" style="width:26px;height:26px;border-radius:50%;border:2.5px solid #878f9d;flex:none"></span><span>${o}</span></div>`).join('') +
        '<div style="margin-top:16px;padding:16px 22px;font-size:28px;color:#525a68;border:2px dashed #c9ced6;border-radius:8px;corner-shape:bevel">기타: 직접 쓰기</div>';
      return { g, k, opts: [...g.querySelectorAll('.opt')], pick: k === 2 ? 1 : 0 };
    });
    const st = h('div', 'face', layer);
    box(st, 1260, 222, 590, 790);
    text(st, 'h3', 40, 32, 'Workflow 초안');
    const ssvg = sv('svg', { width: 590, height: 790 }, st);
    Object.assign(ssvg.style, { position: 'absolute', left: '0', top: '0' });
    const top0 = 108, gap = 61;
    const rail = sv('line', { x1: 52, x2: 52, y1: top0, y2: top0, stroke: BLUE, 'stroke-width': 3 }, ssvg);
    const steps = E.steps.map((s, i) => {
      const y = top0 + i * gap;
      const mark = sv('rect', { x: 44, y: y + 9, width: 16, height: 16, fill: s.researcher ? '#ffffff' : BLUE, stroke: s.researcher ? '#171b23' : BLUE, 'stroke-width': 3, transform: `rotate(45 52 ${y + 17})` }, ssvg);
      const lab = text(st, 'label', 84, y, s.label, { fontSize: '25px', color: 'var(--ink)', fontWeight: 550, maxWidth: s.researcher ? '330px' : '480px', overflow: 'hidden', textOverflow: 'ellipsis' });
      const pl = s.researcher ? text(st, 'plate', 430, y - 3, '연구자 결정', { fontSize: '22px', background: '#171b23', color: '#fff' }) : null;
      return { mark, lab, pl, i };
    });
    const nRes = E.steps.filter(s => s.researcher).length;
    const foot = text(st, 'h3', 40, 726, `단계 ${E.steps.length} · 연구자 결정 ${nRes} · 산출물 ${E.outputs.length}`, { fontSize: '28px' });
    return t => {
      const o = win(t, 24.0, 30.3, 0.45, 0.45);
      put(layer, { o });
      if (o <= 0) return;
      head(t);
      srcs.forEach((el, i) => { const f = ramp(t, 24.4 + i * 0.18, 25.0 + i * 0.18); put(el, { o: f, x: -30 * (1 - f) }); });
      put(reading, { o: ramp(t, 25.0, 25.4, lin) });
      const ra = ((t - 25) / 1.1) * Math.PI * 2;
      rpt.setAttribute('cx', 20 + 17 * Math.cos(ra));
      rpt.setAttribute('cy', 12 + 9 * Math.sin(ra));
      const qf = ramp(t, 25.3, 25.9);
      put(q, { o: qf, y: 20 * (1 - qf) });
      const per = 1.05;
      qs.forEach(Q => {
        const a = 25.6 + Q.k * per, b = a + per;
        put(Q.g, { o: Q.k === qs.length - 1 ? ramp(t, a, a + 0.25, lin) : win(t, a, b, 0.25, 0.2) });
        Q.opts.forEach((op, j) => {
          const on = j === Q.pick && t > a + 0.6;
          op.style.borderColor = on ? BLUE : '#dce0e6';
          op.style.background = on ? '#e8eeff' : '#fff';
          op.querySelector('.rad').style.border = on ? `8px solid ${BLUE}` : '2.5px solid #878f9d';
        });
      });
      qHead.textContent = `연구자가 정할 조건 ${E.choices.length}개 중 ${Math.min(qs.length, Math.floor(clamp((t - 25.6) / per, 0, qs.length - 0.001)) + 1)}번째`;
      const sf = ramp(t, 26.2, 26.8);
      put(st, { o: sf, x: 30 * (1 - sf) });
      const prog = ramp(t, 26.8, 29.4, lin) * steps.length;
      rail.setAttribute('y2', top0 + 17 + Math.max(0, Math.min(steps.length - 1, prog - 1)) * gap);
      steps.forEach(s => {
        const f = clamp(prog - s.i);
        s.mark.setAttribute('opacity', f);
        put(s.lab, { o: f, x: 12 * (1 - f) });
        if (s.pl) put(s.pl, { o: f });
      });
      put(foot, { o: ramp(t, 29.3, 29.8, lin) });
    };
  });

  // S4c revisions and installs timeline 38.2–41.3 (real hub record)
  scenes.push(() => {
    const E = D.hubEntry;
    const layer = h('div', 'layer');
    const head = headline(layer, 110, 96, [[38.4, 41.3, '등록한 Workflow는 판으로 쌓이고, 다른 프로젝트가 가져다 씁니다']]);
    const panel = h('div', 'face', layer);
    box(panel, 90, 236, 1740, 760);
    const svg = sv('svg', { width: 1740, height: 760 }, panel);
    svg.style.position = 'absolute';
    const t0 = Date.parse('2026-10-16T00:00:00+09:00'), t1 = Date.parse('2026-10-19T00:00:00+09:00');
    const X = ms => lerp(300, 1660, (ms - t0) / (t1 - t0));
    const lanes = [['판', 200], ['프로젝트 설치', 410]];
    for (const [l, y] of lanes) {
      const tx = sv('text', { x: 50, y: y + 12, 'font-size': 34, 'font-weight': 650, fill: '#171b23' }, svg);
      tx.textContent = l;
      sv('line', { x1: 300, x2: 1660, y1: y, y2: y, stroke: '#dce0e6', 'stroke-width': 3 }, svg);
    }
    const axisY = 560;
    sv('line', { x1: 300, x2: 1660, y1: axisY, y2: axisY, stroke: '#878f9d', 'stroke-width': 2 }, svg);
    for (let d = 0; d <= 3; d++) {
      const ms = t0 + d * 86400000;
      sv('line', { x1: X(ms), x2: X(ms), y1: axisY, y2: axisY + 18, stroke: '#525a68', 'stroke-width': 2.5 }, svg);
      const lab = sv('text', { x: X(ms), y: axisY + 56, 'font-size': 30, 'font-weight': 600, fill: '#525a68', 'text-anchor': 'middle' }, svg);
      lab.textContent = `10월 ${16 + d}일`;
      for (let hh = 6; hh < 24; hh += 6) {
        const m = ms + hh * 3600000;
        sv('line', { x1: X(m), x2: X(m), y1: axisY, y2: axisY + 9, stroke: '#b9c0ca', 'stroke-width': 1.5 }, svg);
      }
    }
    const events = [];
    E.revisions.forEach(r => {
      const x = X(Date.parse(r.at));
      const g = sv('g', {}, svg);
      sv('rect', { x: x - 15, y: 185, width: 30, height: 30, fill: BLUE, transform: `rotate(45 ${x} 200)` }, g);
      const tx = sv('text', { x: x + 30, y: 166, 'font-size': 38, 'font-weight': 700, fill: '#171b23' }, g);
      tx.textContent = `판 ${r.revision}`;
      if (r.note) {
        const n = sv('text', { x: x + 30, y: 258, 'font-size': 28, 'font-weight': 550, fill: '#525a68' }, g);
        n.textContent = r.note;
      }
      events.push({ g, ms: Date.parse(r.at) });
    });
    E.installs.forEach((ins, i) => {
      const x = X(Date.parse(ins.at));
      const g = sv('g', {}, svg);
      sv('line', { x1: x, x2: x, y1: 428, y2: axisY, stroke: '#c9ced6', 'stroke-width': 1.5, 'stroke-dasharray': '4 5' }, g);
      sv('circle', { cx: x, cy: 410, r: 15, fill: '#ffffff', stroke: BLUE, 'stroke-width': 5 }, g);
      events.push({ g, ms: Date.parse(ins.at) + i });
    });
    const reads = h('div', 'abs', panel);
    Object.assign(reads.style, { left: '300px', top: '650px', display: 'flex', gap: '64px', alignItems: 'baseline' });
    reads.innerHTML = [[E.installs.length, '설치한 프로젝트'], [E.stars, '별'], [E.comments, '댓글']].map(([n, l]) =>
      `<span><span class="num" style="font-size:64px">${n}</span><span class="h3" style="margin-left:14px;font-size:32px;color:var(--ink-2)">${l}</span></span>`).join('');
    text(panel, 'small', 1250, 690, '검토용 허브 기록 · 시험 계정 포함');
    const sweep = sv('line', { x1: 300, x2: 300, y1: 130, y2: axisY, stroke: BLUE, 'stroke-width': 2, opacity: 0.5 }, svg);
    return t => {
      const o = win(t, 38.2, 41.3, 0.45, 0.4);
      put(layer, { o });
      if (o <= 0) return;
      head(t);
      const pf = ramp(t, 38.2, 38.8);
      put(panel, { o: pf, y: 20 * (1 - pf) });
      const now = lerp(t0, t1, ramp(t, 38.6, 40.4, inOut));
      sweep.setAttribute('x1', X(now));
      sweep.setAttribute('x2', X(now));
      for (const e of events) e.g.setAttribute('opacity', clamp((now - e.ms) / 3600000 / 3));
      put(reads, { o: ramp(t, 40.1, 40.6, lin) });
    };
  });

  // Footage segments: a/b film seconds; side = a chart beside a narrower window.
  const SEG = [
    { shot: 'H1', a: 30.1, b: 35.0, cap: ['GAID 허브', '등록된 Workflow와 단계를 봅니다'] },
    { shot: 'H3', a: 34.8, b: 38.4, cap: ['허브 스킬 선반', '출처·라이선스·검사 기록을 보고 설치합니다'] },
    { shot: 'R1', a: 41.1, b: 45.4, cap: ['Workflow 시작 설정', '입력 파일 → 분석 조건 → 요약'] },
    { shot: 'R2', a: 45.2, b: 49.0, cap: ['Workflow로 시작한 대화', 'AI agent가 지침대로 분석합니다'] },
    { shot: 'R3', a: 48.8, b: 52.6, cap: ['연구노트', 'AI agent가 제안하고 연구자가 정합니다'] },
    { shot: 'R5', a: 52.4, b: 55.4, cap: ['LAS 검층 보기', '깊이 트랙을 원본 값으로'] },
    { shot: 'M1', a: 55.2, b: 59.6, cap: ['shp 지도 보기', '암상별 색 구분 · 1:5만 지질도와 위성영상 배경'] },
    { shot: 'M2', a: 59.4, b: 64.3, cap: ['속성과 면적 표', '암상별 면적을 표로'], side: 'area' },
    { shot: 'L1', a: 64.1, b: 68.6, cap: ['서재', '논문을 폴더로 모으고 Zotero와 잇습니다'] },
    { shot: 'R6', a: 68.4, b: 74.4, cap: ['쪽 인용', '서재의 논문을 쪽 번호까지 인용합니다'], side: 'cite' },
    { shot: 'L2', a: 74.2, b: 78.4, cap: ['논문과 프로젝트 연결', '이 논문을 쓴 프로젝트를 지도로'] },
  ];
  const WIN_FULL = { x: 180, y: 166, w: 1560 };
  const WIN_SIDE = { x: 70, y: 236, w: 1180 };
  const mixWin = (a, b, f) => ({ x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), w: lerp(a.w, b.w, f) });

  scenes.push(() => {
    const layer = h('div', 'layer');
    const main = footageWindow(layer);
    const caps = SEG.map(sg => {
      const el = h('div', 'caption', layer);
      el.innerHTML = `<span>${sg.cap[0]}</span><span class="sub">${sg.cap[1]}</span>`;
      return { el, sg };
    });
    // side chart: area by lithology (real research-note table)
    const Lt = D.litho;
    const area = h('div', 'face', layer);
    box(area, 1280, 166, 570, 860);
    text(area, 'h3', 36, 30, '암상별 면적');
    text(area, 'label', 36, 82, `폴리곤 ${fmt(Lt.polygons)}개 · 합계 ${fmt(Lt.totalKm2, 1)} km²`);
    const top = Lt.classes.slice(0, 6);
    const rest = Lt.classes.slice(6);
    const rows = [...top.map(c => ({ label: c.label, km2: c.areaKm2, pct: c.percent })),
      { label: `그 외 ${rest.length}개 분류`, km2: rest.reduce((s, c) => s + c.areaKm2, 0), pct: rest.reduce((s, c) => s + c.percent, 0), muted: true }];
    const maxA = Math.max(...rows.map(r => r.km2));
    const aRows = rows.map((r, i) => {
      const y = 140 + i * 96;
      const lab = text(area, 'label', 36, y, r.label.replace(/^서산층군 경기변성암복합체 /, '경기변성암복합체 '), { color: 'var(--ink)', fontSize: '25px', maxWidth: '500px', overflow: 'hidden', textOverflow: 'ellipsis' });
      const bar = h('div', 'abs', area);
      Object.assign(bar.style, { left: '36px', top: `${y + 40}px`, height: '28px', background: r.muted ? '#878f9d' : BLUE, borderRadius: '3px' });
      const val = text(area, 'label', 0, y + 38, `${fmt(r.km2, 1)} km² ${fmt(r.pct, 1)}%`, { color: 'var(--ink)', fontWeight: 650, fontSize: '24px' });
      return { lab, bar, val, w: (250 * r.km2) / maxA, i };
    });
    text(area, 'small', 36, 818, '선언된 좌표계의 평면 면적 · 연구노트 2026-10-18');
    // side chart: page-citation checks (two real tests)
    const A = D.acceptance, Q = D.libraryNext;
    const cite = h('div', 'face', layer);
    box(cite, 1280, 166, 570, 860);
    text(cite, 'h3', 36, 30, '쪽 인용 대조');
    const day = s => `${Number(s.slice(5, 7))}월 ${Number(s.slice(8, 10))}일`;
    const qBlock = h('div', 'abs', cite);
    Object.assign(qBlock.style, { left: '36px', top: '92px' });
    qBlock.innerHTML = `<div class="label" style="color:var(--ink)">${day(Q.date)} · ${Q.model} · 논문 ${Q.papers}편</div><div style="display:flex;align-items:baseline;gap:12px;margin-top:6px"><span class="num" style="font-size:64px">${Q.onPage}</span><span class="h3" style="font-size:30px;color:var(--ink-2)">/ ${Q.citations} 인용이 해당 쪽에</span></div>`;
    const qsvg = sv('svg', { width: 500, height: 60 }, cite);
    Object.assign(qsvg.style, { position: 'absolute', left: '36px', top: '222px' });
    const qCells = [];
    for (let i = 0; i < Q.citations; i++) qCells.push(sv('rect', { x: (i % 17) * 29, y: Math.floor(i / 17) * 29, width: 24, height: 24, rx: 2, fill: '#e8eeff' }, qsvg));
    const aBlock = h('div', 'abs', cite);
    Object.assign(aBlock.style, { left: '36px', top: '312px' });
    const onPage = A.units - A.notOnPage - A.contradicted;
    aBlock.innerHTML = `<div class="label" style="color:var(--ink)">${day(A.date)} · 수용 시험 · 논문 ${A.papers}편</div><div style="display:flex;align-items:baseline;gap:12px;margin-top:6px"><span class="num" style="font-size:64px">${onPage}</span><span class="h3" style="font-size:30px;color:var(--ink-2)">/ ${A.units} 확인 단위</span></div>`;
    const asvg = sv('svg', { width: 500, height: 330 }, cite);
    Object.assign(asvg.style, { position: 'absolute', left: '36px', top: '442px' });
    const aCells = [];
    for (let i = 0; i < A.units; i++) aCells.push(sv('rect', { x: (i % 18) * 27.5, y: Math.floor(i / 18) * 27.5, width: 23, height: 23, rx: 2, fill: '#e8eeff' }, asvg));
    const legend = h('div', 'abs', cite);
    Object.assign(legend.style, { left: '36px', top: '784px', display: 'flex', gap: '22px', alignItems: 'center' });
    legend.innerHTML = [[BLUE, '해당 쪽', ''], ['#8a5300', '쪽에 없음', A.notOnPage], ['#c2261d', '어긋남', A.contradicted]].map(([c, l, n]) =>
      `<span style="display:flex;align-items:center;gap:8px"><span style="width:20px;height:20px;background:${c};border-radius:2px"></span><span class="label" style="font-size:24px;color:var(--ink)">${l} ${n}</span></span>`).join('');
    return t => {
      const any = SEG.some(s => t >= s.a - 0.05 && t <= s.b + 0.05);
      put(layer, { o: any ? 1 : 0 });
      if (!any) return;
      let drawn = false;
      SEG.forEach((sg, idx) => {
        if (t < sg.a || t > sg.b) return;
        const local = t - sg.a, dur = sg.b - sg.a;
        const first = idx === 0 || SEG[idx - 1].b < sg.a;
        const last = idx === SEG.length - 1 || SEG[idx + 1].a > sg.b;
        const prevSide = !first && SEG[idx - 1].side;
        // window geometry eases between the full and side layouts at shot boundaries
        let g = sg.side ? WIN_SIDE : WIN_FULL;
        if (sg.side && !prevSide) g = mixWin(WIN_FULL, WIN_SIDE, ramp(t, sg.a, sg.a + 0.8, inOut));
        if (!sg.side && prevSide) g = mixWin(WIN_SIDE, WIN_FULL, ramp(t, sg.a, sg.a + 0.8, inOut));
        const o = (first ? ramp(t, sg.a, sg.a + 0.45, lin) : 1) * (last ? 1 - ramp(t, sg.b - 0.35, sg.b, lin) : 1);
        const dy = first ? 24 * (1 - ramp(t, sg.a, sg.a + 0.7)) : 0;
        main.draw({ x: g.x, y: g.y + dy, w: g.w, o, shot: sg.shot, local, view: viewAt(shotKeys(sg.shot), local, dur) });
        drawn = true;
      });
      if (!drawn) main.draw({});
      for (const c of caps) {
        put(c.el, { o: win(t, c.sg.a + 0.1, c.sg.b, 0.4, 0.3), y: 12 * (1 - ramp(t, c.sg.a + 0.1, c.sg.a + 0.7)) });
        c.el.style.left = `${c.sg.side ? WIN_SIDE.x : WIN_FULL.x}px`;
        c.el.style.top = c.sg.side ? '150px' : '70px';
      }
      const m2 = SEG.find(s => s.side === 'area');
      put(area, { o: win(t, m2.a + 0.5, m2.b, 0.5, 0.35), x: 40 * (1 - ramp(t, m2.a + 0.5, m2.a + 1.2)) });
      aRows.forEach(r => {
        const f = ramp(t, m2.a + 0.9 + r.i * 0.18, m2.a + 1.8 + r.i * 0.18);
        r.bar.style.width = `${r.w * f}px`;
        r.val.style.left = `${36 + r.w * f + 14}px`;
        put(r.val, { o: f });
        put(r.lab, { o: ramp(t, m2.a + 0.8 + r.i * 0.18, m2.a + 1.3 + r.i * 0.18, lin) });
      });
      const r6 = SEG.find(s => s.side === 'cite');
      put(cite, { o: win(t, r6.a + 0.5, r6.b, 0.5, 0.35), x: 40 * (1 - ramp(t, r6.a + 0.5, r6.a + 1.2)) });
      const qf = ramp(t, r6.a + 0.9, r6.a + 2.0, lin) * Q.citations;
      qCells.forEach((c, i) => c.setAttribute('fill', i < qf ? BLUE : '#e8eeff'));
      const af = ramp(t, r6.a + 2.0, r6.a + 4.0, lin) * A.units;
      const bad = 9 * 18 + 7; // the one not-on-page unit, placed inside the grid
      aCells.forEach((c, i) => c.setAttribute('fill', i < af ? (i === bad && A.notOnPage ? '#8a5300' : BLUE) : '#e8eeff'));
      put(legend, { o: ramp(t, r6.a + 3.8, r6.a + 4.3, lin) });
    };
  });

  // S6 eight points around the octagonal G 78.2–85.3
  scenes.push(() => {
    const layer = h('div', 'layer');
    const head = headline(layer, 110, 90, [[78.5, 85.3, 'GAID가 연구자를 돕는 여덟 가지']]);
    const cx = 960, cy = 620, R = 230;
    const svg = sv('svg', { width: 1920, height: 1080 }, layer);
    svg.style.position = 'absolute';
    const L = markAt(layer, cx, cy, 170);
    const items = [
      ['file-text', '논문에서 Workflow로', '질문에 답하면 초안'],
      ['users', 'GAID 허브', '판·별·댓글·스킬 선반'],
      ['server', '기관 허브 서버', '계정과 서재 동기화'],
      ['book-open', '서재와 쪽 인용', 'Zotero 연결'],
      ['notebook-pen', '연구노트와 결정', '결정은 연구자가'],
      ['map', '지도·검층·표', 'shp·LAS·CSV 그대로'],
      ['table-2', '저널 그림 점검', '폭과 글자 크기'],
      ['database', '기관 로컬 모델', '연구소 서버 모델'],
    ];
    const arcs = items.map(([ic, title, sub], i) => {
      const deg0 = -90 + i * 45 - 22.5 + 3, deg1 = -90 + i * 45 + 22.5 - 3;
      const a0 = (deg0 * Math.PI) / 180, a1 = (deg1 * Math.PI) / 180;
      const d = `M ${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)} A ${R} ${R} 0 0 1 ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)}`;
      const base = sv('path', { d, fill: 'none', stroke: '#dce0e6', 'stroke-width': 16 }, svg);
      const arc = sv('path', { d, fill: 'none', stroke: BLUE, 'stroke-width': 16, pathLength: 1, 'stroke-dasharray': '0 1' }, svg);
      const am = ((-90 + i * 45) * Math.PI) / 180;
      const diag = Math.abs(Math.cos(am)) > 0.3 && Math.abs(Math.sin(am)) > 0.3;
      const lx = cx + (R + 50) * Math.cos(am) + (diag ? Math.sign(Math.cos(am)) * 70 : 0), ly = cy + (R + 50) * Math.sin(am);
      const c = Math.cos(am), s = Math.sin(am);
      const side = c > 0.3 ? 'right' : c < -0.3 ? 'left' : 'center';
      const el = h('div', 'abs', layer);
      const W = 520;
      el.style.width = `${W}px`;
      el.style.textAlign = side === 'right' ? 'left' : side === 'left' ? 'right' : 'center';
      el.style.left = `${side === 'right' ? lx : side === 'left' ? lx - W : lx - W / 2}px`;
      const blockH = 92;
      el.style.top = `${s < -0.3 ? ly - blockH : s > 0.3 ? ly : ly - blockH / 2}px`;
      const jc = side === 'right' ? 'flex-start' : side === 'left' ? 'flex-end' : 'center';
      el.innerHTML = `<div style="display:flex;align-items:center;gap:14px;justify-content:${jc}">${icon(ic, 40, BLUE)}<span class="h3" style="font-size:38px">${title}</span></div><div class="label" style="margin-top:6px;font-size:28px">${sub}</div>`;
      return { base, arc, el, i };
    });
    const pt = sv('circle', { r: 12, fill: BLUE }, svg);
    return t => {
      const o = win(t, 78.2, 85.3, 0.5, 0.5);
      put(layer, { o });
      if (o <= 0) return;
      head(t);
      const gi = ramp(t, 78.5, 79.2);
      L.set({ ringF: ramp(t, 78.3, 79.3, inOut), gO: gi, gS: lerp(0.8, 1, gi), lettersF: 0 });
      const step = 0.62;
      arcs.forEach(a => {
        const s = 79.2 + a.i * step;
        a.arc.setAttribute('stroke-dasharray', `${ramp(t, s, s + 0.55, inOut)} 1`);
        a.base.setAttribute('opacity', ramp(t, 78.8, 79.3, lin));
        const f = ramp(t, s + 0.15, s + 0.7);
        put(a.el, { o: f, y: 10 * (1 - f) });
      });
      const prog = clamp((t - 79.2) / (step * 8));
      const ang = ((-90 - 22.5 + prog * 360) * Math.PI) / 180;
      pt.setAttribute('cx', cx + R * Math.cos(ang));
      pt.setAttribute('cy', cy + R * Math.sin(ang));
      pt.setAttribute('opacity', win(t, 79.1, 84.6, 0.2, 0.4));
    };
  });

  // S7 closing 85–90
  scenes.push(() => {
    const layer = h('div', 'layer');
    const L = lockup(layer, 280);
    L.svg.style.left = `${960 - L.width / 2}px`;
    L.svg.style.top = '300px';
    const sub = text(layer, 'h2', 0, 660, '지구과학 연구자를 위한 AI agent 작업 공간', { width: '1920px', textAlign: 'center', fontSize: '50px', fontWeight: 600, color: 'var(--ink-2)' });
    const tag = text(layer, 'small', 0, 1000, '내부 검토용 영상', { width: '1840px', textAlign: 'right' });
    return t => {
      const o = ramp(t, 85.0, 85.6, lin);
      put(layer, { o });
      if (o <= 0) return;
      const gi = ramp(t, 85.2, 86.0);
      L.set({ ringF: ramp(t, 85.0, 86.2, inOut), gO: gi, gS: lerp(0.85, 1, gi), lettersF: ramp(t, 85.8, 86.7, inOut) });
      put(sub, { o: ramp(t, 86.6, 87.2, lin), y: 14 * (1 - ramp(t, 86.6, 87.4)) });
      put(tag, { o: ramp(t, 87.0, 87.6, lin) });
    };
  });

  // ---------- init ----------
  async function init() {
    const names = ['file-text', 'code-xml', 'folder-open', 'notebook-pen', 'book-open', 'git-branch', 'server', 'map', 'database', 'table-2', 'quote', 'users', 'message-square-text', 'well-log', 'map-gis'];
    await Promise.all(names.map(async n => {
      const txt = await (await fetch(`icons/${n}.svg`)).text();
      ICON[n] = txt.replace(/width="24"/, 'width="100%"').replace(/height="24"/, 'height="100%"');
    }));
    const logo = new DOMParser().parseFromString(await (await fetch('brand/horizontal-color.svg')).text(), 'image/svg+xml');
    const paths = [...logo.querySelectorAll('path')];
    LOGO = {
      ring: paths[0].getAttribute('d'),
      g: paths[1].getAttribute('d'),
      letters: paths.slice(2).map(p => ({ d: p.getAttribute('d'), transform: p.getAttribute('transform') })),
    };
    await document.fonts.load('700 40px Pretendard');
    await document.fonts.load('500 20px Pretendard');
    const drawers = scenes.map(build => build());
    drawers.push(buildScale());
    window.motion = {
      ready: true,
      duration: 90,
      segments: SEG,
      async frame(t) {
        pending.length = 0;
        for (const d of drawers) d(t);
        await Promise.all(pending);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      },
    };
  }
  init().catch(e => { window.motionError = String((e && e.stack) || e); });
})();
