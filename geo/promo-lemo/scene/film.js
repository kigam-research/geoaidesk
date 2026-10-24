/* GAID promo film, lemo edition (Dark Tech Keynote). Task gaid-promo-video-v4-lemo; treatment in ../TREATMENT.md.
 * Page contract of lemo-opuscar (TECHNIQUE.md §2): window.DUR, async window.render(t), window.READY, window.EV (sound and cue
 * events for mix.py), window.CUES (section times), window.TEXTS(t) (on-screen text for the reading check), window.STILLS.
 * Deterministic: no clock, seeded randomness, no state carried between frames.
 * Messages and copy follow v4 (geo/promo/scene/scene.js). Real takes (capture-v3) play whole at one scale, never zoomed or
 * panned inside (user feedback 2026-10-23); the camera moves only on the stage and in the graphic scenes.
 */
(() => {
  'use strict';
  const CAP = window.PROMO_CAPTURE;
  const FPS = 30, VW = 1280, VH = 720;
  const BEAT = 0.5, SIXTEENTH = BEAT / 4;
  const world = document.getElementById('world');
  const hud = document.getElementById('hud');
  const NS = 'http://www.w3.org/2000/svg';
  const C = { signal: '#3366e8', signalInk: '#7fa2ff', mark: '#4d7fff', ink: '#e7e9ee', ink2: '#b3b9c4', ink3: '#98a0ad', ink4: '#6b7382', edge: '#2e333c', sys: '#59616e' };

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, v) => a + (b - a) * v;
  const lin = x => clamp(x);
  const eo = x => 1 - Math.pow(1 - clamp(x), 3);
  const ei = x => Math.pow(clamp(x), 3);
  const eio = x => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const back = (x, s = 1.3) => { x = clamp(x) - 1; return 1 + x * x * ((s + 1) * x + s); };
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const ramp = (t, a, b, e = eo) => e(seg(t, a, b));
  const win = (t, a, b, fi = 0.25, fo = 0.25) => Math.min(ramp(t, a, a + fi, lin), 1 - ramp(t, b - fo, b, lin));
  const qup = (t, q = BEAT) => Math.ceil(t / q - 1e-6) * q;
  const qnear = (t, q = SIXTEENTH) => Math.round(t / q) * q;
  function mulberry(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- dom ----------
  function h(tag, cls, parent, html) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html !== undefined) el.innerHTML = html;
    parent.appendChild(el);
    return el;
  }
  function sv(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    if (parent) parent.appendChild(el);
    return el;
  }
  function svgLayer(parent) {
    const s = sv('svg', { width: 1920, height: 1080 }, parent);
    Object.assign(s.style, { position: 'absolute', left: '0px', top: '0px', overflow: 'visible' });
    return s;
  }
  function put(el, { o = 1, x = 0, y = 0, s = 1, sx, sy, r = 0 } = {}) {
    el.style.opacity = o;
    el.style.visibility = o <= 0.002 ? 'hidden' : 'visible';
    el.style.transform = `translate(${x}px,${y}px) rotate(${r}deg) scale(${sx ?? s},${sy ?? s})`;
  }
  function at(el, x, y, w, hh) {
    Object.assign(el.style, { left: `${x}px`, top: `${y}px` });
    if (w != null) el.style.width = `${w}px`;
    if (hh != null) el.style.height = `${hh}px`;
    return el;
  }
  const ICON = {};
  const icon = (name, size = 28, color = C.ink2) =>
    `<span class="icon" style="width:${size}px;height:${size}px;color:${color}">${ICON[name] || ''}</span>`;
  let LOGO = null;

  // ---------- events, texts ----------
  const EV = [];
  const ev = (t, type, extra = {}) => EV.push({ t: +t.toFixed(4), type, ...extra });
  const TEXTS = []; // {id, text, a, b, rect: () => [x0,y0,x1,y1]}

  // GAID lockup on dark (175×64 viewBox): ring, G, letters; letters revealed by a clip that a light band follows.
  function lockup(parent) {
    const svg = sv('svg', { width: 175, height: 64, viewBox: '0 0 175 64' }, parent);
    Object.assign(svg.style, { position: 'absolute', left: '0px', top: '0px', overflow: 'visible', transformOrigin: '0 0' });
    const defs = sv('defs', {}, svg);
    const id = `c${Math.floor(Math.random() * 1e9)}`;
    const clip = sv('clipPath', { id }, defs);
    const clipRect = sv('rect', { x: 66, y: -10, width: 0, height: 84 }, clip);
    const ring = sv('path', { d: LOGO.ring, 'fill-rule': 'evenodd', fill: C.mark }, svg);
    const g = sv('path', { d: LOGO.g, 'fill-rule': 'evenodd', fill: C.mark }, svg);
    const letters = sv('g', { fill: C.mark, 'clip-path': `url(#${id})` }, svg);
    for (const l of LOGO.letters) sv('path', { d: l.d, transform: l.transform }, letters);
    const glint = sv('rect', { x: 66, y: 4, width: 10, height: 56, fill: '#ffffff', opacity: 0 }, svg);
    return {
      svg,
      place(cx, cy, height) { // cx, cy = centre of the mark (logo coords 32,32)
        const k = height / 64;
        svg.style.transform = `translate(${cx - 32 * k}px,${cy - 32 * k}px) scale(${k})`;
      },
      set({ o = 1, ringO = 1, gO = 1, lettersF = 0, glintO = 0 }) {
        svg.style.opacity = o;
        svg.style.visibility = o <= 0.002 ? 'hidden' : 'visible';
        ring.setAttribute('opacity', ringO);
        g.setAttribute('opacity', gO);
        clipRect.setAttribute('width', 110 * lettersF);
        glint.setAttribute('x', 66 + 110 * lettersF - 6);
        glint.setAttribute('opacity', glintO);
      },
    };
  }

  function headline(layer, x, y, items, size = 56) {
    const els = items.map(([a, b, str], i) => {
      const el = h('div', 'headline', layer, str);
      at(el, x, y);
      el.style.fontSize = `${size}px`;
      TEXTS.push({ id: `head-${y}-${i}-${a}`, text: str, a: a + 0.16, b, el });
      return { el, a, b };
    });
    return t => {
      for (const { el, a, b } of els) {
        const o = win(t, a, b, 0.16, 0.18);
        put(el, { o, y: 14 * (1 - ramp(t, a, a + 0.22)) - 10 * ramp(t, b - 0.18, b, ei) });
      }
    };
  }

  // ================= timeline =================
  const T = {
    hook: [0, 4.8], tools: [4.8, 9.6], freeze: [9.6, 10.0], press: 10.0, chord: 13.0,
    title: [13.5, 17.5], cycle: [17.5, 24.0],
  };
  // Real-system takes from two examples (user, 2026-10-24: "예제도 yilgarn예제와 PGI예제를 둘다써도되고 … 적합한것을 사용"):
  // `p` = 포천 자철석 광체 추정 (PGI example, capture-v3), `y` = Yilgarn 니켈 탐사 우선순위 (capture-v2). A take is shown whole at one
  // scale as a window inside the motion graphics (no zoom, no scroll inside it). `use` = shot seconds; tags = [shot t0, t1, beat, label].
  const EXAMPLE = { p: '예제 · 포천 자철석 광체 추정', y: '예제 · Yilgarn 니켈 탐사 우선순위 구역' };
  const shotInfo = (src, id) => CAP[src].shots.find(s => s.id === id);
  const BR = (src, id, k) => { const i = shotInfo(src, id); return i && i.beats && i.beats[k] ? i.beats[k].rect : null; };
  const UNION = (a, b) => (a && b ? { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.max(a.x + a.width, b.x + b.width) - Math.min(a.x, b.x), height: Math.max(a.y + a.height, b.y + b.height) - Math.min(a.y, b.y) } : a || b);
  const STATIONS = [
    { icon: 'library', label: '내 서재' },
    { icon: 'workflow', label: 'Workflow 만들기' },
    { icon: 'share-2', label: 'GAID 허브 공유' },
    { icon: 'map-gis', label: '연구 분석' },
    { icon: 'notebook-pen', label: '연구노트' },
  ];
  // Copy: v4 chapter purposes and outcome tags; two Yilgarn tags keep their v2 wording.
  const CHAPTERS = [
    { st: 0, part: 'GAID 시스템', title: '연구는 내 서재의 논문에서 시작합니다', shots: [
      { src: 'p', id: 'L1', use: [0, 4.5], tags: [[0.2, 4.5, 0, '주제별 폴더에 모은 논문']] },
      { src: 'p', id: 'L2', use: [0.6, 3.6], tags: [[0.6, 3.6, 0, '논문을 곁에 두고 읽기']] },
    ] },
    { st: 1, part: 'GAID 허브', title: '논문 속 방법을 AI agent가 따르는 Workflow로 만듭니다', shots: [
      { src: 'p', id: 'A1', use: [0.3, 5], tags: [[0.3, 5, [0, 1], '논문·코드·자료를 함께']] },
      { src: 'p', id: 'A2', use: [0.2, 5], tags: [[0.2, 2.5, 0, '원문 근거를 바로 곁에'], [2.5, 5, 1, '근거를 보고 연구자가 결정']] },
      { src: 'p', id: 'A3', use: [0, 4], tags: [[0.2, 4, [0, 1], '단계로 정리된 분석 절차']] },
    ] },
    { st: 2, part: 'GAID 허브', title: '만든 Workflow는 허브에서 함께 쓰고 고쳐 갑니다', shots: [
      { src: 'p', id: 'H1', use: [0, 4.5], tags: [[0.2, 1.6, 0, '다음 version으로 등록'], [1.6, 4.5, 1, '예제 자료와 함께 공유']] },
      { src: 'p', id: 'H2', use: [0, 3.5], tags: [[0.2, 3.5, 1, '허브에서 가져다 쓰기']] },
    ] },
    { st: 3, part: 'GAID 시스템', title: '공유된 Workflow로 내 자료를 분석합니다', shots: [
      { src: 'p', id: 'R1', use: [0, 4.5], tags: [[0.2, 2.5, 0, 'Workflow의 목적과 근거'], [2.5, 4.5, 1, '근거 논문을 붙여 시작']] },
      { src: 'p', id: 'R3', use: [0.3, 6], tags: [[0.3, 2, 0, 'AI agent가 Workflow대로'], [2, 4, 1, 'AI agent가 Workflow대로'], [4, 6, 2, '결과 그림까지 저장']] },
      { src: 'y', id: 'M1', use: [0, 4.6], tags: [[0.1, 2.5, 0, '지도에서 우선순위 확인'], [2.5, 4.6, 1, '원본 값을 바로 확인']] },
    ] },
    { st: 4, part: 'GAID 시스템', title: '결과와 판단은 연구노트에 남습니다', shots: [
      { src: 'p', id: 'N1', use: [0, 4.5], tags: [[0.2, 3, 1, '결과부터 쓴 연구노트'], [3, 4.5, 2, '두 논문의 쪽수까지 인용']] },
      { src: 'y', id: 'N1', use: [1.5, 5.5], tags: [[1.5, 3, 1, '결과와 그림을 노트로 정리'], [3, 5.5, 2, '판단은 연구자가 답합니다']] },
    ] },
    { st: 0, back: true, part: 'GAID 시스템', title: '연구가 서재로 돌아와 다음 연구로 이어집니다', shots: [
      { src: 'p', id: 'L3', use: [0.5, 3.6], tags: [[0.5, 2, 0, '연구노트도 서재에'], [2, 3.6, 1, '연구노트도 서재에']] },
      { src: 'p', id: 'L4', use: [0, 4], tags: [[0.2, 4, [0, 1], '논문에서 이어진 연구 이력']] },
      { src: 'y', id: 'L3', use: [0, 4], tags: [[0.2, 4, 0, '논문·Workflow·노트의 연결']] },
    ] },
  ];
  const SEG = [];
  {
    let tcur = T.cycle[1];
    CHAPTERS.forEach((c, ci) => {
      if (ci > 0) tcur = qup(tcur + 0.52, BEAT / 2); // collapse 0.22 s + expand 0.3 s, the new chapter lands on an eighth
      c.a = tcur;
      for (const s of c.shots) {
        const info = shotInfo(s.src, s.id);
        const full = info.frames / FPS;
        const [from, to] = s.use;
        const dur = Math.min(to, full) - from;
        SEG.push({ src: s.src, shot: s.id, a: tcur, b: tcur + dur, skip: from, ch: ci, tags: s.tags });
        tcur += dur;
      }
      c.b = tcur;
    });
  }
  const DEMO_END = CHAPTERS[CHAPTERS.length - 1].b;
  T.silence = [DEMO_END + 0.05, DEMO_END + 0.5];
  T.brain = [T.silence[1], qup(T.silence[1] + 6.8)];
  T.end = [T.brain[1], T.brain[1] + 3.8];
  const DUR = +(T.end[1]).toFixed(3);

  // ================= stage (background) =================
  function buildStage() {
    const back = h('div', 'layer', world);
    back.style.zIndex = 0;
    const s = svgLayer(back);
    const defs = sv('defs', {}, s);
    const lift = sv('radialGradient', { id: 'lift', cx: '50%', cy: '18%', r: '75%' }, defs);
    sv('stop', { offset: '0', 'stop-color': '#171b24' }, lift);
    sv('stop', { offset: '1', 'stop-color': '#0b0d11' }, lift);
    sv('rect', { x: -2000, y: -2000, width: 5920, height: 5080, fill: 'url(#lift)' }, s);
    const grid = sv('g', { stroke: '#ffffff' }, s);
    for (let x = -1920; x <= 3840; x += 48) sv('line', { x1: x, y1: -1080, x2: x, y2: 2160, 'stroke-opacity': ((x / 48) % 4 === 0) ? 0.055 : 0.028, 'stroke-width': 1 }, grid);
    for (let y = -1080; y <= 2160; y += 48) sv('line', { x1: -1920, y1: y, x2: 3840, y2: y, 'stroke-opacity': ((y / 48) % 4 === 0) ? 0.055 : 0.028, 'stroke-width': 1 }, grid);
    // vignette on the HUD side so the camera does not move it
    const vig = h('div', 'layer', document.getElementById('stage'));
    vig.style.background = 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%)';
    vig.style.zIndex = 1;
    hud.style.zIndex = 2;
    return t => {
      // the grid fades while a real take is on screen so the take is the only lit plane
      const demo = Math.min(ramp(t, T.cycle[1] - 0.4, T.cycle[1] + 0.2, lin), 1 - ramp(t, DEMO_END - 0.2, DEMO_END + 0.4, lin));
      grid.setAttribute('opacity', 1 - 0.25 * demo);
    };
  }

  // ================= camera =================
  let CAM = { x: 0, y: 0, s: 1, r: 0 };
  function camera(t) {
    let s = 1, r = 0, x = 0, y = 0;
    const tf = Math.min(t, T.freeze[0]);
    s = lerp(1, 1.05, ramp(tf, 0, T.tools[1], lin)); // pressure push through the mess
    r = 1.6 * ramp(tf, T.tools[0], T.tools[1], eio); // Dutch tilt only while things are scattered
    if (tf > 9.0) { const k = ramp(tf, 9.0, 9.6, lin); x += 2.4 * k * Math.sin(tf * 71); y += 2.4 * k * Math.sin(tf * 53 + 1); }
    if (t >= T.press) {
      // whip pull-out in one beat at the press, then settle
      const w = ramp(t, T.press, T.press + 0.5, eo);
      s = lerp(1.05, 0.94, w);
      s = lerp(s, 1, ramp(t, T.press + 0.5, T.press + 1.6, eio));
      r = lerp(1.6, 0, ramp(t, T.press, T.press + 0.35, eo));
      x = 0; y = 0;
    }
    CAM = { x, y, s, r };
    world.style.transform = `translate(${x}px,${y}px) rotate(${r}deg) scale(${s})`;
  }

  // ================= S1–S3: the mess, the freeze, the snap =================
  const ME = { x: 960, y: 640 };
  const ME_LEFT = { x: 250, y: 640 };
  const MARK_AT = { x: 960, y: 500 }, MARK_LEFT = { x: 250, y: 500 };
  const PANEL = { x: 500, y: 196, w: 1340, h: 820 };
  const SHELVES = [
    ['library', '서재', ['논문', 'PDF']],
    ['code-xml', '스킬과 도구', []],
    ['workflow', 'Workflow', ['논문 속 방법']],
    ['map-gis', '자료와 지도', ['지도', '검층']],
    ['notebook-pen', '연구노트', []],
  ];
  const shelfRowY = i => PANEL.y + 150 + i * 128;
  // Real names (v4: K-Dense scientific agent skills, KIGAM skills in GAID's catalogue, the Heo et al. supplementary script).
  const TOOLS = [
    ['code-xml', 'K-Dense AI 과학 스킬', 'geopandas', 70, 190, -2, 1],
    ['map-gis', 'KIGAM 지구과학 스킬', 'geo-map-and-crs', 1470, 186, 2, 1],
    ['git-branch', 'GitHub 저장소', '저장소마다 따로 설치', 50, 470, 1.5, 1],
    ['file-code', '논문 부록 코드', 'MOESM1_ESM.py', 1500, 470, -1.5, 2],
    ['database', '기관 자료', '지질도 · 시추 자료', 120, 790, -1, 3],
    ['folder-open', '개인 폴더', '분석 노트', 1460, 780, 1.8, 4],
    ['plug', 'agent 도구', 'MCP 서버', 540, 900, 1, 1],
    ['well-log', 'KIGAM 지구과학 스킬', 'well-log-qc-quicklook', 1010, 900, -1.2, 1],
  ].map(([ic, group, name, x, y, rot, shelf], i) => ({ ic, group, name, x, y, rot, shelf, i, w: 380, h: 112 }));
  const MAP_FILES = ['dem.tif', 'aeromag_lines.csv', 'boreholes.csv', 'core_samples.csv', 'base_station.csv', 'orebody_reference.csv'];
  const CODE_FILES = ['MOESM1_ESM.py', 'pyproject.toml'];
  const KIND = {
    map: { w: 230, h: 164, shelf: 3, color: '#8fb3a6', bend: -1 },
    pdf: { w: 176, h: 222, shelf: 0, color: '#c9d3e6', bend: 1 },
    code: { w: 250, h: 160, shelf: 2, color: '#c8b48a', bend: -1 },
  };

  function buildMess() {
    const layer = h('div', 'layer', world);
    layer.style.zIndex = 2;
    const lines = svgLayer(layer);
    const workLayer = h('div', 'layer', layer);
    const toolLayer = h('div', 'layer', layer);
    const trails = svgLayer(layer);
    const rnd = mulberry(20261024);

    // researcher node
    const me = h('div', 'abs', layer);
    me.innerHTML = `<div class="panel raised" style="position:absolute;left:-46px;top:-46px;width:92px;height:92px;border-radius:46px;display:flex;align-items:center;justify-content:center">${icon('user', 44, C.ink)}</div>`;
    const meLab = h('div', 'abs h3', layer, '연구자');
    Object.assign(meLab.style, { width: '200px', textAlign: 'center', fontSize: '32px', color: C.ink2 });

    // --- work windows spawned by rule, faster and faster ---
    const N = 54;
    const kinds = ['map', 'pdf', 'code'];
    const work = [];
    for (let k = 0; k < N; k++) {
      const kind = kinds[k % 3];
      const K = KIND[kind];
      const t0 = qnear(0.3 + 4.3 * Math.sqrt(k / N), SIXTEENTH / 2);
      let x, y, tries = 0;
      do {
        x = 40 + rnd() * (1880 - K.w - 40); y = 170 + rnd() * (1040 - K.h - 170); tries++;
      } while (tries < 60 && Math.hypot(x + K.w / 2 - ME.x, y + K.h / 2 - ME.y) < 230);
      const el = h('div', 'panel cheap', workLayer);
      at(el, 0, 0, K.w, K.h);
      const g = sv('svg', { width: K.w, height: K.h }, el);
      g.style.position = 'absolute';
      if (kind === 'map') {
        for (let c = 0; c < 4; c++) {
          const cx = K.w * (0.3 + rnd() * 0.4), cy = 20 + (K.h - 60) * (0.3 + rnd() * 0.4);
          const pts = [];
          for (let a = 0; a < 24; a++) {
            const ang = (a / 24) * Math.PI * 2, rr = (14 + c * 14) * (1 + 0.18 * Math.sin(ang * 3 + c + k));
            pts.push(`${(cx + rr * 1.5 * Math.cos(ang)).toFixed(1)},${(cy + rr * Math.sin(ang)).toFixed(1)}`);
          }
          sv('polygon', { points: pts.join(' '), fill: 'none', stroke: c === 3 ? '#4a6f63' : '#3b4a47', 'stroke-width': 2 }, g);
        }
        h('div', 'abs small', el, MAP_FILES[k % MAP_FILES.length]).style.cssText += `left:14px;top:${K.h - 38}px;color:${C.ink3}`;
      } else if (kind === 'pdf') {
        sv('rect', { x: 16, y: 18, width: 74, height: 12, rx: 3, fill: '#3a404b' }, g);
        for (let l = 0; l < 7; l++) sv('rect', { x: 16, y: 44 + l * 16, width: 110 + ((l * 37 + k * 11) % 34), height: 7, rx: 3, fill: '#2a2f38' }, g);
        h('div', 'abs small', el, '논문 PDF').style.cssText += `left:14px;top:${K.h - 38}px;color:${C.ink3}`;
      } else {
        for (let l = 0; l < 6; l++) {
          let x0 = 18 + (l % 3) * 16;
          for (let j = 0; j < 3; j++) { const w = 18 + ((l * 13 + j * 29 + k * 7) % 46); sv('rect', { x: x0, y: 18 + l * 17, width: w, height: 7, rx: 3, fill: j % 2 ? '#3a404b' : '#2a2f38' }, g); x0 += w + 8; }
        }
        h('div', 'abs small', el, CODE_FILES[k % CODE_FILES.length]).style.cssText += `left:14px;top:${K.h - 38}px;color:${C.ink3}`;
      }
      const rot = (rnd() - 0.5) * 6;
      work.push({ el, kind, K, x, y, rot, t0, k, cx: x + K.w / 2, cy: y + K.h / 2 });
      ev(t0, 'spawn', { kind, pan: +((x + K.w / 2 - 960) / 960).toFixed(3) });
    }

    // --- scattered tools, each out of the researcher's reach ---
    const tools = TOOLS.map(tl => {
      const el = h('div', 'panel raised', toolLayer);
      at(el, 0, 0, tl.w, tl.h);
      el.innerHTML = `<div style="position:absolute;left:20px;top:16px;display:flex;align-items:center;gap:12px">${icon(tl.ic, 30, C.ink2)}<span class="label" style="color:${C.ink2}">${tl.group}</span></div>`
        + `<div style="position:absolute;left:20px;top:60px"><span class="pill">${tl.name}</span></div>`;
      const t0 = T.tools[0] + 0.25 + tl.i * 0.5;
      const reach = sv('line', { stroke: C.ink4, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-dasharray': '10 10' }, lines);
      const from = { x: tl.x + tl.w / 2 + (tl.x < 960 ? -700 : 700), y: tl.y + tl.h / 2 + (tl.y < 540 ? -300 : 300) };
      ev(t0, 'scatter', { pan: +((tl.x + tl.w / 2 - 960) / 960).toFixed(3), i: tl.i });
      ev(t0 + 0.5, 'miss', { pan: +((tl.x + tl.w / 2 - 960) / 960).toFixed(3), i: tl.i });
      return { ...tl, el, t0, reach, from, cx: tl.x + tl.w / 2, cy: tl.y + tl.h / 2 };
    });

    // --- the press: the GAID mark is the living element ---
    const markL = lockup(layer);
    const pulse = sv('circle', { cx: 0, cy: 0, r: 0, fill: 'none', stroke: C.signal, 'stroke-width': 4 }, trails);
    ev(T.freeze[0], 'freeze');
    ev(T.freeze[0] + 0.12, 'mark');
    ev(T.press - 0.25, 'windup');
    ev(T.press, 'press');

    // --- the GAID panel and its shelves ---
    const panel = h('div', 'panel', layer);
    at(panel, PANEL.x, PANEL.y, PANEL.w, PANEL.h);
    layer.insertBefore(panel, workLayer);
    const pTitle = h('div', 'abs', panel);
    pTitle.innerHTML = `<span class="headline" style="position:static;font-size:52px">GAID</span>`;
    at(pTitle, 48, 40);
    const shelves = SHELVES.map(([ic, name, own], i) => {
      const row = h('div', 'abs', panel);
      Object.assign(row.style, { left: '44px', top: `${150 + i * 128 - 0}px`, width: `${PANEL.w - 88}px`, height: '104px', display: 'flex', alignItems: 'center', gap: '20px', padding: '0 24px', border: `1px solid ${C.edge}`, borderRadius: '8px', cornerShape: 'bevel', background: '#1b1f26' });
      row.innerHTML = `<span class="ic" style="flex:none;display:flex">${icon(ic, 40, C.ink2)}</span><span class="h3" style="width:220px;flex:none">${name}</span><span class="pills" style="display:flex;gap:10px;flex-wrap:nowrap"></span>`;
      const pills = row.querySelector('.pills');
      const mk = (label, accent) => h('span', `pill${accent ? ' accent' : ''}`, pills, label);
      return { row, i, ico: row.querySelector('.ic'), mk, own: own.map(l => mk(l, false)), y: shelfRowY(i) + 52 };
    });
    for (const tl of tools) tl.pill = shelves[tl.shelf].mk(tl.name.replace('저장소마다 따로 설치', 'GitHub').replace(' · ', '·'), true);
    // measure pill slots (panel laid out at its final rect)
    for (const tl of tools) {
      const r = tl.pill.getBoundingClientRect();
      tl.target = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    for (const s of shelves) { const r = s.ico.getBoundingClientRect(); s.icoAt = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

    // flights: launched when the press ring passes, landing on sixteenths, each type bending the same way
    const flyers = [
      ...tools.map(tl => ({ kind: 'tool', o: tl, p0: { x: tl.cx, y: tl.cy }, p1: tl.target, bend: 1, color: C.signalInk })),
      ...work.map(w => ({ kind: w.kind, o: w, p0: { x: w.cx, y: w.cy }, p1: shelves[w.K.shelf].icoAt, bend: w.K.bend, color: w.K.color })),
    ];
    for (const f of flyers) {
      const ringT = T.press + 0.15 + Math.hypot(f.p0.x - MARK_LEFT.x, f.p0.y - MARK_LEFT.y) / 1400;
      const dur = 0.3 + Math.hypot(f.p1.x - f.p0.x, f.p1.y - f.p0.y) / 4200;
      f.land = Math.min(T.chord - 0.25, qnear(ringT + dur, SIXTEENTH));
      f.launch = f.land - dur;
      const dx = f.p1.x - f.p0.x, dy = f.p1.y - f.p0.y, len = Math.hypot(dx, dy) || 1;
      f.c = { x: (f.p0.x + f.p1.x) / 2 - (dy / len) * 0.22 * len * f.bend, y: (f.p0.y + f.p1.y) / 2 + (dx / len) * 0.22 * len * f.bend };
      f.trail = sv('polyline', { fill: 'none', stroke: f.color, 'stroke-width': f.kind === 'tool' ? 5 : 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0 }, trails);
      const shelf = f.kind === 'tool' ? f.o.shelf : f.o.K.shelf;
      f.o.flyer = f;
      (shelves[shelf].landTimes ||= []).push(f.land);
      ev(f.land, 'land', { kind: f.kind, shelf, pan: +((f.p1.x - 960) / 960).toFixed(3) });
    }
    for (const s of shelves) s.landTimes ||= [];
    ev(T.chord, 'chord');
    const bez = (f, u) => ({
      x: (1 - u) * (1 - u) * f.p0.x + 2 * (1 - u) * u * f.c.x + u * u * f.p1.x,
      y: (1 - u) * (1 - u) * f.p0.y + 2 * (1 - u) * u * f.c.y + u * u * f.p1.y,
    });
    const flyU = (f, t) => back(seg(t, f.launch, f.land), 1.25);

    const head = headline(layer, 110, 64, [
      [0.3, 4.95, '자료를 찾고, 논문을 읽고, 코드를 짭니다'],
      [5.0, 9.95, '쓸 만한 스킬과 도구는 곳곳에 흩어져 있습니다'],
      [10.2, 13.55, 'GAID가 한곳에 모아 연구를 돕습니다'],
    ]);

    // panel collapse (CRT off) into the mark for the title
    const crt = [T.title[0], T.title[0] + 0.35];
    ev(crt[0], 'crt');
    return t => {
      const show = t < crt[1] + 0.05;
      layer.style.display = show ? '' : 'none';
      if (!show) return;
      head(t);
      const tf = Math.min(t, T.freeze[0]);
      const pressed = t >= T.press;
      const slide = ramp(t, T.press + 0.05, T.press + 0.45, eio);
      const mx = lerp(MARK_AT.x, MARK_LEFT.x, slide), my = lerp(MARK_AT.y, MARK_LEFT.y, slide);
      const mex = lerp(ME.x, ME_LEFT.x, slide), mey = lerp(ME.y, ME_LEFT.y, slide);
      const meO = ramp(t, 0.1, 0.4, lin) * (1 - ramp(t, crt[0], crt[0] + 0.25, lin));
      put(me, { o: meO, x: mex, y: mey, s: 0.9 + 0.1 * ramp(t, 0.1, 0.4) });
      put(meLab, { o: meO, x: mex - 100, y: mey + 56 });

      // work windows
      for (const w of work) {
        const sp = seg(tf, w.t0, w.t0 + 0.22);
        if (t < w.t0) { put(w.el, { o: 0 }); continue; }
        const dim = 1 - 0.55 * ramp(tf, T.tools[0], T.tools[0] + 1.2, lin);
        const drift = 26 * ramp(tf, T.tools[0], T.tools[1], lin);
        const ox = (w.cx - ME.x) / 960 * drift, oy = (w.cy - ME.y) / 540 * drift;
        let x = w.x + ox, y = w.y - 20 * (1 - back(sp, 1.6)) + oy, s = lerp(0.94, 1, back(sp, 1.6)), o = clamp(sp * 3) * dim, r = w.rot;
        if (pressed) {
          const f = w.flyer;
          const u = flyU(f, t);
          if (t >= f.land + 0.06) { put(w.el, { o: 0 }); continue; }
          if (t >= f.launch) {
            const p = bez(f, u);
            const m = ramp(t, f.launch, f.launch + (f.land - f.launch) * 0.35);
            s = lerp(1, 0.16, m); r = lerp(w.rot, 0, m); o = lerp(dim, 1, m);
            x = p.x - w.K.w / 2; y = p.y - w.K.h / 2;
          } else { x = w.x + ox; y = w.y + oy; }
        }
        put(w.el, { o, x, y, s, r });
      }
      // tools: fling in, the reach line falls short
      for (const tl of tools) {
        if (t < tl.t0) { put(tl.el, { o: 0 }); tl.reach.setAttribute('opacity', 0); continue; }
        const u = seg(tf, tl.t0, tl.t0 + 0.3);
        let x = lerp(tl.from.x, tl.cx, back(u, 1.2)) - tl.w / 2, y = lerp(tl.from.y, tl.cy, back(u, 1.2)) - tl.h / 2, s = 1, o = clamp(u * 4), r = tl.rot * back(u, 2);
        // reach: extend to 70 %, hold, retract; leave a faint ghost
        const ra = tl.t0 + 0.3;
        const ext = ramp(tf, ra, ra + 0.3) * (1 - 0.75 * ramp(tf, ra + 0.5, ra + 0.9, eio));
        const ex = lerp(mex, tl.cx, 0.7 * ext), ey = lerp(mey, tl.cy, 0.7 * ext);
        tl.reach.setAttribute('x1', mex); tl.reach.setAttribute('y1', mey);
        tl.reach.setAttribute('x2', ex); tl.reach.setAttribute('y2', ey);
        tl.reach.setAttribute('opacity', (tf < ra ? 0 : 0.85) * (1 - ramp(t, T.press, T.press + 0.2, lin)));
        if (pressed) {
          const f = tl.flyer;
          if (t >= f.launch) {
            const p = bez(f, flyU(f, t));
            const m = ramp(t, f.launch, f.land);
            s = lerp(1, 0.42, m); r = lerp(tl.rot, 0, m); o = 1 - ramp(t, f.land - 0.08, f.land + 0.02, lin);
            x = p.x - tl.w / 2; y = p.y - tl.h / 2;
          }
        }
        put(tl.el, { o, x, y, s, r });
      }
      // trails
      for (const f of flyers) {
        if (!pressed || t < f.launch || t > f.land + 0.25) { f.trail.setAttribute('opacity', 0); continue; }
        const pts = [];
        for (let i = 0; i <= 9; i++) {
          const tt = Math.max(f.launch, Math.min(t, f.land) - i * 0.022);
          const p = bez(f, flyU(f, tt));
          pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
        }
        f.trail.setAttribute('points', pts.join(' '));
        f.trail.setAttribute('opacity', 0.75 * (1 - ramp(t, f.land, f.land + 0.25, lin)));
      }
      // shelf pills appear on landing; a shelf icon blinks when a window lands in it
      for (const tl of tools) put(tl.pill, { o: t >= tl.flyer.land ? 1 : 0, s: t >= tl.flyer.land ? lerp(0.8, 1, back(seg(t, tl.flyer.land, tl.flyer.land + 0.2), 2)) : 1 });
      for (const s of shelves) {
        const hits = s.landTimes.filter(lt => t >= lt && t < lt + 0.18).length;
        s.ico.style.color = hits ? C.signalInk : C.ink2;
        s.ico.querySelector('.icon').style.color = hits ? C.signalInk : C.ink2;
      }
      // the mark: appears in the freeze, winds up, presses
      const mo = ramp(t, T.freeze[0] + 0.12, T.freeze[0] + 0.3, lin);
      const wind = ramp(t, T.press - 0.4, T.press, ei);
      const hit = t >= T.press && t < T.press + 2 / FPS;
      const spring = t >= T.press ? 1 + 0.25 * Math.exp(-6 * (t - T.press)) * Math.sin(18 * (t - T.press)) : 1;
      const mh = 72 * (hit ? 0.6 : lerp(1, 1.25, wind) * spring);
      markL.place(mx, my, mh);
      markL.set({ o: mo * (1 - ramp(t, crt[1] - 0.05, crt[1] + 0.05, lin)), lettersF: 0 });
      const pr = (t - T.press) * 1400;
      pulse.setAttribute('cx', mx); pulse.setAttribute('cy', my);
      pulse.setAttribute('r', Math.max(0, pr));
      pulse.setAttribute('opacity', pressed ? 0.8 * (1 - ramp(t, T.press, T.press + 1.4, lin)) : 0);
      // panel opens from the mark, and later collapses like a screen switching off
      const open = ramp(t, T.press + 0.1, T.press + 0.45, eo);
      const sy = t < crt[0] ? 1 : lerp(1, 0.012, ramp(t, crt[0], crt[0] + 0.2, ei));
      const sx = t < crt[0] + 0.2 ? 1 : lerp(1, 0, ramp(t, crt[0] + 0.2, crt[1], ei));
      panel.style.transformOrigin = `${(MARK_LEFT.x - PANEL.x)}px ${(MARK_LEFT.y - PANEL.y)}px`;
      if (t < crt[0]) put(panel, { o: open, s: lerp(0.05, 1, open) });
      else { panel.style.transformOrigin = `${PANEL.w / 2}px ${PANEL.h / 2}px`; put(panel, { o: 1, sx, sy }); }
    };
  }

  // ================= S4 title, S5 cycle (the mark's orbit becomes the research cycle) =================
  const RING = { x: 960, y: 590, r: 300 };
  const stAngle = i => (-90 + i * 72) * Math.PI / 180;
  const stPos = i => ({ x: RING.x + RING.r * Math.cos(stAngle(i)), y: RING.y + RING.r * Math.sin(stAngle(i)) });
  // the logo's orbit as an ellipse in logo coordinates (fitted to the ring path's ends)
  const ORBIT = { cx: 32, cy: 32, rx: 30, ry: 11, rot: -19.3 };
  const TITLE_MARK = { x: 960 - (175 * 220 / 64) / 2 + 32 * 220 / 64, y: 470, hgt: 220 };

  function buildTitleCycle() {
    const layer = h('div', 'layer', world);
    layer.style.zIndex = 3;
    const svg = svgLayer(layer);
    const L = lockup(layer);
    const sub = h('div', 'headline', layer, '지구과학 연구자를 위한 AI agent 연구 지원 플랫폼');
    Object.assign(sub.style, { width: '1920px', textAlign: 'center', fontSize: '50px', fontWeight: 600, color: C.ink2 });
    at(sub, 0, 640);
    TEXTS.push({ id: 'title-sub', text: sub.textContent, a: T.title[0] + 1.3, b: T.title[1], el: sub });
    const sweepAt = T.title[0] + 0.7;
    ev(sweepAt - 0.3, 'sweep');
    ev(T.title[0] + 0.5, 'title');

    // cycle
    const ring = sv('ellipse', { fill: 'none', stroke: C.sys, 'stroke-width': 10 }, svg);
    const C2 = 2 * Math.PI * RING.r;
    const arcHub = sv('circle', { cx: RING.x, cy: RING.y, r: RING.r, fill: 'none', stroke: C.signal, 'stroke-width': 12, transform: `rotate(-54 ${RING.x} ${RING.y})`, 'stroke-dasharray': `0 ${C2}` }, svg);
    const dot = sv('circle', { r: 13, fill: C.mark }, svg);
    const stations = STATIONS.map((st, i) => {
      const p = stPos(i);
      const el = h('div', 'abs', layer);
      el.innerHTML = `<div class="panel raised" style="position:absolute;left:-40px;top:-40px;width:80px;height:80px;border-radius:40px;display:flex;align-items:center;justify-content:center">${icon(st.icon, 38, C.ink)}</div>`;
      const lab = h('div', 'abs h3', layer, st.label);
      const lx = RING.x + (RING.r + 66) * Math.cos(stAngle(i)), ly = RING.y + (RING.r + 66) * Math.sin(stAngle(i));
      const anchor = Math.cos(stAngle(i)) > 0.3 ? 'left' : Math.cos(stAngle(i)) < -0.3 ? 'right' : 'center';
      Object.assign(lab.style, { width: '420px', textAlign: anchor, fontSize: '32px' });
      const lxPos = anchor === 'left' ? lx - 10 : anchor === 'right' ? lx - 410 : lx - 210;
      const lyPos = i === 0 ? ly - 60 : ly - 22;
      const t0 = T.cycle[0] + 1.25 + i * BEAT;
      ev(t0, 'station', { i, pan: +((p.x - 960) / 960).toFixed(3) });
      TEXTS.push({ id: `st-${i}`, text: st.label, a: t0 + 0.2, b: T.cycle[1] - 0.5, el: lab });
      return { el, lab, p, t0, lxPos, lyPos };
    });
    const hubLab = h('div', 'abs', layer);
    hubLab.innerHTML = `<span class="badge hub" style="position:static">GAID 허브</span><div class="label" style="margin-top:10px;color:${C.signalInk}">함께 쓰고 고쳐 가는 Workflow</div>`;
    at(hubLab, 1300, 236);
    const sysLab = h('div', 'abs', layer);
    sysLab.innerHTML = `<span class="badge sys" style="position:static">GAID 시스템</span><div class="label" style="margin-top:10px">내 서재에서 분석하고 기록하는 연구</div>`;
    at(sysLab, 250, 760);
    const tArc = T.cycle[0] + 3.0;
    ev(tArc, 'arc');
    TEXTS.push({ id: 'hub-lab', text: '함께 쓰고 고쳐 가는 Workflow', a: tArc + 0.2, b: T.cycle[1] - 0.5, el: hubLab });
    TEXTS.push({ id: 'sys-lab', text: '내 서재에서 분석하고 기록하는 연구', a: tArc + 0.7, b: T.cycle[1] - 0.5, el: sysLab });
    const who = h('div', 'abs h3', layer, '연구자 + AI agent');
    Object.assign(who.style, { width: '600px', textAlign: 'center', fontSize: '36px' });
    at(who, RING.x - 300, RING.y + 40);
    const ver = h('div', 'abs', layer);
    at(ver, 1300, 352);
    const verA = h('span', 'pill accent', ver, 'version 0.1.0');
    const verB = h('span', 'pill accent', ver, 'version 0.1.1');
    Object.assign(verA.style, { position: 'absolute', fontSize: '26px' });
    Object.assign(verB.style, { position: 'absolute', fontSize: '26px' });
    const tVer = T.cycle[0] + 4.4;
    ev(tVer, 'version');
    const head = headline(layer, 110, 64, [[T.cycle[0] + 0.4, T.cycle[1] - 0.15, '논문과 분석이 공유된 Workflow가 되고, 쓰일수록 나아집니다']]);
    const exp = [T.cycle[1] - 0.5, T.cycle[1]];
    ev(exp[0], 'expand');

    return t => {
      const show = t >= T.title[0] && t < T.cycle[1] + 0.05;
      layer.style.display = show ? '' : 'none';
      if (!show) return;
      head(t);
      // the small mark flies from the panel's corner to the title position and grows
      const fly = ramp(t, T.title[0] + 0.15, T.title[0] + 0.65, eio);
      const mx = lerp(MARK_LEFT.x, TITLE_MARK.x, fly), my = lerp(MARK_LEFT.y, TITLE_MARK.y, fly), mh = lerp(72, TITLE_MARK.hgt, fly);
      const lettersF = ramp(t, sweepAt, sweepAt + 1.1, lin) * (1 - ramp(t, T.cycle[0], T.cycle[0] + 0.35, ei));
      const glintO = 0.22 * Math.min(ramp(t, sweepAt, sweepAt + 0.1, lin), 1 - ramp(t, sweepAt + 1.0, sweepAt + 1.15, lin));
      const morph = ramp(t, T.cycle[0] + 0.2, T.cycle[0] + 1.2, eio);
      L.place(mx, my, mh);
      L.set({ o: t >= T.title[0] + 0.15 ? 1 : 0, ringO: 1 - ramp(t, T.cycle[0] + 0.2, T.cycle[0] + 0.35, lin), gO: 1 - ramp(t, T.cycle[0] + 0.2, T.cycle[0] + 0.7, lin), lettersF, glintO });
      put(sub, { o: win(t, T.title[0] + 1.1, T.cycle[0] + 0.2, 0.2, 0.2), y: 14 * (1 - ramp(t, T.title[0] + 1.1, T.title[0] + 1.4)) });
      // the orbit ellipse (in screen space at the title scale) morphs into the research cycle
      const k = TITLE_MARK.hgt / 64;
      const ex0 = TITLE_MARK.x, ey0 = TITLE_MARK.y;
      const cx = lerp(ex0, RING.x, morph), cy = lerp(ey0, RING.y, morph);
      const rx = lerp(ORBIT.rx * k, RING.r, morph), ry = lerp(ORBIT.ry * k, RING.r, morph), rot = lerp(ORBIT.rot, 0, morph);
      const ringOn = t >= T.cycle[0] + 0.2;
      ring.setAttribute('cx', cx); ring.setAttribute('cy', cy); ring.setAttribute('rx', rx); ring.setAttribute('ry', ry);
      ring.setAttribute('transform', `rotate(${rot} ${cx} ${cy})`);
      ring.setAttribute('stroke', morph < 1 ? C.mark : C.sys);
      ring.setAttribute('stroke-width', lerp(5 * k, 10, morph));
      const out = 1 - ramp(t, exp[0], exp[0] + 0.25, lin);
      ring.setAttribute('opacity', ringOn ? out : 0);
      // orbit dot rides the ring
      const da = (-30 + 360 * ramp(t, T.cycle[0] + 1.2, T.cycle[1], lin) * 1.0) * Math.PI / 180;
      const rr = Math.hypot(rx, ry) > 0 ? 1 : 1;
      const dx = cx + rx * Math.cos(da) * rr, dy = cy + ry * Math.sin(da) * rr;
      dot.setAttribute('cx', dx); dot.setAttribute('cy', dy);
      dot.setAttribute('opacity', ringOn ? out : 0);
      // hub arc: Workflow 만들기 → 허브 공유 (-54° … 90°)
      const arcF = ramp(t, tArc, tArc + 0.5, eio);
      arcHub.setAttribute('stroke-dasharray', `${(C2 * 144 / 360) * arcF} ${C2}`);
      arcHub.setAttribute('opacity', out);
      for (const [i, s] of stations.entries()) {
        const p = ramp(t, s.t0, s.t0 + 0.25);
        const expandIt = i === 0 ? 1 : out;
        put(s.el, { o: (t >= s.t0 ? clamp(p * 3) : 0) * (i === 0 ? 1 - ramp(t, exp[0] + 0.05, exp[0] + 0.15, lin) : out), x: s.p.x, y: s.p.y, s: lerp(0.6, 1, back(p, 2)) * expandIt });
        put(s.lab, { o: (t >= s.t0 + 0.1 ? ramp(t, s.t0 + 0.1, s.t0 + 0.3, lin) : 0) * out, x: s.lxPos, y: s.lyPos });
      }
      put(hubLab, { o: ramp(t, tArc, tArc + 0.2, lin) * out, y: 10 * (1 - ramp(t, tArc, tArc + 0.25)) });
      put(sysLab, { o: ramp(t, tArc + 0.5, tArc + 0.7, lin) * out, y: 10 * (1 - ramp(t, tArc + 0.5, tArc + 0.75)) });
      put(who, { o: ramp(t, T.cycle[0] + 1.6, T.cycle[0] + 1.9, lin) * out });
      const vf = ramp(t, tVer, tVer + 0.3, eio);
      put(ver, { o: ramp(t, tArc + 0.6, tArc + 0.8, lin) * out });
      put(verA, { o: 1 - vf, y: -24 * vf });
      put(verB, { o: vf, y: 24 * (1 - vf) });
    };
  }

  // ================= S6 demo: the real app as a window inside the motion graphics, chapter by chapter =================
  // Left: part badge, purpose line, the chapter's outcomes as a list that fills as they appear; right: the take, whole, at one scale;
  // a leader line joins the current outcome to its box on the take (user, 2026-10-24: "촬영 에셋이 영상 전 영역을 차지하지 않고,
  // 해당 기능을 소개하는 모션그래픽속의 창요소처럼 보여도되므로").
  const TAKE = { x: 660, y: 232, w: 1180, h: 664 };
  const KS = TAKE.w / VW;
  const COL = { x: 100, w: 500 };
  const pending = [];
  function buildDemo() {
    const layer = h('div', 'layer', hud);
    const glow = h('div', 'abs', layer);
    Object.assign(glow.style, { left: `${TAKE.x - 260}px`, top: `${TAKE.y - 200}px`, width: `${TAKE.w + 520}px`, height: `${TAKE.h + 400}px`, background: 'radial-gradient(closest-side, rgba(51,102,232,0.10), rgba(51,102,232,0))' });
    const win2 = h('div', 'take', layer);
    const imgA = h('img', '', win2); // previous shot (held last frame) under the light sweep
    const imgB = h('img', '', win2);
    for (const im of [imgA, imgB]) Object.assign(im.style, { width: `${TAKE.w}px`, height: `${TAKE.h}px` });
    const glint = h('div', 'lit', win2);
    const box = h('div', 'tagbox', win2);
    box.style.boxShadow = 'none';
    const chip = h('span', 'pill', layer);
    Object.assign(chip.style, { position: 'absolute', fontSize: '24px' });
    const badge = h('span', 'badge', layer);
    const title = h('div', 'headline', layer);
    Object.assign(title.style, { whiteSpace: 'normal', wordBreak: 'keep-all', width: `${COL.w}px`, fontSize: '50px', lineHeight: '1.26' });
    const lead = svgLayer(layer);
    const leadLine = sv('polyline', { fill: 'none', stroke: C.signal, 'stroke-width': 3, 'stroke-linejoin': 'round' }, lead);
    const leadDot = sv('circle', { r: 7, fill: C.signal }, lead);
    // mini cycle (position in the story)
    const MC = { x: 1792, y: 70, r: 34 };
    sv('circle', { cx: MC.x, cy: MC.y, r: MC.r, fill: 'none', stroke: C.sys, 'stroke-width': 4 }, lead);
    sv('circle', { cx: MC.x, cy: MC.y, r: MC.r, fill: 'none', stroke: C.signal, 'stroke-width': 5, transform: `rotate(-54 ${MC.x} ${MC.y})`, 'stroke-dasharray': `${2 * Math.PI * MC.r * 144 / 360} 999` }, lead);
    const mdots = STATIONS.map((_, i) => sv('circle', { cx: MC.x + MC.r * Math.cos(stAngle(i)), cy: MC.y + MC.r * Math.sin(stAngle(i)), r: 6, fill: '#20242c', stroke: C.ink3, 'stroke-width': 2 }, lead));
    const mdot = sv('circle', { r: 9, fill: C.mark }, lead);

    // tag schedule in film time; rows = the chapter's distinct outcomes in order
    const tagSched = [];
    for (const sg of SEG) {
      let last = null;
      for (const [t0, t1, k, label] of sg.tags) {
        const ta = sg.a + (t0 - sg.skip), tb = Math.min(sg.b, sg.a + (t1 - sg.skip));
        if (tb <= ta) continue;
        const rect = Array.isArray(k) ? UNION(BR(sg.src, sg.shot, k[0]), BR(sg.src, sg.shot, k[1])) : BR(sg.src, sg.shot, k);
        const entry = { a: Math.max(sg.a, ta), b: tb, rect, label, same: last && last.label === label, prev: last, sg };
        tagSched.push(entry);
        if (!entry.same) ev(entry.a, 'tag', { shot: sg.shot });
        last = entry;
      }
    }
    const ROW0 = 640, ROWH = 64;
    CHAPTERS.forEach((c, ci) => {
      c.rows = [];
      for (const e of tagSched.filter(e => e.sg.ch === ci)) {
        let row = c.rows.find(r => r.label === e.label);
        if (!row) {
          row = { label: e.label, a: e.a, el: h('div', 'abs', layer) };
          row.el.innerHTML = `<span class="mk" style="position:absolute;left:0;top:14px;width:14px;height:14px;background:${C.ink4}"></span><span class="lb" style="position:absolute;left:32px;top:0;font-size:30px;font-weight:650;white-space:nowrap">${e.label}</span>`;
          row.y = ROW0 + c.rows.length * ROWH;
          at(row.el, COL.x, row.y);
          c.rows.push(row);
          TEXTS.push({ id: `row-${ci}-${c.rows.length}`, text: e.label, a: e.a + 0.16, b: c.b, el: row.el });
        }
        e.row = row;
      }
      TEXTS.push({ id: `ch-${ci}`, text: c.title, a: c.a - 0.1, b: c.b, el: title });
    });
    for (const c of CHAPTERS) for (const r of c.rows) r.w = r.el.querySelector('.lb').getBoundingClientRect().width;
    CHAPTERS.forEach((c, ci) => { ev(c.a - 0.3, 'chapter', { i: ci, part: c.part === 'GAID 허브' ? 'hub' : 'sys' }); if (ci > 0) ev(CHAPTERS[ci - 1].b, 'collapse'); });
    SEG.forEach((sg, i) => { if (i > 0 && SEG[i - 1].ch === sg.ch) ev(sg.a, 'cut', { example: sg.src !== SEG[i - 1].src }); });
    ev(DEMO_END, 'collapse');
    const frameSrc = (sg, local) => {
      const info = shotInfo(sg.src, sg.shot);
      const idx = clamp(Math.floor((sg.skip + local) * FPS + 1e-6), 0, info.frames - 1);
      return `capture-${sg.src}/${info.pattern.replace('%05d', String(idx).padStart(5, '0'))}`;
    };
    const setImg = (img, src) => { if (img.dataset.src !== src) { img.dataset.src = src; img.src = src; pending.push(img.decode().catch(() => {})); } };

    return t => {
      const first = CHAPTERS[0];
      const show = t >= first.a - 0.5 && t < DEMO_END + 0.4;
      layer.style.display = show ? '' : 'none';
      if (!show) return;
      let ci = CHAPTERS.findIndex((c, i) => t < (i + 1 < CHAPTERS.length ? CHAPTERS[i + 1].a - 0.3 : DEMO_END + 1));
      if (ci < 0) ci = CHAPTERS.length - 1;
      const c = CHAPTERS[ci];
      // window: expand from the cycle station (first chapter) or from a thin bar; collapse to a bar between chapters
      let o = 1, sx = 1, sy = 1, ox = 0, oy = 0;
      if (ci === 0 && t < c.a) {
        const p = ramp(t, c.a - 0.5, c.a, eio);
        const s0 = stPos(0);
        const cx = lerp(s0.x, TAKE.x + TAKE.w / 2, p), cy = lerp(s0.y, TAKE.y + TAKE.h / 2, p);
        sx = lerp(80 / TAKE.w, 1, p); sy = lerp(80 / TAKE.h, 1, p);
        ox = cx - (TAKE.x + TAKE.w / 2); oy = cy - (TAKE.y + TAKE.h / 2);
      } else if (t < c.a) sy = lerp(0.01, 1, ramp(t, c.a - 0.3, c.a, eo));
      const prevEnd = ci > 0 ? CHAPTERS[ci - 1].b : -1;
      if (ci > 0 && t >= prevEnd && t < c.a - 0.3) sy = lerp(1, 0.01, ramp(t, prevEnd, prevEnd + 0.22, ei));
      if (ci > 0 && t >= prevEnd + 0.22 && t < c.a - 0.3) o = 0;
      if (t >= DEMO_END) { sy = lerp(1, 0.01, ramp(t, DEMO_END, DEMO_END + 0.22, ei)); sx = lerp(1, 0, ramp(t, DEMO_END + 0.18, DEMO_END + 0.35, ei)); o = t < DEMO_END + 0.35 ? 1 : 0; }
      at(win2, TAKE.x, TAKE.y, TAKE.w, TAKE.h);
      win2.style.transformOrigin = '50% 50%';
      put(win2, { o, x: ox, y: oy, sx, sy });
      glow.style.opacity = o * Math.min(sx, sy);
      // shot and frame
      const segsC = SEG.filter(s => s.ch === ci);
      let si = segsC.findIndex(s => t < s.b);
      if (si < 0) si = segsC.length - 1;
      const sg = segsC[si];
      const local = clamp(t - sg.a, 0, sg.b - sg.a - 1 / FPS);
      setImg(imgB, frameSrc(sg, local));
      const prev = si > 0 ? segsC[si - 1] : null;
      const sw = prev ? seg(t, sg.a, sg.a + 0.45) : 1;
      if (prev && sw < 1) {
        setImg(imgA, frameSrc(prev, prev.b - prev.a - 1 / FPS));
        imgA.style.visibility = 'visible';
        const edge = lerp(-15, 115, eio(sw));
        imgB.style.webkitMaskImage = imgB.style.maskImage = `linear-gradient(100deg, #000 ${edge - 12}%, transparent ${edge}%)`;
        glint.style.background = `linear-gradient(100deg, rgba(255,255,255,0) ${edge - 14}%, rgba(255,255,255,0.18) ${edge - 6}%, rgba(255,255,255,0) ${edge + 1}%)`;
        glint.style.visibility = 'visible';
      } else {
        imgA.style.visibility = 'hidden';
        imgB.style.webkitMaskImage = imgB.style.maskImage = 'none';
        glint.style.visibility = 'hidden';
      }
      // example chip above the window (changes with the example)
      chip.textContent = EXAMPLE[sg.src];
      at(chip, TAKE.x, TAKE.y - 58);
      const chipIn = prev && prev.src !== sg.src ? ramp(t, sg.a, sg.a + 0.25) : ramp(t, c.a - 0.1, c.a + 0.15);
      put(chip, { o: chipIn * o, y: 8 * (1 - chipIn) });
      // left column: badge, purpose, rows
      const hin = ramp(t, c.a - 0.3, c.a);
      const hout = ramp(t, ci + 1 < CHAPTERS.length ? c.b : DEMO_END, (ci + 1 < CHAPTERS.length ? c.b : DEMO_END) + 0.2, lin);
      badge.textContent = c.part;
      badge.className = `badge ${c.part === 'GAID 허브' ? 'hub' : 'sys'}`;
      at(badge, COL.x, 260);
      put(badge, { o: clamp(hin * 1.5) * (1 - hout), x: -20 * (1 - hin) });
      title.textContent = c.title;
      at(title, COL.x, 330);
      const tin = ramp(t, c.a - 0.2, c.a + 0.15);
      put(title, { o: clamp(tin * 1.3) * (1 - hout), y: 18 * (1 - tin) });
      for (const [k, cc] of CHAPTERS.entries()) {
        for (const r of cc.rows) {
          if (k !== ci) { r.el.style.display = 'none'; continue; }
          r.el.style.display = '';
          const rin = ramp(t, r.a, r.a + 0.2);
          const cur = tagSched.find(e => e.row === r && t >= e.a && t < e.b);
          const on = !!cur && sw >= 1;
          r.el.querySelector('.lb').style.color = on ? C.ink : (t >= r.a ? C.ink3 : C.ink3);
          r.el.querySelector('.mk').style.background = on ? C.signal : C.ink4;
          put(r.el, { o: (t >= r.a ? clamp(rin * 1.4) : 0) * (1 - hout), x: -16 * (1 - rin) });
        }
      }
      // mini cycle position
      const prevSt = ci > 0 ? CHAPTERS[ci - 1].st : 0;
      const a0 = prevSt * 72, a1 = (c.back ? 5 : c.st) * 72;
      const ang = (-90 + lerp(a0, a1, ramp(t, c.a - 0.3, c.a + 0.2, eio))) * Math.PI / 180;
      mdot.setAttribute('cx', MC.x + MC.r * Math.cos(ang)); mdot.setAttribute('cy', MC.y + MC.r * Math.sin(ang));
      mdots.forEach((d, i) => d.setAttribute('stroke', i === c.st ? C.signalInk : C.ink3));
      // box on the take + leader line to the current row
      const cur = tagSched.find(e => t >= e.a && t < e.b && e.sg === sg);
      const mini = Math.min(ramp(t, first.a - 0.2, first.a + 0.2, lin), 1 - ramp(t, DEMO_END, DEMO_END + 0.3, lin));
      for (const el of [...mdots]) el.style.opacity = mini;
      mdot.style.opacity = mini;
      if (!cur || sw < 1 || sy < 0.99) { box.style.visibility = 'hidden'; leadLine.setAttribute('opacity', 0); leadDot.setAttribute('opacity', 0); return; }
      let r = cur.rect;
      if (cur.same && cur.prev) { const g = ramp(t, cur.a, cur.a + 0.3, eio); const p = cur.prev.rect; r = { x: lerp(p.x, r.x, g), y: lerp(p.y, r.y, g), width: lerp(p.width, r.width, g), height: lerp(p.height, r.height, g) }; }
      const pad = 5;
      const bx = clamp(r.x * KS - pad, 2, TAKE.w - 10), by = clamp(r.y * KS - pad, 2, TAKE.h - 10);
      const bw = Math.min(r.width * KS + 2 * pad, TAKE.w - bx - 2), bh = Math.min(r.height * KS + 2 * pad, TAKE.h - by - 2);
      at(box, bx, by, bw, bh);
      const pin = cur.same ? 1 : ramp(t, cur.a, cur.a + 0.2);
      box.style.visibility = 'visible'; box.style.opacity = pin;
      const row = cur.row;
      const x0 = COL.x + 32 + row.w + 18, y0 = row.y + 20;
      const x1 = TAKE.x + bx, y1 = TAKE.y + by + Math.min(bh / 2, 60);
      const xm = Math.min(x0 + 30, TAKE.x - 24);
      const grow = cur.same ? 1 : ramp(t, cur.a, cur.a + 0.25, eio);
      const pts = [[x0, y0], [xm, y0], [lerp(xm, x1, 1), y1]];
      const end = [lerp(x0, x1, grow), lerp(y0, y1, grow)];
      leadLine.setAttribute('points', grow < 1 ? `${x0},${y0} ${end[0]},${end[1]}` : pts.map(p => p.join(',')).join(' '));
      leadLine.setAttribute('opacity', 0.9 * pin);
      leadDot.setAttribute('cx', x1); leadDot.setAttribute('cy', y1);
      leadDot.setAttribute('opacity', grow >= 1 ? 1 : 0);
    };
  }

  // ================= S7 second brain (pull-back), S8 ending (put-away to the mark) =================
  function buildBrain() {
    const layer = h('div', 'layer', world);
    layer.style.zIndex = 4;
    const net = h('div', 'layer', layer);
    net.style.transformOrigin = '960px 560px';
    const svg = svgLayer(net);
    const rnd = mulberry(77);
    const CEN = { x: 960, y: 560 };
    // rings of researchers around the centre; the first is the one we followed
    const RINGS = [{ x: CEN.x, y: CEN.y, r: 300 }];
    for (let i = 0; i < 7; i++) {
      const a = (-90 + i * (360 / 7) + 20) * Math.PI / 180;
      RINGS.push({ x: CEN.x + 1700 * Math.cos(a), y: CEN.y + 1150 * Math.sin(a), r: 300 });
    }
    for (let i = 0; i < 6; i++) {
      const a = (i * 60 + 5) * Math.PI / 180;
      RINGS.push({ x: CEN.x + 3300 * Math.cos(a), y: CEN.y + 2200 * Math.sin(a), r: 300 });
    }
    const links = [];
    const linkLayer = sv('g', {}, svg);
    const ringEls = RINGS.map((R, i) => {
      const g = sv('g', {}, svg);
      sv('circle', { cx: R.x, cy: R.y, r: R.r, fill: 'none', stroke: C.sys, 'stroke-width': 10 }, g);
      sv('circle', { cx: R.x, cy: R.y, r: R.r, fill: 'none', stroke: C.signal, 'stroke-width': 12, transform: `rotate(-54 ${R.x} ${R.y})`, 'stroke-dasharray': `${2 * Math.PI * R.r * 144 / 360} 99999` }, g);
      const d = sv('circle', { r: 16, fill: C.mark }, g);
      sv('circle', { cx: R.x, cy: R.y, r: 70, fill: '#1b1f26', stroke: '#3a404b', 'stroke-width': 2 }, g);
      const u = sv('g', { transform: `translate(${R.x - 36} ${R.y - 36}) scale(3)`, color: C.ink2 }, g);
      u.innerHTML = ICON.user.replace(/<svg[^>]*>/, '').replace('</svg>', '');
      u.setAttribute('fill', 'none'); u.setAttribute('stroke', 'currentColor'); u.setAttribute('stroke-width', '2'); u.setAttribute('stroke-linecap', 'round'); u.setAttribute('stroke-linejoin', 'round');
      return { g, d, R, i };
    });
    // knowledge links between rings: papers (circle), Workflows (accent diamond), research notes (square)
    const kinds = ['paper', 'workflow', 'note'];
    for (let i = 1; i < RINGS.length; i++) {
      const A = RINGS[i], B = i < 8 ? RINGS[0] : RINGS[1 + ((i - 8) % 7)];
      const line = sv('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, stroke: '#3a404b', 'stroke-width': 6, 'stroke-dasharray': '18 16' }, linkLayer);
      const kind = kinds[i % 3];
      const sym = kind === 'paper' ? sv('circle', { r: 26, fill: '#e7e9ee', stroke: '#0b0d11', 'stroke-width': 6 }, svg)
        : kind === 'workflow' ? sv('rect', { x: -24, y: -24, width: 48, height: 48, fill: C.signal }, svg)
          : sv('rect', { x: -22, y: -22, width: 44, height: 44, fill: '#8a919e' }, svg);
      links.push({ line, sym, A, B, kind, i, ph: rnd() });
    }
    // the institute's knowledge at the centre: GAID mark plate
    const plate = h('div', 'panel raised', layer);
    plate.innerHTML = '<span class="headline" style="position:static;font-size:50px">KIGAM Second brain</span>';
    Object.assign(plate.style, { padding: '16px 40px', whiteSpace: 'nowrap' });
    const legend = h('div', 'abs', layer);
    Object.assign(legend.style, { left: '110px', top: '986px', display: 'flex', gap: '40px', alignItems: 'center' });
    legend.innerHTML = [
      ['<svg width="26" height="26"><circle cx="13" cy="13" r="9" fill="#e7e9ee" stroke="#0b0d11" stroke-width="3"/></svg>', '논문'],
      [`<svg width="26" height="26"><rect x="5" y="5" width="16" height="16" fill="${C.signal}" transform="rotate(45 13 13)"/></svg>`, 'Workflow'],
      ['<svg width="26" height="26"><rect x="5" y="5" width="16" height="16" fill="#8a919e"/></svg>', '연구노트'],
    ].map(([s, l]) => `<span style="display:flex;align-items:center;gap:12px">${s}<span class="label" style="font-size:28px;color:${C.ink}">${l}</span></span>`).join('');
    const A = T.brain[0], B = T.brain[1];
    const head = headline(layer, 110, 64, [
      [A + 0.3, A + 3.75, '연구자마다 고리가 돌면 지구과학 AI agent 생태계가 자랍니다'],
      [A + 3.85, B - 0.1, '논문, Workflow, 연구노트가 이어져 KIGAM의 Second brain이 됩니다'],
    ], 52);
    TEXTS.push({ id: 'plate', text: 'KIGAM Second brain', a: A + 4.2, b: B, el: plate });
    ev(A, 'brain');
    // pull-back keyed per bar in log space: 1 → 0.16 over the first three bars
    const keys = [[A, 1], [A + 2, 0.52], [A + 4, 0.3], [A + 6, 0.21]];
    const zoomAt = t => {
      if (t <= keys[0][0]) return 1;
      for (let i = 1; i < keys.length; i++) {
        if (t < keys[i][0]) { const u = eio(seg(t, keys[i - 1][0], keys[i][0])); return Math.exp(lerp(Math.log(keys[i - 1][1]), Math.log(keys[i][1]), u)); }
      }
      return keys[keys.length - 1][1];
    };
    ringEls.forEach((re, i) => { re.t0 = i === 0 ? A : A + 0.5 + (i < 8 ? (i - 1) * 0.25 : 2.5 + (i - 8) * 0.25); if (i > 0) ev(re.t0, 'ring', { i, pan: +((re.R.x - 960) / 3400).toFixed(3) }); });
    links.forEach(l => { l.t0 = ringEls[l.i].t0 + 0.25; });

    // ending: put-away one ring per beat, then the mark alone with the lockup
    const E0 = T.end[0];
    const L = lockup(layer);
    const sub = h('div', 'headline', layer, '지구과학 연구자를 위한 AI agent 연구 지원 플랫폼');
    Object.assign(sub.style, { width: '1920px', textAlign: 'center', fontSize: '46px', fontWeight: 600, color: C.ink2 });
    at(sub, 0, 660);
    const note = h('div', 'abs small', layer, '내부 검토용 영상');
    Object.assign(note.style, { width: '1840px', textAlign: 'right' });
    at(note, 0, 1010);
    TEXTS.push({ id: 'end-sub', text: sub.textContent, a: E0 + 1.6, b: DUR, el: sub });
    const order = ringEls.slice(1).map(r => r.i).reverse();
    order.forEach((ri, k) => { ringEls[ri].tOut = E0 - 1.0 + k * 0.08; });
    ringEls[0].tOut = E0 + 0.5;
    ev(E0 - 1.0, 'retract');
    ev(E0 + 0.5, 'final');
    ev(E0 + 1.0, 'logo');
    return t => {
      const show = t >= A - 0.05;
      layer.style.display = show ? '' : 'none';
      if (!show) return;
      head(t);
      const z = zoomAt(t);
      net.style.transform = `scale(${z})`;
      for (const re of ringEls) {
        const p = ramp(t, re.t0, re.t0 + 0.4);
        const outF = re.tOut != null ? ramp(t, re.tOut, re.tOut + 0.3, ei) : 0;
        re.g.setAttribute('opacity', (re.i === 0 ? ramp(t, A - 0.05, A + 0.15, lin) : clamp(p * 2)) * (1 - outF));
        re.g.setAttribute('transform', `translate(${re.R.x} ${re.R.y}) scale(${(re.i === 0 ? 1 : lerp(0.7, 1, back(p, 1.6))) * (1 - 0.7 * outF)}) translate(${-re.R.x} ${-re.R.y})`);
        const da = (-90 + 360 * ((t - A) * 0.18 + re.i * 0.13)) * Math.PI / 180;
        re.d.setAttribute('cx', re.R.x + re.R.r * Math.cos(da)); re.d.setAttribute('cy', re.R.y + re.R.r * Math.sin(da));
      }
      const fade = 1 - ramp(t, E0 - 1.0, E0 - 0.4, lin);
      for (const l of links) {
        const p = ramp(t, l.t0, l.t0 + 0.5, eio);
        const x2 = lerp(l.A.x, l.B.x, p), y2 = lerp(l.A.y, l.B.y, p);
        l.line.setAttribute('x2', x2); l.line.setAttribute('y2', y2);
        l.line.setAttribute('opacity', (t >= l.t0 ? 1 : 0) * fade);
        const u = ((t - l.t0) * 0.35 + l.ph) % 1;
        const sx = lerp(l.A.x, l.B.x, u), sy = lerp(l.A.y, l.B.y, u);
        l.sym.setAttribute('transform', `translate(${sx} ${sy})${l.kind === 'workflow' ? ' rotate(45)' : ''}`);
        l.sym.setAttribute('opacity', (t >= l.t0 + 0.5 ? 1 : 0) * fade);
      }
      // plate at the centre when the network is whole
      const pp = ramp(t, A + 4.0, A + 4.3);
      const pr = plate.getBoundingClientRect();
      at(plate, 960 - plate.offsetWidth / 2, 560 - plate.offsetHeight / 2);
      put(plate, { o: pp * (1 - ramp(t, E0 - 0.6, E0 - 0.3, lin)), s: lerp(0.9, 1, back(pp, 1.6)) });
      put(legend, { o: ramp(t, A + 2.2, A + 2.5, lin) * (1 - ramp(t, E0 - 0.6, E0 - 0.3, lin)) });
      // ending: the last ring shrinks into the mark at the centre; lockup letters wipe in
      const lp = ramp(t, E0 + 0.5, E0 + 1.0, eio);
      L.place(960 - (175 * 200 / 64) / 2 + 32 * 200 / 64, 480, 200);
      L.set({ o: t >= E0 + 0.5 ? ramp(t, E0 + 0.5, E0 + 0.7, lin) : 0, ringO: 1, gO: lp, lettersF: ramp(t, E0 + 0.9, E0 + 1.6, lin) });
      put(sub, { o: ramp(t, E0 + 1.5, E0 + 1.7, lin), y: 12 * (1 - ramp(t, E0 + 1.5, E0 + 1.75)) });
      put(note, { o: ramp(t, E0 + 1.8, E0 + 2.0, lin) });
    };
  }

  // ================= init =================
  async function init() {
    const names = ['plug', 'file-code', 'code-xml', 'folder-open', 'notebook-pen', 'git-branch', 'database', 'well-log', 'map-gis', 'library', 'share-2', 'workflow', 'user'];
    await Promise.all(names.map(async n => {
      const txt = await (await fetch(`icons/${n}.svg`)).text();
      ICON[n] = txt.replace(/width="24"/, 'width="100%"').replace(/height="24"/, 'height="100%"');
    }));
    const logo = new DOMParser().parseFromString(await (await fetch('brand/horizontal-on-dark.svg')).text(), 'image/svg+xml');
    const paths = [...logo.querySelectorAll('path')];
    LOGO = {
      ring: paths[0].getAttribute('d'), g: paths[1].getAttribute('d'),
      letters: paths.slice(2).map(p => ({ d: p.getAttribute('d'), transform: p.getAttribute('transform') })),
    };
    await document.fonts.load('700 40px Pretendard');
    await document.fonts.load('500 20px Pretendard');
    const drawers = [buildStage(), buildMess(), buildTitleCycle(), buildDemo(), buildBrain()];
    // link flyers back to their objects (built inside buildMess)
    ev(T.silence[0], 'silence');
    ev(DUR - 0.6, 'out');
    EV.sort((a, b) => a.t - b.t);
    window.DUR = DUR;
    window.EV = EV;
    window.CUES = {
      bpm: 120, hook: T.hook, tools: T.tools, freeze: T.freeze, press: T.press, chord: T.chord, title: T.title, cycle: T.cycle,
      demo: [CHAPTERS[0].a, DEMO_END], chapters: CHAPTERS.map(c => ({ a: c.a, b: c.b, part: c.part === 'GAID 허브' ? 'hub' : 'sys', st: c.st })),
      silence: T.silence, brain: T.brain, end: T.end, dur: DUR,
    };
    window.SEG = SEG;
    window.STILLS = {
      '01-work': 3.6, '02-scattered': 8.6, '03-freeze': 9.85, '04-snap': 11.4, '05-gathered': 12.9, '06-title': 16.5,
      '07-cycle': T.cycle[1] - 1.0,
      ...Object.fromEntries(CHAPTERS.map((c, i) => [`${String(i + 8).padStart(2, '0')}-ch${i + 1}`, +(Math.min(c.a + 2.2, c.b - 0.3)).toFixed(2)])),
      '14-network': T.brain[0] + 3.0, '15-second-brain': T.brain[1] - 0.6, '16-closing': DUR - 0.3,
    };
    window.TEXTS = t => TEXTS.filter(x => t >= x.a && t < x.b).map(x => {
      const r = x.el.getBoundingClientRect();
      return { id: x.id, text: x.text, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom };
    });
    window.TEXT_SPANS = TEXTS.map(x => ({ id: x.id, text: x.text, a: x.a, b: x.b }));
    window.render = async t => {
      pending.length = 0;
      camera(t);
      for (const d of drawers) d(t);
      await Promise.all(pending);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    };
    window.READY = true;
  }
  init().catch(e => { window.RENDER_ERROR = String((e && e.stack) || e); });
})();
