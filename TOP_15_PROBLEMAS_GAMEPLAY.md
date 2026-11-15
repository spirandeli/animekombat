# Top 15 Problemas de Fluidez, Imersão e Jogabilidade (`TOP_15_PROBLEMAS_GAMEPLAY.md`)

Diagnóstico técnico e status de resolução dos 15 principais gargalos encontrados no código-fonte e nos assets do **Anime Kombat**, ordenados por impacto na experiência de combate.

> **Resumo de Status:** **14/15 Resolvidos** | **1/15 Parcialmente Resolvido (Folhas antigas restantes em [sprites_para_correção.md](file:///home/spira/animekombat/sprites_para_corre%C3%A7%C3%A3o.md))**

---

### 1. Deslize e Inércia Residual Após Soltar Movimento (*Ghost Sliding*) — **[RESOLVIDO]**
- **Categoria:** Jogabilidade / Física & Colisão
- **Nível de Criticidade:** Crítico
- **Onde ocorre no código/assets:** `src/game/Fighter.ts` — `updateNeutralState()` (L787–809, L740–741, L768–769).
- **Impacto na Experiência do Jogador:** Ao soltar a tecla de direção, `this.vx` sofre decaimento exponencial lento (`Math.pow(0.0004, dt)`) até cair abaixo de `8 px/s`. O personagem continua deslizando por ~0,4s sem comando ativo, destruindo a precisão de espaçamento (*footsies*) e passando a impressão de que o personagem está andando sozinho.
- **Solução Técnica Direta:** Quando `Math.abs(input.moveX) <= 0.25` no solo (`this.grounded`), zerar `this.vx = 0` imediatamente (e também ao entrar em `block` ou `crouch`).

---

### 2. Teclas Presas e Drift de Controle / Touch Sobrescrevendo o Teclado — **[RESOLVIDO]**
- **Categoria:** Jogabilidade
- **Nível de Criticidade:** Crítico
- **Onde ocorre no código/assets:** `src/engine/InputManager.ts` — `sample()` (L406–460), `handleKeyDown()` (L681–715) e `constructor()` (L183–187).
- **Impacto na Experiência do Jogador:** Se `touchAxisX` ou o eixo analógico `gx` de qualquer gamepad conectado ultrapassar o limiar (`0.01` / `gamepadDeadzone`), o código ignora completamente o teclado (`kx = 0`). Além disso, atalhos com `Alt`/`Meta` ou trocas de foco podem deixar códigos em `keysDown` sem `keyup`, fazendo o lutador andar sozinho indefinidamente.
- **Solução Técnica Direta:** Adicionar `window.addEventListener('focus', this.resetAll)`, ignorar acúmulo direcional quando `e.metaKey`/`e.altKey` estiver ativo e exigir variação ativa do gamepad antes de sobrepor o teclado.

---

### 3. Corte de Bordas (*Clipping*) e Desalinhamento de Grid em Sprites (Goku e Demais Lutadores) — **[PARCIALMENTE RESOLVIDO — Restam Folhas Antigas]**
> *Nota:* Naruto foi zerado (`0/362` cortados), e as folhas críticas de Goku (F2 `run`/`ataque_4`, F3 `idle`/`crouch`/`hitstun`, F4 `ataque_3`) e Chopper (F2 `idle`/`block`/`ataque_1..4`, F4 `ataque_4`) foram corrigidas. Folhas antigas ainda com corte em `Goku` (61/398), `Chopper` (63/368), `Sukuna` (82/368), `Sasuke` (63/368), `Zoro` (60/368), `Luffy` (57/368), `Seiya` (45/368) e `Inuyasha` (40/368) seguem listadas em [sprites_para_correção.md](file:///home/spira/animekombat/sprites_para_corre%C3%A7%C3%A3o.md).
- **Categoria:** Imersão / Fluidez
- **Nível de Criticidade:** Crítico
- **Onde ocorre no código/assets:** `scripts/process_sprites_2x2.py` — `process_sheet_task()` (L865–875); `public/assets/characters/manifest.json` (596/2912 frames base com `clippedEdges`, sendo Goku 94/336 e Chopper 100/336).
- **Impacto na Experiência do Jogador:** Cabelos (Goku F2 `run`, F3 `idle`/`crouch`/`hitstun`), punhos, espadas e auras aparecem literalmente decepados nas bordas ou invadindo o quadro vizinho, quebrando a imersão visual.
- **Solução Técnica Direta:** Substituir o corte rígido `w // cols, h // rows` por detecção automática de vale de projeção (*projection valley*) ao redor das divisórias e regerar as folhas onde o desenho já toca a borda externa do canvas usando o padrão `1536×1024` com 18% de margem `#FF00FF`.

---

### 4. Código Morto na Animação de Aterrissagem (*Landing Recovery*) — **[RESOLVIDO]**
- **Categoria:** Fluidez / Física & Colisão
- **Nível de Criticidade:** Alto
- **Onde ocorre no código/assets:** `src/game/Fighter.ts` — `update()` (L665–693) vs. `getCurrentFrame()` (L1297–1300).
- **Impacto na Experiência do Jogador:** Ao tocar o chão, `update()` muda `this.state = 'idle'` no mesmo instante em que define `this.landingTimer = 0.09`. Porém, `getCurrentFrame()` só checa `if (this.grounded && this.landingTimer > 0)` dentro do ramo `this.state === 'jump'`. O último frame do pulo (pouso) **nunca é exibido**, gerando um corte seco do ar direto para `idle`.
- **Solução Técnica Direta:** Manter o frame de pouso (ou um sub-estado `land` cancelável) ativo enquanto `this.landingTimer > 0` antes de transicionar para `idle`.

---

### 5. Variação Brusca de Escala e Pivô entre Frames da Mesma Ação — **[RESOLVIDO]**
- **Categoria:** Fluidez / Imersão
- **Nível de Criticidade:** Alto
- **Onde ocorre no código/assets:** `src/game/Fighter.ts` — `computeNormalizedFrameScale()` (L1227–1281); `scripts/process_sprites_2x2.py` — `compute_anchors()` (L1171–1190).
- **Impacto na Experiência do Jogador:** Como `rawW` e `rawH` oscilam fortemente entre poses (ex.: Goku F1 `ataque_4` varia `rawW=178..398`, `rawH=276..419`, `anchorX=91.0..233.6`), o cálculo `blendedH = medianH * 0.78 + frameH * 0.22` faz o personagem encolher, crescer e "teletransportar" horizontalmente a cada frame.
- **Solução Técnica Direta:** Usar escala fixa por fase (`TARGET_BODY_HEIGHT / phasePack.manifest.refBodyHeight`) sem misturar `frameH` por quadro, e calcular `anchorX` exclusivamente pelo centro do tronco/quadril.

---

### 6. Timing Linear de Ataques Sem Curva de Startup / Active / Recovery — **[RESOLVIDO]**
- **Categoria:** Fluidez / Jogabilidade
- **Nível de Criticidade:** Alto
- **Onde ocorre no código/assets:** `src/game/Fighter.ts` — `getCurrentFrame()` (L1330–1333).
- **Impacto na Experiência do Jogador:** A seleção de frame `Math.floor((stateTime / spec.duration) * frames.length)` dá exatamente o mesmo tempo de tela para preparação, impacto e recuperação. Golpes pesados como `ataque_4` (`1.08s` / 6 frames = `180ms` por frame, ~5,5 FPS) parecem câmera lenta engasgada em vez de explosivos.
- **Solução Técnica Direta:** Mapear os frames por curva não-linear usando `spec.activeStart` e `spec.activeEnd` (antecipação rápida, retenção nos frames de impacto, recuperação suave) e expandir `ataque_4` para 10–12 frames.

---

### 7. Naruto Preso em 4 Frames (`2×2`) Enquanto o Elenco Usa 6 Frames (`3×2`) — **[RESOLVIDO]**
> *Nota:* Todas as 4 fases do Naruto foram atualizadas via `spritesheets_padrao_definitivo (1).zip` para o padrão `3×2` (6 frames, e `jump` com 8 frames), com **0/362 frames cortados (0,0%)**.
- **Categoria:** Fluidez / Imersão
- **Nível de Criticidade:** Alto
- **Onde ocorre no código/assets:** `public/assets/characters/manifest.json` — `naruto` (`fase_1`..`fase_4`: 4 frames por ação, `quad=688×384`).
- **Impacto na Experiência do Jogador:** Em comparação direta com os outros 8 lutadores, Naruto roda a 4–6 FPS em ataques e corrida, apresentando saltos visuais muito mais secos entre poses.
- **Solução Técnica Direta:** Migrar as 56 folhas do Naruto para o padrão `3×2` (6 frames) ou `4×2` (8 frames) e reprocessar via `process_sprites_2x2.py`.

---

### 8. Input Remoto Sem Timeout/Decaimento no Modo Online — **[RESOLVIDO]**
- **Categoria:** Jogabilidade
- **Nível de Criticidade:** Alto
- **Onde ocorre no código/assets:** `src/game/ArenaScene.ts` — `consumeRemoteInput()` (L670–681).
- **Impacto na Experiência do Jogador:** `consumeRemoteInput` limpa apenas os eventos `just*`, mantendo `moveX`, `left` e `right` intactos. Se houver *jitter* ou perda de pacote na rede, o lutador remoto continua andando ou correndo na última direção recebida.
- **Solução Técnica Direta:** Rastrear o timestamp do último `combat_sync` por slot e decair/zerar `moveX`, `left` e `right` caso nenhum pacote chegue em `> 180ms`.

---

### 9. Congelamento Total Durante o *Hitstop* Sem Micro-Vibração do Alvo — **[RESOLVIDO]**
- **Categoria:** Imersão / Fluidez
- **Nível de Criticidade:** Médio
- **Onde ocorre no código/assets:** `src/engine/CombatSystem.ts` — `updateMulti()` (L441–445).
- **Impacto na Experiência do Jogador:** Quando `hitStopRemaining > 0`, `updateMulti` retorna `false` e congela toda a física dos lutadores sem tremor local no defensor. Em golpes fortes, a tela parece ter "travado" em vez de transmitir peso de impacto.
- **Solução Técnica Direta:** Aplicar um *hit-shake* horizontal (`±3px` alternado) apenas na renderização do `defender` enquanto `hitStopRemaining > 0`.

---

### 10. Hitboxes Retangulares Fixas Desacopladas da Pose do Sprite — **[RESOLVIDO]**
- **Categoria:** Física & Colisão / Jogabilidade
- **Nível de Criticidade:** Médio
- **Onde ocorre no código/assets:** `src/game/Fighter.ts` — `getActiveAttackHitbox()` (L1070–1168) e `getHurtbox()` (L1058–1068).
- **Impacto na Experiência do Jogador:** A hurtbox tem largura fixa (`78px`) e altura binária (`164px` em pé / `116px` agachado), e a hitbox usa um retângulo único durante toda a janela `[activeStart, activeEnd]`. Isso causa acertos onde o visual do golpe ainda não alcançou o oponente ou já recolheu.
- **Solução Técnica Direta:** Ajustar `activeStart`/`activeEnd` por personagem e sincronizar o deslocamento da hitbox com os frames ativos da animação.

---

### 11. Ausência de *Jump Cancel* e Cancelamento Restrito de Combos — **[RESOLVIDO]**
- **Categoria:** Jogabilidade / Fluidez
- **Nível de Criticidade:** Médio
- **Onde ocorre no código/assets:** `src/game/Fighter.ts` — `updateAttackState()` (L848–858).
- **Impacto na Experiência do Jogador:** Só é possível encadear `ataque_1` → `ataque_2/3/4` após `progress >= 0.48` e apenas se o golpe acertar (`attackHitDone`). Não há *jump cancel* nem cancelamento de recuperação em defesa, deixando a cadência rígida.
- **Solução Técnica Direta:** Permitir *jump cancel* após acerto de `ataque_1`/`ataque_2` e reduzir a janela de bloqueio de input no final da recuperação (*recovery cancel*).

---

### 12. Falta de Animações Dedicadas de *Dash*, *Knockdown* e *Getup* — **[RESOLVIDO]**
> *Nota:* As folhas `dash`, `land`, `knockdown` e `victory` de todos os 9 personagens foram processadas no `manifest.json` e integradas em [SpriteLoader.ts](file:///home/spira/animekombat/src/engine/SpriteLoader.ts) e [Fighter.ts](file:///home/spira/animekombat/src/game/Fighter.ts) (com fallback automático da `fase_1` para fases 2–4).
- **Categoria:** Imersão / Fluidez
- **Nível de Criticidade:** Médio
- **Onde ocorre no código/assets:** `src/game/Fighter.ts` — `FighterState` (L19–30) e `getCurrentFrame()` (L1283–1336).
- **Impacto na Experiência do Jogador:** Não existe esquiva/dash dedicado nem queda no chão após golpes pesados (`ataque_4` com `knockbackY = -305`). O personagem apenas flutua em `hitstun` e volta instantaneamente para `idle` ao tocar o chão ou zerar o timer.
- **Solução Técnica Direta:** Adicionar estados `land`, `dash` e `knockdown` na State Machine (inicialmente com suporte a fallback para frames existentes até os novos sprites serem gerados).

---

### 13. Transição Brusca de Estados Sem Interpolação Visual (*Afterimage* Subutilizado) — **[RESOLVIDO]**
- **Categoria:** Fluidez / Imersão
- **Nível de Criticidade:** Médio
- **Onde ocorre no código/assets:** `src/game/Fighter.ts` — `update()` (L525–551).
- **Impacto na Experiência do Jogador:** `afterimages` só disparam quando `vx > 310`, `ataque_4` ou `evolve`. Investidas rápidas como `ataque_2` (`lungeX: 135`) e saltos em alta velocidade não deixam rastro, acentuando os saltos entre os 6 frames.
- **Solução Técnica Direta:** Habilitar 1–2 *afterimages* leves durante `ataque_2` e nos 2 primeiros frames de `jump`/`hitstun` forte.

---

### 14. Desaceleração Aérea e Gravidade Unificada Sem Controle de Queda Rápida (*Fast Fall*) — **[RESOLVIDO]**
- **Categoria:** Física & Colisão / Jogabilidade
- **Nível de Criticidade:** Médio
- **Onde ocorre no código/assets:** `src/game/Fighter.ts` — `updateNeutralState()` (L774–785) e `update()` (L621–626).
- **Impacto na Experiência do Jogador:** O pulo tem arco fixo (`GRAVITY = 1580`, `JUMP_VEL = -665`) sem possibilidade de *short hop* (pulo curto ao soltar o botão) ou *fast fall* (segurar baixo no ar), tornando o combate aéreo lento e previsível.
- **Solução Técnica Direta:** Aplicar multiplicador de gravidade (`1.35x`) ao segurar `input.down` durante a descida (`vy > 0`) e amortecer `vy` se o botão de pulo for solto cedo na subida.

---

### 15. Uso de `SpriteLoader.loadRaw2x2SheetFallback` Com Grid Fixo Sem Vale de Projeção — **[RESOLVIDO]**
- **Categoria:** Imersão / Arquitetura
- **Nível de Criticidade:** Médio
- **Onde ocorre no código/assets:** `src/engine/SpriteLoader.ts` — `loadRaw2x2SheetFallback()` (L274–300).
- **Impacto na Experiência do Jogador:** Caso alguma folha caia no fallback de runtime, ela é fatiada por `Math.floor(w / cols)` e `Math.floor(h / rows)` sem remoção de ilhas de *bleeding* nem cálculo de `bodyCenterX`, replicando cortes e saltos de âncora em tempo de execução.
- **Solução Técnica Direta:** Garantir 100% de cobertura via `manifest.json` pré-processado e atualizar o fallback para respeitar margens de segurança caso seja acionado.

