export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  unlock(): void {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : 0.18;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch { /* Audio is optional when a browser blocks it. */ }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.context) this.master.gain.setTargetAtTime(muted ? 0 : 0.18, this.context.currentTime, 0.015);
  }

  private tone(frequency: number, duration: number, delay = 0, type: OscillatorType = 'sine', volume = 0.5): void {
    if (!this.context || !this.master || this.muted || this.context.state !== 'running') return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(volume, now + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }

  rotate(): void { this.tone(330, 0.045, 0, 'triangle', 0.22); this.tone(185, 0.055, 0.018, 'triangle', 0.1); }
  light(): void { this.tone(783.99, 0.18); this.tone(1046.5, 0.23, 0.08, 'sine', 0.32); }
  select(): void { this.tone(523.25, 0.08, 0, 'sine', 0.2); }
  complete(): void { [523.25,659.25,783.99,1046.5].forEach((note, index) => this.tone(note, 0.4, index * 0.11, 'triangle', 0.4)); }
  hint(): void { this.tone(659.25, 0.18); this.tone(880, 0.25, 0.1, 'sine', 0.3); }
}
