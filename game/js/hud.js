/**
 * hud.js - 2D canvas HUD for AEROVANT.
 * Pitch ladder, heading tape, speed/altitude tapes, world markers,
 * chase instrument bar (with FUEL + HULL), cockpit MFDs, minimap,
 * alerts and toasts. All drawn on one overlay canvas.
 * AEROVANT revision v6 - the hull-integrity bar label was misleading,
 * it is now HULL (the bar shows hull integrity: 100% = undamaged);
 * toast pill width is measured with the same font it is drawn in,
 * so long subtitles fit the pill.
 */
(function (global) {
  'use strict';

  const M = global.AerovantMath;
  const W = global.AerovantWorld;

  function HUD(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
  }

  HUD.prototype.resize = function (w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.width = w;
    this.height = h;
  };

  HUD.prototype._roundRect = function (x, y, w, h, r) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  };

  HUD.prototype._text = function (txt, x, y, size, color, align, bold) {
    const c = this.ctx;
    c.font = (bold ? '700 ' : '') + size + 'px system-ui, sans-serif';
    c.fillStyle = color || '#c8f5e8';
    c.textAlign = align || 'center';
    c.textBaseline = 'middle';
    c.fillText(txt, x, y);
  };

  HUD.prototype.draw = function (s) {
    const c = this.ctx;
    const w = this.width, h = this.height;
    const f = s.flight;
    c.clearRect(0, 0, w, h);
    if (!f) return;

    const cx = w / 2, cy = h / 2;
    const roll = f.rollDeg * Math.PI / 180;
    const pitch = f.pitchDeg;

    // Pitch ladder (rolls with the aircraft)
    c.save();
    c.translate(cx, cy);
    c.rotate(-roll);
    c.strokeStyle = 'rgba(120, 240, 210, 0.75)';
    c.fillStyle = 'rgba(120, 240, 210, 0.9)';
    c.lineWidth = 1.5;
    const pxPerDeg = 3.2;
    const pitchOff = pitch * pxPerDeg;
    for (let d = -30; d <= 30; d += 10) {
      const y = -d * pxPerDeg + pitchOff;
      if (y < -h / 2 + 60 || y > h / 2 - 60) continue;
      const len = d === 0 ? 120 : 60;
      c.beginPath();
      c.moveTo(-len / 2, y);
      c.lineTo(len / 2, y);
      c.stroke();
      if (d !== 0) {
        this._text(String(Math.abs(d)), -len / 2 - 18, y, 12, '#9fe8d2', 'right');
        this._text(String(Math.abs(d)), len / 2 + 18, y, 12, '#9fe8d2', 'left');
      }
    }
    c.strokeStyle = 'rgba(140, 240, 220, 0.9)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-w * 0.22, pitchOff);
    c.lineTo(w * 0.22, pitchOff);
    c.stroke();
    c.restore();

    // Center reticle
    c.strokeStyle = '#7df0c8';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(cx - 14, cy);
    c.lineTo(cx + 14, cy);
    c.moveTo(cx, cy - 14);
    c.lineTo(cx, cy + 14);
    c.stroke();
    c.beginPath();
    c.arc(cx, cy, 22, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(125, 240, 200, 0.5)';
    c.stroke();

    // Heading tape
    const tapeY = 64;
    const tapeW = 320;
    c.fillStyle = 'rgba(10, 18, 24, 0.72)';
    this._roundRect(cx - tapeW / 2, tapeY - 18, tapeW, 36, 8);
    c.fill();
    c.strokeStyle = 'rgba(120, 240, 210, 0.4)';
    c.stroke();
    const heading = f.headingDeg;
    c.save();
    c.beginPath();
    this._roundRect(cx - tapeW / 2, tapeY - 18, tapeW, 36, 8);
    c.clip();
    for (let d = -60; d <= 60; d += 5) {
      const hd = M.wrapAngleDeg(heading + d);
      const x = cx + d * 2.4;
      const major = hd % 30 === 0;
      c.strokeStyle = 'rgba(160, 240, 215, 0.8)';
      c.lineWidth = major ? 2 : 1;
      c.beginPath();
      c.moveTo(x, tapeY + 4);
      c.lineTo(x, tapeY + (major ? 14 : 9));
      c.stroke();
      if (major) {
        const label = hd === 0 ? 'N' : hd === 90 ? 'E' : hd === 180 ? 'S' : hd === 270 ? 'W' : String(hd).padStart(3, '0');
        this._text(label, x, tapeY - 6, 12, hd % 90 === 0 ? '#ffd166' : '#b8f5e2', 'center', true);
      }
    }
    c.restore();
    c.fillStyle = 'rgba(10, 18, 24, 0.85)';
    this._roundRect(cx - 42, tapeY + 22, 84, 22, 6);
    c.fill();
    this._text('HDG ' + String(Math.round(heading)).padStart(3, '0') + '°', cx, tapeY + 33, 13, '#7df0c8', 'center', true);

    // Speed tape (left)
    const kts = Math.round(f.speed * 1.944);
    const tapeX = 24, tapeTop = 150, tapeH = 300;
    c.fillStyle = 'rgba(10, 18, 24, 0.72)';
    this._roundRect(tapeX, tapeTop, 76, tapeH, 8);
    c.fill();
    c.strokeStyle = 'rgba(120, 240, 210, 0.4)';
    c.stroke();
    this._text('SPD (KTS)', tapeX + 38, tapeTop + 12, 10, '#8fd8c2', 'center', true);
    c.save();
    c.beginPath();
    this._roundRect(tapeX, tapeTop, 76, tapeH, 8);
    c.clip();
    for (let d = -40; d <= 40; d += 10) {
      const v = kts + d;
      if (v < 0) continue;
      const y = tapeTop + tapeH / 2 - d * 2.2;
      c.strokeStyle = 'rgba(160, 240, 215, 0.7)';
      c.beginPath();
      c.moveTo(tapeX + 8, y);
      c.lineTo(tapeX + 22, y);
      c.stroke();
      this._text(String(v), tapeX + 46, y, 11, '#b8f5e2', 'center');
    }
    c.restore();
    c.fillStyle = 'rgba(10, 18, 24, 0.9)';
    this._roundRect(tapeX + 4, tapeTop + tapeH / 2 - 16, 68, 32, 6);
    c.fill();
    c.strokeStyle = '#2dd4a8';
    c.stroke();
    this._text(String(kts), tapeX + 38, tapeTop + tapeH / 2, 18, '#7df0c8', 'center', true);
    this._text(Math.round(f.speed * 3.6) + ' KM/H', tapeX + 38, tapeTop + tapeH - 28, 11, '#ffd166', 'center');
    this._text('THR ' + Math.round(f.throttle * 100) + '%', tapeX + 38, tapeTop + tapeH - 12, 11, '#ffd166', 'center');

    // Altitude tape (right)
    const altX = w - 100, altTop = 150, altH = 300;
    c.fillStyle = 'rgba(10, 18, 24, 0.72)';
    this._roundRect(altX, altTop, 76, altH, 8);
    c.fill();
    c.strokeStyle = 'rgba(120, 240, 210, 0.4)';
    c.stroke();
    this._text('ALT (M)', altX + 38, altTop + 12, 10, '#8fd8c2', 'center', true);
    const alt = Math.round(f.altMSL);
    c.save();
    c.beginPath();
    this._roundRect(altX, altTop, 76, altH, 8);
    c.clip();
    for (let d = -80; d <= 80; d += 20) {
      const v = alt + d;
      if (v < 0) continue;
      const y = altTop + altH / 2 - d * 1.1;
      c.strokeStyle = 'rgba(160, 240, 215, 0.7)';
      c.beginPath();
      c.moveTo(altX + 54, y);
      c.lineTo(altX + 68, y);
      c.stroke();
      this._text(String(v), altX + 30, y, 11, '#b8f5e2', 'center');
    }
    c.restore();
    c.fillStyle = 'rgba(10, 18, 24, 0.9)';
    this._roundRect(altX + 4, altTop + altH / 2 - 16, 68, 32, 6);
    c.fill();
    c.strokeStyle = '#2dd4a8';
    c.stroke();
    this._text(String(alt).padStart(4, '0'), altX + 38, altTop + altH / 2, 18, '#7df0c8', 'center', true);
    this._text('AGL ' + Math.round(f.altAGL) + 'm', altX + 38, altTop + altH - 28, 11, '#ffd166', 'center');
    this._text('VSI ' + (f.vsi >= 0 ? '+' : '') + f.vsi.toFixed(1), altX + 38, altTop + altH - 12, 11, '#ffd166', 'center');

    // Fuel + hull bars (under the speed tape)
    const barY = tapeTop + tapeH + 12;
    this._bar(tapeX, barY, 76, 12, f.fuel / 100, f.fuel < 20 ? '#ff5a4a' : '#ffb020', 'FUEL');
    this._bar(tapeX, barY + 20, 76, 12, 1 - f.damage / 100, f.damage > 60 ? '#ff5a4a' : '#2dd4a8', 'HULL');

    // World marker: next objective
    if (s.objective && s.project) {
      const p = s.project(s.objective.pos);
      if (p) {
        const dx = p.x - cx, dy = p.y - cy;
        const dist = Math.hypot(dx, dy);
        const maxR = Math.min(w, h) * 0.42;
        let mx = p.x, my = p.y;
        if (dist > maxR) {
          mx = cx + dx / dist * maxR;
          my = cy + dy / dist * maxR;
        }
        const ang = Math.atan2(dy, dx);
        c.save();
        c.translate(mx, my);
        c.rotate(ang);
        c.fillStyle = '#2dd4d8';
        c.beginPath();
        c.moveTo(14, 0);
        c.lineTo(-8, -9);
        c.lineTo(-8, 9);
        c.closePath();
        c.fill();
        c.restore();
        this._text(s.objective.label + ' (' + Math.round(s.objective.dist) + 'm)', mx, my - 22, 13, '#7df0c8', 'center', true);
      }
    }

    // Bottom instrument bar (chase) or MFDs (cockpit)
    if (s.cameraMode === 'cockpit') {
      this._drawCockpit(s, w, h);
    } else {
      this._drawChaseBar(s, w, h);
    }

    // Minimap
    this._drawMinimap(s, w, h);

    // Yoke indicator
    if (s.yokeOn) {
      const yx = w - 190, yy = h - 150;
      c.fillStyle = 'rgba(10, 18, 24, 0.7)';
      this._roundRect(yx - 50, yy - 50, 100, 100, 10);
      c.fill();
      c.strokeStyle = 'rgba(120, 240, 210, 0.5)';
      c.stroke();
      c.beginPath();
      c.arc(yx, yy, 34, 0, Math.PI * 2);
      c.stroke();
      const kx = yx + (s.yokeX || 0) * 30;
      const ky = yy + (s.yokeY || 0) * 30;
      c.fillStyle = '#2dd4d8';
      c.beginPath();
      c.arc(kx, ky, 8, 0, Math.PI * 2);
      c.fill();
      this._text('YOKE', yx, yy + 42, 10, '#8fd8c2', 'center', true);
    }

    // Alerts
    if (s.alert) {
      const ay = h * 0.22;
      c.fillStyle = 'rgba(40, 8, 8, 0.8)';
      this._roundRect(cx - 150, ay - 18, 300, 36, 8);
      c.fill();
      c.strokeStyle = '#ff5a4a';
      c.lineWidth = 2;
      c.stroke();
      this._text(s.alert, cx, ay, 18, '#ff8a7a', 'center', true);
    }

    // Toasts (pill width measured with the same font the text is drawn
    // in, and shrunk if needed, so long subtitles never spill past
    // the pill or the screen edge)
    let ty = 126;
    for (const t of (s.toasts || [])) {
      let size = 14;
      c.font = size + 'px system-ui, sans-serif';
      let tw = c.measureText(t.text).width + 28;
      while (tw > w - 32 && size > 10) {
        size -= 1;
        c.font = size + 'px system-ui, sans-serif';
        tw = c.measureText(t.text).width + 28;
      }
      c.fillStyle = 'rgba(10, 18, 24, 0.78)';
      this._roundRect(cx - tw / 2, ty - 14, tw, 28, 14);
      c.fill();
      this._text(t.text, cx, ty, size, '#c8f5e8', 'center');
      ty += 34;
    }
  };

  HUD.prototype._bar = function (x, y, w, h, frac, color, label) {
    const c = this.ctx;
    c.fillStyle = 'rgba(10, 18, 24, 0.72)';
    this._roundRect(x, y, w, h, 4);
    c.fill();
    c.fillStyle = color;
    const fw = Math.max(0, Math.min(1, frac)) * (w - 4);
    if (fw > 0) {
      this._roundRect(x + 2, y + 2, fw, h - 4, 3);
      c.fill();
    }
    c.font = '700 9px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.strokeStyle = 'rgba(6, 12, 14, 0.85)';
    c.lineWidth = 3;
    c.strokeText(label + ' ' + Math.round(frac * 100) + '%', x + w / 2, y + h / 2);
    c.fillStyle = '#eafff6';
    c.fillText(label + ' ' + Math.round(frac * 100) + '%', x + w / 2, y + h / 2);
  };

  HUD.prototype._drawChaseBar = function (s, w, h) {
    const c = this.ctx;
    const f = s.flight;
    const barW = 420, barH = 64;
    const bx = w / 2 - barW / 2, by = h - barH - 16;
    c.fillStyle = 'rgba(10, 18, 24, 0.78)';
    this._roundRect(bx, by, barW, barH, 10);
    c.fill();
    c.strokeStyle = 'rgba(120, 240, 210, 0.35)';
    c.stroke();

    // Mini attitude indicator
    const ax = bx + 34, ay = by + barH / 2;
    c.save();
    c.beginPath();
    c.arc(ax, ay, 22, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = '#2a7fd4';
    c.fillRect(ax - 22, ay - 22, 44, 22);
    c.fillStyle = '#8a5a2a';
    c.fillRect(ax - 22, ay, 44, 22);
    c.rotate(-f.rollDeg * Math.PI / 180);
    c.fillStyle = '#7df0c8';
    c.fillRect(ax - 22, ay - 2, 44, 4);
    c.restore();
    c.strokeStyle = '#2dd4a8';
    c.beginPath();
    c.arc(ax, ay, 22, 0, Math.PI * 2);
    c.stroke();

    // Lamps: GEAR / FLAP / BRK / YOKE
    const lamps = [
      ['GEAR', f.gearDown ? 'DN' : 'UP', f.gearDown ? '#2dd4a8' : '#8a94a0'],
      ['FLAP', f.flapsDeg > 0 ? f.flapsDeg + '°' : '0°', f.flapsDeg > 0 ? '#ffd166' : '#8a94a0'],
      ['BRK', f.airbrake ? 'ON' : 'OFF', f.airbrake ? '#ff5a4a' : '#8a94a0'],
      ['YOKE', s.yokeOn ? 'ON' : 'KEYS', s.yokeOn ? '#2dd4a8' : '#8a94a0']
    ];
    let lx = bx + 68;
    for (const [label, val, col] of lamps) {
      c.fillStyle = 'rgba(255,255,255,0.06)';
      this._roundRect(lx, by + 10, 52, 44, 6);
      c.fill();
      this._text(label, lx + 26, by + 20, 9, '#8fd8c2', 'center', true);
      this._text(val, lx + 26, by + 40, 12, col, 'center', true);
      lx += 58;
    }

    // Thrust bar + G-load
    const tx = lx + 6;
    c.fillStyle = 'rgba(255,255,255,0.08)';
    this._roundRect(tx, by + 12, 110, 12, 6);
    c.fill();
    c.fillStyle = f.afterburner ? '#ff7a3c' : '#ffb020';
    this._roundRect(tx + 2, by + 14, Math.max(2, (f.throttle * 106)), 8, 4);
    c.fill();
    this._text('THRUST ' + Math.round(f.throttle * 100) + '%', tx + 55, by + 34, 10, '#ffd166', 'center', true);
    this._text('G ' + f.gLoad.toFixed(1) + '  •  ' + (s.aircraftName || ''), tx + 55, by + 50, 10, '#8fd8c2', 'center');
  };

  HUD.prototype._drawCockpit = function (s, w, h) {
    const c = this.ctx;
    const f = s.flight;
    // Canopy frame
    c.strokeStyle = 'rgba(8, 12, 16, 0.95)';
    c.lineWidth = 14;
    c.beginPath();
    c.moveTo(0, h * 0.72);
    c.lineTo(w * 0.32, h * 0.28);
    c.lineTo(w * 0.68, h * 0.28);
    c.lineTo(w, h * 0.72);
    c.stroke();
    c.lineWidth = 10;
    c.beginPath();
    c.moveTo(w * 0.5, h * 0.28);
    c.lineTo(w * 0.5, h * 0.1);
    c.stroke();

    // Dashboard
    const dashY = h - 150;
    c.fillStyle = 'rgba(8, 14, 18, 0.92)';
    c.fillRect(0, dashY, w, 150);
    c.strokeStyle = 'rgba(120, 240, 210, 0.3)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, dashY);
    c.lineTo(w, dashY);
    c.stroke();

    const mfdW = 250, mfdH = 120, gap = 24;
    const totalW = mfdW * 3 + gap * 2;
    let mx = w / 2 - totalW / 2;
    const my = dashY + 14;

    // MFD 1: ATTITUDE / PFD
    this._mfd(mx, my, mfdW, mfdH, 'ATTITUDE / PFD');
    const ax = mx + 62, ay = my + 66;
    c.save();
    c.beginPath();
    c.arc(ax, ay, 40, 0, Math.PI * 2);
    c.clip();
    c.translate(ax, ay);
    c.rotate(-f.rollDeg * Math.PI / 180);
    c.translate(0, f.pitchDeg * 1.2);
    c.fillStyle = '#2a7fd4';
    c.fillRect(-42, -42, 84, 42);
    c.fillStyle = '#8a5a2a';
    c.fillRect(-42, 0, 84, 42);
    c.fillStyle = '#fff';
    c.fillRect(-42, -2, 84, 4);
    c.restore();
    c.strokeStyle = '#2dd4a8';
    c.beginPath();
    c.arc(ax, ay, 40, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.moveTo(ax - 14, ay);
    c.lineTo(ax + 14, ay);
    c.moveTo(ax, ay - 10);
    c.lineTo(ax, ay + 10);
    c.strokeStyle = '#ffd166';
    c.stroke();
    this._text('HDG ' + String(Math.round(f.headingDeg)).padStart(3, '0'), mx + 175, my + 40, 14, '#7df0c8', 'center', true);
    this._text('ALT ' + Math.round(f.altMSL) + 'm', mx + 175, my + 66, 14, '#7df0c8', 'center', true);
    this._text('SPD ' + Math.round(f.speed * 1.944) + 'kt', mx + 175, my + 92, 14, '#7df0c8', 'center', true);

    // MFD 2: SYSTEMS / NAV
    mx += mfdW + gap;
    this._mfd(mx, my, mfdW, mfdH, 'SYSTEMS / NAV');
    const sys = [
      ['GEAR', f.gearDown ? 'DN' : 'UP', f.gearDown],
      ['FLAP', f.flapsDeg > 0 ? f.flapsDeg + '°' : '0°', f.flapsDeg > 0],
      ['STALL', f.stall ? 'WARN' : 'OK', !f.stall],
      ['TERR', f.terrainWarning ? 'WARN' : 'CLR', !f.terrainWarning],
      ['A/B', f.afterburner ? 'MAX' : 'OFF', f.afterburner],
      ['YOKE', s.yokeOn ? 'ON' : 'OFF', s.yokeOn]
    ];
    for (let i = 0; i < sys.length; i++) {
      const [label, val, ok] = sys[i];
      const col = i % 3, row = Math.floor(i / 3);
      const sx = mx + 10 + col * 78, sy = my + 34 + row * 44;
      c.fillStyle = ok ? 'rgba(45, 212, 168, 0.18)' : 'rgba(255, 90, 74, 0.22)';
      this._roundRect(sx, sy, 70, 36, 5);
      c.fill();
      this._text(label, sx + 35, sy + 11, 9, '#8fd8c2', 'center', true);
      this._text(val, sx + 35, sy + 26, 12, ok ? '#7df0c8' : '#ff8a7a', 'center', true);
    }

    // MFD 3: ENGINE / THRUST (with FUEL + HULL)
    mx += mfdW + gap;
    this._mfd(mx, my, mfdW, mfdH, 'ENGINE / THRUST');
    const gx = mx + 62, gy = my + 66;
    c.strokeStyle = '#ff7a3c';
    c.lineWidth = 8;
    c.beginPath();
    c.arc(gx, gy, 34, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * f.throttle);
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.15)';
    c.beginPath();
    c.arc(gx, gy, 34, Math.PI * 0.75 + Math.PI * 1.5 * f.throttle, Math.PI * 2.25);
    c.stroke();
    this._text(Math.round(f.throttle * 100) + '%', gx, gy, 16, '#ffd166', 'center', true);
    this._text('N1 RPM', gx, gy + 20, 9, '#8fd8c2', 'center');
    this._text('EGT ' + Math.round(600 + f.throttle * 280) + 'C', mx + 175, my + 34, 12, '#b8f5e2', 'center');
    this._text('G ' + f.gLoad.toFixed(1) + '  AOA ' + f.aoa.toFixed(1) + '°', mx + 175, my + 56, 12, '#b8f5e2', 'center');
    this._bar(mx + 130, my + 72, 100, 10, f.fuel / 100, f.fuel < 20 ? '#ff5a4a' : '#ffb020', 'FUEL');
    this._bar(mx + 130, my + 88, 100, 10, 1 - f.damage / 100, f.damage > 60 ? '#ff5a4a' : '#2dd4a8', 'HULL');
  };

  HUD.prototype._mfd = function (x, y, w, h, title) {
    const c = this.ctx;
    c.fillStyle = 'rgba(16, 28, 34, 0.95)';
    this._roundRect(x, y, w, h, 8);
    c.fill();
    c.strokeStyle = '#2dd4a8';
    c.lineWidth = 1.5;
    c.stroke();
    this._text(title, x + 10, y + 12, 11, '#7df0c8', 'left', true);
  };

  HUD.prototype._drawMinimap = function (s, w, h) {
    const c = this.ctx;
    const f = s.flight;
    const size = 160;
    const mx = w - size - 16, my = h - size - 16;
    c.fillStyle = 'rgba(10, 18, 24, 0.8)';
    this._roundRect(mx, my, size, size, 10);
    c.fill();
    c.strokeStyle = 'rgba(120, 240, 210, 0.4)';
    c.stroke();
    this._text('RADAR PETA', mx + size / 2, my + 12, 10, '#8fd8c2', 'center', true);

    const scale = size / 7200;
    const toMap = (x, z) => [mx + size / 2 + x * scale, my + size / 2 + z * scale];
    // River
    c.strokeStyle = '#2a7fd4';
    c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i < W.RIVER.points.length; i++) {
      const [px, pz] = toMap(W.RIVER.points[i][0], W.RIVER.points[i][1]);
      if (i === 0) c.moveTo(px, pz); else c.lineTo(px, pz);
    }
    c.stroke();
    // Peaks
    c.fillStyle = 'rgba(180, 190, 200, 0.7)';
    for (const p of W.PEAKS) {
      const [px, pz] = toMap(p.x, p.z);
      c.beginPath();
      c.arc(px, pz, 4, 0, Math.PI * 2);
      c.fill();
    }
    // City
    c.fillStyle = 'rgba(255, 200, 80, 0.7)';
    const [cxp, czp] = toMap(W.CITY.x, W.CITY.z);
    c.fillRect(cxp - 5, czp - 5, 10, 10);
    // Runway
    c.fillStyle = '#e8e8e8';
    const [rx, rz] = toMap(W.RUNWAY.x, W.RUNWAY.z);
    c.fillRect(rx - 2, rz - 8, 4, 16);
    // Rings
    if (s.rings) {
      for (let i = 0; i < s.rings.length; i++) {
        const ring = s.rings[i];
        const [px, pz] = toMap(ring.x, ring.z);
        c.strokeStyle = i === s.nextRingIndex ? '#2dd4d8' : 'rgba(120, 200, 255, 0.5)';
        c.lineWidth = i === s.nextRingIndex ? 2.5 : 1;
        c.beginPath();
        c.arc(px, pz, 4, 0, Math.PI * 2);
        c.stroke();
      }
    }
    // Aircraft arrow
    const [ax, az] = toMap(f.pos[0], f.pos[2]);
    c.save();
    c.translate(ax, az);
    c.rotate(-f.headingDeg * Math.PI / 180);
    c.fillStyle = '#ffd166';
    c.beginPath();
    c.moveTo(0, -7);
    c.lineTo(5, 6);
    c.lineTo(-5, 6);
    c.closePath();
    c.fill();
    c.restore();
  };

  global.AerovantHUD = HUD;
})(window);
