/* GAID promo film v4_brag (100.8 s, plan geo/promo/brag/brag-plan.md): the v4 scenes re-cut to a 100 BPM grid with a soundtrack.
 * Copied from geo/promo/scene/scene.js (v4); changes: the timeline (BEAT/BAR, piecewise slot maps, demo takes in whole beats,
 * the logo lockup moved from the opening to the reveal), hard dips on bar lines, and window.motion.cues for the soundtrack.
 * Deterministic: window.motion.frame(t) draws film second t.
 * Footage and feature tags from PROMO_CAPTURE (capture-v3); demo frames are shown whole at one scale.
 * The cycle, second-brain and closing scenes keep their v2 clock; timed() maps each scene onto its v4 slot, and the demo length
 * (and so everything after it) follows the capture frame counts.
 * v4 (user feedback 2026-10-24): no on-screen "개념도" tag; the report names the illustrative scenes (background, cycle,
 * second brain). The background is motion graphics with one short caption per phase; the demo leads with each chapter's
 * purpose and the part of GAID (시스템 / 허브) that carries it, with one outcome tag per step.
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
  // Run a scene written on its own clock [srcA, srcB] inside the film slot [dstA, dstB] (linear time map).
  // brag: src/dst may list several key points (piecewise-linear), so a scene's own phases land on bar lines.
  const pwMap = (from, to) => x => {
    let i = 0;
    while (i < from.length - 2 && x > from[i + 1]) i++;
    return to[i] + (x - from[i]) * (to[i + 1] - to[i]) / (from[i + 1] - from[i]);
  };
  const timed = (src, dst, build) => {
    const toSrc = pwMap(dst, src);
    scenes.push(() => { const draw = build(); return t => draw(toSrc(t)); });
    return pwMap(src, dst); // scene clock → film second, for the soundtrack cues
  };
  // brag grid: 100 BPM, 4/4; a beat is 18 frames, a bar 72 frames.
  const BEAT = 0.6, BAR = 2.4;
  const bar = n => +(n * BAR).toFixed(4);
  const CUES = []; // soundtrack cues {t, kind, ...}; soundtrack.py snaps them to the eighth-note grid

  // S1 lockup (v2 clock 0–5.2). brag: no longer the opening; it is the reveal after GAID gathers the tools (bars 6–7).
  const SLOT = { background: [0, bar(6)], opening: [bar(6), bar(8)], cycle: [bar(8), bar(11)] };
  const filmOpening = timed([0, 3.2, 5.2], [SLOT.opening[0], SLOT.opening[0] + 1.8, SLOT.opening[1]], () => {
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


  // ================= timeline v4 (direction v4, task document) =================
  // Real-system segments: one shot each, whole app frame at one scale (no zoom, no pan; user feedback 2026-10-23).
  // a/b are film seconds; consecutive shots overlap by 0.1 s. Beats (feature tags) come from capture.json.
  // v4: A4 is left out (its example data still shows in H1 and R2); `use` trims a take to [from, to] shot seconds.
  const SHOT_ORDER = ['L1', 'L2', 'A1', 'A2', 'A3', 'H1', 'H2', 'R1', 'R2', 'R3', 'M1', 'N1', 'L3', 'L4', 'L5'];
  const SHOT_TARGET = { L1: 4.2, L2: 3, A1: 4.8, A2: 4.8, A3: 4.8, H1: 4.2, H2: 3, R1: 4.2, R2: 3.6, R3: 6, M1: 3, N1: 7.2, L3: 3, L4: 3.6, L5: 3 };
  // brag: every take lasts whole beats and every chapter whole bars; `to` beyond the take holds its last frame (A3 +0.8 s, N1 +0.7 s).
  const USE = {
    L1: [0, 4.2], L2: [0.6, 3.6], A1: [0, 4.8], A2: [0, 4.8], A3: [0, 4.8], H1: [0, 4.2], H2: [0.5, 3.5],
    R1: [0, 4.2], R2: [0.8, 4.4], R3: [0, 6.0], M1: [0.8, 3.8], N1: [0, 7.2], L3: [0.5, 3.5], L4: [0, 3.6], L5: [0, 3.0],
  };
  // One outcome tag per step of the story (v4, user feedback 2026-10-24: purpose first, features along the way).
  // Rects come from the capture's beats (CSS px); consecutive entries with the same label glide.
  const BR = (id, k) => { const i = shotInfo(id); return i && i.beats && i.beats[k] ? i.beats[k].rect : null; };
  const UNION = (a, b) => (a && b ? { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.max(a.x + a.width, b.x + b.width) - Math.min(a.x, b.x), height: Math.max(a.y + a.height, b.y + b.height) - Math.min(a.y, b.y) } : a || b);
  const TAGS = {
    L1: [[0.2, 4.2, () => BR('L1', 0), '주제별 폴더에 모은 논문']],
    L2: [[0.6, 3.6, () => BR('L2', 0), '논문을 곁에 두고 읽기']],
    A1: [[0.2, 5, () => UNION(BR('A1', 0), BR('A1', 1)), '논문·코드·자료를 함께']],
    A2: [[0.2, 2.5, () => BR('A2', 0), '원문 근거를 바로 곁에'], [2.5, 5, () => BR('A2', 1), '근거를 보고 연구자가 결정']],
    A3: [[0.2, 4.8, () => UNION(BR('A3', 0), BR('A3', 1)), '단계로 정리된 분석 절차']],
    H1: [[0.2, 1.5, () => BR('H1', 0), '다음 version으로 등록'], [1.5, 3.2, () => BR('H1', 1), '예제 자료와 함께 공유']],
    H2: [[0.2, 3.5, () => BR('H2', 1), '허브에서 가져다 쓰기']],
    R1: [[0.2, 2.4, () => BR('R1', 0), 'Workflow의 목적과 근거'], [2.4, 4.2, () => BR('R1', 1), '근거 논문을 붙여 시작']],
    R2: [[0.8, 2, () => BR('R2', 0), '단계마다 자료와 조건'], [2, 4.4, () => BR('R2', 1), '단계마다 자료와 조건']],
    R3: [[2, 4, () => BR('R3', 1), 'AI agent가 Workflow대로'], [4, 6, () => BR('R3', 2), '결과 그림까지 저장']],
    M1: [[0.8, 2.3, () => BR('M1', 0), '원본 좌표 그대로 지도에'], [2.3, 3.8, () => BR('M1', 1), '원본 값을 바로 확인']],
    N1: [[0.2, 3, () => BR('N1', 1), '결과부터 쓴 연구노트'], [3, 4.5, () => BR('N1', 2), '두 논문의 쪽수까지 인용'], [4.5, 7.2, () => BR('N1', 3), '판단은 연구자가 답합니다']],
    L3: [[0.5, 2, () => BR('L3', 0), '연구노트도 서재에'], [2, 3.5, () => BR('L3', 1), '연구노트도 서재에']],
    L4: [[0.2, 3.6, () => UNION(BR('L4', 0), BR('L4', 1)), '논문에서 이어진 연구 이력']],
    L5: [[0.2, 3.0, () => UNION(BR('L5', 0), BR('L5', 1)), '논문·Workflow·노트의 연결']],
  };
  const SEG = [];
  {
    // brag: back-to-back hard cuts on beats (no overlap); the plan fixes each take's length, held past its end if needed.
    let at = SLOT.cycle[1];
    for (const id of SHOT_ORDER) {
      const [from, to] = USE[id];
      const dur = +(to - from).toFixed(4);
      SEG.push({ shot: id, a: +at.toFixed(4), b: +(at + dur).toFixed(4), skip: from });
      at += dur;
    }
  }
  const STATIONS = [
    { icon: 'library', label: '내 서재' },
    { icon: 'file-text', label: 'Workflow 만들기' },
    { icon: 'share-2', label: 'GAID 허브 공유' },
    { icon: 'orbit', label: '연구 분석' },
    { icon: 'notebook-pen', label: '연구노트' },
  ];
  // Each chapter says what it is for (purpose line) and which part of GAID carries it.
  const CHAPTERS = [
    { st: 0, part: 'GAID 시스템', title: '연구는 내 서재의 논문에서 시작합니다', shots: ['L1', 'L2'] },
    { st: 1, part: 'GAID 허브', title: '논문 속 방법을 AI agent가 따르는 Workflow로 만듭니다', shots: ['A1', 'A2', 'A3'] },
    { st: 2, part: 'GAID 허브', title: '만든 Workflow는 허브에서 함께 쓰고 고쳐 갑니다', shots: ['H1', 'H2'] },
    { st: 3, part: 'GAID 시스템', title: '공유된 Workflow로 내 자료를 분석합니다', shots: ['R1', 'R2', 'R3', 'M1'] },
    { st: 4, part: 'GAID 시스템', title: '결과와 판단은 연구노트에 남습니다', shots: ['N1'] },
    { st: 0, back: true, part: 'GAID 시스템', title: '연구가 서재로 돌아와 다음 연구로 이어집니다', shots: ['L3', 'L4', 'L5'] },
  ].map(c => {
    const segs = SEG.filter(s => c.shots.includes(s.shot));
    return segs.length ? { ...c, a: segs[0].a, b: segs[segs.length - 1].b } : null;
  }).filter(Boolean);
  const DEMO = { a: CHAPTERS[0].a, b: CHAPTERS[CHAPTERS.length - 1].b };
  SLOT.brain = [DEMO.b, DEMO.b + 3 * BAR];
  SLOT.closing = [SLOT.brain[1], SLOT.brain[1] + 2 * BAR];
  const DURATION = +SLOT.closing[1].toFixed(4);
  if (Math.abs(DURATION - bar(42)) > 1e-6) throw new Error(`brag timeline is ${DURATION} s, plan says ${bar(42)} s`);

  const stationIcon = (st, size, color) => (st.icon === 'orbit'
    ? `<span class="icon" style="width:${size * 1.5}px;height:${size}px;color:${color}">${ORBIT_ICON(size)}</span>`
    : icon(st.icon, size, color));

  // ---------- S2 background (local clock 0–15.3): the researcher's work, scattered tools, gathered by GAID ----------
  // v4 (user feedback 2026-10-24): the graphics carry the story, one short caption per phase, no "개념도" tag.
  // Skill and tool names are real (K-Dense scientific agent skills, KIGAM skills in GAID's catalogue, the Heo et al.
  // supplementary script); nothing is counted.
  // brag: phase A (local 0–5.1) → bars 0–2, B (5.1–10.6) → bars 2–4, C (10.6–15.3) → bars 4–6; the panel lands on bar 4.
  const filmBackground = timed([0, 5.1, 10.6, 15.3], [0, bar(2), bar(4), bar(6)], () => {
    const layer = h('div', 'layer');
    const svg = sv('svg', { width: 1920, height: 1080 }, layer);
    svg.style.position = 'absolute';
    const head = headline(layer, 110, 64, [
      [0.1, 5.0, '자료를 찾고, 논문을 읽고, 코드를 짭니다'],
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
      const o = Math.min(1, 1 - ramp(u, 14.9, 15.3, lin));
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
        const appear = ramp(u, k * 0.64, k * 0.64 + 0.45); // brag: one card per beat
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
  const filmCycle = timed([19.9, 28.25], SLOT.cycle, () => {
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

  // ---------- demo: purpose line, part of GAID, mini cycle ring, whole-frame footage, outcome tags ----------
  const FRAME = { x: 112, y: 108, w: 1696 };
  FRAME.k = FRAME.w / VW;
  FRAME.h = VH * FRAME.k;
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
    const main = footageWindow(layer);
    // outcome tags: highlight frame + dim outside + label (all inside the frame box)
    const over = h('div', 'abs', layer);
    Object.assign(over.style, { overflow: 'hidden', borderRadius: '14px', cornerShape: 'bevel', pointerEvents: 'none' });
    const hi = h('div', 'abs', over);
    Object.assign(hi.style, { border: `4px solid ${BLUE}`, borderRadius: '10px', cornerShape: 'bevel', boxShadow: '0 0 0 3000px rgba(23,27,35,0.18)' });
    const tagEl = h('div', 'abs', over);
    Object.assign(tagEl.style, { background: BLUE, color: '#fff', fontSize: '32px', fontWeight: 700, padding: '8px 20px', borderRadius: '8px', cornerShape: 'bevel', whiteSpace: 'nowrap', letterSpacing: '-0.01em' });
    const tagsOf = id => (TAGS[id] || []).map(([t0, t1, rect, label]) => ({ t0, t1, rect: rect(), label })).filter(b => b.rect);
    return t => {
      const o = win(t, DEMO.a, DEMO.b, 0.45, 0.4);
      put(layer, { o });
      if (o <= 0) return;
      // chapter state
      const ci = CHAPTERS.findIndex(c => t >= c.a && t < c.b);
      const cur = CHAPTERS[ci === -1 ? CHAPTERS.length - 1 : ci];
      const prev = CHAPTERS[Math.max(0, (ci === -1 ? CHAPTERS.length - 1 : ci) - 1)];
      titles.forEach(({ el, c }) => put(el, { o: win(t, c.a, c.b, 0.3, 0.25), y: 12 * (1 - ramp(t, c.a, c.a + 0.6)) }));
      // mini ring: the point travels from the previous station to this one
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
      // footage
      let drawn = null;
      SEG.forEach((sg, idx) => {
        if (t < sg.a || t >= sg.b) return;
        const local = t - sg.a + (sg.skip || 0);
        const first = idx === 0;
        const dy = first ? 24 * (1 - ramp(t, sg.a, sg.a + 0.7)) : 0;
        main.draw({ x: FRAME.x, y: FRAME.y + dy, w: FRAME.w, o: 1, shot: sg.shot, local, view: [0, 0, VW, VH] });
        drawn = { sg, local, dy };
      });
      if (!drawn) { main.draw({}); put(over, { o: 0 }); return; }
      box(over, FRAME.x, FRAME.y + drawn.dy, FRAME.w, FRAME.h);
      const beats = tagsOf(drawn.sg.shot);
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

  // ---------- S4 ecosystem → KIGAM second brain (v2 clock 91.6–100.5, conceptual) ----------
  const filmBrain = timed([91.6, 100.5], SLOT.brain, () => {
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
  const filmClosing = timed([100.2, 104.8], SLOT.closing, () => {
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
    // ---------- soundtrack cues (film seconds; soundtrack.py snaps each to the sixteenth-note grid) ----------
    const cue = (t, kind, extra = {}) => CUES.push({ t: +t.toFixed(4), kind, ...extra });
    [0, 1, 2].forEach(k => cue(filmBackground(k * 0.64), 'pop', { step: k }));
    for (let i = 0; i < 8; i++) cue(filmBackground(5.6 + i * 0.2), 'tick', { step: i });
    cue(filmBackground(10.6), 'hit');
    for (let j = 0; j < 11; j++) cue(filmBackground(10.8 + j * 0.2 + 0.85), 'fly', { step: j });
    cue(filmBackground(13.0), 'join');
    cue(filmOpening(0.35), 'logo');
    cue(filmOpening(3.1), 'soft');
    for (let i = 0; i <= 5; i++) cue(filmCycle(21.6 + (5.8 * i) / 5), 'station', { step: i });
    cue(filmCycle(21.6 + 5.8 * 0.42), 'bump');
    CHAPTERS.forEach((c, i) => cue(c.a, 'chapter', { hub: c.part === 'GAID 허브', index: i }));
    SEG.forEach((sg, i) => {
      if (i && !CHAPTERS.some(c => Math.abs(c.a - sg.a) < 1e-6)) cue(sg.a, 'shot');
      let last = '';
      for (const [t0, t1, , label] of TAGS[sg.shot] || []) {
        const at = sg.a + (t0 - sg.skip) + 0.3;
        if (label !== last && at < sg.b - 0.3) cue(Math.max(sg.a, at), 'tag');
        last = label;
      }
    });
    for (let i = 0; i < 7; i++) cue(filmBrain(91.9 + i * 0.22), 'tick', { step: i });
    cue(filmBrain(94.0), 'join');
    cue(filmBrain(96.2), 'soft');
    cue(filmBrain(97.4), 'bump');
    cue(filmClosing(100.2), 'logo');
    cue(filmClosing(101.8), 'soft');
    CUES.sort((p, q) => p.t - q.t);
    const mid = (a, b) => +((a + b) / 2).toFixed(2);
    window.motion = {
      ready: true,
      duration: DURATION,
      segments: SEG,
      cues: CUES,
      grid: { bpm: 100, beat: BEAT, bar: BAR, bars: Math.round(DURATION / BAR) },
      // the poster (brag): frame 0 of the film shows the settled gathered-GAID frame
      poster: +filmBackground(14.4).toFixed(4),
      stills: {
        '01-hook': 1.8,
        '02-work': filmBackground(4.3),
        '03-scattered': filmBackground(9.6),
        '04-gathered': filmBackground(14.4),
        '05-lockup': filmOpening(4.2),
        '06-cycle': lerp(...SLOT.cycle, 0.8),
        ...Object.fromEntries(SEG.map((sg, i) => [`${String(i + 7).padStart(2, '0')}-${sg.shot}`, mid(sg.a, sg.b)])),
        [`${String(SEG.length + 7).padStart(2, '0')}-network`]: lerp(...SLOT.brain, 0.45),
        [`${String(SEG.length + 8).padStart(2, '0')}-second-brain`]: lerp(...SLOT.brain, 0.9),
        [`${String(SEG.length + 9).padStart(2, '0')}-closing`]: DURATION - 0.3,
      },
      // mid-transition stills (brag: check the dips on the bar lines)
      transitions: Object.fromEntries([bar(2), bar(4), bar(6), bar(8), bar(11), ...CHAPTERS.slice(1).map(c => c.a), SLOT.brain[0], SLOT.closing[0]]
        .flatMap(b => [[`x${b.toFixed(1)}-a`, +(b - 0.15).toFixed(2)], [`x${b.toFixed(1)}-b`, +(b + 0.2).toFixed(2)]])),
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
