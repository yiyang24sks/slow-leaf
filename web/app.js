/* Slow Leaf - UI logic. Talks to the local Python server; falls back to an in-page mock. */
(function () {
  const qs = new URLSearchParams(location.search);
  const MODE = qs.get('mode') === 'pet' ? 'pet' : 'main';
  document.body.classList.add(MODE === 'pet' ? 'is-pet' : 'is-main');
  const $ = id => document.getElementById(id);
  const scene = new SlowLeafScene($('scene'), { pet: MODE === 'pet' });

  const FACTORS = [
    ['keyboard', 'Keyboard input', 'Any key press'],
    ['mouse', 'Mouse movement', 'Moving or clicking the mouse'],
    ['fullscreen', 'Fullscreen window', 'e.g. a lecture video in fullscreen'],
    ['media', 'Media playing', 'Video or audio playing in any app'],
  ];
  const SPECIES = { monstera: 'Monstera', staghorn: 'Staghorn fern', caladium: 'Caladium', bluestar: 'Blue Star fern', jadevine: 'Jade vine', welwitschia: 'Welwitschia' };
  const GROW_RATE = 1 / (4 * 3600), BASE_RATE = GROW_RATE / 1.5, WILT_RATE = BASE_RATE;   // work 1.5x, break and wilting 1x
  const BONUS_S = 30 * 60, RARE_CHANCE = 0.1;
  const VARIANTS = { monstera: ['aurea', 'albo'], staghorn: ['spore', 'silver'], caladium: ['muffet', 'strawberry'], bluestar: ['mandaianum', 'goldsori'], jadevine: ['flame', 'lilac'], welwitschia: ['bluecone', 'trileaf'] };
  const VN = SlowLeafScene.VARIANT_NAMES;
  const randSeed = () => 1 + Math.floor(Math.random() * 2147483000);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const plantName = (sp, v) => SPECIES[sp] + (v ? ' ' + VN[v] : '');
  const potNo = id => 'No. ' + String(id).padStart(3, '0');

  // ---------------------------------------------------------------- mock backend
  function freshPot() { return { growth: 0.02, stress: 0, seed: randSeed(), phase: 'growing', rare: false, variant: null, bonus: 0, active: 0 }; }
  function makeMock() {
    const speed = +qs.get('speed') || 1;
    const pv = qs.has('preview');
    const now = () => Date.now() / 1000;
    const st = {
      settings: { species: qs.get('species') || 'monstera', factors: { keyboard: false, mouse: true, fullscreen: true, media: false }, grace_min: 2, break_min: 15, sound: true },
      plants: Object.fromEntries(Object.keys(SPECIES).map(k => [k, freshPot()])), collection: [], display: null,
      brk: null, reminder: false, anchor: now(), last: { keyboard: 0, mouse: now(), fullscreen: 0, media: 0 },
      pots: 0, mode: 'growing', idle: 0, nextId: 1
    };
    if (pv) {
      const p = st.plants[st.settings.species];
      p.growth = +qs.get('preview'); p.stress = +(qs.get('stress') || 0);
      const m = qs.get('state');
      if (m === 'sleeping') st.brk = { ends: now() + 751, total: 900 };
      if (m === 'wilting') { st.last.mouse = now() - 754; st.anchor = 0; }
      if (qs.has('reminder')) st.reminder = true;
      if (qs.has('seed')) p.seed = +qs.get('seed');
      const ph = qs.get('phase');
      if (ph) { p.phase = ph; p.growth = 1; p.active = 4.3 * 3600; }
      if (qs.has('variant')) { p.variant = qs.get('variant'); p.rare = ph !== 'bonus'; }
      if (ph === 'bonus') p.bonus = (+qs.get('vk') || 0.4) * BONUS_S;
      const n = +qs.get('coll') || 0, r = (() => { let a = 99; return () => (a = (a * 16807) % 2147483647) / 2147483647; })();
      for (let i = 1; i <= n; i++) {
        const sp = Object.keys(SPECIES)[Math.floor(r() * 6)], rare = i % 4 === 2;
        st.collection.push({ id: i, species: sp, seed: Math.floor(r() * 2e9) + 1, rare, variant: rare ? VARIANTS[sp][Math.floor(r() * 2)] : null, finishedAt: now() - (n - i) * 86400 * 1.7, hours: +(3.6 + r() * 2).toFixed(2) });
      }
      st.pots = n; st.nextId = n + 1;
      if (qs.has('display') && n) st.display = 1;
    } else {
      addEventListener('mousemove', () => { st.last.mouse = now(); });
      addEventListener('keydown', () => { st.last.keyboard = now(); });
    }
    let lastT = now();
    function tick() {
      const t = now(), dt = Math.min(5, t - lastT); lastT = t;
      const p = st.plants[st.settings.species];
      if (st.brk && t >= st.brk.ends) { st.brk = null; st.reminder = true; st.anchor = t; }
      let last = st.anchor;
      for (const k in st.settings.factors) if (st.settings.factors[k] && k !== 'media') last = Math.max(last, st.last[k]);
      st.idle = t - last;
      const g = pv ? 0 : dt * speed;
      if (st.brk) { st.mode = 'sleeping'; p.growth += BASE_RATE * g; p.stress -= dt / 120; }
      else if (st.idle <= st.settings.grace_min * 60) {
        st.mode = 'growing'; p.growth += GROW_RATE * g; if (!pv) p.stress -= dt / 120;
        p.active += g;
        if (p.phase === 'bonus') { p.bonus = Math.min(BONUS_S, p.bonus + g); if (p.bonus >= BONUS_S) { p.phase = 'complete'; p.rare = true; } }
      }
      else { st.mode = 'wilting'; p.growth -= WILT_RATE * g; if (!pv) p.stress += g / 600; }
      p.growth = Math.min(1, Math.max(0.02, p.growth)); p.stress = Math.min(1, Math.max(0, p.stress));
      if (p.phase === 'growing' && p.growth >= 0.999) {
        p.phase = 'complete';
        if (Math.random() < RARE_CHANCE) { p.rare = true; p.variant = pick(VARIANTS[st.settings.species]); }
      }
      if (p.phase !== 'growing') p.growth = 1;
    }
    function snap() {
      const t = now(), p = st.plants[st.settings.species], grace = st.settings.grace_min * 60;
      const signals = {};
      for (const [k] of FACTORS) {
        const ago = st.last[k] ? t - st.last[k] : null;
        signals[k] = { available: k !== 'media', enabled: !!st.settings.factors[k], ago, on: ago !== null && ago <= grace };
      }
      return {
        mode: st.mode, species: st.settings.species, growth: p.growth, stress: p.stress, full: p.growth >= 0.999,
        eta: (1 - p.growth) / GROW_RATE / speed, idle: st.idle, grace, settings: JSON.parse(JSON.stringify(st.settings)),
        brk: st.brk ? { active: true, remaining: Math.max(0, st.brk.ends - t), total: st.brk.total } : null,
        reminder: st.reminder, pots_done: st.pots, signals, view: MODE, shell: 'mock',
        pot: { seed: p.seed, phase: p.phase, rare: p.rare, variant: p.variant, vk: p.rare ? 1 : p.phase === 'bonus' ? p.bonus / BONUS_S : 0,
          bonus: p.bonus, bonus_total: BONUS_S, bonus_eta: (BONUS_S - p.bonus) / speed, active: p.active, next_id: st.nextId },
        collection_n: st.collection.length, gold_n: st.collection.filter(c => c.rare).length,
        display: st.collection.find(c => c.id === st.display) || null
      };
    }
    function harvest() {
      const sp = st.settings.species, p = st.plants[sp];
      if (p.phase === 'growing') return;
      const rare = p.phase === 'complete' && p.rare;
      st.collection.push({ id: st.nextId++, species: sp, seed: p.seed, rare, variant: rare ? p.variant : null, finishedAt: now(), hours: +(p.active / 3600).toFixed(2) });
      st.pots++;
      st.plants[sp] = freshPot();
    }
    return {
      get(path) { if (path === '/api/collection') return JSON.parse(JSON.stringify(st.collection)); tick(); return snap(); },
      post(path, body) {
        const s = st.settings;
        if (path === '/api/settings') {
          if (body.species) s.species = body.species;
          if (body.factors) { const m = Object.assign({}, s.factors, body.factors); if (Object.values(m).some(Boolean)) s.factors = m; }
          if (body.grace_min) s.grace_min = body.grace_min;
          if (body.break_min) s.break_min = body.break_min;
          if (typeof body.sound === 'boolean') s.sound = body.sound;
        } else if (path === '/api/break/start') { const m = body.minutes || s.break_min; st.brk = { ends: now() + m * 60, total: m * 60 }; st.reminder = false; }
        else if (path === '/api/break/stop') { st.brk = null; st.anchor = now(); }
        else if (path === '/api/reminder/dismiss') { st.reminder = false; st.anchor = now(); }
        else if (path === '/api/newpot') { if (st.plants[s.species].phase !== 'growing') harvest(); else st.plants[s.species] = freshPot(); }
        else if (path === '/api/harvest') harvest();
        else if (path === '/api/discard') st.plants[s.species] = freshPot();
        else if (path === '/api/collection/delete') { const ids = body.ids || []; st.collection = st.collection.filter(c => !ids.includes(c.id)); if (ids.includes(st.display)) st.display = null; }
        else if (path === '/api/bonus/start') { const p = st.plants[s.species]; if (p.phase === 'complete' && !p.rare) { p.phase = 'bonus'; p.bonus = 0; p.variant = pick(VARIANTS[s.species]); } }
        else if (path === '/api/display') st.display = st.collection.some(c => c.id === body.id) ? body.id : null;
        tick(); return snap();
      }
    };
  }

  const useMock = location.protocol === 'file:' || qs.has('mock') || qs.has('preview');
  const mock = useMock ? makeMock() : null;
  async function api(path, body) {
    if (mock) return body === undefined ? mock.get(path) : mock.post(path, body);
    const r = await fetch(path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  }

  // ---------------------------------------------------------------- helpers
  const fmtDur = sec => {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    if (h) return `${h} h ${m} min`;
    if (m) return `${m} min`;
    return `${sec} s`;
  };
  const fmtClock = sec => { sec = Math.max(0, Math.ceil(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
  let audio = null;
  function chime(rare) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime;
      const notes = rare === true ? [[783.99, 0], [987.77, 0.12], [1174.7, 0.24], [1567.98, 0.36], [1975.5, 0.5]]
        : rare === false ? [[523.25, 0], [659.25, 0.14], [783.99, 0.28]] : [[659.25, 0], [987.77, 0.22], [1318.5, 0.44]];
      notes.forEach(([fq, d]) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sine'; o.frequency.value = fq;
        g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.09, t + d + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 1.6);
        o.connect(g).connect(audio.destination); o.start(t + d); o.stop(t + d + 1.7);
      });
    } catch (e) { /* no audio */ }
  }

  // ---------------------------------------------------------------- settings UI
  const list = $('factorList');
  FACTORS.forEach(([k, label, hint]) => {
    const row = document.createElement('label');
    row.className = 'check';
    row.dataset.k = k;
    row.innerHTML = `<input type="checkbox"><span class="box"></span><span class="f-text">${label}<small>${hint}</small></span><span class="live"><i class="dot"></i><em></em></span>`;
    row.querySelector('input').addEventListener('change', e => {
      const on = e.target.checked;
      const f = Object.assign({}, S.settings.factors, { [k]: on });
      if (!Object.values(f).some(Boolean)) { e.target.checked = true; return; }
      send('/api/settings', { factors: { [k]: on } });
    });
    list.appendChild(row);
  });
  document.querySelectorAll('#speciesSeg button').forEach(b => b.addEventListener('click', () => send('/api/settings', { species: b.dataset.v })));
  document.querySelectorAll('#graceSeg button').forEach(b => b.addEventListener('click', () => send('/api/settings', { grace_min: +b.dataset.v })));
  $('sound').addEventListener('change', e => send('/api/settings', { sound: e.target.checked }));
  $('btnSettings').addEventListener('click', () => { $('settings').hidden = false; render(); });
  $('btnClose').addEventListener('click', () => { $('settings').hidden = true; });
  addEventListener('keydown', e => { if (e.key === 'Escape') { $('settings').hidden = true; $('greenhouse').hidden = true; } });
  $('btnNewPot').addEventListener('click', () => {
    if (!S) return;
    if (S.pot.phase !== 'growing' || confirm('Start over with a new seed? Current progress will be lost.')) send('/api/newpot', {});
  });

  // ---------------------------------------------------------------- break UI
  const STEPS = [5, 10, 15, 20, 25, 30, 45, 60];
  let mins = null;
  function setMins(v) { mins = v; $('mins').textContent = v; }
  $('minus').addEventListener('click', () => { const i = STEPS.indexOf(mins); const v = i > 0 ? STEPS[i - 1] : Math.max(5, mins - 5); setMins(v); send('/api/settings', { break_min: v }); });
  $('plus').addEventListener('click', () => { const i = STEPS.indexOf(mins); const v = i >= 0 && i < STEPS.length - 1 ? STEPS[i + 1] : Math.min(120, mins + 15); setMins(v); send('/api/settings', { break_min: v }); });
  $('btnBreak').addEventListener('click', () => send('/api/break/start', { minutes: mins }));
  $('btnEnd').addEventListener('click', () => send('/api/break/stop', {}));
  $('btnBack').addEventListener('click', () => send('/api/reminder/dismiss', {}));
  $('btnMore').addEventListener('click', () => send('/api/break/start', { minutes: 5 }));
  $('bubbleOk').addEventListener('click', () => send('/api/reminder/dismiss', {}));

  // ---------------------------------------------------------------- window / pet
  $('btnPet').addEventListener('click', () => api('/api/window', { action: 'pet' }));
  $('btnRestore').addEventListener('click', () => api('/api/window', { action: 'main' }));
  if (MODE === 'pet') {
    const stage = $('stage');
    let down = null, dragging = false;
    stage.addEventListener('pointerdown', e => { if (e.button !== 0) return; down = { x: e.screenX, y: e.screenY }; dragging = false; });
    addEventListener('pointermove', e => {
      if (!down || dragging) return;
      if (Math.hypot(e.screenX - down.x, e.screenY - down.y) > 3) { dragging = true; api('/api/window', { action: 'drag' }); }
    });
    addEventListener('pointerup', () => { if (down && !dragging) scene.poke(); down = null; });
    stage.addEventListener('dblclick', () => api('/api/window', { action: 'main' }));
  } else {
    $('stage').addEventListener('click', () => scene.poke());
  }

  // ---------------------------------------------------------------- celebration
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function celebrate(rare) {
    if (S && S.settings.sound) chime(!!rare);
    if (reduceMotion || qs.has('still')) {
      const pop = $('checkPop');
      pop.classList.toggle('rare', !!rare);
      $('checkText').textContent = rare ? 'Rare plant!' : 'Fully grown';
      pop.hidden = false;
      setTimeout(() => { pop.hidden = true; }, 1600);
      return;
    }
    const cv = $('fx'), dpr = devicePixelRatio || 1, W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const x = cv.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const paper = rare ? ['#E9D3A0', '#D9B76A', '#F3E6C4', '#C9A050', '#FFF4D6'] : ['#E7B9A3', '#A9C5A0', '#E9D8A6', '#B8C7D9', '#D9C2D3', '#F1EBDD'];
    const leaves = rare ? ['#C9A050', '#E2C474', '#9DAF6A'] : ['#6F9A5A', '#8DB36E', '#4E7448'];
    const st = $('stage').getBoundingClientRect();
    const ox = st.left + st.width / 2, oy = st.top + st.height * 0.45, spread = Math.min(W, 420);
    const P = [];
    for (let i = 0; i < (rare ? 95 : 70); i++) {
      const leaf = Math.random() < 0.3;
      P.push({
        x: ox + (Math.random() - 0.5) * 40, y: oy + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * spread * 1.6, vy: -(200 + Math.random() * 380) * Math.min(1, H / 500),
        r: Math.random() * 6, vr: (Math.random() - 0.5) * 12, flip: Math.random() * 6, leaf,
        c: leaf ? leaves[i % leaves.length] : paper[i % paper.length], w: leaf ? 5 + Math.random() * 3 : 4 + Math.random() * 4, h: leaf ? 0 : 2.5 + Math.random() * 3
      });
    }
    const T = 1.6, t0 = performance.now();
    let last = t0;
    (function step(now) {
      const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      x.clearRect(0, 0, W, H);
      if (t > T) return;
      const fade = Math.min(1, (T - t) / 0.45);
      for (const p of P) {
        p.vy += 900 * dt; p.vx *= (1 - 1.6 * dt); p.vy *= (1 - 0.9 * dt);
        p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.flip += dt * 9;
        x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.scale(1, Math.abs(Math.cos(p.flip)) * 0.8 + 0.2);
        x.globalAlpha = fade; x.fillStyle = p.c;
        if (p.leaf) {
          x.beginPath(); x.moveTo(-p.w, 0); x.quadraticCurveTo(0, -p.w * 0.75, p.w, 0); x.quadraticCurveTo(0, p.w * 0.75, -p.w, 0); x.fill();
          x.strokeStyle = 'rgba(29,40,32,.45)'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(-p.w * 0.8, 0); x.lineTo(p.w * 0.8, 0); x.stroke();
        } else x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        x.restore();
      }
      requestAnimationFrame(step);
    })(t0);
  }

  // ---------------------------------------------------------------- completion
  $('btnHarvest').addEventListener('click', async () => { await send('/api/harvest', {}); if (!$('greenhouse').hidden) openGreenhouse(); });
  $('btnDiscard').addEventListener('click', () => {
    if (confirm('Discard this plant? It will not be added to your greenhouse, and a new seed is planted.')) send('/api/discard', {});
  });
  $('btnBonus').addEventListener('click', () => {
    if (!S) return;
    if (S.pot.phase === 'bonus') {
      // leaving the golden chance early throws its progress away, so ask first
      if (confirm(`Add it now as a common plant? The golden chance (${fmtDur(S.pot.bonus_eta)} left) will be lost.`)) send('/api/harvest', {});
    }
    else send('/api/bonus/start', {});
  });

  // ---------------------------------------------------------------- greenhouse
  let coll = [], ghSel = null, bigScene = null, selecting = false, ghFilter = 'all';
  const picked = new Set();
  const inFilter = c => ghFilter === 'all' || (ghFilter === 'rare' ? c.rare : c.species === ghFilter);
  const ordered = () => coll.filter(inFilter).reverse();   // newest first, same as the grid (only what the filter shows)
  const fmtDate = ts => new Date(ts * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  // on the small cards the year is left out while it is the current one (keeps them on one line)
  const fmtShort = ts => { const d = new Date(ts * 1000); return d.toLocaleDateString('en-GB', d.getFullYear() === new Date().getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: '2-digit' }); };
  function describe(c) {
    const t = SlowLeafScene.traits(c.species, c.seed);
    const hue = t.hue.name[0].toUpperCase() + t.hue.name.slice(1);
    if (c.species === 'staghorn') return `${hue} fronds · ${t.wood === 'walnut' ? 'walnut' : 'light oak'} board`;
    if (c.species === 'caladium') return `${t.pink[0].toUpperCase() + t.pink.slice(1)} pink · ${t.pot} pot`;
    if (c.species === 'jadevine') return `${t.jade[0].toUpperCase() + t.jade.slice(1)} flowers · ${t.pot} pot`;
    return `${hue} ${c.species === 'bluestar' ? 'fronds' : 'leaves'} · ${t.pot} pot`;
  }
  function plantState(c, extra) {
    return Object.assign({ species: c.species, seed: c.seed, growth: 1, stress: 0, mode: 'growing', variant: c.variant, vk: c.rare ? 1 : 0, rare: c.rare }, extra || {});
  }
  async function openGreenhouse() {
    $('greenhouse').hidden = false;
    try { coll = await api('/api/collection'); } catch (e) { coll = []; }
    if (ghSel !== null && !coll.some(c => c.id === ghSel)) ghSel = null;
    renderGreenhouse();
  }
  function renderGreenhouse() {
    const n = coll.length, g = coll.filter(c => c.rare).length;
    $('ghStats').innerHTML = `<div><b>${n}</b><span>Plants grown</span></div><div><b>${g}</b><span>Rare</span></div><div><b>${n ? Math.round(g / n * 100) : 0}%</b><span>Rare rate</span></div>`;
    $('ghEmpty').hidden = n > 0;
    $('ghList').hidden = ghSel !== null;
    $('ghDetail').hidden = ghSel === null;
    $('ghSelect').hidden = ghSel !== null || !n;
    $('ghSelect').textContent = selecting ? 'Cancel' : 'Select';
    $('ghSelBar').hidden = !selecting;
    // filter chips: All, Rare, then every species that is in the greenhouse
    if (ghFilter !== 'all' && !coll.some(inFilter)) ghFilter = 'all';
    const SHORT = { monstera: 'Monstera', staghorn: 'Staghorn', caladium: 'Caladium', bluestar: 'Blue Star', jadevine: 'Jade vine', welwitschia: 'Welwitschia' };
    const kinds = Object.keys(SPECIES).filter(sp => coll.some(c => c.species === sp));
    const chips = [['all', 'All', n]].concat(g ? [['rare', 'Rare', g]] : [], kinds.map(sp => [sp, SHORT[sp], coll.filter(c => c.species === sp).length]));
    const fb = $('ghFilter');
    fb.hidden = chips.length < 3;
    fb.textContent = '';
    chips.forEach(([k, label, cnt]) => {
      const b = document.createElement('button');
      b.className = (k === ghFilter ? 'on' : '') + (k === 'rare' ? ' gold' : '');
      b.setAttribute('aria-pressed', k === ghFilter);
      b.innerHTML = `${label}<i>${cnt}</i>`;
      b.addEventListener('click', () => { ghFilter = k; picked.clear(); renderGreenhouse(); });
      fb.appendChild(b);
    });
    const vis = ordered();
    const grid = $('ghGrid');
    grid.textContent = '';
    grid.classList.toggle('selecting', selecting);
    if (ghSel === null) {
      const syncSel = () => {
        $('ghSelCount').textContent = `${picked.size} selected`;
        $('ghDelSel').disabled = !picked.size;
        $('ghDelSel').textContent = picked.size ? `Delete ${picked.size}` : 'Delete';
        $('ghSelAll').textContent = picked.size && picked.size === vis.length ? 'Select none' : 'Select all';
      };
      syncSel();
      const shown = S && S.display ? S.display.id : null;
      vis.forEach(c => {
        const b = document.createElement('button');
        b.className = 'gh-card' + (c.rare ? ' rare' : '');
        b.innerHTML = `<svg aria-hidden="true"></svg><span class="nm">${plantName(c.species, c.variant)}</span><span class="mt">${potNo(c.id)} · ${fmtShort(c.finishedAt)}</span>` +
          (c.rare ? '<span class="badge">Rare</span>' : '') + (c.id === shown ? '<span class="pin">On desktop</span>' : '') + '<span class="tick"></span>';
        b.classList.toggle('sel', picked.has(c.id));
        b.addEventListener('click', () => {
          if (selecting) { picked.has(c.id) ? picked.delete(c.id) : picked.add(c.id); b.classList.toggle('sel', picked.has(c.id)); syncSel(); return; }
          ghSel = c.id; renderGreenhouse();
        });
        grid.appendChild(b);
        const sc = new SlowLeafScene(b.querySelector('svg'), { static: true, bg: false });
        b.querySelector('svg').setAttribute('viewBox', c.species === 'staghorn' ? '30 -30 360 378' : c.species === 'welwitschia' ? '12 22 400 421' : '4 -32 412 432');
        sc.setState(plantState(c));
        sc.renderNow();
      });
      return;
    }
    const c = coll.find(x => x.id === ghSel);
    if (!bigScene) bigScene = new SlowLeafScene($('ghBig'), {});
    bigScene.setState(plantState(c));
    $('ghBigWrap').classList.toggle('rare', c.rare);
    $('ghName').textContent = plantName(c.species, c.variant);
    $('ghNo').textContent = potNo(c.id) + (c.rare ? ' · Rare' : ' · Common');
    $('ghFacts').innerHTML = `<dt>Finished</dt><dd>${fmtDate(c.finishedAt)}</dd><dt>Focus time</dt><dd>${fmtDur(c.hours * 3600)}</dd><dt>Look</dt><dd>${describe(c)}</dd>`;
    const list = ordered(), idx = list.findIndex(x => x.id === c.id);
    $('ghPrev').disabled = idx <= 0;
    $('ghNext').disabled = idx >= list.length - 1;
    $('ghPos').textContent = `${idx + 1} / ${list.length}`;
    const on = S && S.display && S.display.id === c.id;
    $('ghShow').textContent = on ? 'On your desktop' : 'Put on desktop';
    $('ghShow').disabled = on;
    $('ghUnshow').hidden = !on;
  }
  function stepPlant(d) {
    const list = ordered(), idx = list.findIndex(x => x.id === ghSel), j = idx + d;
    if (idx < 0 || j < 0 || j >= list.length) return;
    ghSel = list[j].id; renderGreenhouse();
  }
  $('ghPrev').addEventListener('click', () => stepPlant(-1));
  $('ghNext').addEventListener('click', () => stepPlant(1));
  addEventListener('keydown', e => {
    if ($('greenhouse').hidden || ghSel === null) return;
    if (e.key === 'ArrowLeft') stepPlant(-1);
    if (e.key === 'ArrowRight') stepPlant(1);
  });
  async function deleteIds(ids) {
    await send('/api/collection/delete', { ids });
    ids.forEach(i => picked.delete(i));
    coll = await api('/api/collection');
  }
  $('ghDelete').addEventListener('click', async () => {
    const c = coll.find(x => x.id === ghSel);
    if (!c || !confirm(`Delete ${plantName(c.species, c.variant)} (${potNo(c.id)})? This can't be undone.`)) return;
    const list = ordered(), idx = list.findIndex(x => x.id === ghSel);
    const next = list[idx + 1] || list[idx - 1];
    await deleteIds([c.id]);
    ghSel = next ? next.id : null;
    renderGreenhouse();
  });
  $('ghSelect').addEventListener('click', () => { selecting = !selecting; picked.clear(); renderGreenhouse(); });
  $('ghSelAll').addEventListener('click', () => {
    const vis = ordered();
    if (picked.size && picked.size === vis.length) picked.clear(); else vis.forEach(c => picked.add(c.id));
    renderGreenhouse();
  });
  $('ghDelSel').addEventListener('click', async () => {
    const ids = [...picked], rare = coll.filter(c => picked.has(c.id) && c.rare).length;
    if (!ids.length || !confirm(`Delete ${ids.length} plant${ids.length > 1 ? 's' : ''}${rare ? ` (including ${rare} rare)` : ''}? This can't be undone.`)) return;
    await deleteIds(ids);
    selecting = false;
    renderGreenhouse();
  });
  $('btnGreenhouse').addEventListener('click', () => { ghSel = null; selecting = false; picked.clear(); openGreenhouse(); });
  $('ghClose').addEventListener('click', () => { $('greenhouse').hidden = true; selecting = false; picked.clear(); });
  $('ghBack').addEventListener('click', () => { ghSel = null; renderGreenhouse(); });
  $('ghShow').addEventListener('click', async () => {
    await send('/api/display', { id: ghSel });
    renderGreenhouse();
    api('/api/window', { action: 'pet' });
  });
  $('ghUnshow').addEventListener('click', async () => { await send('/api/display', { id: null }); renderGreenhouse(); });

  // ---------------------------------------------------------------- render
  let S = null, prevReminder = null, prevPot = null;
  async function send(path, body) { try { S = await api(path, body); render(); } catch (e) { /* server gone */ } }
  async function refresh() { try { S = await api('/api/state'); render(); } catch (e) { $('statusText').textContent = 'Not connected'; } }

  function render() {
    if (!S) return;
    const pot = S.pot;
    // the desktop window can show a plant from the greenhouse instead of the current pot
    if (MODE === 'pet' && S.display) scene.setState(plantState(S.display, { stress: S.stress, mode: S.mode }));
    else scene.setState(Object.assign({}, S, { seed: pot.seed, variant: pot.variant, vk: pot.vk, rare: pot.rare && pot.phase === 'complete' }));
    const st = S.settings, sig = S.signals;

    // just finished (or the golden chance paid off): confetti in the visible window only
    if (prevPot && prevPot.seed === pot.seed && prevPot.phase !== 'complete' && pot.phase === 'complete' && S.view === MODE) celebrate(pot.rare);
    prevPot = { seed: pot.seed, phase: pot.phase };
    if (mins === null) setMins(st.break_min);

    // reminder sound: only the window that is showing
    if (prevReminder === false && S.reminder && st.sound && S.view === MODE) chime();
    prevReminder = S.reminder;

    if (MODE === 'pet') {
      $('bubble').hidden = !S.reminder;
      $('petChip').hidden = !S.brk;
      if (S.brk) $('petChip').textContent = 'Sleeping · ' + fmtClock(S.brk.remaining);
      return;
    }

    const status = $('status');
    status.className = 'status ' + S.mode;
    let txt;
    if (S.mode === 'sleeping') txt = `Sleeping and growing · ${fmtClock(S.brk ? S.brk.remaining : 0)} left`;
    else if (S.mode === 'wilting') txt = `Wilting · idle for ${fmtDur(S.idle)}`;
    else {
      const on = FACTORS.filter(([k]) => sig[k].enabled && sig[k].available && sig[k].on).sort((a, b) => sig[a[0]].ago - sig[b[0]].ago);
      txt = on.length ? `Growing · ${on[0][1].toLowerCase().replace(' input', '').replace(' movement', '')} active` : 'Growing';
      if (S.idle > 30 && S.grace - S.idle > 0) txt = `Growing · wilts in ${fmtDur(S.grace - S.idle)} if idle`;
    }
    $('statusText').textContent = txt;
    const rareNow = pot.rare && pot.phase === 'complete';
    $('plantName').textContent = plantName(S.species, rareNow ? pot.variant : null);
    $('growthPct').textContent = Math.floor(S.growth * 100) + '%';
    $('barFill').style.width = (S.growth * 100).toFixed(2) + '%';
    document.querySelector('.meter').classList.toggle('wilting', S.mode === 'wilting');
    $('eta').textContent = pot.phase === 'growing'
      ? (S.mode === 'wilting' ? 'Wilting slowly. Any activity brings it back.' : `About ${fmtDur(S.eta)} of activity to full size`)
      : `Grown with ${fmtDur(pot.active)} of focus. It won't shrink anymore.`;

    // completion card
    const done = $('done');
    done.hidden = pot.phase === 'growing';
    done.classList.toggle('rare', rareNow || pot.phase === 'bonus');
    $('bonusBar').hidden = pot.phase !== 'bonus';
    $('btnBonus').hidden = rareNow;
    if (pot.phase === 'bonus') {
      $('doneTitle').textContent = 'Golden chance';
      $('doneText').textContent = S.mode === 'growing' ? `${fmtDur(pot.bonus_eta)} of activity left. The plant is changing.`
        : `Paused at ${fmtDur(pot.bonus_eta)} left. It never goes back.`;
      $('bonusFill').style.width = (pot.bonus / pot.bonus_total * 100).toFixed(2) + '%';
      $('btnBonus').textContent = 'Add now as common';
      $('btnHarvest').hidden = true;
    } else if (rareNow) {
      $('doneTitle').textContent = 'A rare plant';
      $('doneText').textContent = `${plantName(S.species, pot.variant)} will be ${potNo(pot.next_id)} in your greenhouse.`;
      $('btnHarvest').hidden = false;
    } else if (pot.phase === 'complete') {
      $('doneTitle').textContent = 'Fully grown';
      $('doneText').textContent = 'Add it to your greenhouse, or focus 30 more minutes to turn it rare.';
      $('btnBonus').textContent = 'Golden chance · 30 min';
      $('btnHarvest').hidden = false;
    }
    $('btnPet').hidden = S.shell !== 'qt' && S.shell !== 'mock';

    // break
    $('breakIdle').hidden = !!S.brk;
    $('breakRun').hidden = !S.brk;
    if (S.brk) {
      $('clock').textContent = fmtClock(S.brk.remaining);
      $('breakFill').style.width = ((1 - S.brk.remaining / S.brk.total) * 100).toFixed(2) + '%';
    }
    $('banner').hidden = !S.reminder;

    // settings
    if (!$('settings').hidden) {
      document.querySelectorAll('#speciesSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === st.species));
      document.querySelectorAll('#graceSeg button').forEach(b => b.classList.toggle('on', +b.dataset.v === st.grace_min));
      $('sound').checked = st.sound;
      list.querySelectorAll('.check').forEach(row => {
        const k = row.dataset.k, s = sig[k], inp = row.querySelector('input');
        inp.checked = !!st.factors[k];
        inp.disabled = !s.available;
        row.classList.toggle('disabled', !s.available);
        const live = row.querySelector('.live');
        live.classList.toggle('on', s.available && s.on);
        live.querySelector('em').textContent = !s.available ? 'Unavailable' : s.on ? 'Active' : 'Quiet';
      });
      $('potInfo').textContent = (pot.phase !== 'growing' ? 'This plant is fully grown. ' : `This plant is ${Math.floor(S.growth * 100)}% grown. `) +
        `Plants in your greenhouse: ${S.collection_n} (${S.gold_n} rare).`;
      $('btnNewPot').textContent = pot.phase !== 'growing' ? 'Add to Greenhouse' : 'Start over with a new seed';
    }
  }

  refresh().then(() => {
    if (qs.has('celebrate')) setTimeout(() => celebrate(qs.get('celebrate') === 'rare'), 300);
    if (qs.has('greenhouse')) { ghSel = qs.get('greenhouse') ? +qs.get('greenhouse') : null; openGreenhouse(); }
  });
  setInterval(refresh, 1000);
})();
