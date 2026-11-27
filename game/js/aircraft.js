// AEROVANT — Futuristic 3D Jet Models & Flight Physics

window.AeroPlane = (() => {
  const M = window.AeroMath;

  const meshCache = {};
  let gearMesh = null;
  let flameMesh = null;
  let trailMesh = null;

  function buildJetParts(planeData) {
    if (meshCache[planeData.id]) return meshCache[planeData.id];

    const body = window.AeroGL.MeshBuilder();
    const canopy = window.AeroGL.MeshBuilder();
    const glow = window.AeroGL.MeshBuilder();

    const { primary, accent, glow: glowCol, canopy: canopyCol } = planeData.colors;

    if (planeData.type === 'veltrix') {
      // 1. VELTRIX: Sleek metallic silver-grey interceptor, large bubble canopy, twin orange-afterburner engines
      body.addLoftedProfile([
        { z: -5.8, cy: -0.05, rx: 0.02, ry: 0.02, col: accent },
        { z: -4.8, cy: -0.02, rx: 0.28, ry: 0.24, col: primary },
        { z: -3.2, cy: 0.02,  rx: 0.62, ry: 0.48, col: primary },
        { z: -1.0, cy: 0.05,  rx: 0.88, ry: 0.58, col: primary },
        { z:  1.8, cy: 0.02,  rx: 0.92, ry: 0.56, col: primary },
        { z:  3.8, cy: 0.00,  rx: 0.78, ry: 0.46, col: accent },
        { z:  4.5, cy: 0.00,  rx: 0.55, ry: 0.36, col: accent },
      ], 18);

      // Sleek dark panel lines / intakes
      body.addAirfoilWing(-0.68, -0.04, -1.6, 2.6, 0.32, -1.05, -0.04, -0.2, 2.0, 0.22, accent);
      body.addAirfoilWing( 0.68, -0.04, -1.6, 2.6, 0.32,  1.05, -0.04, -0.2, 2.0, 0.22, accent);

      // Swept Interceptor Main Wings (sharp airfoil)
      body.addAirfoilWing(-0.82, 0.0, 0.6, 3.3, 0.22, -5.8, -0.08, 2.5, 0.95, 0.08, primary);
      body.addAirfoilWing( 0.82, 0.0, 0.6, 3.3, 0.22,  5.8, -0.08, 2.5, 0.95, 0.08, primary);

      // Dark metallic wingtip rails & panel trim
      body.addBox(-5.85, -0.08, 2.5, 0.14, 0.12, 1.35, accent);
      body.addBox( 5.85, -0.08, 2.5, 0.14, 0.12, 1.35, accent);

      // Horizontal Tailplanes
      body.addAirfoilWing(-0.65, 0.02, 3.5, 1.6, 0.12, -2.7, 0.02, 4.4, 0.55, 0.06, primary);
      body.addAirfoilWing( 0.65, 0.02, 3.5, 1.6, 0.12,  2.7, 0.02, 4.4, 0.55, 0.06, primary);

      // Twin Canted Vertical Stabilizers
      body.addAirfoilWing(-0.55, 0.35, 3.4, 1.7, 0.10, -1.25, 1.85, 4.3, 0.65, 0.05, accent, true);
      body.addAirfoilWing( 0.55, 0.35, 3.4, 1.7, 0.10,  1.25, 1.85, 4.3, 0.65, 0.05, accent, true);

      // Twin Engine Pods & Nozzles + Pitot Nose Probe
      body.addCylinder(0, -0.05, -6.1, 0.015, 0.03, 0.75, 8, accent, 'z');
      for (const sx of [-0.46, 0.46]) {
        body.addCylinder(sx, -0.02, 4.35, 0.34, 0.40, 1.1, 14, accent, 'z');
        body.addBox(sx * 1.45, -0.06, -1.5, 0.38, 0.26, 0.9, [0.04, 0.05, 0.06]); // intake cavity
        glow.addCylinder(sx, -0.02, 4.88, 0.26, 0.28, 0.15, 12, glowCol, 'z');
      }

      // Large Glossy Bubble Canopy
      canopy.addLoftedProfile([
        { z: -3.2, cy: 0.32, rx: 0.18, ry: 0.12, col: canopyCol },
        { z: -2.2, cy: 0.52, rx: 0.44, ry: 0.36, col: canopyCol },
        { z: -1.0, cy: 0.56, rx: 0.46, ry: 0.38, col: canopyCol },
        { z:  0.3, cy: 0.42, rx: 0.32, ry: 0.24, col: canopyCol },
        { z:  1.1, cy: 0.22, rx: 0.12, ry: 0.08, col: canopyCol },
      ], 14);

      // Glowing accent strips & wingtip lights
      glow.addBox(-5.9, -0.08, 2.5, 0.10, 0.10, 0.45, glowCol);
      glow.addBox( 5.9, -0.08, 2.5, 0.10, 0.10, 0.45, glowCol);
      glow.addBox(0, 0.30, 1.9, 0.08, 0.06, 1.8, glowCol);

    } else if (planeData.type === 'skyrion') {
      // 2. SKYRION: Dark futuristic star-fighter with glowing cyan-blue accent strips & twin blue-flame engines
      body.addLoftedProfile([
        { z: -6.2, cy: -0.06, rx: 0.03, ry: 0.02, col: accent },
        { z: -4.9, cy: -0.03, rx: 0.36, ry: 0.22, col: primary },
        { z: -2.8, cy: 0.02,  rx: 0.85, ry: 0.42, col: primary },
        { z:  0.0, cy: 0.04,  rx: 1.15, ry: 0.50, col: primary },
        { z:  2.8, cy: 0.02,  rx: 1.05, ry: 0.46, col: primary },
        { z:  4.4, cy: 0.00,  rx: 0.92, ry: 0.42, col: accent },
      ], 18);

      // Swept Forward Canards + Main Aggressive Swept Wings
      body.addAirfoilWing(-0.75, 0.05, -2.5, 1.2, 0.10, -2.2, 0.12, -1.8, 0.45, 0.05, primary);
      body.addAirfoilWing( 0.75, 0.05, -2.5, 1.2, 0.10,  2.2, 0.12, -1.8, 0.45, 0.05, primary);

      body.addAirfoilWing(-1.05, 0.0, 0.5, 3.8, 0.24, -6.1, -0.15, 2.9, 0.90, 0.08, primary);
      body.addAirfoilWing( 1.05, 0.0, 0.5, 3.8, 0.24,  6.1, -0.15, 2.9, 0.90, 0.08, primary);

      // Outward Canted Twin Fins
      body.addAirfoilWing(-0.78, 0.35, 2.8, 2.0, 0.12, -1.65, 1.75, 4.2, 0.75, 0.06, accent, true);
      body.addAirfoilWing( 0.78, 0.35, 2.8, 2.0, 0.12,  1.65, 1.75, 4.2, 0.75, 0.06, accent, true);

      // Large Twin Thruster Housings
      for (const sx of [-0.56, 0.56]) {
        body.addCylinder(sx, 0.0, 4.2, 0.42, 0.48, 1.3, 14, accent, 'z');
        glow.addCylinder(sx, 0.0, 4.82, 0.34, 0.36, 0.16, 12, glowCol, 'z');
      }

      // Sleek Dark Canopy
      canopy.addLoftedProfile([
        { z: -3.5, cy: 0.24, rx: 0.16, ry: 0.10, col: canopyCol },
        { z: -2.2, cy: 0.42, rx: 0.42, ry: 0.28, col: canopyCol },
        { z: -0.8, cy: 0.44, rx: 0.44, ry: 0.28, col: canopyCol },
        { z:  0.6, cy: 0.30, rx: 0.28, ry: 0.18, col: canopyCol },
      ], 14);

      // Glowing Cyan-Blue Sci-Fi Strips (spine, intakes, wings)
      glow.addBox(0, 0.36, 1.8, 0.10, 0.06, 2.6, glowCol);
      glow.addBox(-3.2, 0.08, 1.35, 3.6, 0.05, 0.08, glowCol, 0, 0.45, 0);
      glow.addBox( 3.2, 0.08, 1.35, 3.6, 0.05, 0.08, glowCol, 0, -0.45, 0);
      glow.addBox(-6.05, -0.15, 2.9, 0.14, 0.08, 0.85, glowCol);
      glow.addBox( 6.05, -0.15, 2.9, 0.14, 0.08, 0.85, glowCol);

    } else {
      // 3. STRATOVEX: Dark stealth delta-wing jet with sharp silhouette & glowing crimson-red accents
      body.addLoftedProfile([
        { z: -6.0, cy: -0.04, rx: 0.02, ry: 0.02, col: accent },
        { z: -4.5, cy: 0.00,  rx: 0.44, ry: 0.20, col: primary },
        { z: -2.2, cy: 0.02,  rx: 0.96, ry: 0.36, col: primary },
        { z:  0.5, cy: 0.04,  rx: 1.28, ry: 0.44, col: primary },
        { z:  3.2, cy: 0.02,  rx: 1.10, ry: 0.38, col: primary },
        { z:  4.5, cy: 0.00,  rx: 0.85, ry: 0.30, col: accent },
      ], 16);

      // Sharp Blended Stealth Delta Wings
      body.addAirfoilWing(-0.95, 0.0, -0.6, 4.8, 0.22, -6.2, -0.04, 3.3, 1.25, 0.07, primary);
      body.addAirfoilWing( 0.95, 0.0, -0.6, 4.8, 0.22,  6.2, -0.04, 3.3, 1.25, 0.07, primary);

      // Stealth V-Tail Stabilizers
      body.addAirfoilWing(-0.62, 0.25, 2.9, 1.8, 0.10, -1.75, 1.45, 4.2, 0.70, 0.05, accent, true);
      body.addAirfoilWing( 0.62, 0.25, 2.9, 1.8, 0.10,  1.75, 1.45, 4.2, 0.70, 0.05, accent, true);

      // Twin Stealth Exhausts
      for (const sx of [-0.48, 0.48]) {
        body.addBox(sx, 0.0, 4.35, 0.68, 0.42, 0.95, accent);
        glow.addBox(sx, 0.0, 4.82, 0.52, 0.26, 0.14, glowCol);
      }

      // Low-profile Stealth Canopy
      canopy.addLoftedProfile([
        { z: -3.4, cy: 0.22, rx: 0.16, ry: 0.09, col: canopyCol },
        { z: -2.1, cy: 0.36, rx: 0.40, ry: 0.24, col: canopyCol },
        { z: -0.7, cy: 0.38, rx: 0.42, ry: 0.24, col: canopyCol },
        { z:  0.6, cy: 0.26, rx: 0.26, ry: 0.15, col: canopyCol },
      ], 14);

      // Glowing Red Stealth Trim Strips
      glow.addBox(0, 0.34, 1.8, 0.09, 0.05, 2.4, glowCol);
      glow.addBox(-3.4, 0.06, 0.85, 4.4, 0.05, 0.08, glowCol, 0, 0.62, 0);
      glow.addBox( 3.4, 0.06, 0.85, 4.4, 0.05, 0.08, glowCol, 0, -0.62, 0);
      glow.addBox(-6.15, -0.04, 3.3, 0.12, 0.07, 0.9, glowCol);
      glow.addBox( 6.15, -0.04, 3.3, 0.12, 0.07, 0.9, glowCol);
    }

    const parts = {
      body: body.build(),
      canopy: canopy.build(),
      glow: glow.build(),
    };
    meshCache[planeData.id] = parts;
    return parts;
  }

  function ensureSharedMeshes() {
    if (!gearMesh) {
      const gb = window.AeroGL.MeshBuilder();
      gb.addCylinder(-1.1, -0.85, 0.2, 0.06, 0.06, 1.1, 8, [0.32, 0.34, 0.38]);
      gb.addCylinder( 1.1, -0.85, 0.2, 0.06, 0.06, 1.1, 8, [0.32, 0.34, 0.38]);
      gb.addCylinder( 0.0, -0.85, -2.8, 0.05, 0.05, 1.1, 8, [0.32, 0.34, 0.38]);
      // Gear bay doors
      gb.addBox(-1.25, -0.45, 0.2, 0.06, 0.55, 0.75, [0.22, 0.24, 0.28]);
      gb.addBox( 1.25, -0.45, 0.2, 0.06, 0.55, 0.75, [0.22, 0.24, 0.28]);
      // Dual main wheels + nose wheel
      gb.addSphere(-1.16, -1.35, 0.2, 0.22, 8, [0.08, 0.08, 0.10]);
      gb.addSphere(-1.04, -1.35, 0.2, 0.22, 8, [0.08, 0.08, 0.10]);
      gb.addSphere( 1.04, -1.35, 0.2, 0.22, 8, [0.08, 0.08, 0.10]);
      gb.addSphere( 1.16, -1.35, 0.2, 0.22, 8, [0.08, 0.08, 0.10]);
      gb.addSphere( 0.0, -1.35, -2.8, 0.19, 8, [0.08, 0.08, 0.10]);
      gearMesh = gb.build();
    }
    if (!flameMesh) {
      const fb = window.AeroGL.MeshBuilder();
      fb.addCone(0, 0, 1.1, 0.34, 2.3, 12, [1, 1, 1], 'z');
      flameMesh = fb.build();
    }
    if (!trailMesh) {
      const tb = window.AeroGL.MeshBuilder();
      tb.addBox(0, 0, 0, 0.10, 0.04, 1.0, [0.95, 0.97, 1.0]);
      trailMesh = tb.build();
    }
  }

  const state = {
    plane: null,
    pos: { x: 0, y: 12.6, z: 280 },
    yaw: 0,
    pitch: 0,
    roll: 0,
    speedKts: 0,
    throttle: 0.74,
    gearDown: true,
    flapDeg: 0,
    brake: false,
    lightsOn: true,
    cameraMode: 'chase',
    fuel: 100,
    hull: 100,
    gForce: 1.0,
    aoa: 0,
    trim: 1.0,
    vsi: 0,
    agl: 0,
    onGround: true,
    hasTakenOff: false,
    destroyed: false,
    trailPoints: [],
    explosionParticles: [],
  };

  function reset(planeData, startOnRunway = true) {
    ensureSharedMeshes();
    state.plane = planeData;
    const rwyElev = window.AeroWorld.RUNWAY.elev;
    if (startOnRunway) {
      state.pos = { x: 0, y: rwyElev + 1.4, z: 280 };
      state.speedKts = 0;
      state.throttle = 0.74;
      state.gearDown = true;
      state.onGround = true;
      state.hasTakenOff = false;
    } else {
      state.pos = { x: 0, y: 130, z: 100 };
      state.speedKts = planeData.physics.cruiseSpeedKts;
      state.throttle = 0.74;
      state.gearDown = false;
      state.onGround = false;
      state.hasTakenOff = true;
    }
    state.yaw = 0;
    state.pitch = 0;
    state.roll = 0;
    state.flapDeg = 0;
    state.brake = false;
    state.lightsOn = true;
    state.fuel = 100;
    state.hull = 100;
    state.gForce = 1.0;
    state.aoa = 0;
    state.vsi = 0;
    state.destroyed = false;
    state.trailPoints = [];
    state.explosionParticles = [];
  }

  function update(dt, input) {
    const p = state.plane.physics;

    if (input.thrUp) state.throttle = M.clamp(state.throttle + 0.45 * dt, 0, 1);
    if (input.thrDown) state.throttle = M.clamp(state.throttle - 0.45 * dt, 0, 1);

    if (state.fuel > 0) {
      state.fuel = Math.max(0, state.fuel - (0.04 + state.throttle * 0.14) * dt);
    }
    const effectiveThr = state.fuel > 0 ? state.throttle : 0;

    const flapDrag = (state.flapDeg / 30) * 24;
    const flapLiftBonus = (state.flapDeg / 30) * 12; // flaps lower stall speed & aid lift
    const gearDrag = state.gearDown ? 11 : 0;
    const inducedDrag = Math.abs(Math.sin(state.roll)) * 18; // turning bleeds airspeed
    const targetSpeed = Math.max(0, effectiveThr * p.maxSpeedKts - flapDrag - gearDrag - inducedDrag);

    const accel = state.brake
      ? -68
      : (targetSpeed > state.speedKts ? p.accelRate * (0.4 + effectiveThr * 0.8) : -16);

    state.speedKts = M.clamp(state.speedKts + accel * dt, 0, p.maxSpeedKts + 25);
    if (state.brake && state.onGround) {
      state.speedKts = Math.max(0, state.speedKts - 48 * dt);
    }

    const effectiveStallKts = Math.max(36, p.stallSpeedKts - flapLiftBonus);
    const airAuthority = M.smoothstep(24, 90, state.speedKts);

    let pitchInput = 0;
    if (input.pitchUp) pitchInput += 1;
    if (input.pitchDown) pitchInput -= 1;

    let rollInput = 0;
    if (input.rollLeft) rollInput += 1;
    if (input.rollRight) rollInput -= 1;

    let yawInput = 0;
    if (input.yawLeft) yawInput += 1;
    if (input.yawRight) yawInput -= 1;

    if (state.onGround) {
      state.roll = M.lerp(state.roll, 0, 6 * dt);
      if (state.speedKts > effectiveStallKts * 0.92 && pitchInput > 0) {
        state.pitch = M.clamp(state.pitch + pitchInput * p.pitchRate * 0.72 * dt, -0.04, 0.36);
      } else {
        state.pitch = M.lerp(state.pitch, 0, 4 * dt);
      }
      state.yaw += (rollInput * 0.42 + yawInput * 0.58) * dt;
    } else {
      state.pitch = M.clamp(state.pitch + pitchInput * p.pitchRate * airAuthority * dt, -1.15, 1.15);
      state.roll = M.clamp(state.roll + rollInput * p.rollRate * airAuthority * dt, -1.45, 1.45);

      const bankTurn = Math.sin(state.roll) * (0.48 + p.yawRate * 0.35);
      state.yaw += (bankTurn + yawInput * p.yawRate) * airAuthority * dt;

      if (rollInput === 0) {
        state.roll = M.lerp(state.roll, 0, p.stabilityDamp * 0.45 * dt);
      }
      if (pitchInput === 0) {
        state.pitch = M.lerp(state.pitch, 0.015, p.stabilityDamp * 0.25 * dt);
      }

      // Subtle atmospheric wind/turbulence (countered by plane's stability stat)
      const turbScale = Math.max(0.08, 0.35 - p.stabilityDamp * 0.09);
      state.roll += Math.sin(performance.now() * 0.0023) * turbScale * dt;
    }

    const cy = Math.cos(state.yaw), sy = Math.sin(state.yaw);
    const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
    const fwd = { x: -sy * cp, y: sp, z: -cy * cp };

    const speedMs = state.speedKts * 0.62;
    const prevY = state.pos.y;

    state.pos.x += fwd.x * speedMs * dt;
    state.pos.y += fwd.y * speedMs * dt;
    state.pos.z += fwd.z * speedMs * dt;

    // Ground effect cushion near runway + realistic low-speed stall sink
    if (!state.onGround && state.agl < 25 && state.vsi < 0) {
      state.pos.y += (1 - state.agl / 25) * 1.8 * dt;
    }
    if (!state.onGround && state.speedKts < effectiveStallKts) {
      const stallFactor = 1 - state.speedKts / effectiveStallKts;
      state.pos.y -= stallFactor * 16 * dt;
      state.pitch = M.lerp(state.pitch, -0.32, 1.4 * dt);
    }

    const mapId = window.AeroWorld.currentMap.id;
    const groundY = window.AeroWorld.getTerrainHeight(state.pos.x, state.pos.z, mapId);
    const minY = groundY + (state.gearDown ? 1.4 : 0.7);
    state.agl = Math.max(0, (state.pos.y - groundY) * 3.28084);

    const onRunwayRect =
      Math.abs(state.pos.x) <= window.AeroWorld.RUNWAY.width * 0.5 + 4 &&
      state.pos.z >= window.AeroWorld.RUNWAY.zEnd - 15 &&
      state.pos.z <= window.AeroWorld.RUNWAY.zStart + 15;

    let crashEvent = false;
    let crashReason = '';

    const triggerCrash = (reason) => {
      crashEvent = true;
      crashReason = reason;
      state.destroyed = true;
      state.hull = 0;
      state.speedKts = 0;
      state.explosionParticles = [];
      for (let i = 0; i < 32; i++) {
        const a = Math.random() * Math.PI * 2;
        const elev = (Math.random() - 0.2) * Math.PI;
        const spd = 8 + Math.random() * 28;
        state.explosionParticles.push({
          x: state.pos.x,
          y: state.pos.y + 0.5,
          z: state.pos.z,
          vx: Math.cos(a) * Math.cos(elev) * spd,
          vy: Math.abs(Math.sin(elev)) * spd + 6,
          vz: Math.sin(a) * Math.cos(elev) * spd,
          scale: 0.6 + Math.random() * 1.8,
          isFire: i % 3 !== 0,
        });
      }
    };

    // 1. Water / Lava collision
    if (window.AeroWorld.currentMap.hasWater && state.pos.y <= 1.2) {
      triggerCrash(window.AeroWorld.currentMap.isLava
        ? 'Pesawat jatuh ke dalam lava panas dan hancur!'
        : 'Pesawat menabrak permukaan air dan hancur!');
    }

    // 2. Ground / Terrain / Runway collision
    if (!crashEvent && state.pos.y <= minY) {
      const impactVsi = ((state.pos.y - prevY) / Math.max(dt, 0.001)) * 3.28084 * 60;
      if (!state.onGround) {
        if (!state.gearDown) {
          triggerCrash('Pesawat mendarat tanpa roda pendaratan (GEAR) dan hancur!');
        } else if (!onRunwayRect && mapId !== 'orbit') {
          triggerCrash('Pesawat menabrak tanah di luar landasan pacu dan hancur!');
        } else if (impactVsi < -950 || Math.abs(state.roll) > 0.45) {
          triggerCrash('Pesawat menghantam landasan terlalu keras dan hancur!');
        } else if (impactVsi < -450) {
          state.hull = Math.max(0, state.hull - 15);
        }
      } else if (!onRunwayRect && mapId !== 'orbit' && state.speedKts > 22) {
        triggerCrash('Pesawat keluar dari landasan pacu dan menabrak medan!');
      }
      if (!crashEvent) {
        state.pos.y = minY;
        state.onGround = true;
        if (state.pitch < 0) state.pitch = 0;
      }
    } else if (!crashEvent && state.pos.y > minY + 1.5) {
      state.onGround = false;
      if (state.agl > 18) state.hasTakenOff = true;
    }

    // 3. Obstacle collisions (Tower, Hangar, Wind Turbines, Asteroids)
    if (!crashEvent) {
      const rwyY = window.AeroWorld.RUNWAY.elev;
      // Control Tower (48, -80) & Hangar (56, 30)
      if (Math.hypot(state.pos.x - 48, state.pos.z + 80) < 10 && state.pos.y < rwyY + 27) {
        triggerCrash('Pesawat menabrak Menara Kontrol dan hancur!');
      } else if (Math.hypot(state.pos.x - 56, state.pos.z - 30) < 20 && state.pos.y < rwyY + 15) {
        triggerCrash('Pesawat menabrak Hangar Bandara dan hancur!');
      }
      // Wind Turbines
      if (!crashEvent) {
        for (const t of window.AeroWorld.turbines) {
          if (Math.hypot(state.pos.x - t.x, state.pos.z - t.z) < 11 && state.pos.y < t.y + 12) {
            triggerCrash('Pesawat menabrak Turbin Angin dan hancur!');
            break;
          }
        }
      }
      // Space Asteroids
      if (!crashEvent && mapId === 'orbit') {
        for (const a of window.AeroWorld.asteroids) {
          if (M.dist(state.pos, a) < 15 * a.scale) {
            triggerCrash('Pesawat menabrak Asteroid di orbit dan hancur!');
            break;
          }
        }
      }
    }

    state.vsi = Math.round(((state.pos.y - prevY) / Math.max(dt, 0.001)) * 3.28084 * 60);
    state.gForce = M.clamp(1.0 + pitchInput * 1.4 * airAuthority + Math.abs(Math.sin(state.roll)) * 1.2, -1.5, 6.5);
    state.aoa = (state.pitch * 180 / Math.PI) * 0.25 - (state.vsi / 1500);

    if (state.speedKts > 115 && !state.onGround) {
      const right = { x: cy, y: 0, z: -sy };
      const span = 5.9;
      state.trailPoints.push({
        l: { x: state.pos.x - right.x * span, y: state.pos.y, z: state.pos.z - right.z * span },
        r: { x: state.pos.x + right.x * span, y: state.pos.y, z: state.pos.z + right.z * span },
        age: 0,
      });
      if (state.trailPoints.length > 26) state.trailPoints.shift();
    }
    for (const tp of state.trailPoints) tp.age += dt;

    return { crashEvent, crashReason, onRunwayRect };
  }

  function render(proj, view, camPos, time, isHangar = false) {
    if (!state.plane) return;
    const gl = window.AeroGL.gl;
    const progs = window.AeroGL.programs;
    const isNight = !isHangar && window.AeroWorld.currentMode && window.AeroWorld.currentMode.nightOverride;
    const lit = isHangar
      ? {
          skyHorizon: [0.36, 0.44, 0.58],
          sunDir: [0.55, 0.72, 0.45],
          sunColor: [1.0, 0.96, 0.90],
          groundAmb: [0.22, 0.24, 0.30],
          fogColor: [0.08, 0.10, 0.16],
          fogDensity: 0.00001,
        }
      : window.AeroWorld.getLighting(isNight);

    const drawLit = (mesh, modelMat, spec = 0.85, emissive = [0, 0, 0]) => {
      gl.useProgram(progs.lit);
      gl.uniformMatrix4fv(gl.getUniformLocation(progs.lit, 'uProj'), false, proj);
      gl.uniformMatrix4fv(gl.getUniformLocation(progs.lit, 'uView'), false, view);
      gl.uniformMatrix4fv(gl.getUniformLocation(progs.lit, 'uModel'), false, modelMat);
      gl.uniformMatrix3fv(gl.getUniformLocation(progs.lit, 'uNormalMat'), false, M.mat4NormalMatrix(modelMat));
      gl.uniform3fv(gl.getUniformLocation(progs.lit, 'uCamPos'), [camPos.x, camPos.y, camPos.z]);
      gl.uniform3fv(gl.getUniformLocation(progs.lit, 'uSunDir'), lit.sunDir);
      gl.uniform3fv(gl.getUniformLocation(progs.lit, 'uSunColor'), lit.sunColor);
      gl.uniform3fv(gl.getUniformLocation(progs.lit, 'uSkyColor'), lit.skyHorizon);
      gl.uniform3fv(gl.getUniformLocation(progs.lit, 'uGroundColor'), lit.groundAmb);
      gl.uniform3fv(gl.getUniformLocation(progs.lit, 'uFogColor'), lit.fogColor);
      gl.uniform1f(gl.getUniformLocation(progs.lit, 'uFogDensity'), lit.fogDensity);
      gl.uniform1f(gl.getUniformLocation(progs.lit, 'uSpecular'), spec);
      gl.uniform3fv(gl.getUniformLocation(progs.lit, 'uEmissive'), emissive);
      window.AeroGL.drawMesh(mesh);
    };

    const pos = isHangar ? { x: 0, y: 1.45, z: 0 } : state.pos;
    const rot = isHangar ? { yaw: time * 0.45, pitch: 0.06, roll: 0 } : { yaw: state.yaw, pitch: state.pitch, roll: state.roll };
    const planeMat = M.mat4FromTRS(pos, rot, { x: 1, y: 1, z: 1 });

    if (isHangar || (state.cameraMode === 'chase' && !state.destroyed)) {
      const parts = buildJetParts(state.plane);
      // Metallic body & wings
      drawLit(parts.body, planeMat, 0.88);
      // Glossy dark canopy
      drawLit(parts.canopy, planeMat, 1.0, [0.02, 0.04, 0.08]);

      if (state.gearDown || isHangar) {
        drawLit(gearMesh, planeMat, 0.35);
      }

      // Glowing accent strips & exhaust rings
      gl.useProgram(progs.glow);
      gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uProj'), false, proj);
      gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uView'), false, view);
      gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uModel'), false, planeMat);
      gl.uniform1f(gl.getUniformLocation(progs.glow, 'uUseOverride'), 0.0);
      gl.uniform1f(gl.getUniformLocation(progs.glow, 'uAlpha'), 0.96);
      window.AeroGL.drawMesh(parts.glow);

      // Twin Engine Afterburners
      if (state.throttle > 0.40 || isHangar) {
        const fScale = isHangar ? 0.85 : (0.55 + state.throttle * 1.05 + Math.sin(time * 42) * 0.09);
        const engineOffsets = state.plane.type === 'skyrion' ? [-0.56, 0.56] : [-0.46, 0.46];
        const fCol = state.plane.colors.flame;

        for (const sx of engineOffsets) {
          // Outer flame
          const fm = M.mat4Multiply(planeMat, M.mat4FromTRS({ x: sx, y: 0, z: 4.85 }, { yaw: 0, pitch: 0, roll: 0 }, { x: 1, y: 1, z: fScale }));
          gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uModel'), false, fm);
          gl.uniform3fv(gl.getUniformLocation(progs.glow, 'uColorOverride'), fCol);
          gl.uniform1f(gl.getUniformLocation(progs.glow, 'uUseOverride'), 1.0);
          gl.uniform1f(gl.getUniformLocation(progs.glow, 'uAlpha'), 0.78);
          window.AeroGL.drawMesh(flameMesh);

          // Bright white-hot inner core
          const fmCore = M.mat4Multiply(planeMat, M.mat4FromTRS({ x: sx, y: 0, z: 4.85 }, { yaw: 0, pitch: 0, roll: 0 }, { x: 0.55, y: 0.55, z: fScale * 0.65 }));
          gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uModel'), false, fmCore);
          gl.uniform3fv(gl.getUniformLocation(progs.glow, 'uColorOverride'), [1.0, 0.96, 0.90]);
          gl.uniform1f(gl.getUniformLocation(progs.glow, 'uAlpha'), 0.92);
          window.AeroGL.drawMesh(flameMesh);
        }
      }

      // Wingtip contrails
      if (!isHangar && state.trailPoints.length > 1) {
        gl.useProgram(progs.glow);
        gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uProj'), false, proj);
        gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uView'), false, view);
        gl.uniform3fv(gl.getUniformLocation(progs.glow, 'uColorOverride'), [0.92, 0.96, 1.0]);
        gl.uniform1f(gl.getUniformLocation(progs.glow, 'uUseOverride'), 1.0);
        for (const tp of state.trailPoints) {
          const alpha = Math.max(0, 0.45 - tp.age * 0.35);
          if (alpha <= 0.02) continue;
          gl.uniform1f(gl.getUniformLocation(progs.glow, 'uAlpha'), alpha);
          for (const side of [tp.l, tp.r]) {
            const tm = M.mat4FromTRS(side, { yaw: state.yaw, pitch: 0, roll: 0 }, { x: 1, y: 1, z: 3.5 });
            gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uModel'), false, tm);
            window.AeroGL.drawMesh(trailMesh);
          }
        }
      }
    }

    // Explosion & debris when destroyed
    if (!isHangar && state.destroyed && state.explosionParticles.length > 0) {
      gl.useProgram(progs.glow);
      gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uProj'), false, proj);
      gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uView'), false, view);
      gl.uniform1f(gl.getUniformLocation(progs.glow, 'uUseOverride'), 1.0);
      for (const ep of state.explosionParticles) {
        ep.x += ep.vx * 0.016;
        ep.y += ep.vy * 0.016;
        ep.z += ep.vz * 0.016;
        ep.vy -= 18 * 0.016;
        ep.scale = Math.max(0.15, ep.scale * 0.985);
        const em = M.mat4FromTRS({ x: ep.x, y: ep.y, z: ep.z }, { yaw: time * 3, pitch: time * 2, roll: 0 }, { x: ep.scale * 4, y: ep.scale * 4, z: ep.scale * 4 });
        gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uModel'), false, em);
        gl.uniform3fv(gl.getUniformLocation(progs.glow, 'uColorOverride'), ep.isFire ? [1.0, 0.42, 0.06] : [0.22, 0.22, 0.24]);
        gl.uniform1f(gl.getUniformLocation(progs.glow, 'uAlpha'), ep.isFire ? 0.90 : 0.85);
        window.AeroGL.drawMesh(trailMesh);
      }
    }
  }

  return {
    state,
    reset,
    update,
    render,
  };
})();
