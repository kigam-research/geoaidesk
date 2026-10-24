/* GAID promo film v5 (~100 s, direction v5 in docs/tasks/gaid-promo-video-v5.md). Deterministic: window.motion.frame(t) draws film second t.
 * Footage from PROMO_CAPTURE: the v3 takes (Pocheon PGI study) and the v5 takes (Yilgarn nickel MPM example), merged by
 * render.py with patterns prefixed v3/ and v5/. The cycle, second-brain and closing scenes keep their v2 clock; timed() maps
 * each scene onto its slot, and the demo length (and so everything after it) follows the capture frame counts.
 * v4 (user feedback 2026-10-24): no on-screen "개념도" tag; background as motion graphics; each demo chapter leads with its
 * purpose and the part of GAID (시스템 / 허브) that carries it, one outcome tag per step.
 * v5 (user feedback 2026-10-24 on v4): examples chosen per step (PGI and Yilgarn); highlight frames are whole UI regions;
 * the real screens are windows inside the motion design, with lifted detail windows and side-by-side pairs.
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
  // ================= scenes =================
  const scenes = [];
  // Run a scene written on its own clock [srcA, srcB] inside the film slot [dstA, dstB] (linear time map).
  const timed = (src, dst, build) => scenes.push(() => {
    const draw = build();
    const k = (src[1] - src[0]) / (dst[1] - dst[0]);
    return t => draw(src[0] + (t - dst[0]) * k);
  });

  // S1 opening (v2 clock 0–5.2)
  const SLOT = { opening: [0, 4.4], background: [4.1, 19.4], cycle: [19.1, 27.3] };
  timed([0, 5.2], SLOT.opening, () => {
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
    const sub = text(layer, 'h2', 0, 700, '지구과학 연구자를 위한 AI agent 연구 지원 플랫폼', { width: '1920px', textAlign: 'center', fontSize: '50px', fontWeight: 600, color: 'var(--ink-2)' });
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


  // ================= timeline v5 (direction v5, task document) =================
  // The demo is a window stage (user feedback 2026-10-24): the real screen is a framed window inside the motion design,
  // with an example chip (포천 자철석 PGI / Yilgarn 니켈 MPM). Each step frames one whole UI region on the window and, when
  // that gains legibility, lifts the same original pixels out into an enlarged detail window beside it. Pair steps put
  // the two examples side by side. Frames are never zoomed or panned inside the window.
  // Highlight rects are whole UI regions: v5 takes carry DOM-measured beat rects (capture-v5); for the v3 takes the rects
  // below were re-derived from the frames along panel/card edges and checked on drawn frames (frame_check.py).
  const R = (x, y, w, hh) => ({ x, y, width: w, height: hh });
  const V3 = {
    l1Table: R(260, 374, 636, 267), // L1: the folder's paper table
    l2Pdf: R(650, 116, 606, 576), // L2: PDF side panel
    a1Rows: R(428, 207, 672, 274), // A1: two library papers, the code and two data files (five whole rows)
    a2Evidence: R(732, 213, 524, 418), // A2: evidence viewer panel
    a2Option: R(272, 412, 432, 124), // A2: the recommended option card
    a3Rail: R(272, 180, 272, 234), // A3: four-stage rail
    h1Version: R(334, 104, 606, 206), // H1: next-version fieldset with its helper line
    h1Dialog: R(320, 54, 640, 614), // H1: the whole register dialog (shared files list scrolls inside it)
    r3Chat: R(662, 120, 566, 234), // R3: the AI agent's message and its five tool rows below it
    r3Figure: R(48, 151, 542, 553), // R3: the saved 3D comparison figure in the file viewer
    m1Raster: R(344, 390, 256, 223), // M1: the GeoTIFF's extent on the map
    m1Popup: R(482, 532, 288, 81), // M1: original pixel value popup
    n1Cites: R(4, 246, 628, 348), // N1: three cited paragraphs
    n1Decision: R(16, 250, 606, 339), // N1: decision card with options and the send button
    l5Nodes: R(228, 312, 728, 248), // L5: all five connection-map nodes
  };
  const BR = (id, k) => { const i = shotInfo(id); return i && i.beats && i.beats[k] ? i.beats[k].rect : null; };
  const EX = { pgi: { label: '예제 · 포천 자철석 PGI', icon: 'map' }, yil: { label: '예제 · Yilgarn 니켈 MPM', icon: 'map-gis' } };
  const SHOT_TARGET = { Y1: 4.5, Y2: 5, Y3: 6, Y4: 5, Y5: 5, Y6: 6, Y7: 4.5 };
  // A step: one shot (or a pair) played over `use` (shot seconds); beats in step-local seconds [t0, t1, rect(), tag].
  const S = (shot, ex, use, beats) => ({ shot, ex, use, beats });
  const CHAPTERS_DEF = [
    { st: 0, part: 'GAID 시스템', title: '연구는 내 서재의 논문에서 시작합니다', steps: [
      S('L1', 'pgi', [0, 2.4], [[0.3, 2.4, () => V3.l1Table, '주제별 폴더에 모은 논문']]),
      S('L2', 'pgi', [0.3, 3.9], [[0.2, 3.6, () => V3.l2Pdf, '논문을 곁에 두고 읽기']]),
    ] },
    { st: 1, part: 'GAID 허브', title: '논문 속 방법을 AI agent가 따르는 Workflow로 만듭니다', steps: [
      S('A1', 'pgi', [0, 4.2], [[0.3, 4.2, () => V3.a1Rows, '논문·코드·자료를 함께']]),
      S('A2', 'pgi', [0, 5], [[0.3, 2.5, () => V3.a2Evidence, '원문 근거를 바로 곁에'], [2.5, 5, () => V3.a2Option, '근거를 보고 연구자가 결정']]),
      S('A3', 'pgi', [0, 2], [[0.2, 2, () => V3.a3Rail, '단계로 정리된 분석 절차']]),
    ] },
    { st: 2, part: 'GAID 허브', title: '만든 Workflow는 허브에서 함께 쓰고 고쳐 갑니다', steps: [
      S('H1', 'pgi', [0, 3], [[0.3, 1.5, () => V3.h1Version, '다음 version으로 등록'], [1.5, 3, () => V3.h1Dialog, '예제 자료와 함께 공유']]),
      S('Y1', 'yil', [0, 4.5], [[0.3, 2.2, () => BR('Y1', 0), '연구자들이 올린 Workflow'], [2.2, 4.5, () => BR('Y1', 1), '분야별 폴더에서 찾기']]),
      S('Y2', 'yil', [0, 4.2], [[0.3, 2.1, () => BR('Y2', 0), '내 프로젝트에서 바로 시험'], [2.1, 4.2, () => BR('Y2', 1), '단계를 먼저 읽어 보기']]),
    ] },
    { st: 3, part: 'GAID 시스템', title: '공유된 Workflow로 내 자료를 분석합니다', steps: [
      S('Y3', 'yil', [0, 6], [[0.3, 2.1, () => BR('Y3', 0), '내 자료로 시작 설정'], [2.1, 4.1, () => BR('Y3', 1), '단계마다 자료와 조건'], [4.1, 6, () => BR('Y3', 2), '시작 전에 요약 확인']]),
      S('R3', 'pgi', [2, 6], [[0.2, 2, () => V3.r3Chat, 'AI agent가 Workflow대로'], [2, 4, () => V3.r3Figure, '결과 그림까지 저장']]),
      { pair: [S('Y5', 'yil', [0, 4.8], [[0.3, 2.4, () => BR('Y5', 0)], [2.4, 4.8, () => BR('Y5', 1)]]),
        S('M1', 'pgi', [0.8, 4.6], [[0.3, 2.4, () => V3.m1Raster], [2.4, 3.8, () => V3.m1Popup]])],
      tags: [[0.3, 2.4, '원본 좌표 그대로 지도에'], [2.4, 4.8, '원본 값을 바로 확인']] },
    ] },
    { st: 4, part: 'GAID 시스템', title: '결과와 판단은 연구노트에 남습니다', steps: [
      S('Y6', 'yil', [0, 5.5], [[0.3, 2.6, () => BR('Y6', 0), '결과부터 쓴 연구노트'], [2.6, 5.5, () => BR('Y6', 1), '지도 그림까지 노트에']]),
      S('N1', 'pgi', [3, 6.5], [[0.1, 1.5, () => V3.n1Cites, '두 논문의 쪽수까지 인용'], [1.5, 3.5, () => V3.n1Decision, '판단은 연구자가 답합니다']]),
    ] },
    { st: 0, back: true, part: 'GAID 시스템', title: '연구가 서재로 돌아와 다음 연구로 이어집니다', steps: [
      S('Y7', 'yil', [0, 4.5], [[0.3, 2.2, () => BR('Y7', 0), '분야별 폴더의 논문'], [2.2, 4.5, () => BR('Y7', 1), '논문에서 이어진 연구 이력']]),
      S('L5', 'pgi', [0, 3.5], [[0.3, 3.5, () => V3.l5Nodes, '논문·Workflow·노트의 연결']]),
    ] },
  ];
  const STEP_GAP = 0.35; // consecutive steps overlap while one window leaves and the next arrives
  const shotLen = (id, use) => {
    const info = shotInfo(id);
    const full = info ? info.frames / FPS : SHOT_TARGET[id] || 4;
    return Math.max(0.5, Math.min(use[1], full) - use[0]);
  };
  const SEG = [];
  const CHAPTERS = [];
  {
    let at = SLOT.cycle[1] + 0.05;
    for (const c of CHAPTERS_DEF) {
      const steps = [];
      for (const s of c.steps) {
        const dur = s.pair ? Math.max(...s.pair.map(p => shotLen(p.shot, p.use))) : shotLen(s.shot, s.use);
        const step = { ...s, a: at, b: at + dur, dur, ch: CHAPTERS.length };
        steps.push(step);
        SEG.push(step);
        at += dur - STEP_GAP;
      }
      CHAPTERS.push({ ...c, steps, a: steps[0].a, b: steps[steps.length - 1].b });
    }
  }
  const DEMO = { a: CHAPTERS[0].a, b: CHAPTERS[CHAPTERS.length - 1].b };
  SLOT.brain = [DEMO.b - 0.25, DEMO.b - 0.25 + 7.8];
  SLOT.closing = [SLOT.brain[1] - 0.3, SLOT.brain[1] - 0.3 + 4.3];
  const DURATION = Math.ceil(SLOT.closing[1]);
  const STATIONS = [
    { icon: 'library', label: '내 서재' },
    { icon: 'file-text', label: 'Workflow 만들기' },
    { icon: 'share-2', label: 'GAID 허브 공유' },
    { icon: 'orbit', label: '연구 분석' },
    { icon: 'notebook-pen', label: '연구노트' },
  ];
  const stationIcon = (st, size, color) => (st.icon === 'orbit'
    ? `<span class="icon" style="width:${size * 1.5}px;height:${size}px;color:${color}">${ORBIT_ICON(size)}</span>`
    : icon(st.icon, size, color));

  // ---------- S2 background (local clock 0–15.3): the researcher's work, scattered tools, gathered by GAID ----------
  // v4 (user feedback 2026-10-24): the graphics carry the story, one short caption per phase, no "개념도" tag.
  // Skill and tool names are real (K-Dense scientific agent skills, KIGAM skills in GAID's catalogue, the Heo et al.
  // supplementary script); nothing is counted.
  timed([0, 15.3], SLOT.background, () => {
    const layer = h('div', 'layer');
    const svg = sv('svg', { width: 1920, height: 1080 }, layer);
    svg.style.position = 'absolute';
    const head = headline(layer, 110, 64, [
      [0.2, 5.1, '자료를 찾고, 논문을 읽고, 코드를 짭니다'],
      [5.4, 10.3, '쓸 만한 스킬과 도구는 곳곳에 흩어져 있습니다'],
      [10.6, 15.2, 'GAID가 한곳에 모아 연구를 돕습니다'],
    ]);
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const GREY = '#c3c9d2', INK2 = '#525a68', INK3 = '#878f9d';

    // --- three work vignettes (500×380 cards) ---
    const CW = 500, CH = 380;
    function card(ic, title) {
      const el = h('div', 'face', layer);
      box(el, 0, 0, CW, CH);
      el.innerHTML = `<div style="position:absolute;left:28px;top:22px;display:flex;align-items:center;gap:14px">${icon(ic, 40, 'var(--ink)')}<span class="h3" style="font-size:36px">${title}</span></div>`;
      const g = sv('svg', { width: CW, height: CH - 80 }, el);
      Object.assign(g.style, { position: 'absolute', left: '0px', top: '80px' });
      return { el, g };
    }
    // 자료 조사: contour map with survey points popping in, a well-log curve drawing down
    const c1 = card('map', '자료 조사');
    {
      const g = c1.g;
      sv('rect', { x: 24, y: 6, width: 290, height: 270, rx: 6, fill: '#f6f7f9', stroke: '#dce0e6' }, g);
      for (let k = 0; k < 4; k++) {
        const pts = [];
        for (let a = 0; a <= 360; a += 15) {
          const r = 30 + k * 26 + 7 * Math.sin((a * Math.PI) / 60 + k);
          pts.push(`${(170 + r * 1.25 * Math.cos((a * Math.PI) / 180)).toFixed(1)} ${(140 + r * 0.9 * Math.sin((a * Math.PI) / 180)).toFixed(1)}`);
        }
        sv('path', { d: `M ${pts.join(' L ')} Z`, fill: 'none', stroke: GREY, 'stroke-width': 2 }, g);
      }
      c1.pts = [];
      for (let k = 0; k < 14; k++) {
        const x = 44 + rnd() * 250, y = 24 + rnd() * 232;
        c1.pts.push({ el: sv('rect', { x: x - 7, y: y - 7, width: 14, height: 14, fill: k % 3 ? INK2 : BLUE, transform: `rotate(45 ${x} ${y})` }, g), at: 0.5 + k * 0.26 });
      }
      sv('line', { x1: 340, x2: 476, y1: 6, y2: 6, stroke: '#dce0e6', 'stroke-width': 2 }, g);
      sv('line', { x1: 352, x2: 352, y1: 6, y2: 276, stroke: INK3, 'stroke-width': 2 }, g);
      const curve = [];
      for (let y = 8; y <= 276; y += 4) curve.push(`${(410 + 34 * Math.sin(y * 0.07) + 18 * Math.sin(y * 0.21 + 1)).toFixed(1)} ${y}`);
      c1.log = sv('path', { d: `M ${curve.join(' L ')}`, fill: 'none', stroke: BLUE, 'stroke-width': 3, pathLength: 1, 'stroke-dasharray': '0 1' }, g);
    }
    // 문헌 분석: a growing stack of pages, a highlight sweeping lines, a quote pulled out
    const c2 = card('book-open', '문헌 분석');
    {
      const g = c2.g;
      c2.pages = [0, 1, 2].map(k => {
        const pg = sv('g', {}, g);
        sv('rect', { x: 40 + k * 22, y: 22 - k * 8, width: 220, height: 254, rx: 4, fill: '#ffffff', stroke: '#c9ced6', 'stroke-width': 2 }, pg);
        return pg;
      });
      const top = c2.pages[2];
      c2.lines = [];
      for (let k = 0; k < 9; k++) {
        const w = [170, 150, 176, 120, 168, 158, 176, 110, 140][k];
        const y = 30 + k * 25;
        const hl = sv('rect', { x: 94, y: y - 5, width: 0, height: 16, fill: '#e8eeff' }, top);
        sv('rect', { x: 100, y, width: w, height: 7, rx: 3, fill: k === 0 ? INK2 : GREY }, top);
        c2.lines.push({ hl, w });
      }
      c2.quote = sv('g', {}, g);
      sv('rect', { x: 320, y: 90, width: 156, height: 110, rx: 6, fill: '#ffffff', stroke: BLUE, 'stroke-width': 2.5 }, c2.quote);
      sv('text', { x: 336, y: 136, 'font-size': 44, 'font-weight': 700, fill: BLUE }, c2.quote).textContent = '“';
      sv('rect', { x: 368, y: 118, width: 92, height: 7, rx: 3, fill: INK2 }, c2.quote);
      sv('rect', { x: 340, y: 146, width: 120, height: 7, rx: 3, fill: GREY }, c2.quote);
      sv('rect', { x: 340, y: 168, width: 86, height: 7, rx: 3, fill: GREY }, c2.quote);
    }
    // 코드 작성: lines typed token by token, a run bar, one failing line and a retry
    const c3 = card('code-xml', '코드 작성');
    {
      const g = c3.g;
      sv('rect', { x: 24, y: 6, width: 452, height: 232, rx: 6, fill: '#f6f7f9', stroke: '#dce0e6' }, g);
      c3.lines = [];
      const shapes = [[60, 90, 40], [30, 120, 70, 50], [30, 60, 140], [30, 80, 60, 90], [60, 110], [30, 70, 50, 80], [60, 130]];
      shapes.forEach((toks, k) => {
        const y = 24 + k * 30;
        const err = sv('rect', { x: 26, y: y - 9, width: 448, height: 26, fill: '#fdf1dc', opacity: 0 }, g);
        sv('text', { x: 40, y: y + 9, 'font-size': 18, 'font-weight': 500, fill: INK3 }, g).textContent = String(k + 1);
        let x = 72;
        const els = toks.map((w, j) => {
          const r = sv('rect', { x, y, width: w, height: 9, rx: 3, fill: j === 0 && k % 2 ? BLUE : (j % 2 ? INK2 : GREY), opacity: 0 }, g);
          x += w + 12;
          return r;
        });
        c3.lines.push({ els, err, at: 0.5 + k * 0.42 });
      });
      sv('rect', { x: 24, y: 254, width: 452, height: 16, rx: 8, fill: '#e3e6eb' }, g);
      c3.run = sv('rect', { x: 24, y: 254, width: 0, height: 16, rx: 8, fill: BLUE }, g);
      c3.warn = h('div', 'abs', c3.el, icon('triangle-alert', 34, 'var(--warning)'));
      box(c3.warn, 430, 165);
    }
    const cards = [c1, c2, c3];
    const A_POS = [[380, 440], [960, 440], [1540, 440]];
    const B_POS = [[630, 480], [960, 350], [1290, 480]];

    // --- the researcher ---
    const me = h('div', 'abs', layer);
    Object.assign(me.style, { width: '124px', height: '124px', borderRadius: '50%', background: 'var(--face)', border: '3px solid var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' });
    me.innerHTML = icon('user', 62, 'var(--ink)');
    const meLab = text(layer, 'h3', 0, 0, '연구자', { fontSize: '34px', width: '200px', textAlign: 'center' });
    const ME = u => {
      const b = ramp(u, 5.2, 6.2, inOut), c = ramp(u, 10.3, 11.1, inOut);
      return [lerp(lerp(960, 960, b), 250, c), lerp(lerp(860, 690, b), 650, c)];
    };
    // back-and-forth between the three kinds of work (phase A)
    const workLinks = cards.map(() => sv('line', { stroke: GREY, 'stroke-width': 3, 'stroke-dasharray': '8 10' }, svg));
    const pointer = sv('circle', { r: 13, fill: BLUE }, svg);
    const ROUTE = [[0.3, -1], [0.9, 0], [1.6, 0], [2.1, 1], [2.8, 1], [3.3, 2], [4.0, 2], [4.5, 0], [5.0, 1]];

    // --- scattered skills and tools (phase B): far apart, reaching lines stop short ---
    const TOOLS = [
      ['code-xml', 'K-Dense AI 과학 스킬', 'geopandas', 80, 190, -2, 1],
      ['map-gis', 'KIGAM 지구과학 스킬', 'geo-map-and-crs', 1500, 180, 2, 1],
      ['git-branch', 'GitHub 저장소', '저장소마다 따로 설치', 60, 480, 1.5, 1],
      ['file-code', '논문 부록 코드', 'MOESM1_ESM.py', 1540, 470, -1.5, 2],
      ['database', '기관 자료', '지질도 · 시추 자료', 150, 770, -1, 3],
      ['folder-open', '개인 폴더', '분석 노트', 1460, 770, 1.8, 4],
      ['plug', 'agent 도구', 'MCP 서버', 560, 900, 1, 1],
      ['well-log', 'KIGAM 지구과학 스킬', 'well-log-qc-quicklook', 1040, 900, -1.2, 1],
    ].map(([ic, src, name, x, y, rot, shelf], i) => {
      const el = h('div', 'face small', layer);
      Object.assign(el.style, { left: '0px', top: '0px', padding: '16px 24px 18px', whiteSpace: 'nowrap' });
      el.innerHTML = `<div style="display:flex;align-items:center;gap:12px">${icon(ic, 30, 'var(--ink-2)')}<span style="font-size:24px;font-weight:550;color:var(--ink-3)">${src}</span></div>`
        + `<div style="margin-top:8px;font-size:30px;font-weight:650;color:var(--ink)">${name}</div>`;
      const reach = sv('line', { stroke: INK3, 'stroke-width': 3, 'stroke-dasharray': '9 9' }, svg);
      const stub = sv('circle', { r: 7, fill: '#ffffff', stroke: INK3, 'stroke-width': 3 }, svg);
      return { el, x, y, rot, shelf, i, reach, stub, name };
    });

    // --- GAID gathers them (phase C) ---
    const P = { x: 560, y: 196, w: 1300, h: 820 };
    const panel = h('div', 'face', layer);
    box(panel, P.x, P.y, P.w, P.h);
    layer.insertBefore(panel, svg.nextSibling); // under the cards that fly into it
    const mark = markAt(panel, 104, 92, 96);
    text(panel, 'h2', 184, 62, 'GAID', { fontSize: '56px' });
    const SHELVES = [
      ['library', '서재', ['논문', 'PDF']],
      ['code-xml', '스킬과 도구', []],
      ['workflow', 'Workflow', ['논문 속 방법']],
      ['map-gis', '자료와 지도', ['지도', '검층']],
      ['notebook-pen', '연구노트', []],
    ].map(([ic, name, own], i) => {
      const row = h('div', 'abs', panel);
      Object.assign(row.style, { left: '48px', top: `${178 + i * 124}px`, width: `${P.w - 96}px`, height: '100px', display: 'flex', alignItems: 'center', gap: '20px', padding: '0 26px', border: '2px solid var(--edge)', borderRadius: '8px', cornerShape: 'bevel' });
      row.innerHTML = `<span style="flex:none;display:flex">${icon(ic, 40, 'var(--ink-2)')}</span><span class="h3" style="font-size:34px;width:220px;flex:none">${name}</span><span class="pills" style="display:flex;gap:10px;flex-wrap:nowrap"></span>`;
      const pills = row.querySelector('.pills');
      const mk = (label, blue) => {
        const p = h('span', '', pills, label);
        Object.assign(p.style, { fontSize: '22px', fontWeight: 600, padding: '6px 14px', borderRadius: '6px', cornerShape: 'bevel', whiteSpace: 'nowrap', background: blue ? 'var(--signal-tint)' : 'var(--face-2)', color: blue ? 'var(--signal-ink)' : 'var(--ink-2)', border: '1px solid var(--edge)' });
        return p;
      };
      return { row, i, ico: row.querySelector('.icon'), mk, own: own.map(l => mk(l, false)), docked: [] };
    });
    // what flies where: the three kinds of work and every tool card
    // the left-hand tools go first: the researcher moves there as GAID appears
    const LEFT = [0, 2, 4];
    const FLY = [
      ...LEFT.map(i => ({ kind: 'tool', tl: TOOLS[i], shelf: TOOLS[i].shelf })),
      { kind: 'card', k: 1, shelf: 0 }, { kind: 'card', k: 2, shelf: 2 }, { kind: 'card', k: 0, shelf: 3 },
      ...TOOLS.filter(tl => !LEFT.includes(tl.i)).map(tl => ({ kind: 'tool', tl, shelf: tl.shelf })),
    ].map((f, j) => ({ ...f, j }));
    for (const f of FLY) if (f.kind === 'tool') f.pill = SHELVES[f.shelf].mk(f.tl.name.replace('저장소마다 따로 설치', 'GitHub').replace(' · ', '·'), true);
    const join = sv('line', { stroke: BLUE, 'stroke-width': 5, 'stroke-linecap': 'round' }, svg);
    const shelfY = s => P.y + 178 + s * 124 + 50;

    return u => {
      const o = win(u, 0, 15.3, 0.4, 0.4);
      put(layer, { o });
      if (o <= 0) return;
      head(u);
      const [mx, my] = ME(u);
      box(me, mx - 62, my - 62);
      put(me, { o: ramp(u, 0.1, 0.6, lin) });
      me.style.borderColor = u > 13.6 ? BLUE : '#525a68';
      box(meLab, mx - 100, my + 72);
      put(meLab, { o: ramp(u, 0.2, 0.7, lin) });
      const bF = ramp(u, 5.2, 6.2, inOut), cF = ramp(u, 10.4, 11.0, inOut);
      // card placement (A → B cluster → fly into GAID)
      const cardC = k => [lerp(A_POS[k][0], B_POS[k][0], bF), lerp(A_POS[k][1], B_POS[k][1], bF)];
      const fly = f => ramp(u, 10.8 + f.j * 0.2, 11.8 + f.j * 0.2, inOut);
      cards.forEach((c, k) => {
        const [cx, cy] = cardC(k);
        const f = fly(FLY.find(q => q.kind === 'card' && q.k === k));
        const tx = P.x + 640, ty = shelfY(FLY.find(q => q.kind === 'card' && q.k === k).shelf);
        const x = lerp(cx, tx, f), y = lerp(cy, ty, f) - 160 * Math.sin(Math.PI * f);
        const appear = ramp(u, 0.15 + k * 0.2, 0.75 + k * 0.2);
        put(c.el, { o: appear * (1 - ramp(f, 0.75, 0.95, lin)), x: x - CW / 2, y: y - CH / 2 + 20 * (1 - appear), s: lerp(lerp(1, 0.55, bF), 0.2, f) });
      });
      // card animations
      c1.pts.forEach(p => p.el.setAttribute('opacity', ramp(u, p.at, p.at + 0.25, lin)));
      c1.log.setAttribute('stroke-dasharray', `${ramp(u, 0.7, 4.8, lin)} 1`);
      c2.pages.forEach((pg, k) => pg.setAttribute('opacity', ramp(u, 0.3 + k * 0.5, 0.7 + k * 0.5, lin)));
      c2.pages.forEach((pg, k) => pg.setAttribute('transform', `translate(${40 * (1 - ramp(u, 0.3 + k * 0.5, 0.9 + k * 0.5))} 0)`));
      [1, 2, 4, 5].forEach((ln, k) => c2.lines[ln].hl.setAttribute('width', (c2.lines[ln].w + 12) * ramp(u, 1.8 + k * 0.45, 2.2 + k * 0.45, inOut)));
      const q = ramp(u, 3.7, 4.3);
      c2.quote.setAttribute('opacity', q);
      c2.quote.setAttribute('transform', `translate(${-60 * (1 - q)} 0)`);
      c3.lines.forEach((ln, k) => {
        ln.els.forEach((r, j) => r.setAttribute('opacity', ramp(u, ln.at + j * 0.1, ln.at + j * 0.1 + 0.12, lin)));
        const bad = k === 4 && u > 3.9 && u < 4.7;
        ln.err.setAttribute('opacity', bad ? 1 : 0);
      });
      const run = u < 4.7 ? ramp(u, 3.3, 3.9, lin) : ramp(u, 4.8, 5.6, lin);
      c3.run.setAttribute('width', 452 * run);
      c3.run.setAttribute('fill', u > 3.9 && u < 4.7 ? '#8a5300' : BLUE);
      put(c3.warn, { o: u > 3.9 && u < 4.7 ? 1 : 0 });
      // phase A: links and the pointer going back and forth
      cards.forEach((c, k) => {
        const [cx, cy] = cardC(k);
        const s = lerp(1, 0.55, bF);
        const L = workLinks[k];
        L.setAttribute('x1', mx); L.setAttribute('y1', my);
        L.setAttribute('x2', cx); L.setAttribute('y2', cy + (CH / 2) * s);
        L.setAttribute('opacity', ramp(u, 0.4, 0.9, lin) * (1 - cF));
      });
      let px = mx, py = my, active = -1;
      for (let r = 1; r < ROUTE.length; r++) {
        const [t0, a0] = ROUTE[r - 1], [t1, a1] = ROUTE[r];
        if (u < t0 || u > t1) continue;
        const P0 = a0 < 0 ? [mx, my] : (() => { const [cx, cy] = cardC(a0); return [cx, cy + CH / 2]; })();
        const P1 = a1 < 0 ? [mx, my] : (() => { const [cx, cy] = cardC(a1); return [cx, cy + CH / 2]; })();
        const f = inOut((u - t0) / Math.max(0.01, t1 - t0));
        px = lerp(P0[0], P1[0], f); py = lerp(P0[1], P1[1], f);
        active = a0 === a1 ? a1 : -1;
      }
      if (u > ROUTE[ROUTE.length - 1][0]) { const [cx, cy] = cardC(1); px = cx; py = cy + (CH / 2) * lerp(1, 0.55, bF); }
      pointer.setAttribute('cx', px); pointer.setAttribute('cy', py);
      pointer.setAttribute('opacity', ramp(u, 0.3, 0.5, lin) * (1 - ramp(u, 5.4, 5.9, lin)));
      cards.forEach((c, k) => { c.el.style.borderColor = active === k ? BLUE : '#dce0e6'; });
      // phase B: tools appear far apart; the researcher's lines stop short of them
      for (const tl of TOOLS) {
        const ap = ramp(u, 5.6 + tl.i * 0.2, 6.2 + tl.i * 0.2);
        const f = fly(FLY.find(q2 => q2.tl === tl));
        const bob = 6 * Math.sin(u * 1.4 + tl.i * 1.7) * (1 - f);
        const w = tl.el.offsetWidth, hh = tl.el.offsetHeight;
        const sx = tl.x + w / 2, sy = tl.y + hh / 2 + bob;
        const tx = P.x + 640, ty = shelfY(tl.shelf);
        const cx = lerp(sx, tx, f), cy = lerp(sy, ty, f) - 140 * Math.sin(Math.PI * f);
        put(tl.el, { o: ap * (1 - ramp(f, 0.7, 0.92, lin)), x: cx - w / 2, y: cy - hh / 2 + 16 * (1 - ap), s: lerp(1, 0.35, f), r: tl.rot * (1 - f) });
        // reach: grows towards the card, stops at 62 % of the way, hollow end
        const g = ramp(u, 6.6 + tl.i * 0.18, 7.6 + tl.i * 0.18, out) * 0.62;
        const ex = lerp(mx, sx, g), ey = lerp(my, sy, g);
        tl.reach.setAttribute('x1', mx); tl.reach.setAttribute('y1', my);
        tl.reach.setAttribute('x2', ex); tl.reach.setAttribute('y2', ey);
        const ro = ramp(u, 6.6, 6.9, lin) * (1 - ramp(u, 10.2, 10.7, lin));
        tl.reach.setAttribute('opacity', ro);
        tl.stub.setAttribute('cx', ex); tl.stub.setAttribute('cy', ey);
        tl.stub.setAttribute('opacity', ro * ramp(g, 0.5, 0.6, lin));
      }
      // phase C: GAID's shelves take everything in
      const po = ramp(u, 10.6, 11.2);
      put(panel, { o: po, s: lerp(0.96, 1, po) });
      const gi = ramp(u, 10.7, 11.4);
      mark.set({ ringF: ramp(u, 10.6, 11.6, inOut), gO: gi, gS: lerp(0.8, 1, gi), lettersF: 0 });
      for (const s of SHELVES) {
        const f = ramp(u, 10.9 + s.i * 0.12, 11.4 + s.i * 0.12);
        put(s.row, { o: f, x: 24 * (1 - f) });
        s.own.forEach(p => { p.style.opacity = 0; });
      }
      let lit = new Set();
      for (const f of FLY) {
        const v = fly(f);
        if (v > 0.9) lit.add(f.shelf);
        if (f.pill) put(f.pill, { o: ramp(v, 0.85, 1, lin), s: lerp(0.8, 1, ramp(v, 0.85, 1)) });
        if (f.kind === 'card') SHELVES[f.shelf].own.forEach(p => { p.style.opacity = ramp(v, 0.85, 1, lin); });
      }
      for (const s of SHELVES) {
        s.row.style.borderColor = lit.has(s.i) ? BLUE : '#dce0e6';
        s.ico.style.color = lit.has(s.i) ? BLUE : '#525a68';
      }
      // the researcher works through GAID: one solid line
      const jf = ramp(u, 13.0, 13.6, inOut);
      join.setAttribute('x1', mx + 62); join.setAttribute('y1', my);
      join.setAttribute('x2', lerp(mx + 62, P.x, jf)); join.setAttribute('y2', my);
      join.setAttribute('opacity', jf > 0 ? 1 : 0);
    };
  });

  // ---------- S3 the research cycle (v2 clock 19.9–28.25) ----------
  const RING = { cx: 960, cy: 646, rx: 560, ry: 290 };
  timed([19.9, 28.25], SLOT.cycle, () => {
    const A = 19.9, B = 28.25;
    const layer = h('div', 'layer');
    const head = headline(layer, 110, 92, [[20.2, 28.1, '논문과 분석이 공유된 Workflow가 되고, 쓰일수록 나아집니다']]);
    const svg = sv('svg', { width: 1920, height: 1080 }, layer);
    svg.style.position = 'absolute';
    const ell = sv('ellipse', { cx: RING.cx, cy: RING.cy, rx: RING.rx, ry: RING.ry, fill: 'none', stroke: '#9aa3b0', 'stroke-width': 2.5, pathLength: 1, 'stroke-dasharray': '0 1' }, svg);
    // the two parts of GAID on the ring (v4): GAID 허브 holds the shared Workflows, GAID 시스템 the researcher's own work
    const ZONES = [
      { from: -104, to: 22, color: BLUE, title: 'GAID 허브', sub: '함께 쓰고 고쳐 가는 Workflow', at: [1230, 540], tc: 'var(--signal-ink)' },
      { from: 38, to: 240, color: '#525a68', title: 'GAID 시스템', sub: '내 서재에서 분석하고 기록하는 연구', at: [690, 640], tc: 'var(--ink)' },
    ].map(z => {
      const pts = [];
      for (let d = z.from; d <= z.to; d += 2) {
        const a = (d * Math.PI) / 180;
        pts.push(`${(RING.cx + (RING.rx - 40) * Math.cos(a)).toFixed(1)} ${(RING.cy + (RING.ry - 40) * Math.sin(a)).toFixed(1)}`);
      }
      const arc = sv('path', { d: `M ${pts.join(' L ')}`, fill: 'none', stroke: z.color, 'stroke-width': 12, 'stroke-linecap': 'round', opacity: 0, pathLength: 1, 'stroke-dasharray': '0 1' }, svg);
      const lab = h('div', 'abs', layer);
      lab.innerHTML = `<div class="h3" style="font-size:38px;font-weight:700;color:${z.tc}">${z.title}</div><div class="label" style="font-size:26px;margin-top:4px">${z.sub}</div>`;
      Object.assign(lab.style, { textAlign: 'center', whiteSpace: 'nowrap', left: '0px', top: '0px' });
      return { ...z, arc, lab };
    });
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
    // the Workflow's version grows as the loop passes the hub (researcher-facing "version", gaid-hub-versions)
    const pan = h('div', 'plate', layer, '');
    pan.style.fontSize = '30px';
    return t => {
      const o = win(t, A, B, 0.45, 0.35);
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
      ZONES.forEach((z, k) => {
        const f = ramp(t, 22.0 + k * 0.5, 23.0 + k * 0.5, inOut);
        z.arc.setAttribute('stroke-dasharray', `${f} 1`);
        z.arc.setAttribute('opacity', 0.28);
        box(z.lab, z.at[0] - z.lab.offsetWidth / 2, z.at[1] - 40);
        put(z.lab, { o: ramp(t, 22.3 + k * 0.5, 22.9 + k * 0.5, lin) });
      });
      // the loop returning to 내 서재 lights it once more
      if (loop >= 0.999) { st[0].el.style.borderColor = BLUE; }
      const W = st[1];
      const panN = loop >= 0.42 ? 2 : 1;
      pan.textContent = `version 0.1.${panN - 1}`; // the study's real versions: 0.1.0, then the run-learned patch 0.1.1
      box(pan, W.px - pan.offsetWidth / 2, W.py - 150);
      put(pan, { o: ramp(t, 22.6, 23.0, lin), s: loop >= 0.42 ? 1 + 0.12 * (1 - ramp(t, 24.0, 24.4)) : 1 });
    };
  });

  // ---------- demo: purpose line, part of GAID, mini cycle ring, window stage with lifted details ----------
  const BAR = 46; // window chrome bar (example chip)
  const LAY = {
    main: { x: 96, w: 1040 }, // single window, left
    col: { x: 1190, w: 634, top: 170, bottom: 1010 }, // right column: tag + detail window
    pair: [{ x: 48, w: 902 }, { x: 970, w: 902 }],
  };
  LAY.main.k = LAY.main.w / VW;
  LAY.main.h = VH * LAY.main.k + BAR;
  LAY.main.y = 226;
  LAY.pairY = 222;
  const LIFT_MIN = 1.15; // lift only when the detail is at least this much larger than the region on the window
  const PAD = 5; // CSS px kept around a region (whitespace between whole elements)
  function frameSrc(shot, local) {
    const info = shotInfo(shot);
    if (!info) return null;
    const idx = clamp(Math.floor(local * FPS), 0, info.frames - 1);
    return `capture/${info.pattern.replace('%05d', String(idx).padStart(5, '0'))}`;
  }
  function setImg(img, src) {
    if (img.dataset.src === src) return;
    img.dataset.src = src;
    img.src = src;
    pending.push(img.decode().catch(() => {}));
  }
  function mkWin(layer) {
    const el = h('div', 'window', layer);
    const bar = h('div', 'winbar', el);
    const screen = h('div', 'screen', el);
    const img = h('img', '', screen);
    const ph = h('div', 'ph', screen);
    const frame = h('div', 'hl', el);
    return {
      el, frame,
      draw({ x, y, w, o, dx = 0, shot, local, ex }) {
        const k = w / VW, sh = VH * k;
        box(el, x, y, w, sh + BAR);
        put(el, { o, x: dx });
        if (o <= 0.002) return;
        bar.innerHTML = `${icon(EX[ex].icon, 24, 'var(--ink-2)')}<span>${EX[ex].label}</span>`;
        box(screen, 0, BAR, w, sh);
        const src = frameSrc(shot, local);
        if (!src) {
          img.style.display = 'none';
          ph.style.display = 'flex';
          box(ph, 0, 0, w, sh);
          ph.innerHTML = `<div>실제 화면 ${shot}</div><div style="font-size:24px;font-weight:500">촬영본 연결 전 자리</div>`;
          return;
        }
        ph.style.display = 'none';
        img.style.display = 'block';
        setImg(img, src);
        Object.assign(img.style, { width: `${w}px`, height: `${sh}px`, left: '0px', top: '0px' });
      },
      // a whole-region frame on the window; returns its film rect
      mark(r, x, y, w, o) {
        const k = w / VW;
        const fx = (r.x - PAD) * k, fy = BAR + (r.y - PAD) * k, fw = (r.width + 2 * PAD) * k, fh = (r.height + 2 * PAD) * k;
        box(frame, fx - 3, fy - 3, fw + 6, fh + 6);
        put(frame, { o });
        return { x: x + fx, y: y + fy, w: fw, h: fh };
      },
    };
  }
  function mkDetail(layer) {
    const el = h('div', 'detail', layer);
    const img = h('img', '', el);
    return {
      el,
      draw({ from, to, f, o, shot, local, r }) {
        const x = lerp(from.x, to.x, f), y = lerp(from.y, to.y, f), w = lerp(from.w, to.w, f), hh = lerp(from.h, to.h, f);
        box(el, x, y, w, hh);
        put(el, { o });
        if (o <= 0.002) return;
        const src = frameSrc(shot, local);
        if (!src) { img.style.display = 'none'; return; }
        img.style.display = 'block';
        setImg(img, src);
        const s = w / (r.width + 2 * PAD);
        Object.assign(img.style, { width: `${VW * s}px`, height: `${VH * s}px`, left: `${-(r.x - PAD) * s}px`, top: `${-(r.y - PAD) * s}px` });
      },
    };
  }
  scenes.push(() => {
    const layer = h('div', 'layer');
    // mini cycle ring at the top right: the same five stations as the big ring, the GAID 허브 arc tinted
    const MR = { cx: 1716, cy: 54, rx: 88, ry: 34 };
    const msvg = sv('svg', { width: 1920, height: 108 }, layer);
    msvg.style.position = 'absolute';
    const ept = (deg, d = 0) => { const a = (deg * Math.PI) / 180; return [MR.cx + (MR.rx - d) * Math.cos(a), MR.cy + (MR.ry - d) * Math.sin(a)]; };
    sv('ellipse', { cx: MR.cx, cy: MR.cy, rx: MR.rx, ry: MR.ry, fill: 'none', stroke: '#c9ced6', 'stroke-width': 3 }, msvg);
    {
      const pts = [];
      for (let d = -112; d <= 26; d += 4) pts.push(ept(d).map(v => v.toFixed(1)).join(' '));
      sv('path', { d: `M ${pts.join(' L ')}`, fill: 'none', stroke: BLUE, 'stroke-width': 7, opacity: 0.3, 'stroke-linecap': 'round' }, msvg);
    }
    const MSTART = -150;
    const mdots = STATIONS.map((s, i) => {
      const [x, y] = ept(MSTART + i * 72);
      return sv('rect', { x: x - 7, y: y - 7, width: 14, height: 14, fill: '#ffffff', stroke: '#878f9d', 'stroke-width': 3, transform: `rotate(45 ${x} ${y})` }, msvg);
    });
    const mpoint = sv('circle', { r: 9, fill: BLUE }, msvg);
    const mlogo = markAt(layer, MR.cx, MR.cy, 34);
    mlogo.set({ ringF: 1, gO: 1, gS: 1, lettersF: 0 });
    // header: part plate + purpose line per chapter
    const titles = CHAPTERS.map(c => {
      const g = h('div', 'abs', layer);
      Object.assign(g.style, { left: '112px', top: '28px', display: 'flex', alignItems: 'center', gap: '20px', whiteSpace: 'nowrap' });
      const hub = c.part === 'GAID 허브';
      g.innerHTML = `<span style="font-size:28px;font-weight:700;padding:6px 16px;border-radius:6px;corner-shape:bevel;background:${hub ? 'var(--signal-tint)' : 'var(--face)'};color:${hub ? 'var(--signal-ink)' : 'var(--ink)'};border:2px solid ${hub ? BLUE : 'var(--control-edge)'}">${c.part}</span>`
        + `<span class="h2" style="font-size:42px">${c.title}</span>`;
      return { el: g, c };
    });
    // windows: two singles (crossfading steps) and a pair
    const wins = [mkWin(layer), mkWin(layer)];
    const pairWins = [mkWin(layer), mkWin(layer)];
    const links = sv('svg', { width: 1920, height: 1080 }, layer);
    links.style.position = 'absolute';
    const linkA = sv('line', { stroke: BLUE, 'stroke-width': 2 }, links);
    const linkB = sv('line', { stroke: BLUE, 'stroke-width': 2 }, links);
    const details = [mkDetail(layer), mkDetail(layer)];
    const tagBox = h('div', 'abs', layer);
    Object.assign(tagBox.style, { width: `${LAY.col.w}px`, display: 'flex', alignItems: 'center', gap: '18px' });
    const tagIcon = h('span', '', tagBox);
    const tagText = h('span', 'tag-text', tagBox);
    const pairTag = text(layer, 'tag-text', 0, 0, '', { width: '1920px', textAlign: 'center' });
    const beatAt = (step, lt) => {
      const bs = step.beats.map(([t0, t1, rect, label]) => ({ t0, t1, r: rect(), label })).filter(b => b.r);
      return bs.find(b => lt >= b.t0 && lt < b.t1) || null;
    };
    return t => {
      const o = win(t, DEMO.a - 0.05, DEMO.b + 0.05, 0.45, 0.4);
      put(layer, { o });
      if (o <= 0) return;
      const ci = CHAPTERS.findIndex(c => t >= c.a - 0.05 && t < c.b - 0.05);
      const cur = CHAPTERS[ci === -1 ? CHAPTERS.length - 1 : ci];
      const prev = CHAPTERS[Math.max(0, (ci === -1 ? CHAPTERS.length - 1 : ci) - 1)];
      titles.forEach(({ el, c }) => put(el, { o: win(t, c.a, c.b, 0.35, 0.25), y: 12 * (1 - ramp(t, c.a, c.a + 0.6)) }));
      const toDeg = MSTART + (cur.back ? 5 : cur.st) * 72;
      const fromDeg = cur === CHAPTERS[0] ? toDeg : MSTART + (prev.back ? 5 : prev.st) * 72;
      const mv = ramp(t, cur.a, cur.a + 0.8, inOut);
      const [px, py] = ept(lerp(fromDeg, toDeg, mv));
      mpoint.setAttribute('cx', px); mpoint.setAttribute('cy', py);
      mdots.forEach((d, i) => {
        const active = i === (cur.back ? 0 : cur.st) && mv >= 1;
        d.setAttribute('fill', active ? BLUE : '#ffffff');
        d.setAttribute('stroke', active ? BLUE : '#878f9d');
      });
      // active steps (at most two overlap); the later one is drawn on top
      const live = SEG.filter(s => t >= s.a && t <= s.b);
      let wi = 0;
      for (const w of wins) w.draw({ o: 0 });
      for (const w of pairWins) w.draw({ o: 0 });
      for (const w of [...wins, ...pairWins]) put(w.frame, { o: 0 });
      for (const d of details) d.draw({ from: { x: 0, y: 0, w: 1, h: 1 }, to: { x: 0, y: 0, w: 1, h: 1 }, f: 0, o: 0 });
      linkA.setAttribute('opacity', 0); linkB.setAttribute('opacity', 0);
      put(tagBox, { o: 0 }); put(pairTag, { o: 0 });
      let di = 0;
      for (const s of live) {
        const lt = t - s.a;
        const enter = ramp(lt, 0, 0.55), leave = ramp(t, s.b - 0.4, s.b, lin);
        const so = Math.min(ramp(lt, 0, 0.4, lin), 1 - leave);
        const dx = 70 * (1 - enter) - 50 * leave;
        if (s.pair) {
          s.pair.forEach((p, k) => {
            const L = LAY.pair[k];
            const W = pairWins[k];
            const ddx = k === 0 ? -dx : dx;
            W.draw({ x: L.x, y: LAY.pairY, w: L.w, o: so * ramp(lt, k * 0.15, k * 0.15 + 0.4, lin), dx: ddx, shot: p.shot, local: p.use[0] + lt, ex: p.ex });
            const b = beatAt(p, lt);
            if (b) W.mark(b.r, L.x, LAY.pairY, L.w, so * Math.min(ramp(lt, b.t0, b.t0 + 0.3, lin), 1 - ramp(lt, b.t1 - 0.25, b.t1, lin)));
          });
          const tg = s.tags.find(([t0, t1]) => lt >= t0 && lt < t1);
          if (tg) {
            pairTag.textContent = tg[2];
            box(pairTag, 0, LAY.pairY + LAY.pair[0].w * 9 / 16 + BAR + 64, 1920);
            put(pairTag, { o: so * Math.min(ramp(lt, tg[0], tg[0] + 0.35, lin), 1 - ramp(lt, tg[1] - 0.25, tg[1], lin)), y: 10 * (1 - ramp(lt, tg[0], tg[0] + 0.5)) });
          }
          continue;
        }
        const W = wins[wi++ % 2];
        const M = LAY.main;
        W.draw({ x: M.x, y: M.y, w: M.w, o: so, dx, shot: s.shot, local: s.use[0] + lt, ex: s.ex });
        const b = beatAt(s, lt);
        if (!b) continue;
        const bo = so * Math.min(ramp(lt, b.t0, b.t0 + 0.3, lin), 1 - ramp(lt, b.t1 - 0.25, b.t1, lin));
        const fr = W.mark(b.r, M.x + dx, M.y, M.w, bo);
        // detail window: the same pixels, enlarged in the right column when that gains legibility
        const C = LAY.col;
        const rw = b.r.width + 2 * PAD, rh = b.r.height + 2 * PAD;
        const sc = Math.min(C.w / rw, 540 / rh, 1.7);
        const lift = sc >= M.k * LIFT_MIN;
        tagText.textContent = b.label;
        tagIcon.innerHTML = stationIcon(STATIONS[cur.st], 44, BLUE);
        const tagH = 64;
        const cy = fr.y + fr.h / 2;
        if (lift) {
          const D = { w: rw * sc, h: rh * sc };
          D.x = C.x + (C.w - D.w) / 2;
          D.y = clamp(cy - D.h / 2 + tagH / 2, C.top + tagH + 26, C.bottom - D.h);
          const f = ramp(lt, b.t0 + 0.15, b.t0 + 0.7, out);
          const dO = bo * ramp(lt, b.t0 + 0.1, b.t0 + 0.3, lin);
          details[di++ % 2].draw({ from: fr, to: D, f, o: dO, shot: s.shot, local: s.use[0] + lt, r: b.r });
          const lo = dO * ramp(lt, b.t0 + 0.5, b.t0 + 0.8, lin) * 0.7;
          const X = lerp(fr.x, D.x, f), Y = lerp(fr.y, D.y, f), HH = lerp(fr.h, D.h, f);
          linkA.setAttribute('x1', fr.x + fr.w); linkA.setAttribute('y1', fr.y); linkA.setAttribute('x2', X); linkA.setAttribute('y2', Y);
          linkB.setAttribute('x1', fr.x + fr.w); linkB.setAttribute('y1', fr.y + fr.h); linkB.setAttribute('x2', X); linkB.setAttribute('y2', Y + HH);
          linkA.setAttribute('opacity', lo); linkB.setAttribute('opacity', lo);
          box(tagBox, C.x, D.y - tagH - 22);
        } else {
          // a large region: the frame on the window carries it; the tag sits level with it, joined by one line
          const ty = clamp(cy - tagH / 2, C.top, C.bottom - tagH);
          box(tagBox, C.x, ty);
          linkA.setAttribute('x1', fr.x + fr.w); linkA.setAttribute('y1', cy);
          linkA.setAttribute('x2', C.x - 14); linkA.setAttribute('y2', ty + tagH / 2);
          linkA.setAttribute('opacity', bo * ramp(lt, b.t0 + 0.2, b.t0 + 0.5, lin) * 0.7);
        }
        put(tagBox, { o: bo, y: 10 * (1 - ramp(lt, b.t0, b.t0 + 0.5)) });
      }
    };
  });

  // ---------- S4 ecosystem → KIGAM second brain (v2 clock 91.6–100.5, conceptual) ----------
  timed([91.6, 100.5], SLOT.brain, () => {
    const A = 91.6, B = 100.5;
    const layer = h('div', 'layer');
    const head = headline(layer, 110, 92, [
      [91.8, 96.0, '연구자마다 고리가 돌면 지구과학 AI agent 생태계가 자랍니다'],
      [96.2, 100.3, '논문, Workflow, 연구노트가 이어져 KIGAM의 Second brain이 됩니다'],
    ]);
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
      const gather = ramp(t, 96.0, 97.6, inOut);
      for (const r of rings) {
        const f = ramp(t, 91.9 + r.i * 0.22, 92.5 + r.i * 0.22);
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

  // ---------- S5 closing (v2 clock 100.2–104.8) ----------
  timed([100.2, 104.8], SLOT.closing, () => {
    const A = 100.2;
    const layer = h('div', 'layer');
    const L = lockup(layer, 280);
    L.svg.style.left = `${960 - L.width / 2}px`;
    L.svg.style.top = '300px';
    const sub = text(layer, 'h2', 0, 660, '지구과학 연구자를 위한 AI agent 연구 지원 플랫폼', { width: '1920px', textAlign: 'center', fontSize: '50px', fontWeight: 600, color: 'var(--ink-2)' });
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
    const TICKS = [SLOT.cycle[0], ...CHAPTERS.map(c => c.a), SLOT.brain[0], SLOT.closing[0]];
    const layer = h('div', 'layer');
    const svg = sv('svg', { width: 1920, height: 1080 }, layer);
    const x0 = 0, x1 = 1920, y = 1077, a = SLOT.opening[1], b = SLOT.closing[0];
    const sx = t => lerp(x0, x1, (t - a) / (b - a));
    sv('line', { x1: x0, x2: x1, y1: y, y2: y, stroke: '#d5dae1', 'stroke-width': 6 }, svg);
    for (const t of TICKS) sv('line', { x1: sx(t), x2: sx(t), y1: y - 12, y2: y + 3, stroke: '#878f9d', 'stroke-width': 2 }, svg);
    const fill = sv('line', { x1: x0, x2: x0, y1: y, y2: y, stroke: BLUE, 'stroke-width': 6 }, svg);
    return t => {
      put(layer, { o: win(t, a, b + 0.2, 0.6, 0.6) });
      fill.setAttribute('x2', sx(clamp(t, a, b)));
    };
  }

  // ---------- init ----------
  async function init() {
    const names = ['triangle-alert', 'plug', 'file-code', 'file-text', 'code-xml', 'folder-open', 'notebook-pen', 'book-open', 'git-branch', 'server', 'map', 'database', 'table-2', 'quote', 'users', 'message-square-text', 'well-log', 'map-gis',
      'library', 'share-2', 'workflow', 'user'];
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
      stills: {
        '01-opening': 3.7,
        '02-work': lerp(...SLOT.background, 0.27),
        '03-scattered': lerp(...SLOT.background, 0.58),
        '04-gathered': lerp(...SLOT.background, 0.93),
        '05-cycle': lerp(...SLOT.cycle, 0.75),
        // per step: the middle of each beat (box checks), pair steps once per tag
        ...Object.fromEntries(SEG.flatMap((sg, i) => (sg.pair ? sg.tags.map(([t0, t1], j) => [`${String(i + 6).padStart(2, '0')}-${sg.pair.map(p => p.shot).join('')}-${j + 1}`, +(sg.a + (t0 + t1) / 2).toFixed(2)])
          : sg.beats.map(([t0, t1], j) => [`${String(i + 6).padStart(2, '0')}-${sg.shot}-${j + 1}`, +(sg.a + Math.min((t0 + t1) / 2 + 0.5, t1 - 0.3)).toFixed(2)])))),
        [`${String(SEG.length + 6).padStart(2, '0')}-network`]: lerp(...SLOT.brain, 0.4),
        [`${String(SEG.length + 7).padStart(2, '0')}-second-brain`]: lerp(...SLOT.brain, 0.85),
        [`${String(SEG.length + 8).padStart(2, '0')}-closing`]: DURATION - 0.3,
      },
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
