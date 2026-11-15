# Especificação Técnica de Sprites, Recortes e Novas Animações (`sprite_sheets_melhorias.md`)

Este documento detalha todos os problemas de recorte (*clipping* / *bleeding*) detectados no `public/assets/characters/manifest.json` e nos arquivos brutos em `spritesPersonagens/`, define o mapa de *in-betweens* e novas animações necessárias para fluidez de combate, estabelece o padrão técnico definitivo das sprite sheets e fornece os briefings prontos para regeneração.

---

## Seção 1 — Sprites Atuais que Precisam ser Reprocessadas / Recortadas na Arte

A auditoria automática sobre os **2.912 frames base** cadastrados no `manifest.json` (9 personagens × 4 fases, excluindo variações direcionais sintetizadas) identificou **596 frames com corte de borda (`clippedEdges`)**.

### 1.1. Prioridade Crítica — Son Goku (`goku`: 94/336 frames base cortados — 28,0%)
As folhas de override em `anime_kombat_p2_lote2_gokuf2.zip`, `lote3_gokuf3.zip` e `lote4_gokuf4.zip` (`1264×848`, grid `3×2`, célula `421×424`) apresentam dois problemas graves:
- **Arte encostando na borda do canvas ou da célula**: cabelos espetados (SSJ/SSJ3/UI), auras e golpes ultrapassam os limites da célula (`T`, `L`, `R`).
- **Fundo não uniforme / vinheta escura**: em folhas como `fase_3/idle_3x2.png` (`bg=(62,0,58)`) e `fase_2/ataque_4_3x2.png` (`bg=(90,0,94)`), a aura preenche o fundo até o pixel `(0,0)`, impedindo a separação limpa entre células.
- **Desalinhamento de linha**: em `fase_2/run_3x2.png`, a faixa vazia entre linhas está em `y=411..421`, mas o corte fixo em `y=424` decepa 2px do topo da linha inferior.

| Fase | Ação / VFX | Frames Cortados | Bordas Afetadas | Causa e Ação Necessária na Arte |
|---|---|---|---|---|
| **Fase 1 (Base)** | `ataque_3` | 3/6 | `L`, `R` | Kamehameha/mãos invadindo células vizinhas. Ampliar margem lateral para 15% e centralizar corpo. |
| **Fase 1 (Base)** | `ataque_4` | 4/6 | `T`, `L`, `R` | Genki Dama e braços erguidos cortados no topo (`T`). Reduzir escala do boneco na célula para caber com 18% de folga superior. |
| **Fase 1 (Base)** | `jump` | 2/6 | `L`, `R` | Pés/braços tocando divisória lateral. Centralizar no eixo X da célula. |
| **Fase 2 (SSJ)** | `run` | 6/6 | `T` (todos) | Cabelo SSJ toca `y=0` na linha 1 e linha 2 começa em `y=422` (corte em `424`). **Reprocessar + dar padding superior de 18%**. |
| **Fase 2 (SSJ)** | `ataque_4` | 6/6 | `T`, `L`, `R` | Aura e explosão preenchem toda a célula; fundo `(0,0)` sujo. **Regerar com `#FF00FF` puro e margem de 18%**. |
| **Fase 2 (SSJ)** | `ataque_2`, `ataque_3` | 5/6 cada | `L`, `R` | Extensão de chute/onda de ki cortada nas laterais. |
| **Fase 2 (SSJ)** | `crouch`, `block`, `hitstun`, `idle` | 3/6 a 1/6 | `T`, `L`, `R` | Pontas do cabelo SSJ cortadas no topo (`T`). |
| **Fase 2 (SSJ)** | `vfx_ataque_1` | 2/6 | `L` | Faísca de impacto encostando na borda esquerda. |
| **Fase 3 (SSJ3)** | `idle`, `crouch`, `hitstun` | 6/6 cada | `T` (todos), `L` | Cabelo longo do SSJ3 + fundo escuro `(62,0,58)` cortam o topo em 100% dos frames. **Regerar com escala menor e 18% de margem no topo**. |
| **Fase 3 (SSJ3)** | `ataque_3` | 5/6 | `L`, `R` | Feixe/energia cortado nas laterais. |
| **Fase 3 (SSJ3)** | `jump`, `ataque_2`, `ataque_4`, `block`, `vfx_ataque_2` | 1/6 a 3/6 | `T`, `L` | Topo do cabelo ou halo de energia tocando borda. |
| **Fase 4 (UI)** | `ataque_3` | 6/6 | `L`, `R` | Onda de energia encostando nas 2 laterais em todos os frames. **Regerar**. |
| **Fase 4 (UI)** | `ataque_4`, `ataque_1`, `hitstun` | 3/6 a 4/6 | `T`, `L`, `R` | Topo da aura prata (`T`) e extensão dos golpes (`L`/`R`) cortados. |

### 1.2. Demais Personagens com Cortes Críticos na Arte
Todos os casos abaixo têm `clippedEdges` recorrente no `manifest.json` e precisam de ampliação de canvas / padding interno (não basta ajustar o slicer se o desenho toca a borda externa da folha):

| Personagem | Taxa de Corte (Base) | Folhas Mais Críticas (≥50% dos frames cortados) |
|---|---|---|
| **Chopper (`chopper`)** | **100/336 (29,8%)** | **Fase 2 (Horn Point):** `idle` (5/6 `T`), `run` (4/6 `R`), `jump` (4/6 `T/L/R`), `block` (6/6 `L/R`), `hitstun` (5/6 `T/R`), `ataque_1..4` (3/6 a 6/6 `T/L/R`), `vfx_ataque_2` (4/6 `T/L/R`). **Fase 3:** `ataque_3` (6/6 `L/R/B`). **Fase 4 (Monster Point):** `ataque_4` (6/6 `T/L/R/B` — corpo gigante excede a célula nos 4 lados), `hitstun` (5/6 `T/R`), `jump` (4/6 `T/L/R`), `ataque_3` (4/6 `T/L/R`), `vfx_ataque_2` (4/6 `L/R`), `vfx_ataque_4` (5/6 `L/R`). |
| **Sukuna (`sukuna`)** | **63/336 (18,8%)** | **Fase 1:** `ataque_3` (4/6 `L/R`), `ataque_4` (6/6 `L/R`). **Fase 2:** `ataque_1` (3/6 `T/L/R`), `ataque_3` (5/6 `L/R`), `ataque_4` (3/6 `L/R`). **Fase 3:** `ataque_1` (6/6 `L/R`), `ataque_4` (3/6 `L/R`). **Fase 4:** `crouch` (3/6 `T`), `ataque_2` (5/6 `L/R`), `ataque_3` (6/6 `T/R`), `vfx_ataque_4` (4/6 `L/R`). |
| **Zoro (`zoro`)** | **61/336 (18,2%)** | **Fase 1:** `ataque_3` (3/6 `L/R`). **Fase 2:** `idle` (3/6 `L/R`), `crouch` (3/6 `L/R`), `hitstun` (3/6 `L/R`), `ataque_2` (4/6 `L/R`), `ataque_3` (5/6 `L/R`), `ataque_4` (4/6 `T/L/R`). **Fase 3:** `vfx_ataque_4` (3/6 `B`). **Fase 4:** `ataque_3` (3/6 `L/R`), `vfx_ataque_4` (3/6 `T/L`). Espadas invadem células laterais. |
| **Luffy (`luffy`)** | **58/336 (17,3%)** | **Fase 2 (Boundman):** `run` (5/6 `T/L/R`), `jump` (3/6 `T/L/R`), `ataque_1` (4/6 `L/R`), `ataque_3` (3/6 `L/R`). **Fase 3:** `run` (3/6 `T`), `vfx_ataque_1` (3/6 `T`). **Fase 4 (Gear 5):** `ataque_1` (6/6 `T/B/L/R`), `ataque_2` (3/6 `L/R`), `ataque_4` (5/6 `T/L/R`), `vfx_ataque_2` (5/6 `L/R`). Braços elásticos esticados cortam nas bordas. |
| **Sasuke (`sasuke`)** | **53/336 (15,8%)** | **Fase 1:** `ataque_2` (3/6 `L/R`). **Fase 2:** `ataque_3` (3/6 `L/R`), `ataque_4` (3/6 `L/R`). **Fase 3:** `run` (5/6 `T/B`), `jump` (3/6 `T`), `ataque_1` (3/6 `T`), `ataque_4` (5/6 `T/L/R`). **Fase 4:** `ataque_1` (4/6 `L/R`), `ataque_3` (3/6 `L/R`). |
| **Seiya (`seiya`)** | **48/336 (14,3%)** | **Fase 1:** `ataque_2` (3/6 `T/L/R`), `ataque_4` (3/6 `L/R`). **Fase 2:** `ataque_4` (3/6 `L/R`), `vfx_ataque_4` (3/6 `R`). **Fase 3:** `ataque_3` (3/6 `R`), `vfx_ataque_4` (4/6 `T/L/R`). **Fase 4:** `run` (3/6 `L/R`), `ataque_2` (3/6 `T/L/R`), `ataque_4` (3/6 `L/R`). Asas da Kamui e raios de meteoro cortam nas laterais. |
| **Naruto (`naruto`)** | **23/224 (10,3%)** | Único personagem ainda com **4 frames (`2×2`)** por ação (`quad=688×384`). Crítico em **Fase 3:** `vfx_ataque_4` (3/4 `T/B/L`), `ataque_1/3/4` (2/4 `T/L/R`). Precisa de upgrade completo para `3×2` (6 frames) ou `4×2` (8 frames). |
| **Inuyasha (`inuyasha`)** | **29/336 (8,6%)** | **Fase 3:** `vfx_ataque_4` (3/6 `T`). **Fase 4:** `ataque_1` (3/6 `R`), `ataque_3` (4/6 `L/R`), `ataque_4` (3/6 `T/B/L/R`). Tessaiga longa corta na borda direita. |

---

## Seção 2 — Tabela de Novas Animações e Frames Faltantes (Por Personagem)

Para eliminar a sensação de "corte seco", precisamos tanto de **in-betweens** nas ações existentes quanto de **novos estados ausentes na State Machine atual**.

### 2.1. Animações Estruturais Faltantes (Todos os 9 Personagens)
Atualmente, o sistema possui apenas 10 ações base (`idle`, `run`, `jump`, `crouch`, `block`, `hitstun`, `ataque_1..4`). Faltam as seguintes animações essenciais de jogo de luta 2D:

| Animação Faltante | Frames Atuais | Frames Recomendados | Descrição Frame-a-Frame dos Quadros Necessários |
|---|---|---|---|
| `land` (Aterrissagem) | 0 (reusa `jump` morto) | **3–4 frames** | F1: contato dos pés com flexão rápida → F2: compressão máxima de joelhos/quadril (*squash*) com poeira → F3: mola subindo → F4: transição para `idle`. |
| `dash` (Avanço / Esquiva) | 0 (usa `run`) | **4–6 frames** | F1: inclinação frontal extrema → F2–F3: rastro de velocidade horizontal com pernas recolhidas → F4: freio com pé na frente. |
| `knockdown` / `getup` | 0 (usa `hitstun` congelado) | **6 frames** | F1: arco no ar de costas → F2: impacto no chão (quique) → F3: caído plano → F4: apoio de mão → F5: impulso de joelho → F6: retorno à guarda. |
| `victory` / `intro` | 0 | **6 frames** | Pose icônica de entrada/vitória para evitar tela estática no início do round e K.O. |

### 2.2. Expansão de Frames nas Ações Existentes (Por Personagem)

| Personagem | Animação / Fase | Frames Atuais | Frames Recomendados | Descrição dos *In-Betweens* Faltantes |
|---|---|---|---|---|
| **Naruto** | Todas as ações (F1–F4) | **4 frames** | **6 a 8 frames** | Faltam frames intermediários em todas as ações: **Idle** precisa de respiração/oscilação de faixa; **Run** precisa de 2 frames de passagem de perna (*passing position*); **Ataques 1–4** precisam de 1 frame de *antecipação* (ombro recuado), 1 frame de *follow-through* e 1 frame de *recovery*. |
| **Goku** | `run` (F1–F4) | 6 frames | **8 frames** | Adicionar 2 frames de transição entre passos extremos (F2b e F5b) para suavizar o ciclo de corrida a 13 FPS sem salto de pernas. |
| **Goku** | `ataque_1` e `ataque_2` (F1–F4) | 6 frames | **8 frames** | F1: recuo de punho/perna (*startup*) → F2: *in-between* de torção de tronco → F3–F4: impacto com *smear frame* → F5: desaceleração → F6–F8: recolhimento progressivo para guarda. |
| **Goku** | `ataque_4` (Ultimate F1–F4) | 6 frames | **10–12 frames** | Dura `1.08s` no código! Com 6 frames roda a 5,5 FPS. Adicionar 2 frames de carga de aura/ki, 2 frames de clímax com variação de brilho e 2 frames de retorno à postura base. |
| **Luffy** | `ataque_1`, `ataque_2`, `ataque_3` (F1–F4) | 6 frames | **8 frames** | Braços de borracha exigem *in-betweens* de estiramento e retração elástica (*snap-back*), caso contrário o braço "teletransporta" esticado. |
| **Zoro / Sasuke / Inuyasha** | `ataque_1`, `ataque_2`, `ataque_4` | 6 frames | **8–10 frames** | Personagens com espadas/garras precisam de *arc smear* (rastro em arco da lâmina) nos frames intermediários entre o saque e o corte final. |
| **Sukuna / Seiya / Chopper** | `ataque_4` (Ultimate F1–F4) | 6 frames | **10–12 frames** | Mesma razão do Goku: duração de `1.08s` exige pelo menos 10 frames para manter mínimo de 9–10 FPS fluidos no clímax. |
| **Todos** | `jump` (F1–F4) | 4–6 frames | **6–8 frames** | Separar claramente: F1–F2 (decolagem), F3–F4 (ápice/flutuação), F5–F6 (queda), evitando que `jump` pareça uma pose estática no ar. |

---

## Seção 3 — Padrão Técnico Definitivo das Sprite Sheets

Para eliminar permanentemente cortes de borda, vazamento de células e saltos de âncora, todas as novas sprite sheets e reprocessamentos devem obedecer a este padrão:

1. **Dimensões e Grid**:
   - **Padrão 6 frames (`3×2`)**: Canvas total **`1536 × 1024 px`** (3 colunas × 2 linhas = células exatas de **`512 × 512 px`**).
   - **Padrão 8 frames (`4×2`)** *(recomendado para `run` e `ataque_1..4`)*: Canvas total **`2048 × 1024 px`** (4 colunas × 2 linhas = células exatas de **`512 × 512 px`**).
   - **Padrão 12 frames (`4×3`)** *(recomendado para `ataque_4` Ultimate)*: Canvas total **`2048 × 1536 px`** (células exatas de **`512 × 512 px`**).
2. **Margens de Segurança (*Safe Zone* por Célula `512×512`)**:
   - **Topo**: mínimo **18% (`92 px`)** livres de qualquer pixel do personagem, cabelo espetado, espada ou aura.
   - **Esquerda e Direita**: mínimo **15% (`77 px`)** livres em cada lado dentro da célula (área útil máxima de largura = `358 px`). Para golpes longos, reduzir levemente a escala da pose ou usar VFX separado.
   - **Base**: mínimo **10% (`51 px`)** livres abaixo da linha dos pés.
   - **VFX Isolados**: mínimo **18% (`92 px`)** livres nos **4 lados**.
3. **Regra de Alinhamento de Chão (*Baseline*) e Pivô**:
   - Dentro de toda célula `512×512`, a sola do pé de apoio do personagem deve repousar exatamente na linha **`y = 460 px`** (deixando `52 px` de folga inferior).
   - O centro de massa do quadril/tronco deve estar alinhado próximo ao eixo central **`x = 256 px`** no `idle`, `crouch`, `block` e `hitstun`.
4. **Fundo e Limpeza**:
   - Fundo sólido puro **`#FF00FF` (RGB 255, 0, 255)** em 100% da área não ocupada pelo personagem/VFX.
   - **Proibido**: vinhetas escuras, gradientes de aura até a borda da célula, linhas de grade, sombras no chão ou números de frame.

---

## Seção 4 — Prompts / Briefings Prontos para Regeneração

### Briefing 1 — Goku Fase 2 (`run_3x2.png` — Corrigir corte superior de cabelo e alinhamento)
> **Destino:** `spritesPersonagens/overrides/goku/fase_2_super_saiyajin/run_3x2.png`
```text
Create a 2D anime fighting game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255) across 100% of empty space. NO grid lines, NO borders, NO dark vignette, NO numbers, NO floor shadow.
ART STYLE: 2D Dragon Ball shonen anime cel-shading, crisp dark ink outlines, sharp highlights, heroic proportions.
SAFE ZONE (CRITICAL): Keep spiky golden Super Saiyan hair and feet strictly INSIDE each 512x512 cell with at least 92px (18%) empty #FF00FF margin at TOP, 77px (15%) on LEFT and RIGHT, and 51px (10%) at BOTTOM. Feet aligned on the exact same baseline (y=460px).
CHARACTER: Son Goku Super Saiyan (golden spiky hair, teal eyes, orange martial arts gi with blue undershirt, blue belt and wristbands), strictly facing RIGHT.
ACTION - RUN CYCLE (6 frames, seamless loop F6->F1):
F1: right leg forward contact, torso leaning 20deg right, arms pumping.
F2: low passing stride, right knee bent under body, left leg extending back.
F3: push-off midair stride, left leg fully extended behind, right knee driving forward.
F4: left leg forward contact (opposite stride of F1).
F5: low passing stride, left knee under body, right leg extending back.
F6: push-off transitioning smoothly back to F1.
```

### Briefing 2 — Goku Fase 2 (`ataque_4_3x2.png` — Corrigir fundo sujo `(90,0,94)` e corte `T/L/R`)
> **Destino:** `spritesPersonagens/overrides/goku/fase_2_super_saiyajin/ataque_4_3x2.png`
```text
Create a 2D anime fighting game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255) — DO NOT tint or darken the background with aura glow! NO grid lines, NO borders, NO floor shadow.
SAFE ZONE (CRITICAL): Keep Goku, golden hair, and all energy/aura effects 100% inside each 512x512 cell with 92px empty #FF00FF margin at TOP and 77px on LEFT and RIGHT.
CHARACTER: Son Goku Super Saiyan facing RIGHT, orange gi, blue sash.
ACTION - ULTIMATE FINISHER (6 frames F1->F6):
F1: deep crouch charge, hands cupped at right hip, compact golden energy sphere forming.
F2: torso twisting back, bright golden flare around palms (contained inside safe zone).
F3: explosive forward step, both palms thrusting right launching concentrated beam core.
F4: peak impact follow-through, body fully extended right, intense golden rim light on character.
F5: recoil stance, steam/sparks fading near hands.
F6: clean recovery back to combat guard stance.
```

### Briefing 3 — Goku Fase 3 (`idle_3x2.png` — Corrigir fundo `(62,0,58)` e cabelo SSJ3 cortado no topo)
> **Destino:** `spritesPersonagens/overrides/goku/fase_3_super_saiyajin_3/idle_3x2.png`
```text
Create a 2D anime fighting game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255) everywhere around the character. NO dark aura background, NO vignette, NO grid lines.
SAFE ZONE (CRITICAL): Super Saiyan 3 has massive waist-length golden spiky hair — scale the character slightly smaller (~340px tall inside the 512px cell) so the tallest top hair spike has at least 92px (18%) empty #FF00FF margin at the TOP and 77px on LEFT/RIGHT. Feet anchored at y=460px.
CHARACTER: Son Goku Super Saiyan 3 (no eyebrows, prominent brow ridge, massive spiky golden hair down to waist, orange gi, blue belt), facing RIGHT.
ACTION - IDLE COMBAT STANCE (6 frames, subtle breathing loop F6->F1):
F1: balanced martial arts guard, knees slightly bent, front fist up.
F2: subtle inhale, chest rises 3px, hair tips sway slightly.
F3: peak breath, slight weight shift forward.
F4: subtle exhale, shoulders settle.
F5: slight knee bend bounce.
F6: smooth return toward F1 guard.
```

### Briefing 4 — Goku Fase 3 (`crouch_3x2.png` e `hitstun_3x2.png`) e Fase 4 (`ataque_3_3x2.png`)
> Aplicar exatamente as mesmas regras de **Safe Zone (92px topo, 77px laterais, 51px base)** e **`#FF00FF` puro sem vinheta**:
- **Goku F3 `crouch_3x2.png`**: Agachamento real (~60% da altura em pé), cabelo longo do SSJ3 escorrendo para trás/baixo sem tocar o topo (`y >= 92px`) nem a borda esquerda (`x >= 77px`).
- **Goku F3 `hitstun_3x2.png`**: Recuo de impacto inclinando o tronco para trás, mantendo a ponta do cabelo SSJ3 dentro da margem esquerda/superior.
- **Goku F4 `ataque_3_3x2.png` (Instinto Superior)**: Cabelo prateado, postura de disparo de energia sem que o feixe/mão toque `x=0` ou `x=511` da célula (o projétil longo deve ir apenas no `vfx_ataque_3_3x2.png`).

### Briefing 5 — Chopper Fase 2 / Fase 4 e Naruto F1–F4
- **Chopper F2 (`idle`, `block`, `ataque_1..4`) e F4 Monster Point (`ataque_4`)**: Reduzir a escala do corpo na célula `512×512` para `~350px` de altura para que chifres e braços gigantes mantenham os `92px` superiores e `77px` laterais de `#FF00FF` puro.
- **Naruto F1–F4 (Upgrade de `2×2` para `3×2`)**: Regerar as 14 sheets por fase no grid `3×2` (`1536×1024`) seguindo o Template Direto A/B de [PROMPT_NOVO_PERSONAGEM.md](file:///home/spira/animekombat/docs/PROMPT_NOVO_PERSONAGEM.md), padronizando Naruto nos 6 frames como os demais personagens.

