import {
  AttackSpec,
  Fighter,
  FighterSlotId,
  FighterTeam,
  Rect,
} from '../game/Fighter';
import { CanonicalVfx, LoadedFrame } from './SpriteLoader';

interface VfxInstance {
  active: boolean;
  x: number;
  y: number;
  facing: 1 | -1;
  angle: number;
  frames: LoadedFrame[];
  elapsed: number;
  duration: number;
  scale: number;
  owner?: Fighter;
  offsetX: number;
  offsetY: number;
}

interface Projectile {
  active: boolean;
  ownerSlot: FighterSlotId;
  ownerTeam: FighterTeam;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  angle: number;
  w: number;
  h: number;
  damage: number;
  knockbackX: number;
  knockbackY: number;
  hitstun: number;
  hitStop: number;
  kiGain: number;
  auraColor: string;
  frames: LoadedFrame[];
  elapsed: number;
  life: number;
  trailTimer: number;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
}

interface FloatingText {
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

interface ShockwaveRing {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface CombatEvents {
  onHitImpact?: (
    attacker: Fighter,
    defender: Fighter,
    damage: number,
    blocked: boolean,
    isHeavy: boolean
  ) => void;
  onComboUpdate?: (attackerSlot: FighterSlotId, comboCount: number) => void;
  onClash?: (x: number, y: number) => void;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export class CombatSystem {
  // Pools pré-alocados (zero garbage collection em combate, dimensionados para até 6 lutadores)
  private readonly vfxPool: VfxInstance[] = Array.from({ length: 42 }, () => ({
    active: false,
    x: 0,
    y: 0,
    facing: 1,
    angle: 0,
    frames: [],
    elapsed: 0,
    duration: 0.35,
    scale: 0.55,
    owner: undefined,
    offsetX: 0,
    offsetY: 0,
  }));

  private readonly projPool: Projectile[] = Array.from({ length: 28 }, () => ({
    active: false,
    ownerSlot: 'p1',
    ownerTeam: 1,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    facing: 1,
    angle: 0,
    w: 76,
    h: 58,
    damage: 0,
    knockbackX: 0,
    knockbackY: 0,
    hitstun: 0,
    hitStop: 0,
    kiGain: 0,
    auraColor: '#38bdf8',
    frames: [],
    elapsed: 0,
    life: 0,
    trailTimer: 0,
  }));

  private readonly particlePool: Particle[] = Array.from({ length: 200 }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    size: 4,
    life: 0,
    maxLife: 0.3,
    color: '#ffffff',
  }));

  private readonly textPool: FloatingText[] = Array.from({ length: 28 }, () => ({
    active: false,
    x: 0,
    y: 0,
    vy: -60,
    text: '',
    color: '#ffffff',
    life: 0,
    maxLife: 0.65,
    scale: 1,
  }));

  private readonly shockwavePool: ShockwaveRing[] = Array.from({ length: 10 }, () => ({
    active: false,
    x: 0,
    y: 0,
    radius: 10,
    maxRadius: 110,
    life: 0,
    maxLife: 0.28,
    color: '#facc15',
  }));

  public hitStopRemaining = 0;
  public shakeTime = 0;
  public shakeIntensity = 0;
  public flashAlpha = 0;

  private events?: CombatEvents;

  public setEvents(events: CombatEvents): void {
    this.events = events;
  }

  public clearAll(): void {
    for (const v of this.vfxPool) v.active = false;
    for (const p of this.projPool) p.active = false;
    for (const pt of this.particlePool) pt.active = false;
    for (const tx of this.textPool) tx.active = false;
    for (const sw of this.shockwavePool) sw.active = false;
    this.hitStopRemaining = 0;
    this.shakeTime = 0;
    this.shakeIntensity = 0;
    this.flashAlpha = 0;
  }

  private enqueueVfxFrames(
    frames: LoadedFrame[],
    x: number,
    y: number,
    facing: 1 | -1,
    duration: number,
    scale: number,
    owner?: Fighter,
    angle = 0
  ): void {
    if (frames.length === 0) return;
    for (const item of this.vfxPool) {
      if (!item.active) {
        item.active = true;
        item.x = x;
        item.y = y;
        item.facing = facing;
        item.angle = angle;
        item.frames = frames;
        item.elapsed = 0;
        item.duration = duration;
        item.scale = scale;
        item.owner = owner;
        item.offsetX = owner ? x - owner.x : 0;
        item.offsetY = owner ? y - owner.y : 0;
        return;
      }
    }
  }

  public spawnVfx(
    fighter: Fighter,
    vfxKey: CanonicalVfx,
    x: number,
    y: number,
    duration = 0.36,
    scale = 0.56,
    followOwner = false
  ): void {
    const frames = fighter.phasePack.vfx.get(vfxKey);
    if (!frames || frames.length === 0) return;
    const refQuadH = frames[0].meta.quadH || 384;
    const normScale = scale * (384 / Math.max(240, refQuadH));
    const angle = Math.atan2(
      fighter.attackDirY,
      fighter.attackDirX * fighter.facing
    );
    this.enqueueVfxFrames(
      frames,
      x,
      y,
      fighter.facing,
      duration,
      normScale,
      followOwner ? fighter : undefined,
      angle
    );
  }

  public spawnProjectile(fighter: Fighter, spec: AttackSpec): void {
    const frames = fighter.phasePack.vfx.get(spec.vfx) ?? [];
    const dirLen = Math.hypot(fighter.attackDirX, fighter.attackDirY);
    const dirX = dirLen > 0.01 ? fighter.attackDirX / dirLen : fighter.facing;
    const dirY = dirLen > 0.01 ? fighter.attackDirY / dirLen : 0;
    const baseChestY =
      Math.abs(dirY) < 0.2 ? fighter.y + spec.offsetY : fighter.y - 96;

    for (const proj of this.projPool) {
      if (!proj.active) {
        proj.active = true;
        proj.ownerSlot = fighter.slot;
        proj.ownerTeam = fighter.team;
        proj.x = fighter.x + dirX * 72;
        proj.y = baseChestY + dirY * 72;
        proj.vx = dirX * spec.projectileSpeed;
        proj.vy = dirY * spec.projectileSpeed;
        proj.facing = fighter.facing;
        proj.angle = Math.atan2(dirY, dirX * fighter.facing);
        proj.w = 88;
        proj.h = 68;
        proj.damage = Math.round(spec.damage * fighter.getPhaseDamageMultiplier());
        proj.knockbackX = spec.knockbackX;
        proj.knockbackY =
          dirY < -0.32
            ? Math.min(spec.knockbackY, -460)
            : dirY > 0.32
              ? Math.max(spec.knockbackY, 360)
              : spec.knockbackY;
        proj.hitstun = spec.hitstun;
        proj.hitStop = spec.hitStop;
        proj.kiGain = spec.kiGainOnHit;
        proj.auraColor = fighter.phasePack.manifest.auraColor || '#38bdf8';
        proj.frames = frames;
        proj.elapsed = 0;
        proj.life = 1.75;
        proj.trailTimer = 0;
        return;
      }
    }
  }

  public spawnBurstParticles(
    x: number,
    y: number,
    color: string,
    count: number,
    speed = 320
  ): void {
    let spawned = 0;
    for (const pt of this.particlePool) {
      if (!pt.active) {
        const angle = (Math.PI * 2 * spawned) / Math.max(1, count) + Math.random() * 0.45;
        const mag = speed * (0.45 + Math.random() * 0.75);
        pt.active = true;
        pt.x = x;
        pt.y = y;
        pt.vx = Math.cos(angle) * mag;
        pt.vy = Math.sin(angle) * mag - 45;
        pt.size = 3 + Math.random() * 5;
        pt.maxLife = 0.25 + Math.random() * 0.28;
        pt.life = pt.maxLife;
        pt.color = color;
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  public spawnFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
    scale = 1
  ): void {
    for (const tx of this.textPool) {
      if (!tx.active) {
        tx.active = true;
        tx.x = x;
        tx.y = y;
        tx.vy = -68;
        tx.text = text;
        tx.color = color;
        tx.maxLife = 0.7;
        tx.life = 0.7;
        tx.scale = scale;
        return;
      }
    }
  }

  public spawnShockwave(
    x: number,
    y: number,
    color = '#facc15',
    maxRadius = 115,
    duration = 0.26
  ): void {
    for (const sw of this.shockwavePool) {
      if (!sw.active) {
        sw.active = true;
        sw.x = x;
        sw.y = y;
        sw.radius = 14;
        sw.maxRadius = maxRadius;
        sw.life = duration;
        sw.maxLife = duration;
        sw.color = color;
        return;
      }
    }
  }

  public spawnDustPuff(x: number, y: number, count = 5): void {
    let spawned = 0;
    for (const pt of this.particlePool) {
      if (!pt.active) {
        const spread = (Math.random() - 0.5) * 2;
        pt.active = true;
        pt.x = x + spread * 14;
        pt.y = y - 2;
        pt.vx = spread * (55 + Math.random() * 55);
        pt.vy = -28 - Math.random() * 42;
        pt.size = 3.5 + Math.random() * 3.5;
        pt.maxLife = 0.22 + Math.random() * 0.14;
        pt.life = pt.maxLife;
        pt.color = 'rgba(226, 232, 240, 0.72)';
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  public triggerScreenShake(intensity: number, duration: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  public triggerEvolutionBurst(fighter: Fighter, newPhase: number): void {
    const color = fighter.phasePack.manifest.auraColor || '#facc15';
    this.spawnBurstParticles(fighter.x, fighter.y - 95, color, 24, 420);
    this.spawnShockwave(fighter.x, fighter.y - 95, color, 175, 0.34);
    this.spawnVfx(fighter, 'vfx_ataque_4', fighter.x, fighter.y - 95, 0.55, 0.75);
    this.spawnFloatingText(
      fighter.x,
      fighter.y - 195,
      `FASE ${newPhase}!`,
      color,
      1.35
    );
    this.triggerScreenShake(12, 0.32);
    this.flashAlpha = 0.45;
  }

  public update(dt: number, p1: Fighter, p2: Fighter): boolean {
    return this.updateMulti(dt, [p1, p2], p1.arenaLeft, p1.arenaRight);
  }

  public updateMulti(
    dt: number,
    fighters: Fighter[],
    arenaLeft = Fighter.ARENA_LEFT,
    arenaRight = Fighter.ARENA_RIGHT
  ): boolean {
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      if (this.shakeTime === 0) this.shakeIntensity = 0;
    }
    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 1.8);
    }

    // Atualiza VFX, partículas e textos mesmo durante hit-stop para fluidez visual
    this.updatePools(dt);

    // Hit-stop pausa física e colisões por poucos frames ao acertar golpes fortes
    if (this.hitStopRemaining > 0) {
      this.hitStopRemaining = Math.max(0, this.hitStopRemaining - dt);
      return false;
    }

    // Choque simultâneo (Clash) quando dois golpes corpo a corpo colidem no mesmo instante
    for (let i = 0; i < fighters.length; i++) {
      const a = fighters[i];
      if (a.hp <= 0) continue;
      const hitA = a.getActiveAttackHitbox();
      if (!hitA || hitA.spec.isProjectile) continue;
      for (let j = i + 1; j < fighters.length; j++) {
        const b = fighters[j];
        if (b.hp <= 0 || a.team === b.team) continue;
        if (
          a.hitTargetsInCurrentAttack.has(b.slot) ||
          b.hitTargetsInCurrentAttack.has(a.slot)
        ) {
          continue;
        }
        const hitB = b.getActiveAttackHitbox();
        if (!hitB || hitB.spec.isProjectile) continue;
        if (!rectsOverlap(hitA.rect, hitB.rect)) continue;

        a.hitTargetsInCurrentAttack.add(b.slot);
        b.hitTargetsInCurrentAttack.add(a.slot);
        a.attackHitDone = true;
        b.attackHitDone = true;

        const dir = a.x <= b.x ? 1 : -1;
        a.vx = -dir * 185;
        b.vx = dir * 185;
        const cx = (a.x + b.x) * 0.5;
        const cy = (a.y + b.y) * 0.5 - 95;
        this.spawnBurstParticles(cx, cy, '#facc15', 12, 260);
        this.spawnShockwave(cx, cy, '#facc15', 110, 0.24);
        this.spawnFloatingText(cx, cy - 55, 'CHOQUE!', '#facc15', 1.05);
        this.hitStopRemaining = Math.max(this.hitStopRemaining, 0.045);
        this.triggerScreenShake(4, 0.12);
        this.events?.onClash?.(cx, cy);
      }
    }

    // Colisões corpo a corpo entre times opostos (pushbox é aplicado em ArenaScene pós-movimento)
    for (let i = 0; i < fighters.length; i++) {
      const attacker = fighters[i];
      if (attacker.hp <= 0) continue;
      for (let j = 0; j < fighters.length; j++) {
        if (i === j) continue;
        const defender = fighters[j];
        if (attacker.team === defender.team) continue;
        this.checkMeleeHit(attacker, defender);
      }
    }

    // Projéteis
    this.updateProjectilesMulti(dt, fighters, arenaLeft, arenaRight);

    return true;
  }

  public resolveBodyPushMulti(fighters: Fighter[], dt = 1 / 60): void {
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < fighters.length; i++) {
        const a = fighters[i];
        if (a.hp <= 0) continue;
        for (let j = i + 1; j < fighters.length; j++) {
          const b = fighters[j];
          if (b.hp <= 0) continue;
          const dx = b.x - a.x;
          const absDx = Math.abs(dx);
          const dy = Math.abs(b.y - a.y);
          const minDist = Math.max(100, Math.round(a.getPushRadius() + b.getPushRadius()));

          if (absDx < minDist && dy < 115) {
            const needed = minDist - absDx;
            const stepPush =
              needed > 48 ? needed : Math.min(needed, Math.max(4, 380 * dt));
            const sign =
              absDx > 0.5
                ? dx > 0
                  ? 1
                  : -1
                : a.slot < b.slot
                  ? 1
                  : -1;
            const prevAx = a.x;
            const prevBx = b.x;
            a.x = Math.max(
              a.arenaLeft,
              Math.min(a.arenaRight, a.x - sign * stepPush * 0.5)
            );
            b.x = Math.max(
              b.arenaLeft,
              Math.min(b.arenaRight, b.x + sign * stepPush * 0.5)
            );
            const movedA = Math.abs(a.x - prevAx);
            const movedB = Math.abs(b.x - prevBx);
            const leftover = stepPush - (movedA + movedB);
            if (leftover > 0.1) {
              // Transfere excedente quando um lutador está encostado na parede da arena
              a.x = Math.max(
                a.arenaLeft,
                Math.min(a.arenaRight, a.x - sign * leftover)
              );
              b.x = Math.max(
                b.arenaLeft,
                Math.min(b.arenaRight, b.x + sign * leftover)
              );
            }
          } else if (
            dy >= 95 &&
            dy < 150 &&
            absDx < minDist * 0.72 &&
            (!a.grounded || !b.grounded)
          ) {
            // Escorregamento aéreo suave evita cair exatamente em cima do outro lutador
            const slideSign =
              absDx > 2 ? (dx > 0 ? 1 : -1) : a.slot < b.slot ? 1 : -1;
            const slide = 210 * dt;
            if (!a.grounded) {
              a.x = Math.max(a.arenaLeft, Math.min(a.arenaRight, a.x - slideSign * slide));
            }
            if (!b.grounded) {
              b.x = Math.max(b.arenaLeft, Math.min(b.arenaRight, b.x + slideSign * slide));
            }
          }
        }
      }
    }
  }

  private checkMeleeHit(attacker: Fighter, defender: Fighter): void {
    if (
      attacker.hp <= 0 ||
      defender.hp <= 0 ||
      attacker.team === defender.team ||
      defender.invulnTime > 0 ||
      attacker.hitTargetsInCurrentAttack.has(defender.slot)
    ) {
      return;
    }
    const activeHit = attacker.getActiveAttackHitbox();
    if (!activeHit) return;

    const hurtbox = defender.getHurtbox();
    if (!rectsOverlap(activeHit.rect, hurtbox)) return;

    attacker.hitTargetsInCurrentAttack.add(defender.slot);
    attacker.attackHitDone = true;
    const spec = activeHit.spec;
    const scaledDamage = spec.damage * attacker.getPhaseDamageMultiplier();

    let kbX = spec.knockbackX;
    let kbY = spec.knockbackY;
    if (attacker.attackDirY < -0.32) {
      kbY = Math.min(spec.knockbackY, -520 * Math.abs(attacker.attackDirY) - 180);
      kbX = spec.knockbackX * Math.max(0.35, Math.abs(attacker.attackDirX));
    } else if (attacker.attackDirY > 0.32) {
      kbY = Math.max(spec.knockbackY, 440 * attacker.attackDirY + 140);
      kbX = spec.knockbackX * Math.max(0.4, Math.abs(attacker.attackDirX));
    }

    const result = defender.receiveHit(
      scaledDamage,
      kbX,
      kbY,
      spec.hitstun,
      attacker.x
    );

    const impactX = (attacker.x + defender.x) * 0.5;
    const impactY = defender.y - 95;

    if (result.blocked) {
      this.spawnBurstParticles(impactX, impactY, '#38bdf8', 10, 220);
      this.spawnFloatingText(defender.x, defender.y - 165, 'DEFESA', '#38bdf8', 0.9);
      this.hitStopRemaining = Math.max(this.hitStopRemaining, spec.hitStop * 0.6);
      attacker.addCombatXpAndEnergy(4, 6);
    } else {
      const color =
        spec.action === 'ataque_4'
          ? '#facc15'
          : attacker.phasePack.manifest.auraColor || '#ff3b5c';
      this.spawnBurstParticles(
        impactX,
        impactY,
        color,
        spec.action === 'ataque_4' ? 18 : 9,
        spec.action === 'ataque_4' ? 380 : 250
      );
      this.spawnFloatingText(
        defender.x,
        defender.y - 175,
        `-${result.finalDamage}`,
        spec.action === 'ataque_4' ? '#facc15' : '#ffffff',
        spec.action === 'ataque_4' ? 1.3 : 1
      );

      attacker.ki = Math.min(attacker.maxKi, attacker.ki + spec.kiGainOnHit);
      attacker.addCombatXpAndEnergy(
        spec.action === 'ataque_4' ? 24 : 12,
        spec.action === 'ataque_4' ? 28 : 16
      );

      this.hitStopRemaining = Math.max(this.hitStopRemaining, spec.hitStop);
      if (spec.action === 'ataque_4' || spec.action === 'ataque_2') {
        this.triggerScreenShake(
          spec.action === 'ataque_4' ? 14 : 6,
          spec.action === 'ataque_4' ? 0.28 : 0.14
        );
      }
      if (spec.action === 'ataque_4') {
        this.flashAlpha = 0.35;
        this.spawnShockwave(impactX, impactY, color, 150, 0.28);
      }

      if (defender.comboHitsReceived >= 2) {
        this.events?.onComboUpdate?.(attacker.slot, defender.comboHitsReceived);
      }
    }

    this.events?.onHitImpact?.(
      attacker,
      defender,
      result.finalDamage,
      result.blocked,
      spec.action === 'ataque_4' || spec.action === 'ataque_2'
    );
  }

  private updateProjectilesMulti(
    dt: number,
    fighters: Fighter[],
    arenaLeft: number,
    arenaRight: number
  ): void {
    for (const proj of this.projPool) {
      if (!proj.active) continue;
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.elapsed += dt;
      proj.life -= dt;
      proj.trailTimer -= dt;
      if (proj.trailTimer <= 0) {
        proj.trailTimer = 0.04;
        this.spawnBurstParticles(proj.x, proj.y, proj.auraColor, 2, 70);
      }

      const outOfBounds =
        proj.x < arenaLeft - 160 ||
        proj.x > arenaRight + 160 ||
        proj.y < -280 ||
        proj.y > 920;
      if (proj.life <= 0 || outOfBounds) {
        if (!outOfBounds && proj.frames.length >= 2) {
          this.enqueueVfxFrames(
            proj.frames.slice(Math.max(0, proj.frames.length - 2)),
            proj.x,
            proj.y,
            proj.facing,
            0.24,
            0.48 * (384 / Math.max(240, proj.frames[0].meta.quadH || 384)),
            undefined,
            proj.angle
          );
        }
        proj.active = false;
        continue;
      }

      const projRect: Rect = {
        x: proj.x - proj.w * 0.5,
        y: proj.y - proj.h * 0.5,
        w: proj.w,
        h: proj.h,
      };

      const defender = fighters.find(
        (f) =>
          f.team !== proj.ownerTeam &&
          f.invulnTime <= 0 &&
          f.hp > 0 &&
          rectsOverlap(projRect, f.getHurtbox())
      );
      if (!defender) continue;

      const attacker = fighters.find((f) => f.slot === proj.ownerSlot);
      proj.active = false;
      if (proj.frames.length >= 2) {
        this.enqueueVfxFrames(
          proj.frames.slice(Math.max(0, proj.frames.length - 2)),
          proj.x,
          proj.y,
          proj.facing,
          0.26,
          0.52 * (384 / Math.max(240, proj.frames[0].meta.quadH || 384)),
          undefined,
          proj.angle
        );
      }
      const result = defender.receiveHit(
        proj.damage,
        proj.knockbackX,
        proj.knockbackY,
        proj.hitstun,
        proj.x
      );

      if (result.blocked) {
        this.spawnBurstParticles(proj.x, proj.y, '#38bdf8', 10, 230);
        this.spawnFloatingText(defender.x, defender.y - 165, 'DEFESA', '#38bdf8', 0.9);
      } else {
        this.spawnBurstParticles(proj.x, proj.y, proj.auraColor, 18, 320);
        this.spawnFloatingText(
          defender.x,
          defender.y - 175,
          `-${result.finalDamage}`,
          '#38bdf8',
          1.1
        );
        if (attacker) {
          attacker.ki = Math.min(attacker.maxKi, attacker.ki + proj.kiGain);
          attacker.addCombatXpAndEnergy(14, 18);
          if (defender.comboHitsReceived >= 2) {
            this.events?.onComboUpdate?.(attacker.slot, defender.comboHitsReceived);
          }
        }
        this.hitStopRemaining = Math.max(this.hitStopRemaining, proj.hitStop);
        this.triggerScreenShake(7, 0.16);
      }

      if (attacker) {
        this.events?.onHitImpact?.(
          attacker,
          defender,
          result.finalDamage,
          result.blocked,
          true
        );
      }
    }
  }

  private updatePools(dt: number): void {
    for (const v of this.vfxPool) {
      if (!v.active) continue;
      v.elapsed += dt;
      if (v.owner) {
        if (
          v.owner.state === 'ataque_1' ||
          v.owner.state === 'ataque_2' ||
          v.owner.state === 'ataque_3' ||
          v.owner.state === 'ataque_4'
        ) {
          v.facing = v.owner.facing;
          v.x = v.owner.x + v.offsetX;
          v.y = v.owner.y + v.offsetY;
          v.angle = Math.atan2(
            v.owner.attackDirY,
            v.owner.attackDirX * v.owner.facing
          );
        } else {
          v.owner = undefined;
        }
      }
      if (v.elapsed >= v.duration) {
        v.active = false;
        v.owner = undefined;
      }
    }

    for (const pt of this.particlePool) {
      if (!pt.active) continue;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 450 * dt;
      pt.life -= dt;
      if (pt.life <= 0) {
        pt.active = false;
      }
    }

    for (const tx of this.textPool) {
      if (!tx.active) continue;
      tx.y += tx.vy * dt;
      tx.life -= dt;
      if (tx.life <= 0) {
        tx.active = false;
      }
    }

    for (const sw of this.shockwavePool) {
      if (!sw.active) continue;
      sw.life -= dt;
      const t = 1 - Math.max(0, sw.life / sw.maxLife);
      sw.radius = 14 + (sw.maxRadius - 14) * (1 - Math.pow(1 - t, 2));
      if (sw.life <= 0) {
        sw.active = false;
      }
    }
  }

  private drawCelVfxFrame(
    ctx: CanvasRenderingContext2D,
    frame: LoadedFrame,
    x: number,
    y: number,
    facing: 1 | -1,
    scale: number,
    alpha: number,
    angle = 0
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing * scale, scale);
    if (angle !== 0) {
      ctx.rotate(angle);
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.78 * alpha;
    ctx.drawImage(
      frame.image,
      -frame.meta.anchorX,
      -frame.meta.anchorY,
      frame.meta.w,
      frame.meta.h
    );

    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.14 * alpha;
    ctx.drawImage(
      frame.image,
      -frame.meta.anchorX,
      -frame.meta.anchorY,
      frame.meta.w,
      frame.meta.h
    );

    ctx.restore();
  }

  public render(ctx: CanvasRenderingContext2D): void {
    // VFX de ataques com crossfade entre quadros e curva pop-in/fade-out
    for (const v of this.vfxPool) {
      if (!v.active || v.frames.length === 0) continue;
      const progress = Math.max(0, Math.min(1, v.elapsed / v.duration));
      const exact = progress * v.frames.length;
      const idx = Math.min(v.frames.length - 1, Math.floor(exact));
      const frac = exact - idx;
      const fadeAlpha =
        progress > 0.72 ? Math.max(0, 1 - (progress - 0.72) / 0.28) : 1;
      const popScale =
        v.scale *
        (progress < 0.14
          ? 0.84 + 0.22 * (progress / 0.14)
          : 1.06 - 0.1 * progress);

      if (idx < v.frames.length - 1 && frac > 0.68) {
        const blend = (frac - 0.68) / 0.32;
        this.drawCelVfxFrame(
          ctx,
          v.frames[idx],
          v.x,
          v.y,
          v.facing,
          popScale,
          fadeAlpha * (1 - blend),
          v.angle
        );
        this.drawCelVfxFrame(
          ctx,
          v.frames[idx + 1],
          v.x,
          v.y,
          v.facing,
          popScale,
          fadeAlpha * blend,
          v.angle
        );
      } else {
        this.drawCelVfxFrame(
          ctx,
          v.frames[idx],
          v.x,
          v.y,
          v.facing,
          popScale,
          fadeAlpha,
          v.angle
        );
      }
    }

    // Projéteis animados em loop durante o voo
    for (const proj of this.projPool) {
      if (!proj.active) continue;
      if (proj.frames.length > 0) {
        const flyCount =
          proj.frames.length > 2 ? proj.frames.length - 2 : proj.frames.length;
        const idx = Math.floor(proj.elapsed * 14) % Math.max(1, flyCount);
        const frame = proj.frames[idx];
        const normScale =
          0.44 *
          (384 / Math.max(240, frame.meta.quadH || 384)) *
          (1 + 0.05 * Math.sin(proj.elapsed * 26));
        this.drawCelVfxFrame(
          ctx,
          frame,
          proj.x,
          proj.y,
          proj.facing,
          normScale,
          1,
          proj.angle
        );
      } else {
        ctx.save();
        ctx.fillStyle = proj.auraColor;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Partículas
    for (const pt of this.particlePool) {
      if (!pt.active) continue;
      const alpha = Math.max(0, pt.life / pt.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Ondas de choque (Clash / Ultimate / Evolução)
    for (const sw of this.shockwavePool) {
      if (!sw.active) continue;
      const alpha = Math.max(0, sw.life / sw.maxLife);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * 0.72;
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = Math.max(1.5, 5 * alpha);
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Textos flutuantes de dano/status
    for (const tx of this.textPool) {
      if (!tx.active) continue;
      const alpha = Math.max(0, tx.life / tx.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${Math.round(22 * tx.scale)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.strokeText(tx.text, tx.x, tx.y);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.text, tx.x, tx.y);
      ctx.restore();
    }
  }
}
