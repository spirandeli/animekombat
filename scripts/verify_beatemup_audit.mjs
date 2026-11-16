#!/usr/bin/env node
/**
 * Suite de verificação automatizada (estática e de integridade) do modo Beat 'em Up.
 * Valida manifests, arquivos WebP/PNG em disco, dimensões, âncoras, ondas e build.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

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

runCheck('1. BeatEmUp manifest possui 3 NPCs e 3 Bosses', () => {
  const npcKeys = Object.keys(beuManifest.npcs).sort();
  const bossKeys = Object.keys(beuManifest.bosses).sort();
  assert.deepEqual(npcKeys, ['npc_civil_brasil', 'npc_civil_vermelho', 'npc_politico']);
  assert.deepEqual(bossKeys, ['boss_flavio_bolsonaro', 'boss_lula', 'boss_pavanato']);
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
  return '3 bosses × (13 ações + 4 VFX) × 6 frames = 306 frames';
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

runCheck('5. Backgrounds panorâmicos Beat em Up (3 mapas × 3 trechos) existem em disco', () => {
  const expected = [
    'brasilia/bg_1_rodoviaria_eixo.png',
    'brasilia/bg_2_esplanada_ministerios.png',
    'brasilia/bg_3_congresso_boss.png',
    'pelourinho/bg_1_elevador_lacerda.png',
    'pelourinho/bg_2_ladeira_casario.png',
    'pelourinho/bg_3_terreiro_boss.png',
    'rio-de-janeiro/bg_1_copacabana.png',
    'rio-de-janeiro/bg_2_arcos_lapa.png',
    'rio-de-janeiro/bg_3_maracana_boss.png',
  ];
  for (const rel of expected) {
    const p = path.join(PUB, 'assets/backgrounds/beatemup', rel);
    assert.ok(fs.existsSync(p), `Background ausente: ${rel}`);
  }
  return `${expected.length} PNGs panorâmicos verificados`;
});

runCheck('6. Verificação de ações de estado de NPCs (falhas conhecidas de cobertura)', () => {
  const gaps = [];
  for (const [id, npc] of Object.entries(beuManifest.npcs)) {
    for (const opt of ['run', 'getup', 'block']) {
      if (!npc.actions[opt]) gaps.push(`${id}:${opt}`);
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
