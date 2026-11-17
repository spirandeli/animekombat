export type AttackDirectionSuffix = 'up' | 'down' | 'diag_up' | 'diag_down';

export type CanonicalAction =
  | 'idle'
  | 'ataque_1'
  | 'ataque_2'
  | 'ataque_3'
  | 'ataque_4'
  | 'ataque_1_up'
  | 'ataque_1_down'
  | 'ataque_1_diag_up'
  | 'ataque_1_diag_down'
  | 'ataque_2_up'
  | 'ataque_2_down'
  | 'ataque_2_diag_up'
  | 'ataque_2_diag_down'
  | 'ataque_3_up'
  | 'ataque_3_down'
  | 'ataque_3_diag_up'
  | 'ataque_3_diag_down'
  | 'ataque_4_up'
  | 'ataque_4_down'
  | 'ataque_4_diag_up'
  | 'ataque_4_diag_down'
  | 'run'
  | 'walk'
  | 'skid'
  | 'dash'
  | 'jump'
  | 'land'
  | 'crouch'
  | 'block'
  | 'hitstun'
  | 'knockdown'
  | 'getup'
  | 'evolve'
  | 'ki_charge'
  | 'air_ataque_1'
  | 'grab'
  | 'throw'
  | 'pickup'
  | 'victory'
  | 'ko_defeat';

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
  clippedEdges?: string[];
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

export interface MenuCharacterSprites {
  phases: Record<string, { full?: string; portrait?: string }>;
}

export interface MenuSpritesManifest {
  version: number;
  characters: Record<string, MenuCharacterSprites>;
}

export interface BeatEmUpEntityManifest {
  id: string;
  name: string;
  kind: 'npc' | 'boss';
  role?: string;
  title?: string;
  stageId?: string;
  maxHp: number;
  speed: number;
  damageScale: number;
  auraColor: string;
  scoreValue: number;
  refBodyWidth: number;
  refBodyHeight: number;
  moves?: Record<string, string>;
  actions: Record<string, FrameMeta[]>;
  vfx: Record<string, FrameMeta[]>;
}

export interface BeatEmUpManifest {
  version: number;
  generatedAt: string;
  npcs: Record<string, BeatEmUpEntityManifest>;
  bosses: Record<string, BeatEmUpEntityManifest>;
}

export interface LoadedBeatEmUpPack {
  id: string;
  manifest: BeatEmUpEntityManifest;
  actions: Map<CanonicalAction, LoadedFrame[]>;
  vfx: Map<CanonicalVfx, LoadedFrame[]>;
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
  private menuManifest: MenuSpritesManifest | null = null;
  private beatEmUpManifest: BeatEmUpManifest | null = null;
  private phaseCache = new Map<string, LoadedPhasePack>();
  private loadingPromises = new Map<string, Promise<LoadedPhasePack>>();
  private beatEmUpCache = new Map<string, LoadedBeatEmUpPack>();
  private beatEmUpPromises = new Map<string, Promise<LoadedBeatEmUpPack>>();
  private fallbackCache = new Map<string, LoadedFrame[]>();

  public async loadBeatEmUpManifest(): Promise<BeatEmUpManifest> {
    if (this.beatEmUpManifest) return this.beatEmUpManifest;
    const res = await fetch('/assets/beatemup/manifest.json');
    if (!res.ok) {
      throw new Error(`Falha ao carregar beatemup/manifest.json (${res.status})`);
    }
    this.beatEmUpManifest = (await res.json()) as BeatEmUpManifest;
    return this.beatEmUpManifest;
  }

  public getBeatEmUpManifest(): BeatEmUpManifest | null {
    return this.beatEmUpManifest;
  }

  public getCachedBeatEmUpPack(entityId: string): LoadedBeatEmUpPack | undefined {
    return this.beatEmUpCache.get(entityId);
  }

  public async loadBeatEmUpPack(
    entityId: string,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<LoadedBeatEmUpPack> {
    const cached = this.beatEmUpCache.get(entityId);
    if (cached) {
      onProgress?.(1, 1);
      return cached;
    }
    const inFlight = this.beatEmUpPromises.get(entityId);
    if (inFlight) return inFlight;

    const promise = (async () => {
      const manifest = await this.loadBeatEmUpManifest();
      const entManifest = manifest.npcs[entityId] ?? manifest.bosses[entityId];
      if (!entManifest) {
        throw new Error(`Entidade Beat 'em Up não encontrada: ${entityId}`);
      }

      const entries: Array<{
        kind: 'action' | 'vfx';
        key: string;
        frames: FrameMeta[];
      }> = [];
      for (const [act, frames] of Object.entries(entManifest.actions)) {
        entries.push({ kind: 'action', key: act, frames });
      }
      for (const [vfxKey, frames] of Object.entries(entManifest.vfx)) {
        entries.push({ kind: 'vfx', key: vfxKey, frames });
      }

      const total = Math.max(
        1,
        entries.reduce((acc, item) => acc + item.frames.length, 0)
      );
      let loaded = 0;
      const actionsMap = new Map<CanonicalAction, LoadedFrame[]>();
      const vfxMap = new Map<CanonicalVfx, LoadedFrame[]>();

      const loadSingle = async (meta: FrameMeta): Promise<LoadedFrame> => {
        const img = await this.fetchImageBitmap(meta.src);
        loaded++;
        onProgress?.(loaded, total);
        return { image: img, meta };
      };

      await Promise.all(
        entries.map(async (entry) => {
          const loadedFrames = await Promise.all(entry.frames.map(loadSingle));
          if (entry.kind === 'action') {
            actionsMap.set(entry.key as CanonicalAction, loadedFrames);
          } else {
            vfxMap.set(entry.key as CanonicalVfx, loadedFrames);
          }
        })
      );

      const pack: LoadedBeatEmUpPack = {
        id: entityId,
        manifest: entManifest,
        actions: actionsMap,
        vfx: vfxMap,
      };
      this.beatEmUpCache.set(entityId, pack);
      this.beatEmUpPromises.delete(entityId);
      return pack;
    })();

    this.beatEmUpPromises.set(entityId, promise);
    return promise;
  }

  public async preloadBeatEmUpStage(
    heroesOrCharId: string | Array<{ charId: string; startPhase: number }>,
    heroStartPhaseOrEntities: number | string[],
    entityIdsOrProgress?: string[] | ((percent: number) => void),
    maybeOnProgress?: (percent: number) => void
  ): Promise<void> {
    const heroRequests: Array<{ charId: string; startPhase: number }> =
      typeof heroesOrCharId === 'string'
        ? [{ charId: heroesOrCharId, startPhase: Number(heroStartPhaseOrEntities) || 1 }]
        : heroesOrCharId;

    const entityIds: string[] = Array.isArray(heroStartPhaseOrEntities)
      ? heroStartPhaseOrEntities
      : Array.isArray(entityIdsOrProgress)
        ? entityIdsOrProgress
        : [];

    const onProgress: ((percent: number) => void) | undefined =
      typeof entityIdsOrProgress === 'function' ? entityIdsOrProgress : maybeOnProgress;

    const uniqueHeroMap = new Map<string, { charId: string; startPhase: number }>();
    for (const h of heroRequests) {
      const key = `${h.charId}:${this.getPhaseKey(h.startPhase)}`;
      if (!uniqueHeroMap.has(key)) {
        uniqueHeroMap.set(key, { charId: h.charId, startPhase: h.startPhase });
      }
    }
    const uniqueHeroes = [...uniqueHeroMap.values()];
    this.unloadUnused(new Set(uniqueHeroMap.keys()));

    const totalTasks = uniqueHeroes.length + entityIds.length;
    const prog = new Array<number>(totalTasks).fill(0);
    const tot = new Array<number>(totalTasks).fill(1);
    const emit = () => {
      let l = 0;
      let t = 0;
      for (let i = 0; i < totalTasks; i++) {
        l += prog[i];
        t += tot[i];
      }
      onProgress?.(t > 0 ? Math.min(100, Math.round((l / t) * 100)) : 100);
    };

    await Promise.all([
      ...uniqueHeroes.map((h, idx) =>
        this.loadPhasePack(h.charId, h.startPhase, (l, total) => {
          prog[idx] = l;
          tot[idx] = Math.max(1, total);
          emit();
        })
      ),
      ...entityIds.map((eid, idx) =>
        this.loadBeatEmUpPack(eid, (l, total) => {
          prog[uniqueHeroes.length + idx] = l;
          tot[uniqueHeroes.length + idx] = Math.max(1, total);
          emit();
        })
      ),
    ]);
    onProgress?.(100);
  }

  public async loadManifest(): Promise<CharactersManifest> {
    if (this.manifest) return this.manifest;
    const res = await fetch('/assets/characters/manifest.json');
    if (!res.ok) {
      throw new Error(`Falha ao carregar manifest.json (${res.status})`);
    }
    this.manifest = (await res.json()) as CharactersManifest;
    return this.manifest;
  }

  public async loadMenuManifest(): Promise<MenuSpritesManifest | null> {
    if (this.menuManifest) return this.menuManifest;
    try {
      const res = await fetch('/assets/hud/characters/menu-manifest.json');
      if (!res.ok) return null;
      this.menuManifest = (await res.json()) as MenuSpritesManifest;
      return this.menuManifest;
    } catch {
      return null;
    }
  }

  public getMenuFullBodyUrl(charId: string, phaseNum: number): string | null {
    const key = this.getPhaseKey(phaseNum);
    return this.menuManifest?.characters[charId]?.phases[key]?.full ?? null;
  }

  public getMenuPortraitUrl(charId: string, phaseNum: number): string | null {
    const key = this.getPhaseKey(phaseNum);
    return this.menuManifest?.characters[charId]?.phases[key]?.portrait ?? null;
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
   * Fallback de runtime: carrega uma folha 2x2 ou 3x2 com fundo #FF00FF via OffscreenCanvas,
   * aplica chroma-key anti-spill aprimorado e fatia em ordem de leitura.
   */
  public async loadRaw2x2SheetFallback(
    url: string,
    isVfx = false,
    cols = 2,
    rows = 2
  ): Promise<LoadedFrame[]> {
    const cacheKey = `${url}:${isVfx ? 'vfx' : 'char'}:${cols}x${rows}`;
    const existing = this.fallbackCache.get(cacheKey);
    if (existing) return existing;

    const img = await this.fetchImageBitmap(url);
    const w = img.width;
    const h = img.height;

    const fullCanvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(w, h)
        : document.createElement('canvas');
    fullCanvas.width = w;
    fullCanvas.height = h;
    const fullCtx = fullCanvas.getContext('2d', { willReadFrequently: true }) as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null;
    if (!fullCtx) throw new Error('Contexto 2D indisponível para fatiamento.');
    fullCtx.drawImage(img, 0, 0);
    const fullData = fullCtx.getImageData(0, 0, w, h).data;

    const isFgPixel = (px: number, py: number): boolean => {
      const idx = (py * w + px) * 4;
      const minRb = Math.min(fullData[idx], fullData[idx + 2]);
      return Math.max(0, minRb - fullData[idx + 1]) < 48;
    };

    const xSplits = [0];
    for (let c = 1; c < cols; c++) {
      const nom = Math.floor((w * c) / cols);
      let bestX = nom;
      let bestCount = Infinity;
      for (let x = Math.max(1, nom - 20); x <= Math.min(w - 1, nom + 20); x++) {
        let cnt = 0;
        for (let y = 0; y < h; y += 4) if (isFgPixel(x, y)) cnt++;
        if (cnt < bestCount || (cnt === bestCount && Math.abs(x - nom) < Math.abs(bestX - nom))) {
          bestCount = cnt;
          bestX = x;
        }
      }
      xSplits.push(bestX);
    }
    xSplits.push(w);

    const ySplits = [0];
    for (let r = 1; r < rows; r++) {
      const nom = Math.floor((h * r) / rows);
      let bestY = nom;
      let bestCount = Infinity;
      for (let y = Math.max(1, nom - 20); y <= Math.min(h - 1, nom + 20); y++) {
        let cnt = 0;
        for (let x = 0; x < w; x += 4) if (isFgPixel(x, y)) cnt++;
        if (cnt < bestCount || (cnt === bestCount && Math.abs(y - nom) < Math.abs(bestY - nom))) {
          bestCount = cnt;
          bestY = y;
        }
      }
      ySplits.push(bestY);
    }
    ySplits.push(h);

    const rects: Array<[number, number, number, number]> = [];
    for (let ry = 0; ry < rows; ry++) {
      for (let cx = 0; cx < cols; cx++) {
        rects.push([
          xSplits[cx],
          ySplits[ry],
          xSplits[cx + 1] - xSplits[cx],
          ySplits[ry + 1] - ySplits[ry],
        ]);
      }
    }

    const lowT = isVfx ? 36 : 32;
    const highT = isVfx ? 112 : 100;
    const span = highT - lowT;
    const spillStart = isVfx ? 16 : 14;

    const frames: LoadedFrame[] = [];
    for (const [sx, sy, qw, qh] of rects) {
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
