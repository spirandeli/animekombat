# 08 — Auditoria de VFX, Câmera e Interface (HUD & Menus)

## 1. Câmera

| Comportamento | Evidência (`BeatEmUpScene.ts`) | Status |
|---|---|---|
| Suavização de seguimento | `camLeftWorld += (targetLeft - camLeftWorld) * Math.min(1, dt * 7.5)` (`L1063`) | **APROVADO** (suave sem tremor) |
| Enquadramento do jogador | `targetLeft = player.x - viewW * 0.38` | **APROVADO** (deixa ~62% de visão à frente) |
| Tremor de câmera nos impactos | `shakeTime = 0.16`, `shakeIntensity = 7` quando `dmg >= 120` | **APROVADO** |
| Travamento em Arena (`arenaLocked`) em telas > `3:2` | `minLeft = lockMinX` (`3072`) com `viewW ≈ 1820–2130 > 1536` (`L1059-1063`) | **PROBLEMA CONFIRMADO (P0/P1)** — Gera faixa preta à direita na Wave 5 (Boss) e parede invisível na Wave 1 |
| Transição ao liberar onda | `arenaLocked = false`, banner `GO! →` piscante por `3.2s` | **APROVADO** |

---

## 2. Efeitos Visuais (VFX) e Partículas

- **VFX do Jogador (`vfx_ataque_1..4`):** Reutiliza os packs WebP de alta qualidade de cada fase do herói (`BeatEmUpScene.ts:750, 1020`).
- **PROBLEMA CONFIRMADO (P2) — Posição e escala de `vfx_ataque_4` nos Bosses:** Em `BeatEmUpScene.ts:882`, o VFX do Boss spawna em `e.x + e.facing * 85` para todos os ataques, inclusive `ataque_4` (que é área centrada no Boss).
- **PROBLEMA CONFIRMADO (P3) — Alocação de arrays em VFX / Textos flutuantes:** Diferente de `CombatSystem.ts` (que usa object pools pré-alocados), `BeatEmUpScene.ts:1040-1052` usa `.push()` + `.filter()` a cada quadro para `projectiles`, `vfxs` e `floatingTexts`. O volume atual é baixo (~10–20 itens), mas em combates longos gera GC evitável.
- **Ausência de partículas de poeira/impacto no chão:** `BeatEmUpScene.ts` não gera faíscas de impacto nem poeira de aterrissagem (`onLand` / `onJumpDust` existentes em `ArenaScene`).

---

## 3. Interface (HUD de Combate, Menus e Touch)

### 3.1 **PROBLEMA CONFIRMADO (P1) — Desalinhamento de classes CSS no HUD e Tela de Seleção**
1. **HUD de Combate ([BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts#L1318-L1354)):**
   - Usa `.ak-name-row` e `.ak-fighter-name`, mas [main.css](file:///home/spira/animekombat/src/styles/main.css#L476) define **`.ak-hud-name-row`** (sem `.ak-name-row`!). Logo, a linha com nome do herói, badge `F1`, e título do Chefão perde o `display: flex`, `gap: 6px`, `text-transform: uppercase` e `text-shadow`.
   - `#beu-boss-wrap` está fora do fluxo de `display` quando `.hidden` é removido? Não — `.hidden` em `main.css` é `display: none !important`, então ao remover `.hidden` ele volta a `display: flex` de `.ak-fighter-hud.p2`; porém o `#beu-boss-wrap` usa `ak-name-row` em vez de `ak-hud-name-row`, desalinhando o título do Chefão em relação à barra vermelha.
2. **Seleção Beat 'em Up ([Menus.ts](file:///home/spira/animekombat/src/ui/Menus.ts#L1108-L1119)):**
   - Os cards de heróis usam `class="ak-char-card ${this.selectedP1 === c.id ? 'p1' : ''}"`, mas [main.css](file:///home/spira/animekombat/src/styles/main.css#L288) estiliza **`.ak-char-card.selected-p1`** (e não `.ak-char-card.p1`)! Como resultado, o herói selecionado na grade Beat 'em Up não recebe destaque de borda/brilho ciano!
   - A grade `.ak-roster-grid` foi inserida dentro de `.ak-pedestal-col` (coluna esquerda estreita) em vez de ficar no painel central, podendo comprimir os 9 cards em telas landscape compactas (`height <= 430px`).

### 3.2 **Controles Virtuais (`VirtualControls.ts`)**
- `VirtualControls.updateVisualState(...)` é atualizado corretamente a cada frame em `BeatEmUpScene.ts:1300-1314`, exibindo cooldowns, falta de Ki e badge `EVO!` no mobile touch.
- **Ressalva:** Na pré-partida (`openPreMatchControls`), as dicas de teclado ainda exibem o layout padrão (`Luta`), sem mencionar que `Espaço` pula e `A1+Direção` faz agarrão (`grab`).
