export type SfxType =
  | 'ui'
  | 'jump'
  | 'atk1'
  | 'atk2'
  | 'atk3'
  | 'atk4'
  | 'hit'
  | 'heavyHit'
  | 'block'
  | 'clash'
  | 'land'
  | 'evolve'
  | 'ko';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private bgmVolume = 0.45;
  private sfxVolume = 0.75;
  private bgmMuted = false;
  private sfxMuted = false;

  private bgmTimer: number | null = null;
  private bgmPlaying = false;
  private bgmStep = 0;

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) {
        void this.ctx.suspend().catch(() => {});
      } else {
        void this.ctx.resume().catch(() => {});
      }
    });
  }

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.bgmGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.bgmGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
      this.applyVolumes();
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
  }

  public setVolumes(
    bgmVol: number,
    sfxVol: number,
    bgmMuted: boolean,
    sfxMuted: boolean
  ): void {
    this.bgmVolume = Math.max(0, Math.min(1, bgmVol));
    this.sfxVolume = Math.max(0, Math.min(1, sfxVol));
    this.bgmMuted = bgmMuted;
    this.sfxMuted = sfxMuted;
    this.applyVolumes();
  }

  public startBgm(): void {
    if (this.bgmPlaying) return;
    this.bgmPlaying = true;
    this.bgmStep = 0;
    this.bgmTimer = window.setInterval(() => {
      if (!this.bgmPlaying || !this.ctx || !this.bgmGain || document.hidden) return;
      if (this.ctx.state !== 'running' || this.bgmMuted || this.bgmVolume <= 0.01) {
        return;
      }
      this.playBgmBeat(this.bgmStep++);
    }, 185);
  }

  public stopBgm(): void {
    this.bgmPlaying = false;
    if (this.bgmTimer !== null) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  public playSfx(type: SfxType): void {
    if (!this.ctx || !this.sfxGain || this.sfxMuted || this.sfxVolume <= 0.01) {
      return;
    }
    if (this.ctx.state !== 'running') return;

    const now = this.ctx.currentTime;
    switch (type) {
      case 'ui':
        this.tone(580, 760, 0.07, 'triangle', 0.25, now);
        break;
      case 'jump':
        this.tone(210, 480, 0.14, 'sine', 0.28, now);
        break;
      case 'atk1':
        this.noiseBurst(0.08, 900, 0.28, now);
        this.tone(240, 110, 0.09, 'triangle', 0.22, now);
        break;
      case 'atk2':
        this.noiseBurst(0.14, 700, 0.36, now);
        this.tone(320, 95, 0.16, 'sawtooth', 0.26, now);
        break;
      case 'atk3':
        this.tone(380, 780, 0.22, 'sawtooth', 0.28, now);
        this.tone(180, 260, 0.25, 'sine', 0.25, now);
        break;
      case 'atk4':
        this.tone(160, 620, 0.35, 'sawtooth', 0.35, now);
        this.tone(90, 45, 0.45, 'square', 0.3, now + 0.08);
        this.noiseBurst(0.32, 1200, 0.35, now + 0.08);
        break;
      case 'hit':
        this.noiseBurst(0.09, 1400, 0.4, now);
        this.tone(170, 55, 0.11, 'square', 0.35, now);
        break;
      case 'heavyHit':
        this.noiseBurst(0.18, 1000, 0.52, now);
        this.tone(140, 38, 0.24, 'sawtooth', 0.48, now);
        break;
      case 'block':
        this.tone(920, 620, 0.1, 'square', 0.25, now);
        break;
      case 'clash':
        this.tone(1180, 420, 0.16, 'triangle', 0.34, now);
        this.tone(1760, 880, 0.12, 'sine', 0.22, now);
        this.noiseBurst(0.1, 2200, 0.28, now);
        break;
      case 'land':
        this.tone(115, 52, 0.08, 'sine', 0.18, now);
        this.noiseBurst(0.05, 420, 0.14, now);
        break;
      case 'evolve':
        this.tone(220, 880, 0.45, 'sawtooth', 0.32, now);
        this.tone(330, 1320, 0.45, 'triangle', 0.26, now + 0.06);
        break;
      case 'ko':
        this.tone(320, 65, 0.55, 'sawtooth', 0.48, now);
        this.noiseBurst(0.35, 800, 0.45, now);
        break;
    }
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.bgmGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.bgmGain.gain.setTargetAtTime(
      this.bgmMuted ? 0 : this.bgmVolume * 0.24,
      now,
      0.02
    );
    this.sfxGain.gain.setTargetAtTime(
      this.sfxMuted ? 0 : this.sfxVolume,
      now,
      0.02
    );
  }

  private playBgmBeat(step: number): void {
    if (!this.ctx || !this.bgmGain) return;
    const now = this.ctx.currentTime;
    // Progressão menor energética estilo anime shonen
    const bassNotes = [110, 110, 130.81, 146.83, 110, 110, 164.81, 146.83];
    const leadNotes = [440, 0, 523.25, 587.33, 659.25, 587.33, 523.25, 392];

    const bNote = bassNotes[step % bassNotes.length];
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(bNote, now);
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g);
    g.connect(this.bgmGain);
    osc.start(now);
    osc.stop(now + 0.17);

    const lNote = leadNotes[step % leadNotes.length];
    if (lNote > 0 && step % 2 === 0) {
      const lOsc = this.ctx.createOscillator();
      const lG = this.ctx.createGain();
      lOsc.type = 'triangle';
      lOsc.frequency.setValueAtTime(lNote, now);
      lG.gain.setValueAtTime(0.11, now);
      lG.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      lOsc.connect(lG);
      lG.connect(this.bgmGain);
      lOsc.start(now);
      lOsc.stop(now + 0.16);
    }
  }

  private tone(
    freqStart: number,
    freqEnd: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    startTime: number
  ): void {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, startTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), startTime + dur);
    g.gain.setValueAtTime(vol, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.01);
  }

  private noiseBurst(
    dur: number,
    cutoffHz: number,
    vol: number,
    startTime: number
  ): void {
    if (!this.ctx || !this.sfxGain) return;
    const sampleCount = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, sampleCount, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffHz, startTime);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(startTime);
    src.stop(startTime + dur + 0.01);
  }
}
