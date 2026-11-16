import './styles/main.css';
import { AudioManager } from './engine/AudioManager';
import { GameLoop } from './engine/GameLoop';
import { InputManager } from './engine/InputManager';
import { SpriteLoader } from './engine/SpriteLoader';
import { generateArenaMap, preloadArenaBackground } from './game/ArenaMap';
import { ArenaScene, MatchConfig } from './game/ArenaScene';
import { getBeatEmUpStage, preloadBeatEmUpStageBackgrounds } from './game/BeatEmUpMap';
import { BeatEmUpConfig, BeatEmUpScene } from './game/BeatEmUpScene';
import { NetworkClient } from './net/NetworkClient';
import { PwaManager } from './pwa/PwaManager';
import { SaveManager } from './storage/SaveManager';
import { Menus } from './ui/Menus';
import { OrientationGuard } from './ui/OrientationGuard';
import { VirtualControls } from './ui/VirtualControls';

async function bootstrap(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('Canvas #game-canvas não encontrado.');

  const save = new SaveManager();
  await save.load();

  const net = new NetworkClient(save);
  const spriteLoader = new SpriteLoader();
  const manifest = await spriteLoader.loadManifest();
  await spriteLoader.loadMenuManifest();

  const pwa = new PwaManager();
  const audio = new AudioManager();
  const input = new InputManager();
  const virtualControls = new VirtualControls(input);

  // Desbloqueia Web Audio API no primeiro toque ou tecla
  input.setOnFirstGesture(() => audio.unlock());
  input.setOnInputModeChange((isTouch) => {
    virtualControls.syncInputMode(isTouch);
  });

  const arena = new ArenaScene(canvas, spriteLoader, input, virtualControls, audio);
  arena.setNetworkClient(net);
  const beatEmUp = new BeatEmUpScene(canvas, spriteLoader, input, virtualControls, audio);
  const isAnySceneActive = () => arena.isActive() || beatEmUp.isActive();

  const applySettings = () => {
    const s = save.getData().settings;
    virtualControls.setAppearance(s.controlsOpacity, s.controlsScale, s.hapticFeedback);
    input.setStickDeadzone(s.stickDeadzone);
    input.setJumpViaStick(s.jumpViaStick);
    input.setKeyBindings(s.keyBindings);
    input.setGamepadBindings(s.gamepadBindings);
    input.setGamepadDeadzone(s.gamepadDeadzone);
    arena.setCombatPace(s.combatPace);
    audio.setVolumes(s.bgmVolume, s.sfxVolume, s.bgmMuted, s.sfxMuted);
  };
  applySettings();

  let manualPause = false;
  let orientationPause = false;
  let loop!: GameLoop;

  const syncPauseState = () => {
    const pausePhysics =
      !arena.isOnlineMatch() && (manualPause || orientationPause);
    loop.setPaused(pausePhysics);
  };

  const orientationGuard = new OrientationGuard((blocked) => {
    orientationPause = blocked;
    syncPauseState();
  });

  loop = new GameLoop(
    (dt) => {
      if (beatEmUp.isActive()) {
        beatEmUp.update(dt);
      } else {
        arena.update(dt);
      }
    },
    (_alpha, fps) => {
      if (
        manualPause &&
        !orientationPause &&
        isAnySceneActive() &&
        !input.isCapturing() &&
        input.pollGamepadPauseEdge()
      ) {
        manualPause = false;
        input.resetAll();
        virtualControls.resetTouchState();
        menus.closePause();
        syncPauseState();
      }
      if (beatEmUp.isActive()) {
        beatEmUp.render(fps);
      } else {
        arena.render(fps);
      }
    },
    (hidden) => {
      if (hidden) {
        input.resetAll();
        virtualControls.resetTouchState();
      }
      if (hidden && isAnySceneActive() && !arena.isOnlineMatch()) {
        manualPause = true;
        menus.openPause();
        syncPauseState();
      }
    }
  );

  let lastConfig: MatchConfig | null = null;
  let lastBeatEmUpConfig: BeatEmUpConfig | null = null;
  let activeSceneKind: 'arena' | 'beatemup' = 'arena';

  const startMatchFlow = async (config: MatchConfig) => {
    beatEmUp.stopMatch();
    activeSceneKind = 'arena';
    const seed = config.mapSeed ?? ((Math.floor(Math.random() * 0x7fffffff) >>> 0) || 1337);
    const resolvedConfig: MatchConfig = {
      ...config,
      mapSeed: seed,
      combatPace: config.combatPace ?? save.getData().settings.combatPace,
    };
    lastConfig = resolvedConfig;
    manualPause = false;
    menus.setActiveMatchMode(resolvedConfig.mode ?? 'solo');
    menus.showLoading(0);

    // Pré-carrega somente a fase inicial de cada lutador participante
    const preloadByChar = new Map<string, Set<number>>();
    if (resolvedConfig.participants && resolvedConfig.participants.length > 0) {
      for (const p of resolvedConfig.participants) {
        const phases = preloadByChar.get(p.charId) ?? new Set<number>();
        phases.add(p.startPhase);
        preloadByChar.set(p.charId, phases);
      }
    } else {
      preloadByChar.set(resolvedConfig.p1CharId, new Set([resolvedConfig.p1StartPhase]));
      const p2Phases = preloadByChar.get(resolvedConfig.p2CharId) ?? new Set<number>();
      p2Phases.add(resolvedConfig.p2StartPhase);
      preloadByChar.set(resolvedConfig.p2CharId, p2Phases);
    }
    const preloadRequests = [...preloadByChar.entries()].map(([charId, phases]) => ({
      charId,
      phases: [...phases],
    }));

    const previewMap = generateArenaMap(
      seed,
      resolvedConfig.roomMode === 'rumble',
      resolvedConfig.mapTheme
    );

    await Promise.all([
      spriteLoader.preloadMatchAssets(preloadRequests, (pct) => {
        menus.showLoading(pct);
      }),
      preloadArenaBackground(previewMap.themeId),
    ]);

    menus.hideAll();
    pwa.setInCombat(true);
    orientationGuard.setCombatActive(true);
    arena.startMatch(resolvedConfig);
    syncPauseState();
  };

  const startBeatEmUpFlow = async (config: BeatEmUpConfig) => {
    arena.stopMatch();
    activeSceneKind = 'beatemup';
    lastBeatEmUpConfig = config;
    manualPause = false;
    menus.setActiveMatchMode('solo');
    menus.showLoading(0);

    const stage = getBeatEmUpStage(config.stageId);
    const entityIds = Array.from(
      new Set([
        'npc_civil_brasil',
        'npc_civil_vermelho',
        'npc_politico',
        stage.bossId,
      ])
    );

    await Promise.all([
      spriteLoader.preloadBeatEmUpStage(
        config.charId,
        config.startPhase,
        entityIds,
        (pct) => menus.showLoading(pct)
      ),
      preloadBeatEmUpStageBackgrounds(stage.id),
    ]);

    menus.hideAll();
    pwa.setInCombat(true);
    orientationGuard.setCombatActive(true);
    beatEmUp.startStage(config);
    syncPauseState();
  };

  const menus = new Menus(manifest, save, pwa, audio, net, input, {
    onStartMatch: startMatchFlow,
    onStartBeatEmUp: startBeatEmUpFlow,
    onResumeMatch: () => {
      manualPause = false;
      input.resetAll();
      virtualControls.resetTouchState();
      syncPauseState();
    },
    onRestartMatch: () => {
      if (activeSceneKind === 'beatemup' && lastBeatEmUpConfig) {
        void startBeatEmUpFlow(lastBeatEmUpConfig);
      } else if (lastConfig) {
        void startMatchFlow(lastConfig);
      }
    },
    onQuitToSelect: () => {
      manualPause = false;
      const wasBeatEmUp = activeSceneKind === 'beatemup';
      const wasInRoom =
        !wasBeatEmUp &&
        (lastConfig?.mode === 'online' || lastConfig?.mode === 'room-bot');
      arena.stopMatch();
      beatEmUp.stopMatch();
      pwa.setInCombat(false);
      orientationGuard.setCombatActive(false);
      if (wasBeatEmUp) {
        menus.showBeatEmUpSelect();
      } else if (wasInRoom) {
        menus.showRooms();
      } else {
        menus.showSelect();
      }
      syncPauseState();
    },
    onReturnToLobby: () => {
      manualPause = false;
      arena.stopMatch();
      beatEmUp.stopMatch();
      pwa.setInCombat(false);
      orientationGuard.setCombatActive(false);
      net.returnRoomToLobby();
      menus.showLobby();
      syncPauseState();
    },
    onSettingsChanged: applySettings,
  }, spriteLoader);

  net.on('matchStart', (config) => {
    void startMatchFlow(config);
  });
  net.on('remoteSync', (payload) => {
    arena.applyRemoteSync(payload);
  });
  net.on('remoteEvent', (ev) => {
    arena.applyRemoteEvent(ev);
  });
  net.on('opponentLeft', () => {
    arena.handleOpponentLeft();
  });
  net.on('playerLeft', ({ slot, username }) => {
    arena.handlePlayerLeft(slot, username);
  });

  input.setOnGamepadChange(() => {
    menus.refreshGamepadStatus();
  });

  arena.setCallbacks(
    () => {
      if (!arena.isActive()) return;
      input.resetAll();
      virtualControls.resetTouchState();
      if (!arena.isOnlineMatch()) {
        manualPause = true;
        syncPauseState();
      }
      menus.openPause();
    },
    (report) => {
      pwa.setInCombat(false);
      orientationGuard.setCombatActive(false);
      const localParticipant = lastConfig?.participants?.find(
        (p) => p.slot === report.localSlot
      );
      const playedCharId =
        localParticipant?.charId ??
        (report.localSlot === 'p2'
          ? (lastConfig?.p2CharId ?? 'luffy')
          : (lastConfig?.p1CharId ?? 'goku'));
      const won = report.localWon ?? report.winner === report.localSlot;
      const xpSummary = save.recordMatchResult(
        playedCharId,
        won,
        report.xpEarned
      );
      void net.syncProgress();
      if (report.mode !== 'solo') {
        net.notifyMatchEnded();
      }
      menus.showMatchResult(report, xpSummary, playedCharId);
    }
  );

  beatEmUp.setCallbacks(
    () => {
      if (!beatEmUp.isActive()) return;
      input.resetAll();
      virtualControls.resetTouchState();
      manualPause = true;
      syncPauseState();
      menus.openPause();
    },
    (report) => {
      pwa.setInCombat(false);
      orientationGuard.setCombatActive(false);
      const xpSummary = save.recordMatchResult(
        report.charId,
        report.won,
        report.xpEarned
      );
      void net.syncProgress();
      menus.showBeatEmUpResult(report, xpSummary);
    }
  );

  // Tecla de pausa configurável (padrão Escape / P) para pausar/retomar no desktop
  window.addEventListener('keydown', (e) => {
    if (input.isCapturing()) return;
    if (input.matchesPauseKey(e.code) && isAnySceneActive()) {
      e.preventDefault();
      manualPause = !manualPause;
      input.resetAll();
      virtualControls.resetTouchState();
      syncPauseState();
      if (manualPause) {
        menus.openPause();
      } else {
        menus.closePause();
      }
    }
  });

  menus.showTitle();
  loop.start();
  void net.initSession();
}

void bootstrap();
