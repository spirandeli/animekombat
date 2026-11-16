# Listagem & Prompts de Backgrounds — Beat 'em Up (Mapas do Brasil)

Os backgrounds atuais em `public/assets/backgrounds/` (`brasilia.png`, `pelourinho.png`, `rio-de-janeiro.png`) foram projetados para **arenas fixas** (`1v1` / `Rumble`).

Para um **Beat 'em Up 2D estilo Super Nintendo** com rolagem horizontal (`GO! →`), cada fase será estruturada em **3 trechos panorâmicos encadeáveis** (`1536 × 1024 px` cada, somando **`4608 × 1024 px`** de percurso contínuo por mapa):
1. **Trecho 1 (Entrada / Rua):** Primeiras ondas de Civis e Políticos.
2. **Trecho 2 (Avenida / Praça Central):** Ondas intermediárias mais intensas.
3. **Trecho 3 (Ponto Icônico — Arena do Boss):** Trava final da câmera onde o **Chefão Regional** entra em cena.

---

## 1. Especificação Técnica dos Backgrounds (Estilo SNES + Anime Atual)

- **Resolução por trecho:** `1536 × 1024 px` (ou `16:9` / `3:2` horizontal consistente).
- **Faixa de chão transitável (2.5D):** Os **35% inferiores** da imagem devem ser uma rua/calçadão/largo plano e contínuo, visto em leve perspectiva *beat 'em up* (ângulo levemente elevado, como *Streets of Rage 2* / *Final Fight*), para que os personagens andem em profundidade (cima/baixo) sem parecer que flutuam nas paredes.
- **Cenário limpo:** **PROIBIDO** desenhar personagens, multidões, carros móveis ou texto de UI na arte do background.
- **Estilo visual:** Mesmo estilo 2D anime vibrante e detalhado dos backgrounds já existentes ([brasilia.png](file:///home/spira/animekombat/public/assets/backgrounds/brasilia.png), [pelourinho.png](file:///home/spira/animekombat/public/assets/backgrounds/pelourinho.png), [rio-de-janeiro.png](file:///home/spira/animekombat/public/assets/backgrounds/rio-de-janeiro.png)).

---

## 2. Listagem Completa por Mapa

### Mapa 1 — Brasília (DF)
- **Existente:** `public/assets/backgrounds/brasilia.png` *(Catedral Metropolitana e Esplanada — pode servir de referência de paleta e céu)*.
- **Novos necessários (salvar em `public/assets/backgrounds/beatemup/brasilia/`):**
  1. `bg_1_rodoviaria_eixo.png` — Eixo Monumental com silhueta da Torre de TV ao fundo, pista larga e canteiros.
  2. `bg_2_esplanada_ministerios.png` — Corredor lateral da Esplanada dos Ministérios e Catedral Metropolitana ao fundo, calçadão largo na base.
  3. `bg_3_congresso_boss.png` — Praça dos Três Poderes com a rampa e as duas cúpulas do Congresso Nacional ao fundo (Arena do Boss).

### Mapa 2 — Pelourinho / Salvador (BA)
- **Existente:** `public/assets/backgrounds/pelourinho.png` *(Largo do Pelourinho)*.
- **Novos necessários (salvar em `public/assets/backgrounds/beatemup/pelourinho/`):**
  1. `bg_1_elevador_lacerda.png` — Praça Cairu com o Elevador Lacerda e Baía de Todos-os-Santos ao fundo, calçamento de pedra na base.
  2. `bg_2_ladeira_casario.png` — Rua horizontal com casarões coloniais coloridos, bandeirinhas e rua de paralelepípedos ampla nos 35% inferiores.
  3. `bg_3_terreiro_boss.png` — Largo do Terreiro de Jesus com fachada barroca da igreja histórica ao fundo (Arena do Boss).

### Mapa 3 — Rio de Janeiro (RJ)
- **Existente:** `public/assets/backgrounds/rio-de-janeiro.png` *(Pão de Açúcar e Cristo Redentor)*.
- **Novos necessários (salvar em `public/assets/backgrounds/beatemup/rio-de-janeiro/`):**
  1. `bg_1_copacabana.png` — Calçadão de Copacabana com ondas em pedra portuguesa na faixa inferior, coqueiros, quiosques e mar/morros ao fundo.
  2. `bg_2_arcos_lapa.png` — Rua da Lapa com os Arcos da Lapa ao fundo e asfalto/calçada amplos na base.
  3. `bg_3_maracana_boss.png` — Esplanada aberta com fachada do Maracanã (ou mirante com Cristo Redentor e Pão de Açúcar ao fundo) como Arena do Boss.

---

## 3. Template de Prompt para Gerar Cada Trecho

Substitua apenas `[TRECHO / CIDADE]` usando a listagem acima:

```text
Create a 2D anime side-scrolling beat 'em up stage background (1536x1024px, horizontal wide view, matching the vibrant 2D anime background art style of Street Fighter / Streets of Rage 4 / modern SNES-inspired arcade brawlers).
CAMERA & PERSPECTIVE (CRITICAL): Classic 2.5D beat 'em up side-scroller perspective. The bottom 35% of the image MUST be a flat, wide, continuous walkable street/sidewalk/plaza floor viewed from a slightly elevated angle so fighters can walk left, right, up, and down on it. The upper 65% shows the iconic Brazilian architecture and bright sky.
CLEAN SCENE: NO characters, NO people, NO crowds, NO foreground obstacles blocking the floor, NO UI text or health bars.
SEAMLESS HORIZONTAL FLOW: Left and right edges should feel like a continuous urban corridor.

LOCATION: [PREENCHER COM UM DOS 9 TRECHOS ACIMA, ex: Brasília, Brazil — Esplanada dos Ministérios with the white modernist Cathedral of Brasília and ministry buildings in the background, wide sunlit concrete plaza floor in the bottom 35%].
```

