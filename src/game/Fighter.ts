import { FighterInputState } from '../engine/InputManager';
import {
  CanonicalAction,
  CanonicalVfx,
  LoadedFrame,
  LoadedPhasePack,
  SpriteLoader,
} from '../engine/SpriteLoader';
import type { ArenaPlatform } from './ArenaMap';

export type FighterSlotId = 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6';
export type FighterTeam = 1 | 2;

export function teamForSlot(slot: FighterSlotId): FighterTeam {
  return slot === 'p1' || slot === 'p3' || slot === 'p5' ? 1 : 2;
}

export type FighterState =
  | 'idle'
  | 'run'
  | 'jump'
  | 'crouch'
  | 'block'
  | 'hitstun'
  | 'ataque_1'
  | 'ataque_2'
  | 'ataque_3'
  | 'ataque_4'
  | 'evolve';

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
    duration: 0.34,
    activeStart: 0.28,
    activeEnd: 0.72,
    damage: 58,
    kiCost: 0,
    kiGainOnHit: 10,
    cooldown: 0.28,
    knockbackX: 165,
    knockbackY: -60,
    hitstun: 0.26,
    hitStop: 0.045,
    lungeX: 90,
    isProjectile: false,
    projectileSpeed: 0,
    rangeW: 112,
    rangeH: 90,
    offsetY: -95,
  },
  ataque_2: {
    action: 'ataque_2',
    vfx: 'vfx_ataque_2',
    duration: 0.48,
    activeStart: 0.30,
    activeEnd: 0.75,
    damage: 98,
    kiCost: 12,
    kiGainOnHit: 12,
    cooldown: 0.65,
    knockbackX: 310,
    knockbackY: -195,
    hitstun: 0.38,
    hitStop: 0.075,
    lungeX: 340,
    isProjectile: false,
    projectileSpeed: 0,
    rangeW: 128,
    rangeH: 100,
    offsetY: -96,
  },
  ataque_3: {
    action: 'ataque_3',
    vfx: 'vfx_ataque_3',
    duration: 0.54,
    activeStart: 0.38,
    activeEnd: 0.65,
    damage: 115,
    kiCost: 25,
    kiGainOnHit: 10,
    cooldown: 1.05,
    knockbackX: 250,
    knockbackY: -140,
    hitstun: 0.34,
    hitStop: 0.065,
    lungeX: -30,
    isProjectile: true,
    projectileSpeed: 640,
    rangeW: 110,
    rangeH: 90,
    offsetY: -98,
  },
  ataque_4: {
    action: 'ataque_4',
    vfx: 'vfx_ataque_4',
    duration: 0.82,
    activeStart: 0.36,
    activeEnd: 0.84,
    damage: 245,
    kiCost: 65,
    kiGainOnHit: 0,
    cooldown: 3.0,
    knockbackX: 480,
    knockbackY: -310,
    hitstun: 0.56,
    hitStop: 0.14,
    lungeX: 220,
    isProjectile: false,
    projectileSpeed: 0,
    rangeW: 210,
    rangeH: 170,
    offsetY: -108,
  },
};

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
  public comboHitsReceived = 0;
  public comboResetTimer = 0;
  public auraFlashTime = 0;

  public cooldowns: Record<'ataque_1' | 'ataque_2' | 'ataque_3' | 'ataque_4', number> = {
    ataque_1: 0,
    ataque_2: 0,
    ataque_3: 0,
    ataque_4: 0,
  };

  public phasePack: LoadedPhasePack;
  private readonly spriteLoader: SpriteLoader;
  private callbacks?: FighterCallbacks;
  private evolvingPending = false;
  private lastOpponentX = 640;

  // Constantes de física e escala
  public static readonly GROUND_Y = 540;
  public static readonly ARENA_LEFT = 70;
  public static readonly ARENA_RIGHT = 1210;
  public static readonly TARGET_BODY_HEIGHT = 186;
  private static readonly GRAVITY = 2150;
  private static readonly JUMP_VEL = -790;
  private static readonly BASE_SPEED = 365;

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
    this.lastOpponentX = startX + facing * 120;
  }

  public setCallbacks(cb: FighterCallbacks): void {
    this.callbacks = cb;
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
      if (action === 'ataque_1') return { ...base, rangeW: 195, lungeX: 110 };
      if (action === 'ataque_2') return { ...base, rangeW: 215, lungeX: 280 };
      if (action === 'ataque_3' && this.phase <= 3) {
        return { ...base, rangeW: 240, projectileSpeed: 780 };
      }
    } else if (this.charId === 'sukuna') {
      if (action === 'ataque_1') return { ...base, rangeW: 135 };
      if (action === 'ataque_2') return { ...base, rangeW: 155 };
      if (action === 'ataque_4') return { ...base, rangeW: 250, rangeH: 155 };
    } else if (this.charId === 'goku') {
      if (action === 'ataque_1') return { ...base, rangeW: 130 };
      if (action === 'ataque_2') return { ...base, rangeW: 150 };
      if (action === 'ataque_4') return { ...base, rangeW: 240, rangeH: 150 };
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
      this.state !== 'evolve'
    );
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
    let nearestEnemy: Fighter | null = null;
    let bestDist = Infinity;
    for (const candidate of list) {
      if (candidate === this || candidate.team === this.team || candidate.hp <= 0) {
        continue;
      }
      const d = Math.abs(candidate.x - this.x) + Math.abs(candidate.y - this.y) * 0.5;
      if (d < bestDist) {
        bestDist = d;
        nearestEnemy = candidate;
      }
    }
    if (nearestEnemy) {
      this.lastOpponentX = nearestEnemy.x;
    }

    // Atualiza cooldowns e regeneração passiva de Ki
    this.cooldowns.ataque_1 = Math.max(0, this.cooldowns.ataque_1 - dt);
    this.cooldowns.ataque_2 = Math.max(0, this.cooldowns.ataque_2 - dt);
    this.cooldowns.ataque_3 = Math.max(0, this.cooldowns.ataque_3 - dt);
    this.cooldowns.ataque_4 = Math.max(0, this.cooldowns.ataque_4 - dt);
    this.invulnTime = Math.max(0, this.invulnTime - dt);
    this.blockImpactTimer = Math.max(0, this.blockImpactTimer - dt);
    this.auraFlashTime = Math.max(0, this.auraFlashTime - dt);
    this.dropThroughTimer = Math.max(0, this.dropThroughTimer - dt);
    this.ki = Math.min(this.maxKi, this.ki + dt * 4.2);

    if (this.comboResetTimer > 0) {
      this.comboResetTimer -= dt;
      if (this.comboResetTimer <= 0) {
        this.comboHitsReceived = 0;
      }
    }

    if (this.hp <= 0) {
      this.vx *= Math.pow(0.05, dt);
      if (this.state !== 'hitstun') {
        this.state = 'hitstun';
      }
    } else {
      // Virada automática para o oponente mais próximo em poses neutras/defensivas
      if (
        this.grounded &&
        nearestEnemy &&
        (this.state === 'idle' ||
          this.state === 'crouch' ||
          this.state === 'block')
      ) {
        if (Math.abs(nearestEnemy.x - this.x) > 8) {
          this.facing = nearestEnemy.x >= this.x ? 1 : -1;
        }
      }

      // Máquina de estados
      switch (this.state) {
        case 'evolve': {
          if (this.stateTime >= 0.58 && !this.evolvingPending) {
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

        case 'ataque_1':
        case 'ataque_2':
        case 'ataque_3':
        case 'ataque_4': {
          this.updateAttackState(dt, input);
          break;
        }

        default: {
          this.updateNeutralState(dt, input);
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
        this.grounded = true;
        this.y = landedPlat.y;
        this.vy = 0;
        this.currentPlatformId = landedPlat.id;
        this.landingTimer = 0.09;
        if (this.state === 'jump') {
          this.state = 'idle';
          this.stateTime = 0;
        }
      }
    }

    // Piso principal
    if (this.y >= this.groundY) {
      if (!this.grounded) {
        this.grounded = true;
        this.y = this.groundY;
        this.vy = 0;
        this.currentPlatformId = null;
        this.landingTimer = 0.09;
        if (this.state === 'jump') {
          this.state = 'idle';
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

  private updateNeutralState(_dt: number, input: FighterInputState): void {
    // Evolução manual se barra estiver cheia
    if (input.justEvolve && this.canEvolveNow()) {
      this.triggerEvolution();
      return;
    }

    // Prioridade de ataques (do Ultimate ao básico)
    if (input.justA4 && this.tryStartAttack('ataque_4', input)) return;
    if (input.justA3 && this.tryStartAttack('ataque_3', input)) return;
    if (input.justA2 && this.tryStartAttack('ataque_2', input)) return;
    if (input.justA1 && this.tryStartAttack('ataque_1', input)) return;

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

    // Defesa (apenas no chão/plataforma)
    if (this.grounded && input.block) {
      if (Math.abs(this.lastOpponentX - this.x) > 8) {
        this.facing = this.lastOpponentX >= this.x ? 1 : -1;
      }
      this.state = 'block';
      this.vx *= 0.72;
      return;
    }

    // Pulo
    if (this.grounded && input.justJump) {
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

    // Agachar
    if (this.grounded && input.down) {
      if (Math.abs(input.moveX) > 0.25) {
        this.facing = input.moveX > 0 ? 1 : -1;
      } else if (Math.abs(this.lastOpponentX - this.x) > 8) {
        this.facing = this.lastOpponentX >= this.x ? 1 : -1;
      }
      this.state = 'crouch';
      this.vx *= 0.65;
      return;
    }

    // Movimento horizontal / Corrida
    if (!this.grounded) {
      this.state = 'jump';
      const airSpeed = Fighter.BASE_SPEED * this.getPhaseSpeedMultiplier() * 0.92;
      if (Math.abs(input.moveX) > 0.2) {
        this.vx += (input.moveX * airSpeed - this.vx) * 0.14;
      }
      return;
    }

    if (Math.abs(input.moveX) > 0.25) {
      const speed = Fighter.BASE_SPEED * this.getPhaseSpeedMultiplier();
      this.vx = input.moveX * speed;
      this.facing = input.moveX > 0 ? 1 : -1;
      if (this.state !== 'run') {
        this.state = 'run';
        this.stateTime = 0;
      }
    } else {
      this.vx *= 0.65;
      if (Math.abs(this.vx) < 8) this.vx = 0;
      if (Math.abs(this.lastOpponentX - this.x) > 8) {
        this.facing = this.lastOpponentX >= this.x ? 1 : -1;
      }
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

    // Desaceleração durante o golpe
    this.vx *= Math.pow(0.03, dt);

    // Dispara Projétil (A3) OU VFX 2x2 acoplado/direcionado (A1/A2/A4), sem duplicação
    if (progress >= spec.activeStart) {
      if (spec.isProjectile) {
        if (!this.projectileSpawned) {
          this.projectileSpawned = true;
          this.callbacks?.onSpawnProjectile(this, spec);
        }
      } else if (!this.vfxSpawned) {
        this.vfxSpawned = true;
        const offsetDist = spec.action === 'ataque_4' ? 115 : 80;
        const baseChestY =
          Math.abs(this.attackDirY) < 0.2 ? this.y + spec.offsetY : this.y - 96;
        const vfxX = this.x + this.attackDirX * offsetDist;
        const vfxY = baseChestY + this.attackDirY * offsetDist;
        const followOwner = spec.action === 'ataque_2';
        this.callbacks?.onSpawnAttackVfx(this, spec, vfxX, vfxY, followOwner);
      }
    }

    // Cancelamento de combo (A1 -> A2/A3/A4 no acerto!)
    if (
      this.state === 'ataque_1' &&
      this.attackHitDone &&
      progress >= 0.48
    ) {
      if (input.justA4 && this.tryStartAttack('ataque_4', input)) return;
      if (input.justA3 && this.tryStartAttack('ataque_3', input)) return;
      if (input.justA2 && this.tryStartAttack('ataque_2', input)) return;
    }

    if (this.stateTime >= spec.duration) {
      this.state = this.grounded ? 'idle' : 'jump';
      this.stateTime = 0;
    }
  }

  private resolveAttackDirection(input?: FighterInputState): {
    dirX: number;
    dirY: number;
  } {
    const rawX = input ? input.moveX : 0;
    const rawY = input ? input.moveY : 0;
    const ax =
      Math.abs(rawX) > 0.25 ? rawX : input?.right ? 1 : input?.left ? -1 : 0;
    const ay =
      Math.abs(rawY) > 0.28 ? rawY : input?.down ? 1 : input?.up ? -1 : 0;

    if (ax === 0 && ay === 0) {
      if (Math.abs(this.lastOpponentX - this.x) > 8) {
        this.facing = this.lastOpponentX >= this.x ? 1 : -1;
      }
      return { dirX: this.facing, dirY: 0 };
    }

    if (ax === 0) {
      return { dirX: 0, dirY: ay < 0 ? -1 : 1 };
    }

    this.facing = ax >= 0 ? 1 : -1;
    if (ay === 0) {
      return { dirX: this.facing, dirY: 0 };
    }

    const len = Math.hypot(ax, ay) || 1;
    return { dirX: ax / len, dirY: ay / len };
  }

  private applyAttackLunge(
    action: 'ataque_1' | 'ataque_2' | 'ataque_3' | 'ataque_4',
    spec: AttackSpec
  ): void {
    this.vx = this.attackDirX * spec.lungeX;
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

    const { dirX, dirY } = this.resolveAttackDirection(input);
    this.attackDirX = dirX;
    this.attackDirY = dirY;
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
    this.state = 'hitstun';
    this.stateTime = 0;
    this.hitstunRemaining = hitstun;
    this.vx = pushDir * knockbackX;
    if (knockbackY < -10) {
      this.vy = knockbackY;
      this.grounded = false;
    } else if (knockbackY > 30 && !this.grounded) {
      this.vy = Math.max(this.vy, knockbackY);
    }
    this.comboHitsReceived++;
    this.comboResetTimer = 1.25;
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

    if (this.charId === 'sukuna' && this.phase === 1 && this.state === 'ataque_4') {
      // Santuário Incompleto atinge em área ao redor do Sukuna
      return {
        rect: {
          x: this.x - spec.rangeW * 0.6,
          y: this.y + spec.offsetY - spec.rangeH * 0.5,
          w: spec.rangeW * 1.2,
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
              w: spec.rangeW,
              h: spec.rangeH,
            }
          : {
              x: this.x - 12 - spec.rangeW,
              y: this.y + spec.offsetY - spec.rangeH * 0.5,
              w: spec.rangeW,
              h: spec.rangeH,
            };
      return { rect, spec };
    }

    if (this.attackDirY < -0.78) {
      const w = Math.max(88, spec.rangeH * 1.05);
      const h = spec.rangeW * 1.05;
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
      const h = spec.rangeW * 1.05;
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

    const centerDist = 18 + spec.rangeW * 0.45;
    const cx = this.x + this.attackDirX * centerDist;
    const cy = this.y - 86 + this.attackDirY * centerDist;
    const w = Math.max(
      spec.rangeH,
      Math.abs(this.attackDirX) * spec.rangeW * 0.88 + spec.rangeH * 0.45
    );
    const h = Math.max(
      spec.rangeH,
      Math.abs(this.attackDirY) * spec.rangeW * 0.88 + spec.rangeH * 0.45
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

  public getCurrentFrame(): LoadedFrame | undefined {
    let action: CanonicalAction = 'idle';
    if (this.state === 'evolve') {
      action = 'ataque_4';
    } else if (
      this.state === 'ataque_1' ||
      this.state === 'ataque_2' ||
      this.state === 'ataque_3' ||
      this.state === 'ataque_4'
    ) {
      action = this.getDirectionalAttackAction(this.state);
    } else {
      action = this.state;
    }

    const frames =
      this.phasePack.actions.get(action) ?? this.phasePack.actions.get('idle');
    if (!frames || frames.length === 0) return undefined;

    let idx = 0;
    if (this.state === 'idle') {
      idx = Math.floor(this.stateTime * 6.5) % frames.length;
    } else if (this.state === 'run') {
      idx = Math.floor(this.stateTime * 11) % frames.length;
    } else if (this.state === 'jump') {
      if (this.grounded && this.landingTimer > 0) idx = Math.min(frames.length - 1, 3);
      else if (this.stateTime < 0.09) idx = 0;
      else if (this.vy < -60) idx = Math.min(frames.length - 1, 1);
      else idx = Math.min(frames.length - 1, 2);
    } else if (this.state === 'crouch') {
      // Segura na pose agachada mais baixa (f2) sem voltar a ficar em pé nos frames 3..4
      idx = this.stateTime < 0.08 ? 0 : Math.min(1, frames.length - 1);
    } else if (this.state === 'block') {
      if (this.blockImpactTimer > 0) {
        idx = Math.min(2, frames.length - 1);
      } else {
        idx = this.stateTime < 0.07 ? 0 : Math.min(1, frames.length - 1);
      }
    } else if (this.state === 'hitstun') {
      const totalStun = Math.max(
        0.18,
        this.stateTime + Math.max(0, this.hitstunRemaining)
      );
      const p = Math.min(0.999, this.stateTime / totalStun);
      if (p < 0.25) idx = 0;
      else if (p < 0.55) idx = Math.min(1, frames.length - 1);
      else if (p < 0.80) idx = Math.min(2, frames.length - 1);
      else idx = Math.min(3, frames.length - 1);
    } else if (this.state === 'evolve') {
      idx = Math.floor(this.stateTime * 10) % frames.length;
    } else {
      const spec = this.getAttackSpec(this.state);
      const progress = Math.min(0.999, this.stateTime / spec.duration);
      idx = Math.min(frames.length - 1, Math.floor(progress * frames.length));
    }

    return frames[idx];
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

    const refHeight = Math.max(100, this.phasePack.manifest.refBodyHeight || 350);
    const scale = Fighter.TARGET_BODY_HEIGHT / refHeight;

    let renderScaleX = scale;
    let renderScaleY = scale;
    if (this.state === 'crouch' && frame.meta.rawH >= refHeight * 0.90) {
      renderScaleX = scale * 1.04;
      renderScaleY = scale * 0.86;
    }

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

    // Aura de Fase (mais intensa nas fases 2..4 ou durante evolve/ultimate)
    if (
      this.hp > 0 &&
      (this.phase >= 2 || this.auraFlashTime > 0 || this.state === 'ataque_4')
    ) {
      const auraColor = this.phasePack.manifest.auraColor || '#38bdf8';
      const pulse = 0.88 + 0.14 * Math.sin(performance.now() * 0.012);
      const auraAlpha = this.auraFlashTime > 0 ? 0.55 : 0.18 + (this.phase - 1) * 0.08;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = auraAlpha;
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

    // Desenho do sprite ancorado nos pés com suporte a flipX (facing = -1)
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.facing * renderScaleX, renderScaleY);

    if (this.hp <= 0) {
      ctx.globalAlpha = 0.36;
    } else if (this.state === 'hitstun' && Math.floor(this.stateTime * 25) % 2 === 0) {
      ctx.filter = 'brightness(1.85)';
    }

    ctx.drawImage(
      frame.image,
      -frame.meta.anchorX,
      -frame.meta.anchorY,
      frame.meta.w,
      frame.meta.h
    );
    ctx.restore();

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
