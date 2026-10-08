import type { Settings } from './economy';

type Sound = 'tap' | 'craft' | 'dispatch' | 'salvage' | 'output' | 'sale' | 'buy' | 'voyage' | 'milestone' | 'surge';
const SOUNDS: Record<Sound, { notes: number[]; volume: number; length: number; cooldown: number }> = {
  tap: { notes: [360], volume: .16, length: .1, cooldown: 180 },
  craft: { notes: [240, 320], volume: .12, length: .13, cooldown: 200 },
  dispatch: { notes: [392, 523], volume: .12, length: .18, cooldown: 250 },
  salvage: { notes: [220], volume: .045, length: .08, cooldown: 2600 },
  output: { notes: [523, 659], volume: .075, length: .1, cooldown: 900 },
  sale: { notes: [659, 880, 1047], volume: .13, length: .16, cooldown: 650 },
  buy: { notes: [440, 659, 880], volume: .15, length: .18, cooldown: 220 },
  voyage: { notes: [330, 440, 659, 880], volume: .16, length: .22, cooldown: 600 },
  milestone: { notes: [523, 659, 784, 1047], volume: .15, length: .22, cooldown: 1000 },
  surge: { notes: [392, 523, 659, 1047], volume: .17, length: .2, cooldown: 1000 },
};

export class HarborAudio {
  private context?: AudioContext;
  private ambient?: GainNode;
  private gain?: GainNode;
  private unlocked = false;
  private lastPlayed = new Map<Sound, number>();
  private lastForeground = -Infinity;
  private lastAutomatic = -Infinity;
  private voices = 0;
  constructor(private settings: () => Settings) {}
  async unlock() {
    if (!this.context) {
      try {
        this.context = new AudioContext();
        this.gain = this.context.createGain();
        this.gain.connect(this.context.destination);
        const noise = this.context.createBuffer(1, this.context.sampleRate * 4, this.context.sampleRate);
        const samples = noise.getChannelData(0);
        let previous = 0;
        for (let i = 0; i < samples.length; i++) { previous = (previous + (Math.random() * 2 - 1) * .025) / 1.025; samples[i] = previous * 2; }
        const source = this.context.createBufferSource();
        source.buffer = noise; source.loop = true;
        const filter = this.context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 480;
        this.ambient = this.context.createGain();
        source.connect(filter); filter.connect(this.ambient); this.ambient.connect(this.gain); source.start();
        this.unlocked = true;
      } catch { return; }
    }
    if (this.context.state === 'suspended') await this.context.resume().catch(() => {});
    this.sync();
  }
  sync(hidden = false) {
    if (!this.context || !this.gain || !this.ambient) return;
    const s = this.settings(); const now = this.context.currentTime;
    this.gain.gain.setTargetAtTime(s.muted || hidden ? 0 : 1, now, .1);
    this.ambient.gain.setTargetAtTime(s.ambience * .18, now, .1);
  }
  play(kind: Sound) {
    if (!this.unlocked || !this.context || !this.gain || this.settings().muted || this.context.state !== 'running') return;
    const sound = SOUNDS[kind], now = performance.now();
    const automatic = kind === 'salvage' || kind === 'output' || kind === 'sale';
    if (now - (this.lastPlayed.get(kind) ?? -Infinity) < sound.cooldown || this.voices + sound.notes.length > 12) return;
    if (automatic && (now - this.lastForeground < 450 || now - this.lastAutomatic < 180)) return;
    this.lastPlayed.set(kind, now);
    if (automatic) this.lastAutomatic = now; else this.lastForeground = now;
    sound.notes.forEach((hz, i) => {
      const ctx = this.context!, osc = ctx.createOscillator(), gain = ctx.createGain();
      const at = ctx.currentTime + i * .065;
      osc.type = kind === 'tap' || kind === 'salvage' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(hz, at);
      if (kind === 'tap' || kind === 'craft') osc.frequency.exponentialRampToValueAtTime(hz * .7, at + sound.length);
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(this.settings().effects * sound.volume, at + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, at + sound.length);
      osc.connect(gain); gain.connect(this.gain!); this.voices++;
      osc.onended = () => { this.voices--; osc.disconnect(); gain.disconnect(); };
      osc.start(at); osc.stop(at + sound.length + .025);
    });
  }
  destroy() { void this.context?.close(); }
}
