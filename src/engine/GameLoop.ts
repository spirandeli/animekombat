export class GameLoop {
  private readonly fixedDt = 1 / 60;
  private rafId: number | null = null;
  private lastTime = 0;
  private accumulator = 0;
  private running = false;
  private paused = false;
  private pausedByVisibility = false;

  private fpsFrames = 0;
  private fpsTimer = 0;
  private currentFps = 60;

  private readonly onFixedUpdate: (dt: number) => void;
  private readonly onRender: (alpha: number, fps: number) => void;
  private readonly onVisibilityPause?: (paused: boolean) => void;

  constructor(
    onFixedUpdate: (dt: number) => void,
    onRender: (alpha: number, fps: number) => void,
    onVisibilityPause?: (paused: boolean) => void
  ) {
    this.onFixedUpdate = onFixedUpdate;
    this.onRender = onRender;
    this.onVisibilityPause = onVisibilityPause;

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  public stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (!paused) {
      this.lastTime = performance.now();
      this.accumulator = 0;
    }
  }

  public isPaused(): boolean {
    return this.paused || this.pausedByVisibility;
  }

  public getFps(): number {
    return this.currentFps;
  }

  public destroy(): void {
    this.stop();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.pausedByVisibility = true;
      this.onVisibilityPause?.(true);
    } else {
      this.pausedByVisibility = false;
      this.lastTime = performance.now();
      this.accumulator = 0;
      this.onVisibilityPause?.(false);
    }
  };

  private tick = (now: number): void => {
    if (!this.running) return;

    // Limita deltaTime a 100ms para evitar saltos ao alternar apps no celular
    const rawDt = Math.min(0.1, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;

    this.fpsFrames++;
    this.fpsTimer += rawDt;
    if (this.fpsTimer >= 0.5) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsTimer);
      this.fpsFrames = 0;
      this.fpsTimer = 0;
    }

    if (!this.isPaused()) {
      this.accumulator += rawDt;
      let subSteps = 0;
      while (this.accumulator >= this.fixedDt && subSteps < 5) {
        this.onFixedUpdate(this.fixedDt);
        this.accumulator -= this.fixedDt;
        subSteps++;
      }
      if (subSteps >= 5) {
        this.accumulator = 0;
      }
    }

    const alpha = this.accumulator / this.fixedDt;
    this.onRender(alpha, this.currentFps);
    this.rafId = requestAnimationFrame(this.tick);
  };
}
