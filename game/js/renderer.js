/**
 * renderer.js - Custom WebGL renderer for AEROVANT.
 * Terrain, water, city, airfield, rings, clouds, asteroids, planet/moon,
 * lava, particles, speed streaks, and the selected aircraft (banking,
 * pitch, spinning propeller, gear, flaps, control surfaces, plumes).
 * Menu draws the hangar showroom. Indices are Uint16 (WebGL1-safe).
 * Map fields are objects: sky {zenith, mid, horizon}, sun, sunColor,
 * fog {color, density}. World meshes are rebuilt on every map change.
 * AEROVANT revision v15 - hangar showroom ambient 0.62 -> 0.64.
 */
(function (global) {
  'use strict';

  const M = global.AerovantMath;
  const Meshes = global.AerovantMeshes;

  function Renderer(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
    this.cloudMesh = null;
    this.ringMeshes = [];
    this.asteroidMesh = null;
    this.planetMesh = null;
    this.lavaMesh = null;
    this.hangarGL = null;
    this.aircraftParts = null;
    this.aircraftGL = {};
    this.cameraMode = 'chase';
    this.camPos = [0, 30, -480];
    this.camTarget = [0, 20, -600];
    this.propAngle = 0;
    this.streaks = [];
    this.ambientParticles = [];
    this.ambientType = 'none';
    if (!this.gl) return;
    this._initShaders();
    this._initMeshes();
  }

  Renderer.prototype._compileShader = function (type, src) {
    const gl = this.gl;
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(sh));
    }
    return sh;
  };

  Renderer.prototype._linkProgram = function (vsSrc, fsSrc) {
    const gl = this.gl;
    const prog = gl.createProgram();
    gl.attachShader(prog, this._compileShader(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(prog, this._compileShader(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(prog));
    }
    return prog;
  };

  Renderer.prototype._initShaders = function () {
    const gl = this.gl;
    this.prog = this._linkProgram(
      'attribute vec3 aPos; attribute vec3 aNormal; attribute vec3 aColor; ' +
      'uniform mat4 uModel; uniform mat4 uView; uniform mat4 uProj; ' +
      'varying vec3 vNormal; varying vec3 vColor; varying vec3 vWorld; ' +
      'void main(){ vec4 wp = uModel * vec4(aPos, 1.0); vWorld = wp.xyz; ' +
      'vNormal = normalize(mat3(uModel) * aNormal); vColor = aColor; ' +
      'gl_Position = uProj * uView * wp; }',
      'precision mediump float; ' +
      'varying vec3 vNormal; varying vec3 vColor; varying vec3 vWorld; ' +
      'uniform vec3 uSunDir; uniform vec3 uFogColor; uniform float uFogDensity; ' +
      'uniform float uAmbient; uniform float uUnlit; uniform float uGlow; uniform float uTime; ' +
      'uniform vec3 uCamPos; ' +
      'void main(){ ' +
      'vec3 n = normalize(vNormal); vec3 sun = normalize(uSunDir); ' +
      'float diff = max(dot(n, sun), 0.0); ' +
      'float hemi = 0.5 + 0.5 * n.y; ' +
      'vec3 col = vColor * (uAmbient + diff * 0.85) + vColor * hemi * 0.2; ' +
      'if (uGlow > 0.0) { col += vColor * (0.55 + 0.35 * sin(uTime * 2.2)); } ' +
      'if (uUnlit > 0.5) { col = vColor; } ' +
      'float dist = length(vWorld - uCamPos); ' +
      'float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist); ' +
      'col = mix(col, uFogColor, clamp(fog, 0.0, 1.0)); ' +
      'gl_FragColor = vec4(col, 1.0); }'
    );
    this.uModel = gl.getUniformLocation(this.prog, 'uModel');
    this.uView = gl.getUniformLocation(this.prog, 'uView');
    this.uProj = gl.getUniformLocation(this.prog, 'uProj');
    this.uSunDir = gl.getUniformLocation(this.prog, 'uSunDir');
    this.uFogColor = gl.getUniformLocation(this.prog, 'uFogColor');
    this.uFogDensity = gl.getUniformLocation(this.prog, 'uFogDensity');
    this.uAmbient = gl.getUniformLocation(this.prog, 'uAmbient');
    this.uUnlit = gl.getUniformLocation(this.prog, 'uUnlit');
    this.uGlow = gl.getUniformLocation(this.prog, 'uGlow');
    this.uTime = gl.getUniformLocation(this.prog, 'uTime');
    this.uCamPos = gl.getUniformLocation(this.prog, 'uCamPos');
    this.skyProg = this._linkProgram(
      'attribute vec3 aPos; attribute vec3 aDir; varying vec3 vDir; ' +
      'void main(){ vDir = aDir; vec4 p = vec4(aPos, 1.0); gl_Position = p.xyww; }',
      'precision mediump float; varying vec3 vDir; ' +
      'uniform vec3 uZenith; uniform vec3 uMid; uniform vec3 uHorizon; ' +
      'uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uStars; ' +
      'float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); } ' +
      'void main(){ vec3 d = normalize(vDir); float h = d.y; ' +
      'vec3 col = h > 0.15 ? mix(uMid, uZenith, smoothstep(0.15, 0.7, h)) : ' +
      'mix(uHorizon, uMid, smoothstep(-0.05, 0.15, h)); ' +
      'float sunAmt = max(dot(d, normalize(uSunDir)), 0.0); ' +
      'col += uSunColor * (pow(sunAmt, 220.0) * 1.4 + pow(sunAmt, 8.0) * 0.25); ' +
      'if (uStars > 0.5 && h > -0.05) { ' +
      'vec3 cell = floor(d * 220.0); float s = hash(cell); ' +
      'if (s > 0.99) { col += vec3(1.0, 1.0, 1.1) * smoothstep(0.99, 0.998, s) * 1.2; } } ' +
      'gl_FragColor = vec4(col, 1.0); }'
    );
    this.uSkyZenith = gl.getUniformLocation(this.skyProg, 'uZenith');
    this.uSkyMid = gl.getUniformLocation(this.skyProg, 'uMid');
    this.uSkyHorizon = gl.getUniformLocation(this.skyProg, 'uHorizon');
    this.uSkySunDir = gl.getUniformLocation(this.skyProg, 'uSunDir');
    this.uSkySunColor = gl.getUniformLocation(this.skyProg, 'uSunColor');
    this.uSkyStars = gl.getUniformLocation(this.skyProg, 'uStars');
    this.skyPosLoc = gl.getAttribLocation(this.skyProg, 'aPos');
    this.skyDirLoc = gl.getAttribLocation(this.skyProg, 'aDir');
    const skyVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, skyVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0
    ]), gl.STATIC_DRAW);
    this.skyVbo = skyVbo;
    this.skyDirVbo = gl.createBuffer();
  };

  function makeGLMesh(gl, data) {
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const verts = new Float32Array(data.positions.length * 3);
    for (let i = 0; i < data.positions.length / 3; i++) {
      verts[i * 9] = data.positions[i * 3];
      verts[i * 9 + 1] = data.positions[i * 3 + 1];
      verts[i * 9 + 2] = data.positions[i * 3 + 2];
      verts[i * 9 + 3] = data.normals[i * 3];
      verts[i * 9 + 4] = data.normals[i * 3 + 1];
      verts[i * 9 + 5] = data.normals[i * 3 + 2];
      verts[i * 9 + 6] = data.colors[i * 3];
      verts[i * 9 + 7] = data.colors[i * 3 + 1];
      verts[i * 9 + 8] = data.colors[i * 3 + 2];
    }
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
    return { vbo, ibo, count: data.indices.length };
  }

  Renderer.prototype._freeMesh = function (mesh) {
    if (!mesh) return;
    const gl = this.gl;
    gl.deleteBuffer(mesh.vbo);
    gl.deleteBuffer(mesh.ibo);
  };

  Renderer.prototype.rebuildWorld = function () {
    const gl = this.gl;
    const world = global.AerovantWorld;
    this._freeMesh(this.terrainGL);
    this._freeMesh(this.waterGL);
    this._freeMesh(this.cityGL);
    this._freeMesh(this.airfieldGL);
    this._freeMesh(this.asteroidMesh);
    this._freeMesh(this.planetMesh);
    this._freeMesh(this.lavaMesh);
    this.terrainGL = makeGLMesh(gl, Meshes.createTerrainMesh(world));
    this.waterGL = makeGLMesh(gl, Meshes.createWaterMesh(world));
    this.cityGL = makeGLMesh(gl, Meshes.createCityMesh(world));
    this.airfieldGL = makeGLMesh(gl, Meshes.createAirfieldMesh(world));
    this.asteroidMesh = makeGLMesh(gl, Meshes.createAsteroidMesh(world));
    this.planetMesh = makeGLMesh(gl, Meshes.createPlanetMesh());
    this.lavaMesh = makeGLMesh(gl, Meshes.createLavaMesh(world));
  };

  Renderer.prototype._initMeshes = function () {
    const gl = this.gl;
    this.rebuildWorld();
    this.cloudMesh = makeGLMesh(gl, Meshes.createCloudMesh());
    this.hangarGL = makeGLMesh(gl, Meshes.createHangarMesh());
    this._buildParticles();
    this.ringMeshes = [];
  };

  Renderer.prototype.setCourse = function (course) {
    const gl = this.gl;
    this.ringMeshes = [];
    for (const ring of course) {
      this.ringMeshes.push(makeGLMesh(gl, Meshes.createRingMesh(global.AerovantWorld, [ring])));
    }
  };

  Renderer.prototype.setAircraft = function (specId) {
    const gl = this.gl;
    this.aircraftParts = Meshes.createAircraftMesh(specId);
    this.aircraftGL = {};
    for (const key in this.aircraftParts) {
      this.aircraftGL[key] = makeGLMesh(gl, this.aircraftParts[key].data);
    }
  };

  Renderer.prototype._buildParticles = function () {
    const gl = this.gl;
    const vbo = gl.createBuffer();
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    const idx = new Uint16Array(240 * 6);
    for (let i = 0; i < 240; i++) {
      const b = i * 4;
      idx[i * 6] = b; idx[i * 6 + 1] = b + 1; idx[i * 6 + 2] = b + 2;
      idx[i * 6 + 3] = b; idx[i * 6 + 4] = b + 2; idx[i * 6 + 5] = b + 3;
    }
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    this.particleVbo = vbo;
    this.particleIbo = ibo;
    for (let i = 0; i < 240; i++) {
      this.ambientParticles.push({ x: 0, y: 0, z: 0, size: 0.6, fall: 0, drift: 0 });
    }
    for (let i = 0; i < 120; i++) {
      this.streaks.push({ x: 0, y: 0, z: 0, size: 0.15, life: 0 });
    }
  };

  Renderer.prototype.setAmbient = function (type) {
    this.ambientType = type || 'none';
    for (let i = 0; i < this.ambientParticles.length; i++) {
      const p = this.ambientParticles[i];
      p.x = (Math.random() - 0.5) * 400;
      p.y = Math.random() * 200 - 40;
      p.z = (Math.random() - 0.5) * 400;
      p.size = 0.5 + Math.random() * 0.8;
      p.fall = 4 + Math.random() * 8;
      p.drift = (Math.random() - 0.5) * 6;
    }
  };

  Renderer.prototype.resize = function () {
    const w = this.canvas.clientWidth || 1280;
    const h = this.canvas.clientHeight || 800;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  };

  Renderer.prototype.project = function (worldPos) {
    const gl = this.gl;
    const w = this.canvas.width, h = this.canvas.height;
    const v = M.Mat4.multiplyVec4(this.proj, M.Mat4.multiplyVec4(this.view, [worldPos[0], worldPos[1], worldPos[2], 1]));
    if (v[3] <= 0) return null;
    const x = (v[0] / v[3] * 0.5 + 0.5) * w;
    const y = (1 - (v[1] / v[3] * 0.5 + 0.5)) * h;
    return { x, y, z: v[2] / v[3] };
  };

  Renderer.prototype._drawMesh = function (mesh, model, unlit) {
    if (!mesh) return;
    const gl = this.gl;
    gl.uniformMatrix4fv(this.uModel, false, model);
    gl.uniform1f(this.uUnlit, unlit ? 1 : 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 36, 12);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 36, 24);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  };

  Renderer.prototype._partMatrix = function (acMat, hinge, rotAxis, angle, translate, scale) {
    const m = M.Mat4.identity();
    if (translate) {
      M.Mat4.translate(m, translate[0], translate[1], translate[2], m);
    }
    if (hinge) {
      M.Mat4.translate(m, hinge[0], hinge[1], hinge[2], m);
      if (rotAxis === 'x') M.Mat4.rotateX(m, angle, m);
      else if (rotAxis === 'y') M.Mat4.rotateY(m, angle, m);
      else M.Mat4.rotateZ(m, angle, m);
      M.Mat4.translate(m, -hinge[0], -hinge[1], -hinge[2], m);
    }
    if (scale) {
      M.Mat4.scale(m, scale[0], scale[1], scale[2], m);
    }
    return M.Mat4.multiply(acMat, m);
  };

  // True 3D ray directions for the four sky-quad corners, from the
  // current camera (fwd/right/up basis, 58 deg FOV). The old code fed
  // the shader the 2D quad position (z=0), which made every "star" an
  // angular wedge radiating from the screen centre (white lines in the
  // space sky). With real directions, stars are dots and the sun
  // tracks the camera.
  Renderer.prototype._updateSkyDirs = function (aspect) {
    const gl = this.gl;
    const fwd = M.Vec3.normalize(M.Vec3.sub(this.camTarget, this.camPos));
    let right = M.Vec3.cross(fwd, [0, 1, 0]);
    const rl = Math.hypot(right[0], right[1], right[2]);
    right = rl < 0.001 ? [1, 0, 0] : [right[0] / rl, right[1] / rl, right[2] / rl];
    const upv = M.Vec3.cross(right, fwd);
    const tanH = Math.tan(29 * Math.PI / 180);
    const tanW = tanH * aspect;
    const dirs = new Float32Array(12);
    const sx = [-1, 1, -1, 1];
    const sy = [-1, -1, 1, 1];
    for (let i = 0; i < 4; i++) {
      dirs[i * 3] = fwd[0] + right[0] * tanW * sx[i] + upv[0] * tanH * sy[i];
      dirs[i * 3 + 1] = fwd[1] + right[1] * tanW * sx[i] + upv[1] * tanH * sy[i];
      dirs[i * 3 + 2] = fwd[2] + right[2] * tanW * sx[i] + upv[2] * tanH * sy[i];
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyDirVbo);
    gl.bufferData(gl.ARRAY_BUFFER, dirs, gl.DYNAMIC_DRAW);
  };

  Renderer.prototype.render = function (state, flight, rings, nextRingIndex, time) {
    const gl = this.gl;
    if (!gl) return;
    const world = global.AerovantWorld;
    const map = world.getMap();
    const dt = 1 / 60;
    const hangarMode = state.screen === 'MENU';
    this.resize();
    gl.clearColor(map.fog.color[0], map.fog.color[1], map.fog.color[2], 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    const aspect = this.canvas.width / this.canvas.height;
    this.proj = M.Mat4.perspective(58 * Math.PI / 180, aspect, 0.5, 12000);
    this._updateCamera(state, flight);
    this.view = M.Mat4.lookAt(this.camPos, this.camTarget, [0, 1, 0], M.Mat4.identity());
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.skyProg);
    gl.uniform3fv(this.uSkyZenith, map.sky.zenith);
    gl.uniform3fv(this.uSkyMid, map.sky.mid);
    gl.uniform3fv(this.uSkyHorizon, map.sky.horizon);
    gl.uniform3fv(this.uSkySunDir, map.sun);
    gl.uniform3fv(this.uSkySunColor, map.sunColor);
    gl.uniform1f(this.uSkyStars, map.stars ? 1 : 0);
    this._updateSkyDirs(aspect);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyVbo);
    gl.enableVertexAttribArray(this.skyPosLoc);
    gl.vertexAttribPointer(this.skyPosLoc, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyDirVbo);
    gl.enableVertexAttribArray(this.skyDirLoc);
    gl.vertexAttribPointer(this.skyDirLoc, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(this.skyPosLoc);
    gl.disableVertexAttribArray(this.skyDirLoc);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(this.uView, false, this.view);
    gl.uniformMatrix4fv(this.uProj, false, this.proj);
    gl.uniform1f(this.uTime, time);
    gl.uniform3fv(this.uCamPos, this.camPos);
    const identity = M.Mat4.identity();
    if (hangarMode) {
      gl.uniform3fv(this.uSunDir, [0.4, 0.8, 0.45]);
      gl.uniform3fv(this.uFogColor, map.fog.color);
      gl.uniform1f(this.uFogDensity, 0.00005);
      gl.uniform1f(this.uAmbient, 0.64);
      this._drawMesh(this.hangarGL, identity, false);
    } else {
      gl.uniform3fv(this.uSunDir, map.sun);
      gl.uniform3fv(this.uFogColor, map.fog.color);
      gl.uniform1f(this.uFogDensity, map.fog.density);
      gl.uniform1f(this.uAmbient, map.id === 'antariksa' ? 0.42 : map.id === 'kawah' ? 0.45 : 0.5);
      if (map.id === 'antariksa') {
        this._drawMesh(this.terrainGL, identity, false);
        this._drawMesh(this.asteroidMesh, identity, false);
        this._drawMesh(this.planetMesh, identity, true);
      } else {
        this._drawMesh(this.terrainGL, identity, false);
        this._drawMesh(this.waterGL, identity, false);
        this._drawMesh(this.cityGL, identity, false);
        this._drawMesh(this.airfieldGL, identity, false);
        if (map.id === 'kawah') {
          gl.uniform1f(this.uGlow, 1);
          this._drawMesh(this.lavaMesh, identity, true);
          gl.uniform1f(this.uGlow, 0);
        }
        this._drawMesh(this.cloudMesh, identity, true);
      }
      // Rings: vertices already hold world coords, so pulse about the
      // ring's own centre: T(ring) * S(pulse) * T(-ring). (The old code
      // translated by the ring pos again and drew every ring at twice
      // its position, invisible near the plane.)
      for (let i = 0; i < rings.length; i++) {
        const ring = rings[i];
        const isNext = i === nextRingIndex;
        const pulse = 1 + (isNext ? 0.25 * Math.sin(time * 4) : 0);
        const m = M.Mat4.translate(M.Mat4.identity(), ring.x, ring.y, ring.z);
        M.Mat4.scale(m, pulse, pulse, pulse, m);
        M.Mat4.translate(m, -ring.x, -ring.y, -ring.z, m);
        this._drawMesh(this.ringMeshes[i], m, isNext ? 1 : 0);
      }
    }
    if (this.cameraMode !== 'cockpit' || state.showAircraftInCockpit) {
      let acMat;
      if (hangarMode) {
        const yaw = (state.menuTime || 0) * 0.35;
        acMat = M.Quat.toMat4(M.Quat.fromEulerYXZ(yaw, 0, 0), [0, 2.4, 0], M.Mat4.identity());
        M.Mat4.rotateY(acMat, Math.PI, acMat);
      } else {
        acMat = M.Quat.toMat4(flight.quat, flight.pos, M.Mat4.identity());
        M.Mat4.rotateY(acMat, Math.PI, acMat);
      }
      const thr = flight.throttle;
      const gearPos = flight.gearPos;
      const flapPos = flight.flapPos;
      const ail = flight.aileronDeflect;
      const ele = flight.elevatorDeflect;
      const rud = flight.rudderDeflect;
      if (this.aircraftParts) {
        for (const key in this.aircraftParts) {
          const p = this.aircraftParts[key];
          let mat = acMat;
          if (p.anim === 'prop') {
            this.propAngle += dt * (2 + thr * 0.35);
            mat = this._partMatrix(acMat, p.hinge, 'z', this.propAngle, null, null);
          } else if (p.anim === 'gear') {
            const slide = (1 - gearPos) * 1.6;
            mat = this._partMatrix(acMat, null, null, 0, [0, slide, 0], [1, Math.max(0.05, gearPos), 1]);
          } else if (p.anim === 'flapL' || p.anim === 'flapR') {
            mat = this._partMatrix(acMat, p.hinge, 'x', -flapPos * 0.6, null, null);
          } else if (p.anim === 'aileronL') {
            mat = this._partMatrix(acMat, p.hinge, 'x', ail * 0.5, null, null);
          } else if (p.anim === 'aileronR') {
            mat = this._partMatrix(acMat, p.hinge, 'x', -ail * 0.5, null, null);
          } else if (p.anim === 'elevator') {
            mat = this._partMatrix(acMat, p.hinge, 'x', ele * 0.5, null, null);
          } else if (p.anim === 'rudder') {
            mat = this._partMatrix(acMat, p.hinge, 'y', -rud * 0.5, null, null);
          } else if (p.anim === 'plume') {
            const s = 0.15 + thr * 0.015;
            mat = this._partMatrix(acMat, [0, 0, -4.8], null, 0, null, [1, 1, s]);
          }
          this._drawMesh(this.aircraftGL[key], mat, key.indexOf('plume') === 0 ? 1 : 0);
        }
      }
    }
    if (!hangarMode) this._drawParticles(state, flight, dt);
  };

  Renderer.prototype._drawParticles = function (state, flight, dt) {
    const gl = this.gl;
    const cam = this.camPos;
    const verts = new Float32Array(240 * 4 * 9);
    let count = 0;
    const type = this.ambientType;
    if (type !== 'none') {
      const col = type === 'snow' ? [0.95, 0.97, 1.0] : type === 'ash' ? [0.4, 0.38, 0.36] : [0.9, 0.85, 0.7];
      for (let i = 0; i < this.ambientParticles.length; i++) {
        const p = this.ambientParticles[i];
        p.y -= p.fall * dt;
        p.x += p.drift * dt;
        if (p.y < cam[1] - 80) {
          p.y = cam[1] + 120;
          p.x = cam[0] + (Math.random() - 0.5) * 400;
          p.z = cam[2] + (Math.random() - 0.5) * 400;
        }
        if (p.x < cam[0] - 200) p.x = cam[0] + 200;
        if (p.x > cam[0] + 200) p.x = cam[0] - 200;
        if (p.z < cam[2] - 200) p.z = cam[2] + 200;
        if (p.z > cam[2] + 200) p.z = cam[2] - 200;
        const s = p.size;
        const v = count * 36;
        const corners = [
          [p.x - s, p.y - s, p.z], [p.x + s, p.y - s, p.z],
          [p.x + s, p.y + s, p.z], [p.x - s, p.y + s, p.z]
        ];
        for (let c = 0; c < 4; c++) {
          verts[v + c * 9] = corners[c][0];
          verts[v + c * 9 + 1] = corners[c][1];
          verts[v + c * 9 + 2] = corners[c][2];
          verts[v + c * 9 + 3] = 0; verts[v + c * 9 + 4] = 0; verts[v + c * 9 + 5] = 1;
          verts[v + c * 9 + 6] = col[0]; verts[v + c * 9 + 7] = col[1]; verts[v + c * 9 + 8] = col[2];
        }
        count++;
      }
    }
    const speed = flight.speed;
    if (speed > 130) {
      const streakCount = Math.min(120, Math.floor((speed - 130) * 1.5));
      for (let i = 0; i < streakCount; i++) {
        const s = this.streaks[i];
        if (s.life <= 0) {
          s.life = 0.5 + Math.random() * 0.5;
          const a = Math.random() * Math.PI * 2;
          const r = 4 + Math.random() * 14;
          s.x = flight.pos[0] + Math.cos(a) * r;
          s.y = flight.pos[1] + (Math.random() - 0.5) * 16;
          s.z = flight.pos[2] + Math.sin(a) * r;
          s.size = 0.12 + Math.random() * 0.2;
        }
        s.life -= dt;
        const fwd = M.Quat.rotateVec3(flight.quat, [0, 0, -1]);
        const len = 2 + speed * 0.06;
        const v = count * 36;
        const px = s.x, py = s.y, pz = s.z;
        const qx = s.x + fwd[0] * len, qy = s.y + fwd[1] * len, qz = s.z + fwd[2] * len;
        const w = s.size;
        const corners = [
          [px - w, py, pz], [qx - w, qy, qz], [qx + w, qy, qz], [px + w, py, pz]
        ];
        for (let c = 0; c < 4; c++) {
          verts[v + c * 9] = corners[c][0];
          verts[v + c * 9 + 1] = corners[c][1];
          verts[v + c * 9 + 2] = corners[c][2];
          verts[v + c * 9 + 3] = 0; verts[v + c * 9 + 4] = 0; verts[v + c * 9 + 5] = 1;
          verts[v + c * 9 + 6] = 0.9; verts[v + c * 9 + 7] = 0.95; verts[v + c * 9 + 8] = 1.0;
        }
        count++;
      }
    }
    if (count === 0) return;
    gl.uniformMatrix4fv(this.uModel, false, M.Mat4.identity());
    gl.uniform1f(this.uUnlit, 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleVbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.particleIbo);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 36, 12);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 36, 24);
    gl.drawElements(gl.TRIANGLES, count * 6, gl.UNSIGNED_SHORT, 0);
  };

  Renderer.prototype._updateCamera = function (state, flight) {
    const dt = 1 / 60;
    const pos = flight.pos;
    const forward = M.Quat.rotateVec3(flight.quat, [0, 0, -1]);
    const up = M.Quat.rotateVec3(flight.quat, [0, 1, 0]);
    let targetPos, targetLook;
    if (this.cameraMode === 'cockpit') {
      targetPos = [pos[0] + up[0] * 0.96, pos[1] + up[1] * 0.96 + 0.1, pos[2] + up[2] * 0.96];
      targetPos[0] += forward[0] * -2.05;
      targetPos[1] += forward[1] * -2.05;
      targetPos[2] += forward[2] * -2.05;
      targetLook = [pos[0] + forward[0] * 60, pos[1] + forward[1] * 60, pos[2] + forward[2] * 60];
      this.camPos = targetPos;
      this.camTarget = targetLook;
    } else if (this.cameraMode === 'hangar') {
      const drift = Math.sin((state.menuTime || 0) * 0.2) * 1.2;
      this.camPos = [6 + drift, 2.5, 13];
      this.camTarget = [0, 1.0, 0];
    } else if (this.cameraMode === 'orbit') {
      const t = state.menuTime || 0;
      const cx = Math.cos(t * 0.08) * 60;
      const cz = -480 + Math.sin(t * 0.08) * 60;
      targetPos = [cx, 45, cz];
      targetLook = [0, 20, -480];
      const k = 1 - Math.exp(-2.5 * dt);
      this.camPos = M.lerpVec(this.camPos, targetPos, k);
      this.camTarget = M.lerpVec(this.camTarget, targetLook, k);
    } else {
      const dist = 19 + flight.speed * 0.035;
      const height = 4.8 + flight.speed * 0.008;
      targetPos = [
        pos[0] - forward[0] * dist + up[0] * height,
        pos[1] - forward[1] * dist + up[1] * height,
        pos[2] - forward[2] * dist + up[2] * height
      ];
      targetLook = [
        pos[0] + forward[0] * 26,
        pos[1] + forward[1] * 26,
        pos[2] + forward[2] * 26
      ];
      const k = 1 - Math.exp(-6 * dt);
      this.camPos = M.lerpVec(this.camPos, targetPos, k);
      this.camTarget = M.lerpVec(this.camTarget, targetLook, k);
    }
  };

  global.AerovantRenderer = Renderer;
})(window);
