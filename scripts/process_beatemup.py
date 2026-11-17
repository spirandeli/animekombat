#!/usr/bin/env python3
"""Extractor & sanitizer for Beat 'em Up NPCs and Regional Bosses (3x2 sheets).

Reads:
  - spritesPersonagens/expandidos/npcs/*.zip
  - spritesPersonagens/expandidos/bosses/*.zip
  - spritesPersonagens/expandidos/new_bosses/*.zip

Outputs WebP frames and manifest to:
  - public/assets/beatemup/<entity_id>/fase_1/...
  - public/assets/beatemup/manifest.json
"""

from __future__ import annotations

import argparse
import concurrent.futures
import io
import json
import os
import re
import shutil
import sys
import zipfile
from collections import defaultdict
from pathlib import Path
from typing import Any

from PIL import Image

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import process_sprites_2x2 as p22  # noqa: E402
import reorder_luffy_frames as rlf  # noqa: E402

ROOT = SCRIPTS_DIR.parent
EXP_DIR = ROOT / "spritesPersonagens" / "expandidos"
PUBLIC_DIR = ROOT / "public"
OUT_DIR = PUBLIC_DIR / "assets" / "beatemup"
MANIFEST_PATH = OUT_DIR / "manifest.json"

SHEET_TAG_RE = re.compile(r"_(?:3x2|6frames)$", re.IGNORECASE)

NPC_METADATA: dict[str, dict[str, Any]] = {
    "npc_civil_brasil": {
        "name": "Brawler Camisa Brasil",
        "kind": "npc",
        "role": "brawler",
        "maxHp": 280,
        "speed": 175,
        "damageScale": 0.65,
        "auraColor": "#facc15",
        "scoreValue": 150,
    },
    "npc_civil_vermelho": {
        "name": "Brawler Camisa Vermelha",
        "kind": "npc",
        "role": "rusher",
        "maxHp": 320,
        "speed": 195,
        "damageScale": 0.72,
        "auraColor": "#ef4444",
        "scoreValue": 180,
    },
    "npc_politico": {
        "name": "Político da Pasta",
        "kind": "npc",
        "role": "heavy",
        "maxHp": 420,
        "speed": 145,
        "damageScale": 0.85,
        "auraColor": "#38bdf8",
        "scoreValue": 260,
    },
}

BOSS_METADATA: dict[str, dict[str, Any]] = {
    "boss_lula": {
        "name": "Presidente Lula",
        "title": "CHEFÃO DO PLANALTO",
        "stageId": "brasilia",
        "kind": "boss",
        "maxHp": 2600,
        "speed": 185,
        "damageScale": 1.0,
        "auraColor": "#ef4444",
        "scoreValue": 2000,
        "moves": {
            "ataque_1": "Combo Sindical",
            "ataque_2": "Investida Presidencial",
            "ataque_3": "Onda do Discurso",
            "ataque_4": "Fúria da Esplanada",
        },
    },
    "boss_pavanato": {
        "name": "Vereador Pavanato",
        "title": "CHEFÃO DO TERREIRO",
        "stageId": "pelourinho",
        "kind": "boss",
        "maxHp": 2400,
        "speed": 205,
        "damageScale": 0.95,
        "auraColor": "#38bdf8",
        "scoreValue": 1850,
        "moves": {
            "ataque_1": "Combo Retórico",
            "ataque_2": "Investida do Bonfim",
            "ataque_3": "Raio da Ladeira",
            "ataque_4": "Tempestade do Terreiro",
        },
    },
    "boss_flavio_bolsonaro": {
        "name": "Senador Flávio",
        "title": "CHEFÃO DO MARACANÃ",
        "stageId": "rio-de-janeiro",
        "kind": "boss",
        "maxHp": 2550,
        "speed": 190,
        "damageScale": 1.0,
        "auraColor": "#22c55e",
        "scoreValue": 1950,
        "moves": {
            "ataque_1": "Combo Executivo",
            "ataque_2": "Avanço blindado",
            "ataque_3": "Rajada Verde-Ouro",
            "ataque_4": "Impacto Maracanã",
        },
    },
}

BOSS_METADATA.update({
    "boss_nikolas_ferreira": {
        "name": "Dep. Nikolas Ferreira",
        "title": "CHEFÃO DO MINEIRÃO",
        "stageId": "belo-horizonte",
        "kind": "boss",
        "maxHp": 2550,
        "speed": 195,
        "damageScale": 1.0,
        "auraColor": "#FFC542",
        "scoreValue": 2000,
        "moves": {
            "ataque_1": "Trinca da Serra",
            "ataque_2": "Investida de Quartzo",
            "ataque_3": "Eco da Tribuna",
            "ataque_4": "Horizonte Dourado"
        }
    },
    "boss_pablo_marcal": {
        "name": "Pablo Marçal",
        "title": "CHEFÃO DO IPIRANGA",
        "stageId": "sao-paulo",
        "kind": "boss",
        "maxHp": 2450,
        "speed": 215,
        "damageScale": 0.98,
        "auraColor": "#00D9FF",
        "scoreValue": 2000,
        "moves": {
            "ataque_1": "Pulso Paulista",
            "ataque_2": "Arrancada da Avenida",
            "ataque_3": "Seta de Impulso",
            "ataque_4": "Pico da Paulista"
        }
    },
    "boss_sergio_moro": {
        "name": "Sérgio Moro",
        "title": "CHEFÃO DO JARDIM BOTÂNICO",
        "stageId": "curitiba",
        "kind": "boss",
        "maxHp": 2750,
        "speed": 175,
        "damageScale": 1.05,
        "auraColor": "#62E6AA",
        "scoreValue": 2100,
        "moves": {
            "ataque_1": "Tríplice Selo",
            "ataque_2": "Muralha de Jade",
            "ataque_3": "Selo de Curitiba",
            "ataque_4": "Círculo das Araucárias"
        }
    }
})

HIP_ANCHOR_ACTIONS = {"run", "dash"}
CORE_HIP_ANCHOR_ACTIONS = {"ataque_4"}
BODY_CENTROID_ANCHOR_ACTIONS = {"knockdown", "getup", "ko_defeat"}


def _find_magenta_grid_splits(im: Image.Image, cols: int = 3, rows: int = 2) -> tuple[list[int], list[int]]:
    """Find 3x2 grid splits around nominal boundaries using pure magenta as reference."""
    w, h = im.size
    rgb = im.convert("RGB")
    px = rgb.load()

    def is_fg(r: int, g: int, b: int) -> bool:
        # Non-magenta foreground (excludes both pure magenta and dark border lines if needed?
        # Actually, grid lines are dark, while inside cells near nominal +/- 16px there is magenta margin!)
        min_rb = r if r < b else b
        return (min_rb - g) < 80

    x_splits = [0]
    for c in range(1, cols):
        nom = (w * c) // cols
        lo = max(1, nom - 16)
        hi = min(w - 1, nom + 16)
        best_x = nom
        best_score = (10**9, 0)
        for x in range(lo, hi + 1):
            cnt = sum(1 for y in range(0, h, 4) if is_fg(*px[x, y]))
            score = (cnt, abs(x - nom))
            if score < best_score:
                best_score = score
                best_x = x
        # If nominal itself is purely dark divider line, stay close to nominal
        x_splits.append(best_x)
    x_splits.append(w)

    y_splits = [0]
    for r in range(1, rows):
        nom = (h * r) // rows
        lo = max(1, nom - 16)
        hi = min(h - 1, nom + 16)
        best_y = nom
        best_score = (10**9, 0)
        for y in range(lo, hi + 1):
            cnt = sum(1 for x in range(0, w, 4) if is_fg(*px[x, y]))
            score = (cnt, abs(y - nom))
            if score < best_score:
                best_score = score
                best_y = y
        y_splits.append(best_y)
    y_splits.append(h)

    return x_splits, y_splits


def _strip_outer_cell_grid_border(quad: Image.Image, depth: int = 5) -> Image.Image:
    """Clear 0..depth px grid divider/vignette border lines on cell edges before chroma-keying.

    Some generated 3x2 sheets (e.g., boss_pavanato) have dark anti-aliased grid lines
    (rgb ~(30..180, 0..25, 30..180)) right along cell boundaries (0..4px).
    Clearing edge rows/cols that look like uniform border lines prevents halo artifacts.
    """
    w, h = quad.size
    rgb = quad.convert("RGB")
    px = rgb.load()

    def is_border_pixel(r: int, g: int, b: int) -> bool:
        # Dark or dim-magenta border line pixel (not bright character art inside safe zone)
        return g < 40 and max(r, b) < 235

    def row_is_border(y: int) -> bool:
        hits = sum(1 for x in range(0, w, 4) if is_border_pixel(*px[x, y]))
        return hits / max(1, (w // 4)) >= 0.65

    def col_is_border(x: int) -> bool:
        hits = sum(1 for y in range(0, h, 4) if is_border_pixel(*px[x, y]))
        return hits / max(1, (h // 4)) >= 0.65

    out = quad.copy().convert("RGB")
    out_px = out.load()
    magenta = (255, 0, 255)

    for y in list(range(0, depth)) + list(range(h - depth, h)):
        if 0 <= y < h and row_is_border(y):
            for x in range(w):
                out_px[x, y] = magenta

    for x in list(range(0, depth)) + list(range(w - depth, w)):
        if 0 <= x < w and col_is_border(x):
            for y in range(h):
                out_px[x, y] = magenta

    # Always sanitize outermost 2px frame border to pure magenta so anti-aliased line stubs vanish
    for y in range(h):
        if y < 2 or y >= h - 2:
            for x in range(w):
                out_px[x, y] = magenta
        else:
            for x in (0, 1, w - 2, w - 1):
                out_px[x, y] = magenta

    return out


def _count_visible_pixels(rgba: Image.Image) -> int:
    alpha = rgba.getchannel("A").tobytes()
    return sum(1 for a in alpha if a > 20)


def collect_tasks() -> list[dict[str, Any]]:
    tasks: list[dict[str, Any]] = []
    sources: list[Path] = []
    for sub in ("npcs", "bosses", "new_bosses"):
        d = EXP_DIR / sub
        if d.exists():
            sources.extend(sorted(d.glob("*.zip")))

    for zp in sources:
        with zipfile.ZipFile(zp, "r") as zf:
            for name in sorted(zf.namelist()):
                if name.endswith("/"):
                    continue
                if not name.lower().endswith((".png", ".webp", ".jpg", ".jpeg")):
                    continue
                parts = [p for p in name.replace("\\", "/").split("/") if p]
                # Expected: spritesPersonagens/overrides/<entity_id>/fase_1/[vfx/]<seq>_3x2.png
                entity_id = None
                phase_idx = -1
                for i, part in enumerate(parts):
                    if part.lower() == "fase_1":
                        phase_idx = i
                        if i > 0:
                            entity_id = parts[i - 1].lower()
                        break
                if not entity_id or phase_idx < 0:
                    continue

                filename = parts[-1]
                stem = SHEET_TAG_RE.sub("", Path(filename).stem).lower()
                is_vfx = "vfx" in [p.lower() for p in parts[phase_idx + 1 : -1]] or stem.startswith("vfx_")
                tasks.append(
                    {
                        "entity_id": entity_id,
                        "phase_key": "fase_1",
                        "is_vfx": is_vfx,
                        "seq": stem,
                        "zip_path": str(zp),
                        "internal_path": name,
                    }
                )
    return tasks


def process_task(task: dict[str, Any]) -> dict[str, Any]:
    entity_id = task["entity_id"]
    phase_key = task["phase_key"]
    is_vfx = bool(task["is_vfx"])
    seq = task["seq"]

    if is_vfx:
        out_folder = OUT_DIR / entity_id / phase_key / "vfx" / seq
    else:
        out_folder = OUT_DIR / entity_id / phase_key / seq

    if out_folder.exists():
        shutil.rmtree(out_folder)
    out_folder.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(task["zip_path"], "r") as zf:
        raw_bytes = zf.read(task["internal_path"])

    frames_meta: list[dict[str, Any]] = []
    with Image.open(io.BytesIO(raw_bytes)) as im:
        im.load()
        x_splits, y_splits = _find_magenta_grid_splits(im, 3, 2)
        frame_idx = 0
        for r_idx in range(2):
            y_top, y_bot = y_splits[r_idx], y_splits[r_idx + 1]
            for c_idx in range(3):
                x_left, x_right = x_splits[c_idx], x_splits[c_idx + 1]
                quad = im.crop((x_left, y_top, x_right, y_bot))
                quad = _strip_outer_cell_grid_border(quad, depth=6)
                keyed, clipped_edges = p22.chroma_key_quad(quad, is_vfx)
                if not is_vfx:
                    keyed = p22._remove_bleed_islands(keyed, r_idx, c_idx, 2, 3)

                if _count_visible_pixels(keyed) < 16:
                    continue

                alpha_band = keyed.getchannel("A")
                mask = alpha_band.point(lambda p: 255 if p > 18 else 0)
                bbox = mask.getbbox()
                if not bbox:
                    continue

                pad = 2
                x0 = max(0, bbox[0] - pad)
                y0 = max(0, bbox[1] - pad)
                x1 = min(quad.width, bbox[2] + pad)
                y1 = min(quad.height, bbox[3] + pad)
                cropped = keyed.crop((x0, y0, x1, y1))

                if not is_vfx and (cropped.width < 16 or cropped.height < 20):
                    continue

                frame_idx += 1
                out_name = f"frame_{frame_idx}.webp"
                cropped.save(out_folder / out_name, "WEBP", quality=92, method=5)

                if is_vfx:
                    ax, ay = p22._compute_vfx_anchor(
                        cropped, bbox, x0, y0, quad.width, quad.height, seq
                    )
                else:
                    ay = round(float(bbox[3] - y0), 1)
                    if seq in BODY_CENTROID_ANCHOR_ACTIONS:
                        ax = rlf.compute_body_centroid_x(cropped)
                    elif seq in HIP_ANCHOR_ACTIONS:
                        ax = rlf.compute_hip_cx(cropped)
                    elif seq in CORE_HIP_ANCHOR_ACTIONS:
                        ax = rlf.compute_core_hip_cx(cropped)
                    else:
                        body_cx = p22._compute_body_center_x(cropped, quad.height)
                        ax = round(
                            max(cropped.width * 0.12, min(cropped.width * 0.88, body_cx)),
                            1,
                        )

                rel_src = "/" + (out_folder / out_name).relative_to(PUBLIC_DIR).as_posix()
                frames_meta.append(
                    {
                        "src": rel_src,
                        "w": cropped.width,
                        "h": cropped.height,
                        "quadW": quad.width,
                        "quadH": quad.height,
                        "bboxInQuad": [bbox[0], bbox[1], bbox[2], bbox[3]],
                        "cropOrigin": [x0, y0],
                        "rawW": bbox[2] - bbox[0],
                        "rawH": bbox[3] - bbox[1],
                        "clippedEdges": clipped_edges,
                        "anchorX": ax,
                        "anchorY": ay,
                    }
                )

    return {
        "entity_id": entity_id,
        "is_vfx": is_vfx,
        "seq": seq,
        "frames": frames_meta,
    }


def _compute_ref_size(actions: dict[str, list[dict[str, Any]]]) -> tuple[int, int]:
    sample = actions.get("idle") or actions.get("walk") or []
    if sample:
        ws = sorted(max(1, f["rawW"]) for f in sample)
        hs = sorted(max(1, f["rawH"]) for f in sample)
        quad_h = sample[0].get("quadH", 512)
        mid = len(hs) // 2
        return ws[mid], min(hs[mid], round(quad_h * 0.79)) if quad_h >= 420 else hs[mid]
    return 240, 350


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract Beat 'em Up NPC and Boss 3x2 spritesheets.")
    parser.add_argument("--workers", type=int, default=min(8, os.cpu_count() or 4))
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--entities", nargs="+", help="Process only these IDs, preserving other manifest entries")
    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        parser.error("Specify --dry-run or --apply")

    tasks = collect_tasks()
    if args.entities:
        tasks = [t for t in tasks if t["entity_id"] in args.entities]
        missing = set(args.entities) - {t["entity_id"] for t in tasks}
        if missing:
            parser.error(f"Entities without source sheets: {sorted(missing)}")
    print(f"Collected {len(tasks)} Beat 'em Up sheets across npcs/, bosses/ and new_bosses/")
    if args.dry_run:
        by_ent = defaultdict(int)
        for t in tasks:
            by_ent[t["entity_id"]] += 1
        print("Sheets per entity:", dict(sorted(by_ent.items())))
        return 0

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, Any]] = []
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers) as ex:
        for res in ex.map(process_task, tasks):
            results.append(res)

    grouped: dict[str, dict[str, dict[str, list[dict[str, Any]]]]] = defaultdict(
        lambda: {"actions": {}, "vfx": {}}
    )
    for res in results:
        cat = "vfx" if res["is_vfx"] else "actions"
        grouped[res["entity_id"]][cat][res["seq"]] = res["frames"]

    npcs: dict[str, Any] = {}
    bosses: dict[str, Any] = {}
    if args.entities and MANIFEST_PATH.exists():
        previous = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        npcs.update(previous["npcs"])
        bosses.update(previous["bosses"])

    for eid in sorted(grouped):
        acts = {k: grouped[eid]["actions"][k] for k in sorted(grouped[eid]["actions"])}
        vfxs = {k: grouped[eid]["vfx"][k] for k in sorted(grouped[eid]["vfx"])}
        ref_w, ref_h = _compute_ref_size(acts)

        if eid in BOSS_METADATA:
            meta = dict(BOSS_METADATA[eid])
            meta["id"] = eid
            meta["refBodyWidth"] = ref_w
            meta["refBodyHeight"] = ref_h
            meta["actions"] = acts
            meta["vfx"] = vfxs
            bosses[eid] = meta
        else:
            meta = dict(
                NPC_METADATA.get(
                    eid,
                    {
                        "name": eid,
                        "kind": "npc",
                        "role": "brawler",
                        "maxHp": 300,
                        "speed": 170,
                        "damageScale": 0.7,
                        "auraColor": "#facc15",
                        "scoreValue": 150,
                    },
                )
            )
            meta["id"] = eid
            meta["refBodyWidth"] = ref_w
            meta["refBodyHeight"] = ref_h
            meta["actions"] = acts
            meta["vfx"] = vfxs
            npcs[eid] = meta

    manifest = {
        "version": 1,
        "generatedAt": "beatemup-clean",
        "npcs": npcs,
        "bosses": bosses,
    }
    tmp_m = MANIFEST_PATH.with_suffix(".json.tmp")
    with tmp_m.open("w", encoding="utf-8") as mf:
        json.dump(manifest, mf, indent=2, ensure_ascii=False)
        mf.write("\n")
    os.replace(tmp_m, MANIFEST_PATH)

    total_frames = sum(len(r["frames"]) for r in results)
    clipped = sum(1 for r in results for f in r["frames"] if f["clippedEdges"])
    print(
        f"APPLIED: {len(results)} sheets | {total_frames} WebP frames | "
        f"npcs={list(npcs.keys())} | bosses={list(bosses.keys())} | clipped={clipped}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
