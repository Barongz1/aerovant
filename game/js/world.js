// AEROVANT — Procedural 3D World Builder (5 Maps, Runway 27, PAPI, Gates, Props)

window.AeroWorld = (() => {
  const M = window.AeroMath;

  let currentMap = null;
  let currentMode = null;
  let terrainMesh = null;
  let waterMesh = null;
  let propsMesh = null;
  let runwayMesh = null;
  let ringMesh = null;
  let ringInnerMesh = null;
  let cloudMesh = null;
  let turbineBladeMesh = null;
  let spaceObjectsMesh = null;

  const turbines = [];
  const clouds = [];
  const asteroids = [];
  const particles = [];
  let particleBoxMesh = null;

  // Runway 27 sits along Z axis at X = 0, Z from -450 to +350 (800m long)
  // Plane spawns at Z = +280 facing -Z (Heading 270 / North-West visual alignment)
  const RUNWAY = {
    x: 0,
    zStart: 350,
    zEnd: -450,
    zCenter: -50,
    length: 800,
    width: 34,
    elev: 11, // ~36 FT
  };

  let gates = [];

  function getTerrainHeight(x, z, mapId) {
    if (mapId === 'orbit') {
      // Orbital deck & floating platforms; outside deck is deep void
      if (Math.abs(x) < 110 && z > -650 && z < 500) {
        return RUNWAY.elev;
      }
      return -200;
    }

    // Flatten runway & bay/approach corridor smoothly
    const rwyDistX = Math.max(0, Math.abs(x) - 42);
    const rwyDistZ = z < -520 ? (-520 - z) : (z > 420 ? (z - 420) : 0);
    const rwyDist = Math.hypot(rwyDistX, rwyDistZ);
    const rwyFlatten = M.smoothstep(0, 140, rwyDist);

    // Bay water channel in front of runway (Z between -1600 and -520, X near 0)
    const bayChannel = Math.exp(-Math.pow(x / 320, 2)) * M.smoothstep(-480, -780, z) * M.smoothstep(-2800, -1800, z);

    const n1 = M.fbm2D(x * 0.0012 + 3.1, z * 0.0012 - 1.7, 4);
    const n2 = M.fbm2D(x * 0.0038 - 5.2, z * 0.0038 + 2.4, 3);
    const radial = Math.hypot(x, z + 600);

    let h = RUNWAY.elev;

    if (mapId === 'nusantara') {
      // Coastal bay + lush rolling hills + distant mountains
      const hills = (n1 * 0.5 + 0.5) * 115 + n2 * 22;
      const mountainRing = M.smoothstep(900, 2600, radial) * (130 + n1 * 90);
      h = hills + mountainRing - bayChannel * 95;
    } else if (mapId === 'salju') {
      // Sharp alpine peaks + frozen valley lake
      const ridge = Math.pow(Math.abs(n1), 0.85) * 210 + Math.abs(n2) * 45;
      const mountainRing = M.smoothstep(750, 2500, radial) * 160;
      h = ridge + mountainRing - bayChannel * 85;
    } else if (mapId === 'kawah') {
      // Volcanic caldera rim + lava basin
      const caldera = Math.exp(-Math.pow((radial - 1350) / 420, 2)) * 220;
      const crags = Math.abs(n1) * 95 + n2 * 30;
      h = crags + caldera - bayChannel * 80;
    } else if (mapId === 'gurun') {
      // Flowing sand dunes + sandstone mesas + oasis depression
      const dunes = Math.sin(x * 0.009 + n1 * 3.0) * 18 + (n1 * 0.5 + 0.5) * 65;
      const mesa = n2 > 0.28 ? 75 * M.smoothstep(0.28, 0.45, n2) : 0;
      const oasis = Math.exp(-Math.pow((x - 180) / 220, 2) - Math.pow((z + 1050) / 220, 2)) * 60;
      h = dunes + mesa - oasis - bayChannel * 40;
    }

    return M.lerp(RUNWAY.elev, h, rwyFlatten);
  }

  function getTerrainColor(x, y, z, slope, mapId) {
    if (mapId === 'nusantara') {
      if (y < 2.8) return [0.88, 0.80, 0.52]; // sandy beach
      if (y < 65 && slope < 0.45) return [0.22 + M.noise2D(x*0.02, z*0.02)*0.1, 0.54, 0.18]; // lush green
      if (y < 140 && slope < 0.55) return [0.16, 0.40, 0.14]; // forest hill
      if (y > 165) return [0.82, 0.84, 0.88]; // distant misty peak
      return [0.42, 0.38, 0.34]; // rock
    }
    if (mapId === 'salju') {
      if (y < 3.0) return [0.55, 0.65, 0.72]; // icy shore
      if (slope > 0.52) return [0.34, 0.38, 0.44]; // exposed cliff
      return [0.90, 0.94, 0.98]; // snow
    }
    if (mapId === 'kawah') {
      if (y < 4.5) return [0.26, 0.08, 0.04]; // hot crust
      if (slope > 0.48) return [0.14, 0.12, 0.12]; // dark basalt
      return [0.22, 0.16, 0.14]; // volcanic ash
    }
    if (mapId === 'gurun') {
      const oasisDist = Math.hypot(x - 180, z + 1050);
      if (oasisDist < 240 && y < 12) return [0.22, 0.56, 0.24]; // oasis grass
      if (slope > 0.45) return [0.68, 0.36, 0.22]; // red sandstone
      return [0.90, 0.72, 0.40]; // golden sand
    }
    return [0.25, 0.28, 0.34];
  }

  function buildTerrain(mapId) {
    if (mapId === 'orbit') {
      // Build space station orbital deck
      const mb = window.AeroGL.MeshBuilder();
      mb.addBox(0, RUNWAY.elev - 4, -50, 96, 8, 980, [0.18, 0.21, 0.28]);
      mb.addBox(-56, RUNWAY.elev + 2, -50, 14, 14, 960, [0.25, 0.30, 0.40]);
      mb.addBox(56, RUNWAY.elev + 2, -50, 14, 14, 960, [0.25, 0.30, 0.40]);
      // Solar wings
      mb.addBox(-170, RUNWAY.elev - 2, -100, 190, 2, 70, [0.08, 0.22, 0.55]);
      mb.addBox(170, RUNWAY.elev - 2, -100, 190, 2, 70, [0.08, 0.22, 0.55]);
      return mb.build();
    }

    const size = 5600;
    const segs = 128;
    const step = size / segs;
    const half = size * 0.5;
    const zOffset = -700;

    const pos = [];
    const norm = [];
    const col = [];
    const idx = [];

    const heights = new Float32Array((segs + 1) * (segs + 1));
    for (let iz = 0; iz <= segs; iz++) {
      for (let ix = 0; ix <= segs; ix++) {
        const x = -half + ix * step;
        const z = -half + iz * step + zOffset;
        heights[iz * (segs + 1) + ix] = getTerrainHeight(x, z, mapId);
      }
    }

    for (let iz = 0; iz <= segs; iz++) {
      for (let ix = 0; ix <= segs; ix++) {
        const x = -half + ix * step;
        const z = -half + iz * step + zOffset;
        const y = heights[iz * (segs + 1) + ix];

        const hL = heights[iz * (segs + 1) + Math.max(0, ix - 1)];
        const hR = heights[iz * (segs + 1) + Math.min(segs, ix + 1)];
        const hD = heights[Math.max(0, iz - 1) * (segs + 1) + ix];
        const hU = heights[Math.min(segs, iz + 1) * (segs + 1) + ix];

        const n = M.normalize({ x: hL - hR, y: 2 * step, z: hD - hU });
        const slope = 1.0 - n.y;
        const c = getTerrainColor(x, y, z, slope, mapId);

        pos.push(x, y, z);
        norm.push(n.x, n.y, n.z);
        col.push(c[0], c[1], c[2]);
      }
    }

    for (let iz = 0; iz < segs; iz++) {
      for (let ix = 0; ix < segs; ix++) {
        const a = iz * (segs + 1) + ix;
        const b = a + 1;
        const c = a + (segs + 1);
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }

    return window.AeroGL.createMesh(pos, norm, col, idx);
  }

  function buildWater() {
    const size = 6400;
    const segs = 64;
    const step = size / segs;
    const half = size * 0.5;
    const pos = [];
    const idx = [];
    for (let iz = 0; iz <= segs; iz++) {
      for (let ix = 0; ix <= segs; ix++) {
        pos.push(-half + ix * step, 0.5, -half + iz * step - 700);
      }
    }
    for (let iz = 0; iz < segs; iz++) {
      for (let ix = 0; ix < segs; ix++) {
        const a = iz * (segs + 1) + ix;
        const b = a + 1;
        const c = a + (segs + 1);
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    return window.AeroGL.createMesh(pos, null, null, idx);
  }

  function buildRunway(mapId) {
    const mb = window.AeroGL.MeshBuilder();
    const y = RUNWAY.elev + 0.15;
    // Main asphalt strip
    mb.addBox(0, y - 0.1, RUNWAY.zCenter, RUNWAY.width, 0.3, RUNWAY.length, [0.15, 0.16, 0.18]);
    // Shoulders
    mb.addBox(-RUNWAY.width * 0.5 - 3, y - 0.12, RUNWAY.zCenter, 6, 0.25, RUNWAY.length + 10, [0.28, 0.30, 0.26]);
    mb.addBox(RUNWAY.width * 0.5 + 3, y - 0.12, RUNWAY.zCenter, 6, 0.25, RUNWAY.length + 10, [0.28, 0.30, 0.26]);

    // White centerline dashes
    for (let z = RUNWAY.zEnd + 35; z < RUNWAY.zStart - 35; z += 28) {
      mb.addBox(0, y + 0.08, z, 1.0, 0.06, 14, [0.95, 0.95, 0.95]);
    }
    // Threshold piano keys at both ends
    for (let x = -12; x <= 12; x += 4) {
      mb.addBox(x, y + 0.08, RUNWAY.zStart - 16, 1.8, 0.06, 16, [0.95, 0.95, 0.95]);
      mb.addBox(x, y + 0.08, RUNWAY.zEnd + 16, 1.8, 0.06, 16, [0.95, 0.95, 0.95]);
    }

    // Control tower & hangar building beside runway
    const towerX = 48;
    const towerZ = -80;
    mb.addBox(towerX, y + 10, towerZ, 10, 20, 10, [0.78, 0.80, 0.84]);
    mb.addBox(towerX, y + 22, towerZ, 14, 4.5, 14, [0.18, 0.36, 0.52]); // glass cab
    mb.addBox(towerX, y + 25, towerZ, 15, 1.2, 15, [0.85, 0.20, 0.18]); // roof
    // Hangar & Apron/Taxiway
    mb.addBox(34, y - 0.12, 30, 38, 0.25, 110, [0.18, 0.19, 0.22]); // apron
    mb.addBox(22, y - 0.12, -160, 14, 0.25, 220, [0.18, 0.19, 0.22]); // taxiway
    mb.addBox(56, y + 6, 30, 28, 12, 36, [0.65, 0.68, 0.72]);
    mb.addBox(56, y + 12.5, 30, 30, 2, 38, [0.80, 0.28, 0.16]);

    // Touchdown zone markings & Approach Lighting System (ALS) gantries
    for (const tz of [RUNWAY.zEnd + 65, RUNWAY.zEnd + 115, RUNWAY.zStart - 65, RUNWAY.zStart - 115]) {
      mb.addBox(-7, y + 0.08, tz, 3.2, 0.06, 20, [0.92, 0.92, 0.92]);
      mb.addBox( 7, y + 0.08, tz, 3.2, 0.06, 20, [0.92, 0.92, 0.92]);
    }
    for (let i = 1; i <= 5; i++) {
      const az = RUNWAY.zEnd - i * 32;
      mb.addBox(0, y + 0.6, az, 12, 0.4, 0.8, [0.35, 0.38, 0.42]);
    }

    // Road leading away from airport
    if (mapId !== 'orbit') {
      for (let i = 0; i < 18; i++) {
        const rx = 85 + i * 32;
        const rz = -120 - i * 18;
        const ry = getTerrainHeight(rx, rz, mapId) + 0.35;
        mb.addBox(rx, ry, rz, 10, 0.4, 38, [0.18, 0.19, 0.21], 0, -0.52, 0);
      }
    }

    return mb.build();
  }

  function buildProps(mapId) {
    const mb = window.AeroGL.MeshBuilder();
    turbines.length = 0;

    if (mapId === 'orbit') {
      // Space station antennas & docking pylons
      for (let z = -380; z <= 300; z += 170) {
        mb.addCylinder(-42, RUNWAY.elev + 12, z, 1.2, 1.8, 22, 8, [0.7, 0.75, 0.82]);
        mb.addCylinder(42, RUNWAY.elev + 12, z, 1.2, 1.8, 22, 8, [0.7, 0.75, 0.82]);
      }
      return mb.build();
    }

    // Trees, houses, rocks
    for (let i = 0; i < 420; i++) {
      const ang = M.hash2(i, 1.3) * Math.PI * 2;
      const rad = 160 + M.hash2(i, 2.7) * 2100;
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad - 700;

      // Keep clear of runway
      if (Math.abs(x) < 95 && z > -550 && z < 450) continue;

      const y = getTerrainHeight(x, z, mapId);
      if (y < 4.5) continue; // don't put trees underwater/lava

      if (mapId === 'nusantara' || mapId === 'salju') {
        // Pine / Spruce tree
        const s = 0.8 + M.hash2(i, 4.1) * 0.9;
        mb.addCylinder(x, y + 3 * s, z, 0.6 * s, 0.9 * s, 6 * s, 6, [0.36, 0.24, 0.14]);
        const leafCol = mapId === 'salju' ? [0.14, 0.30, 0.22] : [0.10, 0.36, 0.12];
        mb.addCone(x, y + 9 * s, z, 4.2 * s, 10 * s, 7, leafCol);
        mb.addCone(x, y + 14 * s, z, 3.1 * s, 8 * s, 7, mapId === 'salju' ? [0.85, 0.92, 0.96] : [0.12, 0.42, 0.15]);
      } else if (mapId === 'gurun') {
        const oasisDist = Math.hypot(x - 180, z + 1050);
        if (oasisDist < 230) {
          // Palm tree near oasis
          mb.addCylinder(x, y + 5, z, 0.5, 0.8, 10, 6, [0.46, 0.32, 0.18]);
          mb.addCone(x, y + 10.5, z, 4.5, 3, 7, [0.18, 0.55, 0.18]);
        } else if (i % 4 === 0) {
          // Desert rock formation
          const s = 2 + M.hash2(i, 5.5) * 4;
          mb.addBox(x, y + s * 0.5, z, s * 1.6, s, s * 1.4, [0.68, 0.38, 0.22], 0, ang, 0);
        }
      } else if (mapId === 'kawah') {
        if (i % 3 === 0) {
          // Jagged volcanic basalt spire
          const s = 3 + M.hash2(i, 6.2) * 8;
          mb.addCone(x, y + s, z, s * 0.6, s * 2, 5, [0.16, 0.14, 0.14]);
        }
      }

      // Coastal houses in Nusantara
      if (mapId === 'nusantara' && i % 14 === 0 && y < 70) {
        mb.addBox(x + 12, y + 3.5, z, 9, 7, 11, [0.92, 0.88, 0.82]);
        mb.addCone(x + 12, y + 9, z, 7.5, 4.5, 4, [0.76, 0.26, 0.18]);
      }
    }

    // Wind turbines on hills in Nusantara & Salju
    if (mapId === 'nusantara' || mapId === 'salju') {
      const turbCoords = [[-360, -320], [-440, -480], [420, -280], [520, -450], [-280, -1450], [340, -1550]];
      for (const [tx, tz] of turbCoords) {
        const ty = getTerrainHeight(tx, tz, mapId);
        mb.addCylinder(tx, ty + 24, tz, 1.2, 2.0, 48, 8, [0.92, 0.94, 0.96]);
        turbines.push({ x: tx, y: ty + 48, z: tz, phase: tx * 0.1 });
      }
    }

    return mb.build();
  }

  function buildTurbineBlades() {
    const mb = window.AeroGL.MeshBuilder();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const bx = Math.cos(a) * 10;
      const by = Math.sin(a) * 10;
      mb.addBox(bx, by, 0, 20, 1.1, 0.4, [0.95, 0.95, 0.97], 0, 0, a);
    }
    mb.addSphere(0, 0, 0, 1.8, 8, [0.90, 0.22, 0.18]);
    return mb.build();
  }

  function buildClouds(mapId) {
    clouds.length = 0;
    if (mapId === 'orbit') return null;

    const mb = window.AeroGL.MeshBuilder();
    const col = mapId === 'kawah' ? [0.35, 0.22, 0.18] : [0.96, 0.96, 0.98];
    mb.addSphere(0, 0, 0, 22, 8, col);
    mb.addSphere(18, -3, 6, 16, 8, col);
    mb.addSphere(-18, -4, -4, 17, 8, col);
    mb.addSphere(6, 5, -10, 15, 8, col);

    for (let i = 0; i < 28; i++) {
      clouds.push({
        x: (M.hash2(i, 9.1) - 0.5) * 4600,
        y: 260 + M.hash2(i, 8.2) * 240,
        z: -2400 + M.hash2(i, 7.3) * 3200,
        sx: 1.5 + M.hash2(i, 6.4) * 2.5,
        sy: 0.6 + M.hash2(i, 5.5) * 0.6,
        sz: 1.2 + M.hash2(i, 4.6) * 2.0,
        speed: 3 + M.hash2(i, 3.7) * 5,
      });
    }
    return mb.build();
  }

  function buildSpaceObjects(mapId) {
    asteroids.length = 0;
    if (mapId !== 'orbit') return null;

    const mb = window.AeroGL.MeshBuilder();
    // Large planet in background
    mb.addSphere(-900, 420, -2400, 460, 20, [0.18, 0.44, 0.85]);
    // Moon
    mb.addSphere(750, 520, -2100, 130, 14, [0.76, 0.74, 0.70]);
    const bigBodies = mb.build();

    // Asteroids
    const amb = window.AeroGL.MeshBuilder();
    amb.addSphere(0, 0, 0, 14, 7, [0.46, 0.44, 0.42]);
    amb.addBox(8, 3, -4, 12, 9, 11, [0.38, 0.36, 0.35], 0.4, 0.8, 0.2);
    const astMesh = amb.build();

    for (let i = 0; i < 45; i++) {
      asteroids.push({
        x: (M.hash2(i, 11.1) - 0.5) * 2600,
        y: 40 + M.hash2(i, 12.2) * 380,
        z: -2200 + M.hash2(i, 13.3) * 2600,
        scale: 0.6 + M.hash2(i, 14.4) * 1.8,
        rotY: M.hash2(i, 15.5) * Math.PI * 2,
        spin: (M.hash2(i, 16.6) - 0.5) * 0.5,
      });
    }

    return { bigBodies, astMesh };
  }

  function buildGateRing() {
    const mb = window.AeroGL.MeshBuilder();
    mb.addTorus(0, 0, 0, 32, 2.4, 32, 12, [1.0, 0.52, 0.08]);
    const outer = mb.build();

    const imb = window.AeroGL.MeshBuilder();
    imb.addTorus(0, 0, 0, 29.2, 0.65, 32, 8, [1.0, 0.85, 0.35]);
    const inner = imb.build();

    return { outer, inner };
  }

  function setupGates() {
    // 5 gates forming a scenic loop over the bay/mountains and lining back up with RWY 27!
    gates = [
      { id: 1, name: 'GATE 1', x: 0,    y: 120, z: -620,  yaw: 0,     passed: false },
      { id: 2, name: 'GATE 2', x: -240, y: 155, z: -1150, yaw: 0.38,  passed: false },
      { id: 3, name: 'GATE 3', x: -520, y: 175, z: -1680, yaw: 0.72,  passed: false },
      { id: 4, name: 'GATE 4', x: -220, y: 145, z: -2150, yaw: -0.42, passed: false },
      { id: 5, name: 'GATE 5', x: 0,    y: 95,  z: -1150, yaw: 0,     passed: false },
    ];
    // Note: Gate 5 aligns the player straight onto final approach for RWY 27 (from Z=-1150 flying +Z? Wait!)
    // Let's check: Plane takes off from Z=+280 flying toward -Z.
    // Wait: If plane flies -Z for Gate 1..4, then turns around at Z=-2150 to fly +Z back to RWY 27 (from Z=-450 to +350),
    // let's make Gate 5 at Z=-900 facing +Z (heading toward runway) so the player does a sweeping U-turn!
    // Even better: let's make Gate 1 (-500), Gate 2 (-1050, X=-260), Gate 3 (-1550, X=-620), Gate 4 (-1350, X=-1200 -> turning back), Gate 5 (-850, X=0 -> aligned with RWY 27 approaching from -Z toward +Z!).
    // Wait: in Screenshot 1, the runway is straight ahead THROUGH Gate 1 & Gate 2!
    // Let's make sure on takeoff or approach, the visual is super clear:
    // Takeoff from RWY 27 (Z=+280 -> -Z), Gate 1 at (0, 110, -520), Gate 2 at (-160, 145, -1080),
    // Gate 3 at (-480, 165, -1520), Gate 4 at (-520, 150, -980), Gate 5 at (0, 90, -820) facing +Z toward RWY 27!
    if (currentMode && currentMode.isCombat) {
      gates = [];
      return;
    }
    gates = [
      { id: 1, name: 'GATE 1', x: 0,    y: 112, z: -480,  yaw: 0,    passed: false },
      { id: 2, name: 'GATE 2', x: -180, y: 145, z: -1020, yaw: 0.35, passed: false },
      { id: 3, name: 'GATE 3', x: -460, y: 165, z: -1460, yaw: 1.15, passed: false },
      { id: 4, name: 'GATE 4', x: -340, y: 135, z: -1120, yaw: 2.55, passed: false },
      { id: 5, name: 'GATE 5', x: 0,    y: 85,  z: -820,  yaw: 3.14, passed: false },
    ];
  }

  function initParticles(mapId) {
    particles.length = 0;
    if (mapId === 'nusantara' || mapId === 'gurun') return;
    for (let i = 0; i < 180; i++) {
      particles.push({
        x: (Math.random() - 0.5) * 320,
        y: (Math.random() - 0.5) * 160,
        z: (Math.random() - 0.5) * 320,
        vy: mapId === 'salju' ? -14 - Math.random() * 10 : (mapId === 'kawah' ? 12 + Math.random() * 14 : 0),
      });
    }
    if (!particleBoxMesh) {
      const mb = window.AeroGL.MeshBuilder();
      mb.addBox(0, 0, 0, 0.7, 0.7, 0.7, [1, 1, 1]);
      particleBoxMesh = mb.build();
    }
  }

  function load(mapObj, modeObj) {
    currentMap = mapObj;
    currentMode = modeObj;

    terrainMesh = buildTerrain(mapObj.id);
    waterMesh = mapObj.hasWater ? buildWater() : null;
    runwayMesh = buildRunway(mapObj.id);
    propsMesh = buildProps(mapObj.id);
    turbineBladeMesh = buildTurbineBlades();
    cloudMesh = buildClouds(mapObj.id);
    spaceObjectsMesh = buildSpaceObjects(mapObj.id);
    const rings = buildGateRing();
    ringMesh = rings.outer;
    ringInnerMesh = rings.inner;

    setupGates();
    initParticles(mapObj.id);
  }

  function getLighting(isNight) {
    const m = currentMap;
    if (!isNight) {
      return {
        skyTop: m.skyTop,
        skyHorizon: m.skyHorizon,
        sunDir: m.sunDir,
        sunColor: m.sunColor,
        groundAmb: m.groundAmb,
        fogColor: m.fogColor,
        fogDensity: m.fogDensity,
        stars: m.stars,
      };
    }
    // Night / Dawn Ops override
    return {
      skyTop: [0.02, 0.04, 0.10],
      skyHorizon: [0.16, 0.22, 0.36],
      sunDir: [-0.5, 0.08, -0.85],
      sunColor: [0.55, 0.65, 0.88],
      groundAmb: [0.06, 0.08, 0.14],
      fogColor: [0.06, 0.09, 0.16],
      fogDensity: 0.00032,
      stars: 0.85,
    };
  }

  function render(proj, view, viewRot, camPos, time, planePos, dt, lightsOn) {
    const gl = window.AeroGL.gl;
    const progs = window.AeroGL.programs;
    const isNight = currentMode && currentMode.nightOverride;
    const lit = getLighting(isNight);

    // 1. Sky Dome
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(progs.sky);
    gl.uniformMatrix4fv(gl.getUniformLocation(progs.sky, 'uProj'), false, proj);
    gl.uniformMatrix4fv(gl.getUniformLocation(progs.sky, 'uViewRot'), false, viewRot);
    gl.uniform3fv(gl.getUniformLocation(progs.sky, 'uSkyTop'), lit.skyTop);
    gl.uniform3fv(gl.getUniformLocation(progs.sky, 'uSkyHorizon'), lit.skyHorizon);
    gl.uniform3fv(gl.getUniformLocation(progs.sky, 'uSunDir'), lit.sunDir);
    gl.uniform3fv(gl.getUniformLocation(progs.sky, 'uSunColor'), lit.sunColor);
    gl.uniform1f(gl.getUniformLocation(progs.sky, 'uStars'), lit.stars);
    if (!window._skyCube) window._skyCube = window.AeroGL.createSkyCube();
    window.AeroGL.drawMesh(window._skyCube);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.depthFunc(gl.LESS);

    // 2. Lit World Helper
    const drawLit = (mesh, modelMat, spec = 0.12, emissive = [0, 0, 0]) => {
      if (!mesh) return;
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

    const ident = M.mat4Identity();
    drawLit(terrainMesh, ident, 0.06);
    drawLit(runwayMesh, ident, 0.18);
    drawLit(propsMesh, ident, 0.10);

    // Wind turbines
    for (const t of turbines) {
      const tm = M.mat4FromTRS({ x: t.x, y: t.y, z: t.z }, { yaw: 0, pitch: 0, roll: time * 1.4 + t.phase }, { x: 1, y: 1, z: 1 });
      drawLit(turbineBladeMesh, tm, 0.25);
    }

    // Clouds
    if (cloudMesh) {
      for (const c of clouds) {
        c.x += c.speed * dt;
        if (c.x > 2400) c.x = -2400;
        const cm = M.mat4FromTRS({ x: c.x, y: c.y, z: c.z }, { yaw: 0, pitch: 0, roll: 0 }, { x: c.sx, y: c.sy, z: c.sz });
        drawLit(cloudMesh, cm, 0.02);
      }
    }

    // Space planets & asteroids
    if (spaceObjectsMesh) {
      drawLit(spaceObjectsMesh.bigBodies, ident, 0.08);
      for (const a of asteroids) {
        a.rotY += a.spin * dt;
        const am = M.mat4FromTRS({ x: a.x, y: a.y, z: a.z }, { yaw: a.rotY, pitch: 0.2, roll: 0 }, { x: a.scale, y: a.scale, z: a.scale });
        drawLit(spaceObjectsMesh.astMesh, am, 0.12);
      }
    }

    // 3. Water / Lava
    if (waterMesh) {
      gl.useProgram(progs.water);
      gl.uniformMatrix4fv(gl.getUniformLocation(progs.water, 'uProj'), false, proj);
      gl.uniformMatrix4fv(gl.getUniformLocation(progs.water, 'uView'), false, view);
      gl.uniformMatrix4fv(gl.getUniformLocation(progs.water, 'uModel'), false, ident);
      gl.uniform3fv(gl.getUniformLocation(progs.water, 'uCamPos'), [camPos.x, camPos.y, camPos.z]);
      gl.uniform3fv(gl.getUniformLocation(progs.water, 'uSunDir'), lit.sunDir);
      gl.uniform3fv(gl.getUniformLocation(progs.water, 'uSunColor'), lit.sunColor);
      gl.uniform3fv(gl.getUniformLocation(progs.water, 'uSkyColor'), lit.skyHorizon);
      gl.uniform3fv(gl.getUniformLocation(progs.water, 'uFogColor'), lit.fogColor);
      gl.uniform1f(gl.getUniformLocation(progs.water, 'uFogDensity'), lit.fogDensity);
      gl.uniform3fv(gl.getUniformLocation(progs.water, 'uWaterDeep'), currentMap.waterDeep);
      gl.uniform3fv(gl.getUniformLocation(progs.water, 'uWaterShallow'), currentMap.waterShallow);
      gl.uniform1f(gl.getUniformLocation(progs.water, 'uTime'), time);
      gl.uniform1f(gl.getUniformLocation(progs.water, 'uIsLava'), currentMap.isLava ? 1.0 : 0.0);
      window.AeroGL.drawMesh(waterMesh);
    }

    // 4. Glowing Gate Rings & Runway / PAPI Lights
    gl.useProgram(progs.glow);
    gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uProj'), false, proj);
    gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uView'), false, view);

    const nextGate = gates.find((g) => !g.passed);
    for (const g of gates) {
      if (g.passed) continue;
      const isNext = nextGate && g.id === nextGate.id;
      const pulse = isNext ? (1.0 + Math.sin(time * 5.0) * 0.04) : 1.0;
      const gm = M.mat4FromTRS({ x: g.x, y: g.y, z: g.z }, { yaw: g.yaw, pitch: 0, roll: 0 }, { x: pulse, y: pulse, z: 1 });
      gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uModel'), false, gm);
      gl.uniform3fv(gl.getUniformLocation(progs.glow, 'uColorOverride'), isNext ? [1.0, 0.56, 0.12] : [0.85, 0.38, 0.08]);
      gl.uniform1f(gl.getUniformLocation(progs.glow, 'uUseOverride'), 1.0);
      gl.uniform1f(gl.getUniformLocation(progs.glow, 'uAlpha'), isNext ? 0.96 : 0.65);
      window.AeroGL.drawMesh(ringMesh);

      gl.uniform3fv(gl.getUniformLocation(progs.glow, 'uColorOverride'), [1.0, 0.88, 0.45]);
      gl.uniform1f(gl.getUniformLocation(progs.glow, 'uAlpha'), isNext ? 0.85 : 0.40);
      window.AeroGL.drawMesh(ringInnerMesh);
    }

    // Runway Edge Lights & PAPI Lights
    if (!particleBoxMesh) {
      const mb = window.AeroGL.MeshBuilder();
      mb.addBox(0, 0, 0, 0.7, 0.7, 0.7, [1, 1, 1]);
      particleBoxMesh = mb.build();
    }

    if (lightsOn || isNight || currentMap.id === 'orbit' || currentMap.id === 'kawah') {
      // Edge lights
      for (let z = RUNWAY.zEnd + 20; z <= RUNWAY.zStart - 20; z += 50) {
        for (const sx of [-16.5, 16.5]) {
          const lm = M.mat4FromTRS({ x: sx, y: RUNWAY.elev + 0.6, z }, { yaw: 0, pitch: 0, roll: 0 }, { x: 1.1, y: 1.1, z: 1.1 });
          gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uModel'), false, lm);
          gl.uniform3fv(gl.getUniformLocation(progs.glow, 'uColorOverride'), [1.0, 0.85, 0.45]);
          gl.uniform1f(gl.getUniformLocation(progs.glow, 'uUseOverride'), 1.0);
          gl.uniform1f(gl.getUniformLocation(progs.glow, 'uAlpha'), 0.95);
          window.AeroGL.drawMesh(particleBoxMesh);
        }
      }
      // 4 PAPI lights on left side of runway approach (red/white based on glide slope)
      const distToRwy = Math.max(40, Math.abs(planePos.z - RUNWAY.zEnd));
      const glideAngle = Math.atan2(planePos.y - RUNWAY.elev, distToRwy);
      const targetGlide = M.degToRad(4.0);
      for (let i = 0; i < 4; i++) {
        const thresh = targetGlide + (i - 1.5) * 0.012;
        const isWhite = glideAngle > thresh;
        const pm = M.mat4FromTRS({ x: -24 - i * 4.5, y: RUNWAY.elev + 1.0, z: RUNWAY.zEnd + 45 }, { yaw: 0, pitch: 0, roll: 0 }, { x: 2.0, y: 1.4, z: 2.0 });
        gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uModel'), false, pm);
        gl.uniform3fv(gl.getUniformLocation(progs.glow, 'uColorOverride'), isWhite ? [1.0, 0.98, 0.92] : [1.0, 0.16, 0.12]);
        gl.uniform1f(gl.getUniformLocation(progs.glow, 'uAlpha'), 1.0);
        window.AeroGL.drawMesh(particleBoxMesh);
      }
    }

    // Weather particles (Snow / Embers / Stardust)
    if (particles.length > 0 && particleBoxMesh) {
      const pCol = currentMap.id === 'salju' ? [0.95, 0.98, 1.0] : currentMap.id === 'kawah' ? [1.0, 0.45, 0.08] : [0.7, 0.85, 1.0];
      gl.uniform3fv(gl.getUniformLocation(progs.glow, 'uColorOverride'), pCol);
      gl.uniform1f(gl.getUniformLocation(progs.glow, 'uUseOverride'), 1.0);
      gl.uniform1f(gl.getUniformLocation(progs.glow, 'uAlpha'), 0.85);
      for (const p of particles) {
        p.y += p.vy * dt;
        if (p.y < -80) p.y += 160;
        if (p.y > 80) p.y -= 160;
        const wx = planePos.x + p.x;
        const wy = planePos.y + p.y;
        const wz = planePos.z + p.z;
        const pm = M.mat4FromTRS({ x: wx, y: wy, z: wz }, { yaw: 0, pitch: 0, roll: 0 }, { x: 0.9, y: 0.9, z: 0.9 });
        gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uModel'), false, pm);
        window.AeroGL.drawMesh(particleBoxMesh);
      }
    }
  }

  return {
    RUNWAY,
    get gates() { return gates; },
    get asteroids() { return asteroids; },
    get turbines() { return turbines; },
    get currentMap() { return currentMap; },
    get currentMode() { return currentMode; },
    load,
    getTerrainHeight,
    getLighting,
    render,
  };
})();
