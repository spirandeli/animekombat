import { FighterInputState } from '../engine/InputManager';
import {
  CanonicalAction,
  CanonicalVfx,
  LoadedFrame,
  LoadedPhasePack,
  SpriteLoader,
} from '../engine/SpriteLoader';
import type { CombatPace } from '../storage/SaveManager';
import type { ArenaPlatform } from './ArenaMap';

export type FighterSlotId = 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6';
export type FighterTeam = 1 | 2;

export function teamForSlot(slot: FighterSlotId): FighterTeam {
  return slot === 'p1' || slot === 'p3' || slot === 'p5' ? 1 : 2;
}

export type FighterState =
  | 'idle'
  | 'run'
  | 'dash'
  | 'jump'
  | 'land'
  | 'crouch'
  | 'block'
  | 'ki_charge'
  | 'hitstun'
  | 'knockdown'
  | 'getup'
  | 'ataque_1'
  | 'ataque_2'
  | 'ataque_3'
  | 'ataque_4'
  | 'evolve'
  | 'victory';

export interface AttackSpec {
  action: 'ataque_1' | 'ataque_2' | 'ataque_3' | 'ataque_4';
  vfx: CanonicalVfx;
  duration: number; // segundos
  activeStart: number; // 0..1 do progresso
  activeEnd: number;
  damage: number;
  kiCost: number;
  kiGainOnHit: number;
  cooldown: number;
  knockbackX: number;
  knockbackY: number;
  hitstun: number;
  hitStop: number;
  lungeX: number;
  isProjectile: boolean;
  projectileSpeed: number;
  rangeW: number;
  rangeH: number;
  offsetY: number;
}

export const ATTACK_SPECS: Record<
  'ataque_1' | 'ataque_2' | 'ataque_3' | 'ataque_4',
  AttackSpec
> = {
  ataque_1: {
    action: 'ataque_1',
    vfx: 'vfx_ataque_1',
    duration: 0.5,
    activeStart: 0.25,
    activeEnd: 0.58,
    damage: 58,
    kiCost: 0,
    kiGainOnHit: 10,
    cooldown: 0.9,
    knockbackX: 165,
    knockbackY: -60,
    hitstun: 0.26,
    hitStop: 0.016,
    lungeX: 0,
    isProjectile: false,
    projectileSpeed: 0,
    rangeW: 126,
    rangeH: 92,
    offsetY: -95,
  },
  ataque_2: {
    action: 'ataque_2',
    vfx: 'vfx_ataque_2',
    duration: 0.68,
    activeStart: 0.27,
    activeEnd: 0.67,
    damage: 98,
    kiCost: 12,
    kiGainOnHit: 12,
    cooldown: 1.5,
    knockbackX: 300,
    knockbackY: -190,
    hitstun: 0.38,
    hitStop: 0.035,
    lungeX: 135,
    isProjectile: false,
    projectileSpeed: 0,
    rangeW: 132,
    rangeH: 102,
    offsetY: -96,
  },
  ataque_3: {
    action: 'ataque_3',
    vfx: 'vfx_ataque_3',
    duration: 0.74,
    activeStart: 0.35,
    activeEnd: 0.65,
    damage: 115,
    kiCost: 25,
    kiGainOnHit: 10,
    cooldown: 2.1,
    knockbackX: 250,
    knockbackY: -140,
    hitstun: 0.34,
    hitStop: 0.03,
    lungeX: 0,
    isProjectile: true,
    projectileSpeed: 440,
    rangeW: 110,
    rangeH: 90,
    offsetY: -98,
  },
  ataque_4: {
    action: 'ataque_4',
    vfx: 'vfx_ataque_4',
    duration: 1.08,
    activeStart: 0.35,
    activeEnd: 0.75,
    damage: 245,
    kiCost: 65,
    kiGainOnHit: 0,
    cooldown: 4.2,
    knockbackX: 470,
    knockbackY: -305,
    hitstun: 0.56,
    hitStop: 0.07,
    lungeX: 85,
    isProjectile: false,
    projectileSpeed: 0,
    rangeW: 215,
    rangeH: 170,
    offsetY: -108,
  },
};

interface AfterimageSnapshot {
  frame: LoadedFrame;
  x: number;
  y: number;
  facing: 1 | -1;
  age: number;
  maxAge: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FighterCallbacks {
  onSpawnAttackVfx: (
    fighter: Fighter,
    spec: AttackSpec,
    x: number,
    y: number,
    followOwner?: boolean
  ) => void;
  onSpawnProjectile: (fighter: Fighter, spec: AttackSpec) => void;
  onEvolved: (fighter: Fighter, newPhase: number) => void;
  onPlaySfx: (name: 'jump' | 'atk1' | 'atk2' | 'atk3' | 'atk4' | 'evolve') => void;
  onLand?: (fighter: Fighter) => void;
  onJumpDust?: (fighter: Fighter) => void;
}

export function phaseForLevel(level: number): number {
  if (level >= 16) return 4;
  if (level >= 11) return 3;
  if (level >= 6) return 2;
  return 1;
}

export class Fighter {
  public readonly slot: FighterSlotId;
  public readonly team: FighterTeam;
  public readonly charId: string;
  public readonly displayName: string;

  public x: number;
  public y: number;
  public vx = 0;
  public vy = 0;
  public facing: 1 | -1;
  public attackDirX = 1;
  public attackDirY = 0;
  public grounded = true;

  public arenaLeft = 70;
  public arenaRight = 1210;
  public groundY = 540;
  public currentPlatformId: string | null = null;
  public dropThroughTimer = 0;

  public maxHp = 1000;
  public hp = 1000;
  public maxKi = 100;
  public ki = 45;
  public evoEnergy = 0; // 0..100 para evoluir em combate
  public level: number;
  public phase: number;
  public xpEarnedInMatch = 0;

  public state: FighterState = 'idle';
  public stateTime = 0;
  public hitstunRemaining = 0;
  public invulnTime = 0;
  public blockImpactTimer = 0;
  public attackHitDone = false;
  public hitTargetsInCurrentAttack = new Set<FighterSlotId>();
  public projectileSpawned = false;
  public vfxSpawned = false;
  public landingTimer = 0;
  public dashCooldown = 0;
  private dashDir: 1 | -1 = 1;
  private knockdownBounceDone = false;
  private knockdownGroundTimer = 0;
  public comboHitsReceived = 0;
  public comboResetTimer = 0;
  public auraFlashTime = 0;

  public cooldowns: Record<'ataque_1' | 'ataque_2' | 'ataque_3' | 'ataque_4', number> = {
    ataque_1: 0,
    ataque_2: 0,
    ataque_3: 0,
    ataque_4: 0,
  };
  public globalAttackCooldown = 0;
  public globalAttackMax = 1.0;
  public combatPace: CombatPace = 'tactical';
  public nearestEnemyDist = Infinity;
  public nearestAnyDist = Infinity;

  public phasePack: LoadedPhasePack;
  private readonly spriteLoader: SpriteLoader;
  private callbacks?: FighterCallbacks;
  private evolvingPending = false;
  private afterimages: AfterimageSnapshot[] = [];
  private afterimageTimer = 0;
  private hasMoveInputInAttack = false;
  private bufferedAction: {
    type: 'jump' | 'dash' | 'ataque_1' | 'ataque_2' | 'ataque_3' | 'ataque_4';
    ttl: number;
  } | null = null;

  // Constantes de física e escala
  public static readonly GROUND_Y = 540;
  public static readonly ARENA_LEFT = 70;
  public static readonly ARENA_RIGHT = 1210;
  public static readonly TARGET_BODY_HEIGHT = 186;
  private static readonly GRAVITY = 1580;
  private static readonly JUMP_VEL = -665;
  private static readonly BASE_SPEED = 255;
  private static readonly actionMedianHeightCache = new WeakMap<
    LoadedPhasePack,
    Map<CanonicalAction, number>
  >();

  constructor(
    slot: FighterSlotId,
    charId: string,
    displayName: string,
    startX: number,
    facing: 1 | -1,
    initialPhase: number,
    level: number,
    phasePack: LoadedPhasePack,
    spriteLoader: SpriteLoader,
    team?: FighterTeam,
    startY?: number
  ) {
    this.slot = slot;
    this.team = team ?? teamForSlot(slot);
    this.charId = charId;
    this.displayName = displayName;
    this.x = startX;
    this.y = startY ?? Fighter.GROUND_Y;
    this.facing = facing;
    this.phase = initialPhase;
    this.level = level;
    this.phasePack = phasePack;
    this.spriteLoader = spriteLoader;
  }

  public setCallbacks(cb: FighterCallbacks): void {
    this.callbacks = cb;
  }

  public setCombatPace(pace: CombatPace): void {
    this.combatPace = pace;
  }

  public getPushRadius(): number {
    return 52;
  }

  public getGlobalCooldownRatio(): number {
    return 0;
  }

  public resetForNewRound(spawnX: number, spawnY: number, facing: 1 | -1): void {
    this.x = spawnX;
    this.y = spawnY;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.attackDirX = facing;
    this.attackDirY = 0;
    this.grounded = true;
    this.currentPlatformId = null;
    this.dropThroughTimer = 0;

    this.hp = this.maxHp;
    this.ki = 45;
    this.evoEnergy = 0;

    this.state = 'idle';
    this.stateTime = 0;
    this.hitstunRemaining = 0;
    this.invulnTime = 0.6;
    this.blockImpactTimer = 0;
    this.attackHitDone = false;
    this.hitTargetsInCurrentAttack.clear();
    this.projectileSpawned = false;
    this.vfxSpawned = false;
    this.landingTimer = 0;
    this.dashCooldown = 0;
    this.knockdownBounceDone = false;
    this.knockdownGroundTimer = 0;
    this.comboHitsReceived = 0;
    this.comboResetTimer = 0;
    this.auraFlashTime = 0;
    this.evolvingPending = false;
    this.globalAttackCooldown = 0;
    this.globalAttackMax = 1.0;
    this.nearestEnemyDist = Infinity;
    this.nearestAnyDist = Infinity;
    this.hasMoveInputInAttack = false;
    this.afterimages = [];
    this.afterimageTimer = 0;
    this.cooldowns.ataque_1 = 0;
    this.cooldowns.ataque_2 = 0;
    this.cooldowns.ataque_3 = 0;
    this.cooldowns.ataque_4 = 0;
  }

  public getPhaseDamageMultiplier(): number {
    return 1 + (this.phase - 1) * 0.16;
  }

  public getPhaseSpeedMultiplier(): number {
    return 1 + (this.phase - 1) * 0.08;
  }

  public getAttackSpec(
    action: 'ataque_1' | 'ataque_2' | 'ataque_3' | 'ataque_4'
  ): AttackSpec {
    const base = ATTACK_SPECS[action];
    if (this.charId === 'luffy') {
      if (action === 'ataque_1') return { ...base, rangeW: 195, lungeX: 0 };
      if (action === 'ataque_2') return { ...base, rangeW: 215, lungeX: 145 };
      if (action === 'ataque_3' && this.phase <= 3) {
        return { ...base, rangeW: 240, projectileSpeed: 630 };
      }
    } else if (this.charId === 'sukuna') {
      if (action === 'ataque_1') return { ...base, rangeW: 135 };
      if (action === 'ataque_2') return { ...base, rangeW: 155 };
      if (action === 'ataque_4') return { ...base, rangeW: 250, rangeH: 155 };
    } else if (this.charId === 'goku') {
      if (action === 'ataque_1') return { ...base, rangeW: 130 };
      if (action === 'ataque_2') return { ...base, rangeW: 150 };
      if (action === 'ataque_4') return { ...base, rangeW: 240, rangeH: 150 };
    } else if (this.charId === 'naruto') {
      if (action === 'ataque_1') return { ...base, rangeW: 132 };
      if (action === 'ataque_2') return { ...base, rangeW: 155 };
      if (action === 'ataque_4') return { ...base, rangeW: 240, rangeH: 150 };
    } else if (this.charId === 'inuyasha') {
      if (action === 'ataque_1') return { ...base, rangeW: 142 };
      if (action === 'ataque_2') return { ...base, rangeW: 165 };
      if (action === 'ataque_4') return { ...base, rangeW: 245, rangeH: 155 };
    } else if (this.charId === 'seiya') {
      if (action === 'ataque_1') return { ...base, rangeW: 136 };
      if (action === 'ataque_2') return { ...base, rangeW: 158 };
      if (action === 'ataque_4') return { ...base, rangeW: 240, rangeH: 155 };
    } else if (this.charId === 'zoro') {
      if (action === 'ataque_1') return { ...base, rangeW: 146 };
      if (action === 'ataque_2') return { ...base, rangeW: 168 };
      if (action === 'ataque_4') return { ...base, rangeW: 250, rangeH: 160 };
    } else if (this.charId === 'sasuke') {
      if (action === 'ataque_1') return { ...base, rangeW: 136 };
      if (action === 'ataque_2') return { ...base, rangeW: 162 };
      if (action === 'ataque_4') return { ...base, rangeW: 245, rangeH: 155 };
    } else if (this.charId === 'chopper') {
      const monsterBonus = this.phase >= 4 ? 32 : 0;
      if (action === 'ataque_1') return { ...base, rangeW: 128 + monsterBonus };
      if (action === 'ataque_2') return { ...base, rangeW: 150 + monsterBonus };
      if (action === 'ataque_4') {
        return { ...base, rangeW: 235 + monsterBonus, rangeH: 155 + monsterBonus };
      }
    }
    return base;
  }

  public getMoveNames(): Record<'a1' | 'a2' | 'a3' | 'a4', string> {
    const m = this.phasePack.manifest.moves;
    return {
      a1: m.ataque_1 ?? 'Golpe 1',
      a2: m.ataque_2 ?? 'Golpe 2',
      a3: m.ataque_3 ?? 'Golpe 3',
      a4: m.ataque_4 ?? 'Ultimate',
    };
  }

  public canEvolveNow(): boolean {
    return (
      this.hp > 0 &&
      this.phase < 4 &&
      this.evoEnergy >= 100 &&
      !this.evolvingPending &&
      this.state !== 'hitstun' &&
      this.state !== 'knockdown' &&
      this.state !== 'getup' &&
      this.state !== 'evolve'
    );
  }

  public canChainCombo(): boolean {
    if (this.state !== 'ataque_1' && this.state !== 'ataque_2') return false;
    if (!this.attackHitDone) return false;
    const spec = this.getAttackSpec(this.state);
    return this.stateTime / spec.duration >= 0.42;
  }

  public enterVictory(): void {
    if (this.hp <= 0 || this.state === 'victory') return;
    this.state = 'victory';
    this.stateTime = 0;
    this.vx = 0;
    this.bufferedAction = null;
  }

  public tryStartDash(input?: FighterInputState): boolean {
    if (this.hp <= 0 || this.dashCooldown > 0) return false;
    if (input && Math.abs(input.moveX) > 0.22) {
      this.facing = input.moveX > 0 ? 1 : -1;
    }
    this.dashDir = this.facing;
    this.dashCooldown = 0.45;
    this.state = 'dash';
    this.stateTime = 0;
    this.bufferedAction = null;
    this.invulnTime = Math.max(this.invulnTime, 0.11);
    this.vx = this.dashDir * 560 * this.getPhaseSpeedMultiplier();
    this.callbacks?.onJumpDust?.(this);
    return true;
  }

  public addCombatXpAndEnergy(xpAmount: number, evoGain: number): void {
    this.xpEarnedInMatch += xpAmount;
    if (this.phase < 4) {
      this.evoEnergy = Math.min(100, this.evoEnergy + evoGain);
    }
  }

  public triggerEvolution(): void {
    if (this.phase >= 4 || this.evolvingPending) return;
    const nextPhase = this.phase + 1;
    this.evolvingPending = true;
    this.evoEnergy = 0;
    this.state = 'evolve';
    this.stateTime = 0;
    this.vx = 0;
    this.invulnTime = 0.75;
    this.auraFlashTime = 0.9;
    this.callbacks?.onPlaySfx('evolve');

    // Carrega spritesheet da nova fase (cache-first ou fetch assíncrono rápido)
    const cached = this.spriteLoader.getCachedPhase(this.charId, nextPhase);
    if (cached) {
      this.applyPhasePack(cached, nextPhase);
    } else {
      void this.spriteLoader.loadPhasePack(this.charId, nextPhase).then((pack) => {
        this.applyPhasePack(pack, nextPhase);
      });
    }
  }

  private applyPhasePack(pack: LoadedPhasePack, newPhase: number): void {
    this.phase = newPhase;
    this.phasePack = pack;
    this.evolvingPending = false;
    // Bônus de despertar: recupera 10% de HP e +25 Ki
    this.hp = Math.min(this.maxHp, this.hp + Math.round(this.maxHp * 0.1));
    this.ki = Math.min(this.maxKi, this.ki + 25);
    this.callbacks?.onEvolved(this, newPhase);
  }

  public update(
    dt: number,
    input: FighterInputState,
    opponents: Fighter | Fighter[],
    platforms: ArenaPlatform[] = []
  ): void {
    this.stateTime += dt;

    const list = Array.isArray(opponents) ? opponents : [opponents];
    let bestHorizDist = Infinity;
    let bestAnyDist = Infinity;
    for (const candidate of list) {
      if (candidate === this || candidate.hp <= 0) {
        continue;
      }
      const sameBand = Math.abs(candidate.y - this.y) < 120;
      const horiz = Math.abs(candidate.x - this.x);
      if (sameBand && horiz < bestAnyDist) {
        bestAnyDist = horiz;
      }
      if (candidate.team !== this.team && sameBand && horiz < bestHorizDist) {
        bestHorizDist = horiz;
      }
    }
    this.nearestEnemyDist = bestHorizDist;
    this.nearestAnyDist = bestAnyDist;

    // Atualiza cooldowns, cadência global e regeneração passiva de Ki
    this.globalAttackCooldown = Math.max(0, this.globalAttackCooldown - dt);
    this.cooldowns.ataque_1 = Math.max(0, this.cooldowns.ataque_1 - dt);
    this.cooldowns.ataque_2 = Math.max(0, this.cooldowns.ataque_2 - dt);
    this.cooldowns.ataque_3 = Math.max(0, this.cooldowns.ataque_3 - dt);
    this.cooldowns.ataque_4 = Math.max(0, this.cooldowns.ataque_4 - dt);
    this.invulnTime = Math.max(0, this.invulnTime - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.blockImpactTimer = Math.max(0, this.blockImpactTimer - dt);
    this.auraFlashTime = Math.max(0, this.auraFlashTime - dt);
    this.dropThroughTimer = Math.max(0, this.dropThroughTimer - dt);
    this.ki = Math.min(this.maxKi, this.ki + dt * 4.2);

    // Input buffering (120ms) para respostas fluidas ao sair de golpes/hitstun
    if (this.bufferedAction) {
      this.bufferedAction.ttl -= dt;
      if (this.bufferedAction.ttl <= 0) {
        this.bufferedAction = null;
      }
    }
    if (input.justA4) this.bufferedAction = { type: 'ataque_4', ttl: 0.12 };
    else if (input.justA3) this.bufferedAction = { type: 'ataque_3', ttl: 0.12 };
    else if (input.justA2) this.bufferedAction = { type: 'ataque_2', ttl: 0.12 };
    else if (input.justA1) this.bufferedAction = { type: 'ataque_1', ttl: 0.12 };
    else if (input.justDash) this.bufferedAction = { type: 'dash', ttl: 0.12 };
    else if (input.justJump) this.bufferedAction = { type: 'jump', ttl: 0.12 };

    // Atualiza afterimages (rastros sutis apenas em golpes especiais, dash ou velocidade alta)
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      this.afterimages[i].age += dt;
      if (this.afterimages[i].age >= this.afterimages[i].maxAge) {
        this.afterimages.splice(i, 1);
      }
    }
    const shouldEmitTrail =
      this.hp > 0 &&
      (Math.abs(this.vx) > 310 ||
        this.state === 'dash' ||
        this.state === 'ataque_2' ||
        this.state === 'ataque_4' ||
        this.state === 'evolve' ||
        ((this.state === 'hitstun' || this.state === 'knockdown') &&
          this.stateTime < 0.14 &&
          Math.abs(this.vx) > 260));
    if (shouldEmitTrail) {
      this.afterimageTimer -= dt;
      if (this.afterimageTimer <= 0) {
        this.afterimageTimer = 0.065;
        const curFrame = this.getCurrentFrame();
        if (curFrame) {
          this.afterimages.push({
            frame: curFrame,
            x: this.x,
            y: this.y,
            facing: this.facing,
            age: 0,
            maxAge: 0.14,
          });
          if (this.afterimages.length > 3) {
            this.afterimages.shift();
          }
        }
      }
    } else {
      this.afterimageTimer = 0;
    }

    if (this.comboResetTimer > 0) {
      this.comboResetTimer -= dt;
      if (this.comboResetTimer <= 0) {
        this.comboHitsReceived = 0;
      }
    }

    if (this.hp <= 0) {
      this.vx *= Math.pow(0.05, dt);
      if (this.state !== 'knockdown') {
        this.state = 'knockdown';
        this.stateTime = 0;
      }
    } else {
      // Máquina de estados (facing 100% manual: sem virada magnética passiva)
      switch (this.state) {
        case 'victory': {
          this.vx *= Math.pow(0.02, dt);
          if (Math.abs(this.vx) < 8) this.vx = 0;
          break;
        }

        case 'evolve': {
          this.vx *= Math.pow(0.02, dt);
          if (Math.abs(this.vx) < 8) this.vx = 0;
          if (this.stateTime >= 0.58 && !this.evolvingPending) {
            this.state = this.grounded ? 'idle' : 'jump';
            this.stateTime = 0;
          }
          break;
        }

        case 'dash': {
          const dashSpeed = 560 * this.getPhaseSpeedMultiplier();
          this.vx = this.dashDir * dashSpeed * (this.stateTime > 0.14 ? 0.55 : 1);
          if (this.stateTime >= 0.1) {
            if (input.justA4 && this.tryStartAttack('ataque_4', input)) break;
            if (input.justA3 && this.tryStartAttack('ataque_3', input)) break;
            if (input.justA2 && this.tryStartAttack('ataque_2', input)) break;
            if (input.justA1 && this.tryStartAttack('ataque_1', input)) break;
          }
          if (this.stateTime >= 0.2) {
            this.state = this.grounded
              ? Math.abs(input.moveX) > 0.25
                ? 'run'
                : 'idle'
              : 'jump';
            this.stateTime = 0;
          }
          break;
        }

        case 'land': {
          this.vx *= Math.pow(0.02, dt);
          if (input.justA4 && this.tryStartAttack('ataque_4', input)) break;
          if (input.justA3 && this.tryStartAttack('ataque_3', input)) break;
          if (input.justA2 && this.tryStartAttack('ataque_2', input)) break;
          if (input.justA1 && this.tryStartAttack('ataque_1', input)) break;
          if (input.justDash && this.tryStartDash(input)) break;
          if (input.justJump) {
            this.updateNeutralState(dt, input);
            break;
          }
          if (this.landingTimer <= 0 || this.stateTime >= 0.09) {
            this.state = Math.abs(input.moveX) > 0.25 ? 'run' : 'idle';
            this.stateTime = 0;
          }
          break;
        }

        case 'ki_charge': {
          this.vx = 0;
          this.ki = Math.min(this.maxKi, this.ki + dt * 22);
          this.auraFlashTime = Math.max(this.auraFlashTime, 0.08);
          if (input.justA4 && this.tryStartAttack('ataque_4', input)) break;
          if (input.justA3 && this.tryStartAttack('ataque_3', input)) break;
          if (input.justA2 && this.tryStartAttack('ataque_2', input)) break;
          if (input.justA1 && this.tryStartAttack('ataque_1', input)) break;
          if (input.justDash && this.tryStartDash(input)) break;
          if (!this.grounded || !input.down || !input.block) {
            this.state = this.grounded ? 'idle' : 'jump';
            this.stateTime = 0;
          }
          break;
        }

        case 'hitstun': {
          this.hitstunRemaining -= dt;
          this.vx *= Math.pow(0.08, dt);
          if (this.hitstunRemaining <= 0) {
            this.state = this.grounded ? 'idle' : 'jump';
            this.stateTime = 0;
          }
          break;
        }

        case 'knockdown': {
          if (this.grounded) {
            if (!this.knockdownBounceDone) {
              this.knockdownBounceDone = true;
              this.vy = -135;
              this.grounded = false;
              this.vx *= 0.45;
              this.callbacks?.onLand?.(this);
            } else {
              this.vx *= Math.pow(0.04, dt);
              this.knockdownGroundTimer += dt;
              if (this.knockdownGroundTimer >= 0.28) {
                this.state = 'getup';
                this.stateTime = 0;
                this.invulnTime = Math.max(this.invulnTime, 0.28);
              }
            }
          } else {
            this.vx *= Math.pow(0.35, dt);
          }
          break;
        }

        case 'getup': {
          this.vx = 0;
          if (this.stateTime >= 0.22) {
            this.state = this.grounded ? 'idle' : 'jump';
            this.stateTime = 0;
          }
          break;
        }

        case 'ataque_1':
        case 'ataque_2':
        case 'ataque_3':
        case 'ataque_4': {
          this.updateAttackState(dt, input);
          break;
        }

        default: {
          const effInput: FighterInputState =
            this.bufferedAction &&
            !input.justA4 &&
            !input.justA3 &&
            !input.justA2 &&
            !input.justA1 &&
            !input.justDash &&
            !input.justJump
              ? {
                  ...input,
                  justA4: this.bufferedAction.type === 'ataque_4',
                  justA3: this.bufferedAction.type === 'ataque_3',
                  justA2: this.bufferedAction.type === 'ataque_2',
                  justA1: this.bufferedAction.type === 'ataque_1',
                  justDash: this.bufferedAction.type === 'dash',
                  justJump: this.bufferedAction.type === 'jump',
                }
              : input;
          this.updateNeutralState(dt, effInput);
          break;
        }
      }
    }

    // Física vertical, horizontal e plataformas One-Way
    const prevY = this.y;
    if (!this.grounded) {
      this.vy += Fighter.GRAVITY * dt;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Verifica se continua apoiado sobre a plataforma atual
    if (this.grounded && this.currentPlatformId !== null) {
      const activePlat = platforms.find((p) => p.id === this.currentPlatformId);
      if (
        !activePlat ||
        this.x < activePlat.x - 18 ||
        this.x > activePlat.x + activePlat.w + 18
      ) {
        this.grounded = false;
        this.currentPlatformId = null;
      } else {
        this.y = activePlat.y;
        this.vy = 0;
      }
    }

    // Pouso em plataforma ao descer (One-Way Pass-Through)
    if (
      !this.grounded &&
      this.vy >= 0 &&
      this.dropThroughTimer <= 0 &&
      platforms.length > 0
    ) {
      let landedPlat: ArenaPlatform | null = null;
      for (const plat of platforms) {
        if (
          this.x >= plat.x - 18 &&
          this.x <= plat.x + plat.w + 18 &&
          prevY <= plat.y + 10 &&
          this.y >= plat.y
        ) {
          if (!landedPlat || plat.y < landedPlat.y) {
            landedPlat = plat;
          }
        }
      }
      if (landedPlat) {
        const heavyLand = this.vy > 220;
        this.grounded = true;
        this.y = landedPlat.y;
        this.vy = 0;
        this.currentPlatformId = landedPlat.id;
        this.landingTimer = 0.09;
        if (heavyLand) this.callbacks?.onLand?.(this);
        if (this.state === 'jump') {
          this.state = heavyLand ? 'land' : 'idle';
          this.stateTime = 0;
        }
      }
    }

    // Piso principal
    if (this.y >= this.groundY) {
      if (!this.grounded) {
        const heavyLand = this.vy > 220;
        this.grounded = true;
        this.y = this.groundY;
        this.vy = 0;
        this.currentPlatformId = null;
        this.landingTimer = 0.09;
        if (heavyLand) this.callbacks?.onLand?.(this);
        if (this.state === 'jump') {
          this.state = heavyLand ? 'land' : 'idle';
          this.stateTime = 0;
        }
      } else if (this.currentPlatformId === null) {
        this.y = this.groundY;
        this.vy = 0;
      }
    } else if (this.currentPlatformId === null) {
      this.grounded = false;
    }

    this.landingTimer = Math.max(0, this.landingTimer - dt);
    this.x = Math.max(this.arenaLeft, Math.min(this.arenaRight, this.x));
  }

  private updateNeutralState(dt: number, input: FighterInputState): void {
    // Evolução manual se barra estiver cheia
    if (input.justEvolve && this.canEvolveNow()) {
      this.triggerEvolution();
      return;
    }

    // Prioridade de ataques (do Ultimate ao básico) e Dash
    if (input.justA4 && this.tryStartAttack('ataque_4', input)) return;
    if (input.justA3 && this.tryStartAttack('ataque_3', input)) return;
    if (input.justA2 && this.tryStartAttack('ataque_2', input)) return;
    if (input.justA1 && this.tryStartAttack('ataque_1', input)) return;
    if (input.justDash && this.tryStartDash(input)) return;

    // Atravessar plataforma para baixo (Baixo + Pulo)
    if (
      this.grounded &&
      this.currentPlatformId !== null &&
      input.down &&
      input.justJump
    ) {
      this.dropThroughTimer = 0.24;
      this.grounded = false;
      this.currentPlatformId = null;
      this.vy = 115;
      this.state = 'jump';
      this.stateTime = 0;
      return;
    }

    // Carregar Ki (Baixo + Defesa no solo)
    if (this.grounded && input.down && input.block) {
      this.state = 'ki_charge';
      this.stateTime = 0;
      this.vx = 0;
      return;
    }

    // Defesa (apenas no chão/plataforma; permite trocar direção manualmente)
    if (this.grounded && input.block) {
      if (Math.abs(input.moveX) > 0.25) {
        this.facing = input.moveX > 0 ? 1 : -1;
      }
      this.state = 'block';
      this.vx = 0;
      return;
    }

    // Pulo
    if (this.grounded && input.justJump) {
      this.bufferedAction = null;
      this.callbacks?.onJumpDust?.(this);
      this.grounded = false;
      this.currentPlatformId = null;
      this.vy = Fighter.JUMP_VEL;
      this.vx = input.moveX * Fighter.BASE_SPEED * this.getPhaseSpeedMultiplier() * 1.05;
      if (Math.abs(input.moveX) > 0.25) {
        this.facing = input.moveX > 0 ? 1 : -1;
      }
      this.state = 'jump';
      this.stateTime = 0;
      this.callbacks?.onPlaySfx('jump');
      return;
    }

    // Agachar (facing 100% manual)
    if (this.grounded && input.down) {
      if (Math.abs(input.moveX) > 0.25) {
        this.facing = input.moveX > 0 ? 1 : -1;
      }
      this.state = 'crouch';
      this.vx = 0;
      return;
    }

    // Movimento horizontal / Corrida / Controle aéreo com short-hop e fast-fall
    if (!this.grounded) {
      this.state = 'jump';
      if (!input.jump && this.vy < -220) {
        this.vy *= Math.pow(0.06, dt);
      }
      if (input.down && this.vy > 0) {
        this.vy += Fighter.GRAVITY * 0.45 * dt;
      }
      const airSpeed = Fighter.BASE_SPEED * this.getPhaseSpeedMultiplier() * 0.92;
      if (Math.abs(input.moveX) > 0.2) {
        this.facing = input.moveX > 0 ? 1 : -1;
        this.vx += (input.moveX * airSpeed - this.vx) * Math.min(1, dt * 8.5);
      } else {
        this.vx *= Math.pow(0.18, dt);
        if (Math.abs(this.vx) < 10) this.vx = 0;
      }
      return;
    }

    if (Math.abs(input.moveX) > 0.25) {
      const speed = Fighter.BASE_SPEED * this.getPhaseSpeedMultiplier();
      const targetVx = input.moveX * speed;
      this.vx += (targetVx - this.vx) * Math.min(1, dt * 26);
      this.facing = input.moveX > 0 ? 1 : -1;

      // Evita animação de corrida deslizando no lugar contra a borda da arena
      const blockedByLeftWall = this.x <= this.arenaLeft + 1 && this.facing < 0;
      const blockedByRightWall = this.x >= this.arenaRight - 1 && this.facing > 0;
      const desiredState: FighterState =
        blockedByLeftWall || blockedByRightWall ? 'idle' : 'run';
      if (this.state !== desiredState) {
        this.state = desiredState;
        this.stateTime = 0;
      }
    } else {
      // Parada imediata ao soltar direcional (elimina deslize / ghost walking)
      this.vx = 0;
      if (this.state !== 'idle') {
        this.state = 'idle';
        this.stateTime = 0;
      }
    }
  }

  private updateAttackState(dt: number, input: FighterInputState): void {
    const spec = this.getAttackSpec(
      this.state as 'ataque_1' | 'ataque_2' | 'ataque_3' | 'ataque_4'
    );
    const progress = this.stateTime / spec.duration;

    // Desaceleração durante o golpe + freio ao encostar no oponente (anti-ímã)
    this.vx *= Math.pow(0.03, dt);
    const pushLimit = this.getPushRadius() * 2 + 8;
    if (this.nearestEnemyDist <= pushLimit && this.vx * this.attackDirX > 0) {
      this.vx = 0;
    }

    // Dispara Projétil (A3) OU VFX acoplado/direcionado (A1/A2/A4), sem duplicação
    if (progress >= spec.activeStart) {
      if (spec.isProjectile) {
        if (!this.projectileSpawned) {
          this.projectileSpawned = true;
          this.callbacks?.onSpawnProjectile(this, spec);
        }
      } else if (!this.vfxSpawned) {
        this.vfxSpawned = true;
        const baseReach = spec.action === 'ataque_4' ? 112 : 82;
        const offsetDist = Number.isFinite(this.nearestEnemyDist)
          ? Math.max(58, Math.min(baseReach, this.nearestEnemyDist * 0.55))
          : baseReach;
        const baseChestY =
          Math.abs(this.attackDirY) < 0.2 ? this.y + spec.offsetY : this.y - 96;
        const vfxX = this.x + this.attackDirX * offsetDist;
        const vfxY = baseChestY + this.attackDirY * offsetDist;
        const followOwner = spec.action === 'ataque_2';
        this.callbacks?.onSpawnAttackVfx(this, spec, vfxX, vfxY, followOwner);
      }
    }

    // Encadeamento fluido de combo (e jump cancel) após acertar o golpe
    if (
      (this.state === 'ataque_1' || this.state === 'ataque_2') &&
      this.attackHitDone &&
      progress >= 0.42
    ) {
      if (input.justA4 && this.tryStartAttack('ataque_4', input)) return;
      if (input.justA3 && this.tryStartAttack('ataque_3', input)) return;
      if (this.state === 'ataque_1' && input.justA2 && this.tryStartAttack('ataque_2', input)) {
        return;
      }
      if (input.justDash && this.tryStartDash(input)) {
        return;
      }
      if (this.grounded && input.justJump) {
        this.bufferedAction = null;
        this.callbacks?.onJumpDust?.(this);
        this.grounded = false;
        this.currentPlatformId = null;
        this.vy = Fighter.JUMP_VEL;
        this.vx = input.moveX * Fighter.BASE_SPEED * this.getPhaseSpeedMultiplier() * 1.05;
        this.state = 'jump';
        this.stateTime = 0;
        this.callbacks?.onPlaySfx('jump');
        return;
      }
    }

    if (this.stateTime >= spec.duration) {
      this.state = this.grounded ? 'idle' : 'jump';
      this.stateTime = 0;
    }
  }

  private resolveAttackDirection(input?: FighterInputState): {
    dirX: number;
    dirY: number;
    hasHorizInput: boolean;
  } {
    const rawX = input ? input.moveX : 0;
    const rawY = input ? input.moveY : 0;
    const ax =
      Math.abs(rawX) > 0.25 ? rawX : input?.right ? 1 : input?.left ? -1 : 0;
    const ay =
      Math.abs(rawY) > 0.28 ? rawY : input?.down ? 1 : input?.up ? -1 : 0;

    if (ax === 0 && ay === 0) {
      // Sem giro magnético: golpe sai para a direção atual do personagem
      return { dirX: this.facing, dirY: 0, hasHorizInput: false };
    }

    if (ax === 0) {
      return { dirX: 0, dirY: ay < 0 ? -1 : 1, hasHorizInput: false };
    }

    this.facing = ax >= 0 ? 1 : -1;
    if (ay === 0) {
      return { dirX: this.facing, dirY: 0, hasHorizInput: true };
    }

    const len = Math.hypot(ax, ay) || 1;
    return { dirX: ax / len, dirY: ay / len, hasHorizInput: true };
  }

  private applyAttackLunge(
    action: 'ataque_1' | 'ataque_2' | 'ataque_3' | 'ataque_4',
    spec: AttackSpec
  ): void {
    const pushLimit = this.getPushRadius() * 2 + 8;
    if (this.hasMoveInputInAttack && this.nearestEnemyDist > pushLimit) {
      this.vx = this.attackDirX * spec.lungeX;
    } else {
      this.vx *= 0.25;
      if (Math.abs(this.vx) < 8) this.vx = 0;
    }

    if (this.attackDirY < -0.32) {
      if (action === 'ataque_2' || action === 'ataque_4') {
        this.vy = Math.min(
          this.vy,
          this.attackDirY * Math.max(460, spec.lungeX * 0.95)
        );
        this.grounded = false;
        this.currentPlatformId = null;
      } else if (!this.grounded) {
        this.vy = Math.min(this.vy, this.attackDirY * 220);
      }
    } else if (this.attackDirY > 0.32) {
      if (
        this.grounded &&
        this.currentPlatformId !== null &&
        (action === 'ataque_2' || action === 'ataque_4')
      ) {
        this.dropThroughTimer = 0.24;
        this.grounded = false;
        this.currentPlatformId = null;
        this.vy = Math.max(
          this.vy,
          this.attackDirY * Math.max(420, spec.lungeX * 0.85)
        );
      } else if (!this.grounded) {
        this.vy = Math.max(
          this.vy,
          this.attackDirY * Math.max(360, spec.lungeX * 0.72)
        );
      }
    }
  }

  private beginAttackState(
    action: 'ataque_1' | 'ataque_2' | 'ataque_3' | 'ataque_4',
    spec: AttackSpec,
    isRemote: boolean
  ): void {
    this.ki = isRemote ? Math.max(0, this.ki - spec.kiCost) : this.ki - spec.kiCost;
    this.cooldowns[action] = spec.cooldown;
    this.globalAttackMax = 0;
    this.globalAttackCooldown = 0;

    this.state = action;
    this.stateTime = 0;
    this.attackHitDone = false;
    this.hitTargetsInCurrentAttack.clear();
    this.projectileSpawned = false;
    this.vfxSpawned = false;
    this.applyAttackLunge(action, spec);
    if (action === 'ataque_4') {
      this.invulnTime = 0.35;
      this.auraFlashTime = 0.65;
    }

    const sfxMap = {
      ataque_1: 'atk1',
      ataque_2: 'atk2',
      ataque_3: 'atk3',
      ataque_4: 'atk4',
    } as const;
    this.callbacks?.onPlaySfx(sfxMap[action]);
  }

  public tryStartAttack(
    action: 'ataque_1' | 'ataque_2' | 'ataque_3' | 'ataque_4',
    input?: FighterInputState
  ): boolean {
    if (this.hp <= 0) return false;
    const spec = this.getAttackSpec(action);
    if (this.cooldowns[action] > 0 || this.ki < spec.kiCost) {
      return false;
    }

    const { dirX, dirY, hasHorizInput } = this.resolveAttackDirection(input);
    this.attackDirX = dirX;
    this.attackDirY = dirY;
    this.hasMoveInputInAttack = hasHorizInput;
    this.bufferedAction = null;
    this.beginAttackState(action, spec, false);
    return true;
  }

  public syncRemoteAttack(
    action: 'ataque_1' | 'ataque_2' | 'ataque_3' | 'ataque_4',
    attackDirX?: number,
    attackDirY?: number
  ): void {
    const spec = this.getAttackSpec(action);
    if (typeof attackDirX === 'number' && typeof attackDirY === 'number') {
      const len = Math.hypot(attackDirX, attackDirY) || 1;
      this.attackDirX = attackDirX / len;
      this.attackDirY = attackDirY / len;
      if (Math.abs(this.attackDirX) > 0.25) {
        this.facing = this.attackDirX >= 0 ? 1 : -1;
      }
    } else {
      this.attackDirX = this.facing;
      this.attackDirY = 0;
    }
    this.hasMoveInputInAttack = Math.abs(this.attackDirX) > 0.25 && spec.lungeX > 0;
    this.beginAttackState(action, spec, true);
  }

  public isBlockingHit(attackerX: number): boolean {
    if (this.state !== 'block') return false;
    // Defesa protege contra ataques vindos da direção para a qual está olhando
    const attackFromFront =
      (attackerX >= this.x && this.facing === 1) ||
      (attackerX <= this.x && this.facing === -1);
    return attackFromFront;
  }

  public receiveHit(
    rawDamage: number,
    knockbackX: number,
    knockbackY: number,
    hitstun: number,
    attackerX: number
  ): { blocked: boolean; finalDamage: number } {
    const blocked = this.isBlockingHit(attackerX);
    const pushDir = this.x >= attackerX ? 1 : -1;

    if (blocked) {
      const chipDamage = Math.max(4, Math.round(rawDamage * 0.18));
      this.hp = Math.max(0, this.hp - chipDamage);
      this.vx = pushDir * knockbackX * 0.52;
      this.blockImpactTimer = 0.15;
      this.addCombatXpAndEnergy(4, 9);
      return { blocked: true, finalDamage: chipDamage };
    }

    const finalDamage = Math.round(rawDamage);
    this.hp = Math.max(0, this.hp - finalDamage);
    this.comboHitsReceived++;
    this.comboResetTimer = 1.25;
    this.knockdownBounceDone = false;
    this.knockdownGroundTimer = 0;
    const isHeavyKnockdown =
      this.hp <= 0 || knockbackY <= -180 || this.comboHitsReceived >= 3;
    this.state = isHeavyKnockdown ? 'knockdown' : 'hitstun';
    this.stateTime = 0;
    this.hitstunRemaining = hitstun;
    this.vx = pushDir * knockbackX;
    if (knockbackY < -10) {
      this.vy = knockbackY;
      this.grounded = false;
    } else if (knockbackY > 30 && !this.grounded) {
      this.vy = Math.max(this.vy, knockbackY);
    }
    this.addCombatXpAndEnergy(6, 14);
    return { blocked: false, finalDamage };
  }

  public getHurtbox(): Rect {
    const isCrouching = this.state === 'crouch';
    const h = isCrouching ? 116 : 164;
    const w = 78;
    return {
      x: this.x - w * 0.5,
      y: this.y - h,
      w,
      h,
    };
  }

  public getActiveAttackHitbox(): { rect: Rect; spec: AttackSpec } | null {
    if (
      this.hp <= 0 ||
      (this.state !== 'ataque_1' &&
        this.state !== 'ataque_2' &&
        this.state !== 'ataque_3' &&
        this.state !== 'ataque_4')
    ) {
      return null;
    }

    const spec = this.getAttackSpec(this.state);
    if (spec.isProjectile) return null; // Projéteis colidem por objeto próprio

    const progress = this.stateTime / spec.duration;
    if (progress < spec.activeStart || progress > spec.activeEnd) {
      return null;
    }

    // Curva dinâmica de alcance acompanhando extensão e recolhimento do golpe
    const activeSpan = Math.max(0.01, spec.activeEnd - spec.activeStart);
    const activeProgress = (progress - spec.activeStart) / activeSpan;
    const reachFactor =
      activeProgress < 0.3
        ? 0.74 + (activeProgress / 0.3) * 0.26
        : activeProgress > 0.8
          ? 1 - ((activeProgress - 0.8) / 0.2) * 0.2
          : 1.0;
    const effectiveRangeW = Math.round(spec.rangeW * reachFactor);

    if (this.charId === 'sukuna' && this.phase === 1 && this.state === 'ataque_4') {
      // Santuário Incompleto atinge em área ao redor do Sukuna
      return {
        rect: {
          x: this.x - effectiveRangeW * 0.6,
          y: this.y + spec.offsetY - spec.rangeH * 0.5,
          w: effectiveRangeW * 1.2,
          h: spec.rangeH,
        },
        spec,
      };
    }

    if (Math.abs(this.attackDirY) < 0.25) {
      const rect: Rect =
        this.facing === 1
          ? {
              x: this.x + 12,
              y: this.y + spec.offsetY - spec.rangeH * 0.5,
              w: effectiveRangeW,
              h: spec.rangeH,
            }
          : {
              x: this.x - 12 - effectiveRangeW,
              y: this.y + spec.offsetY - spec.rangeH * 0.5,
              w: effectiveRangeW,
              h: spec.rangeH,
            };
      return { rect, spec };
    }

    if (this.attackDirY < -0.78) {
      const w = Math.max(88, spec.rangeH * 1.05);
      const h = effectiveRangeW * 1.05;
      return {
        rect: {
          x: this.x + this.attackDirX * 20 - w * 0.5,
          y: this.y - 88 - h,
          w,
          h,
        },
        spec,
      };
    }

    if (this.attackDirY > 0.78) {
      const w = Math.max(88, spec.rangeH * 1.05);
      const h = effectiveRangeW * 1.05;
      return {
        rect: {
          x: this.x + this.attackDirX * 20 - w * 0.5,
          y: this.y - 72,
          w,
          h,
        },
        spec,
      };
    }

    const centerDist = 18 + effectiveRangeW * 0.45;
    const cx = this.x + this.attackDirX * centerDist;
    const cy = this.y - 86 + this.attackDirY * centerDist;
    const w = Math.max(
      spec.rangeH,
      Math.abs(this.attackDirX) * effectiveRangeW * 0.88 + spec.rangeH * 0.45
    );
    const h = Math.max(
      spec.rangeH,
      Math.abs(this.attackDirY) * effectiveRangeW * 0.88 + spec.rangeH * 0.45
    );
    return {
      rect: {
        x: cx - w * 0.5,
        y: cy - h * 0.5,
        w,
        h,
      },
      spec,
    };
  }

  private getDirectionalAttackAction(
    baseAction: 'ataque_1' | 'ataque_2' | 'ataque_3' | 'ataque_4'
  ): CanonicalAction {
    let candidate: CanonicalAction = baseAction;
    if (this.attackDirY < -0.78) {
      candidate = `${baseAction}_up`;
    } else if (this.attackDirY <= -0.32) {
      candidate = `${baseAction}_diag_up`;
    } else if (this.attackDirY > 0.78) {
      candidate = `${baseAction}_down`;
    } else if (this.attackDirY >= 0.32) {
      candidate = `${baseAction}_diag_down`;
    }
    return this.phasePack.actions.has(candidate) ? candidate : baseAction;
  }

  private resolveCurrentAction(): CanonicalAction {
    if (this.state === 'evolve') {
      return this.getActionFrames('evolve') ? 'evolve' : 'ataque_4';
    }
    if (this.state === 'ki_charge') {
      return this.getActionFrames('ki_charge')
        ? 'ki_charge'
        : this.getActionFrames('block')
          ? 'block'
          : 'idle';
    }
    if (this.state === 'getup') {
      return this.getActionFrames('getup')
        ? 'getup'
        : this.getActionFrames('land')
          ? 'land'
          : 'crouch';
    }
    if (
      this.state === 'ataque_1' ||
      this.state === 'ataque_2' ||
      this.state === 'ataque_3' ||
      this.state === 'ataque_4'
    ) {
      return this.getDirectionalAttackAction(this.state);
    }
    return this.state;
  }

  private getActionMedianRawHeight(action: CanonicalAction): number {
    let packMap = Fighter.actionMedianHeightCache.get(this.phasePack);
    if (!packMap) {
      packMap = new Map<CanonicalAction, number>();
      Fighter.actionMedianHeightCache.set(this.phasePack, packMap);
    }
    const cached = packMap.get(action);
    if (cached !== undefined) return cached;

    const frames =
      this.phasePack.actions.get(action) ?? this.phasePack.actions.get('idle') ?? [];
    if (frames.length === 0) {
      const fallback = Math.max(100, this.phasePack.manifest.refBodyHeight || 350);
      packMap.set(action, fallback);
      return fallback;
    }
    const sorted = frames
      .map((f) => Math.max(80, f.meta.rawH || f.meta.h || 350))
      .sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) * 0.5;
    packMap.set(action, median);
    return median;
  }

  private computeNormalizedFrameScale(
    _frame: LoadedFrame,
    action: CanonicalAction,
    refHeight: number
  ): { scale: number; scaleX: number; scaleY: number } {
    let effectiveRefH = refHeight;
    if (this.state === 'crouch') {
      const medianH = this.getActionMedianRawHeight(action);
      if (medianH >= refHeight * 0.82) {
        effectiveRefH = medianH / 0.78;
      }
    }

    const scale = Fighter.TARGET_BODY_HEIGHT / Math.max(100, effectiveRefH);
    let renderScaleX = scale;
    let renderScaleY = scale;

    if (!this.grounded && this.vy < -320) {
      renderScaleX = scale * 0.95;
      renderScaleY = scale * 1.06;
    } else if (this.landingTimer > 0) {
      const landRatio = this.landingTimer / 0.09;
      renderScaleX = scale * (1 + 0.07 * landRatio);
      renderScaleY = scale * (1 - 0.06 * landRatio);
    } else if (
      this.state === 'ataque_2' ||
      this.state === 'ataque_4'
    ) {
      const spec = this.getAttackSpec(this.state);
      const p = this.stateTime / spec.duration;
      if (p < spec.activeStart * 0.6) {
        renderScaleX = scale * 1.04;
        renderScaleY = scale * 0.96;
      } else if (p >= spec.activeStart && p <= spec.activeEnd) {
        renderScaleX = scale * 1.05;
        renderScaleY = scale * 0.97;
      }
    }

    return { scale, scaleX: renderScaleX, scaleY: renderScaleY };
  }

  private getAttackFrameIndex(
    spec: AttackSpec,
    frameCount: number
  ): number {
    if (frameCount <= 1) return 0;
    const progress = Math.min(0.999, Math.max(0, this.stateTime / spec.duration));
    const startupEndIdx = Math.max(1, Math.floor((frameCount - 1) * 0.25));
    const activeEndIdx = Math.max(startupEndIdx + 1, Math.floor((frameCount - 1) * 0.72));

    if (progress < spec.activeStart) {
      const localP = progress / Math.max(0.01, spec.activeStart);
      return Math.min(startupEndIdx, Math.floor(localP * (startupEndIdx + 1)));
    }
    if (progress <= spec.activeEnd) {
      const span = Math.max(0.01, spec.activeEnd - spec.activeStart);
      const localP = (progress - spec.activeStart) / span;
      const activeCount = activeEndIdx - startupEndIdx;
      return Math.min(
        activeEndIdx,
        startupEndIdx + 1 + Math.floor(localP * Math.max(1, activeCount))
      );
    }
    const recSpan = Math.max(0.01, 1 - spec.activeEnd);
    const localP = (progress - spec.activeEnd) / recSpan;
    const recCount = frameCount - 1 - activeEndIdx;
    return Math.min(
      frameCount - 1,
      activeEndIdx + 1 + Math.floor(localP * Math.max(1, recCount))
    );
  }

  private getActionFrames(action: CanonicalAction): LoadedFrame[] | undefined {
    const direct = this.phasePack.actions.get(action);
    if (direct && direct.length > 0) return direct;
    if (
      this.phase > 1 &&
      (action === 'land' ||
        action === 'dash' ||
        action === 'knockdown' ||
        action === 'victory' ||
        action === 'getup' ||
        action === 'evolve' ||
        action === 'ki_charge')
    ) {
      const f1 = this.spriteLoader.getCachedPhase(this.charId, 1)?.actions.get(action);
      if (f1 && f1.length > 0) return f1;
    }
    return undefined;
  }

  public getCurrentFrame(): LoadedFrame | undefined {
    const action = this.resolveCurrentAction();

    if (this.state === 'idle' && this.grounded && this.landingTimer > 0) {
      const landFrames = this.getActionFrames('land');
      if (landFrames && landFrames.length > 0) {
        const p = Math.min(0.999, Math.max(0, 1 - this.landingTimer / 0.09));
        return landFrames[Math.min(landFrames.length - 1, Math.floor(p * landFrames.length))];
      }
      const jumpFrames = this.getActionFrames('jump');
      if (jumpFrames && jumpFrames.length > 0) {
        return jumpFrames[jumpFrames.length - 1];
      }
    }

    const frames =
      this.getActionFrames(action) ?? this.getActionFrames('idle');
    if (!frames || frames.length === 0) return undefined;

    let idx = 0;
    if (this.state === 'idle') {
      const fps = frames.length >= 6 ? 8 : 6.5;
      idx = Math.floor(this.stateTime * fps) % frames.length;
    } else if (this.state === 'run') {
      const fps = frames.length >= 8 ? 15 : frames.length >= 6 ? 13 : 11;
      idx = Math.floor(this.stateTime * fps) % frames.length;
    } else if (this.state === 'dash') {
      const p = Math.min(0.999, Math.max(0, this.stateTime / 0.2));
      idx = Math.floor(p * frames.length);
    } else if (this.state === 'land') {
      const p = Math.min(0.999, Math.max(0, this.stateTime / 0.09));
      idx = Math.floor(p * frames.length);
    } else if (this.state === 'jump') {
      if (this.grounded && this.landingTimer > 0) {
        idx = frames.length - 1;
      } else if (this.stateTime < 0.08) {
        idx = 0;
      } else if (this.vy < -60) {
        idx = Math.min(frames.length - 1, Math.max(1, Math.round((frames.length - 1) * 0.35)));
      } else {
        idx = Math.min(frames.length - 1, Math.max(1, Math.round((frames.length - 1) * 0.68)));
      }
    } else if (this.state === 'crouch') {
      // Segura na pose agachada mais baixa sem voltar a ficar em pé nos frames finais
      const holdIdx = frames.length >= 6 ? 2 : 1;
      idx = this.stateTime < 0.07 ? 0 : Math.min(holdIdx, frames.length - 1);
    } else if (this.state === 'block') {
      if (this.blockImpactTimer > 0) {
        const impactIdx = frames.length >= 6 ? 3 : 2;
        idx = Math.min(impactIdx, frames.length - 1);
      } else {
        const guardIdx = frames.length >= 6 ? 2 : 1;
        idx = this.stateTime < 0.07 ? 0 : Math.min(guardIdx, frames.length - 1);
      }
    } else if (this.state === 'ki_charge') {
      const fps = 10;
      idx = Math.floor(this.stateTime * fps) % frames.length;
    } else if (this.state === 'hitstun') {
      const totalStun = Math.max(
        0.18,
        this.stateTime + Math.max(0, this.hitstunRemaining)
      );
      const p = Math.min(0.999, this.stateTime / totalStun);
      idx = Math.min(frames.length - 1, Math.floor(p * frames.length));
    } else if (this.state === 'knockdown') {
      if (this.grounded && this.knockdownBounceDone) {
        idx = frames.length - 1;
      } else {
        const p = Math.min(0.999, Math.max(0, this.stateTime / 0.42));
        idx = Math.floor(p * frames.length);
      }
    } else if (this.state === 'getup') {
      const p = Math.min(0.999, Math.max(0, this.stateTime / 0.22));
      idx = Math.floor(p * frames.length);
    } else if (this.state === 'victory') {
      const p = Math.min(0.999, Math.max(0, this.stateTime / 0.65));
      idx = Math.floor(p * frames.length);
    } else if (this.state === 'evolve') {
      const fps = frames.length >= 6 ? 12 : 10;
      idx = Math.floor(this.stateTime * fps) % frames.length;
    } else {
      const spec = this.getAttackSpec(this.state);
      idx = this.getAttackFrameIndex(spec, frames.length);
    }

    return frames[idx];
  }

  public renderAura(ctx: CanvasRenderingContext2D): void {
    if (
      this.hp > 0 &&
      (this.phase >= 2 || this.auraFlashTime > 0 || this.state === 'ataque_4')
    ) {
      const auraColor = this.phasePack.manifest.auraColor || '#38bdf8';
      const pulse = 0.88 + 0.14 * Math.sin(performance.now() * 0.012);
      const baseAlpha =
        this.auraFlashTime > 0 ? 0.55 : 0.18 + (this.phase - 1) * 0.08;
      const proximityDim =
        this.nearestAnyDist < 120
          ? 0.35 + 0.65 * Math.max(0, (this.nearestAnyDist - 55) / 65)
          : 1;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = baseAlpha * proximityDim;
      const grad = ctx.createRadialGradient(
        this.x,
        this.y - 95,
        12,
        this.x,
        this.y - 95,
        92 * pulse
      );
      grad.addColorStop(0, auraColor);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y - 95, 92 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    options?: {
      showOverheadHud?: boolean;
      isLocal?: boolean;
      platforms?: ArenaPlatform[];
    }
  ): void {
    const frame = this.getCurrentFrame();
    if (!frame) return;

    const action = this.resolveCurrentAction();
    const refHeight = Math.max(100, this.phasePack.manifest.refBodyHeight || 350);
    const { scale, scaleX: renderScaleX, scaleY: renderScaleY } =
      this.computeNormalizedFrameScale(frame, action, refHeight);

    // Sombra na superfície imediatamente abaixo (plataforma ou chão)
    let shadowSurfaceY = this.groundY;
    if (options?.platforms) {
      for (const plat of options.platforms) {
        if (
          plat.y >= this.y - 2 &&
          this.x >= plat.x - 18 &&
          this.x <= plat.x + plat.w + 18 &&
          plat.y < shadowSurfaceY
        ) {
          shadowSurfaceY = plat.y;
        }
      }
    }
    const heightAboveSurface = Math.max(0, shadowSurfaceY - this.y);
    const shadowScale = Math.max(0.42, 1 - heightAboveSurface / 320);
    ctx.save();
    ctx.fillStyle = this.hp <= 0 ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(
      this.x,
      shadowSurfaceY + 4,
      54 * shadowScale,
      12 * shadowScale,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    // Afterimages sutis atrás do lutador (sem ctx.filter para manter 60fps estável)
    if (this.hp > 0 && this.afterimages.length > 0) {
      for (const trail of this.afterimages) {
        const lifeRatio = Math.max(0, 1 - trail.age / trail.maxAge);
        if (lifeRatio <= 0.02) continue;
        ctx.save();
        ctx.translate(trail.x, trail.y);
        ctx.scale(trail.facing * scale, scale);
        ctx.globalAlpha = lifeRatio * 0.2;
        ctx.drawImage(
          trail.frame.image,
          -trail.frame.meta.anchorX,
          -trail.frame.meta.anchorY,
          trail.frame.meta.w,
          trail.frame.meta.h
        );
        ctx.restore();
      }
    }

    // Desenho do sprite ancorado nos pés com suporte a flipX (facing = -1) e tremor de impacto
    const hitShakeX =
      this.hp > 0 &&
      ((this.state === 'hitstun' && this.stateTime < 0.03) || this.blockImpactTimer > 0.11)
        ? Math.sin(performance.now() * 0.22) * 3.5
        : 0;
    ctx.save();
    ctx.translate(this.x + hitShakeX, this.y);
    ctx.scale(this.facing * renderScaleX, renderScaleY);

    if (this.hp <= 0) {
      ctx.globalAlpha = 0.36;
    }

    ctx.drawImage(
      frame.image,
      -frame.meta.anchorX,
      -frame.meta.anchorY,
      frame.meta.w,
      frame.meta.h
    );

    if (
      this.hp > 0 &&
      this.state === 'hitstun' &&
      Math.floor(this.stateTime * 22) % 2 === 0
    ) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45;
      ctx.drawImage(
        frame.image,
        -frame.meta.anchorX,
        -frame.meta.anchorY,
        frame.meta.w,
        frame.meta.h
      );
    }
    ctx.restore();

    // Arco de escudo translúcido quando defendendo
    if (this.hp > 0 && this.state === 'block') {
      const impactPulse = this.blockImpactTimer > 0 ? 1 : 0;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = impactPulse ? 0.65 : 0.34;
      ctx.strokeStyle = impactPulse ? '#7dd3fc' : '#38bdf8';
      ctx.lineWidth = impactPulse ? 4.5 : 3;
      ctx.beginPath();
      const arcStart = this.facing === 1 ? -Math.PI * 0.42 : Math.PI * 0.58;
      const arcEnd = this.facing === 1 ? Math.PI * 0.42 : Math.PI * 1.42;
      ctx.arc(this.x + this.facing * 12, this.y - 92, 68, arcStart, arcEnd);
      ctx.stroke();
      ctx.restore();
    }

    // Mini HUD / Marcador de equipe acima da cabeça no modo Rumble Arena
    if (options?.showOverheadHud) {
      this.renderOverheadHud(ctx, Boolean(options.isLocal));
    }
  }

  private renderOverheadHud(ctx: CanvasRenderingContext2D, isLocal: boolean): void {
    const teamColor = isLocal
      ? '#facc15'
      : this.team === 1
        ? '#22d3ee'
        : '#ff3b5c';
    const topY = this.y - 204;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '800 12px system-ui, sans-serif';

    const label = isLocal ? `${this.displayName} ★` : this.displayName;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.strokeText(label, this.x, topY - 8);
    ctx.fillStyle = teamColor;
    ctx.fillText(label, this.x, topY - 8);

    if (this.hp <= 0) {
      ctx.font = '900 13px system-ui, sans-serif';
      ctx.strokeText('K.O.', this.x, topY + 12);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('K.O.', this.x, topY + 12);
      ctx.restore();
      return;
    }

    const barW = 74;
    const barH = 7;
    const bx = this.x - barW * 0.5;
    const by = topY;
    const pct = Math.max(0, Math.min(1, this.hp / this.maxHp));

    ctx.fillStyle = 'rgba(7, 10, 20, 0.82)';
    ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);

    ctx.fillStyle = this.team === 1 ? '#06b6d4' : '#f43f5e';
    ctx.fillRect(bx, by, barW * pct, barH);

    ctx.strokeStyle = isLocal ? '#facc15' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = isLocal ? 1.5 : 1;
    ctx.strokeRect(bx - 1, by - 1, barW + 2, barH + 2);
    ctx.restore();
  }
}
