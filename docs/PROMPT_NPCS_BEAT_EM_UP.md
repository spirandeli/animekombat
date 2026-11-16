# Prompts de Spritesheets — 3 Tipos de NPCs (Beat 'em Up)

Este guia contém os **24 prompts prontos** (`3 NPCs × 8 ações`) para gerar todas as spritesheets dos inimigos comuns do modo **Beat 'em Up: Ruas do Brasil**, mantendo o mesmo estilo 2D anime cel-shading dos heróis atuais.

> [!IMPORTANT]
> **Regra de ouro de consistência (Image-to-Image):**
> Para cada NPC, gere primeiro o **`idle_3x2.png`**. Depois, ao gerar as outras 7 ações daquele mesmo NPC, **anexe o Frame 1 do `idle` recém-gerado como imagem de referência** para manter rosto, roupa e proporções 100% idênticos.

---

## Estrutura de Pastas para Salvar

```text
spritesPersonagens/overrides/
├── npc_politico/
│   └── fase_1/
│       ├── idle_3x2.png
│       ├── walk_3x2.png
│       ├── ataque_1_3x2.png
│       ├── ataque_2_3x2.png
│       ├── hitstun_3x2.png
│       ├── knockdown_3x2.png
│       ├── getup_3x2.png
│       └── ko_defeat_3x2.png
├── npc_civil_brasil/
│   └── fase_1/
│       ├── idle_3x2.png
│       ├── walk_3x2.png
│       ├── run_3x2.png
│       ├── ataque_1_3x2.png
│       ├── ataque_2_3x2.png
│       ├── hitstun_3x2.png
│       ├── knockdown_3x2.png
│       └── ko_defeat_3x2.png
└── npc_civil_vermelho/
    └── fase_1/
        ├── idle_3x2.png
        ├── walk_3x2.png
        ├── run_3x2.png
        ├── ataque_1_3x2.png
        ├── ataque_2_3x2.png
        ├── hitstun_3x2.png
        ├── knockdown_3x2.png
        └── ko_defeat_3x2.png
```

---

## Bloco Base Comum (já embutido em todos os prompts abaixo)
Todos os prompts abaixo usam:
- Grid `3×2` (`1536×1024 px`, 6 células de `512×512 px`, esquerda → direita, cima → baixo).
- Fundo sólido magenta puro `#FF00FF` (`RGB 255,0,255`), sem linhas, texto ou sombra no chão.
- *Safe Zone*: ≥ 18% topo, ≥ 15% esquerda/direita, ≥ 10% base (`y = 460 px`).
- Personagem sempre virado para a **DIREITA**.

---

## 1. NPC 1 — Político (`npc_politico`)
**Identidade visual fixa:** Homem de meia-idade caricato em estilo anime 2D, terno azul-marinho bem cortado, camisa social branca, gravata vermelha/dourada, pequeno broche dourado da bandeira na lapela, cabelo grisalho penteado para trás, expressão arrogante, segurando uma **pasta executiva de couro preta** na mão direita.

### 1.1 `idle_3x2.png` (GERAR PRIMEIRO)
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255) across all 6 cells. NO grid lines, NO borders, NO dividers, NO frame numbers, NO text, NO floor shadows.
ART STYLE: high-contrast 2D shonen anime arcade cel-shading, crisp dark ink outlines, sharp highlights, stylized caricature proportions (NO pixel art, NO 3D).
SAFE ZONE (CRITICAL): Keep character and briefcase 100% INSIDE each 512x512 cell with at least 18% empty #FF00FF margin at TOP, 15% on LEFT and RIGHT, and 10% at BOTTOM. Feet anchored on y=460px. Strictly facing RIGHT.

CHARACTER: Corrupt Brazilian politician enemy ("npc_politico") — middle-aged man with slicked-back grey-streaked hair, smug grin, navy blue tailored suit, white dress shirt, golden-striped tie, small lapel pin, polished black dress shoes, holding a black leather executive briefcase in his right hand.
ACTION — IDLE (6-frame smooth breathing loop F1->F6): F1 smug upright guard stance with briefcase at side -> F2 slight chest inhale and shoulder shift -> F3 subtle nod and briefcase slight swing -> F4 peak breath -> F5 relax back down -> F6 seamless return to F1 pose.
```

### 1.2 `walk_3x2.png`
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255). NO grid lines, NO borders, NO text, NO floor shadows.
ART STYLE: 2D anime arcade cel-shading, crisp dark ink outlines, exact same character design as the attached idle reference.
SAFE ZONE: 18% TOP, 15% LEFT/RIGHT, 10% BOTTOM empty #FF00FF in every cell. Feet anchored at y=460px. Strictly facing RIGHT.

CHARACTER: Same navy-suit politician with black briefcase from reference.
ACTION — WALK (6-frame street-brawler walk cycle): F1 left foot forward contact, briefcase back -> F2 weight shift down -> F3 right leg passing -> F4 right foot forward contact, briefcase forward -> F5 weight shift down -> F6 left leg passing back to F1.
```

### 1.3 `ataque_1_3x2.png` (Golpe com Pasta Executiva)
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255). NO grid lines, NO borders, NO text, NO floor shadows.
ART STYLE: 2D anime arcade cel-shading, crisp dark ink outlines, exact same character design as the attached idle reference.
SAFE ZONE: 18% TOP, 15% LEFT/RIGHT, 10% BOTTOM empty #FF00FF even at full briefcase swing! Strictly facing RIGHT.

CHARACTER: Same navy-suit politician with black briefcase from reference.
ACTION — ATAQUE_1 (Heavy briefcase bash): F1 pull briefcase back behind shoulder (anticipation) -> F2 torso twist forward -> F3 full horizontal swing strike forward with black briefcase and white motion arc -> F4 impact follow-through -> F5 pull arm back -> F6 recover to guard stance.
```

### 1.4 `ataque_2_3x2.png` (Empurrão / Discurso Arrogante)
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255). NO grid lines, NO borders, NO text, NO floor shadows.
ART STYLE: 2D anime arcade cel-shading, crisp dark ink outlines, exact same character design as the attached idle reference.
SAFE ZONE: 18% TOP, 15% LEFT/RIGHT, 10% BOTTOM empty #FF00FF. Strictly facing RIGHT.

CHARACTER: Same navy-suit politician from reference.
ACTION — ATAQUE_2 (Two-hand arrogant shove / kick): F1 lean back raising both palms -> F2 lunge forward -> F3 forceful double-palm shove + front kick forward -> F4 peak push extension -> F5 recoil -> F6 return to guard.
```

### 1.5 `hitstun_3x2.png`
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255). NO grid lines, NO borders, NO text, NO floor shadows.
ART STYLE: 2D anime arcade cel-shading, crisp dark ink outlines, exact same character design as the attached idle reference.
SAFE ZONE: 18% TOP, 15% LEFT/RIGHT, 10% BOTTOM empty #FF00FF. Strictly facing RIGHT.

CHARACTER: Same navy-suit politician from reference.
ACTION — HITSTUN (Taking a hit): F1 sudden impact flinch head snapped back -> F2 torso recoiling backward, tie flying up -> F3 staggered backward step -> F4 grimace clutching ribs -> F5 regaining balance -> F6 return toward guard.
```

### 1.6 `knockdown_3x2.png`
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255). NO grid lines, NO borders, NO text, NO floor shadows.
ART STYLE: 2D anime arcade cel-shading, crisp dark ink outlines, exact same character design as the attached idle reference.
SAFE ZONE: 18% TOP, 15% LEFT/RIGHT, 10% BOTTOM empty #FF00FF. Strictly facing RIGHT (falling backward to the left).

CHARACTER: Same navy-suit politician from reference.
ACTION — KNOCKDOWN (Launched & hitting the ground): F1 launched backward in mid-air arched back -> F2 falling horizontally -> F3 back hitting the ground line y=460 -> F4 small bounce off ground -> F5 settling flat on back -> F6 lying KO'd on ground.
```

### 1.7 `getup_3x2.png`
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255). NO grid lines, NO borders, NO text, NO floor shadows.
ART STYLE: 2D anime arcade cel-shading, crisp dark ink outlines, exact same character design as the attached idle reference.
SAFE ZONE: 18% TOP, 15% LEFT/RIGHT, 10% BOTTOM empty #FF00FF. Strictly facing RIGHT.

CHARACTER: Same navy-suit politician from reference.
ACTION — GETUP (Standing up from floor): F1 lying on back -> F2 pushing up with one hand -> F3 kneeling on one knee -> F4 rising up dusting off suit -> F5 standing upright -> F6 ready in guard stance.
```

### 1.8 `ko_defeat_3x2.png`
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255). NO grid lines, NO borders, NO text, NO floor shadows.
ART STYLE: 2D anime arcade cel-shading, crisp dark ink outlines, exact same character design as the attached idle reference.
SAFE ZONE: 18% TOP, 15% LEFT/RIGHT, 10% BOTTOM empty #FF00FF. Strictly facing RIGHT.

CHARACTER: Same navy-suit politician from reference.
ACTION — KO_DEFEAT (Classic SNES beat 'em up defeated blink/collapse): F1 dizzy spinning eyes -> F2 knees buckling -> F3 collapsing backward -> F4 hitting the ground flat -> F5 dizzy stars/sweat drop lying down -> F6 flat unconscious pose.
```

---

## 2. NPC 2 — Civil Camisa do Brasil (`npc_civil_brasil`)
**Identidade visual fixa:** Jovem/adulto brasileiro estilo anime 2D brawler, **camisa amarela da seleção brasileira com gola e detalhes verdes**, bermuda jeans azul (ou calça jeans), tênis esportivo branco/azul, pulseira verde-amarela, cabelo curto castanho, postura de briga de rua.

### 2.1 `idle_3x2.png` (GERAR PRIMEIRO)
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255) across all 6 cells. NO grid lines, NO borders, NO dividers, NO frame numbers, NO text, NO floor shadows.
ART STYLE: high-contrast 2D shonen anime arcade cel-shading, crisp dark ink outlines, sharp highlights, street-brawler proportions (NO pixel art, NO 3D).
SAFE ZONE (CRITICAL): Keep character 100% INSIDE each 512x512 cell with at least 18% empty #FF00FF margin at TOP, 15% on LEFT and RIGHT, and 10% at BOTTOM. Feet anchored on y=460px. Strictly facing RIGHT.

CHARACTER: Brazilian street brawler civilian ("npc_civil_brasil") — athletic young man with short brown hair, bright canary-yellow Brazil soccer jersey with green collar and cuffs, blue denim shorts, white-and-blue sneakers, fists raised in street-fighting guard.
ACTION — IDLE (6-frame bouncy fighter stance loop F1->F6): F1 guard up -> F2 slight knee bounce down -> F3 fists bobbing -> F4 peak breath -> F5 settle -> F6 loop back to F1.
```

### 2.2 `walk_3x2.png`
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255). NO grid lines, NO borders, NO text, NO floor shadows.
ART STYLE: 2D anime arcade cel-shading, exact same yellow Brazil jersey civilian from attached idle reference.
SAFE ZONE: 18% TOP, 15% LEFT/RIGHT, 10% BOTTOM empty #FF00FF. Feet at y=460px. Strictly facing RIGHT.

ACTION — WALK (6-frame street-brawler walk cycle): F1 left foot forward -> F2 weight down -> F3 right leg passing -> F4 right foot forward -> F5 weight down -> F6 left leg passing.
```

### 2.3 `run_3x2.png`
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255). NO grid lines, NO borders, NO text, NO floor shadows.
ART STYLE: 2D anime arcade cel-shading, exact same yellow Brazil jersey civilian from attached idle reference.
SAFE ZONE: 18% TOP, 15% LEFT/RIGHT, 10% BOTTOM empty #FF00FF. Strictly facing RIGHT.

ACTION — RUN (6-frame aggressive dash run): F1 lean forward push off -> F2 wide stride right leg forward -> F3 airborne mid-stride -> F4 left leg forward -> F5 airborne stride -> F6 loop back to F1.
```

### 2.4 `ataque_1_3x2.png` (Soco Direto / Cruzado)
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255). NO grid lines, NO borders, NO text, NO floor shadows.
ART STYLE: 2D anime arcade cel-shading, exact same yellow Brazil jersey civilian from attached idle reference.
SAFE ZONE: 18% TOP, 15% LEFT/RIGHT, 10% BOTTOM empty #FF00FF even at full punch extension! Strictly facing RIGHT.

ACTION — ATAQUE_1 (Fast street jab & cross): F1 chamber right fist -> F2 step forward twisting hip -> F3 full straight punch extension to the right -> F4 follow-through -> F5 retract arm -> F6 back to guard.
```

### 2.5 `ataque_2_3x2.png` (Chute / Voadora Baixa)
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255). NO grid lines, NO borders, NO text, NO floor shadows.
ART STYLE: 2D anime arcade cel-shading, exact same yellow Brazil jersey civilian from attached idle reference.
SAFE ZONE: 18% TOP, 15% LEFT/RIGHT, 10% BOTTOM empty #FF00FF. Strictly facing RIGHT.

ACTION — ATAQUE_2 (Soccer-style roundhouse kick): F1 pivot on left foot raising right knee -> F2 hip rotation -> F3 full high/mid side kick extension to the right -> F4 peak impact -> F5 snap leg back -> F6 land in guard.
```

### 2.6 `hitstun_3x2.png`
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255). NO grid lines, NO borders, NO text, NO floor shadows.
ART STYLE: 2D anime arcade cel-shading, exact same yellow Brazil jersey civilian from attached idle reference.
SAFE ZONE: 18% TOP, 15% LEFT/RIGHT, 10% BOTTOM empty #FF00FF. Strictly facing RIGHT.

ACTION — HITSTUN (6-frame stagger reaction): F1 head snapped back from punch -> F2 torso bent backward -> F3 stumbling back step -> F4 wincing -> F5 bracing -> F6 recovering guard.
```

### 2.7 `knockdown_3x2.png`
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255). NO grid lines, NO borders, NO text, NO floor shadows.
ART STYLE: 2D anime arcade cel-shading, exact same yellow Brazil jersey civilian from attached idle reference.
SAFE ZONE: 18% TOP, 15% LEFT/RIGHT, 10% BOTTOM empty #FF00FF. Strictly facing RIGHT.

ACTION — KNOCKDOWN (6-frame fall to ground): F1 airborne backward arc -> F2 horizontal fall -> F3 back impact at y=460 -> F4 small ground bounce -> F5 settling -> F6 lying flat on ground.
```

### 2.8 `ko_defeat_3x2.png`
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255). NO grid lines, NO borders, NO text, NO floor shadows.
ART STYLE: 2D anime arcade cel-shading, exact same yellow Brazil jersey civilian from attached idle reference.
SAFE ZONE: 18% TOP, 15% LEFT/RIGHT, 10% BOTTOM empty #FF00FF. Strictly facing RIGHT.

ACTION — KO_DEFEAT (6-frame beat 'em up KO collapse): F1 dizzy sway -> F2 knees giving out -> F3 falling back -> F4 flat on ground -> F5 knocked out -> F6 flat unconscious pose.
```

---

## 3. NPC 3 — Civil Camisa Vermelha (`npc_civil_vermelho`)
**Identidade visual fixa:** Jovem/adulto brasileiro estilo anime 2D brawler, **camisa/camiseta vermelha vibrante**, boné vermelho para trás (ou faixa na cabeça), calça cargo/jeans escura, tênis preto/vermelho, postura agressiva de brawler de rua.

### 3.1 `idle_3x2.png` (GERAR PRIMEIRO)
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255) across all 6 cells. NO grid lines, NO borders, NO dividers, NO frame numbers, NO text, NO floor shadows.
ART STYLE: high-contrast 2D shonen anime arcade cel-shading, crisp dark ink outlines, sharp highlights, street-brawler proportions (NO pixel art, NO 3D).
SAFE ZONE (CRITICAL): Keep character 100% INSIDE each 512x512 cell with at least 18% empty #FF00FF margin at TOP, 15% on LEFT and RIGHT, and 10% at BOTTOM. Feet anchored on y=460px. Strictly facing RIGHT.

CHARACTER: Brazilian street brawler civilian ("npc_civil_vermelho") — athletic young man wearing a vibrant crimson-red t-shirt, backwards red cap, dark charcoal cargo pants, black-and-red sneakers, fists clenched in aggressive brawler guard.
ACTION — IDLE (6-frame bouncy guard loop F1->F6): F1 guard up -> F2 slight knee dip -> F3 shoulder bob -> F4 peak breath -> F5 settle -> F6 loop back to F1.
```

### 3.2 `walk_3x2.png`
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255). NO grid lines, NO borders, NO text, NO floor shadows.
ART STYLE: 2D anime arcade cel-shading, exact same red-shirt civilian from attached idle reference.
SAFE ZONE: 18% TOP, 15% LEFT/RIGHT, 10% BOTTOM empty #FF00FF. Feet at y=460px. Strictly facing RIGHT.

ACTION — WALK (6-frame street-brawler walk cycle): F1 left foot forward -> F2 weight down -> F3 right leg passing -> F4 right foot forward -> F5 weight down -> F6 left leg passing.
```

### 3.3 `run_3x2.png`
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255). NO grid lines, NO borders, NO text, NO floor shadows.
ART STYLE: 2D anime arcade cel-shading, exact same red-shirt civilian from attached idle reference.
SAFE ZONE: 18% TOP, 15% LEFT/RIGHT, 10% BOTTOM empty #FF00FF. Strictly facing RIGHT.

ACTION — RUN (6-frame aggressive sprint): F1 forward lean push -> F2 wide stride -> F3 airborne stride -> F4 opposite stride -> F5 airborne -> F6 loop to F1.
```

### 3.4 `ataque_1_3x2.png` (Combo de Soco Rápido)
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255). NO grid lines, NO borders, NO text, NO floor shadows.
ART STYLE: 2D anime arcade cel-shading, exact same red-shirt civilian from attached idle reference.
SAFE ZONE: 18% TOP, 15% LEFT/RIGHT, 10% BOTTOM empty #FF00FF even at full punch extension! Strictly facing RIGHT.

ACTION — ATAQUE_1 (Hook punch): F1 windup right shoulder back -> F2 step in -> F3 heavy hook punch forward to the right -> F4 follow-through -> F5 pull back -> F6 guard stance.
```

### 3.5 `ataque_2_3x2.png` (Investida de Ombro / Tackle)
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255). NO grid lines, NO borders, NO text, NO floor shadows.
ART STYLE: 2D anime arcade cel-shading, exact same red-shirt civilian from attached idle reference.
SAFE ZONE: 18% TOP, 15% LEFT/RIGHT, 10% BOTTOM empty #FF00FF. Strictly facing RIGHT.

ACTION — ATAQUE_2 (Shoulder tackle rush): F1 crouch low bracing shoulder -> F2 burst forward -> F3 high-impact shoulder ram to the right -> F4 follow-through skid -> F5 brake -> F6 recover guard.
```

### 3.6 `hitstun_3x2.png`
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255). NO grid lines, NO borders, NO text, NO floor shadows.
ART STYLE: 2D anime arcade cel-shading, exact same red-shirt civilian from attached idle reference.
SAFE ZONE: 18% TOP, 15% LEFT/RIGHT, 10% BOTTOM empty #FF00FF. Strictly facing RIGHT.

ACTION — HITSTUN (6-frame stagger reaction): F1 head jerked back -> F2 torso bent back -> F3 stumbling step -> F4 grimace -> F5 bracing -> F6 recovering guard.
```

### 3.7 `knockdown_3x2.png`
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255). NO grid lines, NO borders, NO text, NO floor shadows.
ART STYLE: 2D anime arcade cel-shading, exact same red-shirt civilian from attached idle reference.
SAFE ZONE: 18% TOP, 15% LEFT/RIGHT, 10% BOTTOM empty #FF00FF. Strictly facing RIGHT.

ACTION — KNOCKDOWN (6-frame fall to ground): F1 airborne backward arc -> F2 horizontal fall -> F3 back impact at y=460 -> F4 small bounce -> F5 settling -> F6 lying flat.
```

### 3.8 `ko_defeat_3x2.png`
```text
Create a 2D anime beat 'em up game spritesheet in a clean 3x2 grid (3 columns, 2 rows, 6 equal cells of 512x512px, total 1536x1024px, left-to-right top-to-bottom).
Solid flat pure magenta background (#FF00FF, RGB 255,0,255). NO grid lines, NO borders, NO text, NO floor shadows.
ART STYLE: 2D anime arcade cel-shading, exact same red-shirt civilian from attached idle reference.
SAFE ZONE: 18% TOP, 15% LEFT/RIGHT, 10% BOTTOM empty #FF00FF. Strictly facing RIGHT.

ACTION — KO_DEFEAT (6-frame beat 'em up KO collapse): F1 dizzy sway -> F2 knees buckling -> F3 falling back -> F4 flat on ground -> F5 knocked out -> F6 flat unconscious pose.
```

