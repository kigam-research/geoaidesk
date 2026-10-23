/* GAID promo film v2 (~105 s, structure draft v2 in the task document). Deterministic: window.motion.frame(t) draws film second t.
 * Footage and feature tags from PROMO_CAPTURE (capture-v2); demo frames are shown whole at one scale.
 * Illustrative scenes (scattered sources, second brain) carry an on-screen "개념도" tag.
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
    // at most 1.5× so the zoomed region keeps its context; never show outside the frame
    w = clamp(w, VW / 1.5, VW); hh = (w * 9) / 16;
    x = clamp(x, 0, VW - w); y = clamp(y, 0, VH - hh);
    return [x, y, w, hh];
  };
  // Default zoom for a shot: its focus rects from capture.json, in order, held until the next one.
  function shotKeys(id) {
    const info = shotInfo(id);
    if (!info || !info.focus || !info.focus.length) return null;
    // pointer-sized targets (buttons, single rows) would crop away their context; frame only regions
    const regions = info.focus.filter(f => f.rect.width >= 300 && f.rect.height >= 120);
    if (!regions.length) return null;
    return regions.map(f => ({ t: Math.max(0.6, f.t), rect: fit169([f.rect.x, f.rect.y, f.rect.width, f.rect.height]) }));
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


  // ================= timeline v2 (structure draft v2, task document) =================
  const DURATION = 105;
  // Real-system segments: one shot each, whole app frame at one scale (no zoom, no pan; user feedback 2026-10-23).
  // a/b are film seconds; consecutive shots overlap by 0.1 s. Beats (feature tags) come from capture.json.
  const SHOT_ORDER = ['L1', 'L1b', 'A1', 'A2', 'A3', 'H1', 'H2', 'R1', 'R2', 'M1', 'N1', 'N2', 'L2', 'L3'];
  const SHOT_TARGET = { L1: 6, L1b: 4, A1: 4, A2: 4.5, A3: 4, H1: 4, H2: 4, R1: 6, R2: 6, M1: 5, N1: 5.5, N2: 3.5, L2: 4.5, L3: 4 };
  const SEG = [];
  {
    let at = 28.3;
    for (const id of SHOT_ORDER) {
      const info = CAP && CAP.shots ? CAP.shots.find(s => s.id === id) : null;
      const dur = info ? info.frames / FPS : SHOT_TARGET[id];
      SEG.push({ shot: id, a: at, b: at + dur });
      at += dur - 0.1;
    }
  }
  const STATIONS = [
    { icon: 'library', label: '내 서재' },
    { icon: 'file-text', label: 'Workflow 만들기' },
    { icon: 'share-2', label: 'GAID 허브 공유' },
    { icon: 'orbit', label: '연구 분석' },
    { icon: 'notebook-pen', label: '연구노트' },
  ];
  const CHAPTERS_V2 = [
    { st: 0, title: '내 서재', shots: ['L1', 'L1b'] },
    { st: 1, title: '논문에서 Workflow 만들기', shots: ['A1', 'A2', 'A3'] },
    { st: 2, title: 'GAID 허브에 공유', shots: ['H1', 'H2'] },
    { st: 3, title: 'Workflow로 연구 분석', shots: ['R1', 'R2', 'M1'] },
    { st: 4, title: '연구노트로 정리', shots: ['N1', 'N2'] },
    { st: 0, back: true, title: '다시 내 서재로', shots: ['L2', 'L3'] },
  ].map(c => {
    const segs = SEG.filter(s => c.shots.includes(s.shot));
    return { ...c, a: segs[0].a, b: segs[segs.length - 1].b };
  });
  const DEMO = { a: CHAPTERS_V2[0].a, b: CHAPTERS_V2[CHAPTERS_V2.length - 1].b };

  const stationIcon = (st, size, color) => (st.icon === 'orbit'
    ? `<span class="icon" style="width:${size * 1.5}px;height:${size}px;color:${color}">${ORBIT_ICON(size)}</span>`
    : icon(st.icon, size, color));

  // ---------- S2 background 4.9–20.2: existing skill ecosystems, scattered sources, gathered by GAID ----------
  scenes.push(() => {
    const A = 4.9, B = 20.2;
    const layer = h('div', 'layer');
    const head = headline(layer, 110, 92, [
      [5.2, 10.0, 'AI agent가 쓸 과학 스킬은 이미 여러 곳에 공개되어 있습니다'],
      [10.2, 15.0, '논문 속 방법, 기관 자료, 개인 폴더의 코드는 따로 흩어져 있습니다'],
      [15.2, 20.0, 'GAID는 이것을 연구자가 쓰기 쉬운 한 곳으로 모읍니다'],
    ]);
    // Sources. Skill names are real: the K-Dense scientific agent skills and the KIGAM skills in GAID's catalogue.
    const cards = [
      ['code-xml', 'K-Dense AI 과학 스킬', ['geopandas', 'literature-review', 'citation-management', 'matplotlib'], 0],
      ['map-gis', 'KIGAM 지구과학 스킬', ['geo-map-and-crs', 'well-log-qc-quicklook', 'spatial-pu-workflow'], 0],
      ['git-branch', 'GitHub 공개 저장소의 스킬', ['저장소마다 따로 설치'], 0],
      ['file-text', '논문 속 분석 방법', ['방법 절', '부록 코드'], 1],
      ['database', '기관 자료', ['지질도', '시추·검층', '지구화학'], 1],
      ['folder-open', '개인 폴더의 코드와 노트', ['스크립트', '분석 노트'], 1],
    ].map(([ic, title, chips, phase], i) => {
      const el = h('div', 'face', layer);
      const col = i % 3, row = Math.floor(i / 3);
      const W = 560, H = 290;
      box(el, 0, 0, W, H);
      el.innerHTML = `<div style="position:absolute;left:32px;top:28px;display:flex;align-items:center;gap:16px">${icon(ic, 44, 'var(--ink)')}<span class="h3" style="font-size:36px">${title}</span></div>`
        + `<div style="position:absolute;left:32px;right:24px;top:100px;display:flex;flex-wrap:wrap;gap:12px 10px">${chips.map(c =>
          `<span style="font-size:26px;font-weight:550;color:var(--ink-2);background:var(--face-2);border:1px solid var(--edge);padding:6px 14px;border-radius:6px;corner-shape:bevel">${c}</span>`).join('')}</div>`;
      const hx = 90 + col * 600, hy = 236 + row * 360;
      // scattered position (phase 2): pushed apart with a small tilt, deterministic
      const sx = hx + [-50, 10, 60][col], sy = hy + [[-20, 30, -10], [40, -15, 25]][row][col];
      const rot = [[-2.5, 1.5, 2.2], [1.8, -2.0, -1.2]][row][col];
      return { el, i, phase, hx, hy, sx, sy, rot, W, H };
    });
    const tag = h('div', 'note-tag', layer, '개념도');
    box(tag, 1700, 100);
    // links between the published skill sources (phase 1); they break when the scene scatters
    const svg = sv('svg', { width: 1920, height: 1080 }, layer);
    svg.style.position = 'absolute';
    const links = [[0, 1], [1, 2]].map(([p, q]) => sv('line', { stroke: '#9aa3b0', 'stroke-width': 3, 'stroke-dasharray': '10 10' }, svg));
    // GAID: one place with shelves
    const panel = h('div', 'face', layer);
    box(panel, 460, 236, 1000, 760);
    const mark = markAt(panel, 120, 104, 110);
    text(panel, 'h2', 210, 72, 'GAID', { fontSize: '60px' });
    const shelves = [
      ['library', '서재', '논문과 서지'],
      ['code-xml', '스킬', '기본 스킬과 가져온 스킬'],
      ['workflow', 'Workflow', '논문에서 만든 분석 절차'],
      ['map-gis', '자료와 지도', '지도·검층·표를 원본 그대로'],
      ['notebook-pen', '연구노트', '결과와 연구자의 결정'],
    ].map(([ic, name, sub], i) => {
      const row = h('div', 'abs', panel);
      Object.assign(row.style, { left: '64px', top: `${196 + i * 104}px`, width: '872px', height: '86px', display: 'flex', alignItems: 'center', gap: '22px', padding: '0 26px', border: '2px solid var(--edge)', borderRadius: '8px', cornerShape: 'bevel' });
      row.innerHTML = `${icon(ic, 40, 'var(--ink-2)')}<span class="h3" style="font-size:36px;width:250px">${name}</span><span class="label" style="font-size:30px">${sub}</span>`;
      return { row, i, ico: row.querySelector('.icon') };
    });
    return t => {
      const o = win(t, A, B, 0.4, 0.4);
      put(layer, { o });
      if (o <= 0) return;
      head(t);
      const scatter = ramp(t, 10.2, 11.4, inOut);
      const gather = ramp(t, 15.2, 16.8, inOut);
      for (const c of cards) {
        const s0 = c.phase === 0 ? 5.5 + c.i * 0.35 : 10.6 + (c.i - 3) * 0.35;
        const appear = ramp(t, s0, s0 + 0.6);
        const lift = c.phase === 0 ? 170 * (1 - ramp(t, 10.0, 10.9, inOut)) : 0;
        let x = lerp(c.hx, c.sx, scatter), y = lerp(c.hy, c.sy, scatter) + lift;
        // gather into the shelves of the GAID panel
        const tx = 460 + 500 - c.W * 0.15, ty = 236 + 196 + (c.i % 5) * 104 - 20;
        x = lerp(x, tx, gather);
        y = lerp(y, ty, gather);
        put(c.el, { o: appear * (1 - ramp(t, 16.2, 16.8, lin)), x, y: y + 18 * (1 - appear), s: lerp(1, 0.3, gather), r: c.rot * scatter * (1 - gather) });
        c.el.style.transformOrigin = '50% 50%';
      }
      [[0, 1], [1, 2]].forEach(([p, q], k) => {
        const P = cards[p], Q = cards[q];
        links[k].setAttribute('x1', P.hx + P.W); links[k].setAttribute('y1', P.hy + 170 + P.H / 2);
        links[k].setAttribute('x2', Q.hx); links[k].setAttribute('y2', Q.hy + 170 + Q.H / 2);
        links[k].setAttribute('opacity', ramp(t, 7.0 + k * 0.3, 7.6 + k * 0.3, lin) * (1 - scatter));
      });
      put(tag, { o: ramp(t, 10.4, 11.0, lin) * (1 - ramp(t, 19.4, 19.9, lin)) });
      const po = ramp(t, 15.9, 16.6);
      put(panel, { o: po, s: lerp(0.96, 1, po) });
      const gi = ramp(t, 16.0, 16.8);
      mark.set({ ringF: ramp(t, 15.9, 16.9, inOut), gO: gi, gS: lerp(0.8, 1, gi), lettersF: 0 });
      for (const s of shelves) {
        const f = ramp(t, 16.6 + s.i * 0.28, 17.2 + s.i * 0.28);
        put(s.row, { o: f, x: 24 * (1 - f) });
        const lit = t > 17.0 + s.i * 0.28;
        s.row.style.borderColor = lit ? BLUE : '#dce0e6';
        s.ico.style.color = lit ? BLUE : '#525a68';
      }
    };
  });

  // ---------- S3 the research cycle 19.9–28.4 ----------
  const RING = { cx: 960, cy: 646, rx: 560, ry: 290 };
  scenes.push(() => {
    const A = 19.9, B = 28.5;
    const layer = h('div', 'layer');
    const head = headline(layer, 110, 92, [[20.2, 28.3, '내 연구가 Workflow가 되고, 다시 내 연구로 돌아옵니다']]);
    const svg = sv('svg', { width: 1920, height: 1080 }, layer);
    svg.style.position = 'absolute';
    const ell = sv('ellipse', { cx: RING.cx, cy: RING.cy, rx: RING.rx, ry: RING.ry, fill: 'none', stroke: '#9aa3b0', 'stroke-width': 2.5, pathLength: 1, 'stroke-dasharray': '0 1' }, svg);
    const trail = sv('path', { d: '', fill: 'none', stroke: BLUE, 'stroke-width': 5, 'stroke-linecap': 'round' }, svg);
    const point = sv('circle', { r: 14, fill: BLUE }, svg);
    const L = markAt(layer, RING.cx, RING.cy - 30, 150);
    const who = text(layer, 'h3', 0, RING.cy + 70, '연구자 + AI agent', { width: '1920px', textAlign: 'center', fontSize: '36px' });
    const START = -150;
    const st = STATIONS.map((s, i) => {
      const deg = START + i * 72;
      const a = (deg * Math.PI) / 180;
      const px = RING.cx + RING.rx * Math.cos(a), py = RING.cy + RING.ry * Math.sin(a);
      const el = h('div', 'face small', layer);
      Object.assign(el.style, { display: 'flex', alignItems: 'center', gap: '16px', padding: '0 28px', height: '92px', left: '0px', top: '0px' });
      el.innerHTML = `${stationIcon(s, 40, '#525a68')}<span class="h3" style="font-size:38px">${s.label}</span>`;
      const dot = sv('circle', { cx: px, cy: py, r: 11, fill: '#ffffff', stroke: '#525a68', 'stroke-width': 3 }, svg);
      return { el, px, py, i, dot, rel: i / 5, ico: el.querySelector('.icon') };
    });
    // 판 grows on the Workflow station as the loop passes the hub
    const pan = h('div', 'plate', layer, '');
    pan.style.fontSize = '30px';
    return t => {
      const o = win(t, A, B, 0.45, 0.4);
      put(layer, { o });
      if (o <= 0) return;
      head(t);
      ell.setAttribute('stroke-dasharray', `${ramp(t, 20.0, 21.2, inOut)} 1`);
      const gi = ramp(t, 20.3, 21.0);
      L.set({ ringF: ramp(t, 20.1, 21.1, inOut), gO: gi, gS: lerp(0.8, 1, gi), lettersF: 0 });
      put(who, { o: ramp(t, 20.9, 21.4, lin) });
      const loop = ramp(t, 21.6, 27.4, lin);
      const ang = ((START + loop * 360) * Math.PI) / 180;
      point.setAttribute('cx', RING.cx + RING.rx * Math.cos(ang));
      point.setAttribute('cy', RING.cy + RING.ry * Math.sin(ang));
      point.setAttribute('opacity', ramp(t, 21.3, 21.7, lin));
      const pts = [];
      for (let k = 0; k <= 120 * loop; k++) {
        const aa = ((START + (k / 120) * 360) * Math.PI) / 180;
        pts.push(`${(RING.cx + RING.rx * Math.cos(aa)).toFixed(1)} ${(RING.cy + RING.ry * Math.sin(aa)).toFixed(1)}`);
      }
      pts.push(`${(RING.cx + RING.rx * Math.cos(ang)).toFixed(1)} ${(RING.cy + RING.ry * Math.sin(ang)).toFixed(1)}`);
      trail.setAttribute('d', loop > 0 ? `M ${pts.join(' L ')}` : '');
      for (const s of st) {
        const appear = ramp(t, 20.6 + s.i * 0.14, 21.2 + s.i * 0.14);
        const lit = loop > 0 && (loop >= s.rel - 0.003);
        const cw = s.el.offsetWidth, ch = 92;
        const ux = (s.px - RING.cx) / RING.rx, uy = (s.py - RING.cy) / RING.ry;
        const x = s.px + ux * (cw / 2 + 26) - cw / 2, y = s.py + uy * (ch / 2 + 30) - ch / 2;
        put(s.el, { o: appear, x, y });
        s.el.style.borderColor = lit ? BLUE : '#dce0e6';
        s.ico.style.color = lit ? BLUE : '#525a68';
        s.dot.setAttribute('fill', lit ? BLUE : '#ffffff');
        s.dot.setAttribute('stroke', lit ? BLUE : '#525a68');
        s.dot.setAttribute('opacity', appear);
      }
      // the loop returning to 내 서재 lights it once more
      if (loop >= 0.999) { st[0].el.style.borderColor = BLUE; }
      const W = st[1];
      const panN = loop >= 0.42 ? 2 : 1;
      pan.textContent = `판 ${panN}`;
      box(pan, W.px - 40, W.py - 150);
      put(pan, { o: ramp(t, 22.6, 23.0, lin), s: loop >= 0.42 ? 1 + 0.12 * (1 - ramp(t, 24.0, 24.4)) : 1 });
    };
  });

  // ---------- demo: cycle strip, chapter title, whole-frame footage, feature tags ----------
  const FRAME = { x: 112, y: 108, w: 1696 };
  FRAME.k = FRAME.w / VW;
  FRAME.h = VH * FRAME.k;
  scenes.push(() => {
    const layer = h('div', 'layer');
    // strip: five stations with the return arc
    const strip = h('div', 'abs', layer);
    Object.assign(strip.style, { left: '0px', top: '0px', width: '1920px', height: '104px' });
    const ssvg = sv('svg', { width: 1920, height: 104 }, strip);
    ssvg.style.position = 'absolute';
    const X0 = 920, X1 = 1790, Y = 40;
    const nodes = STATIONS.map((s, i) => {
      const x = lerp(X0, X1, i / (STATIONS.length - 1));
      const dot = sv('rect', { x: x - 9, y: Y - 9, width: 18, height: 18, fill: '#ffffff', stroke: '#878f9d', 'stroke-width': 3, transform: `rotate(45 ${x} ${Y})` }, ssvg);
      const lab = text(strip, 'label', 0, Y + 18, s.label, { fontSize: '23px', width: '200px', textAlign: 'center', left: `${x - 100}px` });
      return { x, dot, lab };
    });
    const base = sv('line', { x1: X0, x2: X1, y1: Y, y2: Y, stroke: '#c9ced6', 'stroke-width': 3 }, ssvg);
    ssvg.insertBefore(base, ssvg.firstChild);
    const prog = sv('line', { x1: X0, x2: X0, y1: Y, y2: Y, stroke: BLUE, 'stroke-width': 4 }, ssvg);
    ssvg.insertBefore(prog, base.nextSibling);
    // return path from 연구노트 back to 내 서재 (above the strip)
    const back = sv('path', { d: `M ${X1} ${Y - 12} C ${X1} ${Y - 40}, ${X0} ${Y - 40}, ${X0} ${Y - 12}`, fill: 'none', stroke: BLUE, 'stroke-width': 3, pathLength: 1, 'stroke-dasharray': '0 1' }, ssvg);
    const titles = CHAPTERS_V2.map(c => {
      const el = text(layer, 'h2', 112, 26, c.title, { fontSize: '48px' });
      return { el, c };
    });
    const main = footageWindow(layer);
    // feature tags: highlight frame + dim outside + label (all inside the frame box)
    const over = h('div', 'abs', layer);
    Object.assign(over.style, { overflow: 'hidden', borderRadius: '14px', cornerShape: 'bevel', pointerEvents: 'none' });
    const hi = h('div', 'abs', over);
    Object.assign(hi.style, { border: `4px solid ${BLUE}`, borderRadius: '10px', cornerShape: 'bevel', boxShadow: '0 0 0 3000px rgba(23,27,35,0.20)' });
    const tagEl = h('div', 'abs', over);
    Object.assign(tagEl.style, { background: BLUE, color: '#fff', fontSize: '32px', fontWeight: 700, padding: '8px 20px', borderRadius: '8px', cornerShape: 'bevel', whiteSpace: 'nowrap', letterSpacing: '-0.01em' });
    return t => {
      const o = win(t, DEMO.a - 0.1, DEMO.b + 0.1, 0.5, 0.45);
      put(layer, { o });
      if (o <= 0) return;
      // chapter state
      const ci = Math.max(0, CHAPTERS_V2.findIndex(c => t >= c.a - 0.05 && t < c.b - 0.05));
      const cur = CHAPTERS_V2[ci === -1 ? CHAPTERS_V2.length - 1 : ci];
      titles.forEach(({ el, c }) => put(el, { o: win(t, c.a, c.b, 0.35, 0.25), y: 12 * (1 - ramp(t, c.a, c.a + 0.6)) }));
      const fwd = cur.back ? 4 : cur.st;
      const fx = lerp(nodes[0].x, nodes[fwd].x, 1);
      const prevX = fwd > 0 ? nodes[fwd - 1].x : nodes[0].x;
      const grow = ramp(t, cur.a, cur.a + 0.7, inOut);
      prog.setAttribute('x2', cur.back ? nodes[4].x : lerp(prevX, fx, grow));
      back.setAttribute('stroke-dasharray', `${cur.back ? ramp(t, cur.a, cur.a + 1.0, inOut) : 0} 1`);
      nodes.forEach((n, i) => {
        const active = cur.back ? i === 0 : i === cur.st;
        const done = cur.back ? true : i < cur.st;
        n.dot.setAttribute('fill', active || done ? BLUE : '#ffffff');
        n.dot.setAttribute('stroke', active || done ? BLUE : '#878f9d');
        n.dot.setAttribute('transform', `rotate(45 ${n.x} ${Y}) translate(${n.x} ${Y}) scale(${active ? 1.35 : 1}) translate(${-n.x} ${-Y})`);
        n.lab.style.color = active ? 'var(--ink)' : 'var(--ink-3)';
        n.lab.style.fontWeight = active ? 700 : 550;
      });
      // footage
      let drawn = null;
      SEG.forEach((sg, idx) => {
        if (t < sg.a || t > sg.b) return;
        const local = t - sg.a + (sg.skip || 0);
        const first = idx === 0;
        const dy = first ? 24 * (1 - ramp(t, sg.a, sg.a + 0.7)) : 0;
        main.draw({ x: FRAME.x, y: FRAME.y + dy, w: FRAME.w, o: 1, shot: sg.shot, local, view: [0, 0, VW, VH] });
        drawn = { sg, local, dy };
      });
      if (!drawn) { main.draw({}); put(over, { o: 0 }); return; }
      box(over, FRAME.x, FRAME.y + drawn.dy, FRAME.w, FRAME.h);
      const info = shotInfo(drawn.sg.shot);
      const beats = (info && info.beats) || drawn.sg.beats || [];
      const bt = beats.find(b => drawn.local >= b.t0 && drawn.local <= b.t1);
      if (!bt) { put(over, { o: 0 }); return; }
      const joinedIn = beats.some(b => b !== bt && Math.abs(b.t1 - bt.t0) < 0.05);
      const joinedOut = beats.some(b => b !== bt && Math.abs(b.t0 - bt.t1) < 0.05);
      const bo = Math.min(joinedIn ? 1 : ramp(drawn.local, bt.t0 + 0.15, bt.t0 + 0.45, lin), joinedOut ? 1 : 1 - ramp(drawn.local, bt.t1 - 0.3, bt.t1, lin));
      put(over, { o: bo });
      // a box that follows on from the previous beat glides there instead of jumping
      const prevB = beats.find(b => b !== bt && Math.abs(b.t1 - bt.t0) < 0.05);
      const glide = prevB ? inOut((drawn.local - bt.t0) / 0.45) : 1;
      const r = prevB ? ['x', 'y', 'width', 'height'].reduce((o, k) => ({ ...o, [k]: lerp(prevB.rect[k], bt.rect[k], glide) }), {}) : bt.rect;
      const rx = r.x * FRAME.k, ry = r.y * FRAME.k, rw = r.width * FRAME.k, rh = r.height * FRAME.k;
      box(hi, rx - 6, ry - 6, rw + 12, rh + 12);
      tagEl.textContent = bt.label;
      const tw = tagEl.offsetWidth, th = tagEl.offsetHeight;
      // tag outside the box where it fits in the frame: above, below, right, left; last resort inside top-right
      const m = 12, gap = 10, L0 = rx - 6, T0 = ry - 6, R0 = rx + rw + 6, B0 = ry + rh + 6;
      const fits = (x, y) => x >= m && y >= m && x + tw <= FRAME.w - m && y + th <= FRAME.h - m;
      const cands = [
        [clamp(L0, m, FRAME.w - tw - m), T0 - th - gap],
        [clamp(L0, m, FRAME.w - tw - m), B0 + gap],
        [R0 + gap, clamp(T0, m, FRAME.h - th - m)],
        [L0 - tw - gap, clamp(T0, m, FRAME.h - th - m)],
      ];
      const [tx, ty] = cands.find(([x, y]) => fits(x, y)) || [R0 - tw - 16, T0 + 16];
      box(tagEl, tx, ty);
    };
  });

  // ---------- S4 ecosystem → KIGAM second brain 91.9–100.4 (conceptual) ----------
  scenes.push(() => {
    const A = 91.9, B = 100.5;
    const layer = h('div', 'layer');
    const head = headline(layer, 110, 92, [
      [92.2, 96.0, '연구자마다 고리가 돌면 지구과학 AI agent 생태계가 자랍니다'],
      [96.2, 100.3, '논문, Workflow, 연구노트가 이어져 KIGAM의 Second brain이 됩니다'],
    ]);
    const tag = h('div', 'note-tag', layer, '개념도');
    box(tag, 1700, 100);
    const svg = sv('svg', { width: 1920, height: 1080 }, layer);
    svg.style.position = 'absolute';
    const C = { x: 960, y: 640 };
    // researcher rings around the centre
    const rings = [];
    const N = 7;
    for (let i = 0; i < N; i++) {
      const a = (-90 + (i * 360) / N) * Math.PI / 180 + 0.2;
      const x = C.x + 780 * Math.cos(a), y = C.y + 300 * Math.sin(a);
      const g = sv('g', {}, svg);
      const e = sv('ellipse', { cx: x, cy: y, rx: 92, ry: 52, fill: '#ffffff', stroke: '#9aa3b0', 'stroke-width': 2.5 }, g);
      const p = sv('circle', { r: 8, fill: BLUE }, g);
      const link = sv('line', { x1: x, y1: y, x2: x, y2: y, stroke: '#9aa3b0', 'stroke-width': 2, 'stroke-dasharray': '8 8' }, svg);
      svg.insertBefore(link, svg.firstChild);
      const u = h('div', 'abs', layer);
      u.innerHTML = icon('user', 36, '#525a68');
      box(u, x - 18, y - 18);
      rings.push({ g, e, p, x, y, i, link, u, phase: (i * 0.37) % 1 });
    }
    // knowledge network at the centre (deterministic)
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const nodes = [];
    const kinds = ['paper', 'workflow', 'note'];
    for (let i = 0; i < 60; i++) {
      const r = 80 + Math.sqrt(rnd()) * 230, a = rnd() * Math.PI * 2;
      nodes.push({ x: C.x + r * Math.cos(a) * 1.6, y: C.y - 20 + r * Math.sin(a) * 0.75, kind: kinds[i % 3], d: i / 60 });
    }
    const edges = [];
    nodes.forEach((n, i) => {
      const near = nodes.map((m, j) => ({ j, dd: (m.x - n.x) ** 2 + (m.y - n.y) ** 2 })).filter(o => o.j !== i).sort((p, q) => p.dd - q.dd).slice(0, 2);
      for (const o of near) if (o.j > i) edges.push({ a: n, b: nodes[o.j], d: Math.max(n.d, nodes[o.j].d) });
    });
    const eEls = edges.map(e => sv('line', { x1: e.a.x, y1: e.a.y, x2: e.b.x, y2: e.b.y, stroke: '#9aa3b0', 'stroke-width': 2 }, svg));
    const nEls = nodes.map(n => {
      if (n.kind === 'paper') return sv('circle', { cx: n.x, cy: n.y, r: 10, fill: '#ffffff', stroke: '#171b23', 'stroke-width': 3 }, svg);
      if (n.kind === 'workflow') return sv('rect', { x: n.x - 9, y: n.y - 9, width: 18, height: 18, fill: BLUE, transform: `rotate(45 ${n.x} ${n.y})` }, svg);
      return sv('rect', { x: n.x - 8, y: n.y - 8, width: 16, height: 16, fill: '#525a68' }, svg);
    });
    const hub = markAt(layer, C.x, C.y, 120);
    const plate = h('div', 'abs', layer);
    plate.className = 'face small';
    plate.innerHTML = '<span class="h2" style="font-size:50px">KIGAM Second brain</span>';
    Object.assign(plate.style, { padding: '14px 36px', whiteSpace: 'nowrap' });
    box(plate, 0, C.y + 74);
    const legend = h('div', 'abs', layer);
    Object.assign(legend.style, { left: '110px', top: '980px', display: 'flex', gap: '40px', alignItems: 'center' });
    legend.innerHTML = [
      ['<svg width="26" height="26"><circle cx="13" cy="13" r="9" fill="#fff" stroke="#171b23" stroke-width="3"/></svg>', '논문'],
      [`<svg width="26" height="26"><rect x="5" y="5" width="16" height="16" fill="${BLUE}" transform="rotate(45 13 13)"/></svg>`, 'Workflow'],
      ['<svg width="26" height="26"><rect x="5" y="5" width="16" height="16" fill="#525a68"/></svg>', '연구노트'],
    ].map(([sym, l]) => `<span style="display:flex;align-items:center;gap:12px">${sym}<span class="label" style="font-size:28px;color:var(--ink)">${l}</span></span>`).join('');
    return t => {
      const o = win(t, A, B, 0.45, 0.4);
      put(layer, { o });
      if (o <= 0) return;
      head(t);
      put(tag, { o: ramp(t, 92.3, 92.8, lin) });
      const gather = ramp(t, 96.0, 97.6, inOut);
      for (const r of rings) {
        const f = ramp(t, 92.3 + r.i * 0.22, 92.9 + r.i * 0.22);
        r.g.setAttribute('opacity', f);
        put(r.u, { o: f });
        const lap = (t - 92.3) / 2.2 + r.phase;
        const a = lap * Math.PI * 2;
        r.p.setAttribute('cx', r.x + 92 * Math.cos(a));
        r.p.setAttribute('cy', r.y + 52 * Math.sin(a));
        const lf = ramp(t, 94.0 + r.i * 0.12, 94.9 + r.i * 0.12, inOut);
        r.link.setAttribute('x2', lerp(r.x, C.x, lf));
        r.link.setAttribute('y2', lerp(r.y, C.y, lf));
        r.link.setAttribute('stroke', lf >= 1 ? BLUE : '#9aa3b0');
        r.e.setAttribute('stroke', lf >= 1 ? BLUE : '#9aa3b0');
        r.link.setAttribute('opacity', 1 - 0.6 * gather);
      }
      const gi = ramp(t, 93.6, 94.4);
      hub.set({ ringF: ramp(t, 93.4, 94.4, inOut), gO: gi, gS: lerp(0.8, 1, gi), lettersF: 0 });
      const grow = ramp(t, 95.0, 99.0, lin);
      nEls.forEach((el, i) => el.setAttribute('opacity', clamp((grow - nodes[i].d) * 8)));
      eEls.forEach((el, i) => {
        const f = clamp((grow - edges[i].d) * 8 - 0.4);
        el.setAttribute('opacity', f);
        el.setAttribute('stroke', grow > 0.9 ? '#7d8ba3' : '#9aa3b0');
      });
      plate.style.left = `${C.x - plate.offsetWidth / 2}px`;
      put(plate, { o: ramp(t, 97.4, 98.0, lin), y: 14 * (1 - ramp(t, 97.4, 98.2)) });
      put(legend, { o: ramp(t, 95.6, 96.1, lin) });
    };
  });

  // ---------- S5 closing 100.2–105 ----------
  scenes.push(() => {
    const A = 100.2;
    const layer = h('div', 'layer');
    const L = lockup(layer, 280);
    L.svg.style.left = `${960 - L.width / 2}px`;
    L.svg.style.top = '300px';
    const sub = text(layer, 'h2', 0, 660, '지구과학 연구자를 위한 AI agent 작업 공간', { width: '1920px', textAlign: 'center', fontSize: '50px', fontWeight: 600, color: 'var(--ink-2)' });
    const tag = text(layer, 'small', 0, 1000, '내부 검토용 영상', { width: '1840px', textAlign: 'right' });
    return t => {
      const o = ramp(t, A, A + 0.6, lin);
      put(layer, { o });
      if (o <= 0) return;
      const gi = ramp(t, A + 0.2, A + 1.0);
      L.set({ ringF: ramp(t, A, A + 1.2, inOut), gO: gi, gS: lerp(0.85, 1, gi), lettersF: ramp(t, A + 0.8, A + 1.7, inOut) });
      put(sub, { o: ramp(t, A + 1.6, A + 2.2, lin), y: 14 * (1 - ramp(t, A + 1.6, A + 2.4)) });
      put(tag, { o: ramp(t, A + 2.0, A + 2.6, lin) });
    };
  });

  // ---------- film position bar (no text; chapter ticks only) ----------
  function buildScale() {
    const TICKS = [20, ...CHAPTERS_V2.map(c => c.a), 92, 100.2];
    const layer = h('div', 'layer');
    const svg = sv('svg', { width: 1920, height: 1080 }, layer);
    const x0 = 0, x1 = 1920, y = 1077, a = 5, b = 100.2;
    const sx = t => lerp(x0, x1, (t - a) / (b - a));
    sv('line', { x1: x0, x2: x1, y1: y, y2: y, stroke: '#d5dae1', 'stroke-width': 6 }, svg);
    for (const t of TICKS) sv('line', { x1: sx(t), x2: sx(t), y1: y - 12, y2: y + 3, stroke: '#878f9d', 'stroke-width': 2 }, svg);
    const fill = sv('line', { x1: x0, x2: x0, y1: y, y2: y, stroke: BLUE, 'stroke-width': 6 }, svg);
    return t => {
      put(layer, { o: win(t, 5.0, 100.4, 0.6, 0.6) });
      fill.setAttribute('x2', sx(clamp(t, a, b)));
    };
  }

  // ---------- init ----------
  async function init() {
    const names = ['file-text', 'code-xml', 'folder-open', 'notebook-pen', 'book-open', 'git-branch', 'server', 'map', 'database', 'table-2', 'quote', 'users', 'message-square-text', 'well-log', 'map-gis',
      'library', 'network', 'building-2', 'share-2', 'workflow', 'user', 'users-round', 'search'];
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
      duration: DURATION,
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
