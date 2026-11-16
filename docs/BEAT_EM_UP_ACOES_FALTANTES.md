# Ações Faltantes para o Modo Beat 'em Up 2D (SNES — Ruas do Brasil)

Este documento consolida a auditoria dos sprites existentes no **Anime Kombat** e lista exatamente **todas as ações, NPCs, Bosses e Backgrounds** que faltam para implementarmos o novo modo **Beat 'em Up 2D estilo Super Nintendo** (*Streets of Rage* / *Final Fight*) sem quebrar os modos atuais (`1v1` e `Rumble`).

---

## 1. Padrão Técnico Obrigatório das Spritesheets

Todas as folhas novas (heróis, NPCs e bosses) devem seguir o padrão definitivo do pipeline em [process_sprites_2x2.py](file:///home/spira/animekombat/scripts/process_sprites_2x2.py):

- **Grid:** `3×2` (3 colunas × 2 linhas = 6 frames, esquerda → direita, cima → baixo).
- **Resolução:** `1536 × 1024 px` (células exatas de `512 × 512 px`).
- **Fundo:** Magenta puro `#FF00FF` (`RGB 255, 0, 255`), **sem** linhas de grade, bordas, números, texto ou sombra no chão.
- **Safe Zone Anti-Corte (por célula `512×512`):**
  - **Topo:** ≥ 18% (`92 px`) livres.
  - **Esquerda e Direita:** ≥ 15% (`77 px`) livres de cada lado.
  - **Base:** ≥ 10% (`51 px`) livres abaixo dos pés (sola dos pés alinhada em `y = 460 px`).
  - **VFX Isolados:** ≥ 18% livres nos **4 lados**, sem corpo do personagem dentro da célula.
- **Direção:** Todos os quadros virados para a **DIREITA** (o motor espelha automaticamente para a esquerda).

---

## 2. Heróis Jogáveis (9 Personagens Existentes)

Personagens já presentes em `spritesPersonagens/`:
`chopper`, `goku`, `inuyasha`, `luffy`, `naruto`, `sasuke`, `seiya`, `sukuna`, `zoro` (cada um com 4 fases: `fase_1` a `fase_4`).

### 2.1. O que já podemos reaproveitar no Beat 'em Up
- `idle` (guarda parada na rua)
- `run` (corrida com duplo toque `→ →`)
- `jump` (salto vertical / diagonal)
- `block` e `hitstun` (defesa e reação a golpes)
- `ataque_1` (combo leve), `ataque_2` (golpe pesado / avanço), `ataque_3` (especial médio), `ataque_4` (Ultimate limpa-tela) + `vfx_ataque_1..4`

### 2.2. Ações Faltantes nos Heróis para o Estilo Beat 'em Up (SNES)

| Ação (`CanonicalAction`) | Arquivo Alvo (`overrides/<char>/<fase>/`) | Status Atual | Papel no Beat 'em Up |
|---|---|---|---|
| `walk` | `walk_3x2.png` | **Faltante** (existe no tipo TS, sem sprites) | Caminhada cadenciada em 2.5D (andar pelas ruas para cima/baixo/lados sem parecer que está sprintando). |
| `air_ataque_1` | `air_ataque_1_3x2.png` | **Faltante** (existe no tipo TS, sem sprites) | Voadora / chute ou golpe aéreo ao apertar ataque durante o pulo (marca registrada de SNES). |
| `grab` | `grab_3x2.png` | **Faltante** (novo no código) | Agarrar NPC por perto pela gola/ombro + joelhadas/socos curtos no clinch. |
| `throw` | `throw_3x2.png` | **Faltante** (novo no código) | Arremessar o NPC agarrado por cima do ombro para derrubar outros inimigos no caminho. |
| `knockdown` | `knockdown_3x2.png` | **Parcial** (falta em várias fases) | Queda de costas e quique no asfalto ao levar golpe pesado de Boss. |
| `getup` | `getup_3x2.png` | **Parcial** (falta em várias fases) | Levantar do chão com breve invulnerabilidade. |
| `pickup` | `pickup_3x2.png` | **Faltante** (novo no código, opcional) | Abaixar rápido para pegar item de cura no chão (ex.: pastel, açaí, água de coco). |

> [!TIP]
> **Prioridade de geração para os Heróis:** Comece gerando `walk_3x2.png`, `air_ataque_1_3x2.png`, `grab_3x2.png` e `throw_3x2.png` primeiro para a **`fase_1`** dos heróis que você for testar primeiro no modo Beat 'em Up (ex.: Goku, Luffy, Naruto), anexando o `idle` daquela fase como referência na IA geradora.

### 2.3. Template Rápido para Gerar Ações Faltantes dos Heróis
Use o template abaixo anexando o `idle` do personagem como referência:

```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255) across all 6 cells. NO grid lines, NO borders, NO dividers, NO frame numbers, NO text, NO floor shadows.
ART STYLE: high-contrast 2D shonen anime cel-shading matching the attached character reference exactly (crisp dark ink outlines, sharp highlights, NO pixel art, NO 3D).
SAFE ZONE (CRITICAL): Keep character 100% INSIDE each 512x512 cell with at least 18% empty #FF00FF margin at TOP, 15% on LEFT and RIGHT, and 10% at BOTTOM. Feet anchored on y=460px.
CONSISTENCY: Strictly facing RIGHT in all 6 frames, same proportions and outfit as the reference image.

CHARACTER: [NOME DO HERÓI — FASE X]
ACTION: [ESCOLHA UMA:
- WALK: steady street-brawler walking cycle (F1 contact left foot -> F2 down -> F3 passing -> F4 contact right foot -> F5 down -> F6 passing loop)
- AIR_ATAQUE_1: classic SNES flying jump kick / mid-air downward strike (F1 windup in air -> F2-F4 extended flying kick/strike -> F5-F6 recoil in air)
- GRAB: close-range collar grab clinch & knee strike (F1 reach forward -> F2 lock collar -> F3-F4 close knee/gut punch -> F5 hold -> F6 release)
- THROW: shoulder/suplex throw forward to the right (F1 grab stance -> F2 lift up -> F3-F4 hurl forward -> F5 follow-through -> F6 return to guard)
- PICKUP: quick crouch-and-grab item off the street (F1 bend knees -> F2-F3 hand touches ground -> F4 lift item -> F5-F6 stand back up)]
```

---

## 3. Resumo do que Falta para Inimigos e Cenários

| Categoria | Quantidade | Folhas / Arquivos Necessários | Documento com os Prompts |
|---|---|---|---|
| **3 Tipos de NPCs** (`npc_politico`, `npc_civil_brasil`, `npc_civil_vermelho`) | 3 arquétipos (1 fase cada) | **8 sheets `3×2` por NPC** = **24 sheets** | [PROMPT_NPCS_BEAT_EM_UP.md](file:///home/spira/animekombat/docs/PROMPT_NPCS_BEAT_EM_UP.md) |
| **Bosses Regionais** (1 por mapa, gerado só com o nome) | 1+ por mapa (1 fase cada) | **13 sheets `3×2` + 4 VFX `3×2`** = **17 sheets por Boss** | [PROMPT_BOSS_BEAT_EM_UP.md](file:///home/spira/animekombat/docs/PROMPT_BOSS_BEAT_EM_UP.md) |
| **Backgrounds Panorâmicos** (3 mapas × 3 trechos) | 9 trechos (`1536×1024` cada) | **9 PNGs** de cenário contínuo | [BEAT_EM_UP_BACKGROUNDS.md](file:///home/spira/animekombat/docs/BEAT_EM_UP_BACKGROUNDS.md) |

