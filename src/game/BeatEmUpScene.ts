import { AudioManager } from '../engine/AudioManager';
import { FighterInputState, InputManager } from '../engine/InputManager';
import {
  CanonicalAction,
  CanonicalVfx,
  LoadedBeatEmUpPack,
  LoadedFrame,
  LoadedPhasePack,
  SpriteLoader,
} from '../engine/SpriteLoader';
import { VirtualControls } from '../ui/VirtualControls';
import { AIDifficulty } from './AIController';
import {
  BeatEmUpStageConfig,
  BeatEmUpStageId,
  getBeatEmUpStage,
  preloadBeatEmUpStageBackgrounds,
  renderBeatEmUpBackground,
} from './BeatEmUpMap';
import { ATTACK_SPECS } from './Fighter';

export interface BeatEmUpConfig {
  charId: string;
  startPhase: number;
  level: number;
  displayName?: string;
  stageId: BeatEmUpStageId;
  difficulty: AIDifficulty;
}

export interface BeatEmUpEndReport {
  won: boolean;
  stageId: BeatEmUpStageId;
  stageName: string;
  charId: string;
  finalPhase: number;
  score: number;
  enemiesDefeated: number;
  maxCombo: number;
  elapsedSeconds: number;
  hpRemainingPct: number;
  xpEarned: number;
}

type ActorState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'dash'
  | 'jump'
  | 'land'
  | 'block'
  | 'hitstun'
  | 'knockdown'
  | 'getup'
  | 'ko_defeat'
  | 'ataque_1'
  | 'ataque_2'
  | 'ataque_3'
  | 'ataque_4'
  | 'air_ataque_1'
  | 'grab'
  | 'throw'
  | 'pickup'
  | 'evolve'
  | 'victory';

interface BeatActor {
  uid: number;
  kind: 'player' | 'npc' | 'boss';
  entityId: string;
  displayName: string;
  title?: string;
  x: number;
  z: number;
  airY: number; // <= 0 quando no ar
  vx: number;
  vz: number;
  vyAir: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  ki: number;
  maxKi: number;
  evoEnergy: number;
  phase: number;
  state: ActorState;
  stateTime: number;
  stateDuration: number;
  invulnTime: number;
  hitstunTime: number;
  attackHitTargets: Set<number>;
  projectileSpawned: boolean;
  vfxSpawned: boolean;
  comboCount: number;
  comboTimer: number;
  comboBufferNext: boolean;
  comboChainQueued: 'ataque_2' | 'ataque_3' | 'ataque_4' | null;
  cooldowns: Record<'ataque_1' | 'ataque_2' | 'ataque_3' | 'ataque_4', number>;
  dashCooldown: number;
  targetBodyHeight: number;
  auraColor: string;
  scoreValue: number;
  damageScale: number;
  moveSpeed: number;
  superArmor: boolean;
  // Grab / Throw
  grabbedTargetUid: number | null;
  grabbedByUid: number | null;
  thrownActive: boolean;
  // AI
  aiThinkTimer: number;
  aiAttackCooldown: number;
  aiTelegraphTimer: number;
  aiQueuedAttack: 'ataque_1' | 'ataque_2' | 'ataque_3' | 'ataque_4' | null;
  aiFlankSide: 1 | -1;
  aiFlankZOffset: number;
  // Death / Boss phase
  koTimer: number;
  deadDone: boolean;
  bossEnraged: boolean;
  // Packs
  heroPack?: LoadedPhasePack;
  enemyPack?: LoadedBeatEmUpPack;
}

interface BeatProjectile {
  active: boolean;
  ownerUid: number;
  ownerKind: 'player' | 'boss';
  x: number;
  z: number;
  yOffset: number;
  vx: number;
  facing: 1 | -1;
  damage: number;
  knockbackX: number;
  knockdown: boolean;
  frames: LoadedFrame[];
  elapsed: number;
  life: number;
  auraColor: string;
}

interface BeatVfx {
  active: boolean;
  x: number;
  z: number;
  yOffset: number;
  facing: 1 | -1;
  frames: LoadedFrame[];
  elapsed: number;
  duration: number;
  scale: number;
}

interface BeatFloatingText {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

interface BeatPickup {
  uid: number;
  kind: 'acai' | 'pastel' | 'coco';
  label: string;
  x: number;
  z: number;
  heal: number;
  kiBoost: number;
  collected: boolean;
  bobPhase: number;
}

const GRAVITY = 1950;
const JUMP_VEL = -760;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class BeatEmUpScene {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly hudEl: HTMLElement;
  private readonly spriteLoader: SpriteLoader;
  private readonly input: InputManager;
  private readonly virtualControls: VirtualControls;
  private readonly audio: AudioManager;

  private active = false;
  private ended = false;
  private stage: BeatEmUpStageConfig = getBeatEmUpStage('brasilia');
  private difficulty: AIDifficulty = 'medium';
  private config: BeatEmUpConfig | null = null;

  private nextUid = 1;
  private player: BeatActor | null = null;
  private enemies: BeatActor[] = [];
  private pickups: BeatPickup[] = [];
  private projectiles: BeatProjectile[] = [];
  private vfxs: BeatVfx[] = [];
  private floatingTexts: BeatFloatingText[] = [];

  private camLeftWorld = 0;
  private lockMinX = 0;
  private lockMaxX = 4608;
  private activeWaveIndex = -1;
  private triggeredWaveIds = new Set<string>();
  private clearedWaveIds = new Set<string>();
  private arenaLocked = false;
  private goPromptTimer = 0;
  private bannerText = '';
  private bannerTimer = 0;

  private score = 0;
  private enemiesDefeated = 0;
  private maxCombo = 0;
  private elapsedSeconds = 0;
  private hitStopRemaining = 0;
  private shakeTime = 0;
  private shakeIntensity = 0;
  private flashAlpha = 0;
  private endDelayTimer = 0;
  private pendingResultWon: boolean | null = null;

  private debugOverlay = false;
  private lastDirTap: { dir: -1 | 1; time: number } | null = null;
  private prevInputLeft = false;
  private prevInputRight = false;
  private evolvingPending = false;

  private onPauseRequested?: () => void;
  private onStageEnded?: (report: BeatEmUpEndReport) => void;

  private hudRefs: {
    hpFill?: HTMLElement;
    hpTrail?: HTMLElement;
    kiFill?: HTMLElement;
    evoFill?: HTMLElement;
    evoReady?: HTMLElement;
    phaseBadge?: HTMLElement;
    score?: HTMLElement;
    combo?: HTMLElement;
    waveLabel?: HTMLElement;
    goBanner?: HTMLElement;
    bossWrap?: HTMLElement;
    bossName?: HTMLElement;
    bossTitle?: HTMLElement;
    bossHpFill?: HTMLElement;
    fps?: HTMLElement;
  } = {};

  constructor(
    canvas: HTMLCanvasElement,
    spriteLoader: SpriteLoader,
    input: InputManager,
    virtualControls: VirtualControls,
    audio: AudioManager
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Contexto 2D do canvas não suportado.');
    this.ctx = ctx;

    const hud = document.getElementById('combat-hud');
    if (!hud) throw new Error('Elemento #combat-hud não encontrado.');
    this.hudEl = hud;

    this.spriteLoader = spriteLoader;
    this.input = input;
    this.virtualControls = virtualControls;
    this.audio = audio;

    window.addEventListener('keydown', this.handleDebugKey);
  }

  private handleDebugKey = (e: KeyboardEvent): void => {
    if (!this.active) return;
    if (e.code === 'F3') {
      e.preventDefault();
      this.debugOverlay = !this.debugOverlay;
    }
  };

  public setCallbacks(
    onPauseRequested: () => void,
    onStageEnded: (report: BeatEmUpEndReport) => void
  ): void {
    this.onPauseRequested = onPauseRequested;
    this.onStageEnded = onStageEnded;
  }

  public isActive(): boolean {
    return this.active;
  }

  public startStage(config: BeatEmUpConfig): void {
    this.config = config;
    this.stage = getBeatEmUpStage(config.stageId);
    this.difficulty = config.difficulty;
    void preloadBeatEmUpStageBackgrounds(this.stage.id);

    this.input.resetAll();
    this.virtualControls.resetTouchState();

    this.nextUid = 1;
    this.enemies = [];
    this.pickups = [];
    this.projectiles = [];
    this.vfxs = [];
    this.floatingTexts = [];
    this.triggeredWaveIds.clear();
    this.clearedWaveIds.clear();
    this.activeWaveIndex = -1;
    this.arenaLocked = false;
    this.lockMinX = 0;
    this.lockMaxX = this.stage.worldWidth;
    this.camLeftWorld = 0;
    this.goPromptTimer = 0;
    this.score = 0;
    this.enemiesDefeated = 0;
    this.maxCombo = 0;
    this.elapsedSeconds = 0;
    this.hitStopRemaining = 0;
    this.shakeTime = 0;
    this.shakeIntensity = 0;
    this.flashAlpha = 0;
    this.endDelayTimer = 0;
    this.pendingResultWon = null;
    this.ended = false;
    this.evolvingPending = false;
    this.lastDirTap = null;
    this.prevInputLeft = false;
    this.prevInputRight = false;

    const heroPack = this.spriteLoader.getCachedPhase(config.charId, config.startPhase);
    if (!heroPack) {
      throw new Error(`Hero phase pack not preloaded for ${config.charId} F${config.startPhase}`);
    }

    const charInfo = this.spriteLoader.getCharacter(config.charId);
    const displayName = config.displayName ?? charInfo?.name ?? config.charId;
    const hpBonus = 1 + (Math.max(1, config.level) - 1) * 0.035;
    const maxHp = Math.round(1250 * hpBonus);

    this.player = {
      uid: this.nextUid++,
      kind: 'player',
      entityId: config.charId,
      displayName,
      x: 240,
      z: (this.stage.walkMinZ + this.stage.walkMaxZ) * 0.5,
      airY: 0,
      vx: 0,
      vz: 0,
      vyAir: 0,
      facing: 1,
      hp: maxHp,
      maxHp,
      ki: 60,
      maxKi: 100,
      evoEnergy: 0,
      phase: config.startPhase,
      state: 'idle',
      stateTime: 0,
      stateDuration: 0.5,
      invulnTime: 0,
      hitstunTime: 0,
      attackHitTargets: new Set(),
      projectileSpawned: false,
      vfxSpawned: false,
      comboCount: 0,
      comboTimer: 0,
      comboBufferNext: false,
      comboChainQueued: null,
      cooldowns: { ataque_1: 0, ataque_2: 0, ataque_3: 0, ataque_4: 0 },
      dashCooldown: 0,
      targetBodyHeight: 264,
      auraColor: heroPack.manifest.auraColor || '#38bdf8',
      scoreValue: 0,
      damageScale: 1 + (Math.max(1, config.level) - 1) * 0.025 + (config.startPhase - 1) * 0.14,
      moveSpeed: 330,
      superArmor: false,
      grabbedTargetUid: null,
      grabbedByUid: null,
      thrownActive: false,
      aiThinkTimer: 0,
      aiAttackCooldown: 0,
      aiTelegraphTimer: 0,
      aiQueuedAttack: null,
      aiFlankSide: 1,
      aiFlankZOffset: 0,
      koTimer: 0,
      deadDone: false,
      bossEnraged: false,
      heroPack,
    };

    this.bannerText = `${this.stage.name.toUpperCase()} — AVANCE!`;
    this.bannerTimer = 2.4;

    this.active = true;
    this.hudEl.classList.remove('hidden');
    this.hudEl.setAttribute('aria-hidden', 'false');
    this.virtualControls.setVisible(true);
    this.buildHud();
    this.audio.startBgm();
  }

  public stopMatch(): void {
    this.active = false;
    this.ended = true;
    this.audio.stopBgm();
    this.hudEl.classList.add('hidden');
    this.hudEl.setAttribute('aria-hidden', 'true');
    this.hudEl.innerHTML = '';
    this.virtualControls.setVisible(false);
    this.input.resetAll();
  }

  private getViewScale(): number {
    const ch = Math.max(240, this.canvas.height);
    return ch / this.stage.worldHeight;
  }

  private getViewWorldWidth(): number {
    const scale = this.getViewScale();
    return this.canvas.width / Math.max(0.1, scale);
  }

  public update(dt: number): void {
    if (!this.active) return;

    const clampedDt = Math.min(dt, 0.05);

    if (this.bannerTimer > 0) this.bannerTimer = Math.max(0, this.bannerTimer - clampedDt);
    if (this.goPromptTimer > 0) this.goPromptTimer = Math.max(0, this.goPromptTimer - clampedDt);
    if (this.shakeTime > 0) this.shakeTime = Math.max(0, this.shakeTime - clampedDt);
    if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - clampedDt * 2.4);

    if (this.hitStopRemaining > 0) {
      this.hitStopRemaining = Math.max(0, this.hitStopRemaining - clampedDt);
      this.updateEffects(clampedDt * 0.25);
      return;
    }

    if (this.pendingResultWon !== null) {
      this.endDelayTimer -= clampedDt;
      this.updateEffects(clampedDt);
      if (this.endDelayTimer <= 0 && !this.ended) {
        this.finalizeStage(this.pendingResultWon);
      }
      return;
    }

    this.elapsedSeconds += clampedDt;

    const rawInput = this.input.sample();
    if ((this.input.consumePauseRequested() || this.input.pollGamepadPauseEdge()) && !this.ended) {
      this.onPauseRequested?.();
      return;
    }

    if (this.player) {
      this.updatePlayer(this.player, rawInput, clampedDt);
    }

    this.checkWaveTriggers();

    for (const enemy of this.enemies) {
      this.updateEnemy(enemy, clampedDt);
    }

    this.resolvePlayerPickups();
    this.updateProjectiles(clampedDt);
    this.updateEffects(clampedDt);
    this.cleanupDefeatedEnemies();
    this.checkWaveClear();
    this.updateCamera(clampedDt);
    this.updateVirtualControls();
    this.checkStageOutcome();
  }

  private getActionFrames(actor: BeatActor, action: CanonicalAction): LoadedFrame[] {
    if (actor.heroPack) {
      return (
        actor.heroPack.actions.get(action) ??
        actor.heroPack.actions.get(action === 'walk' ? 'run' : 'idle') ??
        actor.heroPack.actions.get('idle') ??
        []
      );
    }
    if (actor.enemyPack) {
      const fallbackMap: Partial<Record<CanonicalAction, CanonicalAction>> = {
        run: 'walk',
        dash: 'walk',
        getup: 'idle',
        ko_defeat: 'knockdown',
        block: 'idle',
        victory: 'idle',
      };
      return (
        actor.enemyPack.actions.get(action) ??
        (fallbackMap[action] ? actor.enemyPack.actions.get(fallbackMap[action]!) : undefined) ??
        actor.enemyPack.actions.get('idle') ??
        []
      );
    }
    return [];
  }

  private getVfxFrames(actor: BeatActor, vfx: CanonicalVfx): LoadedFrame[] {
    if (actor.heroPack) return actor.heroPack.vfx.get(vfx) ?? [];
    if (actor.enemyPack) return actor.enemyPack.vfx.get(vfx) ?? [];
    return [];
  }

  private computeActionDuration(actor: BeatActor, action: CanonicalAction, baseSec: number): number {
    const frames = this.getActionFrames(actor, action);
    if (frames.length <= 6) return baseSec;
    return Math.min(1.45, baseSec * (frames.length / 6) * 0.88);
  }

  private updatePlayer(p: BeatActor, input: FighterInputState, dt: number): void {
    // Cooldowns & timers
    for (const k of ['ataque_1', 'ataque_2', 'ataque_3', 'ataque_4'] as const) {
      p.cooldowns[k] = Math.max(0, p.cooldowns[k] - dt);
    }
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.invulnTime = Math.max(0, p.invulnTime - dt);
    if (p.comboTimer > 0) {
      p.comboTimer -= dt;
      if (p.comboTimer <= 0) p.comboCount = 0;
    }
    p.ki = Math.min(p.maxKi, p.ki + dt * 7.5);

    // Double-tap sprint detection
    const justLeft = input.left && !this.prevInputLeft;
    const justRight = input.right && !this.prevInputRight;
    this.prevInputLeft = input.left;
    this.prevInputRight = input.right;
    const now = performance.now() * 0.001;
    let isDoubleTapSprint = false;
    if (justLeft || justRight) {
      const dir: -1 | 1 = justLeft ? -1 : 1;
      if (this.lastDirTap && this.lastDirTap.dir === dir && now - this.lastDirTap.time < 0.28) {
        isDoubleTapSprint = true;
      }
      this.lastDirTap = { dir, time: now };
    }

    p.stateTime += dt;

    if (p.hp <= 0) {
      if (p.state !== 'knockdown' && p.state !== 'ko_defeat') {
        p.state = 'knockdown';
        p.stateTime = 0;
      }
      this.stepAirPhysics(p, dt);
      return;
    }

    // Grab clinch state
    if (p.state === 'grab') {
      const victim = this.enemies.find((e) => e.uid === p.grabbedTargetUid && e.hp > 0);
      if (!victim || p.stateTime >= 2.2) {
        if (victim) victim.grabbedByUid = null;
        p.grabbedTargetUid = null;
        p.state = 'idle';
        p.stateTime = 0;
      } else {
        victim.x = p.x + p.facing * 52;
        victim.z = p.z;
        victim.facing = (p.facing === 1 ? -1 : 1);
        if (input.justA1) {
          // Joelhada no clinch
          this.damageActor(p, victim, Math.round(44 * p.damageScale), 0, 0, false, 0.25);
          this.audio.playSfx('atk1');
          p.stateTime = Math.min(p.stateTime, 1.4);
          if (victim.hp <= 0) {
            p.grabbedTargetUid = null;
            victim.grabbedByUid = null;
            p.state = 'idle';
            p.stateTime = 0;
          }
        } else if (input.justA2 || input.justA3) {
          // Arremesso (throw)!
          p.state = 'throw';
          p.stateTime = 0;
          p.stateDuration = this.computeActionDuration(p, 'throw', 0.48);
          victim.grabbedByUid = null;
          victim.state = 'knockdown';
          victim.stateTime = 0;
          victim.vx = p.facing * 540;
          victim.vyAir = -420;
          victim.thrownActive = true;
          this.damageActor(p, victim, Math.round(92 * p.damageScale), p.facing * 520, -340, true, 0.6);
          p.grabbedTargetUid = null;
          this.audio.playSfx('atk2');
        }
      }
      return;
    }

    if (p.state === 'throw' || p.state === 'pickup' || p.state === 'evolve') {
      if (p.stateTime >= p.stateDuration) {
        p.state = 'idle';
        p.stateTime = 0;
      }
      return;
    }

    if (p.state === 'hitstun') {
      p.hitstunTime -= dt;
      p.x += p.vx * dt;
      p.vx *= Math.pow(0.05, dt);
      this.stepAirPhysics(p, dt);
      if (p.hitstunTime <= 0 && p.airY >= 0) {
        p.state = 'idle';
        p.stateTime = 0;
      }
      this.clampActorToPlayableBounds(p);
      return;
    }

    if (p.state === 'knockdown') {
      p.x += p.vx * dt;
      p.vx *= Math.pow(0.18, dt);
      this.stepAirPhysics(p, dt);
      if (p.airY >= 0 && p.stateTime >= 0.62) {
        p.state = 'getup';
        p.stateTime = 0;
        p.stateDuration = 0.42;
        p.invulnTime = 0.85;
      }
      this.clampActorToPlayableBounds(p);
      return;
    }

    if (p.state === 'getup') {
      if (p.stateTime >= p.stateDuration) {
        p.state = 'idle';
        p.stateTime = 0;
      }
      return;
    }

    // Evolution trigger
    if (input.justEvolve && p.phase < 4 && p.evoEnergy >= 100 && p.airY >= 0 && !this.evolvingPending) {
      const nextPhase = p.phase + 1;
      this.evolvingPending = true;
      void this.spriteLoader.loadPhasePack(p.entityId, nextPhase).then((pack) => {
        if (!this.player) return;
        this.player.heroPack = pack;
        this.player.phase = nextPhase;
        this.player.evoEnergy = 0;
        this.player.damageScale += 0.16;
        this.player.auraColor = pack.manifest.auraColor || this.player.auraColor;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 260);
        this.player.ki = this.player.maxKi;
        this.player.invulnTime = 1.1;
        this.player.state = 'evolve';
        this.player.stateTime = 0;
        this.player.stateDuration = 0.55;
        this.audio.playSfx('evolve');
        this.spawnText(this.player.x, this.player.z - 220, `FASE ${nextPhase}!`, '#facc15', 1.35);
        this.evolvingPending = false;
      });
      return;
    }

    // Air attack
    if (p.state === 'air_ataque_1') {
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      this.stepAirPhysics(p, dt);
      const prog = p.stateTime / Math.max(0.01, p.stateDuration);
      if (prog >= 0.22 && prog <= 0.78) {
        this.performMeleeHitCheck(p, 76 * p.damageScale, 155, 110, 220, -140, false, 'vfx_ataque_1');
      }
      if (p.airY >= 0) {
        p.state = 'land';
        p.stateTime = 0;
        p.stateDuration = 0.12;
      }
      this.clampActorToPlayableBounds(p);
      return;
    }

    // Ground attack states
    if (
      p.state === 'ataque_1' ||
      p.state === 'ataque_2' ||
      p.state === 'ataque_3' ||
      p.state === 'ataque_4'
    ) {
      const spec = ATTACK_SPECS[p.state];
      const prog = p.stateTime / Math.max(0.01, p.stateDuration);

      if (spec.lungeX > 0 && prog >= 0.15 && prog <= 0.55) {
        p.x += p.facing * spec.lungeX * 1.45 * dt;
      }

      if (!p.vfxSpawned && prog >= 0.22 && !spec.isProjectile) {
        p.vfxSpawned = true;
        this.spawnVfx(p, spec.vfx, p.x + p.facing * 75, p.z, -120, 0.58);
      }

      if (spec.isProjectile) {
        if (!p.projectileSpawned && prog >= spec.activeStart) {
          p.projectileSpawned = true;
          this.spawnPlayerProjectile(p);
        }
      } else if (prog >= spec.activeStart && prog <= spec.activeEnd) {
        const rangeW = p.state === 'ataque_4' ? 280 : p.state === 'ataque_2' ? 165 : 148;
        const depthTol = p.state === 'ataque_4' ? 105 : 62;
        const isKd = p.state === 'ataque_2' || p.state === 'ataque_4';
        this.performMeleeHitCheck(
          p,
          spec.damage * p.damageScale,
          rangeW,
          depthTol,
          spec.knockbackX,
          spec.knockbackY,
          isKd,
          spec.vfx
        );
      }

      // Combo cancel buffering: A1 -> A2 -> A3/A4
      if (prog >= 0.32 && prog <= 0.92) {
        if (p.state === 'ataque_1' && input.justA2 && p.ki >= ATTACK_SPECS.ataque_2.kiCost) {
          p.comboChainQueued = 'ataque_2';
        } else if (p.state === 'ataque_2' && input.justA3 && p.ki >= ATTACK_SPECS.ataque_3.kiCost) {
          p.comboChainQueued = 'ataque_3';
        } else if (
          (p.state === 'ataque_2' || p.state === 'ataque_3') &&
          input.justA4 &&
          p.ki >= ATTACK_SPECS.ataque_4.kiCost
        ) {
          p.comboChainQueued = 'ataque_4';
        }
      }

      if (p.comboChainQueued && prog >= 0.58) {
        const nextAtk = p.comboChainQueued;
        p.comboChainQueued = null;
        this.startPlayerAttack(p, nextAtk);
        return;
      }

      if (p.stateTime >= p.stateDuration) {
        p.state = 'idle';
        p.stateTime = 0;
        p.superArmor = false;
      }
      this.clampActorToPlayableBounds(p);
      return;
    }

    // Dash burst
    if (p.state === 'dash') {
      p.x += p.facing * 640 * dt;
      this.clampActorToPlayableBounds(p);
      if (p.stateTime >= p.stateDuration) {
        p.state = 'idle';
        p.stateTime = 0;
      }
      return;
    }

    // Airborne jump
    if (p.airY < 0 || p.state === 'jump') {
      const moveX = input.moveX;
      const moveY = input.moveY;
      p.vx = moveX * p.moveSpeed * 1.05;
      p.vz = moveY * (p.moveSpeed * 0.55);
      if (Math.abs(moveX) > 0.15) p.facing = moveX > 0 ? 1 : -1;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      this.stepAirPhysics(p, dt);

      if (input.justA1 || input.justA2) {
        p.state = 'air_ataque_1';
        p.stateTime = 0;
        p.stateDuration = this.computeActionDuration(p, 'air_ataque_1', 0.42);
        p.attackHitTargets.clear();
        this.audio.playSfx('atk1');
        return;
      }

      if (p.airY >= 0) {
        p.state = 'land';
        p.stateTime = 0;
        p.stateDuration = 0.12;
      }
      this.clampActorToPlayableBounds(p);
      return;
    }

    if (p.state === 'land' && p.stateTime < p.stateDuration) {
      return;
    }

    // Block
    if (input.block) {
      p.state = 'block';
      p.vx = 0;
      p.vz = 0;
      return;
    }

    // Contextual Grab when walking very close into a hitstunned NPC
    if (input.justA1 || input.justA2) {
      const stunVictim = this.enemies.find(
        (e) =>
          e.kind === 'npc' &&
          e.hp > 0 &&
          e.state === 'hitstun' &&
          Math.abs(e.x - p.x) < 62 &&
          Math.abs(e.z - p.z) < 34
      );
      if (stunVictim && input.justA1 && Math.abs(input.moveX) > 0.2) {
        p.state = 'grab';
        p.stateTime = 0;
        p.grabbedTargetUid = stunVictim.uid;
        stunVictim.grabbedByUid = p.uid;
        stunVictim.state = 'hitstun';
        p.facing = stunVictim.x >= p.x ? 1 : -1;
        this.audio.playSfx('atk1');
        return;
      }
    }

    // Attack inputs
    if (input.justA4 && p.ki >= ATTACK_SPECS.ataque_4.kiCost && p.cooldowns.ataque_4 <= 0) {
      this.startPlayerAttack(p, 'ataque_4');
      return;
    }
    if (input.justA3 && p.ki >= ATTACK_SPECS.ataque_3.kiCost && p.cooldowns.ataque_3 <= 0) {
      this.startPlayerAttack(p, 'ataque_3');
      return;
    }
    if (input.justA2 && p.ki >= ATTACK_SPECS.ataque_2.kiCost && p.cooldowns.ataque_2 <= 0) {
      this.startPlayerAttack(p, 'ataque_2');
      return;
    }
    if (input.justA1 && p.cooldowns.ataque_1 <= 0) {
      this.startPlayerAttack(p, 'ataque_1');
      return;
    }

    // Jump
    if (input.justJump) {
      p.state = 'jump';
      p.stateTime = 0;
      p.vyAir = JUMP_VEL;
      p.airY = -1;
      this.audio.playSfx('jump');
      return;
    }

    // Dash
    if (input.justDash && p.dashCooldown <= 0) {
      p.state = 'dash';
      p.stateTime = 0;
      p.stateDuration = 0.2;
      p.dashCooldown = 0.45;
      p.invulnTime = 0.18;
      if (Math.abs(input.moveX) > 0.15) p.facing = input.moveX > 0 ? 1 : -1;
      return;
    }

    // 2.5D Movement (normalized diagonal speed)
    let mx = input.moveX;
    let mz = input.moveY;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }

    const sprinting = (isDoubleTapSprint || input.dash) && len > 0.25;
    if (len > 0.12) {
      const speedMult = sprinting ? 1.42 : 1.0;
      p.vx = mx * p.moveSpeed * speedMult;
      p.vz = mz * (p.moveSpeed * 0.62 * speedMult);
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      if (Math.abs(mx) > 0.12) p.facing = mx > 0 ? 1 : -1;
      p.state = sprinting ? 'run' : 'walk';
    } else {
      p.vx = 0;
      p.vz = 0;
      p.state = 'idle';
    }

    this.clampActorToPlayableBounds(p);
  }

  private startPlayerAttack(
    p: BeatActor,
    atk: 'ataque_1' | 'ataque_2' | 'ataque_3' | 'ataque_4'
  ): void {
    const spec = ATTACK_SPECS[atk];
    p.ki = Math.max(0, p.ki - spec.kiCost);
    p.cooldowns[atk] = atk === 'ataque_1' ? 0.18 : spec.cooldown * 0.72;
    p.state = atk;
    p.stateTime = 0;
    const baseDur = atk === 'ataque_1' ? 0.34 : atk === 'ataque_2' ? 0.46 : atk === 'ataque_3' ? 0.54 : 0.82;
    p.stateDuration = this.computeActionDuration(p, atk, baseDur);
    p.attackHitTargets.clear();
    p.projectileSpawned = false;
    p.vfxSpawned = false;
    p.comboChainQueued = null;
    p.superArmor = atk === 'ataque_4';
    if (atk === 'ataque_1') this.audio.playSfx('atk1');
    else if (atk === 'ataque_2') this.audio.playSfx('atk2');
    else if (atk === 'ataque_3') this.audio.playSfx('atk3');
    else this.audio.playSfx('atk4');
  }

  private spawnPlayerProjectile(p: BeatActor): void {
    const frames = this.getVfxFrames(p, 'vfx_ataque_3');
    this.projectiles.push({
      active: true,
      ownerUid: p.uid,
      ownerKind: 'player',
      x: p.x + p.facing * 84,
      z: p.z,
      yOffset: -125,
      vx: p.facing * 680,
      facing: p.facing,
      damage: Math.round(ATTACK_SPECS.ataque_3.damage * p.damageScale),
      knockbackX: 280,
      knockdown: true,
      frames,
      elapsed: 0,
      life: 1.5,
      auraColor: p.auraColor,
    });
  }

  private spawnBossProjectile(b: BeatActor): void {
    const frames = this.getVfxFrames(b, 'vfx_ataque_3');
    this.projectiles.push({
      active: true,
      ownerUid: b.uid,
      ownerKind: 'boss',
      x: b.x + b.facing * 95,
      z: b.z,
      yOffset: -135,
      vx: b.facing * (b.bossEnraged ? 560 : 470),
      facing: b.facing,
      damage: Math.round(135 * b.damageScale),
      knockbackX: 260,
      knockdown: false,
      frames,
      elapsed: 0,
      life: 2.0,
      auraColor: b.auraColor,
    });
  }

  private performMeleeHitCheck(
    attacker: BeatActor,
    damage: number,
    rangeW: number,
    depthTol: number,
    knockbackX: number,
    knockbackY: number,
    knockdown: boolean,
    vfxKey: CanonicalVfx
  ): void {
    const targets = attacker.kind === 'player' ? this.enemies : this.player ? [this.player] : [];
    const hitMinX = attacker.facing === 1 ? attacker.x - 24 : attacker.x - rangeW;
    const hitMaxX = attacker.facing === 1 ? attacker.x + rangeW : attacker.x + 24;

    for (const def of targets) {
      if (def.hp <= 0 || def.invulnTime > 0 || attacker.attackHitTargets.has(def.uid)) continue;
      if (Math.abs(def.z - attacker.z) > depthTol) continue;
      if (Math.abs(def.airY - attacker.airY) > 130) continue;

      const defHalfW = def.kind === 'boss' ? 62 : 48;
      if (def.x + defHalfW < hitMinX || def.x - defHalfW > hitMaxX) continue;

      attacker.attackHitTargets.add(def.uid);
      this.damageActor(
        attacker,
        def,
        Math.round(damage),
        attacker.facing * knockbackX,
        knockbackY,
        knockdown,
        knockdown ? 0.45 : 0.3
      );
      this.spawnVfx(
        attacker,
        vfxKey,
        (attacker.x + def.x) * 0.5,
        def.z + 2,
        -120,
        attacker.state === 'ataque_4' ? 0.72 : 0.52
      );
    }
  }

  private damageActor(
    attacker: BeatActor,
    def: BeatActor,
    rawDamage: number,
    kbX: number,
    kbY: number,
    knockdown: boolean,
    hitstun: number
  ): void {
    const blocked = def.state === 'block' && def.facing !== attacker.facing;
    const finalDmg = blocked ? Math.max(4, Math.round(rawDamage * 0.25)) : rawDamage;

    def.hp = Math.max(0, def.hp - finalDmg);
    this.spawnText(
      def.x,
      def.z + def.airY - def.targetBodyHeight * 0.82,
      blocked ? `DEF -${finalDmg}` : `-${finalDmg}`,
      blocked ? '#93c5fd' : finalDmg >= 140 ? '#facc15' : '#ffffff',
      finalDmg >= 140 ? 1.25 : 1.0
    );

    if (attacker.kind === 'player') {
      attacker.ki = Math.min(attacker.maxKi, attacker.ki + 8);
      attacker.evoEnergy = Math.min(100, attacker.evoEnergy + (finalDmg >= 120 ? 14 : 9));
      attacker.comboCount += 1;
      attacker.comboTimer = 2.4;
      this.maxCombo = Math.max(this.maxCombo, attacker.comboCount);
      this.score += finalDmg;
    }

    if (blocked) {
      def.vx = kbX * 0.35;
      this.audio.playSfx('block');
      return;
    }

    this.audio.playSfx(finalDmg >= 120 ? 'heavyHit' : 'hit');
    this.hitStopRemaining = Math.max(this.hitStopRemaining, finalDmg >= 130 ? 0.055 : 0.028);
    if (finalDmg >= 120) {
      this.shakeTime = 0.16;
      this.shakeIntensity = 7;
    }
    if (attacker.state === 'ataque_4') {
      this.flashAlpha = 0.45;
    }

    if (def.hp <= 0) {
      def.state = 'ko_defeat';
      def.stateTime = 0;
      def.koTimer = 0;
      def.vx = kbX * 0.85;
      def.vyAir = Math.min(-220, kbY);
      def.thrownActive = false;
      if (def.grabbedByUid) {
        const p = this.player;
        if (p && p.grabbedTargetUid === def.uid) p.grabbedTargetUid = null;
        def.grabbedByUid = null;
      }
      if (def.kind !== 'player') {
        this.score += def.scoreValue;
        this.enemiesDefeated += 1;
      }
      return;
    }

    if (def.superArmor) {
      return;
    }

    def.grabbedTargetUid = null;
    if (knockdown || kbY < -200) {
      def.state = 'knockdown';
      def.stateTime = 0;
      def.vx = kbX;
      def.vyAir = Math.min(-260, kbY);
    } else {
      def.state = 'hitstun';
      def.stateTime = 0;
      def.hitstunTime = hitstun;
      def.vx = kbX * 0.55;
    }
  }

  private updateEnemy(e: BeatActor, dt: number): void {
    e.stateTime += dt;
    e.invulnTime = Math.max(0, e.invulnTime - dt);
    e.aiAttackCooldown = Math.max(0, e.aiAttackCooldown - dt);
    for (const k of ['ataque_1', 'ataque_2', 'ataque_3', 'ataque_4'] as const) {
      e.cooldowns[k] = Math.max(0, e.cooldowns[k] - dt);
    }

    if (e.grabbedByUid !== null) {
      return;
    }

    if (e.hp <= 0 || e.state === 'ko_defeat') {
      e.x += e.vx * dt;
      e.vx *= Math.pow(0.1, dt);
      this.stepAirPhysics(e, dt);
      e.koTimer += dt;
      this.clampActorToPlayableBounds(e);
      if (e.koTimer >= (e.kind === 'boss' ? 1.8 : 1.15)) {
        e.deadDone = true;
      }
      return;
    }

    if (e.state === 'knockdown') {
      e.x += e.vx * dt;
      e.vx *= Math.pow(0.16, dt);
      this.stepAirPhysics(e, dt);

      // Thrown NPC bowling collision against other NPCs!
      if (e.thrownActive && e.airY < -5) {
        for (const other of this.enemies) {
          if (other === e || other.hp <= 0 || other.invulnTime > 0) continue;
          if (Math.abs(other.x - e.x) < 64 && Math.abs(other.z - e.z) < 48) {
            this.damageActor(e, other, 85, e.vx * 0.6, -240, true, 0.4);
          }
        }
      }

      if (e.airY >= 0) {
        e.thrownActive = false;
        if (e.stateTime >= 0.72) {
          e.state = 'getup';
          e.stateTime = 0;
          e.stateDuration = 0.45;
          e.invulnTime = 0.65;
        }
      }
      this.clampActorToPlayableBounds(e);
      return;
    }

    if (e.state === 'getup') {
      if (e.stateTime >= e.stateDuration) {
        e.state = 'idle';
        e.stateTime = 0;
      }
      return;
    }

    if (e.state === 'hitstun') {
      e.hitstunTime -= dt;
      e.x += e.vx * dt;
      e.vx *= Math.pow(0.06, dt);
      if (e.hitstunTime <= 0) {
        e.state = 'idle';
        e.stateTime = 0;
      }
      this.clampActorToPlayableBounds(e);
      return;
    }

    if (e.state === 'block') {
      if (e.stateTime >= e.stateDuration) {
        e.state = 'idle';
        e.stateTime = 0;
      }
      return;
    }

    if (e.state === 'dash') {
      e.x += e.facing * 520 * dt;
      this.clampActorToPlayableBounds(e);
      if (e.stateTime >= e.stateDuration) {
        e.state = 'idle';
        e.stateTime = 0;
      }
      return;
    }

    // Active enemy/boss attack
    if (
      e.state === 'ataque_1' ||
      e.state === 'ataque_2' ||
      e.state === 'ataque_3' ||
      e.state === 'ataque_4'
    ) {
      const prog = e.stateTime / Math.max(0.01, e.stateDuration);
      if (e.state === 'ataque_2' && prog >= 0.25 && prog <= 0.72) {
        e.x += e.facing * (e.kind === 'boss' ? 360 : 210) * dt;
      }

      if (!e.vfxSpawned && prog >= 0.35 && e.kind === 'boss') {
        e.vfxSpawned = true;
        this.spawnVfx(e, `vfx_${e.state}` as CanonicalVfx, e.x + e.facing * 85, e.z, -125, 0.65);
      }

      if (e.kind === 'boss' && e.state === 'ataque_3') {
        if (!e.projectileSpawned && prog >= 0.45) {
          e.projectileSpawned = true;
          this.spawnBossProjectile(e);
        }
      } else if (prog >= 0.38 && prog <= 0.68) {
        const rangeW = e.state === 'ataque_4' ? 270 : e.kind === 'boss' ? 175 : 122;
        const depthTol = e.state === 'ataque_4' ? 115 : 54;
        const baseDmg =
          e.state === 'ataque_4' ? 175 : e.state === 'ataque_2' ? 95 : 68;
        const isKd = e.state === 'ataque_2' || e.state === 'ataque_4';
        this.performMeleeHitCheck(
          e,
          baseDmg * e.damageScale,
          rangeW,
          depthTol,
          e.state === 'ataque_4' ? 340 : 210,
          isKd ? -240 : -60,
          isKd,
          e.state === 'ataque_4' ? 'vfx_ataque_4' : 'vfx_ataque_1'
        );
      }

      if (e.stateTime >= e.stateDuration) {
        e.state = 'idle';
        e.stateTime = 0;
        e.superArmor = false;
      }
      this.clampActorToPlayableBounds(e);
      return;
    }

    // AI decision & flanking movement
    const p = this.player;
    if (!p || p.hp <= 0) {
      e.state = e.kind === 'boss' ? 'victory' : 'idle';
      return;
    }

    if (e.kind === 'boss' && !e.bossEnraged && e.hp < e.maxHp * 0.5) {
      e.bossEnraged = true;
      e.damageScale *= 1.18;
      e.moveSpeed *= 1.15;
      this.spawnText(e.x, e.z - 280, 'FÚRIA DO CHEFÃO!', e.auraColor, 1.35);
    }

    // Telegraph countdown before executing queued attack
    if (e.aiTelegraphTimer > 0) {
      e.aiTelegraphTimer -= dt;
      e.state = 'idle';
      if (e.aiTelegraphTimer <= 0 && e.aiQueuedAttack) {
        const atk = e.aiQueuedAttack;
        e.aiQueuedAttack = null;
        this.startEnemyAttack(e, atk);
      }
      return;
    }

    const dx = p.x - e.x;
    const dz = p.z - e.z;
    e.facing = dx >= 0 ? 1 : -1;

    e.aiThinkTimer -= dt;
    if (e.aiThinkTimer <= 0) {
      const thinkBase = this.difficulty === 'easy' ? 0.55 : this.difficulty === 'master' ? 0.24 : 0.38;
      e.aiThinkTimer = thinkBase * (0.8 + Math.random() * 0.4);

      if (e.kind === 'boss') {
        const absDx = Math.abs(dx);
        const absDz = Math.abs(dz);
        if (e.aiAttackCooldown <= 0) {
          if (e.bossEnraged && absDx < 220 && absDz < 85 && e.cooldowns.ataque_4 <= 0 && Math.random() < 0.42) {
            e.aiQueuedAttack = 'ataque_4';
            e.aiTelegraphTimer = 0.48;
            e.cooldowns.ataque_4 = 6.5;
            e.aiAttackCooldown = 1.6;
            return;
          }
          if (absDx > 290 && absDz < 60 && e.cooldowns.ataque_3 <= 0 && Math.random() < 0.65) {
            e.aiQueuedAttack = 'ataque_3';
            e.aiTelegraphTimer = 0.36;
            e.cooldowns.ataque_3 = 3.2;
            e.aiAttackCooldown = 1.4;
            return;
          }
          if (absDx >= 130 && absDx <= 320 && absDz < 58 && e.cooldowns.ataque_2 <= 0 && Math.random() < 0.55) {
            e.aiQueuedAttack = 'ataque_2';
            e.aiTelegraphTimer = 0.38;
            e.cooldowns.ataque_2 = 3.0;
            e.aiAttackCooldown = 1.4;
            return;
          }
          if (absDx < 145 && absDz < 48) {
            e.aiQueuedAttack = 'ataque_1';
            e.aiTelegraphTimer = 0.26;
            e.aiAttackCooldown = 1.1;
            return;
          }
        }
        if ((p.state === 'ataque_3' || p.state === 'ataque_4') && absDx < 240 && Math.random() < 0.35) {
          e.state = 'block';
          e.stateTime = 0;
          e.stateDuration = 0.48;
          return;
        }
      } else {
        // Common NPC attack
        if (Math.abs(dx) < 110 && Math.abs(dz) < 42 && e.aiAttackCooldown <= 0) {
          e.aiQueuedAttack = Math.random() < 0.35 ? 'ataque_2' : 'ataque_1';
          e.aiTelegraphTimer = this.difficulty === 'easy' ? 0.42 : 0.28;
          e.aiAttackCooldown = this.difficulty === 'easy' ? 1.8 : this.difficulty === 'master' ? 0.95 : 1.35;
          return;
        }
      }
    }

    // Approach flanking slot
    const desiredDistX = e.kind === 'boss' ? 120 : 88;
    const goalX = p.x + e.aiFlankSide * desiredDistX;
    const goalZ = Math.max(this.stage.walkMinZ, Math.min(this.stage.walkMaxZ, p.z + e.aiFlankZOffset));
    const gx = goalX - e.x;
    const gz = goalZ - e.z;
    const dist = Math.hypot(gx, gz);

    if (dist > 18) {
      const nx = gx / dist;
      const nz = gz / dist;
      const useRun = dist > 260 && (e.enemyPack?.actions.has('run') ?? false);
      const mult = useRun ? 1.45 : 1.0;
      e.x += nx * e.moveSpeed * mult * dt;
      e.z += nz * e.moveSpeed * 0.65 * mult * dt;
      e.state = useRun ? 'run' : 'walk';
    } else {
      e.state = 'idle';
    }
    this.clampActorToPlayableBounds(e);
  }

  private startEnemyAttack(
    e: BeatActor,
    atk: 'ataque_1' | 'ataque_2' | 'ataque_3' | 'ataque_4'
  ): void {
    e.state = atk;
    e.stateTime = 0;
    const baseDur = atk === 'ataque_4' ? 0.95 : atk === 'ataque_2' ? 0.62 : 0.54;
    e.stateDuration = this.computeActionDuration(e, atk, baseDur);
    e.attackHitTargets.clear();
    e.projectileSpawned = false;
    e.vfxSpawned = false;
    e.superArmor = e.kind === 'boss' && (atk === 'ataque_2' || atk === 'ataque_4');
  }

  private stepAirPhysics(a: BeatActor, dt: number): void {
    if (a.airY < 0 || a.vyAir < 0) {
      a.vyAir += GRAVITY * dt;
      a.airY += a.vyAir * dt;
      if (a.airY >= 0) {
        a.airY = 0;
        a.vyAir = 0;
      }
    }
  }

  private clampActorToPlayableBounds(a: BeatActor): void {
    const pad = 42;
    const minX = (this.arenaLocked ? this.lockMinX : 0) + pad;
    const maxX = (this.arenaLocked ? this.lockMaxX : this.stage.worldWidth) - pad;
    a.x = Math.max(minX, Math.min(maxX, a.x));
    a.z = Math.max(this.stage.walkMinZ, Math.min(this.stage.walkMaxZ, a.z));
  }

  private checkWaveTriggers(): void {
    if (!this.player || this.arenaLocked) return;

    for (let i = 0; i < this.stage.waves.length; i++) {
      const wave = this.stage.waves[i];
      if (this.triggeredWaveIds.has(wave.id)) continue;
      if (this.player.x >= wave.triggerX) {
        this.triggeredWaveIds.add(wave.id);
        this.activeWaveIndex = i;
        this.arenaLocked = true;
        this.lockMinX = wave.lockMinX;
        this.lockMaxX = wave.lockMaxX;
        this.bannerText = wave.isBossWave
          ? `CHEFÃO: ${this.stage.bossName.toUpperCase()}!`
          : `ONDA ${i + 1}: ${wave.label.toUpperCase()}`;
        this.bannerTimer = 2.2;
        this.spawnWaveEnemies(wave);
        break;
      }
    }
  }

  private spawnWaveEnemies(wave: BeatEmUpStageConfig['waves'][number]): void {
    const viewW = this.getViewWorldWidth();
    const leftEdge = Math.max(this.lockMinX + 40, this.camLeftWorld - 30);
    const rightEdge = Math.min(this.lockMaxX - 40, this.camLeftWorld + viewW + 30);

    wave.spawns.forEach((sp, idx) => {
      const pack = this.spriteLoader.getCachedBeatEmUpPack(sp.entityId);
      if (!pack) return;
      const m = pack.manifest;
      const spawnX =
        sp.side === 'left'
          ? Math.max(this.lockMinX + 55, leftEdge - sp.offsetX)
          : Math.min(this.lockMaxX - 55, rightEdge + sp.offsetX);
      const diffHp = this.difficulty === 'easy' ? 0.78 : this.difficulty === 'master' ? 1.25 : 1.0;
      const diffDmg = this.difficulty === 'easy' ? 0.72 : this.difficulty === 'master' ? 1.28 : 1.0;
      const maxHp = Math.round(m.maxHp * diffHp);

      this.enemies.push({
        uid: this.nextUid++,
        kind: sp.isBoss ? 'boss' : 'npc',
        entityId: sp.entityId,
        displayName: m.name,
        title: m.title,
        x: spawnX,
        z: Math.max(this.stage.walkMinZ, Math.min(this.stage.walkMaxZ, sp.z)),
        airY: 0,
        vx: 0,
        vz: 0,
        vyAir: 0,
        facing: sp.side === 'right' ? -1 : 1,
        hp: maxHp,
        maxHp,
        ki: 100,
        maxKi: 100,
        evoEnergy: 0,
        phase: 1,
        state: 'walk',
        stateTime: 0,
        stateDuration: 0.5,
        invulnTime: 0.25,
        hitstunTime: 0,
        attackHitTargets: new Set(),
        projectileSpawned: false,
        vfxSpawned: false,
        comboCount: 0,
        comboTimer: 0,
        comboBufferNext: false,
        comboChainQueued: null,
        cooldowns: { ataque_1: 0, ataque_2: 0, ataque_3: 0, ataque_4: 0 },
        dashCooldown: 0,
        targetBodyHeight: sp.isBoss ? 306 : 262,
        auraColor: m.auraColor,
        scoreValue: m.scoreValue,
        damageScale: m.damageScale * diffDmg,
        moveSpeed: m.speed,
        superArmor: false,
        grabbedTargetUid: null,
        grabbedByUid: null,
        thrownActive: false,
        aiThinkTimer: 0.15 + idx * 0.12,
        aiAttackCooldown: 0.6 + idx * 0.2,
        aiTelegraphTimer: 0,
        aiQueuedAttack: null,
        aiFlankSide: idx % 2 === 0 ? 1 : -1,
        aiFlankZOffset: ((idx % 3) - 1) * 26,
        koTimer: 0,
        deadDone: false,
        bossEnraged: false,
        enemyPack: pack,
      });
    });
  }

  private resolvePlayerPickups(): void {
    const p = this.player;
    if (!p || p.hp <= 0 || p.airY < -35) return;
    for (const item of this.pickups) {
      if (item.collected) continue;
      if (Math.abs(p.x - item.x) < 58 && Math.abs(p.z - item.z) < 42) {
        item.collected = true;
        p.hp = Math.min(p.maxHp, p.hp + item.heal);
        p.ki = Math.min(p.maxKi, p.ki + item.kiBoost);
        p.state = 'pickup';
        p.stateTime = 0;
        p.stateDuration = 0.28;
        this.audio.playSfx('evolve');
        this.spawnText(item.x, item.z - 140, `+${item.heal} HP (${item.label})`, '#4ade80', 1.15);
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      proj.x += proj.vx * dt;
      proj.elapsed += dt;
      proj.life -= dt;
      if (proj.life <= 0 || proj.x < -120 || proj.x > this.stage.worldWidth + 120) {
        proj.active = false;
        continue;
      }

      const targets =
        proj.ownerKind === 'player' ? this.enemies : this.player ? [this.player] : [];
      for (const def of targets) {
        if (def.hp <= 0 || def.invulnTime > 0) continue;
        if (Math.abs(def.z - proj.z) > 64) continue;
        if (Math.abs(def.x - proj.x) < 58) {
          proj.active = false;
          const owner = proj.ownerKind === 'player' ? this.player : this.enemies.find((e) => e.uid === proj.ownerUid);
          if (owner) {
            this.damageActor(
              owner,
              def,
              proj.damage,
              proj.facing * proj.knockbackX,
              proj.knockdown ? -260 : -40,
              proj.knockdown,
              0.38
            );
          }
          break;
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.active);
  }

  private updateEffects(dt: number): void {
    for (const v of this.vfxs) {
      if (!v.active) continue;
      v.elapsed += dt;
      if (v.elapsed >= v.duration) v.active = false;
    }
    this.vfxs = this.vfxs.filter((v) => v.active);

    for (const tx of this.floatingTexts) {
      if (!tx.active) continue;
      tx.y += tx.vy * dt;
      tx.life -= dt;
      if (tx.life <= 0) tx.active = false;
    }
    this.floatingTexts = this.floatingTexts.filter((tx) => tx.active);

    for (const pk of this.pickups) {
      pk.bobPhase += dt * 4.2;
    }
  }

  private cleanupDefeatedEnemies(): void {
    this.enemies = this.enemies.filter((e) => !e.deadDone);
  }

  private checkWaveClear(): void {
    if (!this.arenaLocked || this.activeWaveIndex < 0) return;
    const wave = this.stage.waves[this.activeWaveIndex];
    if (!wave || this.clearedWaveIds.has(wave.id)) return;
    if (this.enemies.some((e) => e.hp > 0)) return;

    this.clearedWaveIds.add(wave.id);
    if (!wave.isBossWave) {
      this.arenaLocked = false;
      this.lockMinX = 0;
      this.lockMaxX = this.stage.worldWidth;
      this.goPromptTimer = 3.2;
      if (wave.dropPickupAfterClear) {
        const d = wave.dropPickupAfterClear;
        this.pickups.push({
          uid: this.nextUid++,
          kind: d.kind,
          label: d.label,
          x: d.x,
          z: d.z,
          heal: d.heal,
          kiBoost: d.kiBoost,
          collected: false,
          bobPhase: 0,
        });
      }
    }
  }

  private checkStageOutcome(): void {
    if (this.pendingResultWon !== null || !this.player) return;

    if (this.player.hp <= 0) {
      this.pendingResultWon = false;
      this.endDelayTimer = 1.65;
      this.bannerText = 'DERROTA NAS RUAS...';
      this.bannerTimer = 2.0;
      return;
    }

    const bossWave = this.stage.waves[this.stage.waves.length - 1];
    if (
      this.triggeredWaveIds.has(bossWave.id) &&
      this.enemies.every((e) => e.hp <= 0)
    ) {
      this.pendingResultWon = true;
      this.endDelayTimer = 1.9;
      this.player.state = 'victory';
      this.player.stateTime = 0;
      this.bannerText = 'FASE CONCLUÍDA!';
      this.bannerTimer = 2.4;
      this.audio.playSfx('ko');
    }
  }

  private finalizeStage(won: boolean): void {
    if (this.ended || !this.player || !this.config) return;
    this.ended = true;
    this.active = false;
    this.audio.stopBgm();
    this.hudEl.classList.add('hidden');
    this.hudEl.setAttribute('aria-hidden', 'true');
    this.virtualControls.setVisible(false);
    this.input.resetAll();

    const hpPct = Math.round((this.player.hp / this.player.maxHp) * 100);
    const xpEarned = won
      ? 140 + Math.round(this.score * 0.03)
      : Math.max(35, 25 + this.enemiesDefeated * 12);

    this.onStageEnded?.({
      won,
      stageId: this.stage.id,
      stageName: this.stage.name,
      charId: this.player.entityId,
      finalPhase: this.player.phase,
      score: this.score,
      enemiesDefeated: this.enemiesDefeated,
      maxCombo: this.maxCombo,
      elapsedSeconds: Math.round(this.elapsedSeconds),
      hpRemainingPct: hpPct,
      xpEarned,
    });
  }

  private updateCamera(dt: number): void {
    if (!this.player) return;
    const viewW = this.getViewWorldWidth();
    const minLeft = this.arenaLocked ? this.lockMinX : 0;
    const maxLeft = Math.max(minLeft, (this.arenaLocked ? this.lockMaxX : this.stage.worldWidth) - viewW);
    const targetLeft = Math.max(minLeft, Math.min(maxLeft, this.player.x - viewW * 0.38));
    this.camLeftWorld += (targetLeft - this.camLeftWorld) * Math.min(1, dt * 7.5);
  }

  private spawnVfx(
    actor: BeatActor,
    vfxKey: CanonicalVfx,
    x: number,
    z: number,
    yOffset: number,
    scale: number
  ): void {
    const frames = this.getVfxFrames(actor, vfxKey);
    if (frames.length === 0) return;
    this.vfxs.push({
      active: true,
      x,
      z,
      yOffset,
      facing: actor.facing,
      frames,
      elapsed: 0,
      duration: frames.length >= 20 ? 0.55 : 0.36,
      scale,
    });
  }

  private spawnText(x: number, y: number, text: string, color: string, scale = 1): void {
    this.floatingTexts.push({
      active: true,
      x,
      y,
      vy: -65,
      text,
      color,
      life: 0.72,
      maxLife: 0.72,
      scale,
    });
  }

  public render(fps: number): void {
    if (!this.active) return;

    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const scale = this.getViewScale();

    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeTime > 0) {
      shakeX = (Math.random() * 2 - 1) * this.shakeIntensity;
      shakeY = (Math.random() * 2 - 1) * this.shakeIntensity;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);
    renderBeatEmUpBackground(ctx, cw, ch, this.camLeftWorld, scale, this.stage);

    // Draw pickups
    for (const pk of this.pickups) {
      if (pk.collected) continue;
      this.renderPickup(ctx, pk, scale);
    }

    // Y-Sort all actors by ground z ascending
    const actors: BeatActor[] = [];
    if (this.player) actors.push(this.player);
    for (const e of this.enemies) actors.push(e);
    actors.sort((a, b) => a.z - b.z);

    for (const actor of actors) {
      this.renderActor(ctx, actor, scale);
    }

    // VFX & Projectiles
    for (const proj of this.projectiles) {
      this.renderProjectile(ctx, proj, scale);
    }
    for (const v of this.vfxs) {
      this.renderVfx(ctx, v, scale);
    }

    // Floating Damage / Status Texts
    for (const tx of this.floatingTexts) {
      const sx = (tx.x - this.camLeftWorld) * scale;
      const sy = tx.y * scale;
      const alpha = Math.max(0, Math.min(1, tx.life / tx.maxLife));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${Math.round(22 * scale * tx.scale)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(tx.text, sx, sy);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.text, sx, sy);
      ctx.restore();
    }

    // Stage Banner
    if (this.bannerTimer > 0 && this.bannerText) {
      ctx.save();
      const alpha = Math.min(1, this.bannerTimer * 1.5);
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${Math.round(34 * scale)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.strokeText(this.bannerText, cw * 0.5, ch * 0.32);
      ctx.fillStyle = '#facc15';
      ctx.fillText(this.bannerText, cw * 0.5, ch * 0.32);
      ctx.restore();
    }

    // GO! -> Arrow
    if (this.goPromptTimer > 0 && !this.arenaLocked) {
      const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.012);
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.font = `900 ${Math.round(42 * scale)}px system-ui, sans-serif`;
      ctx.textAlign = 'right';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.strokeText('GO! →', cw - 40, ch * 0.44);
      ctx.fillStyle = '#facc15';
      ctx.fillText('GO! →', cw - 40, ch * 0.44);
      ctx.restore();
    }

    if (this.flashAlpha > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${this.flashAlpha.toFixed(2)})`;
      ctx.fillRect(0, 0, cw, ch);
    }

    if (this.debugOverlay) {
      this.renderDebugOverlay(ctx, actors, scale);
    }

    ctx.restore();
    this.updateHudDom(fps);
  }

  private renderPickup(ctx: CanvasRenderingContext2D, pk: BeatPickup, scale: number): void {
    const sx = (pk.x - this.camLeftWorld) * scale;
    const sy = (pk.z + Math.sin(pk.bobPhase) * 6) * scale;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(sx, pk.z * scale, 22 * scale, 8 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = pk.kind === 'acai' ? '#9333ea' : pk.kind === 'coco' ? '#22c55e' : '#f59e0b';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    ctx.arc(sx, sy - 20 * scale, 18 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.round(12 * scale)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('+HP', sx, sy - 16 * scale);
    ctx.restore();
  }

  private selectActorFrame(actor: BeatActor): LoadedFrame | null {
    const action = actor.state as CanonicalAction;
    const frames = this.getActionFrames(actor, action);
    if (frames.length === 0) return null;

    const looping =
      actor.state === 'idle' ||
      actor.state === 'walk' ||
      actor.state === 'run' ||
      actor.state === 'block';
    const fps =
      actor.state === 'idle'
        ? 9
        : actor.state === 'walk'
          ? 11
          : actor.state === 'run'
            ? 14
            : 12;

    if (looping) {
      const idx = Math.floor(actor.stateTime * fps) % frames.length;
      return frames[idx];
    }

    const dur = Math.max(0.18, actor.stateDuration || 0.45);
    const prog = Math.max(0, Math.min(0.999, actor.stateTime / dur));
    const idx = Math.min(frames.length - 1, Math.floor(prog * frames.length));
    return frames[idx];
  }

  private renderActor(ctx: CanvasRenderingContext2D, actor: BeatActor, scale: number): void {
    // Classic SNES blink on KO before despawn
    if (actor.state === 'ko_defeat' && actor.koTimer > 0.65 && Math.floor(actor.koTimer * 18) % 2 === 0) {
      return;
    }

    const frame = this.selectActorFrame(actor);
    if (!frame) return;

    const sx = (actor.x - this.camLeftWorld) * scale;
    const groundSy = actor.z * scale;
    const drawSy = (actor.z + actor.airY) * scale;

    // Ground contact shadow
    const airRatio = Math.max(0.35, 1 + actor.airY / 360);
    ctx.save();
    ctx.fillStyle = 'rgba(4, 8, 18, 0.42)';
    ctx.beginPath();
    ctx.ellipse(sx, groundSy, 48 * scale * airRatio, 14 * scale * airRatio, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Telegraph warning ring for enemy/boss attacks
    if (actor.aiTelegraphTimer > 0) {
      ctx.save();
      ctx.strokeStyle = actor.aiQueuedAttack === 'ataque_4' ? '#ef4444' : '#facc15';
      ctx.lineWidth = 4 * scale;
      ctx.beginPath();
      ctx.ellipse(sx, groundSy, 68 * scale, 22 * scale, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const refBodyH = actor.heroPack?.manifest.refBodyHeight ?? actor.enemyPack?.manifest.refBodyHeight ?? 360;
    const actorScale = (actor.targetBodyHeight / Math.max(80, refBodyH)) * scale;

    ctx.save();
    if (actor.invulnTime > 0 && Math.floor(actor.invulnTime * 20) % 2 === 0) {
      ctx.globalAlpha = 0.55;
    }
    ctx.translate(sx, drawSy);
    ctx.scale(actor.facing, 1);

    const dx = -frame.meta.anchorX * actorScale;
    const dy = -frame.meta.anchorY * actorScale;
    const dw = frame.meta.w * actorScale;
    const dh = frame.meta.h * actorScale;

    ctx.drawImage(frame.image, dx, dy, dw, dh);
    ctx.restore();

    // Overhead mini HP bar for NPCs
    if (actor.kind === 'npc' && actor.hp > 0 && actor.hp < actor.maxHp) {
      const barW = 76 * scale;
      const barH = 7 * scale;
      const bx = sx - barW * 0.5;
      const by = drawSy - (actor.targetBodyHeight + 24) * scale;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(bx, by, barW * (actor.hp / actor.maxHp), barH);
    }
  }

  private renderProjectile(ctx: CanvasRenderingContext2D, proj: BeatProjectile, scale: number): void {
    const sx = (proj.x - this.camLeftWorld) * scale;
    const sy = (proj.z + proj.yOffset) * scale;
    ctx.save();
    if (proj.frames.length > 0) {
      const idx = Math.floor(proj.elapsed * 16) % proj.frames.length;
      const fr = proj.frames[idx];
      const sc = 0.55 * scale;
      ctx.translate(sx, sy);
      ctx.scale(proj.facing, 1);
      ctx.drawImage(fr.image, -fr.meta.anchorX * sc, -fr.meta.anchorY * sc, fr.meta.w * sc, fr.meta.h * sc);
    } else {
      ctx.fillStyle = proj.auraColor;
      ctx.beginPath();
      ctx.arc(sx, sy, 24 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderVfx(ctx: CanvasRenderingContext2D, v: BeatVfx, scale: number): void {
    if (v.frames.length === 0) return;
    const prog = Math.max(0, Math.min(0.999, v.elapsed / Math.max(0.01, v.duration)));
    const fr = v.frames[Math.floor(prog * v.frames.length)];
    const sx = (v.x - this.camLeftWorld) * scale;
    const sy = (v.z + v.yOffset) * scale;
    const sc = v.scale * scale;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(v.facing, 1);
    ctx.drawImage(fr.image, -fr.meta.anchorX * sc, -fr.meta.anchorY * sc, fr.meta.w * sc, fr.meta.h * sc);
    ctx.restore();
  }

  private renderDebugOverlay(ctx: CanvasRenderingContext2D, actors: BeatActor[], scale: number): void {
    // Walkable Z bounds
    const minY = this.stage.walkMinZ * scale;
    const maxY = this.stage.walkMaxZ * scale;
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(0, minY);
    ctx.lineTo(this.canvas.width, minY);
    ctx.moveTo(0, maxY);
    ctx.lineTo(this.canvas.width, maxY);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const a of actors) {
      const sx = (a.x - this.camLeftWorld) * scale;
      const sy = (a.z + a.airY) * scale;
      const hw = (a.kind === 'boss' ? 62 : 48) * scale;
      const hh = a.targetBodyHeight * 0.85 * scale;

      // Hurtbox (green)
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - hw, sy - hh, hw * 2, hh);

      // Anchor crosshair (cyan)
      ctx.strokeStyle = '#22d3ee';
      ctx.beginPath();
      ctx.moveTo(sx - 10, a.z * scale);
      ctx.lineTo(sx + 10, a.z * scale);
      ctx.moveTo(sx, a.z * scale - 10);
      ctx.lineTo(sx, a.z * scale + 10);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`${a.entityId} [${a.state}] z=${Math.round(a.z)}`, sx - hw, sy - hh - 6);
    }
    ctx.restore();
  }

  private updateVirtualControls(): void {
    const p = this.player;
    if (!p) return;
    const moves = p.heroPack?.manifest.moves ?? {};
    this.virtualControls.updateVisualState(
      {
        a1: p.cooldowns.ataque_1 / 0.25,
        a2: p.cooldowns.ataque_2 / ATTACK_SPECS.ataque_2.cooldown,
        a3: p.cooldowns.ataque_3 / ATTACK_SPECS.ataque_3.cooldown,
        a4: p.cooldowns.ataque_4 / ATTACK_SPECS.ataque_4.cooldown,
      },
      {
        a1: true,
        a2: p.ki >= ATTACK_SPECS.ataque_2.kiCost,
        a3: p.ki >= ATTACK_SPECS.ataque_3.kiCost,
        a4: p.ki >= ATTACK_SPECS.ataque_4.kiCost,
      },
      p.phase < 4 && p.evoEnergy >= 100,
      {
        a1: moves.ataque_1 ?? 'Golpe 1',
        a2: moves.ataque_2 ?? 'Golpe 2',
        a3: moves.ataque_3 ?? 'Golpe 3',
        a4: moves.ataque_4 ?? 'Ultimate',
      },
      0,
      p.dashCooldown / 0.45,
      p.state === 'ataque_1' || p.state === 'ataque_2'
    );
  }

  private buildHud(): void {
    const p = this.player;
    if (!p) return;
    this.hudEl.innerHTML = `
      <div class="ak-hud-top">
        <div class="ak-fighter-hud">
          <div class="ak-name-row">
            <span class="ak-fighter-name">${escapeHtml(p.displayName)}</span>
            <span class="ak-fase-badge" id="beu-phase">F${p.phase}</span>
          </div>
          <div class="ak-hp-track">
            <div class="ak-hp-trail" id="beu-hp-trail" style="width:100%"></div>
            <div class="ak-hp-fill" id="beu-hp-fill" style="width:100%"></div>
          </div>
          <div class="ak-subbars">
            <div class="ak-mini-track" title="Ki"><div class="ak-ki-fill" id="beu-ki" style="width:60%"></div></div>
            <div class="ak-mini-track" title="Evolução"><div class="ak-evo-fill" id="beu-evo" style="width:0%"></div></div>
            <span class="ak-fase-badge hidden" id="beu-evo-ready" style="border-color:#c084fc;background:rgba(168,85,247,0.35);color:#fef08a;">EVO! [E]</span>
          </div>
        </div>

        <div class="ak-hud-center">
          <div class="ak-timer-box" id="beu-score" style="font-size:1.1rem;min-width:96px;">0 PTS</div>
          <div class="ak-map-tag" id="beu-wave-label">${escapeHtml(this.stage.name)}</div>
          <button type="button" class="ak-pause-btn" id="hud-pause-btn">PAUSA</button>
        </div>

        <div class="ak-fighter-hud p2 hidden" id="beu-boss-wrap">
          <div class="ak-name-row">
            <span class="ak-fase-badge" id="beu-boss-title">CHEFÃO</span>
            <span class="ak-fighter-name" id="beu-boss-name">${escapeHtml(this.stage.bossName)}</span>
          </div>
          <div class="ak-hp-track">
            <div class="ak-hp-fill p2-fill" id="beu-boss-hp" style="width:100%"></div>
          </div>
        </div>
      </div>

      <div class="ak-combo-banner hidden" id="beu-combo">2 HITS!</div>
      <div class="ak-fps-tag" id="beu-fps">60 FPS</div>
    `;

    const q = (sel: string) => this.hudEl.querySelector<HTMLElement>(sel) ?? undefined;
    this.hudRefs = {
      hpFill: q('#beu-hp-fill'),
      hpTrail: q('#beu-hp-trail'),
      kiFill: q('#beu-ki'),
      evoFill: q('#beu-evo'),
      evoReady: q('#beu-evo-ready'),
      phaseBadge: q('#beu-phase'),
      score: q('#beu-score'),
      combo: q('#beu-combo'),
      waveLabel: q('#beu-wave-label'),
      bossWrap: q('#beu-boss-wrap'),
      bossName: q('#beu-boss-name'),
      bossTitle: q('#beu-boss-title'),
      bossHpFill: q('#beu-boss-hp'),
      fps: q('#beu-fps'),
    };

    this.hudEl.querySelector('#hud-pause-btn')?.addEventListener('click', () => {
      this.audio.playSfx('ui');
      this.onPauseRequested?.();
    });
  }

  private updateHudDom(fps: number): void {
    const p = this.player;
    if (!p) return;

    const hpPct = `${Math.max(0, (p.hp / p.maxHp) * 100).toFixed(1)}%`;
    if (this.hudRefs.hpFill) this.hudRefs.hpFill.style.width = hpPct;
    if (this.hudRefs.hpTrail) this.hudRefs.hpTrail.style.width = hpPct;
    if (this.hudRefs.kiFill) this.hudRefs.kiFill.style.width = `${(p.ki / p.maxKi) * 100}%`;
    if (this.hudRefs.evoFill) {
      this.hudRefs.evoFill.style.width = `${p.phase >= 4 ? 100 : p.evoEnergy}%`;
    }
    if (this.hudRefs.evoReady) {
      this.hudRefs.evoReady.classList.toggle('hidden', !(p.phase < 4 && p.evoEnergy >= 100));
    }
    if (this.hudRefs.phaseBadge) {
      this.hudRefs.phaseBadge.textContent = `F${p.phase}`;
    }
    if (this.hudRefs.score) {
      this.hudRefs.score.textContent = `${this.score} PTS`;
    }
    if (this.hudRefs.combo) {
      const showCombo = p.comboTimer > 0 && p.comboCount >= 2;
      this.hudRefs.combo.classList.toggle('hidden', !showCombo);
      if (showCombo) this.hudRefs.combo.textContent = `${p.comboCount} HITS!`;
    }
    if (this.hudRefs.waveLabel) {
      const w = this.activeWaveIndex >= 0 ? this.stage.waves[this.activeWaveIndex] : null;
      this.hudRefs.waveLabel.textContent = this.arenaLocked && w ? w.label : `${this.stage.name} · Avance`;
    }

    const boss = this.enemies.find((e) => e.kind === 'boss');
    if (this.hudRefs.bossWrap) {
      this.hudRefs.bossWrap.classList.toggle('hidden', !boss);
      if (boss && this.hudRefs.bossHpFill) {
        this.hudRefs.bossHpFill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100).toFixed(1)}%`;
        if (this.hudRefs.bossName) this.hudRefs.bossName.textContent = boss.displayName;
        if (this.hudRefs.bossTitle && boss.title) this.hudRefs.bossTitle.textContent = boss.title;
      }
    }

    if (this.hudRefs.fps) {
      this.hudRefs.fps.textContent = `${fps} FPS`;
    }
  }
}
