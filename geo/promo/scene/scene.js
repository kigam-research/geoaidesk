/* GAID 90-second promo film. Deterministic: window.motion.frame(t) draws film second t.
 * Numbers come from PROMO_DATA (geo/promo/prepare_data.py); footage from PROMO_CAPTURE (capture-v1).
 * The only illustrative scene (researchers' scattered files) carries an on-screen "개념도" tag.
 */
(() => {
  'use strict';
  const D = window.PROMO_DATA;
  const CAP = window.PROMO_CAPTURE;
  const FPS = 30;
  const stage = document.getElementById('stage');
  const NS = 'http://www.w3.org/2000/svg';

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lin = x => clamp(x);
  const out = x => 1 - Math.pow(1 - clamp(x), 4); // ≈ cubic-bezier(0.22,0.25,0,1)
  const inOut = x => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const ramp = (t, a, b, e = out) => e((t - a) / (b - a));
  const lerp = (a, b, v) => a + (b - a) * v;
  const win = (t, a, b, fi = 0.45, fo = 0.4) => Math.min(ramp(t, a, a + fi, lin), 1 - ramp(t, b - fo, b, lin));
  const fmtInt = n => Math.round(n).toLocaleString('ko-KR');

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
    Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: hgt == null ? '' : `${hgt}px` });
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
  let LOGO = null; // {ring, g, letters[]} path data from horizontal-color.svg

  function lockup(parent, height) {
    // Horizontal lockup (175×64). Ring, G and lettering are separate groups so they can enter in turn;
    // the final arrangement is the unchanged logo.
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
    const ring = sv('g', { fill: '#1f5eff', mask: `url(#${id})` }, svg);
    sv('path', { d: LOGO.ring, 'fill-rule': 'evenodd' }, ring);
    const g = sv('g', { fill: '#1f5eff' }, svg);
    sv('path', { d: LOGO.g, 'fill-rule': 'evenodd' }, g);
    const clipId = `c${Math.random().toString(36).slice(2)}`;
    const clip = sv('clipPath', { id: clipId }, defs);
    const clipRect = sv('rect', { x: 70, y: -10, width: 0, height: 84 }, clip);
    const letters = sv('g', { fill: '#1f5eff', 'clip-path': `url(#${clipId})` }, svg);
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

  // ---------- film progress scale (a position readout, 6–84 s) ----------
  const CHAPTERS = [[6, '배경'], [18, '취지'], [30, 'GAID 허브'], [50, '연구 지원'], [75, '독창성'], [84, '']];
  const SCALE = { x0: 160, x1: 1760, y: 1032, a: 6, b: 84 };
  function buildScale() {
    const layer = h('div', 'layer');
    const svg = sv('svg', { width: 1920, height: 1080 }, layer);
    const sx = t => lerp(SCALE.x0, SCALE.x1, (t - SCALE.a) / (SCALE.b - SCALE.a));
    sv('line', { x1: SCALE.x0, x2: SCALE.x1, y1: SCALE.y, y2: SCALE.y, stroke: '#c9ced6', 'stroke-width': 1.5 }, svg);
    for (let t = SCALE.a; t <= SCALE.b + 1e-6; t += 1) {
      const major = CHAPTERS.some(c => c[0] === t);
      sv('line', { x1: sx(t), x2: sx(t), y1: SCALE.y, y2: SCALE.y - (major ? 14 : 6), stroke: major ? '#525a68' : '#c9ced6', 'stroke-width': major ? 2 : 1 }, svg);
    }
    const labels = CHAPTERS.slice(0, -1).map(([t, l], i) => {
      const el = sv('text', { x: sx(t) + 8, y: SCALE.y - 20, 'font-size': 17, 'font-weight': 600, fill: '#646c7a' }, svg);
      el.textContent = l;
      return { el, a: t, b: CHAPTERS[i + 1][0] };
    });
    const fill = sv('line', { x1: SCALE.x0, x2: SCALE.x0, y1: SCALE.y, y2: SCALE.y, stroke: '#1f5eff', 'stroke-width': 3 }, svg);
    const pointer = sv('path', { d: 'M0 0 L-7 -11 L7 -11 Z', fill: '#1f5eff' }, svg);
    return t => {
      put(layer, { o: win(t, 6.2, 84.2, 0.6, 0.6) });
      const x = sx(clamp(t, SCALE.a, SCALE.b));
      fill.setAttribute('x2', x);
      pointer.setAttribute('transform', `translate(${x} ${SCALE.y - 1})`);
      for (const l of labels) {
        const on = t >= l.a && t < l.b;
        l.el.setAttribute('fill', on ? '#1d4fd8' : '#646c7a');
      }
    };
  }

  // ---------- headline helper (M4: old text fades out before new text fades in) ----------
  function headline(layer, x, y, lines, cls = 'h2') {
    const els = lines.map(([a, b, str, sub]) => {
      const el = h('div', 'abs', layer);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.innerHTML = `<div class="${cls}">${str}</div>${sub ? `<div class="body" style="margin-top:14px">${sub}</div>` : ''}`;
      return { el, a, b };
    });
    return t => {
      for (const { el, a, b } of els) {
        const o = win(t, a, b, 0.5, 0.35);
        put(el, { o, y: 18 * (1 - ramp(t, a, a + 0.7)) });
      }
    };
  }

  // ---------- footage windows ----------
  const capOK = CAP && CAP.shots;
  const shotInfo = id => (capOK ? CAP.shots.find(s => s.id === id) : null);
  const pending = [];
  function footageWindow(layer) {
    const el = h('div', 'window', layer);
    const img = h('img', '', el);
    img.decoding = 'sync';
    const ph = h('div', 'ph', el);
    const callout = h('div', 'abs', el);
    Object.assign(callout.style, { border: '3px solid #1f5eff', borderRadius: '8px', cornerShape: 'bevel' });
    const tag = h('div', 'plate', el);
    let current = '';
    return {
      el,
      draw({ x, y, w, o = 1, shot, local, view, call }) {
        const hgt = (w * 9) / 16;
        box(el, x, y, w, hgt);
        put(el, { o });
        if (o <= 0.002) return;
        const info = shotInfo(shot);
        const v = view || [0, 0, 1440, 810];
        const k = w / v[2];
        if (!info) {
          img.style.display = 'none';
          ph.style.display = 'flex';
          box(ph, 0, 0, w, hgt);
          ph.innerHTML = `<div>실제 화면 ${shot}</div><div style="font-size:22px;font-weight:500">촬영본 연결 전 자리</div>`;
        } else {
          ph.style.display = 'none';
          img.style.display = 'block';
          const idx = clamp(Math.floor(local * FPS) + (info.offset || 0), 0, info.frames - 1);
          const src = `capture/${info.pattern.replace('%05d', String(idx).padStart(5, '0'))}`;
          if (src !== current) {
            current = src;
            img.src = src;
            pending.push(img.decode().catch(() => {}));
          }
          Object.assign(img.style, { width: `${1440 * k}px`, height: `${810 * k}px`, left: `${-v[0] * k}px`, top: `${-v[1] * k}px` });
        }
        if (call && call.o > 0.002) {
          const [cx, cy, cw, ch] = call.rect;
          box(callout, (cx - v[0]) * k - 6, (cy - v[1]) * k - 6, cw * k + 12, ch * k + 12);
          put(callout, { o: call.o });
          tag.textContent = call.text;
          tag.style.left = `${(cx - v[0]) * k - 6}px`;
          tag.style.top = `${(cy - v[1]) * k - 46}px`;
          put(tag, { o: call.o });
        } else {
          put(callout, { o: 0 });
          put(tag, { o: 0 });
        }
      },
    };
  }
  // View rectangle for a shot at local time: optional zoom keyframes [{t, rect}], else a slow 4 % push-in.
  function viewAt(keys, local, dur) {
    const full = [0, 0, 1440, 810];
    if (!keys || !keys.length) {
      const z = lerp(1, 1.04, clamp(local / dur));
      const w = 1440 / z, hh = 810 / z;
      return [(1440 - w) / 2, (810 - hh) / 2, w, hh];
    }
    let prev = { t: 0, rect: full };
    for (const k of keys) {
      if (local < k.t) {
        const span = Math.min(0.9, k.t - prev.t);
        const start = k.t - span;
        const f = local < start ? 0 : inOut((local - start) / span);
        return prev.rect.map((p, i) => lerp(p, k.rect[i], f));
      }
      prev = k;
    }
    return prev.rect;
  }
  const focusRect = (shot, name) => {
    const info = shotInfo(shot);
    const f = info && (info.focus || []).find(x => x.label === name || x.name === name);
    return f ? [f.rect.x, f.rect.y, f.rect.width, f.rect.height] : null;
  };
  const fit169 = (r, pad = 40) => {
    if (!r) return null;
    let [x, y, w, hh] = [r[0] - pad, r[1] - pad, r[2] + 2 * pad, r[3] + 2 * pad];
    if (w / hh > 16 / 9) { const nh = (w * 9) / 16; y -= (nh - hh) / 2; hh = nh; } else { const nw = (hh * 16) / 9; x -= (nw - w) / 2; w = nw; }
    w = Math.min(w, 1440); hh = (w * 9) / 16;
    x = clamp(x, 0, 1440 - w); y = clamp(y, 0, 810 - hh);
    return [x, y, w, hh];
  };

  // ================= scenes =================
  const scenes = [];

  // S1 opening 0–6.2
  scenes.push(() => {
    const layer = h('div', 'layer');
    const dial = sv('svg', { width: 1920, height: 1080 }, layer);
    dial.style.position = 'absolute';
    const ticks = [];
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2 - Math.PI / 2;
      const major = i % 10 === 0;
      const r0 = 236, r1 = major ? 214 : 226;
      ticks.push(sv('line', {
        x1: 960 + r0 * Math.cos(a), y1: 470 + r0 * Math.sin(a), x2: 960 + r1 * Math.cos(a), y2: 470 + r1 * Math.sin(a),
        stroke: major ? '#525a68' : '#b9c0ca', 'stroke-width': major ? 2.5 : 1.5,
      }, dial));
    }
    const L = lockup(layer, 270);
    const sub = text(layer, 'h3', 0, 668, '지구과학 연구자를 위한 AI agent 작업 공간', { width: '1920px', textAlign: 'center', color: 'var(--ink-2)', fontWeight: 550 });
    return t => {
      const o = 1 - ramp(t, 5.5, 6.2, lin);
      put(layer, { o });
      if (o <= 0) return;
      ticks.forEach((tk, i) => tk.setAttribute('opacity', clamp((t - 0.15 - i * 0.008) / 0.25) * (1 - ramp(t, 2.3, 2.9, lin))));
      const ringF = ramp(t, 0.5, 1.9, inOut);
      const gIn = ramp(t, 1.0, 1.8);
      const move = ramp(t, 2.4, 3.3, inOut);
      L.set({ ringF, gO: gIn, gS: lerp(0.82, 1, gIn), lettersF: ramp(t, 2.8, 3.7, inOut) });
      const markLeft = 960 - 32 * L.scale;
      const lockLeft = 960 - L.width / 2;
      const top = 470 - 32 * L.scale;
      L.svg.style.left = `${lerp(markLeft, lockLeft, move)}px`;
      L.svg.style.top = `${lerp(top, top - 40, move)}px`;
      put(sub, { o: ramp(t, 3.7, 4.3, lin), y: 16 * (1 - ramp(t, 3.7, 4.5)) });
    };
  });

  // S2 background 5.8–18.2 (illustrative files per researcher + one real count)
  scenes.push(() => {
    const layer = h('div', 'layer');
    const head = headline(layer, 120, 110, [
      [6.3, 10.6, '연구 방법은 논문과 개인 폴더에 흩어져 있습니다'],
      [10.9, 14.3, '다른 연구자가 다시 쓰려면 코드부터 읽어야 합니다'],
      [14.5, 18.2, 'GAID는 그 방법을 Workflow로 만들어 함께 씁니다'],
    ]);
    const kinds = [['file-text', '논문'], ['code-xml', '코드'], ['map-gis', '자료'], ['notebook-pen', '노트']];
    const cols = 6, x0 = 200, y0 = 330, dx = 260, dy = 140;
    const tiles = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < 4; r++) {
        const el = h('div', 'face small', layer);
        box(el, 0, 0, 200, 92);
        el.style.display = 'flex'; el.style.alignItems = 'center'; el.style.gap = '14px'; el.style.padding = '0 20px';
        el.innerHTML = `${icon(kinds[r][0], 30)}<span class="label" style="font-size:23px">${kinds[r][1]}</span>`;
        tiles.push({ el, c, r, hx: x0 + c * dx + (rnd() - 0.5) * 70, hy: y0 + r * dy + (rnd() - 0.5) * 50, rot: (rnd() - 0.5) * 7, d: rnd() * 0.9 });
      }
    }
    const tag = h('div', 'note-tag', layer, '개념도');
    box(tag, 1700, 110);
    // real count: code files behind one registered hub Workflow
    const codeN = D.hubEntry.codeFiles;
    const waffle = h('div', 'face', layer);
    box(waffle, 1040, 300, 700, 560);
    const wsvg = sv('svg', { width: 700, height: 560 }, waffle);
    const cells = [];
    for (let i = 0; i < codeN; i++) {
      const cx = 60 + (i % 11) * 54, cy = 180 + Math.floor(i / 11) * 62;
      const g = sv('g', { transform: `translate(${cx} ${cy})` }, wsvg);
      sv('path', { d: 'M0 0 H28 L38 10 V46 H0 Z', fill: '#e8eeff', stroke: '#1f5eff', 'stroke-width': 1.5 }, g);
      cells.push(g);
    }
    const wt = sv('text', { x: 60, y: 92, 'font-size': 84, 'font-weight': 700, fill: '#171b23' }, wsvg);
    const wl = sv('text', { x: 60, y: 136, 'font-size': 24, 'font-weight': 550, fill: '#525a68' }, wsvg);
    wl.textContent = '허브 Workflow 1건이 담은 원본 코드 파일';
    const unit = sv('text', { x: 0, y: 92, 'font-size': 36, 'font-weight': 650, fill: '#525a68' }, wsvg);
    unit.textContent = '개';
    return t => {
      const o = win(t, 5.8, 18.3, 0.4, 0.5);
      put(layer, { o });
      if (o <= 0) return;
      head(t);
      const focus = ramp(t, 10.6, 11.6, inOut) * (1 - ramp(t, 14.2, 15.0, inOut));
      const gather = ramp(t, 14.6, 17.6, inOut);
      for (const tl of tiles) {
        const appear = ramp(t, 6.2 + tl.d, 6.9 + tl.d);
        // during focus the matrix slides left; during gather all tiles fall into the orbit centre (S3)
        let x = tl.hx - focus * 140 * (tl.c / cols) - focus * 60;
        let y = tl.hy;
        const ang = ((tl.c * 4 + tl.r) / 24) * Math.PI * 2;
        const tx = 540 + 340 * Math.cos(ang) - 100, ty = 600 + 220 * Math.sin(ang) - 46;
        x = lerp(x, tx, gather);
        y = lerp(y, ty, gather);
        const dim = tl.r === 1 ? 1 : 1 - 0.65 * focus;
        const hideRight = tl.c >= 3 ? 1 - focus : 1;
        put(tl.el, { o: appear * dim * hideRight * (1 - ramp(t, 17.2, 18.0, lin)), x, y, s: lerp(1, 0.35, gather), r: tl.rot * (1 - gather) });
      }
      put(tag, { o: ramp(t, 6.6, 7.2, lin) * (1 - ramp(t, 14.4, 15, lin)) });
      const wo = win(t, 11.0, 14.6, 0.5, 0.4);
      put(waffle, { o: wo, x: 30 * (1 - ramp(t, 11.0, 11.8)) });
      const shown = Math.round(codeN * ramp(t, 11.3, 13.0, lin));
      cells.forEach((c, i) => c.setAttribute('opacity', i < shown ? 1 : 0.0));
      wt.textContent = fmtInt(shown);
      unit.setAttribute('x', 60 + wt.getComputedTextLength() + 10);
    };
  });

  // S3 purpose loop 17.8–30.4
  const ORBIT = { cx: 540, cy: 600, rx: 340, ry: 220 };
  scenes.push(() => {
    const layer = h('div', 'layer');
    const head = headline(layer, 120, 110, [[18.4, 30.2, '한 연구자가 만든 Workflow를 다음 연구자가 이어 씁니다']]);
    const svg = sv('svg', { width: 1920, height: 1080 }, layer);
    svg.style.position = 'absolute';
    const ell = sv('ellipse', { cx: ORBIT.cx, cy: ORBIT.cy, rx: ORBIT.rx, ry: ORBIT.ry, fill: 'none', stroke: '#9aa3b0', 'stroke-width': 2, pathLength: 1, 'stroke-dasharray': '0 1' }, svg);
    const ticks = [];
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const len = i % 6 === 0 ? 12 : 5;
      const nx = Math.cos(a) / ORBIT.rx, ny = Math.sin(a) / ORBIT.ry, nn = Math.hypot(nx, ny);
      const px = ORBIT.cx + ORBIT.rx * Math.cos(a), py = ORBIT.cy + ORBIT.ry * Math.sin(a);
      ticks.push(sv('line', { x1: px, y1: py, x2: px - (nx / nn) * len, y2: py - (ny / nn) * len, stroke: '#9aa3b0', 'stroke-width': 1.5 }, svg));
    }
    const point = sv('circle', { r: 11, fill: '#1f5eff' }, svg);
    const L = lockup(layer, 150);
    L.svg.style.left = `${ORBIT.cx - 32 * L.scale}px`;
    L.svg.style.top = `${ORBIT.cy - 32 * L.scale}px`;
    L.set({ lettersF: 0 });
    const stations = [
      ['file-text', '논문·자료', -150],
      ['git-branch', 'Workflow', -80],
      ['orbit', 'AI agent 실행', 10],
      ['notebook-pen', '연구노트', 70],
      ['users', 'GAID 허브', 150],
    ].map(([ic, label, deg], i) => {
      const a = (deg * Math.PI) / 180;
      const px = ORBIT.cx + ORBIT.rx * Math.cos(a), py = ORBIT.cy + ORBIT.ry * Math.sin(a);
      const el = h('div', 'face small', layer);
      el.style.display = 'flex'; el.style.alignItems = 'center'; el.style.gap = '12px'; el.style.padding = '0 18px'; el.style.height = '64px';
      const ico = ic === 'orbit'
        ? '<svg width="30" height="20" viewBox="0 0 30 20"><ellipse cx="15" cy="10" rx="13" ry="7" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="26" cy="12" r="3" fill="#1f5eff"/></svg>'
        : ICON[ic];
      el.innerHTML = `<span class="icon" style="width:30px;height:30px">${ico}</span><span class="h3" style="font-size:25px">${label}</span>`;
      el.style.left = '0px'; el.style.top = '0px';
      const nx = Math.cos(a) / ORBIT.rx, ny = Math.sin(a) / ORBIT.ry, nn = Math.hypot(nx, ny);
      const ux = nx / nn, uy = ny / nn;
      const lead = sv('line', { x1: px + ux * 10, y1: py + uy * 10, x2: px + ux * 46, y2: py + uy * 46, stroke: '#9aa3b0', 'stroke-width': 1.5 }, svg);
      const dot = sv('circle', { cx: px, cy: py, r: 7, fill: '#ffffff', stroke: '#525a68', 'stroke-width': 2.5 }, svg);
      return { el, px, py, a, ux, uy, lead, dot, i, ico: el.querySelector('.icon') };
    });
    // right panel: what ships in the catalogue (real counts)
    const C = D.catalogue;
    const panel = h('div', 'face', layer);
    box(panel, 1200, 250, 600, 690);
    text(panel, 'h3', 40, 34, 'GAID에 기본으로 들어 있는 것');
    const reads = [[C.workflows.length, '기본 Workflow'], [C.skills, '스킬'], [C.dataSources, '공개 자료 출처']].map(([n, l], i) => {
      const el = h('div', 'abs', panel);
      Object.assign(el.style, { left: `${40 + i * 180}px`, top: '96px' });
      el.innerHTML = `<div class="num" style="font-size:64px;line-height:1"><span>0</span></div><div class="label" style="margin-top:8px">${l}</div>`;
      return { el, n, span: el.querySelector('span') };
    });
    text(panel, 'label', 40, 248, '공개 자료 출처의 분야', { color: 'var(--ink)' });
    const groups = C.dataSourcesByGroup;
    const maxN = Math.max(...groups.map(g => g.count));
    const bars = groups.map((g, i) => {
      const y = 296 + i * 50;
      const lab = text(panel, 'label', 40, y, g.label, { fontSize: '20px' });
      const bar = h('div', 'abs', panel);
      Object.assign(bar.style, { left: '250px', top: `${y + 4}px`, height: '22px', background: '#1f5eff', borderRadius: '3px' });
      const val = text(panel, 'label', 0, y, String(g.count), { color: 'var(--ink)', fontWeight: 700 });
      return { lab, bar, val, w: (250 * g.count) / maxN, i };
    });
    text(panel, 'small', 40, 648, `카탈로그 ${C.version} 기준 · KIGAM 스킬 ${C.skillsBySource.kigam}, K-Dense에서 가져온 스킬 ${C.skillsBySource['k-dense']}`);
    return t => {
      const o = win(t, 17.6, 30.4, 0.5, 0.6);
      put(layer, { o });
      if (o <= 0) return;
      head(t);
      ell.setAttribute('stroke-dasharray', `${ramp(t, 17.6, 19.2, inOut)} 1`);
      ticks.forEach((tk, i) => tk.setAttribute('opacity', ramp(t, 18.0 + i * 0.012, 18.4 + i * 0.012, lin)));
      const gi = ramp(t, 18.0, 19.0);
      L.set({ ringF: ramp(t, 17.8, 19.0, inOut), gO: gi, gS: lerp(0.8, 1, gi), lettersF: 0 });
      // the travelling point = the AI agent working; one loop starting at the first station
      const start = (-150 * Math.PI) / 180;
      const loop = ramp(t, 19.6, 28.6, x => clamp(x));
      const a = start + loop * Math.PI * 2;
      point.setAttribute('cx', ORBIT.cx + ORBIT.rx * Math.cos(a));
      point.setAttribute('cy', ORBIT.cy + ORBIT.ry * Math.sin(a));
      point.setAttribute('opacity', ramp(t, 19.3, 19.7, lin));
      for (const st of stations) {
        const appear = ramp(t, 18.8 + st.i * 0.18, 19.5 + st.i * 0.18);
        let rel = ((st.a - start) / (Math.PI * 2) + 1) % 1;
        const lit = loop > 0 && loop >= rel - 0.004;
        const cw = st.el.offsetWidth, ch = 64;
        const ax = st.px + st.ux * 50, ay = st.py + st.uy * 50;
        const bx = ax - cw / 2 + st.ux * (cw / 2), by = ay - ch / 2 + st.uy * (ch / 2);
        st.lead.setAttribute('opacity', appear);
        st.lead.setAttribute('stroke', lit ? '#1f5eff' : '#9aa3b0');
        put(st.el, { o: appear, x: bx, y: by + 10 * (1 - appear) });
        st.el.style.borderColor = lit ? '#1f5eff' : '#dce0e6';
        st.ico.style.color = lit ? '#1f5eff' : '#525a68';
        st.dot.setAttribute('fill', lit ? '#1f5eff' : '#ffffff');
        st.dot.setAttribute('stroke', lit ? '#1f5eff' : '#525a68');
        st.dot.setAttribute('opacity', appear);
      }
      const po = ramp(t, 20.6, 21.3);
      put(panel, { o: po, x: 40 * (1 - po) });
      reads.forEach((r, i) => { r.span.textContent = fmtInt(r.n * ramp(t, 21.0 + i * 0.3, 22.4 + i * 0.3, out)); });
      bars.forEach(b => {
        const f = ramp(t, 22.6 + b.i * 0.18, 23.6 + b.i * 0.18);
        b.bar.style.width = `${b.w * f}px`;
        b.val.style.left = `${250 + b.w * f + 12}px`;
        put(b.val, { o: f });
        put(b.lab, { o: ramp(t, 22.4 + b.i * 0.18, 22.9 + b.i * 0.18, lin) });
      });
    };
  });

  // S4a authoring motion 29.8–37.6 (real hub entry: sources, choices, steps)
  scenes.push(() => {
    const E = D.hubEntry;
    const layer = h('div', 'layer');
    const head = headline(layer, 120, 100, [[30.2, 37.5, '논문과 코드를 주면 AI agent가 묻고 Workflow 초안을 만듭니다']]);
    // sources
    const srcs = [['file-text', '논문 PDF', ''], ['code-xml', '코드', `${E.codeFiles}개 파일`], ['book-open', '참고문헌', `${E.references}편`]].map(([ic, l, n], i) => {
      const el = h('div', 'face small', layer);
      box(el, 120, 300 + i * 120, 400, 96);
      el.style.display = 'flex'; el.style.alignItems = 'center'; el.style.gap = '16px'; el.style.padding = '0 24px';
      el.innerHTML = `${icon(ic, 34)}<span class="h3" style="font-size:27px">${l}</span><span class="label" style="margin-left:auto;color:var(--ink)">${n}</span>`;
      return el;
    });
    const reading = h('div', 'abs', layer);
    box(reading, 120, 676, 400);
    reading.innerHTML = '<svg width="40" height="24" viewBox="0 0 40 24" style="vertical-align:middle"><ellipse cx="20" cy="12" rx="17" ry="9" fill="none" stroke="#9aa3b0" stroke-width="2"/><circle id="rpt" cx="37" cy="12" r="4" fill="#1f5eff"/></svg><span class="label" style="margin-left:12px;vertical-align:middle">AI agent가 자료를 읽는 중</span>';
    const rpt = reading.querySelector('#rpt');
    // question card
    const q = h('div', 'face', layer);
    box(q, 600, 300, 600, 520);
    const qHead = text(q, 'label', 36, 30, `연구자가 정할 조건 ${E.choices.length}개 중`, { color: 'var(--ink-2)' });
    void qHead;
    const qIdx = text(q, 'plate', 0, 24, '1');
    const asks = [0, 2, 5].map(i => E.choices[i]).filter(Boolean);
    const qs = asks.map((c, k) => {
      const g = h('div', 'abs', q);
      Object.assign(g.style, { left: '36px', top: '84px', width: '528px' });
      g.innerHTML = `<div class="h3" style="font-size:31px;white-space:normal">${c.label}</div>` + c.options.slice(0, 4).map(o =>
        `<div class="opt" style="margin-top:14px;display:flex;align-items:center;gap:14px;padding:14px 18px;border:1.5px solid #dce0e6;border-radius:8px;corner-shape:bevel;font-size:22px;font-weight:550;color:#171b23"><span class="rad" style="width:20px;height:20px;border-radius:50%;border:2px solid #878f9d;flex:none"></span>${o}</div>`).join('') +
        '<div style="margin-top:14px;padding:12px 18px;font-size:22px;color:#646c7a;border:1.5px dashed #c9ced6;border-radius:8px;corner-shape:bevel">기타: 직접 쓰기</div>';
      return { g, k, opts: [...g.querySelectorAll('.opt')], pick: k === 2 ? 1 : 0 };
    });
    // steps on a graduated vertical scale
    const st = h('div', 'face', layer);
    box(st, 1260, 230, 560, 760);
    text(st, 'h3', 36, 28, 'Workflow 초안', { fontSize: '28px' });
    const ssvg = sv('svg', { width: 560, height: 760 }, st);
    ssvg.style.position = 'absolute'; ssvg.style.left = '0'; ssvg.style.top = '0';
    const top0 = 104, gap = 56;
    const rail = sv('line', { x1: 52, x2: 52, y1: top0, y2: top0, stroke: '#1f5eff', 'stroke-width': 3 }, ssvg);
    const steps = E.steps.map((s, i) => {
      const y = top0 + i * gap;
      sv('line', { x1: 44, x2: 60, y1: y + 14, y2: y + 14, stroke: '#c9ced6', 'stroke-width': 1.5 }, ssvg);
      const mark = sv('rect', { x: 45, y: y + 7, width: 14, height: 14, fill: s.researcher ? '#ffffff' : '#1f5eff', stroke: s.researcher ? '#171b23' : '#1f5eff', 'stroke-width': 2.5, transform: `rotate(45 52 ${y + 14})` }, ssvg);
      const lab = text(st, 'label', 80, y, s.label, { fontSize: '20px', color: 'var(--ink)', maxWidth: '360px', overflow: 'hidden', textOverflow: 'ellipsis' });
      const pl = s.researcher ? text(st, 'plate', 0, y - 4, '연구자 결정', { fontSize: '16px', padding: '3px 10px', background: '#171b23', color: '#fff' }) : null;
      if (pl) pl.style.left = '420px';
      return { mark, lab, pl, i };
    });
    const nRes = E.steps.filter(s => s.researcher).length;
    const foot = text(st, 'label', 36, 680, `단계 ${E.steps.length} · 연구자 결정 ${nRes} · 산출물 ${E.outputs.length}`, { color: 'var(--ink)', fontWeight: 650 });
    return t => {
      const o = win(t, 29.8, 37.6, 0.5, 0.5);
      put(layer, { o });
      if (o <= 0) return;
      head(t);
      srcs.forEach((el, i) => { const f = ramp(t, 30.4 + i * 0.2, 31.1 + i * 0.2); put(el, { o: f, x: -30 * (1 - f) }); });
      put(reading, { o: win(t, 31.0, 33.6, 0.3, 0.3) });
      const ra = ((t - 31) / 1.1) * Math.PI * 2;
      rpt.setAttribute('cx', 20 + 17 * Math.cos(ra)); rpt.setAttribute('cy', 12 + 9 * Math.sin(ra));
      const qf = ramp(t, 31.6, 32.2);
      put(q, { o: qf, y: 20 * (1 - qf) });
      const per = 1.15;
      qs.forEach(Q => {
        const a = 32.0 + Q.k * per, b = a + per;
        put(Q.g, { o: Q.k === qs.length - 1 ? ramp(t, a, a + 0.25, lin) : win(t, a, b, 0.25, 0.2) });
        Q.opts.forEach((op, j) => {
          const on = j === Q.pick && t > a + 0.65;
          op.style.borderColor = on ? '#1f5eff' : '#dce0e6';
          op.style.background = on ? '#e8eeff' : '#fff';
          op.querySelector('.rad').style.border = on ? '6px solid #1f5eff' : '2px solid #878f9d';
        });
      });
      qIdx.textContent = `${Math.min(qs.length, Math.floor(clamp((t - 32.0) / per, 0, qs.length - 0.001)) + 1)}`;
      qIdx.style.left = '292px';
      const sf = ramp(t, 32.6, 33.2);
      put(st, { o: sf, x: 30 * (1 - sf) });
      const prog = ramp(t, 33.4, 36.4, lin) * steps.length;
      rail.setAttribute('y2', top0 + 14 + Math.max(0, Math.min(steps.length - 1, prog - 1)) * gap * (prog > 0 ? 1 : 0));
      steps.forEach(s => {
        const f = clamp(prog - s.i);
        s.mark.setAttribute('opacity', f);
        put(s.lab, { o: f, x: 12 * (1 - f) });
        if (s.pl) put(s.pl, { o: f });
      });
      put(foot, { o: ramp(t, 36.3, 36.8, lin) });
    };
  });

  // Footage segments. a/b = film seconds; local = t - a. Captions and optional callouts.
  const SEG = [
    { shot: 'H1', a: 37.3, b: 43.3, cap: ['GAID 허브', '등록된 Workflow를 찾고 판과 단계를 봅니다'] },
    { shot: 'H2', a: 43.1, b: 47.3, cap: ['허브에서 Workflow 만들기', '한 번에 한 질문, 답은 한꺼번에 반영합니다'] },
    { shot: 'R1', a: 50.0, b: 56.3, cap: ['Workflow 시작 설정', '입력 파일 → 분석 조건 → 요약'] },
    { shot: 'R2', a: 56.1, b: 60.7, cap: ['Workflow로 시작한 대화', 'AI agent가 Workflow 지침을 받아 분석합니다'] },
    { shot: 'R3', a: 60.5, b: 65.7, cap: ['연구노트', 'AI agent가 제안하고 연구자가 정합니다'] },
    { shot: 'R6', a: 69.4, b: 75.3, cap: ['서재와 쪽 인용', '서재의 논문을 쪽 번호까지 인용합니다'], narrow: true },
  ];
  const SPLIT = { a: 65.5, b: 69.7, cap: ['지도와 검층 자료', '원본 파일을 바로 열어 봅니다'] };

  scenes.push(() => {
    const layer = h('div', 'layer');
    const main = footageWindow(layer);
    const left = footageWindow(layer);
    const right = footageWindow(layer);
    const caps = [...SEG, SPLIT].map(sg => {
      const el = h('div', 'caption', layer);
      el.innerHTML = `<span>${sg.cap[0]}</span><span class="sub">${sg.cap[1]}</span>`;
      el.style.left = '200px'; el.style.top = '84px';
      return { el, sg };
    });
    // citation check chart (acceptance test 2026-10-22), shown beside R6
    const A = D.acceptance;
    const chart = h('div', 'face', layer);
    box(chart, 1270, 190, 530, 790);
    text(chart, 'h3', 36, 30, '쪽 인용 대조', { fontSize: '28px' });
    const big = text(chart, 'num', 36, 82, '', { fontSize: '76px', lineHeight: '1' });
    text(chart, 'label', 36, 168, `확인 단위 · 인용 ${A.citations}건에서 나눔`);
    const csvg = sv('svg', { width: 530, height: 360 }, chart);
    csvg.style.position = 'absolute'; csvg.style.left = '0'; csvg.style.top = '214px';
    const cells = [];
    for (let i = 0; i < A.units; i++) {
      const c = i % 16, r = Math.floor(i / 16);
      cells.push(sv('rect', { x: 36 + c * 28.5, y: r * 24, width: 24, height: 19, rx: 2, fill: '#e8eeff' }, csvg));
    }
    const legend = [
      ['#1f5eff', '해당 쪽에 있음', A.units - A.notOnPage - A.contradicted],
      ['#8a5300', '해당 쪽에 없음', A.notOnPage],
      ['#c2261d', '원문과 어긋남', A.contradicted],
    ].map(([col, l, n], i) => {
      const el = h('div', 'abs', chart);
      Object.assign(el.style, { left: '36px', top: `${586 + i * 44}px`, display: 'flex', alignItems: 'center', gap: '12px' });
      el.innerHTML = `<span style="width:18px;height:18px;background:${col};border-radius:2px"></span><span class="label" style="color:var(--ink)">${l}</span><span class="num" style="font-size:24px;margin-left:8px">${n}</span>`;
      return el;
    });
    text(chart, 'small', 36, 726, `${A.date} 수용 시험 1회 · 공개 논문 ${A.papers}편`);
    return t => {
      const any = SEG.some(s => t >= s.a - 0.1 && t <= s.b + 0.1) || (t >= SPLIT.a - 0.1 && t <= SPLIT.b + 0.1);
      put(layer, { o: any ? 1 : 0 });
      if (!any) return;
      // main window geometry: full (200..1720) or narrow left (120..1220) for R6
      let mainDrawn = false;
      for (const sg of SEG) {
        if (t < sg.a || t > sg.b) continue;
        const local = t - sg.a, dur = sg.b - sg.a;
        const inF = ramp(t, sg.a, sg.a + 0.45, lin), outF = 1 - ramp(t, sg.b - 0.35, sg.b, lin);
        // consecutive shots overlap by 0.2 s; the later one draws on top
        const first = SEG.indexOf(sg) === 0 || SEG[SEG.indexOf(sg) - 1].b < sg.a;
        const lastSeg = SEG.indexOf(sg) === SEG.length - 1 || SEG[SEG.indexOf(sg) + 1].a > sg.b;
        const o = (first ? inF : 1) * (lastSeg ? outF : 1);
        const narrowF = sg.narrow ? ramp(t, sg.a, sg.a + 0.8, inOut) : 0;
        const x = lerp(240, 120, narrowF), w = lerp(1440, 1100, narrowF);
        const y = lerp(172, 300, narrowF) + (first ? 24 * (1 - ramp(t, sg.a, sg.a + 0.7)) : 0);
        const keys = (sg.zoom || []).map(k => ({ t: k.t, rect: Array.isArray(k.rect) ? k.rect : fit169(focusRect(sg.shot, k.rect)) || [0, 0, 1440, 810] }));
        const view = viewAt(keys.length ? keys : null, local, dur);
        main.draw({ x, y, w, o: Math.min(o, first ? inF : 1), shot: sg.shot, local, view, call: null });
        mainDrawn = true;
      }
      if (!mainDrawn) main.draw({ x: 0, y: 0, w: 10, o: 0 });
      // split: map (R4) and well log (R5)
      if (t >= SPLIT.a && t <= SPLIT.b) {
        const local = t - SPLIT.a, dur = SPLIT.b - SPLIT.a;
        const o = win(t, SPLIT.a, SPLIT.b, 0.4, 0.4);
        const slide = ramp(t, SPLIT.a, SPLIT.a + 0.8, inOut);
        left.draw({ x: lerp(200, 120, slide), y: 270, w: 820, o, shot: 'R4', local, view: viewAt(null, local, dur) });
        right.draw({ x: lerp(1000, 980, slide), y: 270, w: 820, o: o * ramp(t, SPLIT.a + 0.3, SPLIT.a + 0.8, lin), shot: 'R5', local: Math.max(0, local - 0.3), view: viewAt(null, local, dur) });
      } else {
        left.draw({ x: 0, y: 0, w: 10, o: 0 });
        right.draw({ x: 0, y: 0, w: 10, o: 0 });
      }
      for (const c of caps) {
        const o = win(t, c.sg.a + 0.1, c.sg.b, 0.4, 0.3);
        put(c.el, { o, y: 12 * (1 - ramp(t, c.sg.a + 0.1, c.sg.a + 0.7)) });
        c.el.style.left = c.sg.narrow ? '120px' : '240px';
        c.el.style.top = c.sg.narrow ? '200px' : '84px';
      }
      const r6 = SEG[SEG.length - 1];
      const co = win(t, r6.a + 0.6, r6.b, 0.5, 0.35);
      put(chart, { o: co, x: 40 * (1 - ramp(t, r6.a + 0.6, r6.a + 1.3)) });
      const filled = ramp(t, r6.a + 1.0, r6.a + 3.2, lin) * A.units;
      const bad = A.units - 1 - 3 * 16; // a cell placed visibly inside the grid for the one not-on-page unit
      cells.forEach((c, i) => {
        const on = i < filled;
        let col = '#e8eeff';
        if (on) col = i === bad && A.notOnPage > 0 ? '#8a5300' : '#1f5eff';
        c.setAttribute('fill', col);
      });
      big.textContent = fmtInt(Math.min(A.units, filled));
      legend.forEach((el, i) => put(el, { o: ramp(t, r6.a + 3.0 + i * 0.25, r6.a + 3.5 + i * 0.25, lin) }));
    };
  });

  // S4c revisions and installs timeline 47.0–50.3 (real hub record)
  scenes.push(() => {
    const E = D.hubEntry;
    const layer = h('div', 'layer');
    const head = headline(layer, 120, 110, [[47.2, 50.3, '등록한 Workflow는 판으로 쌓이고, 다른 프로젝트가 가져다 씁니다']]);
    const panel = h('div', 'face', layer);
    box(panel, 120, 280, 1680, 640);
    const svg = sv('svg', { width: 1680, height: 640 }, panel);
    svg.style.position = 'absolute';
    const t0 = Date.parse('2026-10-16T00:00:00+09:00'), t1 = Date.parse('2026-10-19T00:00:00+09:00');
    const X = ms => lerp(220, 1600, (ms - t0) / (t1 - t0));
    const lanes = [['판', 170], ['프로젝트 설치', 330]];
    for (const [l, y] of lanes) {
      const tx = sv('text', { x: 50, y: y + 8, 'font-size': 23, 'font-weight': 600, fill: '#525a68' }, svg);
      tx.textContent = l;
      sv('line', { x1: 220, x2: 1600, y1: y, y2: y, stroke: '#dce0e6', 'stroke-width': 2 }, svg);
    }
    const axisY = 470;
    sv('line', { x1: 220, x2: 1600, y1: axisY, y2: axisY, stroke: '#878f9d', 'stroke-width': 1.5 }, svg);
    for (let d = 0; d <= 3; d++) {
      const ms = t0 + d * 86400000;
      sv('line', { x1: X(ms), x2: X(ms), y1: axisY, y2: axisY + 14, stroke: '#525a68', 'stroke-width': 2 }, svg);
      const lab = sv('text', { x: X(ms), y: axisY + 42, 'font-size': 21, 'font-weight': 600, fill: '#525a68', 'text-anchor': 'middle' }, svg);
      lab.textContent = `10월 ${16 + d}일`;
      for (let hh = 6; hh < 24; hh += 6) {
        const m = ms + hh * 3600000;
        sv('line', { x1: X(m), x2: X(m), y1: axisY, y2: axisY + 7, stroke: '#b9c0ca', 'stroke-width': 1 }, svg);
      }
    }
    const events = [];
    E.revisions.forEach(r => {
      const x = X(Date.parse(r.at));
      const g = sv('g', {}, svg);
      sv('rect', { x: x - 11, y: 159, width: 22, height: 22, fill: '#1f5eff', transform: `rotate(45 ${x} 170)` }, g);
      const tx = sv('text', { x: x + 22, y: 140, 'font-size': 26, 'font-weight': 700, fill: '#171b23' }, g);
      tx.textContent = `판 ${r.revision}`;
      if (r.note) {
        const n = sv('text', { x: x + 22, y: 214, 'font-size': 20, 'font-weight': 500, fill: '#525a68' }, g);
        n.textContent = r.note;
      }
      events.push({ g, ms: Date.parse(r.at) });
    });
    E.installs.forEach((ins, i) => {
      const x = X(Date.parse(ins.at));
      const g = sv('g', {}, svg);
      sv('circle', { cx: x, cy: 330, r: 11, fill: '#ffffff', stroke: '#1f5eff', 'stroke-width': 4 }, g);
      sv('line', { x1: x, x2: x, y1: 341, y2: axisY, stroke: '#c9ced6', 'stroke-width': 1, 'stroke-dasharray': '3 4' }, g);
      events.push({ g, ms: Date.parse(ins.at) + i });
    });
    const reads = h('div', 'abs', panel);
    Object.assign(reads.style, { left: '220px', top: '556px', display: 'flex', gap: '48px', alignItems: 'baseline' });
    reads.innerHTML = [[E.installs.length, '설치한 프로젝트'], [E.stars, '별'], [E.comments, '댓글']].map(([n, l]) =>
      `<span><span class="num" style="font-size:44px">${n}</span><span class="label" style="margin-left:10px">${l}</span></span>`).join('');
    text(panel, 'small', 1180, 590, '검토용 허브 기록 · 시험 계정 포함');
    const sweep = sv('line', { x1: 220, x2: 220, y1: 110, y2: axisY, stroke: '#1f5eff', 'stroke-width': 1.5, opacity: 0.5 }, svg);
    return t => {
      const o = win(t, 46.9, 50.3, 0.45, 0.45);
      put(layer, { o });
      if (o <= 0) return;
      head(t);
      const pf = ramp(t, 47.0, 47.6);
      put(panel, { o: pf, y: 20 * (1 - pf) });
      const now = lerp(t0, t1, ramp(t, 47.5, 49.4, inOut));
      sweep.setAttribute('x1', X(now)); sweep.setAttribute('x2', X(now));
      for (const e of events) e.g.setAttribute('opacity', clamp((now - e.ms) / 3600000 / 3));
      put(reads, { o: ramp(t, 49.0, 49.5, lin) });
    };
  });

  // S6 original points 74.9–84.3
  scenes.push(() => {
    const layer = h('div', 'layer');
    const head = headline(layer, 120, 100, [[75.2, 84.2, 'GAID가 연구자를 돕는 여섯 가지']]);
    const cx = 960, cy = 590, R = 250;
    const svg = sv('svg', { width: 1920, height: 1080 }, layer);
    svg.style.position = 'absolute';
    const L = lockup(layer, 150);
    L.svg.style.left = `${cx - 32 * L.scale}px`;
    L.svg.style.top = `${cy - 32 * L.scale}px`;
    L.set({ lettersF: 0 });
    const items = [
      ['file-text', '논문에서 Workflow로', '질문에 답하면 초안이 만들어집니다'],
      ['users', '기관 GAID 허브', '판·별·댓글, 기관 허브 서버'],
      ['map', '지구과학 자료 보기', '지도·LAS 검층·표'],
      ['notebook-pen', '연구노트와 결정', '결과 먼저, 결정은 연구자가'],
      ['git-branch', '관찰로 남는 출처', '파일마다 만든 단계를 기록'],
      ['server', '기관 로컬 모델', '연구소 서버 모델 연결'],
    ];
    const arcs = items.map(([ic, title, sub], i) => {
      const a0 = (-90 + i * 60 + 4) * Math.PI / 180, a1 = (-90 + (i + 1) * 60 - 4) * Math.PI / 180;
      const d = `M ${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)} A ${R} ${R} 0 0 1 ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)}`;
      const base = sv('path', { d, fill: 'none', stroke: '#dce0e6', 'stroke-width': 14 }, svg);
      const arc = sv('path', { d, fill: 'none', stroke: '#1f5eff', 'stroke-width': 14, pathLength: 1, 'stroke-dasharray': '0 1' }, svg);
      const am = (-90 + i * 60 + 30) * Math.PI / 180;
      const lx = cx + (R + 70) * Math.cos(am), ly = cy + (R + 70) * Math.sin(am);
      const el = h('div', 'abs', layer);
      const right = Math.cos(am) > 0.2, leftSide = Math.cos(am) < -0.2;
      Object.assign(el.style, { top: `${ly - 40}px`, width: '460px', textAlign: right ? 'left' : leftSide ? 'right' : 'center' });
      el.style.left = `${right ? lx : leftSide ? lx - 460 : lx - 230}px`;
      el.innerHTML = `<div style="display:flex;align-items:center;gap:12px;justify-content:${right ? 'flex-start' : leftSide ? 'flex-end' : 'center'}">${icon(ic, 32, '#1f5eff')}<span class="h3" style="font-size:30px">${title}</span></div><div class="label" style="margin-top:8px">${sub}</div>`;
      return { base, arc, el, i };
    });
    return t => {
      const o = win(t, 74.9, 84.3, 0.5, 0.6);
      put(layer, { o });
      if (o <= 0) return;
      head(t);
      const gi = ramp(t, 75.2, 76.0);
      L.set({ ringF: ramp(t, 75.1, 76.2, inOut), gO: gi, gS: lerp(0.8, 1, gi), lettersF: 0 });
      arcs.forEach(a => {
        const s = 76.2 + a.i * 1.05;
        a.arc.setAttribute('stroke-dasharray', `${ramp(t, s, s + 0.7, inOut)} 1`);
        a.base.setAttribute('opacity', ramp(t, 75.6, 76.2, lin));
        const f = ramp(t, s + 0.2, s + 0.8);
        put(a.el, { o: f, y: 10 * (1 - f) });
      });
    };
  });

  // S7 closing 83.9–90
  scenes.push(() => {
    const layer = h('div', 'layer');
    const L = lockup(layer, 230);
    L.svg.style.left = `${960 - L.width / 2}px`;
    L.svg.style.top = '330px';
    const sub = text(layer, 'h3', 0, 640, '지구과학 연구자를 위한 AI agent 작업 공간', { width: '1920px', textAlign: 'center', color: 'var(--ink-2)', fontWeight: 550 });
    const tag = text(layer, 'small', 1600, 1010, '내부 검토용 영상');
    return t => {
      const o = ramp(t, 84.0, 84.6, lin);
      put(layer, { o });
      if (o <= 0) return;
      const gi = ramp(t, 84.2, 85.0);
      L.set({ ringF: ramp(t, 84.0, 85.2, inOut), gO: gi, gS: lerp(0.85, 1, gi), lettersF: ramp(t, 84.8, 85.7, inOut) });
      put(sub, { o: ramp(t, 85.6, 86.2, lin), y: 14 * (1 - ramp(t, 85.6, 86.4)) });
      put(tag, { o: ramp(t, 86.0, 86.6, lin) });
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
  init().catch(e => { window.motionError = String(e && e.stack || e); throw e; });
})();
