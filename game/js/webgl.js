// AEROVANT — Pure WebGL2 3D Rendering Engine

window.AeroGL = (() => {
  let gl = null;
  let canvas = null;
  const programs = {};

  function init(canvasEl) {
    canvas = canvasEl;
    gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
    if (!gl) {
      throw new Error('WebGL2 tidak didukung di browser ini.');
    }
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    buildShaders();
    resize();
    return gl;
  }

  function resize() {
    if (!canvas || !gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('Shader error: ' + log);
    }
    return s;
  }

  function createProgram(vsSrc, fsSrc) {
    const vs = compileShader(gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + gl.getProgramInfoLog(p));
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return p;
  }

  function buildShaders() {
    // 1. Lit World & Aircraft Shader
    const litVS = `#version 300 es
      layout(location = 0) in vec3 aPos;
      layout(location = 1) in vec3 aNorm;
      layout(location = 2) in vec3 aCol;

      uniform mat4 uProj;
      uniform mat4 uView;
      uniform mat4 uModel;
      uniform mat3 uNormalMat;

      out vec3 vWorldPos;
      out vec3 vNormal;
      out vec3 vColor;

      void main() {
        vec4 wp = uModel * vec4(aPos, 1.0);
        vWorldPos = wp.xyz;
        vNormal = normalize(uNormalMat * aNorm);
        vColor = aCol;
        gl_Position = uProj * uView * wp;
      }
    `;

    const litFS = `#version 300 es
      precision highp float;
      in vec3 vWorldPos;
      in vec3 vNormal;
      in vec3 vColor;

      uniform vec3 uCamPos;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uSkyColor;
      uniform vec3 uGroundColor;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform float uSpecular;
      uniform vec3 uEmissive;

      out vec4 fragColor;

      float hash31(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash31(i);
        float b = hash31(i + vec2(1.0, 0.0));
        float c = hash31(i + vec2(0.0, 1.0));
        float d = hash31(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        vec3 N = normalize(vNormal);
        vec3 L = normalize(uSunDir);
        vec3 V = normalize(uCamPos - vWorldPos);
        vec3 H = normalize(L + V);

        // Micro-detail surface grain for semi-realistic terrain & matte surfaces
        float micro = vnoise(vWorldPos.xz * 0.14) * 0.65 + vnoise(vWorldPos.xz * 0.52) * 0.35;
        float grain = mix(1.0, 0.84 + micro * 0.32, 1.0 - clamp(uSpecular, 0.0, 1.0));

        float ndl = max(dot(N, L), 0.0);
        float hemi = N.y * 0.5 + 0.5;
        vec3 ambient = mix(uGroundColor, uSkyColor, hemi) * 0.55;
        vec3 diffuse = uSunColor * ndl * 0.92;
        float shininess = mix(24.0, 96.0, clamp(uSpecular, 0.0, 1.0));
        float spec = pow(max(dot(N, H), 0.0), shininess) * uSpecular * (0.35 + 0.85 * ndl);
        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0) * uSpecular * 0.45;

        vec3 envRefl = mix(uGroundColor, uSkyColor, clamp(reflect(-V, N).y * 0.5 + 0.5, 0.0, 1.0));
        vec3 col = (vColor * grain) * (ambient + diffuse) + vec3(spec) * uSunColor + envRefl * fresnel + uEmissive;

        float dist = length(uCamPos - vWorldPos);
        float fog = 1.0 - exp(-pow(dist * uFogDensity, 1.35));
        fog = clamp(fog, 0.0, 1.0);
        col = mix(col, uFogColor, fog);

        fragColor = vec4(col, 1.0);
      }
    `;
    programs.lit = createProgram(litVS, litFS);

    // 2. Water / Lava Shader
    const waterVS = `#version 300 es
      layout(location = 0) in vec3 aPos;
      uniform mat4 uProj;
      uniform mat4 uView;
      uniform mat4 uModel;
      uniform float uTime;
      out vec3 vWorldPos;

      void main() {
        vec4 wp = uModel * vec4(aPos, 1.0);
        wp.y += sin(wp.x * 0.045 + uTime * 1.6) * 0.25 + cos(wp.z * 0.05 + uTime * 1.3) * 0.25;
        vWorldPos = wp.xyz;
        gl_Position = uProj * uView * wp;
      }
    `;

    const waterFS = `#version 300 es
      precision highp float;
      in vec3 vWorldPos;

      uniform vec3 uCamPos;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uSkyColor;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform vec3 uWaterDeep;
      uniform vec3 uWaterShallow;
      uniform float uTime;
      uniform float uIsLava;

      out vec4 fragColor;

      void main() {
        float w1 = sin(vWorldPos.x * 0.08 + uTime * 2.1) * cos(vWorldPos.z * 0.07 + uTime * 1.7);
        float w2 = sin(vWorldPos.x * 0.21 - uTime * 1.4) * sin(vWorldPos.z * 0.19 + uTime * 2.3);
        vec3 N = normalize(vec3((w1 + w2 * 0.5) * 0.09, 1.0, (w2 - w1 * 0.5) * 0.09));

        vec3 V = normalize(uCamPos - vWorldPos);
        vec3 L = normalize(uSunDir);
        vec3 H = normalize(L + V);

        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.2);
        vec3 baseCol = mix(uWaterDeep, uWaterShallow, 0.45 + 0.2 * w1);

        vec3 col;
        if (uIsLava > 0.5) {
          float glow = smoothstep(-0.2, 0.7, w1 * 0.6 + w2 * 0.4);
          col = mix(vec3(0.18, 0.03, 0.01), vec3(1.0, 0.42, 0.05), glow);
          col += vec3(1.0, 0.85, 0.2) * pow(glow, 3.0) * 0.7;
        } else {
          float spec = pow(max(dot(N, H), 0.0), 96.0) * 1.25;
          col = mix(baseCol, uSkyColor * 0.95, fresnel * 0.68) + uSunColor * spec;
        }

        float dist = length(uCamPos - vWorldPos);
        float fog = clamp(1.0 - exp(-pow(dist * uFogDensity, 1.35)), 0.0, 1.0);
        col = mix(col, uFogColor, fog);

        fragColor = vec4(col, 0.94);
      }
    `;
    programs.water = createProgram(waterVS, waterFS);

    // 3. Sky Dome Shader
    const skyVS = `#version 300 es
      layout(location = 0) in vec3 aPos;
      uniform mat4 uProj;
      uniform mat4 uViewRot;
      out vec3 vDir;
      void main() {
        vDir = aPos;
        vec4 p = uProj * uViewRot * vec4(aPos, 1.0);
        gl_Position = p.xyww;
      }
    `;

    const skyFS = `#version 300 es
      precision highp float;
      in vec3 vDir;
      uniform vec3 uSkyTop;
      uniform vec3 uSkyHorizon;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uStars;

      out vec4 fragColor;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        vec3 dir = normalize(vDir);
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 col = mix(uSkyHorizon, uSkyTop, pow(h, 0.55));

        float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
        col += uSunColor * pow(sunDot, 12.0) * 0.42;
        col += uSunColor * pow(sunDot, 180.0) * 1.4;
        col += vec3(1.0, 0.96, 0.88) * smoothstep(0.9985, 0.9996, sunDot) * 1.6;

        if (uStars > 0.05 && dir.y > -0.2) {
          vec3 grid = floor(dir * 260.0);
          float s = hash(grid);
          if (s > 0.994) {
            float twinkle = (s - 0.994) / 0.006;
            col += vec3(0.85, 0.92, 1.0) * twinkle * uStars;
          }
        }

        fragColor = vec4(col, 1.0);
      }
    `;
    programs.sky = createProgram(skyVS, skyFS);

    // 4. Unlit / Emissive Glow Shader (rings, lights, trails, particles)
    const glowVS = `#version 300 es
      layout(location = 0) in vec3 aPos;
      layout(location = 1) in vec3 aNorm;
      layout(location = 2) in vec3 aCol;

      uniform mat4 uProj;
      uniform mat4 uView;
      uniform mat4 uModel;

      out vec3 vColor;
      out vec3 vWorldPos;

      void main() {
        vec4 wp = uModel * vec4(aPos, 1.0);
        vWorldPos = wp.xyz;
        vColor = aCol;
        gl_Position = uProj * uView * wp;
      }
    `;

    const glowFS = `#version 300 es
      precision highp float;
      in vec3 vColor;
      in vec3 vWorldPos;
      uniform vec3 uColorOverride;
      uniform float uAlpha;
      uniform float uUseOverride;
      out vec4 fragColor;

      void main() {
        vec3 c = mix(vColor, uColorOverride, uUseOverride);
        fragColor = vec4(c, uAlpha);
      }
    `;
    programs.glow = createProgram(glowVS, glowFS);
  }

  function createMesh(positions, normals, colors, indices) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    if (normals) {
      const normBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    }

    if (colors) {
      const colBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);
    }

    let indexCount = positions.length / 3;
    let useIndices = false;
    if (indices) {
      const idxBuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);
      indexCount = indices.length;
      useIndices = true;
    }

    gl.bindVertexArray(null);
    return { vao, count: indexCount, useIndices };
  }

  // Geometry Builder Helper (accumulates boxes, cylinders, cones, spheres, tori)
  function MeshBuilder() {
    const pos = [];
    const norm = [];
    const col = [];
    const idx = [];

    function pushTri(v0, v1, v2, n, c) {
      const base = pos.length / 3;
      pos.push(v0[0], v0[1], v0[2], v1[0], v1[1], v1[2], v2[0], v2[1], v2[2]);
      norm.push(n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]);
      col.push(c[0], c[1], c[2], c[0], c[1], c[2], c[0], c[1], c[2]);
      idx.push(base, base + 1, base + 2);
    }

    function addBox(cx, cy, cz, sx, sy, sz, c, rx = 0, ry = 0, rz = 0) {
      const hx = sx * 0.5, hy = sy * 0.5, hz = sz * 0.5;
      const corners = [
        [-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
        [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz],
      ];
      const rot = (v) => {
        let [x, y, z] = v;
        if (rx) { const ca = Math.cos(rx), sa = Math.sin(rx); [y, z] = [y * ca - z * sa, y * sa + z * ca]; }
        if (ry) { const ca = Math.cos(ry), sa = Math.sin(ry); [x, z] = [x * ca + z * sa, -x * sa + z * ca]; }
        if (rz) { const ca = Math.cos(rz), sa = Math.sin(rz); [x, y] = [x * ca - y * sa, x * sa + y * ca]; }
        return [x + cx, y + cy, z + cz];
      };
      const rotN = (v) => {
        let [x, y, z] = v;
        if (rx) { const ca = Math.cos(rx), sa = Math.sin(rx); [y, z] = [y * ca - z * sa, y * sa + z * ca]; }
        if (ry) { const ca = Math.cos(ry), sa = Math.sin(ry); [x, z] = [x * ca + z * sa, -x * sa + z * ca]; }
        if (rz) { const ca = Math.cos(rz), sa = Math.sin(rz); [x, y] = [x * ca - y * sa, x * sa + y * ca]; }
        return [x, y, z];
      };
      const pts = corners.map(rot);
      const faces = [
        [0, 3, 2, 1, [0, 0, -1]],
        [4, 5, 6, 7, [0, 0, 1]],
        [0, 1, 5, 4, [0, -1, 0]],
        [3, 7, 6, 2, [0, 1, 0]],
        [0, 4, 7, 3, [-1, 0, 0]],
        [1, 2, 6, 5, [1, 0, 0]],
      ];
      for (const [a, b, d, e, fn] of faces) {
        const n = rotN(fn);
        pushTri(pts[a], pts[b], pts[d], n, c);
        pushTri(pts[a], pts[d], pts[e], n, c);
      }
    }

    function addCylinder(cx, cy, cz, rTop, rBot, h, segs, c, axis = 'y') {
      const hy = h * 0.5;
      const mapPt = (x, y, z) => {
        if (axis === 'z') return [cx + x, cy + z, cz + y];
        if (axis === 'x') return [cx + y, cy + x, cz + z];
        return [cx + x, cy + y, cz + z];
      };
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2;
        const a1 = ((i + 1) / segs) * Math.PI * 2;
        const c0 = Math.cos(a0), s0 = Math.sin(a0);
        const c1 = Math.cos(a1), s1 = Math.sin(a1);
        const b0 = mapPt(c0 * rBot, -hy, s0 * rBot);
        const b1 = mapPt(c1 * rBot, -hy, s1 * rBot);
        const t0 = mapPt(c0 * rTop, hy, s0 * rTop);
        const t1 = mapPt(c1 * rTop, hy, s1 * rTop);
        const midA = (a0 + a1) * 0.5;
        const n = axis === 'z'
          ? [Math.cos(midA), Math.sin(midA), 0]
          : axis === 'x'
          ? [0, Math.cos(midA), Math.sin(midA)]
          : [Math.cos(midA), 0, Math.sin(midA)];
        pushTri(b0, t0, t1, n, c);
        pushTri(b0, t1, b1, n, c);
      }
    }

    function addCone(cx, cy, cz, r, h, segs, c, axis = 'y') {
      addCylinder(cx, cy, cz, 0.001, r, h, segs, c, axis);
    }

    function addTorus(cx, cy, cz, majorR, minorR, segMaj, segMin, c) {
      const baseVert = pos.length / 3;
      for (let i = 0; i <= segMaj; i++) {
        const u = (i / segMaj) * Math.PI * 2;
        const cu = Math.cos(u), su = Math.sin(u);
        for (let j = 0; j <= segMin; j++) {
          const v = (j / segMin) * Math.PI * 2;
          const cv = Math.cos(v), sv = Math.sin(v);
          const x = (majorR + minorR * cv) * cu;
          const y = (majorR + minorR * cv) * su;
          const z = minorR * sv;
          pos.push(cx + x, cy + y, cz + z);
          norm.push(cv * cu, cv * su, sv);
          col.push(c[0], c[1], c[2]);
        }
      }
      for (let i = 0; i < segMaj; i++) {
        for (let j = 0; j < segMin; j++) {
          const a = baseVert + i * (segMin + 1) + j;
          const b = baseVert + (i + 1) * (segMin + 1) + j;
          const d = baseVert + (i + 1) * (segMin + 1) + (j + 1);
          const e = baseVert + i * (segMin + 1) + (j + 1);
          idx.push(a, b, d, a, d, e);
        }
      }
    }

    function addSphere(cx, cy, cz, r, segs, c) {
      const baseVert = pos.length / 3;
      for (let lat = 0; lat <= segs; lat++) {
        const th = (lat / segs) * Math.PI;
        const st = Math.sin(th), ct = Math.cos(th);
        for (let lon = 0; lon <= segs; lon++) {
          const ph = (lon / segs) * Math.PI * 2;
          const sp = Math.sin(ph), cp = Math.cos(ph);
          const nx = cp * st, ny = ct, nz = sp * st;
          pos.push(cx + nx * r, cy + ny * r, cz + nz * r);
          norm.push(nx, ny, nz);
          col.push(c[0], c[1], c[2]);
        }
      }
      for (let lat = 0; lat < segs; lat++) {
        for (let lon = 0; lon < segs; lon++) {
          const a = baseVert + lat * (segs + 1) + lon;
          const b = baseVert + (lat + 1) * (segs + 1) + lon;
          const d = baseVert + (lat + 1) * (segs + 1) + (lon + 1);
          const e = baseVert + lat * (segs + 1) + (lon + 1);
          idx.push(a, b, d, a, d, e);
        }
      }
    }

    // Smooth lofted fuselage/nacelle along Z: sections = [{ z, cy, rx, ry, col }]
    function addLoftedProfile(sections, segs = 16) {
      const baseVert = pos.length / 3;
      const ringSize = segs + 1;
      for (let s = 0; s < sections.length; s++) {
        const sec = sections[s];
        const prev = sections[Math.max(0, s - 1)];
        const next = sections[Math.min(sections.length - 1, s + 1)];
        const dz = (next.z - prev.z) || 1;
        const dr = (((next.rx + next.ry) * 0.5) - ((prev.rx + prev.ry) * 0.5)) / dz;
        const c = sec.col;
        for (let i = 0; i <= segs; i++) {
          const a = (i / segs) * Math.PI * 2;
          const ca = Math.cos(a), sa = Math.sin(a);
          const x = ca * sec.rx;
          const y = (sec.cy || 0) + sa * sec.ry;
          const nx = ca, ny = sa, nz = -dr;
          const nl = Math.hypot(nx, ny, nz) || 1;
          pos.push(x, y, sec.z);
          norm.push(nx / nl, ny / nl, nz / nl);
          col.push(c[0], c[1], c[2]);
        }
      }
      for (let s = 0; s < sections.length - 1; s++) {
        for (let i = 0; i < segs; i++) {
          const a = baseVert + s * ringSize + i;
          const b = baseVert + (s + 1) * ringSize + i;
          const d = baseVert + (s + 1) * ringSize + (i + 1);
          const e = baseVert + s * ringSize + (i + 1);
          idx.push(a, b, d, a, d, e);
        }
      }
    }

    // Sharp swept airfoil wing / tailfin between root & tip chords
    function addAirfoilWing(rx, ry, rz, rChord, rThick, tx, ty, tz, tChord, tThick, c, isVertical = false) {
      const makeLoop = (x, y, z, ch, th) => {
        if (isVertical) {
          return [
            [x, y, z - ch * 0.5],           // leading edge
            [x + th * 0.5, y, z - ch * 0.1],
            [x, y, z + ch * 0.5],           // trailing edge
            [x - th * 0.5, y, z - ch * 0.1],
          ];
        }
        return [
          [x, y, z - ch * 0.5],             // sharp leading edge
          [x, y + th * 0.5, z - ch * 0.1],  // upper camber
          [x, y, z + ch * 0.5],             // sharp trailing edge
          [x, y - th * 0.5, z - ch * 0.1],  // lower camber
        ];
      };
      const rLoop = makeLoop(rx, ry, rz, rChord, rThick);
      const tLoop = makeLoop(tx, ty, tz, tChord, tThick);
      for (let i = 0; i < 4; i++) {
        const ni = (i + 1) % 4;
        const p0 = rLoop[i], p1 = rLoop[ni], p2 = tLoop[ni], p3 = tLoop[i];
        const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
        const vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const nl = Math.hypot(nx, ny, nz) || 1;
        const n = [nx / nl, ny / nl, nz / nl];
        pushTri(p0, p1, p2, n, c);
        pushTri(p0, p2, p3, n, c);
      }
    }

    return {
      pos, norm, col, idx,
      addBox, addCylinder, addCone, addTorus, addSphere, addLoftedProfile, addAirfoilWing,
      build: () => createMesh(pos, norm, col, idx),
    };
  }

  function createSkyCube() {
    const s = 1;
    const verts = [
      -s,-s,-s,  s,-s,-s,  s, s,-s, -s, s,-s,
      -s,-s, s,  s,-s, s,  s, s, s, -s, s, s,
    ];
    const indices = [
      0,1,2, 0,2,3,
      5,4,7, 5,7,6,
      4,0,3, 4,3,7,
      1,5,6, 1,6,2,
      3,2,6, 3,6,7,
      4,5,1, 4,1,0,
    ];
    return createMesh(verts, null, null, indices);
  }

  function drawMesh(mesh) {
    gl.bindVertexArray(mesh.vao);
    if (mesh.useIndices) {
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
    } else {
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    }
  }

  return {
    get gl() { return gl; },
    get programs() { return programs; },
    init, resize, createMesh, MeshBuilder, createSkyCube, drawMesh,
  };
})();
