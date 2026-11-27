/**
 * audio.js - Procedural WebAudio sound effects for AEROVANT
 * Everything is synthesized with the Web Audio API. No external files.
 * AEROVANT revision v5 - propeller drone base frequency 38 -> 36 Hz
 * (slightly deeper chop on the Jalak Bali turboprop).
 */
(function (global) {
  'use strict';

  function AudioEngine() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.userVolume = 0.8;

    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.windSource = null;
    this.windFilter = null;
    this.windGain = null;
    this.rumbleOsc = null;
    this.rumbleGain = null;
    this.propOsc = null;
    this.propGain = null;

    this.started = false;
    this.propEnabled = false;
    this.turboEnabled = false;
    this.enginePitch = 1.0;

    this.lastWarnTime = 0;
    this.lastTouchTime = 0;
    this.lastCrashTime = 0;
    this.lastChimeTime = 0;
    this.lastGearTime = 0;
    this.lastFlapTime = 0;
  }

  AudioEngine.prototype.init = function () {
    if (this.context) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.context = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(ctx.destination);

    // Turbine engine: two detuned sawtooths through a low-pass filter
    this.engineOsc1 = ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.value = 52;
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'sawtooth';
    this.engineOsc2.frequency.value = 78;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 440;
    this.engineFilter.Q.value = 1.2;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc1.start();
    this.engineOsc2.start();

    // Propeller drone (turboprop): low square wave
    this.propOsc = ctx.createOscillator();
    this.propOsc.type = 'square';
    this.propOsc.frequency.value = 36;
    this.propGain = ctx.createGain();
    this.propGain.gain.value = 0.0;
    this.propOsc.connect(this.propGain);
    this.propGain.connect(this.master);
    this.propOsc.start();

    // Wind: looping noise buffer through a band-pass filter
    const bufferSize = ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.windSource = ctx.createBufferSource();
    this.windSource.buffer = noiseBuffer;
    this.windSource.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 900;
    this.windFilter.Q.value = 0.7;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.0;
    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.master);
    this.windSource.start();

    // Rumble: low-frequency triangle for ground roll / vibration
    this.rumbleOsc = ctx.createOscillator();
    this.rumbleOsc.type = 'triangle';
    this.rumbleOsc.frequency.value = 28;
    this.rumbleGain = ctx.createGain();
    this.rumbleGain.gain.value = 0.0;
    this.rumbleOsc.connect(this.rumbleGain);
    this.rumbleGain.connect(this.master);
    this.rumbleOsc.start();

    this.started = true;
  };

  AudioEngine.prototype.resume = function () {
    if (this.context && this.context.state === 'suspended') {
      this.context.resume();
    }
  };

  AudioEngine.prototype.setMuted = function (muted) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(
        muted ? 0.0 : this.userVolume, this.context.currentTime, 0.08
      );
    }
  };

  // Per-aircraft engine character: turboprop chops, jets whine. pitch is a base multiplier.
  AudioEngine.prototype.setAircraftTone = function (pitch, prop, turbo) {
    this.enginePitch = pitch;
    this.propEnabled = !!prop;
    this.turboEnabled = !!turbo;
  };

  AudioEngine.prototype.update = function (state) {
    if (!this.context || !this.started) return;
    const t = this.context.currentTime;

    const throttle = state.throttle || 0;
    const airspeed = state.airspeed || 0;
    const onGround = !!state.onGround;
    const rpm = state.rpm != null ? state.rpm : throttle;

    const isProp = this.propEnabled;

    const engineGainBase = isProp ? 0.06 : 0.16;
    const engineGainTarget = this.muted || state.isCrashed ? 0 : engineGainBase * (0.25 + throttle * 0.75) * this.userVolume;
    if (this.engineGain) this.engineGain.gain.setTargetAtTime(engineGainTarget, t, 0.08);

    const baseFreq = 52 * (this.enginePitch || 1.0) * (0.55 + rpm * 1.25);
    if (this.engineOsc1) this.engineOsc1.frequency.setTargetAtTime(baseFreq, t, 0.06);
    if (this.engineOsc2) this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.5 + 3, t, 0.06);
    if (this.engineFilter) {
      this.engineFilter.frequency.setTargetAtTime(320 + rpm * 1400, t, 0.08);
    }

    const propGainTarget = this.muted || state.isCrashed ? 0 : (isProp ? 0.14 * (0.2 + throttle * 0.8) * this.userVolume : 0);
    if (this.propGain) this.propGain.gain.setTargetAtTime(propGainTarget, t, 0.08);
    if (this.propOsc) this.propOsc.frequency.setTargetAtTime(30 + throttle * 55, t, 0.1);

    const windGainTarget = this.muted || state.isCrashed
      ? 0
      : Math.min(0.55, (airspeed / 200) * 0.55) * this.userVolume;
    if (this.windGain) this.windGain.gain.setTargetAtTime(windGainTarget, t, 0.12);
    if (this.windFilter) {
      this.windFilter.frequency.setTargetAtTime(400 + airspeed * 5, t, 0.1);
    }

    const rumbleTarget = onGround && airspeed > 1
      ? Math.min(0.22, airspeed * 0.002) * this.userVolume
      : 0;
    if (this.rumbleGain) this.rumbleGain.gain.setTargetAtTime(rumbleTarget, t, 0.08);
  };

  AudioEngine.prototype._blip = function (freq, dur, vol, type) {
    if (!this.context || this.muted) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  };

  AudioEngine.prototype.ringPass = function (combo) {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    if (now - this.lastChimeTime < 0.15) return;
    this.lastChimeTime = now;
    const base = 660 * Math.pow(1.059, Math.min(combo, 8));
    this._blip(base, 0.18, 0.22, 'sine');
    this._blip(base * 1.5, 0.22, 0.18, 'sine');
  };

  AudioEngine.prototype.warnStall = function () {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    if (now - this.lastWarnTime < 0.4) return;
    this.lastWarnTime = now;
    this._blip(880, 0.12, 0.16, 'square');
  };

  AudioEngine.prototype.warnTerrain = function () {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    if (now - this.lastWarnTime < 0.5) return;
    this.lastWarnTime = now;
    this._blip(440, 0.16, 0.18, 'sawtooth');
  };

  AudioEngine.prototype.gear = function (down) {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    if (now - this.lastGearTime < 0.3) return;
    this.lastGearTime = now;
    this._blip(down ? 220 : 320, 0.12, 0.2, 'square');
    this._blip(down ? 180 : 260, 0.15, 0.15, 'square');
  };

  AudioEngine.prototype.flaps = function () {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    if (now - this.lastFlapTime < 0.3) return;
    this.lastFlapTime = now;
    this._blip(500, 0.08, 0.14, 'square');
  };

  AudioEngine.prototype.touchdown = function () {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    if (now - this.lastTouchTime < 0.5) return;
    this.lastTouchTime = now;
    this._blip(140, 0.25, 0.28, 'triangle');
  };

  AudioEngine.prototype.crash = function () {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    if (now - this.lastCrashTime < 1) return;
    this.lastCrashTime = now;
    this._blip(90, 0.6, 0.35, 'sawtooth');
    this._blip(55, 0.8, 0.3, 'triangle');
  };

  AudioEngine.prototype.success = function () {
    if (!this.context || this.muted) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      setTimeout(() => this._blip(f, 0.35, 0.2, 'sine'), i * 110);
    });
  };

  AudioEngine.prototype.lowFuel = function () {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    if (now - this.lastWarnTime < 0.6) return;
    this.lastWarnTime = now;
    this._blip(660, 0.1, 0.14, 'square');
    this._blip(520, 0.12, 0.12, 'square');
  };

  global.AerovantAudio = AudioEngine;
})(window);
