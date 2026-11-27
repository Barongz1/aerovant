// AEROVANT — Combat Mode ("Pertempuran Angkasa"): Semi-Realistic Alien Waves, Weapons & Scoring

window.AeroCombat = (() => {
  const M = window.AeroMath;

  const enemyMeshes = {};
  let bulletMesh = null;
  let missileMesh = null;
  let fxMesh = null;

  const state = {
    active: false,
    wave: 1,
    maxWave: 1,
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    combo: 1,
    comboTimer: 0,
    missiles: 6,
    maxMissiles: 6,
    missileCooldown: 0,
    missileReloadTimer: 0,
    cannonCooldown: 0,
    screenShake: 0,
    waveBannerTimer: 0,
    enemies: [],
    projectiles: [], // player bullets, missiles, enemy plasma
    effects: [],     // fireballs, smoke, debris
  };

  function ensureMeshes() {
    if (!bulletMesh) {
      const bm = window.AeroGL.MeshBuilder();
      bm.addCylinder(0, 0, 0, 0.16, 0.16, 4.2, 8, [1.0, 0.85, 0.35], 'z');
      bulletMesh = bm.build();
    }
    if (!missileMesh) {
      const mm = window.AeroGL.MeshBuilder();
      mm.addCylinder(0, 0, 0, 0.22, 0.22, 2.8, 10, [0.85, 0.88, 0.92], 'z');
      mm.addCone(0, 0, -1.7, 0.22, 0.8, 10, [0.90, 0.22, 0.14], 'z');
      missileMesh = mm.build();
    }
    if (!fxMesh) {
      const fm = window.AeroGL.MeshBuilder();
      fm.addSphere(0, 0, 0, 1.0, 10, [1, 1, 1]);
      fxMesh = fm.build();
    }
    if (!enemyMeshes.scout) {
      // 1. Alien Bio-Scout (organic winged interceptor, dark chitin + bioluminescent teal)
      const b = window.AeroGL.MeshBuilder();
      const g = window.AeroGL.MeshBuilder();
      const chitin = [0.16, 0.18, 0.22];
      const darkOrg = [0.09, 0.10, 0.13];
      const bioGlow = [0.22, 0.82, 0.68];
      b.addLoftedProfile([
        { z: -3.2, cy: 0.0, rx: 0.05, ry: 0.04, col: darkOrg },
        { z: -1.8, cy: 0.1, rx: 0.55, ry: 0.36, col: chitin },
        { z:  0.0, cy: 0.15, rx: 0.85, ry: 0.48, col: chitin },
        { z:  2.2, cy: 0.0, rx: 0.42, ry: 0.28, col: darkOrg },
      ], 14);
      // Organic swept wings
      b.addAirfoilWing(-0.6, 0.05, -0.4, 2.6, 0.22, -4.6, 0.45, 1.8, 0.75, 0.08, chitin);
      b.addAirfoilWing( 0.6, 0.05, -0.4, 2.6, 0.22,  4.6, 0.45, 1.8, 0.75, 0.08, chitin);
      g.addSphere(0, 0.25, -1.2, 0.36, 10, bioGlow);
      g.addBox(-3.6, 0.32, 1.1, 1.8, 0.06, 0.12, bioGlow, 0, 0.35, 0);
      g.addBox( 3.6, 0.32, 1.1, 1.8, 0.06, 0.12, bioGlow, 0, -0.35, 0);
      enemyMeshes.scout = { body: b.build(), glow: g.build() };
    }
    if (!enemyMeshes.heavy) {
      // 2. Heavy Winged Alien Wyvern (larger organic predator with armored carapace & amber core)
      const b = window.AeroGL.MeshBuilder();
      const g = window.AeroGL.MeshBuilder();
      const armor = [0.22, 0.17, 0.20];
      const dark = [0.10, 0.08, 0.10];
      const core = [0.96, 0.48, 0.16];
      b.addLoftedProfile([
        { z: -5.0, cy: -0.1, rx: 0.12, ry: 0.10, col: dark },
        { z: -2.8, cy: 0.15, rx: 1.05, ry: 0.72, col: armor },
        { z:  0.0, cy: 0.25, rx: 1.45, ry: 0.92, col: armor },
        { z:  3.4, cy: 0.05, rx: 0.85, ry: 0.55, col: dark },
      ], 16);
      b.addAirfoilWing(-1.1, 0.1, -0.8, 4.2, 0.38, -7.8, 0.85, 2.4, 1.1, 0.12, armor);
      b.addAirfoilWing( 1.1, 0.1, -0.8, 4.2, 0.38,  7.8, 0.85, 2.4, 1.1, 0.12, armor);
      b.addAirfoilWing(-0.9, 0.4, 2.2, 2.2, 0.16, -2.5, 2.4, 3.6, 0.8, 0.08, dark, true);
      b.addAirfoilWing( 0.9, 0.4, 2.2, 2.2, 0.16,  2.5, 2.4, 3.6, 0.8, 0.08, dark, true);
      g.addSphere(0, 0.25, -2.1, 0.62, 12, core);
      g.addSphere(0, 0.05, 3.3, 0.58, 10, core);
      enemyMeshes.heavy = { body: b.build(), glow: g.build() };
    }
    if (!enemyMeshes.boss) {
      // 3. Boss Leviathan (massive bio-mechanical dreadnought with twin wings & crimson core)
      const b = window.AeroGL.MeshBuilder();
      const g = window.AeroGL.MeshBuilder();
      const shell = [0.16, 0.14, 0.18];
      const trim = [0.28, 0.16, 0.18];
      const crimson = [1.0, 0.20, 0.18];
      b.addLoftedProfile([
        { z: -9.5, cy: 0.0, rx: 0.35, ry: 0.25, col: trim },
        { z: -5.5, cy: 0.3, rx: 2.2, ry: 1.4, col: shell },
        { z:  0.0, cy: 0.5, rx: 3.1, ry: 1.8, col: shell },
        { z:  5.5, cy: 0.2, rx: 2.4, ry: 1.4, col: trim },
        { z:  8.5, cy: 0.0, rx: 1.2, ry: 0.8, col: shell },
      ], 18);
      b.addAirfoilWing(-2.4, 0.2, -2.0, 7.5, 0.65, -14.5, 1.4, 4.2, 2.2, 0.22, shell);
      b.addAirfoilWing( 2.4, 0.2, -2.0, 7.5, 0.65,  14.5, 1.4, 4.2, 2.2, 0.22, shell);
      b.addAirfoilWing(-2.0, 0.8, 4.0, 3.8, 0.28, -5.2, 4.4, 6.8, 1.5, 0.14, trim, true);
      b.addAirfoilWing( 2.0, 0.8, 4.0, 3.8, 0.28,  5.2, 4.4, 6.8, 1.5, 0.14, trim, true);
      g.addSphere(0, 0.35, -4.2, 1.15, 14, crimson);
      g.addSphere(-4.8, 0.6, 0.8, 0.65, 10, crimson);
      g.addSphere( 4.8, 0.6, 0.8, 0.65, 10, crimson);
      enemyMeshes.boss = { body: b.build(), glow: g.build() };
    }
  }

  function spawnWave(waveNum, playerPos, playerYaw = 0) {
    state.wave = waveNum;
    state.maxWave = Math.max(state.maxWave, waveNum);
    state.waveBannerTimer = 3.2;
    state.enemies = [];

    const count = 3 + waveNum * 2;
    const isBossWave = waveNum % 3 === 0;
    const fwdX = -Math.sin(playerYaw);
    const fwdZ = -Math.cos(playerYaw);
    const rightX = Math.cos(playerYaw);
    const rightZ = -Math.sin(playerYaw);

    for (let i = 0; i < count; i++) {
      const forwardDist = 480 + (i % 3) * 130;
      const sideOffset = ((i / Math.max(1, count - 1)) - 0.5) * 340;
      const isHeavy = i % 3 === 2 || (waveNum >= 3 && i % 2 === 1);
      const kind = isHeavy ? 'heavy' : 'scout';
      const hp = kind === 'heavy' ? 80 + waveNum * 15 : 28 + waveNum * 5;
      state.enemies.push({
        id: `${waveNum}-${i}`,
        kind,
        x: playerPos.x + fwdX * forwardDist + rightX * sideOffset,
        y: Math.max(85, playerPos.y + 20 + (i % 4) * 22),
        z: playerPos.z + fwdZ * forwardDist + rightZ * sideOffset,
        yaw: playerYaw + Math.PI,
        pitch: 0,
        roll: 0,
        hp,
        maxHp: hp,
        speed: (kind === 'heavy' ? 42 : 56) + waveNum * 3.5,
        fireCd: 1.5 + Math.random() * 2.5,
        scoreVal: kind === 'heavy' ? 500 : 100,
        radius: kind === 'heavy' ? 9.5 : 5.5,
      });
    }

    if (isBossWave) {
      const bhp = 320 + waveNum * 60;
      state.enemies.push({
        id: `${waveNum}-boss`,
        kind: 'boss',
        x: playerPos.x + fwdX * 720,
        y: Math.max(130, playerPos.y + 60),
        z: playerPos.z + fwdZ * 720,
        yaw: playerYaw + Math.PI,
        pitch: 0,
        roll: 0,
        hp: bhp,
        maxHp: bhp,
        speed: 38 + waveNum * 2,
        fireCd: 1.8,
        scoreVal: 2000,
        radius: 17.0,
      });
    }
  }

  function reset(playerPos, playerYaw = 0) {
    ensureMeshes();
    state.active = true;
    state.wave = 1;
    state.maxWave = 1;
    state.kills = 0;
    state.shotsFired = 0;
    state.shotsHit = 0;
    state.combo = 1;
    state.comboTimer = 0;
    state.missiles = 6;
    state.missileCooldown = 0;
    state.missileReloadTimer = 0;
    state.cannonCooldown = 0;
    state.screenShake = 0;
    state.projectiles = [];
    state.effects = [];
    spawnWave(1, playerPos, playerYaw);
  }

  function stop() {
    state.active = false;
    state.enemies = [];
    state.projectiles = [];
    state.effects = [];
  }

  function spawnExplosion(x, y, z, scale = 1.0, big = false) {
    window.AeroAudio.playExplosion(big);
    if (big) state.screenShake = Math.max(state.screenShake, 0.45);
    const count = big ? 20 : 12;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const el = (Math.random() - 0.3) * Math.PI;
      const spd = (10 + Math.random() * 24) * scale;
      state.effects.push({
        x, y, z,
        vx: Math.cos(a) * Math.cos(el) * spd,
        vy: Math.sin(el) * spd + 4,
        vz: Math.sin(a) * Math.cos(el) * spd,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.45,
        size: (1.8 + Math.random() * 2.4) * scale,
        isFire: i % 3 !== 0,
      });
    }
  }

  function fireCannon(ps) {
    if (!state.active || state.cannonCooldown > 0) return;
    state.cannonCooldown = 0.11;
    state.shotsFired += 2;
    window.AeroAudio.playCannon();

    const cy = Math.cos(ps.yaw), sy = Math.sin(ps.yaw);
    const cp = Math.cos(ps.pitch), sp = Math.sin(ps.pitch);
    const fwd = { x: -sy * cp, y: sp, z: -cy * cp };
    const right = { x: cy, y: 0, z: -sy };
    const spd = Math.max(240, ps.speedKts * 0.62 + 210);

    for (const side of [-1.2, 1.2]) {
      state.projectiles.push({
        type: 'bullet',
        fromPlayer: true,
        x: ps.pos.x + right.x * side + fwd.x * 4.5,
        y: ps.pos.y + fwd.y * 4.5,
        z: ps.pos.z + right.z * side + fwd.z * 4.5,
        vx: fwd.x * spd,
        vy: fwd.y * spd,
        vz: fwd.z * spd,
        yaw: ps.yaw,
        pitch: ps.pitch,
        life: 0,
        maxLife: 2.0,
        dmg: 16,
      });
    }
  }

  function fireMissile(ps) {
    if (!state.active || state.missiles <= 0 || state.missileCooldown > 0) return;
    state.missiles--;
    state.missileCooldown = 0.9;
    state.shotsFired += 1;
    state.screenShake = Math.max(state.screenShake, 0.18);
    window.AeroAudio.playMissile();

    const cy = Math.cos(ps.yaw), sy = Math.sin(ps.yaw);
    const cp = Math.cos(ps.pitch), sp = Math.sin(ps.pitch);
    const fwd = { x: -sy * cp, y: sp, z: -cy * cp };

    // Lock onto nearest enemy
    let target = null;
    let bestD = Infinity;
    for (const e of state.enemies) {
      const d = M.dist(ps.pos, e);
      if (d < bestD) { bestD = d; target = e; }
    }

    const spd = 210;
    state.projectiles.push({
      type: 'missile',
      fromPlayer: true,
      target,
      x: ps.pos.x + fwd.x * 5,
      y: ps.pos.y - 0.5 + fwd.y * 5,
      z: ps.pos.z + fwd.z * 5,
      vx: fwd.x * spd,
      vy: fwd.y * spd,
      vz: fwd.z * spd,
      yaw: ps.yaw,
      pitch: ps.pitch,
      life: 0,
      maxLife: 4.5,
      dmg: 85,
    });
  }

  function update(dt, ps, missionState) {
    if (!state.active) return;

    if (state.cannonCooldown > 0) state.cannonCooldown -= dt;
    if (state.missileCooldown > 0) state.missileCooldown -= dt;
    if (state.screenShake > 0) state.screenShake = Math.max(0, state.screenShake - dt * 1.4);
    if (state.waveBannerTimer > 0) state.waveBannerTimer = Math.max(0, state.waveBannerTimer - dt);

    // Auto-reload missiles slowly
    if (state.missiles < state.maxMissiles) {
      state.missileReloadTimer += dt;
      if (state.missileReloadTimer >= 6.0) {
        state.missiles++;
        state.missileReloadTimer = 0;
      }
    }

    // Combo decay
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 1;
    }

    // Update enemies
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      const toPlayer = M.sub(ps.pos, e);
      const dist = M.length(toPlayer) || 1;
      const dir = M.scale(toPlayer, 1 / dist);

      // Desired heading toward player (keep slight altitude floor)
      const targetYaw = Math.atan2(-dir.x, -dir.z);
      let dYaw = targetYaw - e.yaw;
      while (dYaw > Math.PI) dYaw -= Math.PI * 2;
      while (dYaw < -Math.PI) dYaw += Math.PI * 2;
      e.yaw += M.clamp(dYaw, -1.6 * dt, 1.6 * dt);
      e.roll = M.clamp(-dYaw * 0.8, -0.9, 0.9);
      e.pitch = M.lerp(e.pitch, Math.asin(M.clamp(dir.y, -0.6, 0.6)), 2.5 * dt);

      const cy = Math.cos(e.yaw), sy = Math.sin(e.yaw);
      const cp = Math.cos(e.pitch), sp = Math.sin(e.pitch);
      e.x += -sy * cp * e.speed * dt;
      e.y += sp * e.speed * dt;
      e.z += -cy * cp * e.speed * dt;
      e.y = Math.max(45, e.y);

      // Enemy firing plasma
      e.fireCd -= dt;
      if (e.fireCd <= 0 && dist < 720) {
        e.fireCd = e.kind === 'boss' ? 1.4 : (2.2 + Math.random() * 1.8);
        const pSpd = 155;
        state.projectiles.push({
          type: 'plasma',
          fromPlayer: false,
          x: e.x, y: e.y, z: e.z,
          vx: dir.x * pSpd,
          vy: dir.y * pSpd,
          vz: dir.z * pSpd,
          yaw: e.yaw,
          pitch: e.pitch,
          life: 0,
          maxLife: 3.5,
          dmg: e.kind === 'boss' ? 16 : 9,
        });
      }

      // Ram collision with player
      if (dist < e.radius + 3.2) {
        ps.hull = Math.max(0, ps.hull - (e.kind === 'boss' ? 35 : 22));
        state.screenShake = 0.45;
        spawnExplosion(e.x, e.y, e.z, e.kind === 'boss' ? 2.2 : 1.2, true);
        if (e.kind !== 'boss') state.enemies.splice(i, 1);
        else e.hp -= 80;
      }
    }

    // Update projectiles
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const pr = state.projectiles[i];
      pr.life += dt;
      if (pr.life >= pr.maxLife) {
        state.projectiles.splice(i, 1);
        continue;
      }

      // Homing steering for player missiles
      if (pr.type === 'missile' && pr.target && state.enemies.includes(pr.target)) {
        const dir = M.normalize(M.sub(pr.target, pr));
        const spd = Math.hypot(pr.vx, pr.vy, pr.vz);
        pr.vx = M.lerp(pr.vx, dir.x * spd, 4.5 * dt);
        pr.vy = M.lerp(pr.vy, dir.y * spd, 4.5 * dt);
        pr.vz = M.lerp(pr.vz, dir.z * spd, 4.5 * dt);
        pr.yaw = Math.atan2(-pr.vx, -pr.vz);
        // Missile smoke puff
        if (Math.random() < 0.65) {
          state.effects.push({
            x: pr.x, y: pr.y, z: pr.z,
            vx: 0, vy: 1, vz: 0,
            life: 0, maxLife: 0.35, size: 1.0, isFire: false,
          });
        }
      }

      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.z += pr.vz * dt;

      if (pr.fromPlayer) {
        let hit = false;
        for (let j = state.enemies.length - 1; j >= 0; j--) {
          const e = state.enemies[j];
          const hitRad = e.radius + (pr.type === 'missile' ? 4.5 : 2.5);
          if (M.dist(pr, e) < hitRad) {
            hit = true;
            state.shotsHit++;
            e.hp -= pr.dmg;
            window.AeroAudio.playHit();
            if (pr.type === 'missile') spawnExplosion(pr.x, pr.y, pr.z, 1.3, true);
            else spawnExplosion(pr.x, pr.y, pr.z, 0.4, false);

            if (e.hp <= 0) {
              state.kills++;
              state.comboTimer = 5.0;
              missionState.score += e.scoreVal * state.combo;
              state.combo = Math.min(5, state.combo + 1);
              spawnExplosion(e.x, e.y, e.z, e.kind === 'boss' ? 3.2 : 1.5, true);
              state.enemies.splice(j, 1);
            }
            break;
          }
        }
        if (hit) {
          state.projectiles.splice(i, 1);
        }
      } else {
        // Enemy plasma hitting player
        if (M.dist(pr, ps.pos) < 4.0) {
          ps.hull = Math.max(0, ps.hull - pr.dmg);
          state.screenShake = Math.max(state.screenShake, 0.25);
          spawnExplosion(pr.x, pr.y, pr.z, 0.6, false);
          state.projectiles.splice(i, 1);
        }
      }
    }

    // Update explosion/smoke effects
    for (let i = state.effects.length - 1; i >= 0; i--) {
      const fx = state.effects[i];
      fx.life += dt;
      if (fx.life >= fx.maxLife) {
        state.effects.splice(i, 1);
        continue;
      }
      fx.x += fx.vx * dt;
      fx.y += fx.vy * dt;
      fx.z += fx.vz * dt;
    }

    // Next wave if cleared
    if (state.enemies.length === 0) {
      state.missiles = Math.min(state.maxMissiles, state.missiles + 2);
      spawnWave(state.wave + 1, ps.pos, ps.yaw);
    }
  }

  function render(proj, view, camPos, time) {
    if (!state.active) return;
    const gl = window.AeroGL.gl;
    const progs = window.AeroGL.programs;
    const isNight = window.AeroWorld.currentMode && window.AeroWorld.currentMode.nightOverride;
    const lit = window.AeroWorld.getLighting(isNight);

    const drawLit = (mesh, modelMat, spec = 0.55) => {
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
      gl.uniform3fv(gl.getUniformLocation(progs.lit, 'uEmissive'), [0, 0, 0]);
      window.AeroGL.drawMesh(mesh);
    };

    // Enemies
    for (const e of state.enemies) {
      const m = enemyMeshes[e.kind] || enemyMeshes.scout;
      const em = M.mat4FromTRS({ x: e.x, y: e.y, z: e.z }, { yaw: e.yaw, pitch: e.pitch, roll: e.roll }, { x: 1, y: 1, z: 1 });
      drawLit(m.body, em, 0.50);

      gl.useProgram(progs.glow);
      gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uProj'), false, proj);
      gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uView'), false, view);
      gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uModel'), false, em);
      gl.uniform1f(gl.getUniformLocation(progs.glow, 'uUseOverride'), 0.0);
      gl.uniform1f(gl.getUniformLocation(progs.glow, 'uAlpha'), 0.92);
      window.AeroGL.drawMesh(m.glow);
    }

    // Projectiles
    gl.useProgram(progs.glow);
    gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uProj'), false, proj);
    gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uView'), false, view);

    for (const pr of state.projectiles) {
      const pm = M.mat4FromTRS({ x: pr.x, y: pr.y, z: pr.z }, { yaw: pr.yaw, pitch: pr.pitch, roll: 0 }, { x: 1, y: 1, z: 1 });
      gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uModel'), false, pm);
      if (pr.type === 'bullet') {
        gl.uniform3fv(gl.getUniformLocation(progs.glow, 'uColorOverride'), [1.0, 0.85, 0.30]);
        gl.uniform1f(gl.getUniformLocation(progs.glow, 'uUseOverride'), 1.0);
        gl.uniform1f(gl.getUniformLocation(progs.glow, 'uAlpha'), 0.95);
        window.AeroGL.drawMesh(bulletMesh);
      } else if (pr.type === 'missile') {
        gl.uniform1f(gl.getUniformLocation(progs.glow, 'uUseOverride'), 0.0);
        gl.uniform1f(gl.getUniformLocation(progs.glow, 'uAlpha'), 1.0);
        window.AeroGL.drawMesh(missileMesh);
      } else {
        gl.uniform3fv(gl.getUniformLocation(progs.glow, 'uColorOverride'), [1.0, 0.25, 0.20]);
        gl.uniform1f(gl.getUniformLocation(progs.glow, 'uUseOverride'), 1.0);
        gl.uniform1f(gl.getUniformLocation(progs.glow, 'uAlpha'), 0.95);
        window.AeroGL.drawMesh(fxMesh);
      }
    }

    // Fireballs & Smoke effects
    for (const fx of state.effects) {
      const t = fx.life / fx.maxLife;
      const s = fx.size * (1 + t * 1.4);
      const fm = M.mat4FromTRS({ x: fx.x, y: fx.y, z: fx.z }, { yaw: 0, pitch: 0, roll: 0 }, { x: s, y: s, z: s });
      gl.uniformMatrix4fv(gl.getUniformLocation(progs.glow, 'uModel'), false, fm);
      gl.uniform3fv(gl.getUniformLocation(progs.glow, 'uColorOverride'), fx.isFire ? [1.0, 0.45 * (1 - t), 0.08] : [0.25, 0.25, 0.28]);
      gl.uniform1f(gl.getUniformLocation(progs.glow, 'uUseOverride'), 1.0);
      gl.uniform1f(gl.getUniformLocation(progs.glow, 'uAlpha'), Math.max(0, (1 - t) * 0.85));
      window.AeroGL.drawMesh(fxMesh);
    }
  }

  return {
    state,
    reset,
    stop,
    fireCannon,
    fireMissile,
    update,
    render,
  };
})();
