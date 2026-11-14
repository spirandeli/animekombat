# Guia & Inventário de Spritesheets Faltantes (`2×2` → `3×2`)

Documento versionado com o mapeamento completo das **168 spritesheets** do Anime Kombat, destacando todas as **79 folhas com corte de borda (`clippedEdges`)** detectadas atualmente em `public/assets/characters/manifest.json`, além do fluxo de importação no pipeline e os **prompts detalhados** para gerar as folhas novas mantendo 100% da identidade visual atual do jogo.

---

## 1. Resumo do Inventário Atual

| Personagem | Fases | Sheets Totais | Em `3×2` (6 frames) | Em `2×2` (4 frames) | Ações com Corte | VFX com Corte | Total com Corte |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Son Goku** (`goku`) | 4 | 56 | 0 | 56 | 33 | 8 | **41** |
| **Monkey D. Luffy** (`luffy`) | 4 | 56 | 0 | 56 | 17 | 6 | **23** |
| **Ryomen Sukuna** (`sukuna`) | 4 | 56 | 0 | 56 | 10 | 5 | **15** |
| **Total do Jogo** | **12** | **168** | **0** | **168** | **60** | **19** | **79** |

### Ordem de Prioridade Recomendada
1. **P1 — Crítico (VFX + `crouch` + Ultimates/Projéteis com corte `L/R/T/B`):**
   - **19 VFX com corte** (`vfx_ataque_1..4`) + demais **29 VFX** para sair de 4 para 6 quadros suaves e sem pontas cortadas.
   - **12 ações `crouch`** (além de irem para 6 frames, os sprites atuais estão quase em pé como o `idle` e precisam ficar realmente agachados, ~60–65% da altura em pé).
   - **Ataques com corte lateral/superior** (`ataque_3` e `ataque_4` na maioria das fases, ex.: `Kamehameha`, `Punho Do Dragao`, `Bajrang Gun`, `Elefante Maximo`, `Mahoraga`, `Corte Do Mundo`).
2. **P2 — Alto (Goku Fases 2–4 + Movimento/Defesa com corte):**
   - Goku `fase_2`, `fase_3` e `fase_4` estão com corte no topo (`T`) em **todas as 10 ações** por causa do topo da aura/cabelo encostando na borda superior da célula.
   - Luffy e Sukuna com corte pontual em `ataque_1`, `ataque_2`, `run`, `jump`, `block` e `hitstun`.
3. **P3 — Polimento (Upgrade 4 → 6 frames nos sprites sem corte):**
   - As **89 sheets restantes** (`168 - 79`) ainda estão em `2×2` (4 frames); podem ser re-geradas em `3×2` ou receber apenas **2 frames extras (`_extra_2x1.png`)** para completar 6 frames sem refazer os quadros bons.

---

## 2. Como Salvar e Processar no Pipeline (`scripts/process_sprites_2x2.py`)

O pipeline já suporta **overrides soltos** com prioridade acima dos `.zip` antigos. Basta salvar os PNGs gerados dentro de `spritesPersonagens/overrides/` (pasta local ignorada pelo Git; apenas os `.webp` finais e o `manifest.json` vão para `public/assets/characters/`).

```text
spritesPersonagens/
└── overrides/
    ├── goku/
    │   ├── fase_1/
    │   │   ├── crouch_3x2.png
    │   │   ├── ataque_3_3x2.png
    │   │   └── vfx/
    │   │       ├── vfx_ataque_3_3x2.png
    │   │       └── vfx_ataque_4_3x2.png
    │   └── fase_2..fase_4/ ...
    ├── luffy/
    │   └── fase_1..fase_4/ ...
    └── sukuna/
        └── fase_1..fase_4/ ...
```

### Convenções de Nome Aceitas
- **Folha completa de 6 frames (`3×2` — 3 colunas × 2 linhas):**
  - Ação: `<acao>_3x2.png` (ex.: `ataque_4_3x2.png`, `crouch_3x2.png`, `idle_3x2.png`)
  - VFX: `vfx/vfx_ataque_<1..4>_3x2.png`
- **Alternativa incremental (`+2` frames intercalados com os 4 existentes — `2×1`):**
  - Ação: `<acao>_extra_2x1.png` (2 colunas × 1 linha: quadro de antecipação/transição + quadro de dissipação/follow-through; o script intercala para gerar 6 frames)
  - VFX: `vfx/vfx_ataque_<1..4>_extra_2x1.png`
  > Use `_extra_2x1.png` **apenas** quando o sprite atual de 4 frames **não tiver borda cortada** (`Sem corte`). Se houver corte (`T`, `B`, `L` ou `R`), gere a folha completa `_3x2.png`.

### Comando para Reprocessar e Validar
```bash
npm run process-sprites && npm run build
```

Para conferir quantas folhas ainda têm corte após rodar o comando:
```bash
node -e 'const m=require("./public/assets/characters/manifest.json");for(const[c,cd]of Object.entries(m.characters))for(const[p,pd]of Object.entries(cd.phases))for(const s of [...Object.entries(pd.actions),...Object.entries(pd.vfx)])if(s[1].some(f=>f.clippedEdges?.length))console.log(c,p,s[0],s[1].map(f=>f.clippedEdges))'
```

---

## 3. Checklist Completo das 168 Spritesheets

Legenda de bordas cortadas no `manifest.json` atual: **`T`** = Topo, **`B`** = Base, **`L`** = Esquerda, **`R`** = Direita.

### 3.1 Son Goku (`goku` — 56 sheets | 41 com corte)

#### Fase 1 — Base (`goku/fase_1` • 5 com corte)
- [ ] `idle` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/goku/fase_1/idle_3x2.png`
- [ ] `run` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/goku/fase_1/run_3x2.png`
- [ ] `jump` — `2×2` **CORTE: `T`** → `overrides/goku/fase_1/jump_3x2.png`
- [ ] `crouch` — `2×2` (Pose atual muito alta — re-gerar agachado 6f) → `overrides/goku/fase_1/crouch_3x2.png`
- [ ] `block` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/goku/fase_1/block_3x2.png`
- [ ] `hitstun` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/goku/fase_1/hitstun_3x2.png`
- [ ] `ataque_1` (*Soco Combo*) — `2×2` (Sem corte — upgrade 4→6f) → `overrides/goku/fase_1/ataque_1_3x2.png`
- [ ] `ataque_2` (*Chute Investida*) — `2×2` (Sem corte — upgrade 4→6f) → `overrides/goku/fase_1/ataque_2_3x2.png`
- [ ] `ataque_3` (*Kamehameha*) — `2×2` **CORTE: `R`** → `overrides/goku/fase_1/ataque_3_3x2.png`
- [ ] `ataque_4` (*Genki Dama*) — `2×2` **CORTE: `T`** → `overrides/goku/fase_1/ataque_4_3x2.png`
- [ ] `vfx_ataque_1` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/goku/fase_1/vfx/vfx_ataque_1_3x2.png`
- [ ] `vfx_ataque_2` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/goku/fase_1/vfx/vfx_ataque_2_3x2.png`
- [ ] `vfx_ataque_3` (*Kamehameha VFX*) — `2×2` **CORTE: `L, R`** → `overrides/goku/fase_1/vfx/vfx_ataque_3_3x2.png`
- [ ] `vfx_ataque_4` (*Genki Dama VFX*) — `2×2` **CORTE: `T, B, L, R`** → `overrides/goku/fase_1/vfx/vfx_ataque_4_3x2.png`

#### Fase 2 — Super Saiyajin (`goku/fase_2` • 12 com corte)
- [ ] `idle` — `2×2` **CORTE: `T`** → `overrides/goku/fase_2/idle_3x2.png`
- [ ] `run` — `2×2` **CORTE: `T`** → `overrides/goku/fase_2/run_3x2.png`
- [ ] `jump` — `2×2` **CORTE: `T`** → `overrides/goku/fase_2/jump_3x2.png`
- [ ] `crouch` — `2×2` **CORTE: `T`** (+ re-gerar realmente agachado) → `overrides/goku/fase_2/crouch_3x2.png`
- [ ] `block` — `2×2` **CORTE: `T`** → `overrides/goku/fase_2/block_3x2.png`
- [ ] `hitstun` — `2×2` **CORTE: `T`** → `overrides/goku/fase_2/hitstun_3x2.png`
- [ ] `ataque_1` (*Soco Combo*) — `2×2` **CORTE: `T`** → `overrides/goku/fase_2/ataque_1_3x2.png`
- [ ] `ataque_2` (*Chute Investida*) — `2×2` **CORTE: `T, L, R`** → `overrides/goku/fase_2/ataque_2_3x2.png`
- [ ] `ataque_3` (*Super Kamehameha*) — `2×2` **CORTE: `T, R`** → `overrides/goku/fase_2/ataque_3_3x2.png`
- [ ] `ataque_4` (*Angry Kamehameha*) — `2×2` **CORTE: `T, R`** → `overrides/goku/fase_2/ataque_4_3x2.png`
- [ ] `vfx_ataque_1` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/goku/fase_2/vfx/vfx_ataque_1_3x2.png`
- [ ] `vfx_ataque_2` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/goku/fase_2/vfx/vfx_ataque_2_3x2.png`
- [ ] `vfx_ataque_3` (*Super Kamehameha VFX*) — `2×2` **CORTE: `T, B, R`** → `overrides/goku/fase_2/vfx/vfx_ataque_3_3x2.png`
- [ ] `vfx_ataque_4` (*Angry Kamehameha VFX*) — `2×2` **CORTE: `B, L`** → `overrides/goku/fase_2/vfx/vfx_ataque_4_3x2.png`

#### Fase 3 — Super Saiyajin 3 (`goku/fase_3` • 12 com corte)
- [ ] `idle` — `2×2` **CORTE: `T`** → `overrides/goku/fase_3/idle_3x2.png`
- [ ] `run` — `2×2` **CORTE: `T`** → `overrides/goku/fase_3/run_3x2.png`
- [ ] `jump` — `2×2` **CORTE: `T`** → `overrides/goku/fase_3/jump_3x2.png`
- [ ] `crouch` — `2×2` **CORTE: `T`** (+ re-gerar realmente agachado) → `overrides/goku/fase_3/crouch_3x2.png`
- [ ] `block` — `2×2` **CORTE: `T`** → `overrides/goku/fase_3/block_3x2.png`
- [ ] `hitstun` — `2×2` **CORTE: `T`** → `overrides/goku/fase_3/hitstun_3x2.png`
- [ ] `ataque_1` (*Soco Combo*) — `2×2` **CORTE: `T`** → `overrides/goku/fase_3/ataque_1_3x2.png`
- [ ] `ataque_2` (*Meteor Smash*) — `2×2` **CORTE: `T`** → `overrides/goku/fase_3/ataque_2_3x2.png`
- [ ] `ataque_3` (*True Kamehameha*) — `2×2` **CORTE: `T, R`** → `overrides/goku/fase_3/ataque_3_3x2.png`
- [ ] `ataque_4` (*Punho Do Dragao*) — `2×2` **CORTE: `T`** → `overrides/goku/fase_3/ataque_4_3x2.png`
- [ ] `vfx_ataque_1` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/goku/fase_3/vfx/vfx_ataque_1_3x2.png`
- [ ] `vfx_ataque_2` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/goku/fase_3/vfx/vfx_ataque_2_3x2.png`
- [ ] `vfx_ataque_3` (*True Kamehameha VFX*) — `2×2` **CORTE: `T, L, R`** → `overrides/goku/fase_3/vfx/vfx_ataque_3_3x2.png`
- [ ] `vfx_ataque_4` (*Punho Do Dragao VFX*) — `2×2` **CORTE: `L`** → `overrides/goku/fase_3/vfx/vfx_ataque_4_3x2.png`

#### Fase 4 — Instinto Superior (`goku/fase_4` • 12 com corte)
- [ ] `idle` — `2×2` **CORTE: `T`** → `overrides/goku/fase_4/idle_3x2.png`
- [ ] `run` — `2×2` **CORTE: `T`** → `overrides/goku/fase_4/run_3x2.png`
- [ ] `jump` — `2×2` **CORTE: `T`** → `overrides/goku/fase_4/jump_3x2.png`
- [ ] `crouch` — `2×2` **CORTE: `T`** (+ re-gerar realmente agachado) → `overrides/goku/fase_4/crouch_3x2.png`
- [ ] `block` — `2×2` **CORTE: `T`** → `overrides/goku/fase_4/block_3x2.png`
- [ ] `hitstun` — `2×2` **CORTE: `T`** → `overrides/goku/fase_4/hitstun_3x2.png`
- [ ] `ataque_1` (*Autonomous Fist*) — `2×2` **CORTE: `T`** → `overrides/goku/fase_4/ataque_1_3x2.png`
- [ ] `ataque_2` (*Godly Display*) — `2×2` **CORTE: `T, L`** → `overrides/goku/fase_4/ataque_2_3x2.png`
- [ ] `ataque_3` (*Kamehameha*) — `2×2` **CORTE: `T, R`** → `overrides/goku/fase_4/ataque_3_3x2.png`
- [ ] `ataque_4` (*Supreme Kamehameha*) — `2×2` **CORTE: `T, R`** → `overrides/goku/fase_4/ataque_4_3x2.png`
- [ ] `vfx_ataque_1` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/goku/fase_4/vfx/vfx_ataque_1_3x2.png`
- [ ] `vfx_ataque_2` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/goku/fase_4/vfx/vfx_ataque_2_3x2.png`
- [ ] `vfx_ataque_3` (*Kamehameha UI VFX*) — `2×2` **CORTE: `R`** → `overrides/goku/fase_4/vfx/vfx_ataque_3_3x2.png`
- [ ] `vfx_ataque_4` (*Supreme Kamehameha VFX*) — `2×2` **CORTE: `B, R`** → `overrides/goku/fase_4/vfx/vfx_ataque_4_3x2.png`

---

### 3.2 Monkey D. Luffy (`luffy` — 56 sheets | 23 com corte)

#### Fase 1 — Base (`luffy/fase_1` • 1 com corte)
- [ ] `idle` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_1/idle_3x2.png`
- [ ] `run` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_1/run_3x2.png`
- [ ] `jump` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_1/jump_3x2.png`
- [ ] `crouch` — `2×2` (Pose atual muito alta — re-gerar agachado 6f) → `overrides/luffy/fase_1/crouch_3x2.png`
- [ ] `block` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_1/block_3x2.png`
- [ ] `hitstun` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_1/hitstun_3x2.png`
- [ ] `ataque_1` (*Gatling*) — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_1/ataque_1_3x2.png`
- [ ] `ataque_2` (*Muchi*) — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_1/ataque_2_3x2.png`
- [ ] `ataque_3` (*Pistol*) — `2×2` **CORTE: `L, R`** → `overrides/luffy/fase_1/ataque_3_3x2.png`
- [ ] `ataque_4` (*Red Hawk*) — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_1/ataque_4_3x2.png`
- [ ] `vfx_ataque_1` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_1/vfx/vfx_ataque_1_3x2.png`
- [ ] `vfx_ataque_2` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_1/vfx/vfx_ataque_2_3x2.png`
- [ ] `vfx_ataque_3` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_1/vfx/vfx_ataque_3_3x2.png`
- [ ] `vfx_ataque_4` (*Red Hawk VFX*) — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_1/vfx/vfx_ataque_4_3x2.png`

#### Fase 2 — Gear 4: Boundman (`luffy/fase_2` • 7 com corte)
- [ ] `idle` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_2/idle_3x2.png`
- [ ] `run` — `2×2` **CORTE: `L`** → `overrides/luffy/fase_2/run_3x2.png`
- [ ] `jump` — `2×2` **CORTE: `T`** → `overrides/luffy/fase_2/jump_3x2.png`
- [ ] `crouch` — `2×2` (Pose atual muito alta — re-gerar agachado 6f) → `overrides/luffy/fase_2/crouch_3x2.png`
- [ ] `block` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_2/block_3x2.png`
- [ ] `hitstun` — `2×2` **CORTE: `T`** → `overrides/luffy/fase_2/hitstun_3x2.png`
- [ ] `ataque_1` (*Kong Gun*) — `2×2` **CORTE: `T`** → `overrides/luffy/fase_2/ataque_1_3x2.png`
- [ ] `ataque_2` (*Rhino Schneider*) — `2×2` **CORTE: `T`** → `overrides/luffy/fase_2/ataque_2_3x2.png`
- [ ] `ataque_3` (*Culverin*) — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_2/ataque_3_3x2.png`
- [ ] `ataque_4` (*King Kong Gun*) — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_2/ataque_4_3x2.png`
- [ ] `vfx_ataque_1` (*Kong Gun VFX*) — `2×2` **CORTE: `T, B, R`** → `overrides/luffy/fase_2/vfx/vfx_ataque_1_3x2.png`
- [ ] `vfx_ataque_2` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_2/vfx/vfx_ataque_2_3x2.png`
- [ ] `vfx_ataque_3` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_2/vfx/vfx_ataque_3_3x2.png`
- [ ] `vfx_ataque_4` (*King Kong Gun VFX*) — `2×2` **CORTE: `T, B`** → `overrides/luffy/fase_2/vfx/vfx_ataque_4_3x2.png`

#### Fase 3 — Gear 4: Snakeman (`luffy/fase_3` • 6 com corte)
- [ ] `idle` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_3/idle_3x2.png`
- [ ] `run` — `2×2` **CORTE: `T`** → `overrides/luffy/fase_3/run_3x2.png`
- [ ] `jump` — `2×2` **CORTE: `T`** → `overrides/luffy/fase_3/jump_3x2.png`
- [ ] `crouch` — `2×2` (Pose atual muito alta — re-gerar agachado 6f) → `overrides/luffy/fase_3/crouch_3x2.png`
- [ ] `block` — `2×2` **CORTE: `L`** → `overrides/luffy/fase_3/block_3x2.png`
- [ ] `hitstun` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_3/hitstun_3x2.png`
- [ ] `ataque_1` (*Black Mamba*) — `2×2` **CORTE: `L`** → `overrides/luffy/fase_3/ataque_1_3x2.png`
- [ ] `ataque_2` (*Python Dash Kick*) — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_3/ataque_2_3x2.png`
- [ ] `ataque_3` (*Jet Culverin*) — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_3/ataque_3_3x2.png`
- [ ] `ataque_4` (*King Cobra*) — `2×2` **CORTE: `L, R`** → `overrides/luffy/fase_3/ataque_4_3x2.png`
- [ ] `vfx_ataque_1` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_3/vfx/vfx_ataque_1_3x2.png`
- [ ] `vfx_ataque_2` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_3/vfx/vfx_ataque_2_3x2.png`
- [ ] `vfx_ataque_3` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_3/vfx/vfx_ataque_3_3x2.png`
- [ ] `vfx_ataque_4` (*King Cobra VFX*) — `2×2` **CORTE: `T, B`** → `overrides/luffy/fase_3/vfx/vfx_ataque_4_3x2.png`

#### Fase 4 — Gear 5 (`luffy/fase_4` • 9 com corte)
- [ ] `idle` — `2×2` **CORTE: `T`** → `overrides/luffy/fase_4/idle_3x2.png`
- [ ] `run` — `2×2` **CORTE: `T`** → `overrides/luffy/fase_4/run_3x2.png`
- [ ] `jump` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_4/jump_3x2.png`
- [ ] `crouch` — `2×2` (Pose atual muito alta — re-gerar agachado 6f) → `overrides/luffy/fase_4/crouch_3x2.png`
- [ ] `block` — `2×2` **CORTE: `T`** → `overrides/luffy/fase_4/block_3x2.png`
- [ ] `hitstun` — `2×2` **CORTE: `T`** → `overrides/luffy/fase_4/hitstun_3x2.png`
- [ ] `ataque_1` (*Dawn Pistol*) — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_4/ataque_1_3x2.png`
- [ ] `ataque_2` (*Dawn Whip*) — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_4/ataque_2_3x2.png`
- [ ] `ataque_3` (*Kaminari*) — `2×2` **CORTE: `T`** → `overrides/luffy/fase_4/ataque_3_3x2.png`
- [ ] `ataque_4` (*Bajrang Gun*) — `2×2` **CORTE: `T, L, R`** → `overrides/luffy/fase_4/ataque_4_3x2.png`
- [ ] `vfx_ataque_1` (*Dawn Pistol VFX*) — `2×2` **CORTE: `B`** → `overrides/luffy/fase_4/vfx/vfx_ataque_1_3x2.png`
- [ ] `vfx_ataque_2` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/luffy/fase_4/vfx/vfx_ataque_2_3x2.png`
- [ ] `vfx_ataque_3` (*Kaminari VFX*) — `2×2` **CORTE: `T, B`** → `overrides/luffy/fase_4/vfx/vfx_ataque_3_3x2.png`
- [ ] `vfx_ataque_4` (*Bajrang Gun VFX*) — `2×2` **CORTE: `T, B, L, R`** → `overrides/luffy/fase_4/vfx/vfx_ataque_4_3x2.png`

---

### 3.3 Ryomen Sukuna (`sukuna` — 56 sheets | 15 com corte)

#### Fase 1 — 1–3 Dedos (`sukuna/fase_1` • 3 com corte)
- [ ] `idle` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_1/idle_3x2.png`
- [ ] `run` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_1/run_3x2.png`
- [ ] `jump` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_1/jump_3x2.png`
- [ ] `crouch` — `2×2` (Pose atual muito alta — re-gerar agachado 6f) → `overrides/sukuna/fase_1/crouch_3x2.png`
- [ ] `block` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_1/block_3x2.png`
- [ ] `hitstun` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_1/hitstun_3x2.png`
- [ ] `ataque_1` (*Punho Amaldiçoado*) — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_1/ataque_1_3x2.png`
- [ ] `ataque_2` (*Chute Sombrio*) — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_1/ataque_2_3x2.png`
- [ ] `ataque_3` (*Desmantelar*) — `2×2` **CORTE: `L, R`** → `overrides/sukuna/fase_1/ataque_3_3x2.png`
- [ ] `ataque_4` (*Santuario Incompleto*) — `2×2` **CORTE: `T, R`** → `overrides/sukuna/fase_1/ataque_4_3x2.png`
- [ ] `vfx_ataque_1` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_1/vfx/vfx_ataque_1_3x2.png`
- [ ] `vfx_ataque_2` (*Chute Sombrio VFX*) — `2×2` **CORTE: `B`** → `overrides/sukuna/fase_1/vfx/vfx_ataque_2_3x2.png`
- [ ] `vfx_ataque_3` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_1/vfx/vfx_ataque_3_3x2.png`
- [ ] `vfx_ataque_4` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_1/vfx/vfx_ataque_4_3x2.png`

#### Fase 2 — 15 Dedos (`sukuna/fase_2` • 5 com corte)
- [ ] `idle` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_2/idle_3x2.png`
- [ ] `run` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_2/run_3x2.png`
- [ ] `jump` — `2×2` **CORTE: `T`** → `overrides/sukuna/fase_2/jump_3x2.png`
- [ ] `crouch` — `2×2` (Pose atual muito alta — re-gerar agachado 6f) → `overrides/sukuna/fase_2/crouch_3x2.png`
- [ ] `block` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_2/block_3x2.png`
- [ ] `hitstun` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_2/hitstun_3x2.png`
- [ ] `ataque_1` (*Combo Impiedoso*) — `2×2` **CORTE: `T`** → `overrides/sukuna/fase_2/ataque_1_3x2.png`
- [ ] `ataque_2` (*Corte Brutal*) — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_2/ataque_2_3x2.png`
- [ ] `ataque_3` (*Desmantelar Clivar*) — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_2/ataque_3_3x2.png`
- [ ] `ataque_4` (*Chama Divina Fuga*) — `2×2` **CORTE: `L, R`** → `overrides/sukuna/fase_2/ataque_4_3x2.png`
- [ ] `vfx_ataque_1` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_2/vfx/vfx_ataque_1_3x2.png`
- [ ] `vfx_ataque_2` (*Corte Brutal VFX*) — `2×2` **CORTE: `T`** → `overrides/sukuna/fase_2/vfx/vfx_ataque_2_3x2.png`
- [ ] `vfx_ataque_3` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_2/vfx/vfx_ataque_3_3x2.png`
- [ ] `vfx_ataque_4` (*Chama Divina Fuga VFX*) — `2×2` **CORTE: `T`** → `overrides/sukuna/fase_2/vfx/vfx_ataque_4_3x2.png`

#### Fase 3 — Meguna (`sukuna/fase_3` • 3 com corte)
- [ ] `idle` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_3/idle_3x2.png`
- [ ] `run` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_3/run_3x2.png`
- [ ] `jump` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_3/jump_3x2.png`
- [ ] `crouch` — `2×2` (Pose atual muito alta — re-gerar agachado 6f) → `overrides/sukuna/fase_3/crouch_3x2.png`
- [ ] `block` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_3/block_3x2.png`
- [ ] `hitstun` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_3/hitstun_3x2.png`
- [ ] `ataque_1` (*Caes Divinos*) — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_3/ataque_1_3x2.png`
- [ ] `ataque_2` (*Nue*) — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_3/ataque_2_3x2.png`
- [ ] `ataque_3` (*Elefante Maximo*) — `2×2` **CORTE: `L, R`** → `overrides/sukuna/fase_3/ataque_3_3x2.png`
- [ ] `ataque_4` (*Mahoraga*) — `2×2` **CORTE: `T, L, R`** → `overrides/sukuna/fase_3/ataque_4_3x2.png`
- [ ] `vfx_ataque_1` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_3/vfx/vfx_ataque_1_3x2.png`
- [ ] `vfx_ataque_2` (*Nue VFX*) — `2×2` **CORTE: `B, T`** → `overrides/sukuna/fase_3/vfx/vfx_ataque_2_3x2.png`
- [ ] `vfx_ataque_3` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_3/vfx/vfx_ataque_3_3x2.png`
- [ ] `vfx_ataque_4` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_3/vfx/vfx_ataque_4_3x2.png`

#### Fase 4 — Era Heian (`sukuna/fase_4` • 4 com corte)
- [ ] `idle` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_4/idle_3x2.png`
- [ ] `run` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_4/run_3x2.png`
- [ ] `jump` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_4/jump_3x2.png`
- [ ] `crouch` — `2×2` (Pose atual muito alta — re-gerar agachado 6f) → `overrides/sukuna/fase_4/crouch_3x2.png`
- [ ] `block` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_4/block_3x2.png`
- [ ] `hitstun` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_4/hitstun_3x2.png`
- [ ] `ataque_1` (*Combo 4 Bracos*) — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_4/ataque_1_3x2.png`
- [ ] `ataque_2` (*Kamutoke Investida*) — `2×2` **CORTE: `T`** → `overrides/sukuna/fase_4/ataque_2_3x2.png`
- [ ] `ataque_3` (*Kamutoke Raio*) — `2×2` **CORTE: `L, R`** → `overrides/sukuna/fase_4/ataque_3_3x2.png`
- [ ] `ataque_4` (*Corte Do Mundo*) — `2×2` **CORTE: `L, R`** → `overrides/sukuna/fase_4/ataque_4_3x2.png`
- [ ] `vfx_ataque_1` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_4/vfx/vfx_ataque_1_3x2.png`
- [ ] `vfx_ataque_2` (*Kamutoke Investida VFX*) — `2×2` **CORTE: `T`** → `overrides/sukuna/fase_4/vfx/vfx_ataque_2_3x2.png`
- [ ] `vfx_ataque_3` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_4/vfx/vfx_ataque_3_3x2.png`
- [ ] `vfx_ataque_4` — `2×2` (Sem corte — upgrade 4→6f) → `overrides/sukuna/fase_4/vfx/vfx_ataque_4_3x2.png`

---

## 4. Trava Técnica & Estilo Oficial (`MASTER_STYLE_LOCK`)

> **Dica de Ouro (Image-to-Image / Referência):** sempre que o seu gerador permitir anexar imagem de referência, anexe o `frame_1.webp` ou `frame_3.webp` atual do mesmo golpe/fase localizado em `public/assets/characters/<char>/<fase>/<acao>/`. Isso garante fidelidade absurda de traço, paleta e proporção!

Copie este bloco como **prefixo** quando montar prompts customizados (os prompts prontos da Seção 6 já o incluem):

### Para Spritesheets de Personagem (`3×2` — 6 Frames)
```text
Create a 2D anime fighting game spritesheet arranged in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells, left-to-right top-to-bottom progression, 1536x1024px total).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255) across all 6 cells, NO grid lines, NO borders, NO panel dividers, NO frame numbers, NO text, NO drop shadows on the background.
ART STYLE: high-contrast 2D shonen fighting game cel-shading, crisp dark ink outlines, sharp highlights, heroic anime proportions matching Dragon Ball / One Piece / Jujutsu Kaisen arcade fighters, NOT 3D, NOT pixel art.
SAFE ZONE & ANTI-CLIPPING (CRITICAL): Keep the entire character, spiky hair, flowing aura, cape, summons, and energy blasts 100% INSIDE each cell with at least 18% empty #FF00FF margin at the TOP edge, 14% margin on LEFT and RIGHT edges, and 10% margin at the BOTTOM edge. NEVER let hair tips, aura flames, lightning arcs, fists, or beams touch or clip against any cell boundary.
CONSISTENCY: Character strictly faces RIGHT in every cell, consistent height/body proportions across all 6 frames, feet aligned to the exact same invisible ground baseline.
```

### Para Spritesheets de VFX Isolados (`3×2` — 6 Frames)
```text
Create a 2D anime fighting game visual effect (VFX) spritesheet arranged in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells, left-to-right top-to-bottom sequence, 1536x1024px total).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255) across all 6 cells, NO grid lines, NO borders, NO numbers, NO text, NO character body inside the VFX.
ART STYLE: sharp 2D anime cel-shaded energy VFX with clean dark/colored edges and bright glowing core, high contrast, crisp shards and kinetic impact lines, NOT photorealistic 3D smoke.
SAFE ZONE & ANTI-CLIPPING (CRITICAL): Center the effect inside each cell and leave at least 18% empty #FF00FF margin on ALL FOUR SIDES (top, bottom, left, right) in every single frame so shockwave rings, lightning forks, fire flares, and debris are completely self-contained and never cropped at cell edges.
6-FRAME LIFECYCLE: F1 initial ignition spark -> F2 rapid buildup -> F3 peak impact burst -> F4 secondary shockwave ring/flare -> F5 fragmenting energy -> F6 clean fade-out embers/dissipation.
```

> **Caso o gerador manche o brilho do VFX com contorno rosa:** troque `#FF00FF` no prompt de VFX por `solid flat pure black background (#000000)` ou `solid flat pure white background (#FFFFFF)` — o script `scripts/process_sprites_2x2.py` (`_strip_anomalous_vfx_bg`) detecta e remove fundo sólido branco/preto automaticamente nos VFX.

### Para `crouch` (Correção Global — Postura Realmente Agachada)
```text
POSE REQUIREMENT (CROUCH): Character MUST be deeply crouched low to the ground (total silhouette height ~60-65% of standing height), hips dropped near heel level, front knee sharply bent, rear knee low near floor, torso leaned tightly forward, arms tucked in compact low guard facing right. NEVER stand upright.
```

---

## 5. Bíblia Visual das 12 Fases (Fiel aos Sprites do Jogo)

Use a descrição exata correspondente à fase para não haver troca de roupa, cor de aura ou acessório:

| ID | Personagem / Fase | Descrição Visual Exata (`CHAR_DESIGN`) |
| --- | --- | --- |
| `goku/fase_1` | **Son Goku — Base** | Muscular Son Goku with jet-black spiky hair, black eyes, intact orange martial arts gi over navy blue undershirt, navy belt sash, navy wristbands, navy boots with red-yellow trim; subtle sky-blue (`#38bdf8`) ki sheen only when attacking. |
| `goku/fase_2` | **Son Goku — Super Saiyajin** | Super Saiyan Goku with glowing golden-yellow spiky hair, fierce teal-green eyes, intact orange martial arts gi with navy undershirt/belt/wristbands/boots, surrounded by sharp jagged golden-yellow (`#facc15`) flame aura with warm orange outer rim (keep aura compact below top margin!). |
| `goku/fase_3` | **Son Goku — Super Saiyajin 3** | Super Saiyan 3 Goku with massive knee-length layered golden spiky hair cascading down his back, protruding brow ridge with NO eyebrows, fierce teal eyes, orange gi with navy undershirt/belt/boots, compact golden-amber (`#f59e0b`) SSJ3 flame aura with crisp white-cyan electric sparks (scale slightly smaller inside cell so long hair + aura keep 18% top margin). |
| `goku/fase_4` | **Son Goku — Instinto Superior** | Mastered Ultra Instinct Goku, shirtless battle-damaged muscular torso showing shredded dark-blue belt & torn orange martial arts pants, navy wristbands & boots, glowing silver-white spiky hair and silver eyes, soft luminous silver-white and pale sky-blue/lavender (`#e2e8f0`) aura with floating stardust particles. |
| `luffy/fase_1` | **Monkey D. Luffy — Base** | Young Monkey D. Luffy wearing his yellow straw hat with red ribbon ON HIS HEAD, open long-sleeved red cardigan with yellow buttons, X-shaped scar on muscular chest, yellow waist sash, cuffed blue denim shorts with white fleece trim, straw sandals; subtle red-crimson (`#ef4444`) kinetic accents. |
| `luffy/fase_2` | **Monkey D. Luffy — Gear 4: Boundman** | Gear 4 Boundman Luffy: massive inflated broad-chested upper body, taller fierce spiky black hair with intense glare, straw hat resting on his back with neck cord, open red vest, yellow waist sash, cuffed blue denim shorts, glossy black-crimson Armament Haki coating forearms and lower legs, thick swirling white steam hagoromo scarf looping behind shoulders, orange-amber (`#f97316`) bounce steam bursts. |
| `luffy/fase_3` | **Monkey D. Luffy — Gear 4: Snakeman** | Gear 4 Snakeman Luffy: lean coiled athletic frame, wild upward flame-spiky black hair, intense dark-ringed eyes, straw hat on back, open red vest, yellow waist sash, blue cuffed shorts, glossy black-crimson Armament Haki on forearms (flame-edged transition below biceps) and shins, swirling white steam hagoromo scarf drifting around shoulders and feet, purple-violet (`#c084fc`) & black-red Haki energy. |
| `luffy/fase_4` | **Monkey D. Luffy — Gear 5** | Gear 5 Sun God Nika Luffy: purely white swirling flame-like curly hair, glowing white eyebrows, manic joyful grin with crimson eyes, white floating hagoromo cloud ring scarf looping behind head/shoulders, open white jacket with two gold buttons, green waist sash, white cuffed shorts, straw hat on back, brown sandals, radiant pearly-white (`#f8fafc`) & golden Conqueror's Haki lightning. |
| `sukuna/fase_1` | **Ryomen Sukuna — 1–3 Dedos** | Sukuna in Yuji Itadori host body: spiky pink hair with dark undercut shave, sharp golden-red eyes, curved black Sukuna tattoos across cheeks/forehead/nose/chin, dark navy Jujutsu High high-collared uniform jacket with gold button, thick bright RED neck hoodie/collar, cropped navy trousers, black socks, bright RED sneakers, black clawed nails, subtle cursed rose-pink/crimson (`#fb7185`) cursed energy. |
| `sukuna/fase_2` | **Ryomen Sukuna — 15 Dedos** | Sukuna in spiky pink-undercut hair with full black facial/chest/wrist tattoos, traditional crisp WHITE long-sleeved jujutsu kimono with thick black lapel trim and black obi belt sash, loose baggy black hakama pants tucked into black tabi socks and zori sandals, wicked grin, intense deep blood-crimson (`#ef4444`) cursed aura. |
| `sukuna/fase_3` | **Ryomen Sukuna — Meguna** | Meguna (Sukuna in Megumi's body): spiky jet-black hair, black Sukuna face/wrist tattoos, **BLACK jujutsu kimono jacket with crisp white collar lapel** over black turtleneck, dark obi sash, flowing **WHITE-and-black trimmed hakama pants**, black tabi socks/zori sandals, and the large ornate **GOLDEN 8-handled Dharma Wheel (Mahoraga wheel)** floating behind his right shoulder, dark indigo shadow energy (`#818cf8`). |
| `sukuna/fase_4` | **Ryomen Sukuna — Era Heian** | True Form Heian Era Sukuna: towering muscular **FOUR-ARMED** demon body, pink spiky hair, bone-like curved mask fused over left side of face with two eyes on mask side, **SECOND MOUTH WITH SHARP FANGS across his muscular abdomen**, black curved body tattoos and double wrist bands on all 4 arms, **baggy black kimono hakama skirt**, holding golden three-pronged Vajra curse tool **Kamutoke** in rear right hand, violent dark blood-crimson (`#e11d48`) and black cursed energy. |

---

## 6. Prompts Prontos para Copiar e Colar

### 6.1 Pacote Prioritário P1 — Prompts 100% Completos (Copie e Cole Direto)

Estes são os prompts das animações mais críticas e visivelmente cortadas do jogo hoje, já montados com `MASTER_STYLE_LOCK` + `CHAR_DESIGN` + coreografia dos 6 quadros.

#### 1) `goku/fase_3/ataque_4_3x2.png` — *Punho Do Dragão (SSJ3)* [CORTE ATUAL: `T`]
```text
Create a 2D anime fighting game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells, 1536x1024px) on a solid flat pure magenta background (#FF00FF). NO grid lines, NO borders, NO numbers, NO text. Clean dark ink outlines, high-contrast 2D shonen anime cel-shading.
SAFE ZONE (CRITICAL): Keep character, long SSJ3 hair, golden aura, and golden dragon completely inside each cell with 18% empty #FF00FF top margin, 14% left/right margin, and 10% bottom margin so nothing clips! Character faces RIGHT, same foot baseline in all 6 frames.
CHARACTER: Super Saiyan 3 Goku (massive cascading layered golden spiky hair, no eyebrows, fierce teal eyes, orange martial arts gi, navy undershirt/belt/wristbands/boots).
ACTION — DRAGON FIST (6 frames):
F1: SSJ3 Goku coiling body back in low stance, right fist pulled back near hip, compact golden ki gathering at fist.
F2: Explosive dash forward, leaning sharply right, bright translucent golden dragon head aura igniting around advancing right fist.
F3: Full forward Dragon Fist punch, giant translucent golden-yellow cel-shaded dragon coiling tightly from behind shoulder around his extended right fist roaring forward.
F4: Peak Dragon Fist impact, dragon jaws wide open surging just past the extended fist with compact golden shockwave rings (stay inside 14% right margin!).
F5: Recoil hover/landing, dragon tail swirling and breaking into golden sparks around Goku's extended arm.
F6: Goku pulling arm back into balanced SSJ3 battle guard, golden sparks fading cleanly.
```

#### 2) `goku/fase_4/ataque_4_3x2.png` — *Supreme Kamehameha (Instinto Superior)* [CORTE ATUAL: `T, R`]
```text
Create a 2D anime fighting game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells, 1536x1024px) on a solid flat pure magenta background (#FF00FF). NO grid lines, NO borders, NO numbers, NO text. Clean dark ink outlines, high-contrast 2D anime cel-shading.
SAFE ZONE (CRITICAL): Leave 18% empty #FF00FF margin at TOP (silver aura tips never touch top border!) and 14% margin on LEFT and RIGHT (beam head stays inside cell, NO clipped beam on right edge!).
CHARACTER: Mastered Ultra Instinct Goku (shirtless shredded blue waistband, torn orange gi pants, navy wristbands & boots, glowing silver-white spiky hair, silver eyes, soft white-blue-lavender aura with stardust).
ACTION — SUPREME KAMEHAMEHA (6 frames):
F1: Goku twisting torso back, both cupped hands pulled behind hip holding a dense glowing cyan-white energy sphere.
F2: Stepped-out charge stance, hands drawing forward, bright silver-cyan flare illuminating torso and hair.
F3: Explosive two-hand forward thrust launching a thick cyan-and-white Kamehameha beam head to the right (keep conical beam flare strictly inside right safe margin).
F4: Peak sustained blast stance, intense luminous silver-white aura flaring symmetrically with clean cel-shaded cyan energy spikes around palms.
F5: Follow-through exhale, beam dissipating into crisp cyan energy streaks ahead of outstretched palms.
F6: Arms lowering smoothly back into composed Ultra Instinct stance, soft stardust settling.
```

#### 3) `luffy/fase_3/ataque_4_3x2.png` — *King Cobra (Gear 4: Snakeman)* [CORTE ATUAL: `L, R`]
```text
Create a 2D anime fighting game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells, 1536x1024px) on a solid flat pure magenta background (#FF00FF). NO grid lines, NO borders, NO numbers, NO text. Clean dark ink outlines, high-contrast 2D One Piece anime cel-shading.
SAFE ZONE (CRITICAL): Keep compressed coil windup, swirling white steam scarf, stretched Armament Haki fist, and black-red lightning starburst completely inside each cell with 18% top, 14% left/right, 10% bottom empty #FF00FF margin.
CHARACTER: Gear 4 Snakeman Luffy (lean muscular frame, tall flame-spiky black hair, intense dark-ringed eyes, straw hat on back, open red vest, yellow waist sash, blue cuffed shorts, glossy black-crimson Armament Haki forearms/shins, white steam hagoromo scarf).
ACTION — GOMU NO KING COBRA (6 frames):
F1: Luffy coiled tightly back, right glossy black-crimson Haki arm retracted behind torso inflating like a python, steam rings spinning around forearm.
F2: Sudden forward lunge, Haki forearm zig-zagging forward in compressed trajectory with purple-crimson air trail.
F3: Full King Cobra impact thrust: huge enlarged glossy black-crimson Armament Haki fist punching straight right encircled by concentric white-red steam rings and sharp black-crimson Conqueror's Haki lightning starburst.
F4: Peak shockwave compression: giant Haki fist exploding forward slightly further with crisp crimson/gold impact spikes inside right margin.
F5: Elastic snap-back: stretched black Haki arm whipping back toward shoulder, Haki steam rings scattering cleanly.
F6: Snakeman landing upright in coiled snake guard, fists raised, steam scarf flowing naturally.
```

#### 4) `luffy/fase_4/ataque_4_3x2.png` — *Bajrang Gun (Gear 5)* [CORTE ATUAL: `T, L, R`]
```text
Create a 2D anime fighting game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells, 1536x1024px) on a solid flat pure magenta background (#FF00FF). NO grid lines, NO borders, NO numbers, NO text. Clean dark ink outlines, high-contrast 2D anime cel-shading.
SAFE ZONE (CRITICAL): Even with the colossal Haki fist, scale composition neatly so hair, floating white cloud ring, fist knuckles, and black-crimson Conqueror lightning keep 18% top margin and 14% left/right empty #FF00FF margin in all 6 frames!
CHARACTER: Gear 5 Sun God Nika Luffy (white curly flame hair, joyful manic grin, crimson eyes, floating white cloud ring hagoromo, open white jacket with two gold buttons, green waist sash, white cuffed shorts, straw hat on back, sandals).
ACTION — BAJRANG GUN (6 frames):
F1: Luffy crouching/coiling backward grinning widely, raising right arm coated in glossy black-crimson Haki with thin white cloud spirals twisting around wrist.
F2: Huge giant-scale Armament Haki fist inflating forward-upward, double concentric white Gear 5 cloud rings spinning around forearm.
F3: Colossal horizontal/down-angled black-crimson Haki giant fist strike punching right with double white cloud rings and explosive cream-orange/black-red Haki lightning starburst.
F4: Peak Bajrang shockwave crush: fist pressed into bright starburst center with sharp radial Haki lightning bolts contained cleanly inside margin.
F5: Giant fist shrinking smoothly back to normal arm size while Luffy laughs rebounding backward.
F6: Light bouncy Gear 5 idle recovery, white cloud hagoromo curling cleanly overhead.
```

#### 5) `sukuna/fase_3/ataque_3_3x2.png` — *Elefante Máximo (Meguna)* [CORTE ATUAL: `L, R`]
```text
Create a 2D anime fighting game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells, 1536x1024px) on a solid flat pure magenta background (#FF00FF). NO grid lines, NO borders, NO numbers, NO text. Clean dark ink outlines, high-contrast 2D Jujutsu Kaisen anime cel-shading.
SAFE ZONE (CRITICAL): Leave 18% top and 14% left/right empty #FF00FF margin in every cell so the Dharma wheel and pressurized cyan water blast NEVER clip on the right or left edges!
CHARACTER: Meguna Sukuna (spiky jet-black hair, black Sukuna face/wrist tattoos, BLACK jujutsu kimono jacket with white lapel trim over black turtleneck, WHITE-and-black trimmed hakama skirt, black tabi/zori sandals, ornate GOLDEN 8-handled Dharma Wheel floating behind shoulder).
ACTION — MAX ELEPHANT PIERCING WATER (6 frames):
F1: Meguna stepping back, bringing both hands together in front of chest in ten-shadows aiming stance, tiny bright cyan-white water orb forming between palms.
F2: Leaning forward firmly, cupped palms aimed right as compressed spiraling aqua water begins surging out.
F3: Full Max Elephant piercing blast: two-hand palm thrust shooting a razor-sharp spiraling bright cyan-and-white pressurized water jet forward (ending cleanly before 14% right margin with sharp splash tips).
F4: Sustained high-pressure water surge with crisp aqua spray droplets and Dharma Wheel gleaming behind shoulder.
F5: Palms opening slightly as water jet snaps off into clean vanishing cyan mist droplets.
F6: Returning upright to composed Meguna stance, kimono sleeves settling cleanly.
```

#### 6) `sukuna/fase_3/ataque_4_3x2.png` — *Mahoraga (Meguna)* [CORTE ATUAL: `T, L, R`]
```text
Create a 2D anime fighting game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells, 1536x1024px) on a solid flat pure magenta background (#FF00FF). NO grid lines, NO borders, NO numbers, NO text. Clean dark ink outlines, high-contrast 2D anime cel-shading.
SAFE ZONE (CRITICAL): Frame Meguna and Mahoraga together slightly more compactly so Mahoraga's white head-wings and Sword of Extermination NEVER touch top, left, or right borders (keep 18% top and 14% left/right empty #FF00FF margin)!
CHARACTER: Meguna Sukuna (black kimono w/ white lapel, white-and-black hakama, golden Dharma wheel behind shoulder) + towering white-skinned Eight-Handled Sword Divergent Sila Divine General Mahoraga (winged spiky white head covering eyes, giant muscular white torso, black hakama skirt, glowing white-and-crimson blade strapped to right forearm).
ACTION — MAHORAGA SUMMON & SLASH (6 frames):
F1: Meguna raising two fingers/clasped hands summoning dark indigo shadow mist behind him as Mahoraga's silhouette rises.
F2: Meguna pointing sharply forward-right while winged white Mahoraga materializes towering just behind his shoulder raising its glowing blade high.
F3: Meguna commanding forward as Mahoraga lunges forward beside him swinging the white-crimson Sword of Extermination in a wide downward-right arc (full sword tip inside 14% margin!).
F4: Peak follow-through of Mahoraga's crimson-white crescent energy slash across the right side while Meguna stands poised.
F5: Mahoraga fading rapidly back into dissolving ink-indigo Ten Shadows wisps behind Meguna.
F6: Meguna lowering pointing arm back into calm dominant stance, golden Dharma Wheel hovering steadily.
```

#### 7) `sukuna/fase_4/ataque_4_3x2.png` — *Corte Do Mundo (Era Heian)* [CORTE ATUAL: `L, R`]
```text
Create a 2D anime fighting game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells, 1536x1024px) on a solid flat pure magenta background (#FF00FF). NO grid lines, NO borders, NO numbers, NO text. Clean dark ink outlines, high-contrast 2D anime cel-shading.
SAFE ZONE (CRITICAL): Keep all four arms, golden Kamutoke trident, and jagged black-crimson World Cutting Slash rays 100% INSIDE each cell with 18% top and 14% left/right empty #FF00FF margin!
CHARACTER: Heian Era True Form Sukuna (towering 4-armed demon, pink spiky hair, left-face bone mask, open fanged belly mouth, black chest/arm tattoos, black hakama skirt, golden three-pronged Vajra Kamutoke held in rear right hand).
ACTION — WORLD CUTTING SLASH (6 frames):
F1: Four-armed Sukuna forming Enmaten handsign with lower hands while upper hands draw back, dark blood-crimson cursed lines crackling around palms.
F2: Upper left arm drawing across chest while Kamutoke rises in rear hand, sharp spatial white-black rift lines forming in front.
F3: Unleashing World Cutting Slash: forward arm pointing/swiping fiercely right launching jagged razor-sharp black, dark-crimson, and blinding-white spatial cleave blades forward (kept cleanly inside right margin).
F4: Peak dimensional cleave burst: crisp black-crimson jagged slash arcs and white lightning fractures splitting the air cleanly inside bounds.
F5: Arms sweeping wide after the cut as jagged spatial fragments break apart and vanish.
F6: Heian Sukuna returning effortlessly to towering four-armed idle guard holding Kamutoke.
```

#### 8) Prompt Universal de VFX P1 (`vfx_ataque_3` / `vfx_ataque_4` — **Sem Personagem**, 100% Sem Corte)
Troque apenas `[CORES & ELEMENTO DO GOLPE]` pela linha correspondente da tabela da Seção 6.2:
```text
Create a 2D anime fighting game isolated VFX spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells, 1536x1024px) on a solid flat pure magenta background (#FF00FF). NO grid lines, NO borders, NO character body, NO text.
STYLE: crisp 2D shonen anime cel-shaded energy effect with sharp silhouette edges, bright hot core, high contrast.
SAFE ZONE (CRITICAL): Keep the ENTIRE VFX explosion/beam/slash centered inside EVERY cell with at least 18% empty #FF00FF margin on ALL FOUR SIDES (top, bottom, left, right). NEVER let rays, rings, sparks, or debris touch any cell border.
EFFECT DESCRIPTION: [CORES & ELEMENTO DO GOLPE].
6-FRAME SEQUENCE:
F1: Tiny condensed ignition core / starter spark centered in cell.
F2: Rapid directional/radial buildup gathering sharp energy spikes.
F3: Maximum peak impact explosion / beam head / cleave burst (boldest silhouette, still inside 18% margins!).
F4: Secondary expanding thin shockwave ring and scattered cel-shaded energy sparks.
F5: Breaking apart into crisp glowing shards, droplets, and curling wisps.
F6: Final tiny fading embers / mist clearing cleanly.
```

---

### 6.2 Biblioteca Completa de Movimentos & VFX (Todas as 12 Fases — Copiar `[BLOCO]` + `[CHAR_DESIGN]`)

Para qualquer folha faltante da Seção 3, combine:
1. **`MASTER_STYLE_LOCK`** (Seção 4),
2. **`CHAR_DESIGN`** da fase exata (Seção 5), e
3. **`AÇÃO` ou `VFX`** abaixo:

#### A) Ações Comuns de Movimento & Defesa (Válido para Todos — 6 Frames)
- **`idle` (Respiração em Guarda — Loop suave F6→F1):**
  `ACTION IDLE (6-frame seamless fighting stance loop): F1 balanced combat guard facing right, knees lightly bent, fists/hands up; F2 subtle weight shift down-forward on exhale; F3 lowest relaxed crouch-bounce with subtle aura/hair sway; F4 rising inhale lifting chest and guard slightly; F5 peak chest/aura lift; F6 smooth return matching F1 pose.`
- **`run` (Corrida para Direita — Loop suave F6→F1):**
  `ACTION RUN (6-frame dynamic dash-run loop facing right): F1 torso leaned 35 degrees forward, left leg driving back, right knee lifting forward; F2 explosive mid-air push-off stride; F3 right foot planting forward, arms pumping hard; F4 opposite stride driving right leg back, left knee lifting; F5 opposite airborne extension stride; F6 left foot planting seamlessly back into F1 rhythm.`
- **`jump` (Salto Completo — Decolagem a Aterrissagem):**
  `ACTION JUMP (6-frame aerial arc, keep 18% top margin even at apex!): F1 deep pre-jump knee bend coil near floor; F2 explosive upward launch legs extending; F3 rising airborne tuck knees pulled slightly up; F4 peak mid-air apex poised balanced (still inside top safe zone); F5 controlled descent legs extending toward ground; F6 cushioned landing knee-bend absorbing impact.`
- **`crouch` (Agachamento Real — Correção Prioritária):**
  `ACTION CROUCH (6 frames — MUST BE DEEPLY CROUCHED ~60-65% standing height, NEVER upright!): F1 lowering hips from standing toward guard; F2 dropping deeply with front knee sharply bent and rear knee near floor; F3 full compact low crouch combat-ready guard, elbows tucked tight; F4 subtle grounded breathing dip holding low profile; F5 slight upward spring tension still low; F6 settling into steady compact low guard.`
- **`block` (Defesa — Guard Up & Impacto):**
  `ACTION BLOCK (6-frame defensive guard): F1 snapping arms quickly across face/chest; F2 braced crossed-forearm fighting guard knees planted wide; F3 absorbing hit recoil leaning slightly back while forearms glow lightly with defensive ki/haki rim; F4 holding firm braced guard counter-pushing weight forward; F5 shock ripple fading off forearms; F6 relaxed steady defensive stance.`
- **`hitstun` (Recebendo Dano — Knockback):**
  `ACTION HITSTUN (6-frame hit reaction): F1 sudden impact snap head jerking back-left; F2 upper body thrown backward off-balance arms flung out; F3 peak knockback stagger sliding slightly back in pain grimace; F4 catching footing bending knees mid-skid; F5 bracing left foot recovering posture; F6 shaking off hit pulling hands back into guard.`

---

#### B) Son Goku — Ataques & VFX Específicos (Fases 1 a 4)

##### `goku/fase_1` (Base)
- `ataque_1` (*Soco Combo*): `F1 coil back left guard -> F2 fast right jab -> F3 torso twist heavy left hook -> F4 explosive full-reach right cross punch with crisp cyan-white wind lines -> F5 pivot follow-through -> F6 snap back to guard.`
- `ataque_2` (*Chute Investida*): `F1 low knee chamber -> F2 lunging slide kick start -> F3 full extended flying side/roundhouse kick forward with crisp wind arc -> F4 peak kick shock impact -> F5 foot snapping back to ground -> F6 balanced landing stance.`
- `ataque_3` (*Kamehameha*) [CORTE: `R`]: `F1 pulling cupped hands behind right hip charging tiny sky-blue orb -> F2 bright blue energy sphere flaring between palms -> F3 throwing palms forward firing conical blue-white Kamehameha blast strictly inside 14% right margin -> F4 sustained recoil stance glowing blue -> F5 beam cutting off cleanly into blue sparks -> F6 lowering hands to guard.`
- `ataque_4` (*Genki Dama*) [CORTE: `T`]: `F1 crouching low raising both open palms skyward -> F2 sky-blue spirit sphere forming compactly OVER head (keep >=18% empty top margin above sphere!) -> F3 rising heroically balancing glowing blue Spirit Bomb -> F4 driving both hands downward-forward hurling condensed Spirit Bomb right -> F5 follow-through push -> F6 landing cleanly.`
- `vfx_ataque_1..2`: `Sharp cel-shaded white and sky-blue kinetic punch/kick shockwave arcs and crisp impact starbursts.`
- `vfx_ataque_3` (*Kamehameha VFX*) [CORTE: `L, R`]: `Intense cel-shaded bright sky-blue and white cylindrical ki beam flare with jagged electric plasma needles along edges, horizontally centered inside 18% L/R margins.`
- `vfx_ataque_4` (*Genki Dama VFX*) [CORTE: `T, B, L, R`]: `Radiant cel-shaded sky-blue and white spherical Spirit Bomb core bursting into jagged blue-cyan shockwave rings, spiral plasma flares and tiny debris pebbles kept completely inside 18% margins.`

##### `goku/fase_2` (Super Saiyajin — Atenção ao Topo `T`)
- `ataque_1` (*Soco Combo*) [CORTE: `T`]: `Rapid 3-punch SSJ flurry: coil -> fast jab -> spinning backfist -> heavy golden-lit finishing straight punch -> follow-through -> guard (compact golden aura, 18% top margin).`
- `ataque_2` (*Chute Investida*) [CORTE: `T, L, R`]: `SSJ surging dash-kick: crouched sprint -> explosive flying knee/kick -> full horizontal golden-trailed rush kick inside 14% L/R margins -> peak golden impact burst -> landing -> guard.`
- `ataque_3` (*Super Kamehameha*) [CORTE: `T, R`]: `Deep SSJ Kamehameha hip charge with bright blue-gold sparks -> intense lean -> firing thicker cyan-blue-white Super Kamehameha blast cleanly inside 14% right margin -> sustained glow -> dissipation -> stance.`
- `ataque_4` (*Angry Kamehameha*) [CORTE: `T, R`]: `Fierce screaming single-handed forward/backhand lunge: drawing right glowing palm back in wrath -> snapping torso forward firing explosive golden-rimmed cyan-orange Kamehameha beam head inside 14% right margin -> heavy exhale recoil -> guard.`
- `vfx_ataque_1..2`: `Golden-yellow and hot white cel-shaded kinetic melee impact bursts with sharp shock lines.`
- `vfx_ataque_3` (*Super Kamehameha VFX*) [CORTE: `T, B, R`]: `Large cel-shaded electric cyan-blue & gold starburst ki blast explosion with rocky pebbles and blinding white core centered cleanly inside 18% margins.`
- `vfx_ataque_4` (*Angry Kamehameha VFX*) [CORTE: `B, L`]: `Furious golden-orange and cyan-white directional beam-explosion flare with jagged golden plasma needles inside 18% margins.`

##### `goku/fase_3` (Super Saiyajin 3 — Atenção ao Cabelo Longo e Topo `T`)
- `ataque_1` (*Soco Combo*) [CORTE: `T`]: `Heavy ferocious SSJ3 elbow-to-hook combo wrapped in compact amber-gold aura and tiny cyan lightning sparks -> heavy downward hook -> recovery.`
- `ataque_2` (*Meteor Smash*) [CORTE: `T`]: `SSJ3 blitz dash -> rising knee strike -> mid-air spin -> crushing double-fist overhead Meteor Smash slam downward-right -> landing shockwave -> upright guard.`
- `ataque_3` (*True Kamehameha*) [CORTE: `T, R`]: `Wide SSJ3 hair flaring cleanly inside 18% top margin, two-hand hip charge -> blinding golden-cyan flare -> massive True Kamehameha beam emission strictly inside 14% right margin -> recoil -> calm stance.`
- `ataque_4` (*Punho Do Dragao*) [CORTE: `T`]: Use o **Prompt Completo #1 da Seção 6.1**.
- `vfx_ataque_1..2`: `Amber-gold melee shock rings laced with sharp cyan SSJ3 static arcs.`
- `vfx_ataque_3` (*True Kamehameha VFX*) [CORTE: `T, L, R`]: `High-output cyan-white & amber-gold radiating Kamehameha detonation wave + crisp white-cyan lightning forks safely inside 18% margins.`
- `vfx_ataque_4` (*Punho Do Dragao VFX*) [CORTE: `L`]: `Isolated golden dragon spiral shockwave ring and roaring golden cel-shaded dragon energy burst bursting forward and swirling into gold stardust inside 18% margins.`

##### `goku/fase_4` (Instinto Superior — Atenção à Aura Prata `T`)
- `ataque_1` (*Autonomous Fist*) [CORTE: `T`]: `Fluid ultra-fast UI auto-dodge lean -> instantaneous blurred silver-white rapid fist thrust -> invisible air pressure strike -> poised effortless recovery.`
- `ataque_2` (*Godly Display*) [CORTE: `T, L`]: `Blinding flash dash -> spinning aerial triple strike sequence with crisp silver-blue crescent shockwaves -> graceful acrobatic drop -> serene landing stance inside margins.`
- `ataque_3` (*Kamehameha*) [CORTE: `T, R`]: `Serene silver-aura hip charge -> smooth glide forward -> crisp white-lavender-cyan Kamehameha beam strictly inside 14% right margin -> quiet exhale -> stance.`
- `ataque_4` (*Supreme Kamehameha*) [CORTE: `T, R`]: Use o **Prompt Completo #2 da Seção 6.1**.
- `vfx_ataque_1..2`: `Luminous silver-white, pale lavender and ice-blue sharp cel-shaded air-shock rings and sparkling stardust flicks.`
- `vfx_ataque_3` (*Kamehameha UI VFX*) [CORTE: `R`]: `Ultra-refined silver-white and pale-cyan starburst beam collision burst with soft glowing stardust flecks strictly inside 18% margins.`
- `vfx_ataque_4` (*Supreme Kamehameha VFX*) [CORTE: `B, R`]: `Massive radiant silver-white, pale violet and electric cyan cel-shaded cosmic energy detonation with crisp radial shock rings inside 18% margins.`

---

#### C) Monkey D. Luffy — Ataques & VFX Específicos (Fases 1 a 4)

##### `luffy/fase_1` (Base)
- `ataque_1` (*Gatling*): `Luffy leaning back arms coiled -> rapid multi-fist blurring Gatling punch volley forward (overlapping crisp anime fist silhouettes inside right margin!) -> final finishing right straight -> snapping arms back -> upright guard.`
- `ataque_2` (*Muchi*): `Pivoting on left heel winding stretched elastic right leg behind -> whipping long rubber leg across in wide crescent Whip Kick arc forward -> follow-through sweep -> elastic snap-back -> stance.`
- `ataque_3` (*Pistol*) [CORTE: `L, R`]: `Drawing right fist far back past hip -> launching straight elongated rubber Gomu no Pistol punch forward-right (fist + stretched arm strictly inside 14% L/R margins!) -> peak impact twist -> elastic rebound curling back -> guard.`
- `ataque_4` (*Red Hawk*): `Arm coated in dark matte black Armament Haki snapping back with swirling orange-red friction flames -> lunging fiery punch igniting bright red-gold Red Hawk flame explosion at fist -> recoil -> steam clearing off fist.`
- `vfx_ataque_1..3`: `Crisp white/yellow anime kinetic speed rings, comic punch shockwaves and rubber wind bursts.`
- `vfx_ataque_4` (*Red Hawk VFX*): `Fierce fiery red-orange and bright gold anime flame explosion burst with crisp black smoke curl accents inside 18% margins.`

##### `luffy/fase_2` (Gear 4: Boundman)
- `ataque_1` (*Kong Gun*) [CORTE: `T`]: `Compressing colossal glossy black-crimson Haki right fist straight deep inside shoulder cavity -> explosive piston launch punching forward with giant Haki knuckle impact & white steam shock ring -> retraction -> bounce guard.`
- `ataque_2` (*Rhino Schneider*) [CORTE: `T`]: `Leaping bounce curling both knees deeply inside torso -> thrusting BOTH black-crimson Haki feet forward simultaneously like twin battering rams -> mid-air bounce recoil -> upright guard.`
- `ataque_3` (*Culverin*): `Pulling Haki arm deep into torso -> launching bent zig-zag ricochet Haki python arm chasing forward-right inside 14% margin -> twisting rebound snap-back -> stance.`
- `ataque_4` (*King Kong Gun*): `Giant ballooned Boundman blowing air into arm inflating colossal glossy black-crimson Haki giant fist overhead/forward -> devastating forward downward-punch with huge cream-gold & black-red Conqueror starburst inside margins -> deflating bounce -> guard.`
- `vfx_ataque_1` (*Kong Gun VFX*) [CORTE: `T, B, R`]: `Explosive white steam shockwave ring + bright yellow-orange compression burst + crisp black shock rays inside 18% margins.`
- `vfx_ataque_2..3`: `Bouncy white steam puffs, orange compression rings and crisp red kinetic impact stars.`
- `vfx_ataque_4` (*King Kong Gun VFX*) [CORTE: `T, B`]: `Massive fiery golden-white & black-crimson Conqueror's Haki shockwave dome + jagged black-red lightning spikes strictly inside 18% margins.`

##### `luffy/fase_3` (Gear 4: Snakeman)
- `ataque_1` (*Black Mamba*) [CORTE: `L`]: `Snakeman leaning forward spinning coiled Haki shoulders -> rapid high-speed barrage of black-crimson Haki fists firing straight & angled forward with dark violet-red air trails -> double finishing punch -> quick recoil -> guard.`
- `ataque_2` (*Python Dash Kick*): `Coiling low on one leg -> jetting forward in low-altitude dash delivering snapping high Haki crescent kick forward -> spinning aerial follow kick -> smooth bounce landing -> guard.`
- `ataque_3` (*Jet Culverin*): `Retracting coiled Haki forearm -> firing razor-fast zig-zagging jet Haki fist snapping sharp 90-degree turns forward inside 14% margins -> snappy whip-back -> guard.`
- `ataque_4` (*King Cobra*) [CORTE: `L, R`]: Use o **Prompt Completo #3 da Seção 6.1**.
- `vfx_ataque_1..3`: `Sharp violet-purple, crimson and black kinetic air-ricochet angles and spinning white steam rings.`
- `vfx_ataque_4` (*King Cobra VFX*) [CORTE: `T, B`]: `Razor-sharp crimson-gold starburst impact explosion encircled by thin bright ring and heavy black-crimson Conqueror's Haki lightning bolts completely inside 18% margins.`

##### `luffy/fase_4` (Gear 5)
- `ataque_1` (*Dawn Pistol*): `Laughing bouncing windup winding arm like a cartoon spring -> snapping blinding white-rimmed fist straight forward with puffy white cloud burst & red Haki lightning -> bouncing elastic recoil -> cheerful guard.`
- `ataque_2` (*Dawn Whip*): `Spinning wildly mid-air on one hand -> whipping colossal rubber white-trousered leg in wide overhead-to-horizontal crescent sweep surrounded by puffy cartoon cloud rings -> playful landing.`
- `ataque_3` (*Kaminari*) [CORTE: `T`]: `Leaping lightly grabbing a solid bright golden cel-shaded thunderbolt spear overhead (keep top spear tip strictly inside 18% top margin!) -> winding back -> hurling crackling golden-white lightning bolt forward-down right -> bouncy landing.`
- `ataque_4` (*Bajrang Gun*) [CORTE: `T, L, R`]: Use o **Prompt Completo #4 da Seção 6.1**.
- `vfx_ataque_1` (*Dawn Pistol VFX*) [CORTE: `B`]: `Puffy stylized white Gear 5 impact cloud rings bursting with crisp golden-red Conqueror Haki lightning sparks inside 18% margins.`
- `vfx_ataque_2`: `Playful swirling cartoon white cloud shockwaves with star-burst comic flash accents.`
- `vfx_ataque_3` (*Kaminari VFX*) [CORTE: `T, B`]: `Jagged bright golden-yellow and white cel-shaded thunderbolt spear crashing into radial electric lightning burst inside 18% margins.`
- `vfx_ataque_4` (*Bajrang Gun VFX*) [CORTE: `T, B, L, R`]: `Colossal crimson-gold impact core surrounded by concentric white cartoon cloud rings and dense black-crimson Conqueror's Haki lightning forks inside 18% margins.`

---

#### D) Ryomen Sukuna — Ataques & VFX Específicos (Fases 1 a 4)

##### `sukuna/fase_1` (1–3 Dedos)
- `ataque_1` (*Punho Amaldiçoado*): `Wicked lunge twisting torso -> fierce cursed black-clawed right hook slash -> heavy rose-crimson cursed fist follow-through -> snapping smirk return to low stance.`
- `ataque_2` (*Chute Sombrio*): `Stepping pivot -> rising roundhouse kick -> slamming downward-sweeping axe/crescent kick wrapped in sharp dark-pink & black cursed energy arc -> balanced landing.`
- `ataque_3` (*Desmantelar*) [CORTE: `L, R`]: `Raising two cursed-clawed fingers coldly -> snapping effortless horizontal wrist flick launching crisp pale-white/black-crimson Dismantle slash crescents forward inside 14% margins -> casual lowering hand -> guard.`
- `ataque_4` (*Santuario Incompleto*) [CORTE: `T, R`]: `Forming Malevolent Shrine hand sign with clasped fingers -> dark crimson cursed vortex rising compactly around feet -> unleashing violent whirlwind of crisscrossing red-black slash arcs forward inside 14% margins -> lowering hands cleanly.`
- `vfx_ataque_1`, `vfx_ataque_3`, `vfx_ataque_4`: `Sharp rose-pink, blood-crimson and ink-black curved claw slash crescents & Malevolent Shrine crisscross blade scars inside 18% margins.`
- `vfx_ataque_2` (*Chute Sombrio VFX*) [CORTE: `B`]: `Sweeping dark-purple, black and bright rose-crimson downward kick crescent arc + low floor spark scatter inside 18% margins.`

##### `sukuna/fase_2` (15 Dedos)
- `ataque_1` (*Combo Impiedoso*) [CORTE: `T`]: `Sadistic blur step -> rapid merciless twin-hand claw rip -> devastating upward cursed uppercut-slash -> brutal downward palm slam -> wicked upright smirk.`
- `ataque_2` (*Corte Brutal*): `Drawing right hand sharply back glowing dark crimson -> wide vicious diagonal cleave arc ripping through the air with heavy black-red slash trail -> follow-through pose -> poised kimono guard.`
- `ataque_3` (*Desmantelar Clivar*): `Crossing both hands calmly -> flicking fingers wide firing multiple razor-sharp crisscrossing black-and-white Cleave/Dismantle slash grids forward inside 14% margin -> hands sliding calmly into kimono posture.`
- `ataque_4` (*Chama Divina Fuga*) [CORTE: `L, R`]: `Pulling hands apart igniting blazing furnace fire arrow between palms -> drawing bowstring of molten orange-gold fire -> releasing blazing orange-gold-crimson Fuga fire beam/arrow surging right inside 14% margin -> lowering smoking hand.`
- `vfx_ataque_1`, `vfx_ataque_3`: `Blood-crimson and ink-black jagged Dismantle/Cleave cross-slash fractures inside 18% margins.`
- `vfx_ataque_2` (*Corte Brutal VFX*) [CORTE: `T`]: `Thick sweeping crimson-black crescent cleave blade arc + crimson splatter sparks safely inside 18% margins.`
- `vfx_ataque_4` (*Chama Divina Fuga VFX*) [CORTE: `T`]: `Intense blazing solar orange, yellow-white core and dark crimson fire vortex flare + ember arrow streaks strictly inside 18% margins.`

##### `sukuna/fase_3` (Meguna)
- `ataque_1` (*Caes Divinos*): `Meguna crouching slightly forming wolf-shadow hand sign -> black-indigo shadow ink erupting around clenched fist -> lunging forward delivering piercing black-violet Totality shadow-claw slash -> clean pull-back to guard.`
- `ataque_2` (*Nue*): `Meguna leaping diagonally upward into flying lightning kick wrapped in jagged bright pale-gold & crimson-edged Nue electricity (golden Dharma wheel behind shoulder!) -> crackling follow-through -> graceful landing.`
- `ataque_3` (*Elefante Maximo*) [CORTE: `L, R`]: Use o **Prompt Completo #5 da Seção 6.1**.
- `ataque_4` (*Mahoraga*) [CORTE: `T, L, R`]: Use o **Prompt Completo #6 da Seção 6.1**.
- `vfx_ataque_1`: `Dark ink-black and indigo Ten Shadows clawed beast swipe tendrils inside 18% margins.`
- `vfx_ataque_2` (*Nue VFX*) [CORTE: `T, B`]: `Jagged bright pale-gold, white-core and soft pink-crimson outline electric lightning bolts bursting radially inside 18% margins.`
- `vfx_ataque_3`: `Spiraling bright cyan-aqua and white pressurized water vortex blast with crisp spray droplets inside 18% margins.`
- `vfx_ataque_4`: `White-and-crimson divine Sword of Extermination crescent slash flare with glowing golden Dharma wheel ring aura inside 18% margins.`

##### `sukuna/fase_4` (Era Heian)
- `ataque_1` (*Combo 4 Bracos*): `Towering four-armed onslaught: rear arms grabbing/holding Kamutoke high while front two fists deliver furious alternating black-crimson cursed punches -> simultaneous four-limb pressure slam -> confident return to 4-arm guard.`
- `ataque_2` (*Kamutoke Investida*) [CORTE: `T`]: `Raising golden Kamutoke high (keep top trident tip strictly below 18% top margin!) -> dashing violently forward driving golden vajra spear thrust charged with red-gold lightning -> snapping back to stance.`
- `ataque_3` (*Kamutoke Raio*) [CORTE: `L, R`]: `Heian Sukuna swinging golden Kamutoke trident horizontally forward unleashing jagged crimson-and-white celestial lightning web forward inside 14% right margin -> lowering tool calmly.`
- `ataque_4` (*Corte Do Mundo*) [CORTE: `L, R`]: Use o **Prompt Completo #7 da Seção 6.1**.
- `vfx_ataque_1`: `Four overlapping jagged blood-crimson and ink-black impact slashes inside 18% margins.`
- `vfx_ataque_2` (*Kamutoke Investida VFX*) [CORTE: `T`]: `Golden-white vajra spear thrust shock cone with jagged blood-crimson lightning forks inside 18% margins.`
- `vfx_ataque_3`: `Branching jagged golden-white and crimson Kamutoke thunder discharge arcs strictly inside 18% margins.`
- `vfx_ataque_4`: `Dimensional reality shatter — jagged ink-black spatial tear filled with blood-crimson cracks, blinding white lightning seams and floating crystal-glass cursed shards inside 18% margins.`

---

### 6.3 Prompt Rápido para `_extra_2x1.png` (Só +2 Frames — Para Sprites Sem Corte)

Use **somente** nas **89 sheets sem corte (`Sem corte`)** quando quiser manter os 4 quadros atuais intactos e adicionar os 2 quadros extras de suavização (`_extra_2x1.png`):

```text
Attached is the current action sprite reference ([COLAR O frame_1/frame_3 DA AÇÃO]). Generate a 2x1 horizontal spritesheet (2 columns, 1 row, 2 equal cells, 1024x512px) on solid flat pure magenta (#FF00FF), NO grid line, NO border, NO text, exact same anime art style, colors, proportions, and ground baseline facing RIGHT, with 18% empty top margin and 14% side margins.
LEFT CELL (ANTICIPATION / IN-BETWEEN): Draw an intermediate transition pose slightly earlier/coiling right before the peak strike of the reference image.
RIGHT CELL (FOLLOW-THROUGH / RECOVERY): Draw an intermediate recoil/dissipation pose right after the impact as energy clears and character returns toward fighting guard.
```
