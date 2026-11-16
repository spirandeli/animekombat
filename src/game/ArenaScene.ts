import { AudioManager } from '../engine/AudioManager';
import { CombatSystem } from '../engine/CombatSystem';
import { FighterInputState, InputManager } from '../engine/InputManager';
import { SpriteLoader } from '../engine/SpriteLoader';
import type { CombatPace } from '../storage/SaveManager';
import type {
  CombatEventPayload,
  MatchParticipantConfig,
  NetworkClient,
  RemoteFighterSyncPayload,
} from '../net/NetworkClient';
import { VirtualControls } from '../ui/VirtualControls';
import { AIController, AIDifficulty } from './AIController';
import {
  GeneratedArenaMap,
  generateArenaMap,
  preloadArenaBackground,
  renderArenaWorld,
  renderThemeBackground,
} from './ArenaMap';
import {
  ATTACK_SPECS,
  Fighter,
  FighterSlotId,
  FighterTeam,
  teamForSlot,
} from './Fighter';

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
  roomMode?: '1v1' | 'rumble';
  teamSize?: 1 | 2 | 3;
  mapSeed?: number;
  mapTheme?: string;
  localSlot?: FighterSlotId;
  hostSlot?: FighterSlotId;
  roomCode?: string;
  participants?: MatchParticipantConfig[];
  combatPace?: CombatPace;
}

export interface MatchEndReport {
  winner: 'p1' | 'p2' | 'draw';
  winnerTeam?: 1 | 2 | 'draw';
  localWon?: boolean;
  p1HpRemaining: number;
  p2HpRemaining: number;
  p1FinalPhase: number;
  p2FinalPhase: number;
  team1RoundWins?: number;
  team2RoundWins?: number;
  roundsPlayed?: number;
  xpEarned: number;
  localSlot: FighterSlotId;
  roomMode?: '1v1' | 'rumble';
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
    dash: false,
    jump: false,
    evolve: false,
    justA1: false,
    justA2: false,
    justA3: false,
    justA4: false,
    justDash: false,
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

interface RumbleSlotHudRefs {
  card: HTMLElement;
  hpFill: HTMLElement;
  hpTrail: HTMLElement;
  phaseBadge: HTMLElement;
  kiFill?: HTMLElement;
  evoFill?: HTMLElement;
  evoReady?: HTMLElement;
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
  private difficulty: AIDifficulty = 'medium';

  private fighters: Fighter[] = [];
  private fightersBySlot = new Map<FighterSlotId, Fighter>();
  private fighterSpawns = new Map<
    FighterSlotId,
    { x: number; y: number; facing: 1 | -1 }
  >();
  private botSlots = new Set<FighterSlotId>();
  private aiControllers = new Map<FighterSlotId, AIController>();
  private remoteInputs = new Map<FighterSlotId, FighterInputState>();
  private lastRemoteSyncTimeBySlot = new Map<FighterSlotId, number>();
  private lastRemoteSeqBySlot = new Map<FighterSlotId, number>();
  private seqBySlot = new Map<FighterSlotId, number>();
  private lastSentStateBySlot = new Map<FighterSlotId, string>();

  private p1: Fighter | null = null;
  private p2: Fighter | null = null;

  private active = false;
  private matchEnded = false;
  private koSlowMoTimer = 0;
  private roundTimer = 99;
  private currentRound = 1;
  private readonly maxRounds = 3;
  private readonly winsRequired = 2;
  private team1RoundWins = 0;
  private team2RoundWins = 0;
  private pendingMatchOver = false;
  private roundIntroTimer = 0;
  private pendingWinner: 'p1' | 'p2' | 'draw' | null = null;
  private pendingWinnerTeam: 1 | 2 | 'draw' | null = null;

  private matchMode: 'solo' | 'room-bot' | 'online' = 'solo';
  private roomMode: '1v1' | 'rumble' = '1v1';
  private localSlot: FighterSlotId = 'p1';
  private hostSlot: FighterSlotId = 'p1';
  private opponentLeftFlag = false;
  private combatPace: CombatPace = 'tactical';
  private net?: NetworkClient;
  private syncTimer = 0;
  private botSyncTimer = 0;

  private arenaMap: GeneratedArenaMap = generateArenaMap(1337, false);

  private camX = 640;
  private camY = 390;
  private camZoom = 1.05;

  private p1ComboDisplay = 0;
  private p1ComboFade = 0;
  private p2ComboDisplay = 0;
  private p2ComboFade = 0;

  private onPauseRequested?: () => void;
  private onMatchEnded?: (report: MatchEndReport) => void;

  private hudRefs: {
    p1Phase?: HTMLElement;
    p1HpFill?: HTMLElement;
    p1HpTrail?: HTMLElement;
    p1KiFill?: HTMLElement;
    p1EvoFill?: HTMLElement;
    p1EvoReady?: HTMLElement;
    p2Phase?: HTMLElement;
    p2HpFill?: HTMLElement;
    p2HpTrail?: HTMLElement;
    p2KiFill?: HTMLElement;
    p2EvoFill?: HTMLElement;
    p2EvoReady?: HTMLElement;
    timer?: HTMLElement;
    roundLabel?: HTMLElement;
    t1Pips?: HTMLElement[];
    t2Pips?: HTMLElement[];
    p1Combo?: HTMLElement;
    p2Combo?: HTMLElement;
    fps?: HTMLElement;
    cadenceFill?: HTMLElement;
    cadenceTag?: HTMLElement;
    skillPills?: Record<'a1' | 'a2' | 'a3' | 'a4' | 'dash', HTMLElement | undefined>;
    rumbleSlots?: Map<FighterSlotId, RumbleSlotHudRefs>;
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

  private isHostAuthority(): boolean {
    return this.matchMode !== 'online' || this.localSlot === this.hostSlot;
  }

  private getLocalFighter(): Fighter | null {
    return this.fightersBySlot.get(this.localSlot) ?? this.p1;
  }

  public setCombatPace(pace: CombatPace): void {
    this.combatPace = pace;
    for (const f of this.fighters) {
      f.setCombatPace(pace);
    }
  }

  public startMatch(config: MatchConfig): void {
    this.combat.clearAll();
    this.input.resetAll();
    this.virtualControls.resetTouchState();
    this.difficulty = config.difficulty;
    this.combatPace = config.combatPace ?? this.combatPace;

    this.matchMode = config.mode ?? 'solo';
    this.roomMode = config.roomMode === 'rumble' ? 'rumble' : '1v1';
    this.localSlot = config.localSlot ?? 'p1';
    this.hostSlot = config.hostSlot ?? 'p1';
    this.opponentLeftFlag = false;
    this.syncTimer = 0;
    this.botSyncTimer = 0;

    this.fighters = [];
    this.fightersBySlot.clear();
    this.fighterSpawns.clear();
    this.botSlots.clear();
    this.aiControllers.clear();
    this.remoteInputs.clear();
    this.lastRemoteSyncTimeBySlot.clear();
    this.lastRemoteSeqBySlot.clear();
    this.seqBySlot.clear();
    this.lastSentStateBySlot.clear();

    const seed = config.mapSeed ?? ((Math.floor(Math.random() * 0x7fffffff) >>> 0) || 1337);
    this.arenaMap = generateArenaMap(seed, this.roomMode === 'rumble', config.mapTheme);
    void preloadArenaBackground(this.arenaMap.themeId);

    const participants: MatchParticipantConfig[] =
      config.participants && config.participants.length >= 2
        ? config.participants
        : [
            {
              slot: 'p1',
              team: 1,
              userId: 'local',
              displayName:
                config.p1DisplayName ||
                this.spriteLoader.getCharacter(config.p1CharId)?.name ||
                config.p1CharId,
              charId: config.p1CharId,
              startPhase: config.p1StartPhase,
              level: config.p1Level,
              isBot: false,
            },
            {
              slot: 'p2',
              team: 2,
              userId: this.matchMode === 'online' ? 'remote' : 'bot',
              displayName:
                config.p2DisplayName ||
                this.spriteLoader.getCharacter(config.p2CharId)?.name ||
                config.p2CharId,
              charId: config.p2CharId,
              startPhase: config.p2StartPhase,
              level: config.p2Level ?? Math.max(1, config.p1Level),
              isBot: this.matchMode !== 'online',
            },
          ];

    const wireFighter = (f: Fighter) => {
      f.setCombatPace(this.combatPace);
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
          if (newPhase < 4) {
            void this.spriteLoader.loadPhasePack(evolvedFighter.charId, newPhase + 1);
          }
        },
        onPlaySfx: (sfx) => {
          this.audio.playSfx(sfx);
        },
        onLand: (landed) => {
          this.combat.spawnDustPuff(landed.x, landed.y, 5);
          this.audio.playSfx('land');
        },
        onJumpDust: (jumper) => {
          this.combat.spawnDustPuff(jumper.x, jumper.y, 4);
        },
      });
    };

    let t1Idx = 0;
    let t2Idx = 0;

    for (const p of participants) {
      const charDef = this.spriteLoader.getCharacter(p.charId);
      const pack = this.spriteLoader.getCachedPhase(p.charId, p.startPhase);
      if (!charDef || !pack) {
        throw new Error(`Pacote de sprites iniciais não carregado para ${p.charId} F${p.startPhase}.`);
      }

      const team: FighterTeam = p.team ?? teamForSlot(p.slot);
      const pool = team === 1 ? this.arenaMap.spawnPoints.team1 : this.arenaMap.spawnPoints.team2;
      const idx = team === 1 ? t1Idx++ : t2Idx++;
      const spawn = pool[idx % pool.length];
      const facing: 1 | -1 = team === 1 ? 1 : -1;
      this.fighterSpawns.set(p.slot, { x: spawn.x, y: spawn.y, facing });

      const fighter = new Fighter(
        p.slot,
        p.charId,
        p.displayName || charDef.name,
        spawn.x,
        facing,
        p.startPhase,
        p.level,
        pack,
        this.spriteLoader,
        team,
        spawn.y
      );
      fighter.arenaLeft = this.arenaMap.arenaLeft;
      fighter.arenaRight = this.arenaMap.arenaRight;
      fighter.groundY = this.arenaMap.groundY;

      wireFighter(fighter);
      this.fighters.push(fighter);
      this.fightersBySlot.set(p.slot, fighter);
      this.remoteInputs.set(p.slot, createEmptyInput());

      if (p.isBot) {
        this.botSlots.add(p.slot);
        this.aiControllers.set(p.slot, new AIController(this.difficulty));
      }

      if (p.startPhase < 4) {
        void this.spriteLoader.loadPhasePack(p.charId, p.startPhase + 1);
      }
    }

    this.p1 =
      this.fightersBySlot.get('p1') ??
      this.fighters.find((f) => f.team === 1) ??
      this.fighters[0] ??
      null;
    this.p2 =
      this.fightersBySlot.get('p2') ??
      this.fighters.find((f) => f.team === 2) ??
      this.fighters[1] ??
      null;

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
        const f = this.fightersBySlot.get(slot);
        if (!f || f.team === 1) {
          this.p1ComboDisplay = count;
          this.p1ComboFade = 1.4;
        } else {
          this.p2ComboDisplay = count;
          this.p2ComboFade = 1.4;
        }
      },
      onClash: () => {
        this.audio.playSfx('clash');
        this.virtualControls.vibrate([18, 16, 18]);
      },
    });

    this.active = true;
    this.matchEnded = false;
    this.pendingWinner = null;
    this.pendingWinnerTeam = null;
    this.pendingMatchOver = false;
    this.currentRound = 1;
    this.team1RoundWins = 0;
    this.team2RoundWins = 0;
    this.koSlowMoTimer = 0;
    this.roundIntroTimer = 0.9;
    this.roundTimer = this.roomMode === 'rumble' ? 150 : 99;

    const local = this.getLocalFighter();
    if (this.roomMode === 'rumble') {
      this.camX = local ? local.x : this.arenaMap.width * 0.5;
      this.camY = 360;
      this.camZoom = 0.82;
    } else {
      this.camX = 640;
      this.camY = 390;
      this.camZoom = 1.05;
    }

    this.p1ComboFade = 0;
    this.p2ComboFade = 0;

    this.buildHud();
    this.hudEl.classList.remove('hidden');
    this.hudEl.setAttribute('aria-hidden', 'false');
    this.virtualControls.setVisible(true);
    this.audio.startBgm();
    this.combat.spawnFloatingText(
      this.camX,
      this.camY - 60,
      'ROUND 1!',
      '#facc15',
      1.75
    );
  }

  public stopMatch(): void {
    this.active = false;
    this.input.resetAll();
    this.virtualControls.resetTouchState();
    this.p1 = null;
    this.p2 = null;
    this.fighters = [];
    this.fightersBySlot.clear();
    this.fighterSpawns.clear();
    this.botSlots.clear();
    this.aiControllers.clear();
    this.remoteInputs.clear();
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
    if (!this.active || this.matchMode !== 'online') return;
    if (payload.slot === this.localSlot) return;
    if (this.isHostAuthority() && this.botSlots.has(payload.slot)) return;

    const prevSeq = this.lastRemoteSeqBySlot.get(payload.slot) ?? -1;
    if (payload.seq <= prevSeq) return;
    this.lastRemoteSeqBySlot.set(payload.slot, payload.seq);

    const remote = this.fightersBySlot.get(payload.slot);
    if (!remote) return;

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

    // Host é autoritativo para HP de todos e relógio da partida
    if (!this.isHostAuthority() && payload.slot === this.hostSlot) {
      if (typeof payload.roundTimer === 'number') {
        this.roundTimer = payload.roundTimer;
      }
      if (typeof payload.currentRound === 'number') {
        this.currentRound = payload.currentRound;
      }
      if (typeof payload.team1RoundWins === 'number') {
        this.team1RoundWins = payload.team1RoundWins;
      }
      if (typeof payload.team2RoundWins === 'number') {
        this.team2RoundWins = payload.team2RoundWins;
      }
      if (payload.hpMap) {
        for (const [sid, hpVal] of Object.entries(payload.hpMap)) {
          const target = this.fightersBySlot.get(sid as FighterSlotId);
          if (target && typeof hpVal === 'number') {
            target.hp = hpVal;
            if (target.hp <= 0) {
              target.state = 'idle';
              target.vx = 0;
            }
          }
        }
      } else {
        const local = this.getLocalFighter();
        if (local && typeof payload.peerHp === 'number') {
          local.hp = payload.peerHp;
        }
        remote.hp = payload.hp;
      }
    } else if (!this.isHostAuthority() && this.botSlots.has(payload.slot)) {
      remote.hp = payload.hp;
      if (remote.hp <= 0) {
        remote.state = 'idle';
        remote.vx = 0;
      }
    }

    if (payload.phase > remote.phase && remote.phase < 4) {
      remote.triggerEvolution();
    }

    if (payload.state !== remote.state && remote.hp > 0) {
      if (
        payload.state === 'ataque_1' ||
        payload.state === 'ataque_2' ||
        payload.state === 'ataque_3' ||
        payload.state === 'ataque_4'
      ) {
        remote.syncRemoteAttack(
          payload.state,
          payload.attackDirX,
          payload.attackDirY
        );
      } else if (payload.state === 'evolve') {
        remote.triggerEvolution();
      }
    }

    this.remoteInputs.set(payload.slot, { ...payload.input });
    this.lastRemoteSyncTimeBySlot.set(payload.slot, performance.now());
  }

  public applyRemoteEvent(ev: CombatEventPayload): void {
    if (!this.active || this.matchMode !== 'online') return;
    if (ev.kind === 'ko' && this.pendingWinner === null) {
      if (ev.hpRemainingMap) {
        for (const [sid, hpVal] of Object.entries(ev.hpRemainingMap)) {
          const f = this.fightersBySlot.get(sid as FighterSlotId);
          if (f && typeof hpVal === 'number') {
            f.hp = hpVal;
          }
        }
      } else {
        if (this.p1 && typeof ev.p1HpRemaining === 'number') this.p1.hp = ev.p1HpRemaining;
        if (this.p2 && typeof ev.p2HpRemaining === 'number') this.p2.hp = ev.p2HpRemaining;
      }
      if (typeof ev.currentRound === 'number') {
        this.currentRound = ev.currentRound;
      }
      if (typeof ev.team1RoundWins === 'number') {
        this.team1RoundWins = ev.team1RoundWins;
      }
      if (typeof ev.team2RoundWins === 'number') {
        this.team2RoundWins = ev.team2RoundWins;
      }
      const winnerTeam =
        ev.winnerTeam ??
        (ev.winner === 'p1' ? 1 : ev.winner === 'p2' ? 2 : 'draw');
      const winner =
        ev.winner ??
        (winnerTeam === 1 ? 'p1' : winnerTeam === 2 ? 'p2' : 'draw');
      this.triggerKoSequence(winner, winnerTeam, ev.matchOver ?? true);
    }
  }

  public handleOpponentLeft(): void {
    if (!this.active || this.matchMode !== 'online') return;
    if (this.pendingWinner !== null) return;
    this.opponentLeftFlag = true;
    this.combat.spawnFloatingText(
      this.camX,
      this.camY - 90,
      'OPONENTE SAIU!',
      '#38bdf8',
      1.4
    );
    const localTeam = this.getLocalFighter()?.team ?? 1;
    const winner = localTeam === 1 ? 'p1' : 'p2';
    this.triggerKoSequence(winner, localTeam, true);
  }

  public handlePlayerLeft(slot: FighterSlotId, username?: string): void {
    if (!this.active || this.matchMode !== 'online') return;
    const f = this.fightersBySlot.get(slot);
    if (f) {
      f.hp = 0;
      f.state = 'hitstun';
      f.hitstunRemaining = 0.4;
      f.vx = 0;
      f.vy = 0;
    }
    this.combat.spawnFloatingText(
      this.camX,
      this.camY - 95,
      `${username || f?.displayName || slot.toUpperCase()} SAIU!`,
      '#38bdf8',
      1.25
    );
  }

  private consumeRemoteInput(slot: FighterSlotId): FighterInputState {
    const existing = this.remoteInputs.get(slot);
    if (!existing) return createEmptyInput();
    const lastSync = this.lastRemoteSyncTimeBySlot.get(slot) ?? 0;
    if (lastSync > 0 && performance.now() - lastSync > 220) {
      existing.moveX = 0;
      existing.moveY = 0;
      existing.left = false;
      existing.right = false;
      existing.up = false;
      existing.down = false;
      existing.block = false;
      existing.jump = false;
    }
    const snap = { ...existing };
    existing.justA1 = false;
    existing.justA2 = false;
    existing.justA3 = false;
    existing.justA4 = false;
    existing.justDash = false;
    existing.justJump = false;
    existing.justEvolve = false;
    return snap;
  }

  private triggerKoSequence(
    winner: 'p1' | 'p2' | 'draw',
    winnerTeam: 1 | 2 | 'draw',
    isMatchOver: boolean
  ): void {
    this.pendingWinner = winner;
    this.pendingWinnerTeam = winnerTeam;
    this.pendingMatchOver = isMatchOver;
    this.koSlowMoTimer = isMatchOver ? 1.55 : 1.5;
    if (winnerTeam !== 'draw') {
      for (const f of this.fighters) {
        if (f.team === winnerTeam && f.hp > 0) {
          f.enterVictory();
        }
      }
    }
    this.combat.triggerScreenShake(16, 0.45);
    const label =
      this.roundTimer <= 0
        ? 'TEMPO!'
        : winnerTeam === 'draw'
          ? 'EMPATE!'
          : `ROUND ${this.currentRound} K.O.!`;
    this.combat.spawnFloatingText(
      this.camX,
      this.camY - 40,
      label,
      '#facc15',
      1.85
    );
    this.audio.playSfx('ko');
    this.virtualControls.vibrate([60, 40, 100]);
  }

  private buildHpMap(): Partial<Record<FighterSlotId, number>> {
    const map: Partial<Record<FighterSlotId, number>> = {};
    for (const f of this.fighters) {
      map[f.slot] = f.hp;
    }
    return map;
  }

  private sendSyncForFighter(
    fighter: Fighter,
    input: FighterInputState,
    includeHostAuth: boolean
  ): void {
    if (!this.net) return;
    const nextSeq = (this.seqBySlot.get(fighter.slot) ?? 0) + 1;
    this.seqBySlot.set(fighter.slot, nextSeq);
    this.lastSentStateBySlot.set(fighter.slot, fighter.state);

    const peer = this.fighters.find((f) => f.slot !== fighter.slot);
    this.net.sendCombatSync({
      slot: fighter.slot,
      seq: nextSeq,
      x: fighter.x,
      y: fighter.y,
      vx: fighter.vx,
      vy: fighter.vy,
      facing: fighter.facing,
      attackDirX: fighter.attackDirX,
      attackDirY: fighter.attackDirY,
      grounded: fighter.grounded,
      hp: fighter.hp,
      peerHp: includeHostAuth ? peer?.hp : undefined,
      hpMap: includeHostAuth ? this.buildHpMap() : undefined,
      roundTimer: includeHostAuth ? this.roundTimer : undefined,
      currentRound: includeHostAuth ? this.currentRound : undefined,
      team1RoundWins: includeHostAuth ? this.team1RoundWins : undefined,
      team2RoundWins: includeHostAuth ? this.team2RoundWins : undefined,
      ki: fighter.ki,
      evoEnergy: fighter.evoEnergy,
      phase: fighter.phase,
      state: fighter.state,
      stateTime: fighter.stateTime,
      hitstunRemaining: fighter.hitstunRemaining,
      invulnTime: fighter.invulnTime,
      input,
    });
  }

  public update(dt: number): void {
    const localFighter = this.getLocalFighter();
    if (!this.active || this.fighters.length < 2 || !localFighter) return;

    const sampledLocal = this.input.sample();
    if (this.input.consumePauseRequested()) {
      this.input.resetAll();
      this.virtualControls.resetTouchState();
      this.audio.playSfx('ui');
      this.onPauseRequested?.();
      return;
    }

    if (this.pendingWinner !== null) {
      this.koSlowMoTimer -= dt;
      const slowDt = dt * 0.28;
      const idleInput = createEmptyInput();
      for (const f of this.fighters) {
        f.update(slowDt, idleInput, this.fighters, this.arenaMap.platforms);
      }
      this.combat.updateMulti(
        slowDt,
        this.fighters,
        this.arenaMap.arenaLeft,
        this.arenaMap.arenaRight
      );
      const winnerAnchor =
        this.pendingWinnerTeam !== null && this.pendingWinnerTeam !== 'draw'
          ? this.fighters.find((f) => f.team === this.pendingWinnerTeam && f.hp > 0)
          : undefined;
      if (winnerAnchor) {
        this.camX += (winnerAnchor.x - this.camX) * Math.min(1, dt * 4);
        this.camY += (winnerAnchor.y - 115 - this.camY) * Math.min(1, dt * 4);
        this.camZoom += (1.18 - this.camZoom) * Math.min(1, dt * 3);
      }
      if (this.koSlowMoTimer <= 0 && !this.matchEnded) {
        if (!this.pendingMatchOver) {
          this.startNextRound();
          return;
        }
        this.matchEnded = true;
        this.active = false;
        this.virtualControls.setVisible(false);
        this.audio.stopBgm();

        let winnerTeam: 1 | 2 | 'draw';
        if (this.opponentLeftFlag) {
          winnerTeam = localFighter.team;
        } else if (this.team1RoundWins > this.team2RoundWins) {
          winnerTeam = 1;
        } else if (this.team2RoundWins > this.team1RoundWins) {
          winnerTeam = 2;
        } else {
          winnerTeam =
            this.pendingWinnerTeam ??
            (this.pendingWinner === 'p1'
              ? 1
              : this.pendingWinner === 'p2'
                ? 2
                : 'draw');
        }
        const winner: 'p1' | 'p2' | 'draw' =
          winnerTeam === 1 ? 'p1' : winnerTeam === 2 ? 'p2' : 'draw';
        const localWon = winnerTeam === localFighter.team;

        this.onMatchEnded?.({
          winner,
          winnerTeam,
          localWon,
          p1HpRemaining: this.p1?.hp ?? 0,
          p2HpRemaining: this.p2?.hp ?? 0,
          p1FinalPhase: this.p1?.phase ?? 1,
          p2FinalPhase: this.p2?.phase ?? 1,
          team1RoundWins: this.team1RoundWins,
          team2RoundWins: this.team2RoundWins,
          roundsPlayed: this.currentRound,
          localSlot: this.localSlot,
          roomMode: this.roomMode,
          mode: this.matchMode,
          opponentLeft: this.opponentLeftFlag,
          xpEarned:
            localFighter.xpEarnedInMatch +
            (localWon ? (this.roomMode === 'rumble' ? 85 : 65) : 25),
        });
      }
      return;
    }

    if (this.roundIntroTimer > 0) {
      this.roundIntroTimer = Math.max(0, this.roundIntroTimer - dt);
      if (this.roundIntroTimer === 0) {
        this.combat.spawnFloatingText(
          this.camX,
          this.camY - 60,
          'LUTEM!',
          '#38bdf8',
          1.75
        );
      }
    } else {
      this.roundTimer = Math.max(0, this.roundTimer - dt);
    }

    const canAct = this.roundIntroTimer <= 0;
    const localInput =
      canAct && localFighter.hp > 0 ? sampledLocal : createEmptyInput();
    const frameInputs = new Map<FighterSlotId, FighterInputState>();

    for (const f of this.fighters) {
      if (!canAct || f.hp <= 0) {
        frameInputs.set(f.slot, createEmptyInput());
      } else if (f.slot === this.localSlot) {
        frameInputs.set(f.slot, localInput);
      } else if (this.botSlots.has(f.slot) && this.isHostAuthority()) {
        const ai = this.aiControllers.get(f.slot) ?? new AIController(this.difficulty);
        this.aiControllers.set(f.slot, ai);
        frameInputs.set(
          f.slot,
          ai.sampleMulti(dt, f, this.fighters, this.arenaMap.platforms)
        );
      } else {
        frameInputs.set(f.slot, this.consumeRemoteInput(f.slot));
      }
    }

    const stepPhysics = this.combat.updateMulti(
      dt,
      this.fighters,
      this.arenaMap.arenaLeft,
      this.arenaMap.arenaRight
    );
    if (stepPhysics) {
      for (const f of this.fighters) {
        f.update(
          dt,
          frameInputs.get(f.slot) ?? createEmptyInput(),
          this.fighters,
          this.arenaMap.platforms
        );
      }
      // Separação corporal executada após integrar física/velocidades para manter espaçamento limpo sem puxão
      this.combat.resolveBodyPushMulti(this.fighters, dt);
    }

    // Sincronização em tempo real online
    if (this.matchMode === 'online' && this.net) {
      this.syncTimer += dt;
      const lastLocalState = this.lastSentStateBySlot.get(this.localSlot) ?? 'idle';
      const immediate =
        localInput.justA1 ||
        localInput.justA2 ||
        localInput.justA3 ||
        localInput.justA4 ||
        localInput.justJump ||
        localInput.justEvolve ||
        localFighter.state !== lastLocalState;

      if (immediate || this.syncTimer >= 0.033) {
        this.syncTimer = 0;
        this.sendSyncForFighter(localFighter, localInput, this.isHostAuthority());
      }

      if (this.isHostAuthority() && this.botSlots.size > 0) {
        this.botSyncTimer += dt;
        if (this.botSyncTimer >= 0.04) {
          this.botSyncTimer = 0;
          for (const botSlot of this.botSlots) {
            const bot = this.fightersBySlot.get(botSlot);
            if (!bot) continue;
            const botInput = frameInputs.get(botSlot) ?? createEmptyInput();
            this.sendSyncForFighter(bot, botInput, false);
          }
        }
      }
    }

    this.p1ComboFade = Math.max(0, this.p1ComboFade - dt);
    this.p2ComboFade = Math.max(0, this.p2ComboFade - dt);

    this.updateCamera(dt, localFighter);

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
      localFighter.getMoveNames(),
      localFighter.getGlobalCooldownRatio(),
      localFighter.dashCooldown / 0.45,
      localFighter.canChainCombo()
    );

    if (this.isHostAuthority()) {
      this.evaluateRoundEnd();
    }
  }

  private updateCamera(dt: number, localFighter: Fighter): void {
    if (this.roomMode !== 'rumble' && this.p1 && this.p2) {
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
      return;
    }

    // Rumble Arena (2600px + múltiplas plataformas): acompanha jogador local + luta próxima
    const anchor =
      localFighter.hp > 0
        ? localFighter
        : this.fighters.find((f) => f.hp > 0 && f.team === localFighter.team) ??
          this.fighters.find((f) => f.hp > 0) ??
          localFighter;

    const aliveOthers = this.fighters
      .filter((f) => f.slot !== anchor.slot && f.hp > 0)
      .sort(
        (a, b) =>
          Math.hypot(a.x - anchor.x, a.y - anchor.y) -
          Math.hypot(b.x - anchor.x, b.y - anchor.y)
      );

    let focusX = anchor.x;
    let focusY = anchor.y;
    let spreadX = 480;

    if (aliveOthers.length > 0) {
      const nearby = aliveOthers.slice(0, 2).filter((o) => Math.abs(o.x - anchor.x) < 760);
      if (nearby.length > 0) {
        let sumX = anchor.x * 2;
        let sumY = anchor.y * 2;
        for (const o of nearby) {
          sumX += o.x;
          sumY += o.y;
          spreadX = Math.max(spreadX, Math.abs(o.x - anchor.x));
        }
        const denom = 2 + nearby.length;
        focusX = sumX / denom;
        focusY = sumY / denom;
      }
    }

    const isDramatic =
      anchor.state === 'ataque_4' || anchor.state === 'evolve';
    const targetZoom = isDramatic
      ? 1.04
      : Math.max(0.64, Math.min(0.98, 1.06 - spreadX / 2150));

    const targetCamX = Math.max(
      this.arenaMap.arenaLeft + 240,
      Math.min(this.arenaMap.arenaRight - 240, focusX)
    );
    const targetCamY = Math.max(200, Math.min(440, focusY - 120));

    this.camX += (targetCamX - this.camX) * Math.min(1, dt * 7);
    this.camY += (targetCamY - this.camY) * Math.min(1, dt * 7);
    this.camZoom += (targetZoom - this.camZoom) * Math.min(1, dt * 5);
  }

  private startNextRound(): void {
    this.currentRound += 1;
    this.input.resetAll();
    this.virtualControls.resetTouchState();
    this.pendingWinner = null;
    this.pendingWinnerTeam = null;
    this.pendingMatchOver = false;
    this.koSlowMoTimer = 0;
    this.roundTimer = this.roomMode === 'rumble' ? 150 : 99;
    this.roundIntroTimer = 0.9;
    this.p1ComboDisplay = 0;
    this.p1ComboFade = 0;
    this.p2ComboDisplay = 0;
    this.p2ComboFade = 0;

    this.combat.clearAll();

    for (const f of this.fighters) {
      const sp = this.fighterSpawns.get(f.slot) ?? {
        x: f.team === 1 ? this.arenaMap.arenaLeft + 200 : this.arenaMap.arenaRight - 200,
        y: this.arenaMap.groundY,
        facing: (f.team === 1 ? 1 : -1) as 1 | -1,
      };
      f.resetForNewRound(sp.x, sp.y, sp.facing);
    }

    const local = this.getLocalFighter();
    if (this.roomMode === 'rumble') {
      this.camX = local ? local.x : this.arenaMap.width * 0.5;
      this.camY = 360;
      this.camZoom = 0.82;
    } else {
      this.camX = 640;
      this.camY = 390;
      this.camZoom = 1.05;
    }

    const roundTitle =
      this.currentRound >= this.maxRounds
        ? 'ROUND FINAL!'
        : `ROUND ${this.currentRound}!`;
    this.combat.spawnFloatingText(
      this.camX,
      this.camY - 60,
      roundTitle,
      '#facc15',
      1.8
    );
  }

  private evaluateRoundEnd(): void {
    const team1 = this.fighters.filter((f) => f.team === 1);
    const team2 = this.fighters.filter((f) => f.team === 2);

    const t1Alive = team1.some((f) => f.hp > 0);
    const t2Alive = team2.some((f) => f.hp > 0);

    if (t1Alive && t2Alive && this.roundTimer > 0) return;

    let winnerTeam: 1 | 2 | 'draw';
    if (!t1Alive && !t2Alive) {
      winnerTeam = 'draw';
    } else if (!t2Alive) {
      winnerTeam = 1;
    } else if (!t1Alive) {
      winnerTeam = 2;
    } else {
      const t1Pct =
        team1.reduce((acc, f) => acc + Math.max(0, f.hp) / f.maxHp, 0) /
        Math.max(1, team1.length);
      const t2Pct =
        team2.reduce((acc, f) => acc + Math.max(0, f.hp) / f.maxHp, 0) /
        Math.max(1, team2.length);
      winnerTeam =
        Math.abs(t1Pct - t2Pct) < 0.001 ? 'draw' : t1Pct > t2Pct ? 1 : 2;
    }

    if (winnerTeam === 1) {
      this.team1RoundWins += 1;
    } else if (winnerTeam === 2) {
      this.team2RoundWins += 1;
    }

    const isMatchOver =
      this.team1RoundWins >= this.winsRequired ||
      this.team2RoundWins >= this.winsRequired ||
      this.currentRound >= this.maxRounds;

    const winner: 'p1' | 'p2' | 'draw' =
      winnerTeam === 1 ? 'p1' : winnerTeam === 2 ? 'p2' : 'draw';

    if (this.matchMode === 'online' && this.net) {
      this.net.sendCombatEvent({
        kind: 'ko',
        slot: this.hostSlot,
        winner,
        winnerTeam,
        p1HpRemaining: this.p1?.hp ?? 0,
        p2HpRemaining: this.p2?.hp ?? 0,
        hpRemainingMap: this.buildHpMap(),
        p1FinalPhase: this.p1?.phase ?? 1,
        currentRound: this.currentRound,
        team1RoundWins: this.team1RoundWins,
        team2RoundWins: this.team2RoundWins,
        matchOver: isMatchOver,
      });
    }

    this.triggerKoSequence(winner, winnerTeam, isMatchOver);
  }

  public render(fps: number): void {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    if (!this.active || this.fighters.length === 0) {
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

    // 1. Céu / Plano de fundo temático
    renderThemeBackground(ctx, cw, ch, this.camX, this.camY, this.arenaMap, viewScale);

    // 2. Mundo da Arena transformado pela câmera
    ctx.save();
    ctx.translate(cw * 0.5 + shakeX, ch * 0.56 + shakeY);
    ctx.scale(viewScale, viewScale);
    ctx.translate(-this.camX, -this.camY);

    renderArenaWorld(ctx, this.arenaMap);

    // Z-order estável para evitar troca brusca de profundidade durante trocas de golpes
    const stateZPriority = (f: Fighter): number => {
      if (f.hp <= 0) return -1;
      if (f.state === 'ataque_4' || f.state === 'evolve') return 3;
      if (
        f.state === 'ataque_2' ||
        f.state === 'ataque_1' ||
        f.state === 'ataque_3'
      ) {
        return 2;
      }
      return 1;
    };
    const ordered = [...this.fighters].sort((a, b) => {
      const pa = stateZPriority(a);
      const pb = stateZPriority(b);
      if (pa !== pb) return pa - pb;
      if (a.slot === this.localSlot) return 1;
      if (b.slot === this.localSlot) return -1;
      return 0;
    });

    // Camada 1: auras atrás de todos os sprites para evitar halo cobrindo o oponente
    for (const f of ordered) {
      f.renderAura(ctx);
    }

    // Camada 2: sombras, afterimages e corpos dos lutadores
    for (const f of ordered) {
      f.render(ctx, {
        showOverheadHud: this.roomMode === 'rumble',
        isLocal: f.slot === this.localSlot,
        platforms: this.arenaMap.platforms,
      });
    }

    this.combat.render(ctx);

    ctx.restore();

    // 3. Indicadores de lutadores fora da tela no Rumble Arena
    if (this.roomMode === 'rumble') {
      this.renderOffscreenMarkers(ctx, cw, ch, viewScale);
    }

    // 4. Vinheta dramática durante Ultimate, Evolução ou K.O.
    const isClimax =
      this.pendingWinner !== null ||
      this.fighters.some(
        (f) => f.hp > 0 && (f.state === 'ataque_4' || f.state === 'evolve')
      );
    if (isClimax) {
      ctx.save();
      const vig = ctx.createRadialGradient(
        cw * 0.5,
        ch * 0.5,
        Math.min(cw, ch) * 0.28,
        cw * 0.5,
        ch * 0.5,
        Math.max(cw, ch) * 0.72
      );
      vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vig.addColorStop(1, 'rgba(4, 6, 16, 0.42)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
    }

    // 5. Flash de impacto / Ultimate
    if (this.combat.flashAlpha > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${this.combat.flashAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
    }

    this.updateHudDom(fps);
  }

  private renderOffscreenMarkers(
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number,
    viewScale: number
  ): void {
    const pad = 34;
    for (const f of this.fighters) {
      if (f.hp <= 0) continue;
      const sx = cw * 0.5 + (f.x - this.camX) * viewScale;
      const sy = ch * 0.56 + (f.y - 90 - this.camY) * viewScale;
      if (sx >= 16 && sx <= cw - 16 && sy >= 56 && sy <= ch - 16) continue;

      const mx = Math.max(pad, Math.min(cw - pad, sx));
      const my = Math.max(92, Math.min(ch - pad, sy));
      const angle = Math.atan2(sy - my, sx - mx);
      const color = f.team === 1 ? '#38bdf8' : '#ff4757';

      ctx.save();
      ctx.translate(mx, my);
      ctx.fillStyle = 'rgba(8, 12, 26, 0.85)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Seta direcional
      ctx.save();
      ctx.rotate(angle);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(12, -5);
      ctx.lineTo(12, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Sigla e HP mini
      ctx.fillStyle = '#f8fafc';
      ctx.font = '800 9px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.slot.toUpperCase(), 0, 3);
      ctx.restore();
    }
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

  private buildHud(): void {
    if (this.roomMode === 'rumble') {
      this.buildRumbleHud();
      return;
    }
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
          <div class="ak-round-row">
            <div class="ak-round-pips" id="hud-t1-pips">
              <span class="ak-round-pip" data-pip="1"></span>
              <span class="ak-round-pip" data-pip="2"></span>
            </div>
            <span class="ak-round-badge" id="hud-round-label">R1/3</span>
            <div class="ak-round-pips" id="hud-t2-pips">
              <span class="ak-round-pip p2" data-pip="1"></span>
              <span class="ak-round-pip p2" data-pip="2"></span>
            </div>
          </div>
          <div class="ak-timer-box" id="hud-timer">99</div>
          <div class="ak-cadence-pill" title="Intervalo global entre golpes">
            <span class="ak-cadence-label" id="hud-cadence-tag">GOLPE PRONTO</span>
            <div class="ak-cadence-track"><div class="ak-cadence-fill ready" id="hud-cadence-fill" style="width:100%"></div></div>
          </div>
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
      <div class="ak-skills-dock" id="hud-skills-dock">
        <span class="ak-skill-pill" id="hud-sk-a1" data-sk="a1"><b>A1</b><i></i></span>
        <span class="ak-skill-pill" id="hud-sk-a2" data-sk="a2"><b>A2</b><i></i></span>
        <span class="ak-skill-pill" id="hud-sk-a3" data-sk="a3"><b>A3</b><i></i></span>
        <span class="ak-skill-pill" id="hud-sk-a4" data-sk="a4"><b>ULT</b><i></i></span>
        <span class="ak-skill-pill" id="hud-sk-dash" data-sk="dash"><b>DASH</b><i></i></span>
      </div>
      <div class="ak-fps-tag" id="hud-fps">60 FPS</div>
    `;

    const q = (sel: string) => this.hudEl.querySelector<HTMLElement>(sel) ?? undefined;
    this.hudRefs = {
      p1Phase: q('#hud-p1-phase'),
      p1HpFill: q('#hud-p1-hp-fill'),
      p1HpTrail: q('#hud-p1-hp-trail'),
      p1KiFill: q('#hud-p1-ki'),
      p1EvoFill: q('#hud-p1-evo'),
      p1EvoReady: q('#hud-p1-evo-ready'),
      p2Phase: q('#hud-p2-phase'),
      p2HpFill: q('#hud-p2-hp-fill'),
      p2HpTrail: q('#hud-p2-hp-trail'),
      p2KiFill: q('#hud-p2-ki'),
      p2EvoFill: q('#hud-p2-evo'),
      p2EvoReady: q('#hud-p2-evo-ready'),
      timer: q('#hud-timer'),
      roundLabel: q('#hud-round-label'),
      t1Pips: Array.from(this.hudEl.querySelectorAll<HTMLElement>('#hud-t1-pips .ak-round-pip')),
      t2Pips: Array.from(this.hudEl.querySelectorAll<HTMLElement>('#hud-t2-pips .ak-round-pip')),
      p1Combo: q('#hud-p1-combo'),
      p2Combo: q('#hud-p2-combo'),
      fps: q('#hud-fps'),
      cadenceFill: q('#hud-cadence-fill'),
      cadenceTag: q('#hud-cadence-tag'),
      skillPills: {
        a1: q('#hud-sk-a1'),
        a2: q('#hud-sk-a2'),
        a3: q('#hud-sk-a3'),
        a4: q('#hud-sk-a4'),
        dash: q('#hud-sk-dash'),
      },
    };

    this.hudEl.querySelector('#hud-pause-btn')?.addEventListener('click', () => {
      this.audio.playSfx('ui');
      this.onPauseRequested?.();
    });
  }

  private buildRumbleHud(): void {
    const team1 = this.fighters.filter((f) => f.team === 1);
    const team2 = this.fighters.filter((f) => f.team === 2);

    const renderTeamSlot = (f: Fighter) => {
      const isMe = f.slot === this.localSlot;
      const tag = isMe ? ' (VOCÊ)' : '';
      return `
        <div class="ak-rumble-slot-hud ${isMe ? 'is-local' : ''}" id="hud-rslot-${f.slot}">
          <div class="ak-rumble-slot-head">
            <span class="ak-rumble-slot-name">${escapeHtml(f.displayName + tag)}</span>
            <span class="ak-fase-badge" id="hud-rslot-${f.slot}-phase">F${f.phase}</span>
          </div>
          <div class="ak-hp-track ak-hp-track-sm">
            <div class="ak-hp-trail" id="hud-rslot-${f.slot}-hp-trail" style="width:100%"></div>
            <div class="ak-hp-fill ${f.team === 2 ? 'p2-fill' : ''}" id="hud-rslot-${f.slot}-hp-fill" style="width:100%"></div>
          </div>
          ${
            isMe
              ? `<div class="ak-subbars ak-subbars-compact">
                   <div class="ak-mini-track" title="Ki"><div class="ak-ki-fill" id="hud-rslot-${f.slot}-ki" style="width:45%"></div></div>
                   <div class="ak-mini-track" title="Evolução"><div class="ak-evo-fill" id="hud-rslot-${f.slot}-evo" style="width:0%"></div></div>
                   <span class="ak-fase-badge hidden" id="hud-rslot-${f.slot}-evo-ready" style="border-color:#c084fc;background:rgba(168,85,247,0.35);color:#fef08a;">EVO!</span>
                 </div>`
              : ''
          }
        </div>
      `;
    };

    this.hudEl.innerHTML = `
      <div class="ak-hud-top ak-hud-rumble-top">
        <div class="ak-rumble-team-hud t1">
          <div class="ak-rumble-team-label blue">TIME AZUL</div>
          ${team1.map(renderTeamSlot).join('')}
        </div>

        <div class="ak-hud-center">
          <div class="ak-round-row">
            <div class="ak-round-pips" id="hud-t1-pips">
              <span class="ak-round-pip" data-pip="1"></span>
              <span class="ak-round-pip" data-pip="2"></span>
            </div>
            <span class="ak-round-badge" id="hud-round-label">R1/3</span>
            <div class="ak-round-pips" id="hud-t2-pips">
              <span class="ak-round-pip p2" data-pip="1"></span>
              <span class="ak-round-pip p2" data-pip="2"></span>
            </div>
          </div>
          <div class="ak-timer-box" id="hud-timer">150</div>
          <div class="ak-cadence-pill" title="Intervalo global entre golpes">
            <span class="ak-cadence-label" id="hud-cadence-tag">GOLPE PRONTO</span>
            <div class="ak-cadence-track"><div class="ak-cadence-fill ready" id="hud-cadence-fill" style="width:100%"></div></div>
          </div>
          <div class="ak-map-tag">${escapeHtml(this.arenaMap.themeName)} · ${escapeHtml(this.arenaMap.archetypeName)}</div>
          <button type="button" class="ak-pause-btn" id="hud-pause-btn">PAUSA</button>
        </div>

        <div class="ak-rumble-team-hud t2">
          <div class="ak-rumble-team-label red">TIME VERMELHO</div>
          ${team2.map(renderTeamSlot).join('')}
        </div>
      </div>

      <div class="ak-combo-banner hidden" id="hud-p1-combo">2 HITS!</div>
      <div class="ak-combo-banner p2 hidden" id="hud-p2-combo">2 HITS!</div>
      <div class="ak-skills-dock" id="hud-skills-dock">
        <span class="ak-skill-pill" id="hud-sk-a1" data-sk="a1"><b>A1</b><i></i></span>
        <span class="ak-skill-pill" id="hud-sk-a2" data-sk="a2"><b>A2</b><i></i></span>
        <span class="ak-skill-pill" id="hud-sk-a3" data-sk="a3"><b>A3</b><i></i></span>
        <span class="ak-skill-pill" id="hud-sk-a4" data-sk="a4"><b>ULT</b><i></i></span>
        <span class="ak-skill-pill" id="hud-sk-dash" data-sk="dash"><b>DASH</b><i></i></span>
      </div>
      <div class="ak-fps-tag" id="hud-fps">60 FPS</div>
    `;

    const rumbleSlots = new Map<FighterSlotId, RumbleSlotHudRefs>();
    for (const f of this.fighters) {
      const card = this.hudEl.querySelector<HTMLElement>(`#hud-rslot-${f.slot}`);
      const hpFill = this.hudEl.querySelector<HTMLElement>(`#hud-rslot-${f.slot}-hp-fill`);
      const hpTrail = this.hudEl.querySelector<HTMLElement>(`#hud-rslot-${f.slot}-hp-trail`);
      const phaseBadge = this.hudEl.querySelector<HTMLElement>(`#hud-rslot-${f.slot}-phase`);
      if (card && hpFill && hpTrail && phaseBadge) {
        rumbleSlots.set(f.slot, {
          card,
          hpFill,
          hpTrail,
          phaseBadge,
          kiFill:
            this.hudEl.querySelector<HTMLElement>(`#hud-rslot-${f.slot}-ki`) ?? undefined,
          evoFill:
            this.hudEl.querySelector<HTMLElement>(`#hud-rslot-${f.slot}-evo`) ?? undefined,
          evoReady:
            this.hudEl.querySelector<HTMLElement>(`#hud-rslot-${f.slot}-evo-ready`) ??
            undefined,
        });
      }
    }

    const q = (sel: string) => this.hudEl.querySelector<HTMLElement>(sel) ?? undefined;
    this.hudRefs = {
      timer: q('#hud-timer'),
      roundLabel: q('#hud-round-label'),
      t1Pips: Array.from(this.hudEl.querySelectorAll<HTMLElement>('#hud-t1-pips .ak-round-pip')),
      t2Pips: Array.from(this.hudEl.querySelectorAll<HTMLElement>('#hud-t2-pips .ak-round-pip')),
      p1Combo: q('#hud-p1-combo'),
      p2Combo: q('#hud-p2-combo'),
      fps: q('#hud-fps'),
      cadenceFill: q('#hud-cadence-fill'),
      cadenceTag: q('#hud-cadence-tag'),
      rumbleSlots,
    };

    this.hudEl.querySelector('#hud-pause-btn')?.addEventListener('click', () => {
      this.audio.playSfx('ui');
      this.onPauseRequested?.();
    });
  }

  private updateHudDom(fps: number): void {
    if (this.roomMode === 'rumble' && this.hudRefs.rumbleSlots) {
      for (const f of this.fighters) {
        const refs = this.hudRefs.rumbleSlots.get(f.slot);
        if (!refs) continue;
        const hpPct = Math.max(0, (f.hp / f.maxHp) * 100);
        const w = `${hpPct.toFixed(1)}%`;
        refs.hpFill.style.width = w;
        refs.hpTrail.style.width = w;
        refs.hpFill.classList.toggle('danger', hpPct < 30);
        refs.card.classList.toggle('is-ko', f.hp <= 0);
        const phaseTxt = `F${f.phase}`;
        if (refs.phaseBadge.textContent !== phaseTxt) {
          refs.phaseBadge.textContent = phaseTxt;
        }
        if (refs.kiFill) {
          refs.kiFill.style.width = `${(f.ki / f.maxKi) * 100}%`;
        }
        if (refs.evoFill) {
          refs.evoFill.style.width = `${f.phase >= 4 ? 100 : f.evoEnergy}%`;
        }
        if (refs.evoReady) {
          refs.evoReady.classList.toggle('hidden', !f.canEvolveNow());
        }
      }
    } else if (this.p1 && this.p2) {
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
    }

    if (this.hudRefs.timer) {
      const sec = String(Math.ceil(this.roundTimer));
      if (this.hudRefs.timer.textContent !== sec) {
        this.hudRefs.timer.textContent = sec;
      }
    }

    if (this.hudRefs.roundLabel) {
      const rTxt =
        this.currentRound >= this.maxRounds
          ? 'FINAL'
          : `R${this.currentRound}/${this.maxRounds}`;
      if (this.hudRefs.roundLabel.textContent !== rTxt) {
        this.hudRefs.roundLabel.textContent = rTxt;
      }
    }
    if (this.hudRefs.t1Pips) {
      this.hudRefs.t1Pips.forEach((pip, idx) => {
        pip.classList.toggle('won', idx < this.team1RoundWins);
      });
    }
    if (this.hudRefs.t2Pips) {
      this.hudRefs.t2Pips.forEach((pip, idx) => {
        pip.classList.toggle('won', idx < this.team2RoundWins);
      });
    }

    const formatCombo = (hits: number) => {
      const tier =
        hits >= 10 ? ' LENDÁRIO!' : hits >= 6 ? ' BRUTAL!' : hits >= 3 ? ' BOM!' : '';
      return `${hits} HITS!${tier}`;
    };

    if (this.hudRefs.p1Combo) {
      const show = this.p1ComboFade > 0 && this.p1ComboDisplay >= 2;
      this.hudRefs.p1Combo.classList.toggle('hidden', !show);
      if (show) {
        this.hudRefs.p1Combo.textContent = formatCombo(this.p1ComboDisplay);
      }
    }
    if (this.hudRefs.p2Combo) {
      const show = this.p2ComboFade > 0 && this.p2ComboDisplay >= 2;
      this.hudRefs.p2Combo.classList.toggle('hidden', !show);
      if (show) {
        this.hudRefs.p2Combo.textContent = formatCombo(this.p2ComboDisplay);
      }
    }

    if (this.hudRefs.fps) {
      const txt = `${fps} FPS`;
      if (this.hudRefs.fps.textContent !== txt) {
        this.hudRefs.fps.textContent = txt;
      }
    }

    const localFighter = this.getLocalFighter();
    if (localFighter && this.hudRefs.cadenceFill && this.hudRefs.cadenceTag) {
      const ratio = localFighter.getGlobalCooldownRatio();
      const readyPct = Math.max(0, Math.min(100, (1 - ratio) * 100));
      this.hudRefs.cadenceFill.style.width = `${readyPct.toFixed(0)}%`;
      const isReady = ratio <= 0.01;
      this.hudRefs.cadenceFill.classList.toggle('ready', isReady);
      const label = isReady ? 'GOLPE PRONTO' : 'INTERVALO';
      if (this.hudRefs.cadenceTag.textContent !== label) {
        this.hudRefs.cadenceTag.textContent = label;
      }
    }
    if (localFighter && this.hudRefs.skillPills) {
      const chainReady = localFighter.canChainCombo();
      const pills: Array<{
        key: 'a1' | 'a2' | 'a3' | 'a4' | 'dash';
        cd: number;
        hasKi: boolean;
        chain?: boolean;
      }> = [
        { key: 'a1', cd: localFighter.cooldowns.ataque_1 / ATTACK_SPECS.ataque_1.cooldown, hasKi: true },
        { key: 'a2', cd: localFighter.cooldowns.ataque_2 / ATTACK_SPECS.ataque_2.cooldown, hasKi: localFighter.ki >= ATTACK_SPECS.ataque_2.kiCost, chain: chainReady },
        { key: 'a3', cd: localFighter.cooldowns.ataque_3 / ATTACK_SPECS.ataque_3.cooldown, hasKi: localFighter.ki >= ATTACK_SPECS.ataque_3.kiCost, chain: chainReady },
        { key: 'a4', cd: localFighter.cooldowns.ataque_4 / ATTACK_SPECS.ataque_4.cooldown, hasKi: localFighter.ki >= ATTACK_SPECS.ataque_4.kiCost, chain: chainReady },
        { key: 'dash', cd: localFighter.dashCooldown / 0.45, hasKi: true, chain: chainReady },
      ];
      for (const p of pills) {
        const el = this.hudRefs.skillPills[p.key];
        if (!el) continue;
        const clamped = Math.max(0, Math.min(1, p.cd));
        el.classList.toggle('on-cd', clamped > 0.01);
        el.classList.toggle('no-ki', !p.hasKi);
        el.classList.toggle('combo-link', Boolean(p.chain && clamped <= 0.01 && p.hasKi));
        const bar = el.querySelector<HTMLElement>('i');
        if (bar) {
          bar.style.transform = `scaleX(${(1 - clamped).toFixed(2)})`;
        }
      }
    }
  }
}
