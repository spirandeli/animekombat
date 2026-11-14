import './styles/main.css';
import { AudioManager } from './engine/AudioManager';
import { GameLoop } from './engine/GameLoop';
import { InputManager } from './engine/InputManager';
import { SpriteLoader } from './engine/SpriteLoader';
import { ArenaScene, MatchConfig } from './game/ArenaScene';
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

  const pwa = new PwaManager();
  const audio = new AudioManager();
  const input = new InputManager();
  const virtualControls = new VirtualControls(input);

  // Desbloqueia Web Audio API no primeiro toque ou tecla
  input.setOnFirstGesture(() => audio.unlock());
  input.setOnInputModeChange((isTouch) => {
    virtualControls.syncInputMode(isTouch);
  });

  const applySettings = () => {
    const s = save.getData().settings;
    virtualControls.setAppearance(s.controlsOpacity, s.controlsScale, s.hapticFeedback);
    input.setStickDeadzone(s.stickDeadzone);
    input.setJumpViaStick(s.jumpViaStick);
    audio.setVolumes(s.bgmVolume, s.sfxVolume, s.bgmMuted, s.sfxMuted);
  };
  applySettings();

  const arena = new ArenaScene(canvas, spriteLoader, input, virtualControls, audio);
  arena.setNetworkClient(net);

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
      arena.update(dt);
    },
    (_alpha, fps) => {
      arena.render(fps);
    },
    (hidden) => {
      if (hidden && arena.isActive() && !arena.isOnlineMatch()) {
        manualPause = true;
        menus.openPause();
        syncPauseState();
      }
    }
  );

  let lastConfig: MatchConfig | null = null;

  const startMatchFlow = async (config: MatchConfig) => {
    lastConfig = config;
    manualPause = false;
    menus.setActiveMatchMode(config.mode ?? 'solo');
    menus.showLoading(0);

    // Pré-carrega somente a fase inicial de cada lutador participante
    const preloadByChar = new Map<string, Set<number>>();
    if (config.participants && config.participants.length > 0) {
      for (const p of config.participants) {
        const phases = preloadByChar.get(p.charId) ?? new Set<number>();
        phases.add(p.startPhase);
        preloadByChar.set(p.charId, phases);
      }
    } else {
      preloadByChar.set(config.p1CharId, new Set([config.p1StartPhase]));
      const p2Phases = preloadByChar.get(config.p2CharId) ?? new Set<number>();
      p2Phases.add(config.p2StartPhase);
      preloadByChar.set(config.p2CharId, p2Phases);
    }
    const preloadRequests = [...preloadByChar.entries()].map(([charId, phases]) => ({
      charId,
      phases: [...phases],
    }));

    await spriteLoader.preloadMatchAssets(preloadRequests, (pct) => {
      menus.showLoading(pct);
    });

    menus.hideAll();
    pwa.setInCombat(true);
    orientationGuard.setCombatActive(true);
    arena.startMatch(config);
    syncPauseState();
  };

  const menus = new Menus(manifest, save, pwa, audio, net, {
    onStartMatch: startMatchFlow,
    onResumeMatch: () => {
      manualPause = false;
      syncPauseState();
    },
    onRestartMatch: () => {
      if (lastConfig) {
        void startMatchFlow(lastConfig);
      }
    },
    onQuitToSelect: () => {
      manualPause = false;
      const wasInRoom =
        lastConfig?.mode === 'online' || lastConfig?.mode === 'room-bot';
      arena.stopMatch();
      pwa.setInCombat(false);
      orientationGuard.setCombatActive(false);
      if (wasInRoom) {
        menus.showRooms();
      } else {
        menus.showSelect();
      }
      syncPauseState();
    },
    onReturnToLobby: () => {
      manualPause = false;
      arena.stopMatch();
      pwa.setInCombat(false);
      orientationGuard.setCombatActive(false);
      net.returnRoomToLobby();
      menus.showLobby();
      syncPauseState();
    },
    onSettingsChanged: applySettings,
  });

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

  arena.setCallbacks(
    () => {
      if (!arena.isActive()) return;
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

  // Tecla Escape para pausar/retomar no desktop
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && arena.isActive()) {
      manualPause = !manualPause;
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
