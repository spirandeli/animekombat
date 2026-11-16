#!/usr/bin/env python3
"""
Processa spritesheets 2x2 de menu (gerados por IA externa) em raw_menu_sprites/
e exporta PNGs transparentes padronizados + menu-manifest.json em
public/assets/hud/characters/.

Uso:
  python3 scripts/process_menu_sprites.py
"""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path
from typing import Optional

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "raw_menu_sprites"
OUT_DIR = ROOT / "public" / "assets" / "hud" / "characters"
MANIFEST_PATH = OUT_DIR / "menu-manifest.json"

FULL_SIZE = 512
FULL_MAX_W = 472
FULL_MAX_H = 484
FULL_BOTTOM_MARGIN = 12

PORTRAIT_SIZE = 256


def is_bg_pixel(r: int, g: int, b: int, a: int) -> bool:
    """Detecta fundo branco sólido ou chroma green com pequena tolerância."""
    if a <= 12:
        return True
    # Branco / quase branco neutro
    if min(r, g, b) >= 238 and (max(r, g, b) - min(r, g, b)) <= 20:
        return True
    # Chroma green (#00FF00)
    if g >= 210 and r <= 80 and b <= 80:
        return True
    return False


def remove_border_background(quad: Image.Image) -> Image.Image:
    """
    Remove apenas o fundo conectado às bordas do quadrante via flood-fill BFS,
    preservando detalhes brancos internos do personagem (roupas, olhos, cabelo).
    """
    rgba = quad.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    assert px is not None

    visited = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    def try_seed(x: int, y: int) -> None:
        idx = y * w + x
        if visited[idx]:
            return
        r, g, b, a = px[x, y]
        if is_bg_pixel(r, g, b, a):
            visited[idx] = 1
            q.append((x, y))

    for x in range(w):
        try_seed(x, 0)
        try_seed(x, h - 1)
    for y in range(h):
        try_seed(0, y)
        try_seed(w - 1, y)

    while q:
        cx, cy = q.popleft()
        px[cx, cy] = (0, 0, 0, 0)
        for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                idx = ny * w + nx
                if not visited[idx]:
                    r, g, b, a = px[nx, ny]
                    if is_bg_pixel(r, g, b, a):
                        visited[idx] = 1
                        q.append((nx, ny))

    # Suavização leve de 1px na borda adjacente ao fundo removido
    for y in range(1, h - 1):
        row_off = y * w
        for x in range(1, w - 1):
            if visited[row_off + x]:
                continue
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if min(r, g, b) >= 210 and (max(r, g, b) - min(r, g, b)) <= 24:
                if (
                    visited[row_off + x - 1]
                    or visited[row_off + x + 1]
                    or visited[row_off - w + x]
                    or visited[row_off + w + x]
                ):
                    lum = (r + g + b) / 3.0
                    new_a = max(0, min(255, int((255.0 - lum) * 4.0)))
                    px[x, y] = (r, g, b, min(a, new_a))

    return rgba


def split_2x2(sheet: Image.Image) -> list[Image.Image]:
    w, h = sheet.size
    hw, hh = w // 2, h // 2
    return [
        sheet.crop((0, 0, hw, hh)),          # Top-Left  -> fase_1
        sheet.crop((hw, 0, w, hh)),          # Top-Right -> fase_2
        sheet.crop((0, hh, hw, h)),          # Bottom-Left -> fase_3
        sheet.crop((hw, hh, w, h)),          # Bottom-Right -> fase_4
    ]


def build_fullbody_canvas(sprite: Image.Image) -> Image.Image:
    bbox = sprite.getbbox()
    if not bbox:
        return Image.new("RGBA", (FULL_SIZE, FULL_SIZE), (0, 0, 0, 0))
    cropped = sprite.crop(bbox)
    cw, ch = cropped.size
    scale = min(FULL_MAX_W / cw, FULL_MAX_H / ch)
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (FULL_SIZE, FULL_SIZE), (0, 0, 0, 0))
    ox = (FULL_SIZE - nw) // 2
    oy = FULL_SIZE - FULL_BOTTOM_MARGIN - nh
    canvas.paste(resized, (ox, oy), resized)
    return canvas


def build_portrait_from_fullbody(sprite: Image.Image) -> Image.Image:
    """Gera retrato 1:1 focado na metade superior (cabeça e ombros) do full-body."""
    bbox = sprite.getbbox()
    if not bbox:
        return Image.new("RGBA", (PORTRAIT_SIZE, PORTRAIT_SIZE), (0, 0, 0, 0))
    cropped = sprite.crop(bbox)
    cw, ch = cropped.size

    # Recorta os 45% superiores (cabeça + peito)
    head_h = max(1, int(round(ch * 0.45)))
    upper = cropped.crop((0, 0, cw, head_h))
    ubox = upper.getbbox()
    if ubox:
        upper = upper.crop(ubox)

    uw, uh = upper.size
    side = max(uw, uh)
    pad = int(round(side * 0.08))
    square = Image.new("RGBA", (side + pad * 2, side + pad * 2), (0, 0, 0, 0))
    ox = (square.width - uw) // 2
    oy = pad + (side - uh) // 3
    square.paste(upper, (ox, oy), upper)
    return square.resize((PORTRAIT_SIZE, PORTRAIT_SIZE), Image.Resampling.LANCZOS)


def build_portrait_from_dedicated(sprite: Image.Image) -> Image.Image:
    bbox = sprite.getbbox()
    if not bbox:
        return Image.new("RGBA", (PORTRAIT_SIZE, PORTRAIT_SIZE), (0, 0, 0, 0))
    cropped = sprite.crop(bbox)
    cw, ch = cropped.size
    scale = min((PORTRAIT_SIZE - 16) / cw, (PORTRAIT_SIZE - 16) / ch)
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (PORTRAIT_SIZE, PORTRAIT_SIZE), (0, 0, 0, 0))
    canvas.paste(resized, ((PORTRAIT_SIZE - nw) // 2, PORTRAIT_SIZE - nh), resized)
    return canvas


def main() -> None:
    if not RAW_DIR.exists():
        print(f"Pasta não encontrada: {RAW_DIR}")
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    full_files = sorted(RAW_DIR.glob("*_fullbody_2x2.png"))
    if not full_files:
        print(f"Nenhum *_fullbody_2x2.png encontrado em {RAW_DIR}")
        return

    manifest_chars: dict[str, dict[str, dict[str, dict[str, str]]]] = {}

    for full_path in full_files:
        char_id = full_path.name.replace("_fullbody_2x2.png", "")
        portrait_path: Optional[Path] = RAW_DIR / f"{char_id}_portrait_2x2.png"
        has_dedicated_portrait = portrait_path.exists()

        print(f"Processando {char_id}...")
        full_sheet = Image.open(full_path)
        full_quads = split_2x2(full_sheet)

        portrait_quads = (
            split_2x2(Image.open(portrait_path)) if has_dedicated_portrait else None
        )

        char_out_dir = OUT_DIR / char_id
        char_out_dir.mkdir(parents=True, exist_ok=True)
        phases_entry: dict[str, dict[str, str]] = {}

        for idx, quad in enumerate(full_quads, start=1):
            phase_key = f"fase_{idx}"
            clean_full = remove_border_background(quad)
            full_final = build_fullbody_canvas(clean_full)

            full_out_name = f"{phase_key}_full.png"
            full_final.save(char_out_dir / full_out_name, "PNG", optimize=True)

            if portrait_quads is not None:
                clean_port = remove_border_background(portrait_quads[idx - 1])
                port_final = build_portrait_from_dedicated(clean_port)
            else:
                port_final = build_portrait_from_fullbody(clean_full)

            port_out_name = f"{phase_key}_portrait.png"
            port_final.save(char_out_dir / port_out_name, "PNG", optimize=True)

            phases_entry[phase_key] = {
                "full": f"/assets/hud/characters/{char_id}/{full_out_name}",
                "portrait": f"/assets/hud/characters/{char_id}/{port_out_name}",
            }

        manifest_chars[char_id] = {"phases": phases_entry}

    manifest_data = {
        "version": 1,
        "characters": manifest_chars,
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest_data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Concluído! {len(manifest_chars)} personagens exportados para {OUT_DIR}")


if __name__ == "__main__":
    main()
