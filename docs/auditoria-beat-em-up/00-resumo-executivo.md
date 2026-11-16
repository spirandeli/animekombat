# 00 — Resumo Executivo: Auditoria e Alinhamento do Modo Beat 'em Up

**Projeto:** AnimeKombat PWA (`animekombat-pwa`)  
**Modo Auditado:** Beat 'em Up: Ruas do Brasil  
**Stack:** TypeScript 5.7.2 + Vite 5.4.21 + Canvas 2D + Web Audio API + PWA (`vite-plugin-pwa` 0.21.2) + Python/Pillow (pipeline de extração)  
**Status Geral:** **FUNCIONAL EM BUILD / COM PROBLEMAS CONFIRMADOS DE INTEGRAÇÃO E ASSETS (NÃO HOMOLOGADO)**

---

## 1. Síntese Executiva

O modo **Beat 'em Up: Ruas do Brasil** foi integrado com:
- **9 heróis jogáveis** (4 fases cada, 20 ações base por fase em `public/assets/characters/manifest.json`);
- **3 arquétipos de NPCs** (`npc_civil_brasil`, `npc_civil_vermelho`, `npc_politico` — 24 sheets `3×2`, 144 frames WebP);
- **3 Chefões Regionais** (`boss_lula`, `boss_pavanato`, `boss_flavio_bolsonaro` — 51 sheets `3×2`, 306 frames WebP incluindo 12 sheets de VFX);
- **3 Mapas Panorâmicos do Brasil** (Brasília, Pelourinho, Rio de Janeiro — 9 PNGs de `1536×1024 px` somando `4608×1024 px` por fase);
- **Motor dedicado** em [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts) e [BeatEmUpMap.ts](file:///home/spira/animekombat/src/game/BeatEmUpMap.ts), preservando integralmente os modos existentes (`1v1` e `Rumble` em [ArenaScene.ts](file:///home/spira/animekombat/src/game/ArenaScene.ts)).

Entretanto, a auditoria técnica, visual e estrutural identificou **18 problemas classificados (P0–P3)** entre código, assets e design que impedem a homologação imediata.

---

## 2. Principais Achados Críticos (P0 / P1)

| ID | Prioridade | Categoria | Resumo |
|---|---|---|---|
| **BEU-01** | **P0** | Código / Controles | `InputManager.sample()` dispara `justJump = true` quando `up` (`W`/`ArrowUp`/stick ↑) é pressionado com `jumpViaStickEnabled = true` (padrão). No Beat 'em Up 2.5D, andar para cima no eixo `Z` faz o personagem pular involuntariamente. |
| **BEU-02** | **P1** | Código / Interface | Classes CSS desalinhadas no HUD e tela de seleção: `BeatEmUpScene.ts` usa `.ak-name-row` / `.ak-fighter-name` (inexistentes em `main.css`, onde existem `.ak-hud-name-row`), e `Menus.ts` usa `class="ak-char-card p1"` em vez de `selected-p1`. |
| **BEU-03** | **P1** | Assets / Sprite | `npc_civil_brasil :: ko_defeat` Frame 4 (`frame_4.webp`) está horizontalmente invertido (cabeça à direita, pés à esquerda) em relação aos demais quadros da queda. |
| **BEU-04** | **P1** | Assets / Sprite | Escala anômala em `zoro/fase_4`: `refBodyHeight = 256` (vs `318..327` nas fases 1–3) devido à postura agachada/larga do `idle`, causando aumento artificial de ~27% no tamanho de Zoro Fase 4 ao caminhar/atacar. |
| **BEU-05** | **P1** | Assets / Sprite | 31 frames de Bosses (`boss_flavio_bolsonaro`: 16, `boss_lula`: 9, `boss_pavanato`: 6) e 4 frames de NPCs possuem `clippedEdges` nas bordas das células; `boss_lula/ataque_4` F4 apresenta escurecimento/halo no núcleo da aura. |
| **BEU-06** | **P1** | Código / Animação | `grab` e `throw` não reproduzem sub-ciclos sincronizados: `grab` reproduz todos os 10 frames em loop/progresso fixo em vez de travar o clinch (`F2..F6`) e disparar `F7..F8` apenas na joelhada. |
| **BEU-07** | **P1** | Código / Combate | Ausência de normalização e buffer de cancelamento nas transições aéreas/terrestres, além de `ataque_1` em `BeatEmUpScene.ts` não possuir hitstop diferenciado nem combo de 3 golpes distintos (A1→A1→A1). |

---

## 3. Cobertura de Verificação

| Área Auditada | Método | Classificação |
|---|---|---|
| Build TypeScript + Vite PWA (`npm run build`) | Execução real (`tsc && vite build`) | **APROVADO** (0 erros; bundle `307.46 kB`) |
| Integridade de manifests e 13.005 arquivos WebP + 9 PNGs | Execução real (`verify_beatemup_audit.mjs`, `run_audit_metrics.py`) | **APROVADO** (0 ausentes, 0 órfãos WebP) |
| Inspeção visual de spritesheets (NPCs, Bosses, Heróis, Mapas) | Folhas de contato numeradas + leitura de imagens | **PROBLEMA CONFIRMADO** (cortes, flip F4, escala Zoro F4) |
| Movimentação 2.5D, Input e Combate | Inspeção estática linha-a-linha do código | **PROBLEMA CONFIRMADO** (conflito `jumpViaStick`, `doubleTapDash` duplo) |
| Gameplay em runtime no navegador (60 FPS, inputs reais, câmera ao vivo) | Sem Chromium/Playwright no ambiente | **NÃO TESTADO** (pendente de validação em navegador) |

---

## 4. Próximos Passos Recomendados

Seguir estritamente o plano incremental de 8 fases em [11-plano-correcoes.md](file:///home/spira/animekombat/docs/auditoria-beat-em-up/11-plano-correcoes.md), começando pela **Fase A** (desacoplar `jumpViaStick` no Beat 'em Up e corrigir classes CSS de HUD/Menu) e seguindo até a **Fase H** (homologação em navegador real).
