/* Slow Leaf - procedural plant scene (SVG). Semi-realistic, muted palette.
   Every leaf / frond is generated from its own seed, so no two look alike. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const rad = d => d * Math.PI / 180;
  const f = n => Math.round(n * 100) / 100;
  const dirv = deg => [Math.sin(rad(deg)), -Math.cos(rad(deg))];
  const pt = p => f(p[0]) + ',' + f(p[1]);
  function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) {
    const A = hex(a), B = hex(b);
    return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(t))).toString(16).padStart(2, '0')).join('');
  }
  const shade = (c, t) => t >= 0 ? mix(c, '#F4F1E6', t) : mix(c, '#1C251E', -t);
  function E(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const R = (r, a, b) => a + (b - a) * r();
  function qAt(p0, p1, p2, t) {
    const a = 1 - t;
    return [a * a * p0[0] + 2 * a * t * p1[0] + t * t * p2[0], a * a * p0[1] + 2 * a * t * p1[1] + t * t * p2[1]];
  }
  function qTan(p0, p1, p2, t) {
    const x = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
    const y = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
    const l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  }
  function qSub(p0, p1, p2, t) {
    const a = [lerp(p0[0], p1[0], t), lerp(p0[1], p1[1], t)];
    const b = [lerp(p1[0], p2[0], t), lerp(p1[1], p2[1], t)];
    return { c: a, end: [lerp(a[0], b[0], t), lerp(a[1], b[1], t)], tan: qTan(p0, p1, p2, t) };
  }
  const angOf = v => Math.atan2(v[0], -v[1]) * 180 / Math.PI;
  function smoothClosed(pts) {
    const n = pts.length;
    let d = 'M' + pt(pts[0]);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += ` C${pt([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${pt([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${pt(p2)}`;
    }
    return d + ' Z';
  }
  // irregular watercolor blot
  function blot(cx, cy, rx, ry, rot, r) {
    const pts = [], n = 11, a0 = rad(rot);
    for (let i = 0; i < n; i++) {
      const t = i / n * Math.PI * 2, j = R(r, 0.62, 1.18);
      const x = Math.cos(t) * rx * j, y = Math.sin(t) * ry * j * R(r, 0.8, 1.15);
      pts.push([cx + x * Math.cos(a0) - y * Math.sin(a0), cy + x * Math.sin(a0) + y * Math.cos(a0)]);
    }
    return smoothClosed(pts);
  }
  // tapered strip along a quadratic curve; round start, pointed-round end
  function strip(P0, P1, P2, w0, w1, tipSharp, pw) {
    const N = 16, L = [], Rr = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, p = qAt(P0, P1, P2, t), tg = qTan(P0, P1, P2, t), w = lerp(w0, w1, Math.pow(t, pw || 1)) / 2;
      L.push([p[0] - tg[1] * w, p[1] + tg[0] * w]);
      Rr.push([p[0] + tg[1] * w, p[1] - tg[0] * w]);
    }
    const tE = qTan(P0, P1, P2, 1), tS = qTan(P0, P1, P2, 0), h1 = w1 / 2, h0 = w0 / 2, k = tipSharp || 1.35;
    let d = 'M' + pt(L[0]);
    for (let i = 1; i <= N; i++) d += ' L' + pt(L[i]);
    d += ` C${pt([L[N][0] + tE[0] * h1 * k, L[N][1] + tE[1] * h1 * k])} ${pt([Rr[N][0] + tE[0] * h1 * k, Rr[N][1] + tE[1] * h1 * k])} ${pt(Rr[N])}`;
    for (let i = N - 1; i >= 0; i--) d += ' L' + pt(Rr[i]);
    d += ` C${pt([Rr[0][0] - tS[0] * h0 * 1.2, Rr[0][1] - tS[1] * h0 * 1.2])} ${pt([L[0][0] - tS[0] * h0 * 1.2, L[0][1] - tS[1] * h0 * 1.2])} ${pt(L[0])} Z`;
    return d;
  }

  const PAL = {
    paper: '#F5F0E5', soil: '#4A3B30',
    leaf: ['#2E4E37', '#44694A', '#7AA066'], young: ['#5C8A4E', '#7DA866', '#AACB8C'], wilt: ['#6B6440', '#8A7E50', '#AFA170'],
    stem: '#4E7448', stemYoung: '#86A96A', stemWilt: '#8E835B',
    fern: ['#264A2C', '#3D6B3C', '#6E9B57'], fernHang: ['#5C8B43', '#86B25C', '#B6D687'], fernYoung: ['#7FA65A', '#9CC06F', '#C3DC98'],
    shieldGreen: '#8E9E77', shieldTan: '#B9A780', shieldBrown: '#8E765A'
  };
  const CX = 210, SOIL = 293, INK = '#1D2820';

  // ------------------------------------------------------------ Monstera leaf set
  const MON = (() => {
    const r = rng(20251101), out = [], N = 13;
    const ang = [-4, 22, -24, 36, -40, 12, 48, -16, -54, 30, -32, 58, 2];
    const turned = { 3: 0.62, 6: 0.7, 9: 0.58, 11: 0.66, 4: 0.82 };
    for (let i = 0; i < N; i++) {
      const k = i / (N - 1);
      out.push({
        i, a: ang[i] + R(r, -4, 4), L: lerp(58, 150, Math.sqrt(k)) * R(r, 0.86, 1.1), H: lerp(44, 116, Math.pow(k, 0.8)) * R(r, 0.9, 1.08),
        b: k * 0.78, wr: R(r, 1.0, 1.14), asym: R(r, -0.09, 0.09), bl: R(r, 0.05, 0.19), ta: R(r, 0.2, 1), mc: R(r, -0.12, 0.12),
        turn: turned[i] || R(r, 0.88, 1), tone: [0.06, -0.2, -0.38, 0.12, -0.38, -0.2, 0.04, -0.2, -0.38, 0.1, -0.2, -0.38, 0.08][i] + R(r, -0.02, 0.02), seed: 1000 + i * 7919, fenLevel: clamp((i - 1.5) / 9)
      });
    }
    return out;
  })();
  const MON_MATURE = 0.22;

  // ------------------------------------------------------------ Staghorn (wall mounted)
  const MOUNT = { x: 210, y: 176, w: 132, h: 196 };
  const HEART = [MOUNT.x, MOUNT.y + 34];
  const STAG = (() => {
    const r = rng(777), out = [];
    // angle from vertical-up; >90 means hanging. gravity pulls toward straight down
    const ang = [-10, 18, -42, 46, -72, 168, -146, 128];
    for (let i = 0; i < ang.length; i++) {
      const hang = Math.abs(ang[i]) > 90;
      out.push({
        i, hang, a: ang[i] + R(r, -5, 5), L: (hang ? R(r, 170, 205) : R(r, 175, 210)), b: i * 0.08,
        grav: hang ? R(r, 0.14, 0.2) : R(r, 0.04, 0.07),
        palm: hang ? R(r, 66, 84) : R(r, 50, 64), seed: 5000 + i * 104729,
        tone: [0.02, -0.16, 0.06, -0.3, -0.12, 0.04, -0.14, 0.08, -0.06][i]
      });
    }
    return out;
  })();
  const STAG_MATURE = 0.3;
  const SHIELDS = [
    { b: 0.0, R: 92, a: -112, dx: -6, dy: 4, wf: 1.05, seed: 11, dark: 1 }, { b: 0.05, R: 96, a: 110, dx: 6, dy: 4, wf: 1.0, seed: 23, dark: 1 },
    { b: 0.16, R: 60, a: -36, dx: -2, dy: 0, wf: 1.0, seed: 37, dark: 0 }, { b: 0.22, R: 58, a: 38, dx: 2, dy: 0, wf: 0.98, seed: 51, dark: 0 }
  ];

  class Scene {
    constructor(svg, opt = {}) {
      this.svg = svg;
      this.pet = !!opt.pet;
      svg.setAttribute('viewBox', '0 0 420 440');
      svg.setAttribute('preserveAspectRatio', 'xMidYMax meet');
      this.defs = E('defs', null, svg);
      this.layers = {};
      for (const n of ['bg', 'mount', 'ripples', 'plant', 'front', 'drops', 'night', 'z']) this.layers[n] = E('g', { class: 'l-' + n }, svg);
      this.staticDefs();
      if (!this.pet) this.drawBackground();
      this.buildNight();
      this.target = { G: 0.02, W: 0, mode: 'growing', species: 'monstera' };
      this.disp = { G: null, W: 0, sleep: 0 };
      this.built = null;
      this.mountFor = null;
      this.parts = [];
      this.tips = [];
      this.drops = [];
      this.zs = [];
      this.pokeT = -10;
      this.reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.t0 = performance.now();
      this.last = this.t0;
      this.nextDrop = 5;
      this.nextZ = 0;
      requestAnimationFrame(this.frame.bind(this));
    }

    setState(s) {
      const sp = s.species || 'monstera';
      if (sp !== this.target.species || (this.disp.G !== null && s.growth < this.disp.G - 0.1)) this.disp.G = s.growth;
      this.target = { G: s.growth, W: s.stress || 0, mode: s.mode || 'growing', species: sp };
    }
    poke() { this.pokeT = (performance.now() - this.t0) / 1000; }

    // ------------------------------------------------ defs & static
    noiseURL(size, dots, alpha, streak) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const x = c.getContext('2d'), r = rng(size * 31 + dots);
      for (let i = 0; i < dots; i++) {
        const v = Math.floor(R(r, 0, 90));
        x.fillStyle = `rgba(${v},${v},${v},${R(r, 0.2, 1) * alpha})`;
        if (streak) { x.save(); x.translate(r() * size, r() * size); x.rotate(R(r, -0.3, 0.3)); x.fillRect(0, 0, R(r, 3, 12), R(r, 0.5, 1.2)); x.restore(); }
        else x.fillRect(r() * size, r() * size, R(r, 0.6, 1.8), R(r, 0.6, 1.8));
      }
      return c.toDataURL('image/png');
    }
    speckURL(size, dots) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const x = c.getContext('2d'), r = rng(size * 17 + dots);
      for (let i = 0; i < dots; i++) {
        x.fillStyle = `rgba(${Math.floor(R(r, 170, 225))},${Math.floor(R(r, 205, 240))},${Math.floor(R(r, 150, 190))},${R(r, 0.15, 0.6)})`;
        const s = R(r, 0.35, 1.0);
        x.beginPath(); x.arc(r() * size, r() * size, s, 0, Math.PI * 2); x.fill();
      }
      return c.toDataURL('image/png');
    }
    staticDefs() {
      const d = this.defs;
      const grad = (id, stops, attrs) => {
        const g = E('linearGradient', Object.assign({ id }, attrs), d);
        stops.forEach(([o, c, op]) => E('stop', { offset: o, 'stop-color': c, 'stop-opacity': op === undefined ? 1 : op }, g));
      };
      grad('potBody', [[0, '#8E6754'], [0.28, '#AE8670'], [0.6, '#C7A48C'], [0.86, '#A47C66'], [1, '#86604E']], { x1: 0, y1: 0, x2: 1, y2: 0 });
      grad('potRim', [[0, '#9F7762'], [0.38, '#CDAA92'], [1, '#9A725E']], { x1: 0, y1: 0, x2: 1, y2: 0 });
      grad('potShade', [[0, '#000', 0.18], [0.25, '#000', 0], [1, '#000', 0.12]], { x1: 0, y1: 0, x2: 0, y2: 1 });
      grad('saucer', [[0, '#9F7964'], [0.5, '#BE9A83'], [1, '#9C7660']], { x1: 0, y1: 0, x2: 1, y2: 0 });
      grad('water', [[0, '#9DB4B7'], [0.5, '#C6D4D2'], [1, '#97AEB2']], { x1: 0, y1: 0, x2: 1, y2: 0 });
      grad('bowl', [[0, '#C9C3B6'], [0.45, '#E9E4D8'], [1, '#B9B2A4']], { x1: 0, y1: 0, x2: 1, y2: 0 });
      grad('floor', [[0, '#EDE5D5'], [1, '#E5DBC8']], { x1: 0, y1: 0, x2: 0, y2: 1 });
      grad('shaft', [[0, '#FFFDF6', 0.4], [1, '#FFFDF6', 0]], { x1: 0.8, y1: 0, x2: 0.2, y2: 1 });
      grad('wood', [[0, '#B2916D'], [0.45, '#CDB08B'], [1, '#A88664']], { x1: 0, y1: 0, x2: 1, y2: 1 });
      grad('bark', [[0, '#5E4636'], [0.5, '#7A5C47'], [1, '#55402F']], { x1: 0, y1: 0, x2: 1, y2: 1 });
      const rg = E('radialGradient', { id: 'light', gradientUnits: 'userSpaceOnUse', cx: 90, cy: 40, r: 420 }, d);
      E('stop', { offset: 0, 'stop-color': '#FFFDF7', 'stop-opacity': 0.9 }, rg);
      E('stop', { offset: 1, 'stop-color': '#FFFDF7', 'stop-opacity': 0 }, rg);
      const gl = E('radialGradient', { id: 'gloss', cx: 0.5, cy: 0.5, r: 0.5 }, d);
      E('stop', { offset: 0, 'stop-color': '#FBFAF2', 'stop-opacity': 0.5 }, gl);
      E('stop', { offset: 1, 'stop-color': '#FBFAF2', 'stop-opacity': 0 }, gl);
      const blur = E('filter', { id: 'soft', x: '-30%', y: '-60%', width: '160%', height: '220%' }, d);
      E('feGaussianBlur', { stdDeviation: 4 }, blur);
      const nz = E('filter', { id: 'paper', filterUnits: 'userSpaceOnUse', x: -300, y: -600, width: 1020, height: 1300 }, d);
      E('feTurbulence', { type: 'fractalNoise', baseFrequency: 0.8, numOctaves: 2, seed: 7 }, nz);
      E('feColorMatrix', { type: 'matrix', values: '0 0 0 0 0.42  0 0 0 0 0.37  0 0 0 0 0.3  0 0 0 0.07 0' }, nz);
      // painted textures (canvas, generated once)
      const pat = (id, url, size) => {
        const p = E('pattern', { id, patternUnits: 'userSpaceOnUse', width: size, height: size }, d);
        E('image', { href: url, width: size, height: size }, p);
      };
      pat('grain', this.noiseURL(128, 2200, 0.5, false), 128);
      pat('fiber', this.noiseURL(128, 700, 0.55, true), 128);
      pat('speck', this.speckURL(96, 520), 96);
    }

    drawBackground() {
      const g = this.layers.bg;
      E('rect', { x: -300, y: -600, width: 1020, height: 1100, fill: PAL.paper }, g);
      E('rect', { x: -300, y: -600, width: 1020, height: 1100, fill: 'url(#light)' }, g);
      E('path', { d: 'M502 -600 L939 -600 L238 386 L170 386 Z', fill: 'url(#shaft)' }, g);
      E('rect', { x: -300, y: 386, width: 1020, height: 300, fill: 'url(#floor)' }, g);
      E('line', { x1: -300, y1: 386.5, x2: 720, y2: 386.5, stroke: '#DCD2BF', 'stroke-width': 1 }, g);
      E('rect', { x: -300, y: -600, width: 1020, height: 1300, filter: 'url(#paper)' }, g);
    }

    buildNight() {
      const g = this.layers.night;
      this.nightRect = E('rect', { x: -300, y: -600, width: 1020, height: 1300, fill: '#36425C', opacity: 0 }, g);
      this.moon = E('g', { opacity: 0, transform: 'translate(362 52)' }, g);
      E('path', { d: 'M4,-12 A13,13 0 1 0 12,6 A11,11 0 1 1 4,-12 Z', fill: '#E9DFC3' }, this.moon);
    }

    // ------------------------------------------------ mounts
    drawMount(sp) {
      const g = this.layers.mount;
      while (g.firstChild) g.removeChild(g.firstChild);
      const fr = this.layers.front;
      while (fr.firstChild) fr.removeChild(fr.firstChild);
      this.mountFor = sp;
      if (sp === 'staghorn') this.drawPlaque(g); else this.drawPot(g);
    }
    drawWater(g, cx, cy, rx, ry, rim, rimRy) {
      E('ellipse', { cx, cy: cy + 9, rx: rim + 12, ry: 7, fill: '#5B4A3A', opacity: 0.13, filter: 'url(#soft)' }, g);
      this.waterLine = { cx, cy, rx };
      this.shimmer = null;
      return [cx, cy, rx, ry, rim, rimRy];
    }
    drawPot(g) {
      // matte charcoal pot, cartoon ink style; no saucer
      this.water = null;
      this.shimmer = null;
      const fr = this.layers.front;
      E('ellipse', { cx: CX + 16, cy: 392, rx: 100, ry: 10, fill: '#1E2420', opacity: 0.22, filter: 'url(#soft)' }, g);
      E('path', { d: `M${CX - 44},389 Q${CX + 10},380 ${CX + 86},387 Q${CX + 96},393 ${CX + 60},396 Q${CX},399 ${CX - 40},394 Z`, fill: '#1E2420', opacity: 0.55 }, g);
      const body = `M${CX - 57},292 C${CX - 59},332 ${CX - 53},366 ${CX - 40},382 Q${CX - 34},390 ${CX - 24},390 L${CX + 24},390 Q${CX + 34},390 ${CX + 40},382 C${CX + 53},366 ${CX + 59},332 ${CX + 57},292 Z`;
      E('path', { d: body, fill: '#34383B' }, g);
      E('path', { d: body, fill: 'url(#grain)', opacity: 0.45, style: 'mix-blend-mode:multiply' }, g);
      E('path', { d: `M${CX + 47},304 C${CX + 48},338 ${CX + 42},362 ${CX + 30},380`, stroke: '#1D2022', 'stroke-width': 11, fill: 'none', 'stroke-linecap': 'round', opacity: 0.5 }, g);
      E('path', { d: `M${CX - 43},306 C${CX - 44},336 ${CX - 39},358 ${CX - 30},374`, stroke: '#70777B', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', opacity: 0.5 }, g);
      E('path', { d: body, fill: 'none', stroke: INK, 'stroke-width': 2.4, 'stroke-linejoin': 'round' }, g);
      // rim: back half behind the stems, front band in front of them
      E('ellipse', { cx: CX, cy: 281, rx: 63, ry: 6.5, fill: '#3E4346', stroke: INK, 'stroke-width': 2.2 }, g);
      E('ellipse', { cx: CX, cy: 282, rx: 56, ry: 4.6, fill: '#151819' }, g);
      const band = `M${CX - 63},281 A63,6.5 0 0 0 ${CX + 63},281 L${CX + 63},292 Q${CX + 63},297 ${CX + 58},297 L${CX - 58},297 Q${CX - 63},297 ${CX - 63},292 Z`;
      E('path', { d: band, fill: '#3E4346' }, fr);
      E('path', { d: band, fill: 'url(#grain)', opacity: 0.4, style: 'mix-blend-mode:multiply' }, fr);
      E('path', { d: `M${CX - 56},${291} L${CX + 20},291`, stroke: '#7D8488', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0.55 }, fr);
      E('path', { d: band, fill: 'none', stroke: INK, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, fr);
    }
    drawPlaque(g) {
      // rectangular wooden board on the wall, ink style; no bowl
      this.water = null;
      this.shimmer = null;
      const { x, y } = MOUNT, w = MOUNT.w, h = MOUNT.h, x0 = x - w / 2, y0 = y - h / 2, th = 7;
      E('rect', { x: x0 + 8, y: y0 + 10, width: w, height: h, rx: 3, fill: '#3A3226', opacity: 0.2, filter: 'url(#soft)' }, g);
      // twine + nail
      E('path', { d: `M${x - 34},${y0 + 14} L${x},${y0 - 40} L${x + 34},${y0 + 14}`, stroke: INK, 'stroke-width': 2.4, fill: 'none', 'stroke-linejoin': 'round' }, g);
      E('path', { d: `M${x - 34},${y0 + 14} L${x},${y0 - 40} L${x + 34},${y0 + 14}`, stroke: '#C9B48E', 'stroke-width': 1.1, fill: 'none', 'stroke-linejoin': 'round' }, g);
      E('circle', { cx: x, cy: y0 - 41, r: 3.4, fill: '#7A736A', stroke: INK, 'stroke-width': 1.4 }, g);
      // board thickness (right + bottom side)
      E('path', { d: `M${x0 + w},${y0 + 2} L${x0 + w + th},${y0 + th} L${x0 + w + th},${y0 + h + th} L${x0 + th},${y0 + h + th} L${x0},${y0 + h} L${x0 + w},${y0 + h} Z`, fill: '#9A7650', stroke: INK, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }, g);
      E('rect', { x: x0, y: y0, width: w, height: h, rx: 2, fill: '#CFAE7F' }, g);
      // wood grain
      const r = rng(4242);
      for (let k = 0; k < 13; k++) {
        const gx = x0 + 6 + k * (w - 12) / 12 + R(r, -3, 3), a = R(r, 1.5, 4), ph = R(r, 0, 6);
        let d = `M${f(gx)},${y0 + 2}`;
        for (let q = 1; q <= 8; q++) d += ` L${f(gx + Math.sin(q * 0.9 + ph) * a)},${f(y0 + q * h / 8)}`;
        E('path', { d, stroke: '#8E6B45', 'stroke-width': R(r, 0.5, 1.1), fill: 'none', opacity: R(r, 0.3, 0.6) }, g);
      }
      E('ellipse', { cx: x0 + w * 0.72, cy: y0 + h * 0.2, rx: 4, ry: 9, fill: 'none', stroke: '#8E6B45', 'stroke-width': 1, opacity: 0.6 }, g);
      E('rect', { x: x0, y: y0, width: w, height: h, rx: 2, fill: 'url(#grain)', opacity: 0.5, style: 'mix-blend-mode:multiply' }, g);
      E('path', { d: `M${x0 + 3},${y0 + 3} L${x0 + 3},${y0 + h - 3}`, stroke: '#EBD3AE', 'stroke-width': 2, opacity: 0.7 }, g);
      E('rect', { x: x0, y: y0, width: w, height: h, rx: 2, fill: 'none', stroke: INK, 'stroke-width': 2 }, g);
      E('circle', { cx: x - 34, cy: y0 + 14, r: 2.4, fill: '#4D3B2E' }, g);
      E('circle', { cx: x + 34, cy: y0 + 14, r: 2.4, fill: '#4D3B2E' }, g);
    }

    // ------------------------------------------------ plants
    rebuild() {
      const d = this.disp, sp = this.target.species;
      if (this.mountFor !== sp) this.drawMount(sp);
      const g = this.layers.plant;
      while (g.firstChild) g.removeChild(g.firstChild);
      this.parts = [];
      this.tips = [];
      if (sp === 'staghorn') this.buildStaghorn(g, d.G, d.W, d.sleep);
      else this.buildMonstera(g, d.G, d.W, d.sleep);
      this.built = { species: sp, G: d.G, W: d.W, sleep: d.sleep };
    }

    buildMonstera(g, G, W, sl) {
      MON.forEach(s => this.monsteraLeaf(g, s, G, W, sl));
    }

    monsteraLeaf(g, s, G, W, sl) {
      const i = s.i;
      const m = clamp((G - s.b) / MON_MATURE);
      if (m <= 0.001) return;
      const r = rng(s.seed);
      const side = s.a < 0 ? -1 : 1;
      const growL = 0.08 + 0.92 * ease(m / 0.45), size = ease((m - 0.08) / 0.7);
      const u = 0.12 + 0.88 * ease((m - 0.3) / 0.5), tm = ease((m - 0.35) / 0.6);
      const fen = ease((m - 0.6) / 0.4) * (s.fenLevel > 0 ? 1 : 0);
      const droop = W + sl * 0.25;
      const bx = CX + s.a * 0.13 + R(r, -3, 3), by = SOIL + 1;
      const L = s.L;
      const a0 = s.a * 0.1 + R(r, -6, 6), a1 = s.a * 1.55 + side * (8 + droop * 22);
      const dA = dirv(a0), dB = dirv(a1);
      const P0 = [bx, by], C = [bx + dA[0] * L * 0.6, by + dA[1] * L * 0.6];
      const P2 = [C[0] + dB[0] * L * 0.52, C[1] + dB[1] * L * 0.52 + droop * L * 0.14];
      const sub = qSub(P0, C, P2, growL), T = sub.end;
      const finalBlade = s.a * 1.5 + side * Math.min(40, Math.abs(s.a) * 1.2) + side * (W * 40 + sl * 9) + R(r, -6, 6);
      const bAng = lerp(angOf(sub.tan), finalBlade, ease(m * 1.4 - 0.2));
      const ink = mix(INK, '#3A3122', W * 0.5);

      const lg = E('g', null, g);
      const stem = mix(mix(PAL.stemYoung, PAL.stem, tm), PAL.stemWilt, W * 0.6);
      const sw = lerp(1.5, 3.4, size) * (0.8 + s.H / 140);
      const sp = `M${pt(P0)} Q${pt(sub.c)} ${pt(T)}`;
      E('path', { d: sp, stroke: ink, 'stroke-width': f(sw + 2.6), fill: 'none', 'stroke-linecap': 'round' }, lg);
      E('path', { d: sp, stroke: stem, 'stroke-width': f(sw), fill: 'none', 'stroke-linecap': 'round' }, lg);
      E('path', { d: sp, stroke: shade(stem, 0.35), 'stroke-width': f(Math.max(0.6, sw * 0.26)), fill: 'none', 'stroke-linecap': 'round', opacity: 0.7, transform: `translate(${f(-sw * 0.2)},0)` }, lg);
      let blade = null;
      if (size > 0.01) {
        const H = s.H * (0.22 + 0.78 * size) * (1 - W * 0.08);
        const uu = u * (1 - W * 0.22 - sl * 0.1) * s.turn;
        const hwR = H * 0.5 * s.wr * (1 + s.asym) * uu, hwL = H * 0.5 * s.wr * (1 - s.asym) * uu;
        // local leaf coordinates: x in half-widths (-1..1), y in lengths (0 base .. -1 tip)
        const P = (x, y) => [x * (x < 0 ? hwL : hwR) + s.mc * y * y * H, y * H];
        const Pp = (x, y) => pt(P(x, y));
        const bl = s.bl, ta = s.ta;
        const outline = (sx) => sx > 0
          ? `C${Pp(0.1 + ta * 0.06, -0.9)} ${Pp(0.86, -0.84)} ${Pp(1, -0.5)} C${Pp(1.06, -0.2)} ${Pp(0.9, 0.06 + bl * 0.3)} ${Pp(0.5, 0.1 + bl)} C${Pp(0.24, 0.12 + bl)} ${Pp(0.06, 0.08)} ${Pp(0, 0.02)}`
          : `C${Pp(-0.06, 0.08)} ${Pp(-0.24, 0.12 + bl)} ${Pp(-0.5, 0.1 + bl)} C${Pp(-0.9, 0.06 + bl * 0.3)} ${Pp(-1.04, -0.16)} ${Pp(-1, -0.5)} C${Pp(-0.86, -0.84)} ${Pp(-0.1 - ta * 0.06, -0.9)} ${Pp(0, -1)}`;
        const bp = `M${Pp(0, -1)} ${outline(1)} ${outline(-1)} Z`;
        const bg = E('g', { transform: `translate(${f(T[0])},${f(T[1])}) rotate(${f(bAng)})` }, lg);
        const id = `m${i}`;
        const pal = k => shade(mix(mix(PAL.young[k], PAL.leaf[k], tm), PAL.wilt[k], W * 0.65), s.tone);
        const dark = pal(0), mid = pal(1), light = pal(2);
        const turned = s.turn < 0.75;
        const ow = clamp(0.55 + H / 130, 0.8, 1.45);
        const cp = E('clipPath', { id: id + 'c' }, bg);
        E('path', { d: bp }, cp);

        // layout is always computed so veins sit between the (future) slits
        const lay = [];
        for (const sx of [-1, 1]) {
          const n = Math.max(2, Math.round(lerp(2, 4.6, s.fenLevel) + R(r, -0.6, 0.6)));
          let t = R(r, 0.08, 0.15);
          const step = (0.86 - t) / n;
          for (let j = 0; j < n; j++) {
            lay.push({
              sx, t, gap: step, depth: R(r, 0.5, 0.92) * (j === 0 ? 0.7 : 1), rise: R(r, 0.3, 0.42) + t * 0.08,
              bend: R(r, 0.02, 0.09), w0: R(r, 0.03, 0.04), w1: R(r, 0.075, 0.095),
              hole: r(), hx: R(r, 0.15, 0.24), hl: R(r, 0.045, 0.07), hw: R(r, 0.018, 0.028), dark: r() < 0.1
            });
            t += step * R(r, 0.92, 1.08);
          }
        }
        const slits = [], holes = [], veins = [];
        lay.forEach(o => {
          const sx = o.sx, vt = o.t + o.gap * 0.5;
          veins.push([P(sx * 0.05, -vt), P(sx * 0.55, -(vt + o.rise * 0.5)), P(sx * 1.05, -(vt + o.rise * 1.1))]);
          if (fen <= 0.01) return;
          const wantHole = s.fenLevel > 0.4 && fen > 0.4 && o.hole < 0.62 && o.t > 0.12 && o.t < 0.8;
          let xi = 1.12 - o.depth * fen * (0.6 + 0.4 * s.fenLevel);
          if (wantHole) xi = Math.max(xi, o.hx + 0.26);
          const I = P(sx * xi, -o.t), O = P(sx * 1.36, -(o.t + o.rise * 1.25 + o.bend)), M = P(sx * (xi * 0.4 + 1.36 * 0.6), -(o.t + o.rise * 0.3));
          const wk = 0.45 + 0.55 * fen;
          if (xi < 0.98) slits.push(strip(I, M, O, o.w0 * H * wk, o.w1 * H * wk * 1.15, 0.4, 2.4));
          if (wantHole) {
            const hf = ease((fen - 0.4) / 0.6);
            const c = P(sx * o.hx, -(o.t - o.rise * 0.12));
            const dv = [I[0] - c[0], I[1] - c[1]];
            holes.push({ x: c[0], y: c[1], rx: o.hl * H * hf, ry: o.hw * H * hf, rot: Math.atan2(dv[1], dv[0]) * 180 / Math.PI, dark: o.dark });
          }
        });
        const ell = (h, attrs, parent) => E('ellipse', Object.assign({ cx: f(h.x), cy: f(h.y), rx: f(h.rx), ry: f(h.ry), transform: `rotate(${f(h.rot)} ${f(h.x)} ${f(h.y)})` }, attrs), parent);
        let target = bg;
        if (slits.length || holes.some(h => !h.dark)) {
          const mk = E('mask', { id: id + 'k', maskUnits: 'userSpaceOnUse', x: f(-2 * H), y: f(-2 * H), width: f(4 * H), height: f(4 * H) }, bg);
          E('rect', { x: f(-2 * H), y: f(-2 * H), width: f(4 * H), height: f(4 * H), fill: '#fff' }, mk);
          slits.forEach(dd => E('path', { d: dd, fill: '#000' }, mk));
          holes.forEach(h => { if (!h.dark) ell(h, { fill: '#000' }, mk); });
          target = E('g', { mask: `url(#${id}k)` }, bg);
        }
        E('path', { d: bp, fill: mid }, target);
        const inner = E('g', { 'clip-path': `url(#${id}c)` }, target);
        const big = { x: f(-2 * H), y: f(-2 * H), width: f(4 * H), height: f(4 * H) };
        // shaded half (the side turned away from the light)
        E('path', { d: `M${Pp(0, 0.3)} L${Pp(0, -1.1)} L${Pp(-1.3, -0.7)} L${Pp(-1.3, 0.3)} Z`, fill: dark, opacity: turned ? 0.85 : 0.55 }, inner);
        // loose brush patches of lighter green
        const nb = 2 + Math.floor(r() * 3);
        for (let k = 0; k < nb; k++) {
          const sx = k === 0 ? 1 : (r() < 0.7 ? 1 : -1);
          const c = P(sx * R(r, 0.25, 0.85), -R(r, 0.2, 0.85)), rr = H * R(r, 0.07, 0.15), pts = [];
          const rot = R(r, -0.6, 0.6) + (sx > 0 ? -0.5 : 0.5), el = R(r, 1.6, 2.6);
          for (let q = 0; q < 10; q++) {
            const th = q / 10 * Math.PI * 2, j = R(r, 0.7, 1.15);
            const ex = Math.cos(th) * rr * el * j, ey = Math.sin(th) * rr * j;
            pts.push([c[0] + ex * Math.cos(rot) - ey * Math.sin(rot), c[1] + ex * Math.sin(rot) + ey * Math.cos(rot)]);
          }
          E('path', { d: smoothClosed(pts), fill: light, opacity: f(R(r, 0.45, 0.75) * (turned ? 0.6 : 1)) }, inner);
        }
        E('rect', Object.assign({ fill: 'url(#speck)', opacity: 0.38 }, big), inner);
        E('rect', Object.assign({ fill: 'url(#grain)', opacity: 0.3, style: 'mix-blend-mode:multiply' }, big), inner);
        // ink veins between the slits
        veins.forEach(([A, B, Cc]) => E('path', { d: `M${pt(A)} Q${pt(B)} ${pt(Cc)}`, stroke: ink, 'stroke-width': f(ow * 0.5), fill: 'none', opacity: f(0.25 + 0.4 * tm), 'stroke-linecap': 'round' }, inner));
        // pale midrib with an ink edge
        const mw = 0.8 + H / 55;
        const md = `M${Pp(0, 0.02)} Q${Pp(0.02, -0.5)} ${Pp(0, -0.93)}`;
        E('path', { d: md, stroke: ink, 'stroke-width': f(mw + ow * 1.1), fill: 'none', 'stroke-linecap': 'round', opacity: 0.85 }, inner);
        E('path', { d: md, stroke: mix(light, '#C9DDA6', 0.35), 'stroke-width': f(mw), fill: 'none', 'stroke-linecap': 'round' }, inner);
        // cream highlight just inside the outline, broken like a brush stroke
        E('path', { d: bp, stroke: '#E9EBCB', 'stroke-width': f(ow * 3.4), fill: 'none', opacity: turned ? 0.3 : 0.6, 'stroke-dasharray': `${f(H * 0.4)} ${f(H * 0.22)} ${f(H * 0.14)} ${f(H * 0.5)}`, 'stroke-dashoffset': f(R(r, 0, H)) }, inner);
        slits.forEach(dd => E('path', { d: dd, fill: 'none', stroke: ink, 'stroke-width': f(ow * 2) }, inner));
        holes.forEach(h => h.dark ? ell(h, { fill: '#16221A', stroke: ink, 'stroke-width': f(ow) }, inner) : ell(h, { fill: 'none', stroke: ink, 'stroke-width': f(ow * 2) }, inner));
        E('path', { d: bp, fill: 'none', stroke: ink, 'stroke-width': f(ow), 'stroke-linejoin': 'round' }, target);
        E('ellipse', { cx: 0, cy: f(H * 0.04), rx: f(sw * 0.75), ry: f(sw * 1.3), fill: shade(stem, 0.15), stroke: ink, 'stroke-width': 1.1 }, bg);
        blade = { g: bg, x: T[0], y: T[1], ang: bAng };
        const tip = P(0, -1), c0 = Math.cos(rad(bAng)), s0 = Math.sin(rad(bAng));
        if (size > 0.6) this.tips.push([T[0] + tip[0] * c0 - tip[1] * s0, T[1] + tip[0] * s0 + tip[1] * c0]);
      }
      this.parts.push({ g: lg, cx: bx, cy: by, amp: 0.4 + size * 0.7, ph: i * 1.7, blade });
    }
    buildStaghorn(g, G, W, sl) {
      // back: upright antler fronds; middle: round shield fronds; front: hanging fronds
      STAG.filter(s => !s.hang).forEach(s => this.staghornFrond(g, s, G, W, sl));
      SHIELDS.forEach((s, i) => this.shieldFrond(g, s, i, G, W));
      // the little growing bud in the middle: one smooth, soft bud
      const k = ease(G / 0.08);
      if (k > 0.01) {
        const kg = E('g', null, g), rr = rng(5), [hx, hy] = HEART;
        E('path', { d: blot(hx, hy + 1, 5.2 * k, 4.4 * k, -10, rr), fill: '#9DBE72', stroke: INK, 'stroke-width': 1.1 }, kg);
        E('path', { d: `M${f(hx - 2.4 * k)},${f(hy - 0.5 * k)} Q${f(hx)},${f(hy - 3.2 * k)} ${f(hx + 2.6 * k)},${f(hy - 0.8 * k)}`, stroke: '#C9DFA3', 'stroke-width': 1.1, fill: 'none', 'stroke-linecap': 'round' }, kg);
      }
      STAG.filter(s => s.hang).forEach(s => this.staghornFrond(g, s, G, W, sl));
    }

    shieldFrond(g, s, i, G, W) {
      const k = ease((G - s.b) / 0.16);
      if (k <= 0.01) return;
      const r = rng(s.seed);
      const age = clamp((G - s.b - 0.35) / 0.4);
      const P = s.dark ? ['#2B4A2E', '#3E6A3D', '#79A55C'] : ['#4E7F41', '#78A65A', '#B2D488'];
      const col = j => mix(P[j], PAL.wilt[j], W * 0.5);
      const RR = s.R * (0.3 + 0.7 * k), rw = RR * 0.5 * s.wf;
      const sg = E('g', { transform: `translate(${f(HEART[0] + s.dx)},${f(HEART[1] + s.dy)}) rotate(${f(s.a)})` }, g);
      const pts = [], ph = R(r, 0, 6), ph2 = R(r, 0, 6), cy = -RR * 0.54;
      for (let q = 0; q <= 34; q++) {
        const t = rad(-160 + q * 320 / 34);
        const wob = 1 + 0.035 * Math.sin(t * 9 + ph) + 0.018 * Math.sin(t * 17 + ph2);
        const notch = 1 - 0.08 * Math.exp(-Math.pow(t / 0.2, 2));
        pts.push([Math.sin(t) * rw * wob * notch, cy - Math.cos(t) * RR * 0.5 * wob * notch]);
      }
      pts.push([rw * 0.06, -RR * 0.02], [-rw * 0.06, -RR * 0.02]);
      const d = smoothClosed(pts);
      const id = 'sh' + i;
      E('path', { d, fill: col(0) }, sg);
      const cp = E('clipPath', { id: id + 'c' }, sg);
      E('path', { d }, cp);
      const inner = E('g', { 'clip-path': `url(#${id}c)` }, sg);
      // watercolor mottling
      for (let q = 0; q < 7; q++) {
        const a = R(r, -2.6, 2.6), dd = R(r, 0.3, 0.95);
        E('ellipse', { cx: f(Math.sin(a) * rw * dd), cy: f(cy - Math.cos(a) * RR * 0.45 * dd), rx: f(RR * R(r, 0.12, 0.22)), ry: f(RR * R(r, 0.06, 0.12)), transform: `rotate(${f(a * 57 + 90)} ${f(Math.sin(a) * rw * dd)} ${f(cy - Math.cos(a) * RR * 0.45 * dd)})`, fill: col(r() < 0.5 ? 1 : 0), opacity: f(R(r, 0.4, 0.8)) }, inner);
      }
      const lg = E('radialGradient', { id: id + 'l', gradientUnits: 'userSpaceOnUse', cx: 0, cy: f(-RR * 0.18), r: f(RR * 0.48) }, sg);
      E('stop', { offset: 0, 'stop-color': col(2), 'stop-opacity': 0.95 }, lg);
      E('stop', { offset: 0.6, 'stop-color': col(2), 'stop-opacity': 0.55 }, lg);
      E('stop', { offset: 1, 'stop-color': col(2), 'stop-opacity': 0 }, lg);
      E('ellipse', { cx: 0, cy: f(-RR * 0.22), rx: f(rw * 0.75), ry: f(RR * 0.42), fill: `url(#${id}l)` }, inner);
      if (age > 0.01) {
        const a = R(r, 0.9, 1.6) * (r() < 0.5 ? -1 : 1), cx2 = Math.sin(a) * rw * 0.95, cy2 = cy - Math.cos(a) * RR * 0.46;
        E('path', { d: blot(cx2, cy2, RR * 0.24 * age, RR * 0.15 * age, a * 57, r), fill: '#857040', opacity: 0.85 }, inner);
        E('path', { d: blot(cx2 + Math.sin(a) * RR * 0.05, cy2, RR * 0.13 * age, RR * 0.08 * age, a * 57, r), fill: '#64522A', opacity: 0.7 }, inner);
      }
      E('rect', { x: f(-RR), y: f(-RR * 1.2), width: f(RR * 2), height: f(RR * 1.4), fill: 'url(#grain)', opacity: 0.45, style: 'mix-blend-mode:multiply' }, inner);
      // fine radiating ink veins from the base
      const nv = 34;
      for (let q = 0; q < nv; q++) {
        const t = rad(-150 + q * 300 / (nv - 1) + R(r, -3, 3)), reach = R(r, 0.55, 0.95);
        const ex = Math.sin(t) * rw * reach, ey = cy - Math.cos(t) * RR * 0.5 * reach;
        E('path', { d: `M${f(Math.sin(t) * 2)},${f(-RR * 0.03)} Q${f(ex * 0.25)},${f(ey * 0.62)} ${f(ex)},${f(ey)}`, stroke: INK, 'stroke-width': f(R(r, 0.35, 0.7)), fill: 'none', opacity: f(R(r, 0.35, 0.7) * (0.4 + 0.6 * k)) }, inner);
      }
      E('path', { d, fill: 'none', stroke: INK, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, sg);
    }

    frondTree(s) {
      // fixed per frond: a fan of long flowing fingers, some forking near the end
      if (s.tree) return s.tree;
      const r = rng(s.seed), hang = s.hang;
      const node = (len, off, curl) => ({ len, off, curl, kids: [], share: 1, w1fr: 0 });
      const root = node(s.L * (hang ? 0.38 : 0.5), 0, R(r, -12, 12));
      root.w1 = s.palm;
      const n = hang ? 3 : (r() < 0.6 ? 2 : 3);
      const fan = hang ? R(r, 56, 76) : R(r, 34, 52);
      const sh = [];
      for (let j = 0; j < n; j++) sh.push(R(r, 0.85, 1.15) * (j === 0 || j === n - 1 ? 0.9 : 1));
      const tot = sh.reduce((a, b) => a + b, 0);
      let anyFork = false;
      for (let j = 0; j < n; j++) {
        const edge = j === 0 || j === n - 1;
        const k = node(s.L * (hang ? R(r, 0.34, 0.46) : R(r, 0.34, 0.48)) * (edge ? 0.85 : 1), (j / (n - 1) - 0.5) * fan + R(r, -6, 6), R(r, 8, 20) * (r() < 0.5 ? -1 : 1));
        k.share = sh[j] / tot;
        if (hang ? r() < 0.8 : r() < 0.4) {
          anyFork = true;
          k.len *= 0.7;
          k.w1fr = hang ? 0.72 : 0.66;
          const f2 = R(r, 36, 58);
          for (let q = 0; q < 2; q++) {
            const c = node(s.L * (hang ? R(r, 0.15, 0.25) : R(r, 0.18, 0.3)), (q - 0.5) * f2, R(r, 10, 26) * (q ? 1 : -1));
            c.share = q ? 0.47 : 0.53;
            k.kids.push(c);
          }
        }
        root.kids.push(k);
      }
      s.tree = root;
      s.depthT = anyFork ? 2 : 1;
      return root;
    }

    staghornFrond(g, s, G, W, sl) {
      const m = clamp((G - s.b) / STAG_MATURE);
      if (m <= 0.001) return;
      const tree = this.frondTree(s);
      const r = rng(s.seed + 1);
      const p = m * (s.depthT + 1), tm = ease((m - 0.15) / 0.5);
      const hang = s.hang, N = 12;
      const pull = th => { const tgt = th >= 0 ? 180 : -180; return (tgt - th) * (s.grav * (1 + W * 1.6 + sl * 0.3)); };
      const outline = [], lines = [], ends = [];
      let wing = null;
      const walk = (nd, S, th0, w0, lvl) => {
        const gr = ease(p - lvl);
        const hasKids = nd.kids.length > 0;
        const forkK = hasKids ? ease(p - lvl - 1) : 0;
        const len = Math.max(0.5, nd.len * gr);
        const tipW = Math.max(1.8, w0 * (hang ? 0.34 : 0.2));
        const wFull = hasKids ? (lvl === 0 ? nd.w1 : w0 * nd.w1fr) : tipW;
        const wEnd = lerp(tipW, wFull, forkK);
        const e = hasKids ? (lvl === 0 ? 1.3 : 1.1) : 1.35;
        const gs = 0.55 + 0.45 * gr;
        const P = [S], T = [th0], Wd = [w0];
        let th = th0, c = S;
        for (let k = 1; k <= N; k++) {
          const t = k / N;
          th += (t <= 0.4 ? nd.off / (0.4 * N) : 0) + nd.curl * (0.5 + 0.5 * gr) / N + pull(th) * 1.4 / N;
          const d = dirv(th);
          c = [c[0] + d[0] * len / N, c[1] + d[1] * len / N];
          P.push(c); T.push(th);
          Wd.push(lerp(w0, wEnd * (lvl === 0 ? gs : 1), Math.pow(t, e)));
        }
        const left = k => { const d = dirv(T[k]); return [d[1], -d[0]]; };
        for (let k = lvl ? 1 : 0; k <= N; k++) { const l = left(k); outline.push([P[k][0] + l[0] * Wd[k] / 2, P[k][1] + l[1] * Wd[k] / 2]); }
        const E = P[N], lE = left(N), dE = dirv(T[N]);
        if (hasKids && forkK > 0.01) {
          if (lvl === 0) wing = { E, l: lE, d: dE, w: wEnd };
          let cum = 0;
          nd.kids.forEach((kd, i) => {
            const wk = kd.share * wEnd, o = wEnd / 2 - cum - wk / 2;
            walk(kd, [E[0] + lE[0] * o, E[1] + lE[1] * o], T[N], wk, lvl + 1);
            cum += wk;
            if (i < nd.kids.length - 1) {
              const o2 = wEnd / 2 - cum;
              outline.push([E[0] + lE[0] * o2 + dE[0] * wEnd * 0.05, E[1] + lE[1] * o2 + dE[1] * wEnd * 0.05]);
            }
          });
        } else {
          outline.push([E[0] + dE[0] * (tipW * 0.7 + 1.2), E[1] + dE[1] * (tipW * 0.7 + 1.2)]);
          if (gr > 0.9) ends.push(E);
        }
        for (let k = N; k >= (lvl ? 1 : 0); k--) { const l = left(k); outline.push([P[k][0] - l[0] * Wd[k] / 2, P[k][1] - l[1] * Wd[k] / 2]); }
        lines.push({ P, T, Wd, lvl });
      };
      const S0 = [HEART[0] + R(r, -4, 4), HEART[1] - 2 + R(r, -3, 3)];
      walk(tree, S0, s.a, hang ? 8 : 7, 0);

      const fg = E('g', null, g);
      const id = 'fr' + s.i;
      const base = hang ? PAL.fernHang : PAL.fern;
      const pal = k => shade(mix(mix(PAL.fernYoung[k], base[k], tm), PAL.wilt[k], W * 0.6), s.tone);
      const dk = pal(0), md = pal(1), lt = pal(2);
      const d = smoothClosed(outline);
      E('path', { d, fill: md }, fg);
      const cp = E('clipPath', { id: id + 'c' }, fg);
      E('path', { d }, cp);
      const inner = E('g', { 'clip-path': `url(#${id}c)` }, fg);
      const lineAt = (L, u, k0) => {
        let dd = '';
        for (let k = k0 || 0; k <= N; k++) {
          const dv = dirv(L.T[k]), l = [dv[1], -dv[0]], q = [L.P[k][0] + l[0] * L.Wd[k] * u, L.P[k][1] + l[1] * L.Wd[k] * u];
          dd += (dd ? ' L' : 'M') + pt(q);
        }
        return dd;
      };
      // watercolor: soft dark rim, lighter flowing streak through the middle, a few blots
      E('path', { d, fill: 'none', stroke: dk, 'stroke-width': 9, opacity: 0.5 }, inner);
      lines.forEach(L => {
        const side = (s.i + L.lvl) % 2 ? 1 : -1;
        E('path', { d: lineAt(L, 0.18 * side), stroke: lt, 'stroke-width': f(Math.max(2, L.Wd[Math.round(N / 2)] * 0.3)), fill: 'none', opacity: 0.55, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, inner);
        if (r() < 0.7) {
          const k = Math.floor(R(r, 3, 10)), c = L.P[k];
          E('ellipse', { cx: f(c[0]), cy: f(c[1]), rx: f(Math.max(2, L.Wd[k] * R(r, 0.2, 0.4))), ry: f(Math.max(3, L.Wd[k] * R(r, 0.5, 0.9))), transform: `rotate(${f(L.T[k] + 90)} ${f(c[0])} ${f(c[1])})`, fill: r() < 0.5 ? dk : lt, opacity: f(R(r, 0.3, 0.55)) }, inner);
        }
      });
      if (hang && wing && m > 0.6) {
        // papery browning creeping in from the edges of the broad wing
        const k = ease((m - 0.6) / 0.4);
        for (const sd of [-1, 1]) {
          if (r() < 0.3) continue;
          const along = R(r, 0.12, 0.3), c = [wing.E[0] + wing.l[0] * wing.w * 0.34 * sd - wing.d[0] * wing.w * along, wing.E[1] + wing.l[1] * wing.w * 0.34 * sd - wing.d[1] * wing.w * along];
          const rx = wing.w * R(r, 0.3, 0.42) * k, ry = wing.w * R(r, 0.16, 0.24) * k, rot = angOf(wing.d) - 90 + R(r, -20, 20);
          E('path', { d: blot(c[0], c[1], rx, ry, rot, r), fill: '#8A7340', opacity: 0.8 }, inner);
          E('path', { d: blot(c[0] + wing.l[0] * sd * rx * 0.25, c[1] + wing.l[1] * sd * rx * 0.25, rx * 0.6, ry * 0.6, rot, r), fill: '#6A5428', opacity: 0.7 }, inner);
          for (let q = 0; q < 3; q++) {
            const u = R(r, -0.6, 0.6);
            E('path', { d: `M${pt([c[0] - wing.d[0] * ry * 0.6 + wing.d[1] * rx * u, c[1] - wing.d[1] * ry * 0.6 - wing.d[0] * rx * u])} Q${pt([c[0], c[1]])} ${pt([c[0] + wing.l[0] * sd * rx * 0.8, c[1] + wing.l[1] * sd * rx * 0.8])}`, stroke: '#4E3D1C', 'stroke-width': 0.5, fill: 'none', opacity: 0.6 }, inner);
          }
        }
      }
      E('rect', { x: -100, y: -100, width: 620, height: 640, fill: 'url(#grain)', opacity: 0.4, style: 'mix-blend-mode:multiply' }, inner);
      // fine ink veins flowing along every finger
      lines.forEach(L => {
        const us = L.lvl === 0 ? [-0.36, -0.24, -0.12, 0, 0.12, 0.24, 0.36] : [-0.22, 0, 0.22];
        us.forEach(u => E('path', { d: lineAt(L, u + R(r, -0.03, 0.03)), stroke: INK, 'stroke-width': 0.45, fill: 'none', opacity: f(0.25 + 0.3 * tm), 'stroke-linejoin': 'round' }, inner));
      });
      E('path', { d, fill: 'none', stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, fg);
      ends.forEach(e => this.tips.push(e));
      this.parts.push({ g: fg, cx: S0[0], cy: S0[1], amp: (hang ? 0.9 : 0.5) + m * 0.5, ph: s.i * 1.3, blade: null });
    }

    // ------------------------------------------------ animation
    frame(now) {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      const t = (now - this.t0) / 1000;
      const tg = this.target, d = this.disp;
      if (d.G === null) d.G = tg.G;
      d.G += (tg.G - d.G) * Math.min(1, dt * 2.2);
      d.W += (tg.W - d.W) * Math.min(1, dt * 1.2);
      d.sleep += ((tg.mode === 'sleeping' ? 1 : 0) - d.sleep) * Math.min(1, dt * 1.1);
      const b = this.built;
      if (!b || b.species !== tg.species || Math.abs(d.G - b.G) > 0.0008 || Math.abs(d.W - b.W) > 0.004 || Math.abs(d.sleep - b.sleep) > 0.01) this.rebuild();
      const still = this.reduce ? 0 : 1;
      const sl = d.sleep, spd = lerp(1, 0.45, sl), amp = lerp(1, 0.5, sl) * (1 - d.W * 0.5) * still;
      const pt0 = t - this.pokeT, pk = pt0 < 3 ? Math.exp(-pt0 * 2.4) * Math.sin(pt0 * 13) * still : 0;
      for (const p of this.parts) {
        const a = Math.sin(t * 0.7 * spd + p.ph) * 0.9 * amp * p.amp + pk * 2.5 * p.amp;
        p.g.setAttribute('transform', `rotate(${f(a)} ${f(p.cx)} ${f(p.cy)})`);
        if (p.blade) {
          const ba = p.blade.ang + Math.sin(t * 1.1 * spd + p.ph * 1.7) * 2.2 * amp + pk * 5;
          p.blade.g.setAttribute('transform', `translate(${f(p.blade.x)},${f(p.blade.y)}) rotate(${f(ba)})`);
        }
      }
      this.animWater(t, dt, still);
      this.animNight(t, dt, still);
      requestAnimationFrame(this.frame.bind(this));
    }

    animWater(t, dt, still) {
      const w = this.water;
      if (!w) return;
      if (this.shimmer) {
        const x = w.cx - w.rx * 0.4 + Math.sin(t * 0.4) * w.rx * 0.18 * still;
        this.shimmer.setAttribute('d', `M${f(x)},${f(w.y)} Q${f(x + 12)},${f(w.y - 1.4)} ${f(x + 26)},${f(w.y)}`);
      }
      if (!still) return;
      this.nextDrop -= dt;
      if (this.nextDrop <= 0) {
        this.nextDrop = 8 + Math.random() * 8;
        const tips = this.tips.filter(p => Math.abs(p[0] - w.cx) < w.rx && p[1] < w.y - 30 && !(w.potHalf && Math.abs(p[0] - CX) < w.potHalf));
        if (tips.length && this.disp.W < 0.6) {
          const p = tips[Math.floor(Math.random() * tips.length)];
          const el = E('path', { d: 'M0,-4 Q2.6,0 2.6,1.6 A2.6,2.6 0 1 1 -2.6,1.6 Q-2.6,0 0,-4 Z', fill: '#CCDAD8', stroke: '#8FA7AA', 'stroke-width': 0.6, opacity: 0 }, this.layers.drops);
          this.drops.push({ el, x: p[0], y: p[1], vy: 0, hang: 1.4, age: 0 });
        }
      }
      for (let i = this.drops.length - 1; i >= 0; i--) {
        const dp = this.drops[i];
        dp.age += dt;
        if (dp.hang > 0) { dp.hang -= dt; dp.el.setAttribute('opacity', f(Math.min(0.9, dp.age))); }
        else { dp.vy += 520 * dt; dp.y += dp.vy * dt; }
        dp.el.setAttribute('transform', `translate(${f(dp.x)},${f(dp.y)})`);
        if (dp.y >= w.y) { dp.el.remove(); this.drops.splice(i, 1); this.ripple(dp.x, w); }
      }
      for (const r of [...this.layers.ripples.children]) {
        const a = (+r.dataset.a || 0) + dt;
        r.dataset.a = a;
        if (a < 0) continue;
        const k = a / 1.6;
        if (k >= 1) { r.remove(); continue; }
        r.setAttribute('rx', f(2 + k * 15));
        r.setAttribute('ry', f((2 + k * 15) * 0.24));
        r.setAttribute('opacity', f(0.8 * (1 - k)));
      }
    }
    ripple(x, w) {
      for (let j = 0; j < 2; j++) {
        const r = E('ellipse', { cx: f(clamp(x, w.cx - w.rx + 8, w.cx + w.rx - 8)), cy: f(w.y), rx: 2, ry: 0.5, fill: 'none', stroke: '#8EA6A9', 'stroke-width': 0.8, opacity: 0 }, this.layers.ripples);
        r.dataset.a = -j * 0.35;
      }
    }

    animNight(t, dt, still) {
      const s = this.disp.sleep;
      this.nightRect.setAttribute('opacity', f(s * (this.pet ? 0 : 0.085)));
      this.moon.setAttribute('opacity', f(s * 0.95));
      if (s > 0.6 && still) {
        this.nextZ -= dt;
        if (this.nextZ <= 0) {
          this.nextZ = 2.4;
          const top = this.tips.length ? Math.min(...this.tips.map(p => p[1])) : SOIL - 40;
          const el = E('text', { x: 0, y: 0, 'font-family': 'Georgia, serif', 'font-style': 'italic', fill: '#7D8399', 'font-size': 15 }, this.layers.z);
          el.textContent = 'z';
          this.zs.push({ el, x: CX + 34, y: Math.max(70, top + 6), age: 0 });
        }
      }
      for (let i = this.zs.length - 1; i >= 0; i--) {
        const z = this.zs[i];
        z.age += dt;
        const k = z.age / 4;
        if (k >= 1) { z.el.remove(); this.zs.splice(i, 1); continue; }
        z.el.setAttribute('transform', `translate(${f(z.x + k * 34 + Math.sin(z.age * 2) * 4)},${f(z.y - k * 46)}) scale(${f(0.7 + k * 0.7)})`);
        z.el.setAttribute('opacity', f(Math.sin(Math.PI * k) * 0.85));
      }
    }
  }

  window.SlowLeafScene = Scene;
})();
