#!/usr/bin/env node
/**
 * Suite de verificação automatizada (estática e de integridade) do modo Beat 'em Up.
 * Valida manifests, arquivos WebP/PNG em disco, dimensões, âncoras, ondas e build.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['src/game/BeatEmUpMap.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { BEAT_EM_UP_STAGES } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const sceneBuild = await build({ entryPoints: ['src/game/BeatEmUpScene.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { BeatEmUpScene } = await import(`data:text/javascript;base64,${Buffer.from(sceneBuild.outputFiles[0].text).toString('base64')}`);

const ROOT = path.resolve(import.meta.dirname, '..');
const PUB = path.join(ROOT, 'public');

const results = [];
function runCheck(name, fn) {
  try {
    const detail = fn();
    results.push({ name, status: 'PASS', detail: detail ?? 'OK' });
  } catch (err) {
    results.push({ name, status: 'FAIL', detail: err instanceof Error ? err.message : String(err) });
  }
}

const charManifest = JSON.parse(fs.readFileSync(path.join(PUB, 'assets/characters/manifest.json'), 'utf8'));
const beuManifest = JSON.parse(fs.readFileSync(path.join(PUB, 'assets/beatemup/manifest.json'), 'utf8'));

runCheck('1. BeatEmUp manifest possui 3 NPCs e 6 Bosses', () => {
  const npcKeys = Object.keys(beuManifest.npcs).sort();
  const bossKeys = Object.keys(beuManifest.bosses).sort();
  assert.deepEqual(npcKeys, ['npc_civil_brasil', 'npc_civil_vermelho', 'npc_politico']);
  assert.deepEqual(bossKeys, ['boss_flavio_bolsonaro', 'boss_lula', 'boss_nikolas_ferreira', 'boss_pablo_marcal', 'boss_pavanato', 'boss_sergio_moro']);
  return `npcs=${npcKeys.length}, bosses=${bossKeys.length}`;
});

runCheck('2. Todos os frames de NPCs e Bosses existem em disco e têm dimensões > 0', () => {
  let count = 0;
  for (const bucket of [beuManifest.npcs, beuManifest.bosses]) {
    for (const [id, ent] of Object.entries(bucket)) {
      for (const [act, frames] of [...Object.entries(ent.actions), ...Object.entries(ent.vfx)]) {
        assert.ok(frames.length > 0, `${id}.${act} sem frames`);
        for (const f of frames) {
          const full = path.join(PUB, f.src.replace(/^\//, ''));
          assert.ok(fs.existsSync(full), `Ausente: ${f.src}`);
          assert.ok(f.w > 0 && f.h > 0, `Dimensão inválida em ${f.src}`);
          assert.ok(f.anchorX >= 0 && f.anchorX <= f.w + 1, `anchorX fora em ${f.src}`);
          assert.ok(f.anchorY >= 0 && f.anchorY <= f.h + 1, `anchorY fora em ${f.src}`);
          count++;
        }
      }
    }
  }
  return `${count} frames validados`;
});

runCheck('3. Bosses possuem 13 ações e 4 VFX isolados cada', () => {
  const reqActs = [
    'idle', 'walk', 'dash', 'block', 'hitstun', 'knockdown', 'getup',
    'victory', 'ko_defeat', 'ataque_1', 'ataque_2', 'ataque_3', 'ataque_4',
  ];
  const reqVfx = ['vfx_ataque_1', 'vfx_ataque_2', 'vfx_ataque_3', 'vfx_ataque_4'];
  for (const [id, b] of Object.entries(beuManifest.bosses)) {
    for (const a of reqActs) assert.ok(b.actions[a]?.length === 6, `${id} ação ${a} != 6 frames`);
    for (const v of reqVfx) assert.ok(b.vfx[v]?.length === 6, `${id} vfx ${v} != 6 frames`);
  }
  return '6 bosses × (13 ações + 4 VFX) × 6 frames = 612 frames';
});

runCheck('4. Heróis jogáveis possuem ações Beat em Up essenciais (fase_1..fase_4)', () => {
  const reqHeroActs = [
    'idle', 'walk', 'run', 'dash', 'jump', 'land', 'air_ataque_1',
    'grab', 'throw', 'pickup', 'ataque_1', 'ataque_2', 'ataque_3', 'ataque_4',
    'block', 'hitstun', 'knockdown', 'getup', 'evolve', 'victory',
  ];
  let phasesChecked = 0;
  for (const [cid, c] of Object.entries(charManifest.characters)) {
    for (const [pk, p] of Object.entries(c.phases)) {
      for (const a of reqHeroActs) {
        assert.ok((p.actions[a]?.length ?? 0) > 0, `${cid}.${pk} sem ${a}`);
      }
      phasesChecked++;
    }
  }
  return `${phasesChecked} fases verificadas com todas as ${reqHeroActs.length} ações`;
});

runCheck('5. Seis mapas completos com oito trechos, ondas e boss correspondente', () => {
  assert.equal(BEAT_EM_UP_STAGES.length, 6);
  const ids = new Set();
  for (const stage of BEAT_EM_UP_STAGES) {
    assert.ok(!ids.has(stage.id));
    ids.add(stage.id);
    assert.equal(stage.segmentSrcs.length, 8);
    assert.equal(stage.segmentNames.length, 8);
    assert.equal(stage.worldWidth, stage.segmentWidth * 8);
    for (const src of [...stage.segmentSrcs, stage.thumbnailSrc]) {
      assert.ok(fs.existsSync(path.join(PUB, src)), `Background ausente: ${src}`);
    }
    const boss = beuManifest.bosses[stage.bossId];
    assert.ok(boss, `Boss ausente: ${stage.bossId}`);
    assert.equal(boss.stageId, stage.id);
    assert.equal(boss.name, stage.bossName);
    assert.equal(boss.title, stage.bossTitle);
    assert.equal(stage.waves.length, 8);
    let previousTrigger = -1;
    const waveIds = new Set();
    for (const [index, wave] of stage.waves.entries()) {
      assert.ok(!waveIds.has(wave.id));
      waveIds.add(wave.id);
      assert.ok(wave.triggerX > previousTrigger);
      previousTrigger = wave.triggerX;
      assert.ok(wave.lockMinX >= 0 && wave.lockMaxX <= stage.worldWidth + 0.001);
      assert.ok(wave.triggerX > wave.lockMinX && wave.triggerX < wave.lockMaxX);
      assert.equal(Boolean(wave.isBossWave), index === 7);
      for (const spawn of wave.spawns) {
        assert.ok(beuManifest.npcs[spawn.entityId] || beuManifest.bosses[spawn.entityId]);
        assert.ok(spawn.z >= stage.walkMinZ && spawn.z <= stage.walkMaxZ);
        if (spawn.isBoss) assert.equal(spawn.entityId, stage.bossId);
      }
      const drop = wave.dropPickupAfterClear;
      if (drop) {
        assert.ok(drop.x >= wave.triggerX && drop.x < wave.lockMaxX);
        assert.ok(drop.z >= stage.walkMinZ && drop.z <= stage.walkMaxZ);
      }
    }
    assert.equal(stage.waves[7].spawns.filter(s => s.isBoss).length, 1);
  }
  const server = fs.readFileSync(path.join(ROOT, 'server/gameServer.mjs'), 'utf8');
  const accepted = server.match(/VALID_BEU_STAGES = new Set\(\[([^\]]+)\]/)[1];
  for (const id of ids) assert.ok(accepted.includes(`'${id}'`), `Servidor rejeita ${id}`);
  return '48 cenários, 48 ondas, 6 bosses e seleção online verificados';
});

runCheck('6. Estados essenciais de NPCs e fallback de movimentação/recuperação', () => {
  const gaps = [];
  for (const [id, npc] of Object.entries(beuManifest.npcs)) {
    for (const action of ['idle', 'walk', 'hitstun', 'knockdown', 'ko_defeat', 'ataque_1', 'ataque_2']) {
      if (!npc.actions[action]?.length) gaps.push(`${id}:${action}`);
    }
  }
  for (const npc of Object.values(beuManifest.npcs)) {
    const actor = { enemyPack: { actions: new Map(Object.entries(npc.actions)) } };
    for (const action of ['run', 'getup', 'block']) {
      assert.ok(BeatEmUpScene.prototype.getActionFrames(actor, action).length > 0);
    }
  }
  assert.equal(gaps.length, 0, `Ações ausentes em NPCs: ${gaps.join(', ')}`);
  return 'OK';
});

let passed = 0;
let failed = 0;
for (const r of results) {
  if (r.status === 'PASS') passed++;
  else failed++;
  console.log(`[${r.status}] ${r.name} -> ${r.detail}`);
}
console.log(`\nResumo: ${passed} PASS, ${failed} FAIL`);
process.exitCode = failed > 0 ? 1 : 0;
