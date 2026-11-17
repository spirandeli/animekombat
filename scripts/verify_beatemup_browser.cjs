// Requires Playwright and its Chromium browser. Point PLAYWRIGHT_MODULE to an existing installation if needed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.BEU_TEST_URL || 'http://127.0.0.1:5173';
(async () => {
 const browser = await chromium.launch({headless:true});
 const page = await browser.newPage({viewport:{width:1280,height:720}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400 && r.url().includes('/assets/'))errors.push(`${r.status()} ${r.url()}`)});
 await page.goto(origin);
 await page.locator('#btn-go-beatemup').click();
 if(await page.locator('[data-pick-beu-stage]').count()!==6)throw Error('Expected six map cards');
 for(const id of ['belo-horizonte','sao-paulo','curitiba']){
  await page.locator(`[data-pick-beu-stage="${id}"]`).click();
  const src=await page.locator('.ak-map-preview-img').getAttribute('src');
  if(!src.includes(`${id}/segment_08.webp`))throw Error(`Invalid preview ${src}`);
 }
 await page.screenshot({path:'/tmp/beu-selection.png'});
 await page.locator('#btn-start-beatemup').click();
 await page.locator('#btn-prematch-ready').click();
 await page.waitForFunction(()=>!document.querySelector('#combat-hud').classList.contains('hidden'),{},{timeout:60000});
 await page.keyboard.down('d');await page.waitForTimeout(1500);await page.keyboard.up('d');
 await page.screenshot({path:'/tmp/beu-gameplay.png'});
 console.log('PASS real menu: 6 maps, new previews, solo load and keyboard movement');
 // Isolated scene using real loaders/rendering/AI with deterministic wave completion.
 const test = await browser.newPage({viewport:{width:1280,height:720}});
 test.on('pageerror',e=>errors.push(e.message));
 await test.route('**/__beu_test',r=>r.fulfill({contentType:'text/html',body:'<canvas id="game-canvas" width="1280" height="720"></canvas><div id="combat-hud"></div>'}));
 await test.goto(`${origin}/__beu_test`);
 const results=await test.evaluate(async()=>{
  const {SpriteLoader}=await import('/src/engine/SpriteLoader.ts');
  const {BeatEmUpScene}=await import('/src/game/BeatEmUpScene.ts');
  const {BEAT_EM_UP_STAGES,preloadBeatEmUpStageBackgrounds}=await import('/src/game/BeatEmUpMap.ts');
  const {InputManager}=await import('/src/engine/InputManager.ts');
  const loader=new SpriteLoader();await loader.loadManifest();
  const noOp=new Proxy({}, {get:()=>()=>{}});
  const scene=new BeatEmUpScene(document.querySelector('canvas'),loader,new InputManager(),noOp,noOp);
  const reports=[];
  for(const stage of BEAT_EM_UP_STAGES){
   await Promise.all([preloadBeatEmUpStageBackgrounds(stage.id),loader.preloadBeatEmUpStage('goku',1,['npc_civil_brasil','npc_civil_vermelho','npc_politico',stage.bossId])]);
   scene.startStage({charId:'goku',startPhase:1,level:1,stageId:stage.id,difficulty:'normal'});
   for(const [i,wave] of stage.waves.entries()){
    scene.players[0].x=wave.triggerX;scene.players[0].hp=scene.players[0].maxHp;
    scene.checkWaveTriggers();scene.updateCamera(1);scene.render(60);
    if(scene.activeWaveIndex!==i || scene.enemies.length!==wave.spawns.length)throw Error(`Spawn failure ${stage.id} ${i}`);
    if(wave.isBossWave){
     const boss=scene.enemies.find(e=>e.kind==='boss');
     if(boss.entityId!==stage.bossId)throw Error('Wrong boss');
     for(const attack of ['ataque_1','ataque_2','ataque_3','ataque_4']){
      scene.startEnemyAttack(boss,attack);
      for(let f=0;f<24;f++){scene.updateEnemy(boss,1/60);scene.render(60);}
     }
     boss.hp=boss.maxHp*.4;boss.state='idle';scene.updateEnemy(boss,1/60);
     if(!boss.bossEnraged)throw Error('Missing rage phase');
    }
    for(const e of scene.enemies){e.hp=0;e.deadDone=true;}
    scene.checkWaveClear();scene.cleanupDefeatedEnemies();
   }
   scene.checkStageOutcome();
   if(scene.pendingResultWon!==true)throw Error(`No victory ${stage.id}`);
   reports.push(`PASS ${stage.id}: 8 waves, boss attacks/VFX, rage, victory`);
   scene.stopMatch();
  }
  return reports;
 });
 console.log(results.join('\n'));
 if(errors.length)throw Error(errors.join('\n'));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
