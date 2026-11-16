# 11 — Plano de Alinhamento e Implementação (Fases A–H)

> Plano incremental para resolver todos os problemas (`BEU-01` a `BEU-18`) preservando os modos `1v1` e `Rumble` intactos.

---

## Fase A — Correções Estruturais e Bloqueantes (P0 / P1)
- **Objetivo:** Eliminar bugs bloqueantes de controle, câmera em widescreen, CSS de interface e precache PWA.
- **Problemas resolvidos:** `BEU-01`, `BEU-02`, `BEU-03`, `BEU-08`.
- **Arquivos impactados:** [InputManager.ts](file:///home/spira/animekombat/src/engine/InputManager.ts), [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts), [Menus.ts](file:///home/spira/animekombat/src/ui/Menus.ts), [vite.config.ts](file:///home/spira/animekombat/vite.config.ts).
- **Tarefas em ordem:**
  1. Adicionar `setBeatEmUpInputMode(enabled: boolean)` em `InputManager` desativando `stickJumpJust` e `doubleTapDash` apenas quando `enabled = true`.
  2. Ajustar `updateCamera` e `clampActorToPlayableBounds` em `BeatEmUpScene.ts` para considerar `viewWorldW` dinâmico na Arena Lock (`16:9` / `20:9`).
  3. Corrigir classes CSS em `BeatEmUpScene.ts` (`.ak-hud-name-row`) e `Menus.ts` (`selected-p1` + layout da grade de heróis no Beat 'em Up).
  4. Ajustar `globPatterns` em `vite.config.ts` para evitar precache de 49 MB no boot.
- **Dependências:** Nenhuma.
- **Riscos:** Restaurar `setBeatEmUpInputMode(false)` ao sair do modo para não quebrar pulo no `1v1`.
- **Critério de conclusão:** Andar em `W`/`Up` não pula; sem faixa preta na Wave 5 em `1280×720`; precache PWA `< 2 MB`.
- **Testes obrigatórios:** `npm run build` + teste unitário de `InputManager` + teste de cálculo de câmera.

---

## Fase B — Sprites e Animações (Assets + Pipeline)
- **Objetivo:** Corrigir escala de `zoro/fase_4`, frame invertido de `npc_civil_brasil`, cortes em Bosses e sincronização de `grab`/`knockdown`/`victory`.
- **Problemas resolvidos:** `BEU-04`, `BEU-05`, `BEU-07`, `BEU-09`.
- **Arquivos impactados:** [process_expandidos.py](file:///home/spira/animekombat/scripts/process_expandidos.py), [process_beatemup.py](file:///home/spira/animekombat/scripts/process_beatemup.py), [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts), `spritesPersonagens/expandidos/{bosses,npcs}/*.zip`.
- **Tarefas em ordem:**
  1. Ajustar `_compute_ref_size` para considerar `walk` quando `idle` for muito agachado (`zoro/fase_4`) e regenerar apenas `zoro/fase_4` no `manifest.json`.
  2. Corrigir orientação horizontal de `npc_civil_brasil/ko_defeat` F4 e reprocessar `process_beatemup.py`.
  3. Re-gerar folhas com cortes críticos nos Bosses (`boss_flavio_bolsonaro/ataque_4, dash, ataque_1`, `boss_lula/ataque_4, vfx_ataque_4`, `boss_pavanato/ataque_3`).
  4. Corrigir reprodução de `grab` (loop clinch + sub-ciclo joelhada), `knockdown` (`stateDuration`) e `victory` em `BeatEmUpScene.ts`.
- **Dependências:** Fase A.
- **Riscos:** Mudança de `manifest.json` pode afetar âncoras de `zoro/fase_4` no `1v1`; validar âncoras após gerar.
- **Critério de conclusão:** `zoro/fase_4` `refBodyHeight` entre `310–330`; 0 flips em `ko_defeat`; 0 congelamentos em `grab`/`knockdown`.
- **Testes obrigatórios:** `run_audit_metrics.py` + inspeção visual de folhas de contato.

---

## Fase C — Movimentação e Controles
- **Objetivo:** Tornar sprint por duplo toque funcional, adicionar *input buffering* e cancelamento de `land`/`pickup`.
- **Problemas resolvidos:** `BEU-11` e lacunas de responsividade da Etapa 3.
- **Arquivos impactados:** [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts).
- **Tarefas em ordem:**
  1. Persistir `isSprinting` no `BeatActor` no duplo toque horizontal até soltar direção.
  2. Adicionar buffer de `120ms` para `jump`, `dash` e `ataque_1..4` durante final de animações.
  3. Permitir cancelamento imediato de `pickup` e `land` por movimento ou ataque.
- **Dependências:** Fase A (`BEU-01`).
- **Riscos:** Double-tap muito sensível pode disparar corrida acidental; calibrar janela para `230ms`.
- **Critério de conclusão:** `→ →` mantém corrida contínua e cancelar pouso com golpe responde sem perda de comando.
- **Testes obrigatórios:** Testes unitários de sequência de entrada simulada.

---

## Fase D — Combate, Combos e Hitboxes
- **Objetivo:** Calibrar frame data Beat 'em Up, retângulos de colisão reais e modo debug completo.
- **Problemas resolvidos:** `BEU-06`, `BEU-10`, `BEU-18` (parte debug).
- **Arquivos impactados:** [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts).
- **Tarefas em ordem:**
  1. Criar tabela `BEAT_EM_UP_ATTACK_SPECS` com tempos ágeis (`ataque_1 <= 0.34s`, `ataque_2 <= 0.56s`, `ataque_3 <= 0.62s`, `ataque_4 <= 1.05s`).
  2. Implementar retângulo 2.5D completo `(rectX, rectY, rectZ)` na checagem de melee e projéteis, tornando `ataque_4` radial em área.
  3. Desenhar hitboxes ativas (vermelho) e índice de frame `F{i}/{N}` no overlay `F3`.
- **Dependências:** Fase B, Fase C.
- **Riscos:** Reduzir duração demais pode encurtar visualmente ultimates de 40 frames; manter curva de easing no `ataque_4`.
- **Critério de conclusão:** Combos `A1→A2→A3/A4` fluidos, `F3` exibe hitboxes sincronizadas com frames ativos.
- **Testes obrigatórios:** Teste unitário de intersecção de hitbox/hurtbox e janela de cancelamento.

---

## Fase E — Inimigos e Bosses
- **Objetivo:** Enriquecer comportamento tático de NPCs e Bosses evitando exploits.
- **Problemas resolvidos:** `BEU-12`, `BEU-13`.
- **Arquivos impactados:** [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts), `spritesPersonagens/expandidos/npcs/`.
- **Tarefas em ordem:**
  1. Recalcular `aiFlankSide` dinamicamente quando o lado alvo estiver bloqueado pela borda da arena.
  2. Adicionar `dash`, pose de entrada e *combo-breaker* (após 5 hits seguidos) nos Bosses.
  3. Adicionar `getup` para os 2 NPCs civis (ou transição animada dedicada).
- **Dependências:** Fase D.
- **Riscos:** *Combo-breaker* agressivo demais pode frustrar o jogador no modo Fácil; escalar limiar por `AIDifficulty`.
- **Critério de conclusão:** Impossível travar o Boss em stunlock infinito na borda; NPCs cercam pelos dois lados.
- **Testes obrigatórios:** Teste de IA e playtest nas 3 dificuldades.

---

## Fase F — Mapas e Cenários
- **Objetivo:** Eliminar costuras visíveis entre trechos e calibrar profundidade caminhável por mapa/trecho.
- **Problemas resolvidos:** `BEU-14`, `BEU-17` (limpeza de arquivos).
- **Arquivos impactados:** [BeatEmUpMap.ts](file:///home/spira/animekombat/src/game/BeatEmUpMap.ts), `public/assets/backgrounds/beatemup/`.
- **Tarefas em ordem:**
  1. Aplicar faixa de blend/transição nas emendas `x=1536` e `x=3072` durante `renderBeatEmUpBackground`.
  2. Calibrar `walkMinZ` por trecho (ex.: `725` em Copacabana/Lacerda).
  3. Remover duplicatas `<cidade>.png` não utilizadas dentro de `beatemup/` e avaliar conversão WebP.
- **Dependências:** Fase A (`BEU-02`).
- **Risco de regressão:** Baixo.
- **Critério de conclusão:** Transição visual suave entre os 3 trechos e zero colisão visual com mobiliário de fundo.
- **Testes obrigatórios:** `verify_beatemup_audit.mjs` + inspeção visual de scroll.

---

## Fase G — Polimento e Otimização
- **Objetivo:** Gerenciamento de memória de bitmaps, VFX centrados, partículas e zero-GC.
- **Problemas resolvidos:** `BEU-15`, `BEU-16`, `BEU-18` (pools).
- **Arquivos impactados:** [SpriteLoader.ts](file:///home/spira/animekombat/src/engine/SpriteLoader.ts), [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts).
- **Tarefas em ordem:**
  1. Implementar `unloadBeatEmUpUnused` e pré-carregamento antecipado da próxima evolução quando `evoEnergy >= 60`.
  2. Centralizar `vfx_ataque_4` dos Bosses e adicionar partículas de poeira/impacto.
  3. Substituir `.push()`/`.filter()` de VFX/projéteis/textos por pools pré-alocados.
- **Dependências:** Fases D, E, F.
- **Risco de regressão:** Baixo.
- **Critério de conclusão:** Uso de memória estável ao alternar entre os 3 mapas e `1v1`/`Rumble`.
- **Testes obrigatórios:** Teste de ciclo de cache + profiling de heap no DevTools.

---

## Fase H — Homologação
- **Objetivo:** Executar bateria completa de regressão automatizada e manual em navegador real (Desktop + Mobile Landscape).
- **Dependências:** Todas as fases anteriores (`A`–`G`).
- **Critério de conclusão:** 100% dos critérios de [13-criterios-homologacao.md](file:///home/spira/animekombat/docs/auditoria-beat-em-up/13-criterios-homologacao.md) aprovados.
