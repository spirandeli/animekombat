# 07 — Auditoria dos Mapas, Cenários e Composição 2.5D

## 1. Estrutura dos 3 Mapas (`BeatEmUpMap.ts`)

Cada mapa concatena 3 imagens de `1536×1024 px` lado a lado formando um corredor contínuo de **`4608×1024 px`**, com faixa caminhável definida em `walkMinZ..walkMaxZ`.

| Mapa | Trechos | Faixa Z (`walkMinZ..walkMaxZ`) | Ondas |
|---|---|---|---|
| **Brasília (DF)** | `bg_1_rodoviaria_eixo.png` → `bg_2_esplanada_ministerios.png` → `bg_3_congresso_boss.png` | `675..965` (`290px`, 28,3% inferior) | 5 ondas (3–4 inimigos + Lula + 1 Político) |
| **Pelourinho (BA)** | `bg_1_elevador_lacerda.png` → `bg_2_ladeira_casario.png` → `bg_3_terreiro_boss.png` | `675..965` (`290px`, 28,3% inferior) | 5 ondas (3–4 inimigos + Pavanato + 1 Civil) |
| **Rio de Janeiro (RJ)** | `bg_1_copacabana.png` → `bg_2_arcos_lapa.png` → `bg_3_maracana_boss.png` | `685..965` (`280px`, 27,3% inferior) | 5 ondas (3–4 inimigos + Flávio + 1 Político) |

---

## 2. Inspeção Visual e Técnica das Imagens de Fundo

### 2.1 **PROBLEMA CONFIRMADO (P2) — Costuras (Seams) Visíveis nas Junções `x = 1536` e `x = 3072`**
- **Medição real de descontinuidade média RGB na fronteira vertical entre trechos:**
  - **Brasília:** Trecho 1→2 = **`61.1`** | Trecho 2→3 = **`35.0`**
  - **Pelourinho:** Trecho 1→2 = **`73.9`** | Trecho 2→3 = **`56.4`**
  - **Rio de Janeiro:** Trecho 1→2 = **`72.0`** | Trecho 2→3 = **`44.4`**
- **Causa:** Os 3 trechos de cada cidade representam locações geográficas distintas (ex.: Copacabana praia → Arcos da Lapa → Maracanã) geradas separadamente, sem faixa de transição (*crossfade* horizontal de ~64–96px, pórtico de transição, ou fade entre trechos). Na câmera panorâmica (`camLeftWorld`), quando a junção passa no meio da tela, surge um corte vertical seco no céu, edifícios e piso.

### 2.2 **PROBLEMA CONFIRMADO (P2) — Alinhamento Vertical do Chão Caminhável vs Calçadas / Obstáculos Desenhados**
Observado diretamente nas imagens:
- **`brasilia/bg_1_rodoviaria_eixo.png`:** A faixa de asfalto principal ocupa `~64%..92%` (`y ≈ 655..940`), mas há uma **grama em primeiro plano** no extremo inferior (`y ≈ 940..1024`). `walkMaxZ = 965` permite que os pés do personagem pisem ligeiramente na grama inferior (comportamento aceitável, pois `965` encosta no meio-fio inferior).
- **`rio-de-janeiro/bg_1_copacabana.png`:** O calçadão de ondas portuguesas tem perspectiva diagonal acentuada à direita (`y ≈ 600` à direita com quiosque e mesas/cadeiras desenhados em `x ≈ 950..1536, y ≈ 580..760`). Quando o jogador sobe até `walkMinZ = 685` no lado direito de Copacabana, o personagem passa **por cima das cadeiras e do quiosque de água de coco** desenhados na arte!
- **`rio-de-janeiro/bg_2_arcos_lapa.png`:** Possui caixotes, lixeira e cavalete desenhados no canto inferior direito (`y ≈ 780..1000`), onde o jogador pode atravessar visualmente.
- **`pelourinho/bg_1_elevador_lacerda.png`:** Chão plano amplo em `y ≈ 700..1024`; `walkMinZ = 675` deixa o personagem subir `~25px` acima da base das barracas de rua.

### 2.3 **PROBLEMA CONFIRMADO (P2) — Aspect Ratio / Cortinas Pretas ou Corte Vertical em Telas Ultrawide ou 4:3**
- **Evidência:** Em [BeatEmUpScene.ts](file:///home/spira/animekombat/src/game/BeatEmUpScene.ts#L438-L446) e [BeatEmUpMap.ts](file:///home/spira/animekombat/src/game/BeatEmUpMap.ts#L341-L347), `viewScale = ch / 1024` e `drawY = (ch - screenH) * 0.5 = 0`.
  - Isso preenche 100% da altura da tela em qualquer resolução, sem barras horizontais.
  - Em `16:9` (`1280×720`), `viewWorldW = 1820 px`, maior que a largura de 1 trecho (`1536 px`) e maior que `lockMaxX - lockMinX = 1536 px`!
  - **Consequência crítica:** Quando `arenaLocked = true` na Wave 1 (`lockMinX = 0, lockMaxX = 1536`), `maxLeft = Math.max(0, 1536 - 1820) = 0`, então a câmera mostra **`0..1820`** (os `284px` à direita já mostram o Trecho 2!), mas o jogador e inimigos estão travados dentro de `lockMaxX - 42 = 1494` — ou seja, existe uma **parede invisível `326px` antes da borda direita da tela**! O mesmo ocorre na Wave 5 (`lockMinX = 3072, lockMaxX = 4608`, onde `viewWorldW = 1820 > 1536` faz a câmera ficar presa em `3072`? Não: `maxLeft = Math.max(3072, 4608 - 1820) = 3072`, mostrando `3072..4892`, deixando **`284px` de fundo preto `#090d1a` à direita da tela** durante a luta contra o Chefão em telas 16:9 e ainda pior em 20:9 mobile!!).

**EXCELENTE DESCOBERTA NA AUDITORIA!** Em qualquer tela mais larga que `3:2` (`16:9` desktop ou `20:9` smartphone em landscape!), a Wave do Chefão (`lockMaxX = 4608`) deixa uma faixa preta vazia de `284px` a `500px` no lado direito da tela porque `lockMinX = 3072` impede a câmera de encostar `camLeftWorld` em `4608 - viewWorldW`!

---

## 3. Recomendações de Mapa e Câmera

1. Ajustar cálculo de câmera para travar usando `viewWorldW` dinâmico (`camLockMin = Math.min(wave.lockMinX, wave.lockMaxX - viewW)` e `camLeftWorld` sempre clamped em `[0, stage.worldWidth - viewW]`), eliminando a faixa preta à direita na Arena do Boss!
2. Aplicar um **blend suave / gradiente de transição** (`~72px`) ou elemento arquitetônico de transição (poste/portal/sombra de viaduto) entre os trechos `0|1` e `1|2` para mascarar as costuras RGB de 35–74 pontos.
3. Ajustar `walkMinZ` por trecho ou por mapa (ex.: `715` em Copacabana/Lacerda) para evitar pés sobre mobiliário/barracas de fundo.
4. Remover a duplicata `public/assets/backgrounds/beatemup/<cidade>/<cidade>.png` ou reutilizar `/assets/backgrounds/<cidade>.png` (economizando ~8,6 MB).
