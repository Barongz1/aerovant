/**
 * meshes.js - Procedural mesh builders for AEROVANT.
 * Terrain, city, airfield, rings, clouds, asteroids, planet/moon,
 * three distinct aircraft (Elang Jawa, Cendrawasih, Jalak Bali) with
 * animated parts, and the hangar showroom for the selection screen.
 * Indices are Uint16 (WebGL1 UNSIGNED_SHORT); the terrain grid shares
 * vertices so it stays under 65,536 vertices.
 * AEROVANT revision v5 - main hangar roof gained a vent box.
 */
(function (global) {
  'use strict';

  const M = global.AerovantMath;

  function MeshBuilder() {
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.indices = [];
    this.vertexCount = 0;
  }

  MeshBuilder.prototype._pushVertex = function (x, y, z, nx, ny, nz, r, g, b) {
    this.positions.push(x, y, z);
    this.normals.push(nx, ny, nz);
    this.colors.push(r, g, b);
    this.vertexCount++;
    return this.vertexCount - 1;
  };

  MeshBuilder.prototype.addQuad = function (a, b, c, d, normal, color) {
    const i0 = this._pushVertex(a[0], a[1], a[2], normal[0], normal[1], normal[2], color[0], color[1], color[2]);
    const i1 = this._pushVertex(b[0], b[1], b[2], normal[0], normal[1], normal[2], color[0], color[1], color[2]);
    const i2 = this._pushVertex(c[0], c[1], c[2], normal[0], normal[1], normal[2], color[0], color[1], color[2]);
    const i3 = this._pushVertex(d[0], d[1], d[2], normal[0], normal[1], normal[2], color[0], color[1], color[2]);
    this.indices.push(i0, i1, i2, i0, i2, i3);
  };

  MeshBuilder.prototype.addTriangle = function (a, b, c, normal, color) {
    const i0 = this._pushVertex(a[0], a[1], a[2], normal[0], normal[1], normal[2], color[0], color[1], color[2]);
    const i1 = this._pushVertex(b[0], b[1], b[2], normal[0], normal[1], normal[2], color[0], color[1], color[2]);
    const i2 = this._pushVertex(c[0], c[1], c[2], normal[0], normal[1], normal[2], color[0], color[1], color[2]);
    this.indices.push(i0, i1, i2);
  };

  MeshBuilder.prototype.addBox = function (cx, cy, cz, sx, sy, sz, color) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const faces = [
      { n: [0, 0, 1], v: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
      { n: [0, 0, -1], v: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
      { n: [1, 0, 0], v: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]] },
      { n: [-1, 0, 0], v: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]] },
      { n: [0, 1, 0], v: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
      { n: [0, -1, 0], v: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] }
    ];
    for (const f of faces) {
      this.addQuad(
        [cx + f.v[0][0], cy + f.v[0][1], cz + f.v[0][2]],
        [cx + f.v[1][0], cy + f.v[1][1], cz + f.v[1][2]],
        [cx + f.v[2][0], cy + f.v[2][1], cz + f.v[2][2]],
        [cx + f.v[3][0], cy + f.v[3][1], cz + f.v[3][2]],
        f.n, color
      );
    }
  };

  // Box that tapers toward +z (nose) or -z (tail): scale the far face by t
  MeshBuilder.prototype.addTaperedBox = function (cx, cy, cz, sx, sy, sz, taper, color) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const thx = hx * taper, thy = hy * taper;
    const faces = [
      { n: [0, 0, 1], v: [[-thx, -thy, hz], [thx, -thy, hz], [thx, thy, hz], [-thx, thy, hz]] },
      { n: [0, 0, -1], v: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
      { n: [1, 0, 0], v: [[thx, -thy, hz], [hx, -hy, -hz], [hx, hy, -hz], [thx, thy, hz]] },
      { n: [-1, 0, 0], v: [[-hx, -hy, -hz], [-thx, -thy, hz], [-thx, thy, hz], [-hx, hy, -hz]] },
      { n: [0, 1, 0], v: [[-thx, thy, hz], [thx, thy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
      { n: [0, -1, 0], v: [[-hx, -hy, -hz], [hx, -hy, -hz], [thx, -thy, hz], [-thx, -thy, hz]] }
    ];
    for (const f of faces) {
      this.addQuad(
        [cx + f.v[0][0], cy + f.v[0][1], cz + f.v[0][2]],
        [cx + f.v[1][0], cy + f.v[1][1], cz + f.v[1][2]],
        [cx + f.v[2][0], cy + f.v[2][1], cz + f.v[2][2]],
        [cx + f.v[3][0], cy + f.v[3][1], cz + f.v[3][2]],
        f.n, color
      );
    }
  };

  MeshBuilder.prototype.addCylinderZ = function (cx, cy, cz, radius, length, segments, color) {
    const hz = length / 2;
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const x0 = Math.cos(a0) * radius, y0 = Math.sin(a0) * radius;
      const x1 = Math.cos(a1) * radius, y1 = Math.sin(a1) * radius;
      const nx0 = Math.cos(a0), ny0 = Math.sin(a0);
      const nx1 = Math.cos(a1), ny1 = Math.sin(a1);
      this.addQuad(
        [cx + x0, cy + y0, cz - hz], [cx + x1, cy + y1, cz - hz],
        [cx + x1, cy + y1, cz + hz], [cx + x0, cy + y0, cz + hz],
        [nx0, ny0, 0], color
      );
      this.addTriangle([cx, cy, cz + hz], [cx + x0, cy + y0, cz + hz], [cx + x1, cy + y1, cz + hz], [0, 0, 1], color);
      this.addTriangle([cx, cy, cz - hz], [cx + x1, cy + y1, cz - hz], [cx + x0, cy + y0, cz - hz], [0, 0, -1], color);
    }
  };

  MeshBuilder.prototype.addSphere = function (cx, cy, cz, radius, segments, color, squashY) {
    const sy = squashY || 1;
    for (let i = 0; i < segments; i++) {
      const lat0 = (i / segments) * Math.PI;
      const lat1 = ((i + 1) / segments) * Math.PI;
      for (let j = 0; j < segments; j++) {
        const lon0 = (j / segments) * Math.PI * 2;
        const lon1 = ((j + 1) / segments) * Math.PI * 2;
        const p = (lat, lon) => [
          cx + radius * Math.sin(lat) * Math.cos(lon),
          cy + radius * Math.cos(lat) * sy,
          cz + radius * Math.sin(lat) * Math.sin(lon)
        ];
        const n = (lat, lon) => [
          Math.sin(lat) * Math.cos(lon),
          Math.cos(lat),
          Math.sin(lat) * Math.sin(lon)
        ];
        const a = p(lat0, lon0), b = p(lat0, lon1), c = p(lat1, lon1), d = p(lat1, lon0);
        const na = n(lat0, lon0), nb = n(lat0, lon1), nc = n(lat1, lon1), nd = n(lat1, lon0);
        const i0 = this._pushVertex(a[0], a[1], a[2], na[0], na[1], na[2], color[0], color[1], color[2]);
        const i1 = this._pushVertex(b[0], b[1], b[2], nb[0], nb[1], nb[2], color[0], color[1], color[2]);
        const i2 = this._pushVertex(c[0], c[1], c[2], nc[0], nc[1], nc[2], color[0], color[1], color[2]);
        const i3 = this._pushVertex(d[0], d[1], d[2], nd[0], nd[1], nd[2], color[0], color[1], color[2]);
        this.indices.push(i0, i1, i2, i0, i2, i3);
      }
    }
  };

  // Flat wing panel: a tapered quad in the XZ plane, thin in Y
  MeshBuilder.prototype.addWing = function (x0, z0, x1, z1, chord0, chord1, y, thickness, color) {
    const t = thickness / 2;
    const top = [0, 1, 0], bot = [0, -1, 0];
    this.addQuad(
      [x0, y + t, z0 - chord0 / 2], [x1, y + t, z1 - chord1 / 2],
      [x1, y + t, z1 + chord1 / 2], [x0, y + t, z0 + chord0 / 2], top, color
    );
    this.addQuad(
      [x0, y - t, z0 + chord0 / 2], [x1, y - t, z1 + chord1 / 2],
      [x1, y - t, z1 - chord1 / 2], [x0, y - t, z0 - chord0 / 2], bot, color
    );
    this.addQuad(
      [x1, y - t, z1 - chord1 / 2], [x1, y - t, z1 + chord1 / 2],
      [x1, y + t, z1 + chord1 / 2], [x1, y + t, z1 - chord1 / 2], [1, 0, 0], color
    );
    this.addQuad(
      [x0, y - t, z0 + chord0 / 2], [x1, y - t, z1 + chord1 / 2],
      [x1, y + t, z1 + chord1 / 2], [x0, y + t, z0 + chord0 / 2], [0, 0, 1], color
    );
  };

  MeshBuilder.prototype.build = function () {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      colors: new Float32Array(this.colors),
      indices: new Uint16Array(this.indices),
      count: this.indices.length
    };
  };

  // ---------- World meshes ----------

  function createTerrainMesh(world) {
    const b = new MeshBuilder();
    const N = 160;
    const size = world.WORLD_SIZE;
    const step = size / N;
    const half = size / 2;
    const heights = new Float32Array((N + 1) * (N + 1));
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const x = -half + i * step;
        const z = -half + j * step;
        heights[j * (N + 1) + i] = world.getTerrainHeight(x, z);
      }
    }
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const x = -half + i * step;
        const z = -half + j * step;
        const h = heights[j * (N + 1) + i];
        const color = world.getGroundColor(x, z, h);
        const hx = heights[j * (N + 1) + Math.min(i + 1, N)] - heights[j * (N + 1) + Math.max(i - 1, 0)];
        const hz = heights[Math.min(j + 1, N) * (N + 1) + i] - heights[Math.max(j - 1, 0) * (N + 1) + i];
        const nx = -hx / (2 * step), nz = -hz / (2 * step);
        const len = Math.hypot(nx, 1, nz);
        b._pushVertex(x, h, z, nx / len, 1 / len, nz / len, color[0], color[1], color[2]);
      }
    }
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = j * (N + 1) + i;
        const c = a + 1;
        const d = a + (N + 1);
        const e = d + 1;
        b.indices.push(a, c, e, a, e, d);
      }
    }
    return b.build();
  }

  function createWaterMesh(world) {
    const b = new MeshBuilder();
    const size = world.WORLD_SIZE;
    const half = size / 2;
    const color = world.getMap().water;
    b.addQuad([-half, 0.5, -half], [half, 0.5, -half], [half, 0.5, half], [-half, 0.5, half], [0, 1, 0], color);
    return b.build();
  }

  function createCityMesh(world) {
    const b = new MeshBuilder();
    const city = world.CITY;
    const mapId = world.getMap().id;
    const base = mapId === 'antariksa' ? [0.5, 0.52, 0.58] : [0.35, 0.38, 0.42];
    const lit = mapId === 'kawah' ? [0.9, 0.5, 0.2] : [1.0, 0.85, 0.5];
    for (let i = 0; i < city.buildingCount; i++) {
      const ang = M.hash2(i, 3) * Math.PI * 2;
      const rad = Math.sqrt(M.hash2(i, 7)) * city.radius * 0.9;
      const x = city.x + Math.cos(ang) * rad;
      const z = city.z + Math.sin(ang) * rad;
      const h = 12 + M.hash2(i, 11) * 55;
      const w = 14 + M.hash2(i, 13) * 22;
      const d = 14 + M.hash2(i, 17) * 22;
      const shade = 0.8 + M.hash2(i, 19) * 0.4;
      b.addBox(x, 14 + h / 2, z, w, h, d, [base[0] * shade, base[1] * shade, base[2] * shade]);
      b.addBox(x, 14 + h + 0.6, z, w * 0.9, 1.2, d * 0.9, lit);
      if (h > 45) {
        b.addBox(x, 14 + h + 2.5, z, 1.5, 3, 1.5, [1.0, 0.2, 0.2]);
      }
    }
    b.addBox(150, 8, 300, 160, 4, 12, [0.5, 0.5, 0.55]);
    b.addBox(-300, 8, -200, 160, 4, 12, [0.5, 0.5, 0.55]);
    for (let i = 0; i < 160; i++) {
      const x = (M.hash2(i, 23) - 0.5) * 5000;
      const z = (M.hash2(i, 29) - 0.5) * 5000;
      const h = world.getTerrainHeight(x, z);
      if (h < 6 || h > 200) continue;
      const cityD = Math.hypot(x - city.x, z - city.z);
      if (cityD < city.radius) continue;
      const s = 4 + M.hash2(i, 31) * 6;
      b.addBox(x, h + s / 2, z, s * 0.5, s, s * 0.5, [0.08, 0.25, 0.1]);
    }
    return b.build();
  }

  function createAirfieldMesh(world) {
    const b = new MeshBuilder();
    const r = world.RUNWAY;
    const mapId = world.getMap().id;
    const pad = mapId === 'antariksa' ? [0.45, 0.46, 0.5] : [0.16, 0.16, 0.18];
    const line = mapId === 'antariksa' ? [1.0, 0.6, 0.2] : [0.95, 0.95, 0.9];
    b.addBox(r.x, r.elevation + 0.3, r.z, r.width, 0.6, r.length, pad);
    for (let i = -4; i <= 4; i++) {
      b.addBox(r.x, r.elevation + 0.7, r.z + i * 100, 2.5, 0.15, 40, line);
    }
    b.addBox(r.x, r.elevation + 0.7, r.z - r.length / 2 + 30, r.width * 0.7, 0.15, 8, line);
    b.addBox(r.x, r.elevation + 0.7, r.z + r.length / 2 - 30, r.width * 0.7, 0.15, 8, line);
    for (let i = -5; i <= 5; i++) {
      b.addBox(-r.width / 2 - 3, r.elevation + 1.2, r.z + i * 85, 1.5, 2.4, 1.5, [0.2, 0.9, 0.4]);
      b.addBox(r.width / 2 + 3, r.elevation + 1.2, r.z + i * 85, 1.5, 2.4, 1.5, [0.2, 0.9, 0.4]);
    }
    for (let i = 1; i <= 5; i++) {
      b.addBox(r.x, r.elevation + 1, r.z - r.length / 2 - i * 60, 3, 1.5, 3, [1.0, 0.9, 0.3]);
    }
    b.addBox(-90, r.elevation + 12, r.z - 120, 40, 24, 60, [0.55, 0.6, 0.65]);
    b.addBox(-90, r.elevation + 12, r.z + 60, 40, 24, 60, [0.55, 0.6, 0.65]);
    b.addBox(90, r.elevation + 12, r.z - 120, 40, 24, 60, [0.5, 0.55, 0.6]);
    b.addCylinderZ(110, r.elevation + 30, r.z + 200, 8, 60, 8, [0.7, 0.72, 0.75]);
    b.addBox(110, r.elevation + 62, r.z + 200, 22, 10, 22, [0.2, 0.3, 0.45]);
    b.addBox(110, r.elevation + 68, r.z + 200, 2, 3, 2, [1.0, 0.25, 0.25]);
    return b.build();
  }

  function createRingMesh(world, course) {
    const b = new MeshBuilder();
    for (const ring of course) {
      const segs = 20;
      const tube = 1.6;
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2;
        const a1 = ((i + 1) / segs) * Math.PI * 2;
        const y0 = Math.sin(a0) * ring.r, x0 = Math.cos(a0) * ring.r;
        const y1 = Math.sin(a1) * ring.r, x1 = Math.cos(a1) * ring.r;
        const n = [0, 0, 1];
        const col = [0.2, 0.85, 1.0];
        b.addQuad(
          [ring.x + x0 - tube, ring.y + y0, ring.z], [ring.x + x1 - tube, ring.y + y1, ring.z],
          [ring.x + x1 + tube, ring.y + y1, ring.z], [ring.x + x0 + tube, ring.y + y0, ring.z],
          n, col
        );
        b.addQuad(
          [ring.x + x0, ring.y + y0 - tube, ring.z], [ring.x + x1, ring.y + y1 - tube, ring.z],
          [ring.x + x1, ring.y + y1 + tube, ring.z], [ring.x + x0, ring.y + y0 + tube, ring.z],
          n, col
        );
      }
    }
    return b.build();
  }

  function createCloudMesh() {
    const b = new MeshBuilder();
    const white = [0.96, 0.97, 1.0];
    for (let i = 0; i < 28; i++) {
      const x = (M.hash2(i, 41) - 0.5) * 6500;
      const z = (M.hash2(i, 43) - 0.5) * 6500;
      const y = 380 + M.hash2(i, 47) * 260;
      const s = 60 + M.hash2(i, 53) * 110;
      b.addSphere(x, y, z, s, 6, white, 0.32);
      b.addSphere(x + s * 0.7, y + s * 0.12, z + s * 0.2, s * 0.7, 6, white, 0.3);
      b.addSphere(x - s * 0.6, y - s * 0.05, z - s * 0.25, s * 0.6, 6, white, 0.3);
    }
    return b.build();
  }

  function createAsteroidMesh(world) {
    const b = new MeshBuilder();
    for (const a of world.getAsteroids()) {
      const shade = 0.4 + M.hash2(a.x, a.z) * 0.25;
      b.addSphere(a.x, a.y, a.z, a.r, 8, [shade, shade * 0.95, shade * 0.9], 0.85);
      b.addSphere(a.x + a.r * 0.5, a.y + a.r * 0.3, a.z, a.r * 0.55, 6, [shade * 0.8, shade * 0.75, shade * 0.7], 0.8);
    }
    return b.build();
  }

  function createPlanetMesh() {
    const b = new MeshBuilder();
    b.addSphere(-2800, 700, -5200, 420, 12, [0.75, 0.45, 0.3], 1);
    b.addSphere(-2600, 900, -4900, 90, 8, [0.9, 0.85, 0.75], 1);
    b.addSphere(3200, 1500, -5600, 150, 10, [0.85, 0.88, 0.92], 1);
    return b.build();
  }

  function createLavaMesh(world) {
    const b = new MeshBuilder();
    const peak = world.PEAKS[0];
    const lava = [1.0, 0.35, 0.05];
    b.addSphere(peak.x, world.getTerrainHeight(peak.x, peak.z) + 6, peak.z, 160, 8, lava, 0.25);
    b.addSphere(peak.x + 500, world.getTerrainHeight(peak.x + 500, peak.z + 700) + 4, peak.z + 700, 120, 8, lava, 0.2);
    return b.build();
  }

  // ---------- Hangar showroom (aircraft selection screen only) ----------
  // Concrete apron with a painted parking pad, two hangar buildings,
  // a control tower, fuel tank, crates and lamp poles. The selected
  // aircraft stands on the pad and rotates slowly in front of it.
  function createHangarMesh() {
    const b = new MeshBuilder();
    const concrete = [0.3, 0.3, 0.33];
    const pad = [0.42, 0.42, 0.46];
    const hangarWall = [0.45, 0.47, 0.5];
    const hangarRoof = [0.33, 0.36, 0.4];
    const dark = [0.16, 0.17, 0.2];
    const teal = [0.1, 0.7, 0.65];
    const yellow = [0.95, 0.75, 0.2];
    const lamp = [1.0, 0.9, 0.6];
    b.addQuad([-110, 0, -110], [110, 0, -110], [110, 0, 110], [-110, 0, 110], [0, 1, 0], concrete);
    b.addQuad([-23, 0.08, -23], [23, 0.08, -23], [23, 0.08, 23], [-23, 0.08, 23], [0, 1, 0], pad);
    b.addQuad([-1, 0.14, -22], [1, 0.14, -22], [1, 0.14, 22], [-1, 0.14, 22], [0, 1, 0], yellow);
    b.addQuad([-22, 0.14, -1], [22, 0.14, -1], [22, 0.14, 1], [-22, 0.14, 1], [0, 1, 0], yellow);
    for (let i = -2; i <= 2; i++) {
      b.addBox(i * 10, 0.5, -23.5, 1, 1, 1, lamp);
      b.addBox(i * 10, 0.5, 23.5, 1, 1, 1, lamp);
    }
    b.addBox(0, 9, -62, 76, 18, 30, hangarWall);
    b.addTaperedBox(0, 21, -62, 76, 7, 30, 0.55, hangarRoof);
    b.addBox(0, 24.5, -62, 10, 2, 8, dark);
    b.addBox(0, 7, -46.8, 46, 14, 0.6, dark);
    b.addBox(0, 18.4, -46.8, 76, 1.2, 0.6, teal);
    b.addBox(-30, 7, -46.8, 4, 14, 0.7, teal);
    b.addBox(30, 7, -46.8, 4, 14, 0.7, teal);
    b.addBox(-88, 6, -50, 42, 12, 24, [0.4, 0.42, 0.46]);
    b.addTaperedBox(-88, 14, -50, 42, 5, 24, 0.55, hangarRoof);
    b.addBox(-88, 5, -37.8, 26, 10, 0.6, dark);
    b.addCylinderZ(78, 15, -48, 7, 30, 8, [0.55, 0.57, 0.6]);
    b.addBox(78, 31, -48, 20, 9, 20, [0.2, 0.3, 0.45]);
    b.addBox(78, 36.5, -48, 2, 2.5, 2, [1.0, 0.25, 0.25]);
    b.addCylinderZ(58, 4, 18, 5, 16, 10, [0.8, 0.8, 0.82]);
    b.addBox(58, 9.5, 18, 2, 1.2, 16, dark);
    b.addBox(-34, 2, 26, 5, 4, 5, [0.5, 0.38, 0.2]);
    b.addBox(-28, 1.5, 28, 4, 3, 4, [0.45, 0.5, 0.3]);
    b.addBox(-34, 5.5, 26, 3.5, 3, 3.5, [0.55, 0.42, 0.25]);
    b.addCylinderZ(40, 2, -20, 1.6, 4, 8, [0.7, 0.2, 0.15]);
    b.addCylinderZ(44, 2, -16, 1.6, 4, 8, [0.15, 0.45, 0.3]);
    const poleSpots = [[-30, -30], [30, -30], [-30, 30], [30, 30]];
    for (const [px, pz] of poleSpots) {
      b.addBox(px, 6, pz, 0.8, 12, 0.8, dark);
      b.addBox(px, 12.4, pz, 3.2, 1, 3.2, lamp);
    }
    b.addBox(-52, 7, 8, 0.7, 14, 0.7, dark);
    b.addBox(-49, 13.5, 8, 5, 1.4, 1.4, [1.0, 0.45, 0.1]);
    return b.build();
  }

  // ---------- Aircraft ----------
  // Each part: { data, hinge:[x,y,z], anim:'prop'|'gear'|'flapL'|'aileronL'|...|null }
  function part(data, hinge, anim) {
    return { data, hinge: hinge || [0, 0, 0], anim: anim || null };
  }

  function buildElang() {
    const white = [0.92, 0.93, 0.95], slate = [0.35, 0.4, 0.48], teal = [0.1, 0.7, 0.75], gold = [0.95, 0.75, 0.3];
    const dark = [0.15, 0.16, 0.2], glass = [0.15, 0.35, 0.5];
    const parts = {};
    const body = new MeshBuilder();
    body.addTaperedBox(0, 0, 0, 2.2, 1.6, 9.5, 0.35, white);
    body.addTaperedBox(0, 0.1, 3.2, 1.4, 1.1, 3.4, 0.15, slate);
    body.addBox(0, 0.55, 1.2, 1.1, 0.7, 2.6, glass);
    body.addBox(0, -0.5, -4.2, 1.8, 0.5, 1.2, dark);
    body.addBox(0, 0.35, -2.2, 0.4, 0.18, 4.5, gold);
    body.addBox(0, 0.35, 1.8, 0.5, 0.15, 2.2, teal);
    parts.body = part(body.build());
    const wingL = new MeshBuilder();
    wingL.addWing(0, -1.2, -5.4, -3.4, 3.2, 1.4, 0, 0.22, white);
    wingL.addBox(-5.2, 0.05, -3.3, 0.3, 0.1, 1.2, teal);
    parts.wingL = part(wingL.build());
    const wingR = new MeshBuilder();
    wingR.addWing(0, -1.2, 5.4, -3.4, 3.2, 1.4, 0, 0.22, white);
    wingR.addBox(5.2, 0.05, -3.3, 0.3, 0.1, 1.2, gold);
    parts.wingR = part(wingR.build());
    const ailL = new MeshBuilder();
    ailL.addWing(-2.2, 0.6, -5.2, -1.6, 1.0, 0.7, 0, 0.16, slate);
    parts.aileronL = part(ailL.build(), [-2.2, 0, 0.2], 'aileronL');
    const ailR = new MeshBuilder();
    ailR.addWing(2.2, 0.6, 5.2, -1.6, 1.0, 0.7, 0, 0.16, slate);
    parts.aileronR = part(ailR.build(), [2.2, 0, 0.2], 'aileronR');
    const flapL = new MeshBuilder();
    flapL.addWing(-0.4, 0.9, -2.1, 0.4, 1.1, 0.9, 0, 0.18, teal);
    parts.flapL = part(flapL.build(), [-0.4, 0, 0.5], 'flapL');
    const flapR = new MeshBuilder();
    flapR.addWing(0.4, 0.9, 2.1, 0.4, 1.1, 0.9, 0, 0.18, teal);
    parts.flapR = part(flapR.build(), [0.4, 0, 0.5], 'flapR');
    const canL = new MeshBuilder();
    canL.addWing(0, 2.6, -2.2, 1.6, 1.2, 0.6, 0.15, 0.14, slate);
    parts.canardL = part(canL.build());
    const canR = new MeshBuilder();
    canR.addWing(0, 2.6, 2.2, 1.6, 1.2, 0.6, 0.15, 0.14, slate);
    parts.canardR = part(canR.build());
    const tailL = new MeshBuilder();
    tailL.addBox(-0.9, 1.1, -4.3, 0.18, 2.2, 1.6, slate);
    parts.tailL = part(tailL.build());
    const tailR = new MeshBuilder();
    tailR.addBox(0.9, 1.1, -4.3, 0.18, 2.2, 1.6, slate);
    parts.tailR = part(tailR.build());
    const rud = new MeshBuilder();
    rud.addBox(0, 1.3, -4.9, 1.9, 1.6, 0.18, teal);
    parts.rudder = part(rud.build(), [0, 1.3, -4.4], 'rudder');
    const stabL = new MeshBuilder();
    stabL.addWing(0, -4.0, -2.6, -4.9, 1.4, 0.7, 0.2, 0.14, white);
    parts.stabL = part(stabL.build());
    const stabR = new MeshBuilder();
    stabR.addWing(0, -4.0, 2.6, -4.9, 1.4, 0.7, 0.2, 0.14, white);
    parts.stabR = part(stabR.build());
    const eleL = new MeshBuilder();
    eleL.addWing(-0.6, -3.2, -2.5, -4.0, 0.7, 0.5, 0.2, 0.12, slate);
    parts.elevatorL = part(eleL.build(), [-0.6, 0.2, -3.4], 'elevator');
    const eleR = new MeshBuilder();
    eleR.addWing(0.6, -3.2, 2.5, -4.0, 0.7, 0.5, 0.2, 0.12, slate);
    parts.elevatorR = part(eleR.build(), [0.6, 0.2, -3.4], 'elevator');
    const plumeL = new MeshBuilder();
    plumeL.addCylinderZ(-0.7, -0.1, -5.6, 0.55, 2.2, 8, [0.35, 0.75, 1.0]);
    parts.plumeL = part(plumeL.build(), [0, 0, 0], 'plume');
    const plumeR = new MeshBuilder();
    plumeR.addCylinderZ(0.7, -0.1, -5.6, 0.55, 2.2, 8, [0.35, 0.75, 1.0]);
    parts.plumeR = part(plumeR.build(), [0, 0, 0], 'plume');
    const gearN = new MeshBuilder();
    gearN.addBox(0, -1.35, 2.6, 0.18, 1.5, 0.18, dark);
    gearN.addCylinderZ(0, -2.1, 2.6, 0.28, 0.3, 8, [0.1, 0.1, 0.12]);
    parts.gearNose = part(gearN.build(), [0, 0, 0], 'gear');
    const gearL = new MeshBuilder();
    gearL.addBox(-1.1, -1.3, -0.6, 0.18, 1.4, 0.18, dark);
    gearL.addCylinderZ(-1.1, -2.0, -0.6, 0.3, 0.32, 8, [0.1, 0.1, 0.12]);
    parts.gearL = part(gearL.build(), [0, 0, 0], 'gear');
    const gearR = new MeshBuilder();
    gearR.addBox(1.1, -1.3, -0.6, 0.18, 1.4, 0.18, dark);
    gearR.addCylinderZ(1.1, -2.0, -0.6, 0.3, 0.32, 8, [0.1, 0.1, 0.12]);
    parts.gearR = part(gearR.build(), [0, 0, 0], 'gear');
    return parts;
  }

  function buildCendrawasih() {
    const crimson = [0.75, 0.15, 0.2], white = [0.95, 0.93, 0.9], orange = [1.0, 0.55, 0.15];
    const dark = [0.15, 0.16, 0.2], glass = [0.1, 0.3, 0.45];
    const parts = {};
    const body = new MeshBuilder();
    body.addTaperedBox(0, 0, 0, 1.8, 1.4, 11, 0.2, white);
    body.addTaperedBox(0, 0.05, 4.2, 0.9, 0.8, 3.2, 0.1, crimson);
    body.addBox(0, 0.5, 0.6, 1.0, 0.65, 2.8, glass);
    body.addBox(0, 0.3, -3.5, 0.5, 0.2, 5.5, orange);
    body.addBox(0, -0.4, -5.0, 1.4, 0.4, 1.0, dark);
    parts.body = part(body.build());
    const wingL = new MeshBuilder();
    wingL.addWing(0, 1.5, -4.6, -4.6, 5.2, 1.0, 0, 0.2, crimson);
    wingL.addBox(-4.4, 0.05, -4.5, 0.25, 0.1, 1.0, orange);
    parts.wingL = part(wingL.build());
    const wingR = new MeshBuilder();
    wingR.addWing(0, 1.5, 4.6, -4.6, 5.2, 1.0, 0, 0.2, crimson);
    wingR.addBox(4.4, 0.05, -4.5, 0.25, 0.1, 1.0, orange);
    parts.wingR = part(wingR.build());
    const ailL = new MeshBuilder();
    ailL.addWing(-1.8, -2.2, -4.4, -4.0, 1.6, 0.9, 0, 0.16, dark);
    parts.aileronL = part(ailL.build(), [-1.8, 0, -2.6], 'aileronL');
    const ailR = new MeshBuilder();
    ailR.addWing(1.8, -2.2, 4.4, -4.0, 1.6, 0.9, 0, 0.16, dark);
    parts.aileronR = part(ailR.build(), [1.8, 0, -2.6], 'aileronR');
    const flapL = new MeshBuilder();
    flapL.addWing(-0.3, -0.5, -1.7, -1.4, 1.6, 1.2, 0, 0.18, orange);
    parts.flapL = part(flapL.build(), [-0.3, 0, -0.8], 'flapL');
    const flapR = new MeshBuilder();
    flapR.addWing(0.3, -0.5, 1.7, -1.4, 1.6, 1.2, 0, 0.18, orange);
    parts.flapR = part(flapR.build(), [0.3, 0, -0.8], 'flapR');
    const tail = new MeshBuilder();
    tail.addBox(0, 1.4, -4.6, 0.2, 3.0, 2.0, crimson);
    parts.tailL = part(tail.build());
    const rud = new MeshBuilder();
    rud.addBox(0, 1.6, -5.4, 0.22, 2.2, 0.3, orange);
    parts.rudder = part(rud.build(), [0, 1.6, -5.0], 'rudder');
    const plume = new MeshBuilder();
    plume.addCylinderZ(0, -0.1, -6.4, 0.8, 3.0, 10, [0.4, 0.8, 1.0]);
    parts.plumeL = part(plume.build(), [0, 0, 0], 'plume');
    parts.plumeR = part(plume.build(), [0, 0, 0], 'plume');
    const gearN = new MeshBuilder();
    gearN.addBox(0, -1.3, 3.0, 0.18, 1.4, 0.18, dark);
    gearN.addCylinderZ(0, -2.0, 3.0, 0.26, 0.3, 8, [0.1, 0.1, 0.12]);
    parts.gearNose = part(gearN.build(), [0, 0, 0], 'gear');
    const gearL = new MeshBuilder();
    gearL.addBox(-1.0, -1.25, -1.0, 0.18, 1.3, 0.18, dark);
    gearL.addCylinderZ(-1.0, -1.9, -1.0, 0.28, 0.3, 8, [0.1, 0.1, 0.12]);
    parts.gearL = part(gearL.build(), [0, 0, 0], 'gear');
    const gearR = new MeshBuilder();
    gearR.addBox(1.0, -1.25, -1.0, 0.18, 1.3, 0.18, dark);
    gearR.addCylinderZ(1.0, -1.9, -1.0, 0.28, 0.3, 8, [0.1, 0.1, 0.12]);
    parts.gearR = part(gearR.build(), [0, 0, 0], 'gear');
    return parts;
  }

  function buildJalak() {
    const cream = [0.93, 0.9, 0.8], green = [0.15, 0.45, 0.3], brown = [0.5, 0.35, 0.2];
    const dark = [0.15, 0.16, 0.2], glass = [0.15, 0.35, 0.45];
    const parts = {};
    const body = new MeshBuilder();
    body.addTaperedBox(0, 0, 0, 2.4, 2.0, 8.5, 0.5, cream);
    body.addTaperedBox(0, 0, 3.4, 1.6, 1.5, 2.4, 0.3, green);
    body.addBox(0, 0.75, 0.8, 1.4, 0.8, 2.8, glass);
    body.addBox(0, -0.3, -3.8, 1.6, 0.6, 1.4, brown);
    body.addBox(0, 0.4, 2.2, 0.35, 0.15, 3.0, green);
    parts.body = part(body.build());
    const wingL = new MeshBuilder();
    wingL.addWing(0, -0.6, -6.2, -1.4, 2.4, 1.2, 0.9, 0.24, cream);
    wingL.addBox(-6.0, 0.95, -1.3, 0.3, 0.1, 1.0, green);
    parts.wingL = part(wingL.build());
    const wingR = new MeshBuilder();
    wingR.addWing(0, -0.6, 6.2, -1.4, 2.4, 1.2, 0.9, 0.24, cream);
    wingR.addBox(6.0, 0.95, -1.3, 0.3, 0.1, 1.0, green);
    parts.wingR = part(wingR.build());
    const ailL = new MeshBuilder();
    ailL.addWing(-2.4, -0.2, -6.0, -1.0, 1.0, 0.7, 0.9, 0.16, green);
    parts.aileronL = part(ailL.build(), [-2.4, 0.9, 0.1], 'aileronL');
    const ailR = new MeshBuilder();
    ailR.addWing(2.4, -0.2, 6.0, -1.0, 1.0, 0.7, 0.9, 0.16, green);
    parts.aileronR = part(ailR.build(), [2.4, 0.9, 0.1], 'aileronR');
    const flapL = new MeshBuilder();
    flapL.addWing(-0.4, 0.2, -2.3, -0.4, 1.1, 0.9, 0.9, 0.18, brown);
    parts.flapL = part(flapL.build(), [-0.4, 0.9, 0.0], 'flapL');
    const flapR = new MeshBuilder();
    flapR.addWing(0.4, 0.2, 2.3, -0.4, 1.1, 0.9, 0.9, 0.18, brown);
    parts.flapR = part(flapR.build(), [0.4, 0.9, 0.0], 'flapR');
    const stabL = new MeshBuilder();
    stabL.addWing(0, -3.6, -2.8, -4.4, 1.5, 0.8, 0.3, 0.16, cream);
    parts.stabL = part(stabL.build());
    const stabR = new MeshBuilder();
    stabR.addWing(0, -3.6, 2.8, -4.4, 1.5, 0.8, 0.3, 0.16, cream);
    parts.stabR = part(stabR.build());
    const eleL = new MeshBuilder();
    eleL.addWing(-0.6, -2.9, -2.7, -3.6, 0.7, 0.5, 0.3, 0.14, green);
    parts.elevatorL = part(eleL.build(), [-0.6, 0.3, -3.1], 'elevator');
    const eleR = new MeshBuilder();
    eleR.addWing(0.6, -2.9, 2.7, -3.6, 0.7, 0.5, 0.3, 0.14, green);
    parts.elevatorR = part(eleR.build(), [0.6, 0.3, -3.1], 'elevator');
    const tail = new MeshBuilder();
    tail.addBox(0, 1.2, -3.9, 0.2, 2.4, 1.8, green);
    parts.tailL = part(tail.build());
    const rud = new MeshBuilder();
    rud.addBox(0, 1.4, -4.6, 0.22, 1.8, 0.3, brown);
    parts.rudder = part(rud.build(), [0, 1.4, -4.2], 'rudder');
    const prop = new MeshBuilder();
    prop.addCylinderZ(0, 0, 4.9, 0.35, 0.8, 8, dark);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const dx = Math.cos(a), dy = Math.sin(a);
      const bx = dx * 1.9, by = dy * 1.9;
      prop.addBox(bx * 0.55, by * 0.55, 5.2, Math.abs(dx) > 0.5 ? 1.9 : 0.35, Math.abs(dy) > 0.5 ? 1.9 : 0.35, 0.12, dark);
    }
    parts.prop = part(prop.build(), [0, 0, 4.9], 'prop');
    const gearN = new MeshBuilder();
    gearN.addBox(0, -1.4, 2.4, 0.2, 1.6, 0.2, dark);
    gearN.addCylinderZ(0, -2.2, 2.4, 0.3, 0.32, 8, [0.1, 0.1, 0.12]);
    parts.gearNose = part(gearN.build(), [0, 0, 0], 'gear');
    const gearL = new MeshBuilder();
    gearL.addBox(-1.35, -1.35, -0.4, 0.2, 1.5, 0.2, dark);
    gearL.addCylinderZ(-1.35, -2.1, -0.4, 0.32, 0.34, 8, [0.1, 0.1, 0.12]);
    parts.gearL = part(gearL.build(), [0, 0, 0], 'gear');
    const gearR = new MeshBuilder();
    gearR.addBox(1.35, -1.35, -0.4, 0.2, 1.5, 0.2, dark);
    gearR.addCylinderZ(1.35, -2.1, -0.4, 0.32, 0.34, 8, [0.1, 0.1, 0.12]);
    parts.gearR = part(gearR.build(), [0, 0, 0], 'gear');
    return parts;
  }

  function createAircraftMesh(specId) {
    if (specId === 'cendrawasih') return buildCendrawasih();
    if (specId === 'jalak') return buildJalak();
    return buildElang();
  }

  global.AerovantMeshes = {
    MeshBuilder,
    createTerrainMesh,
    createWaterMesh,
    createCityMesh,
    createAirfieldMesh,
    createRingMesh,
    createCloudMesh,
    createAsteroidMesh,
    createPlanetMesh,
    createLavaMesh,
    createHangarMesh,
    createAircraftMesh
  };
})(window);
