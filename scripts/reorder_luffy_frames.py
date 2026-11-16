#!/usr/bin/env python3
"""Audit-driven sprite sequence reorder & anchorX stabilization tool for Luffy.

Reads an audit specification JSON mapping every sequence in
`public/assets/characters/luffy/fase_{1..4}/{actions,vfx}` to:
  - `order`: 1-based source frame indices defining the target 1..N order
  - `anchorX_mode`: 'keep' | 'hip' | 'core_hip' | 'body_centroid'

Only `public/assets/characters/luffy/**` and `characters.luffy` inside
`public/assets/characters/manifest.json` are modified. `refBodyHeight`,
`refBodyWidth`, and all other characters remain untouched.
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Any

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MANIFEST = REPO_ROOT / "public" / "assets" / "characters" / "manifest.json"
DEFAULT_PUBLIC = REPO_ROOT / "public"


def compute_hip_cx(im: Image.Image) -> float:
    """Horizontal center of mass across waist/shorts/thigh rows (58%..78% height)."""
    w, h = im.size
    px = im.load()
    y0 = int(h * 0.58)
    y1 = max(y0 + 1, int(h * 0.78))
    xs = [x for y in range(y0, y1) for x in range(w) if px[x, y][3] > 24]
    if not xs:
        return round(w * 0.5, 1)
    return round(max(0.0, min(float(w), sum(xs) / len(xs))), 1)


def compute_core_hip_cx(im: Image.Image) -> float:
    """Hip/legs core centroid capped to body width so extended fists cannot bias anchorX."""
    w, h = im.size
    px = im.load()
    y0 = int(h * 0.58)
    y1 = max(y0 + 1, int(h * 0.85))
    xs = [x for y in range(y0, y1) for x in range(w) if px[x, y][3] > 24]
    if not xs:
        return round(w * 0.5, 1)
    sxs = sorted(xs)
    x_left = sxs[max(0, int(len(sxs) * 0.02))]
    cap_w = max(125.0, min(175.0, h * 0.58))
    core = [x for x in xs if x <= x_left + cap_w]
    if not core:
        return round(w * 0.5, 1)
    return round(max(0.0, min(float(w), sum(core) / len(core))), 1)


def compute_body_centroid_x(im: Image.Image) -> float:
    """Horizontal center of mass across all opaque pixels (best for prone/knockdown)."""
    w, h = im.size
    px = im.load()
    total_x = 0
    count = 0
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 24:
                total_x += x
                count += 1
    if count == 0:
        return round(w * 0.5, 1)
    return round(max(0.0, min(float(w), total_x / count)), 1)


def compute_median_hip_cx(im: Image.Image) -> float:
    """Trimmed hip/waist centroid (15th..85th percentile across 50%..78% height) immune to tails or extended attacks."""
    w, h = im.size
    px = im.load()
    y0 = int(h * 0.50)
    y1 = max(y0 + 1, int(h * 0.78))
    xs = [x for y in range(y0, y1) for x in range(w) if px[x, y][3] > 24]
    if not xs:
        return round(w * 0.5, 1)
    sxs = sorted(xs)
    lo = int(len(sxs) * 0.15)
    hi = max(lo + 1, int(len(sxs) * 0.85))
    core = sxs[lo:hi]
    return round(max(0.0, min(float(w), sum(core) / len(core))), 1)


def compute_anchor_x(im: Image.Image, current_ax: float, mode: str) -> float:
    if mode == "keep":
        return current_ax
    if mode == "hip":
        return compute_hip_cx(im)
    if mode == "core_hip":
        return compute_core_hip_cx(im)
    if mode == "median_hip":
        return compute_median_hip_cx(im)
    if mode == "body_centroid":
        return compute_body_centroid_x(im)
    raise ValueError(f"Unknown anchorX_mode: {mode}")


def process_character(
    manifest_path: Path,
    public_dir: Path,
    audit_path: Path,
    apply: bool,
    backup_path: Path | None,
    char_id: str = "luffy",
) -> int:
    with manifest_path.open("r", encoding="utf-8") as f:
        manifest: dict[str, Any] = json.load(f)
    with audit_path.open("r", encoding="utf-8") as f:
        audit: dict[str, dict[str, dict[str, Any]]] = json.load(f)

    if char_id not in manifest["characters"]:
        raise KeyError(f"Character '{char_id}' not found in manifest")
    char_data = manifest["characters"][char_id]
    orig_refs = {
        p: (pdata["refBodyHeight"], pdata["refBodyWidth"])
        for p, pdata in char_data["phases"].items()
    }

    if apply and backup_path is not None:
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        with backup_path.open("w", encoding="utf-8") as bf:
            json.dump(manifest, bf, indent=2, ensure_ascii=False)
        print(f"Saved pre-apply manifest backup to {backup_path}")

    seq_count = 0
    reordered_count = 0
    ax_updated_count = 0
    trimmed_count = 0
    planned: list[tuple[dict[str, Any], str, str, list[int], list[Path], list[dict[str, Any]]]] = []

    # Pass 1: validate all sequences and compute metadata before any disk writes
    for phase, pdata in char_data["phases"].items():
        if phase not in audit:
            raise KeyError(f"Audit JSON missing phase '{phase}'")
        for cat in ("actions", "vfx"):
            for seq, frames_meta in pdata[cat].items():
                seq_count += 1
                if seq not in audit[phase]:
                    raise KeyError(f"Audit JSON missing '{phase}/{seq}'")
                spec = audit[phase][seq]
                order: list[int] = spec["order"]
                ax_mode: str = spec.get("anchorX_mode", "keep")
                trim_ok: bool = bool(spec.get("trim_ok", False))
                n = len(frames_meta)

                if not order:
                    raise ValueError(f"{phase}/{seq}: audit order cannot be empty")
                if len(order) != n and not (trim_ok and len(order) < n):
                    raise ValueError(
                        f"{phase}/{seq}: audit order length {len(order)} != {n} (set trim_ok=true to drop frames)"
                    )
                if any(idx < 1 or idx > n for idx in order):
                    raise ValueError(f"{phase}/{seq}: order index out of range 1..{n}")

                is_identity_order = order == list(range(1, n + 1))
                if not is_identity_order:
                    reordered_count += 1
                if len(order) < n:
                    trimmed_count += 1

                src_files = [public_dir / fm["src"].lstrip("/") for fm in frames_meta]
                for sf in src_files:
                    if not sf.is_file():
                        raise FileNotFoundError(f"Missing frame file: {sf}")

                new_meta_list: list[dict[str, Any]] = []
                max_ax_delta = 0.0

                for new_idx, old_1idx in enumerate(order, start=1):
                    src_fm = frames_meta[old_1idx - 1]
                    src_file = src_files[old_1idx - 1]
                    new_fm = copy.deepcopy(src_fm)
                    old_rel = src_fm["src"]
                    target_name = f"frame_{new_idx}.webp"
                    new_fm["src"] = str(Path(old_rel).with_name(target_name))

                    with Image.open(src_file) as im:
                        rgba = im.convert("RGBA")
                        w_px, h_px = rgba.size
                        assert w_px == new_fm["w"] and h_px == new_fm["h"], (
                            f"Dimension mismatch on {src_file}: "
                            f"{(w_px, h_px)} vs {(new_fm['w'], new_fm['h'])}"
                        )
                        new_ax = compute_anchor_x(rgba, src_fm["anchorX"], ax_mode)

                    delta = abs(new_ax - src_fm["anchorX"])
                    if delta > max_ax_delta:
                        max_ax_delta = delta
                    new_fm["anchorX"] = new_ax
                    new_meta_list.append(new_fm)

                if max_ax_delta > 0.05:
                    ax_updated_count += 1

                if not is_identity_order or max_ax_delta > 15.0 or len(order) < n:
                    trim_note = f" trimmed={n}->{len(order)}" if len(order) < n else ""
                    print(
                        f"[{char_id}/{phase}/{seq:14s}] order_changed={str(not is_identity_order):5s} "
                        f"ax_mode={ax_mode:13s} max_ax_delta={max_ax_delta:5.1f}{trim_note}"
                    )

                planned.append((pdata, cat, seq, order, src_files, new_meta_list))

    # Pass 2: apply validated swaps to disk & manifest
    if apply:
        for pdata, cat, seq, order, src_files, new_meta_list in planned:
            seq_dir = src_files[0].parent
            tmp_dir = seq_dir / "_reorder_tmp"
            if tmp_dir.exists():
                shutil.rmtree(tmp_dir)
            tmp_dir.mkdir(parents=True, exist_ok=True)
            try:
                for new_idx, old_1idx in enumerate(order, start=1):
                    src_file = src_files[old_1idx - 1]
                    shutil.copy2(src_file, tmp_dir / f"frame_{new_idx}.webp")
                for sf in src_files:
                    if sf.exists():
                        sf.unlink()
                for new_idx in range(1, len(order) + 1):
                    shutil.move(
                        str(tmp_dir / f"frame_{new_idx}.webp"),
                        str(seq_dir / f"frame_{new_idx}.webp"),
                    )
            finally:
                if tmp_dir.exists():
                    shutil.rmtree(tmp_dir, ignore_errors=True)
            pdata[cat][seq] = new_meta_list

    # Verify refBodyHeight/Width invariant
    for phase, pdata in char_data["phases"].items():
        cur = (pdata["refBodyHeight"], pdata["refBodyWidth"])
        assert cur == orig_refs[phase], f"refBody mismatch on {char_id}/{phase}: {cur} != {orig_refs[phase]}"

    mode_label = "APPLIED" if apply else "DRY-RUN"
    print(
        f"\n{mode_label} ({char_id}): checked {seq_count} sequences | "
        f"reordered={reordered_count} | trimmed={trimmed_count} | anchorX_adjusted={ax_updated_count}"
    )

    if apply:
        tmp_manifest = manifest_path.with_suffix(".json.tmp")
        with tmp_manifest.open("w", encoding="utf-8") as mf:
            json.dump(manifest, mf, indent=2, ensure_ascii=False)
            mf.write("\n")
        os.replace(tmp_manifest, manifest_path)
        print(f"Updated {manifest_path}")

    return 0


process_luffy = process_character


def main() -> int:
    parser = argparse.ArgumentParser(description="Reorder character sprites from audit JSON.")
    parser.add_argument("--char", default="luffy", help="Character ID in manifest (default: luffy)")
    parser.add_argument(
        "--audit",
        type=Path,
        required=True,
        help="Path to <char>_sequence_audit.json",
    )
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--public", type=Path, default=DEFAULT_PUBLIC)
    parser.add_argument(
        "--backup",
        type=Path,
        default=None,
        help="Optional backup path for manifest.json before --apply",
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--dry-run", action="store_true", help="Validate without modifying files")
    group.add_argument("--apply", action="store_true", help="Apply frame reordering and manifest update")
    args = parser.parse_args()

    return process_character(
        manifest_path=args.manifest,
        public_dir=args.public,
        audit_path=args.audit,
        apply=args.apply,
        backup_path=args.backup,
        char_id=args.char,
    )


if __name__ == "__main__":
    sys.exit(main())
