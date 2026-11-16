#!/usr/bin/env python3
"""Extractor & pre-sanitizer for 3x2 `parte_*.png` sheets inside spritesPersonagens/expandidos/.

Supports zip path layouts across all expanded characters (including Inuyasha's
zip root without character prefix and Sasuke's split multi-zip packs), skips
empty `#FF00FF` cells accurately, applies anchorX stabilization policies proven
during the Luffy audit, preserves `luffy`, and writes `manifest.json` cleanly.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import copy
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
OUT_DIR = PUBLIC_DIR / "assets" / "characters"
MANIFEST_PATH = OUT_DIR / "manifest.json"

ALL_CANONICAL_ACTIONS = {
    "idle",
    "walk",
    "run",
    "dash",
    "jump",
    "land",
    "crouch",
    "block",
    "hitstun",
    "knockdown",
    "getup",
    "evolve",
    "ki_charge",
    "air_ataque_1",
    "grab",
    "throw",
    "pickup",
    "victory",
    "ataque_1",
    "ataque_2",
    "ataque_3",
    "ataque_4",
}
ALL_CANONICAL_VFX = {
    "vfx_ataque_1",
    "vfx_ataque_2",
    "vfx_ataque_3",
    "vfx_ataque_4",
}

HIP_ANCHOR_ACTIONS = {"run", "dash", "air_ataque_1"}
CORE_HIP_ANCHOR_ACTIONS = {"ataque_4"}
BODY_CENTROID_ANCHOR_ACTIONS = {"knockdown", "getup"}

PART_RE = re.compile(r"(?:^|_)parte_(\d+)$", re.IGNORECASE)
PHASE_RE = re.compile(r"^fase_([1-4])$", re.IGNORECASE)


def parse_expandido_entry(zip_path: Path, internal_path: str) -> dict[str, Any] | None:
    parts = [p for p in internal_path.replace("\\", "/").split("/") if p]
    if len(parts) < 3:
        return None
    filename = parts[-1]
    if not filename.lower().endswith((".png", ".webp", ".jpg", ".jpeg")):
        return None

    m_part = PART_RE.search(Path(filename).stem)
    if not m_part:
        return None
    part_num = int(m_part.group(1))

    phase_idx = -1
    for i, tok in enumerate(parts[:-1]):
        if PHASE_RE.match(tok):
            phase_idx = i
            break
    if phase_idx < 0:
        return None

    phase_key = parts[phase_idx].lower()
    char_id = zip_path.parent.name.lower()
    sub_parts = parts[phase_idx + 1 : -1]
    if not sub_parts:
        return None

    seq_name = sub_parts[-1].lower()
    is_vfx = "vfx" in [s.lower() for s in sub_parts] or seq_name.startswith("vfx_")
    if is_vfx:
        if seq_name not in ALL_CANONICAL_VFX:
            return None
    else:
        if seq_name not in ALL_CANONICAL_ACTIONS:
            return None

    return {
        "char_id": char_id,
        "phase_key": phase_key,
        "is_vfx": is_vfx,
        "seq": seq_name,
        "part_num": part_num,
        "zip_path": str(zip_path),
        "internal_path": internal_path,
    }


def collect_sequence_tasks(
    target_chars: set[str],
) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str, bool, str], list[dict[str, Any]]] = defaultdict(list)

    skipped: list[str] = []
    for char_dir in sorted(EXP_DIR.iterdir()):
        if not char_dir.is_dir():
            continue
        char_id = char_dir.name.lower()
        if char_id not in target_chars:
            continue
        zips = sorted(char_dir.glob("*.zip"))
        for zp in zips:
            with zipfile.ZipFile(zp, "r") as zf:
                for name in zf.namelist():
                    if name.endswith("/"):
                        continue
                    parsed = parse_expandido_entry(zp, name)
                    if parsed:
                        key = (
                            parsed["char_id"],
                            parsed["phase_key"],
                            parsed["is_vfx"],
                            parsed["seq"],
                        )
                        grouped[key].append(parsed)
                    elif name.lower().endswith((".png", ".webp", ".jpg", ".jpeg")):
                        skipped.append(f"{zp.name}:{name}")
    if skipped:
        print(f"WARNING: Skipped {len(skipped)} image entries: {skipped[:10]}", file=sys.stderr)

    tasks: list[dict[str, Any]] = []
    for (char_id, phase_key, is_vfx, seq), items in sorted(grouped.items()):
        items_sorted = sorted(items, key=lambda x: x["part_num"])
        tasks.append(
            {
                "char_id": char_id,
                "phase_key": phase_key,
                "is_vfx": is_vfx,
                "seq": seq,
                "parts": items_sorted,
            }
        )
    return tasks


def _count_visible_pixels(rgba: Image.Image) -> int:
    alpha = rgba.getchannel("A").tobytes()
    return sum(1 for a in alpha if a > 20)


def process_sequence_task(task: dict[str, Any]) -> dict[str, Any]:
    char_id = task["char_id"]
    phase_key = task["phase_key"]
    is_vfx = bool(task["is_vfx"])
    seq = task["seq"]
    parts = task["parts"]

    if is_vfx:
        out_folder = OUT_DIR / char_id / phase_key / "vfx" / seq
    else:
        out_folder = OUT_DIR / char_id / phase_key / seq

    tmp_folder = out_folder.parent / f"_tmp_{out_folder.name}"
    if tmp_folder.exists():
        shutil.rmtree(tmp_folder)
    tmp_folder.mkdir(parents=True, exist_ok=True)

    frames_meta: list[dict[str, Any]] = []
    frame_idx = 0

    try:
        # Keep open ZipFile cache per worker call
        zip_handles: dict[str, zipfile.ZipFile] = {}
        try:
            for part_item in parts:
                zp_str = part_item["zip_path"]
                if zp_str not in zip_handles:
                    zip_handles[zp_str] = zipfile.ZipFile(zp_str, "r")
                raw_bytes = zip_handles[zp_str].read(part_item["internal_path"])
                with Image.open(io.BytesIO(raw_bytes)) as im:
                    im.load()
                    x_splits, y_splits = p22._find_grid_splits(im, 3, 2)
                    for r_idx in range(2):
                        y_top, y_bot = y_splits[r_idx], y_splits[r_idx + 1]
                        for c_idx in range(3):
                            x_left, x_right = x_splits[c_idx], x_splits[c_idx + 1]
                            quad = im.crop((x_left, y_top, x_right, y_bot))
                            keyed, clipped_edges = p22.chroma_key_quad(quad, is_vfx)
                            if not is_vfx:
                                keyed = p22._remove_bleed_islands(keyed, r_idx, c_idx, 2, 3)

                            visible = _count_visible_pixels(keyed)
                            if visible < 16:
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

                            # Reject pure border noise (< 12px high/wide non-VFX remnant)
                            if not is_vfx and (cropped.width < 16 or cropped.height < 20):
                                continue

                            frame_idx += 1
                            out_name = f"frame_{frame_idx}.webp"
                            cropped.save(tmp_folder / out_name, "WEBP", quality=92, method=5)

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
        finally:
            for zf in zip_handles.values():
                zf.close()

        # Atomically replace target folder contents
        if out_folder.exists():
            shutil.rmtree(out_folder)
        out_folder.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(tmp_folder), str(out_folder))
    finally:
        if tmp_folder.exists():
            shutil.rmtree(tmp_folder, ignore_errors=True)

    return {
        "char_id": char_id,
        "phase_key": phase_key,
        "is_vfx": is_vfx,
        "seq": seq,
        "frames": frames_meta,
    }


def _compute_ref_size(actions: dict[str, list[dict[str, Any]]]) -> tuple[int, int]:
    idle = actions.get("idle", [])
    sample = idle[:6] if len(idle) >= 6 else idle
    if not sample:
        sample = actions.get("walk", [])[:6]
    if sample:
        ws = sorted(max(1, f["rawW"]) for f in sample)
        hs = sorted(max(1, f["rawH"]) for f in sample)
        quad_h = sample[0].get("quadH", 512)
        mid = len(hs) // 2
        ref_w = ws[mid]
        ref_h = min(hs[mid], round(quad_h * 0.79)) if quad_h >= 420 else hs[mid]
        return ref_w, ref_h
    return 260, 350


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract 3x2 expanded character sprite packs.")
    parser.add_argument(
        "--chars",
        nargs="+",
        default=None,
        help="Character IDs to process (default: all non-luffy folders with .zip in expandidos/)",
    )
    parser.add_argument("--include-luffy", action="store_true", help="Allow overwriting luffy")
    parser.add_argument("--workers", type=int, default=min(8, os.cpu_count() or 4))
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        parser.error("Specify --dry-run or --apply")

    available = sorted(
        d.name.lower()
        for d in EXP_DIR.iterdir()
        if d.is_dir() and list(d.glob("*.zip"))
    )
    if args.chars:
        target_chars = {c.lower() for c in args.chars}
    else:
        target_chars = set(available)
    if not args.include_luffy:
        target_chars.discard("luffy")

    missing = target_chars - set(available)
    if missing:
        print(f"ERROR: No zip sources found for: {sorted(missing)}", file=sys.stderr)
        return 1

    tasks = collect_sequence_tasks(target_chars)
    print(
        f"Collected {len(tasks)} sequence tasks across chars={sorted(target_chars)} "
        f"(total parts={sum(len(t['parts']) for t in tasks)})"
    )

    if args.dry_run:
        by_char = defaultdict(int)
        for t in tasks:
            by_char[t["char_id"]] += 1
        print("Sequences per char (dry-run):", dict(sorted(by_char.items())))
        return 0

    with MANIFEST_PATH.open("r", encoding="utf-8") as f:
        manifest = json.load(f)

    # Clean stale legacy directories (e.g. old synthesized ataque_X_up dirs) for target chars
    for ch in sorted(target_chars):
        ch_dir = OUT_DIR / ch
        if ch_dir.exists():
            shutil.rmtree(ch_dir)

    results: list[dict[str, Any]] = []
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers) as ex:
        for res in ex.map(process_sequence_task, tasks):
            results.append(res)

    by_cp: dict[tuple[str, str], dict[str, Any]] = defaultdict(
        lambda: {"actions": {}, "vfx": {}}
    )
    for res in results:
        key = (res["char_id"], res["phase_key"])
        cat = "vfx" if res["is_vfx"] else "actions"
        by_cp[key][cat][res["seq"]] = res["frames"]

    chars_map = manifest["characters"]
    for ch in sorted(target_chars):
        prev_char = copy.deepcopy(chars_map.get(ch, {}))
        display_name = prev_char.get("name") or p22.CHAR_DISPLAY_NAMES.get(ch, ch.capitalize())
        color_list = p22.PHASE_COLORS.get(ch, [("#38bdf8", f"Fase {i}") for i in range(1, 5)])

        new_phases: dict[str, Any] = {}
        for p_idx in range(1, 5):
            pk = f"fase_{p_idx}"
            prev_phase = prev_char.get("phases", {}).get(pk, {})
            aura, label = color_list[p_idx - 1]
            aura = prev_phase.get("auraColor", aura)
            label = prev_phase.get("label", label)

            prev_moves = prev_phase.get("moves", {})
            moves = {}
            for ak in ("ataque_1", "ataque_2", "ataque_3", "ataque_4"):
                moves[ak] = (
                    p22.MOVE_NAME_OVERRIDES.get((ch, p_idx, ak))
                    or prev_moves.get(ak)
                    or f"Golpe {ak[-1]}"
                )

            pack = by_cp[(ch, pk)]
            actions_sorted = {k: pack["actions"][k] for k in sorted(pack["actions"])}
            vfx_sorted = {k: pack["vfx"][k] for k in sorted(pack["vfx"])}
            ref_w, ref_h = _compute_ref_size(actions_sorted)

            new_phases[pk] = {
                "phase": p_idx,
                "key": pk,
                "label": label,
                "auraColor": aura,
                "refBodyHeight": ref_h,
                "refBodyWidth": ref_w,
                "moves": moves,
                "actions": actions_sorted,
                "vfx": vfx_sorted,
            }

        chars_map[ch] = {
            "id": ch,
            "name": display_name,
            "phases": new_phases,
        }

    tmp_m = MANIFEST_PATH.with_suffix(".json.tmp")
    with tmp_m.open("w", encoding="utf-8") as mf:
        json.dump(manifest, mf, indent=2, ensure_ascii=False)
        mf.write("\n")
    os.replace(tmp_m, MANIFEST_PATH)

    total_frames = sum(len(r["frames"]) for r in results)
    clipped_total = sum(1 for r in results for f in r["frames"] if f["clippedEdges"])
    print(
        f"APPLIED: {len(results)} sequences | {total_frames} frames extracted | "
        f"clipped={clipped_total} | manifest={MANIFEST_PATH}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
