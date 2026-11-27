// AEROVANT — 3D Math & Procedural Noise Utilities

window.AeroMath = (() => {
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (e0, e1, x) => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const degToRad = (d) => (d * Math.PI) / 180;
  const radToDeg = (r) => (r * 180) / Math.PI;

  function vec3(x = 0, y = 0, z = 0) {
    return { x, y, z };
  }

  function add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }

  function sub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  function scale(a, s) {
    return { x: a.x * s, y: a.y * s, z: a.z * s };
  }

  function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  function cross(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }

  function length(a) {
    return Math.hypot(a.x, a.y, a.z);
  }

  function normalize(a) {
    const l = length(a) || 1;
    return { x: a.x / l, y: a.y / l, z: a.z / l };
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  // Column-major 4x4 matrix utilities
  function mat4Identity() {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
  }

  function mat4Perspective(fovRad, aspect, near, far) {
    const f = 1.0 / Math.tan(fovRad / 2);
    const nf = 1 / (near - far);
    const out = new Float32Array(16);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[14] = 2 * far * near * nf;
    return out;
  }

  function mat4LookAt(eye, target, up) {
    const z = normalize(sub(eye, target));
    const x = normalize(cross(up, z));
    const y = cross(z, x);
    const out = new Float32Array(16);
    out[0] = x.x; out[1] = y.x; out[2] = z.x; out[3] = 0;
    out[4] = x.y; out[5] = y.y; out[6] = z.y; out[7] = 0;
    out[8] = x.z; out[9] = y.z; out[10] = z.z; out[11] = 0;
    out[12] = -dot(x, eye);
    out[13] = -dot(y, eye);
    out[14] = -dot(z, eye);
    out[15] = 1;
    return out;
  }

  function mat4Multiply(a, b) {
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        out[c * 4 + r] =
          a[0 * 4 + r] * b[c * 4 + 0] +
          a[1 * 4 + r] * b[c * 4 + 1] +
          a[2 * 4 + r] * b[c * 4 + 2] +
          a[3 * 4 + r] * b[c * 4 + 3];
      }
    }
    return out;
  }

  function mat4FromTRS(pos, rotEuler, scl) {
    // rotEuler: { yaw, pitch, roll } (Y -> X -> Z)
    const cy = Math.cos(rotEuler.yaw || 0), sy = Math.sin(rotEuler.yaw || 0);
    const cx = Math.cos(rotEuler.pitch || 0), sx = Math.sin(rotEuler.pitch || 0);
    const cz = Math.cos(rotEuler.roll || 0), sz = Math.sin(rotEuler.roll || 0);

    const sxv = scl ? scl.x : 1;
    const syv = scl ? scl.y : 1;
    const szv = scl ? scl.z : 1;

    // R = Ry * Rx * Rz
    const m00 = (cy * cz + sy * sx * sz) * sxv;
    const m01 = (cx * sz) * sxv;
    const m02 = (-sy * cz + cy * sx * sz) * sxv;

    const m10 = (-cy * sz + sy * sx * cz) * syv;
    const m11 = (cx * cz) * syv;
    const m12 = (sy * sz + cy * sx * cz) * syv;

    const m20 = (sy * cx) * szv;
    const m21 = (-sx) * szv;
    const m22 = (cy * cx) * szv;

    const out = new Float32Array(16);
    out[0] = m00; out[1] = m01; out[2] = m02; out[3] = 0;
    out[4] = m10; out[5] = m11; out[6] = m12; out[7] = 0;
    out[8] = m20; out[9] = m21; out[10] = m22; out[11] = 0;
    out[12] = pos.x; out[13] = pos.y; out[14] = pos.z; out[15] = 1;
    return out;
  }

  function mat4NormalMatrix(m) {
    // Upper-left 3x3 inverse transpose (assuming uniform/mild scale or extract 3x3)
    const a00 = m[0], a01 = m[1], a02 = m[2];
    const a10 = m[4], a11 = m[5], a12 = m[6];
    const a20 = m[8], a21 = m[9], a22 = m[10];
    const b01 = a22 * a11 - a12 * a21;
    const b11 = -a22 * a10 + a12 * a20;
    const b21 = a21 * a10 - a11 * a20;
    let det = a00 * b01 + a01 * b11 + a02 * b21;
    if (Math.abs(det) < 1e-8) det = 1;
    const inv = 1.0 / det;
    return new Float32Array([
      b01 * inv, (-a22 * a01 + a02 * a21) * inv, (a12 * a01 - a02 * a11) * inv,
      b11 * inv, (a22 * a00 - a02 * a20) * inv, (-a12 * a00 + a02 * a10) * inv,
      b21 * inv, (-a21 * a00 + a01 * a20) * inv, (a11 * a00 - a01 * a10) * inv,
    ]);
  }

  // Deterministic Hash & Value Noise
  function hash2(ix, iz) {
    const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  function noise2D(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx);
    const uz = fz * fz * (3 - 2 * fz);
    const a = hash2(ix, iz);
    const b = hash2(ix + 1, iz);
    const c = hash2(ix, iz + 1);
    const d = hash2(ix + 1, iz + 1);
    return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
  }

  function fbm2D(x, z, octaves = 4) {
    let val = 0;
    let amp = 0.5;
    let freq = 1;
    for (let i = 0; i < octaves; i++) {
      val += amp * (noise2D(x * freq, z * freq) * 2 - 1);
      freq *= 2.03;
      amp *= 0.5;
    }
    return val;
  }

  return {
    clamp, lerp, smoothstep, degToRad, radToDeg,
    vec3, add, sub, scale, dot, cross, length, normalize, dist,
    mat4Identity, mat4Perspective, mat4LookAt, mat4Multiply, mat4FromTRS, mat4NormalMatrix,
    hash2, noise2D, fbm2D,
  };
})();
