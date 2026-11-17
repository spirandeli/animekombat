#!/usr/bin/env python3
"""Pipeline helper to prepare chain-outpainting guides, extract 1280x1024 WebP segments,
and generate panoramic stitch previews for Beat 'em Up backgrounds."""

from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image, ImageDraw

TARGET_SEG_W = 1280
TARGET_SEG_H = 1024
GUIDE_W = 1536
GUIDE_H = 1024
ANCHOR_W = GUIDE_W - TARGET_SEG_W  # 256 px


def prepare_guide(prev_path: Path, out_path: Path, curb_y: int = 665) -> None:
    prev = Image.open(prev_path).convert("RGB")
    if prev.size != (TARGET_SEG_W, TARGET_SEG_H):
        prev = prev.resize((TARGET_SEG_W, TARGET_SEG_H), Image.Resampling.LANCZOS)

    guide = Image.new("RGB", (GUIDE_W, GUIDE_H))
    anchor = prev.crop((TARGET_SEG_W - ANCHOR_W, 0, TARGET_SEG_W, TARGET_SEG_H))
    guide.paste(anchor, (0, 0))

    # Extend the rightmost column horizontally across the remaining 1280px,
    # keeping sky top and sidewalk/floor (y >= 560) continuous while gently fading
    # mid-height objects (220..560) into sky blue so new landmarks have clean room.
    edge_col = prev.crop((TARGET_SEG_W - 1, 0, TARGET_SEG_W, TARGET_SEG_H))
    ext = edge_col.resize((TARGET_SEG_W, TARGET_SEG_H), Image.Resampling.BILINEAR)
    sky_sample = prev.getpixel((TARGET_SEG_W - 1, 140))
    ext_px = ext.load()
    fade_span = 160
    for x in range(TARGET_SEG_W):
        if x < fade_span:
            t = x / fade_span
        else:
            t = 1.0
        for y in range(200, 555):
            r, g, b = ext_px[x, y]
            ext_px[x, y] = (
                int(round(r * (1 - t) + sky_sample[0] * t)),
                int(round(g * (1 - t) + sky_sample[1] * t)),
                int(round(b * (1 - t) + sky_sample[2] * t)),
            )
    guide.paste(ext, (ANCHOR_W, 0))

    # Faint visual marker at x=ANCHOR_W is NOT drawn (would leak into art);
    # the natural horizon/curb smear guides the model directly.
    out_path.parent.mkdir(parents=True, exist_ok=True)
    guide.save(out_path, format="PNG")
    print(f"Prepared guide: {out_path} ({GUIDE_W}x{GUIDE_H}, anchor={ANCHOR_W}px)")


def extract_first_segment(src_path: Path, out_webp: Path) -> None:
    img = Image.open(src_path).convert("RGB")
    # Scale height to 1024 preserving aspect, then center-crop width to 1280
    scale = TARGET_SEG_H / img.height
    scaled_w = max(TARGET_SEG_W, int(round(img.width * scale)))
    img = img.resize((scaled_w, TARGET_SEG_H), Image.Resampling.LANCZOS)
    left = max(0, (scaled_w - TARGET_SEG_W) // 2)
    seg = img.crop((left, 0, left + TARGET_SEG_W, TARGET_SEG_H))

    out_webp.parent.mkdir(parents=True, exist_ok=True)
    seg.save(out_webp, format="WEBP", quality=90, method=6)
    print(f"Saved seg 1: {out_webp} ({seg.size[0]}x{seg.size[1]})")


def extract_chained_segment(
    src_path: Path, prev_webp: Path, out_webp: Path, blend_w: int = 36
) -> None:
    gen = Image.open(src_path).convert("RGB")
    if gen.size != (GUIDE_W, GUIDE_H):
        gen = gen.resize((GUIDE_W, GUIDE_H), Image.Resampling.LANCZOS)

    prev = Image.open(prev_webp).convert("RGB")
    if prev.size != (TARGET_SEG_W, TARGET_SEG_H):
        prev = prev.resize((TARGET_SEG_W, TARGET_SEG_H), Image.Resampling.LANCZOS)

    # Extract the new 1280px segment from x = ANCHOR_W..GUIDE_W
    seg = gen.crop((ANCHOR_W, 0, GUIDE_W, TARGET_SEG_H))

    # Seamless cross-fade at the left edge using the rightmost pixels of prev
    # and the corresponding anchor overlap columns in gen (x = ANCHOR_W - blend_w .. ANCHOR_W)
    #wait: gen[ANCHOR_W] continues from gen[ANCHOR_W - 1]. If gen kept the anchor faithful
    #except for slight color drift, compute average per-row/band tone match or feather
    #from prev's right edge into seg's left edge over a narrow band (e.g. 24px).
    if blend_w > 0:
        prev_edge = prev.crop((TARGET_SEG_W - blend_w, 0, TARGET_SEG_W, TARGET_SEG_H))
        seg_left = seg.crop((0, 0, blend_w, TARGET_SEG_H))

        # Match per-row average color shift on the seam so sky & floor stay seamless
        prev_px = prev_edge.load()
        gen_anchor_col = gen.crop((ANCHOR_W - 1, 0, ANCHOR_W, TARGET_SEG_H)).load()
        seg_px = seg.load()
        # Apply smooth vertical-band color-drift correction decaying over 120px
        corr_w = min(140, TARGET_SEG_W)
        for y in range(TARGET_SEG_H):
            pr, pg, pb = prev_px[blend_w - 1, y]
            gr, gg, gb = gen_anchor_col[0, y]
            dr, dg, db = pr - gr, pg - gg, pb - gb
            for x in range(corr_w):
                w = (1.0 - x / corr_w) ** 1.6
                sr, sg, sb = seg_px[x, y]
                nr = max(0, min(255, int(round(sr + dr * w * 0.65))))
                ng = max(0, min(255, int(round(sg + dg * w * 0.65))))
                nb = max(0, min(255, int(round(sb + db * w * 0.65))))
                seg_px[x, y] = (nr, ng, nb)

        # Feather blend first 16px from prev's mirrored right edge so exact boundary pixel matches
        fade_w = min(16, blend_w)
        seg_px = seg.load()
        for x in range(fade_w):
            alpha = (x + 1) / (fade_w + 1)
            src_x = blend_w - 1 - x
            for y in range(TARGET_SEG_H):
                pr, pg, pb = prev_px[src_x, y]
                sr, sg, sb = seg_px[x, y]
                seg_px[x, y] = (
                    int(round(pr * (1 - alpha) + sr * alpha)),
                    int(round(pg * (1 - alpha) + sg * alpha)),
                    int(round(pb * (1 - alpha) + sb * alpha)),
                )

    out_webp.parent.mkdir(parents=True, exist_ok=True)
    seg.save(out_webp, format="WEBP", quality=90, method=6)
    print(f"Saved chained seg: {out_webp} ({seg.size[0]}x{seg.size[1]})")


def make_preview(seg_paths: list[Path], out_jpg: Path) -> None:
    imgs = [Image.open(p).convert("RGB") for p in seg_paths]
    total_w = sum(im.width for im in imgs)
    h = imgs[0].height
    strip = Image.new("RGB", (total_w, h))
    cx = 0
    for im in imgs:
        strip.paste(im, (cx, 0))
        cx += im.width

    # Downscale to readable 3200px wide panoramic strip with seam tick marks at bottom
    scale = 3200 / total_w
    prev_h = max(128, int(round(h * scale)))
    preview = strip.resize((3200, prev_h), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(preview)
    cx = 0
    for idx, im in enumerate(imgs):
        sx = int(round(cx * scale))
        if idx > 0:
            draw.line([(sx, 0), (sx, 14)], fill=(250, 204, 21), width=2)
        draw.text((sx + 6, 4), f"S{idx + 1}", fill=(250, 204, 21))
        cx += im.width

    out_jpg.parent.mkdir(parents=True, exist_ok=True)
    preview.save(out_jpg, format="JPEG", quality=88)
    print(f"Saved panoramic preview: {out_jpg} ({preview.size[0]}x{preview.size[1]})")


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_guide = sub.add_parser("prepare-guide")
    p_guide.add_argument("prev_img", type=Path)
    p_guide.add_argument("out_guide", type=Path)
    p_guide.add_argument("--curb-y", type=int, default=665)

    p_first = sub.add_parser("extract-first")
    p_first.add_argument("src_img", type=Path)
    p_first.add_argument("out_webp", type=Path)

    p_chain = sub.add_parser("extract-chained")
    p_chain.add_argument("src_img", type=Path)
    p_chain.add_argument("prev_webp", type=Path)
    p_chain.add_argument("out_webp", type=Path)
    p_chain.add_argument("--blend", type=int, default=36)

    p_prev = sub.add_parser("preview")
    p_prev.add_argument("out_jpg", type=Path)
    p_prev.add_argument("segments", nargs="+", type=Path)

    args = parser.parse_args()
    if args.cmd == "prepare-guide":
        prepare_guide(args.prev_img, args.out_guide, args.curb_y)
    elif args.cmd == "extract-first":
        extract_first_segment(args.src_img, args.out_webp)
    elif args.cmd == "extract-chained":
        extract_chained_segment(args.src_img, args.prev_webp, args.out_webp, args.blend)
    elif args.cmd == "preview":
        make_preview(args.segments, args.out_jpg)


if __name__ == "__main__":
    main()

