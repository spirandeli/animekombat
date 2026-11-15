import {
  BindableAction,
  GamepadBindings,
  KeyBindings,
  createDefaultGamepadBindings,
  createDefaultKeyBindings,
} from '../storage/SaveManager';

export type InputAction =
  | 'a1'
  | 'a2'
  | 'a3'
  | 'a4'
  | 'block'
  | 'jump'
  | 'evolve';

export interface FighterInputState {
  moveX: number; // -1..1
  moveY: number; // -1 (up)..1 (down)
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  a1: boolean;
  a2: boolean;
  a3: boolean;
  a4: boolean;
  block: boolean;
  jump: boolean;
  evolve: boolean;
  justA1: boolean;
  justA2: boolean;
  justA3: boolean;
  justA4: boolean;
  justJump: boolean;
  justEvolve: boolean;
}

export interface ConnectedGamepadInfo {
  connected: boolean;
  name: string;
  index: number | null;
}

export const BINDABLE_ACTION_LABELS: Record<BindableAction, string> = {
  left: 'Mover Esquerda',
  right: 'Mover Direita',
  up: 'Mirar Cima / Pulo (Opcional)',
  down: 'Agachar / Mirar Baixo',
  a1: 'Golpe 1 (Rápido)',
  a2: 'Golpe 2 (Pesado)',
  a3: 'Golpe 3 (Projétil / Especial)',
  a4: 'Golpe 4 (Ultimate)',
  block: 'Defesa (Guarda)',
  jump: 'Pular',
  evolve: 'Evoluir Fase',
  pause: 'Pausar / Menu',
};

const GAMEPAD_BUTTON_LABELS: Record<number, string> = {
  0: 'A / ✕',
  1: 'B / ○',
  2: 'X / □',
  3: 'Y / △',
  4: 'LB / L1',
  5: 'RB / R1',
  6: 'LT / L2',
  7: 'RT / R2',
  8: 'Back / Share',
  9: 'Start / Options',
  10: 'L3 (Analógico Esq.)',
  11: 'R3 (Analógico Dir.)',
  12: 'D-Pad Cima',
  13: 'D-Pad Baixo',
  14: 'D-Pad Esquerda',
  15: 'D-Pad Direita',
  16: 'Botão Home',
};

export function formatKeyCode(code: string | undefined): string {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  switch (code) {
    case 'ArrowLeft':
      return '←';
    case 'ArrowRight':
      return '→';
    case 'ArrowUp':
      return '↑';
    case 'ArrowDown':
      return '↓';
    case 'Space':
      return 'Espaço';
    case 'ShiftLeft':
      return 'Shift Esq.';
    case 'ShiftRight':
      return 'Shift Dir.';
    case 'ControlLeft':
      return 'Ctrl Esq.';
    case 'ControlRight':
      return 'Ctrl Dir.';
    case 'AltLeft':
      return 'Alt Esq.';
    case 'AltRight':
      return 'Alt Dir.';
    case 'Escape':
      return 'Esc';
    case 'Enter':
      return 'Enter';
    case 'Backspace':
      return 'Backspace';
    case 'Tab':
      return 'Tab';
    default:
      return code;
  }
}

export function formatGamepadButton(idx: number | undefined): string {
  if (typeof idx !== 'number' || idx < 0) return '—';
  return GAMEPAD_BUTTON_LABELS[idx] ?? `Botão ${idx}`;
}

export class InputManager {
  // Estado contínuo de teclado
  private keysDown = new Set<string>();

  // Mapeamentos dinâmicos configuráveis
  private keyBindings: KeyBindings = createDefaultKeyBindings();
  private gamepadBindings: GamepadBindings = createDefaultGamepadBindings();

  // Estado contínuo de touch/joystick
  private touchAxisX = 0;
  private touchAxisY = 0;
  private touchActions = new Map<InputAction, boolean>();

  // Controle de borda (justPressed) para evitar duplo disparo
  private prevState: Record<InputAction, boolean> = {
    a1: false,
    a2: false,
    a3: false,
    a4: false,
    block: false,
    jump: false,
    evolve: false,
  };

  private prevUp = false;
  private prevPause = false;
  private pauseRequested = false;

  private jumpViaStickEnabled = true;
  private stickDeadzone = 0.22;
  private gamepadDeadzone = 0.26;

  private touchModeActive = false;
  private onInputModeChange?: (isTouch: boolean) => void;
  private onFirstGesture?: () => void;
  private firstGestureDone = false;

  // Gamepad API
  private preferredGamepadIndex: number | null = null;
  private gamepadInfo: ConnectedGamepadInfo = {
    connected: false,
    name: '',
    index: null,
  };
  private onGamepadChange?: (info: ConnectedGamepadInfo) => void;

  // Modo captura de tecla ou botão de controle (para remapeamento)
  private keyCaptureCb: ((code: string | null) => void) | null = null;
  private gamepadCaptureCb: ((btnIdx: number | null) => void) | null = null;
  private gamepadCaptureBaseline = new Set<number>();
  private gamepadCaptureRaf: number | null = null;

  constructor() {
    this.touchModeActive =
      'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.resetAll);
    window.addEventListener('focus', this.resetAll);
    window.addEventListener('contextmenu', this.resetAll);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('pointerdown', this.handleAnyPointerDown, {
      passive: true,
    });
    window.addEventListener('gamepadconnected', this.handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
    this.refreshGamepadStatus();
  }

  public setOnInputModeChange(cb: (isTouch: boolean) => void): void {
    this.onInputModeChange = cb;
  }

  public setOnFirstGesture(cb: () => void): void {
    this.onFirstGesture = cb;
  }

  public setOnGamepadChange(cb: (info: ConnectedGamepadInfo) => void): void {
    this.onGamepadChange = cb;
  }

  public getConnectedGamepad(): ConnectedGamepadInfo {
    this.refreshGamepadStatus();
    return { ...this.gamepadInfo };
  }

  public setKeyBindings(bindings: KeyBindings): void {
    const next = createDefaultKeyBindings();
    for (const action of Object.keys(next) as BindableAction[]) {
      const list = bindings[action];
      if (Array.isArray(list) && list.length > 0) {
        next[action] = [...list];
      }
    }
    this.keyBindings = next;
    this.resetAll();
  }

  public getKeyBindings(): KeyBindings {
    const copy = createDefaultKeyBindings();
    for (const action of Object.keys(copy) as BindableAction[]) {
      copy[action] = [...this.keyBindings[action]];
    }
    return copy;
  }

  public setGamepadBindings(bindings: GamepadBindings): void {
    const next = createDefaultGamepadBindings();
    for (const action of Object.keys(next) as BindableAction[]) {
      const list = bindings[action];
      if (Array.isArray(list) && list.length > 0) {
        next[action] = [...list];
      }
    }
    this.gamepadBindings = next;
  }

  public getGamepadBindings(): GamepadBindings {
    const copy = createDefaultGamepadBindings();
    for (const action of Object.keys(copy) as BindableAction[]) {
      copy[action] = [...this.gamepadBindings[action]];
    }
    return copy;
  }

  public isTouchMode(): boolean {
    return this.touchModeActive;
  }

  public setJumpViaStick(enabled: boolean): void {
    this.jumpViaStickEnabled = enabled;
  }

  public setStickDeadzone(dz: number): void {
    this.stickDeadzone = Math.max(0.08, Math.min(0.45, dz));
  }

  public getStickDeadzone(): number {
    return this.stickDeadzone;
  }

  public setGamepadDeadzone(dz: number): void {
    this.gamepadDeadzone = Math.max(0.12, Math.min(0.5, dz));
  }

  public getGamepadDeadzone(): number {
    return this.gamepadDeadzone;
  }

  public isCapturing(): boolean {
    return this.keyCaptureCb !== null || this.gamepadCaptureCb !== null;
  }

  public startKeyCapture(cb: (code: string | null) => void): void {
    this.cancelCapture();
    this.resetAll();
    this.keyCaptureCb = cb;
  }

  public startGamepadCapture(cb: (btnIdx: number | null) => void): void {
    this.cancelCapture();
    this.resetAll();
    this.gamepadCaptureCb = cb;
    this.gamepadCaptureBaseline.clear();
    const gp = this.getActiveGamepad();
    if (gp) {
      gp.buttons.forEach((btn, idx) => {
        if (btn && (btn.pressed || btn.value > 0.45)) {
          this.gamepadCaptureBaseline.add(idx);
        }
      });
    }

    const poll = () => {
      if (!this.gamepadCaptureCb) return;
      const active = this.getActiveGamepad();
      if (active) {
        for (let i = 0; i < active.buttons.length; i++) {
          const btn = active.buttons[i];
          const held = Boolean(btn && (btn.pressed || btn.value > 0.45));
          if (held && !this.gamepadCaptureBaseline.has(i)) {
            const done = this.gamepadCaptureCb;
            this.gamepadCaptureCb = null;
            this.gamepadCaptureRaf = null;
            this.resetAll();
            done(i);
            return;
          }
          if (!held && this.gamepadCaptureBaseline.has(i)) {
            this.gamepadCaptureBaseline.delete(i);
          }
        }
      }
      this.gamepadCaptureRaf = requestAnimationFrame(poll);
    };
    this.gamepadCaptureRaf = requestAnimationFrame(poll);
  }

  public cancelCapture(): void {
    if (this.gamepadCaptureRaf !== null) {
      cancelAnimationFrame(this.gamepadCaptureRaf);
      this.gamepadCaptureRaf = null;
    }
    this.keyCaptureCb = null;
    this.gamepadCaptureCb = null;
    this.gamepadCaptureBaseline.clear();
  }

  public matchesPauseKey(code: string): boolean {
    if (code === 'Escape') return true;
    return this.keyBindings.pause.includes(code);
  }

  public pollGamepadPauseEdge(): boolean {
    if (this.isCapturing()) return false;
    const gp = this.getActiveGamepad();
    const gpPause = gp ? this.isGamepadActionDown(gp, 'pause') : false;
    const kbPause = this.isKeyActionDown('pause');
    const down = gpPause || kbPause;
    const triggered = down && !this.prevPause;
    this.prevPause = down;
    return triggered;
  }

  public consumePauseRequested(): boolean {
    if (!this.pauseRequested) return false;
    this.pauseRequested = false;
    return true;
  }

  public setTouchAxis(x: number, y: number): void {
    const mag = Math.hypot(x, y);
    if (mag < this.stickDeadzone) {
      this.touchAxisX = 0;
      this.touchAxisY = 0;
    } else {
      this.touchAxisX = Math.max(-1, Math.min(1, x));
      this.touchAxisY = Math.max(-1, Math.min(1, y));
    }
    if (mag >= this.stickDeadzone) {
      this.activateTouchMode();
    }
  }

  public setTouchAction(action: InputAction, pressed: boolean): void {
    this.touchActions.set(action, pressed);
    if (pressed) {
      this.activateTouchMode();
    }
  }

  public resetAll = (): void => {
    this.keysDown.clear();
    this.touchAxisX = 0;
    this.touchAxisY = 0;
    this.touchActions.clear();
    this.prevUp = false;
    this.pauseRequested = false;
    for (const k of Object.keys(this.prevState) as InputAction[]) {
      this.prevState[k] = false;
    }
  };

  public sample(): FighterInputState {
    if (this.isCapturing()) {
      return this.emptySample();
    }

    // Teclado remapeável
    let kx = 0;
    let ky = 0;
    if (this.isKeyActionDown('left')) kx -= 1;
    if (this.isKeyActionDown('right')) kx += 1;
    if (this.isKeyActionDown('up')) ky -= 1;
    if (this.isKeyActionDown('down')) ky += 1;

    // Controle físico (Gamepad API com zona morta anti-drift)
    let gx = 0;
    let gy = 0;
    const gp = this.getActiveGamepad();
    if (gp) {
      const rawAx = gp.axes[0] ?? 0;
      const rawAy = gp.axes[1] ?? 0;
      const mag = Math.hypot(rawAx, rawAy);
      if (mag > this.gamepadDeadzone) {
        const scaled = Math.min(
          1,
          (mag - this.gamepadDeadzone) / Math.max(0.01, 1 - this.gamepadDeadzone)
        );
        const nx = (rawAx / mag) * scaled;
        const ny = (rawAy / mag) * scaled;
        // Limiar leve por eixo evita inclinação acidental de cima/baixo ao correr lateralmente
        gx = Math.abs(nx) > 0.14 ? nx : 0;
        gy = Math.abs(ny) > 0.22 ? ny : 0;
      }

      if (this.isGamepadActionDown(gp, 'left')) gx = -1;
      if (this.isGamepadActionDown(gp, 'right')) gx = 1;
      if (this.isGamepadActionDown(gp, 'up')) gy = -1;
      if (this.isGamepadActionDown(gp, 'down')) gy = 1;

      if (
        Math.abs(gx) > 0 ||
        Math.abs(gy) > 0 ||
        gp.buttons.some((b) => Boolean(b && (b.pressed || b.value > 0.45)))
      ) {
        this.notifyFirstGesture();
        this.deactivateTouchModeIfIdle();
      }
    }

    // Detecção de pausa via Gamepad Start ou tecla de pausa configurada
    const gpPauseDown = gp ? this.isGamepadActionDown(gp, 'pause') : false;
    const kbPauseDown = this.isKeyActionDown('pause');
    const pauseDown = gpPauseDown || kbPauseDown;
    if (pauseDown && !this.prevPause) {
      this.pauseRequested = true;
      this.keysDown.clear();
    }
    this.prevPause = pauseDown;

    // Prioridade: touch ativo > teclado intencional > gamepad (evita drift de controle bloquear teclado)
    const moveX =
      Math.abs(this.touchAxisX) > this.stickDeadzone
        ? this.touchAxisX
        : Math.abs(kx) > 0.01
          ? kx
          : Math.abs(gx) > 0.01
            ? gx
            : 0;
    const moveY =
      Math.abs(this.touchAxisY) > this.stickDeadzone
        ? this.touchAxisY
        : Math.abs(ky) > 0.01
          ? ky
          : Math.abs(gy) > 0.01
            ? gy
            : 0;

    const left = moveX < -0.3;
    const right = moveX > 0.3;
    const up = moveY < -0.5;
    const down = moveY > 0.5;

    const a1 = this.isActionPressed('a1', gp);
    const a2 = this.isActionPressed('a2', gp);
    const a3 = this.isActionPressed('a3', gp);
    const a4 = this.isActionPressed('a4', gp);
    const block = this.isActionPressed('block', gp);
    const jumpBtnPressed = this.isActionPressed('jump', gp);
    const evolve = this.isActionPressed('evolve', gp);

    const stickJumpJust =
      this.jumpViaStickEnabled &&
      up &&
      !this.prevUp &&
      Math.abs(moveX) < 0.78 &&
      !a1 &&
      !a2 &&
      !a3 &&
      !a4;

    const justA1 = a1 && !this.prevState.a1;
    const justA2 = a2 && !this.prevState.a2;
    const justA3 = a3 && !this.prevState.a3;
    const justA4 = a4 && !this.prevState.a4;
    const justJump =
      (jumpBtnPressed && !this.prevState.jump) || stickJumpJust;
    const justEvolve = evolve && !this.prevState.evolve;

    const rawJump =
      jumpBtnPressed || (this.jumpViaStickEnabled && up && Math.abs(moveX) < 0.78);

    this.prevState.a1 = a1;
    this.prevState.a2 = a2;
    this.prevState.a3 = a3;
    this.prevState.a4 = a4;
    this.prevState.block = block;
    this.prevState.jump = jumpBtnPressed;
    this.prevState.evolve = evolve;
    this.prevUp = up;

    return {
      moveX,
      moveY,
      left,
      right,
      up,
      down,
      a1,
      a2,
      a3,
      a4,
      block,
      jump: rawJump,
      evolve,
      justA1,
      justA2,
      justA3,
      justA4,
      justJump,
      justEvolve,
    };
  }

  public destroy(): void {
    this.cancelCapture();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.resetAll);
    window.removeEventListener('focus', this.resetAll);
    window.removeEventListener('contextmenu', this.resetAll);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('pointerdown', this.handleAnyPointerDown);
    window.removeEventListener('gamepadconnected', this.handleGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
  }

  private emptySample(): FighterInputState {
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

  private isKeyActionDown(action: BindableAction): boolean {
    const codes = this.keyBindings[action];
    if (!codes) return false;
    return codes.some((code) => Boolean(code) && this.keysDown.has(code));
  }

  private isGamepadActionDown(gp: Gamepad, action: BindableAction): boolean {
    const indices = this.gamepadBindings[action];
    if (!indices) return false;
    for (const idx of indices) {
      const btn = gp.buttons[idx];
      if (btn && (btn.pressed || btn.value > 0.45)) return true;
    }
    return false;
  }

  private isActionPressed(action: InputAction, gp: Gamepad | null): boolean {
    if (this.touchActions.get(action)) return true;
    if (this.isKeyActionDown(action)) return true;
    if (gp && this.isGamepadActionDown(gp, action)) return true;
    return false;
  }

  private getActiveGamepad(): Gamepad | null {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return null;
    }
    const pads = navigator.getGamepads();
    if (!pads) return null;
    if (this.preferredGamepadIndex !== null) {
      const pref = pads[this.preferredGamepadIndex];
      if (pref && pref.connected) return pref;
    }
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (p && p.connected) {
        this.preferredGamepadIndex = p.index;
        return p;
      }
    }
    return null;
  }

  private refreshGamepadStatus(): void {
    const gp = this.getActiveGamepad();
    const next: ConnectedGamepadInfo = gp
      ? { connected: true, name: gp.id || 'Controle Conectado', index: gp.index }
      : { connected: false, name: '', index: null };
    const changed =
      next.connected !== this.gamepadInfo.connected ||
      next.name !== this.gamepadInfo.name ||
      next.index !== this.gamepadInfo.index;
    this.gamepadInfo = next;
    if (changed) {
      this.onGamepadChange?.({ ...this.gamepadInfo });
    }
  }

  private handleGamepadConnected = (e: GamepadEvent): void => {
    this.preferredGamepadIndex = e.gamepad.index;
    this.refreshGamepadStatus();
    this.notifyFirstGesture();
  };

  private handleGamepadDisconnected = (e: GamepadEvent): void => {
    if (this.preferredGamepadIndex === e.gamepad.index) {
      this.preferredGamepadIndex = null;
    }
    this.resetAll();
    this.refreshGamepadStatus();
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.resetAll();
    }
  };

  private isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      target.isContentEditable
    );
  }

  private notifyFirstGesture(): void {
    if (!this.firstGestureDone) {
      this.firstGestureDone = true;
      this.onFirstGesture?.();
    }
  }

  private activateTouchMode(): void {
    if (!this.touchModeActive) {
      this.touchModeActive = true;
      this.onInputModeChange?.(true);
    }
  }

  private deactivateTouchModeIfIdle(): void {
    if (this.touchModeActive && !this.hasActiveTouchInputs()) {
      this.touchModeActive = false;
      this.onInputModeChange?.(false);
    }
  }

  private handleAnyPointerDown = (e: PointerEvent): void => {
    this.notifyFirstGesture();
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      this.activateTouchMode();
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.notifyFirstGesture();

    if (this.keyCaptureCb) {
      e.preventDefault();
      e.stopPropagation();
      const cb = this.keyCaptureCb;
      this.keyCaptureCb = null;
      this.resetAll();
      cb(e.code === 'Escape' ? null : e.code);
      return;
    }

    if (this.gamepadCaptureCb && e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      const cb = this.gamepadCaptureCb;
      this.cancelCapture();
      cb(null);
      return;
    }

    if (this.isEditableTarget(e.target)) {
      return;
    }

    // Atalhos de sistema (Alt/Meta) costumam engolir o keyup; limpa teclas para evitar ghost walking
    if (e.metaKey || (e.altKey && !e.getModifierState?.('AltGraph'))) {
      this.keysDown.clear();
      return;
    }

    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)
    ) {
      e.preventDefault();
    }

    this.keysDown.add(e.code);
    this.deactivateTouchModeIfIdle();
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.code);
  };

  private hasActiveTouchInputs(): boolean {
    if (Math.abs(this.touchAxisX) > 0 || Math.abs(this.touchAxisY) > 0) return true;
    for (const v of this.touchActions.values()) {
      if (v) return true;
    }
    return false;
  }
}
