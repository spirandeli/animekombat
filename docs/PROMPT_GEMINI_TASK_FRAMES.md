# Prompt Mestre para Gemini Web Task — Geração Completa de Spritesheets (10/12/15/20/40 Frames)

> **Como usar:** Copie todo o bloco dentro de **"PROMPT PARA O GEMINI TASK"** abaixo e cole no Task do Gemini Web (anexando os `idle` atuais de `public/assets/characters/<personagem>/fase_<N>/idle/frame_1.webp` como referência visual de estilo, se desejar travar 100% o traço de cada personagem).
> O prompt instrui o Gemini a gerar todas as spritesheets em `3×2` (`1536×1024 px`) e empacotar **1 arquivo `.zip` por personagem** na estrutura exata de pastas para corte e importação automática no **Anime Kombat**.

---

## PROMPT PARA O GEMINI TASK

```text
Você é um Diretor de Arte e Animador Sênior de Jogos de Luta 2D (estilo Anime Shonen Arcade + Beat 'em Up SNES em alta definição).
Sua tarefa é gerar TODAS as spritesheets de todos os 9 personagens (4 fases cada = 36 formas) do jogo Anime Kombat, seguindo rigorosamente as regras técnicas, contagens de frames, janelas de Startup/Active/Recovery e estrutura de pastas .zip abaixo.

======================================================================
1. REGRAS TÉCNICAS OBRIGATÓRIAS (PARA 100% DAS IMAGENS)
======================================================================
- FORMATO DE CADA IMAGEM: PNG em grid 3x2 (3 colunas x 2 linhas = 6 células exatas de 512x512 px, resolução total EXATA de 1536x1024 px).
- ORDEM DE LEITURA: Esquerda -> Direita na linha superior (C1, C2, C3), depois Esquerda -> Direita na linha inferior (C4, C5, C6).
- FUNDO: Magenta 100% sólido e plano #FF00FF (RGB 255, 0, 255) em todo o espaço vazio.
  PROIBIDO: linhas de grade, bordas, divisórias, vinheta escura nas bordas, sombra no chão, números de frame, textos ou marca d'água.
- CÉLULAS SOBRESSALENTES: Quando a última folha de uma ação tiver menos de 6 frames (ex.: 10 frames = 6 na parte_1 + 4 na parte_2; 15 frames = 6+6+3; 20 frames = 6+6+6+2; 40 frames = 6x6+4), preencha as últimas células vazias APENAS com magenta puro #FF00FF.
- ESTILO ARTÍSTICO (TRAVA DE ESTILO): Cel-shading 2D de anime shonen de alto contraste, contornos escuros nítidos (ink outlines), sombras e brilhos bem definidos.
  PROIBIDO: pixel art, estilo retrô 16-bit, render 3D, realismo fotográfico ou estilo chibi deformado (exceto Chopper Brain Point que já é compacto).
- DIREÇÃO: TODOS os frames de TODAS as ações devem estar estritamente virados para a DIREITA (facing RIGHT).
- SAFE ZONE ANTI-CORTE (CRÍTICO):
  - Em ações de personagem: o corpo, cabelo, aura, armas, chifres, membros elásticos e efeitos NUNCA podem tocar as bordas da célula 512x512.
  - Deixe no mínimo 92 px (18%) livres de #FF00FF no TOPO, 77 px (15%) na ESQUERDA e DIREITA, e 51 px (10%) na BASE.
  - Alinhe a sola dos pés na baseline y = 460 px de cada célula.
  - Em folhas de VFX ISOLADO (vfx_ataque_1..4): NÃO desenhe o corpo do personagem dentro da célula; centralize o efeito com pelo menos 92 px (18%) de margem #FF00FF nos 4 lados.

======================================================================
2. REGRA DE QUANTIDADE DE FRAMES & FRAME DATA (STARTUP / ACTIVE / RECOVERY)
======================================================================
Cada ação DEVE ter exatamente a quantidade de frames abaixo, dividida em folhas 3x2 sequenciais (parte_1.png, parte_2.png, ...):

A) AÇÕES NÃO LISTADAS — 10 FRAMES CADA (2 folhas 3x2: parte_1 [F1..F6], parte_2 [F7..F10 + 2 células vazias]):
   1. idle (10f): respiração em guarda de combate em loop suave (F1 neutro -> F5 ápice da inspiração -> F10 retorno exato a F1).
   2. run (10f): corrida agressiva inclinada para frente em loop (F1..F10 ciclo completo de passadas rápidas).
   3. walk (10f): caminhada cadenciada de Beat 'em Up em loop (postura ereta, passadas firmes sem parecer sprint).
   4. jump (10f): F1-F2 agachamento de impulso -> F3-F5 subida no ar -> F6-F7 ápice no ar -> F8-F10 queda preparada.
   5. land (10f): F1-F2 contato dos pés no chão -> F3-F5 absorção de impacto agachando -> F6-F10 retorno gradual à guarda.
   6. dash (10f): F1-F2 inclinação explosiva -> F3-F6 avanço veloz horizontal com rastro -> F7-F10 desaceleração para guarda.
   7. crouch (10f): AGACHADO REAL (altura entre 60% e 65% da altura em pé, joelhos bem dobrados): F1-F3 descida -> F4-F7 respiração agachado -> F8-F10 estabilidade.
   8. block (10f): F1-F2 erguer braços/arma em guarda fechada -> F3-F7 postura defensiva firme absorvendo impacto -> F8-F10 retorno.
   9. hitstun (10f): F1-F3 impacto e recuo do tronco/cabeça para trás -> F4-F7 desequilíbrio -> F8-F10 recuperação para guarda.
  10. knockdown (10f): F1-F3 lançamento para trás no ar -> F4-F6 queda de costas e quique no chão -> F7-F10 corpo caído no chão.
  11. getup (10f): F1-F2 caído no chão apoiando as mãos -> F3-F5 joelho erguido e impulso -> F6-F8 elevação -> F9-F10 guarda pronta.
  12. victory (10f): F1-F3 relaxamento da guarda -> F4-F7 pose icônica de vitória do personagem/fase -> F8-F10 manutenção triunfante.
  13. evolve (10f): F1-F2 concentração com aura crescente -> F3-F5 explosão de poder/transformação -> F6-F8 estabilização na nova forma -> F9-F10 pose de poder.
  14. ki_charge (10f): loop contínuo de recarga de energia (joelhos flexionados, punhos cerrados, aura subindo do chão em F1..F10).
  15. air_ataque_1 (10f): golpe aéreo clássico (voadora ou corte aéreo descendente: F1-F3 preparação no ar -> F4-F7 golpe estendido -> F8-F10 recolhimento no ar).
  16. grab (10f): agarrão de curta distância (F1-F3 estender braços para frente -> F4-F7 segurar gola/ombro e aplicar joelhada curta -> F8-F10 manter controle).
  17. throw (10f): arremesso por cima do ombro para a direita (F1-F3 puxar e erguer -> F4-F7 girar e arremessar com força para a direita -> F8-F10 retorno à guarda).
  18. pickup (10f): pegar item no chão (F1-F3 agachar rápido -> F4-F6 mão toca o chão e pega item -> F7-F10 levantar guardando item).

B) GOLPE 1 (ataque_1 + vfx_ataque_1) — 12 FRAMES (2 folhas 3x2: parte_1 [F1..F6], parte_2 [F7..F12]):
   - Startup (F1-F3, 3 frames): antecipação rápida, ombro/arma recua preparando o golpe.
   - Active (F4-F7, 4 frames): extensão total do golpe rápido / combo leve causando impacto.
   - Recovery (F8-F12, 5 frames): recolhimento fluido do braço/arma até retornar à guarda base.
   - vfx_ataque_1 (12f isolado): F1-F3 faísca de ignição -> F4-F7 explosão/corte de impacto no pico -> F8-F12 ondas e dissipação.

C) GOLPE 2 (ataque_2 + vfx_ataque_2) — 15 FRAMES (3 folhas 3x2: parte_1 [F1..F6], parte_2 [F7..F12], parte_3 [F13..F15 + 3 vazias]):
   - Startup (F1-F4, 4 frames): preparação pesada com torção de tronco / recuo de arma / carga.
   - Active (F5-F10, 6 frames): avanço e execução ampla do golpe forte com arco de movimento contínuo.
   - Recovery (F11-F15, 5 frames): desaceleração, apoio do pé à frente e retorno à guarda.
   - vfx_ataque_2 (15f isolado): F1-F4 carregamento -> F5-F10 varredura/onda de impacto contínua -> F11-F15 estilhaços e fumaça dissipando.

D) GOLPE 3 (ataque_3 + vfx_ataque_3) — 20 FRAMES (4 folhas 3x2: parte_1..3 [F1..F18], parte_4 [F19..F20 + 4 vazias]):
   - Startup (F1-F7, 7 frames): preparação energética/técnica evidente (concentração de ki, chakra, lâmina ou postura especial).
   - Active (F8-F13, 6 frames): disparo de projétil, feixe ou golpe especial de médio alcance mantido no ápice.
   - Recovery (F14-F20, 7 frames): recuo pós-disparo, dissipação de energia nas mãos/arma e retorno firme à guarda.
   - vfx_ataque_3 (20f isolado): F1-F7 formação do núcleo/projétil -> F8-F13 feixe/projétil em deslocamento e explosão -> F14-F20 anel de choque e partículas sumindo.

E) ULTIMATE (ataque_4 + vfx_ataque_4) — 40 FRAMES (7 folhas 3x2: parte_1..6 [F1..F36], parte_7 [F37..F40 + 2 vazias]):
   - Startup (F1-F14, 14 frames): cinemática de preparação épica da técnica suprema (concentração máxima, aura explodindo, preparação do golpe final).
   - Active (F15-F30, 16 frames): execução devastadora em múltiplos estágios (rajada contínua / múltiplos cortes / impacto gigante sustentado).
   - Recovery (F31-F40, 10 frames): pós-impacto, fumaça baixando, personagem recuperando o fôlego e voltando à guarda.
   - vfx_ataque_4 (40f isolado): F1-F14 ignição e acúmulo colossal -> F15-F30 explosão suprema em ondas concêntricas -> F31-F40 estilhaços, cinzas e dissipação total.

======================================================================
3. CATÁLOGO DOS 9 PERSONAGENS × 4 FASES (36 FORMAS E GOLPES OFICIAIS)
======================================================================
Gere todas as 26 pastas de ações (18 ações de 10f + 4 ataques + 4 VFX = 68 folhas 3x2 por fase = 272 folhas por personagem) para cada uma das 36 formas abaixo, respeitando fielmente o visual e o tema de cada golpe:

1) SON GOKU (`goku`)
   - fase_1 (Base): kimono laranja/azul clássico, cabelo preto espetado.
     ataque_1: Soco Combo | ataque_2: Chute Investida | ataque_3: Kamehameha | ataque_4: Genki Dama
   - fase_2 (Super Saiyajin): cabelo dourado espetado, aura dourada, olhos verdes.
     ataque_1: Rajada Super Saiyajin | ataque_2: Chute Meteoro | ataque_3: Super Kamehameha | ataque_4: Teletransporte Kamehameha
   - fase_3 (Super Saiyajin 3): cabelo dourado longo até a cintura, sem sobrancelhas, aura com raios.
     ataque_1: Golpe Veloz SSJ3 | ataque_2: Impacto Pesado SSJ3 | ataque_3: Kamehameha Dourado | ataque_4: Punho do Dragão
   - fase_4 (Instinto Superior): cabelo prateado, aura azul/prata brilhante, camisa rasgada/tronco à mostra.
     ataque_1: Soco Invisível | ataque_2: Contra-Investida Divina | ataque_3: Kamehameha Divino | ataque_4: Impacto Instinto Superior

2) MONKEY D. LUFFY (`luffy`)
   - fase_1 (Base): colete vermelho, chapéu de palha, bermuda azul, sandálias.
     ataque_1: Gomu Gomu no Gatling | ataque_2: Gomu Gomu no Muchi | ataque_3: Gomu Gomu no Pistol | ataque_4: Red Hawk
   - fase_2 (Gear 4: Boundman): tronco musculoso inflado, Haki escuro brilhante nos braços/pernas, fumaça branca nos ombros.
     ataque_1: Kong Gun | ataque_2: Rhino Schneider | ataque_3: Culverin | ataque_4: King Kong Gun
   - fase_3 (Gear 4: Snakeman): forma esguia com Haki escuro, cabelo flamejante, fumaça branca nos ombros.
     ataque_1: Black Mamba | ataque_2: Python Dash Kick | ataque_3: Jet Culverin | ataque_4: King Cobra
   - fase_4 (Gear 5): cabelos e roupas totalmente brancos, nuvem branca flutuante, sorriso energético.
     ataque_1: Dawn Pistol | ataque_2: Dawn Whip | ataque_3: Kaminari (Raio) | ataque_4: Bajrang Gun

3) NARUTO UZUMAKI (`naruto`)
   - fase_1 (Normal): macacão laranja e azul/preto, bandana da Folha, cabelo loiro.
     ataque_1: Soco Combo | ataque_2: Chute Investida | ataque_3: Rasengan | ataque_4: Odama Rasengan / Rajada Clones
   - fase_2 (Quatro Caudas): manto de chakra vermelho-escuro borbulhante, 4 caudas de raposa, olhos brilhantes.
     ataque_1: Garra de Chakra | ataque_2: Chicote de Caudas | ataque_3: Onda Sônica Vermelha | ataque_4: Bijuu Dama
   - fase_3 (Manto Kurama): manto dourado brilhante de energia com marcas negras, cabelo espetado dourado.
     ataque_1: Golpe Kurama | ataque_2: Investida Relâmpago | ataque_3: Rasenshuriken | ataque_4: Avatar Kurama
   - fase_4 (Modo Bárion): manto vermelho/laranja flamejante com 9 caudas de energia e marcas negras no rosto.
     ataque_1: Combo Bárion | ataque_2: Chute Nuclear | ataque_3: Rasengan Bárion | ataque_4: Explosão Bárion Suprema

4) RYOMEN SUKUNA (`sukuna`)
   - fase_1 (1-3 Dedos): uniforme escolar escuro (Itadori) com marcas negras faciais, cabelo rosa.
     ataque_1: Punho Amaldiçoado | ataque_2: Chute Sombrio | ataque_3: Desmantelar | ataque_4: Santuário Incompleto
   - fase_2 (15 Dedos): kimono/calça tradicional com marcas negras completas e energia carmesim.
     ataque_1: Combo Impiedoso | ataque_2: Corte Brutal | ataque_3: Clivar | ataque_4: Flecha de Fogo (Fuga)
   - fase_3 (Meguna): uniforme escuro (Megumi), cabelo preto com marcas negras de Sukuna.
     ataque_1: Golpe das Sombras | ataque_2: Corte Cruzado | ataque_3: Rajada de Cortes | ataque_4: Invocação Mahoraga
   - fase_4 (Era Heian): forma verdadeira com 4 braços, máscara óssea parcial no rosto, marcas negras e kimono branco.
     ataque_1: Barragem de 4 Braços | ataque_2: Corte Esmagador | ataque_3: Corte do Mundo | ataque_4: Santuário Malevolente

5) RORONOA ZORO (`zoro`)
   - fase_1 (Nitoryu): bandana/roupa verde clássica, 2 espadas (uma em cada mão).
     ataque_1: Corte Nitoryu | ataque_2: Taka Nami | ataque_3: 72 Pound Cannon | ataque_4: Nigiri Sai Kuru
   - fase_2 (Santoryu): bandana preta na cabeça, 3 espadas (uma na boca, duas nas mãos), aura verde.
     ataque_1: Corte Santoryu | ataque_2: Oni Giri | ataque_3: 360 Pound Cannon | ataque_4: Tatsumaki
   - fase_3 (Ashura): ilusão demoníaca roxa/verde com 3 cabeças e 6 braços empunhando espadas.
     ataque_1: Corte Demoníaco | ataque_2: Ashura Makyusen | ataque_3: 1080 Pound Cannon | ataque_4: Ashura Ichibugin
   - fase_4 (King of Hell): chamas verdes/roxas de Haki do Rei nas 3 espadas, aura infernal carmesim/verde.
     ataque_1: Corte do Inferno | ataque_2: En-Ou Santoryu | ataque_3: Onda Haoshoku | ataque_4: Jigoku no Ou: Dragon

6) SASUKE UCHIHA (`sasuke`)
   - fase_1 (Sharingan 3 Tomoes): camisa branca aberta, faixa roxa, katana na cintura, olhos Sharingan vermelhos.
     ataque_1: Combo Uchiha | ataque_2: Chidori | ataque_3: Katon: Bola de Fogo | ataque_4: Kirin
   - fase_2 (Selo Amaldiçoado Nv.2): pele cinza-escura, cabelo longo azulado, asas em forma de mão nas costas.
     ataque_1: Garras Amaldiçoadas | ataque_2: Chidori Negro | ataque_3: Chidori Senbon | ataque_4: Chidori Lamentação
   - fase_3 (EMS): manto/capa escura, olhos Eternal Mangekyou, katana Kusanagi, chamas negras Amaterasu.
     ataque_1: Corte Espada Kusanagi | ataque_2: Chidori Nagashi | ataque_3: Amaterasu | ataque_4: Flecha Susano'o
   - fase_4 (Susano'o Indra): aura roxa/elétrica de Susano'o/Rinnegan envolvendo o corpo, raios azuis/roxos.
     ataque_1: Lâmina Amenotejikara | ataque_2: Investida Rinnegan | ataque_3: Chidori Onyx | ataque_4: Flecha de Indra

7) SEIYA DE PÉGASO (`seiya`)
   - fase_1 (Pégaso V2): armadura prateada/azul-claro de Pégaso, roupa vermelha por baixo.
     ataque_1: Punho de Pégaso | ataque_2: Turbilhão de Pégaso | ataque_3: Meteoro de Pégaso | ataque_4: Cometa de Pégaso
   - fase_2 (Pégaso Dourada): armadura dourada brilhante de Sagitário/Pégaso Dourada com asas douradas.
     ataque_1: Punho Dourado | ataque_2: Turbilhão Dourado | ataque_3: Meteoro Dourado | ataque_4: Cometa de Pégaso
   - fase_3 (Odin Robe): armadura azul-safira nórdica de Odin Robe empunhando a Espada de Balmung.
     ataque_1: Corte de Odin | ataque_2: Investida Balmung | ataque_3: Meteoro de Odin | ataque_4: Espada de Balmung
   - fase_4 (Kamui Divina): Armadura Divina de Pégaso alada prateada/dourada radiante, cosmo celestial.
     ataque_1: Golpe Divino | ataque_2: Turbilhão Kamui | ataque_3: Meteoro Divino | ataque_4: Cometa Big Bang

8) INUYASHA (`inuyasha`)
   - fase_1 (Humana): cabelo preto comprido, sem orelhas de cachorro, traje vermelho (Noite de Lua Nova) com espada humana.
     ataque_1: Garras Retalhadoras | ataque_2: Investida Ágil | ataque_3: Lâmina de Sangue | ataque_4: Fúria Retalhadora
   - fase_2 (Hanyou): cabelo branco prateado, orelhas de cachorro, traje vermelho, espada Tessaiga.
     ataque_1: Garras Retalhadoras | ataque_2: Corte da Tessaiga | ataque_3: Ferida do Vento | ataque_4: Onda Explosiva
   - fase_3 (Youkai): olhos vermelhos demoníacos, marcas roxas nas bochechas, Tessaiga carmesim/energia demoníaca.
     ataque_1: Garras Demoníacas | ataque_2: Tessaiga Carmesim | ataque_3: Ferida do Vento | ataque_4: Onda Explosiva
   - fase_4 (Daiyoukai): aura roxa dimensional, Tessaiga Negra (Meidou), poder youkai máximo.
     ataque_1: Corte Daiyoukai | ataque_2: Tessaiga Negra | ataque_3: Lâmina Dimensional | ataque_4: Meidou Zangetsuha

9) TONY TONY CHOPPER (`chopper`)
   - fase_1 (Brain Point): rena pequena fofa com chapéu rosa/azul de cruz, camisa listrada.
     ataque_1: Patada Rápida | ataque_2: Heavy Gong (Guard Point fofo) | ataque_3: Rumble Shot | ataque_4: Kokutei Roseo
   - fase_2 (Horn Point): forma ágil com chifres gigantes ramificados e casaco/chapéu.
     ataque_1: Golpe de Chifre | ataque_2: Horn Point Rush | ataque_3: Impacto Sísmico | ataque_4: Horn Roseo
   - fase_3 (Kung Fu Point): corpo robusto e arredondado de artes marciais com chapéu azul.
     ataque_1: Palma Kung Fu | ataque_2: Chute Giratório | ataque_3: Onda de Choque | ataque_4: Kung Fu Barrage
   - fase_4 (Monster Point): colosso gigantesco peludo marrom com chifres enormes e chapéu pequeno no topo.
     ataque_1: Esmagamento Monstro | ataque_2: Investida Colossal | ataque_3: Rugido Sísmico | ataque_4: Kokutei Palmeira Colossal

======================================================================
4. EMPACOTAMENTO E ESTRUTURA DE PASTAS (.ZIP POR PERSONAGEM)
======================================================================
Entregue EXATAMENTE 9 arquivos .zip (UM por personagem:
`goku_sprites.zip`, `luffy_sprites.zip`, `naruto_sprites.zip`, `sukuna_sprites.zip`, `zoro_sprites.zip`, `sasuke_sprites.zip`, `seiya_sprites.zip`, `inuyasha_sprites.zip`, `chopper_sprites.zip`).

Cada `<personagem>_sprites.zip` deve conter exatamente esta árvore de pastas:

<personagem>/
  fase_1/ ... fase_4/
    idle/parte_1.png, parte_2.png
    run/parte_1.png, parte_2.png
    walk/parte_1.png, parte_2.png
    jump/parte_1.png, parte_2.png
    land/parte_1.png, parte_2.png
    dash/parte_1.png, parte_2.png
    crouch/parte_1.png, parte_2.png
    block/parte_1.png, parte_2.png
    hitstun/parte_1.png, parte_2.png
    knockdown/parte_1.png, parte_2.png
    getup/parte_1.png, parte_2.png
    victory/parte_1.png, parte_2.png
    evolve/parte_1.png, parte_2.png
    ki_charge/parte_1.png, parte_2.png
    air_ataque_1/parte_1.png, parte_2.png
    grab/parte_1.png, parte_2.png
    throw/parte_1.png, parte_2.png
    pickup/parte_1.png, parte_2.png
    ataque_1/parte_1.png, parte_2.png
    ataque_2/parte_1.png, parte_2.png, parte_3.png
    ataque_3/parte_1.png, parte_2.png, parte_3.png, parte_4.png
    ataque_4/parte_1.png, parte_2.png, parte_3.png, parte_4.png, parte_5.png, parte_6.png, parte_7.png
    vfx/
      vfx_ataque_1/parte_1.png, parte_2.png
      vfx_ataque_2/parte_1.png, parte_2.png, parte_3.png
      vfx_ataque_3/parte_1.png, parte_2.png, parte_3.png, parte_4.png
      vfx_ataque_4/parte_1.png, parte_2.png, parte_3.png, parte_4.png, parte_5.png, parte_6.png, parte_7.png
```
