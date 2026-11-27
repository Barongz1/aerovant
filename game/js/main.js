/**
 * main.js - Game orchestration for AEROVANT.
 * State machine (MENU / PLAYING / PAUSED / DEBRIEF), 5 missions, rings,
 * scoring, fuel + damage, toasts, debrief, best scores.
 * APIs (verified against the files on disk): HUD = new HUD(canvas),
 * hud.draw(stateObj); Audio = new Audio(), setAircraftTone(pitch, prop,
 * turbo) takes numbers, update({throttle 0-1, airspeed, onGround, rpm,
 * isCrashed}), ringPass(combo), success()/crash() no args; Flight =
 * new Flight.Flight(world); World.getMaps() is an array; setMap(id) +
 * renderer.rebuildWorld() on every map change (terrain colours are baked).
 * AEROVANT revision v5 - debug handle also exposes the current map id,
 * so the screenshot driver can verify a map switch took effect.
 */
(function (global) {
  'use strict';

  const M = global.AerovantMath;
  const World = global.AerovantWorld;
  const Audio = global.AerovantAudio;
  const Flight = global.AerovantFlight;
  const Renderer = global.AerovantRenderer;
  const HUD = global.AerovantHUD;

  const MODES = {
    corridor: {
      name: 'Koridor Cincin Udara',
      desc: 'Lewati 9 cincin di atas kepulauan, lalu mendarat di runway 36.',
      rings: [
        { x: 0, y: 120, z: -950, r: 24, label: 'Cincin 1' },
        { x: -350, y: 200, z: -1250, r: 24, label: 'Cincin 2' },
        { x: -700, y: 380, z: -1550, r: 24, label: 'Cincin 3' },
        { x: -950, y: 700, z: -2050, r: 24, label: 'Cincin 4' },
        { x: -700, y: 580, z: -2450, r: 24, label: 'Cincin 5' },
        { x: 200, y: 500, z: -2700, r: 24, label: 'Cincin 6' },
        { x: 800, y: 380, z: -2300, r: 24, label: 'Cincin 7' },
        { x: 650, y: 220, z: -1750, r: 24, label: 'Cincin 8' },
        { x: 0, y: 150, z: -1200, r: 24, label: 'Cincin 9' }
      ],
      timeLimit: 0,
      requireLanding: true
    },
    takeoff: {
      name: 'Lepas Landas Fajar',
      desc: 'Lepas landas dari runway 36, terbang melewati pegunungan dan kota, lalu mendarat lagi.',
      rings: [
        { x: 0, y: 140, z: -1150, r: 24, label: 'Lepas landas' },
        { x: -350, y: 280, z: -1550, r: 24, label: 'Lembah barat' },
        { x: -700, y: 550, z: -1900, r: 24, label: 'Punggung naga' },
        { x: -1150, y: 700, z: -2250, r: 24, label: 'Kawah api' },
        { x: -600, y: 480, z: -2600, r: 24, label: 'Puncak barisan' },
        { x: 300, y: 380, z: -2400, r: 24, label: 'Lembah timur' },
        { x: 900, y: 300, z: -1800, r: 24, label: 'Kota pesisir' },
        { x: 500, y: 180, z: -1200, r: 24, label: 'Sungai biru' },
        { x: 0, y: 120, z: -700, r: 24, label: 'Final runway 36' }
      ],
      timeLimit: 0,
      requireLanding: true
    },
    timetrial: {
      name: 'Time Trial',
      desc: 'Lewati 9 cincin secepat mungkin. Waktu tersisa jadi bonus skor.',
      rings: [
        { x: 0, y: 120, z: -950, r: 24, label: 'Cincin 1' },
        { x: -350, y: 200, z: -1250, r: 24, label: 'Cincin 2' },
        { x: -700, y: 380, z: -1550, r: 24, label: 'Cincin 3' },
        { x: -950, y: 700, z: -2050, r: 24, label: 'Cincin 4' },
        { x: -700, y: 580, z: -2450, r: 24, label: 'Cincin 5' },
        { x: 200, y: 500, z: -2700, r: 24, label: 'Cincin 6' },
        { x: 800, y: 380, z: -2300, r: 24, label: 'Cincin 7' },
        { x: 650, y: 220, z: -1750, r: 24, label: 'Cincin 8' },
        { x: 0, y: 150, z: -1200, r: 24, label: 'Cincin 9' }
      ],
      timeLimit: 150,
      requireLanding: false
    },
    landing: {
      name: 'Pendaratan Presisi',
      desc: 'Mulai dari udara, mendarat sehalus mungkin di tengah runway 36. Dinilai dari sink rate, posisi, dan kecepatan.',
      rings: [],
      timeLimit: 0,
      requireLanding: true,
      startAirborne: true
    },
    free: {
      name: 'Jelajah Bebas',
      desc: 'Terbang bebas tanpa misi. Jelajahi pulau, gunung, dan kota sesuka hati.',
      rings: [],
      timeLimit: 0,
      requireLanding: false
    }
  };

  // Per-aircraft engine character: pitch multiplier, prop drone, turbo whine.
  const TONES = {
    elang: [1.0, false, true],
    cendrawasih: [1.3, false, true],
    jalak: [0.85, true, false]
  };

  const state = {
    screen: 'MENU', // MENU | PLAYING | PAUSED | DEBRIEF
    mode: 'corridor',
    aircraft: 'elang',
    map: 'nusantara',
    cameraMode: 'chase',
    showAircraftInCockpit: false,
    invertPitch: false,
    yokeMode: false,
    muted: false,
    menuTime: 0,
    score: 0,
    ringsPassed: 0,
    nextRingIndex: 0,
    combo: 0,
    time: 0,
    timeLeft: 0,
    debrief: null,
    best: {},
    paused: false
  };

  let canvas, renderer, flight, hud, audio;
  let keys = {};
  let mouseDown = false;
  let mouseX = 0, mouseY = 0;
  let yokeX = 0, yokeY = 0;
  let lastTime = 0;
  let rings = [];
  let toasts = [];
  let prevPos = [0, 0, 0];
  let throttle = 0;
  let wasOnGround = true;
  let lastTopbar = { mission: '', score: -1, time: '' };

  function $(id) { return document.getElementById(id); }

  function applyAircraftTone(id) {
    const t = TONES[id] || TONES.elang;
    audio.setAircraftTone(t[0], t[1], t[2]);
  }

  function init() {
    canvas = $('gl');
    renderer = new Renderer(canvas);
    flight = new Flight.Flight(World);
    hud = new HUD($('hud'));
    audio = new Audio();
    loadBest();
    buildMenu();
    bindInput();
    const params = new URLSearchParams(location.search);
    const map = params.get('map');
    const aircraft = params.get('aircraft');
    const mode = params.get('mode');
    const cam = params.get('cam');
    const invert = params.get('invert');
    if (map && World.getMaps().some(m => m.id === map)) state.map = map;
    if (aircraft && Flight.AIRCRAFT.some(a => a.id === aircraft)) state.aircraft = aircraft;
    if (mode && MODES[mode]) state.mode = mode;
    if (cam === 'cockpit' || cam === 'chase' || cam === 'orbit') state.cameraMode = cam;
    if (invert === '1') state.invertPitch = true;
    World.setMap(state.map);
    renderer.rebuildWorld();
    flight.setAircraft(state.aircraft);
    renderer.setAircraft(state.aircraft);
    renderer.setAmbient(World.getMap().particles);
    applyAircraftTone(state.aircraft);
    applySelectionToPreview();
    syncMenuSelection();
    if (params.get('auto') === '1') {
      setTimeout(() => startGame(), 400);
    }
    requestAnimationFrame(frame);
  }

  function loadBest() {
    try {
      const raw = localStorage.getItem('aerovant-best');
      if (raw) state.best = JSON.parse(raw);
    } catch (e) { state.best = {}; }
  }

  function saveBest() {
    try {
      localStorage.setItem('aerovant-best', JSON.stringify(state.best));
    } catch (e) { /* storage unavailable */ }
  }

  function buildMenu() {
    const acWrap = $('aircraft-cards');
    acWrap.innerHTML = '';
    for (const a of Flight.AIRCRAFT) {
      const card = document.createElement('div');
      card.className = 'pick-card' + (a.id === state.aircraft ? ' selected' : '');
      card.dataset.id = a.id;
      card.innerHTML =
        '<div class="pick-name">' + a.name + '</div>' +
        '<div class="pick-sub">' + a.model + '</div>' +
        '<div class="pick-desc">' + a.desc + '</div>' +
        statBar('Speed', a.stats.speed, '#f59e0b') +
        statBar('Handling', a.stats.handling, '#2dd4bf') +
        statBar('Akselerasi', a.stats.acceleration, '#fb7185') +
        statBar('Stabilitas', a.stats.stability, '#a3e635');
      card.addEventListener('click', () => {
        state.aircraft = a.id;
        flight.setAircraft(a.id);
        renderer.setAircraft(a.id);
        applyAircraftTone(a.id);
        syncMenuSelection();
        applySelectionToPreview();
      });
      acWrap.appendChild(card);
    }
    const mapWrap = $('map-cards');
    mapWrap.innerHTML = '';
    for (const m of World.getMaps()) {
      const card = document.createElement('div');
      card.className = 'pick-card' + (m.id === state.map ? ' selected' : '');
      card.dataset.id = m.id;
      card.innerHTML = '<div class="pick-name">' + m.name + '</div><div class="pick-desc">' + m.desc + '</div>';
      card.addEventListener('click', () => {
        state.map = m.id;
        World.setMap(m.id);
        renderer.rebuildWorld();
        renderer.setAmbient(m.particles);
        syncMenuSelection();
        applySelectionToPreview();
      });
      mapWrap.appendChild(card);
    }
    const modeWrap = $('mission-cards');
    modeWrap.innerHTML = '';
    for (const id in MODES) {
      const m = MODES[id];
      const card = document.createElement('div');
      card.className = 'pick-card' + (id === state.mode ? ' selected' : '');
      card.dataset.id = id;
      card.innerHTML = '<div class="pick-name">' + m.name + '</div><div class="pick-desc">' + m.desc + '</div>';
      card.addEventListener('click', () => {
        state.mode = id;
        syncMenuSelection();
      });
      modeWrap.appendChild(card);
    }
    const startBtn = $('start-btn');
    startBtn.addEventListener('click', () => startGame());
    const resumeBtn = $('resume-btn');
    if (resumeBtn) resumeBtn.addEventListener('click', () => togglePause(false));
    const restartBtn = $('restart-btn');
    if (restartBtn) restartBtn.addEventListener('click', () => startGame());
    const quitBtn = $('quit-btn');
    if (quitBtn) quitBtn.addEventListener('click', () => showMenu());
    const againBtn = $('again-btn');
    if (againBtn) againBtn.addEventListener('click', () => startGame());
    const menuBtn = $('menu-btn');
    if (menuBtn) menuBtn.addEventListener('click', () => showMenu());
    const invertChk = $('invert-pitch');
    if (invertChk) invertChk.addEventListener('change', () => { state.invertPitch = invertChk.checked; });
    const camSel = $('camera-select');
    if (camSel) camSel.addEventListener('change', () => { state.cameraMode = camSel.value; });
  }

  function statBar(label, value, color) {
    const pct = Math.round((value / 20) * 100);
    return '<div class="stat"><span>' + label + '</span>' +
      '<div class="statbar"><div class="statfill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
      '<b>' + value + '</b></div>';
  }

  function syncMenuSelection() {
    document.querySelectorAll('#aircraft-cards .pick-card').forEach(el => {
      el.classList.toggle('selected', el.dataset.id === state.aircraft);
    });
    document.querySelectorAll('#map-cards .pick-card').forEach(el => {
      el.classList.toggle('selected', el.dataset.id === state.map);
    });
    document.querySelectorAll('#mission-cards .pick-card').forEach(el => {
      el.classList.toggle('selected', el.dataset.id === state.mode);
    });
    const invertChk = $('invert-pitch');
    if (invertChk) invertChk.checked = state.invertPitch;
    const camSel = $('camera-select');
    if (camSel) camSel.value = state.cameraMode;
    const acLabel = $('aircraft-label');
    if (acLabel) acLabel.textContent = flight ? flight.spec.name : '';
    const mapLabel = $('map-label');
    if (mapLabel) mapLabel.textContent = World.getMap().name;
    const hangarName = $('hangar-name');
    if (hangarName && flight) hangarName.textContent = flight.spec.name.toUpperCase();
    const hangarModel = $('hangar-model');
    if (hangarModel && flight) hangarModel.textContent = flight.spec.model;
  }

  function applySelectionToPreview() {
    // Hangar showroom: park the selected aircraft on the pad; the
    // renderer draws it rotating slowly in front of the hangars.
    flight.setAircraft(state.aircraft);
    renderer.setAircraft(state.aircraft);
    flight.reset(0, 2.4, 0, false, 0);
    renderer.cameraMode = 'hangar';
    renderer.setCourse(MODES[state.mode].rings);
    rings = MODES[state.mode].rings;
    state.nextRingIndex = 0;
  }

  function bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      keys[e.code] = true;
      if (e.code === 'KeyC') cycleCamera();
      if (e.code === 'KeyM') toggleYoke();
      if (e.code === 'KeyN') toggleMute();
      if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
      if (e.code === 'KeyG' && state.screen === 'PLAYING') {
        flight.gearDown = !flight.gearDown;
        audio.gear(flight.gearDown);
      }
      if (e.code === 'KeyF' && state.screen === 'PLAYING') {
        flight.flaps = flight.flaps === 0 ? 1 : 0;
        audio.flaps();
      }
      if (e.code === 'Enter' && state.screen === 'MENU') startGame();
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    canvas.addEventListener('mousedown', (e) => { mouseDown = true; mouseX = e.clientX; mouseY = e.clientY; });
    window.addEventListener('mouseup', () => { mouseDown = false; });
    window.addEventListener('mousemove', (e) => {
      if (!mouseDown || !state.yokeMode) return;
      mouseX = e.clientX; mouseY = e.clientY;
      const rect = canvas.getBoundingClientRect();
      yokeX = M.clamp((mouseX - rect.left) / rect.width * 2 - 1, -1, 1);
      yokeY = M.clamp((mouseY - rect.top) / rect.height * 2 - 1, -1, 1);
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      throttle = M.clamp(throttle - Math.sign(e.deltaY) * 8, 0, 100);
    }, { passive: false });
    const camBtn = $('cam-btn');
    if (camBtn) camBtn.addEventListener('click', cycleCamera);
    const yokeBtn = $('yoke-btn');
    if (yokeBtn) yokeBtn.addEventListener('click', toggleYoke);
    const muteBtn = $('mute-btn');
    if (muteBtn) muteBtn.addEventListener('click', toggleMute);
    const pauseBtn = $('pause-btn');
    if (pauseBtn) pauseBtn.addEventListener('click', () => togglePause());
  }

  function cycleCamera() {
    const modes = ['chase', 'cockpit', 'orbit'];
    const i = modes.indexOf(state.cameraMode);
    state.cameraMode = modes[(i + 1) % modes.length];
    renderer.cameraMode = state.cameraMode;
    updateTopButtons();
  }

  function toggleYoke() {
    state.yokeMode = !state.yokeMode;
    updateTopButtons();
  }

  function toggleMute() {
    state.muted = !state.muted;
    audio.setMuted(state.muted);
    updateTopButtons();
  }

  function updateTopButtons() {
    const camLabel = $('cam-label');
    const camName = state.cameraMode === 'chase' ? 'Chase' : state.cameraMode === 'cockpit' ? 'Kokpit' : 'Orbit';
    if (camLabel) camLabel.textContent = camName;
    const yokeBtn = $('yoke-btn');
    if (yokeBtn) yokeBtn.textContent = '[M] Yoke: ' + (state.yokeMode ? 'ON' : 'OFF');
    const muteBtn = $('mute-btn');
    if (muteBtn) muteBtn.textContent = '[N] Suara: ' + (state.muted ? 'OFF' : 'ON');
    const pauseBtn = $('pause-btn');
    if (pauseBtn) pauseBtn.textContent = '[P] Jeda';
  }

  function updateTopbar() {
    const mode = MODES[state.mode];
    const mission = mode.name.toUpperCase();
    const timeText = mode.timeLimit > 0 ? formatTime(Math.max(0, state.timeLeft)) : formatTime(state.time);
    if (mission !== lastTopbar.mission) {
      const missionBadge = $('mission-badge');
      if (missionBadge) missionBadge.textContent = mission;
      lastTopbar.mission = mission;
    }
    if (state.score !== lastTopbar.score) {
      const scoreEl = $('score');
      if (scoreEl) scoreEl.textContent = String(state.score);
      lastTopbar.score = state.score;
    }
    if (timeText !== lastTopbar.time) {
      const timerEl = $('timer');
      if (timerEl) timerEl.textContent = timeText;
      lastTopbar.time = timeText;
    }
  }

  function startGame() {
    const mode = MODES[state.mode];
    World.setMap(state.map);
    flight.setAircraft(state.aircraft);
    renderer.setAircraft(state.aircraft);
    renderer.setAmbient(World.getMap().particles);
    applyAircraftTone(state.aircraft);
    audio.init();
    audio.resume();
    rings = mode.rings;
    renderer.setCourse(rings);
    state.score = 0;
    state.ringsPassed = 0;
    state.nextRingIndex = 0;
    state.combo = 0;
    state.time = 0;
    state.timeLeft = mode.timeLimit || 0;
    state.debrief = null;
    throttle = 0;
    if (mode.startAirborne) {
      flight.reset(0, 260, 900, true, 70);
      throttle = 55;
    } else {
      flight.reset(0, World.RUNWAY.elevation, World.RUNWAY.z, false, 0);
    }
    flight.fuel = 100;
    flight.damage = 0;
    wasOnGround = !mode.startAirborne;
    prevPos = flight.pos.slice();
    state.cameraMode = state.cameraMode === 'orbit' ? 'chase' : state.cameraMode;
    renderer.cameraMode = state.cameraMode;
    state.screen = 'PLAYING';
    state.paused = false;
    $('menu').style.display = 'none';
    $('pause').classList.add('hidden');
    $('debrief').classList.add('hidden');
    $('topbar').classList.remove('hidden');
    $('hud').style.display = 'block';
    updateTopButtons();
    lastTopbar = { mission: '', score: -1, time: '' };
    updateTopbar();
    toast(mode.name + ' — ' + World.getMap().name + ' — ' + flight.spec.name);
    if (mode.startAirborne) toast('Mendarat di runway 36, sehalus mungkin!');
  }

  function showMenu() {
    state.screen = 'MENU';
    state.paused = false;
    $('menu').style.display = 'flex';
    $('pause').classList.add('hidden');
    $('debrief').classList.add('hidden');
    $('topbar').classList.add('hidden');
    // Hide + clear the flight HUD so nothing stale shows behind the hangar
    const hudEl = $('hud');
    if (hudEl) {
      hudEl.style.display = 'none';
      const ctx = hudEl.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, hudEl.width, hudEl.height);
    }
    applySelectionToPreview();
    syncMenuSelection();
    updateTopButtons();
  }

  function togglePause(force) {
    if (state.screen !== 'PLAYING' && state.screen !== 'PAUSED') return;
    const toPause = force !== undefined ? force : state.screen === 'PLAYING';
    state.paused = toPause;
    state.screen = toPause ? 'PAUSED' : 'PLAYING';
    $('pause').classList.toggle('hidden', !toPause);
  }

  function toast(text) {
    toasts.push({ text, t: 0 });
    if (toasts.length > 3) toasts.shift();
    const el = $('toast');
    if (el) {
      el.textContent = text;
      el.style.opacity = '1';
      setTimeout(() => { el.style.opacity = '0'; }, 2600);
    }
  }

  // Build the single state object the HUD's draw(s) expects.
  function buildHudState() {
    const f = flight;
    let objective = null;
    if (state.nextRingIndex < rings.length) {
      const ring = rings[state.nextRingIndex];
      objective = {
        pos: [ring.x, ring.y, ring.z],
        label: ring.label,
        dist: Math.hypot(f.pos[0] - ring.x, f.pos[1] - ring.y, f.pos[2] - ring.z)
      };
    } else if (MODES[state.mode].requireLanding) {
      const r = World.RUNWAY;
      objective = {
        pos: [r.x, r.elevation, r.z],
        label: 'Runway 36',
        dist: Math.hypot(f.pos[0] - r.x, f.pos[1] - r.elevation, f.pos[2] - r.z)
      };
    }
    let alert = null;
    if (f.crashed) alert = 'PESAWAT JATUH';
    else if (f.stalled) alert = 'STALL — NAIKKAN KECEPATAN';
    else if (f.terrainWarning) alert = 'TERRAIN — TARIK KE ATAS';
    else if (f.fuel <= 0 && !f.onGround) alert = 'BAHAN BAKAR HABIS — CARI RUNWAY';
    else if (f.fuel < 20) alert = 'BAHAN BAKAR RENDAH';
    else if (f.damage >= 70) alert = 'KERUSAKAN PARAH';
    return {
      flight: {
        rollDeg: f.roll, pitchDeg: f.pitch, headingDeg: f.heading,
        speed: f.speed, throttle: f.throttle / 100,
        altMSL: f.altitude, altAGL: f.altAGL, vsi: f.vsi,
        fuel: f.fuel, damage: f.damage,
        gearDown: f.gearDown, flapsDeg: Math.round(f.flapPos * 30),
        airbrake: f.airbrake, afterburner: f.throttle >= 95,
        gLoad: f.gLoad, aoa: f.aoa,
        stall: f.stalled, terrainWarning: f.terrainWarning,
        pos: f.pos
      },
      objective,
      project: (p) => renderer.project(p),
      cameraMode: state.cameraMode,
      yokeOn: state.yokeMode,
      yokeX, yokeY,
      alert,
      toasts,
      rings,
      nextRingIndex: state.nextRingIndex,
      aircraftName: f.spec.name
    };
  }

  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - lastTime) / 1000 || 0.016);
    lastTime = t;
    if (state.screen === 'MENU') {
      state.menuTime += dt;
      renderer.cameraMode = 'hangar';
      renderer.render(state, flight, rings, state.nextRingIndex, t / 1000);
      return;
    }
    if (state.screen === 'PLAYING' && !state.paused) {
      update(dt);
    }
    // Keep the HUD canvas backing store at screen size (it defaults to 300x150)
    const hudEl = $('hud');
    if (hudEl && (hudEl.width !== canvas.clientWidth || hudEl.height !== canvas.clientHeight)) {
      hud.resize(canvas.clientWidth, canvas.clientHeight);
    }
    renderer.cameraMode = state.cameraMode;
    renderer.render(state, flight, rings, state.nextRingIndex, t / 1000);
    hud.draw(buildHudState());
    updateTopbar();
    if (state.screen === 'PLAYING' || state.screen === 'PAUSED') {
      audio.update({
        throttle: flight.throttle / 100,
        airspeed: flight.speed,
        onGround: flight.onGround,
        rpm: flight.throttle / 100,
        isCrashed: flight.crashed
      });
    }
  }

  function update(dt) {
    state.time += dt;
    const mode = MODES[state.mode];
    if (mode.timeLimit > 0) {
      state.timeLeft = mode.timeLimit - state.time;
      if (state.timeLeft <= 0) {
        finishMission(false, 'Waktu habis!');
        return;
      }
    }
    // Input -> flight model
    const pitchSign = state.invertPitch ? 1 : -1;
    let pitchIn = 0, rollIn = 0, yawIn = 0;
    if (keys['KeyS'] || keys['ArrowDown']) pitchIn = pitchSign * -1;
    if (keys['KeyW'] || keys['ArrowUp']) pitchIn = pitchSign * 1;
    if (keys['KeyA'] || keys['ArrowLeft']) rollIn = -1;
    if (keys['KeyD'] || keys['ArrowRight']) rollIn = 1;
    if (keys['KeyQ']) yawIn = -1;
    if (keys['KeyE']) yawIn = 1;
    if (state.yokeMode && mouseDown) {
      rollIn = yokeX;
      pitchIn = yokeY * pitchSign;
    }
    if (keys['ShiftLeft'] || keys['ShiftRight']) throttle = Math.min(100, throttle + 60 * dt);
    if (keys['ControlLeft'] || keys['ControlRight']) throttle = Math.max(0, throttle - 60 * dt);
    const input = {
      pitch: pitchIn, roll: rollIn, yaw: yawIn,
      throttleUp: false, throttleDown: false, throttleSet: throttle,
      airbrake: keys['KeyB'] || keys['Space'],
      toggleGear: false, toggleFlaps: false
    };
    prevPos = flight.pos.slice();
    flight.update(dt, input);
    // Ring checkpoints: crossed the ring plane within the ring radius?
    if (state.nextRingIndex < rings.length) {
      const ring = rings[state.nextRingIndex];
      const crossed = (prevPos[2] - ring.z) * (flight.pos[2] - ring.z) <= 0 &&
        Math.abs(flight.pos[2] - ring.z) < 60;
      if (crossed) {
        const dx = flight.pos[0] - ring.x;
        const dy = flight.pos[1] - ring.y;
        const dist = Math.hypot(dx, dy);
        if (dist < ring.r + 14) {
          state.combo++;
          const pts = 250 + 50 * state.combo;
          state.score += pts;
          state.ringsPassed++;
          state.nextRingIndex++;
          audio.ringPass(state.combo);
          toast('Cincin ' + state.ringsPassed + ' — +' + pts + ' poin (kombo x' + state.combo + ')');
          if (state.nextRingIndex >= rings.length && !mode.requireLanding) {
            finishMission(true, 'Semua cincin terlewati!');
            return;
          }
          if (state.nextRingIndex >= rings.length && mode.requireLanding) {
            toast('Semua cincin terlewati — sekarang mendarat di runway 36!');
          }
        } else {
          state.combo = 0;
          toast('Melewatkan ' + ring.label + ' — kombo hilang');
          state.nextRingIndex++;
          if (state.nextRingIndex >= rings.length && !mode.requireLanding) {
            finishMission(true, 'Misi selesai!');
            return;
          }
        }
      }
    }
    // Landing: touchdown on the runway after all rings (or immediately in landing mode)
    const landed = flight.onGround && !wasOnGround && state.screen === 'PLAYING';
    if (landed) {
      const runway = World.RUNWAY;
      const centerOffset = Math.abs(flight.pos[0] - runway.x);
      const alongRunway = Math.abs(flight.pos[2] - runway.z) < runway.length / 2;
      if (alongRunway && centerOffset < runway.width / 2 + 12) {
        audio.touchdown();
        if (state.mode === 'landing') {
          const sink = Math.abs(flight.vsi || 0);
          const landingScore = Math.max(100, Math.round(1000 - sink * 40 - centerOffset * 8 - Math.abs(flight.speed - 45) * 4));
          state.score += landingScore;
          finishMission(true, 'Mendarat! Skor pendaratan +' + landingScore);
          return;
        }
        if (state.nextRingIndex >= rings.length && mode.requireLanding) {
          finishMission(true, 'Mendarat dengan selamat!');
          return;
        }
        toast('Mendarat di runway — lepas landas lagi untuk lanjut misi');
      } else {
        flight.addDamage(15);
        toast('Mendarat di luar runway — kerusakan +' + 15);
      }
    }
    wasOnGround = flight.onGround;
    // Crash / fuel out
    if (flight.crashed) {
      finishMission(false, 'Jatuh: ' + flight.crashReason);
      return;
    }
    if (flight.fuel <= 0 && !flight.onGround) {
      toast('BAHAN BAKAR HABIS — cari runway!');
    }
    if (flight.fuel < 20 && flight.fuel > 0) audio.lowFuel();
    if (flight.stalled) audio.warnStall();
    if (flight.terrainWarning) audio.warnTerrain();
    // Building collision (city boxes)
    const city = World.CITY;
    if (!flight.onGround && state.map !== 'antariksa') {
      const dCity = Math.hypot(flight.pos[0] - city.x, flight.pos[2] - city.z);
      if (dCity < city.radius && flight.pos[1] < 90) {
        flight.addDamage(30);
        flight.pos[1] += 30;
        toast('Menabrak gedung! Kerusakan +30');
      }
    }
    // Volcano lava proximity damage
    if (state.map === 'kawah' && !flight.onGround) {
      const peak = World.PEAKS[0];
      const dPeak = Math.hypot(flight.pos[0] - peak.x, flight.pos[2] - peak.z);
      if (dPeak < 300 && flight.pos[1] < World.getTerrainHeight(peak.x, peak.z) + 80) {
        flight.addDamage(20 * dt);
        if (Math.random() < dt * 0.5) toast('Panas lava! Jauhi kawah!');
      }
    }
  }

  function finishMission(success, message) {
    state.screen = 'DEBRIEF';
    let bonus = 0;
    if (success && state.mode === 'timetrial' && state.timeLeft > 0) {
      bonus = Math.round(state.timeLeft * 10);
      state.score += bonus;
    }
    if (success && state.mode !== 'timetrial') {
      bonus = Math.max(0, Math.round(1200 - state.time * 6));
      state.score += bonus;
    }
    const key = state.mode + '-' + state.aircraft + '-' + state.map;
    const prevBest = state.best[key] || 0;
    if (state.score > prevBest) {
      state.best[key] = state.score;
      saveBest();
    }
    state.debrief = {
      success, message,
      score: state.score,
      rings: state.ringsPassed,
      totalRings: rings.length,
      time: state.time,
      bonus,
      best: state.best[key],
      isNewBest: state.score > prevBest
    };
    if (success) audio.success(); else audio.crash();
    const el = $('debrief');
    el.classList.remove('hidden');
    $('debrief-title').textContent = success ? 'MISI SELESAI!' : 'MISI GAGAL';
    $('debrief-reason').textContent = message;
    $('debrief-score').textContent = state.score;
    $('debrief-rings').textContent = state.ringsPassed + ' / ' + rings.length;
    $('debrief-time').textContent = formatTime(state.time);
    $('debrief-best').textContent = state.best[key] + (state.debrief.isNewBest ? '  (baru!)' : '');
    $('debrief-bonus').textContent = bonus ? 'Bonus waktu: +' + bonus + ' poin' : '';
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }

  // Debug handle for the automated screenshot driver. flight is a getter:
  // the Flight object is created in init(), after this handle is defined,
  // so a plain property would stay undefined.
  global.__aerovant = {
    state,
    get flight() { return flight; },
    get score() { return state.score; },
    get nextRingIndex() { return state.nextRingIndex; },
    get rings() { return rings; },
    get map() { return World.getMap().id; },
    start: startGame,
    setThrottle: (v) => { throttle = M.clamp(v, 0, 100); },
    press: (code) => { keys[code] = true; },
    hold: (code, ms) => new Promise(res => { keys[code] = true; setTimeout(() => { keys[code] = false; res(); }, ms); }),
    release: (code) => { keys[code] = false; }
  };

  document.addEventListener('DOMContentLoaded', init);
})(window);
