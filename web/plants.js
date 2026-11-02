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
  function smoothOpen(pts) {
    const n = pts.length;
    let d = 'M' + pt(pts[0]);
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      d += ` C${pt([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${pt([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${pt(p2)}`;
    }
    return d;
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

  // ------------------------------------------------------------ per-plant traits (from the pot's seed)
  function hsl(c) {
    let [r, g, b] = hex(c).map(v => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function fromHsl(h, s, l) {
    h = ((h % 360) + 360) % 360; s = clamp(s); l = clamp(l);
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return '#' + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
  }
  function tint(c, T) {
    if (!T || (!T.dh && !T.ds && !T.dl)) return c;
    const [h, s, l] = hsl(c);
    return fromHsl(h + T.dh, s + T.ds, l + T.dl);
  }
  const HUES = [
    { name: 'blue-green', dh: 13, ds: -0.05, dl: -0.01 },
    { name: 'green', dh: 0, ds: 0, dl: 0 },
    { name: 'yellow-green', dh: -13, ds: 0.07, dl: 0.03 },
    { name: 'olive', dh: -24, ds: -0.07, dl: 0.015 }
  ];
  const POTS = {
    charcoal: { body: '#34383B', rim: '#3E4346', inner: '#151819', dark: '#1D2022', hl: '#70777B', hl2: '#7D8488', grain: 0.45 },
    cream: { body: '#E4D9C3', rim: '#ECE3CF', inner: '#3A3128', dark: '#BDAF94', hl: '#FAF6EC', hl2: '#FFFDF6', grain: 0.3 },
    terracotta: { body: '#B5674A', rim: '#C27455', inner: '#3A2418', dark: '#8A4A32', hl: '#D99779', hl2: '#E6A98C', grain: 0.4 },
    sage: { body: '#8DA38C', rim: '#9AAF98', inner: '#25302A', dark: '#6A816B', hl: '#C1D1BD', hl2: '#D1DECD', grain: 0.35 }
  };
  const WOODS = {
    light: { face: '#CFAE7F', side: '#9A7650', grain: '#8E6B45', hl: '#EBD3AE', knot: '#8E6B45' },
    walnut: { face: '#8C6446', side: '#5C3F2A', grain: '#5A3C26', hl: '#B38D6B', knot: '#4E3220' }
  };
  const VARIANT_NAMES = { aurea: "'Aurea'", albo: "'Albo'", spore: "'Yellow Moon'", silver: "'Silver Felt'", muffet: "'Miss Muffet'", strawberry: "'Strawberry Star'", mandaianum: "'Mandaianum'", goldsori: "'Golden Sori'", flame: "'Flame'", lilac: "'Lilac Dawn'", bluecone: "'Blue Cone'", trileaf: "'Three-Leaf'" };
  const PINKS = {
    rose: ['#EBA9B3', '#D8707F', '#9E2F45'],
    coral: ['#EFB6A4', '#DD8068', '#A13F31'],
    magenta: ['#E4A0BD', '#C65A84', '#86234F'],
    blush: ['#F2CFCC', '#E3A5A8', '#B0566A']
  };
  const traitCache = new Map();
  function traits(sp, seed) {
    const key = sp + ':' + seed;
    if (traitCache.has(key)) return traitCache.get(key);
    const r = rng((seed >>> 0) * 7 + 13);
    const hue = HUES[Math.floor(r() * HUES.length)];
    let t;
    if (sp === 'staghorn') {
      t = { hue, len: R(r, 0.92, 1.07), droop: R(r, 0.85, 1.35), lean: R(r, -6, 6), wood: r() < 0.5 ? 'light' : 'walnut', skip: [] };
      // drop a few fronds so every plant has its own silhouette
      for (let i = 2; i < 5; i++) if (r() < 0.28) t.skip.push(i);
      if (r() < 0.3) t.skip.push(5 + Math.floor(r() * 3));
    } else if (sp === 'caladium') {
      const pots = Object.keys(POTS), pk = Object.keys(PINKS);
      t = { hue, n: 9 + Math.floor(r() * 4), size: R(r, 0.9, 1.07), droop: R(r, 0, 0.15), lean: R(r, -7, 7), curve: R(r, 0.85, 1.18), pot: pots[Math.floor(r() * pots.length)], pink: pk[Math.floor(r() * pk.length)], spread: R(r, 0.6, 0.8) };
    } else if (sp === 'jadevine') {
      const pots = Object.keys(POTS), jd = ['turquoise', 'aqua', 'mint'];
      t = { hue, size: R(r, 0.92, 1.06), pot: pots[Math.floor(r() * pots.length)], jade: jd[Math.floor(r() * jd.length)], lead: r() < 0.5 ? -1 : 1, nr: r() < 0.5 ? 3 : 5 };
    } else if (sp === 'welwitschia') {
      const pots = Object.keys(POTS);
      t = { hue, size: R(r, 0.9, 1.05), pot: pots[Math.floor(r() * pots.length)], kl: 6 + Math.floor(r() * 3), kr: 6 + Math.floor(r() * 3), spread: R(r, 0.8, 1.2), arch: R(r, 0.85, 1.15) };
    } else if (sp === 'bluestar') {
      const pots = Object.keys(POTS);
      t = { hue, n: 10 + Math.floor(r() * 4), size: R(r, 0.9, 1.07), droop: R(r, 0.85, 1.25), lean: R(r, -7, 7), pot: pots[Math.floor(r() * pots.length)], lobes: R(r, 3.8, 5.6), curl: R(r, 0.15, 0.5) };
    } else {
      const pots = Object.keys(POTS);
      t = { hue, n: 10 + Math.floor(r() * 5), size: R(r, 0.9, 1.07), fen: R(r, 0.7, 1.2), droop: R(r, 0, 0.16), lean: R(r, -7, 7), curve: R(r, 0.82, 1.22), pot: pots[Math.floor(r() * pots.length)] };
    }
    t.seed = seed;
    traitCache.set(key, t);
    return t;
  }

  // ------------------------------------------------------------ Monstera leaf set
  const monCache = new Map();
  function monLeaves(seed) {
    if (monCache.has(seed)) return monCache.get(seed);
    const T = traits('monstera', seed);
    const r = rng(seed), out = [], N = T.n;
    const ang = [-4, 22, -24, 36, -40, 12, 48, -16, -54, 30, -32, 58, 2, -46];
    const tones = [0.06, -0.2, -0.38, 0.12, -0.38, -0.2, 0.04, -0.2, -0.38, 0.1, -0.2, -0.38, 0.08, -0.2];
    const turned = { 3: 0.62, 6: 0.7, 9: 0.58, 11: 0.66, 4: 0.82 };
    for (let i = 0; i < N; i++) {
      const k = i / (N - 1);
      out.push({
        i, a: ang[i] + R(r, -6, 6) + T.lean * (0.5 + k * 0.5), L: lerp(58, 150, Math.sqrt(k)) * R(r, 0.86, 1.1) * T.size, H: lerp(44, 116, Math.pow(k, 0.8)) * R(r, 0.9, 1.08) * T.size,
        b: k * 0.78, wr: R(r, 1.0, 1.14), asym: R(r, -0.09, 0.09), bl: R(r, 0.05, 0.19), ta: R(r, 0.2, 1), mc: R(r, -0.12, 0.12),
        turn: turned[i] || R(r, 0.88, 1), tone: tones[i] + R(r, -0.02, 0.02), seed: (seed % 100000) * 13 + 1000 + i * 7919,
        fenLevel: clamp((i - 1.5) / 9 * T.fen)
      });
    }
    monCache.set(seed, out);
    return out;
  }
  const MON_MATURE = 0.22;

  // ------------------------------------------------------------ Staghorn (wall mounted)
  const MOUNT = { x: 210, y: 176, w: 132, h: 196 };
  const HEART = [MOUNT.x, MOUNT.y + 34];
  const stagCache = new Map();
  function stagFronds(seed) {
    if (stagCache.has(seed)) return stagCache.get(seed);
    const T = traits('staghorn', seed);
    const r = rng(seed + 777), out = [];
    // angle from vertical-up; >90 means hanging. gravity pulls toward straight down
    const ang = [-10, 18, -42, 46, -72, 168, -146, 128];
    const tones = [0.02, -0.16, 0.06, -0.3, -0.12, 0.04, -0.14, 0.08, -0.06];
    let n = 0;
    for (let i = 0; i < ang.length; i++) {
      const hang = Math.abs(ang[i]) > 90;
      const a = ang[i] + R(r, -8, 8) + T.lean, L = (hang ? R(r, 170, 205) : R(r, 175, 210)) * T.len;
      const grav = (hang ? R(r, 0.14, 0.2) : R(r, 0.04, 0.07)) * T.droop, palm = hang ? R(r, 66, 84) : R(r, 50, 64);
      if (T.skip.includes(i)) continue;
      out.push({ i, hang, a, L, b: n * 0.08, grav, palm, seed: (seed % 100000) * 7 + 5000 + i * 104729, tone: tones[i] });
      n++;
    }
    const shields = [
      { b: 0.0, R: 92, a: -112, dx: -6, dy: 4, wf: 1.05, seed: 11, dark: 1 }, { b: 0.05, R: 96, a: 110, dx: 6, dy: 4, wf: 1.0, seed: 23, dark: 1 },
      { b: 0.16, R: 60, a: -36, dx: -2, dy: 0, wf: 1.0, seed: 37, dark: 0 }, { b: 0.22, R: 58, a: 38, dx: 2, dy: 0, wf: 0.98, seed: 51, dark: 0 }
    ].map(o => Object.assign(o, { seed: o.seed + (seed % 9973), a: o.a + R(r, -6, 6), R: o.R * R(r, 0.92, 1.06) }));
    const res = { fronds: out, shields };
    stagCache.set(seed, res);
    return res;
  }
  const STAG_MATURE = 0.3;
  const SILVER = ['#55665E', '#8B9E96', '#CDD8D2'];
  // 'Yellow Moon' (after P. willinckii 'Yellow Moon'): warm golden-green, moonlit shields
  const MOON = ['#5B6A2C', '#A2A64E', '#E6DC98'], MOONF = ['#4C6A2E', '#8EA64C', '#D2D88C'];

  // ------------------------------------------------------------ Caladium leaf set
  // Every leaf rises on its own petiole straight from the tuber. Older leaves lean further out; the newest
  // one comes up in the centre, tightly rolled, and unfurls. A blade is held with its tip pointing outward
  // and down, upper face tilted up and out toward the light, so leaves going sideways are seen side-on and
  // leaves pointing away show their pale backs.
  const calCache = new Map();
  function calLeaves(seed) {
    if (calCache.has(seed)) return calCache.get(seed);
    const T = traits('caladium', seed), r = rng(seed + 4242), out = [], N = T.n;
    const phi0 = R(r, 0, 360);
    for (let i = 0; i < N; i++) {
      const k = i / (N - 1), isNew = i === N - 1;
      const folded = !isNew && r() < 0.16;
      out.push({
        i, isNew,
        // spread round the plant, but on a windowsill few leaves point straight away from the room
        phi: 90 + (((phi0 + i * 137.5 + R(r, -16, 16)) % 360 + 540) % 360 - 180) * 0.76,
        lean: isNew ? R(r, 3, 10) : lerp(44, 16, k) + R(r, -6, 6),
        P: (isNew ? R(r, 160, 190) : R(r, 208, 248) * lerp(1, 0.92, k)) * T.size,
        L: (isNew ? R(r, 60, 70) : R(r, 72, 94)) * T.size,
        beta: R(r, 22, 50) + (1 - k) * 8, kr: R(r, 0.35, 0.65), rj: R(r, -0.25, 0.25),
        ox: R(r, -7, 7), oz: R(r, -4, 4),
        wr: R(r, 0.52, 0.66), lobe: R(r, 0.28, 0.42), sinus: R(r, 0.07, 0.16), asym: R(r, -0.07, 0.07), mc: R(r, -0.1, 0.1), tipx: R(r, 0, 0.15),
        fold: folded ? R(r, 0.5, 0.8) : R(r, 0.05, 0.32), tw: R(r, -0.3, 0.3), curl: R(r, -1.0, -0.1), lobeK: R(r, -0.45, 0.05), cup: R(r, 0.05, 0.3),
        // the newest leaf is still unfurling when the plant is fully grown
        b: isNew ? 1 - 0.42 * 0.2 : k * 0.62, ph: R(r, 0, 6), seed: (seed % 100000) * 11 + 3000 + i * 6007
      });
    }
    calCache.set(seed, out);
    return out;
  }
  const CAL_MATURE = 0.2;
  // dense Catmull-Rom samples (same curve as smoothClosed / smoothOpen)
  function smoothPts(pts, closed, K) {
    const n = pts.length, out = [], k = K || 6, segs = closed ? n : n - 1;
    const g = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
    for (let i = 0; i < segs; i++) {
      const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      for (let j = 0; j < k; j++) {
        const t = j / k, u = 1 - t;
        out.push([u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0], u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1]]);
      }
    }
    if (!closed) out.push(pts[n - 1]);
    return out;
  }
  // keep the part of a polygon where a*x + b*y + c >= 0
  function clipPoly(P, a, b, c) {
    const out = [], v = p => a * p[0] + b * p[1] + c;
    for (let i = 0; i < P.length; i++) {
      const A = P[i], B = P[(i + 1) % P.length], va = v(A), vb = v(B);
      if (va >= 0) out.push(A);
      if ((va >= 0) !== (vb >= 0)) { const t = va / (va - vb); out.push([lerp(A[0], B[0], t), lerp(A[1], B[1], t)]); }
    }
    return out;
  }
  function blotPts(cx, cy, rx, ry, rot, r) {
    const pts = [], n = 11, a0 = rad(rot);
    for (let i = 0; i < n; i++) {
      const t = i / n * Math.PI * 2, j = R(r, 0.62, 1.18);
      const x = Math.cos(t) * rx * j, y = Math.sin(t) * ry * j * R(r, 0.8, 1.15);
      pts.push([cx + x * Math.cos(a0) - y * Math.sin(a0), cy + x * Math.sin(a0) + y * Math.cos(a0)]);
    }
    return smoothPts(pts, true, 4);
  }
  function stripPts(P0, P1, P2, w0, w1, pw) {
    const N = 12, Lp = [], Rp = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, p = qAt(P0, P1, P2, t), tg = qTan(P0, P1, P2, t), w = lerp(w0, w1, Math.pow(t, pw || 1)) / 2;
      Lp.push([p[0] - tg[1] * w, p[1] + tg[0] * w]);
      Rp.push([p[0] + tg[1] * w, p[1] - tg[0] * w]);
    }
    const tE = qTan(P0, P1, P2, 1), e = qAt(P0, P1, P2, 1), tS = qTan(P0, P1, P2, 0), h1 = w1 / 2, h0 = w0 / 2;
    return Lp.concat([[e[0] + tE[0] * h1 * 1.2, e[1] + tE[1] * h1 * 1.2]], Rp.reverse(), [[P0[0] - tS[0] * h0, P0[1] - tS[1] * h0]]);
  }
  function densify(P, mx, closed) {
    const out = [], n = P.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const A = P[i], B = P[(i + 1) % n], k = Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) / mx);
      for (let j = 0; j < k; j++) out.push([lerp(A[0], B[0], j / k), lerp(A[1], B[1], j / k)]);
    }
    if (!closed) out.push(P[n - 1]);
    return out;
  }

  // ------------------------------------------------------------ Blue Star fern frond set
  const BSC = { leaf: ['#36595A', '#5A8582', '#A5C4BC'], young: ['#6E977F', '#90B59C', '#C6DCC4'] };
  const SILVERBLUE = ['#4C7279', '#8AACB1', '#D3E2E1'];
  const bsCache = new Map();
  function bsFronds(seed) {
    if (bsCache.has(seed)) return bsCache.get(seed);
    const T = traits('bluestar', seed), r = rng(seed + 9191), N = T.n, out = [];
    // fronds fan out all round; the outer ones arch over and hang past the rim
    const order = [];
    for (let q = 0; q < N; q++) order.push(q);
    for (let q = N - 1; q > 0; q--) { const j = Math.floor(r() * (q + 1)); [order[q], order[j]] = [order[j], order[q]]; }
    for (let q = 0; q < N; q++) {
      const i = order[q], k = i / (N - 1);
      const a = lerp(-80, 80, (q + 0.5) / N) + R(r, -7, 7) + T.lean * 0.6, d = Math.pow(Math.min(1, Math.abs(a) / 80), 1.1) * R(r, 0.8, 1.2);
      out.push({
        i, a, d, Lt: lerp(235, 205, Math.min(1, d)) * R(r, 0.82, 1.1) * T.size * lerp(0.7, 1, Math.sqrt(k)), sf: R(r, 0.17, 0.28),
        np: Math.max(3, Math.min(6, Math.round(T.lobes + R(r, -1.2, 1.2)))), grav: (0.08 + 0.85 * d) * R(r, 0.85, 1.15), curl: r() < T.curl ? R(r, 25, 60) : 0,
        tilt: R(r, 0.62, 1), phi0: R(r, 54, 72), phi1: R(r, 28, 44), ll: R(r, 0.85, 1.15), lbend: R(r, 0.03, 0.22),
        fert: r() < 0.7, b: k * 0.8, key: d + R(r, -0.15, 0.15), seed: (seed % 100000) * 17 + 7000 + i * 7727
      });
    }
    out.sort((x, y) => x.key - y.key);
    out.forEach((o, q) => { o.back = q < N * 0.3; o.tone = o.back ? R(r, 0.04, 0.1) : R(r, -0.14, 0.04); });
    bsCache.set(seed, out);
    return out;
  }
  const BS_MATURE = 0.24;

  // ------------------------------------------------------------ small 3D helpers (x right, y down, z toward the viewer)
  const a3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], s3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], k3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const d3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], x3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const n3 = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const l3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  // camera a little above (12 deg): screen x, screen y, depth (bigger = nearer)
  const CE = Math.cos(rad(12)), SE = Math.sin(rad(12));
  let OY = 0;
  const prj = w => [CX + w[0], SOIL + 1 + OY + w[1] * CE + w[2] * SE, -w[1] * SE + w[2] * CE];
  // Welwitschia grows wild, on a low mound of desert sand instead of in a pot
  const WW_OY = 32, WW_YF = 97 - WW_OY / CE, WW_MR = 150, WW_MZ = 0.6;
  const wwGround = (x, z, M) => {
    const a = Math.atan2(z / WW_MZ, x), r = Math.hypot(x, z / WW_MZ) / (1 + (M ? 0.05 * Math.sin(3 * a + M.ph) + 0.03 * Math.sin(5 * a + M.ph2) : 0));
    const t = clamp((r - 24) / (WW_MR - 24));
    return WW_YF * t * t * (3 - 2 * t) - (M ? 2.5 * Math.sin(r * 0.09 + M.ph) * (1 - t) * t * 4 : 0);
  };
  // a strap lying on the floor and heading towards us bends aside before it reaches the front of the picture
  // (it used to be cut off there, its torn tip left hanging over the sand)
  const wwSoftZ = z => z <= 100 ? z : 100 + 30 * (1 - Math.exp(-(z - 100) / 30));
  const mixP = (a, b, t) => a.map((c, i) => mix(c, b[i], t));

  // ------------------------------------------------------------ Jade vine (Strongylodon macrobotrys) on a hoop trellis
  const JADES = {
    turquoise: ['#23806F', '#4FC2A8', '#A0E4CF', '#E4F9F1'],
    aqua: ['#227F84', '#45B8B4', '#97DED6', '#DFF7F4'],
    mint: ['#2F8463', '#5CC298', '#A6E2C4', '#E3F7EA']
  };
  const JV_FLAME = ['#A42E1F', '#DD4F2E', '#F39068', '#FFD9C2'];
  const JV_LILAC = ['#7D61AA', '#B193D8', '#D8C6F0', '#F4EDFB'], JV_BLUE = ['#2F60A8', '#4E86D2', '#9BBEEC', '#E1EDFB'];
  // the hoop: two legs pushed into the soil, swelling into a ring (world units, origin at the soil centre)
  const HOOP = (() => {
    const Rh = 88, Hc = 152, a0 = 0.6, half = [];
    const J = [-Rh * Math.sin(a0), -Hc + Rh * Math.cos(a0)], tg = [-Math.cos(a0), -Math.sin(a0)];
    const P0 = [-21, 4], C = [J[0] - tg[0] * 40, J[1] - tg[1] * 40];
    for (let i = 0; i < 30; i++) half.push(qAt(P0, C, J, i / 30));
    for (let i = 0; i <= 60; i++) { const a = lerp(a0, Math.PI, i / 60); half.push([-Rh * Math.sin(a), -Hc + Rh * Math.cos(a)]); }
    const P = half.concat(half.slice(0, -1).reverse().map(([x, y]) => [-x, y])), S = [0];
    for (let i = 1; i < P.length; i++) S.push(S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    return { P, S, len: S[S.length - 1], Rh, Hc };
  })();
  function hoopAt(w) {
    const { P, S } = HOOP;
    w = clamp(w, 0, HOOP.len - 0.001);
    let lo = 0, hi = S.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= w) lo = m; else hi = m; }
    const t = (w - S[lo]) / (S[hi] - S[lo] || 1), p = [lerp(P[lo][0], P[hi][0], t), lerp(P[lo][1], P[hi][1], t)];
    const tx = P[hi][0] - P[lo][0], ty = P[hi][1] - P[lo][1], l = Math.hypot(tx, ty) || 1;
    let n = [-ty / l, tx / l];
    if (n[0] * p[0] + n[1] * (p[1] + HOOP.Hc) < 0) n = [-n[0], -n[1]];
    return { p, t: [tx / l, ty / l], n };
  }
  const jvCache = new Map();
  function jvPlan(seed) {
    if (jvCache.has(seed)) return jvCache.get(seed);
    const T = traits('jadevine', seed), r = rng(seed + 4242), half = HOOP.len / 2, lv = T.lead > 0 ? 1 : 0;
    const vines = [0, 1].map(j => {
      const nodes = [];
      for (let u = 14 + R(r, 0, 5); u < half + 70; u += R(r, 14.5, 18.5)) nodes.push({ u, flip: r() < 0.2, tw: R(r, -14, 14), st: R(r, 0.94, 1.16), seed: Math.floor(r() * 1e9) });
      return { j, ph: R(r, 0, 6.28), root: [(j ? 1 : -1) * R(r, 7, 12), 0, (j ? -1 : 1) * R(r, 5, 9)], start: j === lv ? 0 : R(r, 0.04, 0.1), over: R(r, 36, 62), nodes };
    });
    // flower trusses hang from the old wood: one heavy showpiece from the top of the hoop down the middle,
    // long ones beside the pot, shorter ones from the upper ring
    const rac = [], used = [];
    const hp = (j, n) => hoopAt(j ? HOOP.len - n.u : n.u).p;
    const free = (j, n) => n.u > 50 && n.u < half + 8 && !used.some(m => m.j === j && Math.abs(m.u - n.u) < 26);
    const all = () => [0, 1].flatMap(j => vines[j].nodes.filter(n => free(j, n)).map(n => ({ j, n, p: hp(j, n) })));
    const put = (c, o) => { used.push({ j: c.j, u: c.n.u }); rac.push(Object.assign({ j: c.j, node: c.n, bow: R(r, -4, 4), seed: Math.floor(r() * 1e9) }, o)); };
    const cn = vines[lv].nodes.reduce((a, b) => Math.abs(b.u - half) < Math.abs(a.u - half) ? b : a);
    used.push({ j: lv, u: cn.u });
    rac.push({ j: lv, node: cn, center: true, g0: R(r, 0.6, 0.66), Lmax: R(r, 198, 214) * T.size, bow: R(r, -3, 3), seed: Math.floor(r() * 1e9) });
    // the others come in pairs, one each side of the showpiece, roughly mirrored (never exactly: the nodes fall where they fall)
    const pair = (ok, L0, L1, g0) => {
      const sd = r() < 0.5 ? -1 : 1, A = all().filter(c => Math.sign(c.p[0]) === sd && ok(c.p));
      if (!A.length) return;
      const a = A[Math.floor(r() * A.length)], Lm = R(r, L0, L1), g = R(r, g0, g0 + 0.06);
      put(a, { g0: g, Lmax: Lm * R(r, 0.93, 1.07) * T.size });
      const B = all().filter(c => Math.sign(c.p[0]) === -sd && Math.abs(c.p[0]) > 14);
      if (!B.length) return;
      const b = B.reduce((m, c) => { const e = Math.abs(c.p[0] + a.p[0]) + 0.6 * Math.abs(c.p[1] - a.p[1]) + R(r, 0, 5); return e < m.e ? { c, e } : m; }, { c: null, e: 1e9 }).c;
      put(b, { g0: g + R(r, -0.02, 0.02), Lmax: Lm * R(r, 0.93, 1.07) * T.size });
    };
    // long ones toward the ends of the top third of the ring; with five, a shorter pair between them and the middle
    const five = T.nr === 5;
    pair(p => (five ? Math.abs(p[0]) > 56 && Math.abs(p[0]) < 72 && p[1] < -184 : Math.abs(p[0]) > 44 && Math.abs(p[0]) < 78 && p[1] < -192), 136, 172, 0.64);
    if (five) pair(p => p[1] < -200 && Math.abs(p[0]) > 22 && Math.abs(p[0]) < 40, 62, 90, 0.7);
    const out = { vines, rac };
    jvCache.set(seed, out);
    return out;
  }

  // ------------------------------------------------------------ Welwitschia mirabilis: a woody crown and two strap leaves for life
  const wwCache = new Map();
  function wwPlan(seed) {
    if (wwCache.has(seed)) return wwCache.get(seed);
    const T = traits('welwitschia', seed), r = rng(seed + 5151), leaves = [];
    // every leaf splits lengthwise into straps that fan out: front ones arch low over the rim, back ones loop up high
    const mk = (lf, K, spread, front) => {
      const st = [], mid = Math.floor(K / 2);
      for (let q = 0; q < K + (front ? 0 : 2); q++) {
        // (the last two of a side leaf grow away from us, over the back of the mound)
        const rear = q >= K, main = q === mid, c = rear ? -0.45 : main ? 0 : lerp(-1, 1, q / (K - 1)) + R(r, -0.1, 0.1);
        let d, H, ra;
        if (rear) { d = -(q === K ? R(r, 66, 80) : R(r, 86, 100)); H = R(r, 96, 128); ra = R(r, 44, 66); }
        else if (main) { d = R(r, -8, 8); H = R(r, 60, 76); ra = R(r, 56, 78); }
        else if (front) { d = c * R(r, 34, 56); H = R(r, 132, 160); ra = R(r, 40, 70); }
        else if (c < -0.55) { d = -R(r, 118, 158); H = R(r, 74, 112); ra = 0; }
        else if (c < 0) { d = c * R(r, 40, 70) * spread; H = lerp(60, 92, -c) * R(r, 0.85, 1.08); ra = R(r, 50, 90); }
        else { d = Math.min(54, c * R(r, 34, 62) * spread); H = lerp(56, 34, c) * R(r, 0.85, 1.1); ra = R(r, 50, 86); }
        st.push({
          main, c, d, H, ra, land: main ? 1 : R(r, 0.78, 1.22), flare: R(r, 0, 1), tail: R(r, 18, 80), Lk: main ? 1 : R(r, 0.86, 1), wk: main ? 1.15 : R(r, 0.85, 1.12),
          tw0: R(r, -0.6, 0.6), twA: R(r, 0.3, 1.0), twF: R(r, 0.004, 0.011), ph: R(r, 0, 6.28), flip: !main && r() < 0.3, fs: R(r, 0.25, 0.5),
          drift: R(r, -14, 14), side: r() < 0.5 ? -1 : 1, fray: 4 + Math.floor(r() * 3), frays: r() < 0.75, seed: Math.floor(r() * 1e9)
        });
      }
      // the ones that grow away from us only fill the gap: their tops stay level with the tallest of the rest
      // (they stand further back, which already lifts them on screen, so they are kept a little lower)
      if (!front) { const top = Math.max(...st.slice(0, K).filter(q => q.c >= -0.55).map(q => q.H)); st.forEach((q, i) => { if (i >= K) q.H = top * (i === K ? 0.86 : 0.8); }); }
      return st;
    };
    for (const sx of [-1, 1]) {
      const lf = { sx, phi: R(r, -10, 10), th0: R(r, 66, 78) * T.arch, L: R(r, 0.95, 1.06), tw0: R(r, -0.3, 0.3), twA: R(r, 0.1, 0.4), twF: R(r, 0.004, 0.008), ph: R(r, 0, 6.28) };
      lf.st = mk(lf, sx < 0 ? T.kl : T.kr, T.spread);
      leaves.push(lf);
    }
    const l3f = { third: true, sx: 0, phi: R(r, -12, 12), th0: R(r, 38, 48), L: R(r, 0.74, 0.86), tw0: 0, twA: 0.2, twF: 0.006, ph: 0 };
    l3f.st = mk(l3f, 5, 0.75, true);
    leaves.push(l3f);
    // cones on forked stalks round the crown rim
    const cones = [];
    for (let q = 0, n = 7 + Math.floor(r() * 2); q < n; q++) cones.push({ a: Math.PI * (-0.04 + 1.08 * (q + R(r, 0.25, 0.75)) / n), h: R(r, 34, 48), lean: R(r, -10, 10), seed: Math.floor(r() * 1e9) });
    // dry pieces shed by the leaf tips, lying on the floor
    const litter = [];
    for (let q = 0, n = 4 + Math.floor(r() * 3); q < n; q++) {
      const sx = q % 2 ? 1 : -1;
      litter.push({ x: sx * R(r, 80, 168), z: R(r, -24, 46), dir: R(r, -35, 35), sx, len: R(r, 22, 44), wk: R(r, 0.45, 0.75), g0: R(r, 0.55, 0.85), seed: Math.floor(r() * 1e9) });
    }
    const mound = { ph: R(r, 0, 6.28), ph2: R(r, 0, 6.28), stones: Array.from({ length: 16 }, () => ({ a: R(r, 0.08, 0.92) * Math.PI, r: R(r, 0.3, 0.98), s: R(r, 1.4, 4.2), e: R(r, 0.5, 0.85), rot: R(r, -40, 40), c: Math.floor(r() * 3) })) };
    const out = { leaves, cones, litter, mound, lump: Array.from({ length: 28 }, () => R(r, -1, 1)) };
    wwCache.set(seed, out);
    return out;
  }

  // noise textures are generated once and shared by every scene
  const texCache = new Map();
  let sceneCount = 0;

  class Scene {
    constructor(svg, opt = {}) {
      this.svg = svg;
      this.pet = !!opt.pet;
      this.static = !!opt.static;          // greenhouse thumbnails: draw once, no animation
      this.uid = 'sl' + (++sceneCount) + '_';
      svg.setAttribute('viewBox', '0 0 420 440');
      svg.setAttribute('preserveAspectRatio', 'xMidYMax meet');
      this.defs = E('defs', null, svg);
      this.layers = {};
      for (const n of ['bg', 'mount', 'ripples', 'plant', 'front', 'over', 'drops', 'night', 'fx', 'z']) this.layers[n] = E('g', { class: 'l-' + n }, svg);
      this.staticDefs();
      if (!this.pet && opt.bg !== false) this.drawBackground();
      this.buildNight();
      this.target = { G: 0.02, W: 0, mode: 'growing', species: 'monstera', seed: 1, variant: null, vk: 0, rare: false };
      this.disp = { G: null, W: 0, sleep: 0, vk: 0 };
      this.cur = { variant: null, vk: 0 };
      this.T = traits('monstera', 1);
      this.sporeTips = [];
      this.motes = [];
      this.nextMote = 1.5;
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
      if (!this.static) requestAnimationFrame(this.frame.bind(this));
    }

    setState(s) {
      const sp = s.species || 'monstera', seed = s.seed || 1, tg = this.target;
      const swap = sp !== tg.species || seed !== tg.seed;
      if (swap || (this.disp.G !== null && s.growth < this.disp.G - 0.1)) this.disp.G = s.growth;
      if (swap || !s.vk) this.disp.vk = s.vk || 0;
      this.target = { G: s.growth, W: s.stress || 0, mode: s.mode || 'growing', species: sp, seed, variant: s.variant || null, vk: s.vk || 0, rare: !!s.rare, over: s.over || null };
    }
    renderNow() {
      const d = this.disp, tg = this.target;
      d.G = tg.G; d.W = tg.W; d.sleep = tg.mode === 'sleeping' ? 1 : 0; d.vk = tg.vk;
      this.rebuild();
    }
    mountKey() { const tg = this.target; return `${tg.species}|${tg.seed}|${tg.rare ? 1 : 0}|${tg.over ? JSON.stringify(tg.over) : ''}`; }
    poke() { this.pokeT = (performance.now() - this.t0) / 1000; }

    // ------------------------------------------------ defs & static
    noiseURL(size, dots, alpha, streak) {
      const key = ['n', size, dots, alpha, streak].join();
      if (texCache.has(key)) return texCache.get(key);
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const x = c.getContext('2d'), r = rng(size * 31 + dots);
      for (let i = 0; i < dots; i++) {
        const v = Math.floor(R(r, 0, 90));
        x.fillStyle = `rgba(${v},${v},${v},${R(r, 0.2, 1) * alpha})`;
        if (streak) { x.save(); x.translate(r() * size, r() * size); x.rotate(R(r, -0.3, 0.3)); x.fillRect(0, 0, R(r, 3, 12), R(r, 0.5, 1.2)); x.restore(); }
        else x.fillRect(r() * size, r() * size, R(r, 0.6, 1.8), R(r, 0.6, 1.8));
      }
      texCache.set(key, c.toDataURL('image/png'));
      return texCache.get(key);
    }
    speckURL(size, dots) {
      return this.dotsURL(size, dots, [[170, 225], [205, 240], [150, 190]], [0.15, 0.6], [0.35, 1.0]);
    }
    starURL(size, n) {
      // tiny stellate hairs, like the felt on Platycerium veitchii
      const key = ['s', size, n].join();
      if (texCache.has(key)) return texCache.get(key);
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const x = c.getContext('2d'), r = rng(size * 5 + n);
      x.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const cx = r() * size, cy = r() * size, arms = 3 + Math.floor(r() * 3), len = R(r, 0.6, 1.4), a0 = r() * Math.PI;
        x.strokeStyle = `rgba(${Math.floor(R(r, 232, 252))},${Math.floor(R(r, 238, 252))},${Math.floor(R(r, 236, 250))},${R(r, 0.3, 0.75)})`;
        x.lineWidth = R(r, 0.3, 0.45);
        for (let q = 0; q < arms; q++) {
          const a = a0 + q * Math.PI / arms;
          x.beginPath(); x.moveTo(cx - Math.cos(a) * len, cy - Math.sin(a) * len); x.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); x.stroke();
        }
      }
      texCache.set(key, c.toDataURL('image/png'));
      return texCache.get(key);
    }
    dotsURL(size, dots, rgb, al, sz) {
      const key = ['d', size, dots, rgb, al, sz].join();
      if (texCache.has(key)) return texCache.get(key);
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const x = c.getContext('2d'), r = rng(size * 17 + dots);
      for (let i = 0; i < dots; i++) {
        x.fillStyle = `rgba(${Math.floor(R(r, rgb[0][0], rgb[0][1]))},${Math.floor(R(r, rgb[1][0], rgb[1][1]))},${Math.floor(R(r, rgb[2][0], rgb[2][1]))},${R(r, al[0], al[1])})`;
        const s = R(r, sz[0], sz[1]);
        x.beginPath(); x.arc(r() * size, r() * size, s, 0, Math.PI * 2); x.fill();
      }
      texCache.set(key, c.toDataURL('image/png'));
      return texCache.get(key);
    }
    staticDefs() {
      const d = this.defs;
      const grad = (id, stops, attrs) => {
        const g = E('linearGradient', Object.assign({ id: this.uid + id }, attrs), d);
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
      const rg = E('radialGradient', { id: this.uid + 'light', gradientUnits: 'userSpaceOnUse', cx: 90, cy: 40, r: 420 }, d);
      E('stop', { offset: 0, 'stop-color': '#FFFDF7', 'stop-opacity': 0.9 }, rg);
      E('stop', { offset: 1, 'stop-color': '#FFFDF7', 'stop-opacity': 0 }, rg);
      const gl = E('radialGradient', { id: this.uid + 'gloss', cx: 0.5, cy: 0.5, r: 0.5 }, d);
      E('stop', { offset: 0, 'stop-color': '#FBFAF2', 'stop-opacity': 0.5 }, gl);
      E('stop', { offset: 1, 'stop-color': '#FBFAF2', 'stop-opacity': 0 }, gl);
      const blur = E('filter', { id: this.uid + 'soft', x: '-30%', y: '-60%', width: '160%', height: '220%' }, d);
      E('feGaussianBlur', { stdDeviation: 4 }, blur);
      const nz = E('filter', { id: this.uid + 'paper', filterUnits: 'userSpaceOnUse', x: -300, y: -600, width: 1020, height: 1300 }, d);
      E('feTurbulence', { type: 'fractalNoise', baseFrequency: 0.8, numOctaves: 2, seed: 7 }, nz);
      E('feColorMatrix', { type: 'matrix', values: '0 0 0 0 0.42  0 0 0 0 0.37  0 0 0 0 0.3  0 0 0 0.07 0' }, nz);
      // painted textures (canvas, generated once)
      const pat = (id, url, size) => {
        const p = E('pattern', { id: this.uid + id, patternUnits: 'userSpaceOnUse', width: size, height: size }, d);
        E('image', { href: url, width: size, height: size }, p);
      };
      pat('grain', this.noiseURL(128, 2200, 0.5, false), 128);
      pat('fiber', this.noiseURL(128, 700, 0.55, true), 128);
      pat('speck', this.speckURL(96, 520), 96);
      pat('fuzz', this.dotsURL(64, 700, [[225, 250], [230, 250], [222, 245]], [0.2, 0.75], [0.3, 0.9]), 64);
      pat('stars', this.starURL(72, 230), 72);
      pat('felt', this.dotsURL(48, 650, [[150, 235], [105, 200], [30, 90]], [0.4, 0.95], [0.35, 1.1]), 48);
    }

    drawBackground() {
      const g = this.layers.bg;
      E('rect', { x: -300, y: -600, width: 1020, height: 1100, fill: PAL.paper }, g);
      E('rect', { x: -300, y: -600, width: 1020, height: 1100, fill: `url(#${this.uid}light)` }, g);
      E('path', { d: 'M502 -600 L939 -600 L238 386 L170 386 Z', fill: `url(#${this.uid}shaft)` }, g);
      E('rect', { x: -300, y: 386, width: 1020, height: 300, fill: `url(#${this.uid}floor)` }, g);
      E('line', { x1: -300, y1: 386.5, x2: 720, y2: 386.5, stroke: '#DCD2BF', 'stroke-width': 1 }, g);
      E('rect', { x: -300, y: -600, width: 1020, height: 1300, filter: `url(#${this.uid}paper)` }, g);
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
      this.mountFor = this.mountKey();
      if (sp === 'staghorn') this.drawPlaque(g); else if (sp === 'welwitschia') this.drawMound(g); else this.drawPot(g);
      if (this.target.rare && sp !== 'welwitschia') { if (sp === 'staghorn') this.brassEdge(g); else this.goldRim(fr); }
    }
    goldLine(d, parent, w) {
      E('path', { d, stroke: '#7A5A1C', 'stroke-width': f(w + 1.4), fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.55 }, parent);
      E('path', { d, stroke: '#D7AE45', 'stroke-width': f(w), fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent);
      E('path', { d, stroke: '#FFF0B5', 'stroke-width': f(Math.max(0.4, w * 0.3)), fill: 'none', 'stroke-linecap': 'round', opacity: 0.8, transform: 'translate(-0.4,-0.4)' }, parent);
    }
    goldRim(fr) {
      // a fine gold line along the rim: the quiet mark of a rare plant
      this.goldLine(`M${CX - 62},${282} A62,6 0 0 0 ${CX + 62},${282}`, fr, 1.3);
      this.goldLine(`M${CX - 60},${295.5} L${CX + 60},${295.5}`, fr, 1);
    }
    brassEdge(g) {
      const { x, y } = MOUNT, w = MOUNT.w, h = MOUNT.h, x0 = x - w / 2, y0 = y - h / 2;
      E('rect', { x: x0 + 2.5, y: y0 + 2.5, width: w - 5, height: h - 5, rx: 1.5, fill: 'none', stroke: '#C9A24A', 'stroke-width': 2.4 }, g);
      E('rect', { x: x0 + 2.5, y: y0 + 2.5, width: w - 5, height: h - 5, rx: 1.5, fill: 'none', stroke: '#FFEDB0', 'stroke-width': 0.6, opacity: 0.7 }, g);
      const L = 20;
      [[x0, y0, 1, 1], [x0 + w, y0, -1, 1], [x0, y0 + h, 1, -1], [x0 + w, y0 + h, -1, -1]].forEach(([cx, cy, sx, sy]) => {
        const d = `M${cx},${cy} L${cx + sx * L},${cy} L${cx + sx * L},${cy + sy * 5} L${cx + sx * 5},${cy + sy * 5} L${cx + sx * 5},${cy + sy * L} L${cx},${cy + sy * L} Z`;
        E('path', { d, fill: '#D3AE55', stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, g);
        E('path', { d: `M${cx + sx * 1.5},${cy + sy * 1.5} L${cx + sx * (L - 2)},${cy + sy * 1.5}`, stroke: '#FFF0BC', 'stroke-width': 0.8, opacity: 0.8 }, g);
        E('circle', { cx: cx + sx * 9, cy: cy + sy * 2.6, r: 1.1, fill: '#7A5A1C' }, g);
      });
    }
    drawWater(g, cx, cy, rx, ry, rim, rimRy) {
      E('ellipse', { cx, cy: cy + 9, rx: rim + 12, ry: 7, fill: '#5B4A3A', opacity: 0.13, filter: `url(#${this.uid}soft)` }, g);
      this.waterLine = { cx, cy, rx };
      this.shimmer = null;
      return [cx, cy, rx, ry, rim, rimRy];
    }
    drawPot(g) {
      // matte charcoal pot, cartoon ink style; no saucer
      this.water = null;
      this.shimmer = null;
      const fr = this.layers.front, PC = POTS[this.T.pot] || POTS.charcoal;
      E('ellipse', { cx: CX + 16, cy: 392, rx: 100, ry: 10, fill: '#1E2420', opacity: 0.22, filter: `url(#${this.uid}soft)` }, g);
      E('path', { d: `M${CX - 44},389 Q${CX + 10},380 ${CX + 86},387 Q${CX + 96},393 ${CX + 60},396 Q${CX},399 ${CX - 40},394 Z`, fill: '#1E2420', opacity: 0.55 }, g);
      const body = `M${CX - 57},292 C${CX - 59},332 ${CX - 53},366 ${CX - 40},382 Q${CX - 34},390 ${CX - 24},390 L${CX + 24},390 Q${CX + 34},390 ${CX + 40},382 C${CX + 53},366 ${CX + 59},332 ${CX + 57},292 Z`;
      E('path', { d: body, fill: PC.body }, g);
      E('path', { d: body, fill: `url(#${this.uid}grain)`, opacity: 0.45, style: 'mix-blend-mode:multiply' }, g);
      E('path', { d: `M${CX + 47},304 C${CX + 48},338 ${CX + 42},362 ${CX + 30},380`, stroke: PC.dark, 'stroke-width': 11, fill: 'none', 'stroke-linecap': 'round', opacity: 0.5 }, g);
      E('path', { d: `M${CX - 43},306 C${CX - 44},336 ${CX - 39},358 ${CX - 30},374`, stroke: PC.hl, 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', opacity: 0.5 }, g);
      E('path', { d: body, fill: 'none', stroke: INK, 'stroke-width': 2.4, 'stroke-linejoin': 'round' }, g);
      // rim: back half behind the stems, front band in front of them
      E('ellipse', { cx: CX, cy: 281, rx: 63, ry: 6.5, fill: PC.rim, stroke: INK, 'stroke-width': 2.2 }, g);
      E('ellipse', { cx: CX, cy: 282, rx: 56, ry: 4.6, fill: PC.inner }, g);
      const band = `M${CX - 63},281 A63,6.5 0 0 0 ${CX + 63},281 L${CX + 63},292 Q${CX + 63},297 ${CX + 58},297 L${CX - 58},297 Q${CX - 63},297 ${CX - 63},292 Z`;
      E('path', { d: band, fill: PC.rim }, fr);
      E('path', { d: band, fill: `url(#${this.uid}grain)`, opacity: 0.4, style: 'mix-blend-mode:multiply' }, fr);
      E('path', { d: `M${CX - 56},${291} L${CX + 20},291`, stroke: PC.hl2, 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0.55 }, fr);
      E('path', { d: band, fill: 'none', stroke: INK, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, fr);
    }
    moundSil(M) {
      // outline of the sand mound as seen by the camera: highest point in every screen column, then the front foot
      const o = OY;
      OY = WW_OY;
      const nz = a => 1 + 0.05 * Math.sin(3 * a + M.ph) + 0.03 * Math.sin(5 * a + M.ph2), bins = new Map();
      for (let i = 0; i < 96; i++) {
        const a = i / 96 * Math.PI * 2;
        for (let k = 0; k <= 30; k++) {
          const rr = WW_MR * nz(a) * k / 30, x = Math.cos(a) * rr, z = Math.sin(a) * rr * WW_MZ, q = prj([x, wwGround(x, z, M), z]), b = Math.round((q[0] - CX) / 4);
          if (!bins.has(b) || bins.get(b)[1] > q[1]) bins.set(b, q);
        }
      }
      const top = [...bins.keys()].sort((a, b) => a - b).map(b => bins.get(b)), base = [];
      for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI, rr = WW_MR * nz(a), x = Math.cos(a) * rr, z = Math.sin(a) * rr * WW_MZ; base.push(prj([x, WW_YF, z])); }
      const ring = (k, a0 = 0, a1 = Math.PI) => { const out = []; for (let i = 0; i <= 32; i++) { const a = lerp(a0, a1, i / 32), rr = WW_MR * nz(a) * k, x = Math.cos(a) * rr, z = Math.sin(a) * rr * WW_MZ; out.push(prj([x, wwGround(x, z, M), z])); } return out; };
      const at = (a, k) => { const rr = WW_MR * nz(a) * k, x = Math.cos(a) * rr, z = Math.sin(a) * rr * WW_MZ; return prj([x, wwGround(x, z, M), z]); };
      OY = o;
      // keep the top smooth (columns can jitter a little)
      const sm = top.map((q, i) => [q[0], (top[Math.max(0, i - 1)][1] + 2 * q[1] + top[Math.min(top.length - 1, i + 1)][1]) / 4]);
      return { top: sm, base, ring, at, d: smoothOpen(sm) + 'L' + base.map(pt).join('L') + 'Z' };
    }
    drawMound(g) {
      // a low, wild mound of sun-baked desert sand and grit, with a few stones half buried in it
      this.water = null;
      this.shimmer = null;
      const M = wwPlan(this.target.seed).mound, S = this.moundSil(M), rare = this.target.rare, fy = SOIL + 1 + 97 * CE;
      E('ellipse', { cx: CX + 18, cy: fy + 6, rx: WW_MR + 40, ry: 16, fill: '#3A2E20', opacity: 0.2, filter: `url(#${this.uid}soft)` }, g);
      const id = this.uid + 'mnd';
      const gr = E('linearGradient', { id, x1: 0, y1: 0, x2: 1, y2: 0.6 }, this.defs);
      [[0, '#E2C89A'], [0.45, '#CFAE7C'], [1, '#9C7A52']].forEach(([o, c]) => E('stop', { offset: o, 'stop-color': c }, gr));
      E('path', { d: S.d, fill: `url(#${id})` }, g);
      const cid = this.uid + 'mndc';
      E('path', { d: S.d }, E('clipPath', { id: cid }, this.defs));
      const gc = E('g', { 'clip-path': `url(#${cid})` }, g);
      // soft light from the upper left, a darker foot where the sand meets the floor
      E('ellipse', { cx: CX + 70, cy: fy - 4, rx: 110, ry: 34, fill: '#6E5236', opacity: 0.32, filter: `url(#${this.uid}soft)` }, gc);
      E('ellipse', { cx: CX - 50, cy: fy - 38, rx: 70, ry: 16, fill: '#F6E6C4', opacity: 0.4, filter: `url(#${this.uid}soft)` }, gc);
      E('path', { d: smoothOpen(S.base), stroke: '#6E5236', 'stroke-width': 7, fill: 'none', opacity: 0.25 }, gc);
      E('path', { d: S.d, fill: `url(#${this.uid}grain)`, opacity: 0.7, style: 'mix-blend-mode:multiply' }, gc);
      // wind ripples in the sand
      for (const k of [0.5, 0.68, 0.84]) E('path', { d: smoothOpen(S.ring(k, 0.12, Math.PI - 0.12)), stroke: '#8E6E48', 'stroke-width': 0.8, fill: 'none', opacity: 0.35, 'stroke-dasharray': '14 6 22 9' }, gc);
      // grit: a scatter of tiny pebbles
      const r = rng(this.target.seed + 909);
      let grit = '';
      for (let i = 0; i < 70; i++) { const q = S.at(R(r, 0.05, 0.95) * Math.PI, R(r, 0.25, 1)); grit += `M${f(q[0])},${f(q[1])}h${f(R(r, 0.8, 1.8))}`; }
      E('path', { d: grit, stroke: '#6E5838', 'stroke-width': 1.3, 'stroke-linecap': 'round', opacity: 0.45 }, gc);
      // stones (gold nuggets on a rare plant)
      const SC = [['#A39886', '#6F6657', '#CFC6B4'], ['#857A69', '#57503F', '#B3A894'], ['#B9A487', '#7E6B52', '#E0D1B6']];
      M.stones.forEach((st, i) => {
        const q = S.at(st.a, st.r), gold = rare && i % 5 === 1, c = gold ? ['#D7AE45', '#8A6420', '#FFF0B5'] : SC[st.c], sz = st.s * (gold ? 1.25 : 1);
        const gs = E('g', { transform: `translate(${f(q[0])},${f(q[1])}) rotate(${f(st.rot)})` }, gc);
        E('ellipse', { cx: 0.6, cy: sz * st.e * 0.6, rx: f(sz * 1.05), ry: f(sz * st.e * 0.55), fill: '#4A3824', opacity: 0.3 }, gs);
        E('path', { d: `M${f(-sz)},0 Q${f(-sz)},${f(-sz * st.e)} 0,${f(-sz * st.e)} Q${f(sz)},${f(-sz * st.e)} ${f(sz)},0 Q${f(sz * 0.6)},${f(sz * st.e * 0.4)} 0,${f(sz * st.e * 0.42)} Q${f(-sz * 0.7)},${f(sz * st.e * 0.4)} ${f(-sz)},0 Z`, fill: c[0], stroke: INK, 'stroke-width': 0.9, 'stroke-linejoin': 'round' }, gs);
        E('path', { d: `M${f(-sz * 0.55)},${f(-sz * st.e * 0.35)} Q${f(-sz * 0.2)},${f(-sz * st.e * 0.8)} ${f(sz * 0.3)},${f(-sz * st.e * 0.72)}`, stroke: c[2], 'stroke-width': f(Math.max(0.6, sz * 0.25)), fill: 'none', 'stroke-linecap': 'round', opacity: 0.8 }, gs);
        if (gold) E('circle', { cx: f(-sz * 0.2), cy: f(-sz * st.e * 0.55), r: 0.7, fill: '#FFFBE6' }, gs);
      });
      E('path', { d: smoothOpen(S.top), stroke: INK, 'stroke-width': 2.2, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      E('path', { d: smoothOpen(S.base), stroke: mix(INK, '#6E5236', 0.4), 'stroke-width': 1.4, fill: 'none', 'stroke-linecap': 'round', opacity: 0.8 }, g);
    }
    drawPlaque(g) {
      // rectangular wooden board on the wall, ink style; no bowl
      this.water = null;
      this.shimmer = null;
      const WD = WOODS[this.T.wood] || WOODS.light, { x, y } = MOUNT, w = MOUNT.w, h = MOUNT.h, x0 = x - w / 2, y0 = y - h / 2, th = 7;
      E('rect', { x: x0 + 8, y: y0 + 10, width: w, height: h, rx: 3, fill: '#3A3226', opacity: 0.2, filter: `url(#${this.uid}soft)` }, g);
      // twine + nail
      E('path', { d: `M${x - 34},${y0 + 14} L${x},${y0 - 40} L${x + 34},${y0 + 14}`, stroke: INK, 'stroke-width': 2.4, fill: 'none', 'stroke-linejoin': 'round' }, g);
      E('path', { d: `M${x - 34},${y0 + 14} L${x},${y0 - 40} L${x + 34},${y0 + 14}`, stroke: '#C9B48E', 'stroke-width': 1.1, fill: 'none', 'stroke-linejoin': 'round' }, g);
      E('circle', { cx: x, cy: y0 - 41, r: 3.4, fill: '#7A736A', stroke: INK, 'stroke-width': 1.4 }, g);
      // board thickness (right + bottom side)
      E('path', { d: `M${x0 + w},${y0 + 2} L${x0 + w + th},${y0 + th} L${x0 + w + th},${y0 + h + th} L${x0 + th},${y0 + h + th} L${x0},${y0 + h} L${x0 + w},${y0 + h} Z`, fill: WD.side, stroke: INK, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }, g);
      E('rect', { x: x0, y: y0, width: w, height: h, rx: 2, fill: WD.face }, g);
      // wood grain
      const r = rng(4242 + this.target.seed % 997);
      for (let k = 0; k < 13; k++) {
        const gx = x0 + 6 + k * (w - 12) / 12 + R(r, -3, 3), a = R(r, 1.5, 4), ph = R(r, 0, 6);
        let d = `M${f(gx)},${y0 + 2}`;
        for (let q = 1; q <= 8; q++) d += ` L${f(gx + Math.sin(q * 0.9 + ph) * a)},${f(y0 + q * h / 8)}`;
        E('path', { d, stroke: WD.grain, 'stroke-width': R(r, 0.5, 1.1), fill: 'none', opacity: R(r, 0.3, 0.6) }, g);
      }
      E('ellipse', { cx: x0 + w * 0.72, cy: y0 + h * 0.2, rx: 4, ry: 9, fill: 'none', stroke: WD.grain, 'stroke-width': 1, opacity: 0.6 }, g);
      E('rect', { x: x0, y: y0, width: w, height: h, rx: 2, fill: `url(#${this.uid}grain)`, opacity: 0.5, style: 'mix-blend-mode:multiply' }, g);
      E('path', { d: `M${x0 + 3},${y0 + 3} L${x0 + 3},${y0 + h - 3}`, stroke: WD.hl, 'stroke-width': 2, opacity: 0.7 }, g);
      E('rect', { x: x0, y: y0, width: w, height: h, rx: 2, fill: 'none', stroke: INK, 'stroke-width': 2 }, g);
      E('circle', { cx: x - 34, cy: y0 + 14, r: 2.4, fill: '#4D3B2E' }, g);
      E('circle', { cx: x + 34, cy: y0 + 14, r: 2.4, fill: '#4D3B2E' }, g);
    }

    // ------------------------------------------------ plants
    rebuild() {
      const d = this.disp, tg = this.target, sp = tg.species;
      this.T = Object.assign({}, traits(sp, tg.seed), tg.over || {});
      if (typeof this.T.hue === 'string') this.T.hue = HUES.find(h => h.name === this.T.hue) || HUES[1];
      this.cur = { variant: tg.variant, vk: tg.variant ? d.vk : 0 };
      if (this.mountFor !== this.mountKey()) this.drawMount(sp);
      if (this.pdefs) this.pdefs.remove();
      this.pdefs = E('g', null, this.defs);
      const g = this.layers.plant, og = this.layers.over;
      while (g.firstChild) g.removeChild(g.firstChild);
      while (og.firstChild) og.removeChild(og.firstChild);
      this.parts = [];
      this.tips = [];
      this.sporeTips = [];
      if (sp === 'staghorn') this.buildStaghorn(g, d.G, d.W, d.sleep);
      else if (sp === 'caladium') this.buildCaladium(g, d.G, d.W, d.sleep);
      else if (sp === 'bluestar') this.buildBlueStar(g, d.G, d.W, d.sleep);
      else if (sp === 'jadevine') this.buildJadeVine(g, d.G, d.W, d.sleep);
      else if (sp === 'welwitschia') this.buildWelwitschia(g, d.G, d.W, d.sleep);
      else this.buildMonstera(g, d.G, d.W, d.sleep);
      this.built = { species: sp, seed: tg.seed, variant: tg.variant, G: d.G, W: d.W, sleep: d.sleep, vk: this.cur.vk };
    }

    buildMonstera(g, G, W, sl) {
      monLeaves(this.target.seed).forEach(s => this.monsteraLeaf(g, s, G, W, sl));
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
      const TR = this.T, V = this.cur;
      const droop = W + sl * 0.25 + TR.droop;
      const bx = CX + s.a * 0.13 + R(r, -3, 3), by = SOIL + 1;
      const L = s.L;
      const a0 = s.a * 0.1 + R(r, -6, 6), a1 = s.a * 1.55 * TR.curve + side * (8 + droop * 22);
      const dA = dirv(a0), dB = dirv(a1);
      const P0 = [bx, by], C = [bx + dA[0] * L * 0.6, by + dA[1] * L * 0.6];
      const P2 = [C[0] + dB[0] * L * 0.52, C[1] + dB[1] * L * 0.52 + droop * L * 0.14];
      const sub = qSub(P0, C, P2, growL), T = sub.end;
      const finalBlade = s.a * 1.5 + side * Math.min(40, Math.abs(s.a) * 1.2) + side * (W * 40 + sl * 9) + R(r, -6, 6);
      const bAng = lerp(angOf(sub.tan), finalBlade, ease(m * 1.4 - 0.2));
      const ink = mix(INK, '#3A3122', W * 0.5);

      const lg = E('g', null, g);
      const stem = tint(mix(mix(PAL.stemYoung, PAL.stem, tm), PAL.stemWilt, W * 0.6), TR.hue);
      const sw = lerp(1.5, 3.4, size) * (0.8 + s.H / 140);
      const sp = `M${pt(P0)} Q${pt(sub.c)} ${pt(T)}`;
      E('path', { d: sp, stroke: ink, 'stroke-width': f(sw + 2.6), fill: 'none', 'stroke-linecap': 'round' }, lg);
      E('path', { d: sp, stroke: stem, 'stroke-width': f(sw), fill: 'none', 'stroke-linecap': 'round' }, lg);
      E('path', { d: sp, stroke: shade(stem, 0.35), 'stroke-width': f(Math.max(0.6, sw * 0.26)), fill: 'none', 'stroke-linecap': 'round', opacity: 0.7, transform: `translate(${f(-sw * 0.2)},0)` }, lg);
      const VC = V.variant === 'aurea' ? ['#DDB94F', '#F0D98C', '#C29A35'] : V.variant === 'albo' ? ['#EFEBDA', '#FBF9F0', '#D8D4BE'] : null;
      if (VC && V.vk > 0.01 && (s.seed % 5) < 3) E('path', { d: sp, stroke: VC[0], 'stroke-width': f(Math.max(0.6, sw * 0.32)), fill: 'none', 'stroke-linecap': 'round', opacity: f(0.8 * ease(V.vk)), transform: `translate(${f(sw * 0.18)},0)` }, lg);
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
        const id = `${this.uid}m${i}`;
        const pal = k => tint(shade(mix(mix(PAL.young[k], PAL.leaf[k], tm), PAL.wilt[k], W * 0.65), s.tone), TR.hue);
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
        if (VC && V.vk > 0.01) this.variegate(inner, s, P, H, V.variant, V.vk, W, mid);
        E('rect', Object.assign({ fill: `url(#${this.uid}speck)`, opacity: 0.38 }, big), inner);
        E('rect', Object.assign({ fill: `url(#${this.uid}grain)`, opacity: 0.3, style: 'mix-blend-mode:multiply' }, big), inner);
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
    variegate(inner, s, P, H, variant, vk, W, green) {
      // Modelled on real variegated Monstera: half-moons, sectors, marbling, constellation-like flecks.
      // Colour shifts from leaf to leaf (lime -> gold for Aurea, cream -> white with mint zones for Albo),
      // edges feather out along the veins, and there is a soft transition tone between green and colour.
      const rv = rng(s.seed * 3 + 77), k = ease(vk), t = rv();
      let C;
      if (variant === 'aurea') {
        const main = mix('#CFCD62', '#E8B43C', t);
        C = { main, light: mix(main, '#FBEFB8', 0.55), trans: mix(main, '#8EAA4C', 0.55), deep: mix(main, '#A87A22', 0.55), fleck: mix(main, '#FFF4C8', 0.45) };
      } else {
        const main = mix('#EDEAD3', '#FBFAF2', t);
        C = { main, light: '#FFFFFA', trans: mix('#BFD5AA', '#D7E5C6', t), deep: mix(main, '#CFCAAE', 0.75), fleck: '#FFFFF4' };
      }
      const wl = c => mix(c, PAL.wilt[1], W * 0.5);
      const sh = (c, x) => x < 0 ? mix(c, C.deep, 0.3) : c;     // the half turned from the light is a bit duller
      const dirAt = sx => { const a = P(0, 0), b = P(sx, -0.5), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
      const streak = (c, d, len, w, col, op) => {
        const n = [-d[1], d[0]], a = [c[0] - d[0] * len / 2, c[1] - d[1] * len / 2], b = [c[0] + d[0] * len / 2, c[1] + d[1] * len / 2];
        E('path', { d: `M${pt(a)} Q${pt([c[0] + n[0] * w, c[1] + n[1] * w])} ${pt(b)} Q${pt([c[0] - n[0] * w, c[1] - n[1] * w])} ${pt(a)} Z`, fill: wl(col), opacity: f(op) }, inner);
      };
      const region = (xb, sx, col, op) => {
        const pts = [];
        for (let q = 0; q <= 12; q++) pts.push(P(sx * xb(q), 0.12 - q * 0.104));
        pts.push(P(sx * 1.7, -1.3), P(sx * 1.7, 0.3));
        E('path', { d: smoothClosed(pts), fill: wl(sh(col, sx)), opacity: f(op) }, inner);
      };
      const edge = [];
      const rr = rv(), sx = rv() < 0.5 ? -1 : 1;
      const type = rr < 0.3 ? 'half' : rr < 0.54 ? 'sector' : rr < 0.84 ? 'marble' : rr < 0.95 ? 'speckle' : 'streak';
      if (type === 'half') {
        const x0 = R(rv, -0.06, 0.14), ph = R(rv, 0, 6), amp = R(rv, 0.04, 0.11);
        const xb = ex => q => 1.5 - k * (1.5 - (x0 + amp * Math.sin(q * 1.1 + ph) + 0.04 * Math.sin(q * 2.9 + ph * 2) + ex));
        region(xb(-0.16), sx, C.trans, 0.55);
        region(xb(0), sx, C.main, 0.97);
        region(xb(0.42), sx, C.light, 0.4);
        for (let q = 1; q <= 11; q++) edge.push([P(sx * xb(0)(q), 0.12 - q * 0.104), sx]);
      } else if (type === 'sector') {
        const c0 = R(rv, 0.3, 0.72), w = R(rv, 0.16, 0.32) * k, sk = R(rv, 0.06, 0.18);
        const wedge = (ww, col, op) => {
          const pts = [P(sx * 0.02, -(c0 - ww * 0.35)), P(sx * 0.6, -(c0 - ww + sk * 0.5)), P(sx * 1.5, -(c0 - ww * 1.4 + sk)), P(sx * 1.5, -(c0 + ww * 1.4 + sk)), P(sx * 0.6, -(c0 + ww + sk * 0.5)), P(sx * 0.02, -(c0 + ww * 0.35))];
          E('path', { d: smoothClosed(pts), fill: wl(sh(col, sx)), opacity: f(op) }, inner);
        };
        wedge(w * 1.4, C.trans, 0.5); wedge(w, C.main, 0.97); wedge(w * 0.45, C.light, 0.45);
        for (let q = 0; q <= 6; q++) for (const sg of [-1, 1]) edge.push([P(sx * lerp(0.1, 1.2, q / 6), -(c0 + sg * w * lerp(0.5, 1.25, q / 6) + sk * q / 6)), sx]);
      } else if (type === 'marble') {
        const n = Math.round((24 + rv() * 12) * (0.4 + 0.6 * k));
        for (let q = 0; q < 5; q++) {
          const sxr = rv() < 0.5 ? -1 : 1, c = P(sxr * R(rv, 0.25, 0.8), -R(rv, 0.15, 0.85)), rx = H * R(rv, 0.1, 0.22) * k;
          E('path', { d: blot(c[0], c[1], rx * 1.3, rx * 0.6, Math.atan2(dirAt(sxr)[1], dirAt(sxr)[0]) * 57.3, rv), fill: wl(sh(C.trans, sxr)), opacity: 0.5 }, inner);
          E('path', { d: blot(c[0], c[1], rx, rx * 0.45, Math.atan2(dirAt(sxr)[1], dirAt(sxr)[0]) * 57.3, rv), fill: wl(sh(C.main, sxr)), opacity: 0.95 }, inner);
        }
        for (let q = 0; q < n; q++) {
          const sxr = rv() < 0.5 ? -1 : 1, c = P(sxr * R(rv, 0.08, 1.0), -R(rv, 0.06, 0.94)), len = H * R(rv, 0.06, 0.26) * k;
          const pick = rv();
          streak(c, dirAt(sxr), len, len * R(rv, 0.1, 0.24), sh(pick < 0.55 ? C.main : pick < 0.8 ? C.trans : C.light, sxr), R(rv, 0.7, 0.95));
        }
      } else if (type === 'speckle') {
        const n = Math.round((45 + rv() * 40) * k);
        for (let q = 0; q < n; q++) {
          const sxr = rv() < 0.5 ? -1 : 1, c = P(sxr * R(rv, 0.05, 1.0), -R(rv, 0.04, 0.95)), len = H * R(rv, 0.012, 0.05);
          streak(c, dirAt(sxr), len, len * R(rv, 0.25, 0.5), sh(rv() < 0.6 ? C.fleck : C.main, sxr), R(rv, 0.75, 1));
        }
        for (let q = 0; q < 4; q++) {
          const sxr = rv() < 0.5 ? -1 : 1, c = P(sxr * R(rv, 0.2, 0.9), -R(rv, 0.15, 0.85)), len = H * R(rv, 0.07, 0.14) * k;
          streak(c, dirAt(sxr), len, len * 0.35, sh(C.main, sxr), 0.92);
        }
      } else {
        const n = 2 + Math.floor(rv() * 3);
        for (let q = 0; q < n; q++) {
          const sxr = rv() < 0.6 ? sx : -sx, c = P(sxr * 0.55, -R(rv, 0.15, 0.85)), len = H * R(rv, 0.3, 0.55) * k, w = H * R(rv, 0.015, 0.04);
          streak(c, dirAt(sxr), len * 1.1, w * 2.2, sh(C.trans, sxr), 0.45);
          streak(c, dirAt(sxr), len, w, sh(C.main, sxr), 0.95);
        }
      }
      // feathered edges: thin streaks along the veins, colour reaching into green and green into colour
      edge.forEach(([p, sxr]) => {
        for (let j = 0; j < 2; j++) {
          const d = dirAt(sxr), len = H * R(rv, 0.04, 0.13) * k, off = R(rv, -0.5, 0.5) * len;
          const c = [p[0] + d[0] * off + R(rv, -1, 1), p[1] + d[1] * off + R(rv, -1, 1)];
          streak(c, d, len, len * R(rv, 0.08, 0.18), rv() < 0.6 ? sh(C.main, sxr) : green, R(rv, 0.6, 0.95));
        }
      });
      // a light dusting of flecks on every variegated leaf
      const nf = Math.round((6 + rv() * 14) * k);
      for (let q = 0; q < nf; q++) {
        const sxr = rv() < 0.5 ? -1 : 1, c = P(sxr * R(rv, 0.05, 1.0), -R(rv, 0.05, 0.95)), len = H * R(rv, 0.01, 0.03);
        streak(c, dirAt(sxr), len, len * 0.4, sh(C.fleck, sxr), R(rv, 0.6, 0.95));
      }
    }

    buildStaghorn(g, G, W, sl) {
      // back: upright antler fronds; middle: round shield fronds; front: hanging fronds
      const ST = stagFronds(this.target.seed);
      ST.fronds.filter(s => !s.hang).forEach(s => this.staghornFrond(g, s, G, W, sl));
      ST.shields.forEach((s, i) => this.shieldFrond(g, s, i, G, W));
      // the little growing bud in the middle: one smooth, soft bud
      const k = ease(G / 0.08);
      if (k > 0.01) {
        const kg = E('g', null, g), rr = rng(5), [hx, hy] = HEART;
        E('path', { d: blot(hx, hy + 1, 5.2 * k, 4.4 * k, -10, rr), fill: '#9DBE72', stroke: INK, 'stroke-width': 1.1 }, kg);
        E('path', { d: `M${f(hx - 2.4 * k)},${f(hy - 0.5 * k)} Q${f(hx)},${f(hy - 3.2 * k)} ${f(hx + 2.6 * k)},${f(hy - 0.8 * k)}`, stroke: '#C9DFA3', 'stroke-width': 1.1, fill: 'none', 'stroke-linecap': 'round' }, kg);
      }
      ST.fronds.filter(s => s.hang).forEach(s => this.staghornFrond(g, s, G, W, sl));
    }

    shieldFrond(g, s, i, G, W) {
      const k = ease((G - s.b) / 0.16);
      if (k <= 0.01) return;
      const r = rng(s.seed);
      const age = clamp((G - s.b - 0.35) / 0.4);
      const P = s.dark ? ['#2B4A2E', '#3E6A3D', '#79A55C'] : ['#4E7F41', '#78A65A', '#B2D488'];
      const T = this.T, V = this.cur, silver = V.variant === 'silver' ? ease(V.vk) : 0, gold = V.variant === 'spore' ? ease(V.vk) : 0;
      const col = j => mix(mix(mix(tint(P[j], T.hue), SILVER[j], silver * 0.35), MOON[j], gold * (s.dark ? 0.38 : 0.6)), PAL.wilt[j], W * 0.5);
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
      const id = this.uid + 'sh' + i;
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
        E('path', { d: blot(cx2, cy2, RR * 0.24 * age, RR * 0.15 * age, a * 57, r), fill: mix('#857040', '#C8A85E', gold), opacity: 0.85 }, inner);
        E('path', { d: blot(cx2 + Math.sin(a) * RR * 0.05, cy2, RR * 0.13 * age, RR * 0.08 * age, a * 57, r), fill: mix('#64522A', '#A88540', gold), opacity: 0.7 }, inner);
      }
      E('rect', { x: f(-RR), y: f(-RR * 1.2), width: f(RR * 2), height: f(RR * 1.4), fill: `url(#${this.uid}grain)`, opacity: 0.45, style: 'mix-blend-mode:multiply' }, inner);
      if (silver > 0.01) E('rect', { x: f(-RR), y: f(-RR * 1.2), width: f(RR * 2), height: f(RR * 1.4), fill: `url(#${this.uid}stars)`, opacity: f((s.dark ? 0.22 : 0.42) * silver) }, inner);
      if (gold > 0.01) {
        // soft moonlit glow rising from the base of the shield
        const mg = E('radialGradient', { id: id + 'm', gradientUnits: 'userSpaceOnUse', cx: 0, cy: f(-RR * 0.12), r: f(RR * 0.62) }, sg);
        E('stop', { offset: 0, 'stop-color': '#F4E7A8', 'stop-opacity': 0.55 }, mg);
        E('stop', { offset: 1, 'stop-color': '#F4E7A8', 'stop-opacity': 0 }, mg);
        E('ellipse', { cx: 0, cy: f(-RR * 0.2), rx: f(rw * 0.9), ry: f(RR * 0.48), fill: `url(#${id}m)`, opacity: f(gold) }, inner);
      }
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
        lines.push({ P, T, Wd, lvl, leaf: !(hasKids && forkK > 0.01), gr });
      };
      const S0 = [HEART[0] + R(r, -4, 4), HEART[1] - 2 + R(r, -3, 3)];
      walk(tree, S0, s.a, hang ? 8 : 7, 0);

      const fg = E('g', null, g);
      const id = this.uid + 'fr' + s.i;
      const base = hang ? PAL.fernHang : PAL.fern;
      const V = this.cur, silver = V.variant === 'silver' ? ease(V.vk) : 0, gold = V.variant === 'spore' ? ease(V.vk) : 0;
      const pal = k => mix(mix(tint(shade(mix(mix(PAL.fernYoung[k], base[k], tm), PAL.wilt[k], W * 0.6), s.tone), this.T.hue), SILVER[k], silver * 0.5), MOONF[k], gold * 0.48);
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
          E('path', { d: blot(c[0], c[1], rx, ry, rot, r), fill: mix('#8A7340', '#C9AB62', gold), opacity: 0.8 }, inner);
          E('path', { d: blot(c[0] + wing.l[0] * sd * rx * 0.25, c[1] + wing.l[1] * sd * rx * 0.25, rx * 0.6, ry * 0.6, rot, r), fill: mix('#6A5428', '#A3823F', gold), opacity: 0.7 }, inner);
          for (let q = 0; q < 3; q++) {
            const u = R(r, -0.6, 0.6);
            E('path', { d: `M${pt([c[0] - wing.d[0] * ry * 0.6 + wing.d[1] * rx * u, c[1] - wing.d[1] * ry * 0.6 - wing.d[0] * rx * u])} Q${pt([c[0], c[1]])} ${pt([c[0] + wing.l[0] * sd * rx * 0.8, c[1] + wing.l[1] * sd * rx * 0.8])}`, stroke: '#4E3D1C', 'stroke-width': 0.5, fill: 'none', opacity: 0.6 }, inner);
          }
        }
      }
      E('rect', { x: -100, y: -100, width: 620, height: 640, fill: `url(#${this.uid}grain)`, opacity: 0.4, style: 'mix-blend-mode:multiply' }, inner);
      if (silver > 0.01) {
        // P. veitchii-like silvery felt
        // white star-shaped hairs: a fine, even felt that is thickest on the young tips and thins toward the base
        E('rect', { x: -100, y: -100, width: 620, height: 640, fill: `url(#${this.uid}stars)`, opacity: f(0.5 * silver) }, inner);
        lines.forEach(L => {
          if (!L.leaf) return;
          const k0 = Math.round(N * 0.45);
          E('path', { d: lineAt(L, 0, k0), stroke: '#EEF2EE', 'stroke-width': f(Math.max(2, L.Wd[N] * 1.1)), fill: 'none', opacity: f(0.16 * silver), 'stroke-linecap': 'round' }, inner);
          E('path', { d: lineAt(L, 0, k0), stroke: `url(#${this.uid}stars)`, 'stroke-width': f(Math.max(2, L.Wd[Math.round((k0 + N) / 2)] * 1.1)), fill: 'none', opacity: f(0.9 * silver), 'stroke-linecap': 'round' }, inner);
        });
        E('path', { d, fill: 'none', stroke: '#EEF2EE', 'stroke-width': 2.6, opacity: f(0.42 * silver) }, inner);
      }
      if (gold > 0.01) {
        // fertile tips of the hanging fronds carry small, velvety cinnamon spore pads with a pale gold edge
        const k = gold * ease((m - 0.45) / 0.4), rs = rng(s.seed + 31);
        lines.forEach(L => {
          if (!L.leaf || k < 0.02) return;
          // warm golden blush toward every fingertip
          E('path', { d: lineAt(L, 0, Math.round(N * 0.55)), stroke: '#E4CF78', 'stroke-width': f(Math.max(2, L.Wd[N] * 1.2)), fill: 'none', opacity: f(0.2 * k), 'stroke-linecap': 'round' }, inner);
          if (!hang) return;
          const patch = (start, wf) => {
            const k0 = Math.max(1, Math.round(N * lerp(0.95, start, k))), side = [], back = [];
            for (let q = k0; q <= N; q++) {
              const dv = dirv(L.T[q]), l = [dv[1], -dv[0]], ww = L.Wd[q] * wf * Math.min(1, (q - k0 + 1) / 2) * (1 + R(rs, -0.08, 0.08));
              side.push([L.P[q][0] + l[0] * ww, L.P[q][1] + l[1] * ww]);
              back.unshift([L.P[q][0] - l[0] * ww, L.P[q][1] - l[1] * ww]);
            }
            const e = L.P[N], dE = dirv(L.T[N]);
            const pts = side.concat([[e[0] + dE[0] * 1.5, e[1] + dE[1] * 1.5]], back);
            return pts.length >= 4 ? smoothClosed(pts) : null;
          };
          const outer = patch(0.66, 0.42), core = patch(0.74, 0.3);
          if (!outer) return;
          E('path', { d: outer, fill: '#D6AE62', opacity: 0.85 }, inner);
          if (core) E('path', { d: core, fill: '#AD7638', opacity: 0.9 }, inner);
          E('path', { d: outer, fill: `url(#${this.uid}felt)`, opacity: 0.5 }, inner);
          this.sporeTips.push(L.P[N]);
        });
      }
      // fine ink veins flowing along every finger
      lines.forEach(L => {
        const us = L.lvl === 0 ? [-0.36, -0.24, -0.12, 0, 0.12, 0.24, 0.36] : [-0.22, 0, 0.22];
        us.forEach(u => E('path', { d: lineAt(L, u + R(r, -0.03, 0.03)), stroke: INK, 'stroke-width': 0.45, fill: 'none', opacity: f(0.25 + 0.3 * tm), 'stroke-linejoin': 'round' }, inner));
      });
      E('path', { d, fill: 'none', stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, fg);
      ends.forEach(e => this.tips.push(e));
      this.parts.push({ g: fg, cx: S0[0], cy: S0[1], amp: (hang ? 0.9 : 0.5) + m * 0.5, ph: s.i * 1.3, blade: null });
    }

    // ------------------------------------------------ Caladium (fancy-leaf, peltate heart/arrow leaves)
    buildCaladium(g, G, W, sl) {
      // drawn above the pot rim so low blades never vanish into it, back leaves first
      const og = this.layers.over, jobs = [];
      calLeaves(this.target.seed).forEach(s => { const j = this.caladiumLeaf(s, G, W, sl); if (j) jobs.push(j); });
      jobs.sort((a, b) => a.dep - b.dep).forEach(j => j.draw(og));
    }
    potClip() {
      const id = this.uid + 'potclip';
      if (!this.potClipMade) {
        const cp = E('clipPath', { id, clipPathUnits: 'userSpaceOnUse' }, this.defs);
        E('path', { d: `M-80,-80 H500 V520 H-80 Z M${CX - 63},281 A63,6.5 0 0 0 ${CX + 63},281 L${CX + 63},299 L${CX - 63},299 Z`, 'clip-rule': 'evenodd' }, cp);
        this.potClipMade = true;
      }
      return id;
    }
    calSurface(o) {
      // maps a point of the flat blade (X across, Y along; tip at -H) onto the bent leaf, then tilts it
      const H = o.H, hw = Math.max(1, o.hw), st = 0.02;
      const kap = y => y < 0 ? o.curl * y * y : o.lobeK * y;
      const mk = (n, dir) => {
        const A = [[0, 0]];
        for (let j = 1; j <= n; j++) { const k = kap(dir * (j - 0.5) * st), p = A[j - 1]; A.push([p[0] + dir * Math.cos(k) * H * st, p[1] + Math.sin(k) * H * st]); }
        return A;
      };
      const An = mk(80, -1), Ap = mk(40, 1);
      const cp = Math.cos(o.pitch), sp = Math.sin(o.pitch);
      return (X, Y) => {
        const y = Y / H, A = y < 0 ? An : Ap, xx = clamp(Math.abs(y) / st, 0, A.length - 1.001), j = Math.floor(xx), t = xx - j;
        const my = lerp(A[j][0], A[j + 1][0], t), mz = lerp(A[j][1], A[j + 1][1], t);
        const k = kap(y), n = y < 0 ? [Math.sin(k), Math.cos(k)] : [-Math.sin(k), Math.cos(k)];
        const d = Math.abs(X), e = Math.min(1.2, d / hw), sN = Math.max(0, -y);
        const fo = o.fold * (y > 0 ? 1 - 0.6 * Math.min(1, y / 0.35) : 1) + o.cup * Math.pow(e, 1.5);
        const ro = o.rho + o.tw * Math.pow(sN, 1.3);
        const th = X >= 0 ? ro + fo : Math.PI + ro - fo;
        const q = d * Math.sin(th), py = my + n[0] * q, pz = mz + n[1] * q;
        return [o.mc * y * y * H + d * Math.cos(th), py * cp - pz * sp, py * sp + pz * cp];
      };
    }
    calNormal(S, X, Y) {
      const e = 0.5, a = S(X + e, Y), b = S(X - e, Y), c = S(X, Y + e), d = S(X, Y - e);
      const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], v = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(n[0], n[1], n[2]) || 1;
      return [n[0] / l, n[1] / l, n[2] / l];
    }
    calScale(S, X, Y) {
      const e = 0.5, a = S(X + e, Y), b = S(X - e, Y), c = S(X, Y + e), d = S(X, Y - e);
      return Math.sqrt(Math.abs((a[0] - b[0]) * (c[1] - d[1]) - (a[1] - b[1]) * (c[0] - d[0]))) / (2 * e);
    }
    calColors(W, tm, under) {
      const T = this.T, V = this.cur, PK = PINKS[T.pink] || PINKS.rose;
      const mu = V.variant === 'muffet' ? ease(V.vk) : 0, st = V.variant === 'strawberry' ? ease(V.vk) : 0;
      const gr = j => tint(mix(PAL.young[j], PAL.leaf[j], tm), T.hue);
      // young leaves open mostly green; the pink fills in as they mature
      const pk = 0.3 + 0.7 * tm;
      let c = under
        ? { margin: mix('#A7B38E', gr(2), 0.2), band: '#CDBAB8', fieldL: mix('#E6CDD1', PK[0], 0.2), fieldM: mix('#D8B2B9', PK[1], 0.15), vein: mix('#B9788A', PK[2], 0.2), center: mix('#C99AA4', PK[1], 0.2), spread: 0.86, cream: 0, net: 0.25 }
        : { margin: mix(gr(0), gr(1), 0.2), band: mix(gr(1), '#A6BC84', 0.3), fieldL: mix(gr(2), PK[0], pk), fieldM: mix(gr(1), PK[1], pk), vein: mix(gr(0), PK[2], 0.4 + 0.6 * tm), center: mix(gr(1), PK[2], pk), spread: T.spread, cream: 1, net: 0.3 };
      // colours travel around the hue wheel (pink -> peach -> lime) instead of through grey
      const mixH = (a, b, t) => {
        const A = hsl(a), B = hsl(b);
        let dh = B[0] - A[0];
        if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
        if (A[1] < 0.08) A[0] = B[0]; if (B[1] < 0.08) dh = 0;
        return fromHsl(A[0] + dh * t, lerp(A[1], B[1], t), lerp(A[2], B[2], t));
      };
      const blend = (o, t) => { for (const k in o) c[k] = typeof o[k] === 'number' ? lerp(c[k], o[k], t) : mixH(c[k], o[k], t); };
      // 'Miss Muffet': chartreuse leaf, fine burgundy freckles, pale cream midrib and veins
      if (mu > 0) blend(under ? { margin: '#B9C58F', band: '#D6DBA6', fieldL: '#E4E7BC', fieldM: '#D6DCA0', vein: '#ECE8C9', center: '#E3DAB0', spread: 0.94, net: 0.15 }
        : { margin: '#6C8A34', band: '#B8C962', fieldL: '#E3E7A4', fieldM: '#CDD97C', vein: '#F2EED2', center: '#E3D3A4', spread: 0.95, cream: 0, net: 0.15 }, mu);
      // 'Strawberry Star': white face, green margin, green netted veins, red spots between the main veins
      if (st > 0) blend(under ? { margin: '#9DB290', band: '#E4E5D9', fieldL: '#F1F0E7', fieldM: '#E6E5D8', vein: '#9DB68E', center: '#E6E6D8', spread: 0.9, net: 0.5 }
        : { margin: '#3D6A39', band: '#D3DFC3', fieldL: '#FAF9F2', fieldM: '#F0F1E6', vein: '#5D8E4C', center: '#EBEFE0', spread: 0.9, cream: 0, net: 0.95 }, st);
      if (W > 0) blend({ margin: PAL.wilt[0], band: PAL.wilt[1], fieldL: '#C9AE93', fieldM: '#B89380', center: '#9A7462' }, W * 0.55);
      c.mu = mu; c.st = st;
      return c;
    }
    caladiumLeaf(s, G, W, sl) {
      const i = s.i;
      const m = clamp((G - s.b) / CAL_MATURE);
      if (m <= 0.001) return null;
      const r = rng(s.seed);
      const growL = 0.1 + 0.9 * ease(m / 0.5), size = ease((m - 0.08) / 0.7);
      const op = ease((m - 0.25) / 0.55), tm = ease((m - 0.3) / 0.6) * (s.isNew ? 0.7 : 1);
      const TR = this.T, pg = ease(G / 0.75), droop = W + sl * 0.2 + TR.droop;
      const ink = mix(INK, '#3A3122', W * 0.5);
      // world: x right, y down, z toward the viewer; the camera looks down a little (like the pot rim)
      const ce = Math.cos(rad(20)), se = Math.sin(rad(20));
      const scr = w => [w[0], w[1] * ce + w[2] * se, -w[1] * se + w[2] * ce];
      const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
      const lv = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
      const d = [Math.cos(rad(s.phi)), 0, Math.sin(rad(s.phi))];
      const P = s.P * (s.isNew ? lerp(0.6, 1, pg) : lerp(0.4, 1, pg)) * (1 - W * 0.12);
      const B = [s.ox + TR.lean * 0.5, 0, s.oz];
      const H = s.L * (0.25 + 0.75 * size) * (1 - W * 0.08) * lerp(0.6, 1, pg);
      const hw = H * s.wr * (0.45 + 0.55 * op) * (1 - W * 0.12);
      const o = { H, hw, fold: lerp(1.42, s.fold + W * 0.35, op), rho: 0, tw: s.tw * op, curl: (s.curl - W * 0.9 - sl * 0.2) * op, lobeK: s.lobeK * op, cup: s.cup * op, pitch: 0, mc: s.mc };
      const S0 = this.calSurface(o);
      const pose = (lean, beta) => {
        // petiole: a 3D curve that leaves the tuber upright and arches outward
        const lr = rad(lean), E3 = add(B, [d[0] * P * Math.sin(lr), -P * Math.cos(lr) + droop * P * 0.06, d[2] * P * Math.sin(lr)]);
        const C3 = add(B, [d[0] * P * Math.sin(lr) * 0.18, -P * Math.cos(lr) * 0.72, d[2] * P * Math.sin(lr) * 0.18]);
        const qa = lv(B, C3, growL), qb = lv(C3, E3, growL), end = lv(qa, qb, growL), tan = nrm([qb[0] - qa[0], qb[1] - qa[1], qb[2] - qa[2]]);
        // blade frame: tip outward and down, upper face up-and-out, turned part-way toward the light
        const br = rad(beta), mF = [Math.cos(br) * d[0], Math.sin(br), Math.cos(br) * d[2]];
        let nF = [Math.sin(br) * d[0], -Math.cos(br), Math.sin(br) * d[2]];
        const v = [0, -se, ce], vp = nrm(add(v, sc(mF, -dot(v, mF)))), bb = cross(mF, nF);
        const ro = clamp(Math.atan2(dot(vp, bb), dot(vp, nF)) * s.kr + s.rj, -1.2, 1.2);
        nF = add(sc(nF, Math.cos(ro)), sc(bb, Math.sin(ro)));
        // a young leaf is a rolled spike that carries on from the petiole, then swings out as it opens
        const mm = nrm(lv(tan, mF, ease(m * 1.4 - 0.2)));
        // while rolled it simply faces us; it takes up its own angle as it opens
        const n0 = nrm(lv(v, nF, ease(op)));
        let nn = add(n0, sc(mm, -dot(n0, mm)));
        nn = Math.hypot(nn[0], nn[1], nn[2]) < 1e-3 ? [0, 0, 1] : nrm(nn);
        const l = cross(nn, mm);
        const S = (X, Y) => { const q = S0(X, Y); return scr([l[0] * q[0] - mm[0] * q[1] + nn[0] * q[2], l[1] * q[0] - mm[1] * q[1] + nn[1] * q[2], l[2] * q[0] - mm[2] * q[1] + nn[2] * q[2]]); };
        return { S, P0: scr(B), C: scr(C3), E: scr(E3), end: scr(end) };
      };
      // keep blades out of the pot and inside the frame: lift the blade first, then lean the petiole in
      let lean = s.lean + droop * 10, beta = s.beta + W * 28 + sl * 8, ps;
      for (let q = 0; q < 16; q++) {
        ps = pose(lean, beta);
        let bad = 0, wide = 0;
        [[0, -1], [0.9, -0.35], [-0.9, -0.35], [0.7, 0.3], [-0.7, 0.3]].forEach(([x, y]) => {
          const v = ps.S(x * hw, y * H), X = ps.end[0] + v[0], Y = SOIL + 1 + ps.end[1] + v[1];
          if (Y > 289 && Math.abs(X) < 74) bad = 1;
          if (Math.abs(X) > 184 || Y < 18) wide = 1;
        });
        if (!bad && !wide) break;
        if (bad && beta > -10) beta -= 7;
        if (wide || beta <= -10) lean = Math.max(0, lean - 5);
      }
      const S = ps.S;
      const toS = p => [CX + p[0], SOIL + 1 + p[1]];
      const P0 = toS(ps.P0), Cs = toS(ps.C), Es = toS(ps.E);
      const sub = qSub(P0, Cs, Es, growL), T = sub.end;
      const cen = S(0, -0.4 * H);
      return { dep: ps.end[2] + cen[2], draw: og => this.caladiumDraw(og, s, { S, T, P0, sub, H, hw, o, r, m, size, tm, W, sl, ink, i }) };
    }
    caladiumDraw(og, s, A) {
      const { S, T, P0, sub, H, hw, o, r, m, size, tm, W, ink, i } = A, TR = this.T;
      // long thin petiole, green at first, blushing pink with age; tucked behind the front of the rim
      const lgS = E('g', null, E('g', { 'clip-path': `url(#${this.potClip()})` }, og));
      const stem = mix(mix(tint('#9DB27A', TR.hue), mix('#C99790', (PINKS[TR.pink] || PINKS.rose)[1], 0.25), tm), PAL.stemWilt, W * 0.6);
      const sw = lerp(1.1, 2.1, size) * (0.85 + s.P / 700);
      const sp = `M${pt(P0)} Q${pt(sub.c)} ${pt(T)}`;
      E('path', { d: sp, stroke: ink, 'stroke-width': f(sw + 2.2), fill: 'none', 'stroke-linecap': 'round' }, lgS);
      E('path', { d: sp, stroke: stem, 'stroke-width': f(sw), fill: 'none', 'stroke-linecap': 'round' }, lgS);
      E('path', { d: sp, stroke: shade(stem, 0.4), 'stroke-width': f(Math.max(0.5, sw * 0.3)), fill: 'none', 'stroke-linecap': 'round', opacity: 0.7, transform: `translate(${f(-sw * 0.2)},0)` }, lgS);
      const lgB = E('g', null, og), bAng = 0;
      let blade = null;
      if (size > 0.01) {
        const Pf = (x, y) => [x * hw * (1 + s.asym * Math.sign(x)), y * H];
        const lk = s.lobe / 0.34;
        const half = [[0.07, -0.93 - s.tipx * 0.45], [0.22, -0.8], [0.45, -0.62], [0.7, -0.42], [0.9, -0.2], [1.0, 0.02], [0.95, 0.18 * lk], [0.8, 0.3 * lk], [0.58, 0.36 * lk], [0.34, 0.33 * lk], [0.14, 0.24 * lk], [0.04, s.sinus + 0.05]];
        const U = [[0, -1 - s.tipx]].concat(half, [[0, s.sinus]], half.slice().reverse().map(([x, y]) => [-x, y]));
        const unit = U.map(([x, y], q) => [x * (1 + 0.03 * Math.sin(q * 2.3 + s.ph)), y]);
        const OUT = smoothPts(unit.map(q => Pf(q[0], q[1])), true, 8);
        const PJ = (pts, close) => { let d = ''; for (let q = 0; q < pts.length; q++) d += (q ? 'L' : 'M') + pt(S(pts[q][0], pts[q][1])); return close ? d + 'Z' : d; };
        // split into the two halves; where a half turns edge-on, cut it so each piece shows a single face
        const pieces = [];
        for (const sx of [1, -1]) {
          const hp = clipPoly(OUT, sx, 0, 0);
          if (hp.length < 3) continue;
          let yT = Infinity, yB = -Infinity;
          hp.forEach(p => { yT = Math.min(yT, p[1]); yB = Math.max(yB, p[1]); });
          const fx = sx * hw * 0.35, cuts = [];
          let prev = null;
          for (let q = 0; q <= 60; q++) {
            const y = lerp(yT, yB, q / 60), nz = this.calNormal(S, fx, y)[2];
            if (prev !== null && (nz < 0) !== (prev < 0)) cuts.push(y - (yB - yT) / 120);
            prev = nz;
          }
          const bd = [yT - 1].concat(cuts, [yB + 1]);
          for (let q = 0; q < bd.length - 1; q++) {
            let pc = clipPoly(clipPoly(hp, 0, 1, -bd[q]), 0, -1, bd[q + 1]);
            if (pc.length < 3) continue;
            pc = densify(pc, 2.2, true);
            const nv = this.calNormal(S, fx, (Math.max(bd[q], yT) + Math.min(bd[q + 1], yB)) / 2);
            const P3 = pc.map(p => S(p[0], p[1]));
            pieces.push({ pc, P3, under: nv[2] < 0, n: nv, z: P3.reduce((a, p) => a + p[2], 0) / P3.length });
          }
        }
        pieces.sort((a, b) => a.z - b.z);
        const mixed = pieces.some(p => p.under) && pieces.some(p => !p.under);
        const crease = Math.max(mixed ? 0.9 : 0, clamp((o.fold - 0.35) / 0.45));
        // shared artwork, laid out on the flat blade and then bent with it
        const c0 = [0, -0.3];
        const scaledF = (k, wob, ph) => smoothPts(unit.map(([x, y]) => {
          const a = Math.atan2(x, -(y - c0[1])), kk = k * (1 + wob * Math.sin(a * 6 + ph) + wob * 0.5 * Math.sin(a * 11 + ph * 2));
          return Pf(c0[0] + (x - c0[0]) * kk, c0[1] + (y - c0[1]) * kk);
        }), true, 6);
        const fields = {};
        const field = sp2 => fields[sp2] || (fields[sp2] = [PJ(scaledF(sp2 + 0.07, 0.05, s.ph + 1), true), PJ(scaledF(sp2, 0.06, s.ph + 2), true)]);
        const dOut = PJ(OUT, true), dBand = PJ(scaledF(0.9, 0.015, s.ph), true);
        const VE = [[0, -0.95], [0.34, -0.72], [0.66, -0.48], [0.88, -0.2], [0.82, 0.16 * lk], [0.5, 0.31 * lk]];
        const veins = [];
        VE.forEach(([x, y], q) => {
          for (const sx of q ? [-1, 1] : [1]) {
            const e = [sx * x * 0.93, y * 0.93], cc = q ? [sx * x * 0.72, y * 0.28] : [0.02, -0.5];
            veins.push({ A: Pf(0, 0), B: Pf(cc[0], cc[1]), C: Pf(e[0], e[1]) });
          }
        });
        const blots = [];
        for (let q = 0; q < 4; q++) {
          const v1 = veins[Math.floor(R(r, 0, veins.length))], t = R(r, 0.35, 0.7), p = qAt(v1.A, v1.B, v1.C, t);
          blots.push([PJ(blotPts(p[0] + R(r, -3, 3), p[1] + R(r, -3, 3), H * R(r, 0.08, 0.14), H * R(r, 0.05, 0.08), R(r, 0, 180), r), true), R(r, 0.45, 0.75)]);
        }
        const dFeather = veins.map(v => PJ(stripPts(v.A, v.B, v.C, H * 0.13, H * 0.035, 0.8), true)).join('');
        const cb = Pf(0, -0.08), dCenter = PJ(blotPts(cb[0], cb[1], H * 0.16, H * 0.12, 0, r), true);
        const dVeins = veins.map((v, q) => PJ(stripPts(v.A, v.B, v.C, H * (q === 0 ? 0.04 : 0.03), H * 0.006, 1), true)).join('');
        // fine net veins
        const rs = rng(s.seed + 9);
        let dNet = '';
        veins.forEach(v => {
          for (let q = 0; q < 4; q++) {
            const t = 0.25 + q * 0.17 + R(rs, -0.04, 0.04), p = qAt(v.A, v.B, v.C, t), tg = qTan(v.A, v.B, v.C, t);
            for (const sd of [-1, 1]) {
              const nn = [-tg[1] * sd, tg[0] * sd], len = H * R(rs, 0.07, 0.13), e = [p[0] + (tg[0] * 0.7 + nn[0]) * len, p[1] + (tg[1] * 0.7 + nn[1]) * len];
              const mid = [p[0] + nn[0] * len * 0.6, p[1] + nn[1] * len * 0.6], ln = [];
              for (let j = 0; j <= 5; j++) ln.push(qAt(p, mid, e, j / 5));
              dNet += PJ(ln, false);
            }
          }
        });
        // flecks: cream speckles in the green band, burgundy freckles (Miss Muffet), red spots between veins (Strawberry Star)
        const rf = rng(s.seed + 5), V = this.cur;
        const mu = V.variant === 'muffet' ? ease(V.vk) : 0, st = V.variant === 'strawberry' ? ease(V.vk) : 0;
        const around = (lo, hi) => {
          const q = Math.floor(rf() * unit.length), a = unit[q], b = unit[(q + 1) % unit.length], t = rf(), k = R(rf, lo, hi);
          const x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t);
          return Pf(c0[0] + (x - c0[0]) * k, c0[1] + (y - c0[1]) * k);
        };
        const dots = (list) => {
          let d = '';
          list.forEach(([p, rr]) => { const v = S(p[0], p[1]), k = this.calScale(S, p[0], p[1]), rd = Math.max(0.25, rr * k); d += `M${f(v[0] - rd)},${f(v[1])}a${f(rd)},${f(rd)} 0 1,0 ${f(rd * 2)},0a${f(rd)},${f(rd)} 0 1,0 ${f(-rd * 2)},0`; });
          return d;
        };
        const creamL = [], muL = [], stL = [];
        for (let q = 0; q < 36; q++) creamL.push([around(TR.spread + 0.02, 0.9), H * R(rf, 0.008, 0.02)]);
        for (let q = 0; q < Math.round(70 * mu); q++) muL.push([around(0.06, 0.9), H * R(rf, 0.006, 0.016)]);
        for (let q = 0; q < Math.round(42 * st); q++) {
          const j = 1 + Math.floor(rf() * (VE.length - 1)), sx = rf() < 0.5 ? -1 : 1, e1 = VE[j - 1], e2 = VE[j];
          const t = R(rf, 0.3, 0.7), k = R(rf, 0.22, 0.85);
          stL.push([Pf(lerp(j - 1 === 0 ? 0 : e1[0] * sx, e2[0] * sx, t) * k, lerp(e1[1], e2[1], t) * k), H * R(rf, 0.012, 0.028)]);
        }
        const dCream = dots(creamL), dMu = dots(muL), dSt = dots(stL);
        const tipF = Pf(0, -1 - s.tipx);
        const tip3 = S(tipF[0], tipF[1]);
        const bg = E('g', { transform: `translate(${f(T[0])},${f(T[1])}) rotate(${f(bAng)})` }, lgB);
        const ow = clamp(0.5 + H / 120, 0.75, 1.3);
        const big = { x: f(-2.2 * H), y: f(-2.2 * H), width: f(4.4 * H), height: f(4.4 * H) };
        const LGT = [-0.35, -0.6, 0.72], LN = Math.hypot(...LGT);
        pieces.forEach((pc, q) => {
          const c = this.calColors(W, tm, pc.under);
          let dP = '';
          pc.P3.forEach((p, j) => { dP += (j ? 'L' : 'M') + pt(p); });
          dP += 'Z';
          const id = `${this.uid}c${i}_${q}`;
          const cp = E('clipPath', { id }, bg);
          E('path', { d: dP }, cp);
          E('path', { d: dP, fill: c.margin }, bg);
          const inner = E('g', { 'clip-path': `url(#${id})` }, bg);
          // speckled green band, then the coloured heart of the leaf
          E('path', { d: dBand, fill: c.band, opacity: 0.85 }, inner);
          const fd = field(c.spread);
          E('path', { d: fd[0], fill: c.fieldM, opacity: 0.45 }, inner);
          E('path', { d: fd[1], fill: c.fieldM }, inner);
          blots.forEach(([d, a]) => E('path', { d, fill: c.fieldL, opacity: f(a) }, inner));
          E('path', { d: dFeather, fill: c.fieldM, opacity: f(0.55 * clamp(c.spread / 0.75)) }, inner);
          E('path', { d: dCenter, fill: c.center, opacity: f(0.4 * tm) }, inner);
          if (!pc.under && c.cream > 0.02) E('path', { d: dCream, fill: '#EFEAD0', opacity: f(0.85 * c.cream * (0.3 + 0.7 * tm)) }, inner);
          if (c.mu > 0.02) E('path', { d: dMu, fill: pc.under ? '#B58B90' : '#7A2234', opacity: f(0.9 * c.mu) }, inner);
          if (c.st > 0.02) E('path', { d: dSt, fill: pc.under ? '#D79AA2' : '#C3324A', opacity: f(0.9 * c.st) }, inner);
          E('rect', Object.assign({ fill: `url(#${this.uid}speck)`, opacity: 0.3 }, big), inner);
          E('rect', Object.assign({ fill: `url(#${this.uid}grain)`, opacity: 0.3, style: 'mix-blend-mode:multiply' }, big), inner);
          E('path', { d: dNet, stroke: c.vein, 'stroke-width': f(ow * lerp(0.45, 0.8, c.net)), fill: 'none', opacity: f(c.net * (0.4 + 0.6 * tm)), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, inner);
          E('path', { d: dVeins, fill: 'none', stroke: ink, 'stroke-width': f(ow * 0.6), opacity: f(0.18 + 0.2 * tm) }, inner);
          E('path', { d: dVeins, fill: c.vein, opacity: f(0.6 + 0.4 * tm) }, inner);
          E('path', { d: dOut, stroke: '#ECEBD2', 'stroke-width': f(ow * 3), fill: 'none', opacity: pc.under ? 0.25 : 0.45, 'stroke-dasharray': `${f(H * 0.4)} ${f(H * 0.25)} ${f(H * 0.12)} ${f(H * 0.5)}`, 'stroke-dashoffset': f(R(r, 0, H)) }, inner);
          // light and shade from how this piece faces the window
          const nv = pc.under ? pc.n.map(v => -v) : pc.n, lam = (nv[0] * LGT[0] + nv[1] * LGT[1] + nv[2] * LGT[2]) / LN;
          E('path', { d: dP, fill: '#1E2A22', opacity: f(Math.min(pc.under ? 0.22 : 0.4, 0.5 * clamp(0.85 - lam))) }, inner);
          if (lam > 0.8) E('path', { d: dP, fill: '#FFFBEA', opacity: f(0.5 * (lam - 0.8)) }, inner);
          // ink: the outer edge (and the fold line where the leaf creases)
          const n = pc.pc.length, onMid = j => Math.abs(pc.pc[j][0]) < 1e-6 && Math.abs(pc.pc[(j + 1) % n][0]) < 1e-6;
          let s0 = 0;
          for (let j = 0; j < n; j++) if (onMid(j)) { s0 = j + 1; break; }
          let dI = '', dM = '', run = 0;
          for (let j = 0; j < n; j++) {
            const ja = (s0 + j) % n, jb = (ja + 1) % n, mid = onMid(ja);
            if (run !== (mid ? 2 : 1)) { if (mid) dM += 'M' + pt(pc.P3[ja]); else dI += 'M' + pt(pc.P3[ja]); run = mid ? 2 : 1; }
            if (mid) dM += 'L' + pt(pc.P3[jb]); else dI += 'L' + pt(pc.P3[jb]);
          }
          if (crease > 0.02 && dM) E('path', { d: dM, fill: 'none', stroke: ink, 'stroke-width': f(ow * 0.85), opacity: f(crease), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, bg);
          E('path', { d: dI, fill: 'none', stroke: ink, 'stroke-width': f(ow), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, bg);
        });
        blade = { g: bg, x: T[0], y: T[1], ang: bAng };
        if (size > 0.6) this.tips.push([T[0] + tip3[0], T[1] + tip3[1]]);
      }
      const amp = 0.4 + size * 0.8, ph = i * 1.9;
      this.parts.push({ g: lgS, cx: P0[0], cy: P0[1], amp, ph, blade: null });
      this.parts.push({ g: lgB, cx: P0[0], cy: P0[1], amp, ph, blade });
    }

    // ------------------------------------------------ Blue Star fern (Phlebodium aureum)
    buildBlueStar(g, G, W, sl) {
      const fr = bsFronds(this.target.seed), og = this.layers.over;
      fr.forEach(s => this.blueStarFrond(og, s, G, W, sl));
    }
    bsSide(s, sd, ruff, rr) {
      // one side of the blade in straight frond coordinates: x along the rachis (0 base .. 1 tip), y sideways
      const np = s.np, span = 0.62, spc = span / np, wing = 0.016, out = [], lobes = [];
      for (let j = 0; j < np; j++) {
        const k = np > 1 ? j / (np - 1) : 0;
        const sj = 0.03 + (j + 0.5) * spc + (sd < 0 ? spc * 0.2 : 0);
        const LL = lerp(0.46, 0.3, k) * s.ll * R(rr, 0.84, 1.12) * (1 - 0.08 * ruff), phi = rad(lerp(s.phi0, s.phi1, k) + R(rr, -6, 6));
        const hw = Math.min(spc * 0.46, LL * 0.17) * (1 + 0.15 * ruff), bend = s.lbend * R(rr, 0.6, 1.3);
        const a = [Math.cos(phi), Math.sin(phi) * sd], lo = [-Math.sin(phi), Math.cos(phi) * sd], up = [Math.sin(phi), -Math.cos(phi) * sd];
        const ph1 = R(rr, 0, 6), ph2 = R(rr, 0, 6), amp = 0.05 + 0.16 * ruff, fq = 7 + 9 * ruff;
        const B = [sj, wing * sd];
        // lobes curve gently toward the frond tip
        const cen = u => [B[0] + a[0] * LL * u + up[0] * LL * bend * u * u, B[1] + a[1] * LL * u + up[1] * LL * bend * u * u];
        const at = (u, dir, base, ph) => {
          const t = ease(u / 0.35), v = [lerp(base[0], dir[0], t), lerp(base[1], dir[1], t)], l = Math.hypot(v[0], v[1]) || 1;
          const w = hw * (1 - 0.15 * u) * Math.sqrt(Math.max(0, 1 - Math.pow(u, 4))) * (1 + amp * Math.sin(u * fq + ph) * Math.min(1, u * 3));
          const c = cen(u);
          return [c[0] + v[0] / l * w, c[1] + v[1] / l * w];
        };
        const US = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.79, 0.87, 0.93, 0.975];
        if (j > 0) out.push([sj - spc * 0.5, wing * 0.55 * sd]);
        US.forEach(u => out.push(at(u, lo, [-1, 0], ph1)));
        out.push(cen(1.012));
        US.slice().reverse().forEach(u => out.push(at(u, up, [1, 0], ph2)));
        lobes.push({ B, a, up, LL, hw, bend });
      }
      // long terminal lobe
      const s0 = 0.03 + span + 0.01, wT = 0.07 * (1 + 0.1 * ruff), ph = R(rr, 0, 6);
      out.push([s0 - spc * 0.35, wing * 0.6 * sd]);
      for (let q = 0; q <= 11; q++) {
        const u = q / 12, w = lerp(wing, wT, ease(u / 0.22)) * Math.sqrt(Math.max(0, 1 - Math.pow(u, 3))) * (1 + (0.05 + 0.18 * ruff) * Math.sin(u * (9 + 9 * ruff) + ph) * Math.min(1, u * 4));
        out.push([s0 + (1 - s0) * u, w * sd]);
      }
      return { pts: out, lobes, term: { s0, wT } };
    }
    blueStarFrond(g, s, G, W, sl) {
      const m = clamp((G - s.b) / BS_MATURE);
      if (m <= 0.001) return;
      const r = rng(s.seed), side = s.a < 0 ? -1 : 1, TR = this.T;
      const gr = 0.28 + 0.72 * ease(m / 0.7), uf = ease((m - 0.08) / 0.6), tm = ease((m - 0.3) / 0.6);
      const V = this.cur, ruff = V.variant === 'mandaianum' ? ease(V.vk) : 0, gold = V.variant === 'goldsori' ? ease(V.vk) : 0;
      const NS = 44;
      const bx = CX + clamp(s.a * 0.32, -38, 38) + R(r, -4, 4), by = SOIL + 1;
      const a0 = s.a * 0.5, a1 = s.a * 1.15 + TR.lean * 0.3, grav = s.grav * TR.droop * (1 + W * 1.8 + sl * 0.3) + W * 0.25;
      // keep the widest fronds inside the frame
      let Lt = s.Lt * gr;
      { let x = bx - CX, mx = 0; for (let k = 1; k <= NS; k++) { const t = k / NS, bd = lerp(a0, a1, Math.sqrt(t)) + side * grav * 120 * Math.pow(t, 1.2); x += Math.sin(rad(side > 0 ? Math.min(176, bd) : Math.max(-176, bd))) * Lt / NS; mx = Math.max(mx, Math.abs(x)); } if (mx > 178) Lt *= 178 / mx; }
      const step = Lt / NS, stipe = Lt * s.sf, Lb = Lt - stipe;
      const Pp = [[bx, by]], Th = [a0];
      let c = [bx, by], coil = 0;
      for (let k = 1; k <= NS; k++) {
        const t = k / NS;
        const xb = (t - s.sf) / (1 - s.sf);
        if (xb > uf) { const q = (xb - uf) / Math.max(0.05, 1 - uf); coil += -side * step / (lerp(9, 2.6, q) * (0.75 + 0.45 * gr)) * 57.3; }
        const curl = t > 0.78 ? side * s.curl * Math.pow((t - 0.78) / 0.22, 2) * uf : 0;
        const bend = lerp(a0, a1, Math.sqrt(t)) + side * grav * 120 * Math.pow(t, 1.2) + curl;
        const th = (side > 0 ? Math.min(176, bend) : Math.max(-176, bend)) + coil;
        const dv = dirv(th);
        c = [c[0] + dv[0] * step, c[1] + dv[1] * step];
        Pp.push(c); Th.push(th);
      }
      const at = S => {
        const x = clamp(S / step, 0, NS - 0.0001), i0 = Math.floor(x), fr = x - i0;
        return { p: [lerp(Pp[i0][0], Pp[i0 + 1][0], fr), lerp(Pp[i0][1], Pp[i0 + 1][1], fr)], th: lerp(Th[i0], Th[i0 + 1], fr) };
      };
      // blade folded tight inside the coil, opening behind the unfurling front
      const openAt = x => lerp(0.09, 1, ease((uf - x) / 0.14 + (uf >= 0.999 ? 1 : 0)));
      const map = (x, y) => {
        const S = stipe + clamp(x, -0.05, 1.02) * Lb, q = at(S), dv = dirv(q.th), l = [dv[1], -dv[0]], yy = y * Lb * s.tilt * openAt(clamp(x, 0, 1));
        const ex = x < 0 ? x * Lb : x > 1 ? (x - 1) * Lb : 0;
        return [q.p[0] + l[0] * yy + dv[0] * ex, q.p[1] + l[1] * yy + dv[1] * ex];
      };
      const rr = rng(s.seed + 3);
      const L = this.bsSide(s, 1, ruff, rr), Rr = this.bsSide(s, -1, ruff, rr);
      const tip = [1.025, 0];
      const local = [[-0.012, 0]].concat(L.pts, [tip], Rr.pts.slice().reverse());
      const outline = local.map(([x, y]) => map(x, y));
      const fg = E('g', null, g);
      const id = this.uid + 'bs' + s.i;
      const pale = s.back ? 0.16 : 0;
      const pal = k => mix(mix(tint(shade(mix(mix(BSC.young[k], BSC.leaf[k], tm), PAL.wilt[k], W * 0.6), s.tone), TR.hue), SILVERBLUE[k], ruff * 0.5), '#D9E3DE', pale);
      const dk = pal(0), md = pal(1), lt = pal(2);
      const ink = mix(INK, '#3A3122', W * 0.5);
      // long dark stipe
      let sd = '';
      for (let k = 0; k <= Math.round(NS * s.sf) + 1; k++) sd += (k ? ' L' : 'M') + pt(Pp[Math.min(NS, k)]);
      const stc = mix(mix('#8FA27A', '#6C6A4C', tm), PAL.stemWilt, W * 0.5);
      // the stipe rises from behind the front of the rim; only the blades may hang over it
      const sg = E('g', { 'clip-path': `url(#${this.potClip()})` }, fg);
      E('path', { d: sd, stroke: ink, 'stroke-width': 3.2, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, sg);
      E('path', { d: sd, stroke: stc, 'stroke-width': 1.4, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, sg);
      const d = smoothClosed(outline);
      E('path', { d, fill: md }, fg);
      const cp = E('clipPath', { id: id + 'c' }, fg);
      E('path', { d }, cp);
      const inner = E('g', { 'clip-path': `url(#${id}c)` }, fg);
      const line = (pts) => pts.map((p, q) => (q ? 'L' : 'M') + pt(map(p[0], p[1]))).join(' ');
      const lobeP = (lb, u, off) => {
        const tg = [lb.a[0] + lb.up[0] * 2 * lb.bend * u, lb.a[1] + lb.up[1] * 2 * lb.bend * u], l = Math.hypot(tg[0], tg[1]) || 1, o = off || 0;
        return [lb.B[0] + lb.a[0] * lb.LL * u + lb.up[0] * lb.LL * lb.bend * u * u - tg[1] / l * o, lb.B[1] + lb.a[1] * lb.LL * u + lb.up[1] * lb.LL * lb.bend * u * u + tg[0] / l * o];
      };
      const lobeLine = (lb, u0, u1, off) => {
        const pts = [];
        for (let q = 0; q <= 6; q++) pts.push(lobeP(lb, lerp(u0, u1, q / 6), off));
        return line(pts);
      };
      // watercolour: darker rim, the far half in shade, a pale streak down every lobe
      E('path', { d, fill: 'none', stroke: dk, 'stroke-width': 3.5, opacity: 0.45 }, inner);
      Rr.lobes.forEach(lb => E('path', { d: lobeLine(lb, 0, 0.85), stroke: dk, 'stroke-width': f(Math.max(2, lb.hw * Lb * s.tilt * 1.3)), fill: 'none', opacity: 0.35, 'stroke-linecap': 'round' }, inner));
      L.lobes.concat(Rr.lobes).forEach(lb => E('path', { d: lobeLine(lb, 0.1, 0.8, lb.hw * 0.25), stroke: lt, 'stroke-width': f(Math.max(1.5, lb.hw * Lb * s.tilt * 0.6)), fill: 'none', opacity: 0.45, 'stroke-linecap': 'round' }, inner));
      E('path', { d: line([[L.term.s0, 0.02], [1, 0.005]]), stroke: lt, 'stroke-width': f(Math.max(1.5, L.term.wT * Lb * s.tilt * 0.8)), fill: 'none', opacity: 0.4, 'stroke-linecap': 'round' }, inner);
      // waxy bloom
      E('rect', { x: -100, y: -100, width: 620, height: 640, fill: `url(#${this.uid}speck)`, opacity: 0.22 }, inner);
      E('rect', { x: -100, y: -100, width: 620, height: 640, fill: `url(#${this.uid}grain)`, opacity: 0.35, style: 'mix-blend-mode:multiply' }, inner);
      if (ruff > 0.01) {
        // 'Mandaianum': ruffled, silvery edges catch the light
        E('path', { d, fill: 'none', stroke: '#E7EFEC', 'stroke-width': 2.2, opacity: f(0.45 * ruff) }, inner);
      }
      // pale costa along the rachis and down each lobe, with fine ink veins
      const cost = mix(lt, '#D7DDB4', 0.4);
      const rach = line([[0, 0], [0.5, 0], [1, 0]].flatMap((p, q, A) => q ? [[lerp(A[q - 1][0], p[0], 0.5), 0], p] : [p]));
      E('path', { d: rach, stroke: cost, 'stroke-width': 1.5, fill: 'none', opacity: 0.85, 'stroke-linecap': 'round' }, inner);
      L.lobes.concat(Rr.lobes).forEach(lb => {
        E('path', { d: lobeLine(lb, 0, 0.88), stroke: cost, 'stroke-width': 0.9, fill: 'none', opacity: f(0.5 + 0.3 * tm), 'stroke-linecap': 'round' }, inner);
        E('path', { d: lobeLine(lb, 0.05, 0.85, lb.hw * 0.45), stroke: ink, 'stroke-width': 0.4, fill: 'none', opacity: f(0.18 + 0.15 * tm) }, inner);
      });
      if (gold > 0.01 && m > 0.55 && !s.back && s.fert) {
        // 'Golden Sori': round golden-orange spore dots in a row either side of every lobe's midvein
        const k = gold * ease((m - 0.55) / 0.35);
        const dotAt = (x, y, rr2) => {
          const p = map(x, y);
          E('circle', { cx: f(p[0]), cy: f(p[1]), r: f(rr2 + 0.5), fill: '#7A5418', opacity: f(0.45 * k) }, inner);
          E('circle', { cx: f(p[0]), cy: f(p[1]), r: f(rr2), fill: '#E2AE48', opacity: f(0.95 * k) }, inner);
          E('circle', { cx: f(p[0] - rr2 * 0.3), cy: f(p[1] - rr2 * 0.3), r: f(rr2 * 0.4), fill: '#FFE9A8', opacity: f(0.8 * k) }, inner);
          if (rng(Math.round(p[0] * 13 + p[1] * 7))() < 0.12) this.sporeTips.push(p);
        };
        const rad2 = clamp(Lb * 0.008, 0.75, 1.25) * (0.6 + 0.4 * k);
        L.lobes.concat(Rr.lobes).forEach(lb => {
          for (let u = 0.3; u < 0.8; u += 0.17) for (const o of [-1, 1]) {
            const q = lobeP(lb, u, lb.hw * 0.48 * o * (1 - 0.15 * u));
            dotAt(q[0], q[1], rad2);
          }
        });
        for (let x = L.term.s0 + 0.05; x < 0.9; x += 0.075) for (const o of [-1, 1]) dotAt(x, o * L.term.wT * 0.45 * (1 - (x - L.term.s0) / (1 - L.term.s0) * 0.5), rad2);
      }
      E('path', { d, fill: 'none', stroke: ink, 'stroke-width': 0.95, 'stroke-linejoin': 'round' }, fg);
      if (uf < 0.985) {
        // the crozier: a soft, fuzzy fiddlehead coil that unrolls from the base up
        const k0 = Math.min(NS - 1, Math.max(1, Math.ceil((s.sf + (1 - s.sf) * Math.max(0, uf - 0.04)) * NS)));
        let cd = 'M' + pt(Pp[k0]);
        for (let k = k0 + 1; k <= NS; k++) cd += ' L' + pt(Pp[k]);
        const cw = clamp(Lt * 0.022, 2.6, 4.6), yc = mix(BSC.young[1], '#B9C9A0', 0.25);
        E('path', { d: cd, stroke: ink, 'stroke-width': f(cw + 2.2), fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, fg);
        E('path', { d: cd, stroke: yc, 'stroke-width': f(cw), fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, fg);
        E('path', { d: cd, stroke: `url(#${this.uid}fuzz)`, 'stroke-width': f(cw), fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.6 }, fg);
        E('path', { d: cd, stroke: shade(yc, 0.45), 'stroke-width': f(cw * 0.3), fill: 'none', 'stroke-linecap': 'round', opacity: 0.7, transform: 'translate(-0.5,-0.5)' }, fg);
      }
      if (uf > 0.95) {
        this.tips.push(map(1, 0));
        L.lobes.slice(0, 2).forEach(lb => { const q = lobeP(lb, 1); this.tips.push(map(q[0], q[1])); });
      }
      this.parts.push({ g: fg, cx: bx, cy: by, amp: 0.5 + m * 0.6, ph: s.i * 1.45, blade: null });
    }

    // ------------------------------------------------ Jade vine (Strongylodon macrobotrys): twining up a hoop, claw flowers in hanging trusses
    buildJadeVine(g, G, W, sl) {
      const og = this.layers.over, plan = jvPlan(this.target.seed), items = [], half = HOOP.len / 2;
      const clip = `url(#${this.potClip()})`, ink = mix(INK, '#3A3122', W * 0.5);
      items.push({ dep: 0, draw: p => this.jvHoop(p, clip) });
      const U = {};
      plan.vines.forEach(v => {
        if (G < v.start) return;
        const gv = clamp((G - v.start) / (0.84 - v.start)), Uv = U[v.j] = lerp(34, half + v.over, Math.pow(gv, 0.92));
        // stem: thick brown old wood near the soil, purplish green further up, a bronze tip still searching for support
        const pts = [];
        for (let u = 0; u <= Uv + 0.01; u += 2.5) { const q = this.jvVinePt(v, Math.min(u, Uv), Uv); pts.push({ u, w: q.p, s: prj(q.p) }); }
        const wb = lerp(1.2, 3.1, clamp(Uv / 260));
        let run = [];
        const flush = () => {
          if (run.length < 2) return;
          const um = run[Math.floor(run.length / 2)].u, a = Uv - um, z = run.reduce((t, p) => t + p.w[2], 0) / run.length;
          const col = mix(a < 30 ? mix('#A27E66', '#727457', a / 30) : mix('#727457', '#5E4838', clamp((a - 30) / 150)), PAL.stemWilt, W * 0.4);
          const sw = lerp(wb, 0.9, Math.pow(um / Math.max(1, Uv), 0.8)), d = run.map((p, q) => (q ? 'L' : 'M') + pt(p.s)).join('');
          items.push({ dep: z < 0 ? -1.5 : 1.5, draw: p => {
            const gg = E('g', { 'clip-path': clip }, p);
            E('path', { d, stroke: ink, 'stroke-width': f(sw + 1.8), fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gg);
            E('path', { d, stroke: col, 'stroke-width': f(sw), fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gg);
            if (sw > 1.4) E('path', { d, stroke: shade(col, 0.35), 'stroke-width': f(sw * 0.28), fill: 'none', 'stroke-linecap': 'round', opacity: 0.6, transform: 'translate(-0.3,-0.4)' }, gg);
          } });
        };
        pts.forEach((p, q) => {
          if (run.length && ((p.w[2] < 0) !== (run[run.length - 1].w[2] < 0) || run.length > 12)) { const last = run[run.length - 1]; flush(); run = [last]; }
          run.push(p);
        });
        flush();
        if (Uv > 20) this.tips.push(pts[pts.length - 1].s);
        // trifoliate leaves at the nodes, alternate; young ones bronze and limp
        v.nodes.forEach((n, q) => {
          if (n.u > Uv - 5) return;
          const m = clamp((Uv - n.u - 5) / 80), at = this.jvVinePt(v, n.u, Uv);
          const zs = (q % 2 ? 1 : -1) * (v.j ? -1 : 1) * (n.flip ? -1 : 1);
          const it = this.jvLeaf(at, zs, m, n, W, sl, ink);
          if (it) items.push(it);
        });
      });
      plan.rac.forEach(rc => {
        const v = plan.vines[rc.j], Uv = U[rc.j];
        if (!Uv || G < rc.g0 || Uv < rc.node.u + 14) return;
        const it = this.jvRaceme(rc, this.jvVinePt(v, rc.node.u, Uv), clamp((G - rc.g0) / Math.max(0.12, 0.97 - rc.g0)), W, ink);
        if (it) items.push(it);
      });
      items.sort((a, b) => a.dep - b.dep).forEach(it => it.draw(og));
    }
    jvVinePt(v, u, U) {
      // the stem winds round the hoop; its last few cm reach out into the air
      const w = v.j ? HOOP.len - u : u, h = hoopAt(w), ang = u * 0.165 + v.ph, rt = 3.3 + (u > HOOP.len / 2 ? 1.8 : 0);
      let p = [h.p[0] + h.n[0] * rt * Math.cos(ang), h.p[1] + h.n[1] * rt * Math.cos(ang), rt * Math.sin(ang)];
      if (u < 22) p = l3([v.root[0], -u * 0.8, v.root[2]], p, ease(u / 22));
      const q = (u - (U - 26)) / 26;
      if (q > 0) p = a3(p, [h.n[0] * 12 * q * q, h.n[1] * 12 * q * q - 4 * q * q, (v.j ? -1 : 1) * 6 * q * q]);
      return { p, h };
    }
    jvHoop(p, clip) {
      const d = HOOP.P.map((q, i) => (i ? 'L' : 'M') + pt(prj([q[0], q[1], 0]))).join('');
      const gg = E('g', { 'clip-path': clip }, p), rare = this.target.rare;
      const cap = { fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
      if (rare) {
        // rare plants climb a polished brass hoop with little collars
        E('path', Object.assign({ d, stroke: INK, 'stroke-width': 4.6 }, cap), gg);
        E('path', Object.assign({ d, stroke: '#B8902F', 'stroke-width': 2.9 }, cap), gg);
        E('path', Object.assign({ d, stroke: '#7A5A1C', 'stroke-width': 0.9, opacity: 0.7, transform: 'translate(0.6,0.6)' }, cap), gg);
        E('path', Object.assign({ d, stroke: '#FFEFB8', 'stroke-width': 0.9, opacity: 0.9, transform: 'translate(-0.5,-0.5)' }, cap), gg);
        for (let w = 40; w < HOOP.len - 20; w += 62) {
          const h = hoopAt(w), c = prj([h.p[0], h.p[1], 0]), a = Math.atan2(h.t[1], h.t[0]) * 57.3;
          const cg = E('g', { transform: `translate(${f(c[0])},${f(c[1])}) rotate(${f(a)})` }, gg);
          E('rect', { x: -1.6, y: -2.9, width: 3.2, height: 5.8, rx: 1.1, fill: '#D9B65A', stroke: INK, 'stroke-width': 0.8 }, cg);
          E('path', { d: 'M-0.6,-2.2 L-0.6,2.2', stroke: '#FFF3C4', 'stroke-width': 0.6, opacity: 0.9 }, cg);
        }
        return;
      }
      E('path', Object.assign({ d, stroke: INK, 'stroke-width': 4.8 }, cap), gg);
      E('path', Object.assign({ d, stroke: '#A6835A', 'stroke-width': 3 }, cap), gg);
      E('path', { d, stroke: '#D7BB90', 'stroke-width': 0.9, fill: 'none', opacity: 0.8, transform: 'translate(-0.5,-0.5)' }, gg);
      // bamboo nodes
      let dn = '';
      for (let w = 26; w < HOOP.len - 10; w += 34) {
        const h = hoopAt(w), a = prj([h.p[0] + h.n[0] * 2.3, h.p[1] + h.n[1] * 2.3, 0]), b = prj([h.p[0] - h.n[0] * 2.3, h.p[1] - h.n[1] * 2.3, 0]);
        dn += `M${pt(a)}L${pt(b)}`;
      }
      E('path', { d: dn, stroke: INK, 'stroke-width': 1, opacity: 0.75 }, gg);
    }
    jvLeaf(at, zs, m, n, W, sl, ink) {
      const TR = this.T, sz = 1.1 * TR.size * n.st * lerp(0.3, 1, ease(m / 0.8)), young = 1 - ease((m - 0.15) / 0.45);
      const N = at.p, out = [at.h.n[0], at.h.n[1], 0];
      // petiole out from the stem, a little up; the blade frame then droops under its weight
      const m0 = n3(a3(a3(k3(out, 0.6), [0, -0.3, 0]), [Math.sin(rad(n.tw)) * 0.3, 0, zs * 0.8]));
      const n0 = n3(a3([0, -1, 0.25 * zs + 0.1], k3(m0, -d3([0, -1, 0.25 * zs + 0.1], m0)))), l0 = x3(n0, m0);
      const Lp = (15 + 11 * ease(m)) * sz, Q = a3(N, k3(m0, Lp));
      const beta = rad(26 + young * 48 + W * 34 + sl * 16 + n.tw * 0.8);
      const fold = lerp(0.22, 1.25, young) + sl * 0.35 + W * 0.3;
      const frame = (al, bt) => {
        const ma = a3(k3(m0, Math.cos(al)), k3(l0, Math.sin(al)));
        return { mm: n3(a3(k3(ma, Math.cos(bt)), k3(n0, -Math.sin(bt)))), nn: n3(a3(k3(n0, Math.cos(bt)), k3(ma, Math.sin(bt)))) };
      };
      const lf = [];
      const aL = rad(lerp(58, 30, young) + sl * 8);
      lf.push(Object.assign({ base: a3(Q, k3(frame(0, beta).mm, 3 * sz)), H: 40 * sz }, frame(0, beta)));
      for (const sd of [-1, 1]) lf.push(Object.assign({ base: Q, H: 32 * sz }, frame(sd * aL, beta + rad(14))));
      const pal = (k, under) => {
        const up = mix(mix(['#8C5C48', '#B37C60', '#D6A98C'][k], ['#56794A', '#7EA067', '#B2CB95'][k], ease((m - 0.15) / 0.5)), ['#32553A', '#4C7447', '#80A26C'][k], 0.85 * ease((m - 0.6) / 0.4));
        const un = mix(['#A98476', '#C9A898', '#E2CCBF'][k], ['#7D9470', '#A2B791', '#C9D6B8'][k], ease((m - 0.15) / 0.5));
        return mix(tint(under ? un : up, TR.hue), PAL.wilt[k], W * 0.6);
      };
      const Nscr = prj(N), Qs = prj(Q), r = rng(n.seed);
      const leaflets = lf.map(L => {
        const H = L.H, hw = H * 0.25, ll = x3(L.nn, L.mm);
        const S0 = this.calSurface({ H, hw, fold, rho: 0, tw: R(r, -0.25, 0.25), curl: -0.3 - W * 0.6 - young * 0.3, lobeK: 0, cup: 0.12, pitch: 0, mc: R(r, -0.04, 0.04) });
        const S = (X, Y) => { const q = S0(X, Y); return prj(a3(L.base, [ll[0] * q[0] - L.mm[0] * q[1] + L.nn[0] * q[2], ll[1] * q[0] - L.mm[1] * q[1] + L.nn[1] * q[2], ll[2] * q[0] - L.mm[2] * q[1] + L.nn[2] * q[2]])); };
        return { S, H, hw, dep: S(0, -H * 0.5)[2] };
      }).sort((a, b) => a.dep - b.dep);
      const wp = t => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), 0.8) * (1 - 0.2 * t) * (1 - 0.35 * ease((t - 0.78) / 0.22));
      const LGT = [-0.35, -0.6, 0.72], LN = Math.hypot(...LGT);
      const draw = p => {
        const gl = E('g', null, p);
        const dpe = `M${pt(Nscr)}L${pt(Qs)}`;
        E('path', { d: dpe, stroke: ink, 'stroke-width': f(1.2 + 1.6 * sz), fill: 'none', 'stroke-linecap': 'round' }, gl);
        E('path', { d: dpe, stroke: mix(pal(1, false), '#7A6A50', 0.35), 'stroke-width': f(1.2 * sz), fill: 'none', 'stroke-linecap': 'round' }, gl);
        leaflets.forEach(({ S, H, hw }) => {
          for (const sx of [1, -1]) {
            const side = [];
            for (let q = 0; q <= 12; q++) { const t = q / 12; side.push([sx * hw * wp(t), -H * t]); }
            const nv = this.calNormal(S, sx * hw * 0.45, -H * 0.45), under = nv[2] < 0;
            const P = side.map(q => S(q[0], q[1]));
            const dF = P.map((q, i) => (i ? 'L' : 'M') + pt(q)).join('') + 'Z';
            E('path', { d: dF, fill: pal(1, under) }, gl);
            const nn = under ? nv.map(x => -x) : nv, lam = (nn[0] * LGT[0] + nn[1] * LGT[1] + nn[2] * LGT[2]) / LN;
            if (lam < 0.85) E('path', { d: dF, fill: '#1E2A22', opacity: f(Math.min(0.42, 0.55 * (0.85 - lam))) }, gl);
            else E('path', { d: dF, fill: '#FFFBEA', opacity: f(Math.min(0.3, 0.6 * (lam - 0.85))) }, gl);
            // pinnate veins
            let dv = '';
            for (let k = 1; k <= 6; k++) {
              const t = k / 7.2;
              const a = S(0, -H * t), b = S(sx * hw * 0.5 * wp(t + 0.05), -H * (t + 0.07)), c = S(sx * hw * 0.85 * wp(t + 0.1), -H * (t + 0.13));
              dv += `M${pt(a)}Q${pt(b)} ${pt(c)}`;
            }
            E('path', { d: dv, stroke: under ? pal(0, true) : pal(2, false), 'stroke-width': 0.5, fill: 'none', opacity: 0.6 }, gl);
            E('path', { d: P.map((q, i) => (i ? 'L' : 'M') + pt(q)).join(''), stroke: ink, 'stroke-width': f(0.6 + 0.4 * sz), fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, gl);
          }
          let dm = '';
          for (let q = 0; q <= 8; q++) dm += (q ? 'L' : 'M') + pt(S(0, -H * q / 8 * 0.97));
          E('path', { d: dm, stroke: mix(pal(2, false), '#E6E2C0', 0.3), 'stroke-width': f(0.5 + 0.4 * sz), fill: 'none', opacity: 0.8 }, gl);
          if (fold > 0.7) E('path', { d: dm, stroke: ink, 'stroke-width': 0.6, fill: 'none', opacity: f(clamp((fold - 0.7) / 0.4)) }, gl);
        });
        // (the leaves on the hoop hold still: there are dozens of them, and only the hanging trusses sway - saves a lot of CPU)
      };
      if (m > 0.7) { const tp = leaflets[leaflets.length - 1]; this.tips.push(tp.S(0, -tp.H)); }
      return { dep: (N[2] + Q[2]) / 2 + zs * 2, draw };
    }
    jvColors(t, W) {
      const V = this.cur, TR = this.T, base = JADES[TR.jade] || JADES.turquoise;
      const fl = V.variant === 'flame' ? ease(V.vk) : 0, li = V.variant === 'lilac' ? ease(V.vk) : 0;
      let pal = base, bud = '#9FB4A6', calyx = '#56706A', glow = base[3];
      if (fl > 0) { pal = mixP(pal, JV_FLAME, fl); bud = mix(bud, '#C08A70', fl); calyx = mix(calyx, '#6E2A20', fl); glow = mix(glow, '#FFD27A', fl); }
      // 'Lilac Dawn': flowers open lilac and turn blue as they age, so the truss fades from blue (top) to lilac (bottom)
      if (li > 0) { pal = mixP(pal, mixP(JV_BLUE, JV_LILAC, ease(t * 1.2)), li); bud = mix(bud, '#B9AECB', li); calyx = mix(calyx, '#4D4470', li); glow = mix(glow, '#FFFFFF', li); }
      if (W > 0) { pal = mixP(pal, ['#6F7A6E', '#97A194', '#C2C9BC', '#E3E6DF'], W * 0.4); glow = mix(glow, '#E3E6DF', W * 0.5); }
      return { pal, bud, calyx, glow };
    }
    jvRaceme(rc, at, rk, W, ink) {
      const TR = this.T, A = prj(at.p), dx = A[0] - CX, outside = !rc.center && Math.abs(dx) > 74;
      const room = (rc.center ? 266 : outside ? 372 : 246) - A[1];
      if (room < 40) return null;
      const big = rc.center ? 1.1 : outside ? 1 : 0.9;
      const Lr = Math.min(rc.Lmax, room), Ln = Lr * (0.2 + 0.8 * ease(rk / 0.55));
      const ox = rc.center ? 0 : Math.sign(dx || 1) * (outside ? 13 : 3);
      const ax = s => [A[0] + ox * (1 - Math.exp(-s / 18)) + rc.bow * Math.sin(Math.PI * s / Ln), A[1] + s];
      const r = rng(rc.seed), s0 = Math.min(Ln * 0.13, rc.center ? 14 : 24), gap = rc.center ? 6.4 : 6.8;
      const nw = Math.max(4, Math.round((Ln - s0) / gap)), npw = rc.center ? 5 : 4, no = rk * 1.35 * nw, grow = lerp(0.45, 1, ease(rk / 0.5));
      const fl = [];
      for (let q = 0; q < nw; q++) {
        const t = q / (nw - 1), s = lerp(s0, Ln - 2, t), X0 = ax(s);
        // fullest a third of the way down, tapering to a tail of tight buds
        const szp = lerp(0.8, 1, ease(t / 0.3)) * (1 - 0.66 * ease((t - 0.42) / 0.58));
        const o = clamp(no - q) * (1 - ease((t - 0.6) / 0.36));
        const L = 22 * TR.size * big * szp * grow;
        for (let k = 0; k < npw; k++) {
          // flowers mostly swing out to the sides; a few face us or turn away
          const sd = (k + q) % 2 ? 1 : -1, az = (sd > 0 ? 0 : Math.PI) + sd * (k < 2 ? 1 : -1) * R(r, 0.15, 1.1) * (k > 3 ? 1.3 : 1);
          fl.push({ X0: [X0[0], X0[1] + R(r, -1.5, 1.5)], t, o: o * R(r, 0.85, 1), L: L * R(r, 0.82, 1.12), az, key: Math.sin(az) + R(r, -0.08, 0.08), lift: R(r, -0.16, 0.18), C: null });
        }
      }
      fl.sort((a, b) => a.key - b.key);
      const draw = p => {
        const gR = E('g', null, p);
        let d = '';
        for (let q = 0; q <= 24; q++) d += (q ? 'L' : 'M') + pt(ax(Ln * q / 24 * 0.99));
        const axis = () => {
          E('path', { d, stroke: ink, 'stroke-width': rc.center ? 3.4 : 3, fill: 'none', 'stroke-linecap': 'round' }, gR);
          E('path', { d, stroke: mix('#6E6A4E', PAL.stemWilt, W * 0.5), 'stroke-width': rc.center ? 1.7 : 1.4, fill: 'none', 'stroke-linecap': 'round' }, gR);
        };
        let done = false;
        fl.forEach(F => {
          if (!done && F.key >= 0) { axis(); done = true; }
          this.jvFlower(gR, F, this.jvColors(F.t, W), ink, F.key < 0 ? 0.24 * Math.min(1, -F.key) : 0);
        });
        if (!done) axis();
        this.parts.push({ g: gR, cx: A[0], cy: A[1], amp: (rc.center ? 0.5 : 0.8) + rk * 0.4, ph: rc.node.u * 0.05, blade: null });
      };
      this.tips.push(ax(Ln * 0.55));
      return { dep: at.p[2] + (rc.center ? 6 : 3), draw };
    }
    jvFlower(gp, F, C, ink, dim) {
      // a bud hangs down; an open flower swings out and its keel hooks upward like a claw (seen round the truss in 3D)
      const { X0, L, o } = F, e = ease(o), c0 = Math.cos(F.az), sn = Math.sin(F.az);
      const cs = (c0 < 0 ? -1 : 1) * Math.max(Math.abs(c0), 0.3);
      const M = q => [X0[0] + q[0] * cs, X0[1] + q[1] * CE + q[0] * sn * SE * 1.6];
      const cub = (P, t) => { const u = 1 - t; return [0, 1].map(i => u * u * u * P[0][i] + 3 * u * u * t * P[1][i] + 3 * u * t * t * P[2][i] + t * t * t * P[3][i]); };
      const ribbon = (P, Wm, N, tipK) => {
        const Lp = [], Rp = [], Cp = [];
        for (let i = 0; i <= N; i++) {
          const t = i / N, p = cub(P, t), a = cub(P, Math.max(0, t - 0.02)), b = cub(P, Math.min(1, t + 0.02));
          let tx = b[0] - a[0], ty = b[1] - a[1];
          const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
          const w = Wm * (tipK > 0.45 ? Math.pow(1 - t, 0.62) * (0.74 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.6))) * 0.8 : Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, 0.14 + t * 0.9))), 0.65) * (1 - tipK * t)) / 2;
          Lp.push([p[0] - ty * w, p[1] + tx * w]); Rp.push([p[0] + ty * w, p[1] - tx * w]); Cp.push(p);
        }
        return { Lp, Rp, Cp };
      };
      const pal = C.pal, body = shade(mix(C.bud, pal[1], e), -dim), dark = shade(mix(shade(C.bud, -0.3), pal[0], e), -dim);
      const ln = Math.max(0.45, Math.min(0.75, L * 0.035));
      const P = [[lerp(1, 2.4, e), lerp(1, 1.4, e)], [L * lerp(0.22, 0.6, e), L * lerp(0.42, 0.66 + F.lift, e)], [L * lerp(0.3, 1.1, e), L * lerp(0.78, 0.3, e)], [L * lerp(0.18, 1, e), L * lerp(1.02, -0.34 + F.lift, e)]];
      const Wm = L * lerp(0.42, 0.34, e), k = ribbon(P, Wm, 12, 0.5);
      const Ls = k.Lp.map(M), Rs = k.Rp.map(M), Cs = k.Cp.map(M);
      const poly = Ls.concat(Rs.slice().reverse());
      E('path', { d: smoothClosed(poly), fill: body, stroke: ink, 'stroke-width': ln, 'stroke-linejoin': 'round' }, gp);
      if (L > 4) {
        // the outer, lower side of the claw falls in shade; the inner edge catches a pearly gleam
        const ly = Ls.reduce((t, q) => t + q[1], 0), ry = Rs.reduce((t, q) => t + q[1], 0);
        const outer = ly > ry ? Ls : Rs, inner = ly > ry ? Rs : Ls;
        const sh = outer.slice(1, 12).concat(outer.slice(1, 12).map((q, i) => [lerp(q[0], Cs[i + 1][0], 0.45), lerp(q[1], Cs[i + 1][1], 0.45)]).reverse());
        E('path', { d: smoothClosed(sh), fill: dark, opacity: 0.6 }, gp);
        if (e > 0.2) {
          const hl = inner.slice(2, 11).map((q, i) => [lerp(q[0], Cs[i + 2][0], 0.38), lerp(q[1], Cs[i + 2][1], 0.38)]);
          E('path', { d: smoothOpen(hl), stroke: shade(mix(shade(C.bud, 0.4), pal[2], e), -dim), 'stroke-width': f(Math.max(0.6, Wm * 0.2)), fill: 'none', 'stroke-linecap': 'round', opacity: 0.85 }, gp);
          E('path', { d: smoothOpen(Cs.slice(3, 12).map((q, i) => [lerp(q[0], inner[i + 3][0], 0.12), lerp(q[1], inner[i + 3][1], 0.12)])), stroke: dark, 'stroke-width': 0.45, fill: 'none', opacity: 0.7 }, gp);
          if (e > 0.55) E('path', { d: smoothOpen(hl.slice(4)), stroke: C.glow, 'stroke-width': f(Math.max(0.4, Wm * 0.08)), fill: 'none', 'stroke-linecap': 'round', opacity: f(0.8 * (1 - dim * 2)) }, gp);
        }
      }
      const B = M(P[0]), cr = Math.max(0.9, L * 0.1);
      E('ellipse', { cx: f(B[0]), cy: f(B[1]), rx: f(cr * Math.max(0.75, Math.abs(cs))), ry: f(cr * 0.85), fill: shade(C.calyx, -dim), stroke: ink, 'stroke-width': 0.45 }, gp);
      if (cr > 1.6) E('circle', { cx: f(B[0] - cr * 0.3), cy: f(B[1] - cr * 0.3), r: f(cr * 0.28), fill: '#E4EEE6', opacity: f(0.45 * (1 - dim * 2)) }, gp);
    }

    // ------------------------------------------------ Welwitschia: strap leaves that never stop growing, splitting and fraying with age
    outsidePotClip() {
      const id = this.uid + 'potsil';
      if (!this.potSilMade) {
        const cp = E('clipPath', { id, clipPathUnits: 'userSpaceOnUse' }, this.defs);
        E('path', { d: `M-80,-80 H500 V520 H-80 Z M${CX - 63},281 A63,6.5 0 0 1 ${CX + 63},281 L${CX + 63},296 L${CX + 57},297 C${CX + 59},332 ${CX + 53},366 ${CX + 40},382 Q${CX + 34},390 ${CX + 24},390 L${CX - 24},390 Q${CX - 34},390 ${CX - 40},382 C${CX - 53},366 ${CX - 59},332 ${CX - 57},297 L${CX - 63},296 Z`, 'clip-rule': 'evenodd' }, cp);
        this.potSilMade = true;
      }
      return id;
    }
    buildWelwitschia(g, G, W, sl) {
      const og = this.layers.over, plan = wwPlan(this.target.seed), TR = this.T, V = this.cur, Q = [];
      const gs = ease(G / 0.9), oy = OY;
      OY = WW_OY;
      try {
      const C = { G, W, sl, gs, M: plan.mound, cw: lerp(7, 50, gs) * TR.size, zw: lerp(6, 38, gs) * TR.size, yt: -lerp(6, 13, gs), tri: V.variant === 'trileaf' ? ease(V.vk) : 0, fem: V.variant === 'bluecone' ? 1 : 0, femk: V.variant === 'bluecone' ? lerp(0.7, 1, ease(V.vk)) : 1 };
      plan.leaves.forEach(lf => { if (lf.third && C.tri < 0.02) return; lf.st.forEach(st => this.wwStrap(Q, lf, st, C)); });
            Q.push({ dep: prj([0, C.yt, 0])[2], draw: p => this.wwCrown(p, C, plan) });
      if (G > 0.7) plan.cones.forEach(c => Q.push(this.wwCone(c, C, ease((G - 0.7) / 0.22))));
      const wg = E('g', null, og), cid = this.uid + 'mndo', MS = this.moundSil(plan.mound);
      const cp = E('clipPath', { id: cid, clipPathUnits: 'userSpaceOnUse' }, this.pdefs);
      E('path', { d: 'M-80,-80 H500 V520 H-80 Z ' + MS.d, 'clip-rule': 'evenodd' }, cp);
      // the crest line of the mound, wherever it passes in front of a piece that goes down behind it
      // (without it a strap seemed to sink straight into the sand)
      const top = MS.top, silY = x => {
        if (x <= top[0][0]) return top[0][1];
        for (let i = 1; i < top.length; i++) if (top[i][0] >= x) { const a = top[i - 1], b = top[i]; return lerp(a[1], b[1], (x - a[0]) / ((b[0] - a[0]) || 1)); }
        return top[top.length - 1][1];
      };
      const inPoly = (P, x, y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
      const crest = (P, p) => {
        let x0 = Infinity, x1 = -Infinity, d = '', run = [];
        P.forEach(q => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); });
        const flush = () => { if (run.length > 1) d += 'M' + run.map(pt).join('L'); run = []; };
        for (let x = Math.floor(x0); x <= x1 + 1; x += 1) { const y = silY(x); if (inPoly(P, x, y)) run.push([x, y]); else flush(); }
        flush();
        if (d) E('path', { d, stroke: INK, 'stroke-width': 2.2, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, p);
        return !!d;
      };
      let back = null, tgt = '';
      Q.sort((a, b) => a.dep - b.dep).forEach(q => {
        // pieces lying on the far side of the mound are hidden by it; everything else is drawn in depth order
        if (q.behind) {
          if (tgt !== 'b') { back = E('g', { 'clip-path': `url(#${cid})` }, wg); tgt = 'b'; }
          q.draw(back);
          if (q.poly && crest(q.poly, wg)) tgt = 'm';
        }
        else { tgt = 'm'; q.draw(wg); }
      });
      this.parts.push({ g: wg, cx: CX, cy: SOIL + WW_OY, amp: 0.1, ph: 0, blade: null });
      } finally { OY = oy; }
    }
    wwStrap(Q, lf, st, C) {
      // each strap follows a designed path: up out of the crown, over in an arch, across the rim, down the pot and out along the floor
      const { G, W, sl, gs, cw, zw, yt, tri } = C, TR = this.T, third = !!lf.third;
      const grow = third ? lerp(0.1, 1, tri) * clamp(G / 0.4) : 1, spl = ease((G - 0.12) / 0.5) * (third ? 0.85 : 1);
      if (!st.main && spl < 0.03) return;
      const Mn = lf.st.find(q => q.main), mp = k => lerp(Mn[k], st[k], spl);
      const sz = TR.size * lerp(0.3, 1, gs) * (third ? 0.95 : 1) * 1.2, sag = 1 - W * 0.45 - sl * 0.05, M = C.M;
      const H0 = mp('H') * sz * 1.3 * sag, ra0 = mp('ra') * sz * 0.9, fl = mp('flare'), tail = mp('tail'), dl = mp('d');
      const psiL = third ? -90 : lf.sx > 0 ? 0 : 180, sgn = third ? 1 : lf.sx > 0 ? 1 : -1;
      const YF = WW_YF, MR = WW_MR;
      const wv = lerp(10, 37, gs) * TR.size * lerp(st.main ? 1.15 : 1, st.wk, spl) * (third ? 0.9 : 1), lift = wv * 0.42;
      const r0 = third ? zw * 0.7 : cw * 0.76, y0 = yt + 3, gy = (x, z) => wwGround(x, z, M) - lift;
      // a strap that would stop short of the sand hangs in mid-air and its tip seems to stab into the mound,
      // so a full-grown one that is too short for its arch gets a lower, tighter arch (tried up to three times)
      let dense, cum, L, kH = 1;
      const along = s => {
        let i = 1;
        while (i < cum.length - 1 && cum[i] < s) i++;
        const t = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
        return l3(dense[i - 1], dense[i], clamp(t));
      };
      for (let it = 0; it < 3; it++) {
        const H = H0 * kH, ra = ra0 * kH;
        // up out of the crown, over in an arch, down onto the sand, along the slope of the mound and out across the floor
        const wp = [[r0, y0, 0], [r0 + ra * 0.38, y0 - H * 0.72, 0.45], [r0 + ra * 0.78, y0 - H, 0.85], [r0 + ra * 1.28, y0 - H * 0.5, 1]];
        const yo = (1 - gs) * 30, rl = Math.max(r0 + ra * 1.28 + 12, r0 + ra * 1.55 * mp('land') + 8 + yo * 0.5);
        wp.push([rl, null, 1.02]);
        if (rl < MR - 34) wp.push([lerp(rl, MR, 0.55), null, 1.05]);
        const rf = Math.max(rl + 18, MR + 6 + fl * 34 + yo);
        wp.push([rf, null, 1.1], [rf + tail, null, 1.2]);
        let P3 = wp.map(([rr, y, k]) => { const a = rad(psiL + sgn * (lf.phi * (1 - k * 0.5) + dl * Math.min(1, k) + st.drift * spl * Math.max(0, k - 1) * 5)), x = rr * Math.cos(a), z0 = rr * Math.sin(a), z = y === null ? wwSoftZ(z0) : z0; return [x, y === null ? gy(x, z) : y, z]; });
        if (!third && st.c < -0.55 && !st.main) {
          // a back strap that crosses over behind the crown to the far side: a tall arch seen face-on
          const a0 = rad(psiL + sgn * lf.phi), aE = rad(psiL + sgn * dl * spl), Bb = [r0 * Math.cos(a0), y0, r0 * Math.sin(a0)];
          const pol = rr => { const x = rr * Math.cos(aE), z = rr * Math.sin(aE); return [x, gy(x, z), z]; };
          const Mr = pol(84), at = (u, y) => [lerp(Bb[0], Mr[0], u), y, lerp(Bb[2], Mr[2], u)];
          P3 = [Bb, at(0.14, y0 - H * 0.66), at(0.42, y0 - H), at(0.74, y0 - H * 0.72), at(0.94, lerp(y0 - H * 0.2, Mr[1], 0.5)), Mr, pol(MR - 10), pol(MR + 30)];
        }
        // Catmull-Rom through the waypoints, then even steps along it
        dense = [];
        for (let i = 0; i < P3.length - 1; i++) {
          const p0 = P3[Math.max(0, i - 1)], p1 = P3[i], p2 = P3[i + 1], p3 = P3[Math.min(P3.length - 1, i + 2)];
          for (let k = 0; k < 16; k++) {
            const t = k / 16, t2 = t * t, t3 = t2 * t;
            dense.push([0, 1, 2].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
          }
        }
        dense.push(P3[P3.length - 1]);
        // the spline may not dip into the sand (that showed as a kink where a strap lands)
        dense.forEach(q => { q[1] = Math.min(q[1], gy(q[0], q[2])); });
        cum = [0];
        for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(...s3(dense[i], dense[i - 1])));
        L = Math.min(cum[cum.length - 1] * lerp(1, st.Lk, spl), lerp(20, 580, ease(G / 0.95)) * TR.size * lf.L * grow * lerp(1, st.Lk, spl));
        // the strap is cut short where it would leave the picture
        for (let s = 0; s < L; s += 4) { const q = along(s); if (Math.abs(q[0]) > 202 || q[2] > 135 || q[2] < -235) { L = s; break; } }
        if (G < 0.5 || it === 2) break;
        let top = 0, land = -1;
        dense.forEach((q, i) => { if (q[1] < dense[top][1]) top = i; });
        for (let i = top + 1; i < dense.length; i++) if (dense[i][1] >= gy(dense[i][0], dense[i][2]) - 0.5) { land = i; break; }
        if (land < 0 || L >= cum[land] + 26) break;
        const k = lerp(1, clamp((L - 26) / cum[land], 0.5, 1), ease((G - 0.5) / 0.3));
        if (k > 0.985) break;
        kH *= k;
      }
      if (L < 6) return;
      const NS = 40, S = [];
      for (let k = 0; k <= NS; k++) { const s = L * k / NS, p = along(s); S.push({ p, s, fl: p[1] > YF - lift - 2 && Math.hypot(p[0], p[2] / WW_MZ) > MR, on: s > L * 0.3 && p[1] > gy(p[0], p[2]) - 3 }); }
      const dry = clamp(lerp(0.07, 0.36, G) + W * 0.18) * (third ? 0.6 : 1), sD = L * (1 - dry);
      const Lfray = spl > 0.25 ? Math.min(st.frays || st.main ? 34 : 14, L * (0.05 + 0.08 * spl)) * (1 + W * 0.3) : 0;
      const twL = s => lf.tw0 + lf.twA * Math.sin(6.2832 * s * lf.twF + lf.ph);
      const twS = s => st.tw0 + st.twA * Math.sin(6.2832 * s * st.twF + st.ph) + (st.flip ? Math.PI * ease((s - L * st.fs) / 40) : 0);
      this.wwDrawStrip(Q, S, {
        L, s0: 0, M: C.M, Lfray, fray: st.frays || st.main ? Math.max(2, Math.round(st.fray * spl)) : 2, seed: st.seed, side: st.side,
        w: s => wv * (0.5 + 0.5 * ease(s / 40)) * (1 - 0.12 * s / L),
        tw: s => ease(s / 40) * lerp(twL(s), twS(s), spl),
        col: (s, back, f2) => this.wwColor(s, L, sD, back, f2, W, third ? tri : 0)
      });
      if (G > 0.4 && st.main) this.tips.push(prj(along(L * 0.3)));
    }
    wwColor(s, L, sD, back, fl, W, fresh = 0) {
      const TR = this.T, a = s / L;
      const green = fresh > 0 ? mix(tint(a < 0.2 ? mix('#A9B57E', '#7F8F58', a / 0.2) : '#7F8F58', TR.hue), a < 0.3 ? '#C6DA8A' : '#98BA5E', 0.8 * fresh) : tint(a < 0.2 ? mix('#A9B57E', '#7F8F58', a / 0.2) : mix('#7F8F58', '#728250', (a - 0.2) / 0.8), TR.hue);
      const gk = back ? mix(green, '#C2C690', 0.38) : green;
      const d = Math.max(ease((s - sD) / 28), fl ? 0.85 : 0);
      const dc = mix(back ? '#D2BC8C' : '#B08C58', back ? '#EBDDB8' : '#D9C08C', ease((s - sD - 24) / Math.max(10, L - sD)));
      return mix(mix(gk, dc, d), PAL.wilt[1], W * 0.35);
    }
    wwDrawStrip(Q, S, o) {
      // a broad strap seen in 3D: it always turns a good part of its face to us, twists, and can flip to show its paler back.
      // drawn in short runs (for depth order), each one a smooth band with a colour gradient along it
      const vcam = [0, -SE, CE], LG = n3([-0.45, -0.7, 0.55]), N = S.length - 1, L = o.L;
      let prev = null;
      S.forEach((q, k) => {
        const nb = S[Math.min(N, k + 1)], pb = S[Math.max(0, k - 1)], t = n3(s3(nb.p, pb.p));
        let bb = x3(t, vcam);
        if (Math.hypot(bb[0], bb[1], bb[2]) < 0.12 && prev) bb = prev;
        bb = n3(bb);
        if (prev && d3(bb, prev) < 0) bb = k3(bb, -1);
        prev = bb;
        const nn = n3(x3(bb, t)), tw = o.tw(q.s);
        q.b = a3(k3(bb, Math.cos(tw)), k3(nn, Math.sin(tw)));
        q.n = a3(k3(nn, Math.cos(tw)), k3(bb, -Math.sin(tw)));
      });
      // where it lies out on the floor it settles flat (no edge-on pinches down there)
      S.forEach((q, k) => {
        let wf = 0;
        for (let j = -3; j <= 3; j++) { const qq = S[Math.max(0, Math.min(N, k + j))]; wf += qq.fl || qq.on ? 1 : 0; }
        wf = ease(wf / 7) * 0.6;
        if (wf <= 0) return;
        const t = n3(s3(S[Math.min(N, k + 1)].p, S[Math.max(0, k - 1)].p));
        let bf = n3(x3(t, [0, -1, 0]));
        if (d3(bf, q.b) < 0) bf = k3(bf, -1);
        let nf = n3(x3(bf, t));
        if (d3(nf, q.n) < 0) nf = k3(nf, -1);
        q.b = n3(l3(q.b, bf, wf)); q.n = n3(l3(q.n, nf, wf));
      });
      if (o.M !== undefined) {
        // where it lies, it rests on the sand with its lowest edge (no hovering a hand's breadth above it, and no edge cutting in);
        // where it arches, it is only lifted if an edge would dip into the sand
        const need = S.map(q => {
          const w = o.w(q.s);
          let m = -Infinity;
          for (const u of [-0.5, -0.25, 0, 0.25, 0.5]) { const e = a3(q.p, k3(q.b, u * w)); m = Math.max(m, e[1] - wwGround(e[0], e[2], o.M) + 1.2); }
          return m;
        });
        const want = S.map((q, k) => q.fl || q.on ? -need[k] : Math.min(0, -need[k]));
        S.forEach((q, k) => {
          let t = 0, c = 0;
          for (let j = -2; j <= 2; j++) { const kk = k + j; if (kk >= 0 && kk <= N) { t += want[kk]; c++; } }
          const dy = Math.min(t / c, -need[k]);
          if (dy) q.p = [q.p[0], q.p[1] + dy, q.p[2]];
        });
      }
      const ds = S[1].s - S[0].s;
      const fAt = s => {
        const x = clamp(s / ds, 0, N - 0.0001), i = Math.floor(x), t = x - i, A = S[i], Bq = S[i + 1];
        return { p: l3(A.p, Bq.p, t), b: n3(l3(A.b, Bq.b, t)), n: n3(l3(A.n, Bq.n, t)), fl: A.fl && Bq.fl };
      };
      const ink = mix(INK, '#3A3122', 0.3), sF = L - o.Lfray;
      const n = Math.max(3, Math.round(N * (sF - o.s0) / L)), smp = [];
      for (let k = 0; k <= n; k++) {
        const s = lerp(o.s0, sF, k / n), F = fAt(s), w = o.w(s), front = d3(F.n, vcam) >= 0, lam = d3(front ? F.n : k3(F.n, -1), LG);
        const at = u => prj(a3(F.p, k3(F.b, u * w)));
        smp.push({ s, F, w, front, at, c: shade(o.col(s, !front, F.fl), (lam > 0.5 ? (lam - 0.5) * 0.4 : -(0.5 - lam) * 0.55) - 0.16 * clamp(-F.p[2] / 50)), C: prj(F.p) });
      }
      const runs = [];
      let cur = [smp[0]], lastB = false;
      for (let k = 1; k <= n; k++) {
        cur.push(smp[k]);
        if (k < n && (cur.length > 4 || smp[k + 1].front !== smp[k].front)) { runs.push(cur); cur = [smp[k]]; cur.pre = smp[k - 1]; }
      }
      if (cur.length > 1) runs.push(cur);
      const VE = [-0.34, -0.2, -0.06, 0.08, 0.22, 0.36];
      runs.forEach((run, ri) => {
        const last = ri === runs.length - 1, Ls = run.map(q => q.at(-0.5)), Rs = run.map(q => q.at(0.5));
        const dep = run.reduce((t, q) => t + q.C[2], 0) / run.length, cen = run[Math.floor(run.length / 2)].F.p;
        const behind = cen[2] < -4 && Math.max(...Ls.map(q => q[1]), ...Rs.map(q => q[1])) > SOIL + OY - 30;
        if (last) lastB = behind;
        const pl = run.pre ? [run.pre].concat(run) : run;
        Q.push({ dep, behind, poly: behind ? pl.map(q => q.at(-0.5)).concat(pl.map(q => q.at(0.5)).reverse()) : null, draw: p => {
          const id = this.uid + 'wg' + (this.gid = (this.gid || 0) + 1), rr = run.pre ? [run.pre].concat(run) : run, A = rr[0].C, Z = rr[rr.length - 1].C;
          const gA = { gradientUnits: 'userSpaceOnUse', x1: f(A[0]), y1: f(A[1]), x2: f(Z[0]), y2: f(Z[1]) };
          const gr = E('linearGradient', Object.assign({ id }, gA), this.pdefs), gd = E('linearGradient', Object.assign({ id: id + 'd' }, gA), this.pdefs);
          rr.forEach((q, i) => { E('stop', { offset: f(i / (rr.length - 1)), 'stop-color': q.c }, gr); E('stop', { offset: f(i / (rr.length - 1)), 'stop-color': shade(q.c, -0.14) }, gd); });
          const band = (u0, u1) => smoothOpen(rr.map(q => q.at(u0))) + 'L' + smoothOpen(rr.map(q => q.at(u1)).reverse()).slice(1) + 'Z';
          E('path', { d: band(-0.5, 0.5), fill: `url(#${id})`, stroke: `url(#${id})`, 'stroke-width': 0.8, 'stroke-linejoin': 'round' }, p);
          // the fold: one half of the strap a shade darker, a thin light line along the other
          E('path', { d: band(o.side * 0.06, o.side * 0.5), fill: `url(#${id}d)` }, p);
          let dv = '';
          for (const v of VE) dv += smoothOpen(run.map(q => q.at(v)));
          E('path', { d: dv, stroke: '#24301F', 'stroke-width': 0.45, fill: 'none', opacity: 0.34 }, p);
          E('path', { d: smoothOpen(run.map(q => q.at(-o.side * 0.26))), stroke: '#FFFBEA', 'stroke-width': 0.8, fill: 'none', opacity: 0.22 }, p);
          let de = smoothOpen(Ls) + smoothOpen(Rs);
          if (last && o.Lfray === 0) de += `M${pt(Ls[Ls.length - 1])}L${pt(Rs[Rs.length - 1])}`;
          E('path', { d: de, stroke: ink, 'stroke-width': 1, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, p);
        } });
      });
      if (o.Lfray > 0) {
        // the dry end tears into ragged, fibrous tongues
        const r = rng(o.seed), F = o.fray, F0 = fAt(sF), front = d3(F0.n, vcam) >= 0;
        for (let i = 0; i < F; i++) {
          const a = -0.5 + i / F, b = -0.5 + (i + 1) / F, cx = (a + b) / 2, hw = (b - a) / 2, len = o.Lfray * R(r, 0.55, 1), spread = R(r, 0.1, 0.7), wob = R(r, -0.4, 0.4);
          const Lp = [], Rp = [];
          let dep = 0;
          for (let k = 0; k <= 6; k++) {
            const t = k / 6, s = Math.min(L, sF + len * t), F1 = fAt(s), w = o.w(s);
            const c = cx * (1 + spread * t) + wob * t * t * hw, h = hw * 0.9 * Math.pow(1 - t, 0.6) * (1 + 0.15 * Math.sin(t * 9 + i));
            Lp.push(prj(a3(F1.p, k3(F1.b, (c - h) * w)))); Rp.push(prj(a3(F1.p, k3(F1.b, (c + h) * w))));
            dep += Lp[k][2];
          }
          const mid = l3(F0.p, fAt(L).p, 0.5);
          // a tongue goes wherever its strap goes: if the strap ends behind the mound, so does its torn tip
          const tb = lastB || (mid[2] < -4 && Lp[0][1] > SOIL + OY - 30);
          Q.push({ dep: dep / 7 - 0.01 * i, behind: tb, poly: tb ? Lp.concat(Rp.slice().reverse()) : null, draw: p => {
            const c = shade(o.col(L, !front, F0.fl), (i % 2) * 0.06);
            E('path', { d: smoothOpen(Lp) + 'L' + smoothOpen(Rp.slice().reverse()).slice(1) + 'Z', fill: c, stroke: mix(ink, '#6A5232', 0.35), 'stroke-width': 0.7, 'stroke-linejoin': 'round' }, p);
            E('path', { d: smoothOpen(Lp.map((q, k) => [lerp(q[0], Rp[k][0], 0.4), lerp(q[1], Rp[k][1], 0.4)]).slice(0, 5)), stroke: shade(c, -0.3), 'stroke-width': 0.4, fill: 'none', opacity: 0.6 }, p);
          } });
        }
      }
    }
    wwLitter(Q, l, C, k) {
      // an old, dry torn-off piece lying curled on the floor
      const YF = 97, S = [], n = 10, len = l.len * k, w = 13 * l.wk * this.T.size, r = rng(l.seed);
      let a = rad(l.dir), p = [l.x, YF - w * 0.42, l.z];
      for (let i = 0; i <= n; i++) { S.push({ p, s: len * i / n, fl: true }); a += R(r, -0.25, 0.25); p = [p[0] + Math.cos(a) * l.sx * len / n, p[1], p[2] + Math.sin(a) * len / n]; }
      this.wwDrawStrip(Q, S, {
        L: len, s0: 0, M: C.M, Lfray: len * 0.35, fray: 3, seed: l.seed, side: 1, first: true,
        w: s => w * (0.8 + 0.2 * Math.sin(s / len * 3.1)), tw: s => 0.5 + 0.9 * Math.sin(s / len * 4 + l.seed % 7),
        col: (s, back) => mix(back ? '#E4D3AA' : '#BF9D68', '#8A7350', 0.1)
      });
    }
    wwCrown(p, C, plan) {
      // the woody, concave crown: a cracked, lumpy cup of bark that widens with age
      const { cw, zw, yt, W } = C, N = 28, top = [], bot = [], inn = [], lay = [[], [], []], sand = [];
      for (let i = 0; i < N; i++) {
        const a = i / N * Math.PI * 2, j = 1 + 0.08 * plan.lump[i], x = Math.cos(a) * cw * j, z = Math.sin(a) * zw * j;
        top.push(prj([x, yt + 2 * plan.lump[(i + 5) % N], z]));
        inn.push(prj([x * 0.7, yt + 3.5, z * 0.66]));
        bot.push(prj([x * 1.16, wwGround(x * 1.16, z * 1.16, C.M) + 4, z * 1.16]));
        sand.push(prj([x * 1.5, wwGround(x * 1.5, z * 1.5, C.M) + 1, z * 1.5]));
        for (let q = 0; q < 3; q++) lay[q].push(prj([x * (1.02 + q * 0.02), yt + (q + 1) * (-yt / 4.2) + 2.4 * plan.lump[(i + 9 + q * 4) % N], z * (1.02 + q * 0.02)]));
      }
      const gc = E('g', null, p);
      const half = a => { const o = []; for (let i = 0; i <= N / 2; i++) o.push(a[i % N]); return o; };
      const front = half(top), fb = half(bot);
      const wall = smoothOpen(front) + ' L' + fb.slice().reverse().map(pt).join(' L') + ' Z';
      const wood = mix('#76563F', '#8A7A62', W * 0.4);
      E('path', { d: wall, fill: wood, stroke: INK, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, gc);
      // crumpled bark: wavy layers and deep vertical fissures, darker toward the sides
      E('path', { d: wall, fill: `url(#${this.uid}grain)`, opacity: 0.6, style: 'mix-blend-mode:multiply' }, gc);
      const sideL = [front[0], front[3], fb[3], fb[0]], sideR = [front[N / 2], front[N / 2 - 3], fb[N / 2 - 3], fb[N / 2]];
      for (const sd of [sideL, sideR]) E('path', { d: smoothClosed(sd), fill: '#3B2A1F', opacity: 0.32 }, gc);
      lay.forEach((l, q) => E('path', { d: smoothOpen(half(l)), stroke: q === 0 ? '#C49E78' : '#4A3426', 'stroke-width': q === 0 ? 0.9 : 0.8, fill: 'none', opacity: q === 0 ? 0.7 : 0.75 }, gc));
      let dk = '';
      const r = rng(this.target.seed + 77), rowsY = [top, lay[0], lay[1], lay[2], bot];
      for (let q = 0; q < 4; q++) {
        // short, slightly curved cracks between the bark ridges, staggered like old cork
        for (let i = 1 + (q % 2); i < N / 2; i += 2 + Math.floor(r() * 2)) {
          const a = rowsY[q][i], b = rowsY[q + 1][i], m = [lerp(a[0], b[0], 0.5) + R(r, -2, 2), lerp(a[1], b[1], 0.5)];
          dk += `M${pt([a[0], a[1] + 0.8])}Q${pt(m)} ${pt([b[0] + R(r, -1, 1), b[1] - 0.6])}`;
        }
      }
      E('path', { d: dk, stroke: '#2E2018', 'stroke-width': 0.8, fill: 'none', opacity: 0.6, 'stroke-linecap': 'round' }, gc);
      // the rim of the cup and its hollow
      E('path', { d: smoothClosed(top), fill: mix('#A38262', '#A69478', W * 0.4), stroke: INK, 'stroke-width': 1.4 }, gc);
      E('path', { d: smoothClosed(top.map((q, i) => [lerp(q[0], inn[i][0], 0.45), lerp(q[1], inn[i][1], 0.45)])), fill: 'none', stroke: '#6E5240', 'stroke-width': 0.8, opacity: 0.8 }, gc);
      E('path', { d: smoothClosed(inn), fill: '#4A3729', stroke: '#2E2018', 'stroke-width': 0.8 }, gc);
      E('path', { d: smoothOpen(inn.slice(N / 2, N).concat([inn[0]])), stroke: '#7E6048', 'stroke-width': 1, fill: 'none', opacity: 0.8 }, gc);
      E('path', { d: smoothClosed(top), fill: `url(#${this.uid}grain)`, opacity: 0.55, style: 'mix-blend-mode:multiply' }, gc);
      E('path', { d: smoothOpen(top.slice(N / 2 + 2, N - 2)), stroke: '#D9BC98', 'stroke-width': 0.9, fill: 'none', opacity: 0.7 }, gc);
      // wind-blown sand heaped against the foot of the crown
      const ct = half(bot).map((q, i) => { const t = front[i], k = 0.3 + 0.14 * plan.lump[(i + 3) % N]; return [lerp(q[0], t[0], k), lerp(q[1], t[1], k)]; }), cs = half(sand);
      const col = smoothOpen(ct) + 'L' + smoothOpen(cs.slice().reverse()).slice(1) + 'Z';
      const sid = this.uid + 'cs' + (this.gid = (this.gid || 0) + 1), sg = E('linearGradient', { id: sid, x1: 0, y1: 0, x2: 0, y2: 1 }, this.pdefs);
      [[0, '#D9BE90', 1], [0.55, '#CDAE7E', 0.9], [1, '#C4A272', 0]].forEach(([o, c, a]) => E('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, sg));
      E('path', { d: col, fill: `url(#${sid})` }, gc);
      E('path', { d: col, fill: `url(#${this.uid}grain)`, opacity: 0.45, style: 'mix-blend-mode:multiply' }, gc);
      E('path', { d: smoothOpen(ct), stroke: '#6E5236', 'stroke-width': 1, fill: 'none', 'stroke-linecap': 'round' }, gc);
      E('path', { d: smoothOpen(ct.map(q => [q[0], q[1] + 1.6])), stroke: '#F1DEB8', 'stroke-width': 0.8, fill: 'none', opacity: 0.6 }, gc);
    }
    wwCone(c, C, ck) {
      // a fertile shoot from the crown rim: a short stalk that forks (and forks again on a male plant),
      // every tip carrying a little cluster of cones; 'Blue Cone' (a female plant) has fewer, plumper blue-green cones
      const { cw, zw, yt, W, fem } = C, r = rng(c.seed), male = fem < 0.5, fk = C.femk || 1;
      const B = [Math.cos(c.a) * cw * 0.84, yt + 1.5, Math.sin(c.a) * zw * 0.84], Bs = prj(B), gk = 0.35 + 0.65 * ck;
      const segs = [], tips = [];
      const grow = (p, ang, len, depth) => {
        const e = [p[0] + Math.sin(ang) * len, p[1] - Math.cos(ang) * len], bend = R(r, -0.18, 0.18);
        segs.push({ a: p, b: e, m: [lerp(p[0], e[0], 0.5) + Math.cos(ang) * len * bend, lerp(p[1], e[1], 0.5) + Math.sin(ang) * len * bend], w: 1 + depth * 0.5 });
        if (depth === 0) { tips.push({ p: e, ang }); return; }
        const sp = R(r, 20, 30) * (male ? 1 : 1.2);
        for (const s of [-1, 1]) grow(e, ang + rad(s * sp + R(r, -5, 5)), len * R(r, 0.5, 0.68), depth - 1);
      };
      const lean = rad(c.lean + Math.cos(c.a) * 30);
      grow(Bs, lean, c.h * gk * (male ? 0.7 : 0.8) * (0.72 + 0.36 * Math.max(0, Math.sin(c.a))), 1);
      const cones = [];
      tips.forEach(t => {
        const n = male ? (r() < 0.6 ? 2 : 3) : (r() < 0.6 ? 1 : 2);
        for (let i = 0; i < n; i++) {
          const o = n === 1 ? 0 : i / (n - 1) - 0.5;
          cones.push({ p: t.p, ang: t.ang + rad(o * (male ? 46 : 40) + R(r, -6, 6)), k: gk * fk * R(r, 0.85, 1.08) * (n === 3 && i !== 1 ? 0.88 : 1), seed: Math.floor(r() * 1e9) });
        }
      });
      // the middle cone of a cluster is drawn last, so it sits in front
      cones.sort((a, b) => Math.abs(b.ang) - Math.abs(a.ang));
      const draw = p => {
        const gc = E('g', null, p), stalk = mix(mix('#B3A26C', '#9FA57A', fem), PAL.stemWilt, W * 0.5);
        let d = '';
        segs.forEach(s => { d += `M${pt(s.a)}Q${pt(s.m)} ${pt(s.b)}`; });
        E('path', { d, stroke: INK, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gc);
        E('path', { d, stroke: stalk, 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gc);
        // a pair of tiny scale leaves at every fork
        segs.forEach(s => {
          const a = Math.atan2(s.b[0] - s.a[0], -(s.b[1] - s.a[1]));
          for (const sd of [-1, 1]) {
            const q = [s.a[0] + Math.sin(a + sd * 0.9) * 3, s.a[1] - Math.cos(a + sd * 0.9) * 3];
            E('path', { d: `M${pt(s.a)}Q${pt([lerp(s.a[0], q[0], 0.5) + sd * 0.8, lerp(s.a[1], q[1], 0.5) + 0.8])} ${pt(q)}Z`, fill: shade(stalk, -0.1), stroke: INK, 'stroke-width': 0.5, 'stroke-linejoin': 'round' }, gc);
          }
        });
        cones.forEach(cn => this.wwStrobilus(gc, cn.p, cn.ang, cn.k, fem, ck, W, cn.seed));
      };
      return { dep: Bs[2] + 400, draw };
    }
    wwStrobilus(p, at, ang, k, fem, ck, W, seed) {
      // one cone. Male: oblong, salmon-pink, its bracts in four neat ranks (crossed pairs), with little cream stamens
      // tipped by yellow pollen sacs peeping out between them. Female: plump, glaucous blue-green bracts blushing
      // rose at the edges, with fine glassy tubes that hold a drop of nectar
      const r = rng(seed), male = fem < 0.5, Lc = (male ? 17 : 27) * k, Wc = (male ? 8 : 16) * k, showS = r() < (male ? 0.7 : 0.5);
      const pal = male ? { body: '#EE8E6C', dark: '#9A3527', lite: '#FFD3BD', edge: '#B8432F' } : { body: '#86B8AA', dark: '#3D6E66', lite: '#DDF1EC', edge: '#C4887E' };
      const wl = c => mix(c, '#A39468', W * 0.45);
      const g = E('g', { transform: `translate(${f(at[0])},${f(at[1])}) rotate(${f(ang * 57.3)})` }, p);
      const hw = t => Wc / 2 * Math.pow(Math.max(0, Math.sin(Math.PI * clamp(t * 0.92 + 0.04))), male ? 0.42 : 0.6) * (1 - (male ? 0.08 : 0.16) * t);
      const outl = [];
      for (let i = 0; i <= 18; i++) { const t = i / 18; outl.push([hw(t), -Lc * t]); }
      const shape = smoothClosed(outl.concat(outl.slice(1, -1).reverse().map(([x, y]) => [-x, y])));
      const id = this.uid + 'cn' + (this.gid = (this.gid || 0) + 1);
      E('path', { d: shape }, E('clipPath', { id }, this.pdefs));
      // short stalk end and two little bracts at the foot
      E('path', { d: `M0,1.5 L0,${f(-Lc * 0.08)}`, stroke: INK, 'stroke-width': 1.6, 'stroke-linecap': 'round' }, g);
      // stamens / nectar tubes stick out past the outline, so they come first (behind the body)
      if (ck > 0.45 && showS) {
        const e = clamp((ck - 0.45) / 0.4), n = male ? 4 : 2;
        for (let i = 0; i < n; i++) {
          const t = male ? lerp(0.4, 0.82, i / (n - 1)) : lerp(0.62, 0.88, i / (n - 1)), sd = i % 2 ? 1 : -1, y = -Lc * t, x0 = sd * hw(t) * 0.7;
          const len = (male ? R(r, 2, 3) : R(r, 1.8, 2.6)) * k * e, a = sd * rad(male ? R(r, 50, 75) : R(r, 25, 45));
          const x1 = x0 + Math.sin(a) * len * 1.5, y1 = y - Math.cos(a) * len * 1.1;
          const fd = `M${f(x0)},${f(y)} Q${f(lerp(x0, x1, 0.5))},${f(y - len * 0.2)} ${f(x1)},${f(y1)}`;
          if (male) E('path', { d: fd, stroke: INK, 'stroke-width': 1.7, fill: 'none', 'stroke-linecap': 'round', opacity: 0.8 }, g);
          E('path', { d: fd, stroke: male ? '#F8EBDA' : '#E6F2EE', 'stroke-width': male ? 0.9 : 0.6, fill: 'none', 'stroke-linecap': 'round' }, g);
          if (male) {
            // a little head of three pollen sacs
            const ar = Math.max(0.55, 0.62 * k);
            for (let q = 0; q < 3; q++) { const aa = a + (q - 1) * 1.2; E('circle', { cx: f(x1 + Math.sin(aa) * ar * 0.9), cy: f(y1 - Math.cos(aa) * ar * 0.9), r: f(ar), fill: wl('#F4CD4E'), stroke: '#7A5418', 'stroke-width': 0.4 }, g); }
          } else {
            E('circle', { cx: f(x1), cy: f(y1), r: f(Math.max(0.5, 0.6 * k)), fill: '#F4FBF8', stroke: '#6E9A90', 'stroke-width': 0.35, opacity: 0.9 }, g);
          }
        }
      }
      E('path', { d: shape, fill: wl(pal.dark) }, g);
      const gs = E('g', { 'clip-path': `url(#${id})` }, g);
      // decussate bracts: rows alternate between one broad bract facing us and a pair seen from the sides.
      // The free tip of each bract points up and covers the foot of the one above, so draw from the top down.
      const rows = male ? 5 : 4, sh = Lc / rows;
      for (let j = rows; j >= 0; j--) {
        const yb = -sh * (j - 0.15), t = clamp(-yb / Lc), wr = Math.max(hw(t), Wc * 0.2), tipT = clamp(j / rows);
        const cols = j % 2 ? [[-wr * 0.52, wr * 0.6], [wr * 0.52, wr * 0.6]] : [[0, wr * 0.86], [-wr * 1.1, wr * 0.42], [wr * 1.1, wr * 0.42]];
        cols.forEach(([x, hwid], qi) => {
          const side = clamp(Math.abs(x) / Math.max(1, wr)), h = sh * 1.45;
          const base = shade(mix(pal.body, pal.lite, (1 - tipT) * 0.12), (x < 0 ? 0.08 : -0.12) * side - 0.08 * tipT);
          const d = `M${f(x - hwid)},${f(yb + sh * 0.5)} L${f(x - hwid)},${f(yb - h * 0.45)} Q${f(x - hwid * 0.95)},${f(yb - h)} ${f(x)},${f(yb - h * 1.02)} Q${f(x + hwid * 0.95)},${f(yb - h)} ${f(x + hwid)},${f(yb - h * 0.45)} L${f(x + hwid)},${f(yb + sh * 0.5)} Z`;
          E('path', { d, fill: wl(base), stroke: wl(pal.dark), 'stroke-width': 0.45 }, gs);
          // a rosy / darker rim on the bract tip, and a soft light streak up its middle
          E('path', { d: `M${f(x - hwid * 0.92)},${f(yb - h * 0.5)} Q${f(x - hwid * 0.85)},${f(yb - h * 0.97)} ${f(x)},${f(yb - h * 0.98)} Q${f(x + hwid * 0.85)},${f(yb - h * 0.97)} ${f(x + hwid * 0.92)},${f(yb - h * 0.5)}`, stroke: wl(pal.edge), 'stroke-width': f(Math.max(0.5, hwid * 0.22)), fill: 'none', opacity: male ? 0.55 : 0.6 }, gs);
          if (hwid > 1.4) E('path', { d: `M${f(x - hwid * 0.25)},${f(yb - h * 0.15)} Q${f(x - hwid * 0.3)},${f(yb - h * 0.6)} ${f(x - hwid * 0.08)},${f(yb - h * 0.82)}`, stroke: wl(pal.lite), 'stroke-width': f(Math.max(0.45, hwid * 0.2)), fill: 'none', 'stroke-linecap': 'round', opacity: 0.6 }, gs);
        });
      }
      // round shading (light from the upper left) and a waxy bloom
      E('path', { d: `M${f(Wc * 0.1)},2 L${f(Wc * 0.1)},${f(-Lc - 2)} L${f(Wc)},${f(-Lc - 2)} L${f(Wc)},2 Z`, fill: '#1C251E', opacity: 0.16 }, gs);
      E('path', { d: shape, fill: male ? '#FFF4EC' : '#EEF8F5', opacity: male ? 0.08 : 0.18 }, gs);
      E('path', { d: `M${f(-Wc * 0.26)},${f(-Lc * 0.2)} Q${f(-Wc * 0.36)},${f(-Lc * 0.5)} ${f(-Wc * 0.2)},${f(-Lc * 0.8)}`, stroke: '#FFFFFF', 'stroke-width': f(Math.max(0.6, Wc * 0.1)), fill: 'none', 'stroke-linecap': 'round', opacity: 0.4 }, gs);
      E('path', { d: shape, fill: 'none', stroke: INK, 'stroke-width': 0.85 }, g);
      // a glistening drop at the tip of a ripe cone
      if (ck > 0.8 && r() < (male ? 0.35 : 0.6)) {
        const rr = Math.max(0.8, (male ? 1 : 1.4) * k);
        E('circle', { cx: 0, cy: f(-Lc - rr * 0.6), r: f(rr), fill: '#F7FCFF', stroke: '#7E9AA0', 'stroke-width': 0.4, opacity: 0.92 }, g);
        E('circle', { cx: f(-rr * 0.35), cy: f(-Lc - rr * 0.95), r: f(rr * 0.3), fill: '#FFFFFF' }, g);
      }
    }

    // ------------------------------------------------ animation
    frame(now) {
      // the sway is slow, so ~30 fps is plenty (saves CPU/battery for an app that stays open all day); nothing while hidden
      if (document.hidden || now - this.last < 31) { requestAnimationFrame(this.frame.bind(this)); return; }
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      const t = (now - this.t0) / 1000;
      const tg = this.target, d = this.disp;
      if (d.G === null) d.G = tg.G;
      d.G += (tg.G - d.G) * Math.min(1, dt * 2.2);
      d.W += (tg.W - d.W) * Math.min(1, dt * 1.2);
      d.sleep += ((tg.mode === 'sleeping' ? 1 : 0) - d.sleep) * Math.min(1, dt * 1.1);
      d.vk += (tg.vk - d.vk) * Math.min(1, dt * 0.8);
      const b = this.built, vk = tg.variant ? d.vk : 0;
      if (!b || b.species !== tg.species || b.seed !== tg.seed || b.variant !== tg.variant || this.mountFor !== this.mountKey() ||
        Math.abs(d.G - b.G) > 0.0008 || Math.abs(d.W - b.W) > 0.004 || Math.abs(d.sleep - b.sleep) > 0.01 || Math.abs(vk - b.vk) > 0.006) this.rebuild();
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
      this.animMotes(dt, still);
      requestAnimationFrame(this.frame.bind(this));
    }

    animMotes(dt, still) {
      // faint gold light motes around rare plants (sparkles from golden spores)
      const tg = this.target, on = tg.rare || (tg.variant && this.disp.vk > 0.5);
      if (on && still && this.disp.sleep < 0.5) {
        this.nextMote -= dt;
        if (this.nextMote <= 0) {
          this.nextMote = 1.3 + Math.random() * 1.8;
          const spore = (tg.variant === 'spore' || tg.variant === 'goldsori') && this.sporeTips.length && Math.random() < 0.6;
          const src = spore ? this.sporeTips : this.tips;
          const p = src.length ? src[Math.floor(Math.random() * src.length)] : [CX, SOIL - 70];
          const el = E('g', { opacity: 0 }, this.layers.fx);
          if (spore) E('path', { d: 'M0,-4 Q0.6,-0.6 4,0 Q0.6,0.6 0,4 Q-0.6,0.6 -4,0 Q-0.6,-0.6 0,-4 Z', fill: '#F6DC8A' }, el);
          else {
            E('circle', { r: 4.5, fill: '#F2D27A', opacity: 0.22 }, el);
            E('circle', { r: 1.4, fill: '#FBE7A6' }, el);
          }
          this.motes.push({ el, x: p[0] + (Math.random() - 0.5) * 28, y: p[1] + (Math.random() - 0.5) * 20, age: 0, life: spore ? 2.6 : 3.8, vy: spore ? 5 : -10, ph: Math.random() * 6, spin: spore });
        }
      }
      for (let i = this.motes.length - 1; i >= 0; i--) {
        const m = this.motes[i];
        m.age += dt;
        const k = m.age / m.life;
        if (k >= 1 || !still) { m.el.remove(); this.motes.splice(i, 1); continue; }
        m.el.setAttribute('transform', `translate(${f(m.x + Math.sin(m.age * 1.4 + m.ph) * 5)},${f(m.y + m.vy * m.age)})` + (m.spin ? ` rotate(${f(m.age * 40)}) scale(${f(0.6 + Math.sin(Math.PI * k) * 0.5)})` : ''));
        m.el.setAttribute('opacity', f(Math.sin(Math.PI * k) * 0.85));
      }
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

  Scene.traits = traits;
  Scene.HUES = HUES.map(h => h.name);
  Scene.POTS = Object.keys(POTS);
  Scene.WOODS = Object.keys(WOODS);
  Scene.VARIANT_NAMES = VARIANT_NAMES;
  Scene.PINKS = Object.keys(PINKS);
  Scene.JADES = Object.keys(JADES);
  window.SlowLeafScene = Scene;
})();

