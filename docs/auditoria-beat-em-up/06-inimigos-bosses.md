# 06 — Auditoria Individual de Inimigos Comuns e Bosses

## 1. Inimigos Comuns (NPCs)

### 1.1 Sistema de IA e Comportamento Geral (`BeatEmUpScene.ts:897-1000`)
- **Flanqueamento por Slots (`aiFlankSide`, `aiFlankZOffset`):** Cada NPC recebe lado preferencial (`±1`) e faixa Z (`-26, 0, +26`), evitando empilhamento total em um único pixel.
- **Telegraph:** Antes de atacar, o NPC exibe anel amarelo no chão por `0.28s–0.42s` (`aiTelegraphTimer`).
- **PROBLEMA CONFIRMADO (P2) — NPCs não reavaliam o lado do flanco dinamicamente:** Se 2 NPCs com `aiFlankSide = +1` sobrevivem e o jogador se encosta na borda direita da arena, ambos ficam comprimidos no mesmo ponto atrás/à direita do jogador sem trocar para `aiFlankSide = -1`.
- **PROBLEMA CONFIRMADO (P2) — `npc_civil_brasil` e `npc_civil_vermelho` sem `getup`:** Ao levantar de `knockdown`, saltam direto para `idle` durante `0.45s` (invulneráveis, sem transição visual de levantamento).
- **PROBLEMA CONFIRMADO (P3) — `npc_politico` sem `run`:** Quando está longe (`dist > 260`), caminha na velocidade base (`145 px/s`), o que combina com o arquétipo *heavy*, mas não tem animação de bloqueio/esquiva com a pasta.

| NPC | Animações Presentes | Animações Faltantes | Velocidade / HP | Bugs Específicos |
|---|---|---|---|---|
| `npc_civil_brasil` | 8 (`idle, walk, run, ataque_1, ataque_2, hitstun, knockdown, ko_defeat`) | `getup`, `block` | 175 / 280 HP | `ko_defeat` **F4 invertido horizontalmente**; teletransporte de `knockdown` → `idle` |
| `npc_civil_vermelho` | 8 (`idle, walk, run, ataque_1, ataque_2, hitstun, knockdown, ko_defeat`) | `getup`, `block` | 195 / 320 HP | `knockdown` F2 corte `R`; teletransporte de `knockdown` → `idle` |
| `npc_politico` | 8 (`idle, walk, ataque_1, ataque_2, hitstun, knockdown, getup, ko_defeat`) | `run`, `block` | 145 / 420 HP | `ataque_2` F3/F4 corte `R`, `knockdown` F6 corte `R` |

---

## 2. Chefões Regionais (Bosses)

### 2.1 Auditoria Individual

#### A) `boss_lula` — Presidente Lula (`CHEFÃO DO PLANALTO` · Brasília)
- **HP Base:** `2600` (`×0.78` Fácil / `×1.25` Mestre) · **Velocidade:** `185`.
- **Kit implementado:** `ataque_1` (combo curto), `ataque_2` (investida com super-armadura), `ataque_3` (projétil `Onda do Discurso` + `vfx_ataque_3`), `ataque_4` (área em fúria HP < 50% + `vfx_ataque_4`), `block`.
- **Problemas encontrados:**
  1. **Assets:** 9 frames com corte (`ataque_1` F1:L, `ataque_3` F3/F4:R, `ataque_4` F4:L, `block` F3:R, `ko_defeat` F6:R, `victory` F3:T, `vfx_ataque_4` F3:TR, F4:RB) e `ataque_4` F4 com halo escuro sobre o corpo.
  2. **IA / Leitura:** `dash` existe no pack (6 frames limpos), mas **a IA do Boss nunca usa `dash`** (`BeatEmUpScene.ts:914-958`)!

#### B) `boss_pavanato` — Vereador Pavanato (`CHEFÃO DO TERREIRO` · Pelourinho)
- **HP Base:** `2400` · **Velocidade:** `205` (mais ágil dos 3).
- **Kit implementado:** `ataque_1`..`ataque_4` + 4 VFX + `block` + `getup` + `ko_defeat`.
- **Problemas encontrados:**
  1. **Assets:** 6 frames com corte (`ataque_2` F4:L, `ataque_3` F3/F4:R nas ondas do megafone, `ataque_4` F2:T, F4:TL, `dash` F4:L). Todos os 4 VFX estão **sem cortes (`0 clipped`)**.
  2. **IA:** Não utiliza `dash` nem possui diálogo/animação de entrada própria (entra apenas caminhando da borda direita em `state = 'walk'`).

#### C) `boss_flavio_bolsonaro` — Senador Flávio (`CHEFÃO DO MARACANÃ` · Rio de Janeiro)
- **HP Base:** `2550` · **Velocidade:** `190`.
- **Problemas encontrados:**
  1. **Assets:** 16 frames com corte (`ataque_1`, `ataque_3`, `ataque_4`, `block`, `dash`, `victory`, `vfx_ataque_4`).
  2. **Consistência visual:** Em `ataque_4` F2, o cabelo muda para estilo espetado e o personagem flutua acima da linha de chão (`footSpan`).

---

## 3. Problemas Comuns na Lógica dos 3 Bosses (`BeatEmUpScene.ts`)

1. **PROBLEMA CONFIRMADO (P1) — Falta de Entrada Dramática e Transição de Fase:**
   - Quando a Wave 5 inicia, o Boss entra simplesmente no estado `walk` fora da tela sem animação de introdução, sem pose/provocação inicial (`victory` ou `ataque_4` pose) e sem invulnerabilidade curta de chegada (apenas `0.25s`).
   - Ao atingir `< 50%` HP (`bossEnraged = true` na L906), só altera `damageScale` e `moveSpeed` com texto flutuante, sem disparar burst de knockback/aura nem resetar cooldowns para apresentar a mudança de fase de forma legível.
2. **PROBLEMA CONFIRMADO (P2) — Boss pode ficar preso em loop de `block` ou ser stunlockado por `ataque_1`:**
   - Como o Boss não tem contador de hits consecutivos (*combo breaker* / super-armadura após X golpes), o jogador pode alternar `A1` + recuo ou encostar o Boss no canto da arena (`lockMaxX`) e drenar seu HP com pouca reação, já que `aiThinkTimer` só decide `block` em `ataque_3`/`ataque_4` (`L946`).
3. **PROBLEMA CONFIRMADO (P2) — `vfx_ataque_4` do Boss spawna deslocado à frente (`x + facing * 85`) em vez de centralizado no ataque em área.**
4. **PROBLEMA CONFIRMADO (P2) — `dash` do Boss não é acionado pela IA** apesar de todos os 3 Bosses possuírem `dash_3x2.png` extraído.
