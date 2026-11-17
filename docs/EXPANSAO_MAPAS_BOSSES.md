# Expansão de mapas e bosses — Ruas do Brasil

## Análise do projeto e ponto de retomada

O projeto é uma PWA em TypeScript/Vite, com renderização Canvas 2D. `main.ts`
coordena carregamento, cenas, menus, pausa e resultados. `ArenaScene`, `Fighter`,
`CombatSystem` e `AIController` atendem os modos de arena; `BeatEmUpScene` implementa
movimentação em profundidade, combate, ondas, pickups, IA dos bosses e cooperação.
Input, áudio, sprites e controles virtuais são compartilhados. `SaveManager` mantém
progresso local; `NetworkClient` e o servidor WebSocket gerenciam salas e sincronização.
O Vite integra o backend no desenvolvimento, e `server/prod.mjs` serve o build.

A árvore de trabalho já continha mudanças de combate, cooperação e interface.
Elas foram preservadas. A documentação da auditoria anterior descrevia um estado mais
antigo; por isso a integração foi baseada no código e nos manifests atuais.

O bloqueio da expansão estava em quatro pontos: o importador ignorava `new_bosses`,
os mapas e o renderizador limitavam-se a três trechos, a prévia usava sempre o terceiro
cenário, e o servidor aceitava apenas três cidades. A IA existente já utiliza os
sprites e parâmetros do manifest, incluindo quatro golpes, projéteis, VFX e fúria
abaixo de metade do HP; não era necessário duplicar essa lógica para os novos bosses.

## Conteúdo integrado

| Cidade | Boss | Arena final |
|---|---|---|
| Brasília | Presidente Lula | Congresso Nacional |
| Pelourinho | Vereador Pavanato | Terreiro de Jesus |
| Rio de Janeiro | Senador Flávio | Esplanada do Maracanã |
| Belo Horizonte | Dep. Nikolas Ferreira | Esplanada do Mineirão |
| São Paulo | Pablo Marçal | Museu do Ipiranga |
| Curitiba | Sérgio Moro | Jardim Botânico |

Cada cidade possui oito trechos em ordem, sete ondas comuns e uma onda final com boss.
Há recuperação de HP/Ki após as ondas 2, 4 e 7. Os cenários mantêm a proporção 16:9
dos arquivos originais e a arena final fica no oitavo trecho. Os seis mapas aparecem
na seleção solo e nas opções de sala; o servidor aceita os novos IDs.

Foram importados 48 backgrounds (~57,8 MiB) e 306 frames novos de bosses, totalizando
seis bosses com 13 ações e quatro VFX cada. As cores e nomes dos golpes novos seguem
as fichas presentes no ZIP. HP, velocidade e dano seguem a faixa dos bosses existentes.
O cache de backgrounds passa a comportar 80 entradas para acomodar a expansão.
Os cenários WebP usam cache de runtime: ficam disponíveis offline depois de carregados.

## Reprodução

```bash
python3 scripts/process_beatemup_backgrounds.py
python3 scripts/process_beatemup.py --apply --entities boss_nikolas_ferreira boss_pablo_marcal boss_sergio_moro --workers 3
node scripts/verify_beatemup_audit.mjs
npm run build
```

O filtro `--entities` preserva os frames e entradas de manifest dos demais inimigos,
incluindo correções anteriores. Os arquivos antigos de cenário foram mantidos.

Para o smoke test no navegador, com Playwright/Chromium disponíveis e Vite iniciado:

```bash
BEU_TEST_URL=http://127.0.0.1:5173 node scripts/verify_beatemup_browser.cjs
```

`PLAYWRIGHT_MODULE` permite apontar para uma instalação existente do Playwright.
O teste usa o menu real para selecionar mapas e iniciar o jogo. Depois cria uma cena
isolada com loaders, sprites, renderização e IA reais, percorre as oito ondas de cada
cidade e verifica golpes, fúria e vitória. As mortes são forçadas para tornar a
progressão determinística; isso não substitui uma avaliação de dificuldade por partida.

## Resultados da validação

- Build TypeScript/Vite/PWA aprovado.
- Auditoria automatizada: seis verificações aprovadas, nenhuma falha.
- Chromium: seis cards de seleção, prévias finais dos novos mapas e início solo aprovados.
- Chromium: progressão determinística das 48 ondas, quatro ataques/VFX de cada boss,
  fúria e vitória nos seis mapas aprovadas, sem erros JavaScript registrados.
- Sintaxe Python/Node e `git diff --check` aprovados.

## Limites da validação

A auditoria automatizada verifica arquivos, âncoras, ações, relação mapa/boss,
limites e ordem das ondas, pickups, whitelist do servidor e fallbacks reais dos NPCs.
A revisão visual incluiu amostras dos cenários e sprites processados. A qualidade
artística e a continuidade entre ilustrações seguem os assets fornecidos; não houve
regeneração de desenhos. Testes de latência entre dois dispositivos, balanceamento
de partidas completas e desempenho em celulares físicos continuam fora deste smoke test.
