# 04 — Auditoria de Movimentação e Fluidez

## 1. Controles e Entrada (`InputManager.ts` + `BeatEmUpScene.ts`)

### 1.1 **PROBLEMA CONFIRMADO (P0) — `jumpViaStick` interfere no movimento de profundidade `Z`**
- **Evidência real:**
  - Em [SaveManager.ts](file:///home/spira/animekombat/src/storage/SaveManager.ts#L116), `jumpViaStick` vem ativado por padrão (`true`).
  - Em [InputManager.ts](file:///home/spira/animekombat/src/engine/InputManager.ts#L516-L532), `stickJumpJust` dispara sempre que `up` (`W`, `ArrowUp`, D-Pad ↑ ou analógico ↑) é pressionado com `Math.abs(moveX) < 0.78`.
  - Em [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts#L868-L876), o código consome `input.justJump` para pular.
- **Impacto:** Em um jogo Beat 'em Up 2.5D, **cima (`W` / `ArrowUp` / stick ↑) serve para andar em profundidade (`z`) pela rua**. Com `jumpViaStick = true`, o jogador salta involuntariamente toda vez que tenta subir na rua para alinhar com um inimigo!
- **Correção recomendada:** Expor modo de amostragem sem `stickJumpJust` em `InputManager` (ex.: `sampleBeatEmUp()` ou `setStickJumpOverride(false)` enquanto `BeatEmUpScene` estiver ativa), reservando o salto exclusivamente para o botão `jump` (`Espaço` / `A`).

### 1.2 **PROBLEMA CONFIRMADO (P2) — Duplicação de lógica `doubleTap` entre `InputManager` e `BeatEmUpScene`**
- **Evidência real:**
  - [InputManager.ts](file:///home/spira/animekombat/src/engine/InputManager.ts#L496-L512) detecta duplo toque em `<= 220ms` e dispara `justDash = true`.
  - [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts#L583-L595) mantém um segundo detector (`lastDirTap`, janela `<= 280ms`) usando `input.left` e `input.right`, porém a variável local `isDoubleTapSprint` é reiniciada a cada frame (`let isDoubleTapSprint = false;` na L585) e **nunca é persistida**!
  - Pior: como o duplo toque em `<= 220ms` já dispara `input.justDash` primeiro, o código entra em `p.state = 'dash'` (L879) antes de chegar em `run` (L898), tornando `run` praticamente inalcançável via duplo-toque e funcionando só se o jogador segurar `dash` enquanto anda (`input.dash && len > 0.25`)!

### 1.3 **PROBLEMA CONFIRMADO (P2) — Atraso de resposta por falta de Input Buffer e Animation Cancel em `land` / `pickup`**
- [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts#L661-L667) e [L825-L827](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts#L825-L827): durante `pickup` (`0.28s`) e `land` (`0.12s`), **todas as entradas são descartadas** (`return` antecipado). Ao contrário de `Fighter.ts` (que possui `bufferedAction`), `BeatEmUpScene.ts` não possui *input buffer* para `jump`, `dash` ou `ataque_1` perto do pouso.

---

## 2. Sensação de Movimento e Física 2.5D

| Aspecto | Implementação Atual | Diagnóstico | Status |
|---|---|---|---|
| Movimento diagonal (`x, z`) | Normalizado via `Math.hypot(mx, mz)` (`L891-L895`); velocidade Z = `0.62×` de X | Proporção 2.5D correta para perspectiva inclinada | **APROVADO** |
| Aceleração / Desaceleração | Instantânea (`p.vx = mx * p.moveSpeed`, `p.vx = 0` ao soltar) | Sem micro-rampa de arranque/frenagem; troca rápida de direção é imediata, porém parada brusca em `run` | **SUSPEITA (P3)** |
| Sombra & Altura Aérea | Sombra fica fixa em `groundSy = actor.z * scale`, encolhendo com `airRatio` (`L1182`) | Boa leitura espacial de profundidade mesmo no ar | **APROVADO** |
| Movimento aéreo (`jump`) | `p.vz = moveY * moveSpeed * 0.55` permite desviar em Z no meio do pulo | Útil para alinhar voadora (`air_ataque_1`), porém permite alterar direção abruptamente no ar | **APROVADO (ajustável)** |
| Alinhamento dos pés (`anchorX`, `anchorY`) | Baseado no `bboxInQuad[3]` e centro corporal (`body_center_x`); `footSpan <= 13px` em walk/idle | Pés bem ancorados na sombra; exceção em `zoro/fase_4` pela escala | **PROBLEMA CONFIRMADO (Zoro F4)** |
| Troca de direção durante ataque | `facing` travado ao iniciar `ataque_1..4`, sem giro acidental | Evita flip indesejado no meio do golpe | **APROVADO** |
| Consistência teclado / gamepad / touch | `VirtualControls` usa `setTouchAxis` e `setTouchAction` no `InputManager` | Touch/Gamepad funcionam, sujeitos ao mesmo bug `jumpViaStick` | **PROBLEMA CONFIRMADO (P0)** |

---

## 3. Recomendações Técnicas de Fluidez (Compatíveis com a Arquitetura)

1. Desativar `stickJumpJust` quando `BeatEmUpScene` estiver ativa (`input.setBeatEmUpMode(true)`), liberando `W`/`Up`/stick ↑ para profundidade `Z` pura.
2. Persistir `isSprinting` no `BeatActor` quando duplo toque ocorrer, e usar `dash` apenas no botão dedicado `dash` (evitando conflito entre *dash burst* e *sprint run*).
3. Permitir cancelar `land` e `pickup` por qualquer ataque, dash ou pulo, além de adicionar buffer de `120ms` ao final de ataques/pulo.
4. Suavizar curva de velocidade em `walk`/`run` com aceleração rápida (`~0.08s`) mantendo responsividade arcade.
