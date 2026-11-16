export function isFullscreen(): boolean {
  return Boolean(document.fullscreenElement);
}

export async function tryLockLandscape(): Promise<void> {
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

export async function enterFullscreen(): Promise<boolean> {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    // Alguns navegadores restringem fullscreen fora de gesto do usuário ou no iOS Safari
  }
  await tryLockLandscape();
  return Boolean(document.fullscreenElement);
}

export async function toggleFullscreen(): Promise<boolean> {
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch {
      // Ignora erro caso já tenha saído
    }
    return Boolean(document.fullscreenElement);
  }
  return enterFullscreen();
}

