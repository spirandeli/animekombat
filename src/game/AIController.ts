import { FighterInputState } from '../engine/InputManager';
import { ATTACK_SPECS, Fighter } from './Fighter';

export type AIDifficulty = 'easy' | 'medium' | 'master';

export class AIController {
  private difficulty: AIDifficulty;
  private thinkTimer = 0;
  private blockTimer = 0;
  private moveDir = 0;
  private wantJump = false;
  private queuedAttack: 'a1' | 'a2' | 'a3' | 'a4' | null = null;
  private wantEvolve = false;

  constructor(difficulty: AIDifficulty = 'medium') {
    this.difficulty = difficulty;
  }

  public setDifficulty(diff: AIDifficulty): void {
    this.difficulty = diff;
  }

  public sample(dt: number, self: Fighter, target: Fighter): FighterInputState {
    this.thinkTimer -= dt;
    this.blockTimer = Math.max(0, this.blockTimer - dt);

    const dx = target.x - self.x;
    const dist = Math.abs(dx);
    const dirToTarget = dx >= 0 ? 1 : -1;

    // Reage quando o jogador ataca de perto
    const playerAttacking =
      target.state === 'ataque_1' ||
      target.state === 'ataque_2' ||
      target.state === 'ataque_4';

    const reactionInterval =
      this.difficulty === 'easy' ? 0.38 : this.difficulty === 'medium' ? 0.2 : 0.1;
    const blockChance =
      this.difficulty === 'easy' ? 0.2 : this.difficulty === 'medium' ? 0.55 : 0.82;
    const aggression =
      this.difficulty === 'easy' ? 0.38 : this.difficulty === 'medium' ? 0.68 : 0.92;

    if (this.thinkTimer <= 0) {
      this.thinkTimer = reactionInterval * (0.8 + Math.random() * 0.4);
      this.wantJump = false;
      this.queuedAttack = null;
      this.wantEvolve = false;

      if (self.canEvolveNow() && Math.random() < (this.difficulty === 'easy' ? 0.45 : 0.9)) {
        this.wantEvolve = true;
      } else if (playerAttacking && dist < 210 && Math.random() < blockChance) {
        this.blockTimer = 0.26;
        this.moveDir = 0;
      } else if (dist > 310) {
        // Distância longa: aproxima ou dispara projétil A3
        this.moveDir = dirToTarget;
        if (
          self.ki >= ATTACK_SPECS.ataque_3.kiCost &&
          self.cooldowns.ataque_3 <= 0 &&
          Math.random() < 0.35 * aggression
        ) {
          this.queuedAttack = 'a3';
          this.moveDir = 0;
        } else if (Math.random() < 0.14) {
          this.wantJump = true;
        }
      } else if (dist > 145) {
        // Distância média: investida A2, Ultimate A4 ou aproximação
        if (
          self.ki >= ATTACK_SPECS.ataque_4.kiCost &&
          self.cooldowns.ataque_4 <= 0 &&
          Math.random() < 0.42 * aggression
        ) {
          this.queuedAttack = 'a4';
        } else if (
          self.ki >= ATTACK_SPECS.ataque_2.kiCost &&
          self.cooldowns.ataque_2 <= 0 &&
          Math.random() < 0.52 * aggression
        ) {
          this.queuedAttack = 'a2';
        } else {
          this.moveDir = dirToTarget;
        }
      } else {
        // Curta distância: combo A1 -> A2 / A4 ou recuo tático
        if (
          self.ki >= ATTACK_SPECS.ataque_4.kiCost &&
          self.cooldowns.ataque_4 <= 0 &&
          Math.random() < 0.35 * aggression
        ) {
          this.queuedAttack = 'a4';
        } else if (
          self.state === 'ataque_1' &&
          self.attackHitDone &&
          self.ki >= ATTACK_SPECS.ataque_2.kiCost &&
          Math.random() < 0.7 * aggression
        ) {
          this.queuedAttack = 'a2';
        } else if (self.cooldowns.ataque_1 <= 0 && Math.random() < 0.78 * aggression) {
          this.queuedAttack = 'a1';
        } else if (Math.random() < 0.22) {
          this.moveDir = -dirToTarget;
        } else {
          this.moveDir = 0;
        }
      }
    }

    const blocking = this.blockTimer > 0;
    const a1 = this.queuedAttack === 'a1';
    const a2 = this.queuedAttack === 'a2';
    const a3 = this.queuedAttack === 'a3';
    const a4 = this.queuedAttack === 'a4';
    const jump = this.wantJump;
    const evolve = this.wantEvolve;

    // Consome disparos pontuais
    this.queuedAttack = null;
    this.wantJump = false;
    this.wantEvolve = false;

    return {
      moveX: blocking ? 0 : this.moveDir,
      moveY: 0,
      left: !blocking && this.moveDir < -0.2,
      right: !blocking && this.moveDir > 0.2,
      up: jump,
      down: false,
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
