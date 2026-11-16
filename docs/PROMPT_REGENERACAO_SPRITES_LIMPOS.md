# Prompts de Regeneração V2 — Spritesheets Limpas & VFXs Detalhados Fiéis aos Golpes

Este documento contém **dois blocos prontos para copiar e colar** no Gemini / Nano Banana (sempre anexando o `idle/frame_1.webp` da respectiva fase como referência de estilo e proporção):
1. **Prompt Mestre A — Personagens Limpos** (corrige VFX embutido no corpo, encolhimento de frames e glitches de figurino).
2. **Prompt Mestre B — VFXs Detalhados de Alta Fidelidade** (`vfx_ataque_1..4` fiéis à técnica icônica de cada personagem e fase).

---

## PARTE A — PROMPT MESTRE PARA REGENERAR PERSONAGENS LIMPOS (SEM VFX EMBUTIDO)

```text
Você é Diretor de Arte e Animador Sênior de Jogos de Luta 2D (Anime Shonen Cel-Shading HD).
Sua tarefa é REGENERAR SOMENTE as spritesheets de PERSONAGEM listadas abaixo, mantendo EXATAMENTE o mesmo estilo de traço, sombreamento e design do `idle/frame_1.webp` anexado, porém ELIMINANDO todos os defeitos descritos.

======================================================================
1. PROIBIÇÃO TOTAL DE VFX DE PROJÉTIL / FEIXE / EXPLOSÃO NO PERSONAGEM
======================================================================
- O motor do Anime Kombat já renderiza os efeitos de ataque em camada separada (`vfx_ataque_1..4`).
- Portanto, nos quadros do PERSONAGEM (`ataque_1..4`):
  * PROIBIDO desenhar feixes Kamehameha, bolas Genki Dama, flechas flamejantes gigantes, arcos de energia, Bijuu Damas voadoras, explosões de luz, anéis concêntricos, cabeças de dragão ou rajadas saindo das mãos/boca/espada!
  * O personagem deve fazer APENAS a atuação corporal limpa: preparação/carga (máximo um ponto de brilho sutil de <=20px colado na palma/lâmina), postura firme de empurrão/disparo estendendo mãos ou arma para o vazio à direita, sustentação do recuo e retorno à guarda.
  * Exceção mínima permitida: aura fina contornando a silhueta corporal ou brilho fino aderido à superfície da arma em golpes físicos.

======================================================================
2. TRAVA ABSOLUTA DE ESCALA CORPORAL (ZERO ZOOM-OUT / ZERO ENCOLHIMENTO)
======================================================================
- A altura do corpo em pé (sola dos pés ao topo da cabeça/cabelo) DEVE permanecer entre 315 px e 340 px dentro de cada célula de 512x512 px em 100% dos frames (mesma estatura do `idle/frame_1.webp` anexado!).
- NUNCA reduza o tamanho do personagem ("zoom out") durante socos estendidos, chutes ou ultimates.
- Alinhe a sola dos pés na baseline y = 460 px.
- Safe Zone: mínimo 92 px livres acima da cabeça, 77 px nas laterais e 51 px na base, sempre em fundo magenta sólido #FF00FF.

======================================================================
3. TRAVA ESTRITA DE FIGURINO & FORMA (ZERO MISTURA DE FASES)
======================================================================
- Copie fielmente 100% das cores, roupas, cabelo, calça, faixa, tatuagens, asas, caudas ou marcas do `idle/frame_1.webp` de referência em TODOS os frames.
- PROIBIDO trocar roupa ou cabelo no meio da animação (sem calça preta em kimono branco, sem Luffy Base dentro do Gear 4, sem cabelo loiro no Naruto 4 Caudas, sem armadura/listras verdes aleatórias).

======================================================================
4. FORMATO TÉCNICO & TIMING SINCRONIZADO COM O MOTOR
======================================================================
- Imagem PNG em grid 3x2 exato (3 colunas x 2 linhas, células de 512x512 px, resolução exata 1536x1024 px).
- Fundo 100% sólido #FF00FF (RGB 255,0,255), SEM linhas divisórias, texto, sombra no chão ou vinheta.
- Personagem SEMPRE virado para a DIREITA.
- Células finais não usadas: preencher apenas com #FF00FF.
- Cadência e clímax sincronizados ao impacto do motor:
  * ataque_1 (12f / 2 folhas 3x2): Startup F1-F4 | Active (extensão/impacto) F5-F8 | Recovery F9-F12.
  * ataque_2 (15f / 3 folhas 3x2): Startup F1-F5 | Active (golpe forte amplo) F6-F10 | Recovery F11-F15.
  * ataque_3 (20f / 4 folhas 3x2): Startup (carga corporal limpa) F1-F8 | Active (extensão/disparo limpo) F9-F13 | Recovery F14-F20.
  * ataque_4 (40f / 7 folhas 3x2): Startup (preparação épica limpa, ~1.12s) F1-F21 | Active (clímax F22-F30 sustentando pose de lançamento/ataque limpa) | Recovery F31-F40.

======================================================================
5. LISTA EXATA DE REGENERAÇÃO POR PERSONAGEM (APLICAR CONFORME O ANEXO)
======================================================================
1) SON GOKU (`goku`):
   - `fase_1`: `ataque_3` (Kamehameha — postura das mãos sem esfera/feixe grande), `ataque_4` (Genki Dama — erguer braços sem esfera gigante + empurrar palmas sem feixe Kamehameha).
   - `fase_2`: `ataque_4` (Teletransporte Kamehameha — recuo com mãos na cintura -> giro -> extensão firme das mãos à frente sem nenhum feixe ciano na imagem).
   - `fase_3`: `ataque_2` (remover risco solto em F6 e unificar chute meteoro), `ataque_3` e `ataque_4` (Punho do Dragão — avanço em soco poderoso sem desenhar o dragão dourado nem feixes).
   - `fase_4`: `ataque_3` e `ataque_4` (aura prata/azul fina na pele, sem feixe ou ondas cobrindo a célula).

2) RYOMEN SUKUNA (`sukuna`):
   - `fase_1`: `ataque_4` (postura do Santuário selando as mãos, sem explosão vermelha tampando o corpo).
   - `fase_2` (CRÍTICO): `ataque_3` (Clivar — manter KIMONO TODO BRANCO em 100% dos frames, PROIBIDO calça preta), `ataque_4` (Fuga — apenas postura corporal puxando e soltando arco imaginário à direita, SEM arco gigante nem feixe de fogo desenhado na sprite).
   - `fase_3`: `ataque_3` e `ataque_4` (uniforme escuro Meguna fixo, sem rajadas grandes).
   - `fase_4` (Era Heian 4 braços): `ataque_3` e `ataque_4` (4 braços consistentes em estatura cheia ~334px, sem lança/explosão tampando o corpo).

3) MONKEY D. LUFFY (`luffy`):
   - `fase_1`: `ataque_2` (Muchi — sem encolher tronco durante o chute esticado), `ataque_4` (Red Hawk — punho em guarda/avanço sem chama gigante tampando o corpo).
   - `fase_3` (Snakeman — CRÍTICO): `ataque_3` e `ataque_4` (manter FORMA SNAKEMAN com cabelo escuro flamejante, fumaça nos ombros e braços com Haki em 100% dos frames — PROIBIDO voltar a Luffy Base de bermuda azul/chapéu; manter altura cheia ~316px).
   - `fase_4` (Gear 5 — CRÍTICO): regenerar `ataque_1`, `ataque_2`, `ataque_3` e `ataque_4` mantendo altura cheia ~328px em TODOS os frames (eliminar zoom-out de 212px!) e remover a rajada laranja da `ataque_3` F6-F13 (deixar só postura de agarrar/arremessar raio no vazio).

4) NARUTO UZUMAKI (`naruto`):
   - `fase_1`: `ataque_4` (sem Rasengan gigante tampando corpo).
   - `fase_2` (Quatro Caudas — CRÍTICO): `ataque_2`, `ataque_3` (MANTER pele vermelha de 4 caudas e PROIBIR cabelo loiro em F13-F18; remover cone sônico/anéis da boca em F8-F11) e `ataque_4` (Bijuu Dama — manter corpo consistente sem encolher para 180px e sem esfera/feixe desenhado fora da boca).
   - `fase_4` (Modo Bárion): `ataque_3` (sem encolher e sem bola explosiva externa) e `ataque_4`.

5) SASUKE UCHIHA (`sasuke`):
   - `fase_2`: `ataque_4` (remover armadura/torso roxo aleatório de F12).
   - `fase_3` (EMS): `ataque_1` (regenerar TODOS os 12 frames em estatura cheia ~335px e remover risco verde), `ataque_3` e `ataque_4` (Flecha Susano'o — só postura de mira/disparo limpa).
   - `fase_4` (CRÍTICO): `ataque_1`, `ataque_2`, `ataque_3` e `ataque_4` (ELIMINAR manchas/listras verdes do torso em todos os frames; em `ataque_4` Flecha de Indra, apenas postura de tensionar/soltar arco sem arco gigante nem raios cobrindo o corpo).

6) SEIYA DE PÉGASO (`seiya`):
   - `fase_2` (`ataque_4`), `fase_3` (`ataque_3` e `ataque_4` — corrigir encolhimento F13-F23 para altura cheia ~332px) e `fase_4` (`ataque_3` e `ataque_4`) — remover esferas, meteoros e lasers gigantes desenhados à frente do punho ou da espada Balmung.

7) INUYASHA (`inuyasha`):
   - `fase_1` (`ataque_2`, `ataque_4`), `fase_2` (`ataque_2`, `ataque_3`, `ataque_4`), `fase_3` (`ataque_2`, `ataque_4`) e `fase_4` (`ataque_3`, `ataque_4`) — eliminar espadas soltas/duplicadas em F9/F11, manter altura cheia ~320-335px e remover arcos/meias-luas gigantes da sprite do personagem.

8) TONY TONY CHOPPER (`chopper`):
   - `fase_2` (`ataque_2` — remover glitch azul nos chifres em F2), `fase_3` (`ataque_3` e `ataque_4` — remover feixes amarelos e anéis da palma em estatura cheia) e `fase_4` (Monster Point `ataque_3` Rugido Sísmico e `ataque_4` — remover feixe laranja saindo da boca em F7 e anéis gigantes).

9) RORONOA ZORO (`zoro`):
   - `fase_1` (`ataque_3` 72 Pound Cannon — remover Zoro minúsculo + anéis verdes gigantes em F7-F9; `ataque_4` sem tornado cobrindo corpo), `fase_2` (`ataque_4` Tatsumaki sem tornado tampando corpo), `fase_4` (`ataque_4` Jigoku no Ou — manter postura firme em estatura cheia ~302px sem desenhar cabeça de dragão verde tampando o corpo em F19-F20).
```

---

## PARTE B — PROMPT MESTRE PARA REGENERAR VFXs DETALHADOS E FIÉIS AOS GOLPES (`vfx_ataque_1..4`)

Use este prompt para substituir efeitos genéricos por **VFXs altamente detalhados, nítidos e 100% fiéis à assinatura visual de cada golpe**:

```text
Você é Lead VFX Artist de Jogos de Luta Anime 2D (nível Dragon Ball FighterZ / Guilty Gear Strive / Street Fighter 6 estilizado em Cel-Shading 2D).
Sua tarefa é REGENERAR as folhas de VFX ISOLADO (`vfx_ataque_1`, `vfx_ataque_2`, `vfx_ataque_3`, `vfx_ataque_4`) para o personagem indicado, elevando ao máximo o detalhamento, clareza de silhueta e fidelidade exata ao golpe oficial.

======================================================================
REGRAS TÉCNICAS OBRIGATÓRIAS DE VFX ISOLADO
======================================================================
- FORMATO: Grid exato 3x2 (1536x1024 px, células 512x512 px, leitura esquerda->direita cima->baixo).
- FUNDO: 100% Magenta sólido #FF00FF (RGB 255,0,255). SEM linhas de grade, textos ou bordas.
- ZERO PERSONAGEM: NÃO desenhe corpo, rosto, braços ou pernas dentro das células de VFX.
- SAFE ZONE RIGOROSA: O efeito inteiro DEVE caber com pelo menos 85 px livres de #FF00FF nos 4 lados (nunca toque as bordas da célula 512x512 px).
- DIREÇÃO: Todo projétil, corte, feixe ou onda de choque deve apontar e fluir da ESQUERDA para a DIREITA.
- CURVA TEMPORAL COERENTE (SEM FRAMES FINAIS FORA DE ORDEM):
  * vfx_ataque_1 (12f / 2 folhas): F1-F3 ignição rápida -> F4-F7 flash de impacto/corte preciso -> F8-F12 faíscas e dissipação limpa.
  * vfx_ataque_2 (15f / 3 folhas): F1-F4 acúmulo -> F5-F10 arco de impacto pesado/onda -> F11-F15 estilhaços e fumaça dissipando.
  * vfx_ataque_3 (20f / 4 folhas — Projétil / Especial): F1-F6 núcleo formando -> F7-F13 projétil ou onda em deslocamento nítido da esq. p/ dir. (loop limpo) -> F14-F17 explosão ao acertar -> F18-F20 fumaça suave sumindo até quase zero.
  * vfx_ataque_4 (40f / 7 folhas — Ultimate): F1-F12 acúmulo épico e núcleo -> F13-F28 forma principal do golpe (esfera, feixe, dragão, flecha ou ondas múltiplas) em máxima definição -> F29-F34 explosão climática -> F35-F40 APENAS fumaça/cinzas/fagulhas desacelerando até sumir (PROIBIDO colocar anéis ou flashes brilhantes depois da fumaça nos F37-F40!).
- QUALIDADE VISUAL: Traço nítido cel-shaded, múltiplas camadas de cor (núcleo branco puro + corpo vibrante + aura externa de alto contraste), faíscas dinâmicas e linhas de velocidade anime; evite borrões opacos sem forma.

======================================================================
CATÁLOGO OFICIAL DE IDENTIDADE VISUAL POR PERSONAGEM × GOLPE
======================================================================
1) GOKU:
   - Base (`fase_1`):
     * vfx_ataque_1..2: ondas de choque branco-azuladas de impacto marcial + vento radial.
     * vfx_ataque_3 (Kamehameha): esfera azul-ciano concentrada -> rajada Kamehameha horizontal com núcleo branco e anéis de pressão -> explosão azul esférica.
     * vfx_ataque_4 (Genki Dama): esfera colossal azul celeste com partículas/faíscas de energia convergindo -> globo massivo descendo/viajando -> domo de explosão celestial branco-azulado.
   - SSJ (`fase_2`):
     * vfx_ataque_3 (Super Kamehameha) & vfx_ataque_4 (Teletransporte Kamehameha): feixe Kamehameha super espesso azul-turquesa com faíscas douradas de SSJ orbitando ao redor do tubo de luz -> explosão em cúpula de choque dourada/azul.
   - SSJ3 (`fase_3`):
     * vfx_ataque_3 (Kamehameha Dourado): feixe dourado-âmbar com relâmpagos de SSJ3 entrelaçados.
     * vfx_ataque_4 (Punho do Dragão): espiral dourada -> cabeça e corpo detalhados de Shenlong dourado translúcido avançando para a direita com escamas luminosas e relâmpagos -> explosão dourada massiva em anel.
   - Instinto Superior (`fase_4`):
     * vfx_ataque_3..4: ondas de energia prateada/azul-gelo iridescente, múltiplos golpes invisíveis em arcos prateados ultravelozes, raios finos e explosão cósmica azul-prata.

2) SUKUNA:
   - 1-3 Dedos (`fase_1`):
     * vfx_ataque_1..2: impactos amaldiçoados carmesim/negros.
     * vfx_ataque_3 (Desmantelar): lâminas crescentes translúcidas vermelho-sangue e pretas voando em alta velocidade com rastro afiado.
     * vfx_ataque_4 (Santuário Incompleto): chuva densa em malha cruzada de centenas de cortes vermelhos e pretos fatiando toda a área + névoa escura.
   - 15 Dedos (`fase_2`):
     * vfx_ataque_3 (Clivar): retícula geométrica de cortes vermelhos cortando o alvo em grade X/+ super nítida.
     * vfx_ataque_4 (Flecha de Fogo - Fuga): chama giratória na ponta -> FLECHA DE FOGO hiper detalhada (haste incandescente branco-amarela com espiral laranja-carmesim voando da esq. p/ dir.) -> pilar explosivo infernal e nuvem de fogo em cogumelo.
   - Meguna (`fase_3`):
     * vfx_ataque_3..4: lâminas negras sombrias misturadas com tinta de sombra e relâmpago de Nue/eletricidade escura em cortes múltiplos.
   - Era Heian (`fase_4`):
     * vfx_ataque_3 (Corte do Mundo): rasgo dimensional branco-negro partindo o espaço em diagonal com distorção carmesim.
     * vfx_ataque_4 (Santuário Malevolente): tempestade extrema de cortes vermelhos/negros + explosão de fogo e crânios estilizados na fumaça infernal.

3) LUFFY:
   - Base (`fase_1`):
     * vfx_ataque_1..3: rastros cinéticos brancos de borracha esticada + anéis de ar comprimido no impacto do punho.
     * vfx_ataque_4 (Red Hawk): punho em chamas laranja-vermelhas deixando túnel de fogo espiralado -> explosão ígnea de impacto com faíscas e fumaça preta.
   - Boundman (`fase_2`):
     * vfx_ataque_1..4: ondas de ar comprimido branco-denso + relâmpagos de Haki do Rei vermelho-negro estalando em torno de onda de choque pesada.
   - Snakeman (`fase_3`):
     * vfx_ataque_1..4 (Jet Culverin / King Cobra): trajetória em zigue-zague/serpenteante super veloz vermelha e preta de Haki + choque explosivo final em onda escarlate.
   - Gear 5 (`fase_4`):
     * vfx_ataque_1..2: poeira e estrelas estilizadas cartoon brancas e Haki roxo-negro.
     * vfx_ataque_3 (Kaminari): relâmpago dourado-amarelo espesso em formato de raio cartoon zig-zag voando da esq. p/ dir. com estalos elétricos e onomatopeia visual abstrata.
     * vfx_ataque_4 (Bajrang Gun): nuvens brancas densas comprimidas -> onda colossal circular de Haki do Rei vermelho-negro e dourado esmagando o chão em terremoto sísmico.

4) NARUTO:
   - Normal (`fase_1`):
     * vfx_ataque_3..4 (Rasengan / Odama Rasengan): esfera de chakra azul turbilhonante com espirais internas concêntricas súper nítidas -> impacto em vórtice espiral expansivo.
   - Quatro Caudas (`fase_2`):
     * vfx_ataque_3 (Onda Sônica): anéis de pressão vermelho-carmesim escuros com chakra borbulhante lançados em cone frontal.
     * vfx_ataque_4 (Bijuu Dama): orbe denso negro-arroxeado com partículas roxas e vermelhas comprimindo -> esfera pesada voando com trilha gravitacional -> explosão maciça em domo roxo/vermelho dissipando em fumaça pura (SEM anéis vermelhos tardios nos últimos frames).
   - Manto Kurama (`fase_3`):
     * vfx_ataque_3 (Rasenshuriken): shuriken de 4 lâminas giratórias gigantes em vento branco-azulado com núcleo de Rasengan brilhante cortando o ar -> domo esférico de micro-cortes explosivos.
     * vfx_ataque_4 (Avatar Kurama): ondas massivas dourado-alaranjadas de chakra de raposa em rugido e explosão solar.
   - Modo Bárion (`fase_4`):
     * vfx_ataque_3..4: chamas nucleares carmesim-laranja pesadas, trilhas de caudas flamejantes e explosão densa vermelho-dourada.

5) SASUKE:
   - Base (`fase_1`):
     * vfx_ataque_2 (Chidori): pássaro/feixe de relâmpagos azuis-brancos crepitando com nítidos zigue-zagues elétricos.
     * vfx_ataque_3 (Katon): esfera/jato denso de fogo laranja-avermelhado rolando para a direita em redemoinho.
     * vfx_ataque_4 (Kirin): nuvem tempestuosa no topo -> dragão de relâmpagos azuis brilhantes descendo com fúria em descarga gigante vertical + explosão elétrica no solo.
   - Selo Nv.2 (`fase_2`):
     * vfx_ataque_3..4 (Chidori Senbon / Lamentação): chuva de agulhas elétricas violeta-negras + esfera negra de Chidori Lamentação com raios roxo-negros.
   - EMS (`fase_3`):
     * vfx_ataque_3 (Amaterasu): chamas negras sólidas com contornos carmesim/roxo queimando e se espalhando da esq. p/ dir.
     * vfx_ataque_4 (Flecha Susano'o): flecha etérea púrpura-escura flamejante com anéis espirais voando velozmente para a direita -> explosão púrpura-negra.
   - Susano'o Indra (`fase_4`):
     * vfx_ataque_3..4 (Chidori Onyx / Flecha de Indra): relâmpagos celestiais azul-elétrico e roxo-real + grande FLECHA DE INDRA formada de raios puros rasgando horizontalmente com explosão relampejante colossal.

6) SEIYA:
   - `fase_1`, `fase_2` e `fase_4`:
     * vfx_ataque_1..2: rajadas estelares azuis (`fase_1`), douradas (`fase_2`) ou branco-dourado celestial (`fase_4`).
     * vfx_ataque_3 (Meteoros de Pégaso): enxame paralelo de 8 a 14 feixes luminosos em formato de estrelas/cometas riscando da esq. p/ dir. -> múltiplos mini-impactos cintilantes.
     * vfx_ataque_4 (Cometa de Pégaso / Big Bang): núcleo estelar coalescendo em UM único cometa colossal com cauda de estrelas e anéis de pressão cósmica atravessando para a direita -> explosão cósmica radiante.
   - Odin Robe (`fase_3`):
     * vfx_ataque_3..4 (Espada de Balmung): cortes estreitos e precisos em azul-safira gelo nórdico + feixe cortante sagrado de Balmung com runas de luz estilhaçando no impacto.

7) INUYASHA:
   - `fase_1`: cortes rápidos carmesim-sangue (`Lâmina de Sangue`) + múltiplas garras cortantes cruzadas.
   - `fase_2` & `fase_3`: múltiplas lâminas curvas dourado-âmbar (`Ferida do Vento`) ou escarlate (`Tessaiga Carmesim`) em leque da esq. p/ dir. + tornado explosivo (`Onda Explosiva`).
   - `fase_4` (Daiyoukai - `Meidou Zangetsuha`): lâminas negras com borda violeta brilhante -> **LUA CRESCENTE NEGRA / VÓRTICE DIMENSIONAL (`Meidou`)** roxo-negro com estrelas distorcidas sugando e explodindo no impacto.

8) CHOPPER:
   - `fase_1..2` (`Kokutei Roseo`): ondas de choque de impacto rosa-fúcsia misturadas com dezenas de pétalas de cerejeira (sakura) nítidas desenhadas no pico da explosão.
   - `fase_3` (`Onda de Choque`): ondas concêntricas de pressão de ar amarelas/douradas + impacto marcial em espiral.
   - `fase_4` (`Rugido Sísmico` / `Palmeira Colossal`): ondas sonoras concêntricas alaranjado-carmesim expandindo para a direita + tremor de rochas estilizadas e fumaça pesada no solo.

9) ZORO:
   - `fase_1` & `fase_2`: cortes em meia-lua verde esmeralda extremamente afiados + rajada helicoidal dupla/tripla (`72/360 Pound Cannon`) + ciclone vertical cortante (`Tatsumaki`) girando com lâminas de vento.
   - `fase_3` (`Ashura`): cortes triplos simultâneos em roxo-demoníaco e verde-esmeralda criando névoa cortante.
   - `fase_4` (`King of Hell`): cortes verdes escuros envolvidos por chamas espessas verde-esmeralda e fumaça roxa-negra de Haki do Rei + cabeça estilizada de dragão verde de vento cortante na `vfx_ataque_4`.
```

