import { FighterInputState } from '../engine/InputManager';
import type { ArenaPlatform } from './ArenaMap';
import { ATTACK_SPECS, Fighter } from './Fighter';

export type AIDifficulty = 'easy' | 'medium' | 'master';

function emptyAiInput(): FighterInputState {
  return {
    moveX: 0,
    moveY: 0,
    left: false,
    right: false,
    up: false,
    down: false,
    a1: false,
    a2: false,
    a3: false,
    a4: false,
    block: false,
    jump: false,
    evolve: false,
    justA1: false,
    justA2: false,
    justA3: false,
    justA4: false,
    justJump: false,
    justEvolve: false,
  };
}

export class AIController {
  private difficulty: AIDifficulty;
  private thinkTimer = 0;
  private blockTimer = 0;
  private moveDir = 0;
  private blockFaceDir: 1 | -1 = 1;
  private wantJump = false;
  private wantDropDown = false;
  private queuedAttack: 'a1' | 'a2' | 'a3' | 'a4' | null = null;
  private aimY = 0;
  private wantEvolve = false;

  private computeAimY(dx: number, dy: number): number {
    const absY = Math.abs(dy);
    if (absY < 48) return 0;
    if (Math.abs(dx) < 75) return dy < 0 ? -1 : 1;
    return dy < 0 ? -0.78 : 0.78;
  }

  private queueDirectionalAttack(
    atk: 'a1' | 'a2' | 'a3' | 'a4',
    dx: number,
    dy: number
  ): void {
    this.queuedAttack = atk;
    this.aimY = this.computeAimY(dx, dy);
    if (Math.abs(this.aimY) >= 0.99) {
      this.moveDir = 0;
    }
  }

  constructor(difficulty: AIDifficulty = 'medium') {
    this.difficulty = difficulty;
  }

  public setDifficulty(diff: AIDifficulty): void {
    this.difficulty = diff;
  }

  public sample(dt: number, self: Fighter, target: Fighter): FighterInputState {
    return this.sampleMulti(dt, self, [target], []);
  }

  public sampleMulti(
    dt: number,
    self: Fighter,
    candidates: Fighter[],
    platforms: ArenaPlatform[] = []
  ): FighterInputState {
    if (self.hp <= 0) {
      return emptyAiInput();
    }

    const livingEnemies = candidates.filter(
      (e) => e !== self && e.team !== self.team && e.hp > 0
    );
    if (livingEnemies.length === 0) {
      return emptyAiInput();
    }

    let target = livingEnemies[0];
    let bestScore = Infinity;
    for (const enemy of livingEnemies) {
      const score =
        Math.abs(enemy.x - self.x) +
        Math.abs(enemy.y - self.y) * 1.45 +
        (enemy.hp / enemy.maxHp) * 80;
      if (score < bestScore) {
        bestScore = score;
        target = enemy;
      }
    }

    this.thinkTimer -= dt;
    this.blockTimer = Math.max(0, this.blockTimer - dt);

    const dx = target.x - self.x;
    const dy = target.y - self.y;
    const dist = Math.abs(dx);
    const dirToTarget = dx >= 0 ? 1 : -1;

    // Reage quando o oponente ataca de perto na mesma faixa vertical
    const playerAttacking =
      target.state === 'ataque_1' ||
      target.state === 'ataque_2' ||
      target.state === 'ataque_4';

    const reactionInterval =
      this.difficulty === 'easy' ? 0.50 : this.difficulty === 'medium' ? 0.30 : 0.18;
    const blockChance =
      this.difficulty === 'easy' ? 0.2 : this.difficulty === 'medium' ? 0.55 : 0.82;
    const aggression =
      this.difficulty === 'easy' ? 0.38 : this.difficulty === 'medium' ? 0.68 : 0.92;
    const canAttackGlobal = self.globalAttackCooldown <= 0;
    const faceDir: 1 | -1 = dx >= 0 ? 1 : -1;
    const approachOrAlign = dist > 115 ? dirToTarget : self.facing === faceDir ? 0 : dirToTarget;

    if (this.thinkTimer <= 0) {
      this.thinkTimer = reactionInterval * (0.8 + Math.random() * 0.4);
      this.wantJump = false;
      this.wantDropDown = false;
      this.queuedAttack = null;
      this.aimY = 0;
      this.wantEvolve = false;

      const withinVerticalAim = Math.abs(dy) < 210;

      if (self.canEvolveNow() && Math.random() < (this.difficulty === 'easy' ? 0.45 : 0.9)) {
        this.wantEvolve = true;
      } else if (
        playerAttacking &&
        dist < 210 &&
        Math.abs(dy) < 120 &&
        Math.random() < blockChance
      ) {
        this.blockTimer = 0.28;
        this.blockFaceDir = faceDir;
        this.moveDir = 0;
      } else if (
        canAttackGlobal &&
        dy < -65 &&
        dy > -205 &&
        dist < 170 &&
        self.cooldowns.ataque_1 <= 0 &&
        Math.random() < 0.42 * aggression
      ) {
        this.moveDir = dist < 60 ? 0 : approachOrAlign;
        if (self.ki >= ATTACK_SPECS.ataque_2.kiCost && self.cooldowns.ataque_2 <= 0 && Math.random() < 0.5) {
          this.queueDirectionalAttack('a2', dx, dy);
        } else {
          this.queueDirectionalAttack('a1', dx, dy);
        }
      } else if (dy < -85 && platforms.length > 0) {
        // Inimigo em plataforma superior: procura plataforma alcançável e pula
        let bestPlat: ArenaPlatform | null = null;
        let bestPlatDist = Infinity;
        for (const plat of platforms) {
          if (plat.y < self.y - 35 && plat.y >= self.y - 160) {
            const pcx = plat.x + plat.w * 0.5;
            const d = Math.abs(pcx - self.x) + Math.abs(pcx - target.x) * 0.45;
            if (d < bestPlatDist) {
              bestPlatDist = d;
              bestPlat = plat;
            }
          }
        }
        if (bestPlat) {
          const pcx = bestPlat.x + bestPlat.w * 0.5;
          if (Math.abs(self.x - pcx) < bestPlat.w * 0.5 + 85 && self.grounded) {
            this.wantJump = true;
            this.moveDir = pcx >= self.x ? 1 : -1;
          } else {
            this.moveDir = pcx >= self.x ? 1 : -1;
          }
        } else {
          this.moveDir = dirToTarget;
          if (self.grounded && Math.random() < 0.45) this.wantJump = true;
        }
      } else if (dy > 85 && self.currentPlatformId !== null && self.grounded) {
        // Inimigo abaixo e IA sobre plataforma: desce pela plataforma
        this.wantDropDown = true;
        this.moveDir = dirToTarget;
      } else if (dist > 310) {
        // Distância longa: aproxima ou dispara projétil A3 (horizontal ou diagonal/vertical)
        this.moveDir = dirToTarget;
        if (
          canAttackGlobal &&
          withinVerticalAim &&
          self.ki >= ATTACK_SPECS.ataque_3.kiCost &&
          self.cooldowns.ataque_3 <= 0 &&
          Math.random() < 0.35 * aggression
        ) {
          this.queueDirectionalAttack('a3', dx, dy);
          if (Math.abs(this.aimY) < 0.3) this.moveDir = self.facing === faceDir ? 0 : dirToTarget;
        } else if (Math.random() < 0.14) {
          this.wantJump = true;
        }
      } else if (dist > 145) {
        // Distância média: investida A2, Ultimate A4 ou aproximação
        if (
          canAttackGlobal &&
          withinVerticalAim &&
          self.ki >= ATTACK_SPECS.ataque_4.kiCost &&
          self.cooldowns.ataque_4 <= 0 &&
          Math.random() < 0.42 * aggression
        ) {
          this.moveDir = approachOrAlign;
          this.queueDirectionalAttack('a4', dx, dy);
        } else if (
          canAttackGlobal &&
          withinVerticalAim &&
          self.ki >= ATTACK_SPECS.ataque_2.kiCost &&
          self.cooldowns.ataque_2 <= 0 &&
          Math.random() < 0.52 * aggression
        ) {
          this.moveDir = approachOrAlign;
          this.queueDirectionalAttack('a2', dx, dy);
        } else {
          this.moveDir = dirToTarget;
        }
      } else {
        // Curta distância: respeita espaçamento limpo, ritmo global ou recuo tático
        if (
          canAttackGlobal &&
          withinVerticalAim &&
          self.ki >= ATTACK_SPECS.ataque_4.kiCost &&
          self.cooldowns.ataque_4 <= 0 &&
          Math.random() < 0.35 * aggression
        ) {
          this.moveDir = approachOrAlign;
          this.queueDirectionalAttack('a4', dx, dy);
        } else if (
          self.combatPace === 'classic' &&
          self.state === 'ataque_1' &&
          self.attackHitDone &&
          self.ki >= ATTACK_SPECS.ataque_2.kiCost &&
          Math.random() < 0.7 * aggression
        ) {
          this.moveDir = approachOrAlign;
          this.queueDirectionalAttack('a2', dx, dy);
        } else if (
          canAttackGlobal &&
          withinVerticalAim &&
          self.cooldowns.ataque_1 <= 0 &&
          Math.random() < 0.78 * aggression
        ) {
          this.moveDir = approachOrAlign;
          this.queueDirectionalAttack('a1', dx, dy);
        } else if (dist < 108 || Math.random() < 0.22) {
          this.moveDir = -dirToTarget;
        } else {
          this.moveDir = self.facing === faceDir ? 0 : dirToTarget;
        }
      }
    }

    const blocking = this.blockTimer > 0;
    const a1 = this.queuedAttack === 'a1';
    const a2 = this.queuedAttack === 'a2';
    const a3 = this.queuedAttack === 'a3';
    const a4 = this.queuedAttack === 'a4';
    const jump = this.wantJump || this.wantDropDown;
    const down = this.wantDropDown;
    const evolve = this.wantEvolve;
    const attackAimY = a1 || a2 || a3 || a4 ? this.aimY : 0;

    // Consome disparos pontuais
    this.queuedAttack = null;
    this.aimY = 0;
    this.wantJump = false;
    this.wantDropDown = false;
    this.wantEvolve = false;

    const moveY = down ? 1 : attackAimY;
    const effectiveMoveX = blocking ? this.blockFaceDir * 0.3 : this.moveDir;

    return {
      moveX: effectiveMoveX,
      moveY,
      left: (!blocking && this.moveDir < -0.2) || (blocking && this.blockFaceDir < 0),
      right: (!blocking && this.moveDir > 0.2) || (blocking && this.blockFaceDir > 0),
      up: moveY < -0.45 || (jump && !down),
      down: down || moveY > 0.45,
      a1,
      a2,
      a3,
      a4,
      block: blocking,
      jump,
      evolve,
      justA1: a1,
      justA2: a2,
      justA3: a3,
      justA4: a4,
      justJump: jump,
      justEvolve: evolve,
    };
  }
}
