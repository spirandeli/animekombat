# 13 — Critérios Objetivos de Homologação (Go / No-Go)

O modo **Beat 'em Up: Ruas do Brasil** só deve ser considerado **HOMOLOGADO** quando todos os critérios abaixo forem verificados com evidência real:

## 1. Critérios Bloqueantes (Obrigatórios 100%)
1. **Zero erros P0:**
   - Andar em `Z` (`W`/`ArrowUp`/stick ↑) nunca dispara salto acidental (`BEU-01`).
   - Câmera nunca expõe faixa preta vazia nem prende o jogador fora da tela em `4:3`, `16:9` ou `20:9` (`BEU-02`).
2. **Build & Integridade:**
   - `npm run build` encerra com código `0` e precache PWA inicial `< 2 MB`.
   - `node scripts/verify_beatemup_audit.mjs` passa sem erros estruturais de assets/dimensões/âncoras.
3. **Integridade Visual dos Sprites:**
   - `npc_civil_brasil/ko_defeat` sem inversão horizontal no F4 (`BEU-05`).
   - `zoro/fase_4` com escala consistente com as fases 1–3 (`BEU-04`).
   - Ações/VFX de Bosses sem cortes visíveis graves (`BEU-09`).
4. **Máquina de Estados & Combate:**
   - `grab`, `throw`, `knockdown`, `getup`, `air_ataque_1` e combos `A1→A2→A3/A4` executam do início ao fim sem travamento nem congelamento de frame (`BEU-06`, `BEU-07`).
   - Overlay `F3` confirma sincronização entre hitbox ativa e frame de impacto.

## 2. Critérios de Experiência e Estabilidade
5. **HUD & Interface:** Nome, fase, HP, Ki, Evolução, Combo, `GO! →`, Barra de Chefão e cards de seleção devidamente estilizados em desktop e mobile landscape (`BEU-03`).
6. **Inimigos & Bosses:** Todas as 3 fases jogáveis do início ao fim (`Vitória` e `Derrota` computando XP no `SaveManager` sem travar ondas).
7. **Estabilidade & Performance:** Sessão contínua de 1 fase completa (5 ondas + Chefão) mantendo `>= 55 FPS` médios em desktop e `>= 45–60 FPS` em mobile, sem vazamento de `ImageBitmap` ao alternar para `1v1` / `Rumble`.
8. **Compatibilidade:** Modos `Luta Rápida (1v1)` e `Salas (Rumble)` 100% funcionais após jogar Beat 'em Up.
