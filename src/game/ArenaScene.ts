import { AudioManager } from '../engine/AudioManager';
import { CombatSystem } from '../engine/CombatSystem';
import { FighterInputState, InputManager } from '../engine/InputManager';
import { SpriteLoader } from '../engine/SpriteLoader';
import type {
  CombatEventPayload,
  NetworkClient,
  RemoteFighterSyncPayload,
} from '../net/NetworkClient';
import { VirtualControls } from '../ui/VirtualControls';
import { AIController, AIDifficulty } from './AIController';
import { ATTACK_SPECS, Fighter } from './Fighter';

export interface MatchConfig {
  p1CharId: string;
  p2CharId: string;
  p1StartPhase: number;
  p2StartPhase: number;
  p1Level: number;
  p2Level?: number;
  p1DisplayName?: string;
  p2DisplayName?: string;
  difficulty: AIDifficulty;
  mode?: 'solo' | 'room-bot' | 'online';
  localSlot?: 'p1' | 'p2';
  roomCode?: string;
}

export interface MatchEndReport {
  winner: 'p1' | 'p2' | 'draw';
  p1HpRemaining: number;
  p2HpRemaining: number;
  p1FinalPhase: number;
  p2FinalPhase: number;
  xpEarned: number;
  localSlot: 'p1' | 'p2';
  mode: 'solo' | 'room-bot' | 'online';
  opponentLeft?: boolean;
}

function createEmptyInput(): FighterInputState {
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class ArenaScene {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly hudEl: HTMLElement;

  private readonly spriteLoader: SpriteLoader;
  private readonly input: InputManager;
  private readonly virtualControls: VirtualControls;
  private readonly audio: AudioManager;
  private readonly combat = new CombatSystem();
  private readonly ai = new AIController('medium');

  private p1: Fighter | null = null;
  private p2: Fighter | null = null;
  private active = false;
  private matchEnded = false;
  private koSlowMoTimer = 0;
  private roundTimer = 99;
  private pendingWinner: 'p1' | 'p2' | 'draw' | null = null;

  private matchMode: 'solo' | 'room-bot' | 'online' = 'solo';
  private localSlot: 'p1' | 'p2' = 'p1';
  private opponentLeftFlag = false;
  private net?: NetworkClient;
  private syncTimer = 0;
  private syncSeq = 0;
  private lastRemoteSeq = -1;
  private lastSentState = 'idle';
  private remoteInput: FighterInputState = createEmptyInput();

  private camX = 640;
  private camY = 390;
  private camZoom = 1.05;

  private p1ComboDisplay = 0;
  private p1ComboFade = 0;
  private p2ComboDisplay = 0;
  private p2ComboFade = 0;

  private onPauseRequested?: () => void;
  private onMatchEnded?: (report: MatchEndReport) => void;

  // Referências rápidas aos elementos da HUD (evita innerHTML a cada frame)
  private hudRefs: {
    p1Name?: HTMLElement;
    p1Phase?: HTMLElement;
    p1HpFill?: HTMLElement;
    p1HpTrail?: HTMLElement;
    p1KiFill?: HTMLElement;
    p1EvoFill?: HTMLElement;
    p1EvoReady?: HTMLElement;
    p2Name?: HTMLElement;
    p2Phase?: HTMLElement;
    p2HpFill?: HTMLElement;
    p2HpTrail?: HTMLElement;
    p2KiFill?: HTMLElement;
    p2EvoFill?: HTMLElement;
    p2EvoReady?: HTMLElement;
    timer?: HTMLElement;
    p1Combo?: HTMLElement;
    p2Combo?: HTMLElement;
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

    this.resizeCanvas();
    window.addEventListener('resize', this.resizeCanvas);
  }

  public setCallbacks(
    onPauseRequested: () => void,
    onMatchEnded: (report: MatchEndReport) => void
  ): void {
    this.onPauseRequested = onPauseRequested;
    this.onMatchEnded = onMatchEnded;
  }

  public setNetworkClient(net: NetworkClient): void {
    this.net = net;
  }

  public isOnlineMatch(): boolean {
    return this.active && this.matchMode === 'online';
  }

  public resizeCanvas = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(320, window.innerWidth);
    const h = Math.max(240, window.innerHeight);
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
  };

  public startMatch(config: MatchConfig): void {
    this.combat.clearAll();
    this.ai.setDifficulty(config.difficulty);

    this.matchMode = config.mode ?? 'solo';
    this.localSlot = config.localSlot ?? 'p1';
    this.opponentLeftFlag = false;
    this.syncTimer = 0;
    this.syncSeq = 0;
    this.lastRemoteSeq = -1;
    this.lastSentState = 'idle';
    this.remoteInput = createEmptyInput();

    const p1Char = this.spriteLoader.getCharacter(config.p1CharId);
    const p2Char = this.spriteLoader.getCharacter(config.p2CharId);
    const p1Pack = this.spriteLoader.getCachedPhase(config.p1CharId, config.p1StartPhase);
    const p2Pack = this.spriteLoader.getCachedPhase(config.p2CharId, config.p2StartPhase);

    if (!p1Char || !p2Char || !p1Pack || !p2Pack) {
      throw new Error('Pacotes de sprites iniciais não foram pré-carregados.');
    }

    const p1Name = config.p1DisplayName || p1Char.name;
    const p2Name = config.p2DisplayName || p2Char.name;

    this.p1 = new Fighter(
      'p1',
      config.p1CharId,
      p1Name,
      440,
      1,
      config.p1StartPhase,
      config.p1Level,
      p1Pack,
      this.spriteLoader
    );
    this.p2 = new Fighter(
      'p2',
      config.p2CharId,
      p2Name,
      840,
      -1,
      config.p2StartPhase,
      config.p2Level ?? Math.max(1, config.p1Level),
      p2Pack,
      this.spriteLoader
    );

    const wireFighter = (f: Fighter) => {
      f.setCallbacks({
        onSpawnAttackVfx: (attacker, spec, x, y, followOwner) => {
          this.combat.spawnVfx(
            attacker,
            spec.vfx,
            x,
            y,
            spec.duration * 0.85,
            spec.action === 'ataque_4' ? 0.72 : 0.54,
            followOwner
          );
        },
        onSpawnProjectile: (attacker, spec) => {
          this.combat.spawnProjectile(attacker, spec);
        },
        onEvolved: (evolvedFighter, newPhase) => {
          this.combat.triggerEvolutionBurst(evolvedFighter, newPhase);
          if (evolvedFighter.slot === this.localSlot) {
            this.virtualControls.vibrate([30, 40, 60]);
          }
          // Pré-carrega em segundo plano a próxima fase se houver
          if (newPhase < 4) {
            void this.spriteLoader.loadPhasePack(evolvedFighter.charId, newPhase + 1);
          }
        },
        onPlaySfx: (sfx) => {
          this.audio.playSfx(sfx);
        },
      });
    };

    wireFighter(this.p1);
    wireFighter(this.p2);

    this.combat.setEvents({
      onHitImpact: (_attacker, _defender, _dmg, blocked, isHeavy) => {
        if (blocked) {
          this.audio.playSfx('block');
          this.virtualControls.vibrate(14);
        } else {
          this.audio.playSfx(isHeavy ? 'heavyHit' : 'hit');
          this.virtualControls.vibrate(isHeavy ? [22, 20, 35] : 18);
        }
      },
      onComboUpdate: (slot, count) => {
        if (slot === 'p1') {
          this.p1ComboDisplay = count;
          this.p1ComboFade = 1.4;
        } else {
          this.p2ComboDisplay = count;
          this.p2ComboFade = 1.4;
        }
      },
    });

    // Pré-carrega em background a fase seguinte de ambos os lutadores para transição instantânea
    if (config.p1StartPhase < 4) {
      void this.spriteLoader.loadPhasePack(config.p1CharId, config.p1StartPhase + 1);
    }
    if (config.p2StartPhase < 4) {
      void this.spriteLoader.loadPhasePack(config.p2CharId, config.p2StartPhase + 1);
    }

    this.active = true;
    this.matchEnded = false;
    this.pendingWinner = null;
    this.koSlowMoTimer = 0;
    this.roundTimer = 99;
    this.camX = 640;
    this.camY = 390;
    this.camZoom = 1.05;
    this.p1ComboFade = 0;
    this.p2ComboFade = 0;

    this.buildHud();
    this.hudEl.classList.remove('hidden');
    this.hudEl.setAttribute('aria-hidden', 'false');
    this.virtualControls.setVisible(true);
    this.audio.startBgm();
  }

  public stopMatch(): void {
    this.active = false;
    this.p1 = null;
    this.p2 = null;
    this.combat.clearAll();
    this.hudEl.classList.add('hidden');
    this.hudEl.setAttribute('aria-hidden', 'true');
    this.virtualControls.setVisible(false);
    this.audio.stopBgm();
  }

  public isActive(): boolean {
    return this.active;
  }

  public applyRemoteSync(payload: RemoteFighterSyncPayload): void {
    if (!this.active || !this.p1 || !this.p2 || this.matchMode !== 'online') return;
    if (payload.slot === this.localSlot || payload.seq <= this.lastRemoteSeq) return;
    this.lastRemoteSeq = payload.seq;

    const remote = payload.slot === 'p1' ? this.p1 : this.p2;
    const local = this.localSlot === 'p1' ? this.p1 : this.p2;

    const dx = payload.x - remote.x;
    const dy = payload.y - remote.y;
    remote.x = Math.abs(dx) > 95 ? payload.x : remote.x + dx * 0.45;
    remote.y = Math.abs(dy) > 95 ? payload.y : remote.y + dy * 0.45;
    remote.vx = payload.vx;
    remote.vy = payload.vy;
    remote.facing = payload.facing;
    remote.grounded = payload.grounded;
    remote.ki = payload.ki;
    remote.evoEnergy = payload.evoEnergy;

    // Host (P1) é autoritativo para HP e relógio da rodada
    if (this.localSlot === 'p2') {
      if (typeof payload.roundTimer === 'number') {
        this.roundTimer = payload.roundTimer;
      }
      if (typeof payload.peerHp === 'number') {
        local.hp = payload.peerHp;
      }
      remote.hp = payload.hp;
    }

    if (payload.phase > remote.phase && remote.phase < 4) {
      remote.triggerEvolution();
    }

    if (payload.state !== remote.state) {
      if (
        payload.state === 'ataque_1' ||
        payload.state === 'ataque_2' ||
        payload.state === 'ataque_3' ||
        payload.state === 'ataque_4'
      ) {
        remote.syncRemoteAttack(payload.state);
      } else if (payload.state === 'evolve') {
        remote.triggerEvolution();
      }
    }

    this.remoteInput = { ...payload.input };
  }

  public applyRemoteEvent(ev: CombatEventPayload): void {
    if (!this.active || !this.p1 || !this.p2 || this.matchMode !== 'online') return;
    if (ev.kind === 'ko' && ev.winner && this.pendingWinner === null) {
      if (typeof ev.p1HpRemaining === 'number') this.p1.hp = ev.p1HpRemaining;
      if (typeof ev.p2HpRemaining === 'number') this.p2.hp = ev.p2HpRemaining;
      this.triggerKoSequence(ev.winner);
    }
  }

  public handleOpponentLeft(): void {
    if (!this.active || !this.p1 || !this.p2 || this.matchMode !== 'online') return;
    if (this.pendingWinner !== null) return;
    this.opponentLeftFlag = true;
    this.combat.spawnFloatingText(
      this.camX,
      this.camY - 90,
      'OPONENTE SAIU!',
      '#38bdf8',
      1.4
    );
    this.triggerKoSequence(this.localSlot);
  }

  private consumeRemoteInput(): FighterInputState {
    const snap = { ...this.remoteInput };
    // Consome disparos de borda apenas uma vez
    this.remoteInput.justA1 = false;
    this.remoteInput.justA2 = false;
    this.remoteInput.justA3 = false;
    this.remoteInput.justA4 = false;
    this.remoteInput.justJump = false;
    this.remoteInput.justEvolve = false;
    return snap;
  }

  private triggerKoSequence(winner: 'p1' | 'p2' | 'draw'): void {
    this.pendingWinner = winner;
    this.koSlowMoTimer = 1.25;
    this.combat.triggerScreenShake(16, 0.45);
    this.combat.spawnFloatingText(
      this.camX,
      this.camY - 40,
      this.roundTimer <= 0 ? 'TEMPO!' : 'K.O.!',
      '#facc15',
      2.0
    );
    this.audio.playSfx('ko');
    this.virtualControls.vibrate([60, 40, 100]);
  }

  public update(dt: number): void {
    if (!this.active || !this.p1 || !this.p2) return;

    const localFighter = this.localSlot === 'p2' ? this.p2 : this.p1;
    const remoteFighter = this.localSlot === 'p2' ? this.p1 : this.p2;

    // Câmera lenta dramática de K.O. antes de abrir a tela de resultado
    if (this.pendingWinner !== null) {
      this.koSlowMoTimer -= dt;
      const slowDt = dt * 0.28;
      this.combat.update(slowDt, this.p1, this.p2);
      if (this.koSlowMoTimer <= 0 && !this.matchEnded) {
        this.matchEnded = true;
        this.active = false;
        this.virtualControls.setVisible(false);
        this.audio.stopBgm();
        this.onMatchEnded?.({
          winner: this.pendingWinner,
          p1HpRemaining: this.p1.hp,
          p2HpRemaining: this.p2.hp,
          p1FinalPhase: this.p1.phase,
          p2FinalPhase: this.p2.phase,
          localSlot: this.localSlot,
          mode: this.matchMode,
          opponentLeft: this.opponentLeftFlag,
          xpEarned:
            localFighter.xpEarnedInMatch +
            (this.pendingWinner === this.localSlot ? 65 : 25),
        });
      }
      return;
    }

    // Relógio da partida
    this.roundTimer = Math.max(0, this.roundTimer - dt);

    const localInput = this.input.sample();
    const opponentInput =
      this.matchMode === 'online'
        ? this.consumeRemoteInput()
        : this.ai.sample(dt, this.p2, this.p1);

    const p1Input = this.localSlot === 'p1' ? localInput : opponentInput;
    const p2Input = this.localSlot === 'p2' ? localInput : opponentInput;

    const stepPhysics = this.combat.update(dt, this.p1, this.p2);
    if (stepPhysics) {
      this.p1.update(dt, p1Input, this.p2);
      this.p2.update(dt, p2Input, this.p1);
    }

    // Envia sincronização em tempo real no modo online (~30Hz + disparos imediatos)
    if (this.matchMode === 'online' && this.net) {
      this.syncTimer += dt;
      const immediate =
        localInput.justA1 ||
        localInput.justA2 ||
        localInput.justA3 ||
        localInput.justA4 ||
        localInput.justJump ||
        localInput.justEvolve ||
        localFighter.state !== this.lastSentState;

      if (immediate || this.syncTimer >= 0.033) {
        this.syncTimer = 0;
        this.lastSentState = localFighter.state;
        this.net.sendCombatSync({
          slot: this.localSlot,
          seq: ++this.syncSeq,
          x: localFighter.x,
          y: localFighter.y,
          vx: localFighter.vx,
          vy: localFighter.vy,
          facing: localFighter.facing,
          grounded: localFighter.grounded,
          hp: localFighter.hp,
          peerHp: this.localSlot === 'p1' ? remoteFighter.hp : undefined,
          roundTimer: this.localSlot === 'p1' ? this.roundTimer : undefined,
          ki: localFighter.ki,
          evoEnergy: localFighter.evoEnergy,
          phase: localFighter.phase,
          state: localFighter.state,
          stateTime: localFighter.stateTime,
          hitstunRemaining: localFighter.hitstunRemaining,
          invulnTime: localFighter.invulnTime,
          input: localInput,
        });
      }
    }

    // Fades de combo banner
    this.p1ComboFade = Math.max(0, this.p1ComboFade - dt);
    this.p2ComboFade = Math.max(0, this.p2ComboFade - dt);

    // Atualiza câmera dinâmica
    const midX = (this.p1.x + this.p2.x) * 0.5;
    const minY = Math.min(this.p1.y, this.p2.y);
    const dist = Math.abs(this.p1.x - this.p2.x);
    const isDramatic =
      this.p1.state === 'ataque_4' ||
      this.p2.state === 'ataque_4' ||
      this.p1.state === 'evolve' ||
      this.p2.state === 'evolve';
    const targetZoom = isDramatic
      ? 1.18
      : Math.max(0.82, Math.min(1.16, 1.24 - dist / 1450));
    const targetCamX = Math.max(320, Math.min(960, midX));
    const targetCamY = Math.max(300, Math.min(415, minY - 125));

    this.camX += (targetCamX - this.camX) * Math.min(1, dt * 8);
    this.camY += (targetCamY - this.camY) * Math.min(1, dt * 8);
    this.camZoom += (targetZoom - this.camZoom) * Math.min(1, dt * 6);

    // Atualiza estado visual dos botões virtuais para o lutador local
    this.virtualControls.updateVisualState(
      {
        a1: localFighter.cooldowns.ataque_1 / ATTACK_SPECS.ataque_1.cooldown,
        a2: localFighter.cooldowns.ataque_2 / ATTACK_SPECS.ataque_2.cooldown,
        a3: localFighter.cooldowns.ataque_3 / ATTACK_SPECS.ataque_3.cooldown,
        a4: localFighter.cooldowns.ataque_4 / ATTACK_SPECS.ataque_4.cooldown,
      },
      {
        a1: localFighter.ki >= ATTACK_SPECS.ataque_1.kiCost,
        a2: localFighter.ki >= ATTACK_SPECS.ataque_2.kiCost,
        a3: localFighter.ki >= ATTACK_SPECS.ataque_3.kiCost,
        a4: localFighter.ki >= ATTACK_SPECS.ataque_4.kiCost,
      },
      localFighter.canEvolveNow(),
      localFighter.getMoveNames()
    );

    // Verifica K.O. ou fim do tempo (no online, P1 é autoritativo para encerrar o round)
    const canEvaluateKo = this.matchMode !== 'online' || this.localSlot === 'p1';
    if (canEvaluateKo && (this.p1.hp <= 0 || this.p2.hp <= 0 || this.roundTimer <= 0)) {
      let winner: 'p1' | 'p2' | 'draw';
      if (this.p1.hp <= 0 && this.p2.hp <= 0) {
        winner = 'draw';
      } else if (this.p2.hp <= 0) {
        winner = 'p1';
      } else if (this.p1.hp <= 0) {
        winner = 'p2';
      } else {
        // Fim do tempo: quem tiver maior porcentagem de HP vence
        const p1Pct = this.p1.hp / this.p1.maxHp;
        const p2Pct = this.p2.hp / this.p2.maxHp;
        winner = Math.abs(p1Pct - p2Pct) < 0.001 ? 'draw' : p1Pct > p2Pct ? 'p1' : 'p2';
      }
      if (this.matchMode === 'online') {
        this.net?.sendCombatEvent({
          kind: 'ko',
          slot: 'p1',
          winner,
          p1HpRemaining: this.p1.hp,
          p2HpRemaining: this.p2.hp,
          p1FinalPhase: this.p1.phase,
        });
      }
      this.triggerKoSequence(winner);
    }
  }

  public render(fps: number): void {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    if (!this.active || !this.p1 || !this.p2) {
      // Fundo animado sutil para os menus
      this.renderBackdropOnly(ctx, cw, ch);
      return;
    }

    const viewScale = Math.min(cw / 900, ch / 460) * this.camZoom;
    const shakeX =
      this.combat.shakeTime > 0
        ? (Math.random() * 2 - 1) * this.combat.shakeIntensity
        : 0;
    const shakeY =
      this.combat.shakeTime > 0
        ? (Math.random() * 2 - 1) * this.combat.shakeIntensity
        : 0;

    // 1. Céu e Parallax de fundo
    this.renderParallaxBackground(ctx, cw, ch);

    // 2. Mundo da Arena transformado pela câmera
    ctx.save();
    ctx.translate(cw * 0.5 + shakeX, ch * 0.56 + shakeY);
    ctx.scale(viewScale, viewScale);
    ctx.translate(-this.camX, -this.camY);

    this.renderArenaFloor(ctx);

    // Lutadores e sistema de VFX/combate
    this.p2.render(ctx);
    this.p1.render(ctx);
    this.combat.render(ctx);

    ctx.restore();

    // 3. Flash de impacto / Ultimate
    if (this.combat.flashAlpha > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${this.combat.flashAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
    }

    this.updateHudDom(fps);
  }

  private renderBackdropOnly(
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number
  ): void {
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#090d1e');
    grad.addColorStop(0.55, '#1a1536');
    grad.addColorStop(1, '#080912');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    // Brilho cel-shaded de energia ao fundo
    const t = performance.now() * 0.001;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rg = ctx.createRadialGradient(
      cw * (0.5 + Math.sin(t * 0.6) * 0.12),
      ch * 0.35,
      10,
      cw * 0.5,
      ch * 0.35,
      Math.max(cw, ch) * 0.5
    );
    rg.addColorStop(0, 'rgba(255, 59, 92, 0.22)');
    rg.addColorStop(0.5, 'rgba(34, 211, 238, 0.08)');
    rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();
  }

  private renderParallaxBackground(
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number
  ): void {
    const sky = ctx.createLinearGradient(0, 0, 0, ch);
    sky.addColorStop(0, '#090e24');
    sky.addColorStop(0.58, '#261845');
    sky.addColorStop(1, '#3b1c4a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, cw, ch);

    // Lua anime estilizada com parallax lento
    const offsetCam = (this.camX - 640) * 0.08;
    const moonX = cw * 0.72 - offsetCam;
    const moonY = ch * 0.24;
    const moonR = Math.min(cw, ch) * 0.11;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 226, 154, 0.9)';
    ctx.shadowColor = 'rgba(255, 184, 0, 0.55)';
    ctx.shadowBlur = 32;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Camada distante de montanhas / templos (parallax 0.2)
    const p1Off = -(this.camX - 640) * 0.18;
    ctx.fillStyle = '#15122b';
    ctx.beginPath();
    ctx.moveTo(0, ch);
    const horizon = ch * 0.66;
    for (let i = -1; i <= 8; i++) {
      const bx = i * (cw / 6) + (p1Off % (cw / 3));
      const peak = horizon - ((i * 53) % 75) - 40;
      ctx.lineTo(bx, peak);
      ctx.lineTo(bx + cw / 12, horizon - 15);
    }
    ctx.lineTo(cw, ch);
    ctx.closePath();
    ctx.fill();

    // Camada média de pilares/torres (parallax 0.35)
    const p2Off = -(this.camX - 640) * 0.34;
    ctx.fillStyle = '#100d20';
    for (let i = -1; i <= 9; i++) {
      const tx = i * (cw / 7) + (p2Off % (cw / 3.5));
      const tw = cw * 0.065;
      const th = ch * (0.2 + ((i * 19) % 14) / 100);
      ctx.fillRect(tx, ch * 0.72 - th, tw, th + ch * 0.3);
    }
  }

  private renderArenaFloor(ctx: CanvasRenderingContext2D): void {
    const gy = Fighter.GROUND_Y;

    // Piso principal
    const floorGrad = ctx.createLinearGradient(0, gy, 0, gy + 240);
    floorGrad.addColorStop(0, '#1f2947');
    floorGrad.addColorStop(0.2, '#13192e');
    floorGrad.addColorStop(1, '#070912');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(-200, gy, 1680, 300);

    // Linha energética de borda da arena
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-200, gy - 2, 1680, 4);

    // Linhas de perspectiva no chão para sensação de velocidade
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= 1280; x += 80) {
      ctx.moveTo(x, gy);
      ctx.lineTo((x - 640) * 1.45 + 640, gy + 190);
    }
    ctx.stroke();

    // Marcadores de limite esquerdo e direito
    ctx.fillStyle = 'rgba(255, 59, 92, 0.35)';
    ctx.fillRect(Fighter.ARENA_LEFT - 12, gy - 220, 6, 220);
    ctx.fillRect(Fighter.ARENA_RIGHT + 6, gy - 220, 6, 220);
  }

  private buildHud(): void {
    if (!this.p1 || !this.p2) return;
    const p1Tag =
      this.matchMode === 'online' && this.localSlot === 'p1' ? ' (VOCÊ)' : '';
    const p2Tag =
      this.matchMode === 'online' && this.localSlot === 'p2' ? ' (VOCÊ)' : '';

    this.hudEl.innerHTML = `
      <div class="ak-hud-top">
        <div class="ak-fighter-hud p1">
          <div class="ak-hud-name-row">
            <span id="hud-p1-name">${escapeHtml(this.p1.displayName + p1Tag)}</span>
            <span class="ak-fase-badge" id="hud-p1-phase">F${this.p1.phase} · ${escapeHtml(this.p1.phasePack.manifest.label)}</span>
          </div>
          <div class="ak-hp-track">
            <div class="ak-hp-trail" id="hud-p1-hp-trail" style="width:100%"></div>
            <div class="ak-hp-fill" id="hud-p1-hp-fill" style="width:100%"></div>
          </div>
          <div class="ak-subbars">
            <div class="ak-mini-track" title="Energia Ki">
              <div class="ak-ki-fill" id="hud-p1-ki" style="width:45%"></div>
            </div>
            <div class="ak-mini-track" title="Barra de Evolução">
              <div class="ak-evo-fill" id="hud-p1-evo" style="width:0%"></div>
            </div>
            <span class="ak-fase-badge hidden" id="hud-p1-evo-ready" style="border-color:#c084fc;background:rgba(168,85,247,0.35);color:#fef08a;">EVO PRONTO!</span>
          </div>
        </div>

        <div class="ak-hud-center">
          <div class="ak-timer-box" id="hud-timer">99</div>
          <button type="button" class="ak-pause-btn" id="hud-pause-btn">PAUSA</button>
        </div>

        <div class="ak-fighter-hud p2">
          <div class="ak-hud-name-row">
            <span class="ak-fase-badge" id="hud-p2-phase">F${this.p2.phase} · ${escapeHtml(this.p2.phasePack.manifest.label)}</span>
            <span id="hud-p2-name">${escapeHtml(this.p2.displayName + p2Tag)}</span>
          </div>
          <div class="ak-hp-track">
            <div class="ak-hp-trail" id="hud-p2-hp-trail" style="width:100%"></div>
            <div class="ak-hp-fill" id="hud-p2-hp-fill" style="width:100%"></div>
          </div>
          <div class="ak-subbars">
            <span class="ak-fase-badge hidden" id="hud-p2-evo-ready" style="border-color:#c084fc;background:rgba(168,85,247,0.35);color:#fef08a;">EVO PRONTO!</span>
            <div class="ak-mini-track">
              <div class="ak-evo-fill" id="hud-p2-evo" style="width:0%"></div>
            </div>
            <div class="ak-mini-track">
              <div class="ak-ki-fill" id="hud-p2-ki" style="width:45%"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="ak-combo-banner hidden" id="hud-p1-combo">2 HITS!</div>
      <div class="ak-combo-banner p2 hidden" id="hud-p2-combo">2 HITS!</div>
      <div class="ak-fps-tag" id="hud-fps">60 FPS</div>
    `;

    const q = (sel: string) => this.hudEl.querySelector<HTMLElement>(sel) ?? undefined;
    this.hudRefs = {
      p1Name: q('#hud-p1-name'),
      p1Phase: q('#hud-p1-phase'),
      p1HpFill: q('#hud-p1-hp-fill'),
      p1HpTrail: q('#hud-p1-hp-trail'),
      p1KiFill: q('#hud-p1-ki'),
      p1EvoFill: q('#hud-p1-evo'),
      p1EvoReady: q('#hud-p1-evo-ready'),
      p2Name: q('#hud-p2-name'),
      p2Phase: q('#hud-p2-phase'),
      p2HpFill: q('#hud-p2-hp-fill'),
      p2HpTrail: q('#hud-p2-hp-trail'),
      p2KiFill: q('#hud-p2-ki'),
      p2EvoFill: q('#hud-p2-evo'),
      p2EvoReady: q('#hud-p2-evo-ready'),
      timer: q('#hud-timer'),
      p1Combo: q('#hud-p1-combo'),
      p2Combo: q('#hud-p2-combo'),
      fps: q('#hud-fps'),
    };

    this.hudEl.querySelector('#hud-pause-btn')?.addEventListener('click', () => {
      this.audio.playSfx('ui');
      this.onPauseRequested?.();
    });
  }

  private updateHudDom(fps: number): void {
    if (!this.p1 || !this.p2) return;

    const p1HpPct = Math.max(0, (this.p1.hp / this.p1.maxHp) * 100);
    const p2HpPct = Math.max(0, (this.p2.hp / this.p2.maxHp) * 100);

    if (this.hudRefs.p1HpFill && this.hudRefs.p1HpTrail) {
      const w = `${p1HpPct.toFixed(1)}%`;
      this.hudRefs.p1HpFill.style.width = w;
      this.hudRefs.p1HpTrail.style.width = w;
      this.hudRefs.p1HpFill.classList.toggle('danger', p1HpPct < 30);
    }
    if (this.hudRefs.p2HpFill && this.hudRefs.p2HpTrail) {
      const w = `${p2HpPct.toFixed(1)}%`;
      this.hudRefs.p2HpFill.style.width = w;
      this.hudRefs.p2HpTrail.style.width = w;
      this.hudRefs.p2HpFill.classList.toggle('danger', p2HpPct < 30);
    }

    if (this.hudRefs.p1KiFill) {
      this.hudRefs.p1KiFill.style.width = `${(this.p1.ki / this.p1.maxKi) * 100}%`;
    }
    if (this.hudRefs.p2KiFill) {
      this.hudRefs.p2KiFill.style.width = `${(this.p2.ki / this.p2.maxKi) * 100}%`;
    }
    if (this.hudRefs.p1EvoFill) {
      const evoW = this.p1.phase >= 4 ? 100 : this.p1.evoEnergy;
      this.hudRefs.p1EvoFill.style.width = `${evoW}%`;
    }
    if (this.hudRefs.p1EvoReady) {
      const showP1Evo = this.localSlot === 'p1' && this.p1.canEvolveNow();
      this.hudRefs.p1EvoReady.classList.toggle('hidden', !showP1Evo);
    }
    if (this.hudRefs.p2EvoFill) {
      const evoW = this.p2.phase >= 4 ? 100 : this.p2.evoEnergy;
      this.hudRefs.p2EvoFill.style.width = `${evoW}%`;
    }
    if (this.hudRefs.p2EvoReady) {
      const showP2Evo = this.localSlot === 'p2' && this.p2.canEvolveNow();
      this.hudRefs.p2EvoReady.classList.toggle('hidden', !showP2Evo);
    }

    if (this.hudRefs.p1Phase) {
      const target = `F${this.p1.phase} · ${this.p1.phasePack.manifest.label}`;
      if (this.hudRefs.p1Phase.textContent !== target) {
        this.hudRefs.p1Phase.textContent = target;
      }
    }
    if (this.hudRefs.p2Phase) {
      const target = `F${this.p2.phase} · ${this.p2.phasePack.manifest.label}`;
      if (this.hudRefs.p2Phase.textContent !== target) {
        this.hudRefs.p2Phase.textContent = target;
      }
    }

    if (this.hudRefs.timer) {
      const sec = String(Math.ceil(this.roundTimer));
      if (this.hudRefs.timer.textContent !== sec) {
        this.hudRefs.timer.textContent = sec;
      }
    }

    if (this.hudRefs.p1Combo) {
      const show = this.p1ComboFade > 0 && this.p1ComboDisplay >= 2;
      this.hudRefs.p1Combo.classList.toggle('hidden', !show);
      if (show) {
        this.hudRefs.p1Combo.textContent = `${this.p1ComboDisplay} HITS!`;
      }
    }
    if (this.hudRefs.p2Combo) {
      const show = this.p2ComboFade > 0 && this.p2ComboDisplay >= 2;
      this.hudRefs.p2Combo.classList.toggle('hidden', !show);
      if (show) {
        this.hudRefs.p2Combo.textContent = `${this.p2ComboDisplay} HITS!`;
      }
    }

    if (this.hudRefs.fps) {
      const txt = `${fps} FPS`;
      if (this.hudRefs.fps.textContent !== txt) {
        this.hudRefs.fps.textContent = txt;
      }
    }
  }
}
