export type BeatEmUpStageId = 'brasilia' | 'pelourinho' | 'rio-de-janeiro';

export interface BeatEmUpWaveEnemySpawn {
  entityId: 'npc_civil_brasil' | 'npc_civil_vermelho' | 'npc_politico' | 'boss_lula' | 'boss_pavanato' | 'boss_flavio_bolsonaro';
  offsetX: number; // relativo ao centro ou borda da arena travada
  side: 'left' | 'right';
  z: number;
  isBoss?: boolean;
}

export interface BeatEmUpWaveDef {
  id: string;
  label: string;
  triggerX: number;
  lockMinX: number;
  lockMaxX: number;
  isBossWave?: boolean;
  spawns: BeatEmUpWaveEnemySpawn[];
  dropPickupAfterClear?: {
    kind: 'acai' | 'pastel' | 'coco';
    label: string;
    heal: number;
    kiBoost: number;
    x: number;
    z: number;
  };
}

export interface BeatEmUpStageConfig {
  id: BeatEmUpStageId;
  name: string;
  subtitle: string;
  accentColor: string;
  thumbnailSrc: string;
  segmentSrcs: [string, string, string];
  segmentNames: [string, string, string];
  bossId: 'boss_lula' | 'boss_pavanato' | 'boss_flavio_bolsonaro';
  bossName: string;
  bossTitle: string;
  worldWidth: number;
  worldHeight: number;
  segmentWidth: number;
  walkMinZ: number;
  walkMaxZ: number;
  waves: BeatEmUpWaveDef[];
}

export const BEAT_EM_UP_STAGES: BeatEmUpStageConfig[] = [
  {
    id: 'brasilia',
    name: 'Brasília (DF)',
    subtitle: 'Eixo Monumental → Esplanada → Congresso Nacional',
    accentColor: '#ef4444',
    thumbnailSrc: '/assets/backgrounds/beatemup/brasilia/brasilia.png',
    segmentSrcs: [
      '/assets/backgrounds/beatemup/brasilia/bg_1_rodoviaria_eixo.png',
      '/assets/backgrounds/beatemup/brasilia/bg_2_esplanada_ministerios.png',
      '/assets/backgrounds/beatemup/brasilia/bg_3_congresso_boss.png',
    ],
    segmentNames: [
      'Rodoviária & Eixo Monumental',
      'Esplanada dos Ministérios',
      'Congresso Nacional — Arena do Chefão',
    ],
    bossId: 'boss_lula',
    bossName: 'Presidente Lula',
    bossTitle: 'CHEFÃO DO PLANALTO',
    worldWidth: 4608,
    worldHeight: 1024,
    segmentWidth: 1536,
    walkMinZ: 675,
    walkMaxZ: 965,
    waves: [
      {
        id: 'bsb_w1',
        label: 'Eixo Monumental',
        triggerX: 340,
        lockMinX: 0,
        lockMaxX: 1536,
        spawns: [
          { entityId: 'npc_civil_vermelho', side: 'right', offsetX: 60, z: 760 },
          { entityId: 'npc_civil_brasil', side: 'right', offsetX: 160, z: 865 },
          { entityId: 'npc_civil_vermelho', side: 'left', offsetX: 60, z: 820 },
        ],
        dropPickupAfterClear: {
          kind: 'pastel',
          label: 'Pastel da Rodoviária',
          heal: 220,
          kiBoost: 25,
          x: 1220,
          z: 820,
        },
      },
      {
        id: 'bsb_w2',
        label: 'Acesso à Esplanada',
        triggerX: 1180,
        lockMinX: 700,
        lockMaxX: 2236,
        spawns: [
          { entityId: 'npc_civil_vermelho', side: 'right', offsetX: 60, z: 750 },
          { entityId: 'npc_politico', side: 'right', offsetX: 180, z: 830 },
          { entityId: 'npc_civil_brasil', side: 'left', offsetX: 70, z: 890 },
          { entityId: 'npc_civil_vermelho', side: 'right', offsetX: 280, z: 910 },
        ],
      },
      {
        id: 'bsb_w3',
        label: 'Esplanada dos Ministérios',
        triggerX: 2050,
        lockMinX: 1536,
        lockMaxX: 3072,
        spawns: [
          { entityId: 'npc_politico', side: 'right', offsetX: 60, z: 770 },
          { entityId: 'npc_civil_vermelho', side: 'right', offsetX: 170, z: 855 },
          { entityId: 'npc_civil_brasil', side: 'left', offsetX: 65, z: 800 },
          { entityId: 'npc_politico', side: 'left', offsetX: 175, z: 905 },
        ],
        dropPickupAfterClear: {
          kind: 'acai',
          label: 'Açaí Energético',
          heal: 280,
          kiBoost: 45,
          x: 2820,
          z: 835,
        },
      },
      {
        id: 'bsb_w4',
        label: 'Praça dos Três Poderes',
        triggerX: 2950,
        lockMinX: 2460,
        lockMaxX: 3996,
        spawns: [
          { entityId: 'npc_civil_vermelho', side: 'right', offsetX: 60, z: 745 },
          { entityId: 'npc_civil_vermelho', side: 'right', offsetX: 180, z: 880 },
          { entityId: 'npc_politico', side: 'left', offsetX: 70, z: 815 },
          { entityId: 'npc_politico', side: 'right', offsetX: 260, z: 825 },
        ],
      },
      {
        id: 'bsb_boss',
        label: 'Congresso Nacional — Chefão!',
        triggerX: 3560,
        lockMinX: 3072,
        lockMaxX: 4608,
        isBossWave: true,
        spawns: [
          { entityId: 'boss_lula', side: 'right', offsetX: 120, z: 830, isBoss: true },
          { entityId: 'npc_politico', side: 'left', offsetX: 70, z: 760 },
        ],
      },
    ],
  },
  {
    id: 'pelourinho',
    name: 'Pelourinho (BA)',
    subtitle: 'Elevador Lacerda → Ladeira do Casario → Terreiro de Jesus',
    accentColor: '#38bdf8',
    thumbnailSrc: '/assets/backgrounds/beatemup/pelourinho/pelourinho.png',
    segmentSrcs: [
      '/assets/backgrounds/beatemup/pelourinho/bg_1_elevador_lacerda.png',
      '/assets/backgrounds/beatemup/pelourinho/bg_2_ladeira_casario.png',
      '/assets/backgrounds/beatemup/pelourinho/bg_3_terreiro_boss.png',
    ],
    segmentNames: [
      'Praça Cairu & Elevador Lacerda',
      'Ladeira do Casario Colonial',
      'Terreiro de Jesus — Arena do Chefão',
    ],
    bossId: 'boss_pavanato',
    bossName: 'Vereador Pavanato',
    bossTitle: 'CHEFÃO DO TERREIRO',
    worldWidth: 4608,
    worldHeight: 1024,
    segmentWidth: 1536,
    walkMinZ: 675,
    walkMaxZ: 965,
    waves: [
      {
        id: 'pel_w1',
        label: 'Praça Cairu',
        triggerX: 340,
        lockMinX: 0,
        lockMaxX: 1536,
        spawns: [
          { entityId: 'npc_civil_brasil', side: 'right', offsetX: 60, z: 775 },
          { entityId: 'npc_civil_vermelho', side: 'right', offsetX: 170, z: 870 },
          { entityId: 'npc_civil_brasil', side: 'left', offsetX: 65, z: 830 },
        ],
        dropPickupAfterClear: {
          kind: 'coco',
          label: 'Água de Coco Gelada',
          heal: 230,
          kiBoost: 30,
          x: 1240,
          z: 830,
        },
      },
      {
        id: 'pel_w2',
        label: 'Subida do Elevador',
        triggerX: 1180,
        lockMinX: 700,
        lockMaxX: 2236,
        spawns: [
          { entityId: 'npc_civil_brasil', side: 'right', offsetX: 60, z: 745 },
          { entityId: 'npc_politico', side: 'right', offsetX: 180, z: 840 },
          { entityId: 'npc_civil_vermelho', side: 'left', offsetX: 60, z: 890 },
          { entityId: 'npc_civil_brasil', side: 'right', offsetX: 270, z: 915 },
        ],
      },
      {
        id: 'pel_w3',
        label: 'Ladeira do Pelô',
        triggerX: 2050,
        lockMinX: 1536,
        lockMaxX: 3072,
        spawns: [
          { entityId: 'npc_civil_vermelho', side: 'right', offsetX: 60, z: 760 },
          { entityId: 'npc_politico', side: 'right', offsetX: 185, z: 850 },
          { entityId: 'npc_civil_brasil', side: 'left', offsetX: 65, z: 790 },
          { entityId: 'npc_civil_vermelho', side: 'left', offsetX: 170, z: 905 },
        ],
        dropPickupAfterClear: {
          kind: 'acai',
          label: 'Acarajé & Açaí',
          heal: 290,
          kiBoost: 45,
          x: 2820,
          z: 840,
        },
      },
      {
        id: 'pel_w4',
        label: 'Arcos do Casario',
        triggerX: 2950,
        lockMinX: 2460,
        lockMaxX: 3996,
        spawns: [
          { entityId: 'npc_politico', side: 'right', offsetX: 65, z: 765 },
          { entityId: 'npc_civil_brasil', side: 'right', offsetX: 170, z: 875 },
          { entityId: 'npc_civil_vermelho', side: 'left', offsetX: 75, z: 825 },
          { entityId: 'npc_politico', side: 'right', offsetX: 265, z: 905 },
        ],
      },
      {
        id: 'pel_boss',
        label: 'Terreiro de Jesus — Chefão!',
        triggerX: 3560,
        lockMinX: 3072,
        lockMaxX: 4608,
        isBossWave: true,
        spawns: [
          { entityId: 'boss_pavanato', side: 'right', offsetX: 120, z: 830, isBoss: true },
          { entityId: 'npc_civil_brasil', side: 'left', offsetX: 70, z: 770 },
        ],
      },
    ],
  },
  {
    id: 'rio-de-janeiro',
    name: 'Rio de Janeiro (RJ)',
    subtitle: 'Copacabana → Arcos da Lapa → Maracanã',
    accentColor: '#22c55e',
    thumbnailSrc: '/assets/backgrounds/beatemup/rio-de-janeiro/rio-de-janeiro.png',
    segmentSrcs: [
      '/assets/backgrounds/beatemup/rio-de-janeiro/bg_1_copacabana.png',
      '/assets/backgrounds/beatemup/rio-de-janeiro/bg_2_arcos_lapa.png',
      '/assets/backgrounds/beatemup/rio-de-janeiro/bg_3_maracana_boss.png',
    ],
    segmentNames: [
      'Calçadão de Copacabana',
      'Arcos da Lapa',
      'Esplanada do Maracanã — Arena do Chefão',
    ],
    bossId: 'boss_flavio_bolsonaro',
    bossName: 'Senador Flávio',
    bossTitle: 'CHEFÃO DO MARACANÃ',
    worldWidth: 4608,
    worldHeight: 1024,
    segmentWidth: 1536,
    walkMinZ: 685,
    walkMaxZ: 965,
    waves: [
      {
        id: 'rio_w1',
        label: 'Calçadão de Copacabana',
        triggerX: 340,
        lockMinX: 0,
        lockMaxX: 1536,
        spawns: [
          { entityId: 'npc_civil_brasil', side: 'right', offsetX: 60, z: 775 },
          { entityId: 'npc_civil_brasil', side: 'right', offsetX: 165, z: 870 },
          { entityId: 'npc_civil_vermelho', side: 'left', offsetX: 65, z: 825 },
        ],
        dropPickupAfterClear: {
          kind: 'coco',
          label: 'Água de Coco da Orla',
          heal: 230,
          kiBoost: 30,
          x: 1240,
          z: 830,
        },
      },
      {
        id: 'rio_w2',
        label: 'Quiosques da Praia',
        triggerX: 1180,
        lockMinX: 700,
        lockMaxX: 2236,
        spawns: [
          { entityId: 'npc_civil_brasil', side: 'right', offsetX: 60, z: 755 },
          { entityId: 'npc_politico', side: 'right', offsetX: 185, z: 845 },
          { entityId: 'npc_civil_vermelho', side: 'left', offsetX: 65, z: 885 },
          { entityId: 'npc_civil_brasil', side: 'right', offsetX: 280, z: 910 },
        ],
      },
      {
        id: 'rio_w3',
        label: 'Arcos da Lapa',
        triggerX: 2050,
        lockMinX: 1536,
        lockMaxX: 3072,
        spawns: [
          { entityId: 'npc_politico', side: 'right', offsetX: 65, z: 770 },
          { entityId: 'npc_civil_brasil', side: 'right', offsetX: 180, z: 855 },
          { entityId: 'npc_civil_vermelho', side: 'left', offsetX: 60, z: 810 },
          { entityId: 'npc_politico', side: 'left', offsetX: 175, z: 910 },
        ],
        dropPickupAfterClear: {
          kind: 'acai',
          label: 'Açaí da Lapa',
          heal: 290,
          kiBoost: 45,
          x: 2820,
          z: 840,
        },
      },
      {
        id: 'rio_w4',
        label: 'Rampa do Maracanã',
        triggerX: 2950,
        lockMinX: 2460,
        lockMaxX: 3996,
        spawns: [
          { entityId: 'npc_civil_brasil', side: 'right', offsetX: 60, z: 755 },
          { entityId: 'npc_politico', side: 'right', offsetX: 175, z: 860 },
          { entityId: 'npc_civil_vermelho', side: 'left', offsetX: 70, z: 820 },
          { entityId: 'npc_politico', side: 'right', offsetX: 260, z: 905 },
        ],
      },
      {
        id: 'rio_boss',
        label: 'Maracanã — Chefão!',
        triggerX: 3560,
        lockMinX: 3072,
        lockMaxX: 4608,
        isBossWave: true,
        spawns: [
          { entityId: 'boss_flavio_bolsonaro', side: 'right', offsetX: 120, z: 830, isBoss: true },
          { entityId: 'npc_politico', side: 'left', offsetX: 70, z: 765 },
        ],
      },
    ],
  },
];

export function getBeatEmUpStage(id?: string): BeatEmUpStageConfig {
  return BEAT_EM_UP_STAGES.find((s) => s.id === id) ?? BEAT_EM_UP_STAGES[0];
}

const stageImgCache = new Map<string, HTMLImageElement>();
const stagePromiseCache = new Map<string, Promise<void>>();

function loadStageImage(src: string): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();
  const existing = stagePromiseCache.get(src);
  if (existing) return existing;

  const p = new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      stageImgCache.set(src, img);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = src;
  });
  stagePromiseCache.set(src, p);
  return p;
}

export async function preloadBeatEmUpStageBackgrounds(stageId: BeatEmUpStageId): Promise<void> {
  const stage = getBeatEmUpStage(stageId);
  await Promise.all(stage.segmentSrcs.map((src) => loadStageImage(src)));
}

export function renderBeatEmUpBackground(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  camLeftWorld: number,
  viewScale: number,
  stage: BeatEmUpStageConfig
): void {
  // Fundo base caso alguma imagem ainda esteja decodificando
  ctx.fillStyle = '#090d1a';
  ctx.fillRect(0, 0, cw, ch);

  const segW = stage.segmentWidth;
  const worldH = stage.worldHeight;
  const screenSegW = segW * viewScale;
  const screenH = worldH * viewScale;
  const drawY = (ch - screenH) * 0.5;

  for (let i = 0; i < 3; i++) {
    const segWorldX = i * segW;
    const screenX = (segWorldX - camLeftWorld) * viewScale;
    if (screenX + screenSegW < -2 || screenX > cw + 2) continue;

    const src = stage.segmentSrcs[i];
    const img = stageImgCache.get(src);
    if (img) {
      // Sobrepõe 1px para evitar costura subpixel entre trechos
      ctx.drawImage(img, Math.floor(screenX), Math.floor(drawY), Math.ceil(screenSegW) + 1, Math.ceil(screenH));
    } else {
      void loadStageImage(src);
      ctx.fillStyle = i % 2 === 0 ? '#111827' : '#1e293b';
      ctx.fillRect(screenX, drawY, screenSegW, screenH);
    }
  }

  // Sutil vinheta no topo para leitura do HUD sem escurecer a área jogável
  const topShade = ctx.createLinearGradient(0, 0, 0, ch * 0.2);
  topShade.addColorStop(0, 'rgba(6, 10, 22, 0.52)');
  topShade.addColorStop(1, 'rgba(6, 10, 22, 0)');
  ctx.fillStyle = topShade;
  ctx.fillRect(0, 0, cw, ch * 0.2);
}
