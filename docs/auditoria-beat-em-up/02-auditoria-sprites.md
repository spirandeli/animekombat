# 02 — Auditoria Completa de Spritesheets e Frames

## 1. Metodologia Aplicada

1. **Análise métrica automatizada** sobre todas as **12.555 texturas WebP** de heróis e **450 texturas WebP** de NPCs/Bosses (`rawW`, `rawH`, `bboxInQuad`, `clippedEdges`, variação de linha dos pés `footSpan`, razão altura máxima/mínima e hash MD5 para duplicatas).
2. **Inspeção visual direta** com folhas de contato numeradas (`F1..F6` / `F1..F10`) para Bosses, NPCs e ações Beat 'em Up de heróis.
3. **Limpeza de grade na extração (`process_beatemup.py`)**: Foi detectado nos `.zip` originais (especialmente `boss_pavanato`, `boss_lula/idle`, `vfx_ataque_2/4`) que linhas divisórias escuras nas bordas das células `512×512` faziam `px[0,0]` cair fora do magenta (`#FF00FF`). O extrator foi ajustado com `_strip_outer_cell_grid_border(..., depth=6)` e `_find_magenta_grid_splits(...)`, eliminando resíduos de borda nos WebPs finais.

---

## 2. Auditoria Individual — Inimigos Comuns (NPCs)

### 2.1 `npc_civil_brasil` (Brawler Camisa Brasil — `ref: 260×407`)
- **Grid:** 8 folhas `3×2` (`1536×1024 px`), 48 frames válidos, **0 `clippedEdges`**.
- **Alinhamento de pés (`footSpan`):** `idle` `3px`, `walk` `13px`, `run` `14px`, `ataque_1` `4px`, `ataque_2` `3px` (excelente).
- **PROBLEMA CONFIRMADO (`ko_defeat` F4):** Na folha visual de `ko_defeat`, os frames `F1, F2, F3, F5, F6` mostram o personagem caindo com a cabeça à esquerda e pés à direita; porém o **F4 (`423×236`) está invertido horizontalmente** (cabeça à direita, pés à esquerda), causando giro instantâneo de 180° no meio da queda!
- **Lacuna de cobertura:** Sem `getup` e sem `block`.

### 2.2 `npc_civil_vermelho` (Brawler Camisa Vermelha — `ref: 267×404`)
- **Grid:** 8 folhas `3×2`, 48 frames válidos.
- **Cortes (`clippedEdges`):** **1 frame com corte** — `knockdown` F2 (`['R']`).
- **Alinhamento:** `idle` `1px`, `walk` `12px`, `ataque_1` `3px`, `ataque_2` `10px`. `run` tem `footSpan = 23px` (normal em corrida com salto entre passadas).
- **Lacuna de cobertura:** Sem `getup` e sem `block`.

### 2.3 `npc_politico` (Político da Pasta — `ref: 216×406`)
- **Grid:** 8 folhas `3×2`, 48 frames válidos.
- **Cortes (`clippedEdges`):** **3 frames com corte** — `ataque_2` F3 (`['R']`), F4 (`['R']`) e `knockdown` F6 (`['R']`).
- **Alinhamento:** `idle` `1px`, `walk` `6px`, `ataque_1` `6px`, `ataque_2` `3px`, `hitstun` `2px`.
- **Qualidade visual:** Excelente consistência de traje/pasta executiva em `ataque_1` (`441×461` na extensão máxima).
- **Lacuna de cobertura:** Sem `run` e sem `block`.

---

## 3. Auditoria Individual — Chefões Regionais (Bosses)

Todos os 3 Bosses seguem o padrão `13 ações + 4 VFX = 17 sheets` (102 frames cada, `refBodyHeight` consistente em `404..406 px`).

### 3.1 `boss_lula` (Presidente Lula — `ref: 329×406`)
- **Cortes (`clippedEdges`):** **9 frames com corte**:
  - Ações: `ataque_1` F1 (`L`), `ataque_3` F3 (`R`), F4 (`R`), `ataque_4` F4 (`L`), `block` F3 (`R`), `ko_defeat` F6 (`R`), `victory` F3 (`T`).
  - VFX: `vfx_ataque_4` F3 (`T, R`), F4 (`R, B`).
- **PROBLEMA CONFIRMADO (`ataque_4` F4):** Na folha de contato de `boss_lula/ataque_4`, o **F4 (`503×499`)** possui explosão ígnea cobrindo quase toda a célula, escurecendo o corpo do boss e tocando as bordas superior/lateral com aspecto de bloqueio sombreado.
- **Sequência `ataque_1`:** F1 (windup com poeira à esquerda), F2 (aura), F3 (cruzado horizontal), F4 (slam vertical com duas mãos e faísca no chão), F5–F6 (recuperação). A transição F3→F4 alterna dois golpes distintos mas legíveis em sequência.

### 3.2 `boss_pavanato` (Vereador Pavanato — `ref: 260×406`)
- **Cortes (`clippedEdges`):** **6 frames com corte** (todos em ações; **0 cortes nos VFX**):
  - `ataque_2` F4 (`L`), `ataque_3` F3 (`R`), F4 (`R` — pontas da onda sonora do megafone), `ataque_4` F2 (`T`), F4 (`T, L`), `dash` F4 (`L`).
- **Qualidade visual:** Identidade (blazer azul, camisa branca, fitinha colorida no pulso direito) consistente entre frames; `ataque_3` com megafone é altamente legível.

### 3.3 `boss_flavio_bolsonaro` (Senador Flávio — `ref: 287×404`)
- **Cortes (`clippedEdges`):** **16 frames com corte** (o maior índice entre os Bosses):
  - Ações: `ataque_1` F3 (`L, R`), F4 (`R`), `ataque_3` F3 (`R`), F4 (`T, R`), `ataque_4` F1 (`T`), F2 (`T`), F4 (`T, L, R`), `block` F3 (`R`), F4 (`R`), F5 (`L, R`), `dash` F3 (`L`), F4 (`L, R`), F5 (`L, R`), F6 (`L`), `victory` F3 (`T`).
  - VFX: `vfx_ataque_4` F3 (`T`).
- **PROBLEMA CONFIRMADO (`ataque_4` F2):** Em `boss_flavio_bolsonaro/ataque_4`, o **F2 (`474×507`)** altera o penteado social para cabelo espetado estilo Super Saiyajin e o coloca flutuando sem contato no chão, quebrando a identidade visual entre F1 e F3.

---

## 4. Auditoria de Sprites — Heróis Jogáveis (Foco Beat 'em Up)

Para os 9 heróis (36 fases, `manifest.json`), **0 frames possuem `clippedEdges` nas ações/VFX** após os passes anteriores de sanitização, e todas as 20 ações Beat 'em Up estão presentes. Problemas observados:

1. **PROBLEMA CONFIRMADO — Escala anômala em `zoro/fase_4` (`refBodyHeight = 256`):**
   - `zoro/fase_1` (`327`), `fase_2` (`325`), `fase_3` (`318`), mas `fase_4` caiu para `256` porque os frames de `idle` em `zoro/fase_4` têm altura `242..264 px` (postura aberta com 3 espadas), enquanto `walk` mede `296..323 px` (`303px` médio).
   - Em `BeatEmUpScene.ts:1194`, `actorScale = targetBodyHeight / refBodyHeight` amplia `zoro/fase_4` para `264 / 256 = 1.031×`, fazendo Zoro Fase 4 ficar ~27% maior que nas fases 1–3 quando anda ou ataca.
2. **OBSERVAÇÃO — Duplicatas em `luffy` (`idle` e `victory`):**
   - `luffy/fase_1..4/idle` possuem 10 frames com `4` hashes MD5 duplicados (`F7=F1`, `F8=F4`, `F9=F3`, `F10=F2`) — trata-se de loop palíndromo de respiração intencional, visualmente suave.
   - `luffy/fase_2` e `fase_4` `victory` repetem o padrão palíndromo (`dup=4`).
3. **Variação de altura em `knockdown` / `getup` (`hr = 1.47..5.15`):**
   - Esperado fisicamente porque o personagem passa da posição em pé (~330px) para deitado no chão (~70–150px).
4. **`goku/fase_1/grab`:** Contém sub-fases distintas dentro dos 10 frames (`F1–F6` agarrão/clinch, `F7–F8` joelhada, `F9–F10` soltura), porém o código atual reproduz tudo linearmente em `2.2s` sem vincular `F7–F8` ao aperto de `A1`.
