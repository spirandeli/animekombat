export type BeatEmUpStageId = 'brasilia' | 'pelourinho' | 'rio-de-janeiro' | 'belo-horizonte' | 'sao-paulo' | 'curitiba';

export type BeatEmUpBossId = 'boss_lula' | 'boss_pavanato' | 'boss_flavio_bolsonaro' | 'boss_nikolas_ferreira' | 'boss_pablo_marcal' | 'boss_sergio_moro';

export interface BeatEmUpWaveEnemySpawn {
  entityId: 'npc_civil_brasil' | 'npc_civil_vermelho' | 'npc_politico' | BeatEmUpBossId;
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
  segmentSrcs: string[];
  segmentNames: string[];
  bossId: BeatEmUpBossId;
  bossName: string;
  bossTitle: string;
  worldWidth: number;
  worldHeight: number;
  segmentWidth: number;
  walkMinZ: number;
  walkMaxZ: number;
  waves: BeatEmUpWaveDef[];
}

// All supplied backgrounds have a 16:9 aspect ratio. Keep the artwork proportional.
const SEGMENT_WIDTH = 1024 * 16 / 9;

type StageDefinition = Pick<BeatEmUpStageConfig,
  'id' | 'name' | 'accentColor' | 'bossId' | 'bossName' | 'bossTitle' | 'segmentNames'>;

function createStage(def: StageDefinition): BeatEmUpStageConfig {
  const segmentSrcs = def.segmentNames.map((_, i) =>
    `/assets/backgrounds/beatemup/${def.id}/segment_${String(i + 1).padStart(2, '0')}.webp`);
  const waves: BeatEmUpWaveDef[] = def.segmentNames.map((label, i) => {
    const isBossWave = i === def.segmentNames.length - 1;
    const start = i * SEGMENT_WIDTH;
    const spawns: BeatEmUpWaveEnemySpawn[] = isBossWave
      ? [
          { entityId: def.bossId, side: 'right', offsetX: 120, z: 830, isBoss: true },
          { entityId: 'npc_politico', side: 'left', offsetX: 70, z: 770 },
        ]
      : [
          { entityId: i % 2 ? 'npc_civil_vermelho' : 'npc_civil_brasil', side: 'right', offsetX: 60, z: 760 },
          { entityId: i >= 2 ? 'npc_politico' : 'npc_civil_vermelho', side: 'right', offsetX: 170, z: 865 },
          { entityId: 'npc_civil_brasil', side: 'left', offsetX: 65, z: 820 },
        ];
    if (!isBossWave && i >= 4) {
      spawns.push({ entityId: 'npc_politico', side: 'left', offsetX: 175, z: 910 });
    }
    return {
      id: `${def.id}_${isBossWave ? 'boss' : `w${i + 1}`}`,
      label, triggerX: start + 510, lockMinX: start,
      lockMaxX: start + SEGMENT_WIDTH, isBossWave, spawns,
      // Three recovery opportunities on the longer route, including before the boss.
      dropPickupAfterClear: [1, 3, 6].includes(i) ? {
        kind: i === 3 ? 'acai' : i === 1 ? 'pastel' : 'coco',
        label: i === 3 ? 'Açaí Energético' : i === 1 ? 'Pastel da Feira' : 'Água de Coco',
        heal: i === 6 ? 320 : 260, kiBoost: i === 6 ? 50 : 35,
        x: start + SEGMENT_WIDTH - 220, z: 835,
      } : undefined,
    };
  });
  return {
    ...def,
    subtitle: `${def.segmentNames[0]} → ${def.segmentNames[3]} → ${def.segmentNames[def.segmentNames.length - 1]}`,
    thumbnailSrc: segmentSrcs[0], segmentSrcs,
    worldWidth: SEGMENT_WIDTH * segmentSrcs.length,
    worldHeight: 1024, segmentWidth: SEGMENT_WIDTH,
    walkMinZ: 730, walkMaxZ: 965, waves,
  };
}

const STAGE_DEFINITIONS: StageDefinition[] = [
  {
    id: 'brasilia', name: 'Brasília (DF)', accentColor: '#ef4444',
    bossId: 'boss_lula', bossName: 'Presidente Lula', bossTitle: 'CHEFÃO DO PLANALTO',
    segmentNames: ['Torre de TV', 'Parque dos Ipês Amarelos', 'Rodoviária do Plano Piloto',
      'Início dos Ministérios', 'Catedral Metropolitana', 'Esplanada e Bandeiras',
      'Palácio Itamaraty', 'Congresso Nacional'],
  },
  {
    id: 'pelourinho', name: 'Pelourinho (BA)', accentColor: '#38bdf8',
    bossId: 'boss_pavanato', bossName: 'Vereador Pavanato', bossTitle: 'CHEFÃO DO TERREIRO',
    segmentNames: ['Mercado Modelo', 'Praça Cairu', 'Elevador Lacerda',
      'Murada e Subida Histórica', 'Rua do Casario Colorido', 'Largo do Pelourinho',
      'Arcos e Ladeira', 'Terreiro de Jesus'],
  },
  {
    id: 'rio-de-janeiro', name: 'Rio de Janeiro (RJ)', accentColor: '#22c55e',
    bossId: 'boss_flavio_bolsonaro', bossName: 'Senador Flávio', bossTitle: 'CHEFÃO DO MARACANÃ',
    segmentNames: ['Calçadão do Leme', 'Quiosques de Copacabana', 'Avenida Atlântica',
      'Aterro do Flamengo', 'Cinelândia', 'Arcos da Lapa', 'Avenida do Maracanã',
      'Esplanada do Maracanã'],
  },
  {
    id: 'belo-horizonte', name: 'Belo Horizonte (MG)', accentColor: '#FFC542',
    bossId: 'boss_nikolas_ferreira', bossName: 'Dep. Nikolas Ferreira', bossTitle: 'CHEFÃO DO MINEIRÃO',
    segmentNames: ['Orla da Pampulha', 'Igrejinha da Pampulha', 'Parque Municipal',
      'Mercado Central', 'Avenida Afonso Pena', 'Praça Sete', 'Praça da Liberdade',
      'Esplanada do Mineirão'],
  },
  {
    id: 'sao-paulo', name: 'São Paulo (SP)', accentColor: '#00D9FF',
    bossId: 'boss_pablo_marcal', bossName: 'Pablo Marçal', bossTitle: 'CHEFÃO DO IPIRANGA',
    segmentNames: ['Estação da Luz e Pinacoteca', 'Mercado Municipal',
      'Vale do Anhangabaú e Viaduto do Chá', 'Theatro Municipal', 'Avenida Paulista',
      'MASP', 'Parque Ibirapuera e Ponte Estaiada', 'Museu do Ipiranga'],
  },
  {
    id: 'curitiba', name: 'Curitiba (PR)', accentColor: '#62E6AA',
    bossId: 'boss_sergio_moro', bossName: 'Sérgio Moro', bossTitle: 'CHEFÃO DO JARDIM BOTÂNICO',
    segmentNames: ['Rua das Flores', 'Largo da Ordem', 'Passeio Público',
      'Torre Panorâmica', 'Parque Tanguá', 'Ópera de Arame', 'Museu Oscar Niemeyer',
      'Jardim Botânico'],
  },
];

export const BEAT_EM_UP_STAGES: BeatEmUpStageConfig[] = STAGE_DEFINITIONS.map(createStage);

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

  for (let i = 0; i < stage.segmentSrcs.length; i++) {
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
