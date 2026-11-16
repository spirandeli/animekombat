# 10 — Matrizes Completas de Auditoria e Catálogo de Problemas (P0–P3)

## 1. Matriz de Animações (Amostra Consolidada de Todas as Entidades)

| Entidade | Ação / Grupo | Asset Real | Frames | Sequência | Transição | Resultado |
|---|---|---|---|---|---|---|
| 9 Heróis (36 fases) | `walk`, `run`, `jump`, `air_ataque_1`, `ataque_1..4` | `public/assets/characters/<char>/fase_1..4/<acao>/` | 8–40 | Validada (heróis) | Pendente em `air_ataque_1`→`land` | **APROVADO** (exceto escala Zoro F4) |
| `zoro` (`fase_4`) | `idle` vs `walk` | `public/assets/characters/zoro/fase_4/idle/` | 10 | Validada | Escala salta +27% | **PROBLEMA CONFIRMADO** |
| 9 Heróis (`fase_1..4`) | `grab`, `throw`, `pickup` | `public/assets/characters/<char>/fase_1..4/{grab,throw,pickup}/` | 10 | Desalinhada em `grab` (F1..F10 linear) | Trava em `pickup`/`grab` | **PROBLEMA CONFIRMADO** |
| `npc_civil_brasil` | `idle, walk, run, ataque_1, ataque_2, hitstun, knockdown` | `public/assets/beatemup/npc_civil_brasil/fase_1/` | 6 cada | Validada | Sem `getup` (pula p/ `idle`) | **PROBLEMA CONFIRMADO** |
| `npc_civil_brasil` | `ko_defeat` | `public/assets/beatemup/npc_civil_brasil/fase_1/ko_defeat/` | 6 | **F4 invertido 180°** | Piscar SNES OK | **PROBLEMA CONFIRMADO** |
| `npc_civil_vermelho` | 8 ações (`idle..ko_defeat`) | `public/assets/beatemup/npc_civil_vermelho/fase_1/` | 6 cada | Validada (`knockdown` F2 corte R) | Sem `getup` | **PROBLEMA CONFIRMADO** |
| `npc_politico` | 8 ações (`idle..ko_defeat` + `getup`) | `public/assets/beatemup/npc_politico/fase_1/` | 6 cada | `ataque_2` F3/F4 corte R; `knockdown` F6 corte R | Sem `run`/`block` | **PROBLEMA CONFIRMADO** |
| `boss_lula` | 13 ações + 4 VFX | `public/assets/beatemup/boss_lula/fase_1/` | 6 cada | `ataque_4` F4 halo escuro; 9 frames com corte | `dash` não usado pela IA | **PROBLEMA CONFIRMADO** |
| `boss_pavanato` | 13 ações + 4 VFX | `public/assets/beatemup/boss_pavanato/fase_1/` | 6 cada | 6 frames com corte (`ataque_2/3/4, dash`); 0 cortes em VFX | `dash` não usado pela IA | **PROBLEMA CONFIRMADO** |
| `boss_flavio_bolsonaro` | 13 ações + 4 VFX | `public/assets/beatemup/boss_flavio_bolsonaro/fase_1/` | 6 cada | `ataque_4` F2 cabelo diferente/flutuando; 16 frames c/ corte | `dash` não usado pela IA | **PROBLEMA CONFIRMADO** |

---

## 2. Matrizes de Jogabilidade, Mapas, IA/Bosses e Performance

### 2.1 Jogabilidade & Combate
| Sistema | Comportamento Esperado | Comportamento Observado (Evidência) | Problema | Prioridade |
|---|---|---|---|---|
| Movimentação Z (`W`/`Up`) | Andar para cima na profundidade da rua | `InputManager.ts:516` dispara `justJump` com `jumpViaStick=true` | Pulo involuntário ao subir na rua | **P0** |
| Corrida (`doubleTap`) | Duplo toque inicia `run` contínuo | `InputManager.ts:497` dispara `dash` antes; `isDoubleTapSprint` não persiste (`BeatEmUpScene.ts:585`) | Sprint só funciona segurando botão `dash` | **P2** |
| Duração de golpes (`ataque_2/3`) | Golpes ágeis (~0.45–0.65s) | `computeActionDuration` escala por `frames/6` até `1.45s` (`L542`) | Herói fica preso até `1.45s` vulnerável | **P1** |
| Hitbox 2.5D & `ataque_4` | AABB real com alcance coerente e área em `ataque_4` | `performMeleeHitCheck` só testa distância X/Z e `|dAirY|<130`; `ataque_4` não acerta costas | Colisões imprecisas / `ataque_4` unidirecional | **P1** |
| Grab & Throw | Clinch estável + joelhada animada + soltura opcional | `grab` usa frames `F1..F10` em `0.45s` e congela em F10 (`L624`) | Animação congelada e sem cancelamento | **P1** |

### 2.2 Mapas, Câmera, Interface & Performance
| Sistema | Comportamento Esperado | Comportamento Observado (Evidência) | Problema | Prioridade |
|---|---|---|---|---|
| Câmera em Arena Travada (`16:9+`) | Preencher 100% da largura da tela sem área vazia | `lockMinX=3072` com `viewW≈1820` deixa faixa preta à direita na Wave 5 (`L1059`) | Faixa preta à direita na luta do Boss | **P0** |
| Junções de Trechos (`bg_1\|bg_2\|bg_3`) | Transição visual contínua | Diferença média RGB `35.0–73.9` nas emendas `x=1536, 3072` | Costura vertical seca no cenário | **P2** |
| HUD & Seleção | Estilização idêntica ao resto do jogo | `.ak-name-row` (CSS tem `.ak-hud-name-row`) e `.p1` (CSS tem `.selected-p1`) | Nomes desalinhados / card sem borda ativa | **P1** |
| Precache PWA (`vite.config.ts`) | Baixar só shell crítico e cachear mapas sob demanda | `globPatterns` precacheia **48,9 MB (97 entries)** | Download inicial pesado no mobile | **P1** |
| Memória Beat 'em Up | Descarregar packs antigos ao trocar modo | `SpriteLoader.unloadUnused` ignora `beatEmUpCache` | Retenção de bitmaps na troca de fases | **P2** |

---

## 3. Catálogo Priorizado Completo (11 Campos por Problema)

### **BEU-01** — Pulo involuntário ao caminhar para cima (`W` / `ArrowUp` / Stick ↑)
1. **ID:** `BEU-01` (**P0 — Bloqueante**)
2. **Arquivo:** [InputManager.ts](file:///home/spira/animekombat/src/engine/InputManager.ts#L516-L536), [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts#L868-L876)
3. **Sistema:** Controles / Movimentação 2.5D
4. **Descrição:** `jumpViaStickEnabled = true` por padrão converte pressionar `up` em `justJump = true`.
5. **Evidência:** Leitura direta de `InputManager.ts:516-532` e `SaveManager.ts:116`.
6. **Causa provável (Confiança: Alta):** `InputManager` foi projetado para arena 2D lateral (`1v1`), onde `up` pula; no Beat 'em Up `up` move em profundidade `Z`.
7. **Correção proposta:** Adicionar flag `setStickJumpSuppressed(boolean)` em `InputManager`, ativada em `BeatEmUpScene.startStage()` e desativada em `stopMatch()`.
8. **Dependências:** Nenhuma.
9. **Risco de regressão:** Baixo (desde que restaurada em `stopMatch()`).
10. **Critério de aceitação:** Pressionar `W`/`ArrowUp`/stick ↑ move apenas em `-Z`, enquanto `Espaço`/botão Pulo salta.
11. **Teste necessário:** Teste automatizado de `InputManager` + teste manual andando em Z e pulando.

### **BEU-02** — Faixa preta e parede invisível na câmera travada em telas `16:9` / `20:9`
1. **ID:** `BEU-02` (**P0 — Bloqueante**)
2. **Arquivo:** [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts#L1058-L1065), [BeatEmUpMap.ts](file:///home/spira/animekombat/src/game/BeatEmUpMap.ts#L69-L260)
3. **Sistema:** Câmera / Arena Lock
4. **Descrição:** Cada trecho tem `1536px` de largura, mas em `1280×720` (`scale = 720/1024`), `viewWorldW = 1820px > 1536px`. Travar `camLeftWorld >= lockMinX (3072)` na Wave 5 deixa `284px+` além de `4608` em preto; na Wave 1 cria parede invisível antes da borda direita.
5. **Evidência:** Cálculo direto de `getViewWorldWidth()` (`L442-445`) vs `lockMinX = 3072, lockMaxX = 4608`.
6. **Causa provável (Confiança: Alta):** `lockMaxX - lockMinX` foi definido igual a `segmentWidth (1536)`, menor que `viewWorldW` em widescreen.
7. **Correção proposta:** Calcular `effectiveMinCam = Math.max(0, Math.min(lockMinX, lockMaxX - viewW))` e expandir/clamped `lockMaxX` quando `viewW > 1536` (ou ajustar `viewScale` mínimo para que `viewWorldW <= 1536`).
8. **Dependências:** Nenhuma.
9. **Risco de regressão:** Baixo.
10. **Critério de aceitação:** Nenhuma barra preta lateral visível em `16:9` (`1280×720`) ou `21:9` durante qualquer onda.
11. **Teste necessário:** Teste unitário de cálculo de câmera em resoluções `4:3`, `16:9`, `20:9`.

### **BEU-03** — Classes CSS inexistentes no HUD e seleção Beat 'em Up
1. **ID:** `BEU-03` (**P1 — Alta**)
2. **Arquivo:** [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts#L1321-L1343), [Menus.ts](file:///home/spira/animekombat/src/ui/Menus.ts#L1109-L1119), [main.css](file:///home/spira/animekombat/src/styles/main.css#L288-L485)
3. **Sistema:** Interface / HUD / Seleção
4. **Descrição:** `ak-name-row` (deveria ser `ak-hud-name-row`) e `ak-char-card p1` (deveria ser `ak-char-card selected-p1`).
5. **Evidência:** Grep em `main.css` confirmou ausência de `.ak-name-row` e `.ak-char-card.p1`.
6. **Causa provável (Confiança: Alta):** Divergência de nomenclatura durante implementação inicial.
7. **Correção proposta:** Alinhar classes ao `main.css` existente e estilizar `.ak-beu-roster-grid` responsivo.
8. **Dependências:** Nenhuma.
9. **Risco de regressão:** Nenhum nos modos `1v1`/`Rumble`.
10. **Critério de aceitação:** Barra do player, barra do Boss e card selecionado exibem estilos idênticos ao restante do jogo.
11. **Teste necessário:** Inspeção visual em desktop e mobile `412×915` landscape.

### **BEU-04** — Escala anômala de `zoro/fase_4` (`refBodyHeight = 256`)
1. **ID:** `BEU-04` (**P1 — Alta**)
2. **Arquivo:** [manifest.json](file:///home/spira/animekombat/public/assets/characters/manifest.json), [process_expandidos.py](file:///home/spira/animekombat/scripts/process_expandidos.py#L303-L316)
3. **Sistema:** Sprites / Escala de Renderização
4. **Descrição:** `zoro/fase_4` tem `refBodyHeight = 256` (medido do `idle` agachado) enquanto `walk` tem `~303px` e fases 1–3 têm `318–327`.
5. **Evidência:** Folhas de contato `hero_zoro_fase_4_idle.png` vs `hero_zoro_fase_4_walk.png` e saída de `run_audit_metrics.py`.
6. **Causa provável (Confiança: Alta):** `_compute_ref_size` usa apenas `idle[:6]` em `process_expandidos.py`.
7. **Correção proposta:** Usar mediana entre `idle` e `walk` (ou mínimo `310` quando `walk` > `295`) para `zoro/fase_4` sem alterar a arte original.
8. **Dependências:** Nenhuma.
9. **Risco de regressão:** Baixo (melhora consistência também em `1v1` e `Rumble`).
10. **Critério de aceitação:** Altura renderizada de Zoro F4 em `walk` igual a F1–F3 (±5%).
11. **Teste necessário:** Verificação métrica no `manifest.json` + inspeção lado a lado.

### **BEU-05** — `npc_civil_brasil :: ko_defeat` F4 invertido horizontalmente
1. **ID:** `BEU-05` (**P1 — Alta**)
2. **Arquivo:** `public/assets/beatemup/npc_civil_brasil/fase_1/ko_defeat/frame_4.webp` (fonte em `npcs_ruas_do_brasil_sprites.zip`)
3. **Sistema:** Assets / Animação NPC
4. **Descrição:** F4 está espelhado para a direita enquanto F1–F3 e F5–F6 caem para a esquerda.
5. **Evidência:** Inspeção visual em `scratch/audit_sheets/npc_civil_brasil_ko_defeat.png`.
6. **Causa provável (Confiança: Alta):** Erro na geração da célula 4 na spritesheet fonte.
7. **Correção proposta:** Espelhar horizontalmente apenas `F4` no pós-processamento `process_beatemup.py` (regra pontual documentada) ou re-gerar a folha `ko_defeat_3x2.png`.
8. **Dependências:** Nenhuma.
9. **Risco de regressão:** Nenhum.
10. **Critério de aceitação:** Todos os 6 frames de `ko_defeat` caem continuamente para o mesmo lado.
11. **Teste necessário:** Inspeção visual da folha de contato `npc_civil_brasil_ko_defeat.png`.

### **BEU-06** — Duração excessiva de `ataque_2` / `ataque_3` e falta de combo `A1` fluido
1. **ID:** `BEU-06` (**P1 — Alta**)
2. **Arquivo:** [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts#L542-L546)
3. **Sistema:** Combate / Frame Data
4. **Descrição:** `ataque_2` (`1.08s`) e `ataque_3` (`1.45s`) prendem o jogador tempo demais em Beat 'em Up; `ataque_1` não encadeia combo rápido.
5. **Evidência:** Cálculo de `computeActionDuration` com 15–20 frames dos heróis.
6. **Causa provável (Confiança: Alta):** Fórmula linear herdada do ritmo tático `1v1` sem teto específico para Beat 'em Up.
7. **Correção proposta:** Definir `BEAT_EM_UP_ATTACK_CAPS` (`ataque_1 <= 0.36s`, `ataque_2 <= 0.56s`, `ataque_3 <= 0.62s`, `ataque_4 <= 1.05s`) e combo de 2–3 hits em `A1`.
8. **Dependências:** Nenhuma.
9. **Risco de regressão:** Zero para `1v1`/`Rumble`.
10. **Critério de aceitação:** Resposta ágil em combate contra grupos sem travar o jogador > 0.65s fora do Ultimate.
11. **Teste necessário:** Teste automatizado de frame data + playtest.

### **BEU-07** — Sincronização de `grab` / `knockdown` / `victory` em `BeatEmUpScene.ts`
1. **ID:** `BEU-07` (**P1 — Alta**)
2. **Arquivo:** [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts#L624-L707)
3. **Sistema:** Animação / Máquina de Estados
4. **Descrição:** `grab` e `knockdown` não definem `stateDuration`, congelando no último frame durante o clinch ou no ar; `victory` não faz loop nem mantém pose final controlada.
5. **Evidência:** `BeatEmUpScene.ts:624-660, 696-707, 1142-1168`.
6. **Causa provável (Confiança: Alta):** Ausência de inicialização explícita de `stateDuration` e mapeamento de sub-frames para `grab`.
7. **Correção proposta:** Usar frames `0..4` em loop suave durante `grab` clinch, disparar `5..7` ao pressionar `A1`, definir `stateDuration = 0.72s` no `knockdown` e loop suave em `victory` ou hold no último frame válido.
8. **Dependências:** Nenhuma.
9. **Risco de regressão:** Baixo.
10. **Critério de aceitação:** Nenhuma animação congela prematuramente em estado ativo.
11. **Teste necessário:** Teste de transição de estados e verificação de índices de frame.

### **BEU-08** — Precache PWA de `48,9 MB` em `vite.config.ts`
1. **ID:** `BEU-08` (**P1 — Alta**)
2. **Arquivo:** [vite.config.ts](file:///home/spira/animekombat/vite.config.ts#L26)
3. **Sistema:** Performance / PWA
4. **Descrição:** `globPatterns` inclui todos os `.png`, forçando precache de 38 MB de backgrounds e 10 MB de HUD no install.
5. **Evidência:** Saída do `npm run build` (`precache 97 entries (50069.86 KiB)`).
6. **Causa provável (Confiança: Alta):** Padrão `**/*.{...,png,...}` engloba `public/assets/backgrounds/` e `public/assets/hud/`.
7. **Correção proposta:** Restringir `globPatterns` aos ícones essenciais e app shell (`icons/*.png`, `js`, `css`, `html`, `webmanifest`), deixando `/assets/backgrounds/` e `/assets/hud/` no `runtimeCaching` `CacheFirst`.
8. **Dependências:** Nenhuma.
9. **Risco de regressão:** Baixo (testar modo offline após visitar as telas).
10. **Critério de aceitação:** Precache inicial < `2 MB`.
11. **Teste necessário:** `npm run build` inspecionando tamanho do precache gerado.

### **BEU-09** — Cortes (`clippedEdges`) e arte anômala em Bosses e NPCs
1. **ID:** `BEU-09` (**P1 — Alta**)
2. **Arquivo:** `spritesPersonagens/expandidos/{bosses,npcs}/*.zip` (`31` frames em Bosses, `4` em NPCs), `boss_lula/ataque_4` F4 e `boss_flavio_bolsonaro/ataque_4` F2.
3. **Sistema:** Assets / Spritesheets
4. **Descrição:** Bordas cortadas (`T/L/R/B`) em golpes de Bosses, corpo sombreado em `boss_lula/ataque_4` F4 e cabelo inconsistente em `boss_flavio_bolsonaro/ataque_4` F2.
5. **Evidência:** Métricas em `run_audit_metrics.py` + folhas de contato visuais.
6. **Causa provável (Confiança: Alta):** Safe zone insuficiente nas folhas geradas para ultimates e dashes largos.
7. **Correção proposta:** Re-gerar prioritariamente `boss_flavio_bolsonaro/ataque_4`, `dash`, `ataque_1`, `boss_lula/ataque_4`, `vfx_ataque_4` e `boss_pavanato/ataque_3` com margem de 18%.
8. **Dependências:** Geração externa de spritesheet e reexecução de `process_beatemup.py`.
9. **Risco de regressão:** Zero.
10. **Critério de aceitação:** `clippedEdges == []` em ações/VFX críticos de Bosses.
11. **Teste necessário:** Reexecutar `run_audit_metrics.py`.

### **BEU-10** — `ataque_4` unidirecional e hitbox sem `Rect` vertical
1. **ID:** `BEU-10` (**P2 — Média**)
2. **Arquivo:** [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts#L755-L767), [L989-L1029](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts#L989-L1029)
3. **Sistema:** Combate / Hitboxes
4. **Descrição:** `ataque_4` só acerta à frente do jogador e `performMeleeHitCheck` usa tolerância fixa `|dAirY| < 130` sem AABB vertical real.
5. **Evidência:** Leitura direta de `performMeleeHitCheck`.
6. **Causa provável (Confiança: Alta):** Simplificação inicial do detector de colisão.
7. **Correção proposta:** Tornar `ataque_4` simétrico (`[-rangeW*0.7, +rangeW]`), usar altura da hurtbox do alvo e exibir hitboxes ativas no modo Debug (`F3`).
8. **Dependências:** Nenhuma.
9. **Risco de regressão:** Baixo.
10. **Critério de aceitação:** Ultimate atinge inimigos cercando o herói; hitboxes visíveis no `F3`.
11. **Teste necessário:** Teste automatizado de geometria de colisão.

### **BEU-11** — Sprint (`doubleTap`) conflitante com `dash` em `InputManager`
1. **ID:** `BEU-11` (**P2 — Média**)
2. **Arquivo:** [InputManager.ts](file:///home/spira/animekombat/src/engine/InputManager.ts#L496-L512), [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts#L583-L595)
3. **Sistema:** Movimentação / Sprint
4. **Descrição:** `isDoubleTapSprint` não é salvo no estado do `BeatActor` e `InputManager` dispara `justDash` no mesmo duplo toque.
5. **Evidência:** `BeatEmUpScene.ts:585, 879, 898`.
6. **Causa provável (Confiança: Alta):** Detector redundante sem estado persistente.
7. **Correção proposta:** Persistir `isSprinting` até o jogador soltar a direção horizontal e suprimir `doubleTapDash` quando em modo Beat 'em Up.
8. **Dependências:** `BEU-01` (mesmo modo Beat 'em Up no `InputManager`).
9. **Risco de regressão:** Zero para `1v1`/`Rumble`.
10. **Critério de aceitação:** `→ →` contínuo mantém estado `run` até soltar a tecla.
11. **Teste necessário:** Teste de sequência de input simulado.

### **BEU-12** — Falta de entrada dramática, `dash` e quebra-combo nos Bosses
1. **ID:** `BEU-12` (**P2 — Média**)
2. **Arquivo:** [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts#L860-L960)
3. **Sistema:** IA de Bosses
4. **Descrição:** Bosses não utilizam `dash`, não têm *combo-breaker* contra stunlock e não têm animação/invulnerabilidade de entrada.
5. **Evidência:** `BeatEmUpScene.ts:914-958` (nenhuma referência a `e.state = 'dash'`).
6. **Causa provável (Confiança: Alta):** IA inicial priorizou ataques `1..4` e `block`.
7. **Correção proposta:** Adicionar entrada com taunt (`victory` curto) + aura, `dash` de aproximação/recuo, e *hyper-armor* de saída após 5 hits seguidos.
8. **Dependências:** `BEU-07`.
9. **Risco de regressão:** Baixo (ajustar dificuldade `easy`/`medium`/`master`).
10. **Critério de aceitação:** Boss usa `dash`, reage a stunlock e apresenta mudança de fase clara aos 50% HP.
11. **Teste necessário:** Playtest da Wave 5 nos 3 mapas.

### **BEU-13** — NPCs sem `getup` visual e flanqueamento preso na borda
1. **ID:** `BEU-13` (**P2 — Média**)
2. **Arquivo:** [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts#L509-L515, L963-L965), `npcs_ruas_do_brasil_sprites.zip`
3. **Sistema:** IA / Animação NPC
4. **Descrição:** `npc_civil_brasil` e `npc_civil_vermelho` saltam de `knockdown` direto para `idle` sem `getup`; `aiFlankSide` não inverte se o slot estiver bloqueado pela parede da arena.
5. **Evidência:** `verify_beatemup_audit.mjs` (`FAIL` #6) + `BeatEmUpScene.ts:964`.
6. **Causa provável (Confiança: Alta):** `getup` foi gerado apenas para `npc_politico`; flanco é estático no spawn.
7. **Correção proposta:** Incluir `getup_3x2.png` para os 2 civis (ou interpolar transição curta) e recalcular `aiFlankSide` quando `goalX` colidir com `lockMinX`/`lockMaxX`.
8. **Dependências:** Nenhuma.
9. **Risco de regressão:** Baixo.
10. **Critério de aceitação:** NPCs rodeiam o jogador pelos dois lados mesmo próximo às bordas.
11. **Teste necessário:** Teste automatizado de `aiFlankSide` + inspeção visual.

### **BEU-14** — Costuras visuais entre trechos (`seam_avg_rgb_diff 35–74`) e `walkMinZ` em Copacabana
1. **ID:** `BEU-14` (**P2 — Média**)
2. **Arquivo:** [BeatEmUpMap.ts](file:///home/spira/animekombat/src/game/BeatEmUpMap.ts#L69-L360)
3. **Sistema:** Mapas / Cenários
4. **Descrição:** Junções em `x=1536` e `x=3072` são cortes abruptos; em Copacabana `walkMinZ=685` permite pisar em cadeiras/quiosque à direita.
5. **Evidência:** Medição de pixel em `run_audit_metrics.py` + leitura de `bg_1_copacabana.png`.
6. **Causa provável (Confiança: Alta):** Trechos gerados isoladamente sem faixa de transição.
7. **Correção proposta:** Renderizar faixa de crossfade/vinheta vertical de ~80px nas junções `1536` e `3072` e ajustar `walkMinZ` do Rio para `725` (ou polígonos de obstáculo leve).
8. **Dependências:** Nenhuma.
9. **Risco de regressão:** Baixo.
10. **Critério de aceitação:** Transição suave entre trechos e pés coerentes com o calçadão.
11. **Teste necessário:** Inspeção visual em scroll contínuo.

### **BEU-15** — `SpriteLoader` não descarrega `beatEmUpCache` e evolução mid-stage carrega sob demanda
1. **ID:** `BEU-15` (**P2 — Média**)
2. **Arquivo:** [SpriteLoader.ts](file:///home/spira/animekombat/src/engine/SpriteLoader.ts#L280-L347), [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts#L682)
3. **Sistema:** Performance / Memória
4. **Descrição:** `beatEmUpCache` retém bitmaps permanentemente; evoluir na fase pode dar micro-travamento enquanto baixa `fase_{n+1}`.
5. **Evidência:** Leitura de `SpriteLoader.ts:328-347`.
6. **Causa provável (Confiança: Alta):** `unloadUnused` cobre apenas `phaseCache`.
7. **Correção proposta:** Adicionar `unloadBeatEmUpUnused(keepIds)` e pré-carregar `startPhase + 1` em segundo plano quando `evoEnergy >= 60`.
8. **Dependências:** Nenhuma.
9. **Risco de regressão:** Baixo.
10. **Critério de aceitação:** `ImageBitmap.close()` chamado ao trocar de modo/fase.
11. **Teste necessário:** Teste unitário de ciclo de vida do cache.

### **BEU-16** — `vfx_ataque_4` do Boss deslocado e falta de partículas de impacto/pouso
1. **ID:** `BEU-16` (**P2 — Média**)
2. **Arquivo:** [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts#L882)
3. **Sistema:** VFX / Feedback
4. **Descrição:** VFX de `ataque_4` dos Bosses nasce deslocado à frente (`+85px`) em vez de no centro do Boss; falta poeira de pouso/corrida e faíscas de impacto.
5. **Evidência:** `BeatEmUpScene.ts:880-883`.
6. **Causa provável (Confiança: Alta):** Mesma regra de offset aplicada a golpes frontais e ultimates de área.
7. **Correção proposta:** Centralizar `vfx_ataque_4` em `e.x` e reutilizar pool leve de partículas.
8. **Dependências:** Nenhuma.
9. **Risco de regressão:** Baixo.
10. **Critério de aceitação:** `vfx_ataque_4` centrado no Boss e alinhado com área de dano.
11. **Teste necessário:** Inspeção visual com `F3` ativo.

### **BEU-17** — Arquivos de background duplicados (~8,6 MB) e PNGs não convertidos para WebP
1. **ID:** `BEU-17` (**P3 — Baixa**)
2. **Arquivo:** `public/assets/backgrounds/beatemup/<cidade>/<cidade>.png` vs `public/assets/backgrounds/<cidade>.png`
3. **Sistema:** Assets / Otimização
4. **Descrição:** As 3 imagens `1672×941` de capa estão duplicadas em `beatemup/` sem uso na UI; os 9 trechos somam `21,8 MB` em PNG.
5. **Evidência:** `run_audit_metrics.py` + `ls` em `public/assets/backgrounds/`.
6. **Causa provável (Confiança: Alta):** Cópia de referência mantida dentro da subpasta `beatemup/`.
7. **Correção proposta:** Remover as 3 cópias não usadas e converter os 9 trechos para WebP de alta qualidade (`q=90`) mantendo fallback.
8. **Dependências:** `BEU-08`.
9. **Risco de regressão:** Baixo (atualizar `BeatEmUpMap.ts`).
10. **Critério de aceitação:** Redução >= 60% do peso de backgrounds sem perda visual visível.
11. **Teste necessário:** `npm run build` + `verify_beatemup_audit.mjs`.

### **BEU-18** — Debug overlay (`F3`) incompleto e alocação de arrays temporários em `BeatEmUpScene`
1. **ID:** `BEU-18` (**P3 — Baixa**)
2. **Arquivo:** [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts#L1035-L1055, L1256-L1297)
3. **Sistema:** Depuração / Polimento
4. **Descrição:** `F3` não desenha hitboxes ativas nem frame atual; `updateProjectiles`/`updateEffects` recriam arrays via `.filter()`.
5. **Evidência:** Leitura direta de `BeatEmUpScene.ts`.
6. **Causa provável (Confiança: Alta):** Implementação inicial focada em entrega funcional.
7. **Correção proposta:** Desenhar retângulo vermelho da hitbox ativa + `F{i}/{N}` no `F3` e converter efeitos para pools fixos.
8. **Dependências:** `BEU-10`.
9. **Risco de regressão:** Zero.
10. **Critério de aceitação:** Zero alocações por frame em efeitos e debug `F3` completo.
11. **Teste necessário:** Verificação com `F3` ativo durante ataque.
