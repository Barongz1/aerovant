/**
 * terrain.js - Procedural world for AEROVANT: 5 maps, one island layout.
 * Nusantara (tropical), Puncak Salju (snow), Kawah Api (volcano, lava: true),
 * Orbit Antariksa (space, low dark rock field), Gurun Pasir (desert).
 * AEROVANT revision v7 - space rock field relief 4-14 m for a touch more
 * shape far below, still far too low to read as hills or farmland.
 */
(function (global) {
  'use strict';

  const M = global.AerovantMath;

  const WORLD_SIZE = 7200;
  const WORLD_HALF = WORLD_SIZE / 2;
  const RUNWAY = {
    x: 0, z: -480, elevation: 18,
    length: 920, width: 58, heading: 0,
    name: 'Landasan 36'
  };

  const MAPS = [
    {
      id: 'nusantara', name: 'Kepulauan Nusantara',
      desc: 'Pulau tropis: laut biru, sawah hijau, kota dan gunung berapi.',
      sky: { zenith: [0.22, 0.48, 0.82], mid: [0.55, 0.78, 0.92], horizon: [0.85, 0.92, 0.97] },
      sun: [0.55, 0.35, 0.75], sunColor: [1.0, 0.95, 0.85],
      fog: { color: [0.72, 0.82, 0.9], density: 0.00012 },
      water: [0.15, 0.45, 0.75], gravity: 1.0, groundCollision: true,
      particles: 'none', stars: false, lava: false,
      palette: { snow: 460, rock: 270, sand: 3, grass: [0.23, 0.5, 0.2], forest: [0.1, 0.32, 0.12], field: [0.55, 0.6, 0.25] }
    },
    {
      id: 'salju', name: 'Puncak Salju',
      desc: 'Pegunungan es: salju putih, danau beku, langit dingin, salju turun.',
      sky: { zenith: [0.35, 0.55, 0.78], mid: [0.68, 0.8, 0.9], horizon: [0.9, 0.93, 0.96] },
      sun: [0.5, 0.3, 0.8], sunColor: [0.95, 0.97, 1.0],
      fog: { color: [0.82, 0.86, 0.92], density: 0.00045 },
      water: [0.6, 0.75, 0.85], gravity: 1.0, groundCollision: true,
      particles: 'snow', stars: false, lava: false,
      palette: { snow: 60, rock: 200, sand: 3, grass: [0.82, 0.86, 0.9], forest: [0.55, 0.65, 0.7], field: [0.75, 0.78, 0.82] }
    },
    {
      id: 'kawah', name: 'Kawah Api',
      desc: 'Gunung berapi: lava menyala, asap dan abu, langit oranye gelap.',
      sky: { zenith: [0.12, 0.06, 0.08], mid: [0.35, 0.14, 0.08], horizon: [0.62, 0.28, 0.12] },
      sun: [0.4, 0.22, 0.9], sunColor: [1.0, 0.55, 0.25],
      fog: { color: [0.35, 0.18, 0.1], density: 0.00035 },
      water: [0.9, 0.35, 0.08], gravity: 1.0, groundCollision: true,
      particles: 'ash', stars: false, lava: true,
      palette: { snow: 520, rock: 180, sand: 3, grass: [0.22, 0.14, 0.1], forest: [0.15, 0.1, 0.08], field: [0.3, 0.18, 0.12] }
    },
    {
      id: 'antariksa', name: 'Orbit Antariksa',
      desc: 'Langit hitam berbintang, planet dan bulan, asteroid melayang sebagai rintangan.',
      sky: { zenith: [0.01, 0.01, 0.03], mid: [0.03, 0.03, 0.08], horizon: [0.08, 0.06, 0.14] },
      sun: [0.6, 0.4, 0.7], sunColor: [1.0, 0.98, 0.9],
      fog: { color: [0.05, 0.05, 0.1], density: 0.0004 },
      water: [0.1, 0.1, 0.2], gravity: 0.35, groundCollision: false,
      particles: 'none', stars: true, lava: false,
      palette: { snow: 9999, rock: 150, sand: 3, grass: [0.32, 0.3, 0.33], forest: [0.22, 0.21, 0.25], field: [0.38, 0.36, 0.4] }
    },
    {
      id: 'gurun', name: 'Gurun Pasir',
      desc: 'Bukit pasir, oasis biru, langit terik, debu panas beterbangan.',
      sky: { zenith: [0.35, 0.6, 0.85], mid: [0.75, 0.78, 0.7], horizon: [0.95, 0.85, 0.62] },
      sun: [0.55, 0.45, 0.75], sunColor: [1.0, 0.9, 0.7],
      fog: { color: [0.9, 0.8, 0.6], density: 0.0003 },
      water: [0.15, 0.5, 0.65], gravity: 1.0, groundCollision: true,
      particles: 'dust', stars: false, lava: false,
      palette: { snow: 9999, rock: 240, sand: 3, grass: [0.82, 0.68, 0.4], forest: [0.7, 0.55, 0.3], field: [0.88, 0.75, 0.48] }
    }
  ];

  const PEAKS = [
    { x: -1150, z: -2250, height: 690, radius: 850, name: 'Gunung Baruna', crater: true },
    { x: 1650, z: -1900, height: 520, radius: 720, name: 'Puncak Barisan Barat' },
    { x: 2100, z: 1050, height: 430, radius: 680, name: 'Pegunungan Timur' },
    { x: -1900, z: 1250, height: 380, radius: 640, name: 'Bukit Selatan' },
    { x: -300, z: 2150, height: 310, radius: 600, name: 'Tebing Naga' }
  ];

  const CITY = {
    x: 620, z: -1150, radius: 520,
    name: 'Distrik Kota',
    buildingCount: 120
  };

  const RIVER = {
    points: [
      [-2600, -2900], [-1800, -2100], [-1200, -1400], [-650, -800],
      [-300, -200], [150, 300], [700, 900], [1200, 1600], [1700, 2300], [2100, 2900]
    ],
    width: 90
  };

  const LAKE = { x: -1800, z: 900, radius: 420 };
  const OASIS = { x: -1500, z: 1200, radius: 260 };

  // Floating asteroids for the space map (position + radius, collision spheres)
  const ASTEROIDS = [
    { x: 800, z: -1600, y: 320, r: 90 },
    { x: -900, z: -900, y: 260, r: 70 },
    { x: 1500, z: -400, y: 380, r: 110 },
    { x: -1600, z: 300, y: 300, r: 85 },
    { x: 400, z: 900, y: 240, r: 65 },
    { x: -600, z: 1700, y: 340, r: 95 },
    { x: 1900, z: 1200, y: 280, r: 75 },
    { x: -2200, z: -1800, y: 360, r: 100 },
    { x: 1100, z: 2100, y: 300, r: 80 },
    { x: -1400, z: -2400, y: 260, r: 70 },
    { x: 250, z: -2200, y: 400, r: 60 },
    { x: 2600, z: 300, y: 330, r: 90 }
  ];

  let currentMap = MAPS[0];

  function setMap(id) {
    const found = MAPS.find(m => m.id === id);
    if (found) currentMap = found;
    return currentMap;
  }

  function getMap() { return currentMap; }
  function getMaps() { return MAPS; }

  function baseHeight(x, z) {
    let h = 0;
    h += M.fbm2D(x * 0.00012, z * 0.00012, 4) * 260;
    h += M.ridgeNoise2D(x * 0.00025, z * 0.00025, 3) * 140;
    h += M.fbm2D(x * 0.0011, z * 0.0011, 2) * 18;

    for (const p of PEAKS) {
      const dx = x - p.x, dz = z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < p.radius * 2.2) {
        const t = Math.max(0, 1 - d / (p.radius * 2.2));
        h += p.height * t * t;
        if (p.crater && d < p.radius * 0.35) {
          h -= p.height * 0.35 * (1 - d / (p.radius * 0.35));
        }
      }
    }

    // River carve
    let minRiverDist = Infinity;
    for (let i = 0; i < RIVER.points.length - 1; i++) {
      const a = RIVER.points[i], b = RIVER.points[i + 1];
      const abx = b[0] - a[0], abz = b[1] - a[1];
      const len2 = abx * abx + abz * abz;
      let t = len2 > 0 ? ((x - a[0]) * abx + (z - a[1]) * abz) / len2 : 0;
      t = M.clamp(t, 0, 1);
      const px = a[0] + abx * t, pz = a[1] + abz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < minRiverDist) minRiverDist = d;
    }
    if (minRiverDist < RIVER.width * 2.5) {
      const t = M.clamp(minRiverDist / (RIVER.width * 2.5), 0, 1);
      h = M.lerp(2, h, M.smoothstep(0.25, 1, t));
    }

    // Lake / oasis flatten
    const lakeD = Math.hypot(x - LAKE.x, z - LAKE.z);
    if (lakeD < LAKE.radius * 1.4) {
      const t = M.clamp(lakeD / (LAKE.radius * 1.4), 0, 1);
      h = M.lerp(1, h, M.smoothstep(0.3, 1, t));
    }
    const oasisD = Math.hypot(x - OASIS.x, z - OASIS.z);
    if (oasisD < OASIS.radius * 1.4) {
      const t = M.clamp(oasisD / (OASIS.radius * 1.4), 0, 1);
      h = M.lerp(2, h, M.smoothstep(0.3, 1, t));
    }

    // Runway flatten
    const rdx = x - RUNWAY.x, rdz = z - RUNWAY.z;
    const along = Math.abs(rdz);
    const across = Math.abs(rdx);
    if (along < RUNWAY.length * 0.75 && across < RUNWAY.width * 4) {
      const t = M.smoothstep(0, 1, Math.min(1, Math.max(
        (RUNWAY.length * 0.75 - along) / (RUNWAY.length * 0.2),
        (RUNWAY.width * 4 - across) / (RUNWAY.width * 1.5)
      )));
      h = M.lerp(h, RUNWAY.elevation, M.clamp(t, 0, 1) * 0.96);
    }

    // City flatten
    const cityD = Math.hypot(x - CITY.x, z - CITY.z);
    if (cityD < CITY.radius * 1.2) {
      const t = M.clamp(cityD / (CITY.radius * 1.2), 0, 1);
      h = M.lerp(14, h, M.smoothstep(0.4, 1, t));
    }

    // Sea fade at edges
    const edgeDist = Math.max(Math.abs(x), Math.abs(z));
    if (edgeDist > WORLD_HALF * 0.72) {
      const t = M.smoothstep(WORLD_HALF * 0.72, WORLD_HALF, edgeDist);
      h = M.lerp(h, -6, t);
    }
    return h;
  }

  function getTerrainHeight(x, z) {
    const id = currentMap.id;
    const h = baseHeight(x, z);
    if (id === 'gurun') {
      // Smooth dunes: soften the base, add rolling sand waves
      const dune = M.fbm2D(x * 0.00035, z * 0.00035, 3) * 60;
      return h * 0.45 + dune * 0.7 + 6;
    }
    if (id === 'antariksa') {
      // Low dark rock field far below, never a mountain range:
      // gentle rolling rock 4-14 m so the plane always flies above it
      // and it reads as a distant asteroid field, not farmland.
      return 4 + Math.abs(M.fbm2D(x * 0.0004, z * 0.0004, 3)) * 10;
    }
    if (id === 'salju') return h * 1.04 + 6;
    if (id === 'kawah') return h * 1.08 + 4;
    return h;
  }

  function isLava(x, z) {
    if (!currentMap.lava) return false;
    const peak = PEAKS[0];
    const d = Math.hypot(x - peak.x, z - peak.z);
    if (d < peak.radius * 0.55) return true;
    // Lava flows downhill from the crater toward the valley
    const flowD = Math.hypot(x - (peak.x + 500), z - (peak.z + 700));
    if (flowD < 260) return true;
    return false;
  }

  function isWater(x, z) {
    const h = getTerrainHeight(x, z);
    if (currentMap.id === 'antariksa') return false;
    const edgeDist = Math.max(Math.abs(x), Math.abs(z));
    if (edgeDist > WORLD_HALF * 0.78) return true;
    let minRiverDist = Infinity;
    for (let i = 0; i < RIVER.points.length - 1; i++) {
      const a = RIVER.points[i], b = RIVER.points[i + 1];
      const abx = b[0] - a[0], abz = b[1] - a[1];
      const len2 = abx * abx + abz * abz;
      let t = len2 > 0 ? ((x - a[0]) * abx + (z - a[1]) * abz) / len2 : 0;
      t = M.clamp(t, 0, 1);
      const d = Math.hypot(x - (a[0] + abx * t), z - (a[1] + abz * t));
      if (d < minRiverDist) minRiverDist = d;
    }
    if (minRiverDist < RIVER.width * 0.9) return true;
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.radius) return true;
    if (Math.hypot(x - OASIS.x, z - OASIS.z) < OASIS.radius) return true;
    return h < 1.5 && currentMap.id !== 'salju';
  }

  function getGroundColor(x, z, height) {
    const pal = currentMap.palette;
    const id = currentMap.id;
    // Space: the ground is dark rock, never grass or sand
    if (id === 'antariksa') {
      const v = (M.hash2(Math.floor(x / 24), Math.floor(z / 24)) - 0.5) * 0.12;
      const base = 0.22 + v;
      return [M.clamp(base, 0, 1), M.clamp(base * 0.95, 0, 1), M.clamp(base * 1.1, 0, 1)];
    }
    const slope = Math.abs(getTerrainHeight(x + 8, z) - getTerrainHeight(x - 8, z)) / 16 +
      Math.abs(getTerrainHeight(x, z + 8) - getTerrainHeight(x, z - 8)) / 16;

    if (isLava(x, z)) return [0.95, 0.3, 0.05];
    if (isWater(x, z)) return currentMap.water;

    const forest = M.fbm2D(x * 0.0016 + 40, z * 0.0016 + 40, 2);
    const field = M.valueNoise2D(x * 0.0009 + 7, z * 0.0009 + 3);

    let c;
    if (height > pal.snow) c = [0.92, 0.93, 0.95];
    else if (height > pal.rock || slope > 0.55) c = [0.42, 0.38, 0.36];
    else if (forest > 0.62 && height > 8) c = pal.forest;
    else if (field > 0.62 && height > 6 && height < 120) c = pal.field;
    else if (height < pal.sand + 4) c = [0.85, 0.78, 0.55];
    else c = pal.grass;

    // City ground: grey
    const cityD = Math.hypot(x - CITY.x, z - CITY.z);
    if (cityD < CITY.radius) c = [0.45, 0.46, 0.48];
    // Runway surround: darker green
    const rdx = Math.abs(x - RUNWAY.x), rdz = Math.abs(z - RUNWAY.z);
    if (rdz < RUNWAY.length * 0.6 && rdx < RUNWAY.width * 3) c = [0.16, 0.38, 0.16];

    // Slight variation so the ground is not flat-shaded
    const v = (M.hash2(Math.floor(x / 24), Math.floor(z / 24)) - 0.5) * 0.06;
    return [M.clamp(c[0] + v, 0, 1), M.clamp(c[1] + v, 0, 1), M.clamp(c[2] + v, 0, 1)];
  }

  function getAsteroids() { return ASTEROIDS; }

  global.AerovantWorld = {
    WORLD_SIZE,
    WORLD_HALF,
    RUNWAY,
    PEAKS,
    CITY,
    RIVER,
    LAKE,
    OASIS,
    ASTEROIDS,
    MAPS,
    setMap,
    getMap,
    getMaps,
    getTerrainHeight,
    isLava,
    isWater,
    getGroundColor,
    getAsteroids
  };
})(window);
