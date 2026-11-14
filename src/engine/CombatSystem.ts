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
  facing: 1 | -1;
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

export interface CombatEvents {
  onHitImpact?: (
    attacker: Fighter,
    defender: Fighter,
    damage: number,
    blocked: boolean,
    isHeavy: boolean
  ) => void;
  onComboUpdate?: (attackerSlot: FighterSlotId, comboCount: number) => void;
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
    facing: 1,
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
    owner?: Fighter
  ): void {
    if (frames.length === 0) return;
    for (const item of this.vfxPool) {
      if (!item.active) {
        item.active = true;
        item.x = x;
        item.y = y;
        item.facing = facing;
        item.frames = frames;
        item.elapsed = 0;
        item.duration = duration;
        item.scale = scale;
        item.owner = owner;
        item.offsetX = owner ? Math.abs(x - owner.x) : 0;
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
    this.enqueueVfxFrames(
      frames,
      x,
      y,
      fighter.facing,
      duration,
      scale,
      followOwner ? fighter : undefined
    );
  }

  public spawnProjectile(fighter: Fighter, spec: AttackSpec): void {
    const frames = fighter.phasePack.vfx.get(spec.vfx) ?? [];
    for (const proj of this.projPool) {
      if (!proj.active) {
        proj.active = true;
        proj.ownerSlot = fighter.slot;
        proj.ownerTeam = fighter.team;
        proj.x = fighter.x + fighter.facing * 72;
        proj.y = fighter.y + spec.offsetY;
        proj.vx = fighter.facing * spec.projectileSpeed;
        proj.facing = fighter.facing;
        proj.w = 88;
        proj.h = 68;
        proj.damage = Math.round(spec.damage * fighter.getPhaseDamageMultiplier());
        proj.knockbackX = spec.knockbackX;
        proj.knockbackY = spec.knockbackY;
        proj.hitstun = spec.hitstun;
        proj.hitStop = spec.hitStop;
        proj.kiGain = spec.kiGainOnHit;
        proj.auraColor = fighter.phasePack.manifest.auraColor || '#38bdf8';
        proj.frames = frames;
        proj.elapsed = 0;
        proj.life = 1.65;
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

  public triggerScreenShake(intensity: number, duration: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  public triggerEvolutionBurst(fighter: Fighter, newPhase: number): void {
    const color = fighter.phasePack.manifest.auraColor || '#facc15';
    this.spawnBurstParticles(fighter.x, fighter.y - 95, color, 28, 440);
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

    // Empurrão suave de corpo (impede sobreposição total no chão)
    this.resolveBodyPush(p1, p2);

    // Colisões corpo a corpo
    this.checkMeleeHit(p1, p2);
    this.checkMeleeHit(p2, p1);

    // Projéteis
    this.updateProjectiles(dt, p1, p2);

    return true;
  }

  private resolveBodyPush(p1: Fighter, p2: Fighter): void {
    const dx = p2.x - p1.x;
    const minDist = 66;
    const dy = Math.abs(p2.y - p1.y);
    if (Math.abs(dx) < minDist && dy < 110) {
      const overlap = (minDist - Math.abs(dx)) * 0.5;
      const sign = dx >= 0 ? 1 : -1;
      p1.x = Math.max(
        Fighter.ARENA_LEFT,
        Math.min(Fighter.ARENA_RIGHT, p1.x - sign * overlap)
      );
      p2.x = Math.max(
        Fighter.ARENA_LEFT,
        Math.min(Fighter.ARENA_RIGHT, p2.x + sign * overlap)
      );
    }
  }

  private checkMeleeHit(attacker: Fighter, defender: Fighter): void {
    if (defender.invulnTime > 0 || defender.hp <= 0) return;
    const activeHit = attacker.getActiveAttackHitbox();
    if (!activeHit) return;

    const hurtbox = defender.getHurtbox();
    if (!rectsOverlap(activeHit.rect, hurtbox)) return;

    attacker.attackHitDone = true;
    const spec = activeHit.spec;
    const scaledDamage = spec.damage * attacker.getPhaseDamageMultiplier();

    const result = defender.receiveHit(
      scaledDamage,
      spec.knockbackX,
      spec.knockbackY,
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
        spec.action === 'ataque_4' ? 26 : 14,
        spec.action === 'ataque_4' ? 420 : 280
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

  private updateProjectiles(dt: number, p1: Fighter, p2: Fighter): void {
    for (const proj of this.projPool) {
      if (!proj.active) continue;
      proj.x += proj.vx * dt;
      proj.elapsed += dt;
      proj.life -= dt;

      const outOfBounds =
        proj.x < Fighter.ARENA_LEFT - 120 ||
        proj.x > Fighter.ARENA_RIGHT + 120;
      if (proj.life <= 0 || outOfBounds) {
        if (!outOfBounds && proj.frames.length >= 3) {
          this.enqueueVfxFrames(
            proj.frames.slice(2),
            proj.x,
            proj.y,
            proj.facing,
            0.22,
            0.48
          );
        }
        proj.active = false;
        continue;
      }

      const attacker = proj.ownerSlot === 'p1' ? p1 : p2;
      const defender = proj.ownerSlot === 'p1' ? p2 : p1;
      if (defender.invulnTime > 0 || defender.hp <= 0) continue;

      const projRect: Rect = {
        x: proj.x - proj.w * 0.5,
        y: proj.y - proj.h * 0.5,
        w: proj.w,
        h: proj.h,
      };

      if (rectsOverlap(projRect, defender.getHurtbox())) {
        proj.active = false;
        if (proj.frames.length >= 3) {
          this.enqueueVfxFrames(
            proj.frames.slice(2),
            proj.x,
            proj.y,
            proj.facing,
            0.24,
            0.52
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
          attacker.ki = Math.min(attacker.maxKi, attacker.ki + proj.kiGain);
          attacker.addCombatXpAndEnergy(14, 18);
          this.hitStopRemaining = Math.max(this.hitStopRemaining, proj.hitStop);
          this.triggerScreenShake(7, 0.16);
          if (defender.comboHitsReceived >= 2) {
            this.events?.onComboUpdate?.(attacker.slot, defender.comboHitsReceived);
          }
        }

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
          v.x = v.owner.x + v.owner.facing * v.offsetX;
          v.y = v.owner.y + v.offsetY;
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
  }

  private drawCelVfxFrame(
    ctx: CanvasRenderingContext2D,
    frame: LoadedFrame,
    x: number,
    y: number,
    facing: 1 | -1,
    scale: number,
    alpha: number
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing * scale, scale);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.92 * alpha;
    ctx.drawImage(
      frame.image,
      -frame.meta.anchorX,
      -frame.meta.anchorY,
      frame.meta.w,
      frame.meta.h
    );

    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.22 * alpha;
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
    // VFX de ataques 2x2
    for (const v of this.vfxPool) {
      if (!v.active || v.frames.length === 0) continue;
      const progress = v.elapsed / v.duration;
      const idx = Math.min(
        v.frames.length - 1,
        Math.floor(progress * v.frames.length)
      );
      const fadeAlpha =
        progress > 0.75 ? Math.max(0, 1 - (progress - 0.75) / 0.25) : 1;
      this.drawCelVfxFrame(
        ctx,
        v.frames[idx],
        v.x,
        v.y,
        v.facing,
        v.scale,
        fadeAlpha
      );
    }

    // Projéteis (quadros 1..2 durante o voo; quadros 3..4 ao colidir)
    for (const proj of this.projPool) {
      if (!proj.active) continue;
      if (proj.frames.length > 0) {
        const idx =
          proj.elapsed < 0.06 ? 0 : Math.min(1, proj.frames.length - 1);
        this.drawCelVfxFrame(
          ctx,
          proj.frames[idx],
          proj.x,
          proj.y,
          proj.facing,
          0.44,
          1
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
