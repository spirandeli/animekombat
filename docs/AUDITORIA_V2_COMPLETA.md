# Auditoria V2 Completa — Todos os 9 Personagens (36 Fases)

Auditoria técnica e visual dos 9 personagens (`chopper`, `goku`, `inuyasha`, `luffy`, `naruto`, `sasuke`, `seiya`, `sukuna`, `zoro`), verificando:
1. **VFX embutido dentro das spritesheets do personagem** (feixes, bolas de energia, explosões e projéteis desenhados sobre o corpo).
2. **Glitches de figurino, forma e artefatos**.
3. **Distorções de escala (`rawH / refBodyHeight`)** causando encolhimento ou inflação em jogo.
4. **Classificação correta de cada `ataque_3` e `ataque_4` no motor** (Projétil Viajante, Feixe Contínuo ou Melee/AoE) e janelas de impacto.
5. **Ajustes de motor e Arena 1v1 estilo Street Fighter** aplicados no código.

---

## 1. Alterações de Motor & Arena Aplicadas no Código

| Componente | O que foi corrigido | Arquivo |
| :--- | :--- | :--- |
| **Ultimates de Projétil & Feixe** | Habilitado `isProjectile: true` + suporte a `projectileMode: 'projectile' \| 'beam'`, dimensões ampliadas (`148–158px`), feixe contínuo multi-hit (ex.: *Teletransporte Kamehameha* `goku/fase_2`, `goku/fase_4`), *Genki Dama* (`goku/fase_1`), *Fuga* (`sukuna/fase_2`, `fase_4`), *Bijuu Dama* (`naruto/fase_2`), *Flecha Susano'o / Indra* (`sasuke/fase_3..4`), *Cometa / Balmung* (`seiya/fase_1..4`), *Ferida / Meidou* (`inuyasha/fase_2..4`), *Kaminari* (`luffy/fase_4/ataque_3`). | [Fighter.ts](file:///home/spira/animekombat/src/game/Fighter.ts), [CombatSystem.ts](file:///home/spira/animekombat/src/engine/CombatSystem.ts), [AIController.ts](file:///home/spira/animekombat/src/game/AIController.ts) |
| **Timing de Impacto & Clímax** | Recalibradas janelas `activeStart / activeEnd`: `ataque_1` `0.34..0.62`, `ataque_2` `0.38..0.70`, `ataque_3` `0.44..0.72`, `ataque_4` (`2.00s`) `0.56..0.82` (**impacto/disparo em ~1.12s–1.20s**, e impulso melee adiado até ~1.0s em Ults físicas). | [Fighter.ts](file:///home/spira/animekombat/src/game/Fighter.ts) |
| **Normalização contra Encolhimento** | Compensação por frame em `computeNormalizedFrameScale()` para poses em pé com `rawH < 0.84 * refBodyHeight` (exceto `crouch`, `knockdown`, `getup`, `jump`, `pickup`), elevando até o piso `0.88 * refBodyHeight` (limite `1.38x`), além da correção de `refBodyHeight` em `zoro/fase_4` (`256 -> 302`) e `inuyasha/fase_4` (`284 -> 312`). | [Fighter.ts](file:///home/spira/animekombat/src/game/Fighter.ts), [manifest.json](file:///home/spira/animekombat/public/assets/characters/manifest.json) |
| **Arena 1v1 Estilo Street Fighter** | Arena clássica ampliada de `1280px` (`70..1210`) para **`2100px` (`80..2020`, +70% de área)**, spawns centrais simétricos (`790` e `1310`), câmera rolável dinâmica de canto a canto, `parallaxPad: 1.24` no cenário e trava de separação máxima `1020px` no 1v1. | [ArenaMap.ts](file:///home/spira/animekombat/src/game/ArenaMap.ts), [ArenaScene.ts](file:///home/spira/animekombat/src/game/ArenaScene.ts), [Fighter.ts](file:///home/spira/animekombat/src/game/Fighter.ts) |

---

## 2. Diagnóstico Completo por Personagem (Todos os 9 × 4 Fases)

### 1) Son Goku (`goku`)
- **`fase_1` (Base, `refH=330`):**
  - `ataque_3` (*Kamehameha*): `F8–F12` com esfera/cone de energia grande embutido no punho (`F12` encostando na borda). `vfx_ataque_3` possui feixe separado `F7–F13`. -> **Regenerar `ataque_3` sem esfera grande.**
  - `ataque_4` (*Genki Dama* / Ultimate): `F1–F12` seguram Genki Dama gigante, depois `F19–F27` disparam feixe horizontal Kamehameha gigante dentro da sprite do Goku + `F28` clarão. Motor configurado como **Projétil Gigante (`speed=430, 158x158`)**. -> **Regenerar `ataque_4` limpo (sem feixe/Genki gigante embutida).**
- **`fase_2` (Super Saiyajin, `refH=331`):**
  - `ataque_4` (*Teletransporte Kamehameha*): `F15–F27` contêm feixe Kamehameha ciano + explosão branca embutidos no corpo. Motor configurado como **Feixe Contínuo (`beamRange=880, duration=0.68s`)** usando `vfx_ataque_4` (que possui feixes horizontais `F13–F23`). -> **Regenerar `ataque_4` limpo.**
- **`fase_3` (Super Saiyajin 3, `refH=335`):**
  - `ataque_2`: `F6` tem fragmento flutuante à esquerda; `F9–F11` trocam chute por esmagamento com energia/poeira. -> **Revisar/regenerar `ataque_2`.**
  - `ataque_3`: `F8–F14` disparam feixe dourado embutido saindo da imagem. -> **Regenerar `ataque_3` limpo.**
  - `ataque_4` (*Punho do Dragão*): `F4–F8` desenham cabeça/corpo do dragão dourado direto na sprite enquanto `vfx_ataque_4` já possui o dragão separado (`F2–F16`). -> **Regenerar `ataque_4` sem dragão colado no corpo.**
- **`fase_4` (Instinto Superior, `refH=337`):**
  - `ataque_3`: `F9–F14` feixe azul Kamehameha embutido. -> **Regenerar `ataque_3` limpo.**
  - `ataque_4`: `F14–F22` ondas/choques embutidos (`min=237px` pontual); motor configurado como **Feixe Contínuo (`beamRange=820`)**. -> **Regenerar `ataque_4` limpo.**

### 2) Ryomen Sukuna (`sukuna`)
- **`fase_1` (1-3 Dedos, `refH=326`):**
  - `ataque_4`: `F12–F17` explosão e cortes vermelhos pesados sobre o corpo. -> **Regenerar `ataque_4` limpo.**
- **`fase_2` (15 Dedos, `refH=332`):**
  - `ataque_3` (*Clivar*): **Glitch crítico de figurino em `F8–F12`** — Sukuna aparece com **calça hakama preta** em vez do kimono todo branco (`F1–F7` e `F13–F20`). -> **Regenerar `ataque_3` obrigatório.**
  - `ataque_4` (*Flecha de Fogo — Fuga*): `F5–F24` desenham arco flamejante gigante + flecha + rajada de fogo direto na sprite, duplicando `vfx_ataque_4` (`F3–F14` flechas de fogo). Motor configurado como **Projétil Grande (`speed=690, 150x112`)**. -> **Regenerar `ataque_4` limpo (apenas postura de arco sem VFX).**
- **`fase_3` (Meguna, `refH=323`):**
  - `ataque_3`: `F11–F13` rajada vermelha/sangue embutida; `ataque_4`: `F26–F28` rajada sombria. -> **Regenerar `ataque_3..4` limpos.**
- **`fase_4` (Era Heian, `refH=334`):**
  - `ataque_3`: `F4–F14` anéis/cortes embutidos; `ataque_4`: `F22–F26` lança flamejante/rajada embutida + 6 frames `<0.78x` (`min=204px`). Motor configurado com `isProjectile: true` na `ataque_4` acompanhando o `vfx_ataque_4` (`F19–F23` lança/flecha). -> **Regenerar `ataque_4` limpo.**

### 3) Monkey D. Luffy (`luffy`)
- **`fase_1` (Base, `refH=326`):**
  - `ataque_2`: `F5–F12` comprimidos (`231–252px`, `0.71x`). Compensado em runtime; **regenerar `ataque_2` em estatura cheia.**
  - `ataque_4` (*Red Hawk*): `F11–F30` fogo intenso embutido no braço/corpo. -> **Regenerar `ataque_4` com fogo mínimo no punho.**
- **`fase_2` (Boundman, `refH=325`):**
  - `ataque_2`: `F6–F10` comprimidos (`231–240px`, `0.71–0.74x`). -> **Compensado em runtime.**
- **`fase_3` (Snakeman, `refH=316`):**
  - **Glitch crítico de figurino:** em `ataque_3` **F6 e F14**, e em `ataque_4` **F7–F10 e F27–F28**, Luffy volta ao **traje da Fase Base** (bermuda azul, faixa amarela, sem forma Snakeman). Além disso `ataque_4` `F18–F26` encolhe (`226–240px`, `0.72–0.76x`). -> **Regenerar `ataque_3` e `ataque_4` obrigatórios.**
- **`fase_4` (Gear 5, `refH=328`):**
  - **Encolhimento severo generalizado:** `ataque_1` (**12/12 frames** `212–236px`, `0.65–0.72x`); `ataque_2` (**F1–F12** `212–228px`, `0.65–0.70x`); `ataque_3` (**F8–F13** `244–259px`, `0.74–0.79x` **com rajada laranja/amarela tipo feixe embutida nas mãos!**); `ataque_4` (**20/40 frames F13–F30** `201–253px`, `0.61–0.77x` com raios/chamas no punho gigante). -> **Compensado em runtime agora + Regenerar `ataque_1..4` de Gear 5 obrigatórios.**

### 4) Naruto Uzumaki (`naruto`)
- **`fase_1` (Normal, `refH=331`):** `ataque_4` `F5–F6` e `F15–F18` Rasengan grande + ondas embutidas (3f `<0.78x`).
- **`fase_2` (Quatro Caudas, `refH=322`):**
  - `ataque_2`: `F9–F12` encolhidos (`178–213px`, `0.55–0.66x`).
  - `ataque_3`: `F8–F11` disparam cone/anéis sônicos vermelhos embutidos + **GLITCH F13–F18 (cabelo loiro humano sobre o corpo vermelho Quatro Caudas!)**. -> **Regenerar `ataque_3` obrigatório.**
  - `ataque_4` (*Bijuu Dama*): **27/40 frames encolhidos** (`181–256px`, `0.56x`) + esfera e feixe Bijuu Dama embutidos em `F5–F20`. `vfx_ataque_4` possui anéis vermelhos tardios `F37–F40` após a fumaça `F31–F36`. Motor configurado como **Projétil Gigante (`152x152`)**. -> **Regenerar `ataque_2`, `ataque_4` e `vfx_ataque_4`.**
- **`fase_3` (Manto Kurama, `refH=324`):** altura estável; `ataque_3` `F9` solta rastro; `ataque_4` `F14–F18` ondas.
- **`fase_4` (Modo Bárion, `refH=310`):** `ataque_3` `F7–F12` encolhem (`183–213px`, `0.59–0.68x`) com bola de fogo externa (`F11–F12`); `ataque_4` `F10–F18` explosões embutidas. -> **Regenerar `ataque_3..4`.**

### 5) Sasuke Uchiha (`sasuke`)
- **`fase_1` (Sharingan 3T, `refH=328`):** `ataque_3` limpo; `ataque_4` (*Kirin*) `F15–F29` raios em volta do corpo.
- **`fase_2` (Selo Amaldiçoado, `refH=335`):** `ataque_4` tem **glitch F12 (torso/cabelo com aura roxa de Susano'o)**; `vfx_ataque_3` tem `F18–F20` anéis escuros residuais.
- **`fase_3` (EMS, `refH=335`):**
  - `ataque_1`: **10/12 frames encolhidos** (`208–267px`, `0.62–0.76x`) + `F6` risco verde.
  - `ataque_3` (*Amaterasu*): `F8–F11` chamas negras/vermelhas embutidas; `ataque_4` (*Flecha Susano'o*): **Projétil (`speed=740, 152x108`)**, `F16–F22` energia embutida. -> **Regenerar `ataque_1`, `ataque_3`, `ataque_4`.**
- **`fase_4` (Susano'o Indra, `refH=325`):**
  - **Glitch de listras verdes no torso** em `ataque_1` (`F4/F8`), `ataque_2` (`F2/F4/F14/F15`), `ataque_3` (`F2/F4/F13/F14`) e `ataque_4` (`F2`).
  - `ataque_4` (*Flecha de Indra*): **Projétil (`speed=740, 152x108`)**; `F5–F25` desenham arco + flecha elétrica + explosões cobrindo a sprite. -> **Regenerar `fase_4` `ataque_1..4` (ou corrigir textura do torso + remover arco gigante de `ataque_4`).**

### 6) Seiya de Pégaso (`seiya`)
- **`fase_1` (`refH=320`):** `ataque_3` `F8–F12` rajadas no punho; `ataque_4` *Cometa* (`isProjectile: true, 148x120`) `F5–F16` rajadas.
- **`fase_2` (`refH=327`):** `ataque_3` `F7–F13` contorno amarelo espesso; `ataque_4` `F9–F17` bolas/feixes dourados gigantes cobrindo o punho. -> **Regenerar `ataque_4` limpo.**
- **`fase_3` (Odin Robe, `refH=332`):** `ataque_3` `F10–F15` feixes pela espada; `ataque_4` (*Espada de Balmung*, `isProjectile: true`) `F7–F20` aura/laser embutido + **encolhimento `F13–F23` (`202–248px`, `0.61x`)**. -> **Regenerar `ataque_3..4`.**
- **`fase_4` (Kamui Divina, `refH=337`):** `ataque_3` `F3–F13` e `ataque_4` `F10–F20` esferas/rajadas douradas no punho. -> **Regenerar `ataque_3..4` limpos.**

### 7) Inuyasha (`inuyasha`)
- **`fase_1` (`refH=330`):** `ataque_2` encolhido (`222–271px`, `F11` lâmina solta à esquerda); `ataque_4` `F15–F27` ondas/explosões vermelhas + encolhido (`min=229px`).
- **`fase_2` (`refH=333`):** `ataque_2` `F8–F11` encolhidos (`216–243px`, `F9` espada duplicada, `F11` ponta solta); `ataque_3` `F3–F11` chamas; `ataque_4` `F5–F23` arcos amarelos gigantes + encolhido (`isProjectile: true`).
- **`fase_3` (`refH=314`):** `ataque_2` `F6–F11` encolhidos; `ataque_3` `F3–F6`; `ataque_4` `F7–F22` arcos de fogo (`isProjectile: true`).
- **`fase_4` (`refH=284 -> 312`):** `refBodyHeight` corrigido no manifesto (`walk=337.5, victory=321`); `ataque_3` e `ataque_4` (*Meidou Zangetsuha*, `isProjectile: true`) possuem meias-luas negras embutidas (`F10–F20`). -> **Regenerar `ataque_1..4` de F1–F2 e `ataque_3..4` de F3–F4.**

### 8) Tony Tony Chopper (`chopper`)
- **`fase_1` (`refH=337`):** `ataque_3` *Rumble Shot* `F8–F11` esfera; `ataque_4` `F18–F24` ondas verde-brancas + `F13–F22` redução (`min=248px`).
- **`fase_2` (`refH=336`):** `ataque_2` `F2` glitch azul nos chifres; `ataque_3` (*Impacto Sísmico*, `isProjectile: false`) golpe de chão; `ataque_4` `F16–F28` feixes/anéis embutidos.
- **`fase_3` (`refH=339`):** `ataque_3` (*Onda de Choque*) `F7–F8` anéis/feixes amarelos gigantes nas mãos; `ataque_4` `F20–F21` rajada + `min=229px`. -> **Regenerar `ataque_3..4`.**
- **`fase_4` (`refH=345`):** `ataque_3` (*Rugido Sísmico*) `F4–F8` anéis + **feixe laranja saindo da boca na sprite**; `ataque_4` `F10–F14` onda na palma. -> **Regenerar `ataque_3` e `ataque_4` limpos.**

### 9) Roronoa Zoro (`zoro`)
- **`fase_1` (`refH=327`):** `ataque_3` (*72 Pound Cannon*) `F7–F9` anéis verdes gigantes embutidos com Zoro encolhido (`215–238px`); `ataque_4` tornado verde cobrindo o corpo + encolhimento (`min=199px`). -> **Regenerar `fase_3..4`.**
- **`fase_2` (`refH=325`):** `ataque_4` (*Tatsumaki*) tornado denso cobrindo F7–F23 + redução (`min=197px`).
- **`fase_3` (`refH=318`):** razoável, cortes verdes integrados; `ataque_4` `min=208px`.
- **`fase_4` (`refH=256 -> 302`):** `refBodyHeight` corrigido no manifesto para impedir inflação de `1.25x`; `ataque_4` (*Jigoku no Ou: Dragon*) tem **cabeça de dragão verde + rajada embutida na sprite (`F19–F20`)**. -> **Regenerar `ataque_4` limpo.**

