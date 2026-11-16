#!/usr/bin/env python3
"""
Auditoria V2 & Saneamento de Escala / Timing / Arena do Anime Kombat.

Uso:
  python3 scripts/audit_v2_verification.py           # Somente leitura (valida tudo)
  python3 scripts/audit_v2_verification.py --apply   # Aplica correcao de refBodyHeight em manifest.json
"""

from __future__ import annotations

import argparse
import json
import re
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT / "public" / "assets" / "characters" / "manifest.json"
FIGHTER_TS = ROOT / "src" / "game" / "Fighter.ts"
ARENA_MAP_TS = ROOT / "src" / "game" / "ArenaMap.ts"

TARGET_BODY_HEIGHT = 186.0


def get_frames(pdata: dict, action: str) -> list[dict]:
    bucket = pdata.get("vfx" if action.startswith("vfx_") else "actions", {})
    entry = bucket.get(action, [])
    if isinstance(entry, dict):
        return entry.get("frames", [])
    return entry if isinstance(entry, list) else []


def simulate_normalized_scale(raw_h: float, ref_h: float, action: str) -> float:
    scale = TARGET_BODY_HEIGHT / max(100.0, ref_h)
    if action not in ("crouch", "knockdown", "getup", "jump", "pickup"):
        ratio = raw_h / max(100.0, ref_h)
        if ratio < 0.84:
            target_floor_h = ref_h * 0.88
            boost = min(1.38, max(1.0, target_floor_h / max(80.0, raw_h)))
            scale *= boost
    return scale


def check_manifest(apply_fix: bool) -> int:
    data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    chars = data["characters"]
    updated = []

    # Correcoes confirmadas de refBodyHeight onde idle era agachado
    expected_ref_overrides = {
        ("zoro", "fase_4"): 302,
        ("inuyasha", "fase_4"): 312,
    }

    if apply_fix:
        for (cname, pname), new_ref in expected_ref_overrides.items():
            pdata = chars.get(cname, {}).get("phases", {}).get(pname)
            if pdata and pdata.get("refBodyHeight") != new_ref:
                old_ref = pdata.get("refBodyHeight")
                pdata["refBodyHeight"] = new_ref
                updated.append(f"{cname}/{pname}: refBodyHeight {old_ref} -> {new_ref}")
        if updated:
            MANIFEST_PATH.write_text(
                json.dumps(data, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            print("Manifest atualizado:", ", ".join(updated))

    errors = 0
    low_stand_actions = []
    for cname, cdata in sorted(chars.items()):
        for pname, pdata in sorted(cdata["phases"].items()):
            ref_h = float(pdata.get("refBodyHeight", 0) or 0)
            if ref_h < 280 or ref_h > 360:
                print(f"[ERRO] {cname}/{pname} refBodyHeight fora do padrao: {ref_h}")
                errors += 1

            for act in ("idle", "walk", "ataque_1", "ataque_2", "ataque_3", "ataque_4"):
                frames = get_frames(pdata, act)
                if not frames:
                    print(f"[ERRO] {cname}/{pname}/{act} sem frames")
                    errors += 1
                    continue

                rendered_heights = []
                for f in frames:
                    raw_h = float(f.get("rawH") or f.get("h") or ref_h)
                    sc = simulate_normalized_scale(raw_h, ref_h, act)
                    rendered_heights.append(raw_h * sc)

                med_rendered = statistics.median(rendered_heights)
                ratio_target = med_rendered / TARGET_BODY_HEIGHT
                if ratio_target < 0.78 or ratio_target > 1.22:
                    low_stand_actions.append(
                        f"{cname}/{pname}/{act}: medRendered={med_rendered:.1f}px ({ratio_target:.2f}x)"
                    )

    print(f"Personagens auditados: {len(chars)} | Erros de manifesto/refH: {errors}")
    print(f"Acoes em pe fora de [0.78x..1.22x] apos compensacao runtime: {len(low_stand_actions)}")
    for line in low_stand_actions:
        print("  ", line)
    return errors


def check_engine_constants() -> int:
    errors = 0
    fighter_txt = FIGHTER_TS.read_text(encoding="utf-8")
    arena_txt = ARENA_MAP_TS.read_text(encoding="utf-8")

    # Confirma arena 1v1 expandida em ArenaMap.ts
    m_width = re.search(r"archetypeId:\s*'classic_duel'[\s\S]*?width:\s*(\d+)[\s\S]*?arenaLeft:\s*(\d+)[\s\S]*?arenaRight:\s*(\d+)", arena_txt)
    if not m_width:
        print("[ERRO] Nao foi possivel localizar configuracao classic_duel em ArenaMap.ts")
        errors += 1
    else:
        w, al, ar = int(m_width.group(1)), int(m_width.group(2)), int(m_width.group(3))
        print(f"Arena 1v1: width={w}, arenaLeft={al}, arenaRight={ar} (jogavel={ar - al}px)")
        if w < 1800 or (ar - al) < 1600:
            print("[ERRO] Arena 1v1 menor que o esperado (< 1800px)")
            errors += 1

    # Confirma timings calibrados em ATTACK_SPECS
    m_a4 = re.search(r"ataque_4:\s*\{[\s\S]*?activeStart:\s*([0-9.]+),\s*activeEnd:\s*([0-9.]+)", fighter_txt)
    if not m_a4:
        print("[ERRO] activeStart/activeEnd de ataque_4 nao encontrados em Fighter.ts")
        errors += 1
    else:
        a4_start = float(m_a4.group(1))
        a4_sec = a4_start * 2.0  # 40f @ 20fps = 2.00s
        print(f"Ultimate ataque_4 activeStart={a4_start} (~{a4_sec:.2f}s em 2.00s)")
        if a4_sec < 1.05 or a4_sec > 1.35:
            print("[ERRO] ataque_4 impact timing fora de [1.05s..1.35s]")
            errors += 1

    return errors


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Corrige refBodyHeight distorcidos no manifest.json")
    args = parser.parse_args()

    err = 0
    err += check_manifest(apply_fix=args.apply)
    err += check_engine_constants()
    if err > 0:
        raise SystemExit(1)
    print("OK: Auditoria V2 validada sem erros.")


if __name__ == "__main__":
    main()

