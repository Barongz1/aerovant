/**
 * math.js - 3D math, matrix/vector operations, procedural noise.
 * Part of AEROVANT (100% original offline flight game).
 * Matrix helpers accept both calling styles: with an explicit `out`
 * matrix, or without one (a fresh matrix is created and returned), and
 * translate/scale accept either a vector or separate x, y, z numbers.
 * AEROVANT revision v5 - fbm octave frequency 2.03 -> 2.05 (slightly
 * finer terrain detail at higher octaves).
 */
(function (global) {
  'use strict';

  const DEG2RAD = Math.PI / 180;
  const RAD2DEG = 180 / Math.PI;

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpVec(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  // Frame-rate independent exponential smoothing: damp(current, target, rate, dt)
  function damp(a, b, lambda, dt) {
    if (dt <= 0) return a;
    return lerp(a, b, 1 - Math.exp(-lambda * dt));
  }

  function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function wrapAngleDeg(deg) {
    let d = deg % 360;
    if (d < 0) d += 360;
    return d;
  }

  // Deterministic 2D hash & value noise for terrain generation
  function hash2(ix, iz) {
    const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  function valueNoise2D(x, z) {
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

  function fbm2D(x, z, octaves) {
    let value = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      value += amp * valueNoise2D(x * freq, z * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2.05;
    }
    return value / norm;
  }

  function ridgeNoise2D(x, z, octaves) {
    let value = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      const n = valueNoise2D(x * freq, z * freq);
      const r = 1 - Math.abs(n * 2 - 1);
      value += amp * r * r;
      norm += amp;
      amp *= 0.5;
      freq *= 2.07;
    }
    return value / norm;
  }

  const Vec3 = {
    create(x = 0, y = 0, z = 0) {
      return [x, y, z];
    },
    add(a, b, out = [0, 0, 0]) {
      out[0] = a[0] + b[0];
      out[1] = a[1] + b[1];
      out[2] = a[2] + b[2];
      return out;
    },
    sub(a, b, out = [0, 0, 0]) {
      out[0] = a[0] - b[0];
      out[1] = a[1] - b[1];
      out[2] = a[2] - b[2];
      return out;
    },
    scale(a, s, out = [0, 0, 0]) {
      out[0] = a[0] * s;
      out[1] = a[1] * s;
      out[2] = a[2] * s;
      return out;
    },
    dot(a, b) {
      return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    },
    cross(a, b, out = [0, 0, 0]) {
      const ax = a[0], ay = a[1], az = a[2];
      const bx = b[0], by = b[1], bz = b[2];
      out[0] = ay * bz - az * by;
      out[1] = az * bx - ax * bz;
      out[2] = ax * by - ay * bx;
      return out;
    },
    len(a) {
      return Math.hypot(a[0], a[1], a[2]);
    },
    length(a) {
      return Math.hypot(a[0], a[1], a[2]);
    },
    dist(a, b) {
      return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    },
    normalize(a, out = [0, 0, 0]) {
      const l = Math.hypot(a[0], a[1], a[2]);
      if (l > 1e-8) {
        out[0] = a[0] / l;
        out[1] = a[1] / l;
        out[2] = a[2] / l;
      } else {
        out[0] = 0; out[1] = 0; out[2] = 0;
      }
      return out;
    },
    lerp(a, b, t, out = [0, 0, 0]) {
      out[0] = a[0] + (b[0] - a[0]) * t;
      out[1] = a[1] + (b[1] - a[1]) * t;
      out[2] = a[2] + (b[2] - a[2]) * t;
      return out;
    }
  };

  const Mat4 = {
    create() {
      const m = new Float32Array(16);
      m[0] = m[5] = m[10] = m[15] = 1;
      return m;
    },
    identity(out) {
      out = out || new Float32Array(16);
      out.fill(0);
      out[0] = out[5] = out[10] = out[15] = 1;
      return out;
    },
    copy(src, out) {
      out = out || new Float32Array(16);
      out.set(src);
      return out;
    },
    multiply(a, b, out) {
      out = out || new Float32Array(16);
      const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
      const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
      const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
      const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

      for (let i = 0; i < 4; i++) {
        const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
        out[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        out[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        out[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        out[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
      }
      return out;
    },
    multiplyVec4(m, v, out) {
      out = out || [0, 0, 0, 0];
      out[0] = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3];
      out[1] = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3];
      out[2] = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3];
      out[3] = m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3];
      return out;
    },
    perspective(fovRad, aspect, near, far, out) {
      out = out || new Float32Array(16);
      const f = 1.0 / Math.tan(fovRad / 2);
      const nf = 1 / (near - far);
      out.fill(0);
      out[0] = f / aspect;
      out[5] = f;
      out[10] = (far + near) * nf;
      out[11] = -1;
      out[14] = 2 * far * near * nf;
      return out;
    },
    lookAt(eye, target, up, out) {
      out = out || new Float32Array(16);
      let zx = eye[0] - target[0];
      let zy = eye[1] - target[1];
      let zz = eye[2] - target[2];
      let len = Math.hypot(zx, zy, zz);
      if (len < 1e-8) { zz = 1; } else { zx /= len; zy /= len; zz /= len; }

      let xx = up[1] * zz - up[2] * zy;
      let xy = up[2] * zx - up[0] * zz;
      let xz = up[0] * zy - up[1] * zx;
      len = Math.hypot(xx, xy, xz);
      if (len < 1e-8) { xx = 1; xy = 0; xz = 0; } else { xx /= len; xy /= len; xz /= len; }

      const yx = zy * xz - zz * xy;
      const yy = zz * xx - zx * xz;
      const yz = zx * xy - zy * xx;

      out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
      out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
      out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
      out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
      out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
      out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
      out[15] = 1;
      return out;
    },
    // translate(m, [x,y,z], out) or translate(m, x, y, z, out)
    translate(m, a, b, c, d) {
      let x, y, z, out;
      if (Array.isArray(a)) { x = a[0]; y = a[1]; z = a[2]; out = b; }
      else { x = a; y = b; z = c; out = d; }
      out = out || new Float32Array(16);
      if (m !== out) out.set(m);
      out[12] = m[0] * x + m[4] * y + m[8] * z + m[12];
      out[13] = m[1] * x + m[5] * y + m[9] * z + m[13];
      out[14] = m[2] * x + m[6] * y + m[10] * z + m[14];
      out[15] = m[3] * x + m[7] * y + m[11] * z + m[15];
      return out;
    },
    // scale(m, [x,y,z], out) or scale(m, x, y, z, out)
    scale(m, a, b, c, d) {
      let x, y, z, out;
      if (Array.isArray(a)) { x = a[0]; y = a[1]; z = a[2]; out = b; }
      else { x = a; y = b; z = c; out = d; }
      out = out || new Float32Array(16);
      if (m !== out) out.set(m);
      out[0] *= x; out[1] *= x; out[2] *= x; out[3] *= x;
      out[4] *= y; out[5] *= y; out[6] *= y; out[7] *= y;
      out[8] *= z; out[9] *= z; out[10] *= z; out[11] *= z;
      return out;
    },
    rotateY(m, rad, out) {
      out = out || new Float32Array(16);
      const s = Math.sin(rad), c = Math.cos(rad);
      const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
      const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
      if (m !== out) out.set(m);
      out[0] = a00 * c - a20 * s;
      out[1] = a01 * c - a21 * s;
      out[2] = a02 * c - a22 * s;
      out[3] = a03 * c - a23 * s;
      out[8] = a00 * s + a20 * c;
      out[9] = a01 * s + a21 * c;
      out[10] = a02 * s + a22 * c;
      out[11] = a03 * s + a23 * c;
      return out;
    },
    rotateZ(m, rad, out) {
      out = out || new Float32Array(16);
      const s = Math.sin(rad), c = Math.cos(rad);
      const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
      const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
      if (m !== out) out.set(m);
      out[0] = a00 * c + a10 * s;
      out[1] = a01 * c + a11 * s;
      out[2] = a02 * c + a12 * s;
      out[3] = a03 * c + a13 * s;
      out[4] = a10 * c - a00 * s;
      out[5] = a11 * c - a01 * s;
      out[6] = a12 * c - a02 * s;
      out[7] = a13 * c - a03 * s;
      return out;
    },
    rotateX(m, rad, out) {
      out = out || new Float32Array(16);
      const s = Math.sin(rad), c = Math.cos(rad);
      const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
      const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
      if (m !== out) out.set(m);
      out[4] = a10 * c + a20 * s;
      out[5] = a11 * c + a21 * s;
      out[6] = a12 * c + a22 * s;
      out[7] = a13 * c + a23 * s;
      out[8] = a20 * c - a10 * s;
      out[9] = a21 * c - a11 * s;
      out[10] = a22 * c - a12 * s;
      out[11] = a23 * c - a13 * s;
      return out;
    }
  };

  const Quat = {
    create() {
      return [0, 0, 0, 1];
    },
    fromEulerYXZ(yaw, pitch, roll, out = [0, 0, 0, 1]) {
      const c1 = Math.cos(yaw * 0.5), s1 = Math.sin(yaw * 0.5);
      const c2 = Math.cos(pitch * 0.5), s2 = Math.sin(pitch * 0.5);
      const c3 = Math.cos(roll * 0.5), s3 = Math.sin(roll * 0.5);
      out[0] = s1 * c2 * s3 + c1 * s2 * c3;
      out[1] = s1 * c2 * c3 - c1 * s2 * s3;
      out[2] = c1 * c2 * s3 - s1 * s2 * c3;
      out[3] = c1 * c2 * c3 + s1 * s2 * s3;
      return out;
    },
    multiply(a, b, out = [0, 0, 0, 1]) {
      const ax = a[0], ay = a[1], az = a[2], aw = a[3];
      const bx = b[0], by = b[1], bz = b[2], bw = b[3];
      out[0] = aw * bx + ax * bw + ay * bz - az * by;
      out[1] = aw * by - ax * bz + ay * bw + az * bx;
      out[2] = aw * bz + ax * by - ay * bx + az * bw;
      out[3] = aw * bw - ax * bx - ay * by - az * bz;
      return out;
    },
    fromAxisAngle(axis, rad, out = [0, 0, 0, 1]) {
      const half = rad * 0.5;
      const s = Math.sin(half);
      out[0] = axis[0] * s;
      out[1] = axis[1] * s;
      out[2] = axis[2] * s;
      out[3] = Math.cos(half);
      return out;
    },
    normalize(q) {
      const l = Math.hypot(q[0], q[1], q[2], q[3]);
      if (l > 1e-8) {
        q[0] /= l; q[1] /= l; q[2] /= l; q[3] /= l;
      } else {
        q[0] = 0; q[1] = 0; q[2] = 0; q[3] = 1;
      }
      return q;
    },
    rotateVec3(q, v, out = [0, 0, 0]) {
      const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
      const vx = v[0], vy = v[1], vz = v[2];
      const ix = qw * vx + qy * vz - qz * vy;
      const iy = qw * vy + qz * vx - qx * vz;
      const iz = qw * vz + qx * vy - qy * vx;
      const iw = -qx * vx - qy * vy - qz * vz;
      out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
      out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
      out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
      return out;
    },
    toMat4(q, pos, out) {
      const x = q[0], y = q[1], z = q[2], w = q[3];
      const x2 = x + x, y2 = y + y, z2 = z + z;
      const xx = x * x2, xy = x * y2, xz = x * z2;
      const yy = y * y2, yz = y * z2, zz = z * z2;
      const wx = w * x2, wy = w * y2, wz = w * z2;

      out[0] = 1 - (yy + zz);
      out[1] = xy + wz;
      out[2] = xz - wy;
      out[3] = 0;

      out[4] = xy - wz;
      out[5] = 1 - (xx + zz);
      out[6] = yz + wx;
      out[7] = 0;

      out[8] = xz + wy;
      out[9] = yz - wx;
      out[10] = 1 - (xx + yy);
      out[11] = 0;

      out[12] = pos[0];
      out[13] = pos[1];
      out[14] = pos[2];
      out[15] = 1;
      return out;
    }
  };

  global.AerovantMath = {
    DEG2RAD,
    RAD2DEG,
    clamp,
    lerp,
    lerpVec,
    damp,
    smoothstep,
    wrapAngleDeg,
    hash2,
    valueNoise2D,
    fbm2D,
    ridgeNoise2D,
    Vec3,
    Mat4,
    Quat
  };
})(window);
