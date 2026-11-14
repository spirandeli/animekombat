import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export class PwaManager {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
  private updateAvailable = false;
  private inCombat = false;
  private onInstallChange?: () => void;

  private readonly toastEl: HTMLElement | null;
  private readonly reloadBtn: HTMLElement | null;

  constructor() {
    this.toastEl = document.getElementById('pwa-update-toast');
    this.reloadBtn = document.getElementById('btn-pwa-reload');

    this.setupInstallListener();
    this.setupGestureLocks();
    this.setupServiceWorker();
  }

  public setOnInstallChange(cb: () => void): void {
    this.onInstallChange = cb;
  }

  public setInCombat(active: boolean): void {
    this.inCombat = active;
    if (!active && this.updateAvailable) {
      this.showUpdateToast();
    } else if (active && this.toastEl) {
      this.toastEl.classList.add('hidden');
    }
  }

  public canInstallNative(): boolean {
    return this.deferredPrompt !== null && !this.isStandalone();
  }

  public isStandalone(): boolean {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    return (
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: standalone)').matches ||
      nav.standalone === true
    );
  }

  public isIosSafariNeedsHint(): boolean {
    if (this.isStandalone()) return false;
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    return isIos && isSafari;
  }

  public async triggerInstall(): Promise<boolean> {
    if (!this.deferredPrompt) return false;
    await this.deferredPrompt.prompt();
    const result = await this.deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      this.deferredPrompt = null;
      this.onInstallChange?.();
      return true;
    }
    return false;
  }

  private setupInstallListener(): void {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.onInstallChange?.();
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.onInstallChange?.();
    });
  }

  private setupGestureLocks(): void {
    // Bloqueia zoom por gesto no iOS Safari e menu de contexto por toque longo
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', prevent, { passive: false });
    document.addEventListener('gesturechange', prevent, { passive: false });
    document.addEventListener('gestureend', prevent, { passive: false });
    document.addEventListener('contextmenu', prevent);

    // Previne double-tap zoom em elementos não interativos
    let lastTouchEnd = 0;
    document.addEventListener(
      'touchend',
      (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 280) {
          e.preventDefault();
        }
        lastTouchEnd = now;
      },
      { passive: false }
    );
  }

  private setupServiceWorker(): void {
    try {
      this.updateSW = registerSW({
        immediate: true,
        onNeedRefresh: () => {
          this.updateAvailable = true;
          if (!this.inCombat) {
            this.showUpdateToast();
          }
        },
        onOfflineReady: () => {
          // App pronto para uso 100% offline
        },
      });
    } catch {
      // Ambiente dev sem SW habilitado
    }

    this.reloadBtn?.addEventListener('click', () => {
      if (this.updateSW) {
        void this.updateSW(true);
      } else {
        window.location.reload();
      }
    });
  }

  private showUpdateToast(): void {
    this.toastEl?.classList.remove('hidden');
  }
}
