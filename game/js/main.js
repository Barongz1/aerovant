// AEROVANT — Main Game Loop, Input, Mission State & Audio

(() => {
  const M = window.AeroMath;

  let gameState = 'HANGAR'; // HANGAR | PLAYING | PAUSED | COMPLETE | CRASHED
  let lastTime = performance.now();
  let totalTime = 0;

  const keys = {};
  let mouseFireHeld = false;
  const missionState = {
    score: 0,
    elapsed: 0,
    landed: false,
  };

  function getBestScore() {
    return Number(localStorage.getItem('aerovant_best_score') || 0);
  }

  function saveBestScore(score) {
    const prev = getBestScore();
    if (score > prev) {
      localStorage.setItem('aerovant_best_score', String(score));
    }
    return Math.max(prev, score);
  }

  function toggleCamera() {
    const ps = window.AeroPlane.state;
    ps.cameraMode = ps.cameraMode === 'chase' ? 'cockpit' : 'chase';
  }

  function togglePause() {
    if (gameState === 'PLAYING') {
      gameState = 'PAUSED';
      showModal('DIJEDA', 'PENERBANGAN DIJEDA', 'Tekan LANJUTKAN atau tombol P untuk kembali terbang.', true);
    } else if (gameState === 'PAUSED') {
      gameState = 'PLAYING';
      hideModal();
    }
  }

  function launchFlight(plane, map, mode) {
    window.AeroWorld.load(map, mode);
    window.AeroPlane.reset(plane, !mode.isCombat);
    window._smoothCamPos = null;
    missionState.score = 0;
    missionState.elapsed = 0;
    missionState.landed = false;

    if (mode.isCombat) {
      window.AeroCombat.reset(window.AeroPlane.state.pos, window.AeroPlane.state.yaw);
    } else {
      window.AeroCombat.stop();
    }

    document.getElementById('banner-title').textContent = `${plane.name} · ${mode.name.toUpperCase()}`;
    document.getElementById('banner-sub').textContent = mode.desc;

    document.getElementById('screen-hangar').classList.add('hidden');
    document.getElementById('hud-root').classList.remove('hidden');
    hideModal();
    gameState = 'PLAYING';
  }

  function returnToHangar() {
    hideModal();
    window.AeroCombat.stop();
    document.getElementById('hud-root').classList.add('hidden');
    document.getElementById('screen-hangar').classList.remove('hidden');
    window.AeroPlane.reset(window.AeroHangar.getSelectedPlane(), true);
    const bestEl = document.getElementById('summary-best-score');
    if (bestEl) bestEl.textContent = getBestScore();
    gameState = 'HANGAR';
  }

  function showModal(badge, title, subtitle, canResume) {
    const ps = window.AeroPlane.state;
    const hullPct = Math.round(ps.hull);
    const grade = hullPct >= 90 && missionState.elapsed < 120 ? 'A' : hullPct >= 70 ? 'B' : 'C';
    const mins = String(Math.floor(missionState.elapsed / 60)).padStart(2, '0');
    const secs = String(Math.floor(missionState.elapsed % 60)).padStart(2, '0');
    const best = saveBestScore(missionState.score);

    document.getElementById('modal-badge').textContent = badge;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-subtitle').textContent = subtitle;
    document.getElementById('res-grade').textContent = grade;
    document.getElementById('res-score').textContent = missionState.score;
    document.getElementById('res-time').textContent = `${mins}:${secs}`;
    document.getElementById('res-hull').textContent = `${hullPct}%`;

    const isCombat = window.AeroCombat && window.AeroCombat.state.active;
    const combatStats = document.getElementById('modal-combat-stats');
    combatStats.classList.toggle('hidden', !isCombat);
    if (isCombat) {
      const cs = window.AeroCombat.state;
      const acc = cs.shotsFired > 0 ? Math.round((cs.shotsHit / cs.shotsFired) * 100) : 0;
      document.getElementById('res-wave').textContent = cs.maxWave;
      document.getElementById('res-kills').textContent = cs.kills;
      document.getElementById('res-acc').textContent = `${acc}%`;
      document.getElementById('res-best').textContent = best;
    }

    document.getElementById('modal-btn-resume').classList.toggle('hidden', !canResume);
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function hideModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  }

  function bindEvents() {
    window.addEventListener('resize', () => window.AeroGL.resize());

    window.addEventListener('keydown', (e) => {
      const code = e.code;
      keys[code] = true;

      if (gameState !== 'PLAYING' && gameState !== 'PAUSED') return;

      if (code === 'KeyC' || code === 'KeyV') toggleCamera();
      else if (code === 'KeyG') window.AeroPlane.state.gearDown = !window.AeroPlane.state.gearDown;
      else if (code === 'KeyF') window.AeroPlane.state.flapDeg = (window.AeroPlane.state.flapDeg + 15) % 45;
      else if (code === 'KeyL') window.AeroPlane.state.lightsOn = !window.AeroPlane.state.lightsOn;
      else if (code === 'KeyZ' && gameState === 'PLAYING') window.AeroCombat.fireMissile(window.AeroPlane.state);
      else if (code === 'KeyP' || code === 'Escape') togglePause();
      else if (code === 'KeyR') {
        launchFlight(window.AeroHangar.getSelectedPlane(), window.AeroHangar.getSelectedMap(), window.AeroHangar.getSelectedMode());
      } else if (code === 'KeyM') {
        returnToHangar();
      }
    });

    window.addEventListener('keyup', (e) => {
      keys[e.code] = false;
    });

    // Mouse weapon controls (Left Click = Cannon, Right Click = Missile)
    const glCanvas = document.getElementById('gl-canvas');
    glCanvas.addEventListener('mousedown', (e) => {
      if (gameState !== 'PLAYING') return;
      if (e.button === 0) {
        mouseFireHeld = true;
        window.AeroCombat.fireCannon(window.AeroPlane.state);
      } else if (e.button === 2) {
        window.AeroCombat.fireMissile(window.AeroPlane.state);
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) mouseFireHeld = false;
    });
    glCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // HUD buttons
    document.getElementById('btn-gear').addEventListener('click', () => {
      window.AeroPlane.state.gearDown = !window.AeroPlane.state.gearDown;
    });
    document.getElementById('btn-flap').addEventListener('click', () => {
      window.AeroPlane.state.flapDeg = (window.AeroPlane.state.flapDeg + 15) % 45;
    });
    document.getElementById('btn-brk').addEventListener('click', () => {
      window.AeroPlane.state.brake = !window.AeroPlane.state.brake;
    });
    document.getElementById('btn-light').addEventListener('click', () => {
      window.AeroPlane.state.lightsOn = !window.AeroPlane.state.lightsOn;
    });
    document.getElementById('btn-cam').addEventListener('click', toggleCamera);
    document.getElementById('btn-pause').addEventListener('click', togglePause);
    document.getElementById('btn-reset').addEventListener('click', () => {
      launchFlight(window.AeroHangar.getSelectedPlane(), window.AeroHangar.getSelectedMap(), window.AeroHangar.getSelectedMode());
    });
    document.getElementById('btn-misi').addEventListener('click', returnToHangar);

    // Throttle slider click/drag
    const track = document.getElementById('thr-track');
    let draggingThr = false;
    const setThrFromEvent = (ev) => {
      const rect = track.getBoundingClientRect();
      const pct = 1 - M.clamp((ev.clientY - rect.top) / rect.height, 0, 1);
      window.AeroPlane.state.throttle = pct;
    };
    track.addEventListener('mousedown', (ev) => { draggingThr = true; setThrFromEvent(ev); });
    window.addEventListener('mousemove', (ev) => { if (draggingThr) setThrFromEvent(ev); });
    window.addEventListener('mouseup', () => { draggingThr = false; });

    // Modal buttons
    document.getElementById('modal-btn-resume').addEventListener('click', togglePause);
    document.getElementById('modal-btn-retry').addEventListener('click', () => {
      launchFlight(window.AeroHangar.getSelectedPlane(), window.AeroHangar.getSelectedMap(), window.AeroHangar.getSelectedMode());
    });
    document.getElementById('modal-btn-hangar').addEventListener('click', returnToHangar);
  }

  function updateMission(onRunwayRect) {
    const ps = window.AeroPlane.state;
    const gates = window.AeroWorld.gates;
    const mode = window.AeroWorld.currentMode;

    // Gate pass detection
    for (const g of gates) {
      if (g.passed) continue;
      const d = M.dist(ps.pos, g);
      if (d < 40) {
        g.passed = true;
        missionState.score += 250;
      }
    }

    // Check mission completion: all gates passed (in corridor/dawn) + landed on runway & slowed down
    const allGatesDone = gates.every((g) => g.passed);
    if (mode.hasGates && allGatesDone && ps.hasTakenOff && ps.onGround && onRunwayRect && ps.speedKts < 42) {
      missionState.landed = true;
      missionState.score += Math.round(ps.hull * 5);
      gameState = 'COMPLETE';
      showModal('MISI SELESAI', 'PENDARATAN SEMPURNA!', 'Seluruh gerbang udara telah dilewati dan pesawat mendarat mulus di RWY 27.', false);
    }
  }

  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    totalTime += dt;

    const canvas = document.getElementById('gl-canvas');
    const aspect = canvas.width / Math.max(1, canvas.height);
    const proj = M.mat4Perspective(M.degToRad(58), aspect, 0.5, 8500);
    const gl = window.AeroGL.gl;
    gl.clearColor(0.04, 0.06, 0.10, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (gameState === 'HANGAR') {
      window.AeroHangar.render3D(proj, totalTime, dt);
    } else {
      if (gameState === 'PLAYING') {
        missionState.elapsed += dt;
        const input = {
          pitchUp: keys['KeyS'] || keys['ArrowDown'],
          pitchDown: keys['KeyW'] || keys['ArrowUp'],
          rollLeft: keys['KeyA'] || keys['ArrowLeft'],
          rollRight: keys['KeyD'] || keys['ArrowRight'],
          yawLeft: keys['KeyQ'],
          yawRight: keys['KeyE'],
          thrUp: keys['ShiftLeft'] || keys['ShiftRight'],
          thrDown: keys['ControlLeft'] || keys['ControlRight'],
        };
        if (keys['Space'] || keys['KeyB']) {
          window.AeroPlane.state.brake = true;
        } else if (!document.getElementById('btn-brk').matches(':active')) {
          // Allow space/B to release brake cleanly
          if (keys['Space'] === false || keys['KeyB'] === false) {
            window.AeroPlane.state.brake = false;
          }
        }

        if (mouseFireHeld || keys['KeyX']) {
          window.AeroCombat.fireCannon(window.AeroPlane.state);
        }

        const res = window.AeroPlane.update(dt, input);
        window.AeroCombat.update(dt, window.AeroPlane.state, missionState);

        if (res.crashEvent || window.AeroPlane.state.hull <= 0) {
          gameState = 'CRASHED';
          window.AeroHUD.update(missionState);
          const isCombat = window.AeroCombat.state.active;
          showModal(
            isCombat ? 'GAME OVER' : 'KECELAKAAN FATAL',
            isCombat ? 'PESAWAT DITEMBAK JATUH!' : 'PESAWAT HANCUR!',
            res.crashReason || 'Hull pesawat habis akibat serangan musuh. Silakan ulangi pertempuran.',
            false
          );
        } else {
          updateMission(res.onRunwayRect);
        }
      }

      const ps = window.AeroPlane.state;
      const cy = Math.cos(ps.yaw), sy = Math.sin(ps.yaw);
      const cp = Math.cos(ps.pitch), sp = Math.sin(ps.pitch);
      const fwd = { x: -sy * cp, y: sp, z: -cy * cp };

      let camPos, camTarget;
      if (ps.cameraMode === 'chase') {
        const desiredPos = {
          x: ps.pos.x - fwd.x * 16.5,
          y: ps.pos.y - fwd.y * 16.5 + 4.2,
          z: ps.pos.z - fwd.z * 16.5,
        };
        if (!window._smoothCamPos || gameState === 'HANGAR') {
          window._smoothCamPos = { ...desiredPos };
        } else {
          const lag = Math.min(1, dt * 8.5);
          window._smoothCamPos.x = M.lerp(window._smoothCamPos.x, desiredPos.x, lag);
          window._smoothCamPos.y = M.lerp(window._smoothCamPos.y, desiredPos.y, lag);
          window._smoothCamPos.z = M.lerp(window._smoothCamPos.z, desiredPos.z, lag);
        }
        camPos = window._smoothCamPos;
        camTarget = {
          x: ps.pos.x + fwd.x * 18,
          y: ps.pos.y + fwd.y * 18 + 0.8,
          z: ps.pos.z + fwd.z * 18,
        };
      } else {
        camPos = {
          x: ps.pos.x + fwd.x * 0.8,
          y: ps.pos.y + fwd.y * 0.8 + 0.9,
          z: ps.pos.z + fwd.z * 0.8,
        };
        camTarget = {
          x: camPos.x + fwd.x * 40,
          y: camPos.y + fwd.y * 40,
          z: camPos.z + fwd.z * 40,
        };
      }

      const shake = window.AeroCombat.state.screenShake;
      if (shake > 0) {
        camPos = {
          x: camPos.x + (Math.random() - 0.5) * shake * 1.8,
          y: camPos.y + (Math.random() - 0.5) * shake * 1.8,
          z: camPos.z + (Math.random() - 0.5) * shake * 1.8,
        };
      }

      const view = M.mat4LookAt(camPos, camTarget, { x: 0, y: 1, z: 0 });
      const dir = M.sub(camTarget, camPos);
      const viewRot = M.mat4LookAt({ x: 0, y: 0, z: 0 }, dir, { x: 0, y: 1, z: 0 });

      window.AeroWorld.render(proj, view, viewRot, camPos, totalTime, ps.pos, dt, ps.lightsOn);
      window.AeroCombat.render(proj, view, camPos, totalTime);
      window.AeroPlane.render(proj, view, camPos, totalTime, false);
      window.AeroHUD.update(missionState);
    }

    requestAnimationFrame(frame);
  }

  function boot() {
    const canvas = document.getElementById('gl-canvas');
    window.AeroGL.init(canvas);
    window.AeroHangar.init(launchFlight);
    bindEvents();
    requestAnimationFrame(frame);
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
