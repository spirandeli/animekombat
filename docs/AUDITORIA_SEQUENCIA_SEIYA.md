# Auditoria Frame a Frame — Sprites de Seiya (`fase_1` .. `fase_4`)

Este documento registra a auditoria completa das **104 sequências (1.413 frames `.webp` ativos)** do personagem `seiya` em `public/assets/characters/seiya/` e `public/assets/characters/manifest.json`.

## 1. Resumo Executivo & Regras Aplicadas

- **Arquivos originais preservados:** Os pacotes fonte em `spritesPersonagens/expandidos/Seiya/` foram mantidos intocados como backup bruto.
- **Extração limpa `3×2` (`process_expandidos.py`):** Fatiamento com remoção de chroma-key `#FF00FF`, limpeza de bordas/ilhas residuais e descarte automático de células puramente vazias.
- **Escala de combate:** `refBodyHeight` e `refBodyWidth` de `fase_1`..`fase_4` em `manifest.json` foram preservados após a extração.
- **Resumo da reordenação (`reorder_luffy_frames.py --char seiya`):**
  - Sequências com permutação/consolidação de ordem: **15** / 104
  - Sequências com remoção (`trim`) de frames divergentes ou partículas ralas finais: **2** / 104
  - Sequências com política explícita de estabilização de `anchorX`: **88** / 104 (`median_hip`, `core_hip`, `hip`, `body_centroid`)

## 2.1. Fase 1 — Pégaso V2 (26 sequências)

| Sequência | Frames Ativos | Status | Modo `anchorX` | Ordem Aplicada (índices 1-based pré-trim) |
| --- | ---: | --- | --- | --- |
| `air_ataque_1` | 10 | `ok` | `hip` | identidade `1..10` |
| `ataque_1` | 12 | `ok` | `median_hip` | identidade `1..12` |
| `ataque_2` | 15 | `ok` | `median_hip` | identidade `1..15` |
| `ataque_3` | 20 | `ok` | `median_hip` | identidade `1..20` |
| `ataque_4` | 40 | `ok` | `median_hip` | identidade `1..40` |
| `block` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `crouch` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `dash` | 10 | `ok` | `hip` | identidade `1..10` |
| `evolve` | 10 | `ok` | `core_hip` | identidade `1..10` |
| `getup` | 10 | `ok` | `body_centroid` | identidade `1..10` |
| `grab` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `hitstun` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `idle` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `jump` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `ki_charge` | 10 | `reordered` | `core_hip` | `1,2,3,4,5,6,10,7,8,9` |
| `knockdown` | 10 | `reordered` | `body_centroid` | `1,2,3,4,5,6,7,9,10,8` |
| `land` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `pickup` | 10 | `ok` | `core_hip` | identidade `1..10` |
| `run` | 10 | `ok` | `hip` | identidade `1..10` |
| `throw` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `victory` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `walk` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `vfx_ataque_1` | 12 | `ok` | `keep` | identidade `1..12` |
| `vfx_ataque_2` | 15 | `reordered` | `keep` | `1,2,3,4,5,6,7,8,9,12,10,11,13,14,15` |
| `vfx_ataque_3` | 19 | `ok` | `keep` | identidade `1..19` |
| `vfx_ataque_4` | 40 | `reordered` | `keep` | `1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,31,32,25,26,27,28,29,30,33,34,35,36,37,38,39,40` |

## 2.2. Fase 2 — Pégaso Dourada (26 sequências)

| Sequência | Frames Ativos | Status | Modo `anchorX` | Ordem Aplicada (índices 1-based pré-trim) |
| --- | ---: | --- | --- | --- |
| `air_ataque_1` | 10 | `ok` | `hip` | identidade `1..10` |
| `ataque_1` | 12 | `ok` | `median_hip` | identidade `1..12` |
| `ataque_2` | 15 | `ok` | `median_hip` | identidade `1..15` |
| `ataque_3` | 20 | `ok` | `median_hip` | identidade `1..20` |
| `ataque_4` | 40 | `ok` | `median_hip` | identidade `1..40` |
| `block` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `crouch` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `dash` | 10 | `ok` | `hip` | identidade `1..10` |
| `evolve` | 10 | `ok` | `core_hip` | identidade `1..10` |
| `getup` | 10 | `ok` | `body_centroid` | identidade `1..10` |
| `grab` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `hitstun` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `idle` | 9 | `reordered+trimmed` | `median_hip` | `1,2,3,4,5,6,7,9,10` |
| `jump` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `ki_charge` | 10 | `ok` | `core_hip` | identidade `1..10` |
| `knockdown` | 10 | `ok` | `body_centroid` | identidade `1..10` |
| `land` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `pickup` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `run` | 10 | `ok` | `hip` | identidade `1..10` |
| `throw` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `victory` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `walk` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `vfx_ataque_1` | 12 | `reordered` | `keep` | `1,2,3,4,5,6,7,8,9,10,12,11` |
| `vfx_ataque_2` | 15 | `ok` | `keep` | identidade `1..15` |
| `vfx_ataque_3` | 20 | `reordered` | `keep` | `1,2,3,4,5,6,7,8,9,10,11,12,13,19,14,15,18,20,16,17` |
| `vfx_ataque_4` | 40 | `ok` | `keep` | identidade `1..40` |

## 2.3. Fase 3 — Odin Robe (26 sequências)

| Sequência | Frames Ativos | Status | Modo `anchorX` | Ordem Aplicada (índices 1-based pré-trim) |
| --- | ---: | --- | --- | --- |
| `air_ataque_1` | 10 | `ok` | `hip` | identidade `1..10` |
| `ataque_1` | 12 | `ok` | `median_hip` | identidade `1..12` |
| `ataque_2` | 15 | `ok` | `median_hip` | identidade `1..15` |
| `ataque_3` | 20 | `ok` | `median_hip` | identidade `1..20` |
| `ataque_4` | 40 | `ok` | `median_hip` | identidade `1..40` |
| `block` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `crouch` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `dash` | 10 | `ok` | `hip` | identidade `1..10` |
| `evolve` | 10 | `ok` | `core_hip` | identidade `1..10` |
| `getup` | 10 | `ok` | `body_centroid` | identidade `1..10` |
| `grab` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `hitstun` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `idle` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `jump` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `ki_charge` | 10 | `ok` | `core_hip` | identidade `1..10` |
| `knockdown` | 10 | `reordered` | `body_centroid` | `1,2,3,4,5,7,8,9,10,6` |
| `land` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `pickup` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `run` | 10 | `ok` | `hip` | identidade `1..10` |
| `throw` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `victory` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `walk` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `vfx_ataque_1` | 12 | `ok` | `keep` | identidade `1..12` |
| `vfx_ataque_2` | 15 | `reordered` | `keep` | `1,2,3,4,5,6,8,7,9,10,11,12,13,14,15` |
| `vfx_ataque_3` | 20 | `ok` | `keep` | identidade `1..20` |
| `vfx_ataque_4` | 40 | `reordered` | `keep` | `1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,37,35,36,38,39,40` |

## 2.4. Fase 4 — Kamui Divina (26 sequências)

| Sequência | Frames Ativos | Status | Modo `anchorX` | Ordem Aplicada (índices 1-based pré-trim) |
| --- | ---: | --- | --- | --- |
| `air_ataque_1` | 10 | `ok` | `hip` | identidade `1..10` |
| `ataque_1` | 12 | `ok` | `median_hip` | identidade `1..12` |
| `ataque_2` | 15 | `ok` | `median_hip` | identidade `1..15` |
| `ataque_3` | 20 | `ok` | `median_hip` | identidade `1..20` |
| `ataque_4` | 40 | `ok` | `median_hip` | identidade `1..40` |
| `block` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `crouch` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `dash` | 10 | `ok` | `hip` | identidade `1..10` |
| `evolve` | 10 | `ok` | `core_hip` | identidade `1..10` |
| `getup` | 10 | `ok` | `body_centroid` | identidade `1..10` |
| `grab` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `hitstun` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `idle` | 9 | `reordered+trimmed` | `median_hip` | `1,2,3,4,6,7,8,9,10` |
| `jump` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `ki_charge` | 10 | `ok` | `core_hip` | identidade `1..10` |
| `knockdown` | 10 | `reordered` | `body_centroid` | `1,2,3,4,5,6,8,9,10,7` |
| `land` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `pickup` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `run` | 10 | `ok` | `hip` | identidade `1..10` |
| `throw` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `victory` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `walk` | 10 | `ok` | `median_hip` | identidade `1..10` |
| `vfx_ataque_1` | 12 | `reordered` | `keep` | `1,2,3,4,5,6,7,8,9,12,10,11` |
| `vfx_ataque_2` | 15 | `ok` | `keep` | identidade `1..15` |
| `vfx_ataque_3` | 20 | `reordered` | `keep` | `1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,19,16,17,18,20` |
| `vfx_ataque_4` | 40 | `reordered` | `keep` | `1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,22,23,21,24,25,26,27,28,29,30,31,32,33,34,37,38,39,40,35,36` |
