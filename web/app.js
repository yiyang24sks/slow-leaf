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
  const SPECIES = { monstera: 'Monstera', staghorn: 'Staghorn fern' };
  const GROW_RATE = 1 / (4 * 3600), WILT_RATE = GROW_RATE / 1.5;

  // ---------------------------------------------------------------- mock backend
  function makeMock() {
    const speed = +qs.get('speed') || 1;
    const pv = qs.has('preview');
    const now = () => Date.now() / 1000;
    const st = {
      settings: { species: qs.get('species') || 'monstera', factors: { keyboard: false, mouse: true, fullscreen: true, media: false }, grace_min: 2, break_min: 15, sound: true },
      plants: { monstera: { growth: 0.02, stress: 0 }, staghorn: { growth: 0.02, stress: 0 } },
      brk: null, reminder: false, anchor: now(), last: { keyboard: 0, mouse: now(), fullscreen: 0, media: 0 },
      pots: 0, mode: 'growing', idle: 0
    };
    if (pv) {
      const p = st.plants[st.settings.species];
      p.growth = +qs.get('preview'); p.stress = +(qs.get('stress') || 0);
      const m = qs.get('state');
      if (m === 'sleeping') st.brk = { ends: now() + 751, total: 900 };
      if (m === 'wilting') { st.last.mouse = now() - 754; st.anchor = 0; }
      if (qs.has('reminder')) st.reminder = true;
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
      if (st.brk) { st.mode = 'sleeping'; p.growth += GROW_RATE * g; p.stress -= dt / 120; }
      else if (st.idle <= st.settings.grace_min * 60) { st.mode = 'growing'; p.growth += GROW_RATE * g; if (!pv) p.stress -= dt / 120; }
      else { st.mode = 'wilting'; p.growth -= WILT_RATE * g; if (!pv) p.stress += g / 600; }
      p.growth = Math.min(1, Math.max(0.02, p.growth)); p.stress = Math.min(1, Math.max(0, p.stress));
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
        reminder: st.reminder, pots_done: st.pots, signals, view: MODE, shell: 'mock'
      };
    }
    return {
      get() { tick(); return snap(); },
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
        else if (path === '/api/newpot') { const p = st.plants[s.species]; if (p.growth >= 0.999) st.pots++; p.growth = 0.02; p.stress = 0; }
        tick(); return snap();
      }
    };
  }

  const useMock = location.protocol === 'file:' || qs.has('mock') || qs.has('preview');
  const mock = useMock ? makeMock() : null;
  async function api(path, body) {
    if (mock) return body === undefined ? mock.get() : mock.post(path, body);
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
  function chime() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime;
      [[659.25, 0], [987.77, 0.22], [1318.5, 0.44]].forEach(([fq, d]) => {
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
  addEventListener('keydown', e => { if (e.key === 'Escape') $('settings').hidden = true; });
  $('btnNewPot').addEventListener('click', () => {
    if (!S) return;
    if (S.full || confirm('Start over with a small sprout? Current progress will be reset.')) send('/api/newpot', {});
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

  // ---------------------------------------------------------------- render
  let S = null, prevReminder = null;
  async function send(path, body) { try { S = await api(path, body); render(); } catch (e) { /* server gone */ } }
  async function refresh() { try { S = await api('/api/state'); render(); } catch (e) { $('statusText').textContent = 'Not connected'; } }

  function render() {
    if (!S) return;
    scene.setState(S);
    const st = S.settings, sig = S.signals;
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
    $('plantName').textContent = SPECIES[S.species];
    $('growthPct').textContent = Math.floor(S.growth * 100) + '%';
    $('barFill').style.width = (S.growth * 100).toFixed(2) + '%';
    document.querySelector('.meter').classList.toggle('wilting', S.mode === 'wilting');
    $('eta').textContent = S.full ? 'Fully grown. Start a new pot in Settings whenever you like.'
      : S.mode === 'wilting' ? 'Wilting slowly. Any activity brings it back.'
      : `About ${fmtDur(S.eta)} of activity to full size`;
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
      $('potInfo').textContent = (S.full ? 'This plant is fully grown. ' : `This plant is ${Math.floor(S.growth * 100)}% grown. `) +
        `Fully grown pots so far: ${S.pots_done}.`;
    }
  }

  refresh();
  setInterval(refresh, 1000);
})();
