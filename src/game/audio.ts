export class GameAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  muted = false;
  enabled = false;

  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(this.ctx.destination);
    this.enabled = true;
  }

  resume() {
    this.ensure();
    void this.ctx?.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.22;
    return this.muted;
  }

  tone(freq: number, dur: number, type: OscillatorType, vol = 0.2, delay = 0) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur: number, vol = 0.12, delay = 0) {
    if (!this.ctx || !this.master || this.muted) return;
    const n = this.ctx.createBuffer(1, (this.ctx.sampleRate * dur) | 0, this.ctx.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = n;
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;
    const t = this.ctx.currentTime + delay;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  click() {
    this.tone(520, 0.06, "square", 0.08);
  }
  select() {
    this.tone(340, 0.07, "triangle", 0.1);
  }
  error() {
    this.tone(140, 0.14, "sawtooth", 0.1);
  }
  train() {
    this.tone(220, 0.12, "square", 0.1);
    this.tone(330, 0.16, "square", 0.08, 0.08);
  }
  gather() {
    this.tone(880, 0.05, "sine", 0.05);
  }
  build() {
    this.noise(0.06, 0.08);
    this.tone(180, 0.08, "triangle", 0.06);
  }
  complete() {
    this.tone(392, 0.1, "square", 0.1);
    this.tone(523, 0.14, "square", 0.1, 0.1);
  }
  attack() {
    this.noise(0.08, 0.14);
  }
  bow() {
    this.tone(640, 0.05, "sine", 0.05);
  }
  death() {
    this.tone(90, 0.2, "sawtooth", 0.08);
  }
  victory() {
    [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.28, "triangle", 0.12, i * 0.16));
  }
  defeat() {
    [330, 262, 196, 147].forEach((f, i) => this.tone(f, 0.35, "sawtooth", 0.1, i * 0.18));
  }
  horn() {
    this.tone(180, 0.35, "sawtooth", 0.08);
    this.tone(270, 0.4, "triangle", 0.07, 0.05);
  }
}

export const audio = new GameAudio();
