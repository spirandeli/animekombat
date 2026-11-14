export type ArenaThemeId =
  | 'brasilia'
  | 'pelourinho'
  | 'rio-de-janeiro'
  | 'shrine'
  | 'volcano'
  | 'cyber_ruins'
  | 'void_horizon'
  | 'sunset_harbor';

export interface ArenaThemeInfo {
  id: ArenaThemeId;
  name: string;
  subtitle: string;
  imageSrc?: string;
  accentColor: string;
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  floorTop: string;
  floorMid: string;
  floorBottom: string;
  platformStyle: 'stone' | 'energy' | 'metal' | 'wood';
}

export const ARENA_THEMES: ArenaThemeInfo[] = [
  {
    id: 'brasilia',
    name: 'Brasília',
    subtitle: 'Catedral Metropolitana e Esplanada',
    imageSrc: '/assets/backgrounds/brasilia.png',
    accentColor: '#38bdf8',
    skyTop: '#0b47a1',
    skyMid: '#1e88e5',
    skyBottom: '#7dd3fc',
    floorTop: '#9c8369',
    floorMid: '#6b5847',
    floorBottom: '#2d2520',
    platformStyle: 'stone',
  },
  {
    id: 'pelourinho',
    name: 'Pelourinho (BA)',
    subtitle: 'Centro Histórico de Salvador',
    imageSrc: '/assets/backgrounds/pelourinho.png',
    accentColor: '#fbbf24',
    skyTop: '#0b4ca6',
    skyMid: '#2575d8',
    skyBottom: '#93c5fd',
    floorTop: '#7a756f',
    floorMid: '#4c4845',
    floorBottom: '#242220',
    platformStyle: 'wood',
  },
  {
    id: 'rio-de-janeiro',
    name: 'Rio de Janeiro',
    subtitle: 'Pão de Açúcar e Cristo Redentor',
    imageSrc: '/assets/backgrounds/rio-de-janeiro.png',
    accentColor: '#22d3ee',
    skyTop: '#08459e',
    skyMid: '#1d7ae0',
    skyBottom: '#74c7f7',
    floorTop: '#967c65',
    floorMid: '#645243',
    floorBottom: '#29211b',
    platformStyle: 'stone',
  },
];

const LEGACY_THEMES: ArenaThemeInfo[] = [
  {
    id: 'shrine',
    name: 'Santuário Celeste',
    subtitle: 'Templos flutuantes sob a lua dourada',
    accentColor: '#38bdf8',
    skyTop: '#090e24',
    skyMid: '#261845',
    skyBottom: '#3b1c4a',
    floorTop: '#1f2947',
    floorMid: '#13192e',
    floorBottom: '#070912',
    platformStyle: 'stone',
  },
  {
    id: 'volcano',
    name: 'Cratera Rubra',
    subtitle: 'Caldeira vulcânica e pilares de obsidiana',
    accentColor: '#fb7185',
    skyTop: '#14080e',
    skyMid: '#3a1019',
    skyBottom: '#6a1b1b',
    floorTop: '#2b1920',
    floorMid: '#1a0e14',
    floorBottom: '#0a0508',
    platformStyle: 'stone',
  },
  {
    id: 'cyber_ruins',
    name: 'Ruínas de Neo-Shibuya',
    subtitle: 'Metrópole noturna em colapso neon',
    accentColor: '#22d3ee',
    skyTop: '#060a18',
    skyMid: '#131a3d',
    skyBottom: '#2d1447',
    floorTop: '#1d263b',
    floorMid: '#101524',
    floorBottom: '#06080f',
    platformStyle: 'metal',
  },
  {
    id: 'void_horizon',
    name: 'Horizonte Dimensional',
    subtitle: 'Dimensão astral de cristais e nebulosas',
    accentColor: '#c084fc',
    skyTop: '#09061a',
    skyMid: '#1d1142',
    skyBottom: '#132e4a',
    floorTop: '#221b48',
    floorMid: '#130f2c',
    floorBottom: '#070514',
    platformStyle: 'energy',
  },
  {
    id: 'sunset_harbor',
    name: 'Baía dos Piratas',
    subtitle: 'Porto lendário no crepúsculo dourado',
    accentColor: '#fbbf24',
    skyTop: '#161130',
    skyMid: '#592045',
    skyBottom: '#a63a33',
    floorTop: '#332421',
    floorMid: '#1f1514',
    floorBottom: '#0d0808',
    platformStyle: 'wood',
  },
];

const ALL_THEMES: ArenaThemeInfo[] = [...ARENA_THEMES, ...LEGACY_THEMES];

export function getArenaThemeInfo(id?: string): ArenaThemeInfo {
  const found = ALL_THEMES.find((t) => t.id === id);
  return found ?? ARENA_THEMES[0];
}

export interface ArenaPlatform {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tier: 1 | 2 | 3;
  style: 'stone' | 'energy' | 'metal' | 'wood';
}

export interface GeneratedArenaMap {
  seed: number;
  isRumble: boolean;
  archetypeId: string;
  archetypeName: string;
  themeId: ArenaThemeId;
  themeName: string;
  width: number;
  groundY: number;
  arenaLeft: number;
  arenaRight: number;
  platforms: ArenaPlatform[];
  spawnPoints: {
    team1: Array<{ x: number; y: number }>;
    team2: Array<{ x: number; y: number }>;
  };
}

export function mulberry32(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

interface PlatformBlueprint {
  cx: number; // centro X aproximado
  w: number;
  tier: 1 | 2 | 3;
}

const ARCHETYPES: Array<{
  id: string;
  name: string;
  build: (rng: () => number) => PlatformBlueprint[];
}> = [
  {
    id: 'stepped_sanctuary',
    name: 'Santuário Escalonado',
    build: (rng) => [
      { cx: 430 + randRange(rng, -40, 40), w: 280 + randRange(rng, 0, 50), tier: 1 },
      { cx: 880 + randRange(rng, -40, 40), w: 260 + randRange(rng, 0, 50), tier: 1 },
      { cx: 1300 + randRange(rng, -35, 35), w: 320 + randRange(rng, 0, 60), tier: 1 },
      { cx: 1720 + randRange(rng, -40, 40), w: 260 + randRange(rng, 0, 50), tier: 1 },
      { cx: 2170 + randRange(rng, -40, 40), w: 280 + randRange(rng, 0, 50), tier: 1 },
      { cx: 660 + randRange(rng, -35, 35), w: 250 + randRange(rng, 0, 45), tier: 2 },
      { cx: 1300 + randRange(rng, -35, 35), w: 270 + randRange(rng, 0, 50), tier: 2 },
      { cx: 1940 + randRange(rng, -35, 35), w: 250 + randRange(rng, 0, 45), tier: 2 },
      { cx: 1300 + randRange(rng, -50, 50), w: 260 + randRange(rng, 0, 50), tier: 3 },
    ],
  },
  {
    id: 'twin_towers',
    name: 'Torres Duplas do Coliseu',
    build: (rng) => [
      { cx: 460 + randRange(rng, -35, 35), w: 300 + randRange(rng, 0, 50), tier: 1 },
      { cx: 1030 + randRange(rng, -35, 35), w: 250 + randRange(rng, 0, 40), tier: 1 },
      { cx: 1570 + randRange(rng, -35, 35), w: 250 + randRange(rng, 0, 40), tier: 1 },
      { cx: 2140 + randRange(rng, -35, 35), w: 300 + randRange(rng, 0, 50), tier: 1 },
      { cx: 730 + randRange(rng, -30, 30), w: 260 + randRange(rng, 0, 45), tier: 2 },
      { cx: 1300 + randRange(rng, -30, 30), w: 240 + randRange(rng, 0, 40), tier: 2 },
      { cx: 1870 + randRange(rng, -30, 30), w: 260 + randRange(rng, 0, 45), tier: 2 },
      { cx: 740 + randRange(rng, -35, 35), w: 230 + randRange(rng, 0, 35), tier: 3 },
      { cx: 1860 + randRange(rng, -35, 35), w: 230 + randRange(rng, 0, 35), tier: 3 },
    ],
  },
  {
    id: 'floating_valley',
    name: 'Vale Flutuante Assimétrico',
    build: (rng) => {
      const flip = rng() < 0.5 ? 1 : -1;
      const mirror = (cx: number) => (flip === 1 ? cx : 2600 - cx);
      return [
        { cx: mirror(410 + randRange(rng, -30, 30)), w: 270 + randRange(rng, 0, 45), tier: 1 },
        { cx: mirror(940 + randRange(rng, -30, 30)), w: 290 + randRange(rng, 0, 50), tier: 1 },
        { cx: mirror(1520 + randRange(rng, -30, 30)), w: 280 + randRange(rng, 0, 50), tier: 1 },
        { cx: mirror(2130 + randRange(rng, -30, 30)), w: 300 + randRange(rng, 0, 50), tier: 1 },
        { cx: mirror(680 + randRange(rng, -30, 30)), w: 250 + randRange(rng, 0, 40), tier: 2 },
        { cx: mirror(1240 + randRange(rng, -30, 30)), w: 260 + randRange(rng, 0, 40), tier: 2 },
        { cx: mirror(1820 + randRange(rng, -30, 30)), w: 250 + randRange(rng, 0, 45), tier: 2 },
        { cx: mirror(1060 + randRange(rng, -40, 40)), w: 240 + randRange(rng, 0, 40), tier: 3 },
        { cx: mirror(1640 + randRange(rng, -40, 40)), w: 220 + randRange(rng, 0, 40), tier: 3 },
      ];
    },
  },
  {
    id: 'central_pyramid',
    name: 'Pirâmide Celestial',
    build: (rng) => [
      { cx: 520 + randRange(rng, -40, 40), w: 290 + randRange(rng, 0, 45), tier: 1 },
      { cx: 1020 + randRange(rng, -30, 30), w: 280 + randRange(rng, 0, 40), tier: 1 },
      { cx: 1580 + randRange(rng, -30, 30), w: 280 + randRange(rng, 0, 40), tier: 1 },
      { cx: 2080 + randRange(rng, -40, 40), w: 290 + randRange(rng, 0, 45), tier: 1 },
      { cx: 830 + randRange(rng, -30, 30), w: 250 + randRange(rng, 0, 40), tier: 2 },
      { cx: 1300 + randRange(rng, -25, 25), w: 300 + randRange(rng, 0, 50), tier: 2 },
      { cx: 1770 + randRange(rng, -30, 30), w: 250 + randRange(rng, 0, 40), tier: 2 },
      { cx: 1300 + randRange(rng, -30, 30), w: 250 + randRange(rng, 0, 40), tier: 3 },
    ],
  },
];

export function generateArenaMap(
  seed: number,
  isRumble: boolean,
  forcedTheme?: string
): GeneratedArenaMap {
  const safeSeed = Math.floor(Number(seed) || 133742);
  const rng = mulberry32(safeSeed);

  const explicitTheme =
    forcedTheme && forcedTheme !== 'auto' && forcedTheme !== 'random'
      ? ALL_THEMES.find((t) => t.id === forcedTheme)
      : undefined;
  const theme =
    explicitTheme ?? ARENA_THEMES[Math.floor(rng() * ARENA_THEMES.length)];

  if (!isRumble) {
    return {
      seed: safeSeed,
      isRumble: false,
      archetypeId: 'classic_duel',
      archetypeName: 'Arena Clássica',
      themeId: theme.id,
      themeName: theme.name,
      width: 1280,
      groundY: 540,
      arenaLeft: 70,
      arenaRight: 1210,
      platforms: [],
      spawnPoints: {
        team1: [{ x: 440, y: 540 }],
        team2: [{ x: 840, y: 540 }],
      },
    };
  }

  const arenaLeft = 90;
  const arenaRight = 2510;
  const groundY = 560;
  const archetype = ARCHETYPES[Math.floor(rng() * ARCHETYPES.length)];
  const blueprints = archetype.build(rng);

  const platforms: ArenaPlatform[] = blueprints.map((bp, idx) => {
    const w = Math.round(Math.max(200, Math.min(410, bp.w)));
    const rawX = Math.round(bp.cx - w * 0.5);
    const x = Math.max(arenaLeft + 30, Math.min(arenaRight - w - 30, rawX));

    // Alturas calibradas para JUMP_VEL=-790 e GRAVITY=2150 (~145px max de salto)
    let y = 440;
    if (bp.tier === 1) {
      y = Math.round(438 + randRange(rng, -6, 8)); // 114..128px acima do solo
    } else if (bp.tier === 2) {
      y = Math.round(320 + randRange(rng, -6, 8)); // 110..126px acima do Tier 1
    } else {
      y = Math.round(204 + randRange(rng, -6, 8)); // 108..124px acima do Tier 2
    }

    return {
      id: `plat_${idx}_${bp.tier}`,
      x,
      y,
      w,
      h: 18,
      tier: bp.tier,
      style: theme.platformStyle,
    };
  });

  // Garante separação horizontal mínima em plataformas do mesmo tier para não sobrepor visualmente
  for (const tier of [1, 2, 3] as const) {
    const sameTier = platforms
      .filter((p) => p.tier === tier)
      .sort((a, b) => a.x - b.x);
    for (let i = 1; i < sameTier.length; i++) {
      const prev = sameTier[i - 1];
      const curr = sameTier[i];
      const minX = prev.x + prev.w + 48;
      if (curr.x < minX) {
        curr.x = Math.min(arenaRight - curr.w - 25, minX);
      }
    }
  }

  return {
    seed: safeSeed,
    isRumble: true,
    archetypeId: archetype.id,
    archetypeName: archetype.name,
    themeId: theme.id,
    themeName: theme.name,
    width: 2600,
    groundY,
    arenaLeft,
    arenaRight,
    platforms,
    spawnPoints: {
      team1: [
        { x: 310, y: groundY },
        { x: 520, y: groundY },
        { x: 730, y: groundY },
      ],
      team2: [
        { x: 2290, y: groundY },
        { x: 2080, y: groundY },
        { x: 1870, y: groundY },
      ],
    },
  };
}

// ==========================================================
// Carregamento Opcional de Imagens de Fundo + Renderização
// ==========================================================
type BgLoadState =
  | { status: 'loading' }
  | { status: 'loaded'; image: HTMLImageElement }
  | { status: 'missing' };

const bgImageCache = new Map<ArenaThemeId, BgLoadState>();
const bgPromiseCache = new Map<ArenaThemeId, Promise<void>>();

export function isArenaBackgroundLoaded(themeId: ArenaThemeId): boolean {
  return bgImageCache.get(themeId)?.status === 'loaded';
}

export function preloadArenaBackground(themeId: ArenaThemeId): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();
  const cachedPromise = bgPromiseCache.get(themeId);
  if (cachedPromise) return cachedPromise;

  const theme = getArenaThemeInfo(themeId);
  bgImageCache.set(themeId, { status: 'loading' });

  const loadPromise = new Promise<void>((resolve) => {
    const loadSrc = (src: string, onFail: () => void) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        bgImageCache.set(themeId, { status: 'loaded', image: img });
        resolve();
      };
      img.onerror = onFail;
      img.src = src;
    };

    if (theme.imageSrc) {
      loadSrc(theme.imageSrc, () => {
        bgImageCache.set(themeId, { status: 'missing' });
        resolve();
      });
      return;
    }

    loadSrc(`/assets/backgrounds/${themeId}.webp`, () => {
      loadSrc(`/assets/backgrounds/${themeId}.png`, () => {
        bgImageCache.set(themeId, { status: 'missing' });
        resolve();
      });
    });
  });

  bgPromiseCache.set(themeId, loadPromise);
  return loadPromise;
}

export function renderThemeBackground(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  camX: number,
  camY: number,
  map: GeneratedArenaMap,
  viewScale = 1
): void {
  const theme = getArenaThemeInfo(map.themeId);
  void preloadArenaBackground(map.themeId);

  // 1. Céu gradiente base do bioma
  const sky = ctx.createLinearGradient(0, 0, 0, ch);
  sky.addColorStop(0, theme.skyTop);
  sky.addColorStop(0.58, theme.skyMid);
  sky.addColorStop(1, theme.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, cw, ch);

  const centerWorld = map.width * 0.5;
  const relCamX = camX - centerWorld;

  // 2. Renderiza a arte de fundo do mapa com parallax e alinhamento de solo
  const cachedBg = bgImageCache.get(map.themeId);
  if (cachedBg?.status === 'loaded') {
    const img = cachedBg.image;
    const parallaxPad = map.isRumble ? 1.18 : 1.08;
    const scale = Math.max(cw / img.width, ch / img.height) * parallaxPad;
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const maxPanX = Math.max(0, (drawW - cw) * 0.5);
    const normX = Math.max(-1, Math.min(1, relCamX / Math.max(1, map.width * 0.45)));
    const drawX = (cw - drawW) * 0.5 - normX * maxPanX;

    // Alinha o calçamento inferior (~79% da arte) à projeção de map.groundY na câmera
    const screenGroundY = ch * 0.56 + (map.groundY - camY) * viewScale;
    const targetDrawY = screenGroundY - drawH * 0.79;
    const drawY = Math.max(ch - drawH, Math.min(0, targetDrawY));

    ctx.save();
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    // Vinheta atmosférica sutil apenas para contraste dos personagens
    ctx.fillStyle = 'rgba(6, 10, 22, 0.1)';
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();
    return;
  }

  // 3. Fallback procedural estilizado por tema (com parallax)
  renderProceduralThemeLayers(ctx, cw, ch, relCamX, map.themeId, theme);
}

function renderProceduralThemeLayers(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  relCamX: number,
  themeId: ArenaThemeId,
  theme: ArenaThemeInfo
): void {
  const t = performance.now() * 0.001;

  // Astro / Elemento celestial distante (parallax 0.06)
  const astroX = cw * 0.72 - relCamX * 0.06;
  const astroY = themeId === 'sunset_harbor' ? ch * 0.44 : ch * 0.24;
  const astroR = Math.min(cw, ch) * (themeId === 'sunset_harbor' ? 0.16 : 0.11);

  ctx.save();
  if (themeId === 'shrine') {
    ctx.fillStyle = 'rgba(255, 226, 154, 0.9)';
    ctx.shadowColor = 'rgba(255, 184, 0, 0.55)';
    ctx.shadowBlur = 32;
    ctx.beginPath();
    ctx.arc(astroX, astroY, astroR, 0, Math.PI * 2);
    ctx.fill();
  } else if (themeId === 'volcano') {
    ctx.fillStyle = 'rgba(251, 113, 133, 0.35)';
    ctx.shadowColor = 'rgba(239, 68, 68, 0.75)';
    ctx.shadowBlur = 45;
    ctx.beginPath();
    ctx.arc(cw * 0.5 - relCamX * 0.05, ch * 0.58, astroR * 1.9, 0, Math.PI * 2);
    ctx.fill();
  } else if (themeId === 'void_horizon') {
    const rg = ctx.createRadialGradient(
      cw * 0.5 - relCamX * 0.05,
      ch * 0.34,
      8,
      cw * 0.5 - relCamX * 0.05,
      ch * 0.34,
      astroR * 2.4
    );
    rg.addColorStop(0, 'rgba(216, 180, 254, 0.85)');
    rg.addColorStop(0.45, 'rgba(56, 189, 248, 0.28)');
    rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cw * 0.5 - relCamX * 0.05, ch * 0.34, astroR * 2.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (themeId === 'sunset_harbor') {
    ctx.fillStyle = 'rgba(253, 224, 71, 0.88)';
    ctx.shadowColor = 'rgba(249, 115, 22, 0.7)';
    ctx.shadowBlur = 40;
    ctx.beginPath();
    ctx.arc(astroX, astroY, astroR, 0, Math.PI * 2);
    ctx.fill();
  } else if (themeId === 'cyber_ruins') {
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.22)';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cw * (0.5 + i * 0.18) - relCamX * 0.08, ch);
      ctx.lineTo(cw * (0.5 + i * 0.26) - relCamX * 0.04, 0);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Camada distante de montanhas / prédios / vulcões (parallax 0.16)
  const p1Off = -relCamX * 0.16;
  ctx.fillStyle =
    themeId === 'volcano'
      ? '#210c12'
      : themeId === 'sunset_harbor'
        ? '#2d1828'
        : themeId === 'cyber_ruins'
          ? '#0d1326'
          : '#15122b';

  ctx.beginPath();
  ctx.moveTo(0, ch);
  const horizon = ch * 0.66;
  const segW = cw / 6;
  for (let i = -2; i <= 9; i++) {
    const bx = i * segW + (((p1Off % segW) + segW) % segW) - segW;
    if (themeId === 'cyber_ruins') {
      const bh = ch * (0.24 + ((Math.abs(i * 17) % 18) / 100));
      ctx.fillRect(bx, horizon - bh, segW * 0.78, bh + ch * 0.4);
    } else {
      const peak = horizon - ((Math.abs(i * 53) % 85) + 35);
      ctx.lineTo(bx, peak);
      ctx.lineTo(bx + segW * 0.5, horizon - 12);
    }
  }
  if (themeId !== 'cyber_ruins') {
    ctx.lineTo(cw, ch);
    ctx.closePath();
    ctx.fill();
  }

  // Camada média de pilares / torres / velas de navio / cristais (parallax 0.30)
  const p2Off = -relCamX * 0.3;
  const colStep = cw / 7;
  ctx.save();
  for (let i = -2; i <= 10; i++) {
    const tx = i * colStep + (((p2Off % colStep) + colStep) % colStep) - colStep;
    const tw = cw * 0.055;
    const th = ch * (0.18 + ((Math.abs(i * 19) % 14) / 100));
    if (themeId === 'void_horizon') {
      ctx.fillStyle = 'rgba(139, 92, 246, 0.24)';
      ctx.beginPath();
      ctx.moveTo(tx, ch * 0.72);
      ctx.lineTo(tx + tw * 0.5, ch * 0.72 - th);
      ctx.lineTo(tx + tw, ch * 0.72);
      ctx.closePath();
      ctx.fill();
    } else if (themeId === 'sunset_harbor') {
      // Silhuetas de mastros ao fundo
      ctx.fillStyle = '#1b111a';
      ctx.fillRect(tx + tw * 0.45, ch * 0.72 - th, 4, th);
      ctx.beginPath();
      ctx.moveTo(tx + tw * 0.45, ch * 0.72 - th * 0.9);
      ctx.lineTo(tx + tw * 1.4, ch * 0.72 - th * 0.55);
      ctx.lineTo(tx + tw * 0.45, ch * 0.72 - th * 0.25);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = themeId === 'volcano' ? '#17070c' : '#100d20';
      ctx.fillRect(tx, ch * 0.72 - th, tw, th + ch * 0.3);
      if (themeId === 'cyber_ruins') {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(34,211,238,0.45)' : 'rgba(244,63,94,0.45)';
        ctx.fillRect(tx + tw * 0.2, ch * 0.72 - th + 14, tw * 0.6, 5);
      }
    }
  }

  // Partículas atmosféricas sutis (brasas/poeira astral)
  ctx.fillStyle = theme.accentColor;
  for (let i = 0; i < 16; i++) {
    const px = ((i * 193 + t * (18 + (i % 4) * 7) - relCamX * 0.22) % cw + cw) % cw;
    const py = ((i * 127 - t * (24 + (i % 3) * 11)) % (ch * 0.78) + ch * 0.78) % (ch * 0.78);
    ctx.globalAlpha = 0.22 + 0.15 * Math.sin(t * 2 + i);
    ctx.beginPath();
    ctx.arc(px, py, 1.5 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function renderArenaWorld(
  ctx: CanvasRenderingContext2D,
  map: GeneratedArenaMap
): void {
  const theme = getArenaThemeInfo(map.themeId);
  const gy = map.groundY;
  const startX = -500;
  const totalW = map.width + 1000;
  const hasBgImage = isArenaBackgroundLoaded(map.themeId);

  if (hasBgImage) {
    // Preserva o piso ilustrado da imagem, adicionando apenas sombra sutil de contato no solo
    const shadeGrad = ctx.createLinearGradient(0, gy, 0, gy + 36);
    shadeGrad.addColorStop(0, 'rgba(6, 10, 22, 0.28)');
    shadeGrad.addColorStop(1, 'rgba(6, 10, 22, 0)');
    ctx.fillStyle = shadeGrad;
    ctx.fillRect(startX, gy, totalW, 36);
  } else {
    // Piso principal contínuo (fallback procedural)
    const floorGrad = ctx.createLinearGradient(0, gy, 0, gy + 260);
    floorGrad.addColorStop(0, theme.floorTop);
    floorGrad.addColorStop(0.24, theme.floorMid);
    floorGrad.addColorStop(1, theme.floorBottom);
    ctx.fillStyle = floorGrad;
    ctx.fillRect(startX, gy, totalW, 340);

    // Borda luminosa energética do piso
    ctx.fillStyle = theme.accentColor;
    ctx.fillRect(startX, gy - 2, totalW, 4);

    // Linhas de perspectiva no solo
    ctx.strokeStyle = `${theme.accentColor}2b`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const center = map.width * 0.5;
    for (let x = 0; x <= map.width; x += 90) {
      ctx.moveTo(x, gy);
      ctx.lineTo((x - center) * 1.35 + center, gy + 210);
    }
    ctx.stroke();
  }

  // Vinheta sutil nos limites laterais da arena (sem barras vermelhas)
  ctx.save();
  const leftFade = ctx.createLinearGradient(map.arenaLeft - 140, 0, map.arenaLeft, 0);
  leftFade.addColorStop(0, 'rgba(6, 10, 22, 0.35)');
  leftFade.addColorStop(1, 'rgba(6, 10, 22, 0)');
  ctx.fillStyle = leftFade;
  ctx.fillRect(map.arenaLeft - 220, gy - 380, 220, 380);

  const rightFade = ctx.createLinearGradient(map.arenaRight, 0, map.arenaRight + 140, 0);
  rightFade.addColorStop(0, 'rgba(6, 10, 22, 0)');
  rightFade.addColorStop(1, 'rgba(6, 10, 22, 0.35)');
  ctx.fillStyle = rightFade;
  ctx.fillRect(map.arenaRight, gy - 380, 220, 380);
  ctx.restore();

  // Plataformas escaláveis (Rumble Arena)
  for (const plat of map.platforms) {
    renderPlatform(ctx, plat, theme.accentColor);
  }
}

function renderPlatform(
  ctx: CanvasRenderingContext2D,
  plat: ArenaPlatform,
  accentColor: string
): void {
  ctx.save();

  // Brilho suave abaixo da plataforma
  const glow = ctx.createLinearGradient(0, plat.y, 0, plat.y + plat.h + 18);
  glow.addColorStop(0, `${accentColor}44`);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(plat.x + 8, plat.y + plat.h, plat.w - 16, 18);

  // Corpo da plataforma por estilo
  let bodyTop = '#293556';
  let bodyBottom = '#11182c';
  let trimColor = accentColor;

  if (plat.style === 'wood') {
    bodyTop = '#6b4228';
    bodyBottom = '#361f14';
    trimColor = '#fbbf24';
  } else if (plat.style === 'metal') {
    bodyTop = '#334155';
    bodyBottom = '#0f172a';
    trimColor = '#22d3ee';
  } else if (plat.style === 'energy') {
    bodyTop = '#4c1d95';
    bodyBottom = '#1e1b4b';
    trimColor = '#c084fc';
  }

  const grad = ctx.createLinearGradient(0, plat.y, 0, plat.y + plat.h);
  grad.addColorStop(0, bodyTop);
  grad.addColorStop(1, bodyBottom);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(plat.x, plat.y, plat.w, plat.h, 6);
  ctx.fill();

  // Superfície superior destacada (indica área pisável)
  ctx.fillStyle = trimColor;
  ctx.fillRect(plat.x + 3, plat.y, plat.w - 6, 4);

  // Detalhes de suporte/runas
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  const notchStep = 44;
  for (let nx = plat.x + 22; nx < plat.x + plat.w - 18; nx += notchStep) {
    ctx.fillRect(nx, plat.y + 8, 14, 4);
  }

  ctx.restore();
}
