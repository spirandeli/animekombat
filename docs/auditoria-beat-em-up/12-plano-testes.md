# 12 — Plano de Testes Automatizados e Validação Manual

## 1. Suite Automatizada Já Executada nesta Auditoria

Arquivo criado: [verify_beatemup_audit.mjs](file:///home/spira/animekombat/scripts/verify_beatemup_audit.mjs)  
Comando: `node scripts/verify_beatemup_audit.mjs`  
Resultado observado: **5 PASS, 1 FAIL** (o `FAIL` confirma as ações ausentes nos NPCs).

| Caso | Descrição | Resultado Observado |
|---|---|---|
| Check 1 | Presença de 3 NPCs e 3 Bosses em `beatemup/manifest.json` | **PASS** (`npcs=3, bosses=3`) |
| Check 2 | Existência em disco, dimensões > 0 e âncoras válidas nos 450 WebPs | **PASS** (`450 frames validados`) |
| Check 3 | 3 Bosses × (13 ações + 4 VFX) × 6 frames | **PASS** (`306 frames`) |
| Check 4 | 9 Heróis × 4 fases com 20 ações Beat 'em Up | **PASS** (`36 fases verificadas`) |
| Check 5 | 9 PNGs panorâmicos (`brasilia`, `pelourinho`, `rio-de-janeiro`) em disco | **PASS** (`9 PNGs panorâmicos verificados`) |
| Check 6 | Cobertura completa de estados (`run`, `getup`, `block`) nos 3 NPCs | **FAIL** (`npc_civil_brasil:getup,block`, `npc_civil_vermelho:getup,block`, `npc_politico:run,block`) |

Além disso:
- `npm run build` (`tsc && vite build`): **APROVADO** (0 erros TypeScript, bundle gerado em `dist/`).
- `python3 ... run_audit_metrics.py`: **EXECUTADO** (confirmou 0 órfãos, 0 ausentes em 12.555+450 WebPs, `zoro/fase_4` `refH=256`, 35 `clippedEdges` em Beat 'em Up e costuras RGB `35.0–73.9`).

---

## 2. Testes Automatizados a Implementar (Pós-Fase A–G)

| ID | Alvo | Asserções Obrigatórias |
|---|---|---|
| **T-01** | `InputManager` (modo Beat 'em Up) | `up` (`W`/`ArrowUp`) NÃO ativa `justJump` quando `setBeatEmUpInputMode(true)`; `Space` ativa `justJump`; restaurar `1v1` reativa `stickJumpJust`. |
| **T-02** | `BeatEmUpScene` FSM | Todas as transições válidas (`idle↔walk↔run`, `jump→air_ataque_1→land→idle`, `ataque_1→ataque_2→ataque_3→ataque_4`, `knockdown→getup→idle`, `hp<=0→ko_defeat`), sem estado preso após `stateDuration`. |
| **T-03** | Hitboxes & Profundidade `Z` | Ataque acerta alvo dentro de `depthTol` e erra se `|dz| > depthTol`; `ataque_4` acerta à frente e atrás. |
| **T-04** | Câmera & Arena Lock | Para larguras `800×600`, `1280×720`, `1920×1080`, `915×412`: `0 <= camLeftWorld <= worldWidth - viewW` em todas as 5 ondas. |
| **T-05** | `manifest.json` & `beatemup/manifest.json` | Todos os frames existem, `w > 0`, `h > 0`, `anchorX`/`anchorY` dentro do quadro, `zoro/fase_4` `refBodyHeight >= 300`, `clippedEdges == []` em ações críticas. |

---

## 3. Roteiro de Testes Manuais / E2E em Navegador (Pendente)

Executar com `npm run dev` ou `npm run preview` em Chrome Desktop (`1280×720`) e Mobile Landscape (`915×412`, Touch ativo):

1. **Fluxo de Menu & Seleção:** Clicar em *Beat 'em Up: Ruas do Brasil* → selecionar cada um dos 9 heróis (e fases liberadas) → selecionar Brasília / Pelourinho / Rio de Janeiro → confirmar modal pré-partida.
2. **Movimentação 2.5D:** Andar nas 8 direções (`WASD` / Stick), verificar que `W`/`↑` não pula; testar duplo toque `→ →` (corrida contínua), `Dash`, `Pulo` + `air_ataque_1`.
3. **Combate & Debug (`F3`):** Ativar `F3`; executar `A1→A2→A3→A4`; testar `grab` + joelhada (`A1`) + `throw` (`A2`) derrubando outros NPCs; verificar alinhamento visual hitbox × impacto.
4. **Progressão & Bosses:** Vencer ondas 1–4, coletar pickups (`Pastel`, `Açaí`, `Água de Coco`), enfrentar e derrotar `Presidente Lula`, `Vereador Pavanato` e `Senador Flávio`, verificando mudança de fase (<50% HP), barra de Chefão, vitória e crédito de XP no `SaveManager`.
5. **Regressão:** Iniciar partida `1v1` e `Rumble` após jogar Beat 'em Up para confirmar ausência de regressões de controle ou memória.
