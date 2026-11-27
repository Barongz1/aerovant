/**
 * flight.js - 6-DOF arcade flight model for AEROVANT.
 * Three aircraft with stats that genuinely change the physics:
 * speed -> max speed, handling -> turn rates, acceleration -> thrust,
 * stability -> auto-level rate and stall speed. Banking follows the
 * turn, the nose follows pitch, controls respond smoothly (damped),
 * gear/flaps animate, fuel and damage matter.
 * AEROVANT revision v5 - fuel burn 0.0009 -> 0.00085 per throttle unit
 * (slightly longer sorties at full power).
 */
(function (global) {
  'use strict';

  const M = global.AerovantMath;

  const AIRCRAFT = [
    {
      id: 'elang',
      name: 'Elang Jawa',
      model: 'Nusantara CX-09 "Albatros-V"',
      desc: 'Jet penegak lincah dari Jawa — belok tajam, cocok untuk koridor sempit.',
      stats: { speed: 10, handling: 18, acceleration: 12, stability: 12 }
    },
    {
      id: 'cendrawasih',
      name: 'Cendrawasih',
      model: 'Cendrawasih CX-15 "Panah Langit"',
      desc: 'Jet panah tercepat dari Papua — melesat lurus, butuh ruang belok lebar.',
      stats: { speed: 15, handling: 12, acceleration: 18, stability: 10 }
    },
    {
      id: 'jalak',
      name: 'Jalak Bali',
      model: 'Jalak Bali TB-07 "Sayap Putih"',
      desc: 'Turboprop kokoh dari Bali — baling-baling stabil, paling mudah dikendalikan.',
      stats: { speed: 12, handling: 14, acceleration: 12, stability: 18 }
    }
  ];

  function derivePhysics(spec) {
    const s = spec.stats;
    return {
      maxSpeed: 95 + s.speed * 6,
      maxThrust: 26 + s.acceleration * 1.4,
      rollRate: 1.2 + s.handling * 0.045,
      pitchRate: 0.7 + s.handling * 0.02,
      yawRate: 0.55 + s.handling * 0.02,
      levelRate: 0.25 + s.stability * 0.09,
      stallSpeed: 16 + (18 - s.stability) * 0.3
    };
  }

  function Flight(world) {
    this.world = world;
    this.pos = [0, 18, -480];
    this.quat = M.Quat.create();
    this.speed = 0;
    this.throttle = 0;
    this.heading = 0;
    this.pitch = 0;
    this.roll = 0;
    this.aoa = 0;
    this.gLoad = 1;
    this.altitude = 18;
    this.altAGL = 0;
    this.vsi = 0;
    this.stalled = false;
    this.terrainWarning = false;
    this.onGround = true;
    this.gearDown = true;
    this.flaps = 0;
    this.fuel = 100;
    this.damage = 0;
    this.crashed = false;
    this.crashReason = '';
    this.pitchInput = 0;
    this.rollInput = 0;
    this.yawInput = 0;
    this.spec = AIRCRAFT[0];
    this.phys = derivePhysics(this.spec);
    this.gearPos = 1;
    this.flapPos = 0;
    this.aileronDeflect = 0;
    this.elevatorDeflect = 0;
    this.rudderDeflect = 0;
    this.airbrake = false;
  }

  Flight.prototype.setAircraft = function (specId) {
    for (const s of AIRCRAFT) {
      if (s.id === specId) { this.spec = s; break; }
    }
    this.phys = derivePhysics(this.spec);
  };

  Flight.prototype.reset = function (x, y, z, airborne, speed) {
    this.pos = [x, y, z];
    this.quat = M.Quat.create();
    this.speed = speed || 0;
    this.throttle = 0;
    this.heading = 0;
    this.pitch = 0;
    this.roll = 0;
    this.altitude = y;
    this.altAGL = 0;
    this.vsi = 0;
    this.stalled = false;
    this.terrainWarning = false;
    this.onGround = !airborne;
    this.gearDown = true;
    this.gearPos = 1;
    this.flaps = 0;
    this.flapPos = 0;
    this.fuel = 100;
    this.damage = 0;
    this.crashed = false;
    this.crashReason = '';
    this.pitchInput = 0;
    this.rollInput = 0;
    this.yawInput = 0;
    this.airbrake = false;
  };

  Flight.prototype.update = function (dt, input) {
    if (this.crashed) return;
    const world = this.world;
    const map = world.getMap();
    const p = this.phys;
    this.pitchInput = M.damp(this.pitchInput, input.pitch, 6, dt);
    this.rollInput = M.damp(this.rollInput, input.roll, 6, dt);
    this.yawInput = M.damp(this.yawInput, input.yaw, 6, dt);
    const gearTarget = this.gearDown ? 1 : 0;
    this.gearPos = M.damp(this.gearPos, gearTarget, 3, dt);
    const flapTarget = this.flaps > 0 ? 1 : 0;
    this.flapPos = M.damp(this.flapPos, flapTarget, 4, dt);
    this.aileronDeflect = M.damp(this.aileronDeflect, this.rollInput, 8, dt);
    this.elevatorDeflect = M.damp(this.elevatorDeflect, this.pitchInput, 8, dt);
    this.rudderDeflect = M.damp(this.rudderDeflect, this.yawInput, 8, dt);
    if (input.throttleUp) this.throttle = Math.min(100, this.throttle + 60 * dt);
    if (input.throttleDown) this.throttle = Math.max(0, this.throttle - 60 * dt);
    if (input.throttleSet !== undefined && input.throttleSet !== null) this.throttle = M.clamp(input.throttleSet, 0, 100);
    this.airbrake = !!input.airbrake;
    if (input.toggleGear && !this._gearLatch) { this.gearDown = !this.gearDown; this._gearLatch = true; }
    if (!input.toggleGear) this._gearLatch = false;
    if (input.toggleFlaps && !this._flapLatch) { this.flaps = this.flaps === 0 ? 1 : 0; this._flapLatch = true; }
    if (!input.toggleFlaps) this._flapLatch = false;
    const burn = (0.02 + this.throttle * 0.00085) * dt * 10;
    this.fuel = Math.max(0, this.fuel - burn);
    const thrustAvailable = this.fuel > 0 ? 1 : 0;
    const forward = M.Quat.rotateVec3(this.quat, [0, 0, -1]);
    const up = M.Quat.rotateVec3(this.quat, [0, 1, 0]);
    const right = M.Quat.rotateVec3(this.quat, [1, 0, 0]);
    const groundH = world.getTerrainHeight(this.pos[0], this.pos[2]);
    const runway = world.RUNWAY;
    const overRunway = Math.abs(this.pos[0] - runway.x) < runway.width / 2 + 12 &&
      Math.abs(this.pos[2] - runway.z) < runway.length / 2 + 12;
    const surfaceH = overRunway ? runway.elevation : groundH;
    const altAGL = this.pos[1] - surfaceH;
    const space = map.id === 'antariksa';
    if (this.onGround) {
      const thrust = (this.throttle / 100) * p.maxThrust * thrustAvailable;
      const accel = thrust - this.speed * 0.12 - (this.airbrake ? 30 : 0);
      this.speed = Math.max(0, this.speed + accel * dt);
      const liftSpeed = (p.stallSpeed + 12) - this.flaps * 6;
      if (this.speed > liftSpeed && this.pitchInput < -0.1) {
        this.onGround = false;
        this.pos[1] += 0.5;
      } else if (this.speed > liftSpeed + 6) {
        this.onGround = false;
        this.pos[1] += 0.5;
      }
      if (this.speed > 2) {
        const turn = this.yawInput * 0.5 * dt * Math.min(1, this.speed / 30);
        const q = M.Quat.fromAxisAngle([0, 1, 0], -turn);
        this.quat = M.Quat.multiply(q, this.quat);
      }
      this.pos[0] += forward[0] * this.speed * dt;
      this.pos[2] += forward[2] * this.speed * dt;
      this.pos[1] = surfaceH;
      if (this.speed < 1 && this.fuel < 100) this.fuel = Math.min(100, this.fuel + 25 * dt);
    } else {
      const thrust = (this.throttle / 100) * p.maxThrust * thrustAvailable;
      const drag = 0.02 + this.speed * 0.0006 + (this.airbrake ? 0.25 : 0) + (this.flaps * 0.03);
      const accel = thrust - drag * this.speed * this.speed * 0.05;
      this.speed = Math.max(0, this.speed + accel * dt);
      if (this.speed > p.maxSpeed) this.speed = p.maxSpeed;
      const lift = M.clamp((this.speed - p.stallSpeed) / 40, 0, 1.4) * (1 + this.flaps * 0.25);
      const gravity = space ? 3.5 : 9.8;
      const vertical = forward[1] * this.speed + lift * 8 - gravity * (1 - lift * 0.55) * dt * 60 * 0.016;
      this.pos[0] += forward[0] * this.speed * dt;
      this.pos[2] += forward[2] * this.speed * dt;
      this.pos[1] += vertical * dt * 0.016 * 60;
      const pitchRate = p.pitchRate * M.clamp((this.speed - p.stallSpeed * 0.6) / 25, 0, 1);
      const rollRate = p.rollRate * M.clamp((this.speed - p.stallSpeed * 0.6) / 25, 0, 1);
      const pitchQ = M.Quat.fromAxisAngle(right, -this.pitchInput * pitchRate * dt);
      const rollQ = M.Quat.fromAxisAngle(forward, this.rollInput * rollRate * dt);
      const yawQ = M.Quat.fromAxisAngle([0, 1, 0], this.yawInput * p.yawRate * dt * 0.6);
      this.quat = M.Quat.multiply(pitchQ, M.Quat.multiply(rollQ, M.Quat.multiply(yawQ, this.quat)));
      const levelQ = this._autoLevelQuat(dt);
      if (levelQ) this.quat = M.Quat.multiply(levelQ, this.quat);
      const stalled = this.speed < p.stallSpeed + 4 && !space;
      if (stalled) {
        const dropQ = M.Quat.fromAxisAngle(right, -0.6 * dt);
        this.quat = M.Quat.multiply(dropQ, this.quat);
        this.pos[1] -= 8 * dt;
      }
      if (!space) {
        if (this.pos[1] <= surfaceH + 1.2) {
          if (overRunway && this.gearDown && Math.abs(this.roll) < 0.2 && this.speed < 90) {
            this.onGround = true;
            this.pos[1] = surfaceH;
          } else {
            this._crash('Menabrak tanah');
            return;
          }
        }
      } else {
        for (const a of world.getAsteroids()) {
          const d = Math.hypot(this.pos[0] - a.x, this.pos[1] - a.y, this.pos[2] - a.z);
          if (d < a.r + 4) {
            this.damage += 25;
            this.pos[1] += 20;
            this.speed *= 0.7;
            if (this.damage >= 100) { this._crash('Menabrak asteroid'); return; }
          }
        }
        if (this.pos[1] < 10) this.pos[1] = 10;
      }
      const half = world.WORLD_SIZE / 2 - 100;
      if (Math.abs(this.pos[0]) > half || Math.abs(this.pos[2]) > half) {
        this.pos[0] = M.clamp(this.pos[0], -half, half);
        this.pos[2] = M.clamp(this.pos[2], -half, half);
      }
    }
    const fwd = M.Quat.rotateVec3(this.quat, [0, 0, -1]);
    this.heading = (Math.atan2(-fwd[0], -fwd[2]) * 180 / Math.PI + 360) % 360;
    this.pitch = Math.asin(M.clamp(fwd[1], -1, 1)) * 180 / Math.PI;
    const upv = M.Quat.rotateVec3(this.quat, [0, 1, 0]);
    this.roll = Math.atan2(upv[0], upv[1]) * 180 / Math.PI;
    this.aoa = M.clamp(12 - (this.speed - p.stallSpeed) * 0.25, -5, 30);
    this.gLoad = 1 + Math.abs(this.pitchInput) * 0.8 + Math.abs(this.rollInput) * 0.4;
    this.altitude = this.pos[1];
    this.altAGL = this.pos[1] - surfaceH;
    this.vsi = (this.pos[1] - (this._prevAlt || this.pos[1])) / Math.max(dt, 0.001);
    this._prevAlt = this.pos[1];
    this.stalled = this.speed < p.stallSpeed + 4 && !this.onGround && !space;
    this.terrainWarning = this.altAGL < 60 && !this.onGround && !space;
  };

  Flight.prototype._autoLevelQuat = function (dt) {
    const up = M.Quat.rotateVec3(this.quat, [0, 1, 0]);
    const fwd = M.Quat.rotateVec3(this.quat, [0, 0, -1]);
    const targetUp = [0, 1, 0];
    const axis = M.Vec3.cross(up, targetUp);
    const len = M.Vec3.length(axis);
    if (len < 0.001) return null;
    const angle = Math.asin(M.clamp(len, -1, 1)) * this.phys.levelRate * dt * 0.4;
    const axisN = M.Vec3.normalize(axis);
    const rollAxis = fwd;
    const rollAngle = angle * Math.sign(M.Vec3.dot(axisN, rollAxis));
    return M.Quat.fromAxisAngle(rollAxis, rollAngle);
  };

  Flight.prototype._crash = function (reason) {
    this.crashed = true;
    this.crashReason = reason;
    this.damage = 100;
    this.speed = 0;
  };

  Flight.prototype.addDamage = function (amount) {
    this.damage = Math.min(100, this.damage + amount);
    if (this.damage >= 100) this._crash('Kerusakan parah');
  };

  global.AerovantFlight = { Flight, AIRCRAFT, derivePhysics };
})(window);
