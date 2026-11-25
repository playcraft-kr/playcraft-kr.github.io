// EVERGREEN — procedural ambience, music and sound effects (Web Audio, no assets)
export class Audio {
  constructor() { this.ctx = null; this.vol = { music: 0.5, sfx: 0.8, amb: 0.7 }; }
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(ctx.destination);
    this.musicBus = ctx.createGain(); this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
    this.ambBus = ctx.createGain(); this.ambBus.connect(this.master);
    // reverb for music & birds
    this.verb = ctx.createConvolver(); const len = ctx.sampleRate * 2.4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = 0.35; this.verb.connect(vg); vg.connect(this.master);
    // noise buffer
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0); let b = 0;
    for (let i = 0; i < nd.length; i++) { const w = Math.random() * 2 - 1; b = 0.98 * b + 0.02 * w; nd[i] = w * 0.5 + b * 3; }
    this.noise = nb;
    const loop = (type, f, q) => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.playbackRate.value = 0.5 + Math.random() * 0.2; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); s.start(); return { s, fl, g }; };
    this.wind = loop('lowpass', 500, 0.6); this.wind.g.connect(this.ambBus);
    this.rain = loop('highpass', 1800, 0.4); this.rain.g.connect(this.ambBus);
    // positional water (river / waterfall)
    this.water = loop('bandpass', 900, 0.5); this.waterPan = ctx.createPanner(); this.waterPan.panningModel = 'HRTF'; this.waterPan.distanceModel = 'inverse'; this.waterPan.refDistance = 4; this.waterPan.rolloffFactor = 1.3; this.water.g.connect(this.waterPan); this.waterPan.connect(this.ambBus);
    this.falls = loop('lowpass', 1400, 0.3); this.fallsPan = ctx.createPanner(); this.fallsPan.panningModel = 'HRTF'; this.fallsPan.refDistance = 6; this.fallsPan.rolloffFactor = 1.1; this.falls.g.connect(this.fallsPan); this.fallsPan.connect(this.ambBus);
    this.crowd = loop('bandpass', 420, 2.5); this.crowdPan = ctx.createPanner(); this.crowdPan.refDistance = 5; this.crowd.g.connect(this.crowdPan); this.crowdPan.connect(this.ambBus);
    this.fire = loop('bandpass', 2400, 0.8); this.firePan = ctx.createPanner(); this.firePan.refDistance = 2; this.firePan.rolloffFactor = 2; this.fire.g.connect(this.firePan); this.firePan.connect(this.ambBus);
    this.nextBird = 0; this.nextCricket = 0; this.nextNote = 0; this.mstep = 0; this.chord = 0;
    this.applyVol();
  }
  applyVol() { if (!this.ctx) return; this.musicBus.gain.value = this.vol.music * 0.5; this.sfxBus.gain.value = this.vol.sfx; this.ambBus.gain.value = this.vol.amb; }
  setPan(p, x, y, z) { if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z); }
  // ---- per-frame ambience update ----
  update(dt, s) {
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime, L = ctx.listener, c = s.cam;
    if (L.positionX) { L.positionX.value = c.position.x; L.positionY.value = c.position.y; L.positionZ.value = c.position.z; const f = s.camDir; L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    else { L.setPosition(c.position.x, c.position.y, c.position.z); L.setOrientation(s.camDir.x, s.camDir.y, s.camDir.z, 0, 1, 0); }
    const ramp = (g, v) => g.gain.setTargetAtTime(v, t, 0.6);
    ramp(this.wind.g, 0.05 + s.wind * 0.12 + s.altitude * 0.004); this.wind.fl.frequency.setTargetAtTime(350 + s.wind * 500, t, 1);
    ramp(this.rain.g, s.rain * 0.22 + s.snow * 0.03);
    this.setPan(this.waterPan, s.riverPt.x, s.riverPt.y, s.riverPt.z); ramp(this.water.g, 0.22);
    this.setPan(this.fallsPan, s.fallsPt.x, s.fallsPt.y, s.fallsPt.z); ramp(this.falls.g, 0.35);
    this.setPan(this.crowdPan, s.crowdPt.x, s.crowdPt.y, s.crowdPt.z); ramp(this.crowd.g, Math.min(0.18, s.crowd * 0.03));
    this.setPan(this.firePan, s.firePt.x, s.firePt.y, s.firePt.z); ramp(this.fire.g, s.night * 0.25 + 0.05);
    // birds by day, crickets & owls at night — positioned around the listener
    if (t > this.nextBird && s.day > 0.3 && s.rain < 0.3 && !s.winterQuiet) { this.bird(c.position, s.region); this.nextBird = t + 1.5 + Math.random() * 5; }
    if (t > this.nextCricket && s.night > 0.5 && s.snow < 0.2) { this.cricket(c.position); this.nextCricket = t + 0.4 + Math.random() * 1.2; }
    if (s.night > 0.7 && Math.random() < dt * 0.03) this.owl(c.position);
    this.music(t, s);
  }
  pan3(x, y, z) { const p = this.ctx.createPanner(); p.panningModel = 'HRTF'; p.refDistance = 3; p.rolloffFactor = 1; this.setPan(p, x, y, z); return p; }
  bird(cp, region) {
    const ctx = this.ctx, t = ctx.currentTime, a = Math.random() * 6.28, d = 6 + Math.random() * 14;
    const p = this.pan3(cp.x + Math.cos(a) * d, cp.y + 3 + Math.random() * 5, cp.z + Math.sin(a) * d); p.connect(this.ambBus); p.connect(this.verb);
    const base = region === 2 ? 2600 : region === 1 ? 1900 : 3000 + Math.random() * 1200, n = 2 + Math.floor(Math.random() * 5), kind = Math.random();
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; const st = t + i * (0.09 + Math.random() * 0.08);
      const f0 = base * (0.9 + Math.random() * 0.3); o.frequency.setValueAtTime(f0, st);
      if (kind < 0.5) o.frequency.exponentialRampToValueAtTime(f0 * 1.5, st + 0.07); else o.frequency.exponentialRampToValueAtTime(f0 * 0.7, st + 0.1);
      g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.06, st + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, st + 0.12);
      o.connect(g); g.connect(p); o.start(st); o.stop(st + 0.15);
    }
  }
  cricket(cp) {
    const ctx = this.ctx, t = ctx.currentTime, a = Math.random() * 6.28, p = this.pan3(cp.x + Math.cos(a) * 8, cp.y - 1, cp.z + Math.sin(a) * 8); p.connect(this.ambBus);
    for (let i = 0; i < 3; i++) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 4400 + Math.random() * 300; const st = t + i * 0.06; g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.012, st + 0.01); g.gain.linearRampToValueAtTime(0, st + 0.04); o.connect(g); g.connect(p); o.start(st); o.stop(st + 0.05); }
  }
  owl(cp) {
    const ctx = this.ctx, t = ctx.currentTime, p = this.pan3(cp.x + 15, cp.y + 6, cp.z - 10); p.connect(this.ambBus); p.connect(this.verb);
    for (const [dt, f] of [[0, 420], [0.5, 380], [0.75, 380]]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(0.05, t + dt + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.35); o.connect(g); g.connect(p); o.start(t + dt); o.stop(t + dt + 0.4); }
  }
  // gentle generative music: soft pad chords + plucked pentatonic melody, mood shifts with time of day
  music(t, s) {
    if (t < this.nextNote) return;
    const ctx = this.ctx, beat = s.night > 0.5 ? 0.75 : 0.55;
    const chords = s.night > 0.5 ? [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]] : [[60, 64, 67], [57, 60, 64], [65, 69, 72], [55, 59, 62]];
    if (this.mstep % 8 === 0) { const ch = chords[this.chord % chords.length]; this.chord++; for (const n of ch) this.pad(n - 12, beat * 8, t); }
    const scale = [0, 2, 4, 7, 9, 12, 14, 16], root = s.night > 0.5 ? 57 : 60;
    if (Math.random() < (s.event ? 0.8 : 0.55)) this.pluck(root + scale[Math.floor(Math.random() * scale.length)], t, s.night > 0.5 ? 0.05 : 0.07);
    this.mstep++; this.nextNote = t + beat;
  }
  hz(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  pad(n, dur, t) { const ctx = this.ctx; for (const det of [-6, 6]) { const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = 'triangle'; o.frequency.value = this.hz(n); o.detune.value = det; f.type = 'lowpass'; f.frequency.value = 900; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.035, t + dur * 0.3); g.gain.linearRampToValueAtTime(0, t + dur); o.connect(f); f.connect(g); g.connect(this.musicBus); g.connect(this.verb); o.start(t); o.stop(t + dur + 0.1); } }
  pluck(n, t, v) { const ctx = this.ctx, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o2.type = 'sine'; o.frequency.value = this.hz(n); o2.frequency.value = this.hz(n) * 2.01; const g2 = ctx.createGain(); g2.gain.value = 0.25; o2.connect(g2); g2.connect(g); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6); o.connect(g); g.connect(this.musicBus); g.connect(this.verb); o.start(t); o2.start(t); o.stop(t + 1.7); o2.stop(t + 1.7); }
  // ---- one-shots ----
  burst(freq, q, dur, vol, type = 'bandpass', rate = 1, at = 0) {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.noise; s.playbackRate.value = rate; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(this.sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  tone(f, dur, vol, type = 'sine', at = 0, slide = 0) { if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + dur + 0.05); }
  step(surface) {
    const r = 0.9 + Math.random() * 0.2;
    if (surface === 'wood') { this.burst(700 * r, 3, 0.07, 0.25); this.tone(140 * r, 0.06, 0.08, 'triangle'); }
    else if (surface === 'water') this.burst(1200 * r, 0.8, 0.18, 0.18, 'bandpass', 0.6);
    else if (surface === 'stone' || surface === 'path') this.burst(2400 * r, 1.4, 0.05, 0.16, 'highpass');
    else if (surface === 'snow') this.burst(900 * r, 0.6, 0.12, 0.2, 'lowpass', 0.5);
    else this.burst(1500 * r, 0.9, 0.08, 0.12, 'bandpass', 0.8);
  }
  chop() { this.burst(500, 2, 0.12, 0.5); this.tone(180, 0.1, 0.18, 'triangle'); }
  clink() { this.tone(2200, 0.15, 0.08, 'triangle'); this.burst(3000, 3, 0.06, 0.25, 'highpass'); }
  pickup() { this.tone(880, 0.12, 0.06); this.tone(1320, 0.18, 0.05, 'sine', 0.06); }
  coin() { this.tone(1568, 0.12, 0.05, 'square', 0, 1); this.tone(2093, 0.25, 0.05, 'square', 0.07); }
  click() { this.tone(900, 0.04, 0.05, 'triangle'); }
  error() { this.tone(220, 0.18, 0.08, 'triangle', 0, 0.8); }
  build() { for (let i = 0; i < 6; i++) { this.burst(600 + Math.random() * 300, 3, 0.08, 0.4, 'bandpass', 1, i * 0.22); this.tone(160 + Math.random() * 40, 0.08, 0.12, 'triangle', i * 0.22); } this.tone(523, 0.4, 0.05, 'sine', 1.4); this.tone(784, 0.6, 0.05, 'sine', 1.55); }
  demolish() { for (let i = 0; i < 4; i++) this.burst(300 + i * 80, 1, 0.3, 0.4, 'lowpass', 0.6, i * 0.12); }
  splash() { this.burst(900, 0.6, 0.4, 0.3, 'bandpass', 0.5); }
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.5, 0.07, 'triangle', i * 0.13)); }
  discover() { [659, 880, 1175, 1568].forEach((f, i) => this.tone(f, 0.7, 0.05, 'sine', i * 0.1)); }
  bite() { this.tone(1200, 0.08, 0.08, 'square'); this.tone(1200, 0.08, 0.08, 'square', 0.12); }
}
