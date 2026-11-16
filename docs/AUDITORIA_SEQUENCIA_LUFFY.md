# Auditoria Frame a Frame — Sprites e Combate do Luffy (`fase_1` .. `fase_4`)

Este documento registra a auditoria completa das **104 sequências (1.416 frames `.webp`)** do personagem `luffy` em `public/assets/characters/luffy/` e `public/assets/characters/manifest.json`, além das correções estruturais no motor de locomoção, impacto de VFX e cache PWA.

## 1. Resumo Executivo & Regras Aplicadas

- **Arquivos originais preservados:** Os arquivos fonte em `spritesPersonagens/expandidos/Luffy/*.zip` foram mantidos intocados como backup bruto.
- **Escala de combate preservada:** `refBodyHeight` e `refBodyWidth` de `fase_1`..`fase_4` em `manifest.json` não foram alterados.
- **Consolidação de loops incoerentes (`idle`, `crouch`, `victory`):**
  - **`idle` (`fase_1`..`fase_4`):** Os frames originais `F7..F10` apresentavam mudança brusca de abertura de pernas/passo e troca de faixa (`fase_4`), fazendo o personagem "andar/correr parado". Consolidado para `[1, 2, 3, 4, 5, 6, 5, 4, 3, 2]` (10 slots preservados com respiração contínua e FPS reduzido para `6.5` em `Fighter.ts`).
  - **`crouch` (`fase_1`..`fase_3`):** Os frames originais `F7..F10` estavam `1.35x` a `1.55x` maiores que `F3..F6`, fazendo o lutador inflar gigante durante o agachamento. Consolidado para `[1, 2, 3, 4, 5, 6, 5, 4, 5, 6]`.
  - **`crouch` (`fase_4`):** Os frames `F8..F10` encolhiam progressivamente (`246px -> 228px`). Consolidado para `[1, 2, 3, 4, 5, 6, 7, 6, 5, 4]`.
  - **`fase_2/victory`:** Os frames `F7..F10` eram duplicatas de `getup` com sandálias em vez de Gear 4 Boundman descalço. Consolidado para `[1, 2, 3, 3, 4, 4, 5, 5, 6, 6]`.
  - **`fase_4/victory`:** Os frames `F7..F10` baixavam o braço triunfal e exibiam chapéu de palha surgindo atrás do pescoço. Consolidado para `[1, 2, 3, 3, 4, 4, 5, 5, 6, 6]`.
- **Estabilização de `anchorX`:** Corrigidos desvios horizontais de até `102px` via centroide de quadril filtrado (`core_hip` em `ataque_4` e `fase_4/ataque_2`), centroide de quadril (`hip` em `run`, `dash`, `air_ataque_1`) e centroide corporal (`body_centroid` em `knockdown` e `getup`), mantendo `anchorY` e metadados de corte íntegros.
- **Locomoção (`Fighter.ts`):** Adicionado estado `'walk'` (`BASE_SPEED = 255 px/s`, `10.5 fps`) para movimento padrão; estado `'run'` (`SPRINT_SPEED = 415 px/s`, `16 fps`) reservado para corrida rápida após `dash` mantendo a direção (com fallback automático para `'run'` nos demais 8 personagens sem `walk`).
- **VFX de Impacto (`Fighter.ts` + `CombatSystem.ts`):** Removido disparo antecipado em `progress = 0.02` preso ao atacante (`followOwner = true`). Impactos corpo a corpo (`checkMeleeHit`) e de projéteis (`updateProjectilesMulti`) agora calculam `activeHit.rect ∩ hurtbox` diretamente sobre o **defensor atingido** e disparam `spawnImpactVfx` sem prender ao atacante.
- **Cache PWA (`vite.config.ts`):** Runtime cache de sprites incrementado de `ak-character-assets-v2` para `ak-character-assets-v3`.

## 2.1. Fase 1 — Base (26 sequências)

| Sequência | Frames | Status | Modo `anchorX` | Ordem Aplicada (índices 1-based originais) | Observações & Anomalias Sinalizadas |
| --- | ---: | --- | --- | --- | --- |
| `idle` | 10 | `reordered` | `keep` | `1,2,3,4,5,6,5,4,3,2` | Consoildated to F1..6 smooth breathing loop (fixes walking-in-place stance mismatch & 26% stride drift in F7..10) |
| `walk` | 10 | `ok` | `keep` | identidade `1..10` | Clean 10f walking stride cycle; stabilized anchorX to torso |
| `run` | 10 | `reordered` | `hip` | identidade `1..10` | Fixed 95px horizontal anchorX teleport via torso stabilization; continuous 2-step sprint stride |
| `jump` | 10 | `ok` | `keep` | identidade `1..10` | Clean crouch-takeoff -> rising -> apex -> falling progression |
| `land` | 10 | `ok` | `keep` | identidade `1..10` | Clean landing absorption to standing guard |
| `dash` | 10 | `reordered` | `hip` | identidade `1..10` | Fixed 115px horizontal anchorX jump on F3/F6 via torso centroid; flagged tiny border bleed on F1..3 |
| `crouch` | 10 | `reordered` | `keep` | `1,2,3,4,5,6,5,4,5,6` | Loop consolidated to F1..6 to avoid 1.35x scale jump on F7..10; flagged F7..10 scale anomaly |
| `block` | 10 | `reordered` | `keep` | `10,9,1,2,3,4,5,6,7,8` | Moved guard-entry F10->F9 to slots 1..2; kept tight X-guard across slots 3..10 incl. blockImpactTimer |
| `hitstun` | 10 | `anomaly_flagged` | `keep` | identidade `1..10` | Sequence clean; flagged tiny outer-border bleed pixels on F4..6 |
| `knockdown` | 10 | `reordered` | `body_centroid` | `1,2,3,4,5,6,9,7,8,10` | Placed arm/head impact bounce F9 at ground-bounce slot 7, followed by flat rest F7,F8,F10; stabilized prone anchorX |
| `getup` | 10 | `reordered` | `body_centroid` | `1,2,3,4,5,7,6,8,9,10` | Swapped F7(h=291) before F6(h=314) for monotonic rise; stabilized prone-to-stand anchorX (fixes +150px slide) |
| `victory` | 10 | `reordered` | `keep` | `1,2,7,8,9,10,3,4,5,6` | Placed laugh buildup F7..10 before fist-raise F3..6 so end clamp freezes proudly on F6 raised fist |
| `evolve` | 10 | `reordered` | `keep` | `1,2,6,3,4,5,7,8,9,10` | Moved focused white-glow F6 before shout/eruption F3..5 so burst does not pause mid-explosion |
| `ki_charge` | 10 | `reordered` | `keep` | `1,2,3,4,5,6,9,8,10,7` | Ordered aura intensity monotonically gold F1..6 -> F9 -> white F8,10,7 for seamless charge loop |
| `pickup` | 10 | `reordered` | `keep` | `1,2,3,4,7,5,8,6,9,10` | Ordered crouched lift F7(279)->F5(294)->F8(307)->F6/9/10(335) without upright/crouch ping-pong |
| `grab` | 10 | `anomaly_flagged` | `keep` | identidade `1..10` | Reach->clinch sequence clean; flagged minor border pixel artifacts on F4..5 |
| `throw` | 10 | `ok` | `keep` | identidade `1..10` | Clean grab -> overhead swing -> slam release |
| `ataque_1` | 12 | `reordered` | `keep` | `1,4,2,5,3,6,7,8,9,10,11,12` | Removed premature full punch in Startup slot 3 (F3) & open guard in Active slot 4 (F4); aligned Startup 1..3 -> Active 4..7 -> Recovery 8..12 |
| `ataque_2` | 15 | `reordered` | `keep` | `1,2,3,4,7,8,5,9,6,10,11,12,13,14,15` | Consolidated 2 whip-kick resets into continuous windup (1..4) -> rubber extend peak (5..10) -> descend lunge recovery (11..15) |
| `ataque_3` | 20 | `reordered` | `keep` | `1,2,3,4,7,8,5,6,9,10,11,12,13,14,15,16,17,18,19,20` | Moved deep windup F7..8 before forward punches F5..6 to match Startup (1..7) -> Active (8..13) -> Recovery (14..20) |
| `ataque_4` | 40 | `reordered` | `core_hip` | `1,2,3,4,30,5,6,7,8,9,10,11,12,19,20,21,22,25,26,27,28,13,14,15,16,17,23,18,24,29,31,32,37,38,33,34,35,36,39,40` | Consolidated 3 Red Hawk cycles into 1 arc: Haki windup (incl. F30 before fire) -> ignition -> coil -> F18/24/29 Red Hawk strikes -> smooth F37 recovery |
| `air_ataque_1` | 10 | `reordered` | `hip` | identidade `1..10` | Sequence clean; stabilized anchorX on F7 (fixed 68px air horizontal pop) |
| `vfx_ataque_1` | 12 | `reordered` | `keep` | `1,6,2,5,4,3,7,8,9,10,11,12` | Monotonic star growth 7k->28k->36k starburst peak (F7) -> smooth 0.7k fade |
| `vfx_ataque_2` | 15 | `reordered` | `keep` | `1,2,3,7,4,8,13,9,14,10,5,11,15,6,12` | Unified 3 slash resets into 1 continuous crescent wind arc -> billowing smoke dissipation |
| `vfx_ataque_3` | 20 | `reordered` | `keep` | `1,2,3,7,4,8,9,5,10,6,13,14,11,15,12,16,19,17,18,20` | Eliminated F7 shrink & F19 pop; aligns bright spinning rings over engine flight loop (slots 8..14) -> fading wisps |
| `vfx_ataque_4` | 40 | `reordered` | `keep` | `1,2,13,7,3,8,14,4,19,9,15,30,29,28,16,20,10,5,27,21,17,11,22,26,6,18,23,12,24,25,31,37,32,38,33,34,35,39,36,40` | Consolidated 5 fireball resets & F37 relight into 1 ignition -> comet peak (60.4k) -> cooling ash arc |

## 2.2. Fase 2 — Boundman (26 sequências)

| Sequência | Frames | Status | Modo `anchorX` | Ordem Aplicada (índices 1-based originais) | Observações & Anomalias Sinalizadas |
| --- | ---: | --- | --- | --- | --- |
| `idle` | 10 | `reordered` | `keep` | `1,2,3,4,5,6,5,4,3,2` | Consolidated to F1..6 Boundman bounce loop; flagged F7..10 stance shift |
| `walk` | 10 | `reordered` | `keep` | identidade `1..10` | Stride sequence clean; stabilized anchorX on torso |
| `run` | 10 | `reordered` | `hip` | identidade `1..10` | Fixed 54px horizontal anchorX teleport via torso stabilization |
| `jump` | 10 | `ok` | `keep` | identidade `1..10` | Clean jump arc |
| `land` | 10 | `ok` | `keep` | identidade `1..10` | Clean bounce landing |
| `dash` | 10 | `reordered` | `hip` | identidade `1..10` | Fixed 103px dash anchorX jump via torso centroid |
| `crouch` | 10 | `reordered` | `keep` | `1,2,3,4,5,6,5,4,5,6` | Consolidated crouch loop to F1..6 to remove 1.35x scale inflation on F7..10 |
| `block` | 10 | `ok` | `keep` | identidade `1..10` | All 10 frames maintain braced Boundman Haki guard |
| `hitstun` | 10 | `ok` | `keep` | identidade `1..10` | Clean knock-back reaction |
| `knockdown` | 10 | `reordered` | `body_centroid` | identidade `1..10` | Order clean; stabilized prone body anchorX (fixed 70px jump on F7..10) |
| `getup` | 10 | `ok` | `body_centroid` | identidade `1..10` | Clean push-up recovery |
| `victory` | 10 | `reordered` | `keep` | `1,2,3,3,4,4,5,5,6,6` | Excluded F7..10 (literal getup duplicates wearing sandals on barefoot Boundman); ends on raised fist F6 |
| `evolve` | 10 | `ok` | `keep` | identidade `1..10` | Clean Boundman surge |
| `ki_charge` | 10 | `reordered` | `keep` | `1,2,3,4,5,6,8,7,10,9` | Smoothed aura falloff F6(72k)->F8(54k)->F7/10/9(48k); flagged vest open on F7..10 |
| `pickup` | 10 | `reordered` | `keep` | `1,2,7,3,4,5,8,6,9,10` | Moved crouching reach F7 before floor pickup F3..4 & lift F5..10; flagged gold->purple fruit swap |
| `grab` | 10 | `ok` | `keep` | identidade `1..10` | Clean grab reach & hold; torso stabilized |
| `throw` | 10 | `ok` | `keep` | identidade `1..10` | Clean overhead toss |
| `ataque_1` | 12 | `ok` | `keep` | identidade `1..12` | Clean Kong punch |
| `ataque_2` | 15 | `ok` | `keep` | identidade `1..15` | Clean Rhino Schneider double/whip kick; torso stabilized |
| `ataque_3` | 20 | `reordered` | `keep` | `1,2,3,4,5,6,7,8,9,10,11,12,19,20,13,14,15,16,17,18` | Moved upturned strike F19..20 out of post-recovery end into Python follow-through before arm retracts F13..18 |
| `ataque_4` | 40 | `reordered` | `core_hip` | `1,2,3,4,5,6,8,7,9,10,11,12,20,19,14,13,15,25,16,26,27,17,30,28,18,29,21,22,23,24,37,38,39,40,31,32,33,34,35,36` | Unified 3 King Kong Gun resets into 1 coil (1..14) -> escalating punch (15..30) -> raised-to-low recovery (37..40 before 31..36) |
| `air_ataque_1` | 10 | `reordered` | `hip` | identidade `1..10` | Order clean; stabilized anchorX on F7 (fixed 74px air shift) |
| `vfx_ataque_1` | 12 | `reordered` | `keep` | `1,2,4,3,5,6,7,8,9,10,11,12` | Swapped F4(15.4k) before F3(18.2k) for monotonic Kong impact expansion |
| `vfx_ataque_2` | 15 | `reordered` | `keep` | `1,2,7,8,3,9,5,4,6,10,11,13,14,12,15` | Unified aerial shock burst & dust crater into 1 peak -> smooth F13->14->12->15 dissipation |
| `vfx_ataque_3` | 20 | `reordered` | `keep` | `1,7,2,8,3,9,4,10,5,11,6,12,19,13,14,15,16,17,20,18` | Eliminated F7..12 reset & F19 pop; aligns screw whip -> F13 cloud crash -> smooth fade |
| `vfx_ataque_4` | 40 | `reordered` | `keep` | `1,2,19,7,3,25,8,20,4,13,9,21,26,10,15,5,22,16,14,27,11,17,23,28,6,18,12,29,24,30,31,32,37,33,34,38,35,39,36,40` | Merged 5 Haki fist resets & F37 relight into single 63.4k growth -> F31 detonation -> 1.2k smoke fade |

## 2.3. Fase 3 — Snakeman (26 sequências)

| Sequência | Frames | Status | Modo `anchorX` | Ordem Aplicada (índices 1-based originais) | Observações & Anomalias Sinalizadas |
| --- | ---: | --- | --- | --- | --- |
| `idle` | 10 | `reordered` | `keep` | `1,2,3,4,5,6,5,4,3,2` | Consolidated to F1..6 Snakeman stance loop; flagged F7..10 wide-leg stride split |
| `walk` | 10 | `reordered` | `keep` | identidade `1..10` | Clean stride; torso stabilized; flagged yellow sash continuity mismatch vs idle |
| `run` | 10 | `reordered` | `hip` | identidade `1..10` | Fixed 73px horizontal anchorX jump via torso centroid |
| `jump` | 10 | `anomaly_flagged` | `keep` | identidade `1..10` | Clean jump arc; flagged straw hat appearing behind neck in F7..10 |
| `land` | 10 | `ok` | `keep` | identidade `1..10` | Clean landing |
| `dash` | 10 | `reordered` | `hip` | identidade `1..10` | Fixed 128px horizontal dash teleport via torso stabilization |
| `crouch` | 10 | `reordered` | `keep` | `1,2,3,4,5,6,5,4,5,6` | Consolidated crouch loop to F1..6; flagged F7..10 1.55x scale jump anomaly |
| `block` | 10 | `reordered` | `keep` | `10,9,1,2,3,4,5,6,7,8` | Moved guard-entry F10->F9 to slots 1..2; tight crossed guard across slots 3..10 incl. block impact |
| `hitstun` | 10 | `ok` | `keep` | identidade `1..10` | Clean hitstun |
| `knockdown` | 10 | `reordered` | `body_centroid` | identidade `1..10` | Fall->rest order clean; stabilized prone anchorX (fixed 77px jump) |
| `getup` | 10 | `reordered` | `body_centroid` | `1,2,3,4,7,5,8,6,9,10` | Ordered height monotonically 135->176->203->222->231(F7)->249(F5)->285(F8)->291(F6)->330->335; torso stabilized |
| `victory` | 10 | `reordered` | `keep` | `1,2,7,8,9,10,3,4,5,6` | Ordered laugh buildup F7..10 before fist-raise F3..6 so victory ends on triumphant pose; flagged blue-shorts/yellow-sash mismatch |
| `evolve` | 10 | `ok` | `keep` | identidade `1..10` | Clean Gear 4 Snakeman aura surge |
| `ki_charge` | 10 | `reordered` | `keep` | `1,2,3,4,5,6,8,7,9,10` | Swapped F8(56k) before F7(50k) for monotonic aura taper from F6(80k) to F10(36k); flagged hat in F9 |
| `pickup` | 10 | `reordered` | `keep` | `1,2,7,3,4,8,10,9,5,6` | Smooth down-grasp-rise order (F7 deep bend before F3/4 grasp, then F8/10/9/5/6 rise); flagged fruit & shorts mismatch |
| `grab` | 10 | `anomaly_flagged` | `keep` | identidade `1..10` | Clean grab; stabilized torso anchorX; flagged tiny cell-border artifact in F4 |
| `throw` | 10 | `ok` | `keep` | identidade `1..10` | Clean throw |
| `ataque_1` | 12 | `reordered` | `keep` | `1,7,2,8,9,3,4,10,11,5,6,12` | Consolidated 2 Jet Culverin punch cycles into 1 coil (1,7,2) -> escalating stretch & starburst hits (8,9,3,4) -> retract (10,11,5,6,12) |
| `ataque_2` | 15 | `reordered` | `keep` | `1,7,2,8,13,5,3,9,4,10,14,11,12,6,15` | Unified 3 kick cycles into smooth knee chamber -> whip extend -> starburst hit (F10/14) -> stomp recovery |
| `ataque_3` | 20 | `reordered` | `keep` | `1,6,7,12,13,20,8,2,15,9,3,4,16,19,10,11,17,5,14,18` | Unified 3 Black Mamba punch cycles into 1 windup -> starburst strikes (F4,16) -> Python bend F19 -> retract; flagged blue shorts F19..20 |
| `ataque_4` | 40 | `reordered` | `core_hip` | `1,2,3,4,5,6,8,7,9,10,11,12,20,19,14,13,15,25,16,26,27,17,30,28,18,29,21,22,23,24,37,38,39,40,31,32,33,34,35,36` | Unified 3 mega-punch cycles + F37..40 recovery raise; flagged Boundman body in F1..30 vs Snakeman recovery F31..40 |
| `air_ataque_1` | 10 | `ok` | `hip` | identidade `1..10` | Clean aerial strike |
| `vfx_ataque_1` | 12 | `reordered` | `keep` | `1,2,4,3,5,6,7,8,9,10,11,12` | Swapped F4(8.4k) before F3(10.7k) for monotonic star growth to F7(38.3k) peak |
| `vfx_ataque_2` | 15 | `reordered` | `keep` | `1,2,7,3,8,4,5,9,6,10,13,11,12,14,15` | Moved dense cloud crescent F13(26.4k) before dissipating puffs F11,12,14,15; unified sweep growth |
| `vfx_ataque_3` | 20 | `reordered` | `keep` | `1,2,7,3,8,4,9,5,10,11,6,19,12,13,14,15,16,20,17,18` | Eliminated F7..12 reset & F19 pop; spear builds -> F13 cloud crash (44k) -> smooth fade |
| `vfx_ataque_4` | 40 | `reordered` | `keep` | `1,19,2,7,20,25,3,8,21,4,26,13,9,15,14,22,16,27,10,5,17,18,23,28,11,6,29,24,12,30,31,32,37,33,34,38,35,39,36,40` | Merged 5 King Cobra vortex cycles & F37 relight into single 62.4k growth -> F31 boom -> 1.3k dissipate |

## 2.4. Fase 4 — Gear 5 (26 sequências)

| Sequência | Frames | Status | Modo `anchorX` | Ordem Aplicada (índices 1-based originais) | Observações & Anomalias Sinalizadas |
| --- | ---: | --- | --- | --- | --- |
| `idle` | 10 | `reordered` | `keep` | `1,2,3,4,5,6,5,4,3,2` | Consolidated to F1..6 Gear 5 breathing loop; flagged F7..10 grey-sash wide stride mismatch |
| `walk` | 10 | `reordered` | `keep` | identidade `1..10` | Clean walk stride; stabilized torso anchorX |
| `run` | 10 | `reordered` | `hip` | identidade `1..10` | Fixed 106px horizontal anchorX teleport via torso centroid; flagged hat in F7..10 |
| `jump` | 10 | `ok` | `keep` | identidade `1..10` | Clean Gear 5 leap |
| `land` | 10 | `ok` | `keep` | identidade `1..10` | Clean Gear 5 land |
| `dash` | 10 | `reordered` | `hip` | identidade `1..10` | Fixed 115px horizontal dash teleport via torso stabilization |
| `crouch` | 10 | `reordered` | `keep` | `1,2,3,4,5,6,7,6,5,4` | Looped F4..7 to exclude chibi size-shrink in F8..10 (246->228px); stabilized anchorX |
| `block` | 10 | `reordered` | `keep` | `10,9,1,7,2,8,3,4,5,6` | Moved open guard F10->F9 to slots 1..2; kept tight X-guard across slots 3..10 incl. block impact; stabilized anchorX |
| `hitstun` | 10 | `anomaly_flagged` | `keep` | identidade `1..10` | Clean hitstun reaction; flagged straw hat appearing behind shoulder in F7..10 |
| `knockdown` | 10 | `reordered` | `body_centroid` | `1,2,3,4,5,6,9,7,8,10` | Moved F9 rebound before flat F7,8,10; stabilized prone anchorX (fixed 83px drop); flagged purple->grey sash |
| `getup` | 10 | `reordered` | `body_centroid` | `1,2,3,4,7,5,6,8,9,10` | Moved bent-low F7(246) before rising F5/F6(281) for smooth ground push-up |
| `victory` | 10 | `reordered` | `keep` | `1,2,3,3,4,4,5,5,6,6` | Excluded F7..10 (arm-drop & hat sprout anomaly) so Nika triumph ends proudly raised on F6 |
| `evolve` | 10 | `anomaly_flagged` | `keep` | identidade `1..10` | Clean Gear 5 surge; flagged straw hat appearing in F7..10 |
| `ki_charge` | 10 | `reordered` | `keep` | `1,2,3,4,5,6,8,7,9,10` | Placed F8(47.2k peak white clouds) before F7->9->10 taper; flagged hat appearing in F7..10 |
| `pickup` | 10 | `reordered` | `keep` | `1,2,3,4,7,5,8,6,9,10` | Smooth down-reach F1..4 -> crouched scoop F7 -> rising F5,8,6,9,10; flagged pink/blue fruit swap |
| `grab` | 10 | `reordered` | `keep` | identidade `1..10` | Clean grab; torso stabilized (fixed 42px anchorX drift) |
| `throw` | 10 | `ok` | `keep` | identidade `1..10` | Clean toss |
| `ataque_1` | 12 | `reordered` | `keep` | identidade `1..12` | Clean Gear 5 punch; torso stabilized against extended reach shift |
| `ataque_2` | 15 | `reordered` | `core_hip` | identidade `1..15` | Order clean; fixed +101px anchorX outlier jump on F11 (290 -> ~227) via torso anchor |
| `ataque_3` | 20 | `reordered` | `keep` | `1,19,2,3,4,5,6,7,8,9,10,11,12,13,14,15,20,16,17,18` | Moved sky-lightning windup F19 to slot 2 & spark guard F20 to recovery slot 17 before F16..18 settle |
| `ataque_4` | 40 | `reordered` | `core_hip` | `1,2,3,4,5,7,8,9,10,11,6,12,13,14,19,15,16,21,22,20,23,24,17,18,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40` | Ordered Bajrang Gun: inflate->Haki->coil -> gold/white stretch -> Haoshoku blast (25..28) -> recovery; fixed 91px ax teleport on F23..26 |
| `air_ataque_1` | 10 | `reordered` | `hip` | identidade `1..10` | Clean aerial strike; torso stabilized |
| `vfx_ataque_1` | 12 | `ok` | `keep` | identidade `1..12` | Clean Gear 5 cartoon star smash progression |
| `vfx_ataque_2` | 15 | `reordered` | `keep` | `1,2,3,4,5,6,7,8,13,9,11,10,14,12,15` | Placed 30k billowing whirlwind F13 right after F8 impact boom before fading smoke F9..15 |
| `vfx_ataque_3` | 20 | `reordered` | `keep` | `1,2,7,3,4,5,6,8,9,10,11,12,13,14,15,19,20,16,17,18` | Placed condensed orb F7 inside orb growth (slot 3) & lightning crash rings F19..20 before wispy fade F16..18 |
| `vfx_ataque_4` | 40 | `reordered` | `keep` | `7,1,8,2,3,9,19,4,10,5,11,6,12,20,21,22,23,24,13,14,15,16,17,18,25,26,27,28,29,30,37,38,31,32,39,33,34,40,35,36` | Unified Haki fist emergence -> gold comet -> Haoshoku blast -> 51.3k ground crater explosion F37 -> monotonic 3.1k fade |

## 3. Lista Consolidada de Anomalias Não-Ordenáveis (Geração / Recorte)

Os itens abaixo pertencem à arte gerada originalmente ou ao recorte por célula e não podem ser eliminados apenas por reordenação:

- **Consistência de figurino entre lotes:**
  - `fase_3/walk`: faixa amarela na cintura em vez da faixa escura de Snakeman.
  - `fase_3/jump` (`F7..F10`) e `fase_3/ki_charge` (`F9`): aparição do chapéu de palha atrás do pescoço.
  - `fase_3/victory` e `fase_3/pickup`: variação de cor da bermuda/faixa entre lotes.
  - `fase_3/ataque_3` (`F6`, `F14` pós-reordenação): bermuda azul + faixa amarela (enquanto `18/20` frames usam bermuda vermelha).
  - `fase_3/ataque_4`: `30` frames de ataque baseados em corpo de Boundman com `10` frames de recuperação em Snakeman.
  - `fase_4/run` (`F7..F10`), `fase_4/hitstun` (`F7..F10`), `fase_4/evolve` (`F7..F10`), `fase_4/ki_charge` (`F7..F10`), `fase_4/victory` (excluídos `F7..F10`) e `fase_4/ataque_4` (`F37..F40`): aparição do chapéu de palha no pescoço em Gear 5.
  - `fase_4/knockdown`: faixa roxa (`F1..F6`) mudando para cinza (`F7..F10`).
  - `fase_2/pickup`, `fase_3/pickup`, `fase_4/pickup`: troca de cor da fruta no chão vs segurada.
- **Escala / Altura divergente dentro de lotes:**
  - `fase_1..fase_3/crouch`: `F7..F10` originais gerados em escala `1.35x`–`1.55x` maior (isolados fora do loop ativo).
  - `fase_4/crouch`: `F8..F10` originais encolhendo progressivamente (`246px -> 228px`) (isolados fora do loop ativo).
  - `fase_4/ataque_3`: lote de disparo encolhido (`244..259px`) comparado ao lote de carga em pé (`312..324px`).
- **Resíduos mínimos de borda / fundo de célula:**
  - `fase_1/dash` (`F1..F3`), `fase_1/hitstun` (`F4..F6`), `fase_1/grab` (`F4..F5`), `fase_3/grab` (`F4`) e `fase_2/ataque_4` (`F20`): pequenos pixels residuais de grade/efeito próximos às extremidades da caixa.
