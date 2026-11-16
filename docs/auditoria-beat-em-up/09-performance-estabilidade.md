# 09 — Auditoria de Performance, Carregamento e Estabilidade

## 1. Medições Reais de Build e Disco

| Métrica | Valor Real Medido | Evidência |
|---|---|---|
| Bundle JS principal (`dist/assets/index-*.js`) | `307.46 kB` (`79.84 kB` gzip) | `npm run build` |
| CSS único (`dist/assets/style-*.css`) | `36.16 kB` (`7.75 kB` gzip) | `npm run build` |
| Precache Workbox PWA (`dist/sw.js`) | **`97 entries (50.069,86 KiB ≈ 48,9 MB)`** | `vite-plugin-pwa` output |
| Texturas de Heróis (`public/assets/characters/`) | `256,11 MB` (`12.555` arquivos `.webp`) | `run_audit_metrics.py` |
| Texturas Beat 'em Up (`public/assets/beatemup/`) | `13,03 MB` (`450` arquivos `.webp`) | `run_audit_metrics.py` |
| Backgrounds (`public/assets/backgrounds/`) | `38,33 MB` (`15` PNGs; `2,00–2,82 MB` cada trecho Beat 'em Up) | `run_audit_metrics.py` |
| HUD portraits (`public/assets/hud/`) | `10,02 MB` | `run_audit_metrics.py` |

---

## 2. Diagnóstico de Carregamento e Memória

### 2.1 **PROBLEMA CONFIRMADO (P1) — Precache PWA inchado (`~49 MB`) em `vite.config.ts`**
- **Evidência:** [vite.config.ts](file:///home/spira/animekombat/vite.config.ts#L26) define `globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}']`, o que força o Service Worker a **baixar e pré-armazenar todos os 15 PNGs de background (`38,3 MB`) e todos os PNGs de HUD (`10 MB`) na primeira visita** ao invés de deixá-los apenas no `runtimeCaching` sob demanda!
- **Risco:** Em dispositivos móveis com 4G ou armazenamento limitado, o registro do PWA trava por dezenas de segundos e desperdiça banda com backgrounds de fases não jogadas.

### 2.2 **PROBLEMA CONFIRMADO (P2) — `SpriteLoader` não libera texturas Beat 'em Up ao sair do modo**
- **Evidência:** Em [SpriteLoader.ts](file:///home/spira/animekombat/src/engine/SpriteLoader.ts#L328-L347), `unloadUnused(keepKeys)` fecha `ImageBitmap` apenas de `this.phaseCache` (heróis), mas **nunca limpa `this.beatEmUpCache`** (`450` bitmaps se o usuário jogar os 3 mapas em sequência, ou quando volta ao modo `1v1`/`Rumble`).
- Além disso, ao evoluir no meio da fase (`BeatEmUpScene.ts:682`), `loadPhasePack(p.entityId, nextPhase)` é disparado em runtime sem pré-carregamento da fase seguinte e sem liberar a fase anterior durante a partida.

### 2.3 **PROBLEMA CONFIRMADO (P2) — Event Listener de `F3` não removido**
- **Evidência:** [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts#L287) registra `window.addEventListener('keydown', this.handleDebugKey)` no construtor (seguro pois há instância única em `main.ts`, mas sem método `destroy()`).

### 2.4 **SUSPEITA (P3) — Alocação por array filtering e `preload` de backgrounds em PNG não comprimido**
- Os 9 trechos Beat 'em Up estão em **PNG (`2,0–2,82 MB` cada = `21,8 MB`)** em vez de WebP (`~350–600 kB`), consumindo ~6–7 MB por fase só de download + decodificação `1536×1024×4 ≈ 6,3 MB` VRAM por trecho (`~19 MB` VRAM por mapa).
- `BeatEmUpScene` usa `.filter()` em `projectiles`, `vfxs`, `floatingTexts` e `enemies` a cada tick (`L1035, 1051, 1054`), ao contrário do pool zero-GC de `CombatSystem.ts`.

---

## 3. Benchmarks de Runtime (Pendentes de Ambiente Browser)

> Conforme Regra 14 e Etapa 8, **nenhum FPS de runtime foi inventado**.

| Cenário de Teste | Status | Motivo |
|---|---|---|
| Batalha com 1 inimigo (CPU/Canvas) | **NÃO TESTADO** | Sem Chromium/Playwright instalado neste host |
| Batalha com 4+ inimigos simultâneos | **NÃO TESTADO** | Sem Chromium/Playwright instalado neste host |
| Batalha com Boss + VFX (`ataque_4`) | **NÃO TESTADO** | Sem Chromium/Playwright instalado neste host |
| Evolução de fase mid-stage (`E`) | **NÃO TESTADO** | Sem Chromium/Playwright instalado neste host |
| Transição entre mapas / combates prolongados | **NÃO TESTADO** | Sem Chromium/Playwright instalado neste host |
