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

export class InputManager {
  // Estado contínuo de teclado
  private keysDown = new Set<string>();

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
  private jumpViaStickEnabled = true;
  private stickDeadzone = 0.22;

  private touchModeActive = false;
  private onInputModeChange?: (isTouch: boolean) => void;
  private onFirstGesture?: () => void;
  private firstGestureDone = false;

  constructor() {
    this.touchModeActive =
      'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.resetAll);
    window.addEventListener('pointerdown', this.handleAnyPointerDown, { passive: true });
  }

  public setOnInputModeChange(cb: (isTouch: boolean) => void): void {
    this.onInputModeChange = cb;
  }

  public setOnFirstGesture(cb: () => void): void {
    this.onFirstGesture = cb;
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

  public setTouchAxis(x: number, y: number): void {
    const mag = Math.hypot(x, y);
    if (mag < this.stickDeadzone) {
      this.touchAxisX = 0;
      this.touchAxisY = 0;
    } else {
      this.touchAxisX = Math.max(-1, Math.min(1, x));
      this.touchAxisY = Math.max(-1, Math.min(1, y));
    }
    this.activateTouchMode();
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
  };

  public sample(): FighterInputState {
    // Combina entrada touch + fallback teclado
    let kx = 0;
    let ky = 0;
    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) kx -= 1;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) kx += 1;
    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) ky -= 1;
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) ky += 1;

    const moveX = Math.abs(this.touchAxisX) > 0.01 ? this.touchAxisX : kx;
    const moveY = Math.abs(this.touchAxisY) > 0.01 ? this.touchAxisY : ky;

    const left = moveX < -0.3;
    const right = moveX > 0.3;
    const up = moveY < -0.45;
    const down = moveY > 0.45;

    const a1 = this.isPressed('a1', ['KeyJ', 'KeyZ']);
    const a2 = this.isPressed('a2', ['KeyK', 'KeyX']);
    const a3 = this.isPressed('a3', ['KeyL', 'KeyC']);
    const a4 = this.isPressed('a4', ['KeyU', 'KeyV']);
    const block = this.isPressed('block', ['KeyI', 'ShiftLeft', 'ShiftRight']);
    const rawJump = this.isPressed('jump', ['Space']) || (this.jumpViaStickEnabled && up);
    const evolve = this.isPressed('evolve', ['KeyE', 'KeyR']);

    const justA1 = a1 && !this.prevState.a1;
    const justA2 = a2 && !this.prevState.a2;
    const justA3 = a3 && !this.prevState.a3;
    const justA4 = a4 && !this.prevState.a4;
    const justEvolve = evolve && !this.prevState.evolve;

    const jumpBtnPressed = this.isPressed('jump', ['Space']);
    const justStickUp = this.jumpViaStickEnabled && up && !this.prevUp;
    const justJump = (jumpBtnPressed && !this.prevState.jump) || justStickUp;

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
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.resetAll);
    window.removeEventListener('pointerdown', this.handleAnyPointerDown);
  }

  private isPressed(action: InputAction, keyCodes: string[]): boolean {
    if (this.touchActions.get(action)) return true;
    return keyCodes.some((code) => this.keysDown.has(code));
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

  private handleAnyPointerDown = (e: PointerEvent): void => {
    this.notifyFirstGesture();
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      this.activateTouchMode();
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.notifyFirstGesture();
    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)
    ) {
      e.preventDefault();
    }
    this.keysDown.add(e.code);

    // Oculta controles virtuais automaticamente ao detectar uso exclusivo de teclado
    if (this.touchModeActive && !this.hasActiveTouchInputs()) {
      this.touchModeActive = false;
      this.onInputModeChange?.(false);
    }
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
