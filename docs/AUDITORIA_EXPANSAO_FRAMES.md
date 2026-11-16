# Auditoria de Sprites — Reaproveitamento vs. Regeneração (Expansão 10/12/15/20/40 Frames)

Este documento apresenta o levantamento técnico completo dos **3.052 frames** atualmente publicados em [manifest.json](file:///home/spira/animekombat/public/assets/characters/manifest.json) frente à nova regra de frame-data e ao conjunto unificado de ações (principais + estruturais + Beat 'em Up de [BEAT_EM_UP_ACOES_FALTANTES.md](file:///home/spira/animekombat/docs/BEAT_EM_UP_ACOES_FALTANTES.md) e [SPRITESHEETS_FALTANTES.md](file:///home/spira/animekombat/docs/SPRITESHEETS_FALTANTES.md)).

---

## 1. Nova Regra Oficial de Frames por Ação

| Ação / Categoria | Frames Exigidos | Startup | Active | Recovery | Folhas `3×2` (`1536×1024`) |
|---|---:|---:|---:|---:|---:|
| **18 ações não listadas** (`idle`, `run`, `walk`, `jump`, `land`, `dash`, `crouch`, `block`, `hitstun`, `knockdown`, `getup`, `victory`, `evolve`, `ki_charge`, `air_ataque_1`, `grab`, `throw`, `pickup`) | **10** | — | — | — | **2** (`parte_1`: 6f, `parte_2`: 4f) |
| **Golpe 1** (`ataque_1` + `vfx_ataque_1`) | **12** | 3 | 4 | 5 | **2** (`parte_1`: 6f, `parte_2`: 6f) |
| **Golpe 2** (`ataque_2` + `vfx_ataque_2`) | **15** | 4 | 6 | 5 | **3** (`parte_1`: 6f, `parte_2`: 6f, `parte_3`: 3f) |
| **Golpe 3** (`ataque_3` + `vfx_ataque_3`) | **20** | 7 | 6 | 7 | **4** (`parte_1..3`: 18f, `parte_4`: 2f) |
| **Ult** (`ataque_4` + `vfx_ataque_4`) | **40** | 14 | 16 | 10 | **7** (`parte_1..6`: 36f, `parte_7`: 4f) |

**Total por Fase (18 ações de 10f + 4 ataques + 4 VFX):**
- **Frames por Fase:** `(18 × 10) + 2×(12 + 15 + 20 + 40) = 180 + 174 =` **354 frames / fase**
- **Folhas `3×2` por Fase:** `(18 × 2) + 2×(2 + 3 + 4 + 7) = 36 + 32 =` **68 folhas `3×2` / fase**
- **Por Personagem (4 fases):** **1.416 frames** (**272 folhas `3×2`**)
- **Total do Jogo (9 personagens × 4 fases = 36 formas):** **12.744 frames** (**2.448 folhas `3×2`**)

---

## 2. Análise: O que Pode Ser Reaproveitado vs. O que Precisa Ser Regenerado

### O que PODE ser reaproveitado
1. **Referência Visual Oficial (*Character & Style Anchor*):**
   - Os **3.052 frames** atuais em `public/assets/characters/` (especialmente o `idle` e os 4 ataques de cada uma das 36 formas) estão 100% limpos, sem pixel art e sem sprites trocados.
   - Eles devem ser usados como **referência visual obrigatória** no Task do Gemini para travar traço *cel-shaded*, proporção corporal, paleta, cabelo/aura/armas e design de cada transformação.
2. **Poses-chave (*Keyframes*):**
   - As poses principais de `idle`, `run`, `jump`, `block`, `hitstun` e `ataque_1..4` atuais servem de guia de pose para o Gemini expandir a sequência com quadros intermediários (*in-betweens*) de Startup, Active e Recovery.

### O que PRECISA ser regenerado
1. **Todas as 10 ações atuais + 4 VFX em todos os 9 personagens (36 formas):**
   - Atualmente possuem apenas **6 frames** (ou **4 frames** em 7 VFX do Naruto). Nenhuma ação atual atinge `10 / 12 / 15 / 20 / 40` frames.
   - Em especial, **`crouch`** precisa ser regenerado realmente agachado (~60–65% da altura em pé), pois várias folhas antigas estavam quase eretas como o `idle`.
   - Costurar frames novos de IA em cima de recortes antigos gera diferença de espessura de traço, iluminação e *jitter* de escala; por isso, **todas as sequências devem ser geradas contínuas do Frame 1 ao último frame** no padrão `3×2` (`1536×1024 px`).
2. **12 ações novas ou parciais em todas as 36 formas:**
   - **Estruturais (`dash`, `land`, `knockdown`, `victory`):** só existem hoje em `goku/fase_2` (6f) e `naruto/fase_1` (6f) — precisam de 10 frames em todas as 36 formas.
   - **Fechamento de ciclo (`getup`, `evolve`, `ki_charge`):** inexistentes hoje (0/36 formas).
   - **Beat 'em Up (`walk`, `air_ataque_1`, `grab`, `throw`, `pickup`):** inexistentes hoje (0/36 formas).

---

## 3. Inventário Atual por Personagem (Base de Referência)

| Personagem | Fases | Frames Atuais (Ref.) | Ações Atuais / Fase | Folhas `3×2` a Gerar (4 Fases) |
|---|---|---:|---|---:|
| **Son Goku** (`goku`) | `Base`, `Super Saiyajin`, `Super Saiyajin 3`, `Instinto Superior` | 360 | 10 ações + 4 VFX (F2 tem +4 estruturais) | **272 folhas** (1.416f) |
| **Monkey D. Luffy** (`luffy`) | `Base`, `Gear 4: Boundman`, `Gear 4: Snakeman`, `Gear 5` | 336 | 10 ações + 4 VFX | **272 folhas** (1.416f) |
| **Naruto Uzumaki** (`naruto`) | `Normal`, `Quatro Caudas`, `Manto Kurama`, `Modo Bárion` | 340 | 10 ações + 4 VFX (F1 tem +4 estruturais) | **272 folhas** (1.416f) |
| **Ryomen Sukuna** (`sukuna`) | `1-3 Dedos`, `15 Dedos`, `Meguna`, `Era Heian` | 336 | 10 ações + 4 VFX | **272 folhas** (1.416f) |
| **Roronoa Zoro** (`zoro`) | `Nitoryu`, `Santoryu`, `Ashura`, `King of Hell` | 336 | 10 ações + 4 VFX | **272 folhas** (1.416f) |
| **Sasuke Uchiha** (`sasuke`) | `Sharingan 3 Tomoes`, `Selo Amaldiçoado Nv.2`, `EMS`, `Susano'o Indra` | 336 | 10 ações + 4 VFX | **272 folhas** (1.416f) |
| **Seiya de Pégaso** (`seiya`) | `Pégaso V2`, `Pégaso Dourada`, `Odin Robe`, `Kamui Divina` | 336 | 10 ações + 4 VFX | **272 folhas** (1.416f) |
| **Inuyasha** (`inuyasha`) | `Humana`, `Hanyou`, `Youkai`, `Daiyoukai` | 336 | 10 ações + 4 VFX | **272 folhas** (1.416f) |
| **Tony Tony Chopper** (`chopper`) | `Brain Point`, `Horn Point`, `Kung Fu Point`, `Monster Point` | 336 | 10 ações + 4 VFX | **272 folhas** (1.416f) |
| **TOTAL** | **36 formas** | **3.052** | — | **2.448 folhas** (**12.744f**) |
