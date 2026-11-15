# Plano Técnico de Correção, Fluidez e Game Feel (`PLANO_DE_MELHORIA_GAME.md`)

Este documento consolida a auditoria técnica do motor 2D, pipeline de sprites, sistema de input, física e máquina de estados do **Anime Kombat**, com foco em eliminar o bug de movimentação autônoma (*ghost walking*), corrigir o fatiamento/enquadramento de sprites (especialmente Goku e os demais personagens com bordas cortadas) e elevar a fluidez das animações e do *game feel*.

---

## 1. Diagnóstico da Causa Raiz

### 1.1. Bug de Movimentação Autônoma (*Ghost Walking*) e Deslize Pós-Tecla
A movimentação autônoma e o deslize indesejado após soltar os comandos nascem da combinação de 4 falhas na cadeia `InputManager` → `ArenaScene` → `Fighter`:

1. **Desaceleração exponencial lenta ao soltar a tecla (`src/game/Fighter.ts:802-809`)**:
   - Quando `Math.abs(input.moveX) <= 0.25`, o código aplica `this.vx *= Math.pow(0.0004, dt)` e só zera `this.vx = 0` quando `Math.abs(this.vx) < 8`.
   - A 60 FPS (`dt = 1/60`), `255 * (0.0004^(1/60))^t` leva ~25 frames (~0,42s) para cair abaixo de 8 px/s. O lutador continua deslizando após o jogador soltar a tecla. O mesmo ocorre em `block` (`Fighter.ts:740-741`) e `crouch` (`Fighter.ts:768-769`).
2. **Teclas presas em `keysDown` (`src/engine/InputManager.ts:183-187, 681-719`)**:
   - `handleKeyDown` adiciona `e.code` ao `Set` `keysDown`, mas não há limpeza quando modificadores de sistema (`Alt`, `Meta`/Windows/Cmd) interceptam o foco, quando o usuário troca de aba/janela via atalho sem disparar `keyup` da tecla direcional, nem no evento `window.focus`.
3. **Prioridade absoluta de `touchAxisX` e Gamepad com drift (`src/engine/InputManager.ts:406-436, 448-460`)**:
   - `moveX` é resolvido como `Math.abs(this.touchAxisX) > 0.01 ? this.touchAxisX : Math.abs(gx) > 0.01 ? gx : kx`.
   - Se um controle físico ou dispositivo virtual reportado pela Gamepad API tiver eixo analógico ruidoso acima de `gamepadDeadzone` (`0.26`), ou se `touchAxisX` ficar preso acima de `0.01`, o eixo fantasma **ignora completamente o teclado (`kx = 0`)** e mantém `moveX != 0` continuamente.
4. **Input remoto sem decaimento no modo online (`src/game/ArenaScene.ts:670-681`)**:
   - `consumeRemoteInput` zera apenas os flags de borda (`justA1..justEvolve`), mas preserva `moveX`, `left` e `right` do último pacote indefinidamente caso haja perda de pacote ou pausa do oponente.

---

### 1.2. Sprites Cortadas e Mal Fatiadas (Goku e Demais Personagens)
A análise direta do `public/assets/characters/manifest.json` e dos arquivos brutos em `spritesPersonagens/` revelou que **não se trata apenas de um erro**, mas de dois problemas somados:

1. **Corte Rígido em Grid Fixo (`scripts/process_sprites_2x2.py:865-875`)**:
   - O script divide a folha exatamente por `qw, qh = w // cols, h // rows`.
   - Nos novos pacotes do Goku (`anime_kombat_p2_lote2_gokuf2.zip`, `lote3_gokuf3.zip`, `lote4_gokuf4.zip`), as folhas têm `1264×848` (`3×2`), gerando células fixas de `421×424`.
   - A inspeção pixel-a-pixel de `goku/fase_2/run_3x2.png` (`1264×848`) mostra que a faixa vazia horizontal entre a linha superior e a inferior está em `y = 411..421`. A linha inferior começa em `y = 422`, mas o corte fixo em `qh = 424` decepa os 2 pixels superiores da segunda linha.
2. **Desenhos Cortados e Vazamento na Arte Original (`clippedEdges`)**:
   - Em `goku/fase_3/idle_3x2.png` e `goku/fase_2/ataque_4_3x2.png`, o pixel `(0,0)` não é `#FF00FF` puro (lido como RGB `(62,0,58)` e `(90,0,94)`), e não há bandas vazias separando linhas/colunas. Cabelos, auras e golpes tocam ou atravessam a borda da célula.
   - No `manifest.json` atual, as taxas de frames base com bordas cortadas (`clippedEdges`) são:
     - **Chopper:** 100/336 (29,8%)
     - **Goku:** 94/336 (28,0%) — crítico em `fase_2/run` (6/6 `T`), `fase_2/ataque_4` (6/6 `T/L/R`), `fase_3/idle` (6/6 `T`), `fase_3/crouch` (6/6 `T`), `fase_3/hitstun` (6/6 `T/L`), `fase_4/ataque_3` (6/6 `L/R`).
     - **Sukuna:** 63/336 (18,8%)
     - **Zoro:** 61/336 (18,2%)
     - **Luffy:** 58/336 (17,3%)
     - **Sasuke:** 53/336 (15,8%)
     - **Seiya:** 48/336 (14,3%)
     - **Naruto:** 23/224 (10,3%)
     - **Inuyasha:** 29/336 (8,6%)

---

### 1.3. Movimentação e Animações Truncadas / Cortes Secos
1. **Taxa de quadros efetiva muito baixa em ataques (`src/game/Fighter.ts:1330-1333`)**:
   - Os ataques usam distribuição linear `Math.floor((stateTime / spec.duration) * frames.length)` sobre 4 ou 6 frames.
   - Um `ataque_4` (`1.08s`) com 6 frames exibe cada desenho por **180 ms (~5,5 FPS)**; um `ataque_1` (`0.50s`) com 6 frames exibe cada desenho por **83 ms (~12 FPS)**; no Naruto (4 frames), cai para **250 ms/frame (~4 FPS)** no Ultimate.
2. **Ausência de curva Startup / Active / Recovery na animação**:
   - O frame de antecipação, o frame de impacto e os frames de recuperação recebem exatamente o mesmo tempo de tela.
3. **Instabilidade de escala e pivô entre frames (`src/game/Fighter.ts:1227-1281`)**:
   - `computeNormalizedFrameScale` recalcula a escala a cada frame misturando `medianH * 0.78 + frameH * 0.22`. Como `rawH` e `rawW` oscilam muito na mesma ação (ex.: Goku `fase_1/ataque_4` varia `rawW=178..398`, `rawH=276..419`, `anchorX=91.0..233.6`), o personagem muda de tamanho e "salta" lateralmente a cada troca de frame.
4. **Código morto na animação de pouso (`src/game/Fighter.ts:689-692` vs `1297-1300`)**:
   - Ao tocar o chão, `update()` muda `this.state = 'idle'` imediatamente. Porém, o frame de pouso (`this.grounded && this.landingTimer > 0`) só é verificado dentro do `if (this.state === 'jump')` em `getCurrentFrame()`. O frame de aterrissagem nunca é exibido.

---

## 2. Relatório de Correção de Recorte (Slicing Fix via Código)

Estas correções devem ser aplicadas em `scripts/process_sprites_2x2.py` para recuperar automaticamente todas as folhas onde o desenho não foi amputado na borda externa da imagem, eliminando cortes causados por divisão rígida de grid:

| Alvo no Pipeline | Comportamento Atual (`process_sprites_2x2.py`) | Correção Técnica Recomendada |
|---|---|---|
| **Divisão de células (`L866-875`)** | Corte rígido em `qw = w // cols`, `qh = h // rows`. Se a linha 2 começa em `y=422` num sheet `1264×848`, corta 2px do topo. | Implementar **busca de vale de projeção (projection valley)**: ao redor de cada linha divisória teórica (`r * qh ± 24px` e `c * qw ± 24px`), contar pixels não-fundo e posicionar o corte na linha/coluna de menor densidade de foreground. |
| **Detecção de fundo (`chroma_key_quad`)** | Assume fundo próximo a `#FF00FF` uniforme; falha quando há aura/vinheta escura em `(0,0)` (ex.: Goku F3 `idle`, F2 `ataque_4`). | Amostrar os 4 cantos da célula e também o perímetro das bandas vazias; se houver borda escura/grade (`_strip_grid_border_lines`), expandir a remoção de borda antes do flood-fill de chroma-key. |
| **Bleed entre células (`_remove_bleed_islands`)** | Só remove ilhas desconectadas após o corte rígido; se o golpe encosta na divisa, parte da mão/aura fica no frame vizinho. | Com o corte guiado por vale de projeção + tolerância de contorno conectado (*connected components* centrados no centro de massa de cada célula), atribuir componentes de borda à célula cujo centroide esteja mais próximo. |
| **Escala em runtime (`Fighter.ts:1227-1281`)** | `blendedH = medianH * 0.78 + frameH * 0.22` causa "zoom pulsante" quando um frame agacha/estica. | Usar escala fixa por fase (`TARGET_BODY_HEIGHT / phasePack.manifest.refBodyHeight`) para todas as ações padrão, evitando encolhimento artificial quando o personagem abre os braços ou dá um chute. |
| **Fallback runtime (`SpriteLoader.ts:287-295`)** | `loadRaw2x2SheetFallback` também usa `Math.floor(w / cols)` e `Math.floor(h / rows)` fixos. | Aplicar a mesma lógica de margem/procura de vale ou garantir que 100% das folhas passem pelo pré-processamento do `manifest.json`. |

---

## 3. Plano de Correção de Input e Movimento (Fim do Ghost Walking)

### Etapa 1 — Blindagem do `InputManager` (`src/engine/InputManager.ts`)
1. **Sanitização de teclado em eventos de sistema**:
   - Em `handleKeyDown`: se `e.metaKey` ou `e.altKey` estiver ativo (exceto `AltGraph`), não acumular direcionais em `keysDown` ou limpar direcionais ao perder foco.
   - Registrar `window.addEventListener('focus', this.resetAll)` além de `blur` e `visibilitychange`.
2. **Deadzone e prioridade segura em `sample()`**:
   - Somar ou priorizar apenas entradas intencionais com *threshold* claro: só considerar `gx` se `Math.abs(gx) > 0.28` e houver mudança recente de estado do gamepad, evitando que um controle conectado com drift leve bloqueie o teclado (`kx`).
   - Garantir que `touchAxisX` abaixo de `stickDeadzone` retorne exatamente `0`.

### Etapa 2 — Parada Imediata no `Fighter` (`src/game/Fighter.ts`)
1. **Zero inércia residual no solo (`updateNeutralState`, L787-809)**:
   - Quando `Math.abs(input.moveX) <= 0.25` no chão (`this.grounded`):
     - Definir `this.vx = 0` imediatamente (ou em no máximo 1 frame de micro-freio se `Math.abs(vx) < 40`, mas idealmente `this.vx = 0` direto para precisão de jogo de luta 2D).
   - Em `block` (`L740`) e `crouch` (`L768`): zerar `this.vx = 0` imediatamente ao entrar no estado.
2. **Separação explícita entre impulso de knockback e movimento voluntário**:
   - Movimento voluntário só altera `vx` em `idle`/`run`/`jump` quando `input.moveX !== 0`.

### Etapa 3 — Decaimento de Rede (`src/game/ArenaScene.ts`)
1. Em `consumeRemoteInput()` (`L670-681`), adicionar um `remoteInputAge` por slot: se não chegar novo pacote de `combat_sync` em `> 180ms`, zerar `moveX`, `left` e `right` daquele slot remoto para impedir que o boneco remoto continue andando em caso de lag/perda de pacote.

---

## 4. Plano de Refatoração do Pipeline de Animação

1. **Corrigir o estado de Pouso (`Landing Recovery`)**:
   - Em `Fighter.ts:665-695`, ao pousar, se `heavyLand` (ou sempre após `jump`), entrar em `landingTimer = 0.09` e manter a exibição do último frame de `jump` (agachado de impacto) durante esse curto período antes de retornar a `idle`, ou criar um sub-estado curto de pouso que ainda permita cancelar em ataque/pulo/defesa.
2. **Mapeamento Não-Linear de Frames (Startup / Active / Recovery)**:
   - Substituir `Math.floor(progress * frames.length)` em `Fighter.ts:1330-1333` por uma curva baseada nas fases do golpe (`spec.activeStart` e `spec.activeEnd`):
     - `progress < spec.activeStart`: mapear nos frames iniciais (`0 .. startupEnd`, ex: F1–F2) com aceleração.
     - `spec.activeStart <= progress <= spec.activeEnd`: segurar nos frames de pico/extensão (`F3–F4`), dando peso e leitura ao impacto.
     - `progress > spec.activeEnd`: distribuir nos frames finais (`F5–F6`) de retorno à guarda.
3. **Alinhamento de Baseline e Âncora Horizontal**:
   - No `process_sprites_2x2.py`, calcular `anchorX` usando apenas o **tronco/quadril** (faixa vertical de 35% a 75% da altura do personagem), ignorando braços/espadas/projéteis estendidos. Hoje `_compute_body_center_x` já tenta estimar o corpo, mas ainda sofre desvios grandes quando o golpe ocupa toda a célula.
   - Em `Fighter.ts`, manter `scale` constante por fase (`TARGET_BODY_HEIGHT / refBodyHeight`), eliminando o jitter de zoom entre frames.

---

## 5. Polimento Visual via Código (*Game Feel*)

Mesmo antes de gerar novos frames de animação, estas técnicas em código reduzem drasticamente a percepção de "corte seco":

1. **Squash & Stretch Real na Decolagem, Pouso e Golpes Pesados**:
   - Corrigir a exibição do `landingTimer` para que o `renderScaleX = scale * 1.08`, `renderScaleY = scale * 0.92` apareça de fato por 80–100ms ao pousar.
   - Adicionar micro-compressão (`scaleX: 1.05, scaleY: 0.95`) no primeiro frame de `ataque_2`/`ataque_4` (antecipação) e leve estiramento (`scaleX: 1.06, scaleY: 0.96`) no frame ativo do golpe.
2. **Crossfade / Ghosting Sutil em Transições Rápidas**:
   - Já existe um sistema de `afterimages` (`Fighter.ts:525-551`) restrito a `Math.abs(vx) > 310` ou `ataque_4`. Expandir para emitir 1-2 *afterimages* translúcidas (`alpha: 0.16`, `maxAge: 0.08s`) durante `ataque_2` e transições de `hitstun` pesado cria continuidade visual entre poses distantes.
3. **Hitstop Assimétrico + Micro-Tremor no Defensor**:
   - Hoje `CombatSystem.ts:442-445` congela o mundo inteiro (`return false`), deixando o impacto estático. Aplicar um micro-deslocamento oscilatório horizontal (`±3px` alternado a cada frame) exclusivamente no `defender` durante `hitStopRemaining > 0` transmite sensação visceral de impacto sem adicionar nenhum sprite novo.
4. **Input Buffer e Cancelamento Responsivo**:
   - O buffer atual (`120ms` em `Fighter.ts:505-516`) é bom, mas `ataque_1` só pode cancelar para `ataque_2/3/4` após `progress >= 0.48` (`L851`). Permitir cancelar `ataque_1` → `ataque_2` → `ataque_3/4` e cancelar `ataque_1` em `jump` (*jump cancel* após hit) torna o combate muito mais fluido e menos travado.

