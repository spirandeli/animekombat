import { AudioManager } from '../engine/AudioManager';
import {
  BINDABLE_ACTION_LABELS,
  InputManager,
  formatGamepadButton,
  formatKeyCode,
} from '../engine/InputManager';
import { CharactersManifest } from '../engine/SpriteLoader';
import { AIDifficulty } from '../game/AIController';
import { ARENA_THEMES, getArenaThemeInfo } from '../game/ArenaMap';
import { MatchConfig, MatchEndReport } from '../game/ArenaScene';
import {
  FighterSlotId,
  NetworkClient,
  RoomInvitePayload,
  RoomMode,
  RoomSlotState,
  RoomState,
  SlotMode,
  teamForSlot,
} from '../net/NetworkClient';
import { PwaManager } from '../pwa/PwaManager';
import {
  BindableAction,
  CombatPace,
  GamepadBindings,
  KeyBindings,
  SaveManager,
  createDefaultGamepadBindings,
  createDefaultKeyBindings,
  xpRequiredForLevel,
} from '../storage/SaveManager';

type ScreenName = 'title' | 'select' | 'rooms' | 'lobby' | 'loading' | 'none';

export interface MenusCallbacks {
  onStartMatch: (config: MatchConfig) => Promise<void>;
  onResumeMatch: () => void;
  onRestartMatch: () => void;
  onQuitToSelect: () => void;
  onReturnToLobby: () => void;
  onSettingsChanged: () => void;
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function presenceLabel(status: string, roomCode: string | null): string {
  if (status === 'fighting') return 'Em Batalha';
  if (status === 'in_room') return roomCode ? `Na Sala #${roomCode}` : 'Em Sala';
  if (status === 'online') return 'Online';
  return 'Offline';
}

export class Menus {
  private readonly uiLayer: HTMLElement;
  private readonly manifest: CharactersManifest;
  private readonly save: SaveManager;
  private readonly pwa: PwaManager;
  private readonly audio: AudioManager;
  private readonly net: NetworkClient;
  private readonly input: InputManager;
  private readonly callbacks: MenusCallbacks;

  private currentScreen: ScreenName = 'title';
  private activeMatchMode: 'solo' | 'room-bot' | 'online' = 'solo';
  private showSettingsModal = false;
  private showHelpModal = false;
  private showPauseModal = false;
  private showAuthModal = false;
  private showFriendsModal = false;
  private helpTab: 'keyboard' | 'gamepad' | 'touch' | 'combat' = 'keyboard';
  private capturingAction: {
    device: 'keyboard' | 'gamepad';
    action: BindableAction;
  } | null = null;

  private lastResult: {
    report: MatchEndReport;
    xpSummary: ReturnType<SaveManager['recordMatchResult']>;
    charName: string;
  } | null = null;

  private selectedP1 = 'goku';
  private selectedP2 = 'luffy';
  private selectedStartPhase = 1;
  private selectingSlot: 'p1' | 'p2' = 'p1';
  private lobbyEditingSlot: FighterSlotId = 'p1';
  private loadingPercent = 0;

  private createRoomMode: RoomMode = 'rumble';
  private createTeamSize: 2 | 3 = 3;
  private createRoomPublic = true;
  private createMapTheme = 'random';
  private selectedMapTheme = 'random';

  // Estado de formulários e feedback (preservado entre re-renders)
  private authTab: 'login' | 'register' = 'login';
  private authIdentifier = '';
  private authUsername = '';
  private authEmail = '';
  private authPassword = '';
  private authErrorMsg: string | null = null;
  private authBusy = false;

  private friendQuery = '';
  private friendFeedback: { kind: 'ok' | 'err'; text: string } | null = null;

  private roomJoinCode = '';
  private roomErrorMsg: string | null = null;
  private pendingAutoInviteUserId: string | null = null;

  private pendingInvites: RoomInvitePayload[] = [];
  private toastMsg: string | null = null;
  private toastTimer: number | null = null;

  constructor(
    manifest: CharactersManifest,
    save: SaveManager,
    pwa: PwaManager,
    audio: AudioManager,
    net: NetworkClient,
    input: InputManager,
    callbacks: MenusCallbacks
  ) {
    const el = document.getElementById('ui-layer');
    if (!el) throw new Error('Elemento #ui-layer não encontrado.');
    this.uiLayer = el;
    this.manifest = manifest;
    this.save = save;
    this.pwa = pwa;
    this.audio = audio;
    this.net = net;
    this.input = input;
    this.callbacks = callbacks;

    const ids = Object.keys(manifest.characters);
    if (ids.length > 0) {
      this.selectedP1 = ids.includes('goku') ? 'goku' : ids[0];
      this.selectedP2 = ids.includes('luffy')
        ? 'luffy'
        : ids[Math.min(1, ids.length - 1)];
    }

    this.pwa.setOnInstallChange(() => {
      if (this.currentScreen === 'title') this.render();
    });

    this.bindNetworkEvents();
  }

  private bindNetworkEvents(): void {
    this.net.on('authChanged', () => {
      if (this.currentScreen !== 'none' && !this.isTypingInInput()) {
        this.render();
      }
    });

    this.net.on('wsStatusChanged', () => {
      if (this.currentScreen !== 'none' && !this.isTypingInInput()) {
        this.render();
      }
    });

    this.net.on('friendsUpdated', () => {
      if (this.currentScreen !== 'none' && !this.isTypingInInput()) {
        this.render();
      }
    });

    this.net.on('roomsListUpdated', () => {
      if (this.currentScreen === 'rooms' && !this.isTypingInInput()) {
        this.render();
      }
    });

    this.net.on('roomUpdated', (room) => {
      if (room && this.pendingAutoInviteUserId) {
        const targetId = this.pendingAutoInviteUserId;
        this.pendingAutoInviteUserId = null;
        this.showFriendsModal = false;
        this.net.inviteFriendToRoom(targetId);
      }

      if (room && this.currentScreen !== 'loading' && this.currentScreen !== 'none') {
        this.currentScreen = 'lobby';
        this.roomErrorMsg = null;
        const actorId = this.net.getActorId();
        const isHost = room.hostId === actorId;
        const slots = this.getNormalizedSlots(room);
        const mySlot = this.findActorSlot(room, slots) ?? 'p1';
        const editingTarget = slots[this.lobbyEditingSlot];
        if (
          !isHost ||
          !editingTarget ||
          (!editingTarget.isBot && editingTarget.userId !== actorId)
        ) {
          this.lobbyEditingSlot = mySlot;
        }
        this.render();
      } else if (!room && this.currentScreen === 'lobby') {
        this.currentScreen = 'rooms';
        this.render();
      }
    });

    this.net.on('roomLeft', ({ reason }) => {
      if (reason) {
        this.showToast(reason);
      }
      if (this.currentScreen === 'lobby') {
        this.currentScreen = 'rooms';
        this.net.requestRoomList();
        this.render();
      }
    });

    this.net.on('roomError', (msg) => {
      this.roomErrorMsg = msg;
      this.showToast(msg);
      if (this.currentScreen !== 'none') {
        this.render();
      }
    });

    this.net.on('inviteReceived', (invite) => {
      this.pendingInvites = [
        invite,
        ...this.pendingInvites.filter((i) => i.roomCode !== invite.roomCode),
      ].slice(0, 3);
      if (this.currentScreen !== 'none') {
        this.render();
      }
    });

    this.net.on('inviteSent', ({ roomCode }) => {
      this.showToast(`Convite enviado para a Sala #${roomCode}!`);
    });
  }

  private isTypingInInput(): boolean {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea';
  }

  public showToast(message: string): void {
    this.toastMsg = message;
    if (this.toastTimer !== null) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = window.setTimeout(() => {
      this.toastMsg = null;
      this.toastTimer = null;
      if (this.currentScreen !== 'none') {
        this.render();
      }
    }, 3600);
    if (this.currentScreen !== 'none' && !this.isTypingInInput()) {
      this.render();
    }
  }

  public setActiveMatchMode(mode: 'solo' | 'room-bot' | 'online'): void {
    this.activeMatchMode = mode;
  }

  public showTitle(): void {
    this.currentScreen = 'title';
    this.showPauseModal = false;
    this.lastResult = null;
    this.roomErrorMsg = null;
    this.render();
  }

  public showSelect(): void {
    this.currentScreen = 'select';
    this.showPauseModal = false;
    this.lastResult = null;
    this.render();
  }

  public showRooms(): void {
    this.currentScreen = 'rooms';
    this.showPauseModal = false;
    this.lastResult = null;
    this.roomErrorMsg = null;
    this.net.requestRoomList();
    this.render();
  }

  public showLobby(): void {
    const room = this.net.getCurrentRoom();
    if (!room) {
      this.showRooms();
      return;
    }
    this.currentScreen = 'lobby';
    this.showPauseModal = false;
    this.lastResult = null;
    this.roomErrorMsg = null;
    this.render();
  }

  public showLoading(percent: number): void {
    this.currentScreen = 'loading';
    this.loadingPercent = percent;
    this.render();
  }

  public hideAll(): void {
    this.cancelCapture();
    this.currentScreen = 'none';
    this.showPauseModal = false;
    this.showSettingsModal = false;
    this.showHelpModal = false;
    this.showAuthModal = false;
    this.showFriendsModal = false;
    this.lastResult = null;
    this.render();
  }

  public openPause(): void {
    this.showPauseModal = true;
    this.render();
  }

  public closePause(): void {
    this.cancelCapture();
    this.showPauseModal = false;
    this.showHelpModal = false;
    this.showSettingsModal = false;
    this.render();
  }

  public openHelp(tab?: 'keyboard' | 'gamepad' | 'touch' | 'combat'): void {
    this.cancelCapture();
    if (tab) this.helpTab = tab;
    this.showHelpModal = true;
    this.render();
  }

  public isModalOpen(): boolean {
    return (
      this.showPauseModal ||
      this.showSettingsModal ||
      this.showHelpModal ||
      this.showAuthModal ||
      this.showFriendsModal ||
      this.lastResult !== null
    );
  }

  public refreshGamepadStatus(): void {
    if (
      (this.showHelpModal || this.showSettingsModal || this.currentScreen === 'title') &&
      !this.isTypingInInput()
    ) {
      this.render();
    }
  }

  private cancelCapture(): void {
    this.capturingAction = null;
    this.input.cancelCapture();
  }

  public showMatchResult(
    report: MatchEndReport,
    xpSummary: ReturnType<SaveManager['recordMatchResult']>,
    playedCharId?: string
  ): void {
    const cid =
      playedCharId ??
      (report.localSlot === 'p2' ? this.selectedP2 : this.selectedP1);
    const charName = this.manifest.characters[cid]?.name ?? cid;
    this.lastResult = { report, xpSummary, charName };
    this.render();
  }

  public getCurrentMatchConfig(): MatchConfig {
    const prog = this.save.getCharacterProgress(this.selectedP1);
    const maxAllowedPhase = Math.min(4, Math.max(1, prog.unlockedPhase));
    const startPhase = Math.min(this.selectedStartPhase, maxAllowedPhase);
    const settings = this.save.getData().settings;
    const difficulty = settings.difficulty;

    const p2StartPhase =
      difficulty === 'master' ? Math.min(4, startPhase + 1) : startPhase;

    return {
      p1CharId: this.selectedP1,
      p2CharId: this.selectedP2,
      p1StartPhase: startPhase,
      p2StartPhase,
      p1Level: prog.level,
      difficulty,
      combatPace: settings.combatPace,
      mode: 'solo',
      localSlot: 'p1',
      mapTheme: this.selectedMapTheme,
      mapSeed: (Math.floor(Math.random() * 0x7fffffff) >>> 0) || 1337,
    };
  }

  private renderThemePillsHtml(dataAttr: string, selectedTheme?: string): string {
    const current = selectedTheme || 'random';
    return `
      <div class="ak-seg-group ak-theme-pills">
        <button type="button" class="ak-seg-btn ak-seg-sm ${current === 'random' ? 'active' : ''}" ${dataAttr}="random">
          🎲 Aleatório
        </button>
        ${ARENA_THEMES.map(
          (t) => `
          <button type="button" class="ak-seg-btn ak-seg-sm ${current === t.id ? 'active' : ''}" ${dataAttr}="${t.id}">
            ${escapeHtml(t.name)}
          </button>`
        ).join('')}
      </div>
    `;
  }

  private render(): void {
    const hasActiveOverlay =
      this.currentScreen !== 'none' ||
      this.showPauseModal ||
      this.showSettingsModal ||
      this.showHelpModal ||
      this.showAuthModal ||
      this.showFriendsModal ||
      this.lastResult !== null;

    this.uiLayer.classList.toggle('hidden', !hasActiveOverlay);
    if (!hasActiveOverlay) {
      this.uiLayer.innerHTML = '';
      return;
    }

    let html = '';

    if (this.currentScreen === 'title') {
      html += this.renderTitleScreen();
    } else if (this.currentScreen === 'select') {
      html += this.renderSelectScreen();
    } else if (this.currentScreen === 'rooms') {
      html += this.renderRoomsScreen();
    } else if (this.currentScreen === 'lobby') {
      html += this.renderLobbyScreen();
    } else if (this.currentScreen === 'loading') {
      html += this.renderLoadingScreen();
    }

    if (this.showPauseModal) {
      html += this.renderPauseModal();
    }

    if (this.lastResult) {
      html += this.renderResultModal();
    }

    if (this.showFriendsModal) {
      html += this.renderFriendsModal();
    }

    if (this.showAuthModal) {
      html += this.renderAuthModal();
    }

    if (this.showSettingsModal) {
      html += this.renderSettingsModal();
    }

    if (this.showHelpModal) {
      html += this.renderHelpModal();
    }

    if (this.pendingInvites.length > 0 && this.currentScreen !== 'none') {
      html += this.renderInvitesOverlay();
    }

    if (this.toastMsg && this.currentScreen !== 'none') {
      html += `<div class="ak-menu-toast">${escapeHtml(this.toastMsg)}</div>`;
    }

    this.uiLayer.innerHTML = html;
    this.bindEvents();
  }

  private renderProfileBar(): string {
    const user = this.net.getUser();
    const online = this.net.isOnline();
    const pendingCount = this.net.getFriendsOverview().incomingRequests.length;

    if (user) {
      const initial = escapeHtml(user.username.charAt(0).toUpperCase() || 'A');
      return `
        <div class="ak-profile-bar">
          <div class="ak-profile-info">
            <div class="ak-avatar-circle">${initial}</div>
            <div>
              <div class="ak-profile-name">
                ${escapeHtml(user.username)}
                <span class="ak-status-dot ${online ? 'online' : 'offline'}" title="${online ? 'Conectado' : 'Offline'}"></span>
              </div>
              <div class="ak-profile-tag-row">
                <span class="ak-tag-pill">${escapeHtml(user.friendCode)}</span>
                <button id="btn-copy-tag-top" class="ak-link-btn" type="button">Copiar Tag</button>
              </div>
            </div>
          </div>
          <div class="ak-profile-actions">
            <button id="btn-open-friends" class="ak-btn ak-btn-ghost ak-btn-sm" type="button">
              Amigos ${pendingCount > 0 ? `<span class="ak-count-badge">${pendingCount}</span>` : ''}
            </button>
            <button id="btn-logout" class="ak-btn ak-btn-ghost ak-btn-sm" type="button">
              Sair
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div class="ak-profile-bar">
        <div class="ak-profile-info">
          <div class="ak-avatar-circle guest">?</div>
          <div>
            <div class="ak-profile-name">
              Modo Convidado
              <span class="ak-status-dot ${online ? 'online' : 'offline'}"></span>
            </div>
            <div class="ak-profile-sub">Save local offline ativo · Entre para salvar na nuvem e jogar com amigos</div>
          </div>
        </div>
        <div class="ak-profile-actions">
          <button id="btn-open-auth" class="ak-btn ak-btn-cyan ak-btn-sm" type="button">
            Entrar / Criar Conta
          </button>
        </div>
      </div>
    `;
  }

  private renderTitleScreen(): string {
    const showInstallBtn = this.pwa.canInstallNative();
    const showIosHint = this.pwa.isIosSafariNeedsHint();
    const onlineBadge = navigator.onLine
      ? this.net.isOnline()
        ? 'Servidor Online · PWA Pronto Offline'
        : 'PWA Instalável · Pronto Offline'
      : 'Modo Offline Ativo';
    const pendingCount = this.net.getFriendsOverview().incomingRequests.length;
    const s = this.save.getData().settings;
    const kb = s.keyBindings;
    const gp = this.input.getConnectedGamepad();
    const kLbl = (act: BindableAction) => escapeHtml(formatKeyCode(kb[act]?.[0]));

    return `
      <div class="ak-screen">
        ${this.renderProfileBar()}
        <div class="ak-panel ak-title-hero">
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:center;">
            <span class="ak-badge">${onlineBadge}</span>
            ${
              gp.connected
                ? `<span class="ak-gamepad-pill connected">🎮 Controle: ${escapeHtml(gp.name.slice(0, 28))}</span>`
                : ''
            }
          </div>
          <h1 class="ak-logo">AnimeKombat</h1>
          <p class="ak-subtitle">
            Luta 2D estilo anime com sistema de evolução em 4 fases. Jogue offline contra a CPU ou desafie amigos em salas online!
          </p>
          <div class="ak-title-actions">
            <button id="btn-go-select" class="ak-btn ak-btn-primary" type="button">
              Luta Rápida (CPU)
            </button>
            <button id="btn-go-rooms" class="ak-btn ak-btn-cyan" type="button">
              Salas (Amigo ou Bot)
            </button>
            <button id="btn-open-friends" class="ak-btn ak-btn-ghost" type="button">
              Amigos & Desafios ${pendingCount > 0 ? `<span class="ak-count-badge">${pendingCount}</span>` : ''}
            </button>
            <button id="btn-open-help" class="ak-btn ak-btn-ghost" type="button">
              Ajuda & Controles
            </button>
            <button id="btn-open-settings" class="ak-btn ak-btn-ghost" type="button">
              Configurações
            </button>
            ${
              showInstallBtn
                ? `<button id="btn-pwa-install" class="ak-btn ak-btn-accent" type="button">
                    Instalar AnimeKombat
                  </button>`
                : ''
            }
          </div>
          ${
            showIosHint
              ? `<div class="ak-ios-hint">
                  <strong>Instalar no iPhone/iPad:</strong> toque em <strong>Compartilhar</strong> na barra do Safari e selecione <strong>Adicionar à Tela de Início</strong> para tela cheia e uso offline.
                </div>`
              : ''
          }
          <p class="ak-subtitle" style="font-size:0.76rem; margin-top:4px;">
            Teclado: ${kLbl('left')}/${kLbl('right')}/${kLbl('up')}/${kLbl('down')} + ${kLbl('a1')} (A1), ${kLbl('a2')} (A2), ${kLbl('a3')} (A3), ${kLbl('a4')} (ULT), ${kLbl('block')} (Defesa), ${kLbl('jump')} (Pulo), ${kLbl('evolve')} (Evoluir) · Controle USB/BT compatível
          </p>
        </div>
      </div>
    `;
  }

  private renderSelectScreen(): string {
    const chars = Object.values(this.manifest.characters);
    const p1Char = this.manifest.characters[this.selectedP1];
    const p1Prog = this.save.getCharacterProgress(this.selectedP1);
    const maxUnlocked = Math.min(4, Math.max(1, p1Prog.unlockedPhase));
    if (this.selectedStartPhase > maxUnlocked) {
      this.selectedStartPhase = 1;
    }

    const activePhaseData = p1Char?.phases[`fase_${this.selectedStartPhase}`];
    const moves = activePhaseData?.moves ?? {};
    const diff = this.save.getData().settings.difficulty;

    const cardsHtml = chars
      .map((c) => {
        const prog = this.save.getCharacterProgress(c.id);
        const needXp = xpRequiredForLevel(prog.level);
        const xpPct = Math.min(100, Math.round((prog.xp / needXp) * 100));
        const thumbSrc = c.phases.fase_1?.actions.idle[0]?.src ?? '';
        const isP1 = this.selectedP1 === c.id;
        const isP2 = this.selectedP2 === c.id;
        const cls =
          isP1 && isP2
            ? 'selected-both'
            : isP1
              ? 'selected-p1'
              : isP2
                ? 'selected-cpu'
                : '';

        const tagText =
          isP1 && isP2 ? 'P1 + CPU' : isP1 ? 'VOCÊ (P1)' : isP2 ? 'CPU' : '';

        const pills = [1, 2, 3, 4]
          .map((ph) => {
            const unlocked = ph <= prog.unlockedPhase;
            return `<span class="ak-phase-pill ${unlocked ? 'unlocked' : ''}">F${ph}</span>`;
          })
          .join('');

        return `
          <button type="button" class="ak-char-card ${cls}" data-pick-char="${c.id}">
            <div class="ak-char-top">
              <img class="ak-char-thumb" src="${thumbSrc}" alt="${escapeHtml(c.name)}" loading="lazy" />
              <div class="ak-char-meta">
                <h3>${escapeHtml(c.name)}</h3>
                <div class="ak-char-level">Nível ${prog.level} · ${prog.wins}V / ${prog.matches}L</div>
                ${
                  tagText
                    ? `<div style="font-size:0.72rem;font-weight:900;color:var(--ak-cyan);margin-top:2px;">${tagText}</div>`
                    : ''
                }
              </div>
            </div>
            <div class="ak-xp-bar"><div class="ak-xp-fill" style="width:${xpPct}%"></div></div>
            <div class="ak-phase-pills">${pills}</div>
          </button>
        `;
      })
      .join('');

    const phaseButtons = [1, 2, 3, 4]
      .map((ph) => {
        const unlocked = ph <= maxUnlocked;
        const label = p1Char?.phases[`fase_${ph}`]?.label ?? `Fase ${ph}`;
        return `
          <button
            type="button"
            class="ak-seg-btn ${this.selectedStartPhase === ph ? 'active' : ''}"
            data-pick-phase="${ph}"
            ${unlocked ? '' : 'disabled style="opacity:0.4;cursor:not-allowed;"'}
          >
            F${ph}: ${escapeHtml(label)} ${unlocked ? '' : '🔒'}
          </button>
        `;
      })
      .join('');

    const diffButtons: Array<{ id: AIDifficulty; label: string }> = [
      { id: 'easy', label: 'Fácil' },
      { id: 'medium', label: 'Médio' },
      { id: 'master', label: 'Mestre' },
    ];

    return `
      <div class="ak-screen">
        <div class="ak-panel">
          <div class="ak-select-header">
            <button id="btn-back-title" class="ak-btn ak-btn-ghost ak-btn-sm" type="button">
              Voltar
            </button>
            <h2>Seleção de Lutador (Solo)</h2>
            <button id="btn-open-settings" class="ak-btn ak-btn-ghost ak-btn-sm" type="button">
              Ajustes
            </button>
          </div>

          <div class="ak-seg-group" style="margin:10px 0;">
            <button type="button" class="ak-seg-btn ${this.selectingSlot === 'p1' ? 'active' : ''}" data-slot="p1">
              Escolher Seu Lutador (P1)
            </button>
            <button type="button" class="ak-seg-btn ${this.selectingSlot === 'p2' ? 'active' : ''}" data-slot="p2">
              Escolher Oponente (CPU)
            </button>
          </div>

          <div class="ak-roster-grid">${cardsHtml}</div>
        </div>

        <div class="ak-panel">
          <div class="ak-select-controls">
            <div class="ak-field">
              <label>Fase Inicial (${escapeHtml(p1Char?.name ?? '')})</label>
              <div class="ak-seg-group">${phaseButtons}</div>
            </div>
            <div class="ak-field">
              <label>Dificuldade da CPU</label>
              <div class="ak-seg-group">
                ${diffButtons
                  .map(
                    (d) => `
                  <button type="button" class="ak-seg-btn ${diff === d.id ? 'active' : ''}" data-diff="${d.id}">
                    ${d.label}
                  </button>`
                  )
                  .join('')}
              </div>
            </div>
          </div>

          <div class="ak-field" style="margin-top:10px;">
            <label>Cenário / Plano de Fundo</label>
            ${this.renderThemePillsHtml('data-pick-theme', this.selectedMapTheme)}
          </div>

          <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:space-between;">
            <div style="font-size:0.78rem;color:var(--ak-muted);">
              <strong>Golpes F${this.selectedStartPhase}:</strong>
              A1 ${escapeHtml(moves.ataque_1 ?? '-')} · A2 ${escapeHtml(moves.ataque_2 ?? '-')} · A3 ${escapeHtml(moves.ataque_3 ?? '-')} · ULT ${escapeHtml(moves.ataque_4 ?? '-')}
            </div>
            <button id="btn-start-fight" class="ak-btn ak-btn-primary" type="button" style="min-width:190px;">
              Iniciar Luta!
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private getNormalizedSlots(room: RoomState): Record<FighterSlotId, RoomSlotState> {
    if (room.slots) return room.slots;
    const makeEmpty = (slot: FighterSlotId): RoomSlotState => ({
      slot,
      team: teamForSlot(slot),
      slotMode: 'human',
      userId: null,
      username: 'Vaga Aberta...',
      friendCode: null,
      isGuest: false,
      isBot: false,
      charId: 'luffy',
      startPhase: 1,
      level: 1,
      ready: false,
    });
    return {
      p1: { ...room.p1, slot: 'p1', team: 1, slotMode: 'human' },
      p2: {
        ...room.p2,
        slot: 'p2',
        team: 2,
        slotMode: room.p2Mode === 'bot' ? 'bot' : 'human',
      },
      p3: makeEmpty('p3'),
      p4: makeEmpty('p4'),
      p5: makeEmpty('p5'),
      p6: makeEmpty('p6'),
    };
  }

  private getActiveSlots(room: RoomState): FighterSlotId[] {
    const all: FighterSlotId[] = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
    const size =
      room.roomMode === 'rumble'
        ? Math.max(2, Math.min(3, room.teamSize ?? 3))
        : 1;
    return all.slice(0, size * 2);
  }

  private findActorSlot(
    room: RoomState,
    slots: Record<FighterSlotId, RoomSlotState>
  ): FighterSlotId | null {
    const actorId = this.net.getActorId();
    for (const sid of this.getActiveSlots(room)) {
      const s = slots[sid];
      if (s && s.slotMode !== 'closed' && !s.isBot && s.userId === actorId) {
        return sid;
      }
    }
    return room.p1.userId === actorId ? 'p1' : room.p2.userId === actorId ? 'p2' : null;
  }

  private renderRoomsScreen(): string {
    const openRooms = this.net.getOpenRooms();
    const isOnline = this.net.isOnline();
    const pendingCount = this.net.getFriendsOverview().incomingRequests.length;
    const modeLabel =
      this.createRoomMode === 'rumble'
        ? `Rumble ${this.createTeamSize}v${this.createTeamSize}`
        : '1v1';

    const roomsListHtml =
      openRooms.length === 0
        ? `<div class="ak-empty-box">Nenhuma sala aberta no momento. Crie uma sala acima e convide amigos ou lute contra Bots!</div>`
        : openRooms
            .map((r) => {
              const charName = this.manifest.characters[r.p1CharId]?.name ?? r.p1CharId;
              const isRumble = r.roomMode === 'rumble';
              const maxP = r.maxPlayers ?? (isRumble ? (r.teamSize ?? 3) * 2 : 2);
              const occ = r.occupiedCount ?? (r.hasFreeSlot ? 1 : maxP);
              const themeLabel =
                r.mapTheme && r.mapTheme !== 'random'
                  ? ` · ${getArenaThemeInfo(r.mapTheme).name}`
                  : '';
              return `
                <div class="ak-list-row">
                  <div>
                    <div style="font-weight:800;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                      <span>#${escapeHtml(r.code)}</span>
                      <span>${escapeHtml(r.hostName)}</span>
                      <span class="ak-mini-badge ${isRumble ? 'amber' : 'cyan'}">
                        ${isRumble ? `RUMBLE ${r.teamSize ?? 3}v${r.teamSize ?? 3}` : '1v1'}
                      </span>
                      <span class="ak-mini-badge ${r.isPublic ? 'green' : ''}">
                        ${r.isPublic ? 'PÚBLICA' : 'PRIVADA'}
                      </span>
                      ${r.isFriend ? '<span class="ak-mini-badge cyan">Amigo</span>' : ''}
                    </div>
                    <div class="ak-profile-sub">
                      ${escapeHtml(charName)} (F${r.p1Phase}) · ${occ}/${maxP} lutadores${escapeHtml(themeLabel)} · ${r.hasFreeSlot ? `${r.openHumanSlots ?? 1} vaga(s) aberta(s)` : 'Completa'}
                    </div>
                  </div>
                  <button
                    type="button"
                    class="ak-btn ak-btn-cyan ak-btn-sm"
                    data-join-room="${escapeHtml(r.code)}"
                    ${r.hasFreeSlot ? '' : 'disabled style="opacity:0.45;"'}
                  >
                    Entrar
                  </button>
                </div>
              `;
            })
            .join('');

    return `
      <div class="ak-screen">
        ${this.renderProfileBar()}
        <div class="ak-panel">
          <div class="ak-select-header">
            <button id="btn-back-title" class="ak-btn ak-btn-ghost ak-btn-sm" type="button">
              Voltar
            </button>
            <h2>Salas de Batalha</h2>
            <button id="btn-open-friends" class="ak-btn ak-btn-ghost ak-btn-sm" type="button">
              Amigos ${pendingCount > 0 ? `<span class="ak-count-badge">${pendingCount}</span>` : ''}
            </button>
          </div>

          ${
            !isOnline
              ? `<div class="ak-alert-warn" style="margin-top:10px;">
                  Sem conexão com o servidor multiplayer. Você ainda pode criar uma <strong>Sala vs Bot / Rumble offline</strong>!
                </div>`
              : ''
          }

          ${
            this.roomErrorMsg
              ? `<div class="ak-alert-err" style="margin-top:10px;">${escapeHtml(this.roomErrorMsg)}</div>`
              : ''
          }

          <div class="ak-room-create-options">
            <div class="ak-field">
              <label>Modo da Nova Sala</label>
              <div class="ak-seg-group">
                <button type="button" class="ak-seg-btn ak-seg-sm ${this.createRoomMode === '1v1' ? 'active' : ''}" data-create-preset="1v1">
                  ⚔️ 1v1 Clássico
                </button>
                <button type="button" class="ak-seg-btn ak-seg-sm ${this.createRoomMode === 'rumble' && this.createTeamSize === 2 ? 'active' : ''}" data-create-preset="rumble-2">
                  🔥 Rumble 2v2
                </button>
                <button type="button" class="ak-seg-btn ak-seg-sm ${this.createRoomMode === 'rumble' && this.createTeamSize === 3 ? 'active' : ''}" data-create-preset="rumble-3">
                  💥 Rumble 3v3
                </button>
              </div>
            </div>

            <div class="ak-field">
              <label>Visibilidade da Sala</label>
              <div class="ak-seg-group">
                <button type="button" class="ak-seg-btn ak-seg-sm ${this.createRoomPublic ? 'active' : ''}" data-create-visibility="public">
                  🌐 Pública (Listada)
                </button>
                <button type="button" class="ak-seg-btn ak-seg-sm ${!this.createRoomPublic ? 'active' : ''}" data-create-visibility="private">
                  🔒 Privada (Amigos/Código)
                </button>
              </div>
            </div>

            <div class="ak-field">
              <label>Cenário / Plano de Fundo da Arena</label>
              ${this.renderThemePillsHtml('data-create-theme', this.createMapTheme)}
            </div>
          </div>

          <div class="ak-rooms-actions">
            <button id="btn-create-room-human" class="ak-btn ak-btn-primary" type="button">
              Criar ${modeLabel} (Vagas Abertas)
            </button>
            <button id="btn-create-room-bot" class="ak-btn ak-btn-cyan" type="button">
              Criar ${modeLabel} c/ Bots
            </button>
          </div>

          <div class="ak-join-code-row">
            <input
              id="input-room-code"
              class="ak-input"
              type="text"
              maxlength="6"
              placeholder="CÓDIGO DA SALA (EX: AK7X92)"
              value="${escapeHtml(this.roomJoinCode)}"
            />
            <button id="btn-join-room-code" class="ak-btn ak-btn-accent" type="button">
              Entrar
            </button>
          </div>
        </div>

        <div class="ak-panel">
          <div class="ak-select-header" style="margin-bottom:10px;">
            <h2 style="font-size:0.95rem;">Salas Disponíveis (${openRooms.length})</h2>
            <button id="btn-refresh-rooms" class="ak-btn ak-btn-ghost ak-btn-sm" type="button">
              Atualizar
            </button>
          </div>
          <div class="ak-list-stack">${roomsListHtml}</div>
        </div>
      </div>
    `;
  }

  private renderLobbyScreen(): string {
    const room = this.net.getCurrentRoom();
    if (!room) return this.renderRoomsScreen();

    const actorId = this.net.getActorId();
    const isHost = room.hostId === actorId;
    const slots = this.getNormalizedSlots(room);
    const activeIds = this.getActiveSlots(room);
    const mySlotKey = this.findActorSlot(room, slots);
    const mySlot = mySlotKey ? slots[mySlotKey] : null;
    const isRumble = room.roomMode === 'rumble';

    const editingTarget = slots[this.lobbyEditingSlot];
    const editingSlotKey: FighterSlotId =
      editingTarget &&
      ((isHost && editingTarget.isBot) || editingTarget.userId === actorId)
        ? this.lobbyEditingSlot
        : mySlotKey ?? 'p1';
    const editingSlot = slots[editingSlotKey];
    const editingBot = Boolean(isHost && editingSlot.isBot);

    const chars = Object.values(this.manifest.characters);
    const activeChar = this.manifest.characters[editingSlot.charId];
    const localProg = this.save.getCharacterProgress(editingSlot.charId);
    const maxUnlocked = editingBot
      ? 4
      : Math.min(4, Math.max(1, localProg.unlockedPhase));

    const cardsHtml = chars
      .map((c) => {
        const prog = this.save.getCharacterProgress(c.id);
        const thumbSrc = c.phases.fase_1?.actions.idle[0]?.src ?? '';
        const selected = editingSlot.charId === c.id;
        return `
          <button
            type="button"
            class="ak-char-card ${selected ? (editingSlotKey === mySlotKey ? 'selected-p1' : 'selected-cpu') : ''}"
            data-lobby-char="${c.id}"
          >
            <div class="ak-char-top">
              <img class="ak-char-thumb" src="${thumbSrc}" alt="${escapeHtml(c.name)}" />
              <div class="ak-char-meta">
                <h3>${escapeHtml(c.name)}</h3>
                <div class="ak-char-level">${editingBot ? 'Bot CPU' : `Nível ${prog.level}`}</div>
                ${selected ? `<div style="font-size:0.72rem;font-weight:900;color:var(--ak-cyan);">SELECIONADO</div>` : ''}
              </div>
            </div>
          </button>
        `;
      })
      .join('');

    const phaseButtons = [1, 2, 3, 4]
      .map((ph) => {
        const unlocked = ph <= maxUnlocked;
        const label = activeChar?.phases[`fase_${ph}`]?.label ?? `Fase ${ph}`;
        return `
          <button
            type="button"
            class="ak-seg-btn ${editingSlot.startPhase === ph ? 'active' : ''}"
            data-lobby-phase="${ph}"
            ${unlocked ? '' : 'disabled style="opacity:0.4;cursor:not-allowed;"'}
          >
            F${ph}: ${escapeHtml(label)} ${unlocked ? '' : '🔒'}
          </button>
        `;
      })
      .join('');

    const diffButtons: Array<{ id: AIDifficulty; label: string }> = [
      { id: 'easy', label: 'Fácil' },
      { id: 'medium', label: 'Médio' },
      { id: 'master', label: 'Mestre' },
    ];

    const hasAnyBot = activeIds.some((sid) => slots[sid].slotMode === 'bot');
    const themeName =
      !room.mapTheme || room.mapTheme === 'random'
        ? 'Aleatório (por Seed)'
        : getArenaThemeInfo(room.mapTheme).name;

    const roomMapToolbarHtml = `
      <div class="ak-rumble-toolbar">
        <div class="ak-rumble-map-meta">
          <span class="ak-mini-badge amber">CENÁRIO: ${escapeHtml(themeName)}</span>
          <span class="ak-profile-sub">Seed #${room.mapSeed ?? 1337}</span>
        </div>
        <div class="ak-rumble-toolbar-btns">
          ${
            isRumble && mySlotKey
              ? `<button id="btn-switch-team" class="ak-btn ak-btn-ghost ak-btn-sm" type="button">
                  ⇄ Trocar de Time
                </button>`
              : ''
          }
          ${
            isHost
              ? `<button id="btn-reroll-map" class="ak-btn ak-btn-ghost ak-btn-sm" type="button">
                  🎲 Sortear Mapa
                </button>
                ${
                  isRumble
                    ? `<button id="btn-fill-bots" class="ak-btn ak-btn-cyan ak-btn-sm" type="button">
                        🤖 Preencher c/ Bots
                      </button>
                      <button id="btn-open-all-human" class="ak-btn ak-btn-ghost ak-btn-sm" type="button">
                        👥 Abrir Vagas
                      </button>`
                    : ''
                }`
              : ''
          }
        </div>
      </div>
      ${
        isHost
          ? `<div style="margin-top:8px;">
              ${this.renderThemePillsHtml('data-room-theme', room.mapTheme || 'random')}
            </div>`
          : ''
      }
    `;

    let versusOrRumbleHtml = '';
    let canStart = false;
    let hostStatusHint = '';

    if (!isRumble) {
      const p1Char = this.manifest.characters[room.p1.charId];
      const p2Char = this.manifest.characters[room.p2.charId];
      const p1Thumb = p1Char?.phases.fase_1?.actions.idle[0]?.src ?? '';
      const p2Thumb = p2Char?.phases.fase_1?.actions.idle[0]?.src ?? '';
      const p2Occupied = Boolean(room.p2.userId);
      canStart =
        isHost &&
        (room.p2Mode === 'bot' || (Boolean(room.p2.userId) && room.p2.ready));
      hostStatusHint = canStart
        ? 'Tudo pronto! Inicie a batalha quando quiser.'
        : room.p2Mode === 'human' && !p2Occupied
          ? 'Convide um amigo ou mude o P2 para Bot para começar.'
          : 'Aguardando o amigo clicar em "Pronto!".';

      versusOrRumbleHtml = `
        <div class="ak-lobby-versus">
          <div class="ak-lobby-slot p1">
            <div class="ak-slot-header">
              <span class="ak-mini-badge cyan">P1 · LÍDER</span>
              <span class="ak-mini-badge green">PRONTO</span>
            </div>
            <div class="ak-slot-player">
              <img class="ak-char-thumb" src="${p1Thumb}" alt="${escapeHtml(p1Char?.name ?? '')}" />
              <div>
                <div class="ak-slot-name">${escapeHtml(room.p1.username)}</div>
                <div class="ak-profile-sub">
                  ${escapeHtml(p1Char?.name ?? room.p1.charId)} · Fase ${room.p1.startPhase} · Nv ${room.p1.level}
                </div>
              </div>
            </div>
          </div>

          <div class="ak-vs-pill">VS</div>

          <div class="ak-lobby-slot p2">
            <div class="ak-slot-header">
              <span class="ak-mini-badge ${room.p2Mode === 'bot' ? 'amber' : 'red'}">
                ${room.p2Mode === 'bot' ? 'P2 · BOT CPU' : 'P2 · AMIGO'}
              </span>
              ${
                room.p2Mode === 'bot'
                  ? '<span class="ak-mini-badge green">PRONTO</span>'
                  : p2Occupied
                    ? `<span class="ak-mini-badge ${room.p2.ready ? 'green' : 'amber'}">${room.p2.ready ? 'PRONTO!' : 'ESCOLHENDO'}</span>`
                    : '<span class="ak-mini-badge">VAGA ABERTA</span>'
              }
            </div>

            ${
              p2Occupied
                ? `<div class="ak-slot-player">
                    <img class="ak-char-thumb" src="${p2Thumb}" alt="${escapeHtml(p2Char?.name ?? '')}" />
                    <div>
                      <div class="ak-slot-name">${escapeHtml(room.p2.username)}</div>
                      <div class="ak-profile-sub">
                        ${escapeHtml(p2Char?.name ?? room.p2.charId)} · Fase ${room.p2.startPhase}
                      </div>
                    </div>
                  </div>`
                : `<div class="ak-waiting-slot">
                    Aguardando amigo entrar...<br/>
                    <span style="font-size:0.75rem;color:var(--ak-muted);">Envie o código <strong>#${escapeHtml(room.code)}</strong> ou clique em <strong>Convidar Amigo</strong>.</span>
                  </div>`
            }

            ${
              isHost
                ? `<div class="ak-seg-group" style="margin-top:8px;">
                    <button type="button" class="ak-seg-btn ak-seg-sm ${room.p2Mode === 'human' ? 'active' : ''}" data-p2-mode="human">
                      👤 Com Amigo
                    </button>
                    <button type="button" class="ak-seg-btn ak-seg-sm ${room.p2Mode === 'bot' ? 'active' : ''}" data-p2-mode="bot">
                      🤖 Com Bot
                    </button>
                  </div>`
                : ''
            }
          </div>
        </div>
      `;
    } else {
      const team1Ids = activeIds.filter((sid) => teamForSlot(sid) === 1);
      const team2Ids = activeIds.filter((sid) => teamForSlot(sid) === 2);

      let t1Active = 0;
      let t2Active = 0;
      let notReadyName: string | null = null;
      for (const sid of activeIds) {
        const s = slots[sid];
        if (s.slotMode === 'bot' || (s.slotMode === 'human' && s.userId)) {
          if (teamForSlot(sid) === 1) t1Active += 1;
          else t2Active += 1;
        }
        if (s.slotMode === 'human' && s.userId && s.userId !== room.hostId && !s.ready) {
          notReadyName = s.username;
        }
      }
      canStart = isHost && t1Active >= 1 && t2Active >= 1 && !notReadyName;
      hostStatusHint = canStart
        ? 'Tudo pronto! Arena procedural preparada para o Rumble!'
        : t1Active === 0 || t2Active === 0
          ? 'Os dois times precisam ter ao menos 1 lutador (jogador ou bot).'
          : `Aguardando ${notReadyName} clicar em "Pronto!".`;

      const renderRumbleCard = (sid: FighterSlotId) => {
        const s = slots[sid];
        const ch = this.manifest.characters[s.charId];
        const thumb = ch?.phases.fase_1?.actions.idle[0]?.src ?? '';
        const isMe = s.slotMode === 'human' && s.userId === actorId;
        const isLeader = s.slotMode === 'human' && s.userId === room.hostId;
        const isOccupied = s.slotMode === 'bot' || (s.slotMode === 'human' && Boolean(s.userId));
        const isEditingThis = editingSlotKey === sid;

        const badgeHtml =
          s.slotMode === 'closed'
            ? '<span class="ak-mini-badge">FECHADA</span>'
            : s.slotMode === 'bot'
              ? '<span class="ak-mini-badge amber">BOT</span>'
              : s.userId
                ? `<span class="ak-mini-badge ${isLeader || s.ready ? 'green' : 'amber'}">${isLeader ? 'LÍDER' : s.ready ? 'PRONTO!' : 'ESCOLHENDO'}</span>`
                : '<span class="ak-mini-badge">VAGA ABERTA</span>';

        return `
          <div class="ak-rumble-slot-card ${isMe ? 'is-me' : ''} ${isEditingThis ? 'is-editing' : ''} ${s.slotMode === 'closed' ? 'is-closed' : ''}">
            <div class="ak-slot-header">
              <span class="ak-mini-badge ${teamForSlot(sid) === 1 ? 'cyan' : 'red'}">${sid.toUpperCase()}${isMe ? ' · VOCÊ' : ''}</span>
              ${badgeHtml}
            </div>
            ${
              isOccupied
                ? `<div class="ak-slot-player ak-slot-player-sm">
                    <img class="ak-char-thumb ak-thumb-sm" src="${thumb}" alt="${escapeHtml(ch?.name ?? '')}" />
                    <div style="min-width:0;">
                      <div class="ak-slot-name">${escapeHtml(s.username)}</div>
                      <div class="ak-profile-sub">
                        ${escapeHtml(ch?.name ?? s.charId)} · F${s.startPhase} · Nv ${s.level}
                      </div>
                    </div>
                  </div>`
                : `<div class="ak-waiting-slot-sm">
                    ${s.slotMode === 'closed' ? 'Vaga fechada pelo líder' : 'Aguardando jogador entrar...'}
                  </div>`
            }
            ${
              isHost && s.userId !== actorId
                ? `<div class="ak-slot-controls">
                    <button type="button" class="ak-mini-btn ${s.slotMode === 'human' ? 'active' : ''}" data-slot-config="${sid}:human">Aberta</button>
                    <button type="button" class="ak-mini-btn ${s.slotMode === 'bot' ? 'active' : ''}" data-slot-config="${sid}:bot">Bot</button>
                    <button type="button" class="ak-mini-btn ${s.slotMode === 'closed' ? 'active' : ''}" data-slot-config="${sid}:closed">Fechar</button>
                    ${
                      s.slotMode === 'bot'
                        ? `<button type="button" class="ak-mini-btn edit ${isEditingThis ? 'active' : ''}" data-lobby-slot="${sid}">Editar</button>`
                        : ''
                    }
                  </div>`
                : ''
            }
          </div>
        `;
      };

      versusOrRumbleHtml = `
        <div class="ak-rumble-lobby-grid">
          <div class="ak-rumble-team-col t1">
            <div class="ak-team-col-title blue">TIME AZUL (${t1Active}/${team1Ids.length})</div>
            ${team1Ids.map(renderRumbleCard).join('')}
          </div>
          <div class="ak-rumble-team-col t2">
            <div class="ak-team-col-title red">TIME VERMELHO (${t2Active}/${team2Ids.length})</div>
            ${team2Ids.map(renderRumbleCard).join('')}
          </div>
        </div>
      `;
    }

    return `
      <div class="ak-screen">
        <div class="ak-panel">
          <div class="ak-select-header" style="flex-wrap:wrap;">
            <button id="btn-leave-room" class="ak-btn ak-btn-ghost ak-btn-sm" type="button">
              Sair da Sala
            </button>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <h2 style="margin:0;">Sala #${escapeHtml(room.code)}</h2>
              <span class="ak-mini-badge ${isRumble ? 'amber' : 'cyan'}">
                ${isRumble ? `RUMBLE ${room.teamSize ?? 3}v${room.teamSize ?? 3}` : '1v1'}
              </span>
              <span class="ak-mini-badge ${room.isPublic ? 'green' : ''}">
                ${room.isPublic ? '🌐 PÚBLICA' : '🔒 PRIVADA'}
              </span>
              <button id="btn-copy-room-code" class="ak-btn ak-btn-ghost ak-btn-sm" type="button">
                Copiar
              </button>
            </div>
            <button id="btn-open-friends" class="ak-btn ak-btn-cyan ak-btn-sm" type="button">
              Convidar Amigo
            </button>
          </div>

          ${
            isHost
              ? `<div class="ak-lobby-host-config">
                  <div class="ak-seg-group">
                    <button type="button" class="ak-seg-btn ak-seg-sm ${!isRumble ? 'active' : ''}" data-room-preset="1v1">
                      1v1
                    </button>
                    <button type="button" class="ak-seg-btn ak-seg-sm ${isRumble && room.teamSize === 2 ? 'active' : ''}" data-room-preset="rumble-2">
                      Rumble 2v2
                    </button>
                    <button type="button" class="ak-seg-btn ak-seg-sm ${isRumble && (room.teamSize ?? 3) === 3 ? 'active' : ''}" data-room-preset="rumble-3">
                      Rumble 3v3
                    </button>
                  </div>
                  <div class="ak-seg-group">
                    <button type="button" class="ak-seg-btn ak-seg-sm ${room.isPublic ? 'active' : ''}" data-room-public="true">
                      🌐 Pública
                    </button>
                    <button type="button" class="ak-seg-btn ak-seg-sm ${!room.isPublic ? 'active' : ''}" data-room-public="false">
                      🔒 Privada
                    </button>
                  </div>
                </div>`
              : ''
          }

          ${
            this.roomErrorMsg
              ? `<div class="ak-alert-err" style="margin-top:8px;">${escapeHtml(this.roomErrorMsg)}</div>`
              : ''
          }

          ${roomMapToolbarHtml}

          ${versusOrRumbleHtml}
        </div>

        <div class="ak-panel">
          ${
            !isRumble && isHost && room.p2Mode === 'bot'
              ? `<div class="ak-seg-group" style="margin-bottom:10px;">
                  <button type="button" class="ak-seg-btn ${editingSlotKey === 'p1' ? 'active' : ''}" data-lobby-slot="p1">
                    Seu Lutador (P1)
                  </button>
                  <button type="button" class="ak-seg-btn ${editingSlotKey === 'p2' ? 'active' : ''}" data-lobby-slot="p2">
                    Lutador do Bot (P2)
                  </button>
                </div>`
              : isRumble && editingBot
                ? `<div class="ak-alert-warn" style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
                    <span>Editando lutador do <strong>${editingSlotKey.toUpperCase()} (Bot)</strong></span>
                    <button type="button" class="ak-btn ak-btn-ghost ak-btn-sm" data-lobby-slot="${mySlotKey ?? 'p1'}">Voltar p/ Meu Lutador</button>
                  </div>`
                : ''
          }

          <div class="ak-roster-grid">${cardsHtml}</div>

          <div class="ak-select-controls" style="margin-top:10px;">
            <div class="ak-field">
              <label>Fase Inicial (${editingBot ? `Bot ${editingSlotKey.toUpperCase()}` : 'Você'})</label>
              <div class="ak-seg-group">${phaseButtons}</div>
            </div>
            ${
              isHost && hasAnyBot
                ? `<div class="ak-field">
                    <label>Dificuldade dos Bots</label>
                    <div class="ak-seg-group">
                      ${diffButtons
                        .map(
                          (d) => `
                        <button type="button" class="ak-seg-btn ${room.botDifficulty === d.id ? 'active' : ''}" data-bot-diff="${d.id}">
                          ${d.label}
                        </button>`
                        )
                        .join('')}
                    </div>
                  </div>`
                : ''
            }
          </div>

          <div class="ak-lobby-footer">
            ${
              isHost
                ? `<div style="font-size:0.8rem;color:var(--ak-muted);">
                    ${escapeHtml(hostStatusHint)}
                  </div>
                  <button id="btn-lobby-start" class="ak-btn ak-btn-primary" type="button" ${canStart ? '' : 'disabled style="opacity:0.45;cursor:not-allowed;"'}>
                    ${isRumble ? 'Iniciar Rumble Arena!' : 'Iniciar Batalha!'}
                  </button>`
                : mySlot
                  ? `<div style="font-size:0.8rem;color:var(--ak-muted);">
                      ${mySlot.ready ? 'Você está pronto! Aguardando o líder iniciar...' : 'Escolha seu lutador e clique em Pronto!'}
                    </div>
                    <button id="btn-toggle-ready" class="ak-btn ${mySlot.ready ? 'ak-btn-accent' : 'ak-btn-primary'}" type="button">
                      ${mySlot.ready ? 'Cancelar Pronto' : 'Marcar Pronto!'}
                    </button>`
                  : ''
            }
          </div>
        </div>
      </div>
    `;
  }

  private renderAuthModal(): string {
    const isReg = this.authTab === 'register';
    return `
      <div class="ak-modal-backdrop">
        <div class="ak-modal">
          <div class="ak-select-header">
            <h2 style="margin:0;">Conta AnimeKombat</h2>
            <button id="btn-close-auth" class="ak-btn ak-btn-ghost ak-btn-sm" type="button">
              Fechar
            </button>
          </div>

          <div class="ak-seg-group">
            <button type="button" class="ak-seg-btn ${!isReg ? 'active' : ''}" data-auth-tab="login">
              Entrar
            </button>
            <button type="button" class="ak-seg-btn ${isReg ? 'active' : ''}" data-auth-tab="register">
              Criar Conta
            </button>
          </div>

          ${
            this.authErrorMsg
              ? `<div class="ak-alert-err">${escapeHtml(this.authErrorMsg)}</div>`
              : ''
          }

          <form id="ak-auth-form" class="ak-form-stack">
            ${
              isReg
                ? `<div class="ak-field">
                    <label>Nome de Guerreiro (Nick)</label>
                    <input id="auth-username" class="ak-input" type="text" maxlength="20" placeholder="Ex: GokuBR" value="${escapeHtml(this.authUsername)}" required />
                  </div>
                  <div class="ak-field">
                    <label>E-mail</label>
                    <input id="auth-email" class="ak-input" type="email" placeholder="seu@email.com" value="${escapeHtml(this.authEmail)}" required />
                  </div>`
                : `<div class="ak-field">
                    <label>Usuário, E-mail ou Tag</label>
                    <input id="auth-identifier" class="ak-input" type="text" placeholder="Ex: GokuBR ou seu@email.com" value="${escapeHtml(this.authIdentifier)}" required />
                  </div>`
            }
            <div class="ak-field">
              <label>Senha</label>
              <input id="auth-password" class="ak-input" type="password" minlength="4" placeholder="Mínimo 4 caracteres" value="${escapeHtml(this.authPassword)}" required />
            </div>

            <button class="ak-btn ak-btn-primary" type="submit" ${this.authBusy ? 'disabled' : ''}>
              ${this.authBusy ? 'Processando...' : isReg ? 'Criar Conta & Salvar Progresso' : 'Entrar na Conta'}
            </button>
          </form>

          <button id="btn-guest-continue" class="ak-btn ak-btn-ghost ak-btn-sm" type="button">
            Continuar como Convidado (Offline)
          </button>
        </div>
      </div>
    `;
  }

  private renderFriendsModal(): string {
    const user = this.net.getUser();
    const overview = this.net.getFriendsOverview();

    if (!user) {
      return `
        <div class="ak-modal-backdrop">
          <div class="ak-modal">
            <div class="ak-select-header">
              <h2 style="margin:0;">Amigos & Desafios</h2>
              <button id="btn-close-friends" class="ak-btn ak-btn-ghost ak-btn-sm" type="button">
                Fechar
              </button>
            </div>
            <p class="ak-subtitle">
              Entre ou crie uma conta para ganhar sua <strong>Tag de Amizade</strong>, adicionar amigos e convidá-los para salas 1v1!
            </p>
            <button id="btn-friends-to-auth" class="ak-btn ak-btn-primary" type="button">
              Entrar / Criar Conta
            </button>
          </div>
        </div>
      `;
    }

    const incomingHtml =
      overview.incomingRequests.length > 0
        ? `<div class="ak-section-title">Solicitações Pendentes (${overview.incomingRequests.length})</div>
           <div class="ak-list-stack">
             ${overview.incomingRequests
               .map(
                 (req) => `
               <div class="ak-list-row">
                 <div>
                   <div style="font-weight:800;">${escapeHtml(req.fromUser?.username ?? 'Jogador')}</div>
                   <div class="ak-profile-sub">${escapeHtml(req.fromUser?.friendCode ?? '')}</div>
                 </div>
                 <div style="display:flex;gap:6px;">
                   <button type="button" class="ak-btn ak-btn-cyan ak-btn-sm" data-accept-req="${escapeHtml(req.friendshipId)}">Aceitar</button>
                   <button type="button" class="ak-btn ak-btn-ghost ak-btn-sm" data-reject-req="${escapeHtml(req.friendshipId)}">Recusar</button>
                 </div>
               </div>`
               )
               .join('')}
           </div>`
        : '';

    const friendsHtml =
      overview.friends.length === 0
        ? `<div class="ak-empty-box">Você ainda não adicionou amigos. Compartilhe sua Tag <strong>${escapeHtml(user.friendCode)}</strong> ou adicione alguém acima!</div>`
        : overview.friends
            .map((f) => {
              const pStatus = f.presence.status;
              const isOnline = pStatus !== 'offline';
              const canJoinRoom =
                pStatus === 'in_room' &&
                f.presence.roomCode &&
                this.net.getCurrentRoom()?.code !== f.presence.roomCode;

              return `
                <div class="ak-list-row">
                  <div>
                    <div style="font-weight:800;display:flex;align-items:center;gap:6px;">
                      <span class="ak-status-dot ${pStatus === 'offline' ? 'offline' : pStatus === 'online' ? 'online' : 'busy'}"></span>
                      <span>${escapeHtml(f.username)}</span>
                    </div>
                    <div class="ak-profile-sub">
                      ${escapeHtml(f.friendCode)} · ${presenceLabel(pStatus, f.presence.roomCode)}
                    </div>
                  </div>
                  <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
                    ${
                      canJoinRoom
                        ? `<button type="button" class="ak-btn ak-btn-accent ak-btn-sm" data-join-friend-room="${escapeHtml(f.presence.roomCode ?? '')}">Entrar</button>`
                        : ''
                    }
                    <button
                      type="button"
                      class="ak-btn ak-btn-cyan ak-btn-sm"
                      data-invite-friend="${escapeHtml(f.userId)}"
                      ${isOnline ? '' : 'disabled style="opacity:0.4;cursor:not-allowed;"'}
                    >
                      Convidar
                    </button>
                    <button
                      type="button"
                      class="ak-btn ak-btn-ghost ak-btn-sm"
                      data-remove-friend="${escapeHtml(f.friendshipId)}"
                      title="Remover amigo"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              `;
            })
            .join('');

    return `
      <div class="ak-modal-backdrop">
        <div class="ak-modal" style="max-width:520px;">
          <div class="ak-select-header">
            <h2 style="margin:0;">Amigos & Desafios</h2>
            <button id="btn-close-friends" class="ak-btn ak-btn-ghost ak-btn-sm" type="button">
              Fechar
            </button>
          </div>

          <div class="ak-my-tag-box">
            <div>
              <div style="font-size:0.72rem;color:var(--ak-muted);text-transform:uppercase;">Sua Tag de Amigo</div>
              <div style="font-size:1.05rem;font-weight:900;color:var(--ak-cyan);">${escapeHtml(user.friendCode)}</div>
            </div>
            <button id="btn-copy-tag-modal" class="ak-btn ak-btn-ghost ak-btn-sm" type="button">
              Copiar Tag
            </button>
          </div>

          <div class="ak-join-code-row" style="margin-top:0;">
            <input
              id="input-friend-query"
              class="ak-input"
              type="text"
              placeholder="Adicionar por Tag (GOKU#1234) ou Nick"
              value="${escapeHtml(this.friendQuery)}"
            />
            <button id="btn-send-friend-req" class="ak-btn ak-btn-primary ak-btn-sm" type="button">
              Adicionar
            </button>
          </div>

          ${
            this.friendFeedback
              ? `<div class="${this.friendFeedback.kind === 'ok' ? 'ak-alert-ok' : 'ak-alert-err'}">${escapeHtml(this.friendFeedback.text)}</div>`
              : ''
          }

          ${incomingHtml}

          <div class="ak-section-title">Meus Amigos (${overview.friends.length})</div>
          <div class="ak-list-stack">${friendsHtml}</div>
        </div>
      </div>
    `;
  }

  private renderInvitesOverlay(): string {
    const cards = this.pendingInvites
      .map(
        (inv) => `
      <div class="ak-invite-card">
        <div>
          <div style="font-weight:900;font-size:0.9rem;">⚔️ Desafio de ${escapeHtml(inv.fromUser.username)}</div>
          <div class="ak-profile-sub">Convidou você para a Sala #${escapeHtml(inv.roomCode)}</div>
        </div>
        <div style="display:flex;gap:6px;">
          <button type="button" class="ak-btn ak-btn-primary ak-btn-sm" data-accept-invite="${escapeHtml(inv.roomCode)}">
            Aceitar
          </button>
          <button type="button" class="ak-btn ak-btn-ghost ak-btn-sm" data-dismiss-invite="${escapeHtml(inv.roomCode)}">
            Recusar
          </button>
        </div>
      </div>`
      )
      .join('');

    return `<div class="ak-invite-stack">${cards}</div>`;
  }

  private renderLoadingScreen(): string {
    return `
      <div class="ak-screen">
        <div class="ak-panel" style="max-width:460px;margin:auto;text-align:center;">
          <h2 style="margin:0 0 8px 0;">Carregando Arena & Sprites...</h2>
          <p class="ak-subtitle" style="margin-bottom:14px;">
            Preparando sprites e efeitos VFX para combate a 60 FPS.
          </p>
          <div class="ak-progress-track">
            <div class="ak-progress-fill" style="width:${this.loadingPercent}%"></div>
          </div>
          <div style="margin-top:8px;font-weight:800;color:var(--ak-cyan);">
            ${this.loadingPercent}%
          </div>
        </div>
      </div>
    `;
  }

  private renderPauseModal(): string {
    const inRoom = this.activeMatchMode !== 'solo';
    const isOnline = this.activeMatchMode === 'online';

    return `
      <div class="ak-modal-backdrop">
        <div class="ak-modal">
          <h2 style="margin:0;text-align:center;">${isOnline ? 'Menu da Batalha Online' : 'Luta Pausada'}</h2>
          <button id="btn-pause-resume" class="ak-btn ak-btn-primary" type="button">
            Continuar Luta
          </button>
          ${
            !isOnline
              ? `<button id="btn-pause-restart" class="ak-btn ak-btn-cyan" type="button">
                  Reiniciar Partida
                </button>`
              : ''
          }
          <button id="btn-open-help" class="ak-btn ak-btn-ghost" type="button">
            Ajuda & Controles (Remapear)
          </button>
          <button id="btn-open-settings" class="ak-btn ak-btn-ghost" type="button">
            Configurações de Controle & Áudio
          </button>
          ${
            inRoom
              ? `<button id="btn-pause-lobby" class="ak-btn ak-btn-ghost" type="button">
                  Voltar ao Lobby da Sala
                </button>`
              : ''
          }
          <button id="btn-pause-quit" class="ak-btn ak-btn-ghost" type="button">
            ${inRoom ? 'Sair da Sala' : 'Voltar à Seleção'}
          </button>
        </div>
      </div>
    `;
  }

  private renderResultModal(): string {
    if (!this.lastResult) return '';
    const { report, xpSummary, charName } = this.lastResult;
    const isDraw = (report.winnerTeam ?? report.winner) === 'draw';
    const isWin = report.localWon ?? report.winner === report.localSlot;
    const title = isDraw
      ? 'EMPATE'
      : report.roomMode === 'rumble'
        ? isWin
          ? 'VITÓRIA DO TIME!'
          : 'DERROTA DO TIME'
        : isWin
          ? 'VITÓRIA!'
          : 'DERROTA';
    const titleColor = isWin
      ? 'var(--ak-accent)'
      : isDraw
        ? 'var(--ak-cyan)'
        : 'var(--ak-primary)';

    const finalPhase =
      report.localSlot === 'p2' ? report.p2FinalPhase : report.p1FinalPhase;
    const leveledUp = xpSummary.newLevel > xpSummary.oldLevel;
    const unlockedNewPhase = xpSummary.newPhase > xpSummary.oldPhase;
    const inRoom = report.mode !== 'solo';
    const hasRoundScore =
      typeof report.team1RoundWins === 'number' &&
      typeof report.team2RoundWins === 'number';
    const roundScoreHtml = hasRoundScore
      ? `<div style="margin-top:4px;font-weight:800;font-size:0.95rem;color:var(--ak-accent);">
           Rounds: ${report.team1RoundWins} – ${report.team2RoundWins}
           ${report.roundsPlayed ? `(${report.roundsPlayed} ${report.roundsPlayed === 1 ? 'round' : 'rounds'})` : ''}
         </div>`
      : '';

    return `
      <div class="ak-modal-backdrop">
        <div class="ak-modal" style="text-align:center;">
          <h2 style="margin:0;font-size:2rem;color:${titleColor};">${title}</h2>
          <p style="margin:0;color:var(--ak-muted);">
            ${escapeHtml(charName)} ${report.roomMode === 'rumble' ? 'lutou no Rumble Arena!' : `encerrou na <strong>Fase ${finalPhase}</strong>`}
            ${report.opponentLeft ? '<br/><span style="color:var(--ak-cyan);">Adversário desconectou da partida.</span>' : ''}
          </p>
          ${roundScoreHtml}
          <div class="ak-panel" style="padding:12px;">
            <div style="font-weight:800;color:var(--ak-cyan);">+${xpSummary.xpGained} XP Obtido</div>
            <div style="margin-top:4px;font-size:0.9rem;">
              Nível ${xpSummary.newLevel} ${leveledUp ? '🎉 (LEVEL UP!)' : ''}
            </div>
            ${
              unlockedNewPhase
                ? `<div style="margin-top:6px;padding:6px;border-radius:8px;background:rgba(255,184,0,0.2);color:#fde047;font-weight:800;">
                    Nova Transformação Desbloqueada: Fase ${xpSummary.newPhase}!
                  </div>`
                : ''
            }
          </div>
          ${
            inRoom
              ? `<button id="btn-result-lobby" class="ak-btn ak-btn-primary" type="button">
                  Voltar ao Lobby da Sala
                </button>`
              : ''
          }
          ${
            report.mode !== 'online'
              ? `<button id="btn-result-rematch" class="ak-btn ${inRoom ? 'ak-btn-cyan' : 'ak-btn-primary'}" type="button">
                  Revanche
                </button>`
              : ''
          }
          <button id="btn-result-select" class="ak-btn ak-btn-ghost" type="button">
            ${inRoom ? 'Sair da Sala' : 'Trocar Lutador'}
          </button>
        </div>
      </div>
    `;
  }

  private renderSettingsModal(): string {
    const s = this.save.getData().settings;
    return `
      <div class="ak-modal-backdrop">
        <div class="ak-modal">
          <div class="ak-select-header">
            <h2 style="margin:0;">Configurações</h2>
            <div style="display:flex;gap:8px;align-items:center;">
              <button id="btn-open-help" class="ak-btn ak-btn-cyan ak-btn-sm" type="button">
                Teclas & Controle
              </button>
              <button id="btn-close-settings" class="ak-btn ak-btn-ghost ak-btn-sm" type="button">
                Fechar
              </button>
            </div>
          </div>

          <div class="ak-setting-row">
            <div>
              <div>Ritmo de Combate</div>
              <div style="font-size:0.72rem;color:#94a3b8;">Tático (~1s entre golpes) ou Clássico (combos rápidos)</div>
            </div>
            <div class="ak-seg-group">
              <button type="button" class="ak-seg-btn ak-seg-sm ${s.combatPace === 'tactical' ? 'active' : ''}" data-pace="tactical">
                Tático (~1s)
              </button>
              <button type="button" class="ak-seg-btn ak-seg-sm ${s.combatPace === 'classic' ? 'active' : ''}" data-pace="classic">
                Clássico
              </button>
            </div>
          </div>
          <div class="ak-setting-row">
            <span>Opacidade Controles (${Math.round(s.controlsOpacity * 100)}%)</span>
            <input id="set-opacity" type="range" min="0.35" max="1" step="0.05" value="${s.controlsOpacity}" />
          </div>
          <div class="ak-setting-row">
            <span>Tamanho Controles (${Math.round(s.controlsScale * 100)}%)</span>
            <input id="set-scale" type="range" min="0.8" max="1.2" step="0.05" value="${s.controlsScale}" />
          </div>
          <div class="ak-setting-row">
            <span>Zona Morta Joystick Touch (${Math.round(s.stickDeadzone * 100)}%)</span>
            <input id="set-deadzone" type="range" min="0.1" max="0.4" step="0.02" value="${s.stickDeadzone}" />
          </div>
          <div class="ak-setting-row">
            <span>Zona Morta Controle Físico (<span id="set-gp-deadzone-val">${Math.round(s.gamepadDeadzone * 100)}%</span>)</span>
            <input id="set-gp-deadzone" type="range" min="0.14" max="0.40" step="0.02" value="${s.gamepadDeadzone}" />
          </div>
          <div class="ak-setting-row">
            <span>Pulo no Direcional (Cima)</span>
            <button id="set-jump-stick" class="ak-btn ak-btn-sm ${s.jumpViaStick ? 'ak-btn-cyan' : 'ak-btn-ghost'}" type="button">
              ${s.jumpViaStick ? 'Ativado' : 'Só Botão'}
            </button>
          </div>
          <div class="ak-setting-row">
            <span>Vibração Háptica</span>
            <button id="set-haptic" class="ak-btn ak-btn-sm ${s.hapticFeedback ? 'ak-btn-cyan' : 'ak-btn-ghost'}" type="button">
              ${s.hapticFeedback ? 'Ligada' : 'Desligada'}
            </button>
          </div>
          <div class="ak-setting-row">
            <span>Volume BGM (${Math.round(s.bgmVolume * 100)}%)</span>
            <div style="display:flex;gap:8px;align-items:center;">
              <input id="set-bgm-vol" type="range" min="0" max="1" step="0.05" value="${s.bgmVolume}" />
              <button id="set-bgm-mute" class="ak-btn ak-btn-sm" type="button">
                ${s.bgmMuted ? 'Mudo' : 'Som'}
              </button>
            </div>
          </div>
          <div class="ak-setting-row">
            <span>Volume SFX (${Math.round(s.sfxVolume * 100)}%)</span>
            <div style="display:flex;gap:8px;align-items:center;">
              <input id="set-sfx-vol" type="range" min="0" max="1" step="0.05" value="${s.sfxVolume}" />
              <button id="set-sfx-mute" class="ak-btn ak-btn-sm" type="button">
                ${s.sfxMuted ? 'Mudo' : 'Som'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private remapKeyboardAction(action: BindableAction, code: string): void {
    const cur = this.save.getData().settings.keyBindings;
    const next: KeyBindings = { ...cur };
    for (const k of Object.keys(next) as BindableAction[]) {
      next[k] = (next[k] ?? []).filter((c) => c !== code);
    }
    next[action] = [code];
    this.save.updateSettings({ keyBindings: next });
    this.callbacks.onSettingsChanged();
    this.showToast(
      `${BINDABLE_ACTION_LABELS[action]} definido para ${formatKeyCode(code)}`
    );
  }

  private remapGamepadAction(action: BindableAction, btnIndex: number): void {
    const cur = this.save.getData().settings.gamepadBindings;
    const next: GamepadBindings = { ...cur };
    for (const k of Object.keys(next) as BindableAction[]) {
      next[k] = (next[k] ?? []).filter((b) => b !== btnIndex);
    }
    next[action] = [btnIndex];
    this.save.updateSettings({ gamepadBindings: next });
    this.callbacks.onSettingsChanged();
    this.showToast(
      `${BINDABLE_ACTION_LABELS[action]} definido para ${formatGamepadButton(btnIndex)}`
    );
  }

  private renderHelpModal(): string {
    const s = this.save.getData().settings;
    const gp = this.input.getConnectedGamepad();

    const kbActions: BindableAction[] = [
      'left',
      'right',
      'up',
      'down',
      'jump',
      'a1',
      'a2',
      'a3',
      'a4',
      'block',
      'evolve',
      'pause',
    ];
    const gpActions: BindableAction[] = [
      'a1',
      'a2',
      'a3',
      'a4',
      'jump',
      'block',
      'evolve',
      'pause',
    ];

    let bodyHtml = '';
    if (this.helpTab === 'keyboard') {
      const rows = kbActions
        .map((act) => {
          const keys = s.keyBindings[act] ?? [];
          const keysLabel =
            keys.length > 0
              ? keys.map((k) => formatKeyCode(k)).join(' / ')
              : 'Não mapeado';
          const isCap =
            this.capturingAction?.device === 'keyboard' &&
            this.capturingAction.action === act;
          return `
            <div class="ak-remap-row">
              <span class="ak-remap-action">${escapeHtml(BINDABLE_ACTION_LABELS[act])}</span>
              <span class="ak-remap-keys">${escapeHtml(keysLabel)}</span>
              <button
                type="button"
                class="ak-btn ak-btn-sm ${isCap ? 'ak-btn-accent ak-capturing' : 'ak-btn-ghost'}"
                data-remap-kb="${act}"
              >
                ${isCap ? 'Aperte uma tecla... (ESC cancela)' : 'Alterar'}
              </button>
            </div>
          `;
        })
        .join('');
      bodyHtml = `
        <div class="ak-help-note">
          Clique em <strong>Alterar</strong> e pressione a nova tecla desejada. Teclas já usadas em outra ação são transferidas automaticamente.
        </div>
        <div class="ak-remap-list">${rows}</div>
        <div style="display:flex;justify-content:flex-end;margin-top:8px;">
          <button id="btn-reset-kb" type="button" class="ak-btn ak-btn-ghost ak-btn-sm">
            Restaurar Padrão do Teclado
          </button>
        </div>
      `;
    } else if (this.helpTab === 'gamepad') {
      const rows = gpActions
        .map((act) => {
          const btns = s.gamepadBindings[act] ?? [];
          const btnLabel =
            btns.length > 0
              ? btns.map((b) => formatGamepadButton(b)).join(' / ')
              : 'Não mapeado';
          const isCap =
            this.capturingAction?.device === 'gamepad' &&
            this.capturingAction.action === act;
          return `
            <div class="ak-remap-row">
              <span class="ak-remap-action">${escapeHtml(BINDABLE_ACTION_LABELS[act])}</span>
              <span class="ak-remap-keys">${escapeHtml(btnLabel)}</span>
              <button
                type="button"
                class="ak-btn ak-btn-sm ${isCap ? 'ak-btn-accent ak-capturing' : 'ak-btn-ghost'}"
                data-remap-gp="${act}"
              >
                ${isCap ? 'Aperte um botão no controle...' : 'Alterar'}
              </button>
            </div>
          `;
        })
        .join('');
      bodyHtml = `
        <div class="ak-help-note">
          Conecte um controle Xbox, PlayStation ou USB/Bluetooth compatível. Analógico Esquerdo e D-Pad controlam movimentação e mira.
        </div>
        <div class="ak-setting-row" style="margin-bottom:8px;">
          <span>Zona Morta Anti-Drift (<strong id="set-gp-deadzone-val">${Math.round(s.gamepadDeadzone * 100)}%</strong>)</span>
          <input id="set-gp-deadzone" type="range" min="0.14" max="0.40" step="0.02" value="${s.gamepadDeadzone}" />
        </div>
        <div class="ak-remap-list">
          <div class="ak-remap-row is-readonly">
            <span class="ak-remap-action">Movimento & Mira</span>
            <span class="ak-remap-keys">Analógico Esq. / D-Pad</span>
            <span class="ak-tag-pill">Fixo</span>
          </div>
          ${rows}
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:8px;">
          <button id="btn-reset-gp" type="button" class="ak-btn ak-btn-ghost ak-btn-sm">
            Restaurar Padrão do Controle
          </button>
        </div>
      `;
    } else if (this.helpTab === 'touch') {
      bodyHtml = `
        <div class="ak-help-grid">
          <div class="ak-help-card">
            <h4>Analógico Virtual (Esquerda)</h4>
            <p>Arraste para correr para esquerda/direita, agachar para baixo ou apontar golpes especiais (cima, diagonal e baixo).</p>
          </div>
          <div class="ak-help-card">
            <h4>Golpes & Ultimate (Direita)</h4>
            <p><strong>A1</strong> (Básico), <strong>A2</strong> (Especial), <strong>A3</strong> (Projétil/Energia) e <strong>ULT</strong> (Ultimate). O brilho indica recarga global e Ki suficiente.</p>
          </div>
          <div class="ak-help-card">
            <h4>Defesa, Pulo & Evolução</h4>
            <p>Segure <strong>DEF</strong> para bloquear golpes frontais. <strong>PULO</strong> salta (ou desça de plataformas com Baixo + Pulo). Quando a barra roxa encher, toque em <strong>EVOLUIR</strong>.</p>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:10px;">
          <button id="btn-help-to-settings" type="button" class="ak-btn ak-btn-cyan ak-btn-sm">
            Ajustar Tamanho, Opacidade e Vibração
          </button>
        </div>
      `;
    } else {
      bodyHtml = `
        <div class="ak-help-grid">
          <div class="ak-help-card">
            <h4>Cadência Tática (~1s entre golpes)</h4>
            <p>No modo <strong>Tático</strong>, cada ataque aplica um intervalo global equilibrado (~1,0s) para que você leia o cenário, defenda e responda estrategicamente em vez de esmagar botões.</p>
          </div>
          <div class="ak-help-card">
            <h4>Controle 100% Manual (Sem Ímã)</h4>
            <p>Seu personagem só anda e vira quando você comanda esquerda/direita. Defesa e golpes saem exatamente para a direção escolhida sem puxar contra o oponente.</p>
          </div>
          <div class="ak-help-card">
            <h4>Golpes Direcionais & Plataformas</h4>
            <p>Segure <strong>Cima</strong>, <strong>Diagonal</strong> ou <strong>Baixo</strong> ao pressionar A1–A4 para variar a trajetória. Para descer de plataformas elevadas, pressione <strong>Baixo + Pulo</strong>.</p>
          </div>
          <div class="ak-help-card">
            <h4>Evolução de Fase (1 → 4)</h4>
            <p>Cause ou receba dano para carregar a barra roxa de Evolução. Quando atingir 100%, pressione <strong>Evoluir</strong> para transformar e ganhar dano, velocidade e novos golpes!</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="ak-modal-backdrop">
        <div class="ak-modal ak-modal-wide">
          <div class="ak-select-header">
            <h2 style="margin:0;">Ajuda & Controles</h2>
            <button id="btn-close-help" class="ak-btn ak-btn-ghost ak-btn-sm" type="button">
              Fechar
            </button>
          </div>

          <div class="ak-gamepad-banner ${gp.connected ? 'connected' : ''}">
            <span class="ak-gamepad-dot"></span>
            <span>
              ${
                gp.connected
                  ? `Controle conectado: <strong>${escapeHtml(gp.name)}</strong>`
                  : 'Nenhum controle físico conectado — plugue via USB/Bluetooth e pressione qualquer botão para detectar'
              }
            </span>
          </div>

          <div class="ak-tabs">
            <button type="button" class="ak-tab-btn ${this.helpTab === 'keyboard' ? 'active' : ''}" data-help-tab="keyboard">
              Teclado
            </button>
            <button type="button" class="ak-tab-btn ${this.helpTab === 'gamepad' ? 'active' : ''}" data-help-tab="gamepad">
              Controle
            </button>
            <button type="button" class="ak-tab-btn ${this.helpTab === 'touch' ? 'active' : ''}" data-help-tab="touch">
              Touch Mobile
            </button>
            <button type="button" class="ak-tab-btn ${this.helpTab === 'combat' ? 'active' : ''}" data-help-tab="combat">
              Guia de Combate
            </button>
          </div>

          ${bodyHtml}
        </div>
      </div>
    `;
  }

  private copyText(text: string, feedback: string): void {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      void navigator.clipboard.writeText(text).then(
        () => this.showToast(feedback),
        () => this.showToast(`Código: ${text}`)
      );
    } else {
      this.showToast(`Código: ${text}`);
    }
  }

  private bindEvents(): void {
    const click = (id: string, fn: () => void) => {
      this.uiLayer.querySelector(`#${id}`)?.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playSfx('ui');
        fn();
      });
    };

    // Navegação principal
    click('btn-go-select', () => this.showSelect());
    click('btn-go-rooms', () => this.showRooms());
    click('btn-back-title', () => this.showTitle());

    // Conta / Auth
    click('btn-open-auth', () => {
      this.authErrorMsg = null;
      this.showAuthModal = true;
      this.render();
    });
    click('btn-close-auth', () => {
      this.showAuthModal = false;
      this.render();
    });
    click('btn-guest-continue', () => {
      this.showAuthModal = false;
      this.render();
    });
    click('btn-logout', () => {
      this.net.logout();
      this.showToast('Você saiu da conta. Modo Convidado ativado.');
      if (this.currentScreen === 'lobby') {
        this.showRooms();
      } else {
        this.render();
      }
    });
    click('btn-copy-tag-top', () => {
      const code = this.net.getUser()?.friendCode;
      if (code) this.copyText(code, `Tag ${code} copiada!`);
    });
    click('btn-copy-tag-modal', () => {
      const code = this.net.getUser()?.friendCode;
      if (code) this.copyText(code, `Tag ${code} copiada!`);
    });

    // Amigos
    click('btn-open-friends', () => {
      this.friendFeedback = null;
      this.showFriendsModal = true;
      void this.net.fetchFriends().catch(() => undefined);
      this.render();
    });
    click('btn-close-friends', () => {
      this.showFriendsModal = false;
      this.render();
    });
    click('btn-friends-to-auth', () => {
      this.showFriendsModal = false;
      this.showAuthModal = true;
      this.render();
    });

    // Configurações, Ajuda & PWA
    click('btn-open-help', () => {
      this.openHelp();
    });
    click('btn-close-help', () => {
      this.cancelCapture();
      this.showHelpModal = false;
      this.render();
    });
    click('btn-help-to-settings', () => {
      this.cancelCapture();
      this.showHelpModal = false;
      this.showSettingsModal = true;
      this.render();
    });
    click('btn-open-settings', () => {
      this.cancelCapture();
      this.showSettingsModal = true;
      this.render();
    });
    click('btn-close-settings', () => {
      this.cancelCapture();
      this.showSettingsModal = false;
      this.render();
    });
    click('btn-pwa-install', () => {
      void this.pwa.triggerInstall();
    });

    // Seleção Solo
    click('btn-start-fight', () => {
      this.activeMatchMode = 'solo';
      void this.callbacks.onStartMatch(this.getCurrentMatchConfig());
    });

    // Pausa & Resultado
    click('btn-pause-resume', () => {
      this.closePause();
      this.callbacks.onResumeMatch();
    });
    click('btn-pause-restart', () => {
      this.closePause();
      this.callbacks.onRestartMatch();
    });
    click('btn-pause-lobby', () => {
      this.closePause();
      this.callbacks.onReturnToLobby();
    });
    click('btn-pause-quit', () => {
      this.closePause();
      if (this.activeMatchMode !== 'solo') {
        this.net.leaveRoom();
      }
      this.callbacks.onQuitToSelect();
    });
    click('btn-result-lobby', () => {
      this.lastResult = null;
      this.callbacks.onReturnToLobby();
    });
    click('btn-result-rematch', () => {
      this.lastResult = null;
      this.callbacks.onRestartMatch();
    });
    click('btn-result-select', () => {
      this.lastResult = null;
      if (this.activeMatchMode !== 'solo') {
        this.net.leaveRoom();
      }
      this.callbacks.onQuitToSelect();
    });

    // Hub de Salas
    this.uiLayer.querySelectorAll<HTMLElement>('[data-create-preset]').forEach((el) => {
      el.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playSfx('ui');
        const preset = el.dataset.createPreset;
        if (preset === '1v1') {
          this.createRoomMode = '1v1';
        } else if (preset === 'rumble-2') {
          this.createRoomMode = 'rumble';
          this.createTeamSize = 2;
        } else {
          this.createRoomMode = 'rumble';
          this.createTeamSize = 3;
        }
        this.render();
      });
    });

    this.uiLayer.querySelectorAll<HTMLElement>('[data-create-visibility]').forEach((el) => {
      el.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playSfx('ui');
        this.createRoomPublic = el.dataset.createVisibility !== 'private';
        this.render();
      });
    });

    this.uiLayer.querySelectorAll<HTMLElement>('[data-create-theme]').forEach((el) => {
      el.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playSfx('ui');
        this.createMapTheme = el.dataset.createTheme || 'random';
        this.render();
      });
    });

    click('btn-create-room-human', () => {
      const prog = this.save.getCharacterProgress(this.selectedP1);
      this.roomErrorMsg = null;
      this.net.createRoom({
        roomMode: this.createRoomMode,
        teamSize: this.createRoomMode === 'rumble' ? this.createTeamSize : 1,
        p2Mode: 'human',
        isPublic: this.createRoomPublic,
        mapTheme: this.createMapTheme,
        fillBots: false,
        charId: this.selectedP1,
        startPhase: Math.min(this.selectedStartPhase, prog.unlockedPhase),
        level: prog.level,
      });
    });
    click('btn-create-room-bot', () => {
      const prog = this.save.getCharacterProgress(this.selectedP1);
      this.roomErrorMsg = null;
      this.net.createRoom({
        roomMode: this.createRoomMode,
        teamSize: this.createRoomMode === 'rumble' ? this.createTeamSize : 1,
        p2Mode: 'bot',
        isPublic: this.createRoomPublic,
        mapTheme: this.createMapTheme,
        fillBots: this.createRoomMode === 'rumble',
        botDifficulty: this.save.getData().settings.difficulty,
        charId: this.selectedP1,
        startPhase: Math.min(this.selectedStartPhase, prog.unlockedPhase),
        level: prog.level,
      });
    });
    click('btn-refresh-rooms', () => {
      this.net.requestRoomList();
    });

    const roomCodeInput = this.uiLayer.querySelector<HTMLInputElement>('#input-room-code');
    roomCodeInput?.addEventListener('input', () => {
      this.roomJoinCode = roomCodeInput.value.toUpperCase();
    });
    click('btn-join-room-code', () => {
      const code = this.roomJoinCode.trim().toUpperCase();
      if (code.length < 4) {
        this.roomErrorMsg = 'Digite o código da sala (ex: AK7X92).';
        this.render();
        return;
      }
      const prog = this.save.getCharacterProgress(this.selectedP1);
      this.roomErrorMsg = null;
      this.net.joinRoom(code, {
        charId: this.selectedP1,
        startPhase: Math.min(this.selectedStartPhase, prog.unlockedPhase),
        level: prog.level,
      });
    });

    this.uiLayer.querySelectorAll<HTMLElement>('[data-join-room]').forEach((el) => {
      el.addEventListener('click', () => {
        const code = el.dataset.joinRoom!;
        const prog = this.save.getCharacterProgress(this.selectedP1);
        this.audio.unlock();
        this.audio.playSfx('ui');
        this.net.joinRoom(code, {
          charId: this.selectedP1,
          startPhase: Math.min(this.selectedStartPhase, prog.unlockedPhase),
          level: prog.level,
        });
      });
    });

    // Lobby da Sala
    click('btn-leave-room', () => {
      this.net.leaveRoom();
      this.showRooms();
    });
    click('btn-copy-room-code', () => {
      const code = this.net.getCurrentRoom()?.code;
      if (code) this.copyText(code, `Código #${code} copiado!`);
    });
    click('btn-lobby-start', () => {
      this.net.startRoomMatch();
    });
    click('btn-toggle-ready', () => {
      const room = this.net.getCurrentRoom();
      if (!room) return;
      const slots = this.getNormalizedSlots(room);
      const mySlotKey = this.findActorSlot(room, slots);
      if (!mySlotKey) return;
      this.net.updateRoomSelection({ ready: !slots[mySlotKey].ready });
    });
    click('btn-switch-team', () => {
      this.net.updateRoomSelection({ switchTeam: true });
    });
    click('btn-reroll-map', () => {
      this.net.updateRoomConfig({ rerollSeed: true });
    });
    click('btn-fill-bots', () => {
      this.net.updateRoomConfig({ fillBots: true });
    });
    click('btn-open-all-human', () => {
      this.net.updateRoomConfig({ openAllHuman: true });
    });

    this.uiLayer.querySelectorAll<HTMLElement>('[data-room-preset]').forEach((el) => {
      el.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playSfx('ui');
        const preset = el.dataset.roomPreset;
        if (preset === '1v1') {
          this.net.updateRoomConfig({ roomMode: '1v1', teamSize: 1 });
        } else if (preset === 'rumble-2') {
          this.net.updateRoomConfig({ roomMode: 'rumble', teamSize: 2 });
        } else {
          this.net.updateRoomConfig({ roomMode: 'rumble', teamSize: 3 });
        }
      });
    });

    this.uiLayer.querySelectorAll<HTMLElement>('[data-room-public]').forEach((el) => {
      el.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playSfx('ui');
        this.net.updateRoomConfig({ isPublic: el.dataset.roomPublic === 'true' });
      });
    });

    this.uiLayer.querySelectorAll<HTMLElement>('[data-room-theme]').forEach((el) => {
      el.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playSfx('ui');
        this.net.updateRoomConfig({ mapTheme: el.dataset.roomTheme || 'random' });
      });
    });

    this.uiLayer.querySelectorAll<HTMLElement>('[data-slot-config]').forEach((el) => {
      el.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playSfx('ui');
        const [targetSlot, slotMode] = (el.dataset.slotConfig || '').split(':') as [
          FighterSlotId,
          SlotMode,
        ];
        if (!targetSlot || !slotMode) return;
        this.net.updateRoomConfig({ targetSlot, slotMode });
      });
    });

    this.uiLayer.querySelectorAll<HTMLElement>('[data-p2-mode]').forEach((el) => {
      el.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playSfx('ui');
        const mode = el.dataset.p2Mode as 'human' | 'bot';
        this.net.updateRoomConfig({ p2Mode: mode });
      });
    });

    this.uiLayer.querySelectorAll<HTMLElement>('[data-lobby-slot]').forEach((el) => {
      el.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playSfx('ui');
        this.lobbyEditingSlot = el.dataset.lobbySlot as FighterSlotId;
        this.render();
      });
    });

    this.uiLayer.querySelectorAll<HTMLElement>('[data-lobby-char]').forEach((el) => {
      el.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playSfx('ui');
        const charId = el.dataset.lobbyChar!;
        const room = this.net.getCurrentRoom();
        if (!room) return;
        const slots = this.getNormalizedSlots(room);
        const actorId = this.net.getActorId();
        const isHost = room.hostId === actorId;
        const target = slots[this.lobbyEditingSlot];
        const editingBot = Boolean(isHost && target && target.isBot);

        if (editingBot) {
          this.net.updateRoomSelection({
            targetSlot: this.lobbyEditingSlot,
            charId,
          });
        } else {
          const prog = this.save.getCharacterProgress(charId);
          const myKey = this.findActorSlot(room, slots) ?? 'p1';
          const slot = slots[myKey];
          const clampedPhase = Math.min(slot.startPhase, prog.unlockedPhase);
          this.net.updateRoomSelection({
            charId,
            startPhase: clampedPhase,
            level: prog.level,
          });
        }
      });
    });

    this.uiLayer.querySelectorAll<HTMLElement>('[data-lobby-phase]').forEach((el) => {
      el.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playSfx('ui');
        const startPhase = Number(el.dataset.lobbyPhase);
        const room = this.net.getCurrentRoom();
        if (!room) return;
        const slots = this.getNormalizedSlots(room);
        const isHost = room.hostId === this.net.getActorId();
        const target = slots[this.lobbyEditingSlot];
        const editingBot = Boolean(isHost && target && target.isBot);
        this.net.updateRoomSelection({
          targetSlot: editingBot ? this.lobbyEditingSlot : undefined,
          startPhase,
        });
      });
    });

    this.uiLayer.querySelectorAll<HTMLElement>('[data-bot-diff]').forEach((el) => {
      el.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playSfx('ui');
        this.net.updateRoomConfig({
          botDifficulty: el.dataset.botDiff as AIDifficulty,
        });
      });
    });

    // Formulário de Login / Cadastro
    this.uiLayer.querySelectorAll<HTMLElement>('[data-auth-tab]').forEach((el) => {
      el.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playSfx('ui');
        this.authTab = el.dataset.authTab as 'login' | 'register';
        this.authErrorMsg = null;
        this.render();
      });
    });

    const bindInputDraft = (sel: string, setter: (v: string) => void) => {
      const inp = this.uiLayer.querySelector<HTMLInputElement>(sel);
      inp?.addEventListener('input', () => setter(inp.value));
    };
    bindInputDraft('#auth-identifier', (v) => (this.authIdentifier = v));
    bindInputDraft('#auth-username', (v) => (this.authUsername = v));
    bindInputDraft('#auth-email', (v) => (this.authEmail = v));
    bindInputDraft('#auth-password', (v) => (this.authPassword = v));

    const authForm = this.uiLayer.querySelector<HTMLFormElement>('#ak-auth-form');
    authForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.authBusy) return;
      this.audio.unlock();
      this.audio.playSfx('ui');
      this.authBusy = true;
      this.authErrorMsg = null;
      this.render();

      const action =
        this.authTab === 'register'
          ? this.net.register(this.authUsername, this.authEmail, this.authPassword)
          : this.net.login(this.authIdentifier, this.authPassword);

      void action
        .then((user) => {
          this.authBusy = false;
          this.authPassword = '';
          this.showAuthModal = false;
          this.showToast(`Bem-vindo, ${user.username}! (${user.friendCode})`);
          this.render();
        })
        .catch((err: unknown) => {
          this.authBusy = false;
          this.authErrorMsg =
            err instanceof Error ? err.message : 'Erro ao autenticar.';
          this.render();
        });
    });

    // Amigos: input & ações
    const friendInput = this.uiLayer.querySelector<HTMLInputElement>('#input-friend-query');
    friendInput?.addEventListener('input', () => {
      this.friendQuery = friendInput.value;
    });
    click('btn-send-friend-req', () => {
      const q = this.friendQuery.trim();
      if (!q) {
        this.friendFeedback = { kind: 'err', text: 'Digite uma Tag ou nome de usuário.' };
        this.render();
        return;
      }
      void this.net
        .sendFriendRequest(q)
        .then((res) => {
          this.friendQuery = '';
          this.friendFeedback = {
            kind: 'ok',
            text:
              res.message ??
              (res.status === 'accepted'
                ? 'Amizade confirmada!'
                : 'Solicitação de amizade enviada!'),
          };
          this.render();
        })
        .catch((err: unknown) => {
          this.friendFeedback = {
            kind: 'err',
            text: err instanceof Error ? err.message : 'Erro ao enviar pedido.',
          };
          this.render();
        });
    });

    this.uiLayer.querySelectorAll<HTMLElement>('[data-accept-req]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.acceptReq!;
        this.audio.playSfx('ui');
        void this.net.respondFriendRequest(id, true).then(() => {
          this.friendFeedback = { kind: 'ok', text: 'Amigo adicionado!' };
          this.render();
        });
      });
    });

    this.uiLayer.querySelectorAll<HTMLElement>('[data-reject-req]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.rejectReq!;
        this.audio.playSfx('ui');
        void this.net.respondFriendRequest(id, false).then(() => this.render());
      });
    });

    this.uiLayer.querySelectorAll<HTMLElement>('[data-remove-friend]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.removeFriend!;
        this.audio.playSfx('ui');
        void this.net.removeFriend(id).then(() => this.render());
      });
    });

    this.uiLayer.querySelectorAll<HTMLElement>('[data-invite-friend]').forEach((el) => {
      el.addEventListener('click', () => {
        const toUserId = el.dataset.inviteFriend!;
        this.audio.playSfx('ui');
        const currentRoom = this.net.getCurrentRoom();
        if (currentRoom && currentRoom.status === 'lobby') {
          this.showFriendsModal = false;
          this.net.inviteFriendToRoom(toUserId);
          this.render();
        } else {
          const prog = this.save.getCharacterProgress(this.selectedP1);
          this.pendingAutoInviteUserId = toUserId;
          this.net.createRoom({
            roomMode: this.createRoomMode,
            teamSize: this.createRoomMode === 'rumble' ? this.createTeamSize : 1,
            p2Mode: 'human',
            isPublic: this.createRoomPublic,
            mapTheme: this.createMapTheme,
            charId: this.selectedP1,
            startPhase: Math.min(this.selectedStartPhase, prog.unlockedPhase),
            level: prog.level,
          });
        }
      });
    });

    this.uiLayer.querySelectorAll<HTMLElement>('[data-join-friend-room]').forEach((el) => {
      el.addEventListener('click', () => {
        const code = el.dataset.joinFriendRoom!;
        const prog = this.save.getCharacterProgress(this.selectedP1);
        this.audio.playSfx('ui');
        this.showFriendsModal = false;
        this.net.joinRoom(code, {
          charId: this.selectedP1,
          startPhase: Math.min(this.selectedStartPhase, prog.unlockedPhase),
          level: prog.level,
        });
      });
    });

    // Convites recebidos (Toast interativo)
    this.uiLayer.querySelectorAll<HTMLElement>('[data-accept-invite]').forEach((el) => {
      el.addEventListener('click', () => {
        const code = el.dataset.acceptInvite!;
        const prog = this.save.getCharacterProgress(this.selectedP1);
        this.audio.unlock();
        this.audio.playSfx('ui');
        this.pendingInvites = this.pendingInvites.filter((i) => i.roomCode !== code);
        this.showFriendsModal = false;
        this.net.joinRoom(code, {
          charId: this.selectedP1,
          startPhase: Math.min(this.selectedStartPhase, prog.unlockedPhase),
          level: prog.level,
        });
      });
    });

    this.uiLayer.querySelectorAll<HTMLElement>('[data-dismiss-invite]').forEach((el) => {
      el.addEventListener('click', () => {
        const code = el.dataset.dismissInvite!;
        this.audio.playSfx('ui');
        this.pendingInvites = this.pendingInvites.filter((i) => i.roomCode !== code);
        this.render();
      });
    });

    // Seleção de slot P1 / CPU (Modo Solo)
    this.uiLayer.querySelectorAll<HTMLElement>('[data-slot]').forEach((el) => {
      el.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playSfx('ui');
        this.selectingSlot = el.dataset.slot as 'p1' | 'p2';
        this.render();
      });
    });

    // Seleção de personagem (Modo Solo)
    this.uiLayer.querySelectorAll<HTMLElement>('[data-pick-char]').forEach((el) => {
      el.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playSfx('ui');
        const cid = el.dataset.pickChar!;
        if (this.selectingSlot === 'p1') {
          this.selectedP1 = cid;
        } else {
          this.selectedP2 = cid;
        }
        this.render();
      });
    });

    // Fase inicial (Modo Solo)
    this.uiLayer.querySelectorAll<HTMLElement>('[data-pick-phase]').forEach((el) => {
      el.addEventListener('click', () => {
        const ph = Number(el.dataset.pickPhase);
        this.audio.unlock();
        this.audio.playSfx('ui');
        this.selectedStartPhase = ph;
        this.render();
      });
    });

    // Cenário / plano de fundo (Modo Solo)
    this.uiLayer.querySelectorAll<HTMLElement>('[data-pick-theme]').forEach((el) => {
      el.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playSfx('ui');
        this.selectedMapTheme = el.dataset.pickTheme || 'random';
        this.render();
      });
    });

    // Dificuldade (Modo Solo)
    this.uiLayer.querySelectorAll<HTMLElement>('[data-diff]').forEach((el) => {
      el.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playSfx('ui');
        this.save.updateSettings({
          difficulty: el.dataset.diff as AIDifficulty,
        });
        this.render();
      });
    });

    // Controles de configurações
    const bindRange = (id: string, cb: (val: number) => void) => {
      const input = this.uiLayer.querySelector<HTMLInputElement>(`#${id}`);
      input?.addEventListener('input', () => {
        cb(parseFloat(input.value));
        this.callbacks.onSettingsChanged();
      });
    };

    bindRange('set-opacity', (v) => this.save.updateSettings({ controlsOpacity: v }));
    bindRange('set-scale', (v) => this.save.updateSettings({ controlsScale: v }));
    bindRange('set-deadzone', (v) => this.save.updateSettings({ stickDeadzone: v }));
    bindRange('set-gp-deadzone', (v) => {
      this.save.updateSettings({ gamepadDeadzone: v });
      const valEl = this.uiLayer.querySelector('#set-gp-deadzone-val');
      if (valEl) valEl.textContent = `${Math.round(v * 100)}%`;
    });
    bindRange('set-bgm-vol', (v) => this.save.updateSettings({ bgmVolume: v }));
    bindRange('set-sfx-vol', (v) => this.save.updateSettings({ sfxVolume: v }));

    this.uiLayer.querySelectorAll<HTMLElement>('[data-pace]').forEach((el) => {
      el.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playSfx('ui');
        const pace = (el.dataset.pace as CombatPace) || 'tactical';
        this.save.updateSettings({ combatPace: pace });
        this.callbacks.onSettingsChanged();
        this.render();
      });
    });

    this.uiLayer.querySelectorAll<HTMLElement>('[data-help-tab]').forEach((el) => {
      el.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.playSfx('ui');
        this.cancelCapture();
        this.helpTab =
          (el.dataset.helpTab as 'keyboard' | 'gamepad' | 'touch' | 'combat') ||
          'keyboard';
        this.render();
      });
    });

    this.uiLayer.querySelectorAll<HTMLElement>('[data-remap-kb]').forEach((el) => {
      el.addEventListener('click', () => {
        const action = el.dataset.remapKb as BindableAction;
        if (!action) return;
        this.audio.unlock();
        this.audio.playSfx('ui');
        if (
          this.capturingAction?.device === 'keyboard' &&
          this.capturingAction.action === action
        ) {
          this.cancelCapture();
          this.render();
          return;
        }
        this.cancelCapture();
        this.capturingAction = { device: 'keyboard', action };
        this.input.startKeyCapture((code) => {
          this.capturingAction = null;
          if (code) {
            this.remapKeyboardAction(action, code);
          }
          this.render();
        });
        this.render();
      });
    });

    this.uiLayer.querySelectorAll<HTMLElement>('[data-remap-gp]').forEach((el) => {
      el.addEventListener('click', () => {
        const action = el.dataset.remapGp as BindableAction;
        if (!action) return;
        this.audio.unlock();
        this.audio.playSfx('ui');
        if (
          this.capturingAction?.device === 'gamepad' &&
          this.capturingAction.action === action
        ) {
          this.cancelCapture();
          this.render();
          return;
        }
        this.cancelCapture();
        this.capturingAction = { device: 'gamepad', action };
        this.input.startGamepadCapture((btnIndex) => {
          this.capturingAction = null;
          if (btnIndex !== null) {
            this.remapGamepadAction(action, btnIndex);
          }
          this.render();
        });
        this.render();
      });
    });

    click('btn-reset-kb', () => {
      this.cancelCapture();
      this.save.updateSettings({ keyBindings: createDefaultKeyBindings() });
      this.callbacks.onSettingsChanged();
      this.showToast('Teclado restaurado para o padrão!');
      this.render();
    });

    click('btn-reset-gp', () => {
      this.cancelCapture();
      this.save.updateSettings({
        gamepadBindings: createDefaultGamepadBindings(),
        gamepadDeadzone: 0.26,
      });
      this.callbacks.onSettingsChanged();
      this.showToast('Controle restaurado para o padrão!');
      this.render();
    });

    click('set-jump-stick', () => {
      const cur = this.save.getData().settings.jumpViaStick;
      this.save.updateSettings({ jumpViaStick: !cur });
      this.callbacks.onSettingsChanged();
      this.render();
    });
    click('set-haptic', () => {
      const cur = this.save.getData().settings.hapticFeedback;
      this.save.updateSettings({ hapticFeedback: !cur });
      this.callbacks.onSettingsChanged();
      this.render();
    });
    click('set-bgm-mute', () => {
      const cur = this.save.getData().settings.bgmMuted;
      this.save.updateSettings({ bgmMuted: !cur });
      this.callbacks.onSettingsChanged();
      this.render();
    });
    click('set-sfx-mute', () => {
      const cur = this.save.getData().settings.sfxMuted;
      this.save.updateSettings({ sfxMuted: !cur });
      this.callbacks.onSettingsChanged();
      this.render();
    });
  }
}
