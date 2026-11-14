export type CanonicalAction =
  | 'idle'
  | 'ataque_1'
  | 'ataque_2'
  | 'ataque_3'
  | 'ataque_4'
  | 'run'
  | 'jump'
  | 'crouch'
  | 'block'
  | 'hitstun';

export type CanonicalVfx =
  | 'vfx_ataque_1'
  | 'vfx_ataque_2'
  | 'vfx_ataque_3'
  | 'vfx_ataque_4';

export interface FrameMeta {
  src: string;
  w: number;
  h: number;
  quadW: number;
  quadH: number;
  bboxInQuad: [number, number, number, number];
  cropOrigin: [number, number];
  rawW: number;
  rawH: number;
  anchorX: number;
  anchorY: number;
}

export interface PhaseManifest {
  phase: number;
  key: string;
  label: string;
  auraColor: string;
  refBodyHeight: number;
  refBodyWidth: number;
  moves: Record<string, string>;
  actions: Record<CanonicalAction, FrameMeta[]>;
  vfx: Record<CanonicalVfx, FrameMeta[]>;
}

export interface CharacterManifest {
  id: string;
  name: string;
  phases: Record<string, PhaseManifest>;
}

export interface CharactersManifest {
  version: number;
  generatedAt: string;
  characters: Record<string, CharacterManifest>;
}

export interface LoadedFrame {
  image: ImageBitmap | HTMLCanvasElement | HTMLImageElement;
  meta: FrameMeta;
}

export interface LoadedPhasePack {
  key: string;
  charId: string;
  phase: number;
  manifest: PhaseManifest;
  actions: Map<CanonicalAction, LoadedFrame[]>;
  vfx: Map<CanonicalVfx, LoadedFrame[]>;
}

export class SpriteLoader {
  private manifest: CharactersManifest | null = null;
  private phaseCache = new Map<string, LoadedPhasePack>();
  private loadingPromises = new Map<string, Promise<LoadedPhasePack>>();
  private fallbackCache = new Map<string, LoadedFrame[]>();

  public async loadManifest(): Promise<CharactersManifest> {
    if (this.manifest) return this.manifest;
    const res = await fetch('/assets/characters/manifest.json');
    if (!res.ok) {
      throw new Error(`Falha ao carregar manifest.json (${res.status})`);
    }
    this.manifest = (await res.json()) as CharactersManifest;
    return this.manifest;
  }

  public getManifest(): CharactersManifest | null {
    return this.manifest;
  }

  public getCharacter(charId: string): CharacterManifest | undefined {
    return this.manifest?.characters[charId];
  }

  public getPhaseKey(phaseNum: number): string {
    return `fase_${Math.max(1, Math.min(4, phaseNum))}`;
  }

  public getCachedPhase(charId: string, phaseNum: number): LoadedPhasePack | undefined {
    return this.phaseCache.get(`${charId}:${this.getPhaseKey(phaseNum)}`);
  }

  public async loadPhasePack(
    charId: string,
    phaseNum: number,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<LoadedPhasePack> {
    const phaseKey = this.getPhaseKey(phaseNum);
    const cacheKey = `${charId}:${phaseKey}`;

    const cached = this.phaseCache.get(cacheKey);
    if (cached) {
      onProgress?.(1, 1);
      return cached;
    }

    const inFlight = this.loadingPromises.get(cacheKey);
    if (inFlight) return inFlight;

    const promise = (async () => {
      const manifest = await this.loadManifest();
      const charData = manifest.characters[charId];
      if (!charData) throw new Error(`Personagem não encontrado: ${charId}`);
      const phaseManifest = charData.phases[phaseKey];
      if (!phaseManifest) throw new Error(`Fase ${phaseKey} não encontrada para ${charId}`);

      const entries: Array<{
        kind: 'action' | 'vfx';
        key: string;
        frames: FrameMeta[];
      }> = [];

      for (const [act, frames] of Object.entries(phaseManifest.actions)) {
        entries.push({ kind: 'action', key: act, frames });
      }
      for (const [vfxKey, frames] of Object.entries(phaseManifest.vfx)) {
        entries.push({ kind: 'vfx', key: vfxKey, frames });
      }

      const total = entries.reduce((acc, item) => acc + item.frames.length, 0);
      let loaded = 0;

      const actionsMap = new Map<CanonicalAction, LoadedFrame[]>();
      const vfxMap = new Map<CanonicalVfx, LoadedFrame[]>();

      const loadSingleFrame = async (meta: FrameMeta): Promise<LoadedFrame> => {
        const img = await this.fetchImageBitmap(meta.src);
        loaded++;
        onProgress?.(loaded, total);
        return { image: img, meta };
      };

      await Promise.all(
        entries.map(async (entry) => {
          const loadedFrames = await Promise.all(entry.frames.map(loadSingleFrame));
          if (entry.kind === 'action') {
            actionsMap.set(entry.key as CanonicalAction, loadedFrames);
          } else {
            vfxMap.set(entry.key as CanonicalVfx, loadedFrames);
          }
        })
      );

      const pack: LoadedPhasePack = {
        key: cacheKey,
        charId,
        phase: phaseNum,
        manifest: phaseManifest,
        actions: actionsMap,
        vfx: vfxMap,
      };

      this.phaseCache.set(cacheKey, pack);
      this.loadingPromises.delete(cacheKey);
      return pack;
    })();

    this.loadingPromises.set(cacheKey, promise);
    return promise;
  }

  public async preloadMatchAssets(
    pairs: Array<{ charId: string; phases: number[] }>,
    onProgress?: (percent: number) => void
  ): Promise<void> {
    const uniqueTasks: Array<{ charId: string; phase: number }> = [];
    const seen = new Set<string>();
    const activeKeys = new Set<string>();

    for (const pair of pairs) {
      for (const p of pair.phases) {
        const key = `${pair.charId}:${this.getPhaseKey(p)}`;
        activeKeys.add(key);
        if (!seen.has(key)) {
          seen.add(key);
          uniqueTasks.push({ charId: pair.charId, phase: p });
        }
      }
    }

    // Libera texturas antigas que não pertencem à partida atual para economizar RAM mobile
    this.unloadUnused(activeKeys);

    const progressMap = new Array<number>(uniqueTasks.length).fill(0);
    const totalMap = new Array<number>(uniqueTasks.length).fill(1);

    const emitTotal = () => {
      let sumL = 0;
      let sumT = 0;
      for (let i = 0; i < uniqueTasks.length; i++) {
        sumL += progressMap[i];
        sumT += totalMap[i];
      }
      const pct = sumT > 0 ? Math.min(100, Math.round((sumL / sumT) * 100)) : 100;
      onProgress?.(pct);
    };

    await Promise.all(
      uniqueTasks.map((t, idx) =>
        this.loadPhasePack(t.charId, t.phase, (l, tot) => {
          progressMap[idx] = l;
          totalMap[idx] = Math.max(1, tot);
          emitTotal();
        })
      )
    );
    onProgress?.(100);
  }

  public unloadUnused(keepKeys: Set<string>): void {
    for (const [key, pack] of this.phaseCache.entries()) {
      if (keepKeys.has(key)) continue;
      for (const frames of pack.actions.values()) {
        for (const f of frames) {
          if ('close' in f.image && typeof f.image.close === 'function') {
            f.image.close();
          }
        }
      }
      for (const frames of pack.vfx.values()) {
        for (const f of frames) {
          if ('close' in f.image && typeof f.image.close === 'function') {
            f.image.close();
          }
        }
      }
      this.phaseCache.delete(key);
    }
  }

  /**
   * Fallback de runtime: carrega uma folha 2x2 com fundo #FF00FF via OffscreenCanvas,
   * aplica chroma-key anti-spill e fatia nos 4 quadrantes (1=TL, 2=TR, 3=BL, 4=BR).
   */
  public async loadRaw2x2SheetFallback(
    url: string,
    isVfx = false
  ): Promise<LoadedFrame[]> {
    const cacheKey = `${url}:${isVfx ? 'vfx' : 'char'}`;
    const existing = this.fallbackCache.get(cacheKey);
    if (existing) return existing;

    const img = await this.fetchImageBitmap(url);
    const w = img.width;
    const h = img.height;
    const qw = Math.floor(w / 2);
    const qh = Math.floor(h / 2);

    const rects: Array<[number, number]> = [
      [0, 0],
      [qw, 0],
      [0, qh],
      [qw, qh],
    ];

    const lowT = isVfx ? 52 : 40;
    const highT = isVfx ? 128 : 112;
    const span = highT - lowT;
    const spillStart = isVfx ? 42 : 32;

    const frames: LoadedFrame[] = [];
    for (const [sx, sy] of rects) {
      const canvas =
        typeof OffscreenCanvas !== 'undefined'
          ? new OffscreenCanvas(qw, qh)
          : document.createElement('canvas');
      canvas.width = qw;
      canvas.height = qh;

      const ctx = canvas.getContext('2d', { willReadFrequently: true }) as
        | OffscreenCanvasRenderingContext2D
        | CanvasRenderingContext2D
        | null;
      if (!ctx) throw new Error('Contexto 2D indisponível para chroma-key.');

      ctx.drawImage(img, sx, sy, qw, qh, 0, 0, qw, qh);
      const imageData = ctx.getImageData(0, 0, qw, qh);
      const data = imageData.data;

      let minX = qw;
      let minY = qh;
      let maxX = 0;
      let maxY = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const minRb = r < b ? r : b;
        const excessMag = Math.max(0, minRb - g);

        let alpha = 255;
        if (excessMag >= highT) {
          alpha = 0;
        } else if (excessMag > lowT) {
          alpha = Math.round((255 * (highT - excessMag)) / span);
        }

        if (excessMag > spillStart) {
          const spill = excessMag - spillStart;
          data[i] = Math.max(0, r - spill);
          data[i + 2] = Math.max(0, b - spill);
        }
        data[i + 3] = alpha;

        if (alpha > 18) {
          const pIdx = i >> 2;
          const px = pIdx % qw;
          const py = (pIdx / qw) | 0;
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        }
      }

      ctx.putImageData(imageData, 0, 0);

      let frameImage: ImageBitmap | HTMLCanvasElement;
      if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
        frameImage = canvas.transferToImageBitmap();
      } else {
        frameImage = canvas as HTMLCanvasElement;
      }

      if (maxX < minX) {
        minX = 0;
        minY = 0;
        maxX = qw;
        maxY = qh;
      }

      frames.push({
        image: frameImage,
        meta: {
          src: url,
          w: qw,
          h: qh,
          quadW: qw,
          quadH: qh,
          bboxInQuad: [minX, minY, maxX, maxY],
          cropOrigin: [0, 0],
          rawW: maxX - minX,
          rawH: maxY - minY,
          anchorX: (minX + maxX) * 0.5,
          anchorY: maxY,
        },
      });
    }

    this.fallbackCache.set(cacheKey, frames);
    return frames;
  }

  private async fetchImageBitmap(url: string): Promise<ImageBitmap | HTMLImageElement> {
    if (typeof createImageBitmap === 'function') {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Erro ao baixar sprite ${url} (${response.status})`);
      }
      const blob = await response.blob();
      return createImageBitmap(blob);
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Erro ao carregar imagem ${url}`));
      img.src = url;
    });
  }
}
