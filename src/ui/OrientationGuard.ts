export class OrientationGuard {
  private readonly overlayEl: HTMLElement | null;
  private readonly tryLandscapeBtn: HTMLElement | null;
  private combatActive = false;
  private isPausedByOrientation = false;
  private onPauseChange?: (paused: boolean) => void;

  constructor(onPauseChange?: (paused: boolean) => void) {
    this.overlayEl = document.getElementById('orientation-guard');
    this.tryLandscapeBtn = document.getElementById('btn-try-landscape');
    this.onPauseChange = onPauseChange;

    this.tryLandscapeBtn?.addEventListener('click', () => {
      void this.requestLandscapeFullscreen();
    });

    const check = () => this.evaluate();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    screen.orientation?.addEventListener?.('change', check);
  }

  public setCombatActive(active: boolean): void {
    this.combatActive = active;
    if (active) {
      void this.tryLockLandscape();
    }
    this.evaluate();
  }

  public isBlocked(): boolean {
    return this.isPausedByOrientation;
  }

  public async requestLandscapeFullscreen(): Promise<void> {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Alguns navegadores móveis restringem fullscreen (ex. iOS Safari)
    }
    await this.tryLockLandscape();
    this.evaluate();
  }

  private async tryLockLandscape(): Promise<void> {
    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (type: 'landscape' | 'landscape-primary') => Promise<void>;
      };
      if (orientation?.lock) {
        await orientation.lock('landscape');
      }
    } catch {
      // Lock só é permitido em PWA instalado ou fullscreen no Android Chrome
    }
  }

  private evaluate(): void {
    const isPortrait = window.innerHeight > window.innerWidth;
    const shouldBlock = this.combatActive && isPortrait;

    if (shouldBlock !== this.isPausedByOrientation) {
      this.isPausedByOrientation = shouldBlock;
      if (shouldBlock) {
        this.overlayEl?.classList.remove('hidden');
      } else {
        this.overlayEl?.classList.add('hidden');
      }
      this.onPauseChange?.(shouldBlock);
    } else if (!this.combatActive) {
      this.overlayEl?.classList.add('hidden');
    }
  }
}
