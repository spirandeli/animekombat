# Sprites Para Correção — Pendências Restantes (`sprites_para_correção.md`)

Após a integração de `spritesPersonagens/sprites_correção/spritesheets_padrao_definitivo (1).zip`, os problemas **#7** (Naruto em 6 frames `3×2` — `0/362` cortados) e **#12** (`dash`, `land`, `knockdown`, `victory` para todos os 9 personagens) foram **resolvidos**.

Este documento mantém apenas os **prompts de regeneração das folhas antigas que ainda apresentam corte de borda (`clippedEdges`)** no [manifest.json](file:///home/spira/animekombat/public/assets/characters/manifest.json) (Problema **#3** em [TOP_15_PROBLEMAS_GAMEPLAY.md](file:///home/spira/animekombat/TOP_15_PROBLEMAS_GAMEPLAY.md)).

---

## Regras Técnicas Obrigatórias
- **Resolução e Grid `3×2`:** `1536 × 1024 px` (`512 × 512 px` por célula).
- **Fundo:** `#FF00FF` (RGB `255, 0, 255`) 100% plano e puro, sem vinheta, sombra no chão ou linhas de grade.
- **Safe Zone Anti-Corte:** Mínimo **92 px (18%)** livres no topo, **77 px (15%)** livres na esquerda e direita e **51 px (10%)** na base. Baseline dos pés em `y = 460 px`, olhando para a **DIREITA**.

---

## Folhas Restantes com Corte (≥3/6 frames cortados)

| Personagem | Taxa Restante | Folhas Pendentes de Regeneração |
|---|---|---|
| **Goku** | 61/398 (15,3%) | `fase_1/ataque_3`, `fase_1/crouch`, `fase_2/ataque_2`, `fase_2/ataque_3`, `fase_2/crouch`, `fase_2/block`, `fase_2/hitstun`, `fase_2/vfx_ataque_1`, `fase_3/ataque_3`, `fase_3/jump`, `fase_4/ataque_1`, `fase_4/ataque_4`, `fase_4/hitstun` |
| **Chopper** | 63/368 (17,1%) | `fase_2/run`, `fase_2/jump`, `fase_2/hitstun`, `fase_2/vfx_ataque_2`, `fase_3/ataque_3`, `fase_4/jump`, `fase_4/hitstun`, `fase_4/ataque_1`, `fase_4/ataque_2`, `fase_4/ataque_3`, `fase_4/vfx_ataque_2`, `fase_4/vfx_ataque_4` |
| **Sukuna** | 82/368 (22,3%) | `fase_1/block`, `fase_2/crouch`, `fase_2/ataque_1`, `fase_2/run`, `fase_2/block`, `fase_2/hitstun`, `fase_2/ataque_3`, `fase_3/ataque_3`, `fase_3/ataque_1`, `fase_4/crouch`, `fase_4/ataque_2`, `fase_4/ataque_3`, `fase_4/run`, `fase_4/jump`, `fase_4/vfx_ataque_4` |
| **Sasuke** | 63/368 (17,1%) | `fase_2/ataque_3`, `fase_2/ataque_4`, `fase_3/idle`, `fase_3/run`, `fase_3/jump`, `fase_3/block`, `fase_3/ataque_1`, `fase_3/ataque_3`, `fase_3/ataque_4`, `fase_4/ataque_1`, `fase_4/ataque_3` |
| **Zoro** | 60/368 (16,3%) | `fase_1/ataque_3`, `fase_2/idle`, `fase_2/crouch`, `fase_2/hitstun`, `fase_2/ataque_2`, `fase_2/ataque_3`, `fase_2/ataque_4`, `fase_3/vfx_ataque_4`, `fase_4/ataque_3`, `fase_4/vfx_ataque_4` |
| **Luffy** | 57/368 (15,5%) | `fase_1/vfx_ataque_3`, `fase_2/ataque_1`, `fase_2/ataque_3`, `fase_2/ataque_4`, `fase_2/run`, `fase_3/ataque_1`, `fase_3/run`, `fase_3/vfx_ataque_1`, `fase_4/ataque_1`, `fase_4/ataque_2`, `fase_4/ataque_4`, `fase_4/vfx_ataque_2` |
| **Seiya** | 45/368 (12,2%) | `fase_1/ataque_2`, `fase_2/ataque_4`, `fase_2/vfx_ataque_4`, `fase_3/ataque_3`, `fase_3/vfx_ataque_4`, `fase_4/run`, `fase_4/ataque_2`, `fase_4/ataque_4` |
| **Inuyasha** | 40/368 (10,9%) | `fase_3/ataque_1`, `fase_3/vfx_ataque_4`, `fase_4/block`, `fase_4/ataque_1`, `fase_4/ataque_3`, `fase_4/ataque_4` |
| **Naruto** | **0/362 (0,0%)** | Nenhuma pendência. |

---

## Prompt Padrão para Regeneração das Folhas Pendentes

### Template A — Ação de Personagem (`3×2`, `1536×1024`)
```text
Create a 2D anime fighting game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255) across 100% of empty space. NO grid lines, NO borders, NO dark vignette, NO floor shadow.
ART STYLE: high-contrast 2D shonen anime arcade fighting game cel-shading, crisp dark ink outlines, sharp highlights.
SAFE ZONE (CRITICAL): Scale the character so hair, aura, swords, horns, elastic limbs, and energy NEVER touch cell borders. Keep at least 92px (18%) empty #FF00FF at TOP, 77px (15%) on LEFT and RIGHT, and 51px (10%) at BOTTOM. Feet aligned on baseline y=460px, strictly facing RIGHT.
CHARACTER & PHASE: [PERSONAGEM E FASE — ex: Son Goku Super Saiyajin 2 / Ryomen Sukuna Era Heian].
ACTION (6 frames F1->F6): [AÇÃO — ex: crouch / block / hitstun / ataque_3 / ataque_4].
```

### Template B — VFX Isolado (`3×2`, `1536×1024`, Sem Personagem)
```text
Create a 2D anime fighting game isolated visual effect (VFX) spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255) across 100% of empty space. NO grid lines, NO borders, NO character body inside any frame.
SAFE ZONE (CRITICAL): Center the effect inside each 512x512 cell and keep at least 92px (18%) empty #FF00FF margin on ALL FOUR SIDES (top, bottom, left, right).
SOURCE TECHNIQUE: [VFX — ex: vfx_ataque_4 de Zoro King of Hell / vfx_ataque_2 de Chopper Monster Point].
6-FRAME LIFECYCLE: F1 ignition spark -> F2 rapid buildup -> F3 peak impact -> F4 shockwave ring -> F5 shattering shards -> F6 dissipation.
```
