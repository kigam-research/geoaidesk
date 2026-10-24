/* GAID 45-second product film ("한 연구자의 하루", plan: ../PLAN.md). Code-only motion graphics; no app footage.
 * Deterministic: window.motion.frame(t) draws film second t. 96 BPM: beat 0.625 s, bar 2.5 s; every cut sits on the grid.
 */
(() => {
  'use strict';
  const stage = document.getElementById('stage');
  const NS = 'http://www.w3.org/2000/svg';
  const BLUE = '#1f5eff', INK = '#171b23', INK2 = '#525a68', INK3 = '#878f9d', EDGE = '#dce0e6', GREY = '#c3c9d2';
  const TINT = '#e8eeff', FACE2 = '#f6f7f9';
  const BEAT = 0.625, BAR = 2.5, DURATION = 45;
  const B = (bar, beat = 0) => (bar - 1) * BAR + beat * BEAT; // bar 1 beat 0 = 0 s

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lin = x => clamp(x);
  const out = x => 1 - Math.pow(1 - clamp(x), 4);
  const back = x => { x = clamp(x); const c = 1.6; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const inOut = x => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const ramp = (t, a, b, e = out) => e((t - a) / (b - a));
  const lerp = (a, b, v) => a + (b - a) * v;
  const win = (t, a, b, fi = 0.3, fo = 0.3) => Math.min(ramp(t, a, a + fi, lin), 1 - ramp(t, b - fo, b, lin));
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

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
  function svg(parent, w = 1920, hh = 1080) {
    const s = sv('svg', { width: w, height: hh }, parent);
    s.style.position = 'absolute'; s.style.left = '0px'; s.style.top = '0px'; s.style.overflow = 'visible';
    return s;
  }
  function put(el, { o = 1, x = 0, y = 0, s = 1, r = 0 } = {}) {
    el.style.opacity = o;
    el.style.display = o <= 0.002 ? 'none' : '';
    el.style.transform = `translate(${x}px,${y}px) scale(${s}) rotate(${r}deg)`;
  }
  // layers only fade (no transform) so they never become stacking contexts at full opacity
  function show(el, o) { el.style.opacity = o; el.style.display = o <= 0.002 ? 'none' : ''; }
  function box(el, x, y, w, hh) {
    Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: w == null ? '' : `${w}px`, height: hh == null ? '' : `${hh}px` });
    return el;
  }
  const ICON = {};
  const icon = (name, size = 28, color = INK2) => `<span class="icon" style="width:${size}px;height:${size}px;color:${color}">${ICON[name] || ''}</span>`;
  const ORBIT = (size, color = INK2, dot = BLUE) => `<svg width="${size * 1.5}" height="${size}" viewBox="0 0 30 20"><ellipse cx="15" cy="10" rx="13" ry="7" fill="none" stroke="${color}" stroke-width="2"/><circle cx="26" cy="12" r="3" fill="${dot}"/></svg>`;
  let LOGO = null;
  function lockup(parent, height, fill = BLUE) {
    const scale = height / 64;
    const s = sv('svg', { width: 175 * scale, height, viewBox: '0 0 175 64' });
    Object.assign(s.style, { position: 'absolute', overflow: 'visible' });
    parent.appendChild(s);
    const defs = sv('defs', {}, s);
    const id = `m${Math.random().toString(36).slice(2)}`;
    const mask = sv('mask', { id, maskUnits: 'userSpaceOnUse', x: -20, y: -20, width: 120, height: 104 }, defs);
    const sweep = sv('circle', { cx: 32, cy: 32, r: 22, fill: 'none', stroke: '#fff', 'stroke-width': 44, transform: 'rotate(-150 32 32)', pathLength: 1, 'stroke-dasharray': '0 1' }, mask);
    const ring = sv('g', { fill, mask: `url(#${id})` }, s);
    sv('path', { d: LOGO.ring, 'fill-rule': 'evenodd' }, ring);
    const g = sv('g', { fill }, s);
    sv('path', { d: LOGO.g, 'fill-rule': 'evenodd' }, g);
    const clipId = `c${Math.random().toString(36).slice(2)}`;
    const clipRect = sv('rect', { x: 70, y: -10, width: 0, height: 84 }, sv('clipPath', { id: clipId }, defs));
    const letters = sv('g', { fill, 'clip-path': `url(#${clipId})` }, s);
    for (const l of LOGO.letters) sv('path', { d: l.d, transform: l.transform }, letters);
    return {
      svg: s, scale, width: 175 * scale,
      set({ ringF = 1, gO = 1, gS = 1, lettersF = 1 }) {
        sweep.setAttribute('stroke-dasharray', `${ringF} 1`);
        g.setAttribute('opacity', gO);
        g.setAttribute('transform', `translate(32 32) scale(${gS}) translate(-32 -32)`);
        clipRect.setAttribute('width', 110 * lettersF);
      },
      at(cx, cy) { s.style.left = `${cx - 32 * scale}px`; s.style.top = `${cy - 32 * scale}px`; },
    };
  }

  // ---------- shared actors ----------
  const drawers = [];
  const scene = build => drawers.push(build);

  // the researcher: head + shoulders, drawn in the 계측 line style
  function person(parent, size = 1, color = INK2, fill = '#ffffff') {
    const g = sv('g', {}, parent);
    sv('circle', { cx: 0, cy: -58 * size, r: 24 * size, fill, stroke: color, 'stroke-width': 4 }, g);
    sv('path', { d: `M ${-44 * size} 0 Q ${-44 * size} ${-30 * size} ${-20 * size} ${-30 * size} L ${20 * size} ${-30 * size} Q ${44 * size} ${-30 * size} ${44 * size} 0 Z`, fill, stroke: color, 'stroke-width': 4, 'stroke-linejoin': 'round' }, g);
    return g;
  }

  // ===== base: chrome ground, beat scale, time of day =====
  scene(() => {
    const layer = h('div', 'layer');
    const s = svg(layer);
    const y = 1048;
    sv('line', { x1: 96, x2: 1824, y1: y, y2: y, stroke: '#d5dae1', 'stroke-width': 3 }, s);
    for (let k = 0; k <= 18; k++) {
      const x = lerp(96, 1824, k / 18);
      sv('line', { x1: x, x2: x, y1: y - (k % 2 ? 8 : 16), y2: y, stroke: '#aab1bc', 'stroke-width': 2 }, s);
    }
    const run = sv('line', { x1: 96, x2: 96, y1: y, y2: y, stroke: BLUE, 'stroke-width': 3 }, s);
    // time of day: a small sun arc and a word
    const tod = h('div', 'abs tod', layer);
    box(tod, 96, 44);
    const arc = svg(tod, 120, 60);
    sv('path', { d: 'M 6 52 A 54 44 0 0 1 114 52', fill: 'none', stroke: GREY, 'stroke-width': 3 }, arc);
    sv('line', { x1: 0, x2: 120, y1: 52, y2: 52, stroke: GREY, 'stroke-width': 3 }, arc);
    const sun = sv('circle', { r: 9, fill: BLUE }, arc);
    const word = h('div', 'abs tod-word', tod);
    box(word, 138, 18);
    const DAY = [[0, 5, '아침', 0.12], [10, 20, '오전', 0.35], [20, 27.5, '오후', 0.6], [32.5, 37.5, '저녁', 0.86], [37.5, 41.25, '밤', 1]];
    return t => {
      run.setAttribute('x2', lerp(96, 1824, clamp(t / DURATION)));
      const d = DAY.find(([a, b]) => t >= a && t < b);
      put(tod, { o: d ? win(t, d[0], d[1], 0.25, 0.25) : 0 });
      if (!d) return;
      word.textContent = d[2];
      const p = d[3], a = Math.PI * (1 - p);
      sun.setAttribute('cx', 60 + 54 * Math.cos(a));
      sun.setAttribute('cy', 52 - 44 * Math.sin(a));
      sun.setAttribute('fill', d[2] === '밤' ? INK2 : BLUE);
    };
  });

  // ===== the desk (researcher + shelf), alive from the hook to the evening =====
  const DESK = { px: 236, py: 960 }; // researcher's feet
  const SHELF = { x: 96, y: 250, w: 470, rowH: 86 };
  const ROWS = [
    ['library', '서재'], ['code-xml', '스킬과 도구'], ['workflow', 'Workflow'], ['map-gis', '자료와 지도'], ['notebook-pen', '연구노트'],
  ];
  const rowY = i => SHELF.y + 104 + i * SHELF.rowH + (SHELF.rowH - 16) / 2; // centre of row i (compact shelf)
  let deskShelf = null; // filled by the gather scene

  // ===== caption: one line (or two) per scene, top centre =====
  const CAPTIONS = [
    { a: 0.6, b: 4.8, lines: ['자료는 여기, 논문은 저기, 코드는 또 따로'] },
    { a: 7.2, b: 9.8, lines: ['GAID에 모두 모입니다'] },
    { a: 10.6, b: 19.7, lines: ['논문 속 방법이', 'AI agent가 따르는 Workflow가 됩니다'], second: 13.1 },
    { a: 20.6, b: 27.2, lines: ['내 자료에 바로 적용합니다'] },
    { a: 27.9, b: 32.2, lines: ['동료와 함께 쓰고, 쓸수록 나아집니다'], white: true },
    { a: 32.9, b: 37.3, lines: ['결과와 근거는 연구노트로 남습니다'] },
    { a: 37.8, b: 41.1, lines: ['연구가 쌓여 KIGAM의 Second brain이 됩니다'] },
  ];

  // ===== S1 hook (bars 1–2): the desk buried under scattered work =====
  const FRAGS = [];
  scene(() => {
    const layer = h('div', 'layer');
    const s = svg(layer);
    const desk = sv('g', {}, s);
    sv('line', { x1: 96, x2: 1824, y1: DESK.py + 2, y2: DESK.py + 2, stroke: INK3, 'stroke-width': 3 }, desk);
    const me = person(s, 1.4);
    me.setAttribute('transform', `translate(${DESK.px} ${DESK.py})`);
    const KINDS = ['pdf', 'code', 'table', 'map', 'chip'];
    const CHIPS = ['geopandas', 'MCP 서버', 'GitHub 저장소', 'well-log-qc-quicklook', 'geo-map-and-crs', '개인 폴더', '기관 자료'];
    const FILES = { code: ['MOESM1_ESM.py', 'inversion.py', 'plot_map.py'], table: ['core_samples.csv', 'aeromag_lines.csv', 'boreholes.csv'], pdf: ['논문 PDF'], map: ['dem.tif', 'geology.shp'] };
    seed = 11;
    for (let i = 0; i < 30; i++) {
      const kind = KINDS[i % 5];
      const el = h('div', `abs frag ${kind === 'chip' ? 'chipcard' : 'face'}`, layer);
      let w = 0, hh = 0;
      if (kind === 'pdf') {
        w = 150; hh = 196;
        el.innerHTML = `<div class="ftag">PDF</div>${Array.from({ length: 8 }, (_, k) => `<i style="width:${[100, 86, 104, 70, 96, 88, 104, 60][k]}px"></i>`).join('')}`;
      } else if (kind === 'code') {
        w = 260; hh = 150;
        const name = FILES.code[(i / 5 | 0) % 3];
        el.innerHTML = `<div class="fname">${icon('file-code', 20, INK2)}${name}</div>${Array.from({ length: 5 }, (_, k) => `<b style="margin-left:${[0, 18, 18, 36, 0][k]}px;width:${[120, 150, 90, 130, 70][k]}px;background:${k % 2 ? BLUE : GREY}"></b>`).join('')}`;
      } else if (kind === 'table') {
        w = 230; hh = 140;
        const name = FILES.table[(i / 5 | 0) % 3];
        el.innerHTML = `<div class="fname">${icon('table-2', 20, INK2)}${name}</div><div class="grid">${Array.from({ length: 16 }, (_, k) => `<span class="${k < 4 ? 'hd' : ''}"></span>`).join('')}</div>`;
      } else if (kind === 'map') {
        w = 200; hh = 160;
        const name = FILES.map[(i / 5 | 0) % 2];
        const pts = k => { const p = []; for (let a = 0; a <= 360; a += 20) { const r = 18 + k * 16 + 5 * Math.sin(a / 25 + k); p.push(`${(100 + r * 1.3 * Math.cos(a * Math.PI / 180)).toFixed(1)},${(84 + r * 0.8 * Math.sin(a * Math.PI / 180)).toFixed(1)}`); } return p.join(' '); };
        el.innerHTML = `<div class="fname">${icon('map', 20, INK2)}${name}</div><svg width="200" height="130" style="position:absolute;left:0;top:30px">${[0, 1, 2, 3].map(k => `<polygon points="${pts(k)}" fill="none" stroke="${k === 0 ? BLUE : GREY}" stroke-width="2"/>`).join('')}</svg>`;
      } else {
        const name = CHIPS[(i / 5 | 0) % CHIPS.length];
        el.innerHTML = `${icon('plug', 22, INK2)}<span>${name}</span>`;
        w = 40 + name.length * 15; hh = 52;
      }
      box(el, 0, 0, kind === 'chip' ? null : w, kind === 'chip' ? null : hh);
      const tx = 500 + rnd() * 1250, ty = 330 + rnd() * 540;
      FRAGS.push({ el, kind, w, hh, tx, ty, rot: (rnd() - 0.5) * 34, at: 0.15 + i * 0.12, ph: rnd() * 6.28, shelf: { pdf: 0, code: 1, chip: 1, table: 3, map: 3 }[kind] });
    }
    return t => {
      const o = t < 5.4 || (t >= 6.5 && t < 10) ? 1 : 0;
      show(layer, o);
      if (!o) return;
      me.setAttribute('opacity', t < 5.4 ? ramp(t, 0, 0.3, lin) : 0);
      desk.setAttribute('opacity', t < 5.4 ? 1 : 0);
      if (t >= 5.4) return; // the gather scene moves the pieces
      for (const f of FRAGS) {
        const d = ramp(t, f.at, f.at + 0.55, back);
        const shake = t > 3.75 ? 5 * Math.sin(t * 40 + f.ph) * ramp(t, 3.75, 4.9, lin) : 0;
        const bob = 6 * Math.sin(t * 1.7 + f.ph);
        put(f.el, { o: ramp(t, f.at, f.at + 0.12, lin), x: f.tx - f.w / 2 + shake, y: lerp(-260, f.ty - f.hh / 2, d) + bob, r: f.rot * d + shake * 0.3, s: 1 });
      }
    };
  });

  // ===== S2 stamp and gather (bars 3–4): blue field, GAID mark, pieces snap onto five shelves =====
  scene(() => {
    const layer = h('div', 'layer');
    // the shelf panel (big at first, compact desk shelf afterwards)
    const s = svg(layer);
    const panel = h('div', 'face shelf', layer);
    const BIG = { x: 640, y: 236, w: 1080, rowH: 116 };
    const rows = ROWS.map(([ic, name], i) => {
      const r = h('div', 'shelfrow', panel);
      r.innerHTML = `<span class="ic">${icon(ic, 40, INK2)}</span><span class="nm">${name}</span><span class="pills"></span>`;
      return { el: r, i, ic: r.querySelector('.ic'), pills: r.querySelector('.pills'), lit: 0 };
    });
    deskShelf = { panel, rows };
    // one pill per kind on its shelf (the other pieces only fly in)
    const LABEL = { pdf: '논문', code: '코드', chip: '도구', table: '표', map: '지도' };
    const seen = new Set();
    FRAGS.forEach(f => { if (!seen.has(f.kind)) { seen.add(f.kind); f.pill = h('span', 'pill', rows[f.shelf].pills, LABEL[f.kind]); } });
    const me = person(s, 1.4);
    me.setAttribute('transform', `translate(${DESK.px} ${DESK.py})`);
    const deskLine = sv('line', { x1: 96, x2: 1824, y1: DESK.py + 2, y2: DESK.py + 2, stroke: INK3, 'stroke-width': 3 }, s);
    const mark = lockup(layer, 150);
    const orbitEl = sv('ellipse', { cx: 960, cy: 560, rx: 520, ry: 250, fill: 'none', stroke: GREY, 'stroke-width': 2.5, 'stroke-dasharray': '6 10' }, s);
    // blue field + white stamp
    const field = h('div', 'blue', stage);
    field.style.zIndex = 10; // above the flying pieces (z 5)
    const stamp = lockup(field, 210, '#ffffff');
    stamp.at(960 - 0, 540);
    return t => {
      // field: wipe in 5.0–5.3, stamp 5.3–6.25, contract to a circle 6.5–7.15
      const fo = t >= 4.95 && t < 7.2 ? 1 : 0;
      field.style.display = fo ? '' : 'none';
      if (fo) {
        const wipe = ramp(t, 5.0, 5.3, inOut);
        const shrink = ramp(t, 6.5625, 7.1875, inOut);
        const r = lerp(1200, 0, shrink);
        field.style.clipPath = shrink > 0 ? `circle(${r}px at 960px 540px)` : `inset(0 ${100 - wipe * 100}% 0 0)`;
        const si = ramp(t, 5.3, 6.1);
        stamp.set({ ringF: ramp(t, 5.3, 6.0, inOut), gO: ramp(t, 5.35, 5.6, lin), gS: lerp(1.25, 1, si), lettersF: ramp(t, 5.6, 6.2, inOut) });
        stamp.svg.style.left = `${960 - stamp.width / 2}px`;
        stamp.svg.style.top = `${540 - 32 * stamp.scale}px`;
      }
      const o = t >= 6.5 && t < 37.5 ? 1 - ramp(t, 37.1, 37.5, lin) : 0;
      show(layer, o);
      if (!o) return;
      // the mark sits at the centre while pieces orbit, then moves to the panel header
      const toPanel = ramp(t, 8.1, 8.9, inOut);
      const cmpM = ramp(t, 9.8, 10.6, inOut);
      mark.at(lerp(lerp(960, BIG.x + 56, toPanel), SHELF.x + 44, cmpM), lerp(lerp(560, BIG.y + 50, toPanel), SHELF.y + 50, cmpM));
      mark.svg.style.width = `${175 * mark.scale}px`;
      const ms = lerp(lerp(1, 0.42, toPanel), 0.3, cmpM);
      mark.svg.style.transformOrigin = `${32 * mark.scale}px ${32 * mark.scale}px`;
      mark.svg.style.transform = `scale(${ms})`;
      mark.svg.style.opacity = t < 6.6 ? 0 : 1;
      mark.set({ ringF: 1, gO: 1, gS: 1, lettersF: ramp(t, 8.4, 8.9, inOut) });
      orbitEl.setAttribute('opacity', win(t, 6.8, 8.4, 0.3, 0.4) * 0.9);
      me.setAttribute('opacity', 1);
      deskLine.setAttribute('opacity', 1);
      // pieces: from their pile into the orbit (6.7–7.5), around (7.5–8.1), onto the shelves (8.2–9.3)
      FRAGS.forEach((f, i) => {
        const ang = (i / FRAGS.length) * Math.PI * 2 + (t - 6.7) * 0.9;
        const ox = 960 + 520 * Math.cos(ang), oy = 560 + 250 * Math.sin(ang);
        const inOrbit = ramp(t, 6.7, 7.5, inOut);
        const toShelf = ramp(t, 8.25 + (i % 10) * 0.05, 8.95 + (i % 10) * 0.05, inOut);
        const sx = BIG.x + 640, sy = BIG.y + 150 + f.shelf * BIG.rowH;
        const x = lerp(lerp(f.tx, ox, inOrbit), sx, toShelf), y = lerp(lerp(f.ty, oy, inOrbit), sy, toShelf);
        const sc = lerp(lerp(1, 0.42, inOrbit), 0.18, toShelf);
        const fo2 = t < 10 ? (1 - ramp(toShelf, 0.75, 0.95, lin)) : 0;
        f.el.style.zIndex = 5;
        put(f.el, { o: t >= 6.6 && t < 10 ? fo2 : 0, x: x - f.w / 2, y: y - f.hh / 2, r: f.rot * (1 - inOrbit), s: sc });
        if (f.pill) put(f.pill, { o: ramp(toShelf, 0.85, 1, lin), s: lerp(0.7, 1, ramp(toShelf, 0.85, 1)) });
      });
      // panel: appears 7.6, big until 9.8, then compacts to the desk shelf (9.8–10.6)
      const pin = ramp(t, 7.6, 8.2);
      const cmp = ramp(t, 9.8, 10.6, inOut);
      const P = { x: lerp(BIG.x, SHELF.x, cmp), y: lerp(BIG.y, SHELF.y, cmp), w: lerp(BIG.w, SHELF.w, cmp), rowH: lerp(BIG.rowH, SHELF.rowH, cmp) };
      box(panel, P.x, P.y, P.w, 120 + P.rowH * 5);
      put(panel, { o: pin * (t < 37.6 ? 1 : 0), s: lerp(0.97, 1, pin) });
      rows.forEach(r => {
        box(r.el, 24, 104 + r.i * P.rowH, P.w - 48, P.rowH - 16);
        const rin = ramp(t, 7.8 + r.i * 0.1, 8.3 + r.i * 0.1);
        put(r.el, { o: rin, x: 20 * (1 - rin) });
        r.pills.style.opacity = 1 - cmp;
        const full = FRAGS.some(f => f.shelf === r.i) && t > 8.9;
        const on = full || r.lit > 0;
        r.el.style.borderColor = on ? BLUE : EDGE;
        r.ic.style.color = on ? BLUE : INK2;
      });
    };
  });

  // ===== S3 morning (bars 5–8): a paper becomes a Workflow the AI agent follows =====
  const STEPS = ['자료 준비', '처리·모델링', '평가', '해석·결과'];
  const WF = { x: 1240, y: 320, w: 560, stepH: 116 };
  scene(() => {
    const layer = h('div', 'layer');
    const page = h('div', 'face page', layer);
    const PG = { x: 640, y: 300, w: 500, h: 640 };
    box(page, PG.x, PG.y, PG.w, PG.h);
    page.innerHTML = `<div class="ptitle">${icon('file-text', 30, INK)}<span>논문</span></div>`;
    const lines = [];
    const HL = [2, 5, 8, 11];
    for (let k = 0; k < 14; k++) {
      const w = [380, 420, 360, 400, 300, 420, 390, 350, 410, 260, 400, 380, 330, 300][k];
      const y = 110 + k * 40;
      const hl = h('div', 'abs hlbar', page); box(hl, 34, y - 9, 0, 30);
      const ln = h('div', 'abs txline', page); box(ln, 40, y, w, 12);
      lines.push({ hl, ln, w, y });
    }
    const wf = h('div', 'face wf', layer);
    box(wf, WF.x, WF.y, WF.w, 110 + WF.stepH * 4);
    wf.innerHTML = `<div class="wftitle">${icon('workflow', 32, BLUE)}<span>Workflow</span></div>`;
    const steps = STEPS.map((name, i) => {
      const el = h('div', 'step', wf);
      box(el, 32, 92 + i * WF.stepH, WF.w - 64, WF.stepH - 26);
      el.innerHTML = `<span class="num">${i + 1}</span><span>${name}</span>`;
      return el;
    });
    const s = svg(layer);
    const arrows = STEPS.slice(1).map((_, i) => sv('path', { d: `M ${WF.x + 70} ${WF.y + 92 + i * WF.stepH + WF.stepH - 26} l 0 26`, stroke: GREY, 'stroke-width': 3 }, s));
    const flyers = HL.map(() => { const f = h('div', 'abs flyer', layer); return f; });
    const agent = h('div', 'abs agent', layer, ORBIT(46, BLUE));
    const paperChip = h('div', 'abs pill big', layer, `${icon('file-text', 24, BLUE)}<span>논문</span>`);
    return t => {
      const o = t >= 10 && t < 20.3 ? 1 : 0;
      show(layer, o);
      if (!o) return;
      // the paper leaves the 서재 row (10.0–10.6) and opens into a page (10.6–11.25)
      const lift = ramp(t, 10.0, 10.6, inOut);
      const open = ramp(t, 10.6, 11.25, out);
      box(paperChip, lerp(SHELF.x + 300, PG.x + PG.w / 2 - 60, lift), lerp(rowY(0) - 24, PG.y + PG.h / 2 - 24, lift));
      put(paperChip, { o: lift > 0 ? 1 - open : 0 });
      const leave = ramp(t, 14.4, 15.0, inOut);
      put(page, { o: open * (1 - leave), s: lerp(0.4, 1, open) * lerp(1, 0.85, leave), x: -60 * leave });
      // highlights on the beat (11.25, 11.875, 12.5, 13.125)
      HL.forEach((k, j) => {
        const a = 11.25 + j * BEAT;
        lines[k].hl.style.width = `${(lines[k].w + 12) * ramp(t, a, a + 0.4, inOut)}px`;
      });
      // highlighted lines fly to the Workflow and become steps (13.75 + j/4 beat)
      const wfIn = ramp(t, 13.4, 14.0);
      put(wf, { o: wfIn * (1 - ramp(t, 19.4, 19.85, lin)), x: 40 * (1 - wfIn) });
      HL.forEach((k, j) => {
        const a = 13.75 + j * BEAT * 0.5, f = ramp(t, a, a + BEAT, inOut); // lands on the grid
        const fl = flyers[j];
        const sx = PG.x + 34, sy = PG.y + lines[k].y - 9, sw = lines[k].w + 12;
        const tx = WF.x + 32, ty = WF.y + 92 + j * WF.stepH, tw = WF.w - 64;
        box(fl, lerp(sx, tx, f), lerp(sy, ty, f), lerp(sw, tw, f), lerp(30, WF.stepH - 26, f));
        put(fl, { o: t >= a && f < 1 ? 1 : 0 });
        put(steps[j], { o: f >= 1 ? 1 : 0, s: f >= 1 ? lerp(1.06, 1, ramp(t, a + BEAT, a + BEAT + 0.25)) : 1 });
      });
      arrows.forEach((ar, i) => ar.setAttribute('opacity', ramp(t, 14.7 + i * 0.1, 15.0 + i * 0.1, lin) * (1 - ramp(t, 19.4, 19.85, lin))));
      // the AI agent follows the steps on the beat: 15.625, 16.25, 16.875, 17.5; stays on the last
      const passes = [15.625, 16.25, 16.875, 17.5];
      let at = -1;
      passes.forEach((p, i) => { if (t >= p) at = i; });
      const ag = ramp(t, 15.0, 15.5, lin) * (1 - ramp(t, 19.3, 19.7, lin));
      const from = Math.max(0, at), prevAt = Math.max(0, at - 1);
      const mv = at >= 1 ? ramp(t, passes[at] - 0.25, passes[at], inOut) : 1;
      const yy = lerp(prevAt, from, mv);
      box(agent, WF.x + WF.w - 120, WF.y + 92 + yy * WF.stepH + (WF.stepH - 26) / 2 - 23);
      put(agent, { o: ag });
      steps.forEach((el, i) => {
        const lit = i <= at && t >= 15.625;
        el.classList.toggle('lit', lit);
      });
    };
  });

  // ===== S4 afternoon (bars 9–11): my data into the Workflow, a map draws itself =====
  const MAP = { x: 1080, y: 250, w: 740, h: 640, cols: 26, rows: 22 };
  const CELLS = [];
  {
    seed = 23;
    const bumps = Array.from({ length: 6 }, () => ({ x: 0.15 + rnd() * 0.7, y: 0.15 + rnd() * 0.7, s: 0.08 + rnd() * 0.12, a: 0.5 + rnd() * 0.6 }));
    const field = (u, v) => bumps.reduce((acc, b) => acc + b.a * Math.exp(-((u - b.x) ** 2 + (v - b.y) ** 2) / (2 * b.s * b.s)), 0);
    for (let r = 0; r < MAP.rows; r++) for (let c = 0; c < MAP.cols; c++) {
      const u = (c + 0.5) / MAP.cols, v = (r + 0.5) / MAP.rows, val = field(u, v);
      if (val > 0.32) CELLS.push({ r, c, val, d: (c + r * 0.6) / (MAP.cols + MAP.rows * 0.6) });
    }
    MAP.field = field;
  }
  function drawMap(parent, w, hh) {
    const s = sv('svg', { width: w, height: hh, viewBox: `0 0 ${MAP.w} ${MAP.h}` }, parent);
    s.style.position = 'absolute';
    sv('rect', { x: 0, y: 0, width: MAP.w, height: MAP.h, fill: '#f2f3f6' }, s);
    // contours: marching-squares-free sketch — iso-lines approximated by rings around the bumps
    const contours = [];
    for (const lev of [0.18, 0.35, 0.55, 0.8]) {
      const pts = [];
      for (let r = 0; r < 44; r++) for (let c = 0; c < 52; c++) {
        const u = c / 52, v = r / 44, a = MAP.field(u, v), b = MAP.field(u + 1 / 52, v), d = MAP.field(u, v + 1 / 44);
        if ((a - lev) * (b - lev) < 0) pts.push([(u + 0.5 / 52) * MAP.w, v * MAP.h]);
        if ((a - lev) * (d - lev) < 0) pts.push([u * MAP.w, (v + 0.5 / 44) * MAP.h]);
      }
      const g = sv('g', { fill: INK3, opacity: 0 }, s);
      for (const [x, y] of pts) sv('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 1.8 }, g);
      contours.push(g);
    }
    const cw = MAP.w / MAP.cols, ch = MAP.h / MAP.rows;
    const cells = CELLS.map(cl => sv('rect', { x: cl.c * cw + 1, y: cl.r * ch + 1, width: cw - 2, height: ch - 2, fill: cl.val > 0.8 ? '#1d4fd8' : cl.val > 0.55 ? '#5a86ff' : '#b8cbff', opacity: 0 }, s));
    return { s, contours, cells };
  }
  scene(() => {
    const layer = h('div', 'layer');
    // compact Workflow card (left of the map)
    const wf = h('div', 'face wf small', layer);
    const CW = { x: 640, y: 330, w: 380 };
    box(wf, CW.x, CW.y, CW.w, 80 + 4 * 74);
    wf.innerHTML = `<div class="wftitle">${icon('workflow', 26, BLUE)}<span>Workflow</span></div>`;
    const steps = STEPS.map((name, i) => {
      const el = h('div', 'step small', wf);
      box(el, 20, 70 + i * 74, CW.w - 40, 58);
      el.innerHTML = `<span class="num">${i + 1}</span><span>${name}</span>`;
      return el;
    });
    const data = h('div', 'abs pill big', layer, `${icon('table-2', 26, BLUE)}<span>내 자료</span>`);
    const mapFace = h('div', 'face mapface', layer);
    box(mapFace, MAP.x, MAP.y, MAP.w, MAP.h);
    const m = drawMap(mapFace, MAP.w, MAP.h);
    const s = svg(layer);
    const link = sv('path', { d: `M ${CW.x + CW.w} ${CW.y + 190} C ${CW.x + CW.w + 40} ${CW.y + 190} ${MAP.x - 40} ${MAP.y + MAP.h / 2} ${MAP.x} ${MAP.y + MAP.h / 2}`, fill: 'none', stroke: BLUE, 'stroke-width': 3, pathLength: 1, 'stroke-dasharray': '0 1' }, s);
    const agent = h('div', 'abs agent', layer, ORBIT(36, BLUE));
    return t => {
      const o = t >= 19.9 && t < 27.9 ? 1 : 0;
      show(layer, o);
      if (!o) return;
      const ci = ramp(t, 19.95, 20.5);
      put(wf, { o: ci * (1 - ramp(t, 27.2, 27.6, lin)), x: 60 * (1 - ci) });
      // 내 자료: from the researcher (20.625) into the Workflow (21.25)
      const fly = ramp(t, 20.625, 21.25, inOut);
      box(data, lerp(DESK.px + 70, CW.x + CW.w / 2 - 80, fly), lerp(DESK.py - 150, CW.y - 64, fly) - 120 * Math.sin(Math.PI * fly));
      put(data, { o: ramp(t, 20.3, 20.6, lin) * (1 - ramp(t, 27.2, 27.6, lin)), s: fly >= 1 ? lerp(1.12, 1, ramp(t, 21.25, 21.6)) : 1 });
      // the map: face 21.875, contours 21.875–23.4, cells sweep 23.75–26.25 with the agent on the steps
      const mi = ramp(t, 21.6, 22.2);
      put(mapFace, { o: mi * (1 - ramp(t, 27.2, 27.6, lin)), s: lerp(0.96, 1, mi) });
      link.setAttribute('stroke-dasharray', `${ramp(t, 21.4, 22.0, inOut)} 1`);
      link.setAttribute('opacity', 1 - ramp(t, 27.2, 27.6, lin));
      m.contours.forEach((g, k) => g.setAttribute('opacity', ramp(t, 21.875 + k * 0.38, 22.3 + k * 0.38, lin)));
      m.cells.forEach((el, k) => el.setAttribute('opacity', ramp(t, 23.75 + CELLS[k].d * 2.5, 23.95 + CELLS[k].d * 2.5, lin) * 0.95));
      const passes = [23.75, 24.375, 25.0, 25.625];
      let at = -1;
      passes.forEach((p, i) => { if (t >= p) at = i; });
      steps.forEach((el, i) => el.classList.toggle('lit', i <= at));
      box(agent, CW.x + CW.w - 78, CW.y + 70 + Math.max(0, at) * 74 + 11);
      put(agent, { o: at >= 0 ? 1 - ramp(t, 27.0, 27.4, lin) : 0 });
    };
  });

  // ===== S5 the hub (bars 12–13): blue field, colleagues take it, version 0.1.0 → 0.1.1 =====
  scene(() => {
    const field = h('div', 'blue', stage);
    const s = svg(field);
    const hub = h('div', 'abs hubword', field, `${icon('share-2', 34, '#ffffff')}<span>GAID 허브</span>`);
    box(hub, 0, 300, 1920);
    const card = h('div', 'face hubcard', field);
    const CD = { x: 760, y: 420, w: 400, h: 230 };
    box(card, CD.x, CD.y, CD.w, CD.h);
    card.innerHTML = `<div class="wftitle">${icon('workflow', 30, BLUE)}<span>Workflow</span></div>${STEPS.map((n, i) => `<div class="mini"><span class="num">${i + 1}</span>${n}</div>`).join('')}`;
    const chip = h('div', 'abs verchip', field);
    const PEERS = [[330, 470], [470, 800], [1450, 800], [1590, 470]];
    const peers = PEERS.map(([x, y], i) => {
      const g = person(s, 1.1, '#ffffff', BLUE);
      g.setAttribute('transform', `translate(${x} ${y + 60})`);
      const copy = h('div', 'abs peercard', field, `${icon('workflow', 22, BLUE)}`);
      const line = sv('line', { x1: CD.x + CD.w / 2, y1: CD.y + CD.h / 2, x2: x, y2: y, stroke: '#ffffff', 'stroke-width': 2.5, 'stroke-dasharray': '8 8' }, s);
      s.insertBefore(line, s.firstChild);
      return { g, copy, line, x, y, i };
    });
    const plus = h('div', 'abs plus', field, '+');
    return t => {
      const on = t >= 27.45 && t < 32.55;
      field.style.display = on ? '' : 'none';
      if (!on) return;
      const wipe = ramp(t, 27.5, 27.85, inOut), outW = ramp(t, 32.2, 32.5, inOut);
      field.style.clipPath = `inset(${(1 - wipe) * 100}% 0 0 0)`;
      if (outW > 0) field.style.clipPath = `inset(0 0 ${outW * 100}% 0)`;
      put(hub, { o: ramp(t, 27.9, 28.2, lin), y: 10 * (1 - ramp(t, 27.9, 28.3)) });
      const ci = ramp(t, 27.75, 28.2, back);
      put(card, { o: ramp(t, 27.75, 27.95, lin), s: lerp(0.7, 1, ci) });
      // colleagues appear on beats (28.125 …), copies travel out (28.75–29.4), lines show the link
      peers.forEach(p => {
        const a = 28.125 + p.i * BEAT * 0.5;
        p.g.setAttribute('opacity', ramp(t, a, a + 0.25, lin));
        const f = ramp(t, 28.75 + p.i * 0.08, 29.4 + p.i * 0.08, inOut);
        box(p.copy, lerp(CD.x + CD.w / 2, p.x + 50, f) - 28, lerp(CD.y + CD.h / 2, p.y - 70, f) - 28, 56, 56);
        put(p.copy, { o: f > 0 ? 1 : 0, s: lerp(0.6, 1, f) });
        p.line.setAttribute('opacity', ramp(t, 28.75, 29.2, lin) * 0.6);
      });
      // one improvement comes back from the right colleague (30.0–30.6); the version ticks on 30.625
      const back2 = ramp(t, 30.0, 30.6, inOut);
      const P = peers[3];
      box(plus, lerp(P.x + 50, CD.x + CD.w - 10, back2) - 24, lerp(P.y - 70, CD.y + 10, back2) - 24, 48, 48);
      put(plus, { o: t >= 30.0 && t < 30.7 ? 1 : 0 });
      const v1 = t >= 30.625;
      chip.textContent = v1 ? 'version 0.1.1' : 'version 0.1.0';
      box(chip, CD.x + CD.w / 2 - 110, CD.y + CD.h + 24);
      put(chip, { o: ramp(t, 28.2, 28.5, lin), s: v1 ? lerp(1.25, 1, ramp(t, 30.625, 31.1)) : 1 });
      chip.classList.toggle('new', v1);
    };
  });

  // ===== S6 evening (bars 14–15): the result becomes a research note and goes home to the shelf =====
  scene(() => {
    const layer = h('div', 'layer');
    const note = h('div', 'face note', layer);
    const NT = { x: 760, y: 240, w: 520, h: 680 };
    box(note, NT.x, NT.y, NT.w, NT.h);
    note.innerHTML = `<div class="wftitle">${icon('notebook-pen', 30, INK)}<span>연구노트</span></div><div class="headline"></div><div class="headline short"></div>`;
    const thumb = h('div', 'abs', note); box(thumb, 36, 200, NT.w - 72, 300);
    const m = drawMap(thumb, NT.w - 72, 300);
    m.contours.forEach(g => g.setAttribute('opacity', 1));
    m.cells.forEach(el => el.setAttribute('opacity', 0.95));
    const txt = [0, 1].map(k => { const l = h('div', 'abs txline', note); box(l, 36, 530 + k * 30, [420, 330][k], 12); return l; });
    const ev = [0, 1].map(k => { const e = h('div', 'abs evchip', note, `${icon('quote', 22, BLUE)}<span>근거</span>`); box(e, 36 + k * 150, 600); return e; });
    const s = svg(layer);
    const loop = sv('path', { d: '', fill: 'none', stroke: BLUE, 'stroke-width': 4, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '0 1' }, s);
    const head = sv('path', { d: '', fill: BLUE }, s);
    return t => {
      const o = t >= 32.5 && t < 37.5 ? 1 : 0;
      show(layer, o);
      if (!o) return;
      // the note unfolds (32.5–33.2), evidence marks on 33.75 / 34.06, then it goes to the shelf (35.0–35.9)
      const unf = ramp(t, 32.5, 33.2, out);
      const home = ramp(t, 35.0, 35.9375, inOut);
      const tx = SHELF.x + SHELF.w - 120, ty = rowY(4);
      const sc = lerp(lerp(0.6, 1, unf), 0.09, home);
      put(note, { o: unf * (1 - ramp(home, 0.85, 1, lin)), x: lerp(0, tx - (NT.x + NT.w / 2), home), y: lerp(0, ty - (NT.y + NT.h / 2), home), s: sc });
      txt.forEach((l, k) => put(l, { o: ramp(t, 33.2 + k * 0.15, 33.5 + k * 0.15, lin) }));
      ev.forEach((e, k) => put(e, { o: ramp(t, 33.75 + k * 0.3125, 33.95 + k * 0.3125, lin), s: lerp(1.2, 1, ramp(t, 33.75 + k * 0.3125, 34.1 + k * 0.3125)) }));
      if (deskShelf) deskShelf.rows[4].lit = home >= 1 ? 1 : 0;
      // the loop around the shelf: 서재 → Workflow → 연구노트 → 서재 (36.25–37.19)
      const x0 = SHELF.x + SHELF.w + 30, y0 = rowY(0), y1 = rowY(4);
      loop.setAttribute('d', `M ${x0} ${y0} C ${x0 + 120} ${y0} ${x0 + 120} ${y1} ${x0} ${y1} M ${x0 - 30 - SHELF.w - 34} ${y1} C ${SHELF.x - 70} ${y1} ${SHELF.x - 70} ${y0} ${SHELF.x - 4} ${y0}`);
      const lf = ramp(t, 36.25, 37.1875, inOut);
      loop.setAttribute('stroke-dasharray', `${lf} 1`);
      loop.setAttribute('opacity', 1 - ramp(t, 37.1875, 37.5, lin));
      head.setAttribute('d', lf >= 1 ? `M ${SHELF.x - 4} ${y0} l -16 -10 l 0 20 Z` : '');
      head.setAttribute('opacity', 1 - ramp(t, 37.1875, 37.5, lin));
    };
  });

  // ===== S7 night (bars 16–17½): one loop among many, a network grows — KIGAM Second brain =====
  scene(() => {
    const layer = h('div', 'layer');
    const s = svg(layer);
    const C = { x: 960, y: 620 };
    seed = 5;
    const N = 8;
    const rings = Array.from({ length: N }, (_, i) => {
      const a = (-90 + (i * 360) / N) * Math.PI / 180 + 0.3;
      const x = C.x + 720 * Math.cos(a), y = C.y + 300 * Math.sin(a);
      const link = sv('line', { x1: x, y1: y, x2: x, y2: y, stroke: GREY, 'stroke-width': 2.5 }, s);
      const g = sv('g', {}, s);
      const e = sv('ellipse', { cx: x, cy: y, rx: 86, ry: 50, fill: '#ffffff', stroke: GREY, 'stroke-width': 3 }, g);
      const p = person(g, 0.5);
      p.setAttribute('transform', `translate(${x} ${y + 22})`);
      const dot = sv('circle', { r: 7, fill: BLUE }, g);
      return { x, y, link, g, e, dot, i, ph: rnd() };
    });
    const nodes = [];
    for (let i = 0; i < 48; i++) {
      const r = 60 + Math.sqrt(rnd()) * 210, a = rnd() * Math.PI * 2;
      nodes.push({ x: C.x + r * Math.cos(a) * 1.7, y: C.y + r * Math.sin(a) * 0.72, k: i % 3, d: i / 48 });
    }
    const edges = [];
    nodes.forEach((n, i) => {
      nodes.map((m, j) => ({ j, dd: (m.x - n.x) ** 2 + (m.y - n.y) ** 2 })).filter(o => o.j !== i).sort((p, q) => p.dd - q.dd).slice(0, 2)
        .forEach(o => { if (o.j > i) edges.push({ a: n, b: nodes[o.j], d: Math.max(n.d, nodes[o.j].d) }); });
    });
    const eEls = edges.map(e => sv('line', { x1: e.a.x, y1: e.a.y, x2: e.b.x, y2: e.b.y, stroke: '#9aa3b0', 'stroke-width': 2 }, s));
    const nEls = nodes.map(n => n.k === 0 ? sv('circle', { cx: n.x, cy: n.y, r: 9, fill: '#fff', stroke: INK, 'stroke-width': 3 }, s)
      : n.k === 1 ? sv('rect', { x: n.x - 8, y: n.y - 8, width: 16, height: 16, fill: BLUE, transform: `rotate(45 ${n.x} ${n.y})` }, s)
        : sv('rect', { x: n.x - 7, y: n.y - 7, width: 14, height: 14, fill: INK2 }, s));
    const mark = lockup(layer, 110);
    mark.at(C.x, C.y);
    const plate = h('div', 'abs face small plate2', layer, 'KIGAM Second brain');
    return t => {
      const o = t >= 37.5 && t < 41.6 ? 1 : 0;
      show(layer, o * (1 - ramp(t, 41.0, 41.5, lin)));
      if (!o) return;
      rings.forEach(r => {
        const a = 37.5 + r.i * BEAT * 0.25;
        r.g.setAttribute('opacity', ramp(t, a, a + 0.3, lin));
        const ang = (t - 37.5) * 3 + r.ph * 6.28;
        r.dot.setAttribute('cx', r.x + 86 * Math.cos(ang)); r.dot.setAttribute('cy', r.y + 50 * Math.sin(ang));
        const lf = ramp(t, 38.4 + r.i * 0.06, 39.0 + r.i * 0.06, inOut);
        r.link.setAttribute('x2', lerp(r.x, C.x, lf)); r.link.setAttribute('y2', lerp(r.y, C.y, lf));
        const on = lf >= 1;
        r.link.setAttribute('stroke', on ? BLUE : GREY);
        r.e.setAttribute('stroke', on ? BLUE : GREY);
      });
      const gi = ramp(t, 38.1, 38.8);
      mark.set({ ringF: ramp(t, 37.9, 38.8, inOut), gO: gi, gS: lerp(0.8, 1, gi), lettersF: 0 });
      const grow = ramp(t, 38.75, 40.6, lin);
      nEls.forEach((el, i) => el.setAttribute('opacity', clamp((grow - nodes[i].d) * 6)));
      eEls.forEach((el, i) => el.setAttribute('opacity', clamp((grow - edges[i].d) * 6 - 0.3)));
      box(plate, C.x - 270, C.y + 96, 540);
      put(plate, { o: ramp(t, 39.4, 39.8, lin) });
    };
  });

  // ===== S8 end card (41.25–45) =====
  scene(() => {
    const layer = h('div', 'layer');
    const L = lockup(layer, 250);
    L.svg.style.left = `${960 - L.width / 2}px`;
    L.svg.style.top = '330px';
    const sub = h('div', 'abs endsub', layer, '지구과학 연구자를 위한 AI agent 연구 지원 플랫폼');
    box(sub, 0, 660, 1920);
    const tag = h('div', 'abs small', layer, '내부 검토용 영상');
    box(tag, 0, 990, 1824);
    tag.style.textAlign = 'right';
    return t => {
      const A = 41.25;
      show(layer, ramp(t, A, A + 0.3, lin));
      if (t < A) return;
      const gi = ramp(t, A + 0.15, A + 0.8);
      L.set({ ringF: ramp(t, A, A + 0.9, inOut), gO: gi, gS: lerp(0.85, 1, gi), lettersF: ramp(t, A + 0.6, A + 1.3, inOut) });
      put(sub, { o: ramp(t, A + 1.25, A + 1.7, lin), y: 14 * (1 - ramp(t, A + 1.25, A + 1.9)) });
      put(tag, { o: ramp(t, A + 1.9, A + 2.3, lin) });
    };
  });

  // ===== captions on top =====
  scene(() => {
    const layer = h('div', 'layer');
    const els = CAPTIONS.map(c => {
      const g = h('div', `abs cap${c.white ? ' white' : ''}`, layer);
      box(g, 0, c.lines.length > 1 ? 96 : 128, 1920);
      g.innerHTML = c.lines.map(l => `<div>${l}</div>`).join('');
      return { g, c, rows: [...g.children] };
    });
    return t => {
      for (const { g, c, rows } of els) {
        const o = win(t, c.a, c.b, 0.3, 0.3);
        put(g, { o, y: 14 * (1 - ramp(t, c.a, c.a + 0.5)) });
        if (c.second) put(rows[1], { o: ramp(t, c.second, c.second + 0.3, lin), y: 10 * (1 - ramp(t, c.second, c.second + 0.45)) });
      }
    };
  });

  // ---------- init ----------
  const pending = [];
  async function init() {
    const names = ['file-code', 'file-text', 'code-xml', 'folder-open', 'notebook-pen', 'library', 'share-2', 'workflow', 'user', 'map', 'map-gis', 'table-2', 'quote', 'plug'];
    await Promise.all(names.map(async n => {
      const txt = await (await fetch(`icons/${n}.svg`)).text();
      ICON[n] = txt.replace(/width="24"/, 'width="100%"').replace(/height="24"/, 'height="100%"');
    }));
    const logo = new DOMParser().parseFromString(await (await fetch('brand/horizontal-color.svg')).text(), 'image/svg+xml');
    const paths = [...logo.querySelectorAll('path')];
    LOGO = { ring: paths[0].getAttribute('d'), g: paths[1].getAttribute('d'), letters: paths.slice(2).map(p => ({ d: p.getAttribute('d'), transform: p.getAttribute('transform') })) };
    await document.fonts.load('700 40px Pretendard');
    await document.fonts.load('500 20px Pretendard');
    const draw = drawers.map(b => b());
    window.motion = {
      ready: true,
      duration: DURATION,
      poster: 31.4,
      stills: {
        '01-hook': 4.2, '02-stamp': 5.9, '03-gathered': 9.3, '04-paper': 12.9, '05-workflow': 17.2, '06-data': 21.4,
        '07-map': 26.4, '08-hub': 29.4, '09-version': 31.4, '10-note': 34.4, '11-loop': 37.0, '12-network': 40.4, '13-end': 44.5,
      },
      async frame(t) {
        pending.length = 0;
        for (const d of draw) d(t);
        await Promise.all(pending);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      },
    };
  }
  init().catch(e => { window.motionError = String((e && e.stack) || e); });
})();
