# Prompt Gerador para Novos Personagens (Nome + 4 Evoluções)

Este guia traz o **Prompt Mestre Parametrizado** para criar do zero todo o pacote de **56 spritesheets `3×2` (336 frames)** de qualquer novo personagem do Anime Kombat informando **apenas o nome e as 4 evoluções**.

O padrão já gera os caminhos e nomes de arquivo compatíveis com [process_sprites_2x2.py](file:///home/spira/animekombat/scripts/process_sprites_2x2.py), [Menus.ts](file:///home/spira/animekombat/src/ui/Menus.ts) e [SaveManager.ts](file:///home/spira/animekombat/src/storage/SaveManager.ts).

---

## 1. Prompt Mestre (Cole em uma IA — Preencha Só os 5 Campos)

Copie o bloco inteiro abaixo, substitua **apenas** as 5 linhas em `[PREENCHER]` e envie para o Gemini / ChatGPT / Claude / Antigravity. Ele vai montar a bíblia visual das 4 fases + todos os **56 prompts prontos para o seu gerador de imagens**.

```text
Você é o Diretor de Arte e Spritesheets do jogo 2D de luta anime "Anime Kombat" (mesmo padrão visual de Son Goku, Monkey D. Luffy e Ryomen Sukuna já existentes no jogo).

Receba apenas estes dados de entrada:
- PERSONAGEM: [NOME DO PERSONAGEM]
- FASE 1: [NOME DA EVOLUÇÃO 1]
- FASE 2: [NOME DA EVOLUÇÃO 2]
- FASE 3: [NOME DA EVOLUÇÃO 3]
- FASE 4: [NOME DA EVOLUÇÃO 4]

TAREFA COMPLETA:
Gere o pacote completo de produção de sprites para este novo personagem contendo 4 fases × 14 spritesheets = 56 prompts de imagem prontos para copiar e colar em gerador de imagens (em INGLÊS técnico nos prompts para máxima aderência visual, mantendo rótulos e instruções em português).

REGRAS OBRIGATÓRIAS DO JOGO (NÃO QUEBRAR NENHUMA):
1. ARTE & ESTILO (padrão oficial Anime Kombat):
   - Estilo 2D shonen anime fighting game cel-shading de alto contraste, traço limpo em tinta escura (crisp dark ink outlines), highlights marcantes, proporções atléticas heroicas (SEM pixel art, SEM render 3D).
   - Grid limpo 3×2 (3 colunas × 2 linhas = 6 quadros individuais, ordem esquerda→direita, cima→baixo, resolução sugerida 1536×1024px).
   - Fundo sólido plano magenta puro `#FF00FF` (RGB 255,0,255) em todas as células. PROIBIDO linhas de grade, bordas, números, texto ou sombra projetada no fundo.
   - SAFE ZONE ANTI-CORTE (CRÍTICO): Deixar pelo menos 18% de margem vazia `#FF00FF` no TOPO, 14% na ESQUERDA e DIREITA e 10% na BASE em TODAS as 6 células de personagem. Cabelo espetado, aura, capa, arma, invocações e feixes NUNCA podem encostar nas bordas da célula.
   - Para VFX isolados (`vfx_ataque_1..4`): SEM corpo do personagem dentro do quadro e pelo menos 18% de margem `#FF00FF` vazia nos 4 LADOS (topo, base, esquerda, direita).
   - DIREÇÃO & ÂNCORA: Personagem sempre virado para a DIREITA em todos os quadros de ação, com mesma altura corporal relativa e pés alinhados na mesma linha invisível de chão.

2. ESTRUTURA DAS 14 SHEETS POR FASE (gerar todas para cada uma das 4 fases):
   Ações básicas & defesa (6 frames):
   - `idle_3x2.png` (loop suave F6→F1 em guarda de combate)
   - `run_3x2.png` (corrida dinâmica em avanço para a direita, loop F6→F1)
   - `jump_3x2.png` (salto completo: preparação, decolagem, ápice mantendo 18% no topo, descida, aterrissagem)
   - `crouch_3x2.png` (AGACHADO DE VERDADE: quadril baixo perto dos calcanhares, altura total ~60-65% da altura em pé, NUNCA ereto)
   - `block_3x2.png` (defesa fechada absorvendo impacto com leve brilho defensivo)
   - `hitstun_3x2.png` (reação recebendo golpe, recuo e recuperação para guarda)

   4 Golpes icônicos daquela fase (escolha golpes canônicos fiéis à evolução):
   - `ataque_1_<slug_golpe1>_3x2.png` → Golpe 1: Combo rápido corpo-a-corpo (curta distância)
   - `ataque_2_<slug_golpe2>_3x2.png` → Golpe 2: Avanço/investida ou golpe pesado de média distância
   - `ataque_3_<slug_golpe3>_3x2.png` → Golpe 3: Técnica média/longa distância ou projétil assinatura (o jogo espelha/rotaciona para cima/baixo/diagonais)
   - `ataque_4_<slug_golpe4>_3x2.png` → Golpe 4: ULTIMATE cinemático máximo da evolução

   4 Efeitos VFX isolados correspondentes (SEM personagem, 6 frames F1→F6):
   - `vfx/vfx_ataque_1_3x2.png` (impacto/faísca do Golpe 1)
   - `vfx/vfx_ataque_2_3x2.png` (rastro/explosão do Golpe 2)
   - `vfx/vfx_ataque_3_3x2.png` (projétil/onda/corte do Golpe 3)
   - `vfx/vfx_ataque_4_3x2.png` (detonação/efeito máximo do Ultimate)

FORMATO EXATO DA SUA RESPOSTA:
Parte A — Resumo do Personagem:
- Slug da pasta (`char_id` em minúsculas sem acento, ex.: `naruto_uzumaki`)
- Bloco `PHASE_COLORS` sugerido (hex da aura + label de cada uma das 4 fases para o `scripts/process_sprites_2x2.py`)
- Bíblia Visual consistente das 4 fases (detalhando exatamente cabelo, olhos, traje, armas/acessórios, tatuagens/marcas e cor de aura para manter consistência absoluta entre fases)
- Dica de fluxo Image-to-Image: lembrar de gerar `idle_3x2.png` primeiro em cada fase e usar o Frame 1 dele como referência fixa para os outros 13 prompts da mesma fase.

Parte B — Os 56 Prompts Prontos (organizados por `Fase 1` → `Fase 4`):
Para CADA uma das 56 folhas, entregue:
1. Caminho exato de destino: `spritesPersonagens/overrides/<char_slug>/fase_<1..4>_<fase_slug>/<nome_arquivo>`
2. Bloco de código pronto para copiar e colar no gerador de imagem, já contendo o estilo técnico, o `CHAR_DESIGN` da fase, a regra anti-corte `#FF00FF` e a coreografia detalhada frame a frame `F1 → F6` específica daquela ação/golpe/VFX.
```

---

## 2. Templates Diretos (Para Colar Direto no Gerador de Imagem)

Se preferir ir **direto para o gerador de imagem** (Nano Banana / Gemini Image / GPT Image) sem passar por uma IA intermediária, use estes 2 templates.

> **Regra de ouro para manter o personagem idêntico:** em cada fase, gere o `idle_3x2.png` primeiro. Depois, ao gerar `run`, `jump`, `crouch`, `block`, `hitstun` e `ataque_1..4` da mesma fase, **anexe o `idle` recém-gerado como imagem de referência**!

### Template Direto A — Ações do Personagem (`3×2`)
```text
Create a 2D anime fighting game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells, left-to-right top-to-bottom progression, 1536x1024px total).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255) across all 6 cells. NO grid lines, NO borders, NO dividers, NO frame numbers, NO text, NO floor shadows.
ART STYLE: high-contrast 2D shonen anime arcade fighting game cel-shading, crisp dark ink outlines, sharp highlights, heroic proportions, matching Dragon Ball / One Piece / Jujutsu Kaisen 2D fighters (NOT 3D, NOT pixel art).
SAFE ZONE (CRITICAL): Keep character, spiky hair, aura, cape, weapons, summons, and energy blasts 100% INSIDE each cell with at least 18% empty #FF00FF margin at TOP, 14% margin on LEFT and RIGHT, and 10% margin at BOTTOM. NEVER clip any aura, weapon tip, or blast at cell borders.
CONSISTENCY: Strictly facing RIGHT in every cell, consistent height/proportions across F1-F6, feet anchored on the same ground line.

CHARACTER & EVOLUTION: [NOME DO PERSONAGEM] — [EVOLUÇÃO ATUAL, ex: Modo Kurama]. Visual details: [DESCREVA OU ANEXE REFERÊNCIA DO IDLE].
SHEET TYPE: [ESCOLHA: IDLE / RUN / JUMP / CROUCH (~60% standing height, deeply crouched!) / BLOCK / HITSTUN / ATAQUE_1 (fast melee combo) / ATAQUE_2 (dash rush strike) / ATAQUE_3 (signature ranged projectile) / ATAQUE_4 (signature ultimate finisher)].
6-FRAME CHOREOGRAPHY (F1->F6): F1 windup/start -> F2 anticipation/build -> F3 main extension/peak strike -> F4 climax impact flare -> F5 follow-through/recoil -> F6 clean return to guard.
```

### Template Direto B — VFX Isolado (`3×2`, Sem Personagem)
```text
Create a 2D anime fighting game isolated visual effect (VFX) spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells, left-to-right top-to-bottom sequence, 1536x1024px total).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255) across all 6 cells. NO grid lines, NO borders, NO numbers, NO text, NO character body inside any frame.
ART STYLE: crisp 2D shonen anime cel-shaded energy effect with bold dark/colored edges and bright hot core, high contrast, sharp shards and shockwaves (NOT 3D realistic smoke).
SAFE ZONE (CRITICAL): Center the effect inside each cell and keep at least 18% empty #FF00FF margin on ALL FOUR SIDES (top, bottom, left, right) in every frame so rings, beams, lightning, and debris never clip.

SOURCE TECHNIQUE: VFX for [NOME DO PERSONAGEM] ([EVOLUÇÃO ATUAL]) — [ESCOLHA: vfx_ataque_1 / vfx_ataque_2 / vfx_ataque_3 / vfx_ataque_4 — nome do golpe].
6-FRAME LIFECYCLE: F1 tiny ignition spark -> F2 rapid buildup -> F3 maximum peak explosion/beam/slash impact -> F4 secondary shockwave ring -> F5 shattering shards/energy trails -> F6 clean dissipation embers.
```

---

## 3. Como Salvar e Ativar no Jogo Sem Complicação

O pipeline em [process_sprites_2x2.py](file:///home/spira/animekombat/scripts/process_sprites_2x2.py) descobre **personagens novos, nomes de fases e nomes de golpes automaticamente** pelo caminho das pastas:

```text
spritesPersonagens/
└── overrides/
    └── <char_slug>/                              # ex.: naruto_uzumaki (vira "Naruto Uzumaki")
        ├── fase_1_<slug_evolucao_1>/             # ex.: fase_1_genin_classico
        │   ├── idle_3x2.png
        │   ├── run_3x2.png
        │   ├── jump_3x2.png
        │   ├── crouch_3x2.png
        │   ├── block_3x2.png
        │   ├── hitstun_3x2.png
        │   ├── ataque_1_<nome_golpe>_3x2.png     # ex.: ataque_1_combo_clones_3x2.png
        │   ├── ataque_2_<nome_golpe>_3x2.png     # ex.: ataque_2_rasengan_3x2.png
        │   ├── ataque_3_<nome_golpe>_3x2.png     # ex.: ataque_3_oodama_rasengan_3x2.png
        │   ├── ataque_4_<nome_golpe>_3x2.png     # ex.: ataque_4_rasenshuriken_3x2.png
        │   └── vfx/
        │       ├── vfx_ataque_1_3x2.png
        │       ├── vfx_ataque_2_3x2.png
        │       ├── vfx_ataque_3_3x2.png
        │       └── vfx_ataque_4_3x2.png
        ├── fase_2_<slug_evolucao_2>/ ...         # mesmas 14 sheets
        ├── fase_3_<slug_evolucao_3>/ ...         # mesmas 14 sheets
        └── fase_4_<slug_evolucao_4>/ ...         # mesmas 14 sheets
```

Depois de colocar os 56 PNGs dentro de `spritesPersonagens/overrides/<char_slug>/`, rode:

```bash
npm run process-sprites && npm run build
```

O personagem novo já aparece automaticamente na tela de seleção ([Menus.ts](file:///home/spira/animekombat/src/ui/Menus.ts)) com progressão de XP/nível salva ([SaveManager.ts](file:///home/spira/animekombat/src/storage/SaveManager.ts)) e ataques direcionais gerados automaticamente.

### Ajustes Opcionais (Para Polimento Extra)
- **Cor da aura e acentuação dos nomes:** adicione o personagem em `PHASE_COLORS` e `CHAR_DISPLAY_NAMES` no topo de [process_sprites_2x2.py](file:///home/spira/animekombat/scripts/process_sprites_2x2.py) (se não adicionar, o jogo usa `#38bdf8` por padrão).
- **Alcance/velocidade customizada dos golpes:** se algum golpe precisar de hitbox ou velocidade diferente do padrão, basta adicionar um bloco `else if (this.charId === '<char_slug>')` em `getAttackSpec` dentro de [Fighter.ts](file:///home/spira/animekombat/src/game/Fighter.ts).
