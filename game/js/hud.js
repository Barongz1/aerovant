// AEROVANT — Complete Chase & Cockpit HUD Renderer

window.AeroHUD = (() => {
  const M = window.AeroMath;

  function drawCompass(hdgDeg) {
    const c = document.getElementById('compass-canvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);

    const pxPerDeg = 3.2;
    const center = w * 0.5;
    const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };

    ctx.font = 'bold 11px Consolas, monospace';
    ctx.textAlign = 'center';

    for (let d = -60; d <= 60; d += 5) {
      const deg = Math.round(hdgDeg + d);
      const norm = ((deg % 360) + 360) % 360;
      const x = center + (deg - hdgDeg) * pxPerDeg;
      if (x < 4 || x > w - 4) continue;

      const isMajor = norm % 30 === 0;
      const isCard = norm % 45 === 0;
      ctx.strokeStyle = isMajor ? 'rgba(245,166,35,0.9)' : 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x, h - (isMajor ? 10 : 5));
      ctx.stroke();

      if (norm % 30 === 0 || isCard) {
        ctx.fillStyle = labels[norm] ? '#ffbe44' : '#e2e8f0';
        ctx.fillText(labels[norm] || String(norm).padStart(3, '0'), x, 14);
      }
    }

    // Center pointer
    ctx.fillStyle = '#ffbe44';
    ctx.beginPath();
    ctx.moveTo(center, h - 2);
    ctx.lineTo(center - 4, h - 8);
    ctx.lineTo(center + 4, h - 8);
    ctx.closePath();
    ctx.fill();
  }

  function drawTape(canvasId, val, step, pxPerUnit, alignRight) {
    const c = document.getElementById(canvasId);
    if (!c) return;
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);

    const cy = h * 0.5;
    ctx.font = 'bold 11px Consolas, monospace';
    ctx.textAlign = alignRight ? 'left' : 'right';

    const start = Math.floor((val - 60) / step) * step;
    const end = Math.ceil((val + 60) / step) * step;

    for (let v = start; v <= end; v += step) {
      if (v < 0) continue;
      const y = cy - (v - val) * pxPerUnit;
      if (y < 6 || y > h - 6) continue;

      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      if (alignRight) {
        ctx.moveTo(0, y);
        ctx.lineTo(10, y);
        ctx.stroke();
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(String(v), 14, y + 4);
      } else {
        ctx.moveTo(w, y);
        ctx.lineTo(w - 10, y);
        ctx.stroke();
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(String(v), w - 14, y + 4);
      }
    }
  }

  function drawPitchLadder(pitchRad, rollRad) {
    const c = document.getElementById('pitch-ladder-canvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w * 0.5, cy = h * 0.5;
    const pitchDeg = M.radToDeg(pitchRad);
    const pxPerDeg = 4.2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-rollRad);

    ctx.font = 'bold 10px Consolas, monospace';
    ctx.lineWidth = 1.6;

    for (let deg = -30; deg <= 30; deg += 10) {
      const y = (pitchDeg - deg) * pxPerDeg;
      if (Math.abs(y) > h * 0.44) continue;

      ctx.strokeStyle = deg === 0 ? 'rgba(245,166,35,0.85)' : 'rgba(255,205,105,0.75)';
      ctx.fillStyle = '#ffbe44';

      if (deg === 0) {
        ctx.beginPath();
        ctx.moveTo(-75, y); ctx.lineTo(-22, y);
        ctx.moveTo(22, y); ctx.lineTo(75, y);
        ctx.stroke();
      } else {
        if (deg < 0) ctx.setLineDash([5, 4]);
        else ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(-52, y); ctx.lineTo(-18, y);
        ctx.moveTo(18, y); ctx.lineTo(52, y);
        ctx.stroke();
        ctx.setLineDash([]);
        const lbl = (deg > 0 ? '+' : '') + deg;
        ctx.textAlign = 'right';
        ctx.fillText(lbl, -56, y + 3);
        ctx.textAlign = 'left';
        ctx.fillText(lbl, 56, y + 3);
      }
    }
    ctx.restore();

    // Center boresight reticle
    ctx.strokeStyle = '#ffbe44';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.moveTo(cx - 14, cy); ctx.lineTo(cx - 5, cy);
    ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 14, cy);
    ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy - 5);
    ctx.stroke();
  }

  function drawRadar(canvasId, planeState, gates, runway) {
    const c = document.getElementById(canvasId);
    if (!c) return;
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    const cx = w * 0.5, cy = h * 0.5;
    const r = w * 0.44;
    ctx.clearRect(0, 0, w, h);

    // Background rings
    ctx.fillStyle = 'rgba(8, 18, 22, 0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(72, 209, 130, 0.28)';
    ctx.lineWidth = 1;
    for (const frac of [0.33, 0.66, 1.0]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * frac, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Heading cone
    ctx.fillStyle = 'rgba(245, 166, 35, 0.12)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, -Math.PI * 0.5 - 0.38, -Math.PI * 0.5 + 0.38);
    ctx.closePath();
    ctx.fill();

    const rangeM = 2200;
    const cyaw = Math.cos(-planeState.yaw);
    const syaw = Math.sin(-planeState.yaw);

    const toRadar = (wx, wz) => {
      const dx = wx - planeState.pos.x;
      const dz = wz - planeState.pos.z;
      const rx = (dx * cyaw - dz * syaw) / rangeM * r;
      const ry = (dx * syaw + dz * cyaw) / rangeM * r;
      return { x: cx + rx, y: cy + ry };
    };

    // Runway marker
    const rp = toRadar(runway.x, runway.zCenter);
    if (Math.hypot(rp.x - cx, rp.y - cy) < r) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(rp.x - 3, rp.y - 6, 6, 12);
    }

    // Gate markers
    const nextGate = gates.find((g) => !g.passed);
    for (const g of gates) {
      if (g.passed) continue;
      const gp = toRadar(g.x, g.z);
      const d = Math.hypot(gp.x - cx, gp.y - cy);
      if (d > r - 3) {
        const ang = Math.atan2(gp.y - cy, gp.x - cx);
        gp.x = cx + Math.cos(ang) * (r - 4);
        gp.y = cy + Math.sin(ang) * (r - 4);
      }
      ctx.fillStyle = (nextGate && g.id === nextGate.id) ? '#ffbe44' : '#ea580c';
      ctx.beginPath();
      ctx.arc(gp.x, gp.y, (nextGate && g.id === nextGate.id) ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Combat enemy markers on radar
    if (window.AeroCombat && window.AeroCombat.state.active) {
      for (const e of window.AeroCombat.state.enemies) {
        const ep = toRadar(e.x, e.z);
        const d = Math.hypot(ep.x - cx, ep.y - cy);
        if (d > r - 3) {
          const ang = Math.atan2(ep.y - cy, ep.x - cx);
          ep.x = cx + Math.cos(ang) * (r - 4);
          ep.y = cy + Math.sin(ang) * (r - 4);
        }
        ctx.fillStyle = e.kind === 'boss' ? '#ffaa00' : '#ff3b3b';
        ctx.beginPath();
        ctx.arc(ep.x, ep.y, e.kind === 'boss' ? 4.5 : 3.0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Center aircraft triangle
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx - 4, cy + 5);
    ctx.lineTo(cx + 4, cy + 5);
    ctx.closePath();
    ctx.fill();
  }

  function drawADI(canvasId, pitchRad, rollRad) {
    const c = document.getElementById(canvasId);
    if (!c) return;
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    const cx = w * 0.5, cy = h * 0.5;
    const r = Math.min(w, h) * 0.45;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    ctx.translate(cx, cy);
    ctx.rotate(-rollRad);
    const pitchPx = M.radToDeg(pitchRad) * 1.6;

    // Sky & Ground
    ctx.fillStyle = '#2576b8';
    ctx.fillRect(-r * 2, -r * 2 + pitchPx, r * 4, r * 2);
    ctx.fillStyle = '#7c4a21';
    ctx.fillRect(-r * 2, pitchPx, r * 4, r * 2);

    // Horizon line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-r * 1.5, pitchPx);
    ctx.lineTo(r * 1.5, pitchPx);
    ctx.stroke();

    // Pitch ticks
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1;
    for (const d of [-20, -10, 10, 20]) {
      const py = pitchPx - d * 1.6;
      ctx.beginPath();
      ctx.moveTo(-14, py);
      ctx.lineTo(14, py);
      ctx.stroke();
    }
    ctx.restore();

    // Outer ring & fixed airplane symbol
    ctx.strokeStyle = '#f5a623';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#ffbe44';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy); ctx.lineTo(cx - 6, cy);
    ctx.lineTo(cx, cy + 5);
    ctx.lineTo(cx + 6, cy); ctx.lineTo(cx + 18, cy);
    ctx.stroke();
  }

  function update(missionState) {
    const ps = window.AeroPlane.state;
    const map = window.AeroWorld.currentMap;
    const mode = window.AeroWorld.currentMode;
    const gates = window.AeroWorld.gates;
    const rwy = window.AeroWorld.RUNWAY;
    if (!ps.plane || !map || !mode) return;

    // Heading: yaw=0 faces -Z which we map to 270° (West / RWY 27)
    const hdgDeg = ((Math.round(270 - M.radToDeg(ps.yaw)) % 360) + 360) % 360;
    document.getElementById('hud-hdg').textContent = String(hdgDeg).padStart(3, '0');
    drawCompass(hdgDeg);

    // Speed & Altitude tapes
    const kts = Math.round(ps.speedKts);
    const altFt = Math.round(ps.pos.y * 3.28084);
    const mach = (kts / 661).toFixed(2);
    document.getElementById('hud-kts').textContent = kts;
    document.getElementById('hud-mach').textContent = mach;
    document.getElementById('hud-alt').textContent = altFt;
    document.getElementById('hud-agl').textContent = `${Math.round(ps.agl)} FT`;
    document.getElementById('hud-vsi').textContent = (ps.vsi >= 0 ? '+' : '') + ps.vsi;

    drawTape('speed-tape-canvas', kts, 10, 3.2, false);
    drawTape('alt-tape-canvas', altFt, 100, 0.36, true);
    drawPitchLadder(ps.pitch, ps.roll);

    // Throttle
    const thrPct = Math.round(ps.throttle * 100);
    document.getElementById('hud-thr').textContent = `${thrPct}%`;
    document.getElementById('thr-fill').style.height = `${thrPct}%`;
    document.getElementById('thr-thumb').style.bottom = `${thrPct}%`;
    document.getElementById('thr-ab-badge').classList.toggle('active', ps.plane.type === 'jet' && ps.throttle > 0.85);

    // Top-left mission info
    const isCombatMode = Boolean(mode.isCombat && window.AeroCombat && window.AeroCombat.state.active);
    document.getElementById('hud-mission-name').textContent = mode.name.toUpperCase();
    document.getElementById('hud-location-name').textContent = map.location;
    document.getElementById('hud-score').textContent = missionState.score;
    const passedCount = gates.filter((g) => g.passed).length;
    document.getElementById('hud-gate-progress').textContent = isCombatMode
      ? `WAVE ${window.AeroCombat.state.wave}`
      : `${passedCount}/${gates.length}`;
    const mins = String(Math.floor(missionState.elapsed / 60)).padStart(2, '0');
    const secs = String(Math.floor(missionState.elapsed % 60)).padStart(2, '0');
    document.getElementById('hud-timer').textContent = `${mins}:${secs}`;

    // Checklist
    const chkEl = document.getElementById('hud-checklist');
    const items = isCombatMode
      ? [
          { label: `Wave ${window.AeroCombat.state.wave} Aktif`, done: false },
          { label: `Kills: ${window.AeroCombat.state.kills}`, done: window.AeroCombat.state.kills > 0 },
          { label: 'Hindari Serangan Alien', done: ps.hull > 50 },
        ]
      : [
          { label: 'Takeoff', done: ps.hasTakenOff },
          ...gates.map((g) => ({ label: g.name, done: g.passed })),
          { label: 'Land RWY 27', done: missionState.landed },
        ];
    chkEl.innerHTML = items.map((it) =>
      `<div class="chk-item ${it.done ? 'done' : ''}"><span>${it.done ? '✓' : '○'}</span><span>${it.label}</span></div>`
    ).join('');

    // Top-right status
    document.getElementById('hud-weather').textContent = mode.nightOverride ? 'CLEAR NIGHT' : map.weather;
    document.getElementById('hud-zulu').textContent = mode.nightOverride ? '22:10Z' : map.zulu;
    document.getElementById('hud-plane-view').textContent = `${ps.plane.name} · ${ps.cameraMode.toUpperCase()}`;
    document.getElementById('hud-wind').textContent = map.wind;
    document.getElementById('hud-gforce').textContent = `${ps.gForce.toFixed(1)} G`;
    document.getElementById('hud-aoa').textContent = `${ps.aoa.toFixed(1)}°`;
    document.getElementById('hud-trim').textContent = `+${ps.trim.toFixed(1)}°`;

    drawRadar('radar-canvas', ps, gates, rwy);

    // Next Gate & Next Obj (or Combat Panel)
    const isCombat = Boolean(mode.isCombat && window.AeroCombat && window.AeroCombat.state.active);
    document.getElementById('next-gate-panel').classList.toggle('hidden', isCombat);
    document.getElementById('hud-combat-panel').classList.toggle('hidden', !isCombat);

    if (isCombat) {
      const cs = window.AeroCombat.state;
      document.getElementById('combat-wave-label').textContent = `WAVE ${cs.wave} · PERTEMPURAN`;
      document.getElementById('combat-combo-label').textContent = `COMBO x${cs.combo}`;
      document.getElementById('combat-enemies-left').textContent = cs.enemies.length;
      document.getElementById('combat-kills').textContent = cs.kills;
      document.getElementById('combat-missiles').textContent = `${cs.missiles}/${cs.maxMissiles}`;

      let nearest = cs.enemies[0];
      let bestD = nearest ? M.dist(ps.pos, nearest) : 0;
      for (const e of cs.enemies) {
        const d = M.dist(ps.pos, e);
        if (d < bestD) { bestD = d; nearest = e; }
      }
      if (nearest) {
        const distNM = (bestD / 1852).toFixed(2);
        document.getElementById('next-obj-text').textContent = `${nearest.kind.toUpperCase()} · ${Math.round(bestD)}m (${distNM} NM)`;
      } else {
        document.getElementById('next-obj-text').textContent = `WAVE ${cs.wave} CLEARED`;
      }
    } else {
      const nextGate = gates.find((g) => !g.passed);
      let targetPos = nextGate ? { x: nextGate.x, y: nextGate.y, z: nextGate.z } : { x: rwy.x, y: rwy.elev + 4, z: rwy.zCenter };
      let targetName = nextGate ? nextGate.name : 'LAND RWY 27';
      if (!mode.hasGates && !nextGate) targetName = 'FREE FLIGHT';

      const distM = M.dist(ps.pos, targetPos);
      const distNM = (distM / 1852).toFixed(2);
      const speedMs = Math.max(15, ps.speedKts * 0.62);
      const etaSec = Math.round(distM / speedMs);
      const etaStr = `${String(Math.floor(etaSec / 60)).padStart(2, '0')}:${String(etaSec % 60).padStart(2, '0')}`;

      document.getElementById('hud-next-gate-name').textContent = targetName;
      document.getElementById('hud-next-gate-dist').textContent = `${distNM} NM`;
      document.getElementById('hud-next-gate-eta').textContent = etaStr;
      document.getElementById('hud-next-gate-alt').textContent = `${Math.round(targetPos.y * 3.28084)} FT`;
      document.getElementById('next-obj-text').textContent = `NEXT OBJ · ${Math.round(distM)}m (${distNM} NM)`;
    }

    // Terrain Warning
    const showWarn = !ps.onGround && ps.agl < 65 && ps.vsi < -350;
    document.getElementById('terrain-warning').classList.toggle('hidden', !showWarn);

    // Bottom Chase Bar
    const fuelPct = Math.round(ps.fuel);
    const hullPct = Math.round(ps.hull);
    const rpmPct = Math.round(25 + ps.throttle * 75);
    const egt = Math.round(420 + ps.throttle * 260);
    const grade = hullPct >= 90 && missionState.elapsed < 120 ? 'GRADE A' : hullPct >= 70 ? 'GRADE B' : 'GRADE C';

    document.getElementById('hud-fuel').textContent = `${fuelPct}%`;
    document.getElementById('hud-fuel-bar').style.width = `${fuelPct}%`;
    document.getElementById('hud-egt').textContent = `${egt}°C`;
    document.getElementById('hud-rpm').textContent = `${rpmPct}%`;
    document.getElementById('hud-hull').textContent = `${hullPct}%`;
    document.getElementById('hud-grade').textContent = grade;

    const totalSteps = Math.max(1, gates.length + 1);
    const progPct = isCombatMode ? 100 : Math.round(((passedCount + (missionState.landed ? 1 : 0)) / totalSteps) * 100);
    document.getElementById('hud-mission-bar').style.width = `${progPct}%`;
    document.getElementById('hud-mini-gate').textContent = isCombatMode
      ? `WAVE ${window.AeroCombat.state.wave} · ${mode.short}`
      : `GATE ${passedCount}/${gates.length} · ${mode.short}`;

    const rwyDistM = M.dist(ps.pos, { x: rwy.x, y: rwy.elev, z: rwy.zCenter });
    document.getElementById('hud-rwy-meta').textContent = `${(rwyDistM / 1852).toFixed(2)} NM · 800M · EL 36FT`;

    drawADI('mini-adi-canvas', ps.pitch, ps.roll);

    // Buttons state
    document.getElementById('btn-gear').classList.toggle('active', ps.gearDown);
    const flapBtn = document.getElementById('btn-flap');
    flapBtn.textContent = `FLAP ${ps.flapDeg}° `;
    const kbd = document.createElement('kbd');
    kbd.textContent = 'F';
    flapBtn.appendChild(kbd);
    flapBtn.classList.toggle('active', ps.flapDeg > 0);
    document.getElementById('btn-brk').classList.toggle('active', ps.brake);
    document.getElementById('btn-light').classList.toggle('active', ps.lightsOn);

    const camBtn = document.getElementById('btn-cam');
    camBtn.innerHTML = `${ps.cameraMode === 'chase' ? 'CHASE' : 'CKPT'} <kbd>C</kbd>`;

    // Cockpit vs Chase visibility
    const isCockpit = ps.cameraMode === 'cockpit';
    document.getElementById('cockpit-frame').classList.toggle('hidden', !isCockpit);
    document.getElementById('hud-bottom-chase').classList.toggle('hidden', isCockpit);
    document.getElementById('hud-bottom-cockpit').classList.toggle('hidden', !isCockpit);

    if (isCockpit) {
      document.getElementById('mfd-hdg').textContent = `HDG ${String(hdgDeg).padStart(3, '0')}°`;
      document.getElementById('mfd-wind').textContent = map.wind;
      document.getElementById('mfd-gforce').textContent = `${ps.gForce.toFixed(1)} G`;
      document.getElementById('mfd-aoa').textContent = `${ps.aoa.toFixed(1)}°`;
      document.getElementById('mfd-trim').textContent = `+${ps.trim.toFixed(1)}°`;
      drawRadar('mfd-radar-canvas', ps, gates, rwy);

      const bnk = Math.round(M.radToDeg(ps.roll));
      const pit = Math.round(M.radToDeg(ps.pitch));
      document.getElementById('mfd-att').textContent = `BNK ${bnk >= 0 ? '+' : ''}${bnk}° · PIT ${pit >= 0 ? '+' : ''}${pit}°`;
      drawADI('mfd-adi-canvas', ps.pitch, ps.roll);

      document.getElementById('mfd-thr').textContent = `${thrPct}%`;
      document.getElementById('mfd-thr-bar').style.width = `${thrPct}%`;
      document.getElementById('mfd-fuel').textContent = `${fuelPct}%`;
      document.getElementById('mfd-fuel-bar').style.width = `${fuelPct}%`;
      document.getElementById('mfd-hull').textContent = `${hullPct}%`;
      document.getElementById('mfd-hull-bar').style.width = `${hullPct}%`;
      document.getElementById('mfd-egt').textContent = `${egt}°C`;
      document.getElementById('mfd-rpm').textContent = `${rpmPct}%`;

      document.getElementById('mfd-pill-gear').classList.toggle('on', ps.gearDown);
      document.getElementById('mfd-pill-gear').textContent = ps.gearDown ? 'GEAR DN' : 'GEAR UP';
      document.getElementById('mfd-pill-flap').classList.toggle('on', ps.flapDeg > 0);
      document.getElementById('mfd-pill-flap').textContent = `FLP ${ps.flapDeg}°`;
      document.getElementById('mfd-pill-brk').classList.toggle('on', ps.brake);
      document.getElementById('mfd-pill-light').classList.toggle('on', ps.lightsOn);
    }
  }

  return { update };
})();
