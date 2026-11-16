# Prompt Mestre Parametrizado — Boss Regional (Beat 'em Up)

Este guia traz o **Prompt Mestre Parametrizado** para gerar todas as **17 spritesheets `3×2` (102 frames)** de qualquer Chefão (Boss) do modo **Beat 'em Up: Ruas do Brasil** informando **apenas o nome dele** (e opcionalmente o mapa/cidade).

---

## 1. Prompt Mestre (Cole em uma IA — Preencha Só `[NOME DO BOSS]`)

Copie o bloco inteiro abaixo, substitua **apenas** `[NOME DO BOSS]` (e `[MAPA / CIDADE]`, se desejar) e envie para o Gemini / ChatGPT / Claude / Antigravity. Ele vai gerar a bíblia visual estilizada 2D anime do chefão + os **17 prompts individuais** prontos para colar no seu gerador de imagens.

```text
Você é o Diretor de Arte e Spritesheets do jogo 2D Beat 'em Up estilo Super Nintendo "Anime Kombat: Ruas do Brasil" (mesmo padrão visual 2D shonen anime cel-shading de alto contraste dos heróis do jogo).

Receba apenas este dado de entrada:
- NOME DO BOSS: [NOME DO BOSS]
- MAPA / CIDADE (opcional): [MAPA / CIDADE, ex: Brasília / Pelourinho / Rio de Janeiro]

TAREFA COMPLETA:
Crie uma versão estilizada, caricata e imponente em estilo **2D shonen anime boss** para este personagem e gere o pacote completo de **17 prompts de spritesheet `3×2`** (13 ações do Boss + 4 VFX isolados) prontos para copiar e colar em gerador de imagens (prompts em INGLÊS técnico, rótulos e caminhos em português).

REGRAS OBRIGATÓRIAS DO JOGO (NÃO QUEBRAR NENHUMA):
1. ARTE & ESTILO:
   - Estilo 2D shonen anime arcade beat 'em up cel-shading, traço limpo em tinta escura (crisp dark ink outlines), highlights marcantes, presença física ~15-20% mais imponente que um NPC comum (SEM pixel art, SEM render 3D, SEM fotorrealismo).
   - Grid limpo 3×2 (3 colunas × 2 linhas = 6 quadros individuais, ordem esquerda→direita, cima→baixo, resolução 1536×1024 px, células 512×512 px).
   - Fundo sólido plano magenta puro `#FF00FF` (RGB 255,0,255) em todas as células. PROIBIDO linhas de grade, bordas, números, texto ou sombra projetada no fundo.
   - SAFE ZONE ANTI-CORTE (CRÍTICO): Deixar pelo menos 18% de margem vazia `#FF00FF` no TOPO, 15% na ESQUERDA e DIREITA e 10% na BASE em TODAS as 6 células. Cabelo, terno, faixa presidencial/estadual, aura, armas ou rajadas NUNCA podem encostar nas bordas da célula.
   - Para VFX isolados (`vfx_ataque_1..4`): SEM corpo do Boss dentro do quadro e pelo menos 18% de margem `#FF00FF` vazia nos 4 LADOS.
   - DIREÇÃO & ÂNCORA: Sempre virado para a DIREITA, pés alinhados na linha de chão `y = 460 px`.

2. AS 17 SHEETS OBRIGATÓRIAS DO BOSS (`boss_<slug_do_nome>/fase_1/`):
   Movimento, Defesa & Estados (9 sheets):
   - `idle_3x2.png` (postura imponente de chefão, loop suave F6→F1)
   - `walk_3x2.png` (caminhada pesada e confiante para a direita, loop F6→F1)
   - `dash_3x2.png` (avanço rápido/investida pesada de chefão)
   - `block_3x2.png` (defesa fechada com aura/barreira absorvendo golpe)
   - `hitstun_3x2.png` (reação ao levar golpe, recuo curto e recuperação)
   - `knockdown_3x2.png` (lançado para trás, impacto no chão, quique e deitado)
   - `getup_3x2.png` (levantando do chão com pose intimidadora)
   - `victory_3x2.png` (provocação / risada / discurso de chefão)
   - `ko_defeat_3x2.png` (derrota dramática estilo SNES: tonto, ajoelhando e caindo nocauteado)

   4 Golpes Assinatura do Boss (inspirados na persona/região do Boss):
   - `ataque_1_3x2.png` → Golpe 1: Combo corpo-a-corpo pesado (curta distância)
   - `ataque_2_3x2.png` → Golpe 2: Investida com super-armadura / agarrão ou atropelo (média distância)
   - `ataque_3_3x2.png` → Golpe 3: Ataque de alcance / projétil assinatura (ondas sonoras de discurso, maletas, carimbos gigantes, aura política etc.)
   - `ataque_4_3x2.png` → Golpe 4: ULTIMATE de Boss (golpe de área/fúria que cobre a tela)

   4 Efeitos VFX Isolados (SEM corpo do Boss, 6 frames F1→F6):
   - `vfx/vfx_ataque_1_3x2.png`
   - `vfx/vfx_ataque_2_3x2.png`
   - `vfx/vfx_ataque_3_3x2.png`
   - `vfx/vfx_ataque_4_3x2.png`

FORMATO EXATO DA SUA RESPOSTA:
Parte A — Ficha & Bíblia Visual do Boss:
- Slug da pasta: `boss_<nome_em_snake_case>`
- Cor da aura sugerida (hex) e título de chefe na barra de HP (ex.: `"SENADOR ..."` / `"GOVERNADOR ..."`)
- Bíblia Visual fixa (rosto, cabelo, traje, acessórios regionais, paleta de cores) para manter consistência absoluta entre as 17 sheets.
- Lembrete: gerar `idle_3x2.png` primeiro e anexar o Frame 1 dele como referência fixa nos outros 12 prompts de personagem.

Parte B — Os 17 Prompts Prontos:
Para CADA uma das 17 sheets, entregue:
1. Caminho exato: `spritesPersonagens/overrides/boss_<slug>/fase_1/<nome_arquivo>`
2. Bloco de código pronto para copiar e colar no gerador de imagens contendo estilo técnico, `CHAR_DESIGN` do Boss, Safe Zone `#FF00FF` e coreografia `F1 → F6`.
```

---

## 2. Template Direto (Sem IA Intermediária)

Se quiser gerar direto no gerador de imagens (anexando o `idle_3x2.png` do Boss após o primeiro passo):

```text
Create a 2D anime beat 'em up boss spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255) across all 6 cells. NO grid lines, NO borders, NO dividers, NO frame numbers, NO text, NO floor shadows.
ART STYLE: high-contrast 2D shonen anime arcade boss cel-shading, crisp dark ink outlines, imposing boss proportions (NO pixel art, NO 3D).
SAFE ZONE (CRITICAL): Keep boss, aura, and attacks 100% INSIDE each 512x512 cell with at least 18% empty #FF00FF margin at TOP, 15% on LEFT and RIGHT, and 10% at BOTTOM. Feet anchored on y=460px. Strictly facing RIGHT.

BOSS CHARACTER: [NOME DO BOSS] — [DESCREVA OU ANEXE REFERÊNCIA DO IDLE].
SHEET TYPE: [ESCOLHA: IDLE / WALK / DASH / BLOCK / HITSTUN / KNOCKDOWN / GETUP / VICTORY / KO_DEFEAT / ATAQUE_1 / ATAQUE_2 / ATAQUE_3 / ATAQUE_4].
6-FRAME CHOREOGRAPHY (F1->F6): F1 start/windup -> F2 anticipation -> F3 peak action/strike -> F4 climax impact -> F5 follow-through -> F6 clean return to boss guard.
```

