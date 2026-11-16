# 01 — Inventário Completo do Projeto (Modo Beat 'em Up)

## 1. Stack Tecnológica e Arquitetura

| Camada | Tecnologia / Arquivo | Papel no Projeto |
|---|---|---|
| Linguagem & Bundler | TypeScript `5.7.2`, Vite `5.4.21` ([package.json](file:///home/spira/animekombat/package.json)) | Compilação estática e empacotamento SPA |
| PWA / Offline | `vite-plugin-pwa` `0.21.2` ([vite.config.ts](file:///home/spira/animekombat/vite.config.ts)) | Service Worker (`Workbox`) e cache offline |
| Renderização | HTML5 Canvas 2D (`alpha: false`) | Desenho de cenários, sprites Y-sorted, VFX e debug |
| Loop de Jogo | [GameLoop.ts](file:///home/spira/animekombat/src/engine/GameLoop.ts) | Timestep fixo/clamped (`dt <= 0.1s`) + medição de FPS |
| Entrada | [InputManager.ts](file:///home/spira/animekombat/src/engine/InputManager.ts) | Teclado remapeável, Gamepad API e toque |
| Áudio | [AudioManager.ts](file:///home/spira/animekombat/src/engine/AudioManager.ts) | Síntese procedural Web Audio API (BGM + SFX) |
| Loader de Sprites | [SpriteLoader.ts](file:///home/spira/animekombat/src/engine/SpriteLoader.ts) | Carregamento de `characters/manifest.json` e `beatemup/manifest.json` |
| Persistência | [SaveManager.ts](file:///home/spira/animekombat/src/storage/SaveManager.ts) | IndexedDB + localStorage (XP, nível, fases liberadas, settings) |
| Rede / Backend | [NetworkClient.ts](file:///home/spira/animekombat/src/net/NetworkClient.ts), `server/` | Salas online (`1v1` / `Rumble`) — não usado pelo Beat 'em Up solo |
| Pipeline de Assets | [process_sprites_2x2.py](file:///home/spira/animekombat/scripts/process_sprites_2x2.py), [process_expandidos.py](file:///home/spira/animekombat/scripts/process_expandidos.py), [process_beatemup.py](file:///home/spira/animekombat/scripts/process_beatemup.py) | Fatiamento de grids `3×2` / `2×2`, chroma-key `#FF00FF`, âncoras e geração de manifests |

---

## 2. Módulos Compartilhados vs Exclusivos

### Compartilhados entre Modos (`1v1`, `Rumble`, `Beat 'em Up`)
- [main.ts](file:///home/spira/animekombat/src/main.ts) — Orquestração `GameLoop`, troca de cenas e fluxo de loading/resultado.
- [InputManager.ts](file:///home/spira/animekombat/src/engine/InputManager.ts) — Compartilhado (causa conflito de `jumpViaStick` no Beat 'em Up).
- [VirtualControls.ts](file:///home/spira/animekombat/src/ui/VirtualControls.ts) — Controles multi-touch (`stick` + `a1..a4`, `block`, `dash`, `jump`, `evolve`).
- [AudioManager.ts](file:///home/spira/animekombat/src/engine/AudioManager.ts) — Efeitos sonoros e trilha.
- [SpriteLoader.ts](file:///home/spira/animekombat/src/engine/SpriteLoader.ts) — Cache de `LoadedPhasePack` e `LoadedBeatEmUpPack`.
- [Menus.ts](file:///home/spira/animekombat/src/ui/Menus.ts) & [SaveManager.ts](file:///home/spira/animekombat/src/storage/SaveManager.ts) — Seleção, pausa, resultados e progressão de XP.

### Exclusivos do Beat 'em Up
- [BeatEmUpMap.ts](file:///home/spira/animekombat/src/game/BeatEmUpMap.ts) — Definição dos 3 mapas, 15 ondas (5/mapa), pickups e renderização panorâmica.
- [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts) — Física 2.5D `(x, z, airY)`, Y-sorting, IA de flanqueamento de NPCs, IA de 2 fases dos Bosses, grab/throw, HUD e Debug Overlay (`F3`).
- `public/assets/beatemup/manifest.json` + 450 WebPs de NPCs e Bosses.
- `public/assets/backgrounds/beatemup/<cidade>/bg_1..3_*.png` (9 PNGs).

### Exclusivos de `1v1` / `Rumble` (Preservados sem regressão)
- [ArenaScene.ts](file:///home/spira/animekombat/src/game/ArenaScene.ts), [ArenaMap.ts](file:///home/spira/animekombat/src/game/ArenaMap.ts), [Fighter.ts](file:///home/spira/animekombat/src/game/Fighter.ts), [CombatSystem.ts](file:///home/spira/animekombat/src/engine/CombatSystem.ts), [AIController.ts](file:///home/spira/animekombat/src/game/AIController.ts).

---

## 3. Inventário de Personagens Jogáveis (9 Heróis × 4 Fases)

Todos os 9 personagens possuem `fase_1` a `fase_4` em [manifest.json](file:///home/spira/animekombat/public/assets/characters/manifest.json) (12.555 arquivos WebP no disco, 0 ausentes, 256,11 MB).

| ID | Nome | Fases (`fase_1` → `fase_4`) | Ações Beat 'em Up Presentes | VFX Presentes |
|---|---|---|---|---|
| `goku` | Son Goku | Base, SSJ, SSJ3, Instinto Superior | 20/20 ações base (8–10f mov/estado, 10–40f ataques) | `vfx_ataque_1..4` |
| `luffy` | Monkey D. Luffy | Base, Gear 4 Boundman, Snakeman, Gear 5 | 20/20 ações base (`idle` 10f c/ 4 dups intencionais) | `vfx_ataque_1..4` |
| `sukuna` | Ryomen Sukuna | 1–3 Dedos, 15 Dedos, Meguna, Era Heian | 20/20 ações base | `vfx_ataque_1..4` |
| `naruto` | Naruto Uzumaki | Normal, Quatro Caudas, Manto Kurama, Bárion | 20/20 ações base | `vfx_ataque_1..4` |
| `inuyasha` | Inuyasha | Humana, Hanyou, Youkai, Daiyoukai | 20/20 ações base | `vfx_ataque_1..4` |
| `seiya` | Seiya de Pégaso | Pégaso V2, Dourada, Odin Robe, Kamui Divina | 20/20 ações base | `vfx_ataque_1..4` |
| `zoro` | Roronoa Zoro | Nitoryu, Santoryu, Ashura, King of Hell | 20/20 ações base (**`fase_4` `refBodyHeight=256` anômalo**) | `vfx_ataque_1..4` |
| `sasuke` | Sasuke Uchiha | Sharingan 3T, Selo Nv.2, EMS, Susano'o Indra | 20/20 ações base | `vfx_ataque_1..4` |
| `chopper` | Tony Tony Chopper | Brain, Horn, Kung Fu, Monster Point | 20/20 ações base | `vfx_ataque_1..4` |

**Ações verificadas nas 36 fases:** `idle`, `walk`, `run`, `dash`, `jump`, `land`, `air_ataque_1`, `grab`, `throw`, `pickup`, `ataque_1`, `ataque_2`, `ataque_3`, `ataque_4`, `block`, `hitstun`, `knockdown`, `getup`, `evolve`, `victory` (além de `crouch`, `ki_charge` e ataques direcionais usados no modo Arena).

---

## 4. Inventário de Inimigos Comuns (NPCs) e Chefões (Bosses)

Extraídos para `public/assets/beatemup/` e indexados em [manifest.json](file:///home/spira/animekombat/public/assets/beatemup/manifest.json) (450 WebPs, 13,03 MB, 0 ausentes).

### Inimigos Comuns (3 NPCs — 8 ações cada × 6 frames = 144 frames)

| ID | Nome / Papel | HP Base | Vel. | Ações Disponíveis | Ações Ausentes (Fallback) |
|---|---|---|---|---|---|
| `npc_civil_brasil` | Brawler Camisa Brasil (`brawler`) | 280 | 175 | `idle`, `walk`, `run`, `ataque_1`, `ataque_2`, `hitstun`, `knockdown`, `ko_defeat` | `getup` (usa `idle`), `block` (não bloqueia) |
| `npc_civil_vermelho` | Brawler Camisa Vermelha (`rusher`) | 320 | 195 | `idle`, `walk`, `run`, `ataque_1`, `ataque_2`, `hitstun`, `knockdown`, `ko_defeat` | `getup` (usa `idle`), `block` (não bloqueia) |
| `npc_politico` | Político da Pasta (`heavy`) | 420 | 145 | `idle`, `walk`, `ataque_1`, `ataque_2`, `hitstun`, `knockdown`, `getup`, `ko_defeat` | `run` (usa `walk`), `block` (não bloqueia) |

### Chefões Regionais (3 Bosses — 13 ações + 4 VFX × 6 frames = 306 frames)

| ID | Nome / Título | Mapa Associado | HP Base | Vel. | Ações & VFX |
|---|---|---|---|---|---|
| `boss_lula` | Presidente Lula (`CHEFÃO DO PLANALTO`) | `brasilia` | 2600 | 185 | 13 ações (`idle`, `walk`, `dash`, `block`, `hitstun`, `knockdown`, `getup`, `victory`, `ko_defeat`, `ataque_1..4`) + `vfx_ataque_1..4` |
| `boss_pavanato` | Vereador Pavanato (`CHEFÃO DO TERREIRO`) | `pelourinho` | 2400 | 205 | 13 ações + `vfx_ataque_1..4` |
| `boss_flavio_bolsonaro` | Senador Flávio (`CHEFÃO DO MARACANÃ`) | `rio-de-janeiro` | 2550 | 190 | 13 ações + `vfx_ataque_1..4` |

---

## 5. Inventário de Mapas, Trechos e Itens

| Mapa (`BeatEmUpStageId`) | Trecho 1 (`0..1536`) | Trecho 2 (`1536..3072`) | Trecho 3 — Boss (`3072..4608`) | Ondas | Pickups |
|---|---|---|---|---|---|
| `brasilia` | `bg_1_rodoviaria_eixo.png` (2,31 MB) | `bg_2_esplanada_ministerios.png` (2,01 MB) | `bg_3_congresso_boss.png` (2,00 MB) | 5 | Pastel (+220 HP), Açaí (+280 HP) |
| `pelourinho` | `bg_1_elevador_lacerda.png` (2,34 MB) | `bg_2_ladeira_casario.png` (2,76 MB) | `bg_3_terreiro_boss.png` (2,55 MB) | 5 | Água de Coco (+230 HP), Açaí (+290 HP) |
| `rio-de-janeiro` | `bg_1_copacabana.png` (2,82 MB) | `bg_2_arcos_lapa.png` (2,73 MB) | `bg_3_maracana_boss.png` (2,32 MB) | 5 | Água de Coco (+230 HP), Açaí (+290 HP) |

---

## 6. Arquivos Duplicados / Não Utilizados / Documentação Existente

1. **Duplicação de imagens de capa (~8,6 MB):** `public/assets/backgrounds/{brasilia,pelourinho,rio-de-janeiro}.png` (usadas em `ArenaMap.ts`) existem idênticas em `public/assets/backgrounds/beatemup/<cidade>/<cidade>.png` (declaradas como `thumbnailSrc` em `BeatEmUpMap.ts`, porém **não consumidas** pela UI em `Menus.ts`, que usa `segmentSrcs[0]` e `segmentSrcs[2]`).
2. **Pickups sem sprites próprios:** `acai`, `pastel` e `coco` são desenhados via círculos vetoriais no Canvas (`BeatEmUpScene.ts:1229-1247`), sem sprites dedicados.
3. **Documentação pré-existente consultada:** [BEAT_EM_UP_BACKGROUNDS.md](file:///home/spira/animekombat/docs/BEAT_EM_UP_BACKGROUNDS.md), [BEAT_EM_UP_ACOES_FALTANTES.md](file:///home/spira/animekombat/docs/BEAT_EM_UP_ACOES_FALTANTES.md), [PROMPT_BOSS_BEAT_EM_UP.md](file:///home/spira/animekombat/docs/PROMPT_BOSS_BEAT_EM_UP.md), [PROMPT_NPCS_BEAT_EM_UP.md](file:///home/spira/animekombat/docs/PROMPT_NPCS_BEAT_EM_UP.md) e `docs/AUDITORIA_SEQUENCIA_*.md`.
