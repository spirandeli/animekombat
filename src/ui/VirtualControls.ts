import { InputAction, InputManager } from '../engine/InputManager';

export interface ButtonVisualState {
  cooldownRatio: number; // 0 = pronto, 1 = recarregando
  hasEnoughKi: boolean;
  isUltReady: boolean;
  canEvolve: boolean;
  moveNames: Record<'a1' | 'a2' | 'a3' | 'a4', string>;
}

export class VirtualControls {
  private readonly rootEl: HTMLElement;
  private readonly input: InputManager;

  private stickBaseEl!: HTMLElement;
  private stickKnobEl!: HTMLElement;
  private stickPointerId: number | null = null;
  private stickRect: DOMRect | null = null;

  private buttonEls = new Map<InputAction, HTMLElement>();
  private cooldownEls = new Map<InputAction, HTMLElement>();
  private subtitleEls = new Map<'a1' | 'a2' | 'a3' | 'a4', HTMLElement>();
  private buttonPointers = new Map<number, InputAction>();

  private hapticEnabled = true;
  private visible = false;

  constructor(input: InputManager) {
    const el = document.getElementById('virtual-controls');
    if (!el) throw new Error('Elemento #virtual-controls não encontrado.');
    this.rootEl = el;
    this.input = input;

    this.render();
    this.bindPointerEvents();
  }

  public setVisible(show: boolean): void {
    this.visible = show;
    const shouldShow = show && this.input.isTouchMode();
    if (!shouldShow) {
      this.resetTouchState();
    }
    this.rootEl.classList.toggle('hidden', !shouldShow);
    this.rootEl.setAttribute('aria-hidden', String(!shouldShow));
  }

  public syncInputMode(isTouch: boolean): void {
    const shouldShow = this.visible && isTouch;
    if (!shouldShow) {
      this.resetTouchState();
    }
    this.rootEl.classList.toggle('hidden', !shouldShow);
    this.rootEl.setAttribute('aria-hidden', String(!shouldShow));
  }

  public resetTouchState(): void {
    this.stickPointerId = null;
    this.stickRect = null;
    if (this.stickKnobEl) {
      this.stickKnobEl.style.transform = 'translate(0px, 0px)';
    }
    this.buttonPointers.clear();
    this.buttonEls.forEach((btn, action) => {
      btn.classList.remove('pressed');
      this.input.setTouchAction(action, false);
    });
    this.input.setTouchAxis(0, 0);
  }

  public setAppearance(opacity: number, scale: number, haptic: boolean): void {
    document.documentElement.style.setProperty(
      '--controls-opacity',
      String(Math.max(0.3, Math.min(1, opacity)))
    );
    document.documentElement.style.setProperty(
      '--controls-scale',
      String(Math.max(0.75, Math.min(1.25, scale)))
    );
    this.hapticEnabled = haptic;
  }

  public vibrate(pattern: number | number[]): void {
    if (!this.hapticEnabled) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignora caso bloqueado antes de gesto ou não suportado
      }
    }
  }

  public updateVisualState(
    cooldowns: Record<'a1' | 'a2' | 'a3' | 'a4', number>,
    hasKi: Record<'a1' | 'a2' | 'a3' | 'a4', boolean>,
    canEvolve: boolean,
    moveNames: Record<'a1' | 'a2' | 'a3' | 'a4', string>,
    globalCooldownRatio = 0,
    dashCooldownRatio = 0,
    canChainCombo = false
  ): void {
    const attackKeys: Array<'a1' | 'a2' | 'a3' | 'a4'> = ['a1', 'a2', 'a3', 'a4'];
    const globalActive = globalCooldownRatio > 0.01;
    for (const k of attackKeys) {
      const btn = this.buttonEls.get(k);
      const cdEl = this.cooldownEls.get(k);
      const subEl = this.subtitleEls.get(k);
      const effectiveCd = Math.max(0, Math.min(1, Math.max(cooldowns[k], globalCooldownRatio)));
      if (btn) {
        btn.classList.toggle('insufficient', !hasKi[k]);
        btn.classList.toggle('global-cooldown', globalActive && cooldowns[k] <= 0.01);
        btn.classList.toggle(
          'combo-link',
          canChainCombo && k !== 'a1' && hasKi[k] && cooldowns[k] <= 0.01
        );
        if (k === 'a4') {
          btn.classList.toggle(
            'ready-ult',
            hasKi.a4 && cooldowns.a4 <= 0.01 && !globalActive
          );
        }
      }
      if (cdEl) {
        cdEl.style.transform = `scaleY(${effectiveCd.toFixed(3)})`;
      }
      if (subEl && subEl.textContent !== moveNames[k]) {
        subEl.textContent = moveNames[k];
      }
    }

    const dashBtn = this.buttonEls.get('dash');
    const dashCdEl = this.cooldownEls.get('dash');
    const dashCd = Math.max(0, Math.min(1, dashCooldownRatio));
    if (dashBtn) {
      dashBtn.classList.toggle('combo-link', canChainCombo && dashCd <= 0.01);
    }
    if (dashCdEl) {
      dashCdEl.style.transform = `scaleY(${dashCd.toFixed(3)})`;
    }

    const evoBtn = this.buttonEls.get('evolve');
    if (evoBtn) {
      evoBtn.classList.toggle('hidden', !canEvolve);
    }
  }

  private render(): void {
    this.rootEl.innerHTML = `
      <div class="ak-pad-left" id="ak-stick-zone">
        <div class="ak-stick-base" id="ak-stick-base">
          <div class="ak-stick-dir-ring"></div>
          <div class="ak-stick-knob" id="ak-stick-knob"></div>
        </div>
      </div>

      <div class="ak-pad-right">
        <button type="button" class="ak-vbtn" data-action="a1">
          <span>A1</span>
          <span class="ak-vbtn-sub" data-sub="a1">Básico</span>
          <span class="ak-vbtn-cd" data-cd="a1" style="transform:scaleY(0)"></span>
        </button>
        <button type="button" class="ak-vbtn" data-action="a2">
          <span>A2</span>
          <span class="ak-vbtn-sub" data-sub="a2">Investida</span>
          <span class="ak-vbtn-cd" data-cd="a2" style="transform:scaleY(0)"></span>
        </button>
        <button type="button" class="ak-vbtn" data-action="a3">
          <span>A3</span>
          <span class="ak-vbtn-sub" data-sub="a3">Projétil</span>
          <span class="ak-vbtn-cd" data-cd="a3" style="transform:scaleY(0)"></span>
        </button>
        <button type="button" class="ak-vbtn" data-action="a4">
          <span>ULT</span>
          <span class="ak-vbtn-sub" data-sub="a4">Especial</span>
          <span class="ak-vbtn-cd" data-cd="a4" style="transform:scaleY(0)"></span>
        </button>
        <button type="button" class="ak-vbtn" data-action="block">
          <span>DEF</span>
          <span class="ak-vbtn-sub">Guarda</span>
        </button>
        <button type="button" class="ak-vbtn" data-action="dash">
          <span>DASH</span>
          <span class="ak-vbtn-sub">Esquiva</span>
          <span class="ak-vbtn-cd" data-cd="dash" style="transform:scaleY(0)"></span>
        </button>
        <button type="button" class="ak-vbtn" data-action="jump">
          <span>PULO</span>
          <span class="ak-vbtn-sub">Salto</span>
        </button>
        <button type="button" class="ak-vbtn hidden" data-action="evolve">
          <span>EVO</span>
          <span class="ak-vbtn-sub">Despertar</span>
        </button>
      </div>
    `;

    this.stickBaseEl = this.rootEl.querySelector('#ak-stick-base')!;
    this.stickKnobEl = this.rootEl.querySelector('#ak-stick-knob')!;

    this.rootEl.querySelectorAll<HTMLElement>('[data-action]').forEach((btn) => {
      const action = btn.dataset.action as InputAction;
      this.buttonEls.set(action, btn);
    });
    this.rootEl.querySelectorAll<HTMLElement>('[data-cd]').forEach((cd) => {
      const action = cd.dataset.cd as InputAction;
      this.cooldownEls.set(action, cd);
    });
    this.rootEl.querySelectorAll<HTMLElement>('[data-sub]').forEach((sub) => {
      const action = sub.dataset.sub as 'a1' | 'a2' | 'a3' | 'a4';
      this.subtitleEls.set(action, sub);
    });
  }

  private bindPointerEvents(): void {
    const stickZone = this.rootEl.querySelector('#ak-stick-zone') as HTMLElement;

    stickZone.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      if (this.stickPointerId !== null) return;
      this.stickPointerId = e.pointerId;
      stickZone.setPointerCapture(e.pointerId);
      this.stickRect = this.stickBaseEl.getBoundingClientRect();
      this.updateStickFromPointer(e.clientX, e.clientY);
    });

    stickZone.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerId !== this.stickPointerId) return;
      e.preventDefault();
      this.updateStickFromPointer(e.clientX, e.clientY);
    });

    const releaseStick = (e: PointerEvent) => {
      if (e.pointerId !== this.stickPointerId) return;
      this.stickPointerId = null;
      this.stickRect = null;
      this.stickKnobEl.style.transform = 'translate(0px, 0px)';
      this.input.setTouchAxis(0, 0);
    };

    stickZone.addEventListener('pointerup', releaseStick);
    stickZone.addEventListener('pointercancel', releaseStick);
    stickZone.addEventListener('lostpointercapture', releaseStick);

    // Botões de ação multi-touch simultâneos
    this.buttonEls.forEach((btn, action) => {
      btn.addEventListener('pointerdown', (e: PointerEvent) => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        this.buttonPointers.set(e.pointerId, action);
        btn.classList.add('pressed');
        this.input.setTouchAction(action, true);
        this.vibrate(12);
      });

      const releaseButton = (e: PointerEvent) => {
        const mapped = this.buttonPointers.get(e.pointerId);
        if (mapped !== action) return;
        this.buttonPointers.delete(e.pointerId);
        btn.classList.remove('pressed');
        this.input.setTouchAction(action, false);
      };

      btn.addEventListener('pointerup', releaseButton);
      btn.addEventListener('pointercancel', releaseButton);
      btn.addEventListener('lostpointercapture', releaseButton);
    });

    window.addEventListener('blur', () => this.resetTouchState());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.resetTouchState();
      }
    });
  }

  private updateStickFromPointer(clientX: number, clientY: number): void {
    const rect = this.stickRect ?? this.stickBaseEl.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const maxRadius = rect.width * 0.36;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius && dist > 0) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    this.stickKnobEl.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;

    // Quantiza suavemente para 8 direções + analógico normalizado
    const nx = dx / Math.max(1, maxRadius);
    const ny = dy / Math.max(1, maxRadius);
    this.input.setTouchAxis(nx, ny);
  }
}
